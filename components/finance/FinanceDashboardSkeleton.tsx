/**
 * Loading skeleton for the Billing & Accounts (finance) dashboard.
 *
 * Pure presentational component (no hooks / no 'use client') so it can be used
 * both by the route-level `loading.tsx` Suspense frame and by the page's own
 * client-side data-fetch loading state.
 *
 * Mirrors the REAL page structure (app/dashboard/finance/page.tsx) section for
 * section so the loading frame matches the content that resolves into it:
 *   1. "Sales" -> SalesKpiPanel: a card with a title row + 4 KPI tiles.
 *   2. "Financial Position" -> KpiDashboard: label row + 6 stat cards (2/3/6 col).
 *   3. RevenueTrendChart: a card with a title + range toggle + bar chart.
 *   4. "Quick Access" -> 4 link tiles (2/4 col).
 *
 * Content-only by design: the persistent app chrome (TopHeader) already renders
 * the "Billing & Accounts" title + breadcrumb during navigation AND data fetch,
 * so this skeleton must not redraw a page-title bar. White cards + gray-200 bars
 * give clear contrast against the cream page background, matching the crisp
 * Payroll / Salary Overview skeletons.
 */
function SectionLabel({ width = 'w-24' }: { width?: string }) {
  return <div className={`mb-3 h-3 rounded bg-gray-200 ${width}`} />;
}

export function FinanceDashboardSkeleton() {
  return (
    <div
      className="animate-pulse p-6"
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      {/* 1. Sales - This Month panel */}
      <section className="mb-8">
        <SectionLabel width="w-16" />
        <div className="rounded-xl border border-[var(--cr-border)] bg-white p-4">
          {/* card title row: "Sales - This Month" + View Invoices */}
          <div className="mb-4 flex items-center justify-between">
            <div className="h-4 w-40 rounded bg-gray-200" />
            <div className="h-7 w-28 rounded-lg bg-gray-200" />
          </div>
          {/* 4 KPI tiles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg border border-[var(--cr-border)] p-4">
                <div className="mb-2 h-3 w-20 rounded bg-gray-200" />
                <div className="h-5 w-24 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Financial Position - 6 stat cards */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-3 w-32 rounded bg-gray-200" />
          <div className="h-3 w-28 rounded bg-gray-200" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-[var(--cr-border)] bg-white p-4">
              <div className="mb-3 h-3 w-3/4 rounded bg-gray-200" />
              <div className="h-6 w-2/3 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </section>

      {/* 3. Revenue trend chart */}
      <section className="mb-8">
        <div className="rounded-xl border border-[var(--cr-border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="h-4 w-52 rounded bg-gray-200" />
            <div className="h-8 w-48 rounded-lg bg-gray-200" />
          </div>
          <div className="h-60 w-full rounded-lg bg-gray-200" />
        </div>
      </section>

      {/* 4. Quick Access tiles */}
      <section>
        <SectionLabel width="w-28" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-md border border-[var(--cr-border)] bg-white" />
          ))}
        </div>
      </section>
    </div>
  );
}
