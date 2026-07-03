'use client';

import { InvoicesTable } from '@/components/subscription/InvoicesTable';

export default function InvoicesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="m-0 mb-1 font-display text-xl font-bold text-heading">Invoices</h2>
        <p className="m-0 text-sm text-muted">
          Download GST-compliant tax invoices for every successful payment.
        </p>
      </div>
      <InvoicesTable invoicesOnly />
    </div>
  );
}
