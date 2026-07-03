export default function DevicesLoading() {
  return (
    <div className="w-full animate-pulse">
      <div className="mb-6">
        <div className="mb-2 h-5 w-32 rounded bg-gray-100" />
        <div className="h-3.5 w-64 rounded bg-gray-100" />
      </div>
      <div className="rounded-[14px] border border-border bg-surface px-6 py-5">
        <div className="mb-4 flex items-center justify-between border-b border-border-light pb-4">
          <div>
            <div className="mb-2 h-4 w-32 rounded bg-gray-100" />
            <div className="h-3 w-56 rounded bg-gray-100" />
          </div>
          <div className="h-9 w-44 rounded-lg bg-gray-100" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-border-light px-3 py-2"
            >
              <div className="h-5 w-5 flex-shrink-0 rounded bg-gray-100" />
              <div className="flex-1">
                <div className="mb-1 h-4 w-40 rounded bg-gray-100" />
                <div className="h-3 w-24 rounded bg-gray-100" />
              </div>
              <div className="h-7 w-16 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
