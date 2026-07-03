/**
 * Route skeleton for the Add Member wizard (/dashboard/team/new).
 * Mirrors the page anatomy section-for-section so the swap to content is
 * shift-free: header card (back arrow + title), wizard card with the 5-step
 * Steps bar, a form area (2-col field grid like PersonalTab, the first step),
 * and the Cancel / Next footer. Keep in sync with new/page.tsx layout.
 */
export default function AddMemberLoading() {
  return (
    <div aria-hidden className="flex w-full animate-pulse flex-col gap-5">
      {/* Header card - back button + title/subtitle */}
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--cr-border)] bg-white p-5 shadow-sm">
        <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-gray-100" />
        <div className="flex-1">
          <div className="mb-2 h-5 w-44 rounded bg-gray-100" />
          <div className="h-3.5 w-72 max-w-full rounded bg-gray-100" />
        </div>
      </div>

      {/* Wizard card */}
      <div className="rounded-2xl border border-[var(--cr-border)] bg-white p-5 shadow-sm md:p-6">
        {/* Steps bar - 5 dots with labels */}
        <div className="mb-10 flex items-center gap-3 px-1 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-1 items-center gap-2">
              <div className="h-7 w-7 flex-shrink-0 rounded-full bg-gray-100" />
              <div className="hidden h-3.5 w-16 rounded bg-gray-100 md:block" />
              {i < 5 && <div className="hidden h-px flex-1 bg-gray-100 md:block" />}
            </div>
          ))}
        </div>

        {/* Form area - section label + 2-col field grid (mirrors PersonalTab) */}
        <div className="min-h-[400px]">
          <div className="mb-5 h-3.5 w-40 rounded bg-gray-100" />
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i}>
                <div className="mb-2 h-3 w-28 rounded bg-gray-100" />
                <div className="h-10 w-full rounded-lg bg-gray-100" />
              </div>
            ))}
          </div>
        </div>

        {/* Footer - Cancel left, Next right */}
        <div className="mt-6 flex items-center justify-between gap-2 border-t border-[var(--cr-border)] pt-5">
          <div className="h-8 w-24 rounded-lg bg-gray-100" />
          <div className="h-8 w-36 rounded-lg bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
