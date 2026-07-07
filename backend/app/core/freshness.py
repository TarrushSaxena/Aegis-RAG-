import re
from datetime import date, datetime


DATE_PATTERNS = [
    r"\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b",
    r"\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b",
    r"\b(?:effective|version|updated|revised)\s+(?:date\s*)?:?\s*([A-Z][a-z]+ \d{1,2}, 20\d{2})\b",
]


def extract_document_date(text: str) -> date | None:
    for pattern in DATE_PATTERNS:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if not match:
            continue
        try:
            if len(match.groups()) == 3 and len(match.group(1)) == 4:
                return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            if len(match.groups()) == 3:
                return date(int(match.group(3)), int(match.group(2)), int(match.group(1)))
            return datetime.strptime(match.group(1), "%B %d, %Y").date()
        except ValueError:
            continue
    return None


def freshness_warning(doc_date: date | None, newest_date: date | None, stale_after_days: int = 365) -> str | None:
    if not doc_date or not newest_date:
        return None
    if (newest_date - doc_date).days > stale_after_days:
        return f"Source document dated {doc_date.isoformat()} may be stale."
    return None

