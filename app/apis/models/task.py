from datetime import datetime

from pydantic import BaseModel

from app.agent.funmax import FunMax


class Task(BaseModel):
    id: str
    created_at: datetime
    agent: "FunMax"

    def model_dump(self, *args, **kwargs):
        data = super().model_dump(*args, **kwargs)
        data["created_at"] = self.created_at.isoformat()
        return data
