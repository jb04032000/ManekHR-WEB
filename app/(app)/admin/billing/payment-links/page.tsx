'use client';

import { useState } from 'react';
import { Card, Button } from 'antd';
import { PlusOutlined, LinkOutlined } from '@ant-design/icons';
import { PaymentLinksTable } from '@/components/admin/billing/PaymentLinksTable';
import { PaymentLinkIssuer } from '@/components/admin/billing/PaymentLinkIssuer';

export default function AdminPaymentLinksPage() {
  const [issuerOpen, setIssuerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <Card
      className="rounded-2xl"
      title={
        <div className="flex items-center gap-2">
          <LinkOutlined /> Payment Links
        </div>
      }
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIssuerOpen(true)}>
          Issue Link
        </Button>
      }
    >
      <PaymentLinksTable key={refreshKey} />
      <PaymentLinkIssuer
        open={issuerOpen}
        onCancel={() => setIssuerOpen(false)}
        onIssued={() => {
          setIssuerOpen(false);
          setRefreshKey((k) => k + 1);
        }}
      />
    </Card>
  );
}
