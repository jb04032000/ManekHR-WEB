// Route-level skeleton for the Attendance Regularizations page (Pillar 4 / AC-4.3).
// Mirrors regularizations/page.tsx section-for-section: p-6 container, page header
// (icon + title + right-side info tooltip), the 3-item Tabs bar (Pending/My/All),
// then the request table (DsTable inside RegularizationList).
// Server-only: no 'use client', no hooks, no i18n - skeletons are visual placeholders.
// Keep counts/spacing in sync with the sibling attendance loaders (grid/anomalies).
export default function RegularizationsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse p-6">
      {/* Header: icon + title block + right-side info tooltip placeholder */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gray-100" />
          <div>
            <div className="mb-2 h-5 w-44 rounded bg-gray-100" />
            <div className="h-3.5 w-72 rounded bg-gray-100" />
          </div>
        </div>
        <div className="h-7 w-7 rounded-full bg-gray-100" />
      </div>
      {/* Tabs bar: Pending for me / My requests / All requests */}
      <div className="mb-4 flex items-center gap-6 border-b border-[var(--cr-border)] pb-3">
        <div className="h-4 w-28 rounded bg-gray-100" />
        <div className="h-4 w-24 rounded bg-gray-100" />
        <div className="h-4 w-24 rounded bg-gray-100" />
      </div>
      {/* Request table */}
      <div className="rounded-xl border border-[var(--cr-border)] bg-white p-4">
        {/* Column-header row */}
        <div className="mb-3 h-9 w-full rounded bg-gray-100" />
        {/* Body rows */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="mb-2 h-9 w-full rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
