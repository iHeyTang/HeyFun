"""
Configuration management routes for LLM configs and user preferences
"""

import re
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import select

from app.apis.request_context import RequestContext, get_request_context
from app.persistence.database.models import LlmConfigs, OrganizationUsers, Preferences
from app.utils.encrypt import decrypt_with_private_key


router = APIRouter(prefix="/config", tags=["config"])


# Request/Response Models
class LlmConfigRequest(BaseModel):
    id: Optional[str] = None
    model: str
    apiKey: str
    baseUrl: str
    maxTokens: int
    temperature: float
    apiType: str


class LlmConfigResponse(BaseModel):
    id: str
    type: str
    model: str
    baseUrl: str
    apiKey: str
    maxTokens: int
    maxInputTokens: Optional[int]
    temperature: float
    apiType: str
    apiVersion: Optional[str]
    isActive: bool
    createdAt: str
    updatedAt: str
    organizationId: str
    name: Optional[str]


class PreferencesRequest(BaseModel):
    language: Optional[str] = None


class PreferencesResponse(BaseModel):
    id: str
    organizationId: str
    language: Optional[str]
    createdAt: str
    updatedAt: str


def mask_data_for_llm_api_key(api_key: str) -> str:
    """Mask API key for display"""
    if not api_key or len(api_key) < 8:
        return api_key
    return api_key[:4] + "*" * (len(api_key) - 8) + api_key[-4:]


def is_maybe_same_masked_llm_api_key(original: str, masked: str) -> bool:
    """Check if masked API key might be the same as original"""
    if not original or not masked:
        return False

    # If the masked version matches the pattern, it might be the same
    if (
        len(original) == len(masked)
        and masked.startswith(original[:4])
        and masked.endswith(original[-4:])
    ):
        return True

    return False


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


@router.get("/llm", response_model=Optional[LlmConfigResponse])
async def get_llm_config(context: RequestContext = Depends(get_request_context)):
    """Get default LLM configuration for the organization"""
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

    # Get LLM config
    config = context.db.exec(
        select(LlmConfigs).where(
            LlmConfigs.organizationId == org_user.organizationId,
            LlmConfigs.type == "default",
        )
    ).first()

    if not config:
        return None

    # Decrypt API key
    private_key_path = Path(Path.cwd()) / "keys" / "private.pem"
    if not private_key_path.exists():
        raise HTTPException(status_code=500, detail="Private key not found")

    private_key = private_key_path.read_text("utf-8")
    decrypted_api_key = ""
    if config.apiKey:
        try:
            decrypted_api_key = decrypt_with_private_key(config.apiKey, private_key)
        except Exception:
            decrypted_api_key = ""

    # Mask API key and base URL
    masked_api_key = (
        mask_data_for_llm_api_key(decrypted_api_key) if decrypted_api_key else ""
    )
    masked_base_url = (
        re.sub(r"//[^:]+:[^@]+@", "//***:***@", config.baseUrl)
        if config.baseUrl
        else ""
    )

    return LlmConfigResponse(
        id=config.id,
        type=config.type,
        model=config.model,
        baseUrl=masked_base_url,
        apiKey=masked_api_key,
        maxTokens=config.maxTokens,
        maxInputTokens=config.maxInputTokens,
        temperature=config.temperature,
        apiType=config.apiType,
        apiVersion=config.apiVersion,
        isActive=config.isActive,
        createdAt=config.createdAt.isoformat(),
        updatedAt=config.updatedAt.isoformat(),
        organizationId=config.organizationId,
        name=config.name,
    )


@router.get("/llm/all", response_model=List[LlmConfigResponse])
async def get_llm_configs(context: RequestContext = Depends(get_request_context)):
    """Get all LLM configurations for the organization"""
    # Get organization
    user = await context.current_user
    org_user = context.db.exec(
        select(OrganizationUsers).where(OrganizationUsers.userId == user.id)
    ).first()

    if not org_user:
        raise HTTPException(
            status_code=404, detail="User not associated with any organization"
        )

    # Get all LLM configs
    configs = context.db.exec(
        select(LlmConfigs).where(LlmConfigs.organizationId == org_user.organizationId)
    ).all()

    # Decrypt and mask API keys
    private_key_path = Path(Path.cwd()) / "keys" / "private.pem"
    if not private_key_path.exists():
        raise HTTPException(status_code=500, detail="Private key not found")

    private_key = private_key_path.read_text("utf-8")

    result = []
    for config in configs:
        decrypted_api_key = ""
        if config.apiKey:
            try:
                decrypted_api_key = decrypt_with_private_key(config.apiKey, private_key)
            except Exception:
                decrypted_api_key = ""

        masked_api_key = (
            mask_data_for_llm_api_key(decrypted_api_key) if decrypted_api_key else ""
        )
        masked_base_url = (
            re.sub(r"//[^:]+:[^@]+@", "//***:***@", config.baseUrl)
            if config.baseUrl
            else ""
        )

        result.append(
            LlmConfigResponse(
                id=config.id,
                type=config.type,
                model=config.model,
                baseUrl=masked_base_url,
                apiKey=masked_api_key,
                maxTokens=config.maxTokens,
                maxInputTokens=config.maxInputTokens,
                temperature=config.temperature,
                apiType=config.apiType,
                apiVersion=config.apiVersion,
                isActive=config.isActive,
                createdAt=config.createdAt.isoformat(),
                updatedAt=config.updatedAt.isoformat(),
                organizationId=config.organizationId,
                name=config.name,
            )
        )

    return result


