'use client';

import { useState, useCallback } from 'react';
import { salaryApi } from '@/lib/api/modules/salary.api';
import { buildBankFileRows, generateBankFile } from '@/lib/export/bankFileEngine';
import type { BankFileRow, BankFileMeta } from '@/types';

interface UseBankFileExportState {
  rows: BankFileRow[];
  loading: boolean;
  error: string | null;
}

export function useBankFileExport(wsId: string) {
  const [state, setState] = useState<UseBankFileExportState>({
    rows: [],
    loading: false,
    error: null,
  });

  const fetchRows = useCallback(
    async (month: number, year: number) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const resp = await salaryApi.getBankFileRows(wsId, month, year);
        const rows = buildBankFileRows(resp.rows);
        setState({ rows, loading: false, error: null });
        return rows;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load bank file data';
        setState({ rows: [], loading: false, error: msg });
        return null;
      }
    },
    [wsId],
  );

  const updateRow = useCallback((rowId: string, patch: Partial<BankFileRow>) => {
    setState((s) => ({
      ...s,
      rows: s.rows.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)),
    }));
  }, []);

  const resetAmounts = useCallback(() => {
    setState((s) => ({
      ...s,
      rows: s.rows.map((r) => ({ ...r, amount: Math.max(r.netSalary - r.paidSoFar, 0) })),
    }));
  }, []);

  const setModeAll = useCallback((mode: BankFileRow['paymentMode']) => {
    setState((s) => ({
      ...s,
      rows: s.rows.map((r) => (r._include ? { ...r, paymentMode: mode } : r)),
    }));
  }, []);

  const toggleFullyPaid = useCallback((include: boolean) => {
    setState((s) => ({
      ...s,
      rows: s.rows.map((r) =>
        r._flags.includes('fully_paid') && !r._blockReason
          ? { ...r, _include: include }
          : r,
      ),
    }));
  }, []);

  const download = useCallback(async (meta: BankFileMeta) => {
    await generateBankFile(state.rows, meta);
  }, [state.rows]);

  return {
    rows: state.rows,
    loading: state.loading,
    error: state.error,
    fetchRows,
    updateRow,
    resetAmounts,
    setModeAll,
    toggleFullyPaid,
    download,
  };
}
