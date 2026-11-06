"""add sync_state (last bank-data sync per user)

Revision ID: f3b8d2a6c514
Revises: e9c4f1a2b7d3
Create Date: 2026-11-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'f3b8d2a6c514'
down_revision: Union[str, None] = 'e9c4f1a2b7d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sync_state',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.String(36).with_variant(postgresql.UUID(as_uuid=False), 'postgresql'), nullable=False),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('last_source', sa.String(length=40), nullable=True),
    )
    op.create_index('ix_sync_state_user_id', 'sync_state', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_sync_state_user_id', table_name='sync_state')
    op.drop_table('sync_state')
