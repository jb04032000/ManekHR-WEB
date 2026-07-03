'use client';

// Phase 16 / FIN-15-04 - Workspace default print language for vouchers.
// Locale resolution order at print time: explicit param → party.preferredLocale
// → firm.defaultPrintLocale → 'en' (D-37).
import { useEffect, useState, startTransition } from 'react';
import { useParams } from 'next/navigation';
import { Card, Form, Select, Spin, Typography, message } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import DsButton from '@/components/ui/DsButton';
import { getFirm } from '@/lib/actions/finance.actions';
import { updateFirmDefaultPrintLocale } from '@/lib/actions/print.actions';
import type { Firm, PrintLocale } from '@/types';

const { Title, Text } = Typography;

const LOCALE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'gu', label: 'ગુજરાતી' },
  { value: 'hi', label: 'हिन्दी' },
];

interface FormValues {
  defaultPrintLocale: PrintLocale;
}

export default function FirmPrintLocalePage() {
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');

  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firm, setFirm] = useState<Firm | null>(null);

  useEffect(() => {
    if (!wsId || !firmId) return;
    startTransition(() => {
      setLoading(true);
    });
    getFirm(wsId, firmId)
      .then((f) => {
        setFirm(f);
        form.setFieldsValue({ defaultPrintLocale: (f?.defaultPrintLocale ?? 'en') as PrintLocale });
      })
      .catch(() => {
        // Firm fetch failed - fall back to default 'en'.
        form.setFieldsValue({ defaultPrintLocale: 'en' });
      })
      .finally(() => setLoading(false));
  }, [wsId, firmId, form]);

  async function handleSave(values: FormValues) {
    if (!wsId || !firmId) return;
    setSaving(true);
    try {
      await updateFirmDefaultPrintLocale(wsId, firmId, values.defaultPrintLocale);
      message.success('Workspace default print language saved.');
    } catch {
      message.error('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spin style={{ display: 'block', marginTop: 48 }} />;

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <Title level={1} style={{ margin: 0, fontSize: 22 }}>
        Print Language
      </Title>
      <Text type="secondary">
        Default language for {firm?.firmName ?? 'this firm'}&apos;s voucher PDFs. Each party can
        override this from their detail page.
      </Text>

      <Card style={{ marginTop: 24 }}>
        <Form<FormValues> form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            label="Workspace default print language"
            name="defaultPrintLocale"
            rules={[{ required: true }]}
          >
            <Select options={LOCALE_OPTIONS} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <DsButton htmlType="submit" loading={saving}>
              Save
            </DsButton>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
