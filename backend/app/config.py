from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized application configuration."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Career-Grade RAG Chatbot"
    environment: str = "development"
    api_prefix: str = "/api"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3010"])

    database_url: str = "sqlite+aiosqlite:///./data/rag.db"
    redis_url: str = "redis://redis:6379/0"
    qdrant_url: str = "http://qdrant:6333"
    qdrant_collection: str = "rag_chunks"

    upload_dir: Path = Path("/data/uploads")
    bm25_dir: Path = Path("/data/bm25")

    llm_provider: str = "gemini"
    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_chat_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    google_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    local_embedding_model: str = "BAAI/bge-small-en-v1.5"
    use_local_embeddings: bool = True

    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"
    retrieval_top_k: int = 5
    rrf_k: int = 60
    confidence_threshold: float = 0.2
    stale_after_days: int = 365
    chat_rate_limit: str = "20/hour"

    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None
    langfuse_host: str | None = None


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.bm25_dir.mkdir(parents=True, exist_ok=True)
    return settings
