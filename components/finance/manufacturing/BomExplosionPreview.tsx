'use client';
import { useEffect, useState, startTransition } from 'react';
import { Table, InputNumber } from 'antd';
import { DsModal } from '@/components/ui/DsModal';
import DsButton from '@/components/ui/DsButton';
import { explodeBom } from '@/lib/actions/finance/manufacturing.actions';
import type { BomExplodedComponent } from '@/types';

export interface BomExplosionPreviewProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  firmId: string;
  bomId: string;
  defaultRequestedQty: number;
}

export default function BomExplosionPreview({
  open,
  onClose,
  workspaceId,
  firmId,
  bomId,
  defaultRequestedQty,
}: BomExplosionPreviewProps) {
  const [requestedQty, setRequestedQty] = useState(defaultRequestedQty);
  const [rows, setRows] = useState<BomExplodedComponent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    startTransition(() => {
      setLoading(true);
    });
    explodeBom(workspaceId, firmId, bomId, requestedQty)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [open, workspaceId, firmId, bomId, requestedQty]);

  return (
    <DsModal
      open={open}
      onCancel={onClose}
      title="BoM Explosion Preview"
      footer={
        <DsButton dsVariant="ghost" onClick={onClose}>
          Close
        </DsButton>
      }
      width={700}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--cr-text-2)' }}>Requested Qty:</span>
        <InputNumber
          min={0.001}
          value={requestedQty}
          onChange={(v) => setRequestedQty(Number(v))}
          style={{ width: 120 }}
        />
      </div>
      <Table
        dataSource={rows}
        rowKey={(r) => `${r.itemId}-${r.level}-${r.path}`}
        pagination={false}
        loading={loading}
        size="small"
        scroll={{ x: 'max-content' }}
        columns={[
          {
            title: 'Item',
            dataIndex: 'itemId',
            render: (id: string, r: BomExplodedComponent) => {
              const indent = '  '.repeat(Math.max(0, r.level - 1));
              return (
                <span style={{ fontFamily: 'monospace' }}>
                  {indent}
                  {id}
                </span>
              );
            },
          },
          {
            title: 'Required Qty',
            dataIndex: 'requiredQty',
            render: (v: number) => v.toFixed(3),
          },
          { title: 'Unit', dataIndex: 'unit' },
          {
            title: 'Level',
            dataIndex: 'level',
          },
          {
            title: 'Path',
            dataIndex: 'path',
            ellipsis: true,
          },
        ]}
      />
    </DsModal>
  );
}
