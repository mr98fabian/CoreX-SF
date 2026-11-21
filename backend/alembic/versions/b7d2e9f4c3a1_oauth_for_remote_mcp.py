"""OAuth 2.1 for the remote MCP: api_tokens.expires_at + source, oauth_clients,
oauth_codes (consent handle + authorization code), oauth_refresh_tokens.

api_tokens.expires_at is NULL for every existing row: tokens created by hand keep never
expiring. source defaults to 'manual'. Every new table gets RLS on Postgres (deny by
default, no policies: the backend connects as postgres); the default-privilege revoke
of e5b9d3f1a7c2 already keeps anon/authenticated out of tables created afterwards.

Revision ID: b7d2e9f4c3a1
Revises: a3f6c8e2d1b9
Create Date: 2026-11-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'b7d2e9f4c3a1'
down_revision: Union[str, None] = 'a3f6c8e2d1b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = sa.String(36).with_variant(postgresql.UUID(as_uuid=False), "postgresql")
NEW_TABLES = ("oauth_clients", "oauth_codes", "oauth_refresh_tokens")


def upgrade() -> None:
    with op.batch_alter_table('api_tokens') as batch:
        batch.add_column(sa.Column('expires_at', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('source', sa.String(), nullable=False, server_default='manual'))

    op.create_table(
        'oauth_clients',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('client_id', sa.String(length=64), nullable=False),
        sa.Column('client_name', sa.String(length=60), nullable=False),
        sa.Column('client_metadata', sa.JSON(), nullable=False),
        sa.Column('secret_hash', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_oauth_clients_client_id', 'oauth_clients', ['client_id'], unique=True)

    op.create_table(
        'oauth_codes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('kind', sa.String(length=10), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('client_id', sa.String(length=64), nullable=False),
        sa.Column('user_id', UUID, nullable=True),
        sa.Column('redirect_uri', sa.String(), nullable=False),
        sa.Column('code_challenge', sa.String(length=128), nullable=False),
        sa.Column('scopes', sa.JSON(), nullable=False),
        sa.Column('state', sa.String(), nullable=True),
        sa.Column('resource', sa.String(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_oauth_codes_token_hash', 'oauth_codes', ['token_hash'], unique=True)
    op.create_index('ix_oauth_codes_client_id', 'oauth_codes', ['client_id'])
    op.create_index('ix_oauth_codes_user_id', 'oauth_codes', ['user_id'])

    op.create_table(
        'oauth_refresh_tokens',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('client_id', sa.String(length=64), nullable=False),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('api_token_id', sa.Integer(), nullable=False),
        sa.Column('family_id', sa.String(length=64), nullable=False),
        sa.Column('scopes', sa.JSON(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('replaced_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_oauth_refresh_tokens_token_hash', 'oauth_refresh_tokens', ['token_hash'], unique=True)
    op.create_index('ix_oauth_refresh_tokens_client_id', 'oauth_refresh_tokens', ['client_id'])
    op.create_index('ix_oauth_refresh_tokens_user_id', 'oauth_refresh_tokens', ['user_id'])
    op.create_index('ix_oauth_refresh_tokens_api_token_id', 'oauth_refresh_tokens', ['api_token_id'])
    op.create_index('ix_oauth_refresh_tokens_family_id', 'oauth_refresh_tokens', ['family_id'])

    if op.get_bind().dialect.name == "postgresql":
        for table in NEW_TABLES:
            op.execute(f'ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    op.drop_table('oauth_refresh_tokens')
    op.drop_table('oauth_codes')
    op.drop_table('oauth_clients')
    with op.batch_alter_table('api_tokens') as batch:
        batch.drop_column('source')
        batch.drop_column('expires_at')
