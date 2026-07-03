'use client';

/**
 * AttachStorePicker - modal to attach an EXISTING storefront to a company page.
 * Lists the owner's storefronts; only unlinked ones (companyPageId null) are
 * selectable, already-linked ones render disabled ("Linked to another page").
 * Confirm calls attachStoreToPage. Links to: company-page store link endpoints
 * (attachStoreToPage) + the owner's storefronts (listMyStorefronts).
 * Gotcha: the BE also rejects a store linked elsewhere, so this disabled state
 * is a UX guard, not the only enforcement.
 */

import { useEffect, useState } from 'react';
import { Modal, message } from 'antd';
import { useTranslations } from 'next-intl';
import DsButton from '@/components/ui/DsButton';
import { listMyStorefronts } from './storefront.actions';
import { attachStoreToPage } from './company-page.actions';
import type { Storefront } from './entities.types';

export default function AttachStorePicker({
  open,
  pageId,
  onClose,
  onAttached,
}: {
  open: boolean;
  pageId: string;
  onClose: () => void;
  onAttached: () => void;
}) {
  const t = useTranslations('connect.companyPage');
  const [stores, setStores] = useState<Storefront[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, ctx] = message.useMessage();

  // Reload the owner's stores each time the modal opens (a freshly created store
  // should appear without a remount). No reset-on-close here: the parent re-keys
  // nothing, so we clear the selection in the close/confirm handlers instead
  // (avoids a setState-in-effect cascade).
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- on-open lazy fetch; reset + spinner are the intended sync state for this open
    setSelected(null);
    setLoading(true);
    void listMyStorefronts().then((res) => {
      if (res.ok) setStores(res.data);
      setLoading(false);
    });
  }, [open]);

  const confirm = async () => {
    if (!selected) return;
    setSaving(true);
    const res = await attachStoreToPage(pageId, selected);
    setSaving(false);
    if (!res.ok) {
      msg.error(res.error);
      return;
    }
    setSelected(null);
    onAttached();
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('attachStoreTitle')}
      footer={null}
      destroyOnHidden
    >
      {ctx}
      {loading ? (
        <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('loading')}
        </p>
      ) : stores.length === 0 ? (
        <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('noStoresToAttach')}
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {stores.map((s) => {
            // A store already linked to ANOTHER page is not attachable here (the
            // BE rejects a silent move). A store linked to THIS page is the current
            // attachment, so it is also non-selectable.
            const linkedElsewhere = !!s.companyPageId;
            const active = selected === s._id;
            return (
              <li key={s._id}>
                <button
                  type="button"
                  disabled={linkedElsewhere}
                  onClick={() => setSelected(s._id)}
                  className="flex w-full items-center justify-between gap-2 rounded-[var(--cr-radius-md)] px-3 py-2 text-left"
                  style={{
                    border: `1px solid ${active ? 'var(--cr-primary)' : 'var(--cr-border)'}`,
                    background: active ? 'var(--cr-primary-light)' : 'var(--cr-surface)',
                    opacity: linkedElsewhere ? 0.5 : 1,
                    cursor: linkedElsewhere ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--cr-text)' }}>
                    {s.name}
                  </span>
                  {linkedElsewhere && (
                    <span className="text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
                      {t('storeLinkedElsewhere')}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <DsButton dsVariant="ghost" onClick={onClose} disabled={saving}>
          {t('cancel')}
        </DsButton>
        <DsButton dsVariant="primary" onClick={confirm} loading={saving} disabled={!selected}>
          {t('attachStoreConfirm')}
        </DsButton>
      </div>
    </Modal>
  );
}
