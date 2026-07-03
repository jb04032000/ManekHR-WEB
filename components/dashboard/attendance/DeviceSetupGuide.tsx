'use client';

import { useState } from 'react';
import { env } from '@/lib/env';
import { App, Button, Tabs, Typography, Space, Modal, Alert } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined, CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

const { Text, Paragraph } = Typography;

interface DeviceSetupGuideProps {
  token: string | null;
  workspaceId: string;
  onRotateToken: () => void;
  rotating?: boolean;
}

function maskToken(token: string): string {
  if (token.length <= 8) return '••••••••••••';
  return `••••••••••••${token.slice(-8)}`;
}

function buildIngestUrl(token: string | null): string {
  if (!token) return 'https://api.manekhr.in/iclock/<token>/';
  return `https://api.manekhr.in/iclock/${token}/`;
}

function buildMaskedUrl(token: string | null): string {
  if (!token) return 'https://api.manekhr.in/iclock/••••••••••••/';
  return `https://api.manekhr.in/iclock/••••••••••••${token.slice(-8)}/`;
}

function UrlDisplay({ token, revealed }: { token: string | null; revealed: boolean }) {
  const url = revealed ? buildIngestUrl(token) : buildMaskedUrl(token);
  return (
    <Text
      code
      style={{
        fontSize: 13,
        wordBreak: 'break-all',
        display: 'block',
        padding: '8px 12px',
        background: 'var(--cr-neutral-100)',
        borderRadius: 6,
        lineHeight: 1.6,
      }}
    >
      {url}
    </Text>
  );
}

function SetupSteps({ steps }: { steps: string[] }) {
  return (
    <ol style={{ paddingLeft: 20, margin: '12px 0', lineHeight: 2 }}>
      {steps.map((step, i) => (
        <li key={i} style={{ color: 'var(--cr-text-3)', fontSize: 14 }}>
          {step}
        </li>
      ))}
    </ol>
  );
}

const VENDOR_TABS = [
  {
    key: 'zkteco',
    label: 'ZKTeco',
    steps: [
      'Press Menu on device',
      'Go to Comm → ADMS',
      'Enable ADMS: ON',
      'Server Address: api.manekhr.in',
      'Server Port: 443',
      'HTTPS: ON',
      'Save and reboot the device',
    ],
    note: 'The device will connect automatically after reboot.',
    models: 'K40 / K30 / F18 / MB20',
  },
  {
    key: 'essl',
    label: 'eSSL',
    steps: [
      'Press Menu (default admin password: 0)',
      'Go to Comm → Cloud Server',
      'Enable: ON',
      'Server Address: api.manekhr.in',
      'Port: 443',
      'HTTPS: ON',
      'Save and reboot',
    ],
    note: null,
    models: 'X990 / K30 Pro / SmartOffice',
  },
  {
    key: 'realtime',
    label: 'Realtime',
    steps: [
      'Press Menu → Comm → Cloud Server',
      'Enable: ON',
      'Server Address: api.manekhr.in',
      'Port: 443',
      'HTTPS: ON',
      'Save and reboot',
    ],
    note: null,
    models: 'T502 / T503',
  },
  {
    key: 'biomax',
    label: 'Biomax',
    steps: [
      'Menu → Comm → ADMS',
      'Server Address: api.manekhr.in',
      'Port: 443',
      'HTTPS: ON',
      'Save and reboot',
    ],
    note: 'Biomax uses ZKTeco ADMS protocol - same steps as ZKTeco.',
    models: 'Biomax devices',
  },
];

export function DeviceSetupGuide({
  token,
  workspaceId: _workspaceId,
  onRotateToken,
  rotating = false,
}: DeviceSetupGuideProps) {
  const t = useTranslations('attendance.deviceSetup');
  const [revealed, setRevealed] = useState(false);
  const [rotateModalOpen, setRotateModalOpen] = useState(false);
  const { message: msgApi } = App.useApp();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildIngestUrl(token));
      msgApi.success('URL copied to clipboard');
    } catch {
      msgApi.error('Failed to copy - please copy manually');
    }
  }

  function handleRotateConfirm() {
    setRotateModalOpen(false);
    onRotateToken();
  }

  return (
    <>
      {/* Connection URL section */}
      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
          Device Connection URL
        </Text>

        <UrlDisplay token={token} revealed={revealed} />

        <Space style={{ marginTop: 10 }} wrap>
          <Button
            size="small"
            icon={revealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? 'Hide' : 'Reveal'} token
          </Button>
          <Button size="small" icon={<CopyOutlined />} onClick={handleCopy} disabled={!token}>
            Copy URL
          </Button>
          <Button
            size="small"
            danger
            icon={<ReloadOutlined />}
            onClick={() => setRotateModalOpen(true)}
            loading={rotating}
          >
            Rotate token
          </Button>
        </Space>

        <Alert type="warning" showIcon style={{ marginTop: 12 }} title={t('privateUrl')} />
      </div>

      {/* Vendor setup tabs */}
      <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>
        Device Configuration Steps
      </Text>

      <Tabs
        defaultActiveKey="zkteco"
        size="small"
        items={[
          ...VENDOR_TABS.map((vendor) => ({
            key: vendor.key,
            label: vendor.label,
            children: (
              <div style={{ paddingTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Supported models: {vendor.models}
                </Text>
                <SetupSteps steps={vendor.steps} />
                {vendor.note && (
                  <Paragraph
                    style={{
                      fontSize: 13,
                      color: 'var(--cr-text-4)',
                      background: 'var(--cr-bg)',
                      padding: '8px 12px',
                      borderRadius: 6,
                      marginTop: 4,
                    }}
                  >
                    {vendor.note}
                  </Paragraph>
                )}
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Your device URL:
                  </Text>
                  <div style={{ marginTop: 4 }}>
                    <UrlDisplay token={token} revealed={revealed} />
                  </div>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={handleCopy}
                    style={{ marginTop: 8 }}
                    disabled={!token}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            ),
          })),
          {
            key: 'matrix',
            label: 'Matrix COSEC',
            children: (
              <div style={{ paddingTop: 8 }}>
                <Alert
                  type="info"
                  showIcon
                  title={t('matrixComing')}
                  description={
                    <>
                      For now, use the Manual File Upload flow or contact support at{' '}
                      <a href={`mailto:${env.supportEmail}`}>{env.supportEmail}</a>.
                    </>
                  }
                />
              </div>
            ),
          },
        ]}
      />

      {/* Rotate token confirmation modal */}
      <Modal
        open={rotateModalOpen}
        title={t('rotateTitle')}
        okText="Rotate token"
        okButtonProps={{ danger: true }}
        cancelText="Cancel"
        onOk={handleRotateConfirm}
        onCancel={() => setRotateModalOpen(false)}
      >
        <Alert
          type="error"
          showIcon
          title={t('rotateWarningShort')}
          description={t('rotateWarningLong')}
          style={{ marginBottom: 0 }}
        />
      </Modal>
    </>
  );
}
