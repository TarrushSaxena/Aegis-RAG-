from app.core.generator import Generator
from app.core.retriever import RetrievalResult


def test_context_block_includes_document_and_page():
    source = RetrievalResult(
        chunk_id="c1",
        doc_id="d1",
        doc_name="policy.pdf",
        page_number=7,
        section_heading="Leave",
        text="Employees receive leave.",
        score=0.9,
        source="test",
    )

    block = Generator()._context_block([source])

    assert "policy.pdf" in block
    assert "Page 7" in block
    assert "Employees receive leave." in block

