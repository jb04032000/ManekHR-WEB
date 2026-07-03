'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  ColorPicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Segmented,
  Select,
  Skeleton,
  Switch,
  Tag,
  Tooltip,
} from 'antd';
import {
  CalendarOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  UndoOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { leaveApi } from '@/lib/api/modules/leave.api';
import { parseApiError } from '@/lib/utils';
import { DsButton, DsPageHeader, DsEmptyState, InfoTooltip } from '@/components/ui';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type {
  CreateLeaveTypePayload,
  LeaveAccrualMode,
  LeaveStatutoryBasis,
  LeaveType,
  LeaveTypeLocale,
  UpdateLeaveTypePayload,
} from '@/types';

/**
 * Statutory annual-entitlement floors (days/year) used for an advisory
 * below-floor warning. Indicative minimums - the owner is not a labour-law
 * expert, so the page flags a configured entitlement that dips under the
 * relevant statute and lets them decide. Never blocks the save.
 *  - factories_act  - Factories Act 1948 §79 earned leave (~1 day / 20 worked).
 *  - shops_act      - Gujarat Shops & Establishments leave-with-wages floor.
 *  - maternity_act  - Maternity Benefit Act 1961 (2017 amendment) - 26 weeks.
 */
const STATUTORY_FLOORS: Record<LeaveStatutoryBasis, number | null> = {
  factories_act: 15,
  shops_act: 7,
  maternity_act: 182,
  voluntary: null,
};

/** Create-form baseline - mirrors the BE LeaveType schema defaults. */
const EMPTY_FORM: CreateLeaveTypePayload = {
  code: '',
  labels: { en: '', 'gu-en': '', 'hi-en': '', gu: '' },
  color: '#1677ff',
  isPaid: true,
  unit: 'half_day_capable',
  statutoryBasis: 'voluntary',
  maxPerRequest: null,
  applicability: { gender: 'any', minTenureDays: null },
  accrualRule: {
    mode: 'none',
    annualQuantity: 0,
    rate: null,
    frequency: null,
    proRateFirstPeriod: true,
    accrualCap: null,
    eligibleAfterDays: 0,
  },
  yearEndRule: { carryForwardCap: 0, lapseExcess: true, encashable: false, encashmentCap: null },
  compOff: { isCompOff: false, validityDays: 90 },
};

/** Resolve a leave type's display label for the active locale, falling back to en. */
function typeLabel(lt: LeaveType, locale: string): string {
  const key = locale as LeaveTypeLocale;
  return lt.labels[key] || lt.labels.en;
}

/** Annualised entitlement used for the statutory floor comparison. */
function effectiveAnnualEntitlement(v: {
  accrualRule: {
    mode: LeaveAccrualMode;
    annualQuantity: number;
    rate: number | null;
    frequency: string | null;
  };
  maxPerRequest?: number | null;
}): number {
  const a = v.accrualRule;
  if (a.mode === 'upfront_annual') return a.annualQuantity || 0;
  if (a.mode === 'periodic_accrual') {
    const periods = a.frequency === 'monthly' ? 12 : a.frequency === 'quarterly' ? 4 : 1;
    return (a.rate || 0) * periods;
  }
  return v.maxPerRequest ?? 0;
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
        <p className="m-0 text-[14px] font-semibold text-heading">{title}</p>
        {hint && <p className="mt-0.5 mb-0 text-[12px] text-muted">{hint}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} aria-label={title} />
    </div>
  );
}

