'use client';
// D19 item-masters import - thin config over the generic ImportWizard. Each row maps an item
// name + type + unit + optional HSN/GST/category; commit creates items via ItemsService.
// Links: ImportWizard, finance-import.api.ts (validate/commit items), BE ImportController.
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ImportWizard, type ImportDryRunRow } from './ImportWizard';
import { financeImportApi } from '@/lib/api/modules/finance-import.api';
import { parseTallyStockItems } from '@/lib/finance/tallyXml';

const FIELD_KEYS = ['name', 'itemType', 'unit', 'hsnSacCode', 'gstRate', 'category'] as const;

export function ImportItemsWizard({ firmId }: { firmId: string }) {
  const t = useTranslations('finance.import');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const wsId = ws?._id ?? '';
  return (
    <ImportWizard
      config={{
        fields: FIELD_KEYS.map((k) => ({ key: k, label: t(`field.${k}`), required: k === 'name' })),
        validate: (rows) => financeImportApi.validateItems(wsId, firmId, rows),
        commit: (rows) => financeImportApi.commitItems(wsId, firmId, rows),
        primaryColLabel: t('field.name'),
        primaryValue: (r: ImportDryRunRow) => (r as { item?: { name?: string } }).item?.name ?? '-',
        parseTallyXml: parseTallyStockItems,
      }}
    />
  );
}
