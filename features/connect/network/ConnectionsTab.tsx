'use client';

/**
 * ConnectionsTab - the Network screen's "Connections" panel.
 *
 * The full connections list arrives pre-loaded + pre-hydrated from the Server
 * Component. A connection is a symmetric, mutually-agreed edge. This tab adds:
 *  - a filter-within text box (client-side, name match, debounced via
 *    `useDeferredValue` so a long list does not re-filter on every keystroke);
 *  - a Remove action, behind an AntD `Popconfirm` so the edge is never dropped
 *    by a stray tap. A successful remove refreshes the route.
 */

import { useCallback, useDeferredValue, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { App as AntApp, Popconfirm } from 'antd';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DsInput } from '@/components/ui';
import DsButton from '@/components/ui/DsButton';
import { ConnectEmptyState, PersonCard } from '@/components/connect';
import { removeConnection } from '../network.actions';
import type { ConnectionSummary } from '../network.types';
import { toConnectPerson, type PeopleIndex } from './hydrate';

interface ConnectionsTabProps {
  /** The viewer's connections, pre-loaded by the Server Component. */
  connections: ConnectionSummary[];
  /** Hydrated people for `connections`, keyed by `userId`. */
  people: PeopleIndex;
}

export default function ConnectionsTab({ connections, people }: ConnectionsTabProps) {
  const t = useTranslations('connect.network.connections');
  const tPerson = useTranslations('connect.network.person');
  const router = useRouter();
  const { message } = AntApp.useApp();

  /** Locally hidden ids - a removed row leaves immediately, pre-refresh. */
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [, startRefresh] = useTransition();

  const visible = useMemo(
    () => connections.filter((c) => !removedIds.has(c.userId)),
    [connections, removedIds],
  );

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) return visible;
    return visible.filter((c) => {
      const name = people[c.userId]?.name ?? tPerson('fallbackName');
      return name.toLowerCase().includes(needle);
    });
  }, [visible, deferredQuery, people, tPerson]);

  const remove = useCallback(
    async (userId: string) => {
      setBusyIds((prev) => new Set(prev).add(userId));
      const res = await removeConnection(userId);
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      if (!res.ok) {
        message.error(res.error || t('removeError'));
        return;
      }
      message.success(t('removed'));
      setRemovedIds((prev) => new Set(prev).add(userId));
      startRefresh(() => router.refresh());
    },
    [message, router, t],
  );

  // Whole list is empty - never connected, or every connection was removed.
  if (visible.length === 0) {
    return (
      <ConnectEmptyState
        variant="inline"
        icon={<Users size={24} aria-hidden />}
        title={t('empty.title')}
        description={t('empty.body')}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-md)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <DsInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('filterPlaceholder')}
          aria-label={t('filterAria')}
          allowClear
          // minWidth 0 (was 200) so the filter can shrink on a < 380px phone; the
          // parent row already wraps (flexWrap) and fl:1 keeps it full-width.
          style={{ flex: 1, minWidth: 0 }}
        />
        <span style={{ fontSize: 12.5, color: 'var(--cr-text-4)', whiteSpace: 'nowrap' }}>
          {t('count', { count: visible.length })}
        </span>
      </div>

      {filtered.length === 0 ? (
        <ConnectEmptyState
          variant="inline"
          icon={<Users size={24} aria-hidden />}
          title={t('noMatchTitle')}
          description={t('noMatchBody')}
        />
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {filtered.map((connection) => {
            const person = toConnectPerson(connection.userId, people, tPerson('fallbackName'));
            const busy = busyIds.has(connection.userId);
            return (
              <li
                key={connection.userId}
                style={{ padding: '14px 4px', borderBottom: '1px solid var(--cr-border-light)' }}
              >
                <PersonCard
                  person={person}
                  action={
                    <Popconfirm
                      title={t('removeConfirmTitle')}
                      description={t('removeConfirmBody', { name: person.name })}
                      okText={t('removeConfirmOk')}
                      cancelText={t('removeConfirmCancel')}
                      okButtonProps={{ danger: true }}
                      onConfirm={() => remove(connection.userId)}
                    >
                      <DsButton dsVariant="ghost" dsSize="sm" loading={busy}>
                        {t('remove')}
                      </DsButton>
                    </Popconfirm>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
