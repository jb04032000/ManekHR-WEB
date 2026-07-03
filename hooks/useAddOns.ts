'use client';

import { useState, useEffect, startTransition } from 'react';
import { useSubscriptionStore } from '@/lib/store';
import { getMyAddOns, getAvailableAddOns } from '@/lib/actions/add-ons.actions';
import type { AddOnDefinition, PurchasedAddOn } from '@/types';

export function useAddOns() {
  const { activeAddOns, setActiveAddOns } = useSubscriptionStore();
  const [availableAddOns, setAvailableAddOns] = useState<AddOnDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAddOns = async () => {
    try {
      startTransition(() => {
        setIsLoading(true);
        setError(null);
      });

      const [myAddOns, available] = await Promise.all([getMyAddOns(), getAvailableAddOns()]);

      startTransition(() => {
        setActiveAddOns(myAddOns);
        setAvailableAddOns(available);
      });
    } catch (err) {
      startTransition(() => {
        setError(err instanceof Error ? err.message : 'Failed to load add-ons');
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAddOns();
  }, []);

  const hasAddOn = (slug: string): boolean => {
    return activeAddOns.some(
      (addOn) =>
        (addOn.addOnDefinitionId as AddOnDefinition)?.slug === slug ||
        addOn.addOnDefinitionId === slug,
    );
  };

  const getAddOnQuantity = (addOnDefinitionId: string): number => {
    return activeAddOns
      .filter((addOn) => addOn.addOnDefinitionId === addOnDefinitionId)
      .reduce((sum, addOn) => sum + addOn.quantity, 0);
  };

  return {
    activeAddOns,
    availableAddOns,
    isLoading,
    error,
    refresh: fetchAddOns,
    hasAddOn,
    getAddOnQuantity,
  };
}
