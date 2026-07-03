'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Popconfirm,
  Select,
  Skeleton,
  Switch,
  Tag,
  Tooltip,
} from 'antd';
import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  LeftOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import {
  listHolidays,
  createHoliday,
  createHolidaysBulk,
  updateHoliday,
  deleteHoliday,
} from '@/lib/actions';
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
import { parseApiError } from '@/lib/utils';
import type { Holiday, CreateHolidayPayload } from '@/types';

type HolidayType = Holiday['type'];
type TypeFilter = 'all' | HolidayType;

/**
 * Map a holiday `type` onto a key in the shared `STATUS_COLORS` palette so the
 * type accent + tag use CR design tokens (700-tier text) instead of ad-hoc
 * colours. Holidays are workspace-global reference data; the type is purely
 * descriptive, not a permission scope.
 */
const TYPE_TONE: Record<HolidayType, string> = {
  national: 'holiday', // info-tier
  festival: 'warning',
  company: 'active', // success-tier
  other: 'cancelled', // neutral
};

function typeTone(type: string): string {
  return TYPE_TONE[type as HolidayType] ?? 'cancelled';
}

const TYPE_FILTER_OPTIONS: readonly TypeFilter[] = [
  'all',
  'national',
  'festival',
  'company',
  'other',
] as const;

