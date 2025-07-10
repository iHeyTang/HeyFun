import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any, List, Optional, Union, cast

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
from sqlmodel import Session, desc, select

from app.agent.funmax import FunMax, McpToolConfig
from app.apis.request_context import RequestContext, get_request_context
from app.apis.services.task_manager import task_manager
from app.config import LLMSettings, config
from app.llm import LLM
from app.logger import logger
from app.persistence.database.models import TaskProgresses, Tasks
from app.persistence.database.session import get_session


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


@router.get("")
async def get_tasks_paginated(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    context: RequestContext = Depends(get_request_context),
):
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

    return {
        "tasks": [task.model_dump() for task in tasks],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{organization_id}/{task_id}")
async def get_task(
    organization_id: str,
    task_id: str,
    context: RequestContext = Depends(get_request_context),
):
    """Get task details with progresses"""
    task = context.db.exec(
        select(Tasks).where(
            Tasks.id == task_id, Tasks.organizationId == organization_id
        )
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Get task progresses
    progresses = context.db.exec(
        select(TaskProgresses).where(TaskProgresses.taskId == task_id).order_by("index")
    ).all()

    # Convert to dict for JSON response
    task_dict = task.model_dump()
    task_dict["progresses"] = [progress.model_dump() for progress in progresses]

    return task_dict


@router.post("")
async def create_task(
    task_id: str = Form(...),
    prompt: str = Form(...),
    should_plan: bool = Form(False),
    tools: Optional[list[str]] = Form(None),
    preferences: Optional[str] = Form(None),
    llm_config: Optional[str] = Form(None),
    history: Optional[str] = Form(None),
    prompts: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    session: Session = Depends(get_session),
):
    print(
        f"Creating task {task_id} with prompt: {prompt}, should_plan: {should_plan}, tools: {tools}, preferences: {preferences}, llm_config: {llm_config}"
    )
    # Parse preferences and llm_config from JSON strings
    preferences_dict: dict[str, Any] = {}
    if preferences:
        try:
            preferences_dict = json.loads(preferences)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid preferences JSON format: {str(e)}",
            )

    llm_config_obj = None
    if llm_config:
        try:
            llm_config_obj = LLMSettings.model_validate_json(llm_config)
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Invalid llm_config format: {str(e)}"
            )

    history_list = []
    if history:
        try:
            history_list: list[dict[str, Any]] = json.loads(history)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid history JSON format")

    processed_tools = parse_tools(tools or [])

    if task_id in task_manager.tasks:
        task = task_manager.tasks[task_id]
        await task.agent.terminate()

    custom_prompt_templates: dict[str, str] = {}
    if prompts:
        try:
            custom_prompt_templates = json.loads(prompts)
        except json.JSONDecodeError:
            logger.error(f"Invalid prompts JSON format: {prompts}, use default prompts")

    task = task_manager.create_task(
        task_id,
        FunMax(
            name=AGENT_NAME,
            description="A versatile agent that can solve various tasks using multiple tools",
            task_id=task_id,
            should_plan=should_plan,
            llm=LLM(config_name=task_id, llm_config=llm_config_obj),
            enable_event_queue=True,
            max_steps=preferences_dict.get("max_steps", 20),
            language=preferences_dict.get("language", "English"),
            tools=processed_tools,
            task_request=prompt,
            history=history_list,
            sandbox=None,
            custom_prompt_templates=custom_prompt_templates,
        ),
    )

    if files:
        import os

        task_dir = Path(
            os.path.join(
                config.workspace_root,
                task.agent.task_dir.replace("/workspace/", ""),
            )
        )
        task_dir.mkdir(parents=True, exist_ok=True)

        for file in files or []:
            file = cast(UploadFile, file)
            try:
                safe_filename = Path(file.filename).name if file.filename else None
                if not safe_filename:
                    raise HTTPException(status_code=400, detail="Invalid filename")

                file_path = task_dir / safe_filename

                MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
                file_content = file.file.read()
                if len(file_content) > MAX_FILE_SIZE:
                    raise HTTPException(status_code=400, detail="File too large")

                with open(file_path, "wb") as f:
                    f.write(file_content)

            except Exception as e:
                logger.error(f"Error saving file {file.filename}: {str(e)}")
                raise HTTPException(
                    status_code=500, detail=f"Error saving file: {str(e)}"
                )
        prompt = (
            prompt
            + "\n\n"
            + "Here are the files I have uploaded: "
            + "\n\n".join([f"File: {file.filename}" for file in files])
        )

    asyncio.create_task(task_manager.run_task(task.id, prompt))
    return {"task_id": task.id}


@router.get("/{organization_id}/{task_id}/events")
async def task_events(organization_id: str, task_id: str):
    return StreamingResponse(
        task_manager.event_generator(f"{organization_id}/{task_id}"),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/terminate")
async def terminate_task(task_id: str = Body(..., embed=True)):
    """Terminate a task immediately.

    Args:
        task_id: The ID of the task to terminate
    """
    if task_id not in task_manager.tasks:
        return {"message": f"Task {task_id} not found"}

    task = task_manager.tasks[task_id]
    await task.agent.terminate()

    return {"message": f"Task {task_id} terminated successfully", "task_id": task_id}


@router.post("/{organization_id}/{task_id}/share")
async def share_task(
    organization_id: str,
    task_id: str,
    expires_at: int = Body(..., embed=True),
    session: Session = Depends(get_session),
):
    """Share a task with expiration time"""
    task = session.exec(
        select(Tasks).where(
            Tasks.id == task_id, Tasks.organizationId == organization_id
        )
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Update task with share expiration
    task.shareExpiresAt = datetime.fromtimestamp(
        expires_at / 1000
    )  # Convert from milliseconds
    session.add(task)
    session.commit()
    session.refresh(task)

    return {"message": "Task shared successfully", "task_id": task_id}
