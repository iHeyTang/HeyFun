from datetime import datetime
from typing import Any, Optional, Union

from pydantic import BaseModel, model_validator

from app.agent.react import ReActAgent
from app.context.browser import BrowserContextHelper
from app.context.toolcall import ToolCallContextHelper
from app.logger import logger
from app.prompt.funmax import NEXT_STEP_PROMPT, PLAN_PROMPT, SYSTEM_PROMPT
from app.schema import Message
from app.tool import Terminate, ToolCollection
from app.tool.base import BaseTool
from app.tool.bash import Bash
from app.tool.browser_use_tool import BrowserUseTool
from app.tool.create_chat_completion import CreateChatCompletion
from app.tool.deep_research import DeepResearch
from app.tool.file_operators import FileOperator
from app.tool.planning import PlanningTool
from app.tool.str_replace_editor import StrReplaceEditor
from app.tool.web_search import WebSearch
from app.utils.agent_event import BaseAgentEvents
from app.utils.prompt_template import template_manager


SYSTEM_TOOLS: list[BaseTool] = [
    Bash(),
    WebSearch(),
    DeepResearch(),
    BrowserUseTool(),
    FileOperator(),
    StrReplaceEditor(),
    PlanningTool(),
    CreateChatCompletion(),
]

SYSTEM_TOOLS_MAP = {tool.name: tool.__class__ for tool in SYSTEM_TOOLS}


class McpToolConfig(BaseModel):
    id: str
    name: str
    # for stdio
    command: str
    args: list[str]
    env: dict[str, str]
    # for sse
    url: str
    headers: dict[str, Any]


