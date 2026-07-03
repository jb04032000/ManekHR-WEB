'use client';

import React, { useEffect, useRef, useCallback, useState, startTransition } from 'react';
import { Modal, Progress, Button, Space, Tag, Typography, Collapse } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  StopOutlined,
  LoadingOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { salaryApi } from '@/lib/api/modules/salary.api';
import type { BulkEmailJobStatusResponse, BulkEmailJobDetail } from '@/types';

const { Text } = Typography;

interface BulkEmailProgressModalProps {
  open: boolean;
  workspaceId: string;
  jobId: string | null;
  onClose: () => void;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: {
    color: 'default',
    icon: <LoadingOutlined />,
    label: 'Preparing…',
  },
  processing: {
    color: 'processing',
    icon: <LoadingOutlined />,
    label: 'Sending emails…',
  },
  completed: {
    color: 'success',
    icon: <CheckCircleOutlined />,
    label: 'Completed',
  },
  cancelled: {
    color: 'warning',
    icon: <StopOutlined />,
    label: 'Cancelled',
  },
  failed: {
    color: 'error',
    icon: <CloseCircleOutlined />,
    label: 'Failed',
  },
};

function DetailIcon({ status }: { status: BulkEmailJobDetail['status'] }) {
  if (status === 'sent') return <CheckCircleOutlined style={{ color: 'var(--cr-success-700)' }} />;
  if (status === 'failed') return <CloseCircleOutlined style={{ color: 'var(--cr-danger-700)' }} />;
  return <ExclamationCircleOutlined style={{ color: 'var(--cr-warning-700)' }} />;
}

export function BulkEmailProgressModal({
  open,
  workspaceId,
  jobId,
  onClose,
}: BulkEmailProgressModalProps) {
  const [job, setJob] = useState<BulkEmailJobStatusResponse | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTerminal =
    job?.status === 'completed' || job?.status === 'cancelled' || job?.status === 'failed';

  const poll = useCallback(async () => {
    if (!workspaceId || !jobId) return;
    try {
      const status = await salaryApi.getBulkEmailJobStatus(workspaceId, jobId);
      startTransition(() => {
        setJob(status);
      });
    } catch {
      // Silently ignore poll errors - next tick will retry
    }
  }, [workspaceId, jobId]);

  // Start polling when modal opens with a jobId
  useEffect(() => {
    if (!open || !jobId) return;

    // Immediate first fetch
    void poll();

    timerRef.current = setInterval(() => void poll(), 2000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [open, jobId, poll]);

  // Stop polling once terminal
  useEffect(() => {
    if (isTerminal && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [isTerminal]);

  const handleCancel = async () => {
    if (!workspaceId || !jobId) return;
    setCancelling(true);
    try {
      await salaryApi.cancelBulkEmailJob(workspaceId, jobId);
      // Next poll will pick up the cancelled status
    } catch {
      // ignore
    } finally {
      setCancelling(false);
    }
  };

  const handleClose = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setJob(null);
    setCancelling(false);
    onClose();
  };

  const percent = job && job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;

  const statusConfig = STATUS_CONFIG[job?.status || 'pending'] || STATUS_CONFIG.pending;

  const progressStatus =
    job?.status === 'failed' ? 'exception' : job?.status === 'completed' ? 'success' : 'active';

  return (
    <Modal
      title={
        <Space>
          <MailOutlined />
          Email All Payslips
        </Space>
      }
      open={open}
      onCancel={handleClose}
      mask={{ closable: isTerminal }}
      closable={isTerminal}
      keyboard={isTerminal}
      footer={
        <Space>
          {!isTerminal && (
            <Button danger icon={<StopOutlined />} loading={cancelling} onClick={handleCancel}>
              Cancel
            </Button>
          )}
          {isTerminal && (
            <Button type="primary" onClick={handleClose}>
              Close
            </Button>
          )}
        </Space>
      }
      width={520}
    >
      <div style={{ padding: '8px 0' }}>
        {/* Status tag + counters - aria-live so screen readers announce progress updates */}
        <div aria-live="polite" aria-atomic="true" style={{ marginBottom: 16 }}>
          <Tag color={statusConfig.color} icon={statusConfig.icon}>
            {statusConfig.label}
          </Tag>
          {job && job.total > 0 && (
            <Text type="secondary" style={{ marginLeft: 8 }}>
              {job.processed} of {job.total} employees processed
            </Text>
          )}
        </div>

        {/* Progress bar */}
        <Progress
          percent={percent}
          status={progressStatus}
          strokeColor={{
            '0%': 'var(--cr-indigo-400)',
            '100%': 'var(--cr-success-700)',
          }}
          style={{ marginBottom: 16 }}
        />

        {/* Counters */}
        {job && (
          <Space size="large" style={{ marginBottom: 16 }}>
            <Text>
              <CheckCircleOutlined style={{ color: 'var(--cr-success-700)', marginRight: 4 }} />
              Sent: <strong>{job.sent}</strong>
            </Text>
            <Text>
              <ExclamationCircleOutlined
                style={{ color: 'var(--cr-warning-700)', marginRight: 4 }}
              />
              Skipped: <strong>{job.skipped}</strong>
            </Text>
            <Text>
              <CloseCircleOutlined style={{ color: 'var(--cr-danger-700)', marginRight: 4 }} />
              Failed: <strong>{job.failed}</strong>
            </Text>
          </Space>
        )}

        {/* Error message */}
        {job?.error && (
          <div
            style={{
              padding: '8px 12px',
              background: 'var(--cr-danger-50)',
              borderRadius: 6,
              marginBottom: 12,
            }}
          >
            <Text type="danger">{job.error}</Text>
          </div>
        )}

        {/* Details accordion - show only when there are results */}
        {job && job.details.length > 0 && (
          <Collapse
            size="small"
            items={[
              {
                key: 'details',
                label: `Details (${job.details.length})`,
                children: (
                  <div
                    style={{
                      maxHeight: 200,
                      overflowY: 'auto',
                      fontSize: 13,
                    }}
                  >
                    {job.details.map((d, i) => (
                      <div
                        key={`${d.salaryId}-${i}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '4px 0',
                          borderBottom:
                            i < job.details.length - 1
                              ? '1px solid var(--cr-border-light)'
                              : undefined,
                        }}
                      >
                        <DetailIcon status={d.status} />
                        <Text style={{ flex: 1 }} ellipsis={{ tooltip: d.email }}>
                          {d.employeeName}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {d.email}
                        </Text>
                        {d.reason && (
                          <Text
                            type="secondary"
                            style={{ fontSize: 11, maxWidth: 160 }}
                            ellipsis={{ tooltip: d.reason }}
                          >
                            {d.reason}
                          </Text>
                        )}
                      </div>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        )}
      </div>
    </Modal>
  );
}
