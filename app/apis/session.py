"""
Session management for handling JWT tokens and session validation
"""

import os
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import jwt
from fastapi import HTTPException, Request, status
from pydantic import BaseModel


class AuthUser(BaseModel):
    """认证用户模型"""

    id: str
    email: str
    name: Optional[str] = None
    isFirstLogin: bool


# JWT 配置
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


def create_token(
    user_id: str, email: str, name: Optional[str] = None, is_first_login: bool = True
) -> str:
    """
    创建 JWT token

    Args:
        user_id: 用户ID
        email: 用户邮箱
        name: 用户姓名（可选）
        is_first_login: 是否首次登录

    Returns:
        JWT token 字符串
    """
    payload = {
        "id": user_id,
        "email": email,
        "name": name,
        "isFirstLogin": is_first_login,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
    }

    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token


def verify_token(token: str) -> AuthUser:
    """
    验证 JWT token

    Args:
        token: JWT token 字符串

    Returns:
        AuthUser 对象

    Raises:
        ValueError: 当 token 无效时
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

        # 验证必要字段是否存在
        if not payload.get("id") or not payload.get("email"):
            raise ValueError("Invalid token payload")

        return AuthUser(
            id=payload["id"],
            email=payload["email"],
            name=payload.get("name"),
            isFirstLogin=payload.get("isFirstLogin", True),
        )
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired")
    except jwt.InvalidTokenError:
        raise ValueError("Invalid token")


def get_token_from_header(auth_header: Optional[str]) -> Optional[str]:
    """
    从 Authorization header 中提取 token

    Args:
        auth_header: Authorization header 字符串

    Returns:
        token 字符串，如果无效则返回 None
    """
    if not auth_header:
        return None

    parts = auth_header.split(" ")
    if len(parts) != 2 or parts[0] != "Bearer":
        return None

    return parts[1]


def validate_session_token(
    token: str, secret_key: str = JWT_SECRET
) -> Optional[Dict[str, Any]]:
    """
    Validate JWT session token and return payload

    Args:
        token: JWT token string
        secret_key: Secret key for JWT verification

    Returns:
        Dict containing token payload if valid, None if invalid
    """
    try:
        payload = jwt.decode(token, secret_key, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_session_from_request(
    request: Request,
    secret_key: str = JWT_SECRET,
    session_cookie_name: str = "session_token",
) -> Optional[Dict[str, Any]]:
    """
    Get and validate session data from request cookies

    Args:
        request: FastAPI request object
        secret_key: Secret key for JWT verification
        session_cookie_name: Name of the session cookie

    Returns:
        Dict containing session data if valid, None if invalid or missing
    """
    session_token = request.cookies.get(session_cookie_name)
    if not session_token:
        return None

    return validate_session_token(session_token, secret_key)


def require_session(
    request: Request,
    secret_key: str = JWT_SECRET,
    session_cookie_name: str = "session_token",
) -> Dict[str, Any]:
    """
    Require valid session from request, raise HTTPException if invalid

    Args:
        request: FastAPI request object
        secret_key: Secret key for JWT verification
        session_cookie_name: Name of the session cookie

    Returns:
        Dict containing session data

    Raises:
        HTTPException: If session is invalid or missing
    """
    session_data = get_session_from_request(request, secret_key, session_cookie_name)
    if not session_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing session token",
        )
    return session_data
