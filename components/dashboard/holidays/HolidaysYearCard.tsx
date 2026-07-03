/**
 * HolidaysNextPill - compact always-visible pill ("Next: Holi · in 4 days")
 * that opens a slide-in drawer with the full year's holiday list.
 *
 * Replaces the previous inline `<HolidaysYearCard>` because the year list
 * (typical Indian SMB workspace: 15-25 holidays) was occupying 200-800px of
 * vertical real estate on every host surface (My Attendance, My Leave) and
 * pushing the primary content (attendance grid, leave balances) below the
 * fold. The pill is ~30px tall and the full list is one tap away.
 *
 * Permission gate: hides itself (returns `null`) when the caller lacks the
 * `holidays.calendar.view` grant AND is not the workspace owner. Mirrors the
 * admin holidays page's own view-grant logic so an admin-side change
 * cascades here for free. The pill itself is never shown to an unauthorised
 * member.
 *
 * Pill rendering uses the FULL loaded set (across years), so the "next
 * holiday" stays meaningful when the drawer's year navigator is on a non-
 * current year. Recurring holidays project their NEXT occurrence into the
 * current year, or roll to next year if today is already past this year's
 * projected date.
 *
 * Drawer body ports the year-list rendering from the previous card verbatim
 * (year navigator + count pill + month-grouped tight rows + past-row dimming
 * + Today badge + recurring projection into the active year) - only the
 * outer wrapping changed. AntD v5 `<Drawer>` (uses `open=`, not the v4
 * `visible=`).
 *
 * Filename kept (`HolidaysYearCard.tsx`) for diff continuity; the exported
 * symbol is `HolidaysNextPill`.
 */
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from 'react';
import { Button, Drawer, Skeleton, Tag, Tooltip } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { listHolidays } from '@/lib/actions';
import { STATUS_COLORS } from '@/components/ui';
import type { Holiday } from '@/types';

type HolidayType = Holiday['type'];

/**
 * Maps the holiday `type` onto a key in the shared `STATUS_COLORS` palette so
 * the dot + type Tag use CR design tokens (700-tier text). Mirrors the admin
 * holidays page TYPE_TONE map verbatim so a token change in one place stays
 * consistent across both surfaces. Inlined rather than extracted because the
 * helper is too small to warrant its own file.
 */
const TYPE_TONE: Record<HolidayType, string> = {
  national: 'holiday',
  festival: 'warning',
  company: 'active',
  other: 'cancelled',
};

function typeTone(type: string): string {
  return TYPE_TONE[type as HolidayType] ?? 'cancelled';
}

/**
 * Projects a recurring holiday's month+day into the requested year. Stored
 * `date` is always `YYYY-MM-DD`. Non-recurring entries keep their literal
 * stored date so a one-off "Founders Day 2026" never spills into 2027.
 */
function projectedDate(h: Holiday, year: number): string {
  return h.isRecurring
    ? dayjs(h.date).year(year).format('YYYY-MM-DD')
    : dayjs(h.date).format('YYYY-MM-DD');
}

/**
 * Finds the next upcoming holiday across the full loaded set, projecting
 * recurring entries forward as needed. Returns `null` when the set has no
 * upcoming entry (e.g. a workspace that has no holidays configured yet, or
 * only non-recurring past holidays). The day-count is rounded to whole days
 * starting from today, so "today" -> 0, "tomorrow" -> 1.
 *
 * For a recurring entry, we project to the CURRENT year first; if that
 * projected date has already passed (e.g. Holi was last month), roll forward
 * to next year. Non-recurring entries simply pass through their stored date.
 */
