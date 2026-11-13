"""cut_history: statement minimum and its due date (mínimo del estado, Fase B safety)

The daily mission never sets aside less than the statement's own minimum for the
current cycle. Both columns are nullable: no statement loaded = current behaviour.
cut_history already has RLS enabled (c4e8a1f7d2b6); adding columns does not change it.

Revision ID: d7a2c5e9b14f
Revises: c4e8a1f7d2b6
Create Date: 2026-11-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd7a2c5e9b14f'
down_revision: Union[str, None] = 'c4e8a1f7d2b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('cut_history') as batch:
        batch.add_column(sa.Column('statement_minimum', sa.Numeric(14, 2), nullable=True))
        batch.add_column(sa.Column('statement_due_date', sa.Date(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('cut_history') as batch:
        batch.drop_column('statement_due_date')
        batch.drop_column('statement_minimum')
