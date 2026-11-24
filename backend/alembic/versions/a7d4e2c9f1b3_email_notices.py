"""Notice e-mails: user_settings.email_enabled / language / timezone and email_log

Misión 2026-11-23-correos-notificacion. email_enabled is on by default (as push_enabled);
language starts at 'es' and timezone empty until the app syncs them. email_log mirrors push_log
(cap + dedup) and, like every public table, gets RLS on with zero policies.

Revision ID: a7d4e2c9f1b3
Revises: e5a9c3f1b7d2
Create Date: 2026-11-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a7d4e2c9f1b3'
down_revision: Union[str, None] = 'e5a9c3f1b7d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = sa.String(36).with_variant(postgresql.UUID(as_uuid=False), "postgresql")


def upgrade() -> None:
    with op.batch_alter_table('user_settings') as batch:
        batch.add_column(sa.Column('email_enabled', sa.Boolean(), nullable=False, server_default=sa.true()))
        batch.add_column(sa.Column('language', sa.String(length=8), nullable=False, server_default='es'))
        batch.add_column(sa.Column('timezone', sa.String(length=64), nullable=True))

    op.create_table(
        'email_log',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('kind', sa.String(length=16), nullable=False),
        sa.Column('dedup_key', sa.String(length=64), nullable=False),
        sa.Column('language', sa.String(length=8), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False),
        sa.Column('detail', sa.String(length=200), nullable=True),
        sa.Column('local_date', sa.Date(), nullable=False),
        sa.Column('sent_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_email_log_user_id', 'email_log', ['user_id'])

    if op.get_bind().dialect.name == "postgresql":
        op.execute('ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    op.drop_table('email_log')
    with op.batch_alter_table('user_settings') as batch:
        batch.drop_column('timezone')
        batch.drop_column('language')
        batch.drop_column('email_enabled')
