from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Message
from app.db.session import get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


@router.get("/overview")
async def overview(db: AsyncSession = Depends(get_db)) -> dict:
    rows = await db.execute(select(Message).where(Message.role == "assistant"))
    messages = list(rows.scalars())
    messages.sort(key=lambda item: item.created_at)

    if not messages:
        return {
            "total_queries": 0,
            "avg_confidence": 0.0,
            "avg_latency_ms": 0.0,
            "avg_retrieval_ms": 0.0,
            "avg_generation_ms": 0.0,
            "total_prompt_tokens": 0,
            "total_completion_tokens": 0,
            "contradiction_count": 0,
            "feedback_up": 0,
            "feedback_down": 0,
            "timeline": [],
            "recent": [],
        }

    confidences = [m.confidence for m in messages if m.confidence is not None]
    latencies = [m.total_ms for m in messages if m.total_ms is not None]
    retrieval = [m.retrieval_ms for m in messages if m.retrieval_ms is not None]
    generation = [m.generation_ms for m in messages if m.generation_ms is not None]

    timeline = [
        {
            "index": index + 1,
            "confidence": m.confidence,
            "latency_ms": m.total_ms,
        }
        for index, m in enumerate(messages[-20:])
    ]
    recent = [
        {
            "id": m.id,
            "content": m.content[:140],
            "confidence": m.confidence,
            "latency_ms": m.total_ms,
            "contradiction_flag": m.contradiction_flag,
            "feedback": m.feedback,
            "created_at": m.created_at,
            "prompt_tokens": m.prompt_tokens,
            "completion_tokens": m.completion_tokens,
        }
        for m in reversed(messages[-10:])
    ]

    return {
        "total_queries": len(messages),
        "avg_confidence": _avg(confidences),
        "avg_latency_ms": _avg(latencies),
        "avg_retrieval_ms": _avg(retrieval),
        "avg_generation_ms": _avg(generation),
        "total_prompt_tokens": sum(m.prompt_tokens or 0 for m in messages),
        "total_completion_tokens": sum(m.completion_tokens or 0 for m in messages),
        "contradiction_count": sum(1 for m in messages if m.contradiction_flag),
        "feedback_up": sum(1 for m in messages if m.feedback == "up"),
        "feedback_down": sum(1 for m in messages if m.feedback == "down"),
        "timeline": timeline,
        "recent": recent,
    }
