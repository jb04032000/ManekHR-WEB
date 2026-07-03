// Co-located route skeleton for the workspace onboarding page (AC-3.5, binding
// rule in crewroster-web/CLAUDE.md). Mirrors the real layout: centered hero
// icon + title + subtitle, then a card holding two stacked form sections (your
// details, workspace details). Server-only (no 'use client', no hooks) so it
// renders instantly during the route transition; aria-hidden so SRs skip it.
export default function WorkspaceOnboardingLoading() {
  return (
    <div className="mx-auto max-w-[600px] animate-pulse" aria-hidden="true">
      {/* Hero block */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 h-16 w-16 rounded-[20px] bg-gray-100" />
        <div className="mb-2 h-7 w-64 rounded bg-gray-100" />
        <div className="h-4 w-48 rounded bg-gray-100" />
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-[var(--cr-border)] bg-white p-6 shadow-sm">
        {/* Your details section */}
        <div className="mb-6">
          <div className="mb-3 h-2.5 w-24 rounded bg-gray-100" />
          <div className="mb-2 h-3 w-20 rounded bg-gray-100" />
          <div className="h-10 w-full rounded-lg bg-gray-100" />
        </div>
        {/* Workspace details section */}
        <div className="mb-6">
          <div className="mb-3 h-2.5 w-32 rounded bg-gray-100" />
          <div className="mb-2 h-3 w-24 rounded bg-gray-100" />
          <div className="mb-4 h-10 w-full rounded-lg bg-gray-100" />
          <div className="mb-2 h-3 w-20 rounded bg-gray-100" />
          <div className="h-10 w-full rounded-lg bg-gray-100" />
        </div>
        {/* Submit button */}
        <div className="h-11 w-full rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}
