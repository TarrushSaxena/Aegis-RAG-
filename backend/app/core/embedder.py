import asyncio
import hashlib
import logging
import math

from app.config import get_settings

logger = logging.getLogger(__name__)


class Embedder:
    """Swappable embedding provider with local and OpenAI implementations."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self._model = None
        self._openai = None

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if self.settings.use_local_embeddings:
            try:
                return await asyncio.to_thread(self._embed_local, texts)
            except Exception:
                logger.exception("Local embedding model failed; falling back to hashed embeddings")
                return self._embed_fallback(texts)
        return await self._embed_openai(texts)

    def _embed_local(self, texts: list[str]) -> list[list[float]]:
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.settings.local_embedding_model)
        vectors = self._model.encode(
            texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        return vectors.tolist()

    async def _embed_openai(self, texts: list[str]) -> list[list[float]]:
        from openai import AsyncOpenAI

        if self._openai is None:
            self._openai = AsyncOpenAI(api_key=self.settings.openai_api_key)
        response = await self._openai.embeddings.create(model=self.settings.openai_embedding_model, input=texts)
        return [item.embedding for item in response.data]

    def _embed_fallback(self, texts: list[str], size: int = 128) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            vector = [0.0] * size
            for token in text.lower().split():
                digest = hashlib.sha256(token.encode("utf-8")).digest()
                for i in range(0, 8, 2):
                    index = int.from_bytes(digest[i : i + 2], "little") % size
                    vector[index] += 1.0
            norm = math.sqrt(sum(value * value for value in vector)) or 1.0
            vectors.append([value / norm for value in vector])
        return vectors
