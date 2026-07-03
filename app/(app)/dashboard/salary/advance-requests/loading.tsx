/**
 * Suspense skeleton for the advance-requests approval queue route. Mirrors the
 * page section-for-section: a page header (title + subtitle) and the pending
 * requests table, so the swap to content is shift-free.
 *
 * Server Component - no 'use client' (the route-loading binding rule).
 */
export default function AdvanceRequestsLoading() {
  return (
    <div
      className="w-full animate-pulse space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Loading advance requests"
    >
      {/* Page header (title + subtitle) */}
      <div>
        <div className="mb-2 h-7 w-48 rounded bg-gray-100" />
        <div className="h-4 w-80 max-w-full rounded bg-gray-100" />
      </div>

      {/* Queue table card */}
      <div className="rounded-2xl border border-[var(--cr-border)] bg-white p-4">
        <div className="mb-3 grid grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 w-full rounded bg-gray-100" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, r) => (
          <div key={r} className="mb-3 grid grid-cols-6 gap-3 border-t border-gray-50 pt-3">
            {Array.from({ length: 6 }).map((_, c) => (
              <div key={c} className="h-4 w-full rounded bg-gray-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
