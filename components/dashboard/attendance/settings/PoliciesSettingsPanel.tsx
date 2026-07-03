'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Skeleton,
  Switch,
  Table,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { attendancePoliciesApi } from '@/lib/api/modules/attendance-policies.api';
import { teamApi } from '@/lib/api/modules/team.api';
import { parseApiError } from '@/lib/utils';
import { DsButton, DsEmptyState, DsTag, InfoTooltip, StatTile } from '@/components/ui';
import type {
  AttendancePolicy,
  AttendancePolicyDryRunChange,
  AttendancePolicyDryRunResult,
  CreateAttendancePolicyPayload,
  TeamMember,
} from '@/types';

/**
 * Extracted from app/dashboard/attendance/settings/policies/page.tsx
 * into a panel component for use in the unified tabbed settings page.
 * The DsPageHeader is replaced with a lightweight tab toolbar (subtitle
 * text + conditional New Policy button).
 */

const { RangePicker } = DatePicker;

/** Blank policy used as the create-form baseline (mirrors BE schema defaults). */
const EMPTY_FORM: CreateAttendancePolicyPayload = {
  name: '',
  isDefault: false,
  lateArrival: { countAsLop: false, lopAfterNLateDays: null },
  earlyDeparture: { enabled: false, thresholdMinutes: 30, countAsHalfDay: false },
  ot: { enabled: false, thresholdMinutes: 30, capMinutes: null },
};

/** BE caps the dry-run window at 31 days (threat mitigation T-C-03). */
const MAX_DRYRUN_DAYS = 31;

// ── Small presentational helpers ───────────────────────────────
function Dot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        marginTop: 5,
        background: on ? 'var(--cr-success-700)' : 'var(--cr-neutral-300)',
      }}
    />
  );
}

function ToggleRow({
  title,
  hint,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  hint?: string;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="m-0 text-[14px] font-semibold text-gray-900">{title}</p>
        {hint && <p className="mt-0.5 mb-0 text-[12px] text-gray-600">{hint}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} aria-label={title} />
    </div>
  );
}

