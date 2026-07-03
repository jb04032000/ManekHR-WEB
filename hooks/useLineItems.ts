'use client';
/**
 * Field-array + memoized per-row tax compute for the voucher editor's Lines tab.
 * Per F-02 D-18. Wraps react-hook-form's useFieldArray with computeTaxClient memoization.
 */
import { useMemo } from 'react';
import { useFieldArray, type Control } from 'react-hook-form';
import {
  computeTaxClient,
  type TaxComputeInput,
  type TaxComputeResult,
} from '@/lib/finance/taxComputeClient';
import type { LineItem, AdditionalCharge } from '@/types';

interface Args {
  control: Control<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  taxContext: Omit<TaxComputeInput, 'lines' | 'additionalCharges'>;
}

export function useLineItems({ control, taxContext }: Args) {
  const { fields, append, remove, update } = useFieldArray({ control, name: 'lineItems' });

  const additionalChargesArray = useFieldArray({
    control,
    name: 'additionalCharges',
  });

  // Cast to domain types - react-hook-form adds `id` field but that's fine
  const lines = fields as unknown as LineItem[];
  const charges = additionalChargesArray.fields as unknown as AdditionalCharge[];

  const taxResult: TaxComputeResult = useMemo(
    () =>
      computeTaxClient({
        ...taxContext,
        lines,
        additionalCharges: charges,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      lines,
      charges,
      taxContext.firmStateCode,
      taxContext.partyStateCode,
      taxContext.placeOfSupplyStateCode,
      taxContext.roundingPolicy,
      taxContext.tcsPaise,
    ],
  );

  const addLine = () =>
    append({
      itemId: '',
      itemName: '',
      qty: 1,
      unit: 'NOS',
      ratePaise: 0,
      rateCentiPaise: 0,
      discountPct: 0,
      discountFlatPaise: 0,
      taxRate: 18,
      cessRate: 0,
      isTaxInclusive: false,
      hsnSacCode: '',
    } as unknown as LineItem);

  const addServiceLine = () =>
    append({
      itemId: '',
      itemName: '',
      qty: 1,
      unit: 'JOB',
      ratePaise: 0,
      rateCentiPaise: 0,
      discountPct: 0,
      discountFlatPaise: 0,
      taxRate: 18,
      cessRate: 0,
      isTaxInclusive: false,
      hsnSacCode: '',
    } as unknown as LineItem);

  return {
    fields,
    lines,
    addLine,
    addServiceLine,
    removeLine: remove,
    updateLine: update,
    additionalCharges: additionalChargesArray,
    taxResult,
  };
}
