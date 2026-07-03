'use client';

/**
 * ERPEntityLinkControl - the owner-only "link this page/shop to my ERP workspace"
 * control shared by the Company Page editor and the Storefront settings (ADR-0004
 * / 2026-06-18 spec). It replaces the old passive "earn the badge" note with an
 * explicit, consented, ownership-checked link action.
 *
 *   not linked -> a "Link to my ERP workspace" CTA that opens ERPConsentModal in
 *                 entity mode (transparency + owned-workspace picker); on confirm
 *                 it calls the host's `onLink(workspaceId)`.
 *   linked     -> a "Linked to your ERP" summary + an "Unlink" control that opens
 *                 a small confirm (unlinkConfirm.*); on confirm it calls `onUnlink`.
 *
 * Generic over the two entities: the host (CompanyPageForm / StorefrontSettings)
 * owns the actual link/unlink server action and passes thin callbacks that return
 * the discriminated result so this control can surface the friendly inline error
 * for the `notOwner` 403 vs a generic failure.
 *
 * Cross-module: link/unlink actions live in entities/company-page.actions
 * (linkPageErp/unlinkPageErp) + entities/storefront.actions
 * (linkStorefrontErp/unlinkStorefrontErp); the workspace picker reads
 * lib/actions/workspaces.actions listWorkspaces. Copy = connect.erpConsent.entity.*
 * + connect.erpConsent.unlinkConfirm.*.
 *
 * Watch: the host should refresh its entity after a successful link/unlink so the
 * `linked` prop flips - this control is presentation + flow only, it holds no
 * source-of-truth link state.
 */

import { useState } from 'react';
import { App as AntApp, Modal } from 'antd';
import { useTranslations } from 'next-intl';
import { Building2, ShieldCheck } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import ERPConsentModal from './ERPConsentModal';

/** The discriminated link result both entity actions return (notOwner vs generic). */
export type EntityLinkOutcome = { ok: true } | { ok: false; code: 'notOwner' | 'generic' };

export interface ERPEntityLinkControlProps {
  /** Whether the entity is currently ERP-linked (host derives from erpWorkspaceId). */
  linked: boolean;
  /** Link the entity to the chosen owned workspace. Returns the outcome so this
   *  control can show the right inline error. The host owns the toast + refresh. */
  onLink: (workspaceId: string) => Promise<EntityLinkOutcome>;
  /** Unlink the entity (badge drops). The host owns the toast + refresh. */
  onUnlink: () => Promise<EntityLinkOutcome>;
}

export default function ERPEntityLinkControl({
  linked,
  onLink,
  onUnlink,
}: ERPEntityLinkControlProps) {
  const t = useTranslations('connect.erpConsent.entity');
  const tConfirm = useTranslations('connect.erpConsent.unlinkConfirm');
  const { message } = AntApp.useApp();
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const handleLink = async (workspaceId?: string) => {
    if (!workspaceId) return;
    setLinking(true);
    try {
      const res = await onLink(workspaceId);
      if (res.ok) {
        setLinkModalOpen(false);
        void message.success(t('linkedToast'));
      } else {
        // notOwner = the caller does not own that workspace (BE 403); generic = anything else.
        message.error(res.code === 'notOwner' ? t('notOwnerError') : t('genericError'));
      }
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      const res = await onUnlink();
      if (res.ok) {
        setUnlinkOpen(false);
        void message.success(t('unlinkedToast'));
      } else {
        message.error(t('genericError'));
      }
    } finally {
      setUnlinking(false);
    }
  };

  if (linked) {
    return (
      <div
        className="flex items-start gap-2.5 p-3"
        style={{
          background: 'var(--cr-wash-indigo)',
          border: '1px solid var(--cr-primary-border)',
          borderRadius: 'var(--cr-radius-md)',
        }}
      >
        <ShieldCheck
          size={16}
          aria-hidden
          style={{ color: 'var(--cr-primary)', flex: 'none', marginTop: 1 }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-bold" style={{ color: 'var(--cr-text)' }}>
            {t('linkedTitle')}
          </div>
          <p
            className="m-0 mt-0.5 text-[11.5px] leading-relaxed"
            style={{ color: 'var(--cr-text-4)' }}
          >
            {t('linkedBody')}
          </p>
          <div className="mt-2">
            <DsButton dsVariant="ghost" dsSize="sm" onClick={() => setUnlinkOpen(true)}>
              {t('unlink')}
            </DsButton>
          </div>
        </div>

        {/* Unlink confirm - a small are-you-sure (the badge drops immediately). */}
        <Modal
          open={unlinkOpen}
          onCancel={() => setUnlinkOpen(false)}
          title={tConfirm('title')}
          okText={tConfirm('confirm')}
          okButtonProps={{ danger: true, loading: unlinking }}
          cancelText={tConfirm('cancel')}
          onOk={() => void handleUnlink()}
          destroyOnHidden
          centered
        >
          <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-3)' }}>
            {tConfirm('body')}
          </p>
        </Modal>
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-2.5 p-3"
      style={{
        background: 'var(--cr-surface-2)',
        border: '1px solid var(--cr-divider)',
        borderRadius: 'var(--cr-radius-md)',
      }}
    >
      <Building2
        size={16}
        aria-hidden
        style={{ color: 'var(--cr-text-4)', flex: 'none', marginTop: 1 }}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-bold" style={{ color: 'var(--cr-text)' }}>
          {t('linkTitle')}
        </div>
        <p
          className="m-0 mt-0.5 text-[11.5px] leading-relaxed"
          style={{ color: 'var(--cr-text-3)' }}
        >
          {t('linkBody')}
        </p>
        <div className="mt-2">
          <DsButton dsVariant="primary" dsSize="sm" onClick={() => setLinkModalOpen(true)}>
            {t('linkCta')}
          </DsButton>
        </div>
      </div>

      <ERPConsentModal
        open={linkModalOpen}
        mode="entity"
        loading={linking}
        onConfirm={(workspaceId) => void handleLink(workspaceId)}
        onCancel={() => setLinkModalOpen(false)}
      />
    </div>
  );
}
