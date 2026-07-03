'use client';

import { useState } from 'react';
import { Alert, App, Button, DatePicker, Divider, Input, Modal, Tag, Typography } from 'antd';
import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { salaryApi } from '@/lib/api';
import { formatCurrencyFull, parseApiError } from '@/lib/utils';
import type { SettleResult } from '@/types';

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  /** One or more member IDs to settle. */
  memberIds: string[];
  /** Display name map for each member ID. */
  memberNames: Record<string, string>;
  onSettled: () => void;
}

export function SettleModal({
  open,
  onClose,
  workspaceId,
  memberIds,
  memberNames,
  onSettled,
}: Props) {
  const t = useTranslations('salary.ledger');
  const { message } = App.useApp();

  const [cutoffDate, setCutoffDate] = useState<dayjs.Dayjs>(dayjs());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SettleResult | null>(null);

  const handleSettle = async () => {
    setSubmitting(true);
    try {
      const res = await salaryApi.settleLedger(workspaceId, {
        teamMemberIds: memberIds,
        upToDate: cutoffDate.format('YYYY-MM-DD'),
        note: note || undefined,
      });
      setResult(res);
    } catch (e) {
      void message.error(parseApiError(e) || t('settleError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDone = () => {
    setResult(null);
    setNote('');
    setCutoffDate(dayjs());
    onSettled();
  };

  const handleCancel = () => {
    if (!result) {
      setNote('');
      setCutoffDate(dayjs());
    }
    onClose();
  };

  const anyMinWageFlag = result?.results.some((r) => r.minimumWageFlag.flag) ?? false;

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={t('settleModalTitle')}
      footer={
        result ? (
          <Button type="primary" onClick={handleDone}>
            {t('doneBtn')}
          </Button>
        ) : (
          <div className="flex justify-end gap-2">
            <Button onClick={handleCancel}>{t('cancelBtn')}</Button>
            <Button type="primary" loading={submitting} onClick={handleSettle}>
              {t('settleConfirmBtn')}
            </Button>
          </div>
        )
      }
      width={520}
    >
      {!result ? (
        <div className="space-y-4">
          <div>
            <Text className="mb-1 block text-sm font-medium">{t('settleWorkers')}</Text>
            <div className="flex flex-wrap gap-1">
              {memberIds.map((id) => (
                <Tag key={id}>{memberNames[id] ?? id}</Tag>
              ))}
            </div>
          </div>

          <div>
            <Text className="mb-1 block text-sm font-medium">{t('settleCutoffLabel')}</Text>
            <DatePicker
              value={cutoffDate}
              onChange={(d) => {
                if (d) setCutoffDate(d);
              }}
              format="DD MMM YYYY"
              allowClear={false}
              disabledDate={(d) => d.isAfter(dayjs(), 'day')}
            />
            <Text type="secondary" className="ml-2 text-xs">
              {t('settleCutoffHint')}
            </Text>
          </div>

          <div>
            <Text className="mb-1 block text-sm font-medium">{t('settleNoteLabel')}</Text>
            <Input.TextArea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('settleNotePlaceholder')}
              maxLength={200}
              rows={2}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {anyMinWageFlag && (
            <Alert
              type="warning"
              showIcon
              title={t('minWageFlagTitle')}
              description={t('minWageFlagDesc')}
            />
          )}

          <Divider className="my-3" />

          {result.results.map((r) => (
            <div
              key={r.teamMemberId}
              className="flex items-start justify-between rounded-lg border p-3"
              style={{ borderColor: 'var(--cr-border)' }}
            >
              <div>
                <Text strong>{memberNames[r.teamMemberId] ?? r.teamMemberId}</Text>
                {r.minimumWageFlag.flag && (
                  <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                    <WarningOutlined />
                    <span>
                      {t('minWageFlagShort', {
                        earned: formatCurrencyFull(r.minimumWageFlag.periodEarned),
                        floor: formatCurrencyFull(r.minimumWageFlag.proratedMinWage ?? 0),
                      })}
                    </span>
                  </div>
                )}
              </div>
              <div className="text-right">
                {r.settled ? (
                  <div className="flex items-center gap-1 text-green-700">
                    <CheckCircleOutlined />
                    <span className="font-semibold">{formatCurrencyFull(r.settledAmount)}</span>
                  </div>
                ) : (
                  <Text type="secondary" className="text-xs">
                    {t('nothingToSettle')}
                  </Text>
                )}
              </div>
            </div>
          ))}

          <Divider className="my-2" />
          <div className="flex justify-between font-semibold">
            <span>{t('totalSettled')}</span>
            <span>{formatCurrencyFull(result.totalSettled)}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}
