'use client';
/**
 * UpcomingGreetingsTable - 30-day preview of upcoming birthday/anniversary
 * greetings (D-32). Each row has a Suppress button that calls the firm-scoped
 * PATCH suppress-greetings endpoint (Plan 17-06).
 *
 * Empty state: "No upcoming greetings in the next 30 days. Enable greetings
 * or add birthday/anniversary dates to party contacts."
 *
 * Note: rows from the backend may not include firmId - we look it up from
 * the active workspace store + caller-provided firmId fallback. If neither
 * is available, the Suppress button is disabled with a tooltip.
 */

import { startTransition, useEffect, useState } from 'react';
import { Card, Table, Tag, Button, message, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import {
  partyIntelligenceSettingsApi,
  type UpcomingGreetingRow,
} from '@/lib/api/modules/party-intelligence-settings.api';

interface Props {
  wsId: string;
  /** Firm fallback used by the Suppress button when the row has no firmId. */
  firmId?: string;
  initial?: UpcomingGreetingRow[];
}

export default function UpcomingGreetingsTable({ wsId, firmId, initial }: Props) {
  const t = useTranslations('party-intelligence');
  const [rows, setRows] = useState<UpcomingGreetingRow[]>(initial ?? []);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const reload = async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const res = await partyIntelligenceSettingsApi.getUpcomingGreetings(wsId, 30);
      startTransition(() => {
        setRows(res.items ?? []);
      });
    } catch {
      // best-effort - keep prior rows
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initial || initial.length === 0) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);

  const handleSuppress = async (row: UpcomingGreetingRow) => {
    const fid = (row as UpcomingGreetingRow & { firmId?: string }).firmId ?? firmId;
    if (!fid) {
      message.warning('Open the party detail page to suppress greetings (firm context required).');
      return;
    }
    const key = `${row.partyId}:${row.contactId}:${row.occasion}:${row.date}`;
    setBusyKey(key);
    try {
      await partyIntelligenceSettingsApi.suppressGreetings(
        wsId,
        fid,
        row.partyId,
        row.contactId,
        true,
      );
      message.success('Greeting suppressed');
      // Reload preview so the suppressed row drops out (backend filters
      // suppressed contacts from the upcoming list).
      void reload();
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? 'Suppress failed');
    } finally {
      setBusyKey(null);
    }
  };

  const columns: ColumnsType<UpcomingGreetingRow> = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (d: string) => {
        try {
          return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        } catch {
          return d;
        }
      },
    },
    {
      title: 'Party',
      dataIndex: 'partyName',
      key: 'partyName',
    },
    {
      title: 'Contact',
      dataIndex: 'contactName',
      key: 'contactName',
      render: (v?: string) => v ?? '-',
    },
    {
      title: 'Occasion',
      dataIndex: 'occasion',
      key: 'occasion',
      width: 110,
      render: (v: 'birthday' | 'anniversary') => (
        <Tag color={v === 'birthday' ? 'magenta' : 'gold'}>{t(`greetings.${v}`)}</Tag>
      ),
    },
    {
      title: 'Channel',
      dataIndex: 'channel',
      key: 'channel',
      width: 110,
      render: (c: 'whatsapp' | 'email' | 'sms') => (
        <Tag>
          {c === 'whatsapp'
            ? t('greetings.channelWhatsapp')
            : c === 'email'
              ? t('greetings.channelEmail')
              : t('greetings.channelSms')}
        </Tag>
      ),
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: 'actions',
      width: 110,
      render: (_v: unknown, row) => {
        const key = `${row.partyId}:${row.contactId}:${row.occasion}:${row.date}`;
        const fid = (row as UpcomingGreetingRow & { firmId?: string }).firmId ?? firmId;
        return (
          <Tooltip title={fid ? '' : 'Open party detail to suppress (firm context required)'}>
            <Button
              size="small"
              loading={busyKey === key}
              disabled={!fid || row.suppressed}
              onClick={() => handleSuppress(row)}
            >
              {row.suppressed ? 'Suppressed' : 'Suppress'}
            </Button>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <Card title={t('greetings.upcomingNext30Days')} size="small">
      <Table<UpcomingGreetingRow>
        size="small"
        loading={loading}
        rowKey={(r) => `${r.partyId}:${r.contactId}:${r.occasion}:${r.date}`}
        columns={columns}
        dataSource={rows}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        locale={{
          emptyText:
            'No upcoming greetings in the next 30 days. Enable greetings or add birthday/anniversary dates to party contacts.',
        }}
      />
    </Card>
  );
}
