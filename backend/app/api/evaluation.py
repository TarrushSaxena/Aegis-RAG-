from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import EvaluationResult
from app.db.session import get_db

router = APIRouter(prefix="/evaluation", tags=["evaluation"])


@router.get("/report")
async def report(db: AsyncSession = Depends(get_db)) -> dict[str, float | int]:
    row = await db.execute(
        select(
            func.count(EvaluationResult.id),
            func.avg(EvaluationResult.faithfulness),
            func.avg(EvaluationResult.relevance),
            func.avg(EvaluationResult.context_precision),
        )
    )
    count, faithfulness, relevance, context_precision = row.one()
    return {
        "sample_count": count,
        "faithfulness": float(faithfulness or 0),
        "relevance": float(relevance or 0),
        "context_precision": float(context_precision or 0),
    }

