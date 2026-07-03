export default function AnomaliesLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse p-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-100" />
        <div>
          <div className="mb-2 h-5 w-48 rounded bg-gray-100" />
          <div className="h-3.5 w-64 rounded bg-gray-100" />
        </div>
      </div>
      {/* Feed card */}
      <div className="mb-4 rounded-xl border border-[var(--cr-border)] bg-white p-4">
        {/* Toolbar */}
        <div className="mb-3 flex items-center gap-3">
          <div className="h-8 w-64 rounded-lg bg-gray-100" />
          <div className="ml-auto h-8 w-24 rounded-lg bg-gray-100" />
        </div>
        {/* Table rows */}
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="mb-2 h-9 w-full rounded bg-gray-100" />
        ))}
      </div>
      {/* Rules card */}
      <div className="rounded-xl border border-[var(--cr-border)] bg-white p-4">
        <div className="mb-3 h-5 w-36 rounded bg-gray-100" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="mb-2 h-9 w-full rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
