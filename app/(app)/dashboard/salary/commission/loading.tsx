/**
 * Suspense-level skeleton for the Salary Commission page.
 * Mirrors the page layout: header, tab bar (entries / scheduled / YTD), and a
 * commission table card with rows.
 *
 * Server Component - no 'use client'. aria-label is a plain string. Added by
 * the salary hardening pass so the commission sub-route ships a matched skeleton.
 */
export default function SalaryCommissionLoading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl animate-pulse p-6"
      role="status"
      aria-busy="true"
      aria-label="Loading commission"
    >
      {/* Page header skeleton */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-100" />
        <div>
          <div className="mb-2 h-5 w-52 rounded bg-gray-100" />
          <div className="h-3.5 w-72 rounded bg-gray-100" />
        </div>
      </div>

      {/* Tab bar */}
      <div className="mb-4 flex items-center gap-4 border-b border-[var(--cr-border)] pb-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-7 w-28 rounded bg-gray-100" />
        ))}
        <div className="ml-auto h-9 w-36 rounded-lg bg-gray-100" />
      </div>

      {/* Commission table card */}
      <div className="rounded-xl border border-[var(--cr-border-light)] bg-white p-4">
        <div className="mb-2 flex gap-3 border-b border-[var(--cr-border)] pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 flex-1 rounded bg-gray-100" />
          ))}
        </div>
        <div className="flex flex-col gap-3 pt-2">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gray-100" />
              <div className="h-4 flex-1 rounded bg-gray-100" />
              <div className="h-4 w-24 rounded bg-gray-100" />
              <div className="h-6 w-16 rounded-full bg-gray-100" />
              <div className="h-8 w-8 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
