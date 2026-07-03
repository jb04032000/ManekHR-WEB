'use client';
import { useEffect, useState, useCallback, startTransition } from 'react';
import { Card, Table, Input, Tag, Avatar, Button } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import { getAdminWorkspaces } from '@/lib/actions';
import { getInitials, avatarColor, fmt } from '@/lib/utils';
import { DsCardTitle } from '@/components/ui';

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const res = await getAdminWorkspaces({ page, limit: 20, search: search || undefined });
      setWorkspaces(res.data ?? []);
      setTotal(res.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ColumnsType<any> = [
    {
      title: 'Workspace',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (name) => (
        <div className="flex items-center gap-2.5">
          <Avatar size={34} className="text-xs font-bold" style={{ background: avatarColor(name) }}>
            {getInitials(name)}
          </Avatar>
          <span className="text-[13px] font-semibold">{name}</span>
        </div>
      ),
    },
    {
      title: 'Business Type',
      dataIndex: 'businessType',
      key: 'type',
      width: 140,
      render: (v) => v ?? '-',
    },
    { title: 'Location', dataIndex: 'location', key: 'loc', width: 150, render: (v) => v ?? '-' },
    {
      title: 'Timezone',
      dataIndex: 'timezone',
      key: 'tz',
      width: 140,
      render: (v) => <span className="text-xs">{v}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'active',
      width: 90,
      align: 'center',
      render: (v) => <Tag color={v ? 'success' : 'error'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    { title: 'Created', dataIndex: 'createdAt', key: 'created', width: 110, render: (v) => fmt(v) },
    {
      title: <span className="sr-only">Actions</span>,
      key: 'actions',
      width: 110,
      align: 'center',
      render: (_: unknown, record: any) => (
        <Link href={`/admin/workspaces/${record._id}`}>
          <Button size="small" icon={<SettingOutlined />}>
            Configure
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <Card
      title={<DsCardTitle>All Workspaces</DsCardTitle>}
      extra={
        <Input.Search
          aria-label="Search workspaces"
          placeholder="Search…"
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={() => {
            setPage(1);
            load();
          }}
          className="w-[220px]"
        />
      }
    >
      <Table
        columns={columns}
        dataSource={workspaces}
        rowKey="_id"
        loading={loading}
        scroll={{ x: 800 }}
        size="middle"
        pagination={{
          current: page,
          total,
          pageSize: 20,
          onChange: setPage,
          showTotal: (t) => `${t} workspaces`,
          showSizeChanger: false,
        }}
      />
    </Card>
  );
}
