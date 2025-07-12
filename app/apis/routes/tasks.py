import asyncio
import base64
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union, cast
from urllib.parse import urlparse

import requests
from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlmodel import Session, desc, select

from app.agent.funmax import FunMax, McpToolConfig
from app.apis.request_context import RequestContext, get_request_context
from app.apis.services.task_manager import task_manager
from app.config import LLMSettings, config
from app.llm import LLM
from app.logger import logger
from app.persistence.database.models import (
    LlmConfigs,
    Preferences,
    TaskProgresses,
    Tasks,
)
from app.persistence.database.session import get_session
from app.utils.encrypt import decrypt_with_private_key


# Response Models
class TaskResponse(BaseModel):
    """Task response model"""

    id: str
    organizationId: str
    outId: Optional[str]
    llmId: str
    summary: Optional[str]
    prompt: str
    status: str
    tools: List[Union[str, Dict[str, Any]]]
    shareExpiresAt: Optional[datetime]
    createdAt: datetime
    updatedAt: datetime


class TaskProgressResponse(BaseModel):
    """Task progress response model"""

    id: str
    organizationId: str
    taskId: str
    index: int
    round: int
    step: int
    type: str
    content: Dict[str, Any]
    createdAt: datetime
    updatedAt: datetime


class TaskWithProgressesResponse(BaseModel):
    """Task with progresses response model"""

    id: str
    organizationId: str
    outId: Optional[str]
    llmId: str
    summary: Optional[str]
    prompt: str
    status: str
    tools: Dict[str, Any]
    shareExpiresAt: Optional[datetime]
    createdAt: datetime
    updatedAt: datetime
    progresses: List[TaskProgressResponse]


class PaginatedTasksResponse(BaseModel):
    """Paginated tasks response model"""

    tasks: List[TaskResponse]
    total: int
    page: int
    page_size: int


class CreateTaskResponse(BaseModel):
    """Create task response model"""

    task_id: str


class TerminateTaskResponse(BaseModel):
    """Terminate task response model"""

    message: str
    task_id: str


class ShareTaskResponse(BaseModel):
    """Share task response model"""

    message: str
    task_id: str


# Request Models
class FileData(BaseModel):
    """File data model for create task request"""

    name: str = Field(..., description="File name")
    content: Optional[str] = Field(None, description="Base64 encoded file content")
    url: Optional[str] = Field(None, description="URL to download file from")

    def model_post_init(self, __context: Any) -> None:
        """Validate that either content or url is provided"""
        if not self.content and not self.url:
            raise ValueError("Either content (base64) or url must be provided")
        if self.content and self.url:
            raise ValueError("Cannot provide both content and url")


class CreateTaskRequest(BaseModel):
    """Create task request model"""

    class LLMConfig(BaseModel):
        modelId: str

    task_id: str = Field(..., description="Task ID")
    llm_config: LLMConfig = Field(..., description="LLM configuration")
    should_plan: bool = Field(False, description="Whether to use planning mode")
    prompt: str = Field(..., description="Task prompt")
    tools: Optional[List[str]] = Field(
        None, description="List of tool names or MCP configs"
    )
    files: Optional[List[FileData]] = Field(None, description="Files to upload")


class TerminateTaskRequest(BaseModel):
    """Terminate task request model"""

    task_id: str


class ShareTaskRequest(BaseModel):
    """Share task request model"""

    expires_at: int


router = APIRouter(prefix="/tasks", tags=["tasks"])

AGENT_NAME = "FunMax"


def parse_tools(tools: list[str]) -> list[Union[str, McpToolConfig]]:
    """Parse tools list which may contain both tool names and MCP configurations.

    Args:
        tools: List of tool strings, which can be either tool names or MCP config JSON strings

    Returns:
        List of processed tools, containing both tool names and McpToolConfig objects

    Raises:
        HTTPException: If any tool configuration is invalid
    """
    processed_tools = []
    for tool in tools:
        try:
            tool_config = json.loads(tool)
            if isinstance(tool_config, dict):
                mcp_tool = McpToolConfig.model_validate(tool_config)
                processed_tools.append(mcp_tool)
            else:
                processed_tools.append(tool)
        except json.JSONDecodeError:
            processed_tools.append(tool)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid tool configuration for '{tool}': {str(e)}",
            )
    return processed_tools


