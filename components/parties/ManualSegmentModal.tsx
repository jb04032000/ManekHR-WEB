'use client';
/**
 * ManualSegmentModal - Phase 17 / D-07. One-cycle segment override.
 * BLACKLIST is excluded - use BlacklistModal for that.
 */

import { useState } from 'react';
import { Modal, Radio, Button, message, Space, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { partyIntelligenceApi } from '@/lib/api/modules/parties.api';
import type { PartySegment } from '@/types';

const SELECTABLE: PartySegment[] = ['NEW', 'REGULAR', 'VIP', 'DORMANT', 'CHURNED'];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  wsId: string;
  partyId: string;
  currentManualSegment?: PartySegment | null;
}

export default function ManualSegmentModal({
  open,
  onClose,
  onSaved,
  wsId,
  partyId,
  currentManualSegment,
}: Props) {
  const t = useTranslations('party-intelligence');
  const [selected, setSelected] = useState<PartySegment | undefined>(
    currentManualSegment ?? undefined,
  );
  const [saving, setSaving] = useState(false);

  const handleSet = async () => {
    if (!selected) {
      message.warning('Pick a segment');
      return;
    }
    setSaving(true);
    try {
      await partyIntelligenceApi.setManualSegment(wsId, partyId, selected);
      message.success('Segment override applied');
      onSaved();
      onClose();
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err?.message) message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await partyIntelligenceApi.clearManualSegment(wsId, partyId);
      message.success('Override cleared');
      onSaved();
      onClose();
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err?.message) message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('actions.overrideSegment')}
      destroyOnHidden
      footer={
        <Space>
          {currentManualSegment ? (
            <Button danger onClick={handleClear} loading={saving}>
              {t('actions.clearOverride')}
            </Button>
          ) : null}
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSet} loading={saving}>
            Apply
          </Button>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary">
        {t('actions.overrideSegment')}. This override clears after one nightly cycle.
      </Typography.Paragraph>
      <Radio.Group value={selected} onChange={(e) => setSelected(e.target.value as PartySegment)}>
        <Space direction="vertical">
          {SELECTABLE.map((seg) => (
            <Radio key={seg} value={seg}>
              {t(`segment.${seg}`)}
            </Radio>
          ))}
        </Space>
      </Radio.Group>
    </Modal>
  );
}
