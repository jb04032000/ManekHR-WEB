'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Alert, Form, Select, Input, Divider, message, Spin } from 'antd';
import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { Can } from '@/components/rbac/Can';
import DsButton from '@/components/ui/DsButton';
import { updateFirmGstConfig } from '@/lib/actions/finance/gst.actions';

type IrpMode = 'gsp_surepass' | 'nic_direct';
type EwbMode = 'gsp_surepass' | 'nic_direct';

interface GstConfigFormValues {
  irpMode: IrpMode;
  irpGspKey?: string;
  irpUsername?: string;
  irpPassword?: string;
  ewbMode: EwbMode;
  ewbGspKey?: string;
  ewbUsername?: string;
  ewbPassword?: string;
}

const MODE_OPTIONS = [
  { value: 'gsp_surepass', label: 'SurePass GSP (recommended)' },
  { value: 'nic_direct', label: 'NIC Direct (advanced)' },
];

/**
 * RBAC gate (ADR-001 finance gap #4): the GSP API-credential surface had no
 * permission gate. Show a spinner while permissions resolve, then wrap the
 * page body in `<Can module="finance" action="edit">` - owners short-circuit,
 * a member without finance.edit gets the Access-Denied surface (mirrors the
 * /dashboard/workspace denied surface). Any existing subscription gate is
 * unaffected.
 */
export default function FirmGstIntegrationPage() {
  const { loading: permissionsLoading } = useMyPermissions();

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Can
      module="finance"
      action="edit"
      fallback={
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-6">
          <Alert
            type="error"
            showIcon
            title="Access Denied"
            description="You do not have permission to manage GST integration settings. Contact your workspace owner to request access."
            style={{ maxWidth: 480 }}
          />
        </div>
      }
    >
      <FirmGstIntegrationBody />
    </Can>
  );
}