export default function LeaveConfigPage() {
  const t = useTranslations('leave.config');
  const locale = useLocale();
  const { message, modal } = App.useApp();
  const { currentWorkspaceId: wsId } = useWorkspaceStore();
  const { loading: permissionsLoading, canPath } = useMyPermissions();

  const [types, setTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<CreateLeaveTypePayload>();

  const accrualMode = Form.useWatch(['accrualRule', 'mode'], form);
  const isCompOff = Form.useWatch(['compOff', 'isCompOff'], form);
  const statutoryBasis = Form.useWatch('statutoryBasis', form);
  const watchAnnual = Form.useWatch(['accrualRule', 'annualQuantity'], form);
  const watchRate = Form.useWatch(['accrualRule', 'rate'], form);
  const watchFreq = Form.useWatch(['accrualRule', 'frequency'], form);
  const watchMax = Form.useWatch('maxPerRequest', form);

  const load = useCallback(async () => {
    if (!wsId) return;
    try {
      const list = await leaveApi.listTypes(wsId, true);
      setTypes(list);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  // Mount + workspace-change fetch - single shared fetch path via `load`.
  // Deferred through a microtask so the call sits outside the synchronous
  // effect body (set-state-in-effect rule); `load` itself writes state only
  // inside its async callbacks.
  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const visibleTypes = useMemo(
    () => (showInactive ? types : types.filter((lt) => lt.isActive)),
    [types, showInactive],
  );
  const inactiveCount = useMemo(() => types.filter((lt) => !lt.isActive).length, [types]);

  const systemLocked = !!editing?.isSystem;

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (lt: LeaveType) => {
    setEditing(lt);
    setEditorOpen(true);
  };

  // Populate the form once the drawer (and its <Form/>) is mounted.
  useEffect(() => {
    if (!editorOpen) return;
    form.resetFields();
    if (editing) {
      form.setFieldsValue({
        code: editing.code,
        labels: {
          en: editing.labels.en,
          'gu-en': editing.labels['gu-en'] ?? '',
          'hi-en': editing.labels['hi-en'] ?? '',
          gu: editing.labels.gu ?? '',
        },
        color: editing.color,
        isPaid: editing.isPaid,
        unit: editing.unit,
        statutoryBasis: editing.statutoryBasis,
        maxPerRequest: editing.maxPerRequest,
        applicability: {
          gender: editing.applicability.gender,
          minTenureDays: editing.applicability.minTenureDays,
        },
        accrualRule: editing.accrualRule,
        yearEndRule: editing.yearEndRule,
        compOff: editing.compOff,
      });
    }
  }, [editorOpen, editing, form]);

  const submitEditor = async () => {
    if (!wsId) return;
    let values: CreateLeaveTypePayload;
    try {
      values = await form.validateFields();
    } catch {
      return; // antd renders field errors inline
    }

    const emptyToUndef = (v?: string | null) => {
      const trimmed = (v ?? '').trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };
    const labels = {
      en: values.labels.en.trim(),
      'gu-en': emptyToUndef(values.labels['gu-en']),
      'hi-en': emptyToUndef(values.labels['hi-en']),
      gu: emptyToUndef(values.labels.gu),
    };

    setSaving(true);
    try {
      if (editing && editing.isSystem) {
        // System types accept only label + colour edits (BE enforces this too).
        const patch: UpdateLeaveTypePayload = { labels, color: values.color };
        await leaveApi.updateType(wsId, editing._id, patch);
      } else {
        const mode = values.accrualRule.mode;
        const accrualRule = {
          mode,
          annualQuantity: mode === 'upfront_annual' ? values.accrualRule.annualQuantity || 0 : 0,
          rate: mode === 'periodic_accrual' ? (values.accrualRule.rate ?? 0) : null,
          frequency:
            mode === 'periodic_accrual' ? (values.accrualRule.frequency ?? 'monthly') : null,
          proRateFirstPeriod: !!values.accrualRule.proRateFirstPeriod,
          accrualCap: mode === 'none' ? null : (values.accrualRule.accrualCap ?? null),
          eligibleAfterDays: values.accrualRule.eligibleAfterDays || 0,
        };
        const payload: CreateLeaveTypePayload = {
          code: values.code.trim().toUpperCase(),
          labels,
          color: values.color,
          isPaid: values.isPaid,
          unit: values.unit,
          statutoryBasis: values.statutoryBasis,
          maxPerRequest: values.maxPerRequest ?? null,
          applicability: {
            gender: values.applicability?.gender ?? 'any',
            minTenureDays: values.applicability?.minTenureDays ?? null,
            designationIds: editing?.applicability.designationIds ?? [],
          },
          accrualRule,
          yearEndRule: {
            carryForwardCap: values.yearEndRule.carryForwardCap || 0,
            lapseExcess: !!values.yearEndRule.lapseExcess,
            encashable: !!values.yearEndRule.encashable,
            encashmentCap: values.yearEndRule.encashmentCap ?? null,
          },
          compOff: {
            isCompOff: !!values.compOff.isCompOff,
            validityDays: values.compOff.validityDays || 90,
          },
        };
        if (editing) {
          const { code: _code, ...patch } = payload;
          void _code;
          await leaveApi.updateType(wsId, editing._id, patch);
        } else {
          await leaveApi.createType(wsId, payload);
        }
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

  const confirmDeactivate = (lt: LeaveType) => {
    if (!wsId) return;
    modal.confirm({
      title: t('deactivateConfirm', { name: typeLabel(lt, locale) }),
      content: t('deactivateDesc'),
      okText: t('card.deactivate'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await leaveApi.deleteType(wsId, lt._id);
          message.success(t('deactivated'));
          await load();
        } catch (e) {
          message.error(parseApiError(e));
        }
      },
    });
  };

  const reactivate = async (lt: LeaveType) => {
    if (!wsId) return;
    try {
      await leaveApi.updateType(wsId, lt._id, { isActive: true });
      message.success(t('reactivated'));
      await load();
    } catch (e) {
      message.error(parseApiError(e));
    }
  };

  // ── Card rule-summary helpers ───────────────────────────────
  const accrualSummary = (lt: LeaveType): string => {
    const a = lt.accrualRule;
    if (a.mode === 'upfront_annual') {
      return t('card.accrualUpfront', { n: a.annualQuantity });
    }
    if (a.mode === 'periodic_accrual') {
      return t('card.accrualPeriodic', {
        rate: a.rate ?? 0,
        freq: t(`card.freq.${a.frequency ?? 'monthly'}`),
      });
    }
    return t('card.accrualNone');
  };

  const yearEndSummary = (lt: LeaveType): string => {
    const parts: string[] = [];
    const y = lt.yearEndRule;
    if (y.carryForwardCap > 0) parts.push(t('card.yearEndCarry', { n: y.carryForwardCap }));
    if (y.encashable) parts.push(t('card.yearEndEncash'));
    if (parts.length === 0 && y.lapseExcess) parts.push(t('card.yearEndLapse'));
    return parts.join(' · ');
  };

  const belowFloor = (lt: LeaveType): boolean => {
    const floor = STATUTORY_FLOORS[lt.statutoryBasis];
    if (floor == null) return false;
    return effectiveAnnualEntitlement(lt) < floor;
  };

  // ── Editor: live statutory floor advisory ───────────────────
  const editorFloor =
    statutoryBasis != null ? STATUTORY_FLOORS[statutoryBasis as LeaveStatutoryBasis] : null;
  const editorEntitlement = effectiveAnnualEntitlement({
    accrualRule: {
      mode: (accrualMode ?? 'none') as LeaveAccrualMode,
      annualQuantity: watchAnnual ?? 0,
      rate: watchRate ?? null,
      frequency: watchFreq ?? null,
    },
    maxPerRequest: watchMax ?? null,
  });
  // Gate the advisory so a fresh "create" opened right after editing a type
  // does not flash the warning for one frame off the prior edit's stale watch
  // values: on create require a field touch first; on edit show immediately
  // (an existing below-floor type must surface its advisory on open).
  const editorBelowFloor =
    editorOpen &&
    editorFloor != null &&
    editorEntitlement < editorFloor &&
    (editing != null || form.isFieldsTouched());

  // RBAC defense-in-depth (ADR-001 Tier 2): in-page gate layered on top of
  // the central ROUTE_PERMISSIONS guard. Owners short-circuit inside `can`.
  if (permissionsLoading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <Skeleton active paragraph={{ rows: 3 }} />
            </Card>
          ))}
        </div>
      </div>
    );
  }
  if (!canPath('leave.type.manage')) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Card>
          <DsEmptyState title={t('accessDenied.title')} sub={t('accessDenied.message')} />
        </Card>
      </div>
    );
  }

  return (
    <FeatureGate module="leave" subFeature="configure" as="h1">
      <div className="mx-auto max-w-6xl p-6">
        <DsPageHeader
          title={t('title')}
          sub={t('subtitle')}
          icon={<CalendarOutlined />}
          right={
            visibleTypes.length > 0 ? (
              <DsButton dsVariant="primary" data-shortcut="new-leave-type" onClick={openCreate}>
                <PlusOutlined /> {t('newType')}
              </DsButton>
            ) : undefined
          }
        />

        {!loading && !loadError && inactiveCount > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <Switch
              size="small"
              checked={showInactive}
              onChange={setShowInactive}
              id="leave-show-inactive"
            />
            <label htmlFor="leave-show-inactive" className="text-[13px] text-muted">
              {t('showInactive', { n: inactiveCount })}
            </label>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <Skeleton active paragraph={{ rows: 3 }} />
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
        ) : visibleTypes.length === 0 ? (
          <Card>
            <DsEmptyState
              title={t('emptyTitle')}
              sub={t('emptySub')}
              action={
                <DsButton dsVariant="primary" onClick={openCreate}>
                  <PlusOutlined /> {t('newType')}
                </DsButton>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleTypes.map((lt) => (
              <Card
                key={lt._id}
                styles={{ body: { padding: 16 } }}
                className={lt.isActive ? undefined : 'opacity-70'}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ background: lt.color }}
                    />
                    <h2 className="m-0 truncate font-display text-[15px] font-bold text-heading">
                      {typeLabel(lt, locale)}
                    </h2>
                  </div>
                  <Tag className="m-0 font-mono">{lt.code}</Tag>
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  <Tag color={lt.isPaid ? 'green' : 'orange'} className="m-0">
                    {lt.isPaid ? t('card.paid') : t('card.unpaid')}
                  </Tag>
                  {lt.compOff.isCompOff && (
                    <Tag color="purple" className="m-0">
                      {t('card.compOff')}
                    </Tag>
                  )}
                  {lt.isSystem && (
                    <Tag color="default" className="m-0">
                      {t('card.system')}
                    </Tag>
                  )}
                  {!lt.isActive && (
                    <Tag color="red" className="m-0">
                      {t('card.inactive')}
                    </Tag>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-1 text-[13px] text-muted">
                  <div>
                    <span className="inline-flex items-center gap-1 font-semibold text-heading">
                      {t('card.accrualLabel')}
                      <InfoTooltip
                        text={t('infoTip.accrual.title')}
                        body={t('infoTip.accrual.body')}
                      />
                    </span>{' '}
                    - {accrualSummary(lt)}
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 font-semibold text-heading">
                      {t('card.statutoryLabel')}
                      <InfoTooltip
                        text={t('infoTip.statutory.title')}
                        body={t('infoTip.statutory.body')}
                      />
                    </span>{' '}
                    - {t(`card.basis.${lt.statutoryBasis}`)}
                  </div>
                  {yearEndSummary(lt) && (
                    <div>
                      <span className="inline-flex items-center gap-1 font-semibold text-heading">
                        {t('card.yearEndLabel')}
                        <InfoTooltip
                          text={t('infoTip.yearEnd.title')}
                          body={t('infoTip.yearEnd.body')}
                        />
                      </span>{' '}
                      - {yearEndSummary(lt)}
                    </div>
                  )}
                  {belowFloor(lt) && (
                    <div
                      className="flex items-center gap-1 text-[12px]"
                      style={{ color: 'var(--cr-warning-700)' }}
                    >
                      <WarningOutlined /> {t('card.floorWarn')}
                    </div>
                  )}
                </div>

                <div
                  className="mt-4 flex items-center justify-between border-0 border-t border-solid pt-3"
                  style={{ borderColor: 'var(--cr-border-light)' }}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEdit(lt)}
                  >
                    {t('card.edit')}
                  </Button>
                  {lt.isActive ? (
                    <Tooltip title={lt.isSystem ? t('card.systemTip') : undefined}>
                      <Button
                        type="text"
                        size="small"
                        danger
                        disabled={lt.isSystem}
                        icon={<StopOutlined />}
                        onClick={() => confirmDeactivate(lt)}
                      >
                        {t('card.deactivate')}
                      </Button>
                    </Tooltip>
                  ) : (
                    <Button
                      type="link"
                      size="small"
                      icon={<UndoOutlined />}
                      onClick={() => reactivate(lt)}
                    >
                      {t('card.reactivate')}
                    </Button>
                  )}
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
          size={560}
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
            {systemLocked && (
              <Alert
                type="info"
                showIcon
                className="!mb-5"
                title={t('editor.systemLockedNotice')}
              />
            )}

            {/* Identity */}
            <section className="mb-6">
              <h3 className="m-0 font-display text-[14px] font-bold text-heading">
                {t('editor.sectionIdentity')}
              </h3>
              <p className="mt-0.5 mb-3 text-[12px] text-subtle">
                {t('editor.sectionIdentityHint')}
              </p>
              <Form.Item
                name="code"
                label={t('editor.codeLabel')}
                tooltip={t('editor.codeHint')}
                rules={[
                  { required: true, message: t('editor.codeRequired') },
                  {
                    pattern: /^[A-Za-z][A-Za-z0-9_]{1,11}$/,
                    message: t('editor.codePattern'),
                  },
                ]}
              >
                <Input
                  size="large"
                  placeholder={t('editor.codePlaceholder')}
                  disabled={!!editing}
                  style={{ textTransform: 'uppercase' }}
                />
              </Form.Item>
              <Form.Item
                name={['labels', 'en']}
                label={t('editor.labelEn')}
                rules={[{ required: true, whitespace: true, message: t('editor.labelEnRequired') }]}
              >
                <Input size="large" placeholder={t('editor.labelEnPlaceholder')} />
              </Form.Item>
              <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
                <Form.Item name={['labels', 'gu-en']} label={t('editor.labelGuEn')}>
                  <Input placeholder={t('editor.localePlaceholder')} />
                </Form.Item>
                <Form.Item name={['labels', 'hi-en']} label={t('editor.labelHiEn')}>
                  <Input placeholder={t('editor.localePlaceholder')} />
                </Form.Item>
                <Form.Item name={['labels', 'gu']} label={t('editor.labelGu')}>
                  <Input placeholder={t('editor.localePlaceholder')} />
                </Form.Item>
              </div>
              <p className="mt-0 mb-3 text-[12px] text-subtle">{t('editor.localeHint')}</p>
              <Form.Item
                name="color"
                label={t('editor.colorLabel')}
                getValueFromEvent={(_color, css: string) => css}
                className="!mb-0"
              >
                <ColorPicker format="hex" disabledAlpha />
              </Form.Item>
            </section>

            {/* Behaviour */}
            <section className="mb-6">
              <h3 className="m-0 font-display text-[14px] font-bold text-heading">
                {t('editor.sectionBehaviour')}
              </h3>
              <p className="mt-0.5 mb-3 text-[12px] text-subtle">
                {t('editor.sectionBehaviourHint')}
              </p>
              <Form.Item name="isPaid" valuePropName="checked" className="!mb-3">
                <ToggleRow
                  title={t('editor.isPaidLabel')}
                  hint={t('editor.isPaidHint')}
                  disabled={systemLocked}
                />
              </Form.Item>
              <Form.Item name="unit" label={t('editor.unitLabel')} tooltip={t('editor.unitHint')}>
                <Select
                  size="large"
                  disabled={systemLocked}
                  options={[
                    { value: 'half_day_capable', label: t('editor.unitHalf') },
                    { value: 'full_day', label: t('editor.unitFull') },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="maxPerRequest"
                label={t('editor.maxPerRequestLabel')}
                tooltip={t('editor.maxPerRequestHint')}
                className="!mb-0"
              >
                <InputNumber
                  min={0}
                  max={366}
                  className="w-full"
                  size="large"
                  disabled={systemLocked}
                  placeholder={t('editor.unbounded')}
                />
              </Form.Item>
            </section>

            {/* Statutory */}
            <section className="mb-6">
              <h3 className="m-0 font-display text-[14px] font-bold text-heading">
                {t('editor.sectionStatutory')}
              </h3>
              <p className="mt-0.5 mb-3 text-[12px] text-subtle">
                {t('editor.sectionStatutoryHint')}
              </p>
              <Form.Item
                name="statutoryBasis"
                label={t('editor.statutoryBasisLabel')}
                className={editorBelowFloor ? '!mb-3' : '!mb-0'}
              >
                <Select
                  size="large"
                  disabled={systemLocked}
                  options={(
                    ['factories_act', 'shops_act', 'maternity_act', 'voluntary'] as const
                  ).map((b) => ({ value: b, label: t(`editor.basis.${b}`) }))}
                />
              </Form.Item>
              {editorBelowFloor && (
                <Alert
                  type="warning"
                  showIcon
                  title={t('editor.floorAlert', {
                    entitlement: editorEntitlement,
                    floor: editorFloor ?? 0,
                    basis: t(`editor.basis.${statutoryBasis as LeaveStatutoryBasis}`),
                  })}
                />
              )}
            </section>

            {/* Accrual */}
            <section className="mb-6">
              <h3 className="m-0 font-display text-[14px] font-bold text-heading">
                {t('editor.sectionAccrual')}
              </h3>
              <p className="mt-0.5 mb-3 text-[12px] text-subtle">
                {t('editor.sectionAccrualHint')}
              </p>
              <Form.Item name={['accrualRule', 'mode']} label={t('editor.accrualModeLabel')}>
                <Segmented
                  block
                  disabled={systemLocked}
                  options={[
                    { value: 'none', label: t('editor.mode.none') },
                    { value: 'upfront_annual', label: t('editor.mode.upfront_annual') },
                    { value: 'periodic_accrual', label: t('editor.mode.periodic_accrual') },
                  ]}
                />
              </Form.Item>

              {accrualMode === 'upfront_annual' && (
                <Form.Item
                  name={['accrualRule', 'annualQuantity']}
                  label={t('editor.annualQuantityLabel')}
                  tooltip={t('editor.annualQuantityHint')}
                  rules={[{ type: 'number', min: 0, message: t('editor.nonNegative') }]}
                >
                  <InputNumber min={0} max={366} step={0.5} className="w-full" size="large" />
                </Form.Item>
              )}

              {accrualMode === 'periodic_accrual' && (
                <div className="grid grid-cols-2 gap-x-3">
                  <Form.Item
                    name={['accrualRule', 'rate']}
                    label={t('editor.rateLabel')}
                    tooltip={t('editor.rateHint')}
                    rules={[{ type: 'number', min: 0, message: t('editor.nonNegative') }]}
                  >
                    <InputNumber min={0} max={366} step={0.5} className="w-full" size="large" />
                  </Form.Item>
                  <Form.Item name={['accrualRule', 'frequency']} label={t('editor.frequencyLabel')}>
                    <Select
                      size="large"
                      options={[
                        { value: 'monthly', label: t('card.freq.monthly') },
                        { value: 'quarterly', label: t('card.freq.quarterly') },
                        { value: 'annual', label: t('card.freq.annual') },
                      ]}
                    />
                  </Form.Item>
                </div>
              )}

              {accrualMode !== 'none' && (
                <>
                  <Form.Item
                    name={['accrualRule', 'proRateFirstPeriod']}
                    valuePropName="checked"
                    className="!mb-3"
                  >
                    <ToggleRow
                      title={t('editor.proRateLabel')}
                      hint={t('editor.proRateHint')}
                      disabled={systemLocked}
                    />
                  </Form.Item>
                  <div className="grid grid-cols-2 gap-x-3">
                    <Form.Item
                      name={['accrualRule', 'accrualCap']}
                      label={t('editor.accrualCapLabel')}
                      tooltip={t('editor.accrualCapHint')}
                    >
                      <InputNumber
                        min={0}
                        max={999}
                        className="w-full"
                        size="large"
                        disabled={systemLocked}
                        placeholder={t('editor.unbounded')}
                      />
                    </Form.Item>
                    <Form.Item
                      name={['accrualRule', 'eligibleAfterDays']}
                      label={t('editor.eligibleAfterLabel')}
                      tooltip={t('editor.eligibleAfterHint')}
                      rules={[{ type: 'number', min: 0, message: t('editor.nonNegative') }]}
                    >
                      <InputNumber
                        min={0}
                        max={3650}
                        className="w-full"
                        size="large"
                        disabled={systemLocked}
                      />
                    </Form.Item>
                  </div>
                </>
              )}
            </section>

            {/* Year-end */}
            <section className="mb-6">
              <h3 className="m-0 font-display text-[14px] font-bold text-heading">
                {t('editor.sectionYearEnd')}
              </h3>
              <p className="mt-0.5 mb-3 text-[12px] text-subtle">
                {t('editor.sectionYearEndHint')}
              </p>
              <Form.Item
                name={['yearEndRule', 'carryForwardCap']}
                label={t('editor.carryForwardCapLabel')}
                tooltip={t('editor.carryForwardHint')}
                rules={[{ type: 'number', min: 0, message: t('editor.nonNegative') }]}
              >
                <InputNumber
                  min={0}
                  max={999}
                  className="w-full"
                  size="large"
                  disabled={systemLocked}
                />
              </Form.Item>
              <Form.Item
                name={['yearEndRule', 'lapseExcess']}
                valuePropName="checked"
                className="!mb-3"
              >
                <ToggleRow
                  title={t('editor.lapseExcessLabel')}
                  hint={t('editor.lapseExcessHint')}
                  disabled={systemLocked}
                />
              </Form.Item>
              <Form.Item
                name={['yearEndRule', 'encashable']}
                valuePropName="checked"
                className="!mb-3"
              >
                <ToggleRow
                  title={t('editor.encashableLabel')}
                  hint={t('editor.encashableHint')}
                  disabled={systemLocked}
                />
              </Form.Item>
              <Form.Item
                name={['yearEndRule', 'encashmentCap']}
                label={t('editor.encashmentCapLabel')}
                tooltip={t('editor.encashmentCapHint')}
                className="!mb-0"
              >
                <InputNumber
                  min={0}
                  max={999}
                  className="w-full"
                  size="large"
                  disabled={systemLocked}
                  placeholder={t('editor.unbounded')}
                />
              </Form.Item>
            </section>

            {/* Comp-off */}
            <section className="mb-6">
              <h3 className="m-0 font-display text-[14px] font-bold text-heading">
                {t('editor.sectionCompOff')}
              </h3>
              <p className="mt-0.5 mb-3 text-[12px] text-subtle">
                {t('editor.sectionCompOffHint')}
              </p>
              <Form.Item name={['compOff', 'isCompOff']} valuePropName="checked" className="!mb-3">
                <ToggleRow
                  title={t('editor.isCompOffLabel')}
                  hint={t('editor.isCompOffHint')}
                  disabled={systemLocked}
                />
              </Form.Item>
              {isCompOff && (
                <Form.Item
                  name={['compOff', 'validityDays']}
                  label={t('editor.validityDaysLabel')}
                  tooltip={t('editor.validityDaysHint')}
                  rules={[{ type: 'number', min: 1, message: t('editor.atLeastOne') }]}
                  className="!mb-0"
                >
                  <InputNumber
                    min={1}
                    max={730}
                    className="w-full"
                    size="large"
                    disabled={systemLocked}
                  />
                </Form.Item>
              )}
            </section>

            {/* Applicability */}
            <section>
              <h3 className="m-0 font-display text-[14px] font-bold text-heading">
                {t('editor.sectionApplicability')}
              </h3>
              <p className="mt-0.5 mb-3 text-[12px] text-subtle">
                {t('editor.sectionApplicabilityHint')}
              </p>
              <Form.Item
                name={['applicability', 'gender']}
                label={t('editor.genderLabel')}
                tooltip={t('editor.genderHint')}
              >
                <Select
                  size="large"
                  disabled={systemLocked}
                  options={[
                    { value: 'any', label: t('editor.gender.any') },
                    { value: 'male', label: t('editor.gender.male') },
                    { value: 'female', label: t('editor.gender.female') },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name={['applicability', 'minTenureDays']}
                label={t('editor.minTenureLabel')}
                tooltip={t('editor.minTenureHint')}
                className="!mb-0"
              >
                <InputNumber
                  min={0}
                  max={36500}
                  className="w-full"
                  size="large"
                  disabled={systemLocked}
                  placeholder={t('editor.noMinTenure')}
                />
              </Form.Item>
            </section>
          </Form>
        </Drawer>
      </div>
    </FeatureGate>
  );
}
