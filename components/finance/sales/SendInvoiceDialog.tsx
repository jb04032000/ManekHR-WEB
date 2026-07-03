'use client';
/**
 * SendInvoiceDialog - multi-channel fan-out modal (D-27).
 * Width 520px. Shows party contact summary, channel checkboxes (email/whatsapp/sms),
 * and an optional message textarea.
 * No payment-link / UPI-QR affordance: the Billing & Accounts module does NOT process or
 * collect payments (owner decision 2026-06-06 - the platform charges only the SaaS subscription).
 * The earlier D22 Razorpay-chip / UPI-QR idea is therefore intentionally NOT built; this dialog
 * only shares the document. Keep in sync with the no-payments rule before re-adding any of it.
 */
import { useEffect, useState, startTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Checkbox, Input } from 'antd';
import { MailOutlined, WhatsAppOutlined, MessageOutlined } from '@ant-design/icons';
import { DsModal } from '@/components/ui/DsModal';
import DsButton from '@/components/ui/DsButton';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import { useWorkspaceStore } from '@/lib/store';
import type { SaleInvoice } from '@/types';

interface Props {
  open: boolean;
  invoice: SaleInvoice;
  firmId: string;
  onClose: () => void;
  onSent?: () => void;
}

export function SendInvoiceDialog({ open, invoice, firmId, onClose, onSent }: Props) {
  const t = useTranslations('finance.sales');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);

  const partyEmail = invoice?.partySnapshot?.email as string | undefined;
  const partyPhone = invoice?.partySnapshot?.phone as string | undefined;

  const defaultChannels = [
    ...(partyEmail ? ['email'] : []),
    ...(partyPhone ? ['whatsapp', 'sms'] : []),
  ];

  const [channels, setChannels] = useState<string[]>(defaultChannels);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens for a new invoice
  useEffect(() => {
    if (!open) return;
    startTransition(() => {
      setChannels([...(partyEmail ? ['email'] : []), ...(partyPhone ? ['whatsapp', 'sms'] : [])]);
      setMessage('');
      setError(null);
    });
  }, [open, invoice?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async () => {
    if (!ws?._id) return;
    setBusy(true);
    setError(null);
    try {
      await financeSalesApi.invoices.send(ws._id, firmId, invoice._id, {
        channels,
        message: message.trim() || undefined,
      });
      onSent?.();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? t('editor.send.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DsModal
      open={open}
      onCancel={onClose}
      title={t('editor.send.title')}
      width={520}
      footer={null}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Party contact summary */}
        <div style={{ fontSize: 12, color: 'var(--cr-text-3)', lineHeight: '1.6' }}>
          <span>{t('editor.send.recipient')}: </span>
          <strong style={{ color: 'var(--cr-text)' }}>
            {(invoice?.partySnapshot?.name as string) ?? t('editor.send.unknownParty')}
          </strong>
          {partyEmail && <span> · {partyEmail}</span>}
          {partyPhone && <span> · {partyPhone}</span>}
          <span>
            {' · '}
            <a
              href={`/dashboard/finance/firms/${firmId}/parties/${invoice?.partyId}`}
              style={{ color: 'var(--cr-primary)' }}
            >
              {t('editor.send.editContact')}
            </a>
          </span>
        </div>

        {/* Channel checkboxes */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            {t('editor.send.channels')}
          </div>
          <Checkbox.Group
            value={channels}
            onChange={(v) => setChannels(v as string[])}
            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            <Checkbox value="email" disabled={!partyEmail}>
              <MailOutlined style={{ marginRight: 4 }} />
              {t('editor.send.email')}
              {!partyEmail && (
                <span style={{ fontSize: 11, color: 'var(--cr-text-3)', marginLeft: 6 }}>
                  {t('editor.send.noEmail')}
                </span>
              )}
            </Checkbox>
            <Checkbox value="whatsapp" disabled={!partyPhone}>
              <WhatsAppOutlined style={{ marginRight: 4 }} />
              WhatsApp
              {!partyPhone && (
                <span style={{ fontSize: 11, color: 'var(--cr-text-3)', marginLeft: 6 }}>
                  {t('editor.send.noPhone')}
                </span>
              )}
            </Checkbox>
            <Checkbox value="sms" disabled={!partyPhone}>
              <MessageOutlined style={{ marginRight: 4 }} />
              SMS
              {!partyPhone && (
                <span style={{ fontSize: 11, color: 'var(--cr-text-3)', marginLeft: 6 }}>
                  {t('editor.send.noPhone')}
                </span>
              )}
            </Checkbox>
          </Checkbox.Group>
        </div>

        {/* Optional message - only shown when email channel is selected */}
        {channels.includes('email') && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              {t('editor.send.message')}{' '}
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--cr-text-3)' }}>
                {t('editor.send.optional')}
              </span>
            </div>
            <Input.TextArea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={3}
              showCount
              placeholder={t('editor.send.messagePlaceholder')}
            />
          </div>
        )}

        {/* Error */}
        {error && <div style={{ fontSize: 12, color: 'var(--cr-error)' }}>{error}</div>}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
          <DsButton dsVariant="ghost" onClick={onClose}>
            {t('editor.send.cancel')}
          </DsButton>
          <DsButton
            dsVariant="primary"
            loading={busy}
            onClick={handleSend}
            disabled={channels.length === 0}
          >
            {t('editor.send.send')}
          </DsButton>
        </div>
      </div>
    </DsModal>
  );
}
