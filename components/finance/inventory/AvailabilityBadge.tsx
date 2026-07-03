'use client';
import { useEffect, useState } from 'react';
import { getStockBalance } from '@/lib/actions/inventory.actions';

interface Props {
  workspaceId: string;
  firmId: string;
  itemId: string;
  godownId?: string;
  requiredQty: number;
}

export function AvailabilityBadge({ workspaceId, firmId, itemId, godownId, requiredQty }: Props) {
  const [available, setAvailable] = useState<number | null>(null);

  useEffect(() => {
    if (!itemId || !godownId) return;
    // 300ms debounce per UI-SPEC interaction §3
    const t = setTimeout(() => {
      getStockBalance(workspaceId, firmId, itemId, godownId).then(setAvailable);
    }, 300);
    return () => clearTimeout(t);
  }, [workspaceId, firmId, itemId, godownId, requiredQty]);

  if (available === null) return <span style={{ fontSize: 11, color: 'var(--cr-text-3)' }}>-</span>;
  if (available <= 0) {
    return (
      <span style={{ fontSize: 11, color: 'var(--cr-text-3)' }}>
        0 available (short-stock allowed)
      </span>
    );
  }
  if (available < requiredQty) {
    return (
      <span style={{ fontSize: 11, color: 'var(--cr-warning)' }}>Only {available} available</span>
    );
  }
  return <span style={{ fontSize: 11, color: 'var(--cr-success)' }}>{available} available</span>;
}
