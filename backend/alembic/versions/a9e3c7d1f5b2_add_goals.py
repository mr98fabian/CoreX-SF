"""goals (Sección Metas)

Revision ID: a9e3c7d1f5b2
Revises: b7d2e4f1a9c3
Create Date: 2026-11-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a9e3c7d1f5b2'
down_revision: Union[str, None] = 'b7d2e4f1a9c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = sa.String(36).with_variant(postgresql.UUID(as_uuid=False), "postgresql")


def upgrade() -> None:
    op.create_table(
        'goals',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('name', sa.String(80), nullable=False),
        sa.Column('target_amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('saved_amount', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('monthly_saving', sa.Numeric(14, 2), nullable=True),
        sa.Column('deadline', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_goals_user_id', 'goals', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_goals_user_id', 'goals')
    op.drop_table('goals')
