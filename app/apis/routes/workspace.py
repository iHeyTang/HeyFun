import hashlib
import zipfile
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.responses import StreamingResponse
from sqlmodel import select

from app.apis.request_context import RequestContext, require_auth_context
from app.config import config
from app.persistence.database.models import OrganizationUsers, Tasks


router = APIRouter(prefix="/workspace", tags=["workspace"])


def get_content_type(file_path: str) -> str:
    """Get content type based on file extension"""
    ext = Path(file_path).suffix.lower()
    content_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".md": "text/markdown",
        ".txt": "text/plain",
        ".json": "application/json",
        ".xml": "application/xml",
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".py": "text/x-python",
        ".java": "text/x-java-source",
        ".cpp": "text/x-c++src",
        ".c": "text/x-csrc",
        ".h": "text/x-chdr",
        ".hpp": "text/x-c++hdr",
    }
    return content_types.get(ext, "application/octet-stream")


async def get_organization_id(context: RequestContext) -> str:
    """Get organization ID for the current user"""
    user = await context.current_user
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    org_user = context.db.exec(
        select(OrganizationUsers).where(OrganizationUsers.userId == user.id)
    ).first()

    if not org_user:
        raise HTTPException(
            status_code=401, detail="User not associated with any organization"
        )

    return org_user.organizationId


