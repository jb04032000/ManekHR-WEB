import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { listMyJobs } from '@/features/connect/jobs/jobs.actions';
import { getWallet } from '@/features/connect/ads/ads.actions';
import { getMe } from '@/lib/actions/auth.actions';
import BoostComposer from '@/features/connect/ads/BoostComposer';
import BoostLoadError from '@/features/connect/ads/BoostLoadError';

/**
 * /connect/boost/job/[jobId] - the Boost composer for a job (Phase 5). Reuses
 * the shipped <BoostComposer> with a job target.
 *
 * Owner + open guard: `listMyJobs` returns only the caller's own jobs, and the
 * job must be `open` (mirrors the backend boost gate). Anything else redirects
 * to the jobs hub. The backend re-enforces ownership + open + no-duplicate on
 * submit. Person-centric: no workspaceId, no <Can>.
 */

interface Props {
  params: Promise<{ jobId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;
  const t = await getTranslations('connect.ads.boost');
  return { title: t('metaTitleJob'), robots: { index: false, follow: false } };
}

export default async function BoostJobPage({ params }: Props) {
  const { jobId } = await params;

  // getMe is for the viewer's display name only (a prefill); guard it so an auth
  // blip degrades to no-prefill instead of throwing the page to the error
  // boundary (getMe throws, unlike the ActionResult reads beside it).
  const [mineRes, walletRes, me] = await Promise.all([
    listMyJobs(),
    getWallet(),
    getMe().catch(() => null),
  ]);
  if (!mineRes.ok) {
    // The own-jobs read FAILED (outage/transient) - distinct from a job that is
    // genuinely not boostable. Show a retryable error instead of a silent bounce.
    return <BoostLoadError retryHref={`/connect/boost/job/${jobId}`} backHref="/connect/jobs" />;
  }

  const job = mineRes.data.find((item) => item._id === jobId);
  if (!job || job.status !== 'open') {
    redirect('/connect/jobs');
  }

  return (
    <BoostComposer
      job={{ _id: job._id, title: job.title, category: job.category }}
      wallet={walletRes.ok ? walletRes.data : null}
      viewerName={me?.name}
    />
  );
}
