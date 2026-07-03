import { redirect } from 'next/navigation';

/**
 * /connect/boost/results/[boostId] - LEGACY redirect.
 *
 * The per-boost report is now a slide-over drawer on the Boosts list, not a
 * standalone page (better in-context UX after launch). This route is kept only so
 * old links / bookmarks keep working: it forwards to the list with `?boost=<id>`,
 * which BoostsManagerScreen reads to open BoostResultsDrawer on mount. The drawer
 * resolves the boost from the list (or a JWT-scoped getBoost fallback), so a
 * missing / foreign id simply lands on the list with no drawer (never a leak).
 *
 * Cross-module: app/connect/boosts/page.tsx (reads `?boost=`) ->
 * BoostsManagerScreen -> BoostResultsDrawer.
 */

interface Props {
  params: Promise<{ boostId: string }>;
}

export default async function ConnectBoostResultsPage({ params }: Props) {
  const { boostId } = await params;
  redirect(`/connect/boosts?boost=${boostId}`);
}
