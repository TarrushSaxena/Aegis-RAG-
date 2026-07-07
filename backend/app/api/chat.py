import json
import time
import uuid
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.contradiction import ContradictionDetector
from app.core.freshness import freshness_warning
from app.core.generator import Generator
from app.core.reformulator import QueryReformulator
from app.core.retriever import Retriever
from app.db.models import ChatSession, Document, EvaluationResult, Message
from app.db.session import AsyncSessionLocal, get_db
from app.evaluation.ragas_eval import evaluate_answers
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/chat", tags=["chat"])
settings = get_settings()


class ChatRequest(BaseModel):
    question: str
    doc_ids: list[uuid.UUID]
    session_id: uuid.UUID | None = None


class FeedbackRequest(BaseModel):
    feedback: Literal["up", "down"] | None = None


@router.post("/stream")
@limiter.limit(settings.chat_rate_limit)
async def chat_stream(
    request: Request,
    payload: ChatRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    if not payload.doc_ids:
        raise HTTPException(status_code=400, detail="At least one document must be selected.")
    doc_ids = [str(doc_id) for doc_id in payload.doc_ids]
    session = await _get_or_create_session(db, payload.session_id)
    history = await _history(db, session.id)

    retrieval_start = time.perf_counter()
    generator = Generator()
    variants = [payload.question] + await QueryReformulator(generator).reformulate(payload.question)
    retriever = Retriever()
    candidates = []
    for variant in variants:
        candidates.extend(await retriever.retrieve(db, variant, doc_ids))
    candidates = retriever._rerank(payload.question, retriever._rrf([candidates]))[: settings.retrieval_top_k]
    confidence = candidates[0].score if candidates else 0.0

    contradiction, reason = await ContradictionDetector(generator).detect(candidates)
    freshness_warnings = await _freshness_warnings(db, doc_ids)
    retrieval_ms = (time.perf_counter() - retrieval_start) * 1000

    async def events():
        generation_start = time.perf_counter()
        if confidence < settings.confidence_threshold:
            answer = "The provided documents do not contain enough information to answer this question."
            yield f"data: {json.dumps({'type': 'token', 'value': answer})}\n\n"
        else:
            parts = []
            try:
                async for token in generator.stream_answer(payload.question, candidates, history):
                    parts.append(token)
                    yield f"data: {json.dumps({'type': 'token', 'value': token})}\n\n"
                answer = "".join(parts)
            except Exception:
                answer = "AI generation is temporarily unavailable. Here are the most relevant excerpts."
                yield f"data: {json.dumps({'type': 'token', 'value': answer})}\n\n"
        generation_ms = (time.perf_counter() - generation_start) * 1000
        total_ms = retrieval_ms + generation_ms
        sources = [
            {
                "doc_id": item.doc_id,
                "doc_name": item.doc_name,
                "page": item.page_number,
                "excerpt": item.text[:500],
                "similarity_score": item.score,
            }
            for item in candidates
        ]
        usage = generator.last_usage or {}
        assistant_message = Message(
            session_id=session.id,
            role="assistant",
            content=answer,
            sources=sources,
            confidence=confidence,
            contradiction_flag=contradiction,
            contradiction_reason=reason,
            retrieval_ms=retrieval_ms,
            generation_ms=generation_ms,
            total_ms=total_ms,
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
        )
        db.add(Message(session_id=session.id, role="user", content=payload.question))
        db.add(assistant_message)
        await db.commit()
        await db.refresh(assistant_message)
        if candidates:
            background_tasks.add_task(
                _run_evaluation,
                str(assistant_message.id),
                payload.question,
                answer,
                [item.text for item in candidates],
            )
        yield "data: " + json.dumps(
            {
                "type": "done",
                "session_id": str(session.id),
                "message_id": str(assistant_message.id),
                "sources": sources,
                "confidence": confidence,
                "contradiction": contradiction,
                "contradiction_reason": reason,
                "query_variants_used": variants,
                "freshness_warnings": freshness_warnings,
                "latency_ms": total_ms,
            }
        ) + "\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@router.patch("/messages/{message_id}/feedback")
async def set_feedback(
    message_id: uuid.UUID, payload: FeedbackRequest, db: AsyncSession = Depends(get_db)
) -> dict[str, str | None]:
    message = await db.get(Message, str(message_id))
    if message is None:
        raise HTTPException(status_code=404, detail="Message not found")
    message.feedback = payload.feedback
    await db.commit()
    return {"status": "ok", "feedback": message.feedback}


@router.get("/sessions")
async def list_sessions(db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = await db.execute(
        select(ChatSession).where(ChatSession.user_id == "demo-user").order_by(ChatSession.created_at.desc())
    )
    sessions = list(rows.scalars())
    result = []
    for session in sessions:
        first_message = await db.execute(
            select(Message.content)
            .where(Message.session_id == session.id, Message.role == "user")
            .order_by(Message.created_at.asc())
            .limit(1)
        )
        preview = first_message.scalar_one_or_none()
        result.append(
            {
                "id": session.id,
                "created_at": session.created_at,
                "preview": (preview or "New conversation")[:80],
            }
        )
    return result


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> list[dict]:
    rows = await db.execute(
        select(Message).where(Message.session_id == str(session_id)).order_by(Message.created_at.asc())
    )
    return [
        {
            "id": message.id,
            "role": message.role,
            "content": message.content,
            "sources": message.sources,
            "confidence": message.confidence,
            "contradiction_flag": message.contradiction_flag,
            "contradiction_reason": message.contradiction_reason,
            "feedback": message.feedback,
        }
        for message in rows.scalars()
    ]


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    session = await db.get(ChatSession, str(session_id))
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()
    return {"status": "deleted"}


async def _get_or_create_session(db: AsyncSession, session_id: uuid.UUID | None) -> ChatSession:
    if session_id:
        session = await db.get(ChatSession, str(session_id))
        if session:
            return session
    session = ChatSession(user_id="demo-user")
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def _run_evaluation(message_id: str, question: str, answer: str, contexts: list[str]) -> None:
    summary = await evaluate_answers(
        [{"question": question, "answer": answer, "contexts": contexts}]
    )
    if not (summary.faithfulness or summary.relevance or summary.context_precision):
        return
    async with AsyncSessionLocal() as db:
        db.add(
            EvaluationResult(
                message_id=message_id,
                faithfulness=summary.faithfulness,
                relevance=summary.relevance,
                context_precision=summary.context_precision,
            )
        )
        await db.commit()


async def _freshness_warnings(db: AsyncSession, doc_ids: list[str]) -> list[str]:
    rows = await db.execute(select(Document).where(Document.id.in_(doc_ids)))
    documents = [doc for doc in rows.scalars() if doc.doc_date]
    if not documents:
        return []
    newest_date = max(doc.doc_date for doc in documents)
    warnings: list[str] = []
    for doc in documents:
        message = freshness_warning(doc.doc_date, newest_date, settings.stale_after_days)
        if message:
            warnings.append(f"{doc.original_name}: {message}")
    return warnings


async def _history(db: AsyncSession, session_id: uuid.UUID) -> list[dict[str, str]]:
    rows = await db.execute(
        select(Message).where(Message.session_id == session_id).order_by(Message.created_at.desc()).limit(8)
    )
    messages = list(reversed(rows.scalars().all()))
    return [{"role": message.role, "content": message.content} for message in messages]
