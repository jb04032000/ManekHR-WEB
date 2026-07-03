'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Skeleton,
  Switch,
  Tag,
  TimePicker,
  Tooltip,
} from 'antd';
import {
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { listShifts, createShift, updateShift, deleteShift } from '@/lib/actions';
import { attendancePoliciesApi } from '@/lib/api/modules/attendance-policies.api';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import {
  DsDrawer,
  DsEmptyState,
  DsPageHeader,
  HeaderRightActions,
  STATUS_COLORS,
} from '@/components/ui';
import type { Shift, CreateShiftPayload, AttendancePolicy } from '@/types';

type ShiftType = Shift['shiftType'];
type TypeFilter = 'all' | ShiftType;

/**
 * Map a shift `shiftType` onto a key in the shared `STATUS_COLORS` palette so
 * the type tag uses CR design tokens. Per-shift `color` / `colorBg` from the
 * schema still drives the time chip (workspace admin's chosen accent); the
 * tone fallback only kicks in when the schema fields are absent.
 */
const TYPE_TONE: Record<ShiftType, string> = {
  fixed: 'active', // success-tier - the "default" shift pattern
  flexi: 'holiday', // info-tier
  split: 'warning',
  break: 'cancelled', // neutral
};

const TYPE_FILTER_OPTIONS: readonly TypeFilter[] = [
  'all',
  'fixed',
  'flexi',
  'split',
  'break',
] as const;

/**
 * Stable display order for the per-type sections - fixed first (most common),
 * then flexi, split, break. Mirrors the chip order so the page reads top to
 * bottom in the same order users scan the filter row.
 */
const TYPE_SECTION_ORDER: readonly ShiftType[] = ['fixed', 'flexi', 'split', 'break'] as const;

/**
 * Working-days palette used inside the create / edit drawer.
 * The shape mirrors the legacy SHIFT_COLORS array - kept verbatim so existing
 * shift documents with one of these values continue to render with a checked
 * swatch on edit. Adding here would require a BE migration to honour it.
 */
const SHIFT_COLORS = [
  { color: 'var(--cr-info-700)', bg: 'var(--cr-info-50)' },
  { color: 'var(--cr-warning-500)', bg: 'var(--cr-warning-50)' },
  { color: 'var(--cr-indigo-400)', bg: 'var(--cr-indigo-50)' },
  { color: 'var(--cr-success-500)', bg: 'var(--cr-success-50)' },
  { color: 'var(--cr-danger-500)', bg: 'var(--cr-danger-50)' },
  { color: 'var(--cr-primary-hover)', bg: 'var(--cr-indigo-50)' },
];

const DAYS = [
  { value: 0, key: 'sun' },
  { value: 1, key: 'mon' },
  { value: 2, key: 'tue' },
  { value: 3, key: 'wed' },
  { value: 4, key: 'thu' },
  { value: 5, key: 'fri' },
  { value: 6, key: 'sat' },
] as const;

/** Format an array of 0-6 weekday indexes as a compact summary string like
 *  "Mon-Sat" or "Mon, Wed, Fri". Pure formatter - the keys themselves are
 *  resolved via i18n at render. */
function formatWorkingDays(
  days: number[],
  dayLabel: (key: (typeof DAYS)[number]['key']) => string,
  joiner: string,
): string {
  if (!Array.isArray(days) || days.length === 0) return '';
  const sorted = [...days].sort((a, b) => a - b);
  // Detect a contiguous run so "Mon Tue Wed Thu Fri Sat" collapses to "Mon-Sat".
  const isContiguous =
    sorted.length >= 3 && sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (isContiguous) {
    const firstKey = DAYS[sorted[0]]?.key ?? 'mon';
    const lastKey = DAYS[sorted[sorted.length - 1]]?.key ?? 'sun';
    return `${dayLabel(firstKey)}-${dayLabel(lastKey)}`;
  }
  return sorted.map((d) => dayLabel(DAYS[d]?.key ?? 'mon')).join(joiner);
}

export default function ShiftsPage() {
  const t = useTranslations('shifts');
  const { message } = App.useApp();
  const { currentWorkspaceId: wsId } = useWorkspaceStore();
  const { canPath, data: myPerms, loading: permsLoading } = useMyPermissions();

  // FE mirrors the BE permission spine (S1). Shifts are workspace-global so
  // the leaves carry no self/all meaning - the spine is binary: view (any
  // member) vs create/edit (manager+) vs delete (owner/admin only). The owner
  // bypass is built into useMyPermissions (isOwner short-circuits canPath to
  // true), so an owner sees every control without an explicit grant.
  const canView = !!myPerms?.isOwner || canPath('shifts.catalog.view');
  const canCreate = !!myPerms?.isOwner || canPath('shifts.catalog.create');
  const canEdit = !!myPerms?.isOwner || canPath('shifts.catalog.edit');
  const canDelete = !!myPerms?.isOwner || canPath('shifts.catalog.delete');

  // Subscription gate (dynamic plans): the Shifts module / sub-features can
  // be plan-locked. When locked the reads 403 - show the upgrade prompt
  // instead of firing doomed calls that surface as a generic load error.
  // Mirrors Holiday. Create / edit / delete are also each plan-gated
  // sub-features.
  const { isLocked: moduleLocked, isLoading: accessLoading } = useFeatureAccess('shifts');
  const { isLocked: createLocked } = useFeatureAccess('shifts', 'create_shift');
  const { isLocked: editLocked } = useFeatureAccess('shifts', 'edit_shift');
  const { isLocked: deleteLocked } = useFeatureAccess('shifts', 'delete_shift');

  // A control needs BOTH the RBAC grant AND the subscription sub-feature.
  const showAdd = canCreate && !createLocked;
  const showEdit = canEdit && !editLocked;
  const showDelete = canDelete && !deleteLocked;

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [policies, setPolicies] = useState<AttendancePolicy[]>([]);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [selectedColor, setSelectedColor] = useState(SHIFT_COLORS[0].color);
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const watchedShiftType = Form.useWatch('shiftType', form) as ShiftType | undefined;

  // Filter state - shift-type chips only (no recurring toggle; shifts have
  // no recurring concept). Type chips compose as a single-select set.
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const load = useCallback(async () => {
    if (!wsId) return;
    try {
      const res = await listShifts(wsId);
      setShifts(res);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  // Mount + workspace-change fetch. Skip while subscription access is
  // resolving or when the module is plan-locked (upgrade prompt renders
  // instead of doomed 403 reads), and skip when the member lacks the view
  // grant (no-access state renders instead). Deferred through a microtask to
  // stay outside the synchronous effect body (set-state-in-effect rule).
  useEffect(() => {
    if (accessLoading || moduleLocked || permsLoading) return;
    queueMicrotask(() => {
      if (!canView) {
        setLoading(false);
        return;
      }
      void load();
    });
  }, [load, accessLoading, moduleLocked, permsLoading, canView]);

  // Attendance policies for the shift -> policy selector. setState lives only
  // inside promise callbacks - no react-hooks/set-state-in-effect disable.
  useEffect(() => {
    if (!wsId || moduleLocked || accessLoading || !canView) return;
    attendancePoliciesApi
      .list(wsId)
      .then(setPolicies)
      .catch(() => setPolicies([]));
  }, [wsId, moduleLocked, accessLoading, canView]);

  const typeOptions = useMemo(
    () => [
      { value: 'fixed', label: t('type.fixed'), hint: t('typeHint.fixed') },
      { value: 'flexi', label: t('type.flexi'), hint: t('typeHint.flexi') },
      { value: 'split', label: t('type.split'), hint: t('typeHint.split') },
      { value: 'break', label: t('type.break'), hint: t('typeHint.break') },
    ],
    [t],
  );

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ shiftType: 'fixed' });
    setSelectedColor(SHIFT_COLORS[0].color);
    setWorkingDays([1, 2, 3, 4, 5, 6]);
    setDrawerOpen(true);
  };

  const openEdit = (s: Shift) => {
    setEditing(s);
    form.setFieldsValue({
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      isDefault: s.isDefault,
      shiftType: s.shiftType ?? 'fixed',
      gracePeriodMinutes: s.gracePeriodMinutes ?? 0,
      halfDayAfterLateMinutes: s.halfDayAfterLateMinutes ?? 60,
      requiredHoursPerDay: s.requiredHoursPerDay ?? undefined,
      policyId: s.policyId ?? undefined,
    });
    setSelectedColor(s.color ?? SHIFT_COLORS[0].color);
    setWorkingDays(Array.isArray(s.workingDays) ? s.workingDays : [1, 2, 3, 4, 5, 6]);
    setDrawerOpen(true);
  };

  const toggleDay = (day: number) => {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSave = async (
    vals: Omit<CreateShiftPayload, 'color' | 'colorBg' | 'workingDays'>,
  ) => {
    if (!wsId) return;
    setSaving(true);
    const colorPair = SHIFT_COLORS.find((c) => c.color === selectedColor) ?? SHIFT_COLORS[0];
    const payload: CreateShiftPayload = {
      ...vals,
      workingDays,
      color: colorPair.color,
      colorBg: colorPair.bg,
      // antd Select clears to `undefined`; send `null` so the BE actually
      // unsets the policy link instead of leaving it unchanged.
      policyId: vals.policyId ?? null,
    };
    try {
      if (editing) {
        await updateShift(wsId, editing._id, payload);
        message.success(t('updated'));
      } else {
        await createShift(wsId, payload);
        message.success(t('created'));
      }
      setDrawerOpen(false);
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!wsId) return;
    try {
      await deleteShift(wsId, id);
      message.success(t('deleted'));
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('deleteFailed'));
    }
  };

  // -- Derived data --------------------------------------------------------

  // Sort the full list once alphabetically; downstream slices stay stable.
  const sortedShifts = useMemo(
    () =>
      [...shifts].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [shifts],
  );

  // Default shift across the FULL loaded set so the summary line stays
  // accurate regardless of the active filter.
  const defaultShift = useMemo(() => sortedShifts.find((s) => s.isDefault), [sortedShifts]);

  const filteredShifts = useMemo(
    () =>
      sortedShifts.filter((s) => {
        if (typeFilter !== 'all') {
          const type = (s.shiftType ?? 'fixed') as ShiftType;
          if (type !== typeFilter) return false;
        }
        return true;
      }),
    [sortedShifts, typeFilter],
  );

  // Per-type counts on the FULL set (chip counters; the active filter does
  // not narrow these so users can see what each chip would reveal).
  const typeCounts = useMemo(() => {
    const counts: Record<TypeFilter, number> = {
      all: sortedShifts.length,
      fixed: 0,
      flexi: 0,
      split: 0,
      break: 0,
    };
    sortedShifts.forEach((s) => {
      const type = (s.shiftType ?? 'fixed') as ShiftType;
      counts[type] += 1;
    });
    return counts;
  }, [sortedShifts]);

  // Type-grouped slice within the active filter. Rows within a group are
  // already alphabetical via sortedShifts. Group order is the canonical
  // TYPE_SECTION_ORDER so fixed is always on top (the dominant pattern in
  // practice).
  const typeGroups = useMemo(() => {
    const map = new Map<ShiftType, Shift[]>();
    filteredShifts.forEach((s) => {
      const type = (s.shiftType ?? 'fixed') as ShiftType;
      const arr = map.get(type) ?? [];
      arr.push(s);
      map.set(type, arr);
    });
    return TYPE_SECTION_ORDER.map((type) => [type, map.get(type) ?? []] as const).filter(
      ([, items]) => items.length > 0,
    );
  }, [filteredShifts]);

  const filtersActive = typeFilter !== 'all';

  const dayLabel = useCallback(
    (key: (typeof DAYS)[number]['key']) => t(`day.${key}` as const),
    [t],
  );

  // -- Plan-locked (subscription) - upgrade prompt, never the load error.
  // FeatureGate with no children renders the UpgradePrompt when locked.
  // Guarded by !accessLoading so it never flashes mid-resolve.
  if (moduleLocked && !accessLoading) {
    return <FeatureGate module="shifts" as="h1" />;
  }

  // -- Permissions / access still resolving. Structural skeleton mirrors the
  // rendered layout (header + summary line + filter chips + type-grouped row
  // card) so the loading state never collapses to a generic blob.
  if (loading || accessLoading || permsLoading) {
    return (
      <div className="w-full max-w-5xl" aria-busy="true">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex flex-1 items-start gap-3">
            <Skeleton.Avatar active shape="square" size={40} />
            <div className="min-w-0 flex-1">
              <Skeleton.Input active size="default" style={{ width: 200 }} />
              <div className="mt-2">
                <Skeleton.Input active size="small" style={{ width: 360 }} />
              </div>
            </div>
          </div>
          <Skeleton.Button active size="large" style={{ width: 130 }} />
        </div>
        {/* Summary line */}
        <div className="mb-3">
          <Skeleton.Input active size="small" style={{ width: 280 }} />
        </div>
        {/* Filter chips */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {[60, 80, 70, 70, 80].map((w, i) => (
            <Skeleton.Button key={i} active size="small" shape="round" style={{ width: w }} />
          ))}
        </div>
        {/* List card with type-grouped row placeholders */}
        <Card styles={{ body: { padding: '4px 0' } }}>
          {[0, 1].map((groupIdx) => (
            <div key={groupIdx} className={groupIdx === 0 ? '' : 'mt-2'}>
              <div className="px-4 py-2">
                <Skeleton.Input active size="small" style={{ width: 110 }} />
              </div>
              {[0, 1].map((rowIdx) => (
                <div key={rowIdx} className="flex items-center gap-3 px-4 py-2.5">
                  <Skeleton.Avatar active shape="square" size={48} />
                  <div className="min-w-0 flex-1">
                    <Skeleton.Input active size="small" style={{ width: 180 }} />
                    <div className="mt-1">
                      <Skeleton.Input active size="small" style={{ width: 100 }} />
                    </div>
                  </div>
                  <Skeleton.Button active size="small" shape="circle" />
                  <Skeleton.Button active size="small" shape="circle" />
                </div>
              ))}
            </div>
          ))}
        </Card>
      </div>
    );
  }

  // -- No view grant - friendly no-access state, never a blank crash.
  if (!canView) {
    return (
      <div className="w-full">
        <DsPageHeader title={t('title')} sub={t('subtitle')} icon={<ClockCircleOutlined />} />
        <Card>
          <DsEmptyState icon="🔒" title={t('accessDenied.title')} sub={t('accessDenied.message')} />
        </Card>
      </div>
    );
  }

  // -- Load error - retry.
  if (loadError) {
    return (
      <div className="w-full">
        <DsPageHeader title={t('title')} sub={t('subtitle')} icon={<ClockCircleOutlined />} />
        <Card>
          <DsEmptyState
            title={t('loadError')}
            action={
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
              >
                {t('retry')}
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  // -- Summary line: count + (optional) default name. Hides "Default" segment
  // when no shift is marked default. Resolves to copy like:
  //   "5 shifts configured . Default: Day Shift"
  // (uses a mid-dot separator, not an em-dash). When the catalog is empty the
  // summary collapses to just the count.
  const summaryCount = t('summary.count', { count: sortedShifts.length });
  const summaryDefault = defaultShift
    ? t('summary.defaultInline', { name: defaultShift.name })
    : '';

  const defaultShiftId = defaultShift?.id ?? defaultShift?._id;

  return (
    <FeatureGate module="shifts" as="h1">
      {/* Constrain the admin list to a focused max-width so short rows
          (time-chip + name + actions) do not have to span 1400px. The
          platform Content wrapper caps overall content at 1400px; this
          narrows further to 1024px and centres so the actions sit close to
          the content instead of pinned to a far-right edge. */}
      <div className="w-full max-w-5xl">
        <DsPageHeader
          title={t('title')}
          sub={t('subtitle')}
          icon={<ClockCircleOutlined />}
          // Shifts deviation from the Holiday template - the catalog is
          // unbounded by date (a workspace can have any number of named
          // shifts; none have a calendar period). The titleAside is left
          // empty so the header reads cleanly without a fake period
          // navigator. Documented in MODULE-ADMIN-PAGE-TEMPLATE.md under
          // "Per-module adaptations".
          right={
            <HeaderRightActions
              module="shifts"
              moduleLabel={t('title')}
              // The dashboard breadcrumb already renders the global atoms
              // (shortcuts, plan features, feedback) for every page; the
              // page-header version was a duplicate. Shifts has no
              // dedicated user guide, so suppress that atom too. The right
              // slot keeps only the single primary action (Add Shift).
              hide={{ plan: true, guide: true, shortcuts: true, feedback: true }}
              extras={
                showAdd ? (
                  <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                    {t('addButton')}
                  </Button>
                ) : null
              }
            />
          }
        />

        {/* -- Summary line: natural-language prose sitting above the chips.
            Replaces the previous floating widgets with a single muted line.
            Hides the "Default" segment when no shift is marked default. */}
        <p className="mb-3 text-[12px] text-subtle" aria-live="polite">
          <span>{summaryCount}</span>
          {summaryDefault ? (
            <>
              <span aria-hidden className="mx-1.5">
                ·
              </span>
              <span>{summaryDefault}</span>
            </>
          ) : null}
        </p>

        {/* -- Filter chips: type only (shifts have no recurring concept) ----
            cr-filter-chip is the canonical Team v2 token. Counts reflect the
            full catalog so users see what each chip would reveal even when
            the active filter narrows the list. */}
        <div
          role="group"
          aria-label={t('filter.aria')}
          className="mb-4 flex flex-wrap items-center gap-1.5"
        >
          {TYPE_FILTER_OPTIONS.map((key) => {
            const active = typeFilter === key;
            const label = key === 'all' ? t('filter.all') : t(`type.${key}` as const);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTypeFilter(key)}
                aria-pressed={active}
                className={`cr-filter-chip ${active ? 'cr-filter-chip--active' : ''}`}
              >
                <span>{label}</span>
                <span className="cr-filter-chip__count tabular-nums">{typeCounts[key]}</span>
              </button>
            );
          })}
        </div>

        {/* -- List / empty state ------------------------------------------ */}
        {filteredShifts.length === 0 ? (
          <Card>
            <DsEmptyState
              icon="⏰"
              title={filtersActive ? t('empty.filtered.title') : t('empty.title')}
              sub={filtersActive ? t('empty.filtered.sub') : t('empty.subtitle')}
              action={
                filtersActive ? (
                  <Button onClick={() => setTypeFilter('all')}>{t('filter.clear')}</Button>
                ) : showAdd ? (
                  <Button type="primary" onClick={openAdd}>
                    {t('empty.action')}
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <Card styles={{ body: { padding: '4px 0' } }}>
            {typeGroups.map(([type, items], groupIdx) => {
              const typeTone = STATUS_COLORS[TYPE_TONE[type]];
              return (
                <section
                  key={type}
                  aria-label={t('typeAria', { type: t(`type.${type}` as const) })}
                  className={groupIdx === 0 ? '' : 'mt-2'}
                >
                  {/* Lighter type grouping: plain bold header + count, no
                      sticky, no backdrop-blur, no card-per-group. */}
                  <div className="flex items-baseline justify-between px-4 py-2">
                    <h3 className="m-0 font-display text-[14px] font-bold text-heading">
                      {t(`type.${type}` as const)}
                      <span className="ml-1.5 text-subtle tabular-nums">({items.length})</span>
                    </h3>
                  </div>
                  {/* Flat list: each shift is a plain row. No Collapse, no
                      expand toggling, no overflow Dropdown. Actions render
                      inline at every breakpoint (Edit + Delete icon
                      buttons). */}
                  <div role="list">
                    {items.map((shift) => {
                      const isDefault = !!shift.isDefault;
                      const shiftId = shift.id ?? shift._id;
                      const isDefaultRow = !!defaultShiftId && shiftId === defaultShiftId;
                      const accent = shift.color ?? typeTone?.dot ?? 'var(--cr-neutral-300)';
                      const accentBg = shift.colorBg ?? typeTone?.bg ?? 'var(--cr-surface-2)';
                      const hasRequiredHours =
                        typeof shift.requiredHoursPerDay === 'number' &&
                        shift.requiredHoursPerDay > 0;
                      const daysSummary = formatWorkingDays(
                        shift.workingDays ?? [],
                        dayLabel,
                        ', ',
                      );

                      return (
                        <div
                          key={shiftId}
                          role="listitem"
                          className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--cr-surface-2)] ${isDefaultRow ? 'bg-[color-mix(in_srgb,var(--cr-primary)_4%,transparent)]' : ''}`}
                          style={{ borderLeft: `3px solid ${accent}` }}
                        >
                          {/* Time-range chip (start - end) */}
                          <div
                            aria-hidden
                            className="flex h-10 w-[88px] flex-shrink-0 flex-col items-center justify-center rounded-lg font-display"
                            style={{
                              background: accentBg,
                              color: accent,
                              border: `1px solid ${accent}`,
                            }}
                          >
                            <span className="text-[11px] leading-none font-bold tabular-nums">
                              {shift.startTime || '--:--'}
                            </span>
                            <span className="mt-0.5 text-[9px] font-medium tracking-wide uppercase opacity-80">
                              {t('toLabel')} {shift.endTime || '--:--'}
                            </span>
                          </div>

                          {/* Name + badges + (optional) days / hours line */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate font-display text-[14px] font-bold text-heading">
                                {shift.name}
                              </span>
                              {isDefault && (
                                <Tag
                                  color="processing"
                                  style={{ fontSize: 10, margin: 0 }}
                                  aria-label={t('defaultBadgeAria')}
                                >
                                  {t('defaultBadge')}
                                </Tag>
                              )}
                              <span
                                aria-hidden
                                className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                style={{ background: accent }}
                              />
                              <Tag
                                style={{
                                  background: typeTone?.bg,
                                  color: typeTone?.text,
                                  border: 'none',
                                  fontSize: 10,
                                  margin: 0,
                                }}
                              >
                                {t(`type.${(shift.shiftType ?? 'fixed') as ShiftType}` as const)}
                              </Tag>
                            </div>
                            {(daysSummary || hasRequiredHours) && (
                              <p className="m-0 mt-0.5 truncate text-[12px] text-subtle">
                                {daysSummary}
                                {daysSummary && hasRequiredHours ? (
                                  <span aria-hidden className="mx-1">
                                    ·
                                  </span>
                                ) : null}
                                {hasRequiredHours
                                  ? t('requiredHoursLabel', {
                                      hours: shift.requiredHoursPerDay ?? 0,
                                    })
                                  : null}
                              </p>
                            )}
                          </div>

                          {/* Actions: Edit + Delete inline at every breakpoint. */}
                          {(showEdit || showDelete) && (
                            <div className="flex flex-shrink-0 gap-1">
                              {showEdit && (
                                <Tooltip title={t('aria.editShift', { name: shift.name })}>
                                  <button
                                    type="button"
                                    aria-label={t('aria.editShift', { name: shift.name })}
                                    onClick={() => openEdit(shift)}
                                    className="cursor-pointer rounded-md border-none bg-transparent p-1.5 text-[var(--cr-text-4)] hover:bg-[var(--cr-pill-brand-bg)] hover:text-[var(--cr-primary)] focus-visible:outline-2 focus-visible:outline-[var(--cr-primary)]"
                                  >
                                    <EditOutlined />
                                  </button>
                                </Tooltip>
                              )}
                              {showDelete && (
                                <Popconfirm
                                  title={t('deleteConfirm.title')}
                                  description={t('deleteConfirm.description')}
                                  okText={t('deleteConfirm.ok')}
                                  cancelText={t('deleteConfirm.cancel')}
                                  okButtonProps={{ danger: true }}
                                  onConfirm={() => handleDelete(shift._id)}
                                >
                                  <button
                                    type="button"
                                    aria-label={t('aria.deleteShift', { name: shift.name })}
                                    className="cursor-pointer rounded-md border-none bg-transparent p-1.5 text-[var(--cr-danger-500)] hover:bg-[var(--cr-danger-50)] hover:text-[var(--cr-danger-700)] focus-visible:outline-2 focus-visible:outline-[var(--cr-danger-500)]"
                                  >
                                    <DeleteOutlined />
                                  </button>
                                </Popconfirm>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </Card>
        )}
      </div>

      {/* -- Create / Edit Shift Drawer (AntD v5 only) -- */}
      <DsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? t('drawer.editTitle') : t('drawer.addTitle')}
        okText={editing ? t('drawer.save') : t('drawer.add')}
        okLoading={saving}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
          <Form.Item
            name="name"
            label={t('drawer.nameLabel')}
            rules={[{ required: true, message: t('drawer.nameRequired') }]}
          >
            <Input placeholder={t('drawer.namePlaceholder')} size="large" />
          </Form.Item>
          <Form.Item name="shiftType" label={t('drawer.typeLabel')} initialValue="fixed">
            <Select
              size="large"
              options={typeOptions.map((s) => ({ value: s.value, label: s.label }))}
            />
          </Form.Item>
          {watchedShiftType && (
            <p className="-mt-2 mb-4 text-[12px] text-subtle">
              {typeOptions.find((s) => s.value === watchedShiftType)?.hint}
            </p>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="startTime"
                label={t('drawer.startLabel')}
                rules={[{ required: true, message: t('drawer.startRequired') }]}
                getValueProps={(v) => ({
                  value: v ? dayjs(v, 'HH:mm') : undefined,
                })}
                getValueFromEvent={(time) => (time ? time.format('HH:mm') : '')}
              >
                <TimePicker use12Hours format="hh:mm A" size="large" className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endTime"
                label={t('drawer.endLabel')}
                rules={[{ required: true, message: t('drawer.endRequired') }]}
                getValueProps={(v) => ({
                  value: v ? dayjs(v, 'HH:mm') : undefined,
                })}
                getValueFromEvent={(time) => (time ? time.format('HH:mm') : '')}
              >
                <TimePicker use12Hours format="hh:mm A" size="large" className="w-full" />
              </Form.Item>
            </Col>
          </Row>
          {watchedShiftType === 'flexi' && (
            <Form.Item
              name="requiredHoursPerDay"
              label={t('drawer.requiredHoursLabel')}
              tooltip={t('drawer.requiredHoursTooltip')}
            >
              <InputNumber
                min={0}
                max={24}
                step={0.5}
                placeholder="8"
                size="large"
                className="w-full"
              />
            </Form.Item>
          )}
          <Form.Item label={t('drawer.workingDaysLabel')}>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const isWorking = workingDays.includes(day.value);
                const dayName = t(`day.${day.key}` as const);
                const dayShort = dayName.charAt(0).toUpperCase();
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    aria-pressed={isWorking}
                    aria-label={dayName}
                    title={dayName}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      border: `1.5px solid ${isWorking ? selectedColor : 'var(--cr-border)'}`,
                      background: isWorking ? `${selectedColor}15` : 'var(--cr-surface)',
                      color: isWorking ? selectedColor : 'var(--cr-text-4)',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                  >
                    {dayShort}
                  </button>
                );
              })}
            </div>
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="gracePeriodMinutes"
                label={t('drawer.graceLabel')}
                tooltip={t('drawer.graceTooltip')}
              >
                <InputNumber min={0} size="large" className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="halfDayAfterLateMinutes"
                label={t('drawer.halfDayLabel')}
                tooltip={t('drawer.halfDayTooltip')}
              >
                <InputNumber min={0} size="large" className="w-full" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="policyId"
            label={t('drawer.policyLabel')}
            tooltip={t('drawer.policyTooltip')}
          >
            <Select
              size="large"
              allowClear
              placeholder={t('drawer.policyPlaceholder')}
              options={policies.map((p) => ({
                value: p._id,
                label: p.isDefault ? `${p.name} (${t('drawer.policyDefaultSuffix')})` : p.name,
              }))}
            />
          </Form.Item>
          <Form.Item label={t('drawer.colorLabel')}>
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label={t('drawer.colorLabel')}
            >
              {SHIFT_COLORS.map((c) => {
                const isSelected = selectedColor === c.color;
                return (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => setSelectedColor(c.color)}
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={t('drawer.colorAria', { color: c.color })}
                    className="flex flex-shrink-0 cursor-pointer items-center justify-center rounded-full border-none"
                    style={{
                      width: 20,
                      height: 20,
                      background: c.color,
                      boxShadow: isSelected
                        ? `0 0 0 2px var(--cr-surface), 0 0 0 3.5px ${c.color}`
                        : 'none',
                      transition: 'box-shadow 0.15s ease',
                    }}
                  >
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="#fff"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </Form.Item>
          <Form.Item name="isDefault" label={t('drawer.defaultLabel')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </DsDrawer>
    </FeatureGate>
  );
}
