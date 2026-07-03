'use client';
// D19 parties import - thin config over the generic ImportWizard. Links: ImportWizard,
// finance-import.api.ts (validate/commit parties), BE ImportController parties endpoints.
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ImportWizard, type ImportDryRunRow } from './ImportWizard';
import { financeImportApi } from '@/lib/api/modules/finance-import.api';
import { parseTallyLedgers } from '@/lib/finance/tallyXml';

const FIELD_KEYS = [
  'name',
  'partyType',
  'gstin',
  'pan',
  'state',
  'phone',
  'email',
  'address',
] as const;

export function ImportPartiesWizard({ firmId }: { firmId: string }) {
  const t = useTranslations('finance.import');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const wsId = ws?._id ?? '';
  return (
    <ImportWizard
      config={{
        fields: FIELD_KEYS.map((k) => ({ key: k, label: t(`field.${k}`), required: k === 'name' })),
        validate: (rows) => financeImportApi.validateParties(wsId, firmId, rows),
        commit: (rows) => financeImportApi.commitParties(wsId, firmId, rows),
        primaryColLabel: t('field.name'),
        primaryValue: (r: ImportDryRunRow) =>
          (r as { party?: { name?: string } }).party?.name ?? '-',
        parseTallyXml: parseTallyLedgers,
      }}
    />
  );
}
