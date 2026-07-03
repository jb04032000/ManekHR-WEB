/**
 * Suspense-level skeleton for the tabbed Attendance Reports page.
 * Tab-agnostic: shows header + tab bar + a single tall content area.
 * Avoids layout jitter on deep-links to Compliance or Patterns tabs,
 * which have a different internal structure than Overtime.
 *
 * Note: this file is a Server Component (no 'use client' directive).
 * The aria-label uses a plain English string rather than t() because
 * useTranslations() requires a Client Component context.
 */
export default function AttendanceReportsLoading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl animate-pulse p-6"
      role="status"
      aria-busy="true"
      aria-label="Loading attendance reports"
    >
      {/* Page header skeleton */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-100" />
        <div>
          <div className="mb-2 h-5 w-48 rounded bg-gray-100" />
          <div className="h-3.5 w-72 rounded bg-gray-100" />
        </div>
      </div>

      {/* Tab bar skeleton */}
      <div className="mb-5 flex gap-6 border-b border-[var(--cr-border)] pb-0">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-24 rounded-t bg-gray-100" />
        ))}
      </div>

      {/* Tab content area - single tall block, tab-agnostic */}
      <div className="h-[520px] rounded-xl border border-[var(--cr-border)] bg-white" />
    </div>
  );
}
