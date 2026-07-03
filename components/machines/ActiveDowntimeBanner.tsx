'use client';

/**
 * ActiveDowntimeBanner - red banner with live elapsed timer + Close action.
 *
 * Renders only when an open downtime exists for the machine. Polls the
 * active-downtime endpoint every 30 seconds (R-4 mitigation: bounded
 * traffic; cleanup on unmount via clearInterval). Elapsed timer ticks
 * every second locally - no server traffic per second.
 */

import { Alert, message } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';

import { DsButton } from '@/components/ui';
import { closeDowntime, getActiveDowntime } from '@/lib/actions/machines.actions';
import type { DowntimeEntry } from '@/types';

interface ActiveDowntimeBannerProps {
  wsId: string;
  machineId: string;
  /** Called after a successful close; parent typically refreshes the list. */
  onClosed?: () => void;
}

function formatElapsed(startIso: string, nowMs: number): string {
  const startMs = new Date(startIso).getTime();
  const totalSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function ActiveDowntimeBanner({ wsId, machineId, onClosed }: ActiveDowntimeBannerProps) {
  const t = useTranslations('machines-downtime');
  const [msgApi, ctx] = message.useMessage();

  const [entry, setEntry] = useState<DowntimeEntry | null>(null);
  const [closing, setClosing] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  // Use a ref to make the polled fetch idempotent against rapid re-renders.
  const cancelledRef = useRef(false);

  const fetchActive = useCallback(async () => {
    if (!wsId || !machineId) return;
    try {
      const next = await getActiveDowntime(wsId, machineId);
      if (!cancelledRef.current) {
        startTransition(() => {
          setEntry(next ?? null);
        });
      }
    } catch {
      // Silent on poll errors - banner stays in last-known state.
    }
  }, [wsId, machineId]);

  // Initial fetch + 30s poll (R-4)
  useEffect(() => {
    cancelledRef.current = false;
    fetchActive();
    const pollId = setInterval(fetchActive, 30_000);
    return () => {
      cancelledRef.current = true;
      clearInterval(pollId);
    };
  }, [fetchActive]);

  // Local 1-second tick for the elapsed timer (no server traffic)
  useEffect(() => {
    if (!entry) return;
    const tickId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickId);
  }, [entry]);

  const handleClose = useCallback(async () => {
    if (!entry) return;
    setClosing(true);
    try {
      await closeDowntime(wsId, machineId, entry._id, {});
      setEntry(null);
      onClosed?.();
      // Refresh in case a newer open downtime exists (race-safety).
      fetchActive();
    } catch (e: unknown) {
      const err = e as { message?: string };
      msgApi.error(err?.message ?? 'Failed to close downtime');
    } finally {
      setClosing(false);
    }
  }, [entry, wsId, machineId, onClosed, fetchActive, msgApi]);

  if (!entry) return null;

  const startFormatted = dayjs(entry.startAt).format('DD MMM YYYY HH:mm');
  const elapsed = formatElapsed(entry.startAt, now);

  return (
    <>
      {ctx}
      <Alert
        type="error"
        showIcon
        icon={<WarningOutlined />}
        className="mb-4 bg-red-50 text-red-900"
        message={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <strong>{entry.reasonLabelSnapshot}</strong>
              <span style={{ fontSize: 13 }}>
                {t('banner.openSince', { startAt: startFormatted })}
                {' · '}
                <span className="font-mono" aria-label={t('tab.elapsedAria')}>
                  {t('banner.elapsed', { elapsed })}
                </span>
              </span>
            </div>
            <DsButton dsVariant="danger" dsSize="sm" loading={closing} onClick={handleClose}>
              {t('banner.closeCta')}
            </DsButton>
          </div>
        }
      />
    </>
  );
}

export default ActiveDowntimeBanner;
