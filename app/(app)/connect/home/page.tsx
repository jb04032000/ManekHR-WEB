import { redirect } from 'next/navigation';

/**
 * `/connect/home` is retired - the Connect home is the feed (`/connect/feed`).
 * The Day-1 welcome page it used to render was a Phase-1 bootstrap; the real
 * feed (Phase 3) is now the landing. This stub redirects stray bookmarks and
 * old links so they never 404. See
 * docs/connect/specs/2026-05-19-connect-home-feed-landing.md.
 */
export default function ConnectHomePage() {
  redirect('/connect/feed');
}
