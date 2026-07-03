import { redirect } from 'next/navigation';

/**
 * Phase 5 W3 - Settings/workspace consolidated into the workspace hub.
 * Account-shell sub-nav stays user-scoped (Profile / Security / Billing /
 * Devices); workspace-scoped settings (incl. maintenance lead time tile)
 * live in /dashboard/workspace under the Operations section.
 */
export default function SettingsWorkspaceRedirect() {
  redirect('/dashboard/workspace?section=operations');
}
