'use client';

/**
 * InvitationsTab - the Network screen's "Invitations" panel.
 *
 * A connection request is symmetric and needs the other person's consent
 * (distinct from a follow, which is one-way). Three sub-boxes:
 *  - Received - requests sent TO the viewer; Accept / Ignore.
 *  - Sent     - requests the viewer SENT and that are still pending; Withdraw.
 *  - Archive  - requests already answered or withdrawn (read-only history).
 *
 * The Server Component hands down the already-loaded `received` box. Switching
 * a sub-box re-fetches that box's requests + hydrates the people through the
 * `getPeople` batch lookup. A successful Accept / Ignore / Withdraw refreshes
 * the route so the nav badge and the Connections tab stay in sync.
 */

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { App as AntApp } from 'antd';
import { Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';
import SegmentedToggle from '@/components/ui/SegmentedToggle';
import { ConnectEmptyState } from '@/components/connect';
import { useNotificationEvent } from '@/lib/connect/NotificationProvider';
import { NETWORK_CHANGED_EVENT } from './useNetworkBadge';
import {
  listInvitations,
  respondToConnectionRequest,
  withdrawConnectionRequest,
} from '../network.actions';
import type { ConnectionRequest, InvitationBox } from '../network.types';
import { hydratePeople, type PeopleIndex } from './hydrate';
import InvitationRow from './InvitationRow';
import { NetworkTabError, NetworkTabSkeleton } from './NetworkTabStates';

interface InvitationsTabProps {
  /** The `received` box, pre-loaded by the Server Component. */
  initialRequests: ConnectionRequest[];
  /** Hydrated people for `initialRequests`, keyed by `userId`. */
  initialPeople: PeopleIndex;
}

const BOXES: InvitationBox[] = ['received', 'sent', 'archive'];

/**
 * Pick the OTHER person on a request from the viewer's seat. On a received
 * request that is the sender; on a sent request that is the recipient.
 */
function counterpartId(request: ConnectionRequest, box: InvitationBox): string {
  return box === 'received' ? request.fromUserId : request.toUserId;
}

export default function InvitationsTab({ initialRequests, initialPeople }: InvitationsTabProps) {
  const t = useTranslations('connect.network.invitations');
  const tPerson = useTranslations('connect.network.person');
  const router = useRouter();
  const { message } = AntApp.useApp();

  const [box, setBox] = useState<InvitationBox>('received');
  const [requests, setRequests] = useState<ConnectionRequest[]>(initialRequests);
  const [people, setPeople] = useState<PeopleIndex>(initialPeople);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  /** Request ids with an action in flight - disables that row's buttons. */
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [, startRefresh] = useTransition();

  /**
   * Fetch + hydrate one sub-box. Called from the sub-filter event handler (not
   * an effect - a box switch is a user action, not external synchronization).
   * The `received` box is pre-loaded by the Server Component for first paint.
   */
  const loadBox = useCallback(async (next: InvitationBox) => {
    setLoading(true);
    setLoadError(false);
    const res = await listInvitations(next);
    if (!res.ok) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    const ids = res.data.map((request) => counterpartId(request, next));
    const index = await hydratePeople(ids);
    setRequests(res.data);
    setPeople(index);
    setLoading(false);
  }, []);

  /** Switch the active sub-box and fetch its (possibly stale) contents. */
  const selectBox = useCallback(
    (next: InvitationBox) => {
      if (next === box) return;
      setBox(next);
      void loadBox(next);
    },
    [box, loadBox],
  );

  // Phase 7a - live update: when a new connection request arrives (socket
  // push via the shared provider) AND the viewer is on the `received` box,
  // refetch so the row appears without a tab switch / manual refresh. Other
  // boxes (sent / archive) don't change on an incoming request, so we skip
  // them to avoid a needless fetch.
  useNotificationEvent(
    useCallback(
      (event) => {
        if (event.category === 'connect.connection_requested' && box === 'received') {
          void loadBox('received');
        }
      },
      [box, loadBox],
    ),
  );

  const setBusy = useCallback((id: string, on: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /** Accept or ignore a received request. */
  const respond = useCallback(
    async (request: ConnectionRequest, action: 'accept' | 'ignore') => {
      setBusy(request._id, true);
      const res = await respondToConnectionRequest(request._id, action);
      setBusy(request._id, false);
      if (!res.ok) {
        message.error(res.error || t('actionError'));
        return;
      }
      message.success(action === 'accept' ? t('accepted') : t('ignored'));
      setRequests((prev) => prev.filter((r) => r._id !== request._id));
      startRefresh(() => router.refresh());
      // Notify the tab-count badges (NetworkScreen) + sidebar/mobile badge.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(NETWORK_CHANGED_EVENT));
      }
    },
    [message, router, setBusy, t],
  );

  /** Withdraw a request the viewer sent. */
  const withdraw = useCallback(
    async (request: ConnectionRequest) => {
      setBusy(request._id, true);
      const res = await withdrawConnectionRequest(request._id);
      setBusy(request._id, false);
      if (!res.ok) {
        message.error(res.error || t('actionError'));
        return;
      }
      message.success(t('withdrawn'));
      setRequests((prev) => prev.filter((r) => r._id !== request._id));
      startRefresh(() => router.refresh());
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(NETWORK_CHANGED_EVENT));
      }
    },
    [message, router, setBusy, t],
  );

  const boxOptions = useMemo(
    () => BOXES.map((b) => ({ value: b, label: t(`boxes.${b}` as Parameters<typeof t>[0]) })),
    [t],
  );

  const emptyCopy = useMemo(
    () => ({
      received: {
        title: t('empty.receivedTitle'),
        body: t('empty.receivedBody'),
        cta: { label: t('empty.browseSuggestions'), href: '/connect/network?tab=suggestions' },
      },
      sent: {
        title: t('empty.sentTitle'),
        body: t('empty.sentBody'),
        cta: { label: t('empty.browseSuggestions'), href: '/connect/network?tab=suggestions' },
      },
      // Archive is historical - no CTA; an empty archive is a sign the user is
      // current on their invites, not a dead-end that needs a forward path.
      archive: { title: t('empty.archiveTitle'), body: t('empty.archiveBody'), cta: undefined },
    }),
    [t],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-md)' }}>
      {/* Intrinsic-width sub-filter sitting on the wide ConnectPage column -
          a 3-option pill scans as a tight filter, not a stretched ribbon. */}
      <SegmentedToggle
        width="fit"
        options={boxOptions}
        value={box}
        onChange={(value) => selectBox(value as InvitationBox)}
      />

      {loading ? (
        <NetworkTabSkeleton rows={3} />
      ) : loadError ? (
        <NetworkTabError onRetry={() => void loadBox(box)} />
      ) : requests.length === 0 ? (
        <ConnectEmptyState
          variant="inline"
          icon={<Inbox size={24} aria-hidden />}
          title={emptyCopy[box].title}
          description={emptyCopy[box].body}
          primaryAction={emptyCopy[box].cta}
        />
      ) : (
        <ul
          aria-label={t('boxAria')}
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--cr-space-sm)',
          }}
        >
          {requests.map((request) => (
            <li key={request._id}>
              <InvitationRow
                request={request}
                box={box}
                userId={counterpartId(request, box)}
                people={people}
                fallbackName={tPerson('fallbackName')}
                busy={busyIds.has(request._id)}
                onAccept={() => respond(request, 'accept')}
                onIgnore={() => respond(request, 'ignore')}
                onWithdraw={() => withdraw(request)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
