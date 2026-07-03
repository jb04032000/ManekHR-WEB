'use client';
/**
 * GreetingsCard - D-29 master switch + 3 channel sub-toggles + template editor link.
 *
 * Default OFF per DPDP - when user flips master to ON, show DPDP consent
 * confirmation toast: "Greetings will be sent to party contacts on the
 * configured channels. Ensure your party-contact consent is captured."
 *
 * Sub-toggles (whatsapp/email/sms) only render when master is enabled and
 * default to true once master is flipped on.
 */

import { startTransition, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Switch, Space, message, Modal, Button, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { partyIntelligenceSettingsApi } from '@/lib/api/modules/party-intelligence-settings.api';
import type { WorkspaceSettingsPartyIntelligence } from '@/types';

const { Text } = Typography;

interface Props {
  wsId: string;
  initial?: WorkspaceSettingsPartyIntelligence['greetings'];
  permissions?: Set<string>;
  onSaved?: (next: WorkspaceSettingsPartyIntelligence) => void;
}

const DEFAULT_GREETINGS = {
  enabled: false,
  whatsapp: true,
  email: true,
  sms: true,
};

export default function GreetingsCard({ wsId, initial, permissions, onSaved }: Props) {
  const t = useTranslations('party-intelligence');
  const [val, setVal] = useState<NonNullable<WorkspaceSettingsPartyIntelligence['greetings']>>({
    ...DEFAULT_GREETINGS,
    ...(initial ?? {}),
  });
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const canEdit = !permissions || permissions.has('manage_party_intelligence');

  useEffect(() => {
    if (initial) {
      startTransition(() => {
        setVal({ ...DEFAULT_GREETINGS, ...initial });
      });
    }
  }, [initial]);

  const persist = async (next: typeof val) => {
    setSaving(true);
    try {
      const updated = await partyIntelligenceSettingsApi.updateSettings(wsId, {
        greetings: next,
      });
      setVal(next);
      onSaved?.(updated);
      message.success('Greetings settings saved');
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleMasterToggle = (checked: boolean) => {
    if (!canEdit) {
      message.warning('Permission required');
      return;
    }
    if (checked && !val.enabled) {
      // DPDP consent confirmation - required when enabling
      setConfirmOpen(true);
      return;
    }
    void persist({ ...val, enabled: checked });
  };

  const confirmEnable = () => {
    setConfirmOpen(false);
    // DPDP toast: warn user about consent obligation
    message.warning(
      'Greetings will be sent to party contacts on the configured channels. Ensure your party-contact consent is captured per DPDP.',
      6,
    );
    void persist({ ...val, enabled: true });
  };

  const handleSubToggle = (key: 'whatsapp' | 'email' | 'sms', checked: boolean) => {
    if (!canEdit) return;
    void persist({ ...val, [key]: checked });
  };

  return (
    <Card title={t('settings.greetingsToggle')} size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>Send birthday & anniversary greetings</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Default OFF per DPDP. Confirm party-contact consent before enabling.
            </Text>
          </div>
          <Switch
            checked={!!val.enabled}
            disabled={!canEdit || saving}
            onChange={handleMasterToggle}
          />
        </div>

        {val.enabled && (
          <div
            style={{
              marginTop: 12,
              paddingLeft: 8,
              borderLeft: '2px solid var(--cr-border-light)',
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('greetings.channelWhatsapp')}</span>
                <Switch
                  size="small"
                  checked={!!val.whatsapp}
                  disabled={!canEdit || saving}
                  onChange={(c) => handleSubToggle('whatsapp', c)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('greetings.channelEmail')}</span>
                <Switch
                  size="small"
                  checked={!!val.email}
                  disabled={!canEdit || saving}
                  onChange={(c) => handleSubToggle('email', c)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('greetings.channelSms')}</span>
                <Switch
                  size="small"
                  checked={!!val.sms}
                  disabled={!canEdit || saving}
                  onChange={(c) => handleSubToggle('sms', c)}
                />
              </div>
            </Space>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <Link
            href="/dashboard/settings/reminder-templates?kind=birthday_greeting,anniversary_greeting"
            className="no-underline"
          >
            <Button type="link" size="small" style={{ padding: 0 }}>
              Edit greeting templates →
            </Button>
          </Link>
        </div>
      </Space>

      <Modal
        title="Confirm DPDP consent"
        open={confirmOpen}
        onOk={confirmEnable}
        onCancel={() => setConfirmOpen(false)}
        okText="I confirm consent - enable"
        cancelText="Cancel"
      >
        <p>
          Greetings will be sent to party contacts on the configured channels. Confirm consent has
          been captured for each contact per DPDP rules.
        </p>
        <p>
          You can suppress greetings for individual contacts in the upcoming preview list below at
          any time.
        </p>
      </Modal>
    </Card>
  );
}
