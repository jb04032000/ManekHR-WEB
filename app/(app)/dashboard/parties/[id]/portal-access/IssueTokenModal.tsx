'use client';

/**
 * Phase 16 / FIN-15-03 - Issue Portal Token modal.
 *
 * Per UI-SPEC §Portal Access (Owner side):
 *   • Title "New portal token"
 *   • Expires-in select (1 / 7 / 30 default / 90 / 180 / 365 days)
 *   • Scope checkboxes - Statement / Invoices / Receipts
 *   • CTA "Generate Token" → on success, ShareModal opens IMMEDIATELY
 *     (single user flow per UI-SPEC §Interaction Contracts)
 *
 * View-only portal (owner decision 2026-06-06, feedback_no_payments_in_billing):
 * the Pay scope was removed - this module does no payment collection.
 */
import { useState } from 'react';
import { Checkbox, Form, Modal, Select, message } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { portalTokensApi } from '@/lib/api/modules/portal-tokens.api';
import type { IssueTokenInput, IssueTokenResult, PortalExpiryDays, PortalScope } from '@/types';

// Expiry values + their i18n label key under finance.portal.access.
const EXPIRY_OPTIONS: Array<{ value: PortalExpiryDays; labelKey: string }> = [
  { value: 1, labelKey: 'expiry1Day' },
  { value: 7, labelKey: 'expiry7Days' },
  { value: 30, labelKey: 'expiry30Days' },
  { value: 90, labelKey: 'expiry90Days' },
  { value: 180, labelKey: 'expiry180Days' },
  { value: 365, labelKey: 'expiry1Year' },
];

// Scope values + their i18n label key under finance.portal.access.
const SCOPE_OPTIONS: Array<{ value: PortalScope; labelKey: string }> = [
  { value: 'statement', labelKey: 'scopeStatement' },
  { value: 'invoices', labelKey: 'scopeInvoices' },
  { value: 'receipts', labelKey: 'scopeReceipts' },
];

export default function IssueTokenModal({
  open,
  partyId,
  partyName,
  onCancel,
  onIssued,
}: {
  open: boolean;
  partyId: string;
  partyName: string;
  onCancel: () => void;
  onIssued: (result: IssueTokenResult) => void;
}) {
  const t = useTranslations('finance.portal');
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';

  const [expiry, setExpiry] = useState<PortalExpiryDays>(30);
  const [scope, setScope] = useState<PortalScope[]>(['statement', 'invoices', 'receipts']);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (scope.length === 0) {
      message.warning(t('access.issuePickScope'));
      return;
    }
    setBusy(true);
    try {
      const dto: IssueTokenInput = { scope, expiresInDays: expiry };
      const result = await portalTokensApi.issue(wsId, partyId, dto);
      message.success(t('access.issueReady'));
      onIssued(result);
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? t('access.issueError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t('access.issueTitle')}
      onCancel={onCancel}
      onOk={handleSubmit}
      okText={t('access.generateToken')}
      okButtonProps={{ loading: busy, type: 'primary' }}
    >
      <Form layout="vertical">
        <Form.Item label={t('access.issueExpiresIn')}>
          <Select<PortalExpiryDays>
            value={expiry}
            onChange={(v) => setExpiry(v)}
            options={EXPIRY_OPTIONS.map((o) => ({
              value: o.value,
              label: t(`access.${o.labelKey}`),
            }))}
          />
        </Form.Item>

        <Form.Item label={t('access.issueScopeLabel')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SCOPE_OPTIONS.map((opt) => (
              <Checkbox
                key={opt.value}
                checked={scope.includes(opt.value)}
                onChange={(e) =>
                  setScope((prev) =>
                    e.target.checked ? [...prev, opt.value] : prev.filter((s) => s !== opt.value),
                  )
                }
              >
                {t(`access.${opt.labelKey}`)}
              </Checkbox>
            ))}
          </div>
        </Form.Item>

        <div style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>
          {t.rich('access.issueGeneratingFor', {
            partyName,
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </div>
      </Form>
    </Modal>
  );
}
