'use client';

import { BillingProfileForm } from '@/components/subscription/BillingProfileForm';

export default function BillingInfoPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="m-0 mb-1 font-display text-xl font-bold text-heading">
          Billing Information
        </h2>
        <p className="m-0 text-sm text-muted">
          Used on every GST invoice. Add your GSTIN to receive B2B input-credit invoices instead of
          B2C consumer invoices.
        </p>
      </div>
      <BillingProfileForm />
    </div>
  );
}
