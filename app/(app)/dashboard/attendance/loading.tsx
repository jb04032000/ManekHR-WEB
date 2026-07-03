export default function AttendanceLoading() {
  return (
    <div className="w-full animate-pulse">
      {/* Page header skeleton */}
      <div className="mb-6 flex items-center gap-4 rounded-xl border border-[var(--cr-border)] bg-white p-5">
        <div className="h-14 w-14 flex-shrink-0 rounded-xl bg-gray-100" />
        <div className="flex-1">
          <div className="mb-2 h-5 w-48 rounded bg-gray-100" />
          <div className="h-3.5 w-72 rounded bg-gray-100" />
        </div>
        <div className="h-8 w-32 rounded-lg bg-gray-100" />
      </div>
      {/* Summary chips row */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 w-32 rounded-lg bg-gray-100" />
        ))}
      </div>
      {/* Filter chip row skeleton */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-gray-100" />
        ))}
      </div>
      {/* Table skeleton */}
      <div className="rounded-xl border border-[var(--cr-border)] bg-white p-4">
        <div className="mb-3 flex items-center gap-3 border-b border-[var(--cr-border)] pb-3">
          <div className="h-4 w-4 rounded bg-gray-100" />
          <div className="h-3.5 w-32 rounded bg-gray-100" />
          <div className="ml-auto h-3.5 w-24 rounded bg-gray-100" />
        </div>
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-[var(--cr-border)] py-3 last:border-b-0"
          >
            <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gray-100" />
            <div className="flex-1">
              <div className="mb-1.5 h-3.5 w-40 rounded bg-gray-100" />
              <div className="h-3 w-28 rounded bg-gray-100" />
            </div>
            <div className="h-3.5 w-20 rounded bg-gray-100" />
            <div className="h-5 w-16 rounded-full bg-gray-100" />
            <div className="h-8 w-8 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
