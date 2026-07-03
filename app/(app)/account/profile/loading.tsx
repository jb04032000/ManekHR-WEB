export default function ProfileLoading() {
  return (
    <div className="w-full animate-pulse">
      {/* SectionHeader skeleton */}
      <div className="mb-6">
        <div className="mb-2 h-5 w-32 rounded bg-gray-100" />
        <div className="h-3.5 w-64 rounded bg-gray-100" />
      </div>
      {/* Header card skeleton (avatar + name + meta) */}
      <div className="mb-6 flex items-center gap-4 rounded-[14px] border border-border bg-surface px-6 py-5">
        <div className="h-16 w-16 flex-shrink-0 rounded-full bg-gray-100" />
        <div className="flex-1">
          <div className="mb-2 h-5 w-48 rounded bg-gray-100" />
          <div className="h-3.5 w-72 rounded bg-gray-100" />
        </div>
        <div className="h-9 w-24 rounded-lg bg-gray-100" />
      </div>
      {/* Personal details card skeleton */}
      <div className="rounded-[14px] border border-border bg-surface px-6 py-5">
        <div className="mb-4 flex items-center justify-between border-b border-border-light pb-4">
          <div>
            <div className="mb-2 h-4 w-36 rounded bg-gray-100" />
            <div className="h-3 w-56 rounded bg-gray-100" />
          </div>
          <div className="h-9 w-20 rounded-lg bg-gray-100" />
        </div>
        <div className="mb-4 h-11 w-full rounded-lg bg-gray-100" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="h-11 rounded-lg bg-gray-100" />
          <div className="h-11 rounded-lg bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
