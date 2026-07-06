"""init

Revision ID: e212b86270ab
Revises: 
Create Date: 2026-07-03 10:26:18.341229

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'e212b86270ab'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        'ALTER TABLE reports ALTER COLUMN extra_fields TYPE JSONB '
        'USING extra_fields::jsonb'
    )


def downgrade() -> None:
    op.execute(
        'ALTER TABLE reports ALTER COLUMN extra_fields TYPE TEXT '
        'USING extra_fields::text'
    )
