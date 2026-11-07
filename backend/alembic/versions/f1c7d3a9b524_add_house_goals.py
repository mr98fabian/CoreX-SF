"""house_goals (Modo Compra de Casa)

Revision ID: f1c7d3a9b524
Revises: c5e2a9d4f871
Create Date: 2026-11-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f1c7d3a9b524'
down_revision: Union[str, None] = 'c5e2a9d4f871'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = sa.String(36).with_variant(postgresql.UUID(as_uuid=False), "postgresql")


def upgrade() -> None:
    op.create_table(
        'house_goals',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('target_total', sa.Numeric(14, 2), nullable=False),
        sa.Column('home_price', sa.Numeric(14, 2), nullable=False),
        sa.Column('down_pct', sa.Numeric(5, 2), nullable=False, server_default='3.5'),
        sa.Column('closing_pct', sa.Numeric(5, 2), nullable=False, server_default='3.0'),
        sa.Column('saved_amount', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('monthly_saving', sa.Numeric(14, 2), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_house_goals_user_id', 'house_goals', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_house_goals_user_id', 'house_goals')
    op.drop_table('house_goals')
