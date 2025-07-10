from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import select

from app.apis.request_context import RequestContext, get_request_context
from app.apis.session import create_token
from app.persistence.database.models import Organizations, OrganizationUsers, Users
from app.utils.encrypt import hash_password, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])


class SigninData(BaseModel):
    email: str
    password: str


class SignupData(BaseModel):
    email: str
    password: str
    name: str
    organizationName: str


@router.post("/signin")
async def signin(
    body: SigninData = Body(...),
    context: RequestContext = Depends(get_request_context),
):
    # 1. Verify user
    user = context.db.exec(select(Users).where(Users.email == body.email)).one()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(body.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # 2. Verify organization
    orgs = context.db.exec(
        select(OrganizationUsers).where(OrganizationUsers.userId == user.id)
    ).all()
    if not orgs:
        raise HTTPException(
            status_code=401, detail="User not associated with any organization"
        )
    if len(orgs) > 1:
        raise HTTPException(
            status_code=401, detail="User is associated with multiple organizations"
        )
    org = context.db.exec(
        select(Organizations).where(Organizations.id == orgs[0].organizationId)
    ).one()
    if not org:
        raise HTTPException(status_code=401, detail="Organization not found")

    # 3. Create token
    token = create_token(
        user_id=str(user.id),
        email=user.email,
        name=user.name,
        is_first_login=user.isFirstLogin,
    )
    return {"token": token}


@router.post("/signup")
async def signup(
    body: SignupData = Body(...),
    context: RequestContext = Depends(get_request_context),
):
    exist_user = context.db.exec(select(Users).where(Users.email == body.email)).one()
    if exist_user:
        raise HTTPException(status_code=400, detail="User already exists")
    exist_org = context.db.exec(
        select(Organizations).where(Organizations.name == body.organizationName)
    ).one()
    if exist_org:
        raise HTTPException(status_code=400, detail="Organization already exists")

    user = Users(
        email=body.email,
        password=hash_password(body.password),
        name=body.name,
        isFirstLogin=True,
    )
    org = Organizations(name=body.organizationName)
    org_user = OrganizationUsers(userId=user.id, organizationId=org.id)
    context.db.add_all([user, org, org_user])
    context.db.commit()
    return {"message": "Registration successful"}
