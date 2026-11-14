"""subscriptions: store_source + gp_purchase_token (Google Play Billing)

store_source says which store charges the row (lemon | google_play | apple); every
existing row is Lemon, hence the server default. gp_purchase_token is the Play purchase
token verified server-side (routers/google_play.py); unique so one token never grants
two accounts. subscriptions already has RLS enabled (c4e8a1f7d2b6); adding columns
does not change it.

Revision ID: a3f6c8e2d1b9
Revises: e5b9d3f1a7c2
Create Date: 2026-11-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a3f6c8e2d1b9'
down_revision: Union[str, None] = 'e5b9d3f1a7c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('subscriptions') as batch:
        batch.add_column(sa.Column('store_source', sa.String(), nullable=False, server_default='lemon'))
        batch.add_column(sa.Column('gp_purchase_token', sa.String(), nullable=True))
        batch.create_index('ix_subscriptions_gp_purchase_token', ['gp_purchase_token'], unique=True)


def downgrade() -> None:
    with op.batch_alter_table('subscriptions') as batch:
        batch.drop_index('ix_subscriptions_gp_purchase_token')
        batch.drop_column('gp_purchase_token')
        batch.drop_column('store_source')
