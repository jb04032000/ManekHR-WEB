'use client';
/**
 * UUID per (wsId, voucherType, draftId) - persisted in IndexedDB so it survives page reloads.
 * Per F-02 D-19. Same UUID returned across re-renders; backend uses it to deduplicate Posts.
 */
import { useEffect, useState } from 'react';
import { loadDraft, saveDraft } from '@/lib/finance/draftStore';

interface Scope {
  wsId: string;
  voucherType: string;
  draftId: string;
}

export function useIdempotencyKey(scope: Scope): string {
  const [key, setKey] = useState<string>('');

  useEffect(() => {
    const idemKey = `idem:${scope.wsId}:${scope.voucherType}:${scope.draftId}`;
    loadDraft(idemKey).then((rec) => {
      if (rec?.data && typeof rec.data === 'object' && 'uuid' in rec.data) {
        setKey((rec.data as { uuid: string }).uuid);
      } else {
        const uuid = crypto.randomUUID();
        saveDraft({
          key: idemKey,
          workspaceId: scope.wsId,
          firmId: '_',
          voucherType: scope.voucherType,
          draftId: scope.draftId,
          data: { uuid },
        });
        setKey(uuid);
      }
    });
  }, [scope.wsId, scope.voucherType, scope.draftId]);

  return key;
}
