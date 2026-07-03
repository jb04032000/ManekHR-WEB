'use client';

/**
 * Phase 16 / FIN-15-03 - Share Portal Token modal.
 *
 * Per UI-SPEC §Portal Access (Owner side):
 *   • Title "Share with {partyName}"
 *   • Read-only URL field + "Copy link" → navigator.clipboard.writeText
 *   • "Send via WhatsApp" - disabled with tooltip if !party.phone
 *   • "Send via email" - disabled with tooltip if !party.email
 *   • Footnote - server-side template; UI just shows revocation note
 *
 * The `url` is the URL captured at issuance time - NEVER reconstructed
 * (T-16-04-06 mitigation: raw JWT not persisted, controller cannot rebuild).
 *
 * `sharePortalToken` is called for every channel including 'copy' so the
 * audit log captures the share intent. Failures are non-blocking.
 */
import { useState } from 'react';
import { Input, Modal, Tooltip, message } from 'antd';
import { useTranslations } from 'next-intl';
import { DsButton } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { portalTokensApi } from '@/lib/api/modules/portal-tokens.api';
import type { Party } from '@/types';

export default function ShareModal({
  open,
  jti,
  url,
  party,
  onClose,
}: {
  open: boolean;
  jti: string;
  url: string;
  party: Party;
  onClose: () => void;
}) {
  const t = useTranslations('finance.portal');
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';
  const partyId = party._id;
  const [busyChannel, setBusyChannel] = useState<'copy' | 'whatsapp' | 'email' | null>(null);

  async function recordShare(channel: 'copy' | 'whatsapp' | 'email', recipient?: string) {
    try {
      await portalTokensApi.share(wsId, partyId, jti, {
        url,
        channel,
        recipient,
      });
    } catch {
      // Non-blocking - UI does not surface audit-record failures.
    }
  }

  async function handleCopy() {
    setBusyChannel('copy');
    try {
      await navigator.clipboard.writeText(url);
      message.success(t('access.shareCopySuccess'));
    } catch {
      message.error(t('access.shareCopyError'));
    } finally {
      void recordShare('copy');
      setBusyChannel(null);
    }
  }

  async function handleWhatsApp() {
    if (!party.phone) return;
    setBusyChannel('whatsapp');
    try {
      const text = encodeURIComponent(t('access.shareWhatsAppText', { firmName: party.name, url }));
      const phone = party.phone.replace(/\D/g, '');
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
      void recordShare('whatsapp', party.phone);
    } finally {
      setBusyChannel(null);
    }
  }

  async function handleEmail() {
    if (!party.email) return;
    setBusyChannel('email');
    try {
      void recordShare('email', party.email);
      message.success(t('access.shareEmailQueued'));
    } finally {
      setBusyChannel(null);
    }
  }

  return (
    <Modal
      open={open}
      title={t('access.shareTitle', { partyName: party.name })}
      onCancel={onClose}
      footer={
        <DsButton type="primary" onClick={onClose}>
          {t('access.shareDone')}
        </DsButton>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div
            className="cr-label"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--cr-text-3)',
              marginBottom: 4,
            }}
          >
            {t('access.sharePortalLink')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input value={url} readOnly aria-label={t('access.sharePortalLink')} />
            <DsButton type="primary" loading={busyChannel === 'copy'} onClick={handleCopy}>
              {t('access.shareCopyLink')}
            </DsButton>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {party.phone ? (
            <DsButton loading={busyChannel === 'whatsapp'} onClick={handleWhatsApp}>
              {t('access.shareWhatsApp')}
            </DsButton>
          ) : (
            <Tooltip title={t('access.shareWhatsAppDisabled', { partyName: party.name })}>
              <span>
                <DsButton disabled>{t('access.shareWhatsApp')}</DsButton>
              </span>
            </Tooltip>
          )}

          {party.email ? (
            <DsButton loading={busyChannel === 'email'} onClick={handleEmail}>
              {t('access.shareEmail')}
            </DsButton>
          ) : (
            <Tooltip title={t('access.shareEmailDisabled', { partyName: party.name })}>
              <span>
                <DsButton disabled>{t('access.shareEmail')}</DsButton>
              </span>
            </Tooltip>
          )}
        </div>

        <p style={{ fontSize: 12, color: 'var(--cr-text-3)', margin: 0 }}>
          {t('access.shareRevokeNote')}
        </p>
      </div>
    </Modal>
  );
}
