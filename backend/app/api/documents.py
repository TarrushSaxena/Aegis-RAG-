import shutil
import uuid
from datetime import date
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.ingestor import Ingestor
from app.db.models import Document, DocumentStatus
from app.db.session import get_db
from app.tasks.ingestion_tasks import run_ingestion_job_async

router = APIRouter(prefix="/documents", tags=["documents"])
settings = get_settings()


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    original_name: str
    page_count: int
    status: DocumentStatus
    chunk_count: int
    doc_date: date | None = None
    is_stale: bool = False
    language: str | None = None
    error_message: str | None = None


@router.post("", response_model=DocumentOut)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> Document:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported.")
    user_id = "demo-user"
    storage_name = f"{uuid.uuid4()}_{Path(file.filename).name}"
    target = settings.upload_dir / storage_name
    with target.open("wb") as handle:
        shutil.copyfileobj(file.file, handle)

    ingestor = Ingestor()
    file_hash = ingestor.sha256(target)
    duplicate = await ingestor.find_duplicate(db, user_id, file_hash)
    if duplicate:
        return duplicate

    document = Document(
        user_id=user_id,
        filename=str(target),
        original_name=file.filename,
        file_hash=file_hash,
        status=DocumentStatus.queued,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    background_tasks.add_task(run_ingestion_job_async, document.id)
    return document


@router.get("", response_model=list[DocumentOut])
async def list_documents(db: AsyncSession = Depends(get_db)) -> list[Document]:
    result = await db.execute(select(Document).order_by(Document.created_at.desc()))
    return list(result.scalars())


@router.get("/{doc_id}", response_model=DocumentOut)
async def get_document(doc_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Document:
    document = await db.get(Document, str(doc_id))
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.delete("/{doc_id}")
async def delete_document(doc_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    document = await db.get(Document, str(doc_id))
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(document)
    await db.commit()
    return {"status": "deleted"}


@router.get("/{doc_id}/file")
async def get_document_file(doc_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> FileResponse:
    document = await db.get(Document, str(doc_id))
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    path = Path(document.filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(path, media_type="application/pdf", filename=document.original_name)


class HighlightRect(BaseModel):
    x0: float
    y0: float
    x1: float
    y1: float


class HighlightOut(BaseModel):
    page_width: float
    page_height: float
    rects: list[HighlightRect]


@router.get("/{doc_id}/pages/{page_number}/highlight", response_model=HighlightOut)
async def get_highlight(
    doc_id: uuid.UUID, page_number: int, text: str, db: AsyncSession = Depends(get_db)
) -> HighlightOut:
    document = await db.get(Document, str(doc_id))
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    path = Path(document.filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    import fitz

    pdf = fitz.open(path)
    if page_number < 1 or page_number > pdf.page_count:
        raise HTTPException(status_code=400, detail="Page out of range")
    page = pdf[page_number - 1]

    words = text.split()
    rects: list = []
    for size in (12, 8, 5, 3):
        candidate = " ".join(words[:size])
        if not candidate:
            continue
        rects = page.search_for(candidate)
        if rects:
            break

    return HighlightOut(
        page_width=page.rect.width,
        page_height=page.rect.height,
        rects=[HighlightRect(x0=r.x0, y0=r.y0, x1=r.x1, y1=r.y1) for r in rects],
    )
