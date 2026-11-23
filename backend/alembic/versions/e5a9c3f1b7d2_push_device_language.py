"""push_devices.language: the app's language (es | en), so each push notice goes out in it

Misión 2026-11-22-push-plantillas-en. Existing phones get 'es' (the only copy they ever got)
and switch on their next app start, when the app re-registers its token. Column only: RLS on
push_devices (c9a4f2e7b815) is unchanged.

Revision ID: e5a9c3f1b7d2
Revises: d2f7b3c9e4a6
Create Date: 2026-11-22

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'e5a9c3f1b7d2'
down_revision: Union[str, None] = 'd2f7b3c9e4a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('push_devices') as batch:
        batch.add_column(sa.Column('language', sa.String(length=8), nullable=False, server_default='es'))


def downgrade() -> None:
    with op.batch_alter_table('push_devices') as batch:
        batch.drop_column('language')
