"""add api_tokens and api_token_audit

Personal API tokens for AI agents (MCP). token_hash is the SHA-256 of the
token; the plain token is never stored.

Revision ID: d7a3b9c41e02
Revises: c2b8e14f9a01
Create Date: 2026-11-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd7a3b9c41e02'
down_revision: Union[str, None] = 'c2b8e14f9a01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = sa.String(36).with_variant(postgresql.UUID(as_uuid=False), "postgresql")


def upgrade() -> None:
    op.create_table(
        'api_tokens',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('token_hash', sa.String(64), nullable=False),
        sa.Column('scopes', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_api_tokens_user_id', 'api_tokens', ['user_id'])
    op.create_index('ix_api_tokens_token_hash', 'api_tokens', ['token_hash'], unique=True)

    op.create_table(
        'api_token_audit',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('token_id', sa.Integer(), nullable=False),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('detail', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_api_token_audit_token_id', 'api_token_audit', ['token_id'])
    op.create_index('ix_api_token_audit_user_id', 'api_token_audit', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_api_token_audit_user_id', table_name='api_token_audit')
    op.drop_index('ix_api_token_audit_token_id', table_name='api_token_audit')
    op.drop_table('api_token_audit')
    op.drop_index('ix_api_tokens_token_hash', table_name='api_tokens')
    op.drop_index('ix_api_tokens_user_id', table_name='api_tokens')
    op.drop_table('api_tokens')
