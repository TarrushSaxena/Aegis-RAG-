import asyncio

from app.core.ingestor import Ingestor
from app.db.session import AsyncSessionLocal
from app.tasks.celery_app import celery_app


@celery_app.task(bind=True)
def ingest_document_task(self, doc_id: str) -> dict[str, str]:
    return asyncio.run(_ingest(self, doc_id))


async def _ingest(task, doc_id: str) -> dict[str, str]:
    task.update_state(state="PROGRESS", meta={"step": "processing"})
    async with AsyncSessionLocal() as db:
        await Ingestor().ingest(db, doc_id)
    task.update_state(state="PROGRESS", meta={"step": "ready"})
    return {"doc_id": str(doc_id), "status": "ready"}


def run_ingestion_job(doc_id: str) -> None:
    asyncio.run(_ingest_local(doc_id))


async def _ingest_local(doc_id: str) -> None:
    async with AsyncSessionLocal() as db:
        await Ingestor().ingest(db, doc_id)


async def run_ingestion_job_async(doc_id: str) -> None:
    await _ingest_local(doc_id)