async def verify_task_access(
    context: RequestContext, task_id: str, organization_id: str
) -> Tasks:
    """Verify that the task exists and belongs to the user's organization"""
    task = context.db.exec(
        select(Tasks).where(
            Tasks.id == task_id, Tasks.organizationId == organization_id
        )
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return task


def get_workspace_path(organization_id: str, path_segments: List[str]) -> Path:
    """Get the full workspace path for the given organization and path segments"""
    workspace_root = config.workspace_root
    return workspace_root / organization_id / "/".join(path_segments)


@router.get("/{path:path}")
async def get_workspace_file(
    path: str,
    context: RequestContext = Depends(require_auth_context),
):
    """
    Get workspace file or directory listing
    Path format: {task_id}/{file_path}
    """
    try:
        # Parse path segments
        path_segments = path.split("/")
        if not path_segments:
            raise HTTPException(status_code=400, detail="Invalid path")

        task_id = path_segments[0]
        file_path_segments = path_segments[1:] if len(path_segments) > 1 else []

        # Get organization ID and verify task access
        organization_id = await get_organization_id(context)
        await verify_task_access(context, task_id, organization_id)

        # Build full file path
        full_path = get_workspace_path(organization_id, path_segments)

        if not full_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        # Handle directory listing
        if full_path.is_dir():
            files = []
            for item in full_path.iterdir():
                stat = item.stat()
                files.append(
                    {
                        "name": item.name,
                        "isDirectory": item.is_dir(),
                        "size": stat.st_size,
                        "modifiedTime": stat.st_mtime,
                    }
                )
            return files

        # Handle file serving
        file_content = full_path.read_bytes()

        # Calculate ETag
        etag = hashlib.md5(file_content).hexdigest()

        # Get last modified time
        stat = full_path.stat()
        last_modified = stat.st_mtime

        # Check If-None-Match header
        if_none_match = context.get_header("if-none-match")
        if if_none_match and if_none_match == etag:
            return Response(status_code=304)

        # Check If-Modified-Since header
        if_modified_since = context.get_header("if-modified-since")
        if if_modified_since:
            try:
                import email.utils

                parsed_time = email.utils.parsedate_to_datetime(if_modified_since)
                if parsed_time.timestamp() >= last_modified:
                    return Response(status_code=304)
            except:
                pass

        # Determine content type
        content_type = get_content_type(str(full_path))
        file_name = full_path.name
        encoded_file_name = file_name.encode("utf-8").decode("latin-1")

        return Response(
            content=file_content,
            media_type=content_type,
            headers={
                "Content-Disposition": f"inline; filename*=UTF-8''{encoded_file_name}",
                "ETag": etag,
                "Last-Modified": str(last_modified),
                "Cache-Control": "private, must-revalidate",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/download/{path:path}")
async def download_workspace_file(
    path: str,
    context: RequestContext = Depends(require_auth_context),
):
    """
    Download workspace file or directory as zip
    Path format: {task_id}/{file_path}
    """
    try:
        # Parse path segments
        path_segments = path.split("/")
        if not path_segments:
            raise HTTPException(status_code=400, detail="Invalid path")

        task_id = path_segments[0]
        file_path_segments = path_segments[1:] if len(path_segments) > 1 else []

        # Get organization ID and verify task access
        organization_id = await get_organization_id(context)
        await verify_task_access(context, task_id, organization_id)

        # Build full file path
        full_path = get_workspace_path(organization_id, path_segments)

        if not full_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        # Handle single file download
        if not full_path.is_dir():
            file_content = full_path.read_bytes()
            file_name = full_path.name
            encoded_file_name = file_name.encode("utf-8").decode("latin-1")

            return Response(
                content=file_content,
                media_type="application/octet-stream",
                headers={
                    "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_file_name}",
                },
            )

        # Handle directory download as zip
        directory_name = full_path.name or "workspace"
        zip_file_name = f"{directory_name}.zip"
        encoded_zip_file_name = zip_file_name.encode("utf-8").decode("latin-1")

        def create_zip_stream():
            """Create zip file stream"""
            import io

            zip_buffer = io.BytesIO()

            with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:

                def add_files_to_zip(current_path: Path, relative_path: str = ""):
                    """Recursively add files to zip"""
                    for item in current_path.iterdir():
                        item_relative_path = (
                            f"{relative_path}/{item.name}"
                            if relative_path
                            else item.name
                        )

                        if item.is_dir():
                            # Recursively add directory contents
                            add_files_to_zip(item, item_relative_path)
                        else:
                            # Add file to zip
                            zip_file.write(item, item_relative_path)

                add_files_to_zip(full_path)

            zip_buffer.seek(0)
            return zip_buffer

        zip_stream = create_zip_stream()

        return StreamingResponse(
            iter([zip_stream.getvalue()]),
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_zip_file_name}",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{path:path}")
async def upload_workspace_file(
    path: str,
    file: UploadFile = File(...),
    context: RequestContext = Depends(require_auth_context),
):
    """
    Upload file to workspace
    Path format: {task_id}/{file_path}
    """
    try:
        # Parse path segments
        path_segments = path.split("/")
        if not path_segments:
            raise HTTPException(status_code=400, detail="Invalid path")

        task_id = path_segments[0]
        file_path_segments = path_segments[1:] if len(path_segments) > 1 else []

        # Get organization ID and verify task access
        organization_id = await get_organization_id(context)
        await verify_task_access(context, task_id, organization_id)

        # Build full file path
        full_path = get_workspace_path(organization_id, path_segments)

        # Ensure parent directory exists
        full_path.parent.mkdir(parents=True, exist_ok=True)

        # Write file content
        content = await file.read()
        full_path.write_bytes(content)

        return {"message": "File uploaded successfully", "path": str(full_path)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/{path:path}")
async def delete_workspace_file(
    path: str,
    context: RequestContext = Depends(require_auth_context),
):
    """
    Delete file or directory from workspace
    Path format: {task_id}/{file_path}
    """
    try:
        # Parse path segments
        path_segments = path.split("/")
        if not path_segments:
            raise HTTPException(status_code=400, detail="Invalid path")

        task_id = path_segments[0]
        file_path_segments = path_segments[1:] if len(path_segments) > 1 else []

        # Get organization ID and verify task access
        organization_id = await get_organization_id(context)
        await verify_task_access(context, task_id, organization_id)

        # Build full file path
        full_path = get_workspace_path(organization_id, path_segments)

        if not full_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        # Delete file or directory
        if full_path.is_dir():
            import shutil

            shutil.rmtree(full_path)
        else:
            full_path.unlink()

        return {"message": "File deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
