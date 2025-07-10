from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.apis.request_context import RequestContext, get_request_context
from app.persistence.database.models import Organizations, Users
from app.utils.encrypt import hash_password, verify_password


router = APIRouter(prefix="/me", tags=["me"])


class ModifyPasswordRequest(BaseModel):
    old_password: str
    new_password: str


class ModifyPasswordResponse(BaseModel):
    message: str


class UserInfoResponse(BaseModel):
    id: str
    email: str
    name: str | None
    organization_id: str
    organization_name: str
    is_root: bool


@router.post("/password", response_model=ModifyPasswordResponse)
async def modify_password(
    request: ModifyPasswordRequest,
    context: RequestContext = Depends(get_request_context),
):
    """Modify user password"""
    if not await context.is_authenticated:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await context.current_user
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify old password
    if not verify_password(request.old_password, user.password):
        raise HTTPException(status_code=400, detail="Invalid old password")

    # Hash new password
    new_hashed_password = hash_password(request.new_password)

    # Update user password
    user.password = new_hashed_password
    user.isFirstLogin = False

    context.db.add(user)
    context.db.commit()
    context.db.refresh(user)

    return ModifyPasswordResponse(message="Password updated successfully")


@router.get("", response_model=UserInfoResponse)
async def get_me(context: RequestContext = Depends(get_request_context)):
    """Get current user information"""
    if not await context.is_authenticated:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = await context.current_user
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Get user's organization through OrganizationUsers table
    from app.persistence.database.models import OrganizationUsers

    # First get the organization user relationship
    org_user = context.db.exec(
        select(OrganizationUsers).where(OrganizationUsers.userId == user.id)
    ).first()

    if not org_user:
        raise HTTPException(
            status_code=404, detail="User not associated with any organization"
        )

    # Then get the organization
    organization = context.db.exec(
        select(Organizations).where(Organizations.id == org_user.organizationId)
    ).first()

    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Check if user is root (you may need to add this to your config)
    import os

    is_root = user.email == os.getenv("ROOT_USER_EMAIL", "")

    return UserInfoResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        organization_id=organization.id,
        organization_name=organization.name,
        is_root=is_root,
    )
