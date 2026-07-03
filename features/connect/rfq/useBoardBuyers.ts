'use client';

/**
 * Batch-resolves buyer identity (name + avatar) for the RFQ board cards.
 * Adaptation of the jobs useBoardEmployers person path: one getPeople batch per
 * NEW set of buyer ids (Load more only fetches the unseen ones), fanned back
 * out to every rfqId that shares the buyer. Persons carry NO verification badge
 * (identity-model invariant: person rows are never badged).
 *
 * Cross-module links:
 * - features/connect/network.actions.getPeople (user id -> { name, avatar }).
 * - RfqBoard passes the returned map into RfqCard as `buyer`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getPeople } from '../network.actions';
import type { Rfq } from './rfq.types';

export interface RfqBuyerRef {
  name: string;
  avatar?: string;
}

export function useBoardBuyers(rfqs: Rfq[]): Record<string, RfqBuyerRef> {
  const [map, setMap] = useState<Record<string, RfqBuyerRef>>({});
  // Already-resolved buyer ids (ref, not state, so the effect never loops).
  const resolved = useRef<Set<string>>(new Set());

  const resolve = useCallback(async (batch: Rfq[]) => {
    const userIdToRfqs = new Map<string, string[]>();
    for (const r of batch) {
      if (!r.buyerUserId) continue;
      const arr = userIdToRfqs.get(r.buyerUserId) ?? [];
      arr.push(r._id);
      userIdToRfqs.set(r.buyerUserId, arr);
    }
    const newIds = [...userIdToRfqs.keys()].filter((id) => !resolved.current.has(id));
    if (newIds.length === 0) return;
    newIds.forEach((id) => resolved.current.add(id));

    const res = await getPeople(newIds);
    if (!res.ok) return;
    const patch: Record<string, RfqBuyerRef> = {};
    for (const person of res.data) {
      const p = person as { userId: string; name: string; avatar: string | null };
      const buyer: RfqBuyerRef = { name: p.name, avatar: p.avatar || undefined };
      for (const rfqId of userIdToRfqs.get(p.userId) ?? []) patch[rfqId] = buyer;
    }
    if (Object.keys(patch).length) setMap((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    // Async post-await setState (synchronize-with-external-system fetch), same
    // pattern + rationale as jobs useBoardEmployers.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async post-await fetch resolve
    void resolve(rfqs);
  }, [rfqs, resolve]);

  return map;
}
