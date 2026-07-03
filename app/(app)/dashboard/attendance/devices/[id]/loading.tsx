export default function DeviceDetailLoading() {
  return (
    <div className="w-full animate-pulse">
      {/* Breadcrumb skeleton */}
      <div className="mb-4 flex items-center gap-2">
        <div className="h-3 w-20 rounded bg-gray-100" />
        <div className="h-3 w-1 rounded bg-gray-100" />
        <div className="h-3 w-16 rounded bg-gray-100" />
      </div>
      {/* Back button + page header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-8 w-32 rounded-lg bg-gray-100" />
      </div>
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-[var(--cr-border)] bg-white p-5">
        <div className="h-12 w-12 flex-shrink-0 rounded-xl bg-gray-100" />
        <div className="flex-1">
          <div className="mb-2 h-5 w-56 rounded bg-gray-100" />
          <div className="h-3.5 w-44 rounded bg-gray-100" />
        </div>
        <div className="h-6 w-20 rounded-full bg-gray-100" />
      </div>
      {/* Action buttons row */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-24 rounded-lg bg-gray-100" />
        ))}
      </div>
      {/* Descriptions skeleton - 6 fields, 2 columns */}
      <div className="mb-6 rounded-xl border border-[var(--cr-border)] bg-white p-5">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i}>
              <div className="mb-1.5 h-3 w-20 rounded bg-gray-100" />
              <div className="h-4 w-32 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
      {/* Events table */}
      <div className="rounded-xl border border-[var(--cr-border)] bg-white p-4">
        <div className="mb-3 flex items-center gap-3 border-b border-[var(--cr-border)] pb-3">
          <div className="h-3.5 w-32 rounded bg-gray-100" />
          <div className="ml-auto h-8 w-24 rounded-lg bg-gray-100" />
        </div>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-[var(--cr-border)] py-3 last:border-b-0"
          >
            <div className="h-3.5 w-32 rounded bg-gray-100" />
            <div className="h-3.5 w-20 rounded bg-gray-100" />
            <div className="h-3.5 w-28 rounded bg-gray-100" />
            <div className="h-3.5 w-20 rounded bg-gray-100" />
            <div className="ml-auto h-3.5 w-16 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
