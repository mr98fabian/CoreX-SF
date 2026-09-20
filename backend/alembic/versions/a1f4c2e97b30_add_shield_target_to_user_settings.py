"""add shield_target to user_settings

Moves the Peace Shield target off the `users` table (which has no Supabase
`user_id` column, forcing a `select(User).first()` that leaked one user's
target to every other user) onto `user_settings`, which is already scoped
per user_id.

Revision ID: a1f4c2e97b30
Revises: bd322c6ada8b
Create Date: 2026-07-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1f4c2e97b30'
down_revision: Union[str, None] = 'bd322c6ada8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'user_settings',
        sa.Column(
            'shield_target',
            sa.Numeric(precision=14, scale=2),
            nullable=False,
            server_default='1000.00',
        ),
    )


def downgrade() -> None:
    op.drop_column('user_settings', 'shield_target')
