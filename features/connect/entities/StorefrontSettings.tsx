'use client';

/**
 * StorefrontSettings - the manage console's Settings tab. Shows the storefront's
 * details as read-only section cards (Basics / Logo & banner / About / Location),
 * each with an Edit affordance that opens StorefrontEditSectionModal focused on
 * that one section. Settings is a return-to surface, so the owner edits a single
 * section rather than re-submitting the whole form. After a save the modal calls
 * back here to refresh, re-syncing the cards + the console header.
 */

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Modal, Input, message } from 'antd';
import { Pencil, Trash2 } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { parseApiError } from '@/lib/utils';
// ERPEntityLinkControl is the shared owner-only ERP-link action (ADR-0004); the
// storefront analogue of the company-page link/unlink. Link/unlink hit
// linkStorefrontErp/unlinkStorefrontErp.
import { ERPEntityLinkControl, type EntityLinkOutcome } from '@/components/connect';
import StorefrontEditSectionModal, { type StorefrontSection } from './StorefrontEditSectionModal';
import { deleteStorefront, linkStorefrontErp, unlinkStorefrontErp } from './storefront.actions';
import type { Storefront } from './entities.types';

function SectionCard({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        background: 'var(--cr-surface)',
        padding: 'var(--cr-space-lg)',
        marginBottom: 'var(--cr-space-md)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--cr-text)' }}>
          {title}
        </h3>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`${editLabel}: ${title}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-semibold"
          style={{
            border: '1px solid var(--cr-border)',
            background: 'var(--cr-surface)',
            color: 'var(--cr-text-3)',
            cursor: 'pointer',
          }}
        >
          <Pencil size={13} aria-hidden /> {editLabel}
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function NotSet({ label }: { label: string }) {
  return (
    <span className="text-[13px] italic" style={{ color: 'var(--cr-text-4)' }}>
      {label}
    </span>
  );
}

export default function StorefrontSettings({ storefront }: { storefront: Storefront }) {
  const t = useTranslations('connect.storefrontAdmin');
  const tSec = useTranslations('connect.storefrontAdmin.section');
  const tc = useTranslations('connect.storefrontAdmin.console');
  const router = useRouter();
  const [msgApi, ctx] = message.useMessage();
  const tErp = useTranslations('connect.erpConsent.entity');
  const [editing, setEditing] = useState<StorefrontSection | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // ERP link (ADR-0004). Seeded from the shop's read field `erpWorkspaceId` (the
  // BE keeps it in sync with the consented `erpLink`). The link/unlink action flips
  // it locally so the control re-renders without a reload, and we refresh the route
  // so the public badge picks up the change. Owner-only by surface (this is the
  // owner's manage console; the BE re-checks ownership of both shop + workspace).
  const [erpLinked, setErpLinked] = useState<boolean>(!!storefront.erpWorkspaceId);
  const handleErpLink = async (workspaceId: string): Promise<EntityLinkOutcome> => {
    const res = await linkStorefrontErp(storefront._id, workspaceId);
    if (res.ok) {
      setErpLinked(true);
      router.refresh();
      return { ok: true };
    }
    return { ok: false, code: res.code };
  };
  const handleErpUnlink = async (): Promise<EntityLinkOutcome> => {
    const res = await unlinkStorefrontErp(storefront._id);
    if (res.ok) {
      setErpLinked(false);
      router.refresh();
      return { ok: true };
    }
    return { ok: false, code: 'generic' };
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await deleteStorefront(storefront._id);
      if (!res.ok) {
        msgApi.error(res.error);
        return;
      }
      void msgApi.success(t('deleteSuccess'));
      router.push('/connect/stores');
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setDeleting(false);
    }
  };

  const notSet = t('notSet');
  const editLabel = t('editSection');
  const visKey =
    storefront.visibility === 'public'
      ? 'public'
      : storefront.visibility === 'connections'
        ? 'connections'
        : 'hidden';
  const locationStr = [
    storefront.location?.district,
    storefront.location?.city,
    storefront.location?.state,
  ]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(', ');

  return (
    <div style={{ maxWidth: 600 }}>
      {ctx}
      <SectionCard title={tSec('basics')} editLabel={editLabel} onEdit={() => setEditing('basics')}>
        <div className="text-[14.5px] font-semibold" style={{ color: 'var(--cr-text)' }}>
          {storefront.name}
        </div>
        <span
          className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
          style={{ border: '1px solid var(--cr-border)', color: 'var(--cr-text-3)' }}
        >
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background:
                storefront.visibility === 'public' ? 'var(--cr-success)' : 'var(--cr-text-4)',
            }}
          />
          {t(`visibility.${visKey}`)}
        </span>
      </SectionCard>

      <SectionCard
        title={tSec('branding')}
        editLabel={editLabel}
        onEdit={() => setEditing('branding')}
      >
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('logoLabel')}
            </span>
            {storefront.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- user asset preview
              <img
                src={storefront.logo}
                alt=""
                className="h-16 w-16 rounded-lg object-cover"
                style={{ border: '1px solid var(--cr-border)' }}
              />
            ) : (
              <NotSet label={notSet} />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('bannerLabel')}
            </span>
            {storefront.banner ? (
              // eslint-disable-next-line @next/next/no-img-element -- user asset preview
              <img
                src={storefront.banner}
                alt=""
                className="h-16 w-48 rounded-lg object-cover"
                style={{ border: '1px solid var(--cr-border)' }}
              />
            ) : (
              <NotSet label={notSet} />
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title={tSec('about')} editLabel={editLabel} onEdit={() => setEditing('about')}>
        {storefront.description?.trim() ? (
          <p
            className="m-0 text-[13.5px] leading-relaxed whitespace-pre-line"
            style={{ color: 'var(--cr-text-2)' }}
          >
            {storefront.description}
          </p>
        ) : (
          <NotSet label={notSet} />
        )}
        {storefront.categories && storefront.categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {storefront.categories.map((c) => (
              <span
                key={c}
                className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                style={{ background: 'var(--cr-surface-2)', color: 'var(--cr-text-3)' }}
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={t('locationLegend')}
        editLabel={editLabel}
        onEdit={() => setEditing('location')}
      >
        {locationStr ? (
          <span className="text-[13.5px]" style={{ color: 'var(--cr-text-2)' }}>
            {locationStr}
          </span>
        ) : (
          <NotSet label={notSet} />
        )}
      </SectionCard>

      {/* ERP verification (ADR-0004) - explicit consent + ownership-checked link
          to an owned ERP workspace, earning the ERP-linked badge. Replaces any
          passive note; the control owns the consent modal + unlink confirm. */}
      <section
        style={{
          border: '1px solid var(--cr-border)',
          borderRadius: 'var(--cr-radius-lg)',
          background: 'var(--cr-surface)',
          padding: 'var(--cr-space-lg)',
          marginBottom: 'var(--cr-space-md)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--cr-text)' }}>
          {erpLinked ? tErp('linkedTitle') : tErp('linkTitle')}
        </h3>
        <div className="mt-3">
          <ERPEntityLinkControl
            linked={erpLinked}
            onLink={handleErpLink}
            onUnlink={handleErpUnlink}
          />
        </div>
      </section>

      {/* Danger zone - delete lives here, away from the day-to-day surfaces. */}
      <section
        style={{
          border: '1px solid var(--cr-error)',
          borderRadius: 'var(--cr-radius-lg)',
          background: 'var(--cr-error-bg)',
          padding: 'var(--cr-space-lg)',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--cr-error)' }}>
          {t('deleteCta')}
        </h3>
        <p className="m-0 mt-1 mb-3 text-[12.5px]" style={{ color: 'var(--cr-text-3)' }}>
          {t('deleteConfirm')}
        </p>
        <DsButton dsVariant="ghost" onClick={() => setDeleteOpen(true)}>
          <Trash2 size={14} aria-hidden /> {t('deleteCta')}
        </DsButton>
      </section>

      <Modal
        open={deleteOpen}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteText('');
        }}
        title={t('deleteCta')}
        okText={t('deleteCta')}
        okButtonProps={{
          danger: true,
          disabled: deleteText.trim() !== storefront.name,
          loading: deleting,
        }}
        onOk={handleDelete}
        destroyOnHidden
      >
        <p className="mb-2 text-[13.5px]" style={{ color: 'var(--cr-text-3)' }}>
          {tc('deleteTypedPrompt')}
        </p>
        <Input
          value={deleteText}
          onChange={(e) => setDeleteText(e.target.value)}
          placeholder={tc('deleteTypedPlaceholder')}
          aria-label={tc('deleteTypedPlaceholder')}
        />
      </Modal>

      <StorefrontEditSectionModal
        open={editing !== null}
        section={editing ?? 'basics'}
        storefront={storefront}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </div>
  );
}