class FunMax(ReActAgent):
    """A versatile general-purpose agent."""

    name: str = "FunMax"
    description: str = (
        "A versatile agent that can solve various tasks using multiple tools"
    )

    language: str
    tools: list[Union[McpToolConfig, str]]
    task_request: str
    history: list[dict[str, Any]]
    custom_prompt_templates: dict[str, str] = {}

    # Override parent class fields to make them non-optional
    system_prompt: str = ""
    next_step_prompt: str = ""

    _tool_call_context_helper: Optional[ToolCallContextHelper] = None
    _browser_context_helper: Optional[BrowserContextHelper] = None

    @property
    def tool_call_context_helper(self) -> ToolCallContextHelper:
        if self._tool_call_context_helper is None:
            raise RuntimeError("tool_call_context_helper is not initialized")
        return self._tool_call_context_helper

    @property
    def browser_context_helper(self) -> BrowserContextHelper:
        if self._browser_context_helper is None:
            raise RuntimeError("browser_context_helper is not initialized")
        return self._browser_context_helper

    @model_validator(mode="after")
    def initialize_helper(self) -> "FunMax":
        organization_id, task_id = self.task_id.split("/")
        self.task_dir = f"/workspace/{organization_id}/{task_id}"

        self.system_prompt_template = self.custom_prompt_templates.get(
            "system_prompt", SYSTEM_PROMPT
        )
        self.next_step_prompt_template = self.custom_prompt_templates.get(
            "next_step_prompt", NEXT_STEP_PROMPT
        )
        self.plan_prompt_template = self.custom_prompt_templates.get(
            "plan_prompt", PLAN_PROMPT
        )

        self.system_prompt = template_manager.render_template_safe(
            self.system_prompt_template,
            task_id=task_id,
            name=self.name,
            language=self.language or "English",
            max_steps=self.max_steps,
            current_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC"),
        )
        self.next_step_prompt = template_manager.render_template_safe(
            self.next_step_prompt_template,
            max_steps=self.max_steps,
            current_step=self.current_step,
            remaining_steps=self.max_steps - self.current_step,
        )
        return self

    async def prepare(self) -> None:
        """Prepare the agent for execution."""
        await super().prepare()

        await self.update_memory(
            role="system", content=self.system_prompt, base64_image=None
        )

        if self.history:
            for message in self.history:
                await self.update_memory(
                    role=message["role"], content=message["message"]
                )

        self._browser_context_helper = BrowserContextHelper(self)
        self._tool_call_context_helper = ToolCallContextHelper(self)
        self.tool_call_context_helper.available_tools = ToolCollection(Terminate())

        if self.tools:
            for tool in self.tools:
                if isinstance(tool, str) and tool in SYSTEM_TOOLS_MAP:
                    inst = SYSTEM_TOOLS_MAP[tool]()
                    await self.tool_call_context_helper.add_tool(inst)
                    if hasattr(inst, "llm"):
                        inst.llm = self.llm
                    if hasattr(inst, "sandbox"):
                        inst.sandbox = self.sandbox
                elif isinstance(tool, McpToolConfig):
                    await self.tool_call_context_helper.add_mcp(
                        {
                            "client_id": tool.id,
                            "url": tool.url,
                            "command": tool.command,
                            "args": tool.args,
                            "env": tool.env,
                            "headers": tool.headers,
                        }
                    )
        summary = await self.llm.ask(
            [Message.user_message(self.task_request)],
            [
                Message.system_message(
                    "Summarize the requirements or tasks provided by the user, Ensure that the core of the task can be reflected, answer in the user's language within 15 characters"
                )
            ],
        )
        self.emit(BaseAgentEvents.LIFECYCLE_SUMMARY, {"summary": summary})
        print(summary)
        print("--------------------------------")
        print(
            f"prepare success, available tools: {', '.join([tool.name for tool in self.tool_call_context_helper.available_tools.tools])}"
        )

    async def plan(self) -> str:
        """Create an initial plan based on the user request."""
        # Create planning message
        self.emit(BaseAgentEvents.LIFECYCLE_PLAN_START, {})

        plan_prompt = template_manager.render_template_safe(
            self.plan_prompt_template,
            language=self.language or "English",
            max_steps=self.max_steps,
            available_tools="\n".join(
                [
                    f"- {tool.name}: {tool.description}"
                    for tool in self.tool_call_context_helper.available_tools
                ]
            ),
        )
        planning_message = await self.llm.ask(
            [
                Message.system_message(plan_prompt),
                Message.user_message(self.task_request),
            ],
            system_msgs=[Message.system_message(self.system_prompt)],
        )

        # Add the planning message to memory
        await self.update_memory("user", planning_message)
        self.emit(BaseAgentEvents.LIFECYCLE_PLAN_COMPLETE, {"plan": planning_message})
        return planning_message

    async def think(self) -> bool:
        """Process current state and decide next actions with appropriate context."""
        # Update next_step_prompt with current step information
        original_prompt = self.next_step_prompt
        self.next_step_prompt = template_manager.render_template_safe(
            self.next_step_prompt_template,
            max_steps=self.max_steps,
            current_step=self.current_step,
            remaining_steps=self.max_steps - self.current_step,
        )

        browser_in_use = self._check_browser_in_use_recently()

        if browser_in_use:
            self.next_step_prompt = (
                await self.browser_context_helper.format_next_step_prompt()
            )

        result = await self.tool_call_context_helper.ask_tool()

        # Restore original prompt
        self.next_step_prompt = original_prompt

        return result

    async def act(self) -> str:
        """Execute decided actions"""
        results = await self.tool_call_context_helper.execute_tool()
        return "\n\n".join(results)

    def _check_browser_in_use_recently(self) -> bool:
        """Check if the browser is in use by looking at the last 3 messages."""
        recent_messages = self.memory.messages[-3:] if self.memory.messages else []
        browser_in_use = any(
            tc.function.name == BrowserUseTool().name
            for msg in recent_messages
            if msg.tool_calls
            for tc in msg.tool_calls
        )
        return browser_in_use

    async def cleanup(self):
        """Clean up agent resources."""
        logger.info(f"🧹 Cleaning up resources for agent '{self.name}'...")
        if self.browser_context_helper:
            await self.browser_context_helper.cleanup_browser()
        if self.tool_call_context_helper:
            await self.tool_call_context_helper.cleanup_tools()
        await super().cleanup()
        logger.info(f"✨ Cleanup complete for agent '{self.name}'.")
