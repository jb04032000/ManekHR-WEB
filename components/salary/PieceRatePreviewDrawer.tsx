'use client';

import { useCallback, useEffect, useState, startTransition } from 'react';
import { Button, Descriptions, Drawer, Space, Spin, Table, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { PieceRatePreviewResponse, PieceRateBreakdownRow } from '@/types';
import { previewPieceRateEarnings, ensureSalaryRecord } from '@/lib/actions/salary.actions';

const inr = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v ?? 0);

export interface PieceRatePreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  wsId: string;
  teamMemberId: string;
  memberName: string;
  month: number;
  year: number;
  /** Parent should refetch the salary list and (optionally) close the drawer */
  onApplied: () => void;
}

export function PieceRatePreviewDrawer({
  open,
  onClose,
  wsId,
  teamMemberId,
  memberName,
  month,
  year,
  onApplied,
}: PieceRatePreviewDrawerProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PieceRatePreviewResponse | null>(null);
  const [applying, setApplying] = useState(false);

  const fetchPreview = useCallback(async () => {
    if (!open || !wsId || !teamMemberId) return;
    startTransition(() => {
      setLoading(true);
    });
    try {
      const result = await previewPieceRateEarnings(wsId, { teamMemberId, month, year });
      startTransition(() => {
        setData(result);
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      let code = '';
      let msg = err?.message ?? 'Preview failed';
      try {
        const parsed = JSON.parse(err.message ?? '{}');
        if (parsed && typeof parsed === 'object') {
          code = parsed.code ?? '';
          msg = parsed.message ?? msg;
        }
      } catch {
        // not JSON - keep raw message
      }
      const i18nKey = code ? `salary.piece_rate.errors.${code}` : '';
      let resolved = msg;
      if (i18nKey) {
        try {
          resolved = t(i18nKey);
        } catch {
          resolved = msg;
        }
      }
      message.error(resolved);
      startTransition(() => {
        setData(null);
      });
    } finally {
      startTransition(() => {
        setLoading(false);
      });
    }
  }, [open, wsId, teamMemberId, month, year, t]);

  useEffect(() => {
    void fetchPreview();
  }, [fetchPreview]);

  const handleApply = async () => {
    setApplying(true);
    try {
      // Reuse existing ensureSalaryRecord server action.
      // Verified signature (Plan 23-08 Task 4): (wsId, teamMemberId, month, year, token?)
      await ensureSalaryRecord(wsId, teamMemberId, month, year);
      try {
        message.success(t('salary.piece_rate.config.saved'));
      } catch {
        message.success('Snapshot refreshed');
      }
      onApplied();
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const tx = (key: string, fallback: string, values?: Record<string, string | number>) => {
    try {
      return values ? t(key, values) : t(key);
    } catch {
      return fallback;
    }
  };

  return (
    <Drawer
      title={tx(
        'salary.piece_rate.preview.title',
        `Preview Piece Earnings - ${memberName}, ${month}/${year}`,
        { name: memberName, month, year },
      )}
      open={open}
      onClose={onClose}
      styles={{ wrapper: { width: 720 } }}
      placement="right"
      destroyOnHidden
    >
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin />
        </div>
      )}
      {!loading && data && (
        <>
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label={tx('salary.piece_rate.config.basePortion', 'Base portion')}>
              {inr(data.basePortion)}
            </Descriptions.Item>
            <Descriptions.Item label="LOP on base">{inr(data.lopOnBase)}</Descriptions.Item>
            <Descriptions.Item label="Net base">{inr(data.netBase)}</Descriptions.Item>
            <Descriptions.Item label="Piece earnings">{inr(data.pieceEarnings)}</Descriptions.Item>
            <Descriptions.Item label={<strong>Total earnings</strong>}>
              <strong>{inr(data.totalEarnings)}</strong>
            </Descriptions.Item>
          </Descriptions>

          {data.breakdown.length === 0 ? (
            <p style={{ marginTop: 16 }}>
              {tx(
                'salary.piece_rate.preview.empty',
                'No production logs in this month - earnings are zero.',
              )}
            </p>
          ) : (
            <Table<PieceRateBreakdownRow & { key: number }>
              style={{ marginTop: 16 }}
              dataSource={data.breakdown.map((b, i) => ({ ...b, key: i }))}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              columns={[
                {
                  title: tx('salary.piece_rate.preview.breakdown.date', 'Date'),
                  dataIndex: 'date',
                },
                {
                  title: tx('salary.piece_rate.preview.breakdown.machine', 'Machine'),
                  dataIndex: 'machineCode',
                },
                {
                  title: tx('salary.piece_rate.preview.breakdown.metric', 'Metric'),
                  dataIndex: 'metricLabel',
                },
                {
                  title: tx('salary.piece_rate.preview.breakdown.qty', 'Quantity'),
                  dataIndex: 'qty',
                  align: 'right',
                },
                {
                  title: tx('salary.piece_rate.preview.breakdown.rate', 'Rate'),
                  dataIndex: 'rate',
                  align: 'right',
                  render: (v: number) => inr(v),
                },
                {
                  title: tx('salary.piece_rate.preview.breakdown.amount', 'Amount'),
                  dataIndex: 'amount',
                  align: 'right',
                  render: (v: number) => inr(v),
                },
              ]}
            />
          )}

          <Space style={{ marginTop: 16 }}>
            <Button icon={<ReloadOutlined />} onClick={() => void fetchPreview()}>
              {tx('salary.piece_rate.preview.recomputeButton', 'Recompute')}
            </Button>
            <Button type="primary" loading={applying} onClick={() => void handleApply()}>
              {tx('salary.piece_rate.preview.applyButton', 'Apply (refresh snapshot)')}
            </Button>
          </Space>
        </>
      )}
    </Drawer>
  );
}

export default PieceRatePreviewDrawer;
