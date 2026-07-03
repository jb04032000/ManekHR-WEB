'use client';
import { useEffect, useState, useCallback, startTransition } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  Form,
  InputNumber,
  Input,
  Switch,
  Button,
  message,
  Divider,
  Descriptions,
  Tag,
  Spin,
  Space,
} from 'antd';
import { ArrowLeftOutlined, SendOutlined } from '@ant-design/icons';
import Link from 'next/link';
import {
  getAdminWorkspaceDetail,
  updateAdminWorkspaceEmailConfig,
  testAdminWorkspaceSmtp,
  resetAdminWorkspaceEmailUsage,
} from '@/lib/actions';
import { parseApiError, fmt } from '@/lib/utils';
import { DsCardTitle } from '@/components/ui';

export default function AdminWorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [workspace, setWorkspace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const ws = await getAdminWorkspaceDetail(id);
      startTransition(() => {
        setWorkspace(ws);
      });
      form.setFieldsValue({
        emailLimitOverride: ws.emailConfig?.emailLimitOverride ?? null,
        smtpEnabled: ws.emailConfig?.smtpConfig?.enabled ?? false,
        smtpHost: ws.emailConfig?.smtpConfig?.host ?? '',
        smtpPort: ws.emailConfig?.smtpConfig?.port ?? 587,
        smtpUser: ws.emailConfig?.smtpConfig?.user ?? '',
        smtpPass: '',
        smtpFromEmail: ws.emailConfig?.smtpConfig?.fromEmail ?? '',
        smtpFromName: ws.emailConfig?.smtpConfig?.fromName ?? '',
        smtpSecure: ws.emailConfig?.smtpConfig?.secure ?? true,
      });
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [id, form, msgApi]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (vals: Record<string, any>) => {
    setSaving(true);
    try {
      await updateAdminWorkspaceEmailConfig(id, {
        emailLimitOverride: vals.emailLimitOverride ?? null,
        smtpConfig: {
          host: vals.smtpHost,
          port: vals.smtpPort,
          user: vals.smtpUser,
          pass: vals.smtpPass || undefined,
          fromEmail: vals.smtpFromEmail,
          fromName: vals.smtpFromName,
          secure: vals.smtpSecure,
          enabled: vals.smtpEnabled,
        },
      });
      msgApi.success('Email config saved');
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleResetUsage = async () => {
    setResetting(true);
    try {
      await resetAdminWorkspaceEmailUsage(id);
      msgApi.success('Email usage reset');
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setResetting(false);
    }
  };

  const handleTestSmtp = async () => {
    setTesting(true);
    try {
      const res = await testAdminWorkspaceSmtp(id);
      msgApi.success(res.message || 'Test email sent');
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setTesting(false);
    }
  };

  const usage = workspace?.emailConfig?.usage;
  const planLimit = workspace?.planEmailLimit ?? 0;
  const overrideLimit = workspace?.emailConfig?.emailLimitOverride;
  const effectiveLimit =
    overrideLimit !== null && overrideLimit !== undefined ? overrideLimit : planLimit;

  return (
    <>
      {ctx}
      <div className="mb-4">
        <Link href="/admin/workspaces">
          <Button icon={<ArrowLeftOutlined />} type="text">
            All Workspaces
          </Button>
        </Link>
      </div>

      <Spin spinning={loading}>
        {workspace && (
          <Space direction="vertical" className="w-full" size={16}>
            <Card title={<DsCardTitle>Workspace Info</DsCardTitle>}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Name">{workspace.name}</Descriptions.Item>
                <Descriptions.Item label="Business Type">
                  {workspace.businessType || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Owner">
                  {(workspace.ownerId as any)?.name} ({(workspace.ownerId as any)?.email})
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={workspace.isActive ? 'success' : 'error'}>
                    {workspace.isActive ? 'Active' : 'Inactive'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Created">{fmt(workspace.createdAt)}</Descriptions.Item>
                <Descriptions.Item label="Plan Email Limit">
                  {planLimit === 0 ? 'Unlimited (plan)' : `${planLimit}/month (plan)`}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title={<DsCardTitle>Email Configuration</DsCardTitle>}>
              <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
                <div className="mb-4 flex items-center justify-between rounded-lg bg-gray-50 p-3 text-sm">
                  <span>
                    <strong>This month usage:</strong>{' '}
                    {usage?.monthKey === new Date().toISOString().slice(0, 7)
                      ? `${usage.count} emails sent`
                      : '0 emails sent'}{' '}
                    {effectiveLimit > 0 ? `/ ${effectiveLimit} limit` : '(unlimited)'}
                  </span>
                  <Button size="small" danger onClick={handleResetUsage} loading={resetting}>
                    Reset Usage
                  </Button>
                </div>

                <Form.Item
                  name="emailLimitOverride"
                  label="Email Limit Override (leave empty to use plan default, 0 = unlimited)"
                >
                  <InputNumber
                    className="w-64"
                    min={0}
                    placeholder="Leave empty for plan default"
                  />
                </Form.Item>

                <Divider className="text-xs">Custom SMTP</Divider>

                <Form.Item name="smtpEnabled" label="Enable Custom SMTP" valuePropName="checked">
                  <Switch />
                </Form.Item>

                <div className="grid grid-cols-2 gap-3">
                  <Form.Item name="smtpHost" label="SMTP Host">
                    <Input placeholder="smtp.example.com" />
                  </Form.Item>
                  <Form.Item name="smtpPort" label="Port">
                    <InputNumber className="w-full" min={1} max={65535} />
                  </Form.Item>
                  <Form.Item name="smtpUser" label="Username">
                    <Input placeholder="user@example.com" />
                  </Form.Item>
                  <Form.Item name="smtpPass" label="Password (leave blank to keep existing)">
                    <Input.Password placeholder="••••••••" />
                  </Form.Item>
                  <Form.Item name="smtpFromEmail" label="From Email">
                    <Input placeholder="noreply@example.com" />
                  </Form.Item>
                  <Form.Item name="smtpFromName" label="From Name">
                    <Input placeholder="Workspace Name" />
                  </Form.Item>
                </div>

                <Form.Item name="smtpSecure" label="Use SSL/TLS" valuePropName="checked">
                  <Switch />
                </Form.Item>

                <div className="mt-2 flex gap-3">
                  <Button type="primary" htmlType="submit" loading={saving}>
                    Save Config
                  </Button>
                  <Button icon={<SendOutlined />} onClick={handleTestSmtp} loading={testing}>
                    Test Connection
                  </Button>
                </div>
              </Form>
            </Card>
          </Space>
        )}
      </Spin>
    </>
  );
}
