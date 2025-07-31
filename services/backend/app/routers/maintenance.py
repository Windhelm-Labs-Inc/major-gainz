from fastapi import APIRouter, BackgroundTasks

from ..crud import refresh_all_tokens

router = APIRouter(tags=["maintenance"])


@router.post("/refresh")
async def refresh(background_tasks: BackgroundTasks):
    """Manually trigger background refresh for all tokens."""
    background_tasks.add_task(refresh_all_tokens)
    return {"status": "refresh scheduled"} 