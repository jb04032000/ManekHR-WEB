export default function AbsencePatternsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse p-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-100" />
        <div>
          <div className="mb-2 h-5 w-48 rounded bg-gray-100" />
          <div className="h-3.5 w-72 rounded bg-gray-100" />
        </div>
      </div>
      {/* KPI tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-[var(--cr-border)] bg-white" />
        ))}
      </div>
      {/* Weekday chart + bands */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="h-72 rounded-xl border border-[var(--cr-border)] bg-white lg:col-span-2" />
        <div className="h-72 rounded-xl border border-[var(--cr-border)] bg-white" />
      </div>
      {/* Table */}
      <div className="rounded-xl border border-[var(--cr-border)] bg-white p-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="mb-2 h-9 w-full rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
