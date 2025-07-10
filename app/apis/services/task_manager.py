import asyncio
from datetime import datetime
from json import dumps
from typing import Dict, Optional

from sqlmodel import Session, asc, select

from app.agent.funmax import FunMax
from app.apis.models.task import Task
from app.logger import logger
from app.persistence.database import TaskProgresses, Tasks
from app.persistence.database.session import get_session
from app.utils.agent_event import BaseAgentEvents, EventItem


class TaskManager:
    def __init__(self):
        self.tasks: Dict[str, Task] = {}
        self.histories: Dict[str, list] = {}

    async def run_task(self, task_id: str, prompt: str):
        """Run the task and set up corresponding event handlers.

        Args:
            task_id: Task ID
            prompt: Task prompt
            llm_config: Optional LLM configuration
        """
        try:
            task = self.tasks[task_id]
            agent = task.agent

            # Set up event handlers based on all event types defined in the Agent class hierarchy
            event_patterns = [r"agent:.*"]
            # Register handlers for each event pattern
            for pattern in event_patterns:
                agent.on(
                    pattern,
                    lambda event: self.update_task_progress(
                        task_id=task_id,
                        event=event,
                    ),
                )

            # Run the agent
            await agent.run(prompt)
            await agent.cleanup()
            asyncio.create_task(self.delayed_remove(task_id))

        except Exception as e:
            logger.error(f"Error in task {task_id}: {str(e)}")

    def create_task(
        self, task_id: str, agent: FunMax, organization_id: Optional[str] = None
    ) -> Task:
        task = Task(
            id=task_id,
            created_at=datetime.now(),
            agent=agent,
            organization_id=organization_id,
        )
        self.tasks[task_id] = task
        self.histories[task_id] = []
        return task

    async def update_task_progress(self, task_id: str, event: EventItem):
        """Update task progress and persist to database"""
        if task_id in self.tasks:
            event_dict = {
                "index": len(self.histories[task_id]),
                "id": event.id,
                "parent_id": event.parent_id,
                "type": "progress",
                "name": event.name,
                "step": event.step,
                "content": event.content,
            }
            self.histories[task_id].append(event_dict)

            # Persist to database
            await self._persist_task_progress(task_id, event)

    async def _persist_task_progress(self, task_id: str, event: EventItem):
        """Persist task progress to database"""
        try:
            for session in get_session():
                # Get existing task progresses to determine index and round
                result = session.exec(
                    select(TaskProgresses)
                    .where(TaskProgresses.taskId == task_id)
                    .order_by(asc(TaskProgresses.index))
                )
                task_progresses = result.all()

                rounds = [progress.round for progress in task_progresses]
                round_num = max(rounds, default=1)
                message_index = len(task_progresses)

                # for backward compatibility, event_name is used in the past
                event_type = event.name or getattr(event, "event_name", event.name)

                # Handle special event types
                if event_type == "agent:lifecycle:summary":
                    self._update_task_summary(
                        session, task_id, event.content.get("summary")
                    )
                    return

                # Get organization_id from task
                task = self.tasks.get(task_id)
                organization_id = (
                    task.organization_id if task and task.organization_id else task_id
                )

                # Create task progress record
                task_progress = TaskProgresses(
                    taskId=task_id,
                    organizationId=organization_id,
                    index=message_index,
                    round=round_num,
                    step=event.step,
                    type=event_type,
                    content=event.content,
                )

                session.add(task_progress)
                session.commit()

                # Handle lifecycle events
                if event_type == "agent:lifecycle:complete":
                    self._update_task_status(session, task_id, "completed")
                elif event_type == "agent:lifecycle:terminating":
                    self._update_task_status(session, task_id, "terminating")
                elif event_type == "agent:lifecycle:terminated":
                    self._update_task_status(session, task_id, "terminated")
                break

        except Exception as e:
            logger.error(
                f"Failed to persist task progress for task {task_id}: {str(e)}"
            )

    def _update_task_summary(self, session: Session, task_id: str, summary: str):
        """Update task summary in database"""
        try:
            result = session.exec(select(Tasks).where(Tasks.id == task_id))
            task = result.first()
            if task:
                task.summary = summary
                session.commit()
        except Exception as e:
            logger.error(f"Failed to update task summary for task {task_id}: {str(e)}")

    def _update_task_status(self, session: Session, task_id: str, status: str):
        """Update task status in database"""
        try:
            result = session.exec(select(Tasks).where(Tasks.id == task_id))
            task = result.first()
            if task:
                task.status = status
                session.commit()
        except Exception as e:
            logger.error(f"Failed to update task status for task {task_id}: {str(e)}")

    async def terminate_task(self, task_id: str):
        if task_id in self.tasks:
            task = self.tasks[task_id]
            await task.agent.terminate()

    async def remove_task(self, task_id: str):
        if task_id in self.tasks:
            del self.tasks[task_id]
            del self.histories[task_id]

    async def event_generator(self, task_id: str):
        if task_id not in self.histories:
            yield f"event: error\ndata: {dumps({'message': 'Task not found'})}\n\n"
            return

        last_index = 0
        heartbeat_interval = 5  # heartbeat interval in seconds
        last_event_time = asyncio.get_event_loop().time()
        while True:
            history = self.histories.get(task_id, [])
            new_events = history[last_index:]
            if new_events:
                for event in new_events:
                    yield f"data: {dumps(event)}\n\n"
                    if event.get("name") == BaseAgentEvents.LIFECYCLE_COMPLETE:
                        return
                last_index = len(history)
                last_event_time = asyncio.get_event_loop().time()
            else:
                now = asyncio.get_event_loop().time()
                if now - last_event_time >= heartbeat_interval:
                    yield ":heartbeat\n\n"
                    last_event_time = now
            await asyncio.sleep(0.5)

    async def delayed_remove(self, task_id: str, delay: int = 1800):
        await asyncio.sleep(delay)
        await self.remove_task(task_id)


task_manager = TaskManager()
