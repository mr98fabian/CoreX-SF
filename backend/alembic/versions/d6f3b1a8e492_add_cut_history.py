"""cut_history (reported balance per debt per statement cut)

Revision ID: d6f3b1a8e492
Revises: c5e2a9d4f871
Create Date: 2026-11-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'd6f3b1a8e492'
down_revision: Union[str, None] = 'c5e2a9d4f871'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = sa.String(36).with_variant(postgresql.UUID(as_uuid=False), "postgresql")


def upgrade() -> None:
    op.create_table(
        'cut_history',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('account_id', sa.Integer(), sa.ForeignKey('accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('cut_date', sa.Date(), nullable=False),
        sa.Column('reported_balance', sa.Numeric(14, 2), nullable=False),
        sa.Column('was_zero', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('source', sa.String(length=12), nullable=False, server_default='manual'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('account_id', 'cut_date', name='uq_cut_history_account_date'),
    )
    op.create_index('ix_cut_history_user_id', 'cut_history', ['user_id'])
    op.create_index('ix_cut_history_account_id', 'cut_history', ['account_id'])


def downgrade() -> None:
    op.drop_index('ix_cut_history_account_id', 'cut_history')
    op.drop_index('ix_cut_history_user_id', 'cut_history')
    op.drop_table('cut_history')
