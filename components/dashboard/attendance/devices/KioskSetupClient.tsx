'use client';

import { useState, useEffect, useCallback } from 'react';
import { App, Switch, Table, Input, Button, Modal, Spin, Alert, Tooltip, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CopyOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LockOutlined,
  InfoCircleOutlined,
  TabletOutlined,
  SafetyOutlined,
  ThunderboltOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { DsModal } from '@/components/ui';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import {
  getKioskState,
  enableKioskWithFreshToken,
  regenerateKioskToken,
  updateKioskSettings,
} from '@/lib/actions/kiosk.actions';
import { ResetPinModal } from '@/components/dashboard/attendance/ResetPinModal';
import { teamApi } from '@/lib/api/modules/team.api';
import type { TeamMember, WorkspaceKioskState } from '@/types';

interface OneTimeSecretModalProps {
  open: boolean;
  url: string;
  onClose: () => void;
}

function OneTimeSecretModal({ open, url, onClose }: OneTimeSecretModalProps) {
  const t = useTranslations('attendance');
  const { message } = App.useApp();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
      })
      .catch(() => {
        message.error(t('kiosk.secretModal.failCopy'));
      });
  };

  return (
    <Modal
      title={t('kiosk.secretModal.title')}
      open={open}
      closable={false}
      mask={{ closable: false }}
      footer={[
        <Button key="done" type="primary" disabled={!copied} onClick={onClose}>
          {copied ? 'I have copied the URL' : 'Copy the URL first'}
        </Button>,
      ]}
    >
      <Alert
        type="warning"
        showIcon
        title={t('kiosk.secretModal.warningTitle')}
        description={t('kiosk.secretModal.warningDesc')}
        className="mb-4"
      />
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-sm break-all">
        <span className="flex-1">{url}</span>
        <Button
          icon={<CopyOutlined />}
          onClick={handleCopy}
          type={copied ? 'primary' : 'default'}
          size="small"
        >
          {copied ? t('kiosk.copyButton.copied') : t('kiosk.copyButton.idle')}
        </Button>
      </div>
    </Modal>
  );
}