function nextUpcoming(holidays: Holiday[]): { holiday: Holiday; days: number } | null {
  const today = dayjs().startOf('day');
  const thisYear = today.year();
  const candidates = holidays.map((h) => {
    if (!h.isRecurring) return { holiday: h, when: dayjs(h.date).startOf('day') };
    const inThisYear = dayjs(h.date).year(thisYear).startOf('day');
    const when = inThisYear.diff(today, 'day') >= 0 ? inThisYear : inThisYear.add(1, 'year');
    return { holiday: h, when };
  });
  // Filter to upcoming + sort ascending. Today (diff === 0) counts as
  // upcoming so a holiday-day pill still surfaces.
  const upcoming = candidates
    .filter((c) => c.when.diff(today, 'day') >= 0)
    .sort((a, b) => a.when.valueOf() - b.when.valueOf());
  if (upcoming.length === 0) return null;
  return { holiday: upcoming[0].holiday, days: upcoming[0].when.diff(today, 'day') };
}

export function HolidaysNextPill(): ReactElement | null {
  const t = useTranslations('holidaysCard');
  const tTypes = useTranslations('holidays.type');
  const tNext = useTranslations('holidays.nextHoliday');
  const { currentWorkspaceId: wsId } = useWorkspaceStore();
  const { canPath, data: myPerms, loading: permsLoading } = useMyPermissions();

  // Permission gate. Mirrors the admin holidays page: an owner bypasses every
  // explicit grant, otherwise the leaf is `holidays.calendar.view`. When the
  // caller has neither, render nothing - the pill never tells a member that
  // there is something they cannot see.
  const canView = !!myPerms?.isOwner || canPath('holidays.calendar.view');

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeYear, setActiveYear] = useState<number>(() => dayjs().year());
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!wsId) return;
    setLoadError(false);
    try {
      const res = await listHolidays(wsId);
      setHolidays(res);
    } catch {
      // Silent on the wire; surface a tight inline retry inside the drawer
      // instead of a toast. The pill itself stays hidden on load error so a
      // transient fetch failure never spawns a useless trigger.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [wsId]);

  // Mount + workspace-switch fetch. Skip while permissions are resolving (the
  // canView check would otherwise read stale data on first paint). Deferred
  // through a microtask so set-state never fires inside the synchronous effect
  // body (set-state-in-effect rule mirrors holidays / leave page patterns).
  useEffect(() => {
    if (permsLoading) return;
    queueMicrotask(() => {
      if (!canView) {
        setLoading(false);
        return;
      }
      void load();
    });
  }, [load, permsLoading, canView]);

  // ── Pill data ─────────────────────────────────────────────────
  // Computed across the FULL loaded set (not year-sliced) so the pill stays
  // useful even when the drawer's navigator is on a non-current year.
  const next = useMemo(() => nextUpcoming(holidays), [holidays]);

  // ── Drawer derived data: project + filter + sort within active year ────
  const holidaysForYear = useMemo(() => {
    const todayStr = dayjs().format('YYYY-MM-DD');
    return holidays
      .map((h) => {
        const projected = projectedDate(h, activeYear);
        return { holiday: h, projected, isPast: projected < todayStr };
      })
      .filter((row) => dayjs(row.projected).year() === activeYear)
      .sort((a, b) => (a.projected < b.projected ? -1 : a.projected > b.projected ? 1 : 0));
  }, [holidays, activeYear]);

  const thisYear = dayjs().year();
  const isCurrentYear = activeYear === thisYear;
  const todayStr = dayjs().format('YYYY-MM-DD');

  // ── Permission-gated: hide the pill entirely when the caller lacks the
  // view grant. Returning null keeps the host layout stable; the member
  // never sees an inaccessible affordance.
  if (!canView && !permsLoading) {
    return null;
  }

  // ── Loading: a tight inline skeleton sized to the pill so the host layout
  // does not jump when the data settles. Same height/width budget as the
  // settled pill (~110px x 28px).
  if (loading) {
    return <Skeleton.Button active size="small" style={{ width: 160, height: 28 }} />;
  }

  // ── Day-count copy: reuse the existing ICU plural under
  // holidays.nextHoliday. Today -> "today", 1 -> "tomorrow", N -> "in N days".
  // Identical formula to the admin page summary so copy stays consistent
  // across surfaces.
  const dayCountCopy = next
    ? next.days === 0
      ? tNext('today')
      : next.days === 1
        ? tNext('tomorrow')
        : tNext('dueIn', { days: next.days })
    : '';

  // ── No upcoming holiday across the loaded set: hide the pill entirely.
  // Per spec, we never render a "no upcoming" message; the absence of the
  // pill is the signal. The drawer is then unreachable from this surface
  // (which is fine - if there is nothing upcoming AND the year list is also
  // empty/uninteresting, this affordance has nothing to offer).
  if (!next) {
    return null;
  }

  const nextTone = STATUS_COLORS[typeTone(next.holiday.type)];

  // ── Pill chrome (always-visible trigger). Rounded-full token-tinted pill
  // with the type-tone accent dot, muted "Next:" prefix, bold holiday name,
  // mid-dot separator, muted day-count. Matches the inline-pill style from
  // the admin Holidays page (background-tinted with type tone, no hard
  // border, focusable, visible focus ring).
  const pillStyle: CSSProperties = {
    background: nextTone?.bg ?? 'var(--cr-surface-2, var(--cr-bg))',
    color: nextTone?.text ?? 'var(--cr-text-2)',
    border: 'none',
  };

  const pillAria = t('nextPill.aria', {
    name: next.holiday.name,
    when: dayCountCopy,
  });

  return (
    <>
      <Tooltip title={tNext('aria', { name: next.holiday.name })}>
        <button
          type="button"
          aria-label={pillAria}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          className="inline-flex h-7 max-w-[260px] cursor-pointer items-center gap-1.5 rounded-full px-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cr-primary)]"
          style={pillStyle}
        >
          <span aria-hidden className="text-[14px] leading-none">
            🌴
          </span>
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: nextTone?.dot ?? 'var(--cr-primary)' }}
          />
          <span className="text-[12px] font-medium" style={{ color: nextTone?.text }}>
            {t('nextPill.prefix')}
          </span>
          <span className="min-w-0 truncate font-display text-[13px] font-bold text-heading">
            {next.holiday.name}
          </span>
          <span aria-hidden className="text-subtle">
            ·
          </span>
          <span className="shrink-0 text-[12px] text-subtle tabular-nums">{dayCountCopy}</span>
        </button>
      </Tooltip>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={t('title')}
        placement="right"
        size={520}
        destroyOnHidden
      >
        <HolidaysDrawerBody
          loadError={loadError}
          holidaysForYear={holidaysForYear}
          activeYear={activeYear}
          isCurrentYear={isCurrentYear}
          thisYear={thisYear}
          todayStr={todayStr}
          setActiveYear={setActiveYear}
          retry={() => {
            setLoading(true);
            void load();
          }}
          t={t}
          tTypes={tTypes}
        />
      </Drawer>
    </>
  );
}

