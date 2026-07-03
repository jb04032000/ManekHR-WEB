'use client';

import { useState, useEffect, startTransition } from 'react';
import { Table, Button, message, Popconfirm, Tag, Space, InputNumber, Card } from 'antd';
import { DeleteOutlined, LaptopOutlined, MobileOutlined } from '@ant-design/icons';
import { getUserSessions, adminTerminateUserSession, updateUserSessionLimit } from '@/lib/actions';
import { fmt } from '@/lib/utils';
import type { SessionInfo } from '@/lib/api/modules/sessions.api';

interface UserSessionsSectionProps {
  userId: string;
  currentLimitOverride?: number | null;
}

export function UserSessionsSection({ userId, currentLimitOverride }: UserSessionsSectionProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingLimit, setSavingLimit] = useState(false);
  const [limitOverride, setLimitOverride] = useState<number | null>(currentLimitOverride ?? null);
  const [msgApi, ctx] = message.useMessage();

  const loadSessions = async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const data = await getUserSessions(userId);
      startTransition(() => {
        setSessions(data);
      });
    } catch (e) {
      msgApi.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [userId]);

  useEffect(() => {
    startTransition(() => {
      setLimitOverride(currentLimitOverride ?? null);
    });
  }, [currentLimitOverride]);

  const handleTerminate = async (sessionId: string) => {
    try {
      await adminTerminateUserSession(userId, sessionId);
      msgApi.success('Session terminated');
      loadSessions();
    } catch (e) {
      msgApi.error('Failed to terminate session');
    }
  };

  const handleSaveLimit = async () => {
    setSavingLimit(true);
    try {
      await updateUserSessionLimit(userId, limitOverride);
      msgApi.success('Session limit updated');
    } catch (e) {
      msgApi.error('Failed to update session limit');
    } finally {
      setSavingLimit(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    return platform === 'mobile' ? <MobileOutlined /> : <LaptopOutlined />;
  };

  const columns = [
    {
      title: 'Device',
      dataIndex: 'deviceName',
      key: 'deviceName',
      render: (name: string, record: SessionInfo) => (
        <Space>
          {getPlatformIcon(record.platform)}
          <span>{name || 'Unknown Device'}</span>
          <Tag color={record.platform === 'mobile' ? 'blue' : 'default'}>{record.platform}</Tag>
        </Space>
      ),
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      render: (loc: string) => loc || 'Unknown',
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      render: (ip: string) => ip || '-',
    },
    {
      title: 'Last Active',
      dataIndex: 'lastActiveAt',
      key: 'lastActiveAt',
      render: (date: string) => fmt(date),
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: 'actions',
      width: 100,
      render: (_: any, record: SessionInfo) => (
        <Popconfirm
          title="Force terminate this session?"
          onConfirm={() => handleTerminate(record.id)}
          okText="Terminate"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small">
            Terminate
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      {ctx}
      <Card size="small" className="mb-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Session Limit Override:</span>
          <InputNumber
            min={1}
            max={20}
            value={limitOverride}
            onChange={(val) => setLimitOverride(val)}
            placeholder="Plan default"
            style={{ width: 120 }}
          />
          <Button
            size="small"
            onClick={() => setLimitOverride(null)}
            disabled={limitOverride === null}
          >
            Reset to Default
          </Button>
          <Button type="primary" size="small" loading={savingLimit} onClick={handleSaveLimit}>
            Save
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">
          Leave empty to use plan default. Set a specific number to override.
        </p>
      </Card>
      <Table
        dataSource={sessions}
        columns={columns}
        loading={loading}
        rowKey="id"
        pagination={false}
        size="small"
        locale={{
          emptyText: 'No active sessions',
        }}
      />
      <div className="mt-2 text-sm text-muted">
        {sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}
      </div>
    </>
  );
}
