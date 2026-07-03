/**
 * Suspense-level skeleton for the Salary Overview page.
 * Mirrors the page layout: large hero card, KPI metric cards grid,
 * and a two-column trend + watchlist section.
 *
 * Server Component - no 'use client'. aria-label uses a plain string
 * (not useTranslations()) because that hook requires a Client Component.
 */
export default function SalaryLoading() {
  return (
    <div
      className="w-full animate-pulse space-y-8"
      role="status"
      aria-busy="true"
      aria-label="Loading salary overview"
    >
      {/* Hero card skeleton */}
      <div className="rounded-[28px] border border-[var(--cr-border)] bg-white p-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <div className="mb-2 h-3 w-28 rounded bg-gray-100" />
            <div className="mb-3 h-8 w-72 rounded bg-gray-100" />
            <div className="h-3.5 w-full max-w-xl rounded bg-gray-100" />
            <div className="mt-2 h-3.5 w-2/3 rounded bg-gray-100" />
            <div className="mt-5 flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-7 w-36 rounded-full bg-gray-100" />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-4 h-14 w-full rounded-[24px] bg-gray-100" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[50px] rounded-xl bg-gray-100" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards grid */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-[24px] border border-[var(--cr-border)] bg-white p-5">
            <div className="mb-3 h-3 w-24 rounded bg-gray-100" />
            <div className="mb-2 h-8 w-36 rounded bg-gray-100" />
            <div className="h-3 w-48 rounded bg-gray-100" />
          </div>
        ))}
      </div>

      {/* Trend + watchlist two-column row */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <div className="rounded-[24px] border border-[var(--cr-border)] bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="mb-2 h-3 w-24 rounded bg-gray-100" />
              <div className="h-6 w-40 rounded bg-gray-100" />
            </div>
            <div className="h-6 w-24 rounded-full bg-gray-100" />
          </div>
          <div className="h-[300px] w-full rounded-xl bg-gray-100" />
        </div>
        <div className="rounded-[24px] border border-[var(--cr-border)] bg-white p-6">
          <div className="mb-2 h-3 w-24 rounded bg-gray-100" />
          <div className="mb-4 h-6 w-48 rounded bg-gray-100" />
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[88px] rounded-[20px] bg-gray-100" />
            ))}
          </div>
          <div className="mt-5 h-[120px] rounded-[24px] bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
