from dataclasses import dataclass, field
from pathlib import Path

import fitz


@dataclass
class ParsedTable:
    page_number: int
    markdown: str


@dataclass
class ParsedPage:
    page_number: int
    raw_text: str
    headings: list[str] = field(default_factory=list)
    tables: list[ParsedTable] = field(default_factory=list)
    is_ocr_page: bool = False


@dataclass
class ParsedDocument:
    page_count: int
    pages: list[ParsedPage]


class PDFParser:
    """Extracts page text, headings, tables, and OCR-needed flags from PDFs."""

    def parse(self, path: Path) -> ParsedDocument:
        doc = fitz.open(path)
        pages: list[ParsedPage] = []
        for index, page in enumerate(doc, start=1):
            raw_text = page.get_text("text").strip()
            headings = self._extract_headings(page)
            tables = self._extract_tables(page, index)
            pages.append(
                ParsedPage(
                    page_number=index,
                    raw_text=raw_text,
                    headings=headings,
                    tables=tables,
                    is_ocr_page=len(raw_text) < 50,
                )
            )
        return ParsedDocument(page_count=doc.page_count, pages=pages)

    def _extract_headings(self, page: fitz.Page) -> list[str]:
        data = page.get_text("dict")
        spans: list[tuple[float, str]] = []
        for block in data.get("blocks", []):
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    size = float(span.get("size", 0))
                    if text:
                        spans.append((size, text))
        if not spans:
            return []
        sizes = sorted(size for size, _ in spans)
        median = sizes[len(sizes) // 2]
        headings = [text for size, text in spans if size >= median * 1.25 and len(text.split()) <= 14]
        return list(dict.fromkeys(headings))

    def _extract_tables(self, page: fitz.Page, page_number: int) -> list[ParsedTable]:
        tables: list[ParsedTable] = []
        try:
            found = page.find_tables()
        except Exception:
            return tables
        for table in found.tables:
            rows = table.extract()
            if not rows:
                continue
            markdown = self._rows_to_markdown(rows)
            tables.append(ParsedTable(page_number=page_number, markdown=markdown))
        return tables

    def _rows_to_markdown(self, rows: list[list[str | None]]) -> str:
        normalized = [["" if cell is None else str(cell).replace("\n", " ") for cell in row] for row in rows]
        header = normalized[0]
        separator = ["---"] * len(header)
        body = normalized[1:]
        return "\n".join(
            ["| " + " | ".join(header) + " |", "| " + " | ".join(separator) + " |"]
            + ["| " + " | ".join(row) + " |" for row in body]
        )

