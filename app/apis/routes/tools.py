"""
Tool management routes for agent tools and tool schemas
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import select

from app.agent.funmax import SYSTEM_TOOLS
from app.apis.request_context import RequestContext, get_request_context
from app.persistence.database.models import (
    AgentTools,
    AgentToolSource,
    OrganizationUsers,
    ToolSchemas,
)
from app.tool.base import BaseTool
from app.utils.encrypt import decrypt_long_text_with_private_key


router = APIRouter(prefix="/tools", tags=["tools"])


# Request/Response Models
class ToolInfo(BaseModel):
    id: str
    name: str
    type: str
    description: Optional[str]
    parameters: Optional[Dict[str, Any]]
    source: str
    schema: Optional[Dict[str, Any]]


class InstallToolRequest(BaseModel):
    toolId: str
    env: Dict[str, str]


class InstallCustomToolRequest(BaseModel):
    name: str
    config: str


class RegisterToolRequest(BaseModel):
    name: str
    description: str
    repoUrl: Optional[str] = None
    command: str
    args: List[str]
    envSchema: Dict[str, Any]


class ToolSchemaResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    repoUrl: Optional[str]
    command: str
    args: List[str]
    envSchema: Dict[str, Any]
    url: str
    querySchema: Dict[str, Any]
    headersSchema: Dict[str, Any]
    createdAt: str
    updatedAt: str


def encrypt_with_public_key(data: str, public_key_pem: str) -> str:
    """Encrypt data using RSA public key"""
    try:
        import base64

        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding, rsa

        # Load public key
        public_key = serialization.load_pem_public_key(
            public_key_pem.encode("utf-8"), backend=default_backend()
        )

        # Ensure it's an RSA public key
        if not isinstance(public_key, rsa.RSAPublicKey):
            raise ValueError("Public key must be an RSA key")

        # Encrypt
        encrypted_bytes = public_key.encrypt(
            data.encode("utf-8"),
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )

        # Encode to base64
        return base64.b64encode(encrypted_bytes).decode("utf-8")
    except Exception as e:
        raise ValueError(f"Failed to encrypt data: {str(e)}")


def encrypt_long_text_with_public_key(data: str, public_key_pem: str) -> str:
    """Encrypt long text data using RSA public key"""
    return encrypt_with_public_key(data, public_key_pem)


def validate_json_schema(schema: Dict[str, Any], data: Dict[str, Any]) -> bool:
    """Simple JSON schema validation"""
    # This is a simplified validation - in production you might want to use a proper JSON schema validator
    if not isinstance(schema, dict) or not isinstance(data, dict):
        return False

    # Check required fields
    required_fields = schema.get("required", [])
    for field in required_fields:
        if field not in data:
            return False

    # Check property types
    properties = schema.get("properties", {})
    for field, value in data.items():
        if field in properties:
            expected_type = properties[field].get("type")
            if expected_type == "string" and not isinstance(value, str):
                return False
            elif expected_type == "number" and not isinstance(value, (int, float)):
                return False
            elif expected_type == "boolean" and not isinstance(value, bool):
                return False

    return True


@router.get("", response_model=List[ToolInfo])
async def list_agent_tools(context: RequestContext = Depends(get_request_context)):
    """List all agent tools (system + organization custom tools)"""
    # Get organization
    user = await context.current_user
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    org_user = context.db.exec(
        select(OrganizationUsers).where(OrganizationUsers.userId == user.id)
    ).first()

    if not org_user:
        raise HTTPException(
            status_code=404, detail="User not associated with any organization"
        )

    # Get system tools
    system_tools = []
    for tool in SYSTEM_TOOLS:
        t = tool  # type: BaseTool
        system_tools.append(
            ToolInfo(
                id=t.name,
                name=t.name,
                type="tool",
                description=t.description,
                parameters=t.parameters,
                source="BUILT_IN",
                schema={"id": t.name, "name": t.name},
            )
        )

    # Get organization custom tools
    agent_tools = context.db.exec(
        select(AgentTools).where(AgentTools.organizationId == org_user.organizationId)
    ).all()

    custom_tools = []
    for tool in agent_tools:
        if tool.schemaId:
            schema = context.db.exec(
                select(ToolSchemas).where(ToolSchemas.id == tool.schemaId)
            ).first()
        custom_tools.append(
            ToolInfo(
                id=tool.id,
                name=tool.name or (schema.name if schema else tool.id),
                type="mcp",
                description=schema.description if schema else None,
                parameters=None,
                source=tool.source.value,
                schema={
                    "id": schema.id if schema else None,
                    "name": schema.name if schema else None,
                    "description": schema.description if schema else None,
                },
            )
        )

    return system_tools + custom_tools


@router.post("/install")
async def install_tool(
    request: InstallToolRequest, context: RequestContext = Depends(get_request_context)
):
    """Install a tool for the organization"""
    # Get organization
    user = await context.current_user
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    org_user = context.db.exec(
        select(OrganizationUsers).where(OrganizationUsers.userId == user.id)
    ).first()

    if not org_user:
        raise HTTPException(
            status_code=404, detail="User not associated with any organization"
        )

    # Get tool schema
    tool = context.db.exec(
        select(ToolSchemas).where(ToolSchemas.id == request.toolId)
    ).first()

    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")

    # Validate environment variables
    if not validate_json_schema(tool.envSchema, request.env):
        raise HTTPException(
            status_code=400, detail="Invalid environment variables configuration"
        )

    # Get public key for encryption
    public_key_path = Path(Path.cwd()) / "keys" / "public.pem"
    if not public_key_path.exists():
        raise HTTPException(status_code=500, detail="Public key not found")

    public_key = public_key_path.read_text("utf-8")

    # Check if tool already exists
    existing = context.db.exec(
        select(AgentTools).where(
            AgentTools.schemaId == request.toolId,
            AgentTools.organizationId == org_user.organizationId,
        )
    ).first()

    if existing:
        # Update existing tool
        existing.env = encrypt_long_text_with_public_key(
            json.dumps(request.env), public_key
        )
    else:
        # Create new tool
        new_tool = AgentTools(
            source=AgentToolSource.STANDARD,
            organizationId=org_user.organizationId,
            schemaId=request.toolId,
            env=encrypt_long_text_with_public_key(json.dumps(request.env), public_key),
        )
        context.db.add(new_tool)

    context.db.commit()


@router.post("/install/custom")
async def install_custom_tool(
    request: InstallCustomToolRequest,
    context: RequestContext = Depends(get_request_context),
):
    """Install a custom tool for the organization"""
    # Get organization
    user = await context.current_user
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    org_user = context.db.exec(
        select(OrganizationUsers).where(OrganizationUsers.userId == user.id)
    ).first()

    if not org_user:
        raise HTTPException(
            status_code=404, detail="User not associated with any organization"
        )

    # Validate config JSON
    try:
        config_data = json.loads(request.config)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Invalid config, config should be a valid JSON object",
        )

    # Basic validation of MCP server config
    if not isinstance(config_data, dict):
        raise HTTPException(status_code=400, detail="Invalid config format")

    required_fields = ["name", "description", "tools"]
    for field in required_fields:
        if field not in config_data:
            raise HTTPException(
                status_code=400, detail=f"Missing required field: {field}"
            )

    # Get public key for encryption
    public_key_path = Path(Path.cwd()) / "keys" / "public.pem"
    if not public_key_path.exists():
        raise HTTPException(status_code=500, detail="Public key not found")

    public_key = public_key_path.read_text("utf-8")

    # Create custom tool
    new_tool = AgentTools(
        source=AgentToolSource.CUSTOM,
        organizationId=org_user.organizationId,
        name=request.name,
        customConfig=encrypt_long_text_with_public_key(request.config, public_key),
    )
    context.db.add(new_tool)
    context.db.commit()

    return {"message": "Tool installed successfully"}


@router.delete("/{tool_id}")
async def remove_tool(
    tool_id: str, context: RequestContext = Depends(get_request_context)
):
    """Remove a tool from the organization"""
    # Get organization
    user = await context.current_user
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    org_user = context.db.exec(
        select(OrganizationUsers).where(OrganizationUsers.userId == user.id)
    ).first()

    if not org_user:
        raise HTTPException(
            status_code=404, detail="User not associated with any organization"
        )

    # Find and delete tool
    tool = context.db.exec(
        select(AgentTools).where(
            AgentTools.id == tool_id,
            AgentTools.organizationId == org_user.organizationId,
        )
    ).first()

    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")

    context.db.delete(tool)
    context.db.commit()

    return {"message": "Tool removed successfully"}


@router.get("/schemas", response_model=List[ToolSchemaResponse])
async def list_tool_schemas(context: RequestContext = Depends(get_request_context)):
    """List all tool schemas from marketplace"""
    schemas = context.db.exec(select(ToolSchemas)).all()

    return [
        ToolSchemaResponse(
            id=schema.id,
            name=schema.name,
            description=schema.description,
            repoUrl=schema.repoUrl,
            command=schema.command,
            args=schema.args,
            envSchema=schema.envSchema,
            url=schema.url,
            querySchema=schema.querySchema,
            headersSchema=schema.headersSchema,
            createdAt=schema.createdAt.isoformat(),
            updatedAt=schema.updatedAt.isoformat(),
        )
        for schema in schemas
    ]


@router.post("/register")
async def register_tool(
    request: RegisterToolRequest, context: RequestContext = Depends(get_request_context)
):
    """Register a new tool (root user only)"""
    # Check if user is root
    user = await context.current_user
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    root_user_email = os.getenv("ROOT_USER_EMAIL", "")

    if user.email != root_user_email:
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Check if tool already exists
    existing_tool = context.db.exec(
        select(ToolSchemas).where(ToolSchemas.name == request.name)
    ).first()

    if existing_tool:
        raise HTTPException(status_code=400, detail="Tool already exists")

    # Create new tool schema
    new_schema = ToolSchemas(
        name=request.name,
        description=request.description,
        repoUrl=request.repoUrl,
        command=request.command,
        args=request.args,
        envSchema=request.envSchema,
    )
    context.db.add(new_schema)
    context.db.commit()

    return {"message": "Tool registered successfully"}
