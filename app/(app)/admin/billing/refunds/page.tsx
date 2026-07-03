'use client';

import { Card } from 'antd';
import { RefundQueue } from '@/components/admin/billing/RefundQueue';

export default function AdminRefundQueuePage() {
  return (
    <Card className="rounded-2xl" title="Pending refund requests">
      <RefundQueue />
    </Card>
  );
}
