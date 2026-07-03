export default function WorkspaceLoading() {
  return (
    <div className="w-full animate-pulse">
      {/* Overview card skeleton */}
      <div className="mb-10 flex items-center gap-4 rounded-xl border border-[var(--cr-border)] bg-white p-5">
        <div className="h-14 w-14 flex-shrink-0 rounded-xl bg-gray-100" />
        <div className="flex-1">
          <div className="mb-2 h-5 w-48 rounded bg-gray-100" />
          <div className="h-3.5 w-32 rounded bg-gray-100" />
        </div>
        <div className="h-8 w-24 rounded-lg bg-gray-100" />
      </div>
      {/* Section skeleton */}
      <div className="mb-5 flex items-center gap-2.5">
        <div className="h-5 w-1 rounded-full bg-gray-100" />
        <div>
          <div className="mb-1.5 h-3 w-20 rounded bg-gray-100" />
          <div className="h-2.5 w-40 rounded bg-gray-100" />
        </div>
      </div>
      {/* Card skeleton row */}
      <div className="mb-12 flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-[var(--cr-border)] bg-white p-4"
          >
            <div className="h-10 w-10 flex-shrink-0 rounded-[10px] bg-gray-100" />
            <div className="flex-1">
              <div className="mb-2 h-3.5 w-40 rounded bg-gray-100" />
              <div className="h-3 w-56 rounded bg-gray-100" />
            </div>
            <div className="h-5 w-16 rounded-full bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
