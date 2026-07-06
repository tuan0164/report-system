"""field_options + drop projects

Revision ID: b1f2a3c4d5e6
Revises: 995da16ed39a
Create Date: 2026-07-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b1f2a3c4d5e6'
down_revision: Union[str, Sequence[str], None] = '995da16ed39a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Bảng lưu danh sách chọn cho trường kiểu array
    op.create_table(
        'field_options',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('column_name', sa.String(length=100), nullable=False),
        sa.Column('value', sa.String(length=255), nullable=False),
        sa.Column('field_order', sa.Integer(), server_default='0', nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_field_options_column_name', 'field_options', ['column_name'])

    # Xóa dữ liệu project cũ trong reports
    op.execute('UPDATE reports SET project = NULL')

    # Xóa bảng projects
    op.execute('DROP TABLE IF EXISTS projects')


def downgrade() -> None:
    op.drop_index('ix_field_options_column_name', table_name='field_options')
    op.drop_table('field_options')
    # Không khôi phục bảng projects / dữ liệu project cũ.
