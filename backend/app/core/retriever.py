import asyncio
import math
import pickle
from dataclasses import dataclass
from pathlib import Path

from rank_bm25 import BM25Okapi
from qdrant_client import AsyncQdrantClient
from qdrant_client.http.models import Distance, FieldCondition, Filter, MatchAny, PointStruct, VectorParams
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.embedder import Embedder
from app.db.models import Chunk, Document


@dataclass
class RetrievalResult:
    chunk_id: str
    doc_id: str
    doc_name: str
    page_number: int
    text: str
    section_heading: str | None
    score: float
    source: str


class Retriever:
    def __init__(self, embedder: Embedder | None = None) -> None:
        self.settings = get_settings()
        self.embedder = embedder or Embedder()
        self.qdrant = AsyncQdrantClient(url=self.settings.qdrant_url)
        self._qdrant_available: bool | None = None
        self._reranker = None

    async def ensure_collection(self, vector_size: int) -> None:
        if not await self._has_qdrant():
            return
        try:
            collections = await self.qdrant.get_collections()
            if any(item.name == self.settings.qdrant_collection for item in collections.collections):
                return
            await self.qdrant.create_collection(
                collection_name=self.settings.qdrant_collection,
                vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
            )
        except Exception:
            return

    async def upsert_chunks(self, chunks: list[Chunk], vectors: list[list[float]], document: Document) -> None:
        if not chunks:
            return
        if not await self._has_qdrant():
            return
        try:
            await self.ensure_collection(len(vectors[0]))
            points = [
                PointStruct(
                    id=str(chunk.id),
                    vector=vector,
                    payload={
                        "chunk_id": str(chunk.id),
                        "doc_id": str(document.id),
                        "doc_name": document.original_name,
                        "page_number": chunk.page_number,
                        "section_heading": chunk.section_heading,
                        "chunk_type": chunk.chunk_type,
                        "text": chunk.text,
                    },
                )
                for chunk, vector in zip(chunks, vectors, strict=True)
            ]
            await self.qdrant.upsert(collection_name=self.settings.qdrant_collection, points=points)
        except Exception:
            return

    async def retrieve(self, db: AsyncSession, query: str, doc_ids: list[str]) -> list[RetrievalResult]:
        variants = [query]
        dense_tasks = [self._dense_search(variant, doc_ids) for variant in variants]
        sparse_tasks = [self._sparse_search(db, variant, doc_ids) for variant in variants]
        lists = await asyncio.gather(*dense_tasks, *sparse_tasks)
        fused = self._rrf(lists)
        reranked = self._rerank(query, fused)
        return reranked[: self.settings.retrieval_top_k]

    async def _dense_search(self, query: str, doc_ids: list[str]) -> list[RetrievalResult]:
        if not await self._has_qdrant():
            return []
        try:
            vector = (await self.embedder.embed([query]))[0]
            query_filter = Filter(
                must=[FieldCondition(key="doc_id", match=MatchAny(any=[str(doc_id) for doc_id in doc_ids]))]
            )
            response = await self.qdrant.query_points(
                collection_name=self.settings.qdrant_collection,
                query=vector,
                query_filter=query_filter,
                limit=self.settings.retrieval_top_k,
            )
            results: list[RetrievalResult] = []
            for hit in response.points:
                payload = hit.payload or {}
                results.append(
                    RetrievalResult(
                        chunk_id=str(payload.get("chunk_id")),
                        doc_id=str(payload.get("doc_id")),
                        doc_name=str(payload.get("doc_name")),
                        page_number=int(payload.get("page_number", 0)),
                        section_heading=payload.get("section_heading"),
                        text=str(payload.get("text", "")),
                        score=float(hit.score),
                        source="dense",
                    )
                )
            return results
        except Exception:
            return []

    async def _sparse_search(self, db: AsyncSession, query: str, doc_ids: list[str]) -> list[RetrievalResult]:
        results: list[RetrievalResult] = []
        for doc_id in doc_ids:
            index_path = self._bm25_path(doc_id)
            if not index_path.exists():
                continue
            with index_path.open("rb") as handle:
                payload = pickle.load(handle)
            bm25: BM25Okapi = payload["bm25"]
            chunk_ids: list[str] = payload["chunk_ids"]
            scores = bm25.get_scores(query.lower().split())
            ranked = sorted(enumerate(scores), key=lambda item: item[1], reverse=True)[: self.settings.retrieval_top_k]
            candidate_ids = [chunk_ids[idx] for idx, _score in ranked]
            if not candidate_ids:
                continue
            rows = await db.execute(select(Chunk, Document).join(Document).where(Chunk.id.in_(candidate_ids)))
            lookup = {str(chunk.id): (chunk, doc) for chunk, doc in rows.all()}
            for idx, score in ranked:
                chunk_id = chunk_ids[idx]
                if chunk_id not in lookup:
                    continue
                chunk, doc = lookup[chunk_id]
                results.append(
                    RetrievalResult(
                        chunk_id=str(chunk.id),
                        doc_id=str(doc.id),
                        doc_name=doc.original_name,
                        page_number=chunk.page_number,
                        section_heading=chunk.section_heading,
                        text=chunk.text,
                        score=float(score),
                        source="sparse",
                    )
                )
        return results

    def _rrf(self, result_lists: list[list[RetrievalResult]]) -> list[RetrievalResult]:
        fused: dict[str, RetrievalResult] = {}
        scores: dict[str, float] = {}
        for results in result_lists:
            for rank, result in enumerate(results, start=1):
                fused[result.chunk_id] = result
                scores[result.chunk_id] = scores.get(result.chunk_id, 0.0) + 1.0 / (self.settings.rrf_k + rank)
        for chunk_id, result in fused.items():
            result.score = scores[chunk_id]
            result.source = "hybrid_rrf"
        return sorted(fused.values(), key=lambda item: item.score, reverse=True)

    def _rerank(self, query: str, candidates: list[RetrievalResult]) -> list[RetrievalResult]:
        if not candidates:
            return []
        try:
            from sentence_transformers import CrossEncoder

            if self._reranker is None:
                self._reranker = CrossEncoder(self.settings.reranker_model)
            scores = self._reranker.predict([(query, item.text) for item in candidates])
            for item, score in zip(candidates, scores, strict=True):
                # Cross-encoder scores are unbounded logits; squash to a 0-1 confidence.
                item.score = 1.0 / (1.0 + math.exp(-float(score)))
                item.source = "cross_encoder"
            return sorted(candidates, key=lambda item: item.score, reverse=True)
        except Exception:
            return candidates

    def _bm25_path(self, doc_id: str) -> Path:
        return self.settings.bm25_dir / f"{doc_id}.pkl"

    async def _has_qdrant(self) -> bool:
        if self._qdrant_available is not None:
            return self._qdrant_available
        try:
            await self.qdrant.get_collections()
            self._qdrant_available = True
        except Exception:
            self._qdrant_available = False
        return self._qdrant_available


def build_bm25_index(path: Path, chunks: list[Chunk]) -> None:
    tokenized = [chunk.text.lower().split() for chunk in chunks]
    bm25 = BM25Okapi(tokenized)
    with path.open("wb") as handle:
        pickle.dump({"bm25": bm25, "chunk_ids": [str(chunk.id) for chunk in chunks]}, handle)
