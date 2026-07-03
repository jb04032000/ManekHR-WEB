'use client';
/**
 * Multi-doc convert wizard state machine: pick_target → preview → confirm → submitting → done.
 * Per F-02 D-04. Full UI for the wizard ships in F-02-08; this hook ships the state + API wiring.
 */
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import type { VoucherType, LineItem } from '@/types';

export type ConvertWizardStep =
  | 'pick_target'
  | 'preview'
  | 'confirm'
  | 'submitting'
  | 'done';

interface WizardState {
  step: ConvertWizardStep;
  sourceType: VoucherType;
  sourceIds: string[];
  targetType: VoucherType | null;
  mergedLines: LineItem[];
  conflictingFields: string[];
  error: string | null;
}

interface UseConvertWizardOpts {
  wsId: string;
  firmId: string;
  sourceType: VoucherType;
  sourceIds: string[];
}

function segmentForType(t: VoucherType): string {
  const map: Record<VoucherType, string> = {
    sale_invoice: 'invoices',
    quotation: 'quotations',
    sale_order: 'orders',
    proforma: 'proforma',
    delivery_challan: 'delivery-challans',
  };
  return map[t];
}

export function useConvertWizard({
  wsId,
  firmId,
  sourceType,
  sourceIds,
}: UseConvertWizardOpts) {
  const router = useRouter();

  const [state, setState] = useState<WizardState>({
    step: 'pick_target',
    sourceType,
    sourceIds,
    targetType: null,
    mergedLines: [],
    conflictingFields: [],
    error: null,
  });

  const setTargetType = useCallback((t: VoucherType) => {
    setState((s) => ({ ...s, targetType: t, step: 'preview' }));
  }, []);

  /** Calls backend with dryRun:true to preview merged lines and conflicts */
  const preview = useCallback(async () => {
    try {
      const res = await financeSalesApi.convert(wsId, firmId, {
        sourceType: state.sourceType,
        sourceIds: state.sourceIds,
        targetType: state.targetType,
        dryRun: true,
      });
      const r = res as unknown as { mergedLines?: LineItem[]; conflictingFields?: string[] };
      setState((s) => ({
        ...s,
        mergedLines: r.mergedLines ?? [],
        conflictingFields: r.conflictingFields ?? [],
        step: 'confirm',
      }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, error: msg }));
    }
  }, [wsId, firmId, state.sourceType, state.sourceIds, state.targetType]);

  /** Submits the conversion and redirects to the new draft */
  const confirm = useCallback(
    async (
      overrides?: Partial<{ voucherDate: string; lineItems: LineItem[] }>,
    ) => {
      setState((s) => ({ ...s, step: 'submitting' }));
      try {
        const res = await financeSalesApi.convert(wsId, firmId, {
          sourceType: state.sourceType,
          sourceIds: state.sourceIds,
          targetType: state.targetType,
          overrides,
        });
        const created = res as unknown as { _id: string };
        setState((s) => ({ ...s, step: 'done' }));
        const segment = segmentForType(state.targetType!);
        router.push(
          `/dashboard/finance/firms/${firmId}/sales/${segment}/${created._id}`,
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setState((s) => ({ ...s, error: msg, step: 'preview' }));
      }
    },
    [wsId, firmId, state.sourceType, state.sourceIds, state.targetType, router],
  );

  const reset = useCallback(() => {
    setState((s) => ({
      ...s,
      step: 'pick_target',
      targetType: null,
      mergedLines: [],
      conflictingFields: [],
      error: null,
    }));
  }, []);

  return { state, setTargetType, preview, confirm, reset };
}
