import type { Metadata } from 'next';
import { Suspense } from 'react';
import InvitePage from './InvitePage';

export const metadata: Metadata = {
  title: 'Accept Invite',
  description: 'Accept your ManekHR workspace or team invitation.',
};

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-page">
          <div className="text-center text-sm text-subtle">Loading invite…</div>
        </main>
      }
    >
      <InvitePage />
    </Suspense>
  );
}
