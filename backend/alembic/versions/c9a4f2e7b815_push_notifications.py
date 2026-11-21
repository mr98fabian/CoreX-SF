"""Push notifications: push_devices (FCM tokens), push_log (dedup + 1-a-day cap) and
user_settings.push_enabled (on by default).

Both new tables get RLS on Postgres (deny by default, no policies: the backend connects as
postgres). Both carry user_id, so deleting an account (routers/account.py) wipes them too.

Revision ID: c9a4f2e7b815
Revises: b7d2e9f4c3a1
Create Date: 2026-11-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'c9a4f2e7b815'
down_revision: Union[str, None] = 'b7d2e9f4c3a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = sa.String(36).with_variant(postgresql.UUID(as_uuid=False), "postgresql")
NEW_TABLES = ("push_devices", "push_log")


def upgrade() -> None:
    with op.batch_alter_table('user_settings') as batch:
        batch.add_column(sa.Column('push_enabled', sa.Boolean(), nullable=False, server_default=sa.true()))

    op.create_table(
        'push_devices',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('fcm_token', sa.String(length=512), nullable=False),
        sa.Column('platform', sa.String(length=16), nullable=False),
        sa.Column('timezone', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(), nullable=False),
        sa.Column('dead_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_push_devices_user_id', 'push_devices', ['user_id'])
    op.create_index('ix_push_devices_fcm_token', 'push_devices', ['fcm_token'], unique=True)

    op.create_table(
        'push_log',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('kind', sa.String(length=16), nullable=False),
        sa.Column('dedup_key', sa.String(length=64), nullable=False),
        sa.Column('local_date', sa.Date(), nullable=False),
        sa.Column('sent_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('user_id', 'kind', 'dedup_key', name='uq_push_log_user_kind_key'),
    )
    op.create_index('ix_push_log_user_id', 'push_log', ['user_id'])

    if op.get_bind().dialect.name == "postgresql":
        for table in NEW_TABLES:
            op.execute(f'ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    op.drop_table('push_log')
    op.drop_table('push_devices')
    with op.batch_alter_table('user_settings') as batch:
        batch.drop_column('push_enabled')
