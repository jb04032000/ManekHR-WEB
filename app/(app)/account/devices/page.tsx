'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Table, Button, message, Popconfirm, Tag, Space } from 'antd';
import { DeleteOutlined, LaptopOutlined, MobileOutlined, ReloadOutlined } from '@ant-design/icons';
import { getActiveSessions, deleteSession, invalidateAllOtherSessions } from '@/lib/actions';
import type { SessionInfo } from '@/lib/api/modules/sessions.api';
import { fmt } from '@/lib/utils';
import { useSubscriptionStore } from '@/lib/store';
import { SectionHeader } from '@/components/settings/SectionHeader';
import { SectionCard } from '@/components/settings/SectionCard';
import { UpgradePrompt } from '@/components/subscription/UpgradePrompt';

export default function DevicesPage() {
  const t = useTranslations('profile');
  const tDevices = useTranslations('profile.devices');
  const tCommon = useTranslations('common');
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgApi, ctx] = message.useMessage();
  const { entitlements } = useSubscriptionStore();
  const totalCap = entitlements?.maxSessionsTotal;
  const platformCap = entitlements?.maxSessionsPerPlatform;
  const hasTotalCap = typeof totalCap === 'number' && totalCap > 0;
  const hasPlatformCap = typeof platformCap === 'number' && platformCap > 0;
  const atTotalCap = hasTotalCap && sessions.length >= totalCap;

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await getActiveSessions();
      setSessions(data);
    } catch {
      msgApi.error(tDevices('loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await getActiveSessions();
        if (!cancelled) setSessions(data);
      } catch {
        if (!cancelled) msgApi.error(tDevices('loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      msgApi.success(tDevices('removeSuccess'));
      loadSessions();
    } catch {
      msgApi.error(tDevices('removeFailed'));
    }
  };

  const handleLogoutAll = async () => {
    try {
      const count = await invalidateAllOtherSessions();
      msgApi.success(tDevices('loggedOutCount', { count }));
      loadSessions();
    } catch {
      msgApi.error(tDevices('logoutAllFailed'));
    }
  };

  const getPlatformIcon = (platform: string) => {
    return platform === 'mobile' ? <MobileOutlined /> : <LaptopOutlined />;
  };

  const columns = [
    {
      title: tCommon('device'),
      dataIndex: 'deviceName',
      key: 'deviceName',
      render: (name: string, record: SessionInfo) => (
        <Space>
          {getPlatformIcon(record.platform)}
          <span>{name || tDevices('unknownDevice')}</span>
          <Tag color={record.platform === 'mobile' ? 'blue' : 'default'}>{record.platform}</Tag>
        </Space>
      ),
    },
    {
      title: tDevices('location'),
      dataIndex: 'location',
      key: 'location',
      render: (loc: string) => loc || tDevices('unknownLocation'),
    },
    {
      title: tDevices('ipAddress'),
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      render: (ip: string) => ip || '-',
    },
    {
      title: tCommon('lastActive'),
      dataIndex: 'lastActiveAt',
      key: 'lastActiveAt',
      render: (date: string) => fmt(date),
    },
    {
      title: <span className="sr-only">{tDevices('actionsHidden')}</span>,
      key: 'actions',
      width: 80,
      render: (_: unknown, record: SessionInfo) => (
        <Popconfirm
          title={tDevices('removeConfirm')}
          onConfirm={() => handleDelete(record.id)}
          okText={tCommon('yes')}
          cancelText={tCommon('no')}
        >
          <Button type="text" danger icon={<DeleteOutlined />} aria-label={tCommon('remove')} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      {ctx}
      <SectionHeader title={t('section.devices.title')} description={t('section.devices.desc')} />

      <SectionCard
        title={tDevices('sectionTitle')}
        trailing={
          <Popconfirm
            title={tDevices('logoutAllConfirm')}
            onConfirm={handleLogoutAll}
            okText={tCommon('yes')}
            cancelText={tCommon('no')}
          >
            <Button icon={<ReloadOutlined />}>{t('logoutOtherDevices')}</Button>
          </Popconfirm>
        }
      >
        <Table
          dataSource={sessions}
          columns={columns}
          loading={loading}
          rowKey="id"
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: tDevices('noSessions'),
          }}
        />
        <div className="mt-4 flex flex-col gap-1 text-sm text-muted">
          <span>
            {tDevices('activeDeviceCount', { count: sessions.length })}
            {hasTotalCap && (
              <>
                {' '}
                <span className="text-xs">
                  ·{' '}
                  {tDevices('ofTotalAllowed', {
                    count: sessions.length,
                    total: totalCap as number,
                  })}
                </span>
              </>
            )}
          </span>
          {hasPlatformCap && (
            <span className="text-xs">
              {tDevices('perPlatformLimit', { limit: platformCap as number })}
            </span>
          )}
        </div>
      </SectionCard>

      {atTotalCap && (
        <div className="mt-6">
          <UpgradePrompt module="sessions" />
        </div>
      )}
    </>
  );
}