async def download_file_from_url(url: str, max_size: int = 10 * 1024 * 1024) -> bytes:
    """Download file from URL with size limit"""
    try:
        # Validate URL
        parsed_url = urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            raise ValueError("Invalid URL format")

        # Download file
        response = requests.get(url, timeout=30, stream=True)
        response.raise_for_status()

        # Check content length if available
        content_length = response.headers.get("content-length")
        if content_length and int(content_length) > max_size:
            raise ValueError(f"File too large: {content_length} bytes")

        # Read content with size limit
        content = b""
        for chunk in response.iter_content(chunk_size=8192):
            content += chunk
            if len(content) > max_size:
                raise ValueError(f"File too large: exceeds {max_size} bytes")

        return content
    except requests.RequestException as e:
        raise HTTPException(
            status_code=400, detail=f"Failed to download file from URL: {str(e)}"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def decode_base64_content(content: str, max_size: int = 10 * 1024 * 1024) -> bytes:
    """Decode base64 content with size limit"""
    try:
        # Remove data URL prefix if present
        if content.startswith("data:"):
            content = content.split(",", 1)[1]

        # Decode base64
        decoded_content = base64.b64decode(content)

        if len(decoded_content) > max_size:
            raise ValueError(f"File too large: {len(decoded_content)} bytes")

        return decoded_content
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 content: {str(e)}")


@router.get("", response_model=PaginatedTasksResponse)
async def get_tasks_paginated(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    context: RequestContext = Depends(get_request_context),
) -> PaginatedTasksResponse:
    """Get paginated tasks for an organization"""
    offset = (page - 1) * page_size

    current_organization = await context.current_organization
    tasks = context.db.exec(
        select(Tasks)
        .where(Tasks.organizationId == current_organization.id)
        .order_by(desc(Tasks.createdAt))
        .offset(offset)
        .limit(page_size)
    ).all()

    total = len(
        context.db.exec(
            select(Tasks).where(Tasks.organizationId == current_organization.id)
        ).all()
    )

    return PaginatedTasksResponse(
        tasks=[
            TaskResponse(
                id=task.id,
                organizationId=task.organizationId,
                outId=task.outId,
                llmId=task.llmId,
                summary=task.summary,
                prompt=task.prompt,
                status=task.status,
                tools=task.tools,
                shareExpiresAt=task.shareExpiresAt,
                createdAt=task.createdAt,
                updatedAt=task.updatedAt,
            )
            for task in tasks
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    context: RequestContext = Depends(get_request_context),
) -> TaskResponse:
    """Get task details"""
    organization = await context.current_organization
    task = context.db.exec(
        select(Tasks).where(
            Tasks.id == task_id, Tasks.organizationId == organization.id
        )
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return TaskResponse(
        id=task.id,
        organizationId=task.organizationId,
        outId=task.outId,
        llmId=task.llmId,
        summary=task.summary,
        prompt=task.prompt,
        status=task.status,
        tools=task.tools,
        shareExpiresAt=task.shareExpiresAt,
        createdAt=task.createdAt,
        updatedAt=task.updatedAt,
    )


@router.post("", response_model=CreateTaskResponse)
async def create_task(
    body: CreateTaskRequest = Body(...),
    context: RequestContext = Depends(get_request_context),
) -> CreateTaskResponse:
    """Create a new task with JSON body"""
    print(
        f"Creating task {body.task_id} with prompt: {body.prompt}, should_plan: {body.should_plan}, tools: {body.tools}, llm_config: {body.llm_config}"
    )
    current_organization = await context.current_organization

    # Process tools
    processed_tools = parse_tools(body.tools or [])

    preferences = context.db.exec(
        select(Preferences).where(Preferences.organizationId == current_organization.id)
    ).first()
    if not preferences:
        raise HTTPException(status_code=400, detail="Preferences not found")

    llm_config = context.db.exec(
        select(LlmConfigs).where(LlmConfigs.id == body.llm_config.modelId)
    ).first()
    if not llm_config:
        raise HTTPException(status_code=400, detail="LLM config not found")

    history = context.db.exec(
        select(TaskProgresses)
        .where(TaskProgresses.taskId == body.task_id)
        .order_by(desc(TaskProgresses.createdAt))
    ).all()

    # Create task
    task = await task_manager.create_task(
        task_id=body.task_id,
        organization_id=current_organization.id,
        llm_id=llm_config.id,
        prompt=body.prompt,
        tools=processed_tools,
    )

    # Handle files if provided
    # if body.files:
    #     import os

    #     task_dir = Path(
    #         os.path.join(
    #             config.workspace_root,
    #             task.agent.task_dir.replace("/workspace/", ""),
    #         )
    #     )
    #     task_dir.mkdir(parents=True, exist_ok=True)

    #     uploaded_files = []
    #     for file_data in body.files:
    #         try:
    #             # Validate filename
    #             safe_filename = Path(file_data.name).name
    #             if not safe_filename:
    #                 raise HTTPException(status_code=400, detail="Invalid filename")

    #             file_path = task_dir / safe_filename

    #             # Get file content
    #             if file_data.content:
    #                 # Decode base64 content
    #                 file_content = decode_base64_content(file_data.content)
    #             elif file_data.url:
    #                 # Download from URL
    #                 file_content = await download_file_from_url(file_data.url)
    #             else:
    #                 raise HTTPException(
    #                     status_code=400, detail="File must have either content or url"
    #                 )

    #             # Write file
    #             with open(file_path, "wb") as f:
    #                 f.write(file_content)

    #             uploaded_files.append(file_data.name)

    #         except Exception as e:
    #             logger.error(f"Error saving file {file_data.name}: {str(e)}")
    #             raise HTTPException(
    #                 status_code=500,
    #                 detail=f"Error saving file {file_data.name}: {str(e)}",
    #             )

    #     # Add file information to prompt
    #     body.prompt = (
    #         body.prompt
    #         + "\n\n"
    #         + "Here are the files I have uploaded: "
    #         + "\n\n".join([f"File: {filename}" for filename in uploaded_files])
    #     )

    # Decrypt and mask API keys
    private_key_path = Path(Path.cwd()) / "keys" / "private.pem"
    if not private_key_path.exists():
        raise HTTPException(status_code=500, detail="Private key not found")

    private_key = private_key_path.read_text("utf-8")

    # Start task
    agent = FunMax(
        name=AGENT_NAME,
        description="A versatile agent that can solve various tasks using multiple tools",
        workspace_root=current_organization.id,
        task_id=task.id,
        should_plan=task.should_plan,
        llm=LLM(
            config_name=task.llmId,
            llm_config=LLMSettings(
                model=llm_config.model,
                base_url=llm_config.baseUrl,
                api_key=decrypt_with_private_key(llm_config.apiKey, private_key),
                api_type=llm_config.apiType,
                api_version=llm_config.apiVersion or "",
                max_tokens=llm_config.maxTokens,
                max_input_tokens=llm_config.maxInputTokens or None,
                temperature=llm_config.temperature,
            ),
        ),
        enable_event_queue=True,
        max_steps=20,
        language=preferences.language or "English",
        tools=processed_tools,
        task_request=task.prompt,
        history=[progress.model_dump() for progress in history],
        sandbox=None,
    )
    task_manager.run_task_asyncio(task.id, agent)
    return CreateTaskResponse(task_id=task.id)


@router.get("/{task_id}/events")
async def task_events(
    task_id: str, context: RequestContext = Depends(get_request_context)
) -> StreamingResponse:
    """Get task events as server-sent events stream"""
    organization = await context.current_organization
    return StreamingResponse(
        task_manager.event_generator(organization.id, task_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{task_id}/terminate", response_model=TerminateTaskResponse)
async def terminate_task(
    task_id: str,
) -> TerminateTaskResponse:
    """Terminate a task immediately.

    Args:
        request: The request containing the task ID to terminate
    """
    task = task_manager.get_task(task_id)
    if not task:
        return TerminateTaskResponse(
            message=f"Task {task_id} not found", task_id=task_id
        )

    task = task_manager.get_task(task_id)
    if task:
        await task.terminate()

    return TerminateTaskResponse(
        message=f"Task {task_id} terminated successfully", task_id=task_id
    )


@router.post("/{task_id}/share", response_model=ShareTaskResponse)
async def share_task(
    task_id: str,
    request: ShareTaskRequest = Body(...),
    context: RequestContext = Depends(get_request_context),
) -> ShareTaskResponse:
    """Share a task with expiration time"""
    organization = await context.current_organization
    task = context.db.exec(
        select(Tasks).where(
            Tasks.id == task_id, Tasks.organizationId == organization.id
        )
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Update task with share expiration
    task.shareExpiresAt = datetime.fromtimestamp(
        request.expires_at / 1000
    )  # Convert from milliseconds
    context.db.add(task)
    context.db.commit()
    context.db.refresh(task)

    return ShareTaskResponse(message="Task shared successfully", task_id=task_id)
