import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  listMyIntroductions,
  listPendingIntroductions,
  listReceivedIntroductions,
} from '@/features/connect/introductions/introductions.actions';
import IntroductionsList from '@/features/connect/introductions/IntroductionsList';
import type { IntroducePerson } from '@/features/connect/introductions/IntroduceComposer';
import { getMyConnectProfile } from '@/features/connect/profile.actions';
import { listConnections, getPeople } from '@/features/connect/network.actions';

/**
 * `/connect/introductions` - the Broker Introductions home (anti-gaming core,
 * Slice 2).
 *
 * What: SSR-fetches the caller's to-confirm queue + their broker contact book +
 *   the confirmed introductions they received (for the broker-review section),
 *   reads the own Connect profile for the `isBroker` gate, and (for a broker)
 *   hydrates their connections into pickable people for the Introduce composer.
 *   Renders IntroductionsList (client) which handles confirm/decline + the
 *   composer modal + the broker-review modal.
 *
 * Cross-module links:
 *   - introductions.actions wrap /connect/introductions (BE introductions module).
 *   - getMyConnectProfile reads ConnectProfile.isBroker (broker gate, profile module).
 *   - listConnections + getPeople hydrate the broker's connections (network module);
 *     mirrors how the network people-cards resolve ids to identity.
 *
 * Watch: visible to ALL signed-in users (the to-confirm queue is for everyone);
 *   only the Introduce trigger is broker-gated. Co-located loading.tsx mirrors
 *   this layout section-for-section (binding rule).
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('connect.introductions');
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    robots: { index: false, follow: false },
  };
}

export default async function ConnectIntroductionsPage() {
  // Fetch the three lists + the broker flag in parallel. Each action is failure-safe
  // (returns ActionResult), so a miss degrades to an empty section, never a throw.
  // `received` defaults BE-side to confirmed introductions (the reviewable ones).
  const [pendingRes, mineRes, receivedRes, profileRes] = await Promise.all([
    listPendingIntroductions(),
    listMyIntroductions(),
    listReceivedIntroductions(),
    getMyConnectProfile(),
  ]);

  const isBroker = profileRes.ok ? !!profileRes.data.isBroker : false;

  // Only a broker needs the connection list (the composer's pickers). Hydrate the
  // connection ids to people identity in one batch; a miss leaves an empty picker.
  let people: IntroducePerson[] = [];
  if (isBroker) {
    const connRes = await listConnections();
    const ids = connRes.ok ? connRes.data.map((c) => c.userId) : [];
    if (ids.length > 0) {
      const peopleRes = await getPeople(ids);
      if (peopleRes.ok) {
        people = peopleRes.data.map((p) => ({
          userId: p.userId,
          name: p.name,
          avatar: p.avatar,
        }));
      }
    }
  }

  return (
    <div className="mx-auto w-full" style={{ maxWidth: 'var(--cn-content-max-w, 1180px)' }}>
      <IntroductionsList
        initialPending={pendingRes.ok ? pendingRes.data : []}
        initialMine={mineRes.ok ? mineRes.data : []}
        initialReceived={receivedRes.ok ? receivedRes.data : []}
        isBroker={isBroker}
        people={people}
      />
    </div>
  );
}
