/**
 * Suspense-level skeleton for the Attendance Overview page.
 * Matches the overview layout: page header + KPI tile row +
 * 2-column chart row (area/line left, donut right) + member table block.
 *
 * The parent attendance/loading.tsx renders a table-only skeleton that
 * mismatches the overview's chart-heavy layout and causes visible flicker.
 * This route-level loading.tsx overrides it for the /overview segment only.
 *
 * Server Component - no 'use client'. aria-label uses a plain English
 * string; useTranslations() requires a Client Component context.
 */
export default function AttendanceOverviewLoading() {
  return (
    <div
      className="w-full animate-pulse space-y-6 p-0"
      role="status"
      aria-busy="true"
      aria-label="Loading attendance overview"
    >
      {/* Page header skeleton - icon + title/sub + right filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-gray-100" />
          <div>
            <div className="mb-2 h-5 w-52 rounded bg-gray-100" />
            <div className="h-3.5 w-72 rounded bg-gray-100" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-36 rounded-lg bg-gray-100" />
          <div className="h-8 w-36 rounded-lg bg-gray-100" />
        </div>
      </div>

      {/* KPI tiles row - 4 tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-[var(--cr-border)] bg-white" />
        ))}
      </div>

      {/* Chart row - 2/3 area chart + 1/3 donut */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Area / line chart block */}
        <div className="rounded-xl border border-[var(--cr-border)] bg-white p-5 lg:col-span-2">
          <div className="mb-1 h-4 w-48 rounded bg-gray-100" />
          <div className="mb-4 h-3.5 w-64 rounded bg-gray-100" />
          <div className="h-[240px] rounded-lg bg-gray-50" />
        </div>

        {/* Donut block */}
        <div className="flex flex-col rounded-xl border border-[var(--cr-border)] bg-white p-5">
          <div className="mb-1 h-4 w-40 rounded bg-gray-100" />
          <div className="mb-4 h-3.5 w-52 rounded bg-gray-100" />
          <div className="flex-1">
            {/* Donut circle placeholder */}
            <div className="mx-auto h-[200px] w-[200px] rounded-full border-[24px] border-gray-100" />
            {/* Legend items */}
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-gray-100" />
                  <div className="h-3 w-14 rounded bg-gray-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Member summary table block */}
      <div className="overflow-hidden rounded-xl border border-[var(--cr-border)] bg-white">
        {/* Table header row with search */}
        <div className="flex items-center justify-between border-b border-[var(--cr-border)] px-5 py-4">
          <div>
            <div className="mb-1.5 h-4 w-44 rounded bg-gray-100" />
            <div className="h-3 w-36 rounded bg-gray-100" />
          </div>
          <div className="h-8 w-48 rounded-lg bg-gray-100" />
        </div>
        {/* Table rows */}
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--cr-border)] px-5 py-3 last:border-b-0"
          >
            <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gray-100" />
            <div className="flex-1">
              <div className="mb-1.5 h-3.5 w-36 rounded bg-gray-100" />
              <div className="h-3 w-24 rounded bg-gray-100" />
            </div>
            <div className="h-2 w-24 rounded-full bg-gray-100" />
            <div className="h-3.5 w-10 rounded bg-gray-100" />
            <div className="h-5 w-8 rounded-full bg-gray-100" />
            <div className="h-5 w-8 rounded-full bg-gray-100" />
            <div className="h-3.5 w-12 rounded bg-gray-100" />
            <div className="h-4 w-4 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
