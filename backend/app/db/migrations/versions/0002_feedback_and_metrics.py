"""add feedback and per-message metrics

Revision ID: 0002_feedback_and_metrics
Revises: 0001_initial
Create Date: 2026-07-07
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_feedback_and_metrics"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("feedback", sa.String(8), nullable=True))
    op.add_column("messages", sa.Column("retrieval_ms", sa.Float(), nullable=True))
    op.add_column("messages", sa.Column("generation_ms", sa.Float(), nullable=True))
    op.add_column("messages", sa.Column("total_ms", sa.Float(), nullable=True))
    op.add_column("messages", sa.Column("prompt_tokens", sa.Integer(), nullable=True))
    op.add_column("messages", sa.Column("completion_tokens", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("messages", "completion_tokens")
    op.drop_column("messages", "prompt_tokens")
    op.drop_column("messages", "total_ms")
    op.drop_column("messages", "generation_ms")
    op.drop_column("messages", "retrieval_ms")
    op.drop_column("messages", "feedback")
