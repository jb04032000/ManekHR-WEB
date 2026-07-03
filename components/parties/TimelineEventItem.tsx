'use client';
/**
 * TimelineEventItem - Phase 17 / D-19, D-20.
 * Renders a single timeline row. For manual entries (call/email/note) authored
 * by the current user within a 24h window, shows ⋮ Edit/Delete menu.
 *
 * 24h edit window: 24 * 60 * 60 * 1000 = 86_400_000 ms.
 */

import { useState } from 'react';
import { Dropdown, Button, Modal, Input, message, Tag } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { partyTimelineApi } from '@/lib/api/modules/parties.api';
import type { PartyTimelineEvent, PartyTimelineEventType } from '@/types';

const MANUAL_TYPES: PartyTimelineEventType[] = ['call.logged', 'email.logged', 'note.added'];

const TYPE_COLORS: Partial<Record<PartyTimelineEventType, string>> = {
  'invoice.created': 'blue',
  'invoice.paid': 'green',
  'payment.received': 'green',
  'payment.sent': 'orange',
  'credit_note.created': 'purple',
  'debit_note.created': 'magenta',
  'reminder.sent': 'gold',
  'call.logged': 'cyan',
  'email.logged': 'cyan',
  'note.added': 'default',
  'segment.changed': 'geekblue',
  'gstin.flag_changed': 'red',
  'greeting.sent': 'pink',
};

const EDIT_WINDOW_MS = 86_400_000; // 24 * 60 * 60 * 1000

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

interface Props {
  event: PartyTimelineEvent;
  currentUserId?: string;
  wsId: string;
  partyId: string;
  onChanged: () => void;
}

export default function TimelineEventItem({
  event,
  currentUserId,
  wsId,
  partyId,
  onChanged,
}: Props) {
  const t = useTranslations('party-intelligence.timeline');
  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState(event.summary);
  const [saving, setSaving] = useState(false);
  const [renderNow] = useState(() => Date.now());

  const isManual = MANUAL_TYPES.includes(event.type);
  // 24h edit window check: actorUserId === currentUser._id && now - createdAt < 86_400_000
  const ageMs = renderNow - new Date(event.createdAt).getTime();
  const canEdit =
    isManual && !!currentUserId && event.actorUserId === currentUserId && ageMs < EDIT_WINDOW_MS;

  const handleEdit = async () => {
    if (!editValue.trim()) {
      message.warning('Summary cannot be empty');
      return;
    }
    setSaving(true);
    try {
      await partyTimelineApi.updateTimelineEvent(wsId, partyId, event._id, { summary: editValue });
      message.success('Updated');
      setEditOpen(false);
      onChanged();
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err?.message) message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete this entry?',
      okType: 'danger',
      onOk: async () => {
        try {
          await partyTimelineApi.deleteTimelineEvent(wsId, partyId, event._id);
          message.success('Deleted');
          onChanged();
        } catch (e: unknown) {
          const err = e as { message?: string };
          if (err?.message) message.error(err.message);
        }
      },
    });
  };

  return (
    <div
      style={{
        padding: '12px 0',
        borderBottom: '1px solid var(--cr-border-light)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <Tag
        color={TYPE_COLORS[event.type] ?? 'default'}
        style={{ minWidth: 110, textAlign: 'center' }}
      >
        {event.type}
      </Tag>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13 }}>{event.summary}</div>
        <div style={{ color: 'var(--cr-text-3)', fontSize: 11, marginTop: 2 }}>
          {formatTs(event.occurredAt)}
        </div>
      </div>
      {canEdit ? (
        <Dropdown
          menu={{
            items: [
              { key: 'edit', label: t('addNote') + ' - Edit', onClick: () => setEditOpen(true) },
              { key: 'delete', label: 'Delete', danger: true, onClick: handleDelete },
            ],
          }}
        >
          <Button size="small" icon={<MoreOutlined />} type="text" />
        </Dropdown>
      ) : null}

      <Modal
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleEdit}
        title="Edit entry"
        confirmLoading={saving}
        destroyOnHidden
      >
        <Input.TextArea
          rows={4}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          maxLength={500}
          showCount
        />
      </Modal>
    </div>
  );
}
