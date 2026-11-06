"""add summary and note to api_token_audit

summary: what an AI write changed, in plain words (set by the handler).
note:    the AI's short reason (X-Korex-Note header, ≤ 140 chars).
Both nullable: older rows keep listing with the generic phrase.

Revision ID: e9c4f1a2b7d3
Revises: d7a3b9c41e02
Create Date: 2026-11-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e9c4f1a2b7d3'
down_revision: Union[str, None] = 'd7a3b9c41e02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('api_token_audit', sa.Column('summary', sa.String(), nullable=True))
    op.add_column('api_token_audit', sa.Column('note', sa.String(length=140), nullable=True))


def downgrade() -> None:
    op.drop_column('api_token_audit', 'note')
    op.drop_column('api_token_audit', 'summary')
