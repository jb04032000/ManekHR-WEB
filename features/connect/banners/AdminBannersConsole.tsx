'use client';

/**
 * AdminBannersConsole - platform-admin management for the Connect feed banner
 * carousel. Table (with native drag-to-reorder rows) + a create/edit Drawer
 * (image upload, link, dates, order, active) + an on/off Switch per row.
 *
 * Talks to the backend via the `banner.actions` server actions
 * (admin/connect/banners). Image upload reuses the existing `connect-banners`
 * upload category (4:1, 2400px) through `uploadService`; the returned URL/ref is
 * stored as `imageUrl`. Cross-links: features/connect/banners/banner.actions.ts,
 * FeedBannerCarousel.tsx (the consumer surface), api banners module.
 */

import { useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { FileUpload } from '@/components/ui/FileUpload';
import { uploadService } from '@/lib/services/upload.service';
import { parseApiError } from '@/lib/utils';
import {
  adminCreateBanner,
  adminDeleteBanner,
  adminReorderBanners,
  adminToggleBanner,
  adminUpdateBanner,
} from './banner.actions';
import { toAbsoluteBannerUrl } from './banner-url';
import type { AdminBanner } from './banner.types';

interface BannerFormValues {
  image?: string | File;
  title: string;
  alt?: string;
  linkUrl?: string;
  order?: number;
  isActive?: boolean;
  liveFrom?: Dayjs | null;
  liveUntil?: Dayjs | null;
}

interface Props {
  initialBanners: AdminBanner[];
}

export default function AdminBannersConsole({ initialBanners }: Props) {
  const t = useTranslations('connect.admin.banners');
  const [msg, ctx] = message.useMessage();
  const [banners, setBanners] = useState<AdminBanner[]>(initialBanners);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AdminBanner | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [form] = Form.useForm<BannerFormValues>();

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, order: banners.length });
    setDrawerOpen(true);
  };

  const openEdit = (b: AdminBanner) => {
    setEditing(b);
    form.resetFields();
    form.setFieldsValue({
      image: b.imageUrl,
      title: b.title,
      alt: b.alt,
      linkUrl: b.linkUrl,
      order: b.order,
      isActive: b.isActive,
      liveFrom: b.liveFrom ? dayjs(b.liveFrom) : null,
      liveUntil: b.liveUntil ? dayjs(b.liveUntil) : null,
    });
    setDrawerOpen(true);
  };

  const submit = async (vals: BannerFormValues) => {
    setSaving(true);
    try {
      // Resolve the image: a freshly-picked File is uploaded now; an unchanged
      // string value (existing signed URL) is passed straight through (the BE
      // normalises it back to its stored ref).
      let imageUrl: string | undefined;
      if (vals.image instanceof File) {
        const up = await uploadService.uploadSingle(vals.image, { category: 'connect-banners' });
        imageUrl = up.url;
      } else if (typeof vals.image === 'string') {
        imageUrl = vals.image;
      }

      if (!editing && !imageUrl) {
        msg.error(t('form.imageRequired'));
        return;
      }

      const payload = {
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        title: vals.title,
        alt: vals.alt ?? '',
        // Store an absolute URL so a bare domain opens the external site.
        linkUrl: toAbsoluteBannerUrl(vals.linkUrl),
        order: vals.order ?? 0,
        isActive: vals.isActive ?? true,
        liveFrom: vals.liveFrom ? vals.liveFrom.toISOString() : null,
        liveUntil: vals.liveUntil ? vals.liveUntil.toISOString() : null,
      };

      const res = editing
        ? await adminUpdateBanner(editing.id, payload)
        : await adminCreateBanner(payload);
      if (!res.ok) {
        msg.error(res.error);
        return;
      }
      // Replace-or-append the saved row in local state (no full refetch needed).
      setBanners((prev) => {
        const exists = prev.some((x) => x.id === res.data.id);
        const next = exists
          ? prev.map((x) => (x.id === res.data.id ? res.data : x))
          : [...prev, res.data];
        return [...next].sort((a, b) => a.order - b.order);
      });
      msg.success(t('saved'));
      setDrawerOpen(false);
    } catch (e) {
      msg.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (b: AdminBanner, isActive: boolean) => {
    // Optimistic flip; revert on failure.
    setBanners((prev) => prev.map((x) => (x.id === b.id ? { ...x, isActive } : x)));
    const res = await adminToggleBanner(b.id, isActive);
    if (!res.ok) {
      setBanners((prev) => prev.map((x) => (x.id === b.id ? { ...x, isActive: !isActive } : x)));
      msg.error(res.error);
    }
  };

  const onDelete = async (b: AdminBanner) => {
    const res = await adminDeleteBanner(b.id);
    if (!res.ok) {
      msg.error(res.error);
      return;
    }
    setBanners((prev) => prev.filter((x) => x.id !== b.id));
    msg.success(t('deleted'));
  };

  // Native drag-to-reorder (no dnd library in the stack). Reorders local state
  // optimistically on drop, then persists the new id sequence; reverts on error.
  const onDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = banners.findIndex((b) => b.id === dragId);
    const to = banners.findIndex((b) => b.id === targetId);
    if (from < 0 || to < 0) return;

    const prevOrder = banners;
    const next = [...banners];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const reindexed = next.map((b, i) => ({ ...b, order: i }));
    setBanners(reindexed);
    setDragId(null);

    const res = await adminReorderBanners(reindexed.map((b) => b.id));
    if (!res.ok) {
      setBanners(prevOrder);
      msg.error(res.error);
      return;
    }
    setBanners(res.data);
    msg.success(t('reordered'));
  };

  const columns: ColumnsType<AdminBanner> = [
    {
      title: t('col.preview'),
      dataIndex: 'imageUrl',
      key: 'preview',
      width: 140,
      render: (url: string, b) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={b.alt || b.title}
          style={{ width: 120, height: 30, objectFit: 'cover', borderRadius: 4 }}
        />
      ),
    },
    { title: t('col.title'), dataIndex: 'title', key: 'title' },
    {
      title: t('col.link'),
      dataIndex: 'linkUrl',
      key: 'linkUrl',
      render: (url: string) =>
        url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            {url}
          </a>
        ) : (
          <span style={{ color: 'var(--cr-text-3)' }}>-</span>
        ),
    },
    {
      title: t('col.window'),
      key: 'window',
      render: (_, b) => (
        <span style={{ fontSize: 12 }}>
          {b.liveFrom ? dayjs(b.liveFrom).format('DD MMM YY') : t('noStart')}
          {' - '}
          {b.liveUntil ? dayjs(b.liveUntil).format('DD MMM YY') : t('noEnd')}
        </span>
      ),
    },
    {
      title: t('col.order'),
      dataIndex: 'order',
      key: 'order',
      width: 70,
      render: (n: number) => <Tag>{n}</Tag>,
    },
    {
      title: t('col.active'),
      dataIndex: 'isActive',
      key: 'isActive',
      width: 90,
      render: (active: boolean, b) => <Switch checked={active} onChange={(v) => onToggle(b, v)} />,
    },
    {
      title: t('col.actions'),
      key: 'actions',
      width: 150,
      render: (_, b) => (
        <Space>
          <Button size="small" onClick={() => openEdit(b)}>
            {t('edit')}
          </Button>
          <Popconfirm title={t('deleteConfirm')} onConfirm={() => onDelete(b)}>
            <Button size="small" danger>
              {t('delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      {ctx}
      <Card
        title={t('title')}
        extra={
          <Button type="primary" onClick={openCreate}>
            {t('add')}
          </Button>
        }
      >
        <p style={{ marginTop: 0, color: 'var(--cr-text-3)' }}>{t('subtitle')}</p>
        <p style={{ color: 'var(--cr-text-3)', fontSize: 12 }}>{t('reorderHint')}</p>
        <Table<AdminBanner>
          rowKey="id"
          columns={columns}
          dataSource={banners}
          pagination={false}
          locale={{ emptyText: t('empty') }}
          onRow={(record) => ({
            draggable: true,
            onDragStart: () => setDragId(record.id),
            onDragOver: (e) => e.preventDefault(),
            onDrop: () => onDrop(record.id),
            style: { cursor: 'move' },
          })}
        />
      </Card>

      <Drawer
        title={editing ? t('drawerEdit') : t('drawerCreate')}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size="large"
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>{t('form.cancel')}</Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              {t('form.save')}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            name="image"
            label={t('form.image')}
            extra={t('form.imageHint')}
            rules={editing ? [] : [{ required: true, message: t('form.imageRequired') }]}
          >
            <FileUpload category="connect-banners" accept="image/jpeg,image/png,image/webp" />
          </Form.Item>
          <Form.Item
            name="title"
            label={t('form.title')}
            rules={[{ required: true, message: t('form.titleRequired') }]}
          >
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item name="alt" label={t('form.alt')} extra={t('form.altHint')}>
            <Input maxLength={200} />
          </Form.Item>
          {/* Plain text (not type="url") so a bare domain like "manekhr.in" is
              accepted; toAbsoluteBannerUrl adds the scheme on save. */}
          <Form.Item name="linkUrl" label={t('form.link')}>
            <Input placeholder={t('form.linkPlaceholder')} />
          </Form.Item>
          <Form.Item name="order" label={t('form.order')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label={t('form.active')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="liveFrom" label={t('form.liveFrom')}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="liveUntil" label={t('form.liveUntil')}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
