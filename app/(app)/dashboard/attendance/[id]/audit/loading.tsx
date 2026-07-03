export default function AuditLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="w-full animate-pulse">
        {/* Header w/ back button */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-7 w-7 rounded bg-gray-100" />
          <div>
            <div className="mb-1.5 h-5 w-28 rounded bg-gray-100" />
            <div className="h-3 w-56 rounded bg-gray-100" />
          </div>
        </div>
        {/* Timeline skeleton */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex gap-3">
              {/* Dot + line */}
              <div className="flex flex-col items-center">
                <div className="h-3 w-3 rounded-full bg-gray-100" />
                {i < 6 && <div className="my-1 h-12 w-px flex-1 bg-gray-100" />}
              </div>
              {/* Content card */}
              <div className="flex-1 rounded-lg border border-[var(--cr-border)] bg-white p-3">
                <div className="mb-1.5 h-3.5 w-40 rounded bg-gray-100" />
                <div className="mb-1 h-3 w-56 rounded bg-gray-100" />
                <div className="h-3 w-32 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
