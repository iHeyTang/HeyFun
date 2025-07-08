from datetime import UTC, datetime
from enum import Enum
from typing import Any, ClassVar, Dict, List, Optional

from sqlmodel import JSON, Column, Field, SQLModel, Text


class AgentToolSource(str, Enum):
    """Agent tool source options"""

    STANDARD = "STANDARD"
    CUSTOM = "CUSTOM"


class BaseModel(SQLModel):
    """Base model for all models"""

    id: str = Field(
        default=None, primary_key=True, sa_column_kwargs={"default": "cuid()"}
    )
    createdAt: datetime = Field(default=datetime.now(UTC))
    updatedAt: datetime = Field(default=datetime.now(UTC))


class Users(BaseModel, table=True):
    """Users table model"""

    __tablename__: ClassVar[str] = "Users"

    email: str = Field(unique=True, index=True)
    name: Optional[str] = Field(default=None, index=True)
    password: str
    isFirstLogin: bool = Field(default=True)


class Organizations(BaseModel, table=True):
    """Organizations table model"""

    __tablename__: ClassVar[str] = "Organizations"

    name: str = Field(unique=True)


class Preferences(BaseModel, table=True):
    """Preferences table model"""

    __tablename__: ClassVar[str] = "Preferences"

    organizationId: str = Field(unique=True)
    language: Optional[str] = Field(default=None)


class OrganizationUsers(BaseModel, table=True):
    """OrganizationUsers table model"""

    __tablename__: ClassVar[str] = "OrganizationUsers"

    organizationId: str = Field(index=True)
    userId: str = Field(index=True)


class Tasks(BaseModel, table=True):
    """Tasks table model"""

    __tablename__: ClassVar[str] = "Tasks"

    organizationId: str = Field(index=True)
    outId: Optional[str] = Field(default=None, unique=True)
    llmId: str
    summary: Optional[str] = Field(default=None)
    prompt: str = Field(sa_column=Column(Text))
    status: str = Field(default="pending")
    tools: Dict[str, Any] = Field(default_factory=list, sa_column=Column(JSON))
    shareExpiresAt: Optional[datetime] = Field(default=None)


class TaskProgresses(BaseModel, table=True):
    """TaskProgresses table model"""

    __tablename__: ClassVar[str] = "TaskProgresses"

    organizationId: str = Field(index=True)
    taskId: str = Field(index=True)
    index: int
    round: int = Field(default=1)
    step: int
    type: str = Field(index=True)
    content: Dict[str, Any] = Field(sa_column=Column(JSON))


class LlmConfigs(SQLModel, table=True):
    """LlmConfigs table model"""

    __tablename__: ClassVar[str] = "LlmConfigs"

    id: str = Field(
        default=None, primary_key=True, sa_column_kwargs={"default": "cuid()"}
    )
    type: str
    model: str
    baseUrl: str
    apiKey: str
    maxTokens: int
    maxInputTokens: Optional[int] = Field(default=None)
    temperature: float
    apiType: str
    apiVersion: Optional[str] = Field(default=None)
    isActive: bool = Field(index=True)
    createdAt: datetime = Field(default=datetime.now(UTC))
    updatedAt: datetime = Field(default=datetime.now(UTC))
    organizationId: str = Field(index=True)
    name: Optional[str] = Field(default=None)


class Agents(BaseModel, table=True):
    """Agents table model"""

    __tablename__: ClassVar[str] = "Agents"

    name: str
    description: str
    organizationId: str = Field(index=True)
    llmId: str
    tools: List[str] = Field(default_factory=list, sa_column=Column(JSON))


class InviteCodes(BaseModel, table=True):
    """InviteCodes table model"""

    __tablename__: ClassVar[str] = "InviteCodes"

    code: str = Field(unique=True)
    email: str = Field(unique=True)
    isUsed: bool = Field(default=False, index=True)
    usedAt: Optional[datetime] = Field(default=None)


class Tools(BaseModel, table=True):
    """Tools table model (deprecated: use ToolSchemas instead)"""

    __tablename__: ClassVar[str] = "Tools"

    name: str = Field(unique=True, index=True)
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    command: str
    args: List[Any] = Field(default_factory=list, sa_column=Column(JSON))
    envSchema: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    url: str = Field(default="")
    querySchema: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    headersSchema: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))


class OrganizationTools(BaseModel, table=True):
    """OrganizationTools table model (deprecated: use AgentTools instead)"""

    __tablename__: ClassVar[str] = "OrganizationTools"

    toolId: str = Field(index=True)
    organizationId: str = Field(index=True)
    env: Optional[str] = Field(default=None)  # for stdio
    query: Optional[str] = Field(default=None)  # for sse
    headers: Optional[str] = Field(default=None)  # for sse


class ToolSchemas(BaseModel, table=True):
    """ToolSchemas table model"""

    __tablename__: ClassVar[str] = "ToolSchemas"

    name: str = Field(unique=True, index=True)
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    repoUrl: Optional[str] = Field(default=None)
    command: str = Field(default="")  # Command for stdio
    args: List[Any] = Field(
        default_factory=list, sa_column=Column(JSON)
    )  # Args for stdio
    envSchema: Dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON)
    )  # EnvSchema for stdio
    url: str = Field(default="")  # Url for sse
    querySchema: Dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON)
    )  # QuerySchema for sse
    headersSchema: Dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON)
    )  # HeadersSchema for sse


class AgentTools(BaseModel, table=True):
    """AgentTools table model"""

    __tablename__: ClassVar[str] = "AgentTools"

    organizationId: str = Field(index=True)
    name: Optional[str] = Field(default=None)
    source: AgentToolSource
    schemaId: Optional[str] = Field(default=None, index=True)
    env: Optional[str] = Field(default=None)  # for stdio
    query: Optional[str] = Field(default=None)  # for sse
    headers: Optional[str] = Field(default=None)  # for sse
    customConfig: Optional[str] = Field(default=None)  # for custom
