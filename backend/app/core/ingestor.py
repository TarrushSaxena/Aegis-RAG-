import hashlib
from datetime import date
from pathlib import Path
from langdetect import detect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.chunker import SemanticChunker
from app.core.embedder import Embedder
from app.core.freshness import extract_document_date, freshness_warning
from app.core.retriever import Retriever, build_bm25_index
from app.db.models import Chunk, Document, DocumentStatus
from app.utils.pdf_parser import PDFParser


class Ingestor:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.parser = PDFParser()
        self.chunker = SemanticChunker()
        self.embedder = Embedder()
        self.retriever = Retriever(self.embedder)

    async def ingest(self, db: AsyncSession, doc_id: str) -> Document:
        document = await db.get(Document, doc_id)
        if document is None:
            raise ValueError(f"Document {doc_id} not found")
        document.status = DocumentStatus.processing
        await db.commit()
        try:
            parsed = self.parser.parse(Path(document.filename))
            leading_text = "\n".join(page.raw_text for page in parsed.pages[:2])
            document.page_count = parsed.page_count
            document.doc_date = extract_document_date(leading_text)
            document.is_stale = bool(
                document.doc_date
                and freshness_warning(document.doc_date, date.today(), self.settings.stale_after_days)
            )
            document.language = self._detect_language(leading_text)
            chunk_records = self.chunker.chunk(parsed)
            chunks = [
                Chunk(
                    doc_id=document.id,
                    page_number=item.page_number,
                    section_heading=item.section_heading,
                    chunk_index=item.chunk_index,
                    chunk_type=item.chunk_type,
                    text=item.text,
                    token_count=item.token_count,
                )
                for item in chunk_records
            ]
            db.add_all(chunks)
            document.chunk_count = len(chunks)
            await db.flush()
            vectors = await self.embedder.embed([chunk.text for chunk in chunks])
            await self.retriever.upsert_chunks(chunks, vectors, document)
            build_bm25_index(self.settings.bm25_dir / f"{document.id}.pkl", chunks)
            document.status = DocumentStatus.ready
            await db.commit()
            return document
        except Exception as exc:
            if document.chunk_count == 0:
                document.status = DocumentStatus.failed
                document.error_message = str(exc)
                await db.commit()
                raise
            build_bm25_index(self.settings.bm25_dir / f"{document.id}.pkl", chunks)
            document.status = DocumentStatus.ready
            document.error_message = None
            await db.commit()
            return document

    async def find_duplicate(self, db: AsyncSession, user_id: str, file_hash: str) -> Document | None:
        result = await db.execute(select(Document).where(Document.user_id == user_id, Document.file_hash == file_hash))
        return result.scalar_one_or_none()

    def sha256(self, path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for block in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(block)
        return digest.hexdigest()

    def _detect_language(self, text: str) -> str | None:
        try:
            return detect(text[:2000]) if text.strip() else None
        except Exception:
            return None
