'use client';
import { Button, Popconfirm, Space, Tooltip } from 'antd';
import { DeleteOutlined, TagsOutlined, ClearOutlined } from '@ant-design/icons';

type Props = {
  selectedCount: number;
  onClear: () => void;
  onBulkDelete: () => void;
  onBulkEditMetadata: () => void;
  loading?: boolean;
};

export function BulkActionsBar({
  selectedCount,
  onClear,
  onBulkDelete,
  onBulkEditMetadata,
  loading,
}: Props) {
  if (selectedCount === 0) return null;
  return (
    <div
      className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border bg-surface px-4 py-2 shadow-md"
      style={{
        borderColor: 'var(--cr-border-subtle, rgba(0,0,0,0.08))',
        boxShadow: '0 8px 24px -8px rgba(46,45,42,0.18)',
      }}
      role="toolbar"
      aria-label="Bulk translation actions"
    >
      <p className="m-0 text-[13px] font-semibold tabular-nums">{selectedCount} selected</p>
      <Space size={8} className="ml-auto">
        <Tooltip title="Edit metadata (description / screen / feature / tags)">
          <Button
            size="small"
            icon={<TagsOutlined />}
            onClick={onBulkEditMetadata}
            disabled={loading}
          >
            Edit metadata
          </Button>
        </Tooltip>
        <Popconfirm
          title="Delete selected translations?"
          description="This action removes the selected rows. Cannot be undone."
          okText="Delete"
          okButtonProps={{ danger: true, loading }}
          onConfirm={onBulkDelete}
        >
          <Button size="small" danger icon={<DeleteOutlined />} disabled={loading}>
            Delete
          </Button>
        </Popconfirm>
        <Button
          type="text"
          size="small"
          icon={<ClearOutlined />}
          onClick={onClear}
          disabled={loading}
        >
          Clear
        </Button>
      </Space>
    </div>
  );
}
