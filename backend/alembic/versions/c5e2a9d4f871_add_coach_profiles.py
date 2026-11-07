"""coach_profiles (tone, ai_name, payday_weekday for the user's AI coach)

Revision ID: c5e2a9d4f871
Revises: b4d1e8f2c637
Create Date: 2026-11-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'c5e2a9d4f871'
down_revision: Union[str, None] = 'b4d1e8f2c637'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = sa.String(36).with_variant(postgresql.UUID(as_uuid=False), "postgresql")


def upgrade() -> None:
    op.create_table(
        'coach_profiles',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('tone', sa.String(length=10), nullable=False, server_default='calido'),
        sa.Column('ai_name', sa.String(length=40), nullable=True),
        sa.Column('payday_weekday', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_coach_profiles_user_id', 'coach_profiles', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_coach_profiles_user_id', 'coach_profiles')
    op.drop_table('coach_profiles')
