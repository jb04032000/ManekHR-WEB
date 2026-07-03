/**
 * Suspense-level skeleton for the Salary TDS page.
 * Mirrors the page layout: header, summary stat tiles, filter bar,
 * and the TDS records table card.
 *
 * Server Component - no 'use client'. aria-label uses a plain string
 * (not useTranslations()) because that hook requires a Client Component.
 */
export default function SalaryTdsLoading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl animate-pulse p-6"
      role="status"
      aria-busy="true"
      aria-label="Loading TDS dashboard"
    >
      {/* Page header skeleton */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-100" />
        <div>
          <div className="mb-2 h-5 w-40 rounded bg-gray-100" />
          <div className="h-3.5 w-64 rounded bg-gray-100" />
        </div>
      </div>

      {/* Summary stat tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[88px] rounded-xl border border-[var(--cr-border-subtle,rgba(0,0,0,0.06))] bg-white"
          />
        ))}
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-28 rounded-full bg-gray-100" />
        ))}
        <div className="ml-auto h-8 w-32 rounded-lg bg-gray-100" />
      </div>

      {/* TDS table card */}
      <div className="rounded-xl border border-[var(--cr-border-light)] bg-white p-4">
        {/* Toolbar */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="h-9 w-48 rounded-lg bg-gray-100" />
          <div className="flex gap-2">
            <div className="h-9 w-28 rounded-lg bg-gray-100" />
            <div className="h-9 w-24 rounded-lg bg-gray-100" />
          </div>
        </div>

        {/* Table header */}
        <div className="mb-2 flex gap-3 border-b border-[var(--cr-border)] pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 flex-1 rounded bg-gray-100" />
          ))}
        </div>

        {/* Table rows */}
        <div className="flex flex-col gap-3 pt-2">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gray-100" />
              <div className="h-4 flex-1 rounded bg-gray-100" />
              <div className="h-4 w-24 rounded bg-gray-100" />
              <div className="h-4 w-20 rounded bg-gray-100" />
              <div className="h-6 w-16 rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
