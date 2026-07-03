'use client';

import { LockOverlay } from '@/components/auth/LockOverlay';

/**
 * Connect smart-entry - the App-Locked branch.
 *
 * `/connect/home` is a Server Component: its entry-state fetch runs during SSR,
 * before the client-side App Lock gate in `DashboardLayout` can suppress
 * anything. When that fetch 423s (the session is App-Locked), the smart-entry
 * renders this instead of mis-degrading to the "coming soon" panel - it shows
 * the PIN unlock screen directly (which `DashboardLayout` does not render for
 * admins), and hard-reloads once the user unlocks so the server component
 * re-runs against the now-unlocked session.
 */
export default function ConnectLockedEntry() {
  return (
    <LockOverlay
      open
      onUnlocked={() => {
        if (typeof window !== 'undefined') window.location.reload();
      }}
    />
  );
}
