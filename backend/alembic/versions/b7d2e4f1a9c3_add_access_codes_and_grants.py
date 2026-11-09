"""access_codes, access_grants (codes stored as HMAC only)

Revision ID: b7d2e4f1a9c3
Revises: e8a4c2f6b913
Create Date: 2026-11-08

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'b7d2e4f1a9c3'
down_revision: Union[str, None] = 'e8a4c2f6b913'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = sa.String(36).with_variant(postgresql.UUID(as_uuid=False), "postgresql")


def upgrade() -> None:
    op.create_table(
        'access_codes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('code_hmac', sa.String(length=64), nullable=False, unique=True),
        sa.Column('prefix', sa.String(length=16), nullable=False),
        sa.Column('kind', sa.String(length=10), nullable=False),
        sa.Column('months', sa.Integer(), nullable=True),
        sa.Column('plan', sa.String(length=20), nullable=False),
        sa.Column('max_uses', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('uses_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', UUID, nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_table(
        'access_grants',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('plan', sa.String(length=20), nullable=False),
        sa.Column('starts_at', sa.DateTime(), nullable=False),
        sa.Column('ends_at', sa.DateTime(), nullable=True),
        sa.Column('code_id', sa.Integer(), sa.ForeignKey('access_codes.id'), nullable=False),
        sa.UniqueConstraint('code_id', 'user_id', name='uq_access_grant_code_user'),
    )
    op.create_index('ix_access_grants_user_id', 'access_grants', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_access_grants_user_id', table_name='access_grants')
    op.drop_table('access_grants')
    op.drop_table('access_codes')
