'use client';

/**
 * SuggestionsTab - the Network screen's "Suggestions" panel.
 *
 * ERP-weighted "people you may know", pre-loaded + pre-hydrated by the Server
 * Component. Each row reuses `PersonCard` and shows the reason it surfaced (a
 * shared workshop, mutual connections, or shared skills). The relationship
 * controls (Connect primary + Follow secondary) come from the shared
 * `PersonCardActions` so every people surface behaves identically. Filter pills
 * narrow to a single signal.
 *
 * Reframe note: Phase 2 suggestions are people only - Company-Page suggestions
 * arrive with Company Pages (Phase 6), at which point those cards flip to
 * Follow-primary via `PersonCardActions`.
 */

import { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ConnectEmptyState, PersonCard } from '@/components/connect';
import PersonCardActions from './PersonCardActions';
import type { Suggestion } from '../network.types';
import { toConnectPerson, type PeopleIndex } from './hydrate';

/** The signal a filter pill narrows to. */
type SuggestionFilter = 'all' | 'skills' | 'mutuals';

interface SuggestionsTabProps {
  /** Ranked suggestions, pre-loaded by the Server Component. */
  suggestions: Suggestion[];
  /** Hydrated people for `suggestions`, keyed by `userId`. */
  people: PeopleIndex;
}

export default function SuggestionsTab({ suggestions, people }: SuggestionsTabProps) {
  const t = useTranslations('connect.network.suggestions');
  const tPerson = useTranslations('connect.network.person');

  const [filter, setFilter] = useState<SuggestionFilter>('all');

  const filtered = useMemo(() => {
    if (filter === 'skills') return suggestions.filter((s) => s.sharedSkills.length > 0);
    if (filter === 'mutuals') return suggestions.filter((s) => s.mutualConnections > 0);
    return suggestions;
  }, [suggestions, filter]);

  /** The plain-language reason a person was suggested - strongest signal wins. */
  const reasonFor = (s: Suggestion): string => {
    if (s.sharedErpParty) return t('reason.erpParty');
    if (s.sharedWorkspace) return t('reason.sharedWorkspace');
    if (s.mutualConnections > 0) return t('reason.mutuals', { count: s.mutualConnections });
    if (s.sharedSkills.length > 0) return t('reason.skills', { skills: s.sharedSkills.join(', ') });
    return t('reason.generic');
  };

  // No suggestions at all - the viewer's profile + graph carry no signal yet.
  if (suggestions.length === 0) {
    return (
      <ConnectEmptyState
        variant="inline"
        icon={<Sparkles size={24} aria-hidden />}
        title={t('empty.title')}
        description={t('empty.body')}
      />
    );
  }

  const filters: { key: SuggestionFilter; label: string }[] = [
    { key: 'all', label: t('filter.all') },
    { key: 'skills', label: t('filter.skills') },
    { key: 'mutuals', label: t('filter.mutuals') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-md)' }}>
      <div
        role="group"
        aria-label={t('filterAria')}
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
      >
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              style={{
                padding: '6px 13px',
                borderRadius: 'var(--cr-radius-full)',
                border: '1px solid var(--cr-border)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: active ? 'var(--cr-primary)' : 'var(--cr-surface)',
                color: active ? 'var(--cr-surface)' : 'var(--cr-text-4)',
                borderColor: active ? 'var(--cr-primary)' : 'var(--cr-border)',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <ConnectEmptyState
          variant="inline"
          icon={<Sparkles size={24} aria-hidden />}
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
          {filtered.map((suggestion) => {
            const person = toConnectPerson(suggestion.userId, people, tPerson('fallbackName'));
            return (
              <li
                key={suggestion.userId}
                style={{ padding: '14px 4px', borderBottom: '1px solid var(--cr-border-light)' }}
              >
                <PersonCard
                  person={person}
                  action={<PersonCardActions userId={suggestion.userId} mode="full" />}
                />
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--cr-text-4)' }}>
                  {reasonFor(suggestion)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
