from app.utils.pdf_parser import ParsedDocument, ParsedTable


def collect_tables(document: ParsedDocument) -> list[ParsedTable]:
    return [table for page in document.pages for table in page.tables]

