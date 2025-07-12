"""
Unified request context manager for FastAPI
"""

from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator, Callable, Dict, Optional

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import Session, select

from app.apis.session import get_token_from_header
from app.persistence.database.models import Organizations, OrganizationUsers, Users
from app.persistence.database.session import get_session


@dataclass
class RequestContext:
    """Unified request context"""

    request: Request
    db: Session

    # 懒加载的属性
    _session_data: Optional[Dict[str, Any]] = field(default=None, init=False)
    _current_user: Optional[Users] = field(default=None, init=False)
    _current_organization: Optional[Organizations] = field(default=None, init=False)
    _loaded: bool = field(default=False, init=False)

    async def _ensure_loaded(self):
        """Ensure data is loaded"""
        if not self._loaded:
            # Try to get token from Authorization header first
            auth_header = self.request.headers.get("Authorization")
            token = None

            if auth_header:
                token = get_token_from_header(auth_header)

            # If no Authorization header, try cookie
            if not token:
                token = self.request.cookies.get("token")

            if token:
                try:
                    from app.apis.session import validate_session_token

                    self._session_data = validate_session_token(token)
                    if self._session_data:
                        user_id = self._session_data.get("id")
                        if user_id:
                            statement = select(Users).where(Users.id == user_id)
                            self._current_user = self.db.exec(statement).first()

                            org_user = self.db.exec(
                                select(OrganizationUsers).where(
                                    OrganizationUsers.userId == user_id
                                )
                            ).first()
                            if not org_user:
                                raise HTTPException(
                                    status_code=status.HTTP_401_UNAUTHORIZED,
                                    detail="User is not in any organization",
                                )
                            self._current_organization = self.db.get(
                                Organizations, org_user.organizationId
                            )
                except Exception:
                    # Token is invalid, ignore
                    pass
            self._loaded = True

    @property
    async def session_data(self) -> Optional[Dict[str, Any]]:
        """Get session data"""
        await self._ensure_loaded()
        return self._session_data

    @property
    async def current_user(self) -> Users:
        """Get current user"""
        await self._ensure_loaded()
        if not self._current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
        return self._current_user

    @property
    async def current_organization(self) -> Organizations:
        """Get current organization"""
        await self._ensure_loaded()
        if not self._current_organization:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User is not in any organization",
            )
        return self._current_organization

    @property
    async def is_authenticated(self) -> bool:
        """Check if authenticated"""
        await self._ensure_loaded()
        return self._current_user is not None

    @property
    async def user_id(self) -> Optional[str]:
        """Get user ID"""
        user = await self.current_user
        return str(user.id) if user else None

    def get_header(self, name: str) -> Optional[str]:
        """Get request header"""
        return self.request.headers.get(name)

    def get_cookie(self, name: str) -> Optional[str]:
        """Get cookie"""
        return self.request.cookies.get(name)

    def get_query_param(self, name: str) -> Optional[str]:
        """Get query parameter"""
        return self.request.query_params.get(name)

    def get_path_param(self, name: str) -> Optional[str]:
        """Get path parameter"""
        return self.request.path_params.get(name)

    @property
    def method(self) -> str:
        """Get request method"""
        return self.request.method

    @property
    def url(self) -> str:
        """Get request URL"""
        return str(self.request.url)

    @property
    def client_ip(self) -> str:
        """Get client IP"""
        return self.request.client.host if self.request.client else "unknown"


# Dependency injection functions
async def get_request_context(
    request: Request,
    db: Session = Depends(get_session),
) -> RequestContext:
    """Get request context"""
    return RequestContext(request, db)


async def require_auth_context(
    context: RequestContext = Depends(get_request_context),
) -> RequestContext:
    """Require authentication context"""
    if not await context.is_authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )
    return context


# Decorator version
def with_context(func: Callable):
    """Decorator: automatically inject context"""

    # 1. Create a new function signature, inject context as dependency
    async def wrapper(
        context: RequestContext = Depends(get_request_context), *args, **kwargs
    ):
        return await func(context, *args, **kwargs)

    # 2. Copy the original function signature information
    wrapper.__name__ = func.__name__
    wrapper.__doc__ = func.__doc__
    wrapper.__annotations__ = func.__annotations__

    return wrapper


def with_auth_context(func: Callable):
    """Decorator: automatically inject authentication context"""

    # 1. Create a new function signature, inject context as dependency
    async def wrapper(
        context: RequestContext = Depends(require_auth_context), *args, **kwargs
    ):
        return await func(context, *args, **kwargs)

    # 2. Copy the original function signature information
    wrapper.__name__ = func.__name__
    wrapper.__doc__ = func.__doc__
    wrapper.__annotations__ = func.__annotations__

    return wrapper


# Context manager (for asynchronous context)
@asynccontextmanager
async def request_context(
    request: Request, db: Session
) -> AsyncGenerator[RequestContext, None]:
    """Asynchronous context manager"""
    context = RequestContext(request, db)
    try:
        yield context
    finally:
        # Clean up resources (if needed)
        pass
