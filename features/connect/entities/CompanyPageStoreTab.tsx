'use client';

/**
 * CompanyPageStoreTab - the manage console "Store" tab. Shows the attached store
 * (Manage store -> /connect/stores/[id], Switch, Unlink) or, when none, Attach
 * existing (picker) + Create new (Start selling, which creates a store
 * pre-linked to the page). Products are managed in the storefront module, never
 * here. Links to: company-page store link actions (unlinkStoreFromPage) +
 * AttachStorePicker + StartSellingButton + the storefront console.
 * Gotcha: after attach/unlink we router.refresh so the SSR-fed `store` prop
 * re-resolves (no client-side store state to keep in sync).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { message } from 'antd';
import { Store } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import ConnectEmptyState from '@/components/connect/ConnectEmptyState';
import AttachStorePicker from './AttachStorePicker';
import StartSellingButton from './StartSellingButton';
import { unlinkStoreFromPage } from './company-page.actions';
import type { Storefront, CompanyPage } from './entities.types';

export default function CompanyPageStoreTab({
  page,
  store,
}: {
  page: CompanyPage;
  store: Storefront | null;
}) {
  const t = useTranslations('connect.companyPage');
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, ctx] = message.useMessage();

  const unlink = async () => {
    setBusy(true);
    const res = await unlinkStoreFromPage(page._id);
    setBusy(false);
    if (!res.ok) {
      msg.error(res.error);
      return;
    }
    router.refresh();
  };

  if (!store) {
    return (
      <section>
        {ctx}
        <ConnectEmptyState
          variant="inline"
          icon={<Store size={24} aria-hidden />}
          title={t('storeEmptyTitle')}
          description={t('storeEmptyBody')}
          primaryAction={{ label: t('attachStoreCta'), onClick: () => setPickerOpen(true) }}
        />
        {/* Create-and-link path: StartSellingButton opens the prefilled store form
            and stamps companyPageId, so a brand-new store lands attached. */}
        <div className="mt-3">
          <StartSellingButton page={page} />
        </div>
        <AttachStorePicker
          open={pickerOpen}
          pageId={page._id}
          onClose={() => setPickerOpen(false)}
          onAttached={() => router.refresh()}
        />
      </section>
    );
  }

  return (
    <section>
      {ctx}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--cr-radius-lg)] p-4"
        style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
      >
        <div className="min-w-0">
          <div className="text-[15px] font-bold" style={{ color: 'var(--cr-text)' }}>
            {store.name}
          </div>
          <div className="text-[12.5px]" style={{ color: 'var(--cr-text-4)' }}>
            {t(`storeVisibility.${store.visibility}`)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <DsButton dsVariant="primary" href={`/connect/stores/${store._id}`}>
            {t('manageStore')}
          </DsButton>
          <DsButton dsVariant="ghost" onClick={() => setPickerOpen(true)} disabled={busy}>
            {t('switchStore')}
          </DsButton>
          <DsButton dsVariant="ghost" onClick={unlink} loading={busy}>
            {t('unlinkStore')}
          </DsButton>
        </div>
      </div>
      <p className="mt-3 text-[12.5px]" style={{ color: 'var(--cr-text-4)' }}>
        {t('storeManagedHint')}
      </p>
      <AttachStorePicker
        open={pickerOpen}
        pageId={page._id}
        onClose={() => setPickerOpen(false)}
        onAttached={() => router.refresh()}
      />
    </section>
  );
}
