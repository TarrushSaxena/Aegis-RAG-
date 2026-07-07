from datetime import date

from app.core.freshness import extract_document_date, freshness_warning


def test_extracts_iso_date():
    assert extract_document_date("Effective date: 2024-03-15") == date(2024, 3, 15)


def test_freshness_warning_for_old_document():
    warning = freshness_warning(date(2023, 1, 1), date(2025, 1, 2), stale_after_days=365)
    assert warning is not None
    assert "2023-01-01" in warning

