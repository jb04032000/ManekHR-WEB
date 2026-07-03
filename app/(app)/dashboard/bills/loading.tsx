// Co-located loading skeleton for the Bills route (binding loading.tsx rule).
// Mirrors the real page section-for-section: 4 summary KPI cards, the Card title
// + Add button, the payable/receivable tab strip, and the bills table rows — so
// the swap to content is shift-free.
export default function BillsLoading() {
  return (
    <div className="w-full animate-pulse" aria-hidden>
      {/* 4 summary KPI cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-[14px] bg-gray-100 px-5 py-4">
            <div className="mb-2 h-3 w-20 rounded bg-gray-200" />
            <div className="h-6 w-24 rounded bg-gray-200" />
          </div>
        ))}
      </div>
      {/* Card with title + Add button */}
      <div className="rounded-xl border border-[var(--cr-border)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--cr-border)] p-4">
          <div className="h-5 w-40 rounded bg-gray-100" />
          <div className="h-8 w-28 rounded-lg bg-gray-100" />
        </div>
        {/* Payable / Receivable tab strip */}
        <div className="flex gap-6 border-b border-[var(--cr-border)] px-4 pt-3">
          <div className="mb-3 h-4 w-24 rounded bg-gray-100" />
          <div className="mb-3 h-4 w-24 rounded bg-gray-100" />
        </div>
        {/* Table rows */}
        <div className="p-4">
          <div className="mb-3 flex items-center gap-3 border-b border-[var(--cr-border)] pb-3">
            <div className="h-3.5 w-32 rounded bg-gray-100" />
            <div className="ml-auto h-3.5 w-20 rounded bg-gray-100" />
          </div>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 border-b border-[var(--cr-border)] py-3 last:border-b-0"
            >
              <div className="flex-1">
                <div className="mb-1.5 h-3.5 w-40 rounded bg-gray-100" />
                <div className="h-3 w-28 rounded bg-gray-100" />
              </div>
              <div className="h-3.5 w-20 rounded bg-gray-100" />
              <div className="h-3.5 w-20 rounded bg-gray-100" />
              <div className="h-5 w-16 rounded-full bg-gray-100" />
              <div className="h-8 w-20 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
