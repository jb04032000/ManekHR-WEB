// Co-located route skeleton for the employee-code settings page (AC-3.5,
// binding rule in crewroster-web/CLAUDE.md). Mirrors the page: header (title +
// subtitle), a stacked alert/notice block, then the main settings card and a
// second backfill card. Server-only (no 'use client', no hooks); aria-hidden.
export default function EmployeeCodeLoading() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      {/* Page header */}
      <div className="mb-8">
        <div className="mb-2 h-7 w-56 rounded bg-gray-100" />
        <div className="h-4 w-80 max-w-full rounded bg-gray-100" />
      </div>

      {/* Notice block */}
      <div className="mb-8 flex flex-col gap-3">
        <div className="h-16 w-full rounded-[10px] bg-gray-100" />
      </div>

      {/* Main settings card */}
      <div className="mb-6 rounded-xl border border-[var(--cr-border)] bg-white p-7 shadow-card">
        {/* Enable toggle row */}
        <div className="mb-7 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-2 h-4 w-44 rounded bg-gray-100" />
            <div className="h-3 w-72 max-w-full rounded bg-gray-100" />
          </div>
          <div className="h-6 w-11 rounded-full bg-gray-100" />
        </div>
        <div className="mb-7 h-px w-full bg-gray-100" />
        {/* Format + preview rows */}
        <div className="mb-5 h-2.5 w-28 rounded bg-gray-100" />
        <div className="mb-6 flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-28 rounded-lg bg-gray-100" />
          ))}
        </div>
        <div className="mb-2 h-3 w-32 rounded bg-gray-100" />
        <div className="mb-6 h-10 w-full rounded-lg bg-gray-100" />
        <div className="h-10 w-32 rounded-lg bg-gray-100" />
      </div>

      {/* Backfill card */}
      <div className="rounded-xl border border-[var(--cr-border)] bg-white p-7 shadow-card">
        <div className="mb-2 h-4 w-40 rounded bg-gray-100" />
        <div className="mb-5 h-3 w-64 max-w-full rounded bg-gray-100" />
        <div className="h-10 w-36 rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}
