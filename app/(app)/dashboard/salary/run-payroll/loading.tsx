/**
 * Suspense-level skeleton for the Run Payroll page.
 * Mirrors the page layout: header with period picker, 4 stat tiles,
 * filter chip bar, and the payroll worklist table card.
 *
 * Server Component - no 'use client'. aria-label uses a plain string
 * (not useTranslations()) because that hook requires a Client Component.
 */
export default function SalaryRunPayrollLoading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl animate-pulse p-6"
      role="status"
      aria-busy="true"
      aria-label="Loading run payroll"
    >
      {/* Page header with period picker */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gray-100" />
          <div>
            <div className="mb-2 h-5 w-44 rounded bg-gray-100" />
            <div className="h-3.5 w-56 rounded bg-gray-100" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-gray-100" />
          <div className="h-9 w-36 rounded-lg bg-gray-100" />
          <div className="h-9 w-9 rounded-lg bg-gray-100" />
          <div className="h-9 w-28 rounded-lg bg-gray-100" />
        </div>
      </div>

      {/* 4 stat tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[88px] rounded-xl border border-[var(--cr-border-subtle,rgba(0,0,0,0.06))] bg-white"
          />
        ))}
      </div>

      {/* Filter chip bar */}
      <div className="mb-3 flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-gray-100" />
        ))}
      </div>

      {/* Payroll worklist table card */}
      <div className="rounded-xl border border-[var(--cr-border-light)] bg-white p-4">
        {/* Toolbar */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="h-9 w-52 rounded-lg bg-gray-100" />
          <div className="flex gap-2">
            <div className="h-9 w-28 rounded-lg bg-gray-100" />
            <div className="h-9 w-28 rounded-lg bg-gray-100" />
          </div>
        </div>

        {/* Table header */}
        <div className="mb-2 flex gap-3 border-b border-[var(--cr-border)] pb-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
              <div className="h-8 w-24 rounded-lg bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
