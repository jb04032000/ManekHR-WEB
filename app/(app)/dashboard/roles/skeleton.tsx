// Shared skeleton pieces for the Roles route. Used by BOTH the co-located
// loading.tsx (route-level, server component) and page.tsx (in-page loading
// states), so keep this file free of 'use client' and hooks. Mirrors the real
// page section-for-section (two-column: role-card grid | template rail) so the
// swap to content is shift-free. Keep in sync with page.tsx layout.

// One role card: icon square + name/description lines + members line + chips.
// Matches the real card anatomy in page.tsx (rounded-2xl, p-5).
export function RoleCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border-light bg-white p-5">
      <div className="mb-2.5 flex items-start gap-3">
        <div className="h-10 w-10 flex-shrink-0 rounded-[10px] bg-gray-100" />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 h-4 w-28 rounded bg-gray-100" />
          <div className="h-3 w-40 rounded bg-gray-100" />
        </div>
      </div>
      <div className="mb-2.5 h-3 w-32 rounded bg-gray-100" />
      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-5 w-16 rounded-full bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

// The role-card grid alone (no header/rail). page.tsx renders this while the
// roles list fetches, because the real header/rail are already on screen then.
export function RolesGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid animate-pulse gap-3"
      aria-hidden
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
    >
      {Array.from({ length: count }, (_, i) => (
        <RoleCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Full-page skeleton: header + grid + separator + template rail. Used by
// loading.tsx and by page.tsx while permissions/entitlements resolve (nothing
// real is on screen yet in those states).
export function RolesPageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5 lg:flex-row lg:items-start" aria-hidden>
      {/* Left: header (title + subtitle + New Role button) then role cards */}
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="mb-1.5 h-5 w-64 rounded bg-gray-100" />
            <div className="h-3 w-32 rounded bg-gray-100" />
          </div>
          <div className="h-8 w-28 rounded-lg bg-gray-100" />
        </div>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <RoleCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Vertical separator (lg+ only, same as the real page) */}
      <div
        className="hidden w-px flex-shrink-0 self-stretch bg-border-light lg:block"
        style={{ minHeight: 200 }}
      />

      {/* Right: template rail header + preset cards */}
      <div className="w-full flex-shrink-0 lg:w-72">
        <div className="mb-3">
          <div className="mb-1.5 h-5 w-52 rounded bg-gray-100" />
          <div className="h-3 w-44 rounded bg-gray-100" />
        </div>
        <div className="flex flex-col gap-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl border border-border-light p-4">
              <div className="mb-1.5 h-4 w-24 rounded bg-gray-100" />
              <div className="h-3 w-48 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
