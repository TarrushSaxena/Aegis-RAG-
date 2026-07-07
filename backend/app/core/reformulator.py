import json


class QueryReformulator:
    def __init__(self, generator: "Generator | None" = None) -> None:
        self.generator = generator

    async def reformulate(self, question: str) -> list[str]:
        if self.generator is None:
            return self._fallback(question)
        prompt = (
            "Rewrite the following question into 3 alternative phrasings suited for retrieving "
            "relevant text from policy documents. Return a JSON array of 3 strings only.\n\n"
            f"Question: {question}"
        )
        raw = await self.generator.complete(prompt)
        try:
            variants = json.loads(raw)
            if isinstance(variants, list):
                return [str(item) for item in variants[:3]]
        except json.JSONDecodeError:
            pass
        return self._fallback(question)

    def _fallback(self, question: str) -> list[str]:
        cleaned = question.strip().rstrip("?")
        return [
            cleaned,
            f"policy clause about {cleaned}",
            f"requirements rules exceptions {cleaned}",
        ][:3]

