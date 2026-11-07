"""webauthn_credentials + webauthn_challenges (local fingerprint lock)

Revision ID: b4d1e8f2c637
Revises: a7e5c3d9b218
Create Date: 2026-11-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'b4d1e8f2c637'
down_revision: Union[str, None] = 'a7e5c3d9b218'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = sa.String(36).with_variant(postgresql.UUID(as_uuid=False), "postgresql")


def upgrade() -> None:
    op.create_table(
        'webauthn_credentials',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('credential_id', sa.String(length=512), nullable=False),
        sa.Column('public_key', sa.Text(), nullable=False),
        sa.Column('sign_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_webauthn_credentials_user_id', 'webauthn_credentials', ['user_id'])
    op.create_index('ix_webauthn_credentials_credential_id', 'webauthn_credentials', ['credential_id'], unique=True)
    op.create_table(
        'webauthn_challenges',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('purpose', sa.String(length=10), nullable=False),
        sa.Column('challenge', sa.String(length=128), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_webauthn_challenges_user_id', 'webauthn_challenges', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_webauthn_challenges_user_id', 'webauthn_challenges')
    op.drop_table('webauthn_challenges')
    op.drop_index('ix_webauthn_credentials_credential_id', 'webauthn_credentials')
    op.drop_index('ix_webauthn_credentials_user_id', 'webauthn_credentials')
    op.drop_table('webauthn_credentials')
