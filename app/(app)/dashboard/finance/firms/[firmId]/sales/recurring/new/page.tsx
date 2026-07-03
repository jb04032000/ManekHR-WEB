/**
 * New recurring template page.
 * Gated by EntitlementGate(feature='sales_recurring') per D-08 + T-F02-08-04.
 */
import { EntitlementGate } from '@/components/finance/EntitlementGate';
import { RecurringTemplateEditor } from '@/components/finance/sales/RecurringTemplateEditor';

export default async function NewRecurringPage({
  params,
}: {
  params: Promise<{ firmId: string }>;
}) {
  const { firmId } = await params;

  return (
    <EntitlementGate feature="sales_recurring" fallback="upsell-overlay">
      <RecurringTemplateEditor firmId={firmId} mode="new" />
    </EntitlementGate>
  );
}
