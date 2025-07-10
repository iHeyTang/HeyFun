from fastapi import APIRouter

from app.apis.routes.auth import router as auth_router
from app.apis.routes.config import router as config_router
from app.apis.routes.me import router as me_router
from app.apis.routes.shared_tasks import router as shared_tasks_router
from app.apis.routes.tasks import router as tasks_router
from app.apis.routes.tools import router as tools_router
from app.apis.routes.workspace import router as workspace_router


router = APIRouter(prefix="/api")

router.include_router(auth_router)
router.include_router(config_router)
router.include_router(me_router)
router.include_router(tools_router)
router.include_router(shared_tasks_router)
router.include_router(tasks_router)
router.include_router(workspace_router)
