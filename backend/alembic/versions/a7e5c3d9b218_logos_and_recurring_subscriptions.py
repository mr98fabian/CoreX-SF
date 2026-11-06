"""accounts.logo_url + recurring_subscriptions

Revision ID: a7e5c3d9b218
Revises: f3b8d2a6c514
Create Date: 2026-11-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a7e5c3d9b218'
down_revision: Union[str, None] = 'f3b8d2a6c514'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = sa.String(36).with_variant(postgresql.UUID(as_uuid=False), "postgresql")


def upgrade() -> None:
    op.add_column('accounts', sa.Column('logo_url', sa.Text(), nullable=True))
    op.create_table(
        'recurring_subscriptions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('name', sa.String(length=80), nullable=False),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('frequency', sa.String(length=10), nullable=False),
        sa.Column('next_charge_date', sa.String(length=10), nullable=True),
        sa.Column('account_id', sa.Integer(), nullable=True),
        sa.Column('logo_url', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_recurring_subscriptions_user_id', 'recurring_subscriptions', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_recurring_subscriptions_user_id', table_name='recurring_subscriptions')
    op.drop_table('recurring_subscriptions')
    op.drop_column('accounts', 'logo_url')
