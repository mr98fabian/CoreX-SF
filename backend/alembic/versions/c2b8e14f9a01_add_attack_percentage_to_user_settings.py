"""add attack_percentage to user_settings

Exposes the previously hardcoded 20% "attack" assumption (extra_monthly =
liquid_cash * 0.20 in velocity_engine.get_projections) as a per-user,
user-editable setting instead of a silent constant baked into every
projection. See PUT /api/user/me/attack-percentage.

Revision ID: c2b8e14f9a01
Revises: a1f4c2e97b30
Create Date: 2026-09-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2b8e14f9a01'
down_revision: Union[str, None] = 'a1f4c2e97b30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'user_settings',
        sa.Column(
            'attack_percentage',
            sa.Numeric(precision=5, scale=2),
            nullable=False,
            server_default='20',
        ),
    )


def downgrade() -> None:
    op.drop_column('user_settings', 'attack_percentage')
