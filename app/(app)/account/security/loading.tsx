export default function SecurityLoading() {
  return (
    <div className="w-full animate-pulse">
      <div className="mb-6">
        <div className="mb-2 h-5 w-32 rounded bg-gray-100" />
        <div className="h-3.5 w-64 rounded bg-gray-100" />
      </div>
      {/* Password card */}
      <div className="mb-6 rounded-[14px] border border-border bg-surface px-6 py-5">
        <div className="mb-4 border-b border-border-light pb-4">
          <div className="mb-2 h-4 w-40 rounded bg-gray-100" />
          <div className="h-3 w-72 rounded bg-gray-100" />
        </div>
        <div className="mb-4 h-11 w-full rounded-lg bg-gray-100" />
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="h-11 rounded-lg bg-gray-100" />
          <div className="h-11 rounded-lg bg-gray-100" />
        </div>
        <div className="h-10 w-36 rounded-lg bg-gray-100" />
      </div>
      {/* App lock card */}
      <div className="rounded-[14px] border border-border bg-surface px-6 py-5">
        <div className="mb-4 flex items-center justify-between border-b border-border-light pb-4">
          <div>
            <div className="mb-2 h-4 w-32 rounded bg-gray-100" />
            <div className="h-3 w-56 rounded bg-gray-100" />
          </div>
          <div className="h-6 w-16 rounded-full bg-gray-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-lg bg-gray-100" />
          <div className="h-10 w-32 rounded-lg bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