export default function KioskSetupClient() {
  const t = useTranslations('attendance');
  const { message } = App.useApp();
  const { currentWorkspaceId } = useWorkspaceStore();
  const wsId = currentWorkspaceId ?? '';

  const [loading, setLoading] = useState(true);
  const [kioskState, setKioskState] = useState<WorkspaceKioskState>({
    kioskEnabled: false,
    kioskTokenRotatedAt: null,
    kioskAllowedIpRanges: [],
  });
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [secretUrl, setSecretUrl] = useState('');

  const [ipText, setIpText] = useState('');
  const [savingIp, setSavingIp] = useState(false);

  const [guideOpen, setGuideOpen] = useState(false);
  const [togglingKiosk, setTogglingKiosk] = useState(false);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);

  const [resetPinModal, setResetPinModal] = useState<{
    open: boolean;
    memberId: string;
    memberName: string;
  }>({ open: false, memberId: '', memberName: '' });

  const loadState = useCallback(async () => {
    if (!wsId) return;
    setLoading(true);
    try {
      const s = await getKioskState(wsId);
      setKioskState(s);
      setIpText((s.kioskAllowedIpRanges ?? []).join('\n'));
    } catch {
      message.error(t('kiosk.toast.failLoadKiosk'));
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  const loadMembers = useCallback(async () => {
    if (!wsId) return;
    setMembersLoading(true);
    try {
      const result = await teamApi.list(wsId);
      const list = Array.isArray(result)
        ? result
        : ((result as { data?: TeamMember[] })?.data ?? []);
      setMembers(list);
    } catch {
      message.error(t('kiosk.toast.failLoadMembers'));
    } finally {
      setMembersLoading(false);
    }
  }, [wsId]);

  // Inline-async-IIFE mirrors loadState + loadMembers for the initial load
  // + dep-change reload; both useCallbacks stay for explicit handler refresh.
  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const s = await getKioskState(wsId);
        if (!cancelled) {
          setKioskState(s);
          setIpText((s.kioskAllowedIpRanges ?? []).join('\n'));
        }
      } catch {
        if (!cancelled) message.error(t('kiosk.toast.failLoadKiosk'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    void (async () => {
      setMembersLoading(true);
      try {
        const result = await teamApi.list(wsId);
        if (cancelled) return;
        const list = Array.isArray(result)
          ? result
          : ((result as { data?: TeamMember[] })?.data ?? []);
        setMembers(list);
      } catch {
        if (!cancelled) message.error(t('kiosk.toast.failLoadMembers'));
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  const handleToggle = async (checked: boolean) => {
    if (!wsId) return;
    setTogglingKiosk(true);
    try {
      if (checked) {
        // Enable kiosk and generate fresh token
        const result = await enableKioskWithFreshToken(wsId);
        setKioskState((prev) => ({
          ...prev,
          kioskEnabled: true,
          kioskTokenRotatedAt: result.rotatedAt,
        }));
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setSecretUrl(`${origin}/kiosk/${wsId}/${result.secret}`);
        setSecretModalOpen(true);
      } else {
        await updateKioskSettings(wsId, { enabled: false });
        setKioskState((prev) => ({ ...prev, kioskEnabled: false }));
        message.success(t('kiosk.toast.disabled'));
      }
    } catch (e: unknown) {
      const err = e as { message?: string } | null;
      message.error(err?.message ?? t('kiosk.toast.failUpdate'));
    } finally {
      setTogglingKiosk(false);
    }
  };

  const handleRegen = async () => {
    if (!wsId) return;
    setRegenLoading(true);
    try {
      const result = await regenerateKioskToken(wsId);
      setKioskState((prev) => ({ ...prev, kioskTokenRotatedAt: result.rotatedAt }));
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setSecretUrl(`${origin}/kiosk/${wsId}/${result.secret}`);
      setSecretModalOpen(true);
      setRegenConfirmOpen(false);
    } catch (e: unknown) {
      const err = e as { message?: string } | null;
      message.error(err?.message ?? t('kiosk.toast.failRegenerate'));
    } finally {
      setRegenLoading(false);
    }
  };

  const handleSaveIp = async () => {
    if (!wsId) return;
    setSavingIp(true);
    try {
      const ranges = ipText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const result = await updateKioskSettings(wsId, { allowedIpRanges: ranges });
      setKioskState((prev) => ({ ...prev, kioskAllowedIpRanges: result.allowedIpRanges }));
      message.success(t('kiosk.toast.allowlistSaved'));
    } catch (e: unknown) {
      const err = e as { message?: string } | null;
      message.error(err?.message ?? t('kiosk.toast.failAllowlist'));
    } finally {
      setSavingIp(false);
    }
  };

  const columns: ColumnsType<TeamMember> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Employee Code',
      dataIndex: 'employeeCode',
      key: 'employeeCode',
      render: (v?: string) => v ?? <span className="text-faint">-</span>,
    },
    {
      title: 'PIN status',
      key: 'pinStatus',
      render: (_, record) =>
        record.kioskPinSet ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Set
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default">
            Not set
          </Tag>
        ),
    },
    {
      title: 'Failed attempts',
      key: 'kioskFailedAttempts',
      render: (_, record) => record.kioskFailedAttempts ?? 0,
    },
    {
      title: 'Locked until',
      key: 'kioskLockedUntil',
      render: (_, record) => {
        if (!record.kioskLockedUntil) return <span className="text-faint">-</span>;
        const d = new Date(record.kioskLockedUntil);
        return (
          <Tooltip title={d.toISOString()}>
            <span className="text-red-700">
              <LockOutlined className="mr-1" />
              {d.toLocaleTimeString()}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button
          size="small"
          onClick={() =>
            setResetPinModal({ open: true, memberId: record.id, memberName: record.name })
          }
        >
          Reset PIN
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spin size="large" />
      </div>
    );
  }

  const rotatedAt = kioskState.kioskTokenRotatedAt
    ? new Date(kioskState.kioskTokenRotatedAt).toLocaleString()
    : null;

  return (
    <div className="max-w-3xl space-y-8">
      {/* Page header */}
      <div>
        <div className="mb-1 flex items-center gap-3">
          <h1 className="m-0 text-xl font-semibold">{t('kiosk.pageTitle')}</h1>
          <Button
            type="text"
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => setGuideOpen(true)}
            className="text-blue-700 hover:text-blue-700"
          >
            How it works
          </Button>
        </div>
        <p className="m-0 text-sm text-gray-700">
          Configure the tablet kiosk so employees can punch in/out using their employee code and
          PIN.
        </p>
      </div>

      {/* Guide modal - opens from "How it works" button */}
      <DsModal
        title={
          <div className="flex items-center gap-2">
            <InfoCircleOutlined className="text-blue-700" />
            <span>{t('kiosk.howItWorks')}</span>
          </div>
        }
        open={guideOpen}
        onCancel={() => setGuideOpen(false)}
        footer={
          <Button type="primary" onClick={() => setGuideOpen(false)}>
            Got it
          </Button>
        }
        width={640}
        scrollable
      >
        <div className="space-y-6 py-2">
          {/* What is it */}
          <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-base text-blue-700">
              <TabletOutlined />
            </span>
            <div>
              <p className="mb-1 text-sm font-semibold text-slate-800">{t('kiosk.whatIsKiosk')}</p>
              <p className="m-0 text-[13px] leading-relaxed text-slate-600">
                Mount any tablet at your office entrance or factory gate. Employees punch in and out
                themselves using their{' '}
                <strong className="font-medium text-slate-700">
                  {t('kiosk.credentialPhrase')}
                </strong>{' '}
                - no smartphone, no app, no manager needed.
              </p>
            </div>
          </div>

          {/* Setup steps */}
          <div>
            <p className="mb-3 text-xs font-semibold tracking-widest text-slate-600 uppercase">
              Setup in 4 steps
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  n: 1,
                  icon: <ThunderboltOutlined />,
                  title: 'Enable',
                  desc: 'Toggle kiosk on - a one-time secret URL appears.',
                },
                {
                  n: 2,
                  icon: <TabletOutlined />,
                  title: 'Open on tablet',
                  desc: 'Load the URL on any tablet and keep it open.',
                },
                {
                  n: 3,
                  icon: <LockOutlined />,
                  title: 'Set PINs',
                  desc: 'Assign a 4-digit PIN to each employee.',
                },
                {
                  n: 4,
                  icon: <CheckCircleOutlined />,
                  title: 'Go live',
                  desc: 'Employees enter code + PIN to punch in or out.',
                },
              ].map(({ n, icon, title, desc }) => (
                <div
                  key={n}
                  className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-3.5"
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

          {/* Benefits + Security */}
          <div className="grid grid-cols-2 gap-4">
            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-green-50 px-4 py-2.5">
                <TeamOutlined className="text-sm text-green-700" />
                <p className="m-0 text-[13px] font-semibold text-green-700">
                  {t('kiosk.whyUseKiosk')}
                </p>
              </div>
              <ul className="m-0 list-none divide-y divide-slate-50 p-0">
                {[
                  'No biometric hardware - any browser works.',
                  'Employees self-serve; no daily manual marking.',
                  'Auto-toggles Check In / Check Out - one tap.',
                  'Punch data flows into payroll like any device.',
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
                  {t('kiosk.security')}
                </p>
              </div>
              <ul className="m-0 list-none divide-y divide-slate-50 p-0">
                {[
                  'Secret URL - only those with link can access.',
                  'Same error for wrong code or PIN (no guessing).',
                  '5-min lockout after 5 wrong PIN attempts.',
                  'Regenerate URL - old tablets stop instantly.',
                  'Optional IP allowlist for office-only access.',
                ].map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 px-4 py-2.5">
                    <LockOutlined className="mt-0.5 shrink-0 text-xs text-purple-400" />
                    <span className="text-[12px] leading-relaxed text-slate-600">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </DsModal>

      {/* Section 1: Toggle */}
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold">{t('kiosk.enableKiosk')}</h2>
        <div className="flex items-center gap-3">
          <Switch
            aria-label={t('kiosk.enableKioskAria')}
            checked={kioskState.kioskEnabled}
            onChange={handleToggle}
            loading={togglingKiosk}
          />
          <span className="text-gray-700">
            {kioskState.kioskEnabled ? 'Kiosk is enabled' : 'Kiosk is disabled'}
          </span>
        </div>
      </div>

      {/* Section 2: URL + regenerate (only when enabled) */}
      {kioskState.kioskEnabled && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-semibold">{t('kiosk.kioskUrl')}</h2>
          {rotatedAt && (
            <p className="text-sm text-gray-700">
              URL last rotated at <strong>{rotatedAt}</strong>.
            </p>
          )}
          <p className="text-sm text-gray-700">
            Regenerating the URL will invalidate any currently open kiosk tabs.
          </p>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => setRegenConfirmOpen(true)}
            loading={regenLoading}
          >
            Regenerate URL
          </Button>
          <Modal
            title={t('kiosk.regenConfirmTitle')}
            open={regenConfirmOpen}
            onOk={handleRegen}
            onCancel={() => setRegenConfirmOpen(false)}
            okText="Regenerate"
            okButtonProps={{ danger: true, loading: regenLoading }}
          >
            <p>
              This will invalidate the current kiosk URL immediately. Any tablets using the old URL
              will stop working until you paste in the new one.
            </p>
          </Modal>
        </div>
      )}

      {/* Section 3: IP allowlist */}
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-semibold">{t('kiosk.ipAllowlist')}</h2>
        <p className="text-sm text-gray-700">
          One CIDR range per line (e.g. <code>10.0.0.0/8</code>). Leave empty to allow all IPs.
        </p>
        <Input.TextArea
          rows={4}
          value={ipText}
          onChange={(e) => setIpText(e.target.value)}
          placeholder={'10.0.0.0/8\n203.0.113.0/24'}
        />
        {ipText.trim() === '' && (
          <p className="text-xs text-amber-700">{t('kiosk.noIpRestriction')}</p>
        )}
        <Button type="primary" onClick={handleSaveIp} loading={savingIp}>
          Save allowlist
        </Button>
      </div>

      {/* Section 4: Per-member PIN table */}
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t('kiosk.memberPinStatus')}</h2>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={loadMembers}
            loading={membersLoading}
          >
            Refresh
          </Button>
        </div>
        <Table<TeamMember>
          columns={columns}
          dataSource={members}
          rowKey={(r) => r.id ?? (r as unknown as { _id: string })._id}
          loading={membersLoading}
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 20 }}
        />
      </div>

      {/* One-time secret modal */}
      <OneTimeSecretModal
        open={secretModalOpen}
        url={secretUrl}
        onClose={() => setSecretModalOpen(false)}
      />

      {/* Reset PIN modal */}
      <ResetPinModal
        open={resetPinModal.open}
        onClose={() => setResetPinModal((p) => ({ ...p, open: false }))}
        wsId={wsId}
        memberId={resetPinModal.memberId}
        memberName={resetPinModal.memberName}
        onSuccess={loadMembers}
      />
    </div>
  );
}
