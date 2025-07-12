from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.persistence.database.models import TaskProgresses, Tasks
from app.persistence.database.session import get_session


router = APIRouter(prefix="/shared_tasks", tags=["shared_tasks"])


class SharedTaskResponse(BaseModel):
    """Response model for shared task with progresses"""

    id: str
    organizationId: str
    outId: str | None
    llmId: str
    summary: str | None
    prompt: str
    status: str
    tools: dict
    shareExpiresAt: datetime | None
    createdAt: datetime
    updatedAt: datetime
    progresses: list[TaskProgresses]


@router.get("/{task_id}")
async def get_shared_task(
    task_id: str, session: Session = Depends(get_session)
) -> SharedTaskResponse:
    """Get a shared task by ID"""
    task = session.exec(select(Tasks).where(Tasks.id == task_id)).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Check if share has expired
    if task.shareExpiresAt and task.shareExpiresAt < datetime.now():
        raise HTTPException(status_code=410, detail="Task share link expired")

    # Get task progresses
    progresses = session.exec(
        select(TaskProgresses)
        .where(
            TaskProgresses.taskId == task.id,
            getattr(TaskProgresses, "type").in_(
                ["agent:lifecycle:start", "agent:lifecycle:complete"]
            ),
        )
        .order_by("index")
    ).all()

    # Create response object
    response = SharedTaskResponse(
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
        progresses=list(progresses),
    )

    return response
