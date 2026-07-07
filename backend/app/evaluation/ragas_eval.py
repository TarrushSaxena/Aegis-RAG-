from dataclasses import dataclass


@dataclass
class EvaluationSummary:
    faithfulness: float
    relevance: float
    context_precision: float


async def evaluate_answers(samples: list[dict]) -> EvaluationSummary:
    """Run RAGAS when configured; return a stable shape for the API/README."""

    try:
        from datasets import Dataset
        from ragas import evaluate
        from ragas.metrics import answer_relevancy, context_precision, faithfulness

        dataset = Dataset.from_list(samples)
        result = evaluate(dataset, metrics=[faithfulness, answer_relevancy, context_precision])
        return EvaluationSummary(
            faithfulness=float(result["faithfulness"]),
            relevance=float(result["answer_relevancy"]),
            context_precision=float(result["context_precision"]),
        )
    except Exception:
        return EvaluationSummary(faithfulness=0.0, relevance=0.0, context_precision=0.0)