// ── Drawer body ──────────────────────────────────────────────────────
// Extracted so the pill component above stays scannable; same module so the
// state (activeYear / holidays / loadError) flows in by props rather than
// re-hoisting context. Renders the year-navigator + count pill + month-
// grouped tight rows that used to live inside the `<Card>` wrapper.

interface HolidaysDrawerBodyProps {
  loadError: boolean;
  holidaysForYear: { holiday: Holiday; projected: string; isPast: boolean }[];
  activeYear: number;
  isCurrentYear: boolean;
  thisYear: number;
  todayStr: string;
  setActiveYear: Dispatch<SetStateAction<number>>;
  retry: () => void;
  t: ReturnType<typeof useTranslations<'holidaysCard'>>;
  tTypes: ReturnType<typeof useTranslations<'holidays.type'>>;
}

function HolidaysDrawerBody(props: HolidaysDrawerBodyProps): ReactElement {
  const {
    loadError,
    holidaysForYear,
    activeYear,
    isCurrentYear,
    thisYear,
    todayStr,
    setActiveYear,
    retry,
    t,
    tTypes,
  } = props;

  // ── Year navigator. Mirrors the admin page pattern: prev / current / next
  // arrows + tabular-nums year label + a "This year" reset link that only
  // renders when off the current year so the chrome stays tight on the
  // common path. NOTE: setActiveYear above is typed as (updater) => void so
  // the dispatch shape stays aligned with React.Dispatch.
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
        className="font-display text-[13px] font-bold text-heading tabular-nums"
        aria-live="polite"
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

  // ── Header row (count pill + year nav). The drawer's own `title=` carries
  // the section heading, so we do not duplicate it here.
  const header = (
    <div className="mb-2 flex items-center justify-between gap-3">
      {!loadError && (
        <span className="text-[12px] text-subtle tabular-nums">
          {t('count', { count: holidaysForYear.length })}
        </span>
      )}
      {yearNav}
    </div>
  );

  // ── Load-error: tight inline retry, never a toast. The drawer is a
  // secondary surface; a load failure must not noise up the host page.
  if (loadError) {
    return (
      <>
        {header}
        <div className="flex items-center justify-between gap-3 pt-1 text-[12px] text-subtle">
          <span>{t('loadError')}</span>
          <Button size="small" onClick={retry}>
            {t('retry')}
          </Button>
        </div>
      </>
    );
  }

  // ── Empty state for the active year: single muted line, no big hero. A
  // workspace that has not configured holidays for the active year is a
  // common case; the drawer must not punish that with a panel.
  if (holidaysForYear.length === 0) {
    return (
      <>
        {header}
        <p className="m-0 pt-1 text-[12px] text-subtle">{t('empty', { year: activeYear })}</p>
      </>
    );
  }

  // ── List rendering. Derive the month-abbrev visibility from the previous
  // row's projected date (pure read of the array; no mutable state). The
  // first row in each month carries the label, continuation rows leave the
  // column empty so the grouping reads naturally without sticky headers.
  return (
    <>
      {header}
      <div role="list" className="flex flex-col">
        {holidaysForYear.map(({ holiday, projected, isPast }, idx) => {
          const d = dayjs(projected);
          const monthIdx = d.month();
          const prevMonthIdx = idx > 0 ? dayjs(holidaysForYear[idx - 1].projected).month() : -1;
          const showMonth = monthIdx !== prevMonthIdx;
          const monthLabel = d.format('MMM').toUpperCase();
          const day = d.format('DD');
          const weekday = d.format('ddd');
          const tone = STATUS_COLORS[typeTone(holiday.type)];
          const isToday = projected === todayStr;

          return (
            <div
              key={holiday._id}
              role="listitem"
              className={`flex items-center gap-3 py-1.5 ${isPast ? 'opacity-60' : ''}`}
            >
              {/* Month abbrev (3-letter, fixed 36px column). Only the first
                  row per month renders the label; continuation rows leave the
                  column blank so the eye groups them. */}
              <span
                aria-hidden
                className="w-9 shrink-0 font-display text-[11px] font-medium tracking-wide text-subtle uppercase tabular-nums"
              >
                {showMonth ? monthLabel : ''}
              </span>

              {/* Type accent dot (1.5 x 1.5). */}
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: tone?.dot ?? 'var(--cr-neutral-300)' }}
              />

              {/* DD + 3-letter weekday. */}
              <span className="shrink-0 font-display text-[13px] text-heading tabular-nums">
                <span className="font-bold">{day}</span>
                <span className="ml-1 text-subtle">{weekday}</span>
              </span>

              {/* Name (truncates on overflow). Today badge sits immediately
                  after the name so the eye lands on it before the type Tag. */}
              <span className="min-w-0 flex-1 truncate font-display text-[13px] text-heading">
                {holiday.name}
                {isToday && (
                  <Tag
                    color="processing"
                    style={{ fontSize: 10, marginInlineStart: 6, marginInlineEnd: 0 }}
                  >
                    {t('todayBadge')}
                  </Tag>
                )}
              </span>

              {/* Type Tag (right-aligned). Same token palette as the admin
                  page so the visual language stays consistent. */}
              <Tag
                style={{
                  background: tone?.bg,
                  color: tone?.text,
                  border: 'none',
                  fontSize: 10,
                  margin: 0,
                }}
              >
                {tTypes(holiday.type)}
              </Tag>
            </div>
          );
        })}
      </div>
    </>
  );
}