export default function HolidaysPage() {
  const t = useTranslations('holidays');
  const { message } = App.useApp();
  const { currentWorkspaceId: wsId } = useWorkspaceStore();
  const { canPath, data: myPerms, loading: permsLoading } = useMyPermissions();

  // FE mirrors the BE permission spine (H1). Holidays are workspace-global so
  // the leaves carry no self/all meaning - the spine is binary: view (any
  // member) vs create/edit (manager+) vs delete (owner/admin only). The owner
  // bypass is built into useMyPermissions (isOwner short-circuits canPath to
  // true), so an owner sees every control without an explicit grant.
  const canView = !!myPerms?.isOwner || canPath('holidays.calendar.view');
  const canCreate = !!myPerms?.isOwner || canPath('holidays.calendar.create');
  const canEdit = !!myPerms?.isOwner || canPath('holidays.calendar.edit');
  const canDelete = !!myPerms?.isOwner || canPath('holidays.calendar.delete');

  // Subscription gate (dynamic plans): the Holidays module / sub-features can
  // be plan-locked. When locked the reads 403 - show the upgrade prompt instead
  // of firing doomed calls that surface as a generic load error. Mirrors My
  // Leave. Create / edit / delete are also each plan-gated sub-features.
  const { isLocked: moduleLocked, isLoading: accessLoading } = useFeatureAccess('holidays');
  const { isLocked: createLocked } = useFeatureAccess('holidays', 'create_holiday');
  const { isLocked: editLocked } = useFeatureAccess('holidays', 'edit_holiday');
  const { isLocked: deleteLocked } = useFeatureAccess('holidays', 'delete_holiday');

  // A control needs BOTH the RBAC grant AND the subscription sub-feature.
  const showAdd = canCreate && !createLocked;
  const showEdit = canEdit && !editLocked;
  const showDelete = canDelete && !deleteLocked;

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [saving, setSaving] = useState(false);
  // Multi-add mode: when on, the drawer shows a repeatable {date,name} row list so
  // an owner can declare several holidays (e.g. a whole year) in one submit via the
  // bulk endpoint. Edit is always single. Reset whenever the drawer (re)opens.
  const [bulkMode, setBulkMode] = useState(false);
  const [form] = Form.useForm();

  // ── Refresh state ─────────────────────────────────────────────
  // Year navigator is held client-side; we filter the workspace-wide load by
  // active year. No new endpoint or DTO. Next-holiday is computed against the
  // full loaded set so it remains visible even when the user is browsing a
  // different year. Type chips + recurring toggle compose with AND.
  const [activeYear, setActiveYear] = useState<number>(() => dayjs().year());
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [recurringOnly, setRecurringOnly] = useState(false);

  const load = useCallback(async () => {
    if (!wsId) return;
    try {
      const res = await listHolidays(wsId);
      setHolidays(res);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  // Mount + workspace-change fetch. Skip while subscription access is resolving
  // or when the module is plan-locked (upgrade prompt renders instead of doomed
  // 403 reads), and skip when the member lacks the view grant (no-access state
  // renders instead). Deferred through a microtask to stay outside the
  // synchronous effect body (set-state-in-effect rule).
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

  const typeOptions = useMemo(
    () => [
      { value: 'national', label: t('type.national') },
      { value: 'festival', label: t('type.festival') },
      { value: 'company', label: t('type.company') },
      { value: 'other', label: t('type.other') },
    ],
    [t],
  );

  const openAdd = () => {
    setEditing(null);
    setBulkMode(false);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (h: Holiday) => {
    setEditing(h);
    setBulkMode(false); // editing targets a single existing holiday
    form.setFieldsValue({
      name: h.name,
      date: dayjs(h.date),
      description: h.description,
      isRecurring: h.isRecurring,
      type: h.type,
    });
    setDrawerOpen(true);
  };

  // Drawer form shape covers both single and bulk (rows) modes.
  type DrawerValues = {
    name?: string;
    date?: dayjs.Dayjs | null;
    type?: HolidayType;
    description?: string;
    isRecurring?: boolean;
    rows?: { date?: dayjs.Dayjs | null; name?: string }[];
  };

  const handleSave = async (vals: DrawerValues) => {
    if (!wsId) return;
    setSaving(true);
    try {
      // ── Bulk add: one shared type/description/recurring + many {date,name} rows.
      if (!editing && bulkMode) {
        const rows = (vals.rows ?? []).filter((r) => r && r.date && r.name);
        if (rows.length === 0) {
          message.error('Add at least one holiday with a date and name.');
          return;
        }
        const payloads: CreateHolidayPayload[] = rows.map((r) => ({
          name: (r.name ?? '').trim(),
          date: dayjs(r.date).format('YYYY-MM-DD'),
          type: vals.type,
          description: vals.description,
          isRecurring: !!vals.isRecurring,
        }));
        const res = await createHolidaysBulk(wsId, payloads);
        const added = res.created.length;
        const skipped = res.skipped.length;
        message.success(
          skipped > 0
            ? `${added} added, ${skipped} skipped (a holiday already exists on that date).`
            : `${added} holiday${added === 1 ? '' : 's'} added.`,
        );
        setDrawerOpen(false);
        await load();
        return;
      }

      // ── Single add / edit (existing behaviour).
      // Single add / edit. The form enforces name+date+type as required, so the
      // `?? ''` fallbacks only satisfy the type narrowing (they never run blank).
      const payload: CreateHolidayPayload = {
        name: vals.name ?? '',
        type: vals.type,
        description: vals.description,
        isRecurring: vals.isRecurring,
        date: vals.date ? dayjs(vals.date).format('YYYY-MM-DD') : '',
      };
      if (editing) {
        await updateHoliday(wsId, editing._id, payload);
        message.success(t('updated'));
      } else {
        await createHoliday(wsId, payload);
        message.success(t('created'));
      }
      setDrawerOpen(false);
      await load();
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!wsId) return;
    try {
      await deleteHoliday(wsId, id);
      message.success(t('deleted'));
      await load();
    } catch (e) {
      message.error(parseApiError(e));
    }
  };

  // ── Derived data ──────────────────────────────────────────────

  // Sort the full list once; downstream slices stay stable.
  const sortedHolidays = useMemo(
    () => [...holidays].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [holidays],
  );

  // Next-upcoming holiday across the FULL loaded set so the summary line stays
  // useful when the user is browsing past or future years. Includes today as a
  // match. Written as .find()+derive so the React Compiler preserves the
  // manual memoization. Also surfaces the holiday id so the list renderer can
  // tag the matching row with an inline "Up next" badge.
  const nextHoliday = useMemo<{ holiday: Holiday; days: number } | null>(() => {
    const today = dayjs().startOf('day');
    const found = sortedHolidays.find((h) => dayjs(h.date).startOf('day').diff(today, 'day') >= 0);
    if (!found) return null;
    return { holiday: found, days: dayjs(found.date).startOf('day').diff(today, 'day') };
  }, [sortedHolidays]);

  // Active-year slice + chip filters.
  const yearHolidays = useMemo(
    () => sortedHolidays.filter((h) => dayjs(h.date).year() === activeYear),
    [sortedHolidays, activeYear],
  );

  const filteredHolidays = useMemo(
    () =>
      yearHolidays.filter((h) => {
        if (typeFilter !== 'all' && h.type !== typeFilter) return false;
        if (recurringOnly && !h.isRecurring) return false;
        return true;
      }),
    [yearHolidays, typeFilter, recurringOnly],
  );

  // Per-type counts within the active year (chip counters; recurring toggle
  // does not narrow these so users can see what each chip would reveal).
  const typeCounts = useMemo(() => {
    const counts: Record<TypeFilter, number> = {
      all: yearHolidays.length,
      national: 0,
      festival: 0,
      company: 0,
      other: 0,
    };
    yearHolidays.forEach((h) => {
      counts[h.type] += 1;
    });
    return counts;
  }, [yearHolidays]);

  const recurringCount = useMemo(
    () => yearHolidays.filter((h) => h.isRecurring).length,
    [yearHolidays],
  );

  // Month-grouped slice within active year. Sort key is the month index so
  // Jan to Dec; rows within a month are already date-sorted via sortedHolidays.
  const monthGroups = useMemo(() => {
    const map = new Map<number, Holiday[]>();
    filteredHolidays.forEach((h) => {
      const m = dayjs(h.date).month();
      const arr = map.get(m) ?? [];
      arr.push(h);
      map.set(m, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [filteredHolidays]);

  const filtersActive = typeFilter !== 'all' || recurringOnly;
  const thisYear = dayjs().year();
  const isCurrentYear = activeYear === thisYear;

  // ── Plan-locked (subscription) - upgrade prompt, never the load error.
  // FeatureGate with no children renders the UpgradePrompt when locked.
  // Guarded by !accessLoading so it never flashes mid-resolve.
  if (moduleLocked && !accessLoading) {
    return <FeatureGate module="holidays" as="h1" />;
  }

  // ── Permissions / access still resolving. Structural skeleton mirrors the
  // rendered layout (header + year nav + summary line + filter chips + month-
  // grouped row card) so the loading state never collapses to a generic blob.
  if (loading || accessLoading || permsLoading) {
    return (
      <div className="w-full max-w-5xl" aria-busy="true">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex flex-1 items-start gap-3">
            <Skeleton.Avatar active shape="square" size={40} />
            <div className="min-w-0 flex-1">
              <Skeleton.Input active size="medium" style={{ width: 220 }} />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Skeleton.Input active size="small" style={{ width: 320 }} />
                <Skeleton.Button active size="small" style={{ width: 120 }} />
              </div>
            </div>
          </div>
          <Skeleton.Button active size="large" style={{ width: 140 }} />
        </div>
        {/* Summary line */}
        <div className="mb-3">
          <Skeleton.Input active size="small" style={{ width: 300 }} />
        </div>
        {/* Filter chips */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {[60, 80, 80, 90, 70, 110].map((w, i) => (
            <Skeleton.Button key={i} active size="small" shape="round" style={{ width: w }} />
          ))}
        </div>
        {/* List card with month-grouped row placeholders */}
        <Card styles={{ body: { padding: '4px 0' } }}>
          {[0, 1].map((groupIdx) => (
            <div key={groupIdx} className={groupIdx === 0 ? '' : 'mt-2'}>
              <div className="px-4 py-2">
                <Skeleton.Input active size="small" style={{ width: 110 }} />
              </div>
              {[0, 1].map((rowIdx) => (
                <div key={rowIdx} className="flex items-center gap-3 px-4 py-2.5">
                  <Skeleton.Avatar active shape="square" size={40} />
                  <div className="min-w-0 flex-1">
                    <Skeleton.Input active size="small" style={{ width: 180 }} />
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

  // ── No view grant - friendly no-access state, never a blank crash.
  if (!canView) {
    return (
      <div className="w-full">
        <DsPageHeader title={t('title')} sub={t('subtitle')} icon={<CalendarOutlined />} />
        <Card>
          <DsEmptyState icon="🔒" title={t('accessDenied.title')} sub={t('accessDenied.message')} />
        </Card>
      </div>
    );
  }

  // ── Load error - retry.
  if (loadError) {
    return (
      <div className="w-full">
        <DsPageHeader title={t('title')} sub={t('subtitle')} icon={<CalendarOutlined />} />
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

  // ── Summary line (prose, sits above the filter chips). Folds the next-
  // holiday context into the page's natural language instead of a floating
  // pill. The "Up next" continuation is only rendered when there is an
  // upcoming holiday in the loaded set. Resolves to copy like:
  //   "2 holidays in 2026 . Up next: Holi in 4 days"
  // (uses a mid-dot separator, not an em-dash). When there is no upcoming
  // entry the summary collapses to just the count.
  const nextWhenCopy = nextHoliday
    ? nextHoliday.days === 0
      ? t('nextHoliday.today')
      : nextHoliday.days === 1
        ? t('nextHoliday.tomorrow')
        : t('nextHoliday.dueIn', { days: nextHoliday.days })
    : '';
  const summaryCount = t('summary.count', {
    count: yearHolidays.length,
    year: activeYear,
  });
  const summaryUpNext = nextHoliday
    ? t('summary.upNextInline', {
        name: nextHoliday.holiday.name,
        when: nextWhenCopy,
      })
    : '';

  // Year navigator (left aside of the page header title). Holds the active
  // year client-side; arrow keys + buttons step through years. "This year"
  // jumps back to today's year when off it. Tabular-nums keeps the label width
  // stable as the year changes.
  const yearNav = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tooltip title={t('yearNav.prev')}>
        <Button
          shape="circle"
          size="small"
          icon={<LeftOutlined />}
          aria-label={t('yearNav.prev')}
          onClick={() => setActiveYear((y) => y - 1)}
        />
      </Tooltip>
      <span
        className="font-display text-[15px] font-bold text-heading tabular-nums"
        aria-live="polite"
        aria-label={t('yearNav.label', { year: activeYear })}
      >
        {activeYear}
      </span>
      <Tooltip title={t('yearNav.next')}>
        <Button
          shape="circle"
          size="small"
          icon={<RightOutlined />}
          aria-label={t('yearNav.next')}
          onClick={() => setActiveYear((y) => y + 1)}
        />
      </Tooltip>
      {!isCurrentYear && (
        <Button type="link" size="small" onClick={() => setActiveYear(thisYear)} className="px-1">
          {t('yearNav.thisYear')}
        </Button>
      )}
    </div>
  );

  const nextHolidayId = nextHoliday?.holiday._id;

  return (
    <FeatureGate module="holidays" as="h1">
      {/* Constrain the admin list to a focused max-width so short rows
          (day-chip + name + actions) do not have to span 1400px. The platform
          Content wrapper caps overall content at 1400px; this narrows further
          to 1024px and centres so the actions sit close to the content
          instead of pinned to a far-right edge. */}
      <div className="w-full max-w-5xl">
        <DsPageHeader
          title={t('title')}
          sub={t('subtitle')}
          icon={<CalendarOutlined />}
          titleAside={yearNav}
          right={
            <HeaderRightActions
              module="holidays"
              moduleLabel={t('title')}
              // The dashboard breadcrumb already renders the global atoms
              // (shortcuts, plan features, feedback) for every page; the page
              // header version was a duplicate. Holidays has no dedicated user
              // guide, so suppress that atom too. The right slot keeps only
              // the single primary action (Add Holiday); next-holiday context
              // is folded into the inline summary line below the chips.
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

        {/* ── Summary line: natural-language prose sitting above the chips.
            Replaces the standalone NEXT HOLIDAY pill the previous iteration
            kept patching into the header. No card, no border, just inline
            muted text. Hides the "Up next" segment when no future holiday is
            loaded. */}
        <p className="mb-3 text-[12px] text-subtle" aria-live="polite">
          <span>{summaryCount}</span>
          {summaryUpNext ? (
            <>
              <span aria-hidden className="mx-1.5">
                ·
              </span>
              <span>{summaryUpNext}</span>
            </>
          ) : null}
        </p>

        {/* ── Filter chips: type + recurring toggle ───────────────────────
            cr-filter-chip is the canonical Team v2 token. Recurring is a
            separate AND-combined toggle (chip selection narrows by type;
            recurring narrows again on top). Counts reflect the active year's
            slice. */}
        <div
          role="group"
          aria-label={t('filter.aria')}
          className="mb-4 flex flex-wrap items-center gap-1.5"
        >
          {TYPE_FILTER_OPTIONS.map((key) => {
            const active = typeFilter === key;
            const label = key === 'all' ? t('filter.all') : t(`type.${key}` as 'type.national');
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
          <span aria-hidden className="mx-1 h-5 w-px bg-[var(--cr-border-subtle)]" />
          <button
            type="button"
            onClick={() => setRecurringOnly((v) => !v)}
            aria-pressed={recurringOnly}
            className={`cr-filter-chip ${recurringOnly ? 'cr-filter-chip--active' : ''}`}
          >
            <span>{t('filter.recurringOnly')}</span>
            <span className="cr-filter-chip__count tabular-nums">{recurringCount}</span>
          </button>
        </div>

        {/* ── List / empty state ──────────────────────────────────── */}
        {filteredHolidays.length === 0 ? (
          <Card>
            <DsEmptyState
              icon="📅"
              title={
                filtersActive ? t('empty.filtered.title', { year: activeYear }) : t('empty.title')
              }
              sub={filtersActive ? t('empty.filtered.sub') : t('empty.subtitle')}
              action={
                filtersActive ? (
                  <Button
                    onClick={() => {
                      setTypeFilter('all');
                      setRecurringOnly(false);
                    }}
                  >
                    {t('filter.clear')}
                  </Button>
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
            {monthGroups.map(([monthIdx, items], groupIdx) => {
              const monthLabel = dayjs().month(monthIdx).format('MMMM');
              return (
                <section
                  key={`${activeYear}-${monthIdx}`}
                  aria-label={t('monthAria', { month: monthLabel, year: activeYear })}
                  className={groupIdx === 0 ? '' : 'mt-2'}
                >
                  {/* Lighter month grouping: plain bold header + count,
                      no sticky, no backdrop-blur, no card-per-group. */}
                  <div className="flex items-baseline justify-between px-4 py-2">
                    <h3 className="m-0 font-display text-[14px] font-bold text-heading">
                      {monthLabel}
                      <span className="ml-1.5 text-subtle tabular-nums">({items.length})</span>
                    </h3>
                  </div>
                  {/* Flat list: each holiday is a plain row. No Collapse,
                      no expand toggling, no overflow Dropdown. Actions render
                      inline at every breakpoint (Edit + Delete icon buttons). */}
                  <div role="list">
                    {items.map((holiday) => {
                      const tone = STATUS_COLORS[typeTone(holiday.type)];
                      const hasDesc = !!holiday.description;
                      const day = dayjs(holiday.date).format('DD');
                      const weekday = dayjs(holiday.date).format('ddd');
                      const isUpNext = holiday._id === nextHolidayId;

                      return (
                        <div
                          key={holiday._id}
                          role="listitem"
                          className={`flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--cr-surface-2)] ${isUpNext ? 'bg-[color-mix(in_srgb,var(--cr-primary)_4%,transparent)]' : ''}`}
                          style={{
                            borderLeft: `3px solid ${tone?.dot ?? 'var(--cr-neutral-300)'}`,
                          }}
                        >
                          {/* Day chip (DD + weekday) */}
                          <div
                            aria-hidden
                            className="flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded-lg font-display"
                            style={{
                              background: tone?.bg ?? 'var(--cr-surface-2)',
                              color: tone?.text ?? 'var(--cr-text-3)',
                              border: `1px solid ${tone?.dot ?? 'var(--cr-border-subtle)'}`,
                            }}
                          >
                            <span className="text-[14px] leading-none font-bold tabular-nums">
                              {day}
                            </span>
                            <span className="mt-0.5 text-[9px] font-medium tracking-wide uppercase opacity-80">
                              {weekday}
                            </span>
                          </div>

                          {/* Name + badges + (optional) description */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate font-display text-[14px] font-bold text-heading">
                                {holiday.name}
                              </span>
                              {isUpNext && (
                                <Tag
                                  color="processing"
                                  style={{ fontSize: 10, margin: 0 }}
                                  aria-label={t('upNextBadgeAria')}
                                >
                                  {t('upNextBadge')}
                                </Tag>
                              )}
                              <span
                                aria-hidden
                                className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                style={{ background: tone?.dot ?? 'var(--cr-neutral-300)' }}
                              />
                              <Tag
                                style={{
                                  background: tone?.bg,
                                  color: tone?.text,
                                  border: 'none',
                                  fontSize: 10,
                                  margin: 0,
                                }}
                              >
                                {t(`type.${holiday.type}` as 'type.national')}
                              </Tag>
                              {holiday.isRecurring && (
                                <Tag style={{ fontSize: 10, margin: 0 }}>{t('recurringTag')}</Tag>
                              )}
                            </div>
                            {hasDesc && (
                              <p className="m-0 mt-0.5 truncate text-[12px] text-subtle">
                                {holiday.description}
                              </p>
                            )}
                          </div>

                          {/* Actions: Edit + Delete inline at every breakpoint. */}
                          {(showEdit || showDelete) && (
                            <div className="flex flex-shrink-0 gap-1">
                              {showEdit && (
                                <Tooltip title={t('aria.editHoliday', { name: holiday.name })}>
                                  <button
                                    type="button"
                                    aria-label={t('aria.editHoliday', { name: holiday.name })}
                                    onClick={() => openEdit(holiday)}
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
                                  onConfirm={() => handleDelete(holiday._id)}
                                >
                                  <button
                                    type="button"
                                    aria-label={t('aria.deleteHoliday', { name: holiday.name })}
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

      <DsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? t('drawer.editTitle') : bulkMode ? 'Add holidays' : t('drawer.addTitle')}
        okText={editing ? t('drawer.save') : bulkMode ? 'Add all' : t('drawer.add')}
        okLoading={saving}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
          {/* Multi-add toggle (add-mode only). When on, the single name/date fields
              are replaced by a repeatable {date,name} row list, all sharing the
              type/description/recurring chosen below, submitted via the bulk API. */}
          {!editing && (
            <div className="mb-4 flex items-center justify-between rounded-lg bg-[var(--cr-surface-2)] px-3 py-2">
              <div className="min-w-0">
                <span className="block text-sm font-medium text-heading">Add multiple dates</span>
                <span className="text-[12px] text-subtle">
                  Declare several holidays at once (e.g. a whole year).
                </span>
              </div>
              <Switch checked={bulkMode} onChange={setBulkMode} />
            </div>
          )}

          {!bulkMode && (
            <Form.Item
              name="name"
              label={t('drawer.nameLabel')}
              rules={[{ required: true, message: t('drawer.nameRequired') }]}
            >
              <Input placeholder={t('drawer.namePlaceholder')} size="large" />
            </Form.Item>
          )}
          {!bulkMode && (
            <Form.Item
              name="date"
              label={t('drawer.dateLabel')}
              rules={[{ required: true, message: t('drawer.dateRequired') }]}
            >
              <DatePicker className="w-full" size="large" />
            </Form.Item>
          )}

          <Form.Item
            name="type"
            label={t('drawer.typeLabel')}
            rules={[{ required: true, message: t('drawer.typeRequired') }]}
          >
            <Select placeholder={t('drawer.typePlaceholder')} size="large" options={typeOptions} />
          </Form.Item>

          {bulkMode && (
            <Form.List name="rows" initialValue={[{}]}>
              {(fields, { add, remove }) => (
                <div className="mb-4 flex flex-col gap-2">
                  <span className="text-sm font-medium text-heading">Holidays</span>
                  {fields.map((field) => (
                    <div key={field.key} className="flex items-start gap-2">
                      <Form.Item
                        name={[field.name, 'date']}
                        rules={[{ required: true, message: 'Date' }]}
                        className="mb-0"
                      >
                        <DatePicker className="w-36" placeholder="Date" />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'name']}
                        rules={[{ required: true, message: 'Name' }]}
                        className="mb-0 flex-1"
                      >
                        <Input placeholder="Holiday name (e.g. Diwali)" />
                      </Form.Item>
                      <Tooltip title="Remove">
                        <button
                          type="button"
                          aria-label="Remove holiday row"
                          disabled={fields.length === 1}
                          onClick={() => remove(field.name)}
                          className="mt-1 cursor-pointer rounded-md border-none bg-transparent p-1.5 text-[var(--cr-danger-500)] hover:bg-[var(--cr-danger-50)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <DeleteOutlined />
                        </button>
                      </Tooltip>
                    </div>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({})} block>
                    Add another holiday
                  </Button>
                </div>
              )}
            </Form.List>
          )}

          <Form.Item name="description" label={t('drawer.descriptionLabel')}>
            <Input.TextArea placeholder={t('drawer.descriptionPlaceholder')} rows={2} />
          </Form.Item>
          <Form.Item name="isRecurring" label={t('drawer.recurringLabel')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </DsDrawer>
    </FeatureGate>
  );
}
