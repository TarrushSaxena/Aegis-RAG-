from dataclasses import dataclass
from typing import Protocol


class PageLike(Protocol):
    page_number: int
    raw_text: str
    headings: list[str]
    tables: list


class DocumentLike(Protocol):
    page_count: int
    pages: list[PageLike]


@dataclass
class ChunkRecord:
    page_number: int
    section_heading: str | None
    chunk_index: int
    chunk_type: str
    text: str
    token_count: int


class SemanticChunker:
    def __init__(self, chunk_size: int = 450, overlap: int = 75, min_section_tokens: int = 100) -> None:
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.min_section_tokens = min_section_tokens

    def chunk(self, document: DocumentLike) -> list[ChunkRecord]:
        chunks: list[ChunkRecord] = []
        index = 0
        for page in document.pages:
            sections = self._split_by_headings(page.raw_text, page.headings)
            sections = self._merge_short_sections(sections)
            for heading, text in sections:
                for piece in self._window(text):
                    chunks.append(
                        ChunkRecord(
                            page_number=page.page_number,
                            section_heading=heading,
                            chunk_index=index,
                            chunk_type="text",
                            text=piece,
                            token_count=len(piece.split()),
                        )
                    )
                    index += 1
            for table in page.tables:
                chunks.append(
                    ChunkRecord(
                        page_number=page.page_number,
                        section_heading="Table",
                        chunk_index=index,
                        chunk_type="table",
                        text=table.markdown,
                        token_count=len(table.markdown.split()),
                    )
                )
                index += 1
        return chunks

    def _split_by_headings(self, text: str, headings: list[str]) -> list[tuple[str | None, str]]:
        if not text:
            return []
        if not headings:
            return [(None, text)]
        sections: list[tuple[str | None, str]] = []
        current_heading: str | None = None
        current_lines: list[str] = []
        heading_set = set(headings)
        for line in text.splitlines():
            stripped = line.strip()
            if stripped in heading_set:
                if current_lines:
                    sections.append((current_heading, "\n".join(current_lines).strip()))
                    current_lines = []
                current_heading = stripped
            else:
                current_lines.append(line)
        if current_lines:
            sections.append((current_heading, "\n".join(current_lines).strip()))
        return [(heading, body) for heading, body in sections if body]

    def _merge_short_sections(self, sections: list[tuple[str | None, str]]) -> list[tuple[str | None, str]]:
        merged: list[tuple[str | None, str]] = []
        carry_heading: str | None = None
        carry_text = ""
        for heading, text in sections:
            candidate = f"{carry_text}\n{text}".strip() if carry_text else text
            if len(candidate.split()) < self.min_section_tokens:
                carry_heading = carry_heading or heading
                carry_text = candidate
                continue
            merged.append((carry_heading or heading, candidate))
            carry_heading = None
            carry_text = ""
        if carry_text:
            merged.append((carry_heading, carry_text))
        return merged

    def _window(self, text: str) -> list[str]:
        tokens = text.split()
        if len(tokens) <= self.chunk_size:
            return [text]
        pieces: list[str] = []
        start = 0
        while start < len(tokens):
            end = min(start + self.chunk_size, len(tokens))
            pieces.append(" ".join(tokens[start:end]))
            if end == len(tokens):
                break
            start = max(0, end - self.overlap)
        return pieces
