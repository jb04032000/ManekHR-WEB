'use client';

/**
 * "Start selling" - the one-click quick-setup that opens a shop from a Company
 * Page. The storefront form is prefilled from the page (name, about, logo,
 * banner, specialization -> categories, location) and the new shop is linked
 * back to the page via `companyPageId`. The link is optional by design: a shop
 * can also be created standalone from the Storefronts hub.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Modal, message } from 'antd';
import { Store } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { useAnnouncer } from '@/components/connect';
import { useLimitReachedDialog } from '@/components/connect/useLimitReachedDialog';
import { parseApiError } from '@/lib/utils';
import StorefrontForm from './StorefrontForm';
import { createStorefront } from './storefront.actions';
import type { CompanyPage, CreateStorefrontPayload, Storefront } from './entities.types';

/** Synthesize a Storefront-shaped prefill from a company page (form-read fields only). */
function prefillFromPage(page: CompanyPage): Storefront {
  return {
    _id: '',
    ownerUserId: page.ownerUserId,
    slug: '',
    name: page.name,
    logo: page.logo,
    banner: page.banner,
    description: page.about,
    categories: page.industryPanel?.specialization ?? [],
    location: page.location,
    companyPageId: page._id,
    erpWorkspaceId: null,
    visibility: page.visibility,
  };
}

export default function StartSellingButton({ page }: { page: CompanyPage }) {
  const t = useTranslations('connect.companyPageAdmin');
  const router = useRouter();
  const [msgApi, ctx] = message.useMessage();
  const { announce, announcer } = useAnnouncer();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Plan-limit upgrade prompt for a blocked storefront create.
  const { dialog: limitDialog, handleLimited } = useLimitReachedDialog();

  const handleCreate = async (payload: CreateStorefrontPayload) => {
    setSaving(true);
    try {
      // Always stamp the link back to this page - this is the "from the company" path.
      const res = await createStorefront({ ...payload, companyPageId: page._id });
      if (!res.ok) {
        // Plan-limit block shows the shared upgrade dialog, not a toast.
        if (handleLimited(res)) return;
        msgApi.error(res.error);
        announce(res.error, { assertive: true });
        return;
      }
      void msgApi.success(t('startSellingSuccess'));
      announce(t('startSellingSuccess'));
      setOpen(false);
      router.push(`/connect/stores/${res.data._id}`);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {ctx}
      {announcer}
      {limitDialog}
      <DsButton dsVariant="primary" onClick={() => setOpen(true)}>
        <Store size={16} aria-hidden /> {t('startSellingCta')}
      </DsButton>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title={<span className="font-display font-bold">{t('startSellingTitle')}</span>}
        footer={null}
        width={680}
        // centered + capped body so on a phone the dialog sits mid-screen and
        // the tall start-selling form scrolls inside, not the whole modal.
        centered
        destroyOnHidden
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <p className="mt-0 mb-4 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('startSellingHint')}
        </p>
        <StorefrontForm
          submitLabel={t('startSellingSubmit')}
          submitting={saving}
          onSubmit={handleCreate}
          initial={prefillFromPage(page)}
          cancelHref={`/connect/pages/${page._id}`}
        />
      </Modal>
    </>
  );
}
