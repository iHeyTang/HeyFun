import asyncio
from json import dumps
from typing import Dict, List, Optional

from pydantic import BaseModel
from sqlmodel import Session, asc, select

from app.agent.funmax import FunMax
from app.logger import logger
from app.persistence.database import TaskProgresses, Tasks
from app.persistence.database.session import get_session
from app.utils.agent_event import BaseAgentEvents, EventItem
from app.utils.snowflake import generate_snowflake_id_str


class Task(BaseModel):
    id: str
    organizationId: str
    status: str = "pending"
    llmId: str = ""
    prompt: str = ""
    tools: list = []
    should_plan: bool = False
    agent: Optional[FunMax] = None
    history: List[Dict] = []

    @classmethod
    async def init_new_task(
        cls,
        organization_id: str,
        task_id: str,
        llm_id: str,
        prompt: str,
        tools: list,
        should_plan: bool = False,
    ) -> "Task":
        task = cls(
            id=task_id or generate_snowflake_id_str(),
            organizationId=organization_id,
            llmId=llm_id,
            prompt=prompt,
            tools=tools,
            should_plan=should_plan,
        )

        # 在数据库中创建任务记录
        try:
            for session in get_session():
                # 检查任务是否已存在
                existing_task = session.exec(
                    select(Tasks).where(Tasks.id == task.id)
                ).first()

                if not existing_task:
                    # 创建新的任务记录
                    task_record = Tasks(
                        id=task.id,
                        organizationId=organization_id,
                        llmId=task.llmId,
                        prompt=task.prompt,
                        status="pending",
                        tools=task.tools,
                    )
                    session.add(task_record)
                    session.commit()
                    logger.info(f"Created task record in database: {task.id}")
                break
        except Exception as e:
            logger.error(f"Failed to create task record in database: {str(e)}")
            # 即使数据库插入失败，也返回内存中的任务对象

        return task

    @classmethod
    async def restore_from_database(
        cls, organization_id: str, task_id: str
    ) -> Optional["Task"]:
        """从数据库还原Task实例"""
        try:
            for session in get_session():
                # 获取任务基本信息
                task_result = session.exec(
                    select(Tasks).where(
                        Tasks.id == task_id, Tasks.organizationId == organization_id
                    )
                )
                task_data = task_result.first()

                if not task_data:
                    logger.warning(f"Task {task_id} not found in database")
                    return None

                # 获取任务进度历史
                progress_result = session.exec(
                    select(TaskProgresses)
                    .where(TaskProgresses.taskId == task_id)
                    .order_by(asc(TaskProgresses.index))
                )
                task_progresses = progress_result.all()

                # 构建历史记录
                history = []
                for progress in task_progresses:
                    event_dict = {
                        "index": progress.index,
                        "id": f"event_{progress.index}",
                        "parent_id": None,
                        "type": "progress",
                        "name": progress.type,
                        "step": progress.step,
                        "content": progress.content,
                    }
                    history.append(event_dict)

                # 创建Task实例
                task = cls(
                    id=task_data.id,
                    organizationId=task_data.organizationId,
                    status=task_data.status,
                    llmId=task_data.llmId,
                    prompt=task_data.prompt,
                    tools=task_data.tools,
                    history=history,
                )

                logger.info(
                    f"Successfully restored task {task_id} from database with {len(history)} events"
                )
                return task

        except Exception as e:
            logger.error(f"Failed to restore task {task_id} from database: {str(e)}")
            return None

    async def add_event(self, event: EventItem):
        event_dict = {
            "index": len(self.history),
            "id": event.id,
            "parent_id": event.parent_id,
            "type": "progress",
            "name": event.name,
            "step": event.step,
            "content": event.content,
        }
        self.history.append(event_dict)
        await self.persist_event(event)

    async def run(self, agent: FunMax):
        try:
            self.agent = agent
            event_patterns = [r"agent:.*"]
            for pattern in event_patterns:
                agent.on(pattern, lambda event: self.add_event(event))
            await agent.run(self.prompt)
            await agent.cleanup()
        except Exception as e:
            logger.error(f"Error in task {self.id}: {str(e)}")

    async def terminate(self):
        if self.agent:
            await self.agent.terminate()

    async def event_generator(self):
        last_index = 0
        heartbeat_interval = 5
        last_event_time = asyncio.get_event_loop().time()
        while True:
            new_events = self.history[last_index:]
            if new_events:
                for event in new_events:
                    yield f"data: {dumps(event)}\n\n"
                    if event.get("name") == BaseAgentEvents.LIFECYCLE_COMPLETE:
                        # 发送明确的结束信号
                        yield f"event: complete\ndata: {dumps({'message': 'Task completed'})}\n\n"
                        return
                    elif event.get("name") == BaseAgentEvents.LIFECYCLE_TERMINATED:
                        # 发送终止信号
                        yield f"event: terminated\ndata: {dumps({'message': 'Task terminated'})}\n\n"
                        return
                last_index = len(self.history)
                last_event_time = asyncio.get_event_loop().time()
            else:
                now = asyncio.get_event_loop().time()
                if now - last_event_time >= heartbeat_interval:
                    yield ":heartbeat\n\n"
                    last_event_time = now
            await asyncio.sleep(0.5)

    async def persist_event(self, event: EventItem):
        try:
            for session in get_session():
                result = session.exec(
                    select(TaskProgresses)
                    .where(TaskProgresses.taskId == self.id)
                    .order_by(asc(TaskProgresses.index))
                )
                task_progresses = result.all()
                rounds = [progress.round for progress in task_progresses]
                round_num = max(rounds, default=1)
                message_index = len(task_progresses)
                event_type = event.name or getattr(event, "event_name", event.name)
                if event_type == "agent:lifecycle:summary":
                    await self._update_summary(session, event.content.get("summary"))
                    return
                task_progress = TaskProgresses(
                    id=generate_snowflake_id_str(),
                    taskId=self.id,
                    organizationId=self.organizationId,
                    index=message_index,
                    round=round_num,
                    step=event.step,
                    type=event_type,
                    content=event.content,
                )
                session.add(task_progress)
                session.commit()
                if event_type == "agent:lifecycle:complete":
                    await self._update_status_in_db(session, "completed")
                elif event_type == "agent:lifecycle:terminating":
                    await self._update_status_in_db(session, "terminating")
                elif event_type == "agent:lifecycle:terminated":
                    await self._update_status_in_db(session, "terminated")
                break
        except Exception as e:
            logger.error(
                f"Failed to persist task progress for task {self.id}: {str(e)}"
            )

    async def _update_summary(self, session: Session, summary: str):
        try:
            result = session.exec(select(Tasks).where(Tasks.id == self.id))
            task = result.first()
            if task:
                task.summary = summary
                session.commit()
        except Exception as e:
            logger.error(f"Failed to update task summary for task {self.id}: {str(e)}")

    async def _update_status_in_db(self, session: Session, status: str):
        try:
            result = session.exec(select(Tasks).where(Tasks.id == self.id))
            task = result.first()
            if task:
                task.status = status
                session.commit()
        except Exception as e:
            logger.error(f"Failed to update task status for task {self.id}: {str(e)}")


