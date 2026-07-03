'use client';
import React, { useEffect, useState, startTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Tag, Typography, Modal, message } from 'antd';
import { CalendarOutlined, ThunderboltOutlined } from '@ant-design/icons';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsModal } from '@/components/ui/DsModal';
import DsCard from '@/components/ui/DsCard';
import DepreciationPreviewTable from './DepreciationPreviewTable';
import {
  listDepreciationRuns,
  previewDepreciation,
  runDepreciation,
} from '@/lib/actions/finance-fixed-assets.actions';
import { useWorkspaceStore } from '@/lib/store';
import { fmt, formatCurrencyFull } from '@/lib/utils';
import type { DepreciationRun, DepreciationPreviewLine } from '@/types';

interface DepreciationRunPanelProps {
  firmId: string;
}

const formatPaise = (v: number) => formatCurrencyFull(v / 100);

const STATUS_COLOR: Record<string, string> = {
  completed: 'success',
  running: 'processing',
  failed: 'error',
};

function getThisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getNextDue(): string {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return next.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DepreciationRunPanel({ firmId }: DepreciationRunPanelProps) {
  const t = useTranslations('finance.fixedAssets.depreciation');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [runs, setRuns] = useState<DepreciationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLines, setPreviewLines] = useState<DepreciationPreviewLine[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);

  const thisMonth = getThisMonth();

  const fetchRuns = () => {
    if (!wsId || !isHydrated) return;
    startTransition(() => {
      setLoading(true);
    });
    listDepreciationRuns(wsId, firmId)
      .then((data) => setRuns(Array.isArray(data) ? data : []))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, isHydrated, firmId]);

  const lastRun = runs[0] ?? null;

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const lines = await previewDepreciation(wsId, firmId, thisMonth);
      setPreviewLines(Array.isArray(lines) ? lines : []);
    } catch {
      message.error(t('toast.previewFailed'));
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRunNow = () => {
    Modal.confirm({
      title: t('runConfirmTitle', { month: thisMonth }),
      content: t('runConfirmContent'),
      okText: t('runConfirmOk'),
      okButtonProps: { danger: true },
      onOk: async () => {
        setRunLoading(true);
        try {
          const result = await runDepreciation(wsId, firmId, thisMonth, 'manual');
          message.success(
            t('toast.runDone', {
              count: result.assetsProcessed,
              amount: formatPaise(result.totalDepreciationPaise),
            }),
          );
          fetchRuns();
        } catch {
          message.error(t('toast.runFailed'));
        } finally {
          setRunLoading(false);
        }
      },
    });
  };

  const handleConfirmRun = async () => {
    setPreviewOpen(false);
    handleRunNow();
  };

  const columns = [
    {
      title: t('runColumns.runMonth'),
      dataIndex: 'runMonth',
      key: 'runMonth',
    },
    {
      title: t('runColumns.type'),
      dataIndex: 'runType',
      key: 'runType',
      render: (v: string) => <Tag>{v.toUpperCase()}</Tag>,
    },
    {
      title: t('runColumns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v.toUpperCase()}</Tag>,
    },
    {
      title: t('runColumns.assetsProcessed'),
      dataIndex: 'assetsProcessed',
      key: 'assetsProcessed',
      align: 'right' as const,
    },
    {
      title: t('runColumns.totalDepreciation'),
      dataIndex: 'totalDepreciationPaise',
      key: 'totalDepreciationPaise',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('runColumns.runAt'),
      dataIndex: 'runAt',
      key: 'runAt',
      render: (v?: string) => (v ? fmt(v) : '-'),
    },
    {
      title: t('runColumns.error'),
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      render: (v?: string) =>
        v ? (
          <Typography.Text type="danger" ellipsis style={{ maxWidth: 200 }}>
            {v}
          </Typography.Text>
        ) : (
          <span style={{ color: '#ccc' }}>-</span>
        ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary card */}
      <DsCard style={{ marginBottom: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 32 }}>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('lastRun')}
              </Typography.Text>
              <div style={{ fontWeight: 600 }}>
                {lastRun ? (
                  <span>
                    {lastRun.runMonth}{' '}
                    <Tag
                      color={STATUS_COLOR[lastRun.status] ?? 'default'}
                      style={{ marginLeft: 4 }}
                    >
                      {lastRun.status.toUpperCase()}
                    </Tag>
                  </span>
                ) : (
                  t('never')
                )}
              </div>
            </div>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('nextDue')}
              </Typography.Text>
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <CalendarOutlined style={{ color: 'var(--cr-primary)' }} />
                {getNextDue()}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              onClick={handlePreview}
              loading={previewLoading}
            >
              {t('previewThisMonth')}
            </DsButton>
            <DsButton
              dsVariant="primary"
              dsSize="sm"
              icon={<ThunderboltOutlined />}
              onClick={handleRunNow}
              loading={runLoading}
            >
              {t('runThisMonth')}
            </DsButton>
          </div>
        </div>
      </DsCard>

      {/* Recent runs table */}
      <Typography.Title level={5} style={{ margin: 0 }}>
        {t('recentRuns')}
      </Typography.Title>
      <DsTable
        dataSource={runs}
        columns={columns}
        rowKey="_id"
        loading={loading}
        size="small"
        scrollX={900}
        pagination={{ pageSize: 10, showSizeChanger: false }}
      />

      {/* Preview modal */}
      <DsModal
        open={previewOpen}
        title={t('previewModalTitle', { month: thisMonth })}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={1000}
        destroyOnHidden
      >
        {previewLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>{t('loadingPreview')}</div>
        ) : (
          <DepreciationPreviewTable lines={previewLines} onConfirmRun={handleConfirmRun} />
        )}
      </DsModal>
    </div>
  );
}
