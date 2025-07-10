from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.persistence.database.models import TaskProgresses, Tasks
from app.persistence.database.session import get_session


router = APIRouter(prefix="/shared_tasks", tags=["shared_tasks"])


@router.get("/{task_id}")
async def get_shared_task(task_id: str, session: Session = Depends(get_session)):
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

    # Convert to dict for JSON response
    task_dict = task.model_dump()
    task_dict["progresses"] = [progress.model_dump() for progress in progresses]

    return {"data": task_dict, "error": None}
