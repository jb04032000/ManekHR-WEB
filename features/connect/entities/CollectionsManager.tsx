'use client';

/**
 * CollectionsManager - the storefront console's "Collections" tab.
 *
 * Owner-curated, shop-scoped product groups. Lets the owner create / rename /
 * re-cover / delete collections, reorder them (up / down), and manage which
 * products each one holds (a checkbox picker). Membership is the source of truth
 * on the product, so the picker simply sets the exact member set + order. All
 * mutations call a server action then `router.refresh()` so the server-fetched
 * list re-reads (no optimistic divergence).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert, App as AntApp, Input, Modal } from 'antd';
import {
  ArrowDown,
  ArrowUp,
  FolderPlus,
  Image as ImageIcon,
  Layers,
  Pencil,
  Trash2,
} from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { ConnectEmptyState } from '@/components/connect';
import MediaUploadGrid from '@/components/connect/MediaUploadGrid';
import type { OwnerListing } from '../marketplace/marketplace.types';
import type { CollectionWithCount } from './collections.types';
import {
  createCollection,
  deleteCollection,
  reorderCollections,
  setCollectionProducts,
  updateCollection,
} from './collection.actions';

interface Props {
  storefrontId: string;
  collections: CollectionWithCount[];
  /** The shop's products, for the manage-products picker. */
  products: OwnerListing[];
}

interface EditState {
  id?: string;
  title: string;
  description: string;
  coverImage: string;
}

const EMPTY_EDIT: EditState = { title: '', description: '', coverImage: '' };