function FirmGstIntegrationBody() {
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');

  const [form] = Form.useForm<GstConfigFormValues>();
  const [saving, setSaving] = useState(false);
  const [testingIrp, setTestingIrp] = useState(false);
  const [testingEwb, setTestingEwb] = useState(false);

  const irpMode = Form.useWatch('irpMode', form);
  const ewbMode = Form.useWatch('ewbMode', form);

  useEffect(() => {
    // Set sensible defaults - actual saved values would be fetched from firm GET
    form.setFieldsValue({
      irpMode: 'gsp_surepass',
      ewbMode: 'gsp_surepass',
    });
  }, [form]);

  async function handleSave(values: GstConfigFormValues) {
    if (!wsId || !firmId) return;
    setSaving(true);
    try {
      await updateFirmGstConfig(wsId, firmId, {
        irpConfig: {
          mode: values.irpMode,
          ...(values.irpMode === 'gsp_surepass'
            ? { gspKey: values.irpGspKey }
            : {
                username: values.irpUsername,
                password: values.irpPassword,
              }),
        },
        ewbConfig: {
          mode: values.ewbMode,
          ...(values.ewbMode === 'gsp_surepass'
            ? { gspKey: values.ewbGspKey }
            : {
                username: values.ewbUsername,
                password: values.ewbPassword,
              }),
        },
      });
      message.success('GST settings saved successfully');
    } catch {
      message.error('Could not save GST settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestIrp() {
    setTestingIrp(true);
    try {
      // Test connection stub - Wave 5b will wire this to the actual test endpoint
      await new Promise((r) => setTimeout(r, 1200));
      message.info('Test connection feature will be available in the next update.');
    } finally {
      setTestingIrp(false);
    }
  }

  async function handleTestEwb() {
    setTestingEwb(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      message.info('Test connection feature will be available in the next update.');
    } finally {
      setTestingEwb(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    fontWeight: 600,
    color: 'var(--cr-text)',
  };

  const helperStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--cr-text-3)',
    marginTop: -8,
    marginBottom: 12,
  };

  return (
    <div className="p-lg" style={{ maxWidth: 680 }}>
      <h1 className="mb-xs font-display text-[20px] font-bold">GST Integration</h1>
      <p className="mb-xl text-[13px]" style={{ color: 'var(--cr-text-3)' }}>
        Configure your IRP (e-Invoice) and EWB (e-Way Bill) provider credentials. Sensitive keys are
        stored encrypted and never returned in plain text.
      </p>

      <Form
        form={form}
        layout="vertical"
        validateTrigger="onBlur"
        onFinish={handleSave}
        requiredMark={false}
      >
        {/* IRP Provider */}
        <div
          className="mb-lg rounded-lg p-md"
          style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
        >
          <div className="mb-md flex items-center justify-between">
            <h2 className="m-0 text-[14px] font-bold" style={{ color: 'var(--cr-text)' }}>
              IRP Provider
            </h2>
            <span className="text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
              Used for e-Invoice generation
            </span>
          </div>

          <Form.Item
            name="irpMode"
            label={<span style={labelStyle}>Provider Mode</span>}
            rules={[{ required: true }]}
          >
            <Select options={MODE_OPTIONS} style={{ width: '100%' }} />
          </Form.Item>

          {irpMode === 'gsp_surepass' && (
            <>
              <Form.Item name="irpGspKey" label={<span style={labelStyle}>GSP API Key</span>}>
                <Input.Password
                  placeholder="Leave blank to use platform's SurePass key"
                  iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                />
              </Form.Item>
              <p style={helperStyle}>
                Leave blank to use the platform&apos;s SurePass key. Enter your own key to use your
                account quota.
              </p>
            </>
          )}

          {irpMode === 'nic_direct' && (
            <>
              <Form.Item
                name="irpUsername"
                label={<span style={labelStyle}>NIC Username</span>}
                rules={[{ required: true, message: 'NIC Username is required for direct mode' }]}
              >
                <Input placeholder="Enter your NIC IRP portal username" />
              </Form.Item>
              <Form.Item
                name="irpPassword"
                label={<span style={labelStyle}>NIC Password</span>}
                rules={[{ required: true, message: 'NIC Password is required for direct mode' }]}
              >
                <Input.Password
                  placeholder="Enter your NIC IRP portal password"
                  iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                />
              </Form.Item>
            </>
          )}

          <DsButton dsVariant="ghost" dsSize="sm" loading={testingIrp} onClick={handleTestIrp}>
            Test Connection
          </DsButton>
        </div>

        {/* EWB Provider */}
        <div
          className="mb-lg rounded-lg p-md"
          style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
        >
          <div className="mb-md flex items-center justify-between">
            <h2 className="m-0 text-[14px] font-bold" style={{ color: 'var(--cr-text)' }}>
              EWB Provider
            </h2>
            <span className="text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
              Used for e-Way Bill generation
            </span>
          </div>

          <Form.Item
            name="ewbMode"
            label={<span style={labelStyle}>Provider Mode</span>}
            rules={[{ required: true }]}
          >
            <Select options={MODE_OPTIONS} style={{ width: '100%' }} />
          </Form.Item>

          {ewbMode === 'gsp_surepass' && (
            <>
              <Form.Item name="ewbGspKey" label={<span style={labelStyle}>GSP API Key</span>}>
                <Input.Password
                  placeholder="Leave blank to use platform's SurePass key"
                  iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                />
              </Form.Item>
              <p style={helperStyle}>
                Leave blank to use the platform&apos;s SurePass key. Enter your own key to use your
                account quota.
              </p>
            </>
          )}

          {ewbMode === 'nic_direct' && (
            <>
              <Form.Item
                name="ewbUsername"
                label={<span style={labelStyle}>NIC Username</span>}
                rules={[{ required: true, message: 'NIC Username is required for direct mode' }]}
              >
                <Input placeholder="Enter your NIC EWB portal username" />
              </Form.Item>
              <Form.Item
                name="ewbPassword"
                label={<span style={labelStyle}>NIC Password</span>}
                rules={[{ required: true, message: 'NIC Password is required for direct mode' }]}
              >
                <Input.Password
                  placeholder="Enter your NIC EWB portal password"
                  iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                />
              </Form.Item>
            </>
          )}

          <DsButton dsVariant="ghost" dsSize="sm" loading={testingEwb} onClick={handleTestEwb}>
            Test Connection
          </DsButton>
        </div>

        <Divider />

        <div className="flex justify-end">
          <DsButton dsVariant="primary" htmlType="submit" loading={saving}>
            Save GST Settings
          </DsButton>
        </div>
      </Form>
    </div>
  );
}
