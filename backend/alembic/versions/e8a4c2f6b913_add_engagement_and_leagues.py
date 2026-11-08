"""engagement_points, league_weeks, coach_profiles.ranking_opt_in/alias

Revision ID: e8a4c2f6b913
Revises: d6f3b1a8e492
Create Date: 2026-11-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'e8a4c2f6b913'
down_revision: Union[str, None] = 'd6f3b1a8e492'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UUID = sa.String(36).with_variant(postgresql.UUID(as_uuid=False), "postgresql")


def upgrade() -> None:
    op.add_column('coach_profiles', sa.Column('ranking_opt_in', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('coach_profiles', sa.Column('ranking_alias', sa.String(length=40), nullable=True))
    op.create_table(
        'engagement_points',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('action', sa.String(length=10), nullable=False),
        sa.Column('points', sa.Integer(), nullable=False),
        sa.Column('ref', sa.String(length=40), nullable=False, server_default=''),
        sa.UniqueConstraint('user_id', 'date', 'action', 'ref', name='uq_engagement_points'),
    )
    op.create_index('ix_engagement_points_user_id', 'engagement_points', ['user_id'])
    op.create_table(
        'league_weeks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', UUID, nullable=False),
        sa.Column('week_start', sa.Date(), nullable=False),
        sa.Column('tier', sa.String(length=10), nullable=False, server_default='bronce'),
        sa.Column('cohort', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('points', sa.Integer(), nullable=False, server_default='0'),
        sa.UniqueConstraint('week_start', 'user_id', name='uq_league_weeks_user'),
    )
    op.create_index('ix_league_weeks_user_id', 'league_weeks', ['user_id'])
    op.create_index('ix_league_weeks_week_start', 'league_weeks', ['week_start'])


def downgrade() -> None:
    op.drop_index('ix_league_weeks_week_start', 'league_weeks')
    op.drop_index('ix_league_weeks_user_id', 'league_weeks')
    op.drop_table('league_weeks')
    op.drop_index('ix_engagement_points_user_id', 'engagement_points')
    op.drop_table('engagement_points')
    op.drop_column('coach_profiles', 'ranking_alias')
    op.drop_column('coach_profiles', 'ranking_opt_in')