export default function CollectionsManager({ storefrontId, collections, products }: Props) {
  const t = useTranslations('connect.collections');
  const router = useRouter();
  const { message } = AntApp.useApp();

  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Manage-products picker state.
  const [managing, setManaging] = useState<CollectionWithCount | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const openCreate = () => {
    setError(null);
    setEdit({ ...EMPTY_EDIT });
  };
  const openEdit = (c: CollectionWithCount) => {
    setError(null);
    setEdit({
      id: c.collection._id,
      title: c.collection.title,
      description: c.collection.description ?? '',
      coverImage: c.collection.coverImage ?? '',
    });
  };

  const saveEdit = async () => {
    if (!edit || !edit.title.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      title: edit.title.trim(),
      description: edit.description.trim() || undefined,
      coverImage: edit.coverImage || undefined,
    };
    const res = edit.id
      ? await updateCollection(edit.id, payload)
      : await createCollection(storefrontId, payload);
    setSaving(false);
    if (res.ok) {
      message.success(edit.id ? t('updated') : t('created'));
      setEdit(null);
      router.refresh();
    } else {
      setError(res.error);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    const res = await deleteCollection(id);
    setBusyId(null);
    setConfirmId(null);
    if (res.ok) {
      message.success(t('deleted'));
      router.refresh();
    } else {
      message.error(res.error);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= collections.length) return;
    const ordered = collections.map((c) => c.collection._id);
    [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
    setBusyId(collections[index].collection._id);
    const res = await reorderCollections(storefrontId, ordered);
    setBusyId(null);
    if (res.ok) router.refresh();
    else message.error(res.error);
  };

  const openManage = (c: CollectionWithCount) => {
    setError(null);
    // Seed the picker from the products that already carry this collection id.
    const seeded = products
      .filter((p) => (p.collectionIds ?? []).includes(c.collection._id))
      .map((p) => p._id);
    setPicked(new Set(seeded));
    setManaging(c);
  };

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const saveManage = async () => {
    if (!managing) return;
    setSaving(true);
    // Preserve the shop's product order for a stable, predictable result.
    const ids = products.filter((p) => picked.has(p._id)).map((p) => p._id);
    const res = await setCollectionProducts(managing.collection._id, ids);
    setSaving(false);
    if (res.ok) {
      message.success(t('productsSaved', { count: ids.length }));
      setManaging(null);
      router.refresh();
    } else {
      message.error(res.error);
    }
  };

  if (collections.length === 0) {
    return (
      <>
        <ConnectEmptyState
          variant="inline"
          icon={<Layers size={24} aria-hidden />}
          title={t('emptyTitle')}
          description={t('emptyBody')}
          primaryAction={{ label: t('createCta'), onClick: openCreate }}
        />
        <EditModal
          edit={edit}
          setEdit={setEdit}
          onSave={saveEdit}
          saving={saving}
          error={error}
          t={t}
        />
      </>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('intro')}
        </p>
        <DsButton dsVariant="primary" dsSize="sm" onClick={openCreate}>
          <FolderPlus size={15} aria-hidden /> {t('createCta')}
        </DsButton>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {collections.map((c, i) => {
          const busy = busyId === c.collection._id;
          return (
            <li
              key={c.collection._id}
              className="flex items-center gap-3 p-3"
              style={{
                border: '1px solid var(--cr-border)',
                borderRadius: 'var(--cr-radius-lg)',
                background: 'var(--cr-surface)',
              }}
            >
              {/* Cover thumb (or a placeholder glyph). */}
              <div
                aria-hidden
                className="grid shrink-0 place-items-center overflow-hidden"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 'var(--cr-radius-md)',
                  background: c.collection.coverImage
                    ? `center / cover no-repeat url(${JSON.stringify(c.collection.coverImage)})`
                    : 'var(--cr-surface-2)',
                  color: 'var(--cr-text-4)',
                }}
              >
                {!c.collection.coverImage && <ImageIcon size={18} />}
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-[14px] font-semibold"
                  style={{ color: 'var(--cr-text)' }}
                >
                  {c.collection.title}
                </div>
                <div className="text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
                  {t('productCount', { count: c.productCount })}
                </div>
              </div>

              {/* Reorder. */}
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={t('moveUp')}
                  disabled={i === 0 || busy}
                  onClick={() => void move(i, -1)}
                  className="cursor-pointer disabled:opacity-30"
                  style={{ background: 'transparent', border: 'none', color: 'var(--cr-text-3)' }}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  aria-label={t('moveDown')}
                  disabled={i === collections.length - 1 || busy}
                  onClick={() => void move(i, 1)}
                  className="cursor-pointer disabled:opacity-30"
                  style={{ background: 'transparent', border: 'none', color: 'var(--cr-text-3)' }}
                >
                  <ArrowDown size={15} />
                </button>
              </div>

              <DsButton dsVariant="ghost" dsSize="sm" onClick={() => openManage(c)}>
                {t('manageProducts')}
              </DsButton>
              <button
                type="button"
                aria-label={t('edit')}
                onClick={() => openEdit(c)}
                className="cursor-pointer"
                style={{ background: 'transparent', border: 'none', color: 'var(--cr-text-3)' }}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                aria-label={t('delete')}
                disabled={busy}
                onClick={() => setConfirmId(c.collection._id)}
                className="cursor-pointer"
                style={{ background: 'transparent', border: 'none', color: 'var(--cr-error)' }}
              >
                <Trash2 size={15} />
              </button>
            </li>
          );
        })}
      </ul>

      <EditModal
        edit={edit}
        setEdit={setEdit}
        onSave={saveEdit}
        saving={saving}
        error={error}
        t={t}
      />

      {/* Manage-products picker. */}
      <Modal
        open={!!managing}
        onCancel={() => setManaging(null)}
        title={managing ? t('manageTitle', { name: managing.collection.title }) : ''}
        okText={t('save')}
        cancelText={t('cancel')}
        confirmLoading={saving}
        onOk={() => void saveManage()}
        destroyOnHidden
        styles={{ body: { maxHeight: '60vh', overflowY: 'auto' } }}
      >
        {products.length === 0 ? (
          <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
            {t('noProductsToAdd')}
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {products.map((p) => (
              <li key={p._id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-[var(--cr-surface-2)]">
                  <input
                    type="checkbox"
                    checked={picked.has(p._id)}
                    onChange={() => togglePick(p._id)}
                  />
                  <div
                    aria-hidden
                    className="shrink-0"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--cr-radius-sm)',
                      background: p.images?.[0]
                        ? `center / cover no-repeat url(${JSON.stringify(p.images[0])})`
                        : 'var(--cr-surface-2)',
                    }}
                  />
                  <span className="truncate text-[13px]" style={{ color: 'var(--cr-text)' }}>
                    {p.title}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* Delete confirm. */}
      <Modal
        open={!!confirmId}
        onCancel={() => setConfirmId(null)}
        title={t('deleteTitle')}
        okText={t('deleteConfirm')}
        cancelText={t('cancel')}
        okButtonProps={{ danger: true, loading: !!busyId }}
        onOk={() => confirmId && void remove(confirmId)}
      >
        <p className="m-0 text-[13.5px]" style={{ color: 'var(--cr-text-2)' }}>
          {t('deleteBody')}
        </p>
      </Modal>
    </div>
  );
}

/** The shared create / edit modal (title + description + cover). */
function EditModal({
  edit,
  setEdit,
  onSave,
  saving,
  error,
  t,
}: {
  edit: EditState | null;
  setEdit: (e: EditState | null) => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Modal
      open={!!edit}
      onCancel={() => setEdit(null)}
      title={edit?.id ? t('editTitle') : t('createTitle')}
      okText={edit?.id ? t('save') : t('create')}
      cancelText={t('cancel')}
      okButtonProps={{ disabled: !edit?.title.trim() }}
      confirmLoading={saving}
      onOk={onSave}
      destroyOnHidden
    >
      {error && <Alert type="error" showIcon className="mb-3" message={error} />}
      <label className="mb-1 block text-[13px] font-semibold" style={{ color: 'var(--cr-text-2)' }}>
        {t('titleLabel')}
      </label>
      <Input
        autoFocus
        maxLength={80}
        value={edit?.title ?? ''}
        placeholder={t('titlePlaceholder')}
        onChange={(e) => edit && setEdit({ ...edit, title: e.target.value })}
      />
      <label
        className="mt-3 mb-1 block text-[13px] font-semibold"
        style={{ color: 'var(--cr-text-2)' }}
      >
        {t('descriptionLabel')}
      </label>
      <Input.TextArea
        rows={3}
        maxLength={500}
        value={edit?.description ?? ''}
        placeholder={t('descriptionPlaceholder')}
        onChange={(e) => edit && setEdit({ ...edit, description: e.target.value })}
      />
      <label
        className="mt-3 mb-1 block text-[13px] font-semibold"
        style={{ color: 'var(--cr-text-2)' }}
      >
        {t('coverLabel')}
      </label>
      {edit && (
        <MediaUploadGrid
          mediaKind="image"
          max={1}
          initialUrls={edit.coverImage ? [edit.coverImage] : []}
          onChange={(urls) => setEdit({ ...edit, coverImage: urls[0] ?? '' })}
        />
      )}
    </Modal>
  );
}
