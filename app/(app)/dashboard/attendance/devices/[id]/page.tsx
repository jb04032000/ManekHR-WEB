'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  App,
  Button,
  Space,
  Tag,
  Tooltip,
  Skeleton,
  Typography,
  Breadcrumb,
  Card,
  Descriptions,
  Table,
} from 'antd';
import { ArrowLeftOutlined, ReloadOutlined, WifiOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { DsPageHeader } from '@/components/ui';
import { attendanceDevicesApi } from '@/lib/api/modules/attendance-devices.api';
import { attendanceApi } from '@/lib/api/modules/attendance.api';
import type {
  AttendanceDevice,
  AttendanceDeviceStatus,
  AttendanceEvent,
  AttendancePunchType,
  AttendanceVerifyMethod,
} from '@/types';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// Vendor brand names - proper nouns, not localized.
const VENDOR_LABELS: Record<string, string> = {
  zkteco: 'ZKTeco',
  essl: 'eSSL',
  realtime: 'Realtime',
  biomax: 'Biomax',
  unknown: 'Unknown',
};

// ── Punch type color mapping ──────────────────────────────────────────────────

const PUNCH_TYPE_COLOR: Record<AttendancePunchType, string> = {
  CHECK_IN: 'green',
  CHECK_OUT: 'blue',
  BREAK_OUT: 'orange',
  BREAK_IN: 'cyan',
  OT_IN: 'purple',
  OT_OUT: 'geekblue',
  STATUS_SET: 'default',
};

// ── Page component ────────────────────────────────────────────────────────────

export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('attendance.deviceDetail');
  const { currentWorkspaceId } = useWorkspaceStore();
  const { message: msgApi } = App.useApp();

  const STATUS_CONFIG: Record<AttendanceDeviceStatus, { color: string; label: string }> = {
    pending_approval: { color: 'orange', label: t('status.pendingApproval') },
    active: { color: 'green', label: t('status.active') },
    paused: { color: 'gold', label: t('status.paused') },
    revoked: { color: 'red', label: t('status.revoked') },
  };

  const renderVerifyMethod = (method: AttendanceVerifyMethod | null) => {
    if (!method) return <Text type="secondary">–</Text>;
    const labelMap: Partial<Record<AttendanceVerifyMethod, string>> = {
      fp: t('verify.fp'),
      face: t('verify.face'),
      card: t('verify.card'),
      palm: t('verify.palm'),
      password: t('verify.password'),
      manual: t('verify.manual'),
      auto: t('verify.auto'),
    };
    return <Tag>{labelMap[method] ?? method}</Tag>;
  };

  const id = params?.id as string | undefined;

  const [device, setDevice] = useState<AttendanceDevice | null>(null);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Use a ref so the polling closure always reads the latest device serial.
  // Sync inside an effect (mutating ref.current during render is flagged by
  // react-hooks/refs as accessing a ref during render).
  const deviceRef = useRef<AttendanceDevice | null>(null);
  useEffect(() => {
    deviceRef.current = device;
  }, [device]);

  // ── Load device info ───────────────────────────────────────────────────────

  const loadDevice = useCallback(async () => {
    if (!currentWorkspaceId || !id) {
      setDeviceLoading(false);
      return;
    }
    try {
      const d = await attendanceDevicesApi.getDevice(currentWorkspaceId, id);
      setDevice(d);
    } catch {
      msgApi.error(t('failedLoad'));
    } finally {
      setDeviceLoading(false);
    }
  }, [currentWorkspaceId, id, msgApi]);

  // Inline-async-IIFE mirrors loadDevice for the initial load + dep-change
  // reload; loadDevice stays as a useCallback for explicit handler refresh
  // (post-approve / pause / etc.). Cancel flag prevents stale setState on
  // unmount or workspace switch.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!currentWorkspaceId || !id) {
        if (!cancelled) setDeviceLoading(false);
        return;
      }
      try {
        const d = await attendanceDevicesApi.getDevice(currentWorkspaceId, id);
        if (!cancelled) setDevice(d);
      } catch {
        if (!cancelled) msgApi.error('Failed to load device');
      } finally {
        if (!cancelled) setDeviceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId, id, msgApi]);

  // ── Fetch events ──────────────────────────────────────────────────────────

  const fetchEvents = useCallback(async () => {
    const serial = deviceRef.current?.serial;
    if (!currentWorkspaceId || !serial) return;
    setEventsLoading(true);
    try {
      const result = await attendanceApi.listEvents(currentWorkspaceId, {
        deviceSerial: serial,
        limit: 100,
      });
      setEvents(result.items);
    } catch {
      // silently fail on background refresh
    } finally {
      setEventsLoading(false);
    }
  }, [currentWorkspaceId]);

  // Trigger event fetch once device serial is known, then poll every 10s
  useEffect(() => {
    if (!device?.serial) return;

    fetchEvents(); // initial fetch

    const intervalId = setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        fetchEvents();
      }
    }, 10_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchEvents(); // fetch immediately when tab becomes visible again
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device?.serial]);

  // ── Status actions ────────────────────────────────────────────────────────

  async function handleApprove() {
    if (!currentWorkspaceId || !id) return;
    setActionLoading(true);
    try {
      await attendanceDevicesApi.approveDevice(currentWorkspaceId, id);
      msgApi.success(t('toast.approved'));
      await loadDevice();
    } catch {
      msgApi.error(t('toast.failApprove'));
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePause() {
    if (!currentWorkspaceId || !id) return;
    setActionLoading(true);
    try {
      await attendanceDevicesApi.pauseDevice(currentWorkspaceId, id);
      msgApi.success(t('toast.paused'));
      await loadDevice();
    } catch {
      msgApi.error(t('toast.failPause'));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnpause() {
    if (!currentWorkspaceId || !id) return;
    setActionLoading(true);
    try {
      await attendanceDevicesApi.unpauseDevice(currentWorkspaceId, id);
      msgApi.success(t('toast.unpaused'));
      await loadDevice();
    } catch {
      msgApi.error(t('toast.failUnpause'));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRevoke() {
    if (!currentWorkspaceId || !id) return;
    setActionLoading(true);
    try {
      await attendanceDevicesApi.revokeDevice(currentWorkspaceId, id);
      msgApi.success(t('toast.revoked'));
      await loadDevice();
    } catch {
      msgApi.error(t('toast.failRevoke'));
    } finally {
      setActionLoading(false);
    }
  }

  // ── Event table columns ───────────────────────────────────────────────────

  const eventColumns: ColumnsType<AttendanceEvent> = [
    {
      title: t('events.col.timestamp'),
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (v: string) => dayjs(v).format('DD MMM YYYY, HH:mm:ss'),
      width: 200,
    },
    {
      title: t('events.col.deviceUserId'),
      dataIndex: 'deviceUserId',
      key: 'deviceUserId',
      render: (v: string | null) =>
        v ? <Text style={{ fontFamily: 'monospace' }}>{v}</Text> : <Text type="secondary">–</Text>,
      width: 140,
    },
    {
      title: t('events.col.member'),
      dataIndex: 'teamMemberId',
      key: 'teamMemberId',
      render: (v: AttendanceEvent['teamMemberId']) => {
        if (v && typeof v === 'object' && 'name' in v) {
          return <Text>{v.name}</Text>;
        }
        if (v && typeof v === 'string') {
          // populated as plain ObjectId string - treat as known but name not returned
          return <Text type="secondary">{v}</Text>;
        }
        return (
          <Link href="/dashboard/attendance/unassigned" style={{ color: 'var(--cr-danger-500)' }}>
            {t('events.unassigned')}
          </Link>
        );
      },
    },
    {
      title: t('events.col.punchType'),
      dataIndex: 'punchType',
      key: 'punchType',
      render: (v: AttendancePunchType) => <Tag color={PUNCH_TYPE_COLOR[v] ?? 'default'}>{v}</Tag>,
      width: 130,
    },
    {
      title: t('events.col.verifyMethod'),
      dataIndex: 'verifyMethod',
      key: 'verifyMethod',
      render: (v: AttendanceVerifyMethod | null) => renderVerifyMethod(v),
      width: 130,
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  if (deviceLoading) {
    return (
      <div style={{ padding: '24px 0' }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (!device) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0' }}>
        <Text type="secondary">{t('notFound')}</Text>
        <br />
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/dashboard/attendance/devices')}
        >
          {t('backToDevices')}
        </Button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[device.status] ?? { color: 'default', label: device.status };

  return (
    <>
      {/* Breadcrumb */}
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: <Link href="/dashboard/attendance">{t('breadcrumb.attendance')}</Link> },
          { title: <Link href="/dashboard/attendance/devices">{t('breadcrumb.devices')}</Link> },
          { title: device.serial },
        ]}
      />

      <DsPageHeader
        title={device.alias ?? device.serial}
        icon={<WifiOutlined />}
        right={
          <Space wrap>
            <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
            <Tag>{VENDOR_LABELS[device.vendor] ?? device.vendor}</Tag>
            {device.status === 'pending_approval' && (
              <Button type="primary" loading={actionLoading} onClick={handleApprove}>
                {t('action.approve')}
              </Button>
            )}
            {device.status === 'active' && (
              <>
                <Button loading={actionLoading} onClick={handlePause}>
                  {t('action.pause')}
                </Button>
                <Button danger loading={actionLoading} onClick={handleRevoke}>
                  {t('action.revoke')}
                </Button>
              </>
            )}
            {device.status === 'paused' && (
              <>
                <Button loading={actionLoading} onClick={handleUnpause}>
                  {t('action.unpause')}
                </Button>
                <Button danger loading={actionLoading} onClick={handleRevoke}>
                  {t('action.revoke')}
                </Button>
              </>
            )}
            {device.status === 'revoked' && (
              <Text type="secondary" style={{ fontSize: 13 }}>
                {t('action.revokedHint')}
              </Text>
            )}
          </Space>
        }
      />

      {/* Device info card */}
      <Card style={{ marginBottom: 24 }}>
        <Descriptions
          column={{ xs: 1, sm: 2, md: 3 }}
          size="small"
          labelStyle={{ color: 'var(--cr-text-4)', fontWeight: 500 }}
        >
          <Descriptions.Item label={t('field.serial')}>
            <Text style={{ fontFamily: 'monospace' }}>{device.serial}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('field.vendor')}>
            {VENDOR_LABELS[device.vendor] ?? device.vendor}
          </Descriptions.Item>
          <Descriptions.Item label={t('field.firmware')}>
            {device.firmwareVersion ?? <Text type="secondary">{t('field.unknown')}</Text>}
          </Descriptions.Item>
          <Descriptions.Item label={t('field.firstSeen')}>
            {device.firstSeenAt ? (
              <Tooltip title={dayjs(device.firstSeenAt).format('YYYY-MM-DD HH:mm:ss')}>
                {dayjs(device.firstSeenAt).fromNow()}
              </Tooltip>
            ) : (
              <Text type="secondary">{t('field.never')}</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t('field.lastSeen')}>
            {device.lastSeenAt ? (
              <Tooltip title={dayjs(device.lastSeenAt).format('YYYY-MM-DD HH:mm:ss')}>
                {dayjs(device.lastSeenAt).fromNow()}
              </Tooltip>
            ) : (
              <Text type="secondary">{t('field.never')}</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label={t('field.totalEvents')}>
            {device.stats?.totalEvents?.toLocaleString() ?? '0'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Recent events section */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <Title level={2} style={{ margin: 0, fontSize: 16 }}>
            {t('events.title')}
          </Title>
          <Button icon={<ReloadOutlined />} onClick={fetchEvents} loading={eventsLoading}>
            {t('events.refresh')}
          </Button>
        </div>

        <Table<AttendanceEvent>
          rowKey="_id"
          dataSource={events}
          columns={eventColumns}
          loading={eventsLoading}
          size="small"
          pagination={false}
          scroll={{ x: 750 }}
          locale={{
            emptyText:
              device.status === 'pending_approval' ? t('events.emptyPending') : t('events.empty'),
          }}
        />
      </div>
    </>
  );
}