@router.delete("/llm/{config_id}")
async def remove_llm_config(
    config_id: str, context: RequestContext = Depends(get_request_context)
):
    """Remove LLM configuration"""
    # Get organization
    user = await context.current_user
    org_user = context.db.exec(
        select(OrganizationUsers).where(OrganizationUsers.userId == user.id)
    ).first()

    if not org_user:
        raise HTTPException(
            status_code=404, detail="User not associated with any organization"
        )

    # Delete config
    config = context.db.exec(
        select(LlmConfigs).where(
            LlmConfigs.id == config_id,
            LlmConfigs.organizationId == org_user.organizationId,
        )
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")

    context.db.delete(config)
    context.db.commit()


@router.post("/llm")
async def update_llm_config(
    request: LlmConfigRequest, context: RequestContext = Depends(get_request_context)
):
    """Create or update LLM configuration"""
    # Get organization
    user = await context.current_user
    org_user = context.db.exec(
        select(OrganizationUsers).where(OrganizationUsers.userId == user.id)
    ).first()

    if not org_user:
        raise HTTPException(
            status_code=404, detail="User not associated with any organization"
        )

    # Get keys
    public_key_path = Path(Path.cwd()) / "keys" / "public.pem"
    private_key_path = Path(Path.cwd()) / "keys" / "private.pem"

    if not public_key_path.exists() or not private_key_path.exists():
        raise HTTPException(status_code=500, detail="Encryption keys not found")

    public_key = public_key_path.read_text("utf-8")
    private_key = private_key_path.read_text("utf-8")

    # Encrypt API key
    encrypted_api_key = ""
    if request.apiKey:
        encrypted_api_key = encrypt_with_public_key(request.apiKey, public_key)

    # Check if config exists
    existing_config = None
    if request.id:
        existing_config = context.db.exec(
            select(LlmConfigs).where(
                LlmConfigs.id == request.id,
                LlmConfigs.organizationId == org_user.organizationId,
            )
        ).first()

    if not existing_config:
        # Create new config
        new_config = LlmConfigs(
            organizationId=org_user.organizationId,
            apiKey=encrypted_api_key,
            baseUrl=request.baseUrl,
            model=request.model,
            maxTokens=request.maxTokens,
            temperature=request.temperature,
            apiType=request.apiType,
            isActive=True,
            type="default",
        )
        context.db.add(new_config)
    else:
        # Update existing config
        # Check if API key is the same
        same_api_key = False
        if existing_config.apiKey and request.apiKey:
            try:
                decrypted_existing = decrypt_with_private_key(
                    existing_config.apiKey, private_key
                )
                same_api_key = is_maybe_same_masked_llm_api_key(
                    decrypted_existing, request.apiKey
                )
            except Exception:
                same_api_key = False

        api_key_to_use = existing_config.apiKey if same_api_key else encrypted_api_key

        existing_config.apiKey = api_key_to_use
        existing_config.baseUrl = request.baseUrl
        existing_config.model = request.model
        existing_config.maxTokens = request.maxTokens
        existing_config.temperature = request.temperature
        existing_config.apiType = request.apiType
        existing_config.isActive = True
        existing_config.type = "default"

    context.db.commit()


@router.get("/preferences", response_model=Optional[PreferencesResponse])
async def get_preferences(context: RequestContext = Depends(get_request_context)):
    """Get user preferences"""
    # Get organization
    user = await context.current_user
    org_user = context.db.exec(
        select(OrganizationUsers).where(OrganizationUsers.userId == user.id)
    ).first()

    if not org_user:
        raise HTTPException(
            status_code=404, detail="User not associated with any organization"
        )

    # Get preferences
    preferences = context.db.exec(
        select(Preferences).where(Preferences.organizationId == org_user.organizationId)
    ).first()

    if not preferences:
        return None

    return PreferencesResponse(
        id=preferences.id,
        organizationId=preferences.organizationId,
        language=preferences.language,
        createdAt=preferences.createdAt.isoformat(),
        updatedAt=preferences.updatedAt.isoformat(),
    )


@router.post("/preferences")
async def update_preferences(
    request: PreferencesRequest, context: RequestContext = Depends(get_request_context)
):
    """Update user preferences"""
    # Get organization
    user = await context.current_user
    org_user = context.db.exec(
        select(OrganizationUsers).where(OrganizationUsers.userId == user.id)
    ).first()

    if not org_user:
        raise HTTPException(
            status_code=404, detail="User not associated with any organization"
        )

    # Check if preferences exist
    existing_preferences = context.db.exec(
        select(Preferences).where(Preferences.organizationId == org_user.organizationId)
    ).first()

    if not existing_preferences:
        # Create new preferences
        new_preferences = Preferences(
            organizationId=org_user.organizationId,
            language=request.language,
        )
        context.db.add(new_preferences)
    else:
        # Update existing preferences
        existing_preferences.language = request.language

    context.db.commit()
