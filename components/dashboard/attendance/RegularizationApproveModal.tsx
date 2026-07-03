'use client';
import { useState } from 'react';
import { App, Steps, Button, Input, Tag, Space, Divider } from 'antd';
import { DsModal } from '@/components/ui/DsModal';
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import {
  regularizationApi,
  getRegularizationErrorMessage,
} from '@/lib/api/modules/regularization.api';
import type { RegularizationRequest, ApprovalChainStep } from '@/types';

// ── Helper: step icon ─────────────────────────────────────────────────────────

function stepIcon(step: ApprovalChainStep, currentLevel: number) {
  if (step.decision === 'approved')
    return <CheckCircleOutlined style={{ color: 'var(--cr-success-500)' }} />;
  if (step.decision === 'rejected')
    return <CloseCircleOutlined style={{ color: 'var(--cr-danger-500)' }} />;
  if (step.level === currentLevel)
    return <ClockCircleOutlined style={{ color: 'var(--cr-primary)' }} />;
  return <ClockCircleOutlined style={{ color: 'var(--cr-neutral-300)' }} />;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RegularizationApproveModalProps {
  open: boolean;
  request: RegularizationRequest;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RegularizationApproveModal({
  open,
  request,
  onClose,
}: RegularizationApproveModalProps) {
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const t = useTranslations('attendance.approveRegularization');
  const tAtt = useTranslations('attendance');
  const tCommon = useTranslations('common');
  const [note, setNote] = useState('');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const { message: msgApi } = App.useApp();

  const handleApprove = async () => {
    if (!wsId) return;
    setApproving(true);
    try {
      await regularizationApi.approve(wsId, request._id, { note });
      void msgApi.success(t('toast.recorded'));
      onClose();
    } catch (err) {
      void msgApi.error(getRegularizationErrorMessage(err));
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!wsId) return;
    if (!note.trim()) {
      void msgApi.warning(t('toast.noteRequired'));
      return;
    }
    setRejecting(true);
    try {
      await regularizationApi.reject(wsId, request._id, { note });
      void msgApi.success(t('toast.recorded'));
      onClose();
    } catch (err) {
      void msgApi.error(getRegularizationErrorMessage(err));
    } finally {
      setRejecting(false);
    }
  };

  // Build Steps items from approvalChain
  const stepsItems = request.approvalChain.map((step) => {
    const isCurrent = step.level === request.currentLevel && request.status === 'pending';
    const decided = step.decision === 'approved' || step.decision === 'rejected';

    let description: React.ReactNode = isCurrent ? (
      <span style={{ color: 'var(--cr-primary)', fontWeight: 600 }}>{t('chain.currentLevel')}</span>
    ) : (
      <span className="text-faint">{t('chain.pending')}</span>
    );

    if (decided) {
      description = (
        <div>
          <span
            style={{
              color:
                step.decision === 'approved' ? 'var(--cr-success-500)' : 'var(--cr-danger-500)',
              fontWeight: 500,
            }}
          >
            {step.decision === 'approved' ? t('chain.approved') : t('chain.rejected')}
          </span>
          {step.decidedAt && (
            <span className="ml-1 text-xs text-faint">
              {t('chain.atPrefix', { time: dayjs(step.decidedAt).format('DD MMM YYYY HH:mm') })}
            </span>
          )}
          {step.note && (
            <div className="mt-1 text-xs text-gray-700 italic">&ldquo;{step.note}&rdquo;</div>
          )}
        </div>
      );
    }

    return {
      title: (
        <span style={{ fontWeight: isCurrent ? 700 : 400 }}>
          {t('chain.levelLabel', {
            level: step.level,
            approver: step.approverName ?? step.approverUserId,
          })}
        </span>
      ),
      description,
      icon: stepIcon(step, request.currentLevel),
    };
  });

  const requestedStatusLabel: Record<string, string> = {
    PRESENT: tAtt('present'),
    HALF_DAY: tAtt('halfDay'),
    LEAVE: tAtt('leave'),
    ABSENT: tAtt('absent'),
  };

  return (
    <DsModal
      open={open}
      title={t('title')}
      onCancel={onClose}
      width={600}
      footer={
        request.status === 'pending' ? (
          <Space>
            <Button danger onClick={handleReject} loading={rejecting} disabled={approving}>
              {t('reject')}
            </Button>
            <Button
              type="primary"
              style={{ background: 'var(--cr-success-500)', borderColor: 'var(--cr-success-500)' }}
              onClick={handleApprove}
              loading={approving}
              disabled={rejecting}
            >
              {t('approve')}
            </Button>
          </Space>
        ) : (
          <Button onClick={onClose}>{tCommon('close')}</Button>
        )
      }
    >
      {/* Request details */}
      <div className="mt-2 space-y-3">
        <div className="flex flex-wrap gap-4">
          <div>
            <span className="text-xs font-bold text-gray-700 uppercase">{t('field.member')}</span>
            <div>{request.memberName ?? request.memberId}</div>
          </div>
          <div>
            <span className="text-xs font-bold text-gray-700 uppercase">{t('field.date')}</span>
            <div>{dayjs(request.date).format('DD MMM YYYY')}</div>
          </div>
          <div>
            <span className="text-xs font-bold text-gray-700 uppercase">{t('field.change')}</span>
            <div>
              <Tag>{request.currentStatus}</Tag>
              {'→ '}
              <Tag color="blue">
                {requestedStatusLabel[request.requestedStatus] ?? request.requestedStatus}
              </Tag>
            </div>
          </div>
          {(request.requestedCheckIn || request.requestedCheckOut) && (
            <div>
              <span className="text-xs font-bold text-gray-700 uppercase">
                {t('field.requestedTimes')}
              </span>
              <div className="text-sm">
                {request.requestedCheckIn && (
                  <span className="mr-3">
                    {t('time.in', { time: dayjs(request.requestedCheckIn).format('HH:mm') })}
                  </span>
                )}
                {request.requestedCheckOut && (
                  <span>
                    {t('time.out', { time: dayjs(request.requestedCheckOut).format('HH:mm') })}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <span className="text-xs font-bold text-gray-700 uppercase">{t('field.reason')}</span>
          <div className="mt-1 rounded bg-gray-50 p-2 text-sm">{request.reason}</div>
        </div>

        {request.attachments.length > 0 && (
          <div>
            <span className="text-xs font-bold text-gray-700 uppercase">
              {t('field.attachments')}
            </span>
            <div className="mt-1 space-y-1">
              {request.attachments.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-blue-700 hover:underline"
                >
                  {t('attachmentItem', { n: i + 1 })}
                </a>
              ))}
            </div>
          </div>
        )}

        <Divider />

        {/* Approval chain */}
        <div>
          <span className="mb-2 block text-xs font-bold text-gray-700 uppercase">
            {t('chain.title')}
          </span>
          <Steps
            direction="vertical"
            size="small"
            current={
              request.status === 'pending' ? request.currentLevel - 1 : request.approvalChain.length
            }
            items={stepsItems}
          />
        </div>

        {/* Note field - shown only when pending */}
        {request.status === 'pending' && (
          <>
            <Divider />
            <div>
              <span className="mb-1 block text-xs font-bold text-gray-700 uppercase">
                {t('note.label')}{' '}
                <span className="text-red-700">{t('note.requiredForReject')}</span>
              </span>
              <Input.TextArea
                rows={3}
                maxLength={500}
                showCount
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('note.placeholder')}
              />
            </div>
          </>
        )}
      </div>
    </DsModal>
  );
}