export function PoliciesSettingsPanel() {
  const t = useTranslations('attendance.policiesSettings');
  const { message, modal } = App.useApp();
  const { currentWorkspaceId: wsId } = useWorkspaceStore();

  const [policies, setPolicies] = useState<AttendancePolicy[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Editor drawer state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AttendancePolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<CreateAttendancePolicyPayload>();
  const lateLop = Form.useWatch(['lateArrival', 'countAsLop'], form);
  const earlyOn = Form.useWatch(['earlyDeparture', 'enabled'], form);
  const otOn = Form.useWatch(['ot', 'enabled'], form);

  // Simulator drawer state
  const [simOpen, setSimOpen] = useState(false);
  const [simPolicy, setSimPolicy] = useState<AttendancePolicy | null>(null);
  const [simRange, setSimRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [simScope, setSimScope] = useState<string[]>([]);
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<AttendancePolicyDryRunResult | null>(null);

  // `load` is the reload path - invoked by event handlers
  // (save / delete / set-default / retry), where setState is unrestricted.
  const load = useCallback(async () => {
    if (!wsId) return;
    try {
      const list = await attendancePoliciesApi.list(wsId);
      setPolicies(list);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  // Mount fetch - kept inline with setState only inside promise callbacks,
  // so it doesn't trip react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!wsId) return;
    attendancePoliciesApi
      .list(wsId)
      .then((list) => {
        setPolicies(list);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [wsId]);

  useEffect(() => {
    if (!wsId) return;
    teamApi
      .list(wsId)
      .then((res) => {
        setMembers(Array.isArray(res) ? res : res.data);
      })
      .catch(() => setMembers([]));
  }, [wsId]);

  const memberName = useCallback(
    (id: string) => members.find((m) => m.id === id)?.name ?? id,
    [members],
  );

  // ── Editor ────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (p: AttendancePolicy) => {
    setEditing(p);
    setEditorOpen(true);
  };

  // Populate the form only once the drawer (and its <Form/>) is mounted -
  // calling setFieldsValue before the Form renders triggers an antd
  // "instance not connected" warning.
  useEffect(() => {
    if (!editorOpen) return;
    form.resetFields();
    if (editing) {
      form.setFieldsValue({
        name: editing.name,
        isDefault: editing.isDefault,
        lateArrival: editing.lateArrival ?? EMPTY_FORM.lateArrival,
        earlyDeparture: editing.earlyDeparture ?? EMPTY_FORM.earlyDeparture,
        ot: editing.ot ?? EMPTY_FORM.ot,
      });
    }
  }, [editorOpen, editing, form]);

  const submitEditor = async () => {
    if (!wsId) return;
    let values: CreateAttendancePolicyPayload;
    try {
      values = await form.validateFields();
    } catch {
      return; // antd renders field errors inline
    }
    setSaving(true);
    try {
      if (editing) {
        await attendancePoliciesApi.update(wsId, editing._id, values);
      } else {
        await attendancePoliciesApi.create(wsId, values);
      }
      message.success(t('saved'));
      setEditorOpen(false);
      await load();
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmSetDefault = (p: AttendancePolicy) => {
    if (!wsId) return;
    modal.confirm({
      title: t('setDefaultConfirm'),
      content: t('setDefaultDesc'),
      okText: t('actions.setDefault'),
      onOk: async () => {
        try {
          await attendancePoliciesApi.update(wsId, p._id, { isDefault: true });
          message.success(t('defaultUpdated'));
          await load();
        } catch (e) {
          message.error(parseApiError(e));
        }
      },
    });
  };

  const confirmDelete = (p: AttendancePolicy) => {
    if (!wsId) return;
    modal.confirm({
      title: t('deleteConfirm'),
      content: t('deleteDesc'),
      okText: t('actions.delete'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await attendancePoliciesApi.delete(wsId, p._id);
          message.success(t('deleted'));
          await load();
        } catch (e) {
          message.error(parseApiError(e));
        }
      },
    });
  };

  // ── Simulator ─────────────────────────────────────────────
  const openSimulator = (p: AttendancePolicy) => {
    setSimPolicy(p);
    setSimRange(null);
    setSimScope([]);
    setSimResult(null);
    setSimOpen(true);
  };

  const runSimulation = async () => {
    if (!wsId || !simPolicy) return;
    if (!simRange || !simRange[0] || !simRange[1]) {
      message.error(t('simulator.rangeRequired'));
      return;
    }
    if (simRange[1].diff(simRange[0], 'day') >= MAX_DRYRUN_DAYS) {
      message.error(t('simulator.rangeTooLong'));
      return;
    }
    setSimRunning(true);
    try {
      const result = await attendancePoliciesApi.dryRun(wsId, simPolicy._id, {
        dateRange: {
          from: simRange[0].format('YYYY-MM-DD'),
          to: simRange[1].format('YYYY-MM-DD'),
        },
        scope: simScope.length > 0 ? simScope : undefined,
      });
      setSimResult(result);
    } catch (e) {
      message.error(parseApiError(e) || t('simulator.runError'));
    } finally {
      setSimRunning(false);
    }
  };

  const simColumns: ColumnsType<AttendancePolicyDryRunChange> = useMemo(
    () => [
      {
        title: t('simulator.colMember'),
        dataIndex: 'teamMemberId',
        key: 'member',
        render: (id: string) => memberName(id),
      },
      {
        title: t('simulator.colDate'),
        dataIndex: 'date',
        key: 'date',
        render: (d: string) => dayjs(d).format('DD MMM YYYY'),
      },
      {
        title: t('simulator.colBefore'),
        key: 'before',
        render: (_: unknown, row) => <DsTag status={row.before.status} />,
      },
      {
        title: t('simulator.colAfter'),
        key: 'after',
        render: (_: unknown, row) => <DsTag status={row.after.status} />,
      },
      {
        title: t('simulator.colLate'),
        key: 'late',
        align: 'right',
        render: (_: unknown, row) => row.after.lateMinutes || '-',
      },
    ],
    [t, memberName],
  );

  // ── Rule summary lines for a policy card ──────────────────
  const ruleLines = (p: AttendancePolicy) => {
    const lopParts: string[] = [];
    if (p.lateArrival?.countAsLop) {
      lopParts.push(t('card.lopOn'));
      if (p.lateArrival.lopAfterNLateDays && p.lateArrival.lopAfterNLateDays > 0) {
        lopParts.push(t('card.lopGrace', { n: p.lateArrival.lopAfterNLateDays }));
      }
    }
    const otParts: string[] = [];
    if (p.ot?.enabled) {
      otParts.push(t('card.otSummary', { n: p.ot.thresholdMinutes }));
      if (p.ot.capMinutes && p.ot.capMinutes > 0) {
        otParts.push(t('card.otCap', { n: p.ot.capMinutes }));
      }
    }
    return [
      {
        label: t('card.lateArrival'),
        on: !!p.lateArrival?.countAsLop,
        value: p.lateArrival?.countAsLop ? lopParts.join(' · ') : t('card.off'),
      },
      {
        label: t('card.earlyDeparture'),
        on: !!p.earlyDeparture?.enabled,
        value: p.earlyDeparture?.enabled
          ? p.earlyDeparture.countAsHalfDay
            ? t('card.edHalfDay', { n: p.earlyDeparture.thresholdMinutes })
            : t('card.edFlagOnly', { n: p.earlyDeparture.thresholdMinutes })
          : t('card.off'),
      },
      {
        label: t('card.ot'),
        on: !!p.ot?.enabled,
        value: p.ot?.enabled ? otParts.join(' · ') : t('card.off'),
      },
      {
        label: t('card.compOff'),
        on: false,
        value: t('card.compOffComing'),
      },
    ];
  };

  return (
    <div>
      {/* Lightweight tab toolbar - subtitle + conditional New Policy button */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="m-0 text-[13px] text-gray-600">{t('subtitle')}</p>
        {policies.length > 0 && (
          <DsButton dsVariant="primary" onClick={openCreate} data-shortcut="new-policy">
            <PlusOutlined /> {t('newPolicy')}
          </DsButton>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Card>
          ))}
        </div>
      ) : loadError ? (
        <Card>
          <DsEmptyState
            title={t('loadError')}
            action={
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setLoading(true);
                  load();
                }}
              >
                {t('retry')}
              </Button>
            }
          />
        </Card>
      ) : policies.length === 0 ? (
        <Card>
          <DsEmptyState
            title={t('emptyTitle')}
            sub={t('emptySub')}
            action={
              <DsButton dsVariant="primary" onClick={openCreate} data-shortcut="new-policy">
                <PlusOutlined /> {t('newPolicy')}
              </DsButton>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {policies.map((p) => (
            <Card key={p._id} styles={{ body: { padding: 16 } }}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="m-0 font-display text-[15px] font-bold text-gray-900">{p.name}</h2>
                {p.isDefault && <DsTag status="active">{t('defaultBadge')}</DsTag>}
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {ruleLines(p).map((r) => (
                  <div key={r.label} className="flex items-start gap-2">
                    <Dot on={r.on} />
                    <div className="min-w-0">
                      <span className="text-[13px] font-semibold text-gray-800">{r.label}</span>
                      <span className="text-[13px] text-gray-600"> - {r.value}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="mt-4 flex items-center justify-between border-0 border-t border-solid pt-3"
                style={{ borderColor: 'var(--cr-border-light)' }}
              >
                <div className="flex items-center gap-1">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEdit(p)}
                  >
                    {t('actions.edit')}
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    icon={<ExperimentOutlined />}
                    onClick={() => openSimulator(p)}
                  >
                    {t('actions.simulate')}
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  {!p.isDefault && (
                    <Button type="link" size="small" onClick={() => confirmSetDefault(p)}>
                      {t('actions.setDefault')}
                    </Button>
                  )}
                  <Button
                    type="text"
                    size="small"
                    danger
                    disabled={p.isDefault}
                    icon={<DeleteOutlined />}
                    aria-label={t('actions.delete')}
                    onClick={() => confirmDelete(p)}
                  />
                  {p.isDefault && <InfoTooltip text={t('deleteDefaultTip')} />}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Editor drawer ─────────────────────────────────── */}
      <Drawer
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? t('editor.editTitle') : t('editor.createTitle')}
        styles={{ wrapper: { width: 520 } }}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditorOpen(false)} disabled={saving}>
              {t('editor.cancel')}
            </Button>
            <DsButton dsVariant="primary" onClick={submitEditor} loading={saving}>
              {t('editor.save')}
            </DsButton>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark="optional" initialValues={EMPTY_FORM}>
          <Form.Item
            name="name"
            label={t('editor.nameLabel')}
            rules={[{ required: true, whitespace: true, message: t('editor.nameRequired') }]}
          >
            <Input size="large" placeholder={t('editor.namePlaceholder')} />
          </Form.Item>

          <Form.Item name="isDefault" valuePropName="checked" className="!mb-6">
            <ToggleRow title={t('editor.isDefaultLabel')} hint={t('editor.isDefaultHint')} />
          </Form.Item>

          {/* Late arrival */}
          <section className="mb-6">
            <h3 className="m-0 font-display text-[14px] font-bold text-gray-900">
              {t('editor.sectionLate')}
            </h3>
            <p className="mt-0.5 mb-3 text-[12px] text-gray-500">{t('editor.sectionLateHint')}</p>
            <Form.Item
              name={['lateArrival', 'countAsLop']}
              valuePropName="checked"
              className="!mb-3"
            >
              <ToggleRow
                title={t('editor.lateCountAsLopLabel')}
                hint={t('editor.lateCountAsLopHint')}
              />
            </Form.Item>
            <Form.Item
              name={['lateArrival', 'lopAfterNLateDays']}
              label={
                <span className="flex items-center gap-1">
                  {t('editor.lateGraceLabel')}
                  <InfoTooltip text={t('editor.lateGraceHint')} />
                </span>
              }
              rules={[{ type: 'number', min: 0, message: t('editor.nonNegative') }]}
              className="!mb-0"
            >
              <InputNumber min={0} className="w-full" size="large" disabled={!lateLop} />
            </Form.Item>
          </section>

          {/* Early departure */}
          <section className="mb-6">
            <h3 className="m-0 font-display text-[14px] font-bold text-gray-900">
              {t('editor.sectionEarly')}
            </h3>
            <p className="mt-0.5 mb-3 text-[12px] text-gray-500">{t('editor.sectionEarlyHint')}</p>
            <Form.Item
              name={['earlyDeparture', 'enabled']}
              valuePropName="checked"
              className="!mb-3"
            >
              <ToggleRow title={t('editor.earlyEnabledLabel')} />
            </Form.Item>
            <Form.Item
              name={['earlyDeparture', 'thresholdMinutes']}
              label={
                <span className="flex items-center gap-1">
                  {t('editor.earlyThresholdLabel')}
                  <InfoTooltip text={t('editor.earlyThresholdHint')} />
                </span>
              }
              rules={[{ type: 'number', min: 0, message: t('editor.nonNegative') }]}
            >
              <InputNumber min={0} className="w-full" size="large" disabled={!earlyOn} />
            </Form.Item>
            <Form.Item
              name={['earlyDeparture', 'countAsHalfDay']}
              valuePropName="checked"
              className="!mb-0"
            >
              <ToggleRow
                title={t('editor.earlyHalfDayLabel')}
                hint={t('editor.earlyHalfDayHint')}
                disabled={!earlyOn}
              />
            </Form.Item>
          </section>

          {/* Overtime */}
          <section className="mb-6">
            <h3 className="m-0 font-display text-[14px] font-bold text-gray-900">
              {t('editor.sectionOt')}
            </h3>
            <p className="mt-0.5 mb-3 text-[12px] text-gray-500">{t('editor.sectionOtHint')}</p>
            <Form.Item name={['ot', 'enabled']} valuePropName="checked" className="!mb-3">
              <ToggleRow title={t('editor.otEnabledLabel')} />
            </Form.Item>
            <Form.Item
              name={['ot', 'thresholdMinutes']}
              label={
                <span className="flex items-center gap-1">
                  {t('editor.otThresholdLabel')}
                  <InfoTooltip text={t('editor.otThresholdHint')} />
                </span>
              }
              rules={[{ type: 'number', min: 0, message: t('editor.nonNegative') }]}
            >
              <InputNumber min={0} className="w-full" size="large" disabled={!otOn} />
            </Form.Item>
            <Form.Item
              name={['ot', 'capMinutes']}
              label={
                <span className="flex items-center gap-1">
                  {t('editor.otCapLabel')}
                  <InfoTooltip text={t('editor.otCapHint')} />
                </span>
              }
              rules={[{ type: 'number', min: 0, message: t('editor.nonNegative') }]}
              className="!mb-0"
            >
              <InputNumber min={0} className="w-full" size="large" disabled={!otOn} />
            </Form.Item>
          </section>

          {/* Comp-off - deferred to the leave module */}
          <section
            className="rounded-lg p-3"
            style={{ background: 'var(--cr-surface-2, var(--cr-bg))' }}
          >
            <h3 className="m-0 font-display text-[14px] font-bold text-gray-700">
              {t('editor.sectionCompOff')}
            </h3>
            <p className="mt-1 mb-0 text-[12px] text-gray-500">{t('editor.compOffComingDesc')}</p>
          </section>
        </Form>
      </Drawer>

      {/* ── Simulator drawer ──────────────────────────────── */}
      <Drawer
        open={simOpen}
        onClose={() => setSimOpen(false)}
        title={t('simulator.title')}
        styles={{ wrapper: { width: 620 } }}
      >
        {simPolicy && (
          <>
            <p className="mt-0 mb-4 text-[13px] text-gray-600">
              {t('simulator.subtitle', { name: simPolicy.name })}
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="sim-range"
                  className="mb-1 block text-[13px] font-semibold text-gray-800"
                >
                  {t('simulator.rangeLabel')}
                </label>
                <RangePicker
                  id="sim-range"
                  className="w-full"
                  size="large"
                  value={simRange}
                  onChange={(v) => {
                    const from = v?.[0];
                    const to = v?.[1];
                    setSimRange(from && to ? [from, to] : null);
                  }}
                />
                <p className="mt-1 mb-0 text-[12px] text-gray-500">{t('simulator.rangeHint')}</p>
              </div>

              <div>
                <label
                  htmlFor="sim-scope"
                  className="mb-1 block text-[13px] font-semibold text-gray-800"
                >
                  {t('simulator.scopeLabel')}
                </label>
                <Select
                  id="sim-scope"
                  className="w-full"
                  size="large"
                  mode="multiple"
                  allowClear
                  placeholder={t('simulator.scopePlaceholder')}
                  value={simScope}
                  onChange={setSimScope}
                  optionFilterProp="label"
                  options={members.map((m) => ({ value: m.id, label: m.name }))}
                />
              </div>

              <DsButton dsVariant="primary" onClick={runSimulation} loading={simRunning}>
                <ExperimentOutlined /> {t('simulator.run')}
              </DsButton>
            </div>

            <div className="mt-6">
              {!simResult ? (
                <DsEmptyState title={t('simulator.idleTitle')} sub={t('simulator.idleSub')} />
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <StatTile
                      label={t('simulator.statTotal')}
                      value={String(simResult.summary.total)}
                    />
                    <StatTile
                      label={t('simulator.statChanged')}
                      value={String(simResult.summary.changed)}
                      emphasis
                    />
                    <StatTile
                      label={t('simulator.statUnchanged')}
                      value={String(simResult.summary.unchanged)}
                    />
                  </div>
                  <div className="mt-4">
                    {simResult.changed.length === 0 ? (
                      <DsEmptyState
                        title={t('simulator.emptyTitle')}
                        sub={t('simulator.emptySub')}
                      />
                    ) : (
                      <Table
                        size="small"
                        rowKey={(r) => `${r.teamMemberId}-${r.date}`}
                        columns={simColumns}
                        dataSource={simResult.changed}
                        pagination={{ pageSize: 10, hideOnSinglePage: true }}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}
