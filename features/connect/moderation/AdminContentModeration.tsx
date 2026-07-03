'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  App as AntApp,
  Button,
  Card,
  Empty,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, EyeOutlined, StopOutlined, UserOutlined } from '@ant-design/icons';
import {
  actionContentReport,
  dismissContentReport,
  type ContentReport,
} from '@/lib/actions/content-reports.actions';
import { DsCardTitle } from '@/components/ui';

/**
 * Admin content-moderation queue (Connect). Lists OPEN abuse reports against
 * public UGC (post / comment / profile / listing) and lets a moderator:
 *   - View the live content (deep link captured at report time),
 *   - Remove it ("Action" -> emits the takedown event; post + listing are
 *     cascade-removed by their owning module),
 *   - Dismiss the report (no action),
 *   - Suspend the offending user (jumps to the Users admin).
 * English-only, matching the other admin consoles (Pending Deletions precedent).
 * Links: content-reports.actions -> /admin/connect/content-reports/*.
 */

const REASON_LABEL: Record<string, string> = {
  spam: 'Spam / misleading',
  harassment: 'Harassment',
  hate: 'Hate speech',
  adult: 'Adult / explicit',
  scam: 'Scam / fraud',
  misinformation: 'False info',
  other: 'Other',
};

const TYPE_COLOR: Record<string, string> = {
  post: 'geekblue',
  comment: 'blue',
  profile: 'purple',
  listing: 'gold',
};

export default function AdminContentModeration({ reports }: { reports: ContentReport[] }) {
  const { message } = AntApp.useApp();
  const [rows, setRows] = useState<ContentReport[]>(reports);
  const [busyId, setBusyId] = useState<string | null>(null);

  const remove = async (id: string) => {
    setBusyId(id);
    const res = await actionContentReport(id);
    setBusyId(null);
    if (res.ok) {
      message.success('Content removed and report closed');
      setRows((r) => r.filter((x) => x._id !== id));
    } else {
      message.error(res.error || 'Could not action the report');
    }
  };

  const dismiss = async (id: string) => {
    setBusyId(id);
    const res = await dismissContentReport(id);
    setBusyId(null);
    if (res.ok) {
      message.success('Report dismissed');
      setRows((r) => r.filter((x) => x._id !== id));
    } else {
      message.error(res.error || 'Could not dismiss the report');
    }
  };

  const columns: ColumnsType<ContentReport> = [
    {
      title: 'Type',
      dataIndex: 'targetType',
      width: 110,
      render: (v: string) => <Tag color={TYPE_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      width: 140,
      render: (v: string) => REASON_LABEL[v] ?? v,
    },
    {
      title: 'Reported content',
      dataIndex: 'snapshot',
      render: (snapshot: string, row) => (
        <div>
          <Typography.Paragraph
            ellipsis={{ rows: 2 }}
            className="!mb-1 text-sm"
            style={{ maxWidth: 420 }}
          >
            {snapshot || <span className="text-subtle">(no snapshot)</span>}
          </Typography.Paragraph>
          {row.detail && <div className="text-xs text-secondary">Note: {row.detail}</div>}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 320,
      render: (_: unknown, row) => (
        <Space wrap>
          {row.targetUrl && (
            <Link href={row.targetUrl} target="_blank" rel="noopener noreferrer">
              <Button size="small" icon={<EyeOutlined />}>
                View
              </Button>
            </Link>
          )}
          <Popconfirm
            title="Remove this content?"
            description="The post/listing is taken down. This cannot be undone."
            okButtonProps={{ danger: true }}
            onConfirm={() => remove(row._id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} loading={busyId === row._id}>
              Remove
            </Button>
          </Popconfirm>
          <Button size="small" icon={<StopOutlined />} onClick={() => dismiss(row._id)}>
            Dismiss
          </Button>
          {row.targetOwnerUserId && (
            <Link href={`/admin/users?focus=${row.targetOwnerUserId}`}>
              <Button size="small" icon={<UserOutlined />}>
                Suspend user
              </Button>
            </Link>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card title={<DsCardTitle>Content Moderation</DsCardTitle>}>
      <p className="mb-4 text-xs text-secondary">
        Open abuse reports on public Connect content. <strong>Remove</strong> takes the content down
        (posts and listings are removed automatically); <strong>Dismiss</strong> closes the report
        with no action; <strong>Suspend user</strong> opens the offending account in Users.
      </p>
      {rows.length === 0 ? (
        <Empty description="No open reports" />
      ) : (
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          size="middle"
        />
      )}
    </Card>
  );
}
