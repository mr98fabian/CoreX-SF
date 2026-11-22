"""subscriptions.store_source: the web store is Stripe (Managed Payments)

The web provider changed (misión 2026-11-22-integracion-stripe): every row the web store
charged is relabelled "stripe" and the server default follows. google_play rows are left
alone. Data-only + default; RLS on subscriptions (c4e8a1f7d2b6) is unchanged.

Revision ID: d2f7b3c9e4a6
Revises: c9a4f2e7b815
Create Date: 2026-11-22

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd2f7b3c9e4a6'
down_revision: Union[str, None] = 'c9a4f2e7b815'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# The previous web provider's label, kept only so downgrade can restore it
PREVIOUS_WEB_STORE = 'lemon'


def upgrade() -> None:
    op.execute(sa.text("UPDATE subscriptions SET store_source = 'stripe' WHERE store_source = :old")
               .bindparams(old=PREVIOUS_WEB_STORE))
    with op.batch_alter_table('subscriptions') as batch:
        batch.alter_column('store_source', existing_type=sa.String(), existing_nullable=False,
                           server_default='stripe')


def downgrade() -> None:
    with op.batch_alter_table('subscriptions') as batch:
        batch.alter_column('store_source', existing_type=sa.String(), existing_nullable=False,
                           server_default=PREVIOUS_WEB_STORE)
    op.execute(sa.text("UPDATE subscriptions SET store_source = :old WHERE store_source = 'stripe'")
               .bindparams(old=PREVIOUS_WEB_STORE))
