'use client';

import React, { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Badge, Modal, Select, Spin, Tabs, Tooltip, message } from 'antd';
import { CopyOutlined, QrcodeOutlined } from '@ant-design/icons';
import { DsTable } from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { DsTag } from '@/components/ui/DsBadge';
import { ListErrorState } from '@/components/finance/ListErrorState';
import IrpOtpModal from '@/components/gst/IrpOtpModal';
import QrPreviewModal from '@/components/gst/QrPreviewModal';
import { useWorkspaceStore } from '@/lib/store';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';
import type { ColumnsType } from 'antd/es/table';
import {
  batchGenerateIrn,
  cancelIrn,
  generateIrn,
  getEInvoiceQr,
  listEInvoicesByStatus,
  listPendingEInvoices,
  prepareIrpSession,
} from '@/lib/actions/finance/gst.actions';

// ── helpers ────────────────────────────────────────────────────────────────────

function formatDate(val: string | Date | undefined): string {
  if (!val) return '-';
  return new Date(val).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatINR(paise: number): string {
  return (
    '₹' +
    (paise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function ageDays(voucherDate: string | Date): number {
  return Math.floor((Date.now() - new Date(voucherDate).getTime()) / 86_400_000);
}

// i18n note: label-producing helpers take the finance.gst translator. Cross-link:
// keys under finance.gst.einvoice.* (age / cancelDeadline / session).
type TFn = ReturnType<typeof useTranslations>;

function formatAgeLabel(days: number, t: TFn): string {
  return t('einvoice.age.label', { days });
}

function ageColor(days: number): string {
  if (days > 25) return 'var(--cr-error)';
  if (days >= 7) return 'var(--cr-warning)';
  return 'var(--cr-text-3)';
}

function cancelDeadline(ackDate: string | Date, t: TFn): { label: string; color: string } {
  const elapsed = Date.now() - new Date(ackDate).getTime();
  const remaining = 24 * 3600 * 1000 - elapsed;
  if (remaining <= 0)
    return { label: t('einvoice.cancelDeadline.permanent'), color: 'var(--cr-text-3)' };
  const hours = Math.floor(remaining / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  const color = hours < 4 ? 'var(--cr-warning)' : 'var(--cr-text-2)';
  return { label: t('einvoice.cancelDeadline.cancellable', { hours, mins }), color };
}

function formatIrnShort(irn: string): string {
  return irn.length > 12 ? irn.slice(0, 12) + '…' : irn;
}

function sessionExpiresLabel(expiresInMs: number, t: TFn): string {
  if (expiresInMs <= 0) return t('einvoice.session.expired');
  const h = Math.floor(expiresInMs / 3_600_000);
  const m = Math.floor((expiresInMs % 3_600_000) / 60_000);
  return t('einvoice.session.active', { hours: h, mins: m });
}

// ── component ──────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ firmId: string }>;
}

export default function EInvoicePage({ params }: PageProps) {
  const [firmId, setFirmId] = useState('');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const gstAccess = useFeatureAccess('gst_compliance');
  // Finance GST polish: copy via finance.gst.einvoice.* (and shared finance.gst.common.*).
  const t = useTranslations('finance.gst');
  // Shared finance list error copy (errorTitle/errorBody/retry) lives under finance.sales.listCommon.
  const tShared = useTranslations('finance.sales');

  // Error/retry pair: a failed tab fetch sets `error`; the Retry button bumps reloadKey to refetch.
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Session state
  const [sessionMode, setSessionMode] = useState<'gsp_surepass' | 'nic_direct' | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionExpiresMs, setSessionExpiresMs] = useState(0);
  const [sessionLoading, setSessionLoading] = useState(false);

  // OTP modal
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpSessionId, setOtpSessionId] = useState('');
  const [otpMobileLast4, setOtpMobileLast4] = useState<string | undefined>();
  const pendingInvoiceIdRef = useRef<string | null>(null);
  const otpSuccessCallbackRef = useRef<(() => void) | null>(null);

  // Tab data
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [generatedItems, setGeneratedItems] = useState<any[]>([]);
  const [cancelledItems, setCancelledItems] = useState<any[]>([]);
  const [retryItems, setRetryItems] = useState<any[]>([]);
  const [loadingTab, setLoadingTab] = useState<string>('pending');
  const [activeTab, setActiveTab] = useState('pending');

  // Row action states
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  // QR preview
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState<{ qrDataUrl: string; irn: string; ackNo: string } | null>(
    null,
  );

  // Cancel IRN form state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelInvoiceId, setCancelInvoiceId] = useState('');
  const [cancelIrnStr, setCancelIrnStr] = useState('');
  const [cancelReason, setCancelReason] = useState<number>(1);
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Timer for session countdown
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Timer for cancel deadline updates
  const deadlineTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, forceUpdate] = useState(0);

  const loadSessionStatus = async () => {
    startTransition(() => {
      setSessionLoading(true);
    });
    try {
      const result = await prepareIrpSession(wsId, firmId);
      if ('sessionReady' in result && result.sessionReady) {
        startTransition(() => {
          setSessionActive(true);
          // SurePass mode = no expiry concept; set a large value
          setSessionExpiresMs(4 * 3600 * 1000);
          setSessionMode('gsp_surepass');
        });
      } else if ('needsOtp' in result && result.needsOtp) {
        startTransition(() => {
          setSessionMode('nic_direct');
          setSessionActive(false);
        });
      } else if ('locked' in result && result.locked) {
        startTransition(() => {
          setSessionMode('nic_direct');
          setSessionActive(false);
        });
      }
    } catch {
      // silently ignore on mount
    } finally {
      setSessionLoading(false);
    }
  };

  // Resolve firmId from params
  useEffect(() => {
    params.then((p) => setFirmId(p.firmId));
  }, [params]);

  // Load IRP session status on mount
  useEffect(() => {
    if (!wsId || !firmId || gstAccess.isLocked) return;
    loadSessionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, firmId, gstAccess.isLocked]);

  // Live session countdown (60s tick)
  useEffect(() => {
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    if (!sessionActive) return;
    sessionTimerRef.current = setInterval(() => {
      setSessionExpiresMs((ms) => Math.max(0, ms - 60_000));
    }, 60_000);
    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [sessionActive]);

  // Live cancel-deadline refresh (60s)
  useEffect(() => {
    deadlineTimerRef.current = setInterval(() => forceUpdate((n) => n + 1), 60_000);
    return () => {
      if (deadlineTimerRef.current) clearInterval(deadlineTimerRef.current);
    };
  }, []);

  const handleAuthenticate = async () => {
    setSessionLoading(true);
    try {
      const result = await prepareIrpSession(wsId, firmId);
      if ('needsOtp' in result && result.needsOtp) {
        setOtpSessionId(result.sessionId ?? '');
        setOtpMobileLast4(result.mobileLast4);
        otpSuccessCallbackRef.current = () => {
          setSessionActive(true);
          setSessionExpiresMs(60 * 60_000); // 1h default
          setSessionMode('nic_direct');
        };
        setOtpOpen(true);
      } else if ('sessionReady' in result && result.sessionReady) {
        setSessionActive(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('einvoice.session.startFailed');
      message.error(msg, 5);
    } finally {
      setSessionLoading(false);
    }
  };

  const loadTab = useCallback(
    async (tab: string) => {
      if (!wsId || !firmId || gstAccess.isLocked) return;
      startTransition(() => {
        setLoadingTab(tab);
        setError(false);
      });
      try {
        if (tab === 'pending') {
          const items = await listPendingEInvoices(wsId, firmId);
          startTransition(() => {
            setPendingItems(items);
          });
        } else if (tab === 'generated') {
          const { items } = await listEInvoicesByStatus(wsId, firmId, 'generated');
          startTransition(() => {
            setGeneratedItems(items);
          });
        } else if (tab === 'cancelled') {
          const { items } = await listEInvoicesByStatus(wsId, firmId, 'cancelled');
          startTransition(() => {
            setCancelledItems(items);
          });
        } else if (tab === 'retry') {
          const { items } = await listEInvoicesByStatus(wsId, firmId, 'retry');
          startTransition(() => {
            setRetryItems(items);
          });
        }
      } catch {
        startTransition(() => {
          setError(true);
        });
        message.error(t('einvoice.loadError'), 3);
      } finally {
        setLoadingTab('');
      }
    },
    [wsId, firmId],
  );

  useEffect(() => {
    if (wsId && firmId && !gstAccess.isLocked) loadTab('pending');
  }, [wsId, firmId, loadTab, gstAccess.isLocked]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    loadTab(key);
  };

  // Retry refetches whichever tab is currently in view; reloadKey is the standard finance
  // retry counter so a bump re-triggers the load even if the active tab is unchanged.
  useEffect(() => {
    if (reloadKey > 0 && wsId && firmId && !gstAccess.isLocked) loadTab(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  // ── Generate IRN flow ────────────────────────────────────────────────────────

  const executeGenerateIrn = async (invoiceId: string) => {
    setGeneratingIds((s) => new Set(s).add(invoiceId));
    try {
      const result = await generateIrn(wsId, firmId, invoiceId);
      message.success(t('einvoice.toast.irnGenerated', { last6: result.irn.slice(-6) }), 3);
      loadTab('pending');
      loadTab('generated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('einvoice.toast.irnGenFailed');
      if (msg.includes('IRP_SESSION_REQUIRED') || msg.includes('session')) {
        // Re-trigger OTP
        await triggerOtpForInvoice(invoiceId);
      } else {
        message.error(t('einvoice.toast.irnGenFailedMsg', { msg }), 5);
      }
    } finally {
      setGeneratingIds((s) => {
        const n = new Set(s);
        n.delete(invoiceId);
        return n;
      });
    }
  };

  const triggerOtpForInvoice = async (invoiceId: string) => {
    try {
      const result = await prepareIrpSession(wsId, firmId);
      if ('needsOtp' in result && result.needsOtp) {
        setOtpSessionId(result.sessionId ?? '');
        setOtpMobileLast4(result.mobileLast4);
        pendingInvoiceIdRef.current = invoiceId;
        otpSuccessCallbackRef.current = () => executeGenerateIrn(invoiceId);
        setOtpOpen(true);
      } else if ('sessionReady' in result && result.sessionReady) {
        await executeGenerateIrn(invoiceId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('einvoice.session.prepareFailed');
      message.error(msg, 5);
    }
  };

  const handleGenerateIrn = async (invoiceId: string) => {
    await triggerOtpForInvoice(invoiceId);
  };

  // ── Batch generate ───────────────────────────────────────────────────────────

  const handleBatchGenerate = () => {
    if (pendingItems.length === 0) return;
    Modal.confirm({
      title: t('einvoice.batch.title'),
      content: t('einvoice.batch.content', { count: pendingItems.length }),
      okText: t('einvoice.batch.ok'),
      cancelText: t('einvoice.batch.cancel'),
      centered: true,
      onOk: async () => {
        setBatchLoading(true);
        try {
          const ids = pendingItems.map((inv: any) => inv._id ?? inv.id);
          const { processed, queued } = await batchGenerateIrn(wsId, firmId, ids);
          message.success(t('einvoice.toast.batchResult', { processed, queued }), 4);
          loadTab('pending');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : t('einvoice.toast.batchFailed');
          message.error(msg, 5);
        } finally {
          setBatchLoading(false);
        }
      },
    });
  };

  // ── Cancel IRN ───────────────────────────────────────────────────────────────

  const openCancelModal = (invoiceId: string, irn: string) => {
    setCancelInvoiceId(invoiceId);
    setCancelIrnStr(irn);
    setCancelReason(1);
    setCancelRemarks('');
    setCancelModalOpen(true);
  };

  const handleCancelIrn = () => {
    Modal.confirm({
      title: t('einvoice.cancelModal.title'),
      content: t('einvoice.cancelModal.confirmContent', { last6: cancelIrnStr.slice(-6) }),
      okText: t('einvoice.cancelModal.ok'),
      okButtonProps: { danger: true },
      cancelText: t('einvoice.cancelModal.keep'),
      centered: true,
      onOk: async () => {
        setCancelling(true);
        try {
          await cancelIrn(
            wsId,
            firmId,
            cancelInvoiceId,
            cancelReason,
            cancelRemarks || t('einvoice.cancelModal.defaultRemark'),
          );
          message.success(t('einvoice.toast.irnCancelled'), 3);
          setCancelModalOpen(false);
          loadTab('generated');
          loadTab('cancelled');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : t('einvoice.toast.cancelFailed');
          message.error(msg, 5);
        } finally {
          setCancelling(false);
        }
      },
    });
  };

  // ── QR Preview ───────────────────────────────────────────────────────────────

  const handleViewQr = async (invoiceId: string) => {
    try {
      const data = await getEInvoiceQr(wsId, firmId, invoiceId);
      setQrData(data);
      setQrOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('einvoice.toast.qrFailed');
      message.error(msg, 4);
    }
  };

  // ── Table columns ────────────────────────────────────────────────────────────

  const pendingColumns: ColumnsType<any> = [
    {
      title: t('einvoice.col.invoiceNo'),
      dataIndex: 'voucherNumber',
      width: 130,
      render: (val: string) => (
        <span className="font-body text-[14px]" style={{ color: 'var(--cr-primary)' }}>
          {val}
        </span>
      ),
    },
    {
      title: t('einvoice.col.date'),
      dataIndex: 'voucherDate',
      width: 90,
      render: (val: string) => formatDate(val),
    },
    {
      title: t('einvoice.col.party'),
      key: 'party',
      width: 180,
      render: (_: any, row: any) => {
        const name = row.partySnapshot?.name ?? row.partyName ?? '-';
        return (
          <Tooltip title={name}>
            <span className="block max-w-[160px] truncate">{name}</span>
          </Tooltip>
        );
      },
    },
    {
      title: t('einvoice.col.grandTotal'),
      dataIndex: 'grandTotalPaise',
      width: 120,
      align: 'right',
      render: (val: number) => formatINR(val ?? 0),
    },
    {
      title: t('einvoice.col.status'),
      key: 'status',
      width: 100,
      render: (_: any, row: any) => {
        const s = row.eInvoice?.status ?? 'pending';
        if (s === 'failed') return <DsTag status="error" label={t('einvoice.status.failed')} />;
        if (s === 'pending') return <DsTag status="warning" label={t('einvoice.status.pending')} />;
        return <DsTag status="processing" label={t('einvoice.status.queued')} />;
      },
    },
    {
      title: t('einvoice.col.age'),
      key: 'age',
      width: 80,
      render: (_: any, row: any) => {
        const days = ageDays(row.voucherDate);
        return <span style={{ color: ageColor(days) }}>{formatAgeLabel(days, t)}</span>;
      },
    },
    {
      title: t('einvoice.col.actions'),
      key: 'actions',
      width: 120,
      render: (_: any, row: any) => {
        const id = row._id ?? row.id;
        return (
          <DsButton
            dsVariant="primary"
            dsSize="sm"
            loading={generatingIds.has(id)}
            disabled={batchLoading}
            onClick={() => handleGenerateIrn(id)}
          >
            {t('einvoice.action.generateIrn')}
          </DsButton>
        );
      },
    },
  ];

  const generatedColumns: ColumnsType<any> = [
    {
      title: t('einvoice.col.invoiceNo'),
      dataIndex: 'voucherNumber',
      width: 130,
      render: (val: string) => <span style={{ color: 'var(--cr-primary)' }}>{val}</span>,
    },
    {
      title: t('einvoice.col.irn'),
      key: 'irn',
      width: 200,
      render: (_: any, row: any) => {
        const irn: string = row.eInvoice?.irn ?? '';
        return (
          <div className="flex items-center gap-1">
            <Tooltip title={irn}>
              <span className="font-mono text-[12px]">{formatIrnShort(irn)}</span>
            </Tooltip>
            <CopyOutlined
              style={{ fontSize: 12, color: 'var(--cr-text-3)', cursor: 'pointer' }}
              onClick={() => {
                navigator.clipboard.writeText(irn);
                message.success(t('einvoice.toast.copied'), 2);
              }}
            />
          </div>
        );
      },
    },
    {
      title: t('einvoice.col.ackDate'),
      key: 'ackDate',
      width: 110,
      render: (_: any, row: any) => formatDate(row.eInvoice?.ackDate),
    },
    {
      title: t('einvoice.col.ackNo'),
      key: 'ackNo',
      width: 140,
      render: (_: any, row: any) => (
        <span className="font-mono text-[12px]" style={{ color: 'var(--cr-text-2)' }}>
          {row.eInvoice?.ackNo ?? '-'}
        </span>
      ),
    },
    {
      title: t('einvoice.col.cancelDeadlineCol'),
      key: 'cancelDeadline',
      width: 120,
      render: (_: any, row: any) => {
        if (!row.eInvoice?.ackDate) return '-';
        const { label, color } = cancelDeadline(row.eInvoice.ackDate, t);
        return <span style={{ color }}>{label}</span>;
      },
    },
    {
      title: t('einvoice.col.qr'),
      key: 'qr',
      width: 60,
      render: (_: any, row: any) => (
        <span
          style={{ color: 'var(--cr-primary)', cursor: 'pointer', fontSize: 13 }}
          onClick={() => handleViewQr(row._id ?? row.id)}
        >
          {t('einvoice.action.viewQr')}
        </span>
      ),
    },
    {
      title: t('einvoice.col.actions'),
      key: 'actions',
      width: 100,
      render: (_: any, row: any) => {
        const ackDate = row.eInvoice?.ackDate;
        const isPast24h = ackDate && Date.now() - new Date(ackDate).getTime() >= 24 * 3600 * 1000;
        return (
          <Tooltip title={isPast24h ? t('einvoice.action.irnPermanent') : undefined}>
            <span>
              <DsButton
                dsVariant="danger"
                dsSize="sm"
                disabled={!!isPast24h}
                onClick={() => openCancelModal(row._id ?? row.id, row.eInvoice?.irn ?? '')}
              >
                {t('einvoice.action.cancelIrn')}
              </DsButton>
            </span>
          </Tooltip>
        );
      },
    },
  ];

  const cancelledColumns: ColumnsType<any> = [
    { title: t('einvoice.col.invoiceNo'), dataIndex: 'voucherNumber', width: 130 },
    {
      title: t('einvoice.col.irn'),
      key: 'irn',
      width: 200,
      render: (_: any, row: any) => (
        <Tooltip title={row.eInvoice?.irn ?? ''}>
          <span className="font-mono text-[12px]">{formatIrnShort(row.eInvoice?.irn ?? '-')}</span>
        </Tooltip>
      ),
    },
    {
      title: t('einvoice.col.ackDate'),
      key: 'ackDate',
      width: 110,
      render: (_: any, row: any) => formatDate(row.eInvoice?.ackDate),
    },
    {
      title: t('einvoice.col.cancelledAt'),
      key: 'cancelledAt',
      width: 110,
      render: (_: any, row: any) => formatDate(row.eInvoice?.cancelledAt),
    },
    {
      title: t('einvoice.col.cancelReason'),
      key: 'cancelReason',
      width: 140,
      render: (_: any, row: any) => {
        const codes: Record<number, string> = {
          1: t('einvoice.cancelReason.duplicate'),
          2: t('einvoice.cancelReason.dataEntry'),
          3: t('einvoice.cancelReason.orderCancelled'),
          4: t('einvoice.cancelReason.others'),
        };
        return codes[row.eInvoice?.cancelReason as number] ?? '-';
      },
    },
  ];

  const retryColumns: ColumnsType<any> = [
    { title: t('einvoice.col.invoiceNo'), dataIndex: 'voucherNumber', width: 130 },
    {
      title: t('einvoice.col.attempts'),
      key: 'attempts',
      width: 80,
      render: (_: any, row: any) => row.eInvoice?.attempts ?? 0,
    },
    {
      title: t('einvoice.col.lastError'),
      key: 'lastError',
      width: 220,
      render: (_: any, row: any) => (
        <Tooltip title={row.eInvoice?.lastError ?? ''}>
          <span className="block max-w-[200px] truncate text-[12px]">
            {row.eInvoice?.lastError ?? '-'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: t('einvoice.col.actions'),
      key: 'actions',
      width: 120,
      render: (_: any, row: any) => {
        const id = row._id ?? row.id;
        return (
          <DsButton
            dsVariant="primary"
            dsSize="sm"
            loading={generatingIds.has(id)}
            onClick={() => handleGenerateIrn(id)}
          >
            {t('einvoice.action.retryNow')}
          </DsButton>
        );
      },
    },
  ];

  // ── Session status badge ─────────────────────────────────────────────────────

  const renderSessionBadge = () => {
    if (sessionLoading) return <Badge status="processing" text={t('einvoice.session.checking')} />;
    if (sessionMode === 'gsp_surepass') {
      return (
        <span className="font-body text-[13px] italic" style={{ color: 'var(--cr-text-4)' }}>
          {t('einvoice.session.gspNoSession')}
        </span>
      );
    }
    if (sessionActive && sessionExpiresMs > 0) {
      return (
        <Badge
          status="success"
          text={
            <span style={{ color: 'var(--cr-success)' }}>
              {sessionExpiresLabel(sessionExpiresMs, t)}
            </span>
          }
        />
      );
    }
    return (
      <span className="flex items-center gap-2">
        <Badge
          status="error"
          text={<span style={{ color: 'var(--cr-error)' }}>{t('einvoice.session.expired')}</span>}
        />
        <span
          style={{
            color: 'var(--cr-primary)',
            cursor: 'pointer',
            fontSize: 13,
            textDecoration: 'underline',
          }}
          onClick={handleAuthenticate}
        >
          {t('einvoice.session.authenticate')}
        </span>
      </span>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const tabItems = [
    {
      key: 'pending',
      label: (
        <span>
          {t('einvoice.tab.pending')}{' '}
          <Badge count={pendingItems.length} style={{ backgroundColor: 'var(--cr-warning)' }} />
        </span>
      ),
      children: (
        <div>
          <div className="mb-3 flex justify-end">
            <DsButton
              dsVariant="primary"
              loading={batchLoading}
              disabled={pendingItems.length === 0}
              onClick={handleBatchGenerate}
            >
              {t('einvoice.action.generateAll', { count: pendingItems.length })}
            </DsButton>
          </div>
          <DsTable
            columns={pendingColumns}
            dataSource={pendingItems}
            rowKey={(r: any, i?: number) => r._id ?? r.id ?? i ?? 0}
            loading={loadingTab === 'pending'}
            scrollX="max-content"
            pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (t) => `${t} records` }}
          />
        </div>
      ),
    },
    {
      key: 'generated',
      label: (
        <span>
          {t('einvoice.tab.generated')}{' '}
          <Badge count={generatedItems.length} style={{ backgroundColor: 'var(--cr-info)' }} />
        </span>
      ),
      children: (
        <DsTable
          columns={generatedColumns}
          dataSource={generatedItems}
          rowKey={(r: any, i?: number) => r._id ?? r.id ?? i ?? 0}
          loading={loadingTab === 'generated'}
          scrollX="max-content"
          pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (t) => `${t} records` }}
        />
      ),
    },
    {
      key: 'cancelled',
      label: (
        <span>
          {t('einvoice.tab.cancelled')} <Badge count={cancelledItems.length} />
        </span>
      ),
      children: (
        <DsTable
          columns={cancelledColumns}
          dataSource={cancelledItems}
          rowKey={(r: any, i?: number) => r._id ?? r.id ?? i ?? 0}
          loading={loadingTab === 'cancelled'}
          scrollX="max-content"
          pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (t) => `${t} records` }}
        />
      ),
    },
    {
      key: 'retry',
      label: (
        <span>
          {t('einvoice.tab.retry')}{' '}
          <Badge count={retryItems.length} style={{ backgroundColor: 'var(--cr-error)' }} />
        </span>
      ),
      children: (
        <DsTable
          columns={retryColumns}
          dataSource={retryItems}
          rowKey={(r: any, i?: number) => r._id ?? r.id ?? i ?? 0}
          loading={loadingTab === 'retry'}
          scrollX="max-content"
          pagination={{ pageSize: 50, showSizeChanger: false, showTotal: (t) => `${t} records` }}
        />
      ),
    },
  ];

  if (gstAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (gstAccess.isLocked) {
    return <ModuleLockedPage module="gst_compliance" />;
  }

  return (
    <div
      className="flex flex-col gap-md p-lg"
      style={{ background: 'var(--cr-bg)', minHeight: '100vh' }}
    >
      <DsPageHeader
        title={t('einvoice.title')}
        icon={<QrcodeOutlined />}
        titleAside={<InfoTooltip text={t('einvoice.info')} />}
        right={<div className="flex items-center gap-sm">{renderSessionBadge()}</div>}
      />

      {/* Tabs (or error state if a tab fetch failed) */}
      <div style={{ background: 'var(--cr-surface)', borderRadius: 8, padding: 16 }}>
        {error ? (
          <ListErrorState
            title={tShared('listCommon.errorTitle')}
            body={tShared('listCommon.errorBody')}
            retryLabel={tShared('listCommon.retry')}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
        ) : (
          <Tabs type="line" activeKey={activeTab} onChange={handleTabChange} items={tabItems} />
        )}
      </div>

      {/* OTP Modal */}
      <IrpOtpModal
        open={otpOpen}
        sessionId={otpSessionId}
        mobileLast4={otpMobileLast4}
        wsId={wsId}
        firmId={firmId}
        onSuccess={() => {
          setOtpOpen(false);
          setSessionActive(true);
          otpSuccessCallbackRef.current?.();
        }}
        onClose={() => setOtpOpen(false)}
        onResendSuccess={(newSessionId) => setOtpSessionId(newSessionId)}
      />

      {/* QR Preview Modal */}
      {qrData && (
        <QrPreviewModal
          open={qrOpen}
          qrDataUrl={qrData.qrDataUrl}
          irn={qrData.irn}
          ackNo={qrData.ackNo}
          onClose={() => setQrOpen(false)}
        />
      )}

      {/* Cancel IRN Modal */}
      <Modal
        open={cancelModalOpen}
        title={t('einvoice.cancelModal.title')}
        onCancel={() => setCancelModalOpen(false)}
        centered
        footer={
          <div className="flex justify-end gap-2">
            <DsButton dsVariant="ghost" onClick={() => setCancelModalOpen(false)}>
              {t('einvoice.cancelModal.keep')}
            </DsButton>
            <DsButton dsVariant="danger" loading={cancelling} onClick={handleCancelIrn}>
              {t('einvoice.cancelModal.ok')}
            </DsButton>
          </div>
        }
      >
        <Alert
          type="warning"
          showIcon
          title={t('einvoice.cancelModal.alert', { last6: cancelIrnStr.slice(-6) })}
          style={{ marginBottom: 16 }}
        />
        <div className="flex flex-col gap-3">
          <div>
            <label
              className="font-body text-[13px] font-bold"
              style={{ color: 'var(--cr-text-2)' }}
            >
              {t('einvoice.cancelModal.reasonLabel')}
            </label>
            <Select
              value={cancelReason}
              onChange={(v) => setCancelReason(v)}
              style={{ width: '100%', marginTop: 4 }}
              options={[
                { value: 1, label: t('einvoice.cancelReason.r1') },
                { value: 2, label: t('einvoice.cancelReason.r2') },
                { value: 3, label: t('einvoice.cancelReason.r3') },
                { value: 4, label: t('einvoice.cancelReason.r4') },
              ]}
            />
          </div>
          <div>
            <label
              className="font-body text-[13px] font-bold"
              style={{ color: 'var(--cr-text-2)' }}
            >
              {t('einvoice.cancelModal.remarksLabel')}
            </label>
            <input
              type="text"
              value={cancelRemarks}
              onChange={(e) => setCancelRemarks(e.target.value)}
              maxLength={100}
              className="mt-1 w-full rounded border px-3 py-2 text-[14px]"
              style={{ borderColor: 'var(--cr-border)', color: 'var(--cr-text)' }}
              placeholder={t('einvoice.cancelModal.remarksPlaceholder')}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