class TaskManager:
    """只负责生命周期管理，不关心Task内部实现"""

    def __init__(self):
        self.tasks: Dict[str, Task] = {}

    async def create_task(
        self, task_id: str, organization_id: str, llm_id: str, prompt: str, tools: list
    ) -> Task:
        task = await Task.init_new_task(organization_id, task_id, llm_id, prompt, tools)
        self.tasks[task.id] = task
        return task

    def get_task(self, task_id: str) -> Optional[Task]:
        return self.tasks.get(task_id)

    async def restore_task(self, organization_id: str, task_id: str) -> Optional[Task]:
        """从数据库获取Task并添加到内存中"""
        # 先从内存中查找
        task = self.get_task(task_id)
        if task:
            return task

        # 从数据库还原Task
        task = await Task.restore_from_database(organization_id, task_id)
        if task:
            # 将还原的Task添加到内存中
            self.tasks[task_id] = task
            logger.info(f"Restored task {task_id} from database to memory")

        return task

    def run_task_asyncio(self, task_id: str, agent: FunMax):
        task = self.get_task(task_id)
        if task:
            asyncio.create_task(task.run(agent))

    async def terminate_task(self, task_id: str):
        task = self.get_task(task_id)
        if task:
            await task.terminate()

    async def remove_task(self, task_id: str):
        if task_id in self.tasks:
            del self.tasks[task_id]

    async def delayed_remove(self, task_id: str, delay: int = 1800):
        await asyncio.sleep(delay)
        await self.remove_task(task_id)

    async def event_generator(self, organization_id: str, task_id: str):
        # 首先尝试从数据库获取Task
        task = await self.restore_task(organization_id, task_id)
        if not task:
            yield f"event: error\ndata: {dumps({'message': 'Task not found'})}\n\n"
            return
        async for event in task.event_generator():
            yield event


task_manager = TaskManager()
