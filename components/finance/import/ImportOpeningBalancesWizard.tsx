'use client';
// D19 opening-balances import - thin config over the generic ImportWizard. Each row maps an
// account code + amount + Dr/Cr + as-of date; commit posts through the lock-aware OB service.
// Links: ImportWizard, finance-import.api.ts (validate/commit opening balances), BE ImportController.
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ImportWizard, type ImportDryRunRow } from './ImportWizard';
import { financeImportApi } from '@/lib/api/modules/finance-import.api';

const FIELD_KEYS = ['accountCode', 'amount', 'drOrCr', 'asOfDate'] as const;

export function ImportOpeningBalancesWizard({ firmId }: { firmId: string }) {
  const t = useTranslations('finance.import');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const wsId = ws?._id ?? '';
  return (
    <ImportWizard
      config={{
        // All four are required for a valid opening-balance row.
        fields: FIELD_KEYS.map((k) => ({ key: k, label: t(`field.${k}`), required: true })),
        validate: (rows) => financeImportApi.validateOpeningBalances(wsId, firmId, rows),
        commit: (rows) => financeImportApi.commitOpeningBalances(wsId, firmId, rows),
        primaryColLabel: t('field.accountCode'),
        primaryValue: (r: ImportDryRunRow) => {
          const ob = (r as { ob?: { accountCode?: string; accountName?: string } }).ob;
          return ob ? `${ob.accountCode} - ${ob.accountName}` : '-';
        },
      }}
    />
  );
}
