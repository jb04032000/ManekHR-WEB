'use client';
// D19 pending-invoices import (bill-wise opening AR) - thin config over the generic ImportWizard.
// Each row references an existing party + a bill no/date/amount; commit posts Dr Debtors / Cr 3004.
// Links: ImportWizard, finance-import.api.ts (validate/commit pending invoices), BE ImportController.
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ImportWizard, type ImportDryRunRow } from './ImportWizard';
import { financeImportApi } from '@/lib/api/modules/finance-import.api';

const FIELD_KEYS = ['party', 'voucherNumber', 'voucherDate', 'dueDate', 'amount'] as const;

export function ImportPendingInvoicesWizard({ firmId }: { firmId: string }) {
  const t = useTranslations('finance.import');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const wsId = ws?._id ?? '';
  return (
    <ImportWizard
      config={{
        // All required except the due date.
        fields: FIELD_KEYS.map((k) => ({
          key: k,
          label: t(`field.${k}`),
          required: k !== 'dueDate',
        })),
        validate: (rows) => financeImportApi.validatePendingInvoices(wsId, firmId, rows),
        commit: (rows) => financeImportApi.commitPendingInvoices(wsId, firmId, rows),
        primaryColLabel: t('field.voucherNumber'),
        primaryValue: (r: ImportDryRunRow) => {
          const b = (r as { bill?: { voucherNumber?: string; partyName?: string } }).bill;
          return b ? `${b.voucherNumber} (${b.partyName})` : '-';
        },
      }}
    />
  );
}
