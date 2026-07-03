import { redirect } from 'next/navigation';

/**
 * `/account` root - redirects to the canonical landing (Profile). The
 * `AccountShell` renders the sub-nav for the four account routes; this stub
 * makes a bare `/account` URL useful as a Settings entry point (the top-
 * header account menu links here).
 */
export default function AccountRootPage() {
  redirect('/account/profile');
}
