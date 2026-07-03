'use client';

import { BillingPolicyForm } from '@/components/admin/billing/BillingPolicyForm';
import { RefundPolicyForm } from '@/components/admin/billing/RefundPolicyForm';

export default function AdminBillingPolicyPage() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <BillingPolicyForm />
      <RefundPolicyForm />
    </div>
  );
}
