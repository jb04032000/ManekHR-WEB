'use client';
/**
 * Amber banner shown on posted invoices where eInvoice.status === 'pending'.
 * Per F-02 UI-SPEC: full-width, left-border 3px var(--cr-warning-500). Retry button calls einvoice endpoint.
 */
import { useState } from 'react';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import DsButton from '@/components/ui/DsButton';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';

interface EInvoiceBannerProps {
  invoiceId: string;
  firmId: string;
  wsId: string;
  onRetry: () => void;
}

export function EInvoiceBanner({ invoiceId, firmId, wsId, onRetry }: EInvoiceBannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRetry = async () => {
    setLoading(true);
    setError(null);
    try {
      await financeSalesApi.invoices.einvoice(wsId, firmId, invoiceId);
      onRetry();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Retry failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        background: 'var(--cr-warning-50)',
        borderBottom: '1px solid var(--cr-warning-50)',
        borderLeft: '3px solid var(--cr-warning-500)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <ExclamationCircleOutlined style={{ color: 'var(--cr-warning-700)', fontSize: 14 }} />
      <span style={{ flex: 1, fontSize: 13, color: 'var(--cr-warning-700)' }}>
        e-Invoice pending - IRP submission queued. Retry manually →
        {error && <span style={{ color: 'var(--cr-error)', marginLeft: 8 }}>{error}</span>}
      </span>
      <DsButton dsVariant="ghost" dsSize="sm" loading={loading} onClick={handleRetry}>
        Retry
      </DsButton>
    </div>
  );
}
