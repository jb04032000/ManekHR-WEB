'use client';

import { useState, useEffect, useCallback } from 'react';
import { App, Button, Space, Tag, Tooltip, Skeleton, Typography } from 'antd';
import {
  PlusOutlined,
  WifiOutlined,
  InfoCircleOutlined,
  ScanOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
  SafetyOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { DsTable, DsModal } from '@/components/ui';
import { DeviceSetupGuide } from '@/components/dashboard/attendance/DeviceSetupGuide';
import { attendanceDevicesApi } from '@/lib/api/modules/attendance-devices.api';
import type { AttendanceDevice, AttendanceDeviceStatus } from '@/types';
import type { ColumnsType } from 'antd/es/table';

dayjs.extend(relativeTime);

const { Text } = Typography;

// Vendor brand names - proper nouns, not localized.
const VENDOR_LABELS: Record<string, string> = {
  zkteco: 'ZKTeco',
  essl: 'eSSL',
  realtime: 'Realtime',
  biomax: 'Biomax',
  unknown: 'Unknown',
};

export function DevicesPanel() {
  const t = useTranslations('attendance.devicesList');
  const tDetail = useTranslations('attendance.deviceDetail');
  const { currentWorkspaceId } = useWorkspaceStore();
  const { message: msgApi } = App.useApp();

  const STATUS_CONFIG: Record<AttendanceDeviceStatus, { color: string; label: string }> = {
    pending_approval: { color: 'orange', label: tDetail('status.pendingApproval') },
    active: { color: 'green', label: tDetail('status.active') },
    paused: { color: 'gold', label: tDetail('status.paused') },
    revoked: { color: 'red', label: tDetail('status.revoked') },
  };

  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // deviceId being acted on
  const [rotating, setRotating] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const [devList, tokenRes] = await Promise.all([
        attendanceDevicesApi.listDevices(currentWorkspaceId),
        attendanceDevicesApi.getIngestToken(currentWorkspaceId),
      ]);
      setDevices(devList);
      setToken(tokenRes.token);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('toast.failLoad');
      msgApi.error(msg);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, msgApi]);

  // Inline-async-IIFE mirrors fetchAll's body with a cancel flag, so
  // setLoading(true) lives inside the async closure (not synchronously in the
  // effect body). fetchAll stays as a useCallback for explicit handler
  // refreshes (post-approve / pause / unpause / revoke).
  useEffect(() => {
    if (!currentWorkspaceId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [devList, tokenRes] = await Promise.all([
          attendanceDevicesApi.listDevices(currentWorkspaceId),
          attendanceDevicesApi.getIngestToken(currentWorkspaceId),
        ]);
        if (cancelled) return;
        setDevices(devList);
        setToken(tokenRes.token);
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : t('toast.failLoad');
        msgApi.error(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId, msgApi]);

  // ── Status action handlers ─────────────────────────────────────────────────

  async function handleApprove(id: string) {
    if (!currentWorkspaceId) return;
    setActionLoading(id);
    try {
      await attendanceDevicesApi.approveDevice(currentWorkspaceId, id);
      msgApi.success(tDetail('toast.approved'));
      await fetchAll();
    } catch {
      msgApi.error(tDetail('toast.failApprove'));
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePause(id: string) {
    if (!currentWorkspaceId) return;
    setActionLoading(id);
    try {
      await attendanceDevicesApi.pauseDevice(currentWorkspaceId, id);
      msgApi.success(tDetail('toast.paused'));
      await fetchAll();
    } catch {
      msgApi.error(tDetail('toast.failPause'));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnpause(id: string) {
    if (!currentWorkspaceId) return;
    setActionLoading(id);
    try {
      await attendanceDevicesApi.unpauseDevice(currentWorkspaceId, id);
      msgApi.success(tDetail('toast.unpaused'));
      await fetchAll();
    } catch {
      msgApi.error(tDetail('toast.failUnpause'));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevoke(id: string) {
    if (!currentWorkspaceId) return;
    setActionLoading(id);
    try {
      await attendanceDevicesApi.revokeDevice(currentWorkspaceId, id);
      msgApi.success(tDetail('toast.revoked'));
      await fetchAll();
    } catch {
      msgApi.error(tDetail('toast.failRevoke'));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRotateToken() {
    if (!currentWorkspaceId) return;
    setRotating(true);
    try {
      const res = await attendanceDevicesApi.rotateIngestToken(currentWorkspaceId, {
        confirm: true,
      });
      setToken(res.token);
      msgApi.success(t('toast.tokenRotated'));
    } catch {
      msgApi.error(t('toast.failRotate'));
    } finally {
      setRotating(false);
    }
  }

  // ── Table columns ──────────────────────────────────────────────────────────

  const columns: ColumnsType<AttendanceDevice> = [
    {
      title: t('col.serial'),
      dataIndex: 'serial',
      key: 'serial',
      render: (serial: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontFamily: 'monospace', fontSize: 13 }}>
            {serial}
          </Text>
          {record.alias && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.alias}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: t('col.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: AttendanceDeviceStatus) => {
        const cfg = STATUS_CONFIG[status] ?? { color: 'default', label: status };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: t('col.vendor'),
      dataIndex: 'vendor',
      key: 'vendor',
      render: (vendor: string) => VENDOR_LABELS[vendor] ?? vendor,
    },
    {
      title: t('col.lastSeen'),
      dataIndex: 'lastSeenAt',
      key: 'lastSeenAt',
      render: (v: string | null) =>
        v ? (
          <Tooltip title={dayjs(v).format('YYYY-MM-DD HH:mm:ss')}>
            <span>{dayjs(v).fromNow()}</span>
          </Tooltip>
        ) : (
          <Text type="secondary">{tDetail('field.never')}</Text>
        ),
    },
    {
      title: t('col.totalEvents'),
      key: 'totalEvents',
      render: (_: unknown, record: AttendanceDevice) =>
        record.stats?.totalEvents?.toLocaleString() ?? '0',
    },
    {
      title: t('col.actions'),
      key: 'actions',
      render: (_: unknown, record: AttendanceDevice) => {
        const busy = actionLoading === record._id;
        if (record.status === 'pending_approval') {
          return (
            <Button
              size="small"
              type="primary"
              loading={busy}
              onClick={() => handleApprove(record._id)}
            >
              {tDetail('action.approve')}
            </Button>
          );
        }
        if (record.status === 'active') {
          return (
            <Space>
              <Button size="small" loading={busy} onClick={() => handlePause(record._id)}>
                {tDetail('action.pause')}
              </Button>
              <Button size="small" danger loading={busy} onClick={() => handleRevoke(record._id)}>
                {tDetail('action.revoke')}
              </Button>
            </Space>
          );
        }
        if (record.status === 'paused') {
          return (
            <Space>
              <Button size="small" loading={busy} onClick={() => handleUnpause(record._id)}>
                {tDetail('action.unpause')}
              </Button>
              <Button size="small" danger loading={busy} onClick={() => handleRevoke(record._id)}>
                {tDetail('action.revoke')}
              </Button>
            </Space>
          );
        }
        // revoked - no actions
        return (
          <Text type="secondary" style={{ fontSize: 12 }}>
            -
          </Text>
        );
      },
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Top toolbar - replaces DsPageHeader right= buttons */}
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="text"
          size="small"
          icon={<InfoCircleOutlined />}
          onClick={() => setHowItWorksOpen(true)}
          className="text-blue-700 hover:text-blue-700"
        >
          {t('howItWorks')}
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setGuideOpen(true)}>
          {t('addDevice')}
        </Button>
      </div>

      {/* Devices table */}
      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <DsTable<AttendanceDevice>
          rowKey="_id"
          dataSource={devices}
          columns={columns}
          locale={{
            emptyText: (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <WifiOutlined
                  style={{ fontSize: 36, color: 'var(--cr-neutral-300)', marginBottom: 12 }}
                />
                <div style={{ color: 'var(--cr-text-3)', marginBottom: 12 }}>{t('noDevices')}</div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setGuideOpen(true)}>
                  {t('connectDevice')}
                </Button>
              </div>
            ),
          }}
          scrollX={800}
        />
      )}

      {/* How it works modal */}
      <DsModal
        open={howItWorksOpen}
        title={
          <span className="flex items-center gap-2">
            <InfoCircleOutlined className="text-blue-700" /> {t('howItWorksModal.title')}
          </span>
        }
        onCancel={() => setHowItWorksOpen(false)}
        footer={
          <Button type="primary" onClick={() => setHowItWorksOpen(false)}>
            {t('howItWorksModal.gotIt')}
          </Button>
        }
        width={600}
        scrollable
      >
        <div className="space-y-5 py-1">
          {/* What is it */}
          <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-base text-blue-700">
              <ScanOutlined />
            </span>
            <div>
              <p className="mb-1 text-sm font-semibold text-slate-800">
                {t('howItWorksModal.whatIs')}
              </p>
              <p className="m-0 text-[13px] leading-relaxed text-slate-600">
                {t.rich('howItWorksModal.whatIsBody', {
                  protocol: () => (
                    <strong className="font-medium text-slate-700">
                      {t('howItWorksModal.admsProtocol')}
                    </strong>
                  ),
                })}
              </p>
            </div>
          </div>

          {/* 3-step flow */}
          <div>
            <p className="mb-3 text-xs font-semibold tracking-widest text-slate-600 uppercase">
              {t('howItWorksModal.setupHeading')}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  n: 1,
                  icon: <CloudUploadOutlined />,
                  title: t('howItWorksModal.step1Title'),
                  desc: t('howItWorksModal.step1Desc'),
                },
                {
                  n: 2,
                  icon: <ScanOutlined />,
                  title: t('howItWorksModal.step2Title'),
                  desc: t('howItWorksModal.step2Desc'),
                },
                {
                  n: 3,
                  icon: <CheckCircleOutlined />,
                  title: t('howItWorksModal.step3Title'),
                  desc: t('howItWorksModal.step3Desc'),
                },
              ].map(({ n, icon, title, desc }) => (
                <div
                  key={n}
                  className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      {n}
                    </span>
                    <span className="text-sm text-blue-700">{icon}</span>
                  </div>
                  <p className="m-0 text-[13px] font-semibold text-slate-800">{title}</p>
                  <p className="m-0 text-[12px] leading-relaxed text-slate-600">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Benefits + Security 2-col */}
          <div className="grid grid-cols-2 gap-4">
            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-green-50 px-4 py-2.5">
                <TeamOutlined className="text-sm text-green-700" />
                <p className="m-0 text-[13px] font-semibold text-green-700">
                  {t('howItWorksModal.benefitsHeading')}
                </p>
              </div>
              <ul className="m-0 list-none divide-y divide-slate-50 p-0">
                {[
                  t('howItWorksModal.benefit1'),
                  t('howItWorksModal.benefit2'),
                  t('howItWorksModal.benefit3'),
                  t('howItWorksModal.benefit4'),
                ].map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 px-4 py-2.5">
                    <CheckCircleOutlined className="mt-0.5 shrink-0 text-xs text-green-700" />
                    <span className="text-[12px] leading-relaxed text-slate-600">{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-purple-50 px-4 py-2.5">
                <SafetyOutlined className="text-sm text-purple-700" />
                <p className="m-0 text-[13px] font-semibold text-purple-700">
                  {t('howItWorksModal.securityHeading')}
                </p>
              </div>
              <ul className="m-0 list-none divide-y divide-slate-50 p-0">
                {[
                  t('howItWorksModal.security1'),
                  t('howItWorksModal.security2'),
                  t('howItWorksModal.security3'),
                  t('howItWorksModal.security4'),
                ].map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 px-4 py-2.5">
                    <ThunderboltOutlined className="mt-0.5 shrink-0 text-xs text-purple-400" />
                    <span className="text-[12px] leading-relaxed text-slate-600">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </DsModal>

      {/* Add device / setup guide modal */}
      <DsModal
        open={guideOpen}
        title={t('setupGuide')}
        onCancel={() => setGuideOpen(false)}
        footer={null}
        width={620}
        scrollable
        scrollHeight="calc(100vh - 160px)"
      >
        <DeviceSetupGuide
          token={token}
          workspaceId={currentWorkspaceId ?? ''}
          onRotateToken={handleRotateToken}
          rotating={rotating}
        />
      </DsModal>
    </div>
  );
}
