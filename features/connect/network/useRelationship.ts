'use client';

/**
 * useRelationship - the single source of truth for the Connect / Follow
 * relationship controls, shared by the profile header (`ProfileConnectActions`)
 * and every people card (`PersonCardActions`).
 *
 * Holds the optimistic relationship state + the actions that mutate it:
 *   - connect   → send a request (captures the created request id so it can be
 *                 withdrawn without a refetch)
 *   - withdraw  → cancel a pending OUTGOING request
 *   - removeConnection → drop an accepted connection
 *   - accept / ignore  → respond to a pending INCOMING request
 *   - toggleFollow     → one-way follow / unfollow
 *
 * Every mutation is optimistic with rollback on failure, surfaces a toast, and
 * fires `NETWORK_CHANGED_EVENT` so the nav badge + tab counts refetch. Callers
 * that render server-loaded surfaces (the profile page) pass an `onChanged`
 * that runs `router.refresh()` to re-sync the SSR relationship.
 *
 * Confirmation for the destructive actions (remove / withdraw) is the caller's
 * job - they wrap the trigger in a Popconfirm - so this hook stays pure logic.
 */

import { useCallback, useState } from 'react';
import { App as AntApp } from 'antd';
import { useTranslations } from 'next-intl';
import { announceGlobal } from '@/components/connect/globalAnnouncer';
import {
  followUser,
  removeConnection as removeConnectionAction,
  respondToConnectionRequest,
  sendConnectionRequest,
  unfollowUser,
  withdrawConnectionRequest,
} from '../network.actions';
import { NETWORK_CHANGED_EVENT } from './useNetworkBadge';

export interface RelationshipInitial {
  connected?: boolean;
  outgoingRequest?: boolean;
  incomingRequest?: boolean;
  following?: boolean;
  outgoingRequestId?: string | null;
  incomingRequestId?: string | null;
}

export interface RelationshipController {
  connected: boolean;
  /** A pending OUTGOING request exists (the viewer asked to connect). */
  requested: boolean;
  /** A pending INCOMING request exists (the target asked the viewer). */
  incoming: boolean;
  following: boolean;
  busyConnect: boolean;
  busyFollow: boolean;
  /** withdraw / remove / accept / ignore in flight. */
  busyManage: boolean;
  connect: () => Promise<void>;
  withdraw: () => Promise<void>;
  removeConnection: () => Promise<void>;
  accept: () => Promise<void>;
  ignore: () => Promise<void>;
  toggleFollow: () => Promise<void>;
}

function emitNetworkChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NETWORK_CHANGED_EVENT));
  }
}

export function useRelationship(
  userId: string,
  initial: RelationshipInitial = {},
  onChanged?: () => void,
): RelationshipController {
  const t = useTranslations('connect.profile.actions');
  const tInv = useTranslations('connect.network.invitations');
  const { message } = AntApp.useApp();

  const [connected, setConnected] = useState(!!initial.connected);
  const [requested, setRequested] = useState(!!initial.outgoingRequest);
  const [incoming, setIncoming] = useState(!!initial.incomingRequest);
  const [following, setFollowing] = useState(!!initial.following);
  const [outgoingRequestId, setOutgoingRequestId] = useState<string | null>(
    initial.outgoingRequestId ?? null,
  );
  const incomingRequestId = initial.incomingRequestId ?? null;

  const [busyConnect, setBusyConnect] = useState(false);
  const [busyFollow, setBusyFollow] = useState(false);
  const [busyManage, setBusyManage] = useState(false);

  const afterChange = useCallback(() => {
    emitNetworkChanged();
    onChanged?.();
  }, [onChanged]);

  const connect = useCallback(async () => {
    setBusyConnect(true);
    setRequested(true); // optimistic
    const res = await sendConnectionRequest(userId);
    setBusyConnect(false);
    if (!res.ok) {
      setRequested(false);
      const msg = res.error || t('connectError');
      message.error(msg);
      announceGlobal(msg, { assertive: true });
      return;
    }
    // Capture the new request id so the viewer can Withdraw it immediately,
    // even on a card that never loaded a full relationship.
    setOutgoingRequestId(res.data._id);
    message.success(t('requestSentToast'));
    announceGlobal(t('requestSentToast'));
    afterChange();
  }, [userId, message, t, afterChange]);

  const withdraw = useCallback(async () => {
    if (!outgoingRequestId) return;
    setBusyManage(true);
    const res = await withdrawConnectionRequest(outgoingRequestId);
    setBusyManage(false);
    if (!res.ok) {
      const msg = res.error || tInv('actionError');
      message.error(msg);
      announceGlobal(msg, { assertive: true });
      return;
    }
    setRequested(false);
    setOutgoingRequestId(null);
    message.success(tInv('withdrawn'));
    announceGlobal(tInv('withdrawn'));
    afterChange();
  }, [outgoingRequestId, message, tInv, afterChange]);

  const removeConnection = useCallback(async () => {
    setBusyManage(true);
    const res = await removeConnectionAction(userId);
    setBusyManage(false);
    if (!res.ok) {
      const msg = res.error || t('removeError');
      message.error(msg);
      announceGlobal(msg, { assertive: true });
      return;
    }
    setConnected(false);
    // The implied follow is NOT removed server-side (disconnect keeps the
    // one-way follow), so `following` is left untouched here.
    message.success(t('removedToast'));
    announceGlobal(t('removedToast'));
    afterChange();
  }, [userId, message, t, afterChange]);

  const accept = useCallback(async () => {
    if (!incomingRequestId) return;
    setBusyManage(true);
    const res = await respondToConnectionRequest(incomingRequestId, 'accept');
    setBusyManage(false);
    if (!res.ok) {
      const msg = res.error || tInv('actionError');
      message.error(msg);
      announceGlobal(msg, { assertive: true });
      return;
    }
    setIncoming(false);
    setConnected(true);
    setFollowing(true); // accepting connects → implies a mutual follow
    message.success(tInv('accepted'));
    announceGlobal(tInv('accepted'));
    afterChange();
  }, [incomingRequestId, message, tInv, afterChange]);

  const ignore = useCallback(async () => {
    if (!incomingRequestId) return;
    setBusyManage(true);
    const res = await respondToConnectionRequest(incomingRequestId, 'ignore');
    setBusyManage(false);
    if (!res.ok) {
      const msg = res.error || tInv('actionError');
      message.error(msg);
      announceGlobal(msg, { assertive: true });
      return;
    }
    setIncoming(false);
    message.success(tInv('ignored'));
    announceGlobal(tInv('ignored'));
    afterChange();
  }, [incomingRequestId, message, tInv, afterChange]);

  const toggleFollow = useCallback(async () => {
    setBusyFollow(true);
    const prev = following;
    setFollowing(!prev); // optimistic
    const res = prev ? await unfollowUser(userId) : await followUser(userId);
    setBusyFollow(false);
    if (!res.ok) {
      setFollowing(prev);
      const msg = res.error || t(prev ? 'unfollowError' : 'followError');
      message.error(msg);
      announceGlobal(msg, { assertive: true });
      return;
    }
    afterChange();
  }, [userId, following, message, t, afterChange]);

  return {
    connected,
    requested,
    incoming,
    following,
    busyConnect,
    busyFollow,
    busyManage,
    connect,
    withdraw,
    removeConnection,
    accept,
    ignore,
    toggleFollow,
  };
}
