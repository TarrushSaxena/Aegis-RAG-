from app.core.generator import Generator
from app.core.retriever import RetrievalResult


class ContradictionDetector:
    def __init__(self, generator: Generator | None = None) -> None:
        self.generator = generator or Generator()

    async def detect(self, chunks: list[RetrievalResult]) -> tuple[bool, str | None]:
        docs = {chunk.doc_id for chunk in chunks}
        if len(docs) < 2:
            return False, None
        comparable = [chunk for chunk in chunks if chunk.section_heading]
        if len(comparable) < 2:
            return False, None
        prompt = (
            "Compare these policy excerpts. Do they contradict each other? "
            'Reply as JSON: {"contradicts": true/false, "reason": "brief explanation"}.\n\n'
            + "\n\n".join(f"{chunk.doc_name} p.{chunk.page_number}: {chunk.text}" for chunk in comparable[:5])
        )
        try:
            raw = await self.generator.complete(prompt)
            return ('"contradicts": true' in raw.lower(), raw[:500])
        except Exception:
            return False, None

