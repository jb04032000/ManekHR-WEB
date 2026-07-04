'use client';
import { useEffect, useState, useCallback, startTransition } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Popconfirm,
  message,
  Tag,
  Row,
  Col,
  DatePicker,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CloudUploadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getLegalPages,
  createLegalPage,
  updateLegalPage,
  publishLegalPage,
  deleteLegalPage,
} from '@/lib/actions';
import type { LegalPage } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { DsCardTitle } from '@/components/ui';

const { Option } = Select;

/**
 * Build the canonical public slug. Company-wide docs use a bare slug (terms /
 * privacy); product docs are kind-product (terms-connect, ...). Keep in sync with
 * components/marketing/LegalPageView + the backend seed.
 */
function slugFor(kind: string, product: string): string {
  return product === 'platform' ? kind : `${kind}-${product}`;
}

/** Public route for a page (company-wide = /terms; product = /terms/connect). */
function publicHref(kind: string, product: string): string {
  return product === 'platform' ? `/${kind}` : `/${kind}/${product}`;
}

/** Scope tag styling for the card header. */
const PRODUCT_TAG: Record<string, { label: string; color: string }> = {
  platform: { label: 'Company-wide', color: 'purple' },
  connect: { label: 'Connect', color: 'geekblue' },
  erp: { label: 'ERP', color: 'gold' },
};

interface LegalFormValues {
  product: 'platform' | 'connect' | 'erp';
  kind: 'terms' | 'privacy' | 'guidelines';
  title: string;
  body?: string;
  status: 'draft' | 'published';
  effectiveDate?: dayjs.Dayjs | null;
}

export default function AdminLegalPagesPage() {
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LegalPage | null>(null);
  const [saving, setSaving] = useState(false);
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm<LegalFormValues>();

  const load = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const res = await getLegalPages();
      startTransition(() => {
        setPages(Array.isArray(res) ? res : []);
      });
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [msgApi]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ product: 'platform', kind: 'terms', status: 'draft' });
    setModalOpen(true);
  };

  const openEdit = (p: LegalPage) => {
    setEditing(p);
    form.setFieldsValue({
      product: p.product,
      kind: p.kind,
      title: p.title,
      body: p.body,
      status: p.status,
      effectiveDate: p.effectiveDate ? dayjs(p.effectiveDate) : null,
    });
    setModalOpen(true);
  };

  const handleSave = async (vals: LegalFormValues) => {
    setSaving(true);
    const effectiveDate = vals.effectiveDate ? vals.effectiveDate.toISOString() : undefined;
    try {
      if (editing) {
        await updateLegalPage(editing._id, {
          title: vals.title,
          body: vals.body,
          status: vals.status,
          effectiveDate,
        });
        msgApi.success('Legal page saved');
      } else {
        await createLegalPage({
          slug: slugFor(vals.kind, vals.product),
          product: vals.product,
          kind: vals.kind,
          title: vals.title,
          body: vals.body,
          status: vals.status,
          effectiveDate,
        });
        msgApi.success('Legal page created');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await publishLegalPage(id);
      msgApi.success('Published');
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLegalPage(id);
      msgApi.success('Legal page deleted');
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  return (
    <>
      {ctx}
      <Card
        title={<DsCardTitle>Legal Pages</DsCardTitle>}
        loading={loading}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            New Page
          </Button>
        }
      >
        <p className="mb-4 text-xs text-secondary">
          Admin-managed Terms, Privacy &amp; Community Guidelines documents. The public site shows
          the <strong>published</strong> version at <code>/terms/&#123;connect,erp&#125;</code>,{' '}
          <code>/privacy/&#123;connect,erp&#125;</code> and <code>/guidelines/connect</code>. Edits
          stay in <em>draft</em> until you publish.
        </p>
        <Row gutter={[16, 16]}>
          {pages.map((page) => (
            <Col xs={24} sm={12} lg={12} key={page._id}>
              <div className="rounded-[18px] border-[1.5px] border-border bg-surface p-6">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Tag color={PRODUCT_TAG[page.product]?.color ?? 'default'}>
                      {PRODUCT_TAG[page.product]?.label ?? page.product}
                    </Tag>
                    <Tag className="capitalize">{page.kind}</Tag>
                    <Tag color={page.status === 'published' ? 'green' : 'orange'}>
                      {page.status === 'published' ? 'Published' : 'Draft'}
                    </Tag>
                  </div>
                  <span className="text-xs text-muted">v{page.version}</span>
                </div>
                <p className="mb-1 font-display text-sm font-semibold text-heading">{page.title}</p>
                <p className="mb-3 font-mono text-xs text-secondary">{page.slug}</p>
                <div className="flex items-center justify-between">
                  <a
                    href={publicHref(page.kind, page.product)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-secondary hover:text-heading"
                  >
                    <EyeOutlined /> View public page
                  </a>
                  <Space>
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openEdit(page)}
                    >
                      Edit
                    </Button>
                    <Popconfirm
                      title="Publish this version?"
                      description="The current content becomes the live public page."
                      onConfirm={() => handlePublish(page._id)}
                    >
                      <Button type="text" size="small" icon={<CloudUploadOutlined />}>
                        Publish
                      </Button>
                    </Popconfirm>
                    <Popconfirm
                      title="Delete this legal page?"
                      description="The public route will fall back to placeholder copy."
                      onConfirm={() => handleDelete(page._id)}
                      okButtonProps={{ danger: true }}
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              </div>
            </Col>
          ))}
          {pages.length === 0 && !loading && (
            <Col span={24}>
              <p className="py-8 text-center text-subtle">
                No legal pages yet. Create one, or run the seed migration to add the default four.
              </p>
            </Col>
          )}
        </Row>
      </Card>

      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        title={
          <span className="font-display font-bold">
            {editing ? 'Edit Legal Page' : 'New Legal Page'}
          </span>
        }
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={760}
        destroyOnHidden
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          requiredMark={false}
          className="mt-4"
        >
          <Row gutter={12}>
            <Col span={12}>
              {/* Connect product removed (2026-07-04) — ManekHR is ERP-only. */}
              <Form.Item name="product" label="Scope" rules={[{ required: true }]}>
                <Select size="large" disabled={!!editing}>
                  <Option value="platform">Company-wide (ManekHR)</Option>
                  <Option value="erp">ERP</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="kind" label="Kind" rules={[{ required: true }]}>
                <Select size="large" disabled={!!editing}>
                  <Option value="terms">Terms &amp; Conditions</Option>
                  <Option value="privacy">Privacy Policy</Option>
                  <Option value="guidelines">Community Guidelines</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter a title' }]}
          >
            <Input size="large" placeholder="e.g. ManekHR Connect — Terms & Conditions" />
          </Form.Item>

          <Form.Item
            name="body"
            label="Body (Markdown)"
            extra="Supports Markdown — headings (#), lists, links, bold/italic."
          >
            <Input.TextArea
              rows={14}
              placeholder={'# Heading\n\nYour policy content...'}
              style={{ fontFamily: 'var(--font-mono, monospace)' }}
            />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                <Select size="large">
                  <Option value="draft">Draft (hidden)</Option>
                  <Option value="published">Published (live)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="effectiveDate" label="Effective date (optional)">
                <DatePicker className="w-full" size="large" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </>
  );
}
