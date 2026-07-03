export default function AttendanceGridLoading() {
  return (
    <div className="mx-auto w-full max-w-[100rem] animate-pulse p-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gray-100" />
        <div>
          <div className="mb-2 h-5 w-44 rounded bg-gray-100" />
          <div className="h-3.5 w-72 rounded bg-gray-100" />
        </div>
      </div>
      {/* Grid */}
      <div className="rounded-xl border border-[var(--cr-border)] bg-white p-4">
        <div className="mb-3 h-9 w-64 rounded bg-gray-100" />
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="mb-2 h-9 w-full rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}
