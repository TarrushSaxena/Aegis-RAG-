from dataclasses import dataclass, field

from app.core.chunker import SemanticChunker


@dataclass
class FakeTable:
    page_number: int
    markdown: str


@dataclass
class FakePage:
    page_number: int
    raw_text: str
    headings: list[str]
    tables: list[FakeTable] = field(default_factory=list)


@dataclass
class FakeDocument:
    page_count: int
    pages: list[FakePage]


def test_chunker_keeps_tables_as_single_chunks():
    doc = FakeDocument(
        page_count=1,
        pages=[
            FakePage(
                page_number=1,
                raw_text="Policy\n" + " ".join(["word"] * 120),
                headings=["Policy"],
                tables=[FakeTable(page_number=1, markdown="| A | B |\n| --- | --- |\n| 1 | 2 |")],
            )
        ],
    )

    chunks = SemanticChunker(chunk_size=50, overlap=10).chunk(doc)  # type: ignore[arg-type]

    assert any(chunk.chunk_type == "table" for chunk in chunks)
    table_chunks = [chunk for chunk in chunks if chunk.chunk_type == "table"]
    assert len(table_chunks) == 1
    assert "| A | B |" in table_chunks[0].text


def test_chunker_applies_overlap_to_long_sections():
    doc = FakeDocument(
        page_count=1,
        pages=[FakePage(page_number=1, raw_text=" ".join(f"t{i}" for i in range(130)), headings=[])],
    )

    chunks = SemanticChunker(chunk_size=60, overlap=10).chunk(doc)  # type: ignore[arg-type]

    assert len(chunks) == 3
    assert chunks[0].text.split()[-10:] == chunks[1].text.split()[:10]

