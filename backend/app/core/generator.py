from collections.abc import AsyncGenerator

from app.config import get_settings
from app.core.retriever import RetrievalResult


GROUNDING_PROMPT = """You are a precise document assistant.
Answer questions using ONLY the provided context.
Do not use outside knowledge.
If the context does not contain sufficient information, respond exactly with:
"The provided documents do not contain enough information to answer this question."
At the end of every answer, list your sources as [Document: filename.pdf, Page X]."""


class Generator:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.last_usage: dict[str, int] | None = None

    async def complete(self, prompt: str) -> str:
        if self.settings.llm_provider == "gemini":
            return await self._complete_gemini(prompt)
        if self.settings.llm_provider == "groq":
            from groq import AsyncGroq

            client = AsyncGroq(api_key=self.settings.groq_api_key)
            response = await client.chat.completions.create(
                model=self.settings.groq_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
            )
            return response.choices[0].message.content or ""
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self.settings.openai_api_key, base_url=self.settings.openai_base_url)
        response = await client.chat.completions.create(
            model=self.settings.openai_chat_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        return response.choices[0].message.content or ""

    async def _complete_gemini(self, prompt: str) -> str:
        from google import genai

        client = genai.Client(api_key=self.settings.google_api_key)
        response = await client.aio.models.generate_content(model=self.settings.gemini_model, contents=prompt)
        return response.text or ""

    async def stream_answer(
        self,
        question: str,
        sources: list[RetrievalResult],
        history: list[dict[str, str]] | None = None,
    ) -> AsyncGenerator[str, None]:
        context = self._context_block(sources)
        history_text = "\n".join(f"{item['role']}: {item['content']}" for item in (history or [])[-8:])
        user_content = f"Conversation history:\n{history_text}\n\nContext:\n{context}\n\nQuestion: {question}"

        if self.settings.llm_provider == "gemini":
            async for token in self._stream_gemini(user_content):
                yield token
            return

        messages = [
            {"role": "system", "content": GROUNDING_PROMPT},
            {"role": "user", "content": user_content},
        ]
        if self.settings.llm_provider == "groq":
            from groq import AsyncGroq

            client = AsyncGroq(api_key=self.settings.groq_api_key)
            stream = await client.chat.completions.create(
                model=self.settings.groq_model,
                messages=messages,
                temperature=0,
                stream=True,
            )
            async for chunk in stream:
                token = chunk.choices[0].delta.content
                if token:
                    yield token
            return
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=self.settings.openai_api_key, base_url=self.settings.openai_base_url)
        stream = await client.chat.completions.create(
            model=self.settings.openai_chat_model,
            messages=messages,
            temperature=0,
            stream=True,
        )
        async for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                yield token

    async def _stream_gemini(self, user_content: str) -> AsyncGenerator[str, None]:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self.settings.google_api_key)
        config = types.GenerateContentConfig(system_instruction=GROUNDING_PROMPT, temperature=0)
        stream = await client.aio.models.generate_content_stream(
            model=self.settings.gemini_model,
            contents=user_content,
            config=config,
        )
        async for chunk in stream:
            if chunk.usage_metadata:
                self.last_usage = {
                    "prompt_tokens": chunk.usage_metadata.prompt_token_count or 0,
                    "completion_tokens": chunk.usage_metadata.candidates_token_count or 0,
                }
            if chunk.text:
                yield chunk.text

    def _context_block(self, sources: list[RetrievalResult]) -> str:
        parts = []
        for idx, source in enumerate(sources, start=1):
            parts.append(
                f"[{idx}] Document: {source.doc_name}, Page {source.page_number}, "
                f"Section: {source.section_heading or 'Unknown'}\n{source.text}"
            )
        return "\n\n".join(parts)
