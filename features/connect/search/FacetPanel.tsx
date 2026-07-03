'use client';

/**
 * FacetPanel - the People-vertical facet strip on `/connect/search`.
 *
 * Three facets, all reducing to existing backend DTO params (no new param):
 *
 *   - `skills` (multi-chip): the member types a skill and presses Enter (or
 *     taps the Add button); the chip lands in the list immediately and the
 *     URL is updated with the new `?skills=&skills=` repeated key. Removing a
 *     chip drops that skill from the URL. Duplicates are silently rejected so
 *     the URL never grows a same-tag pair.
 *   - `district` (free-text scalar): typing is debounced 300 ms before
 *     pushing the URL, so a slow Indian-mobile network sees one navigation
 *     for "Surat" instead of five. Clearing the input drops the `?district=`
 *     param entirely.
 *   - `openToWork` (boolean switch): toggling on writes `?openToWork=true`;
 *     toggling off drops the param. Discrete event - no debounce.
 *   - `providingServices` (boolean switch): same wiring as `openToWork`,
 *     writes `?providingServices=true` to narrow to people offering services /
 *     job-work. Discrete event - no debounce.
 *
 * Every change preserves the rest of the URL state - `q`, `type`, `#tags`
 * inside `q`, and any future search param. We never overwrite the URL with a
 * narrow slice. The panel reads the live URL via `useSearchParams` on every
 * render so external navigation (clicking a result + back, tapping a tab) is
 * reflected immediately.
 *
 * Standard #17: the `openToWork` toggle is not self-evident in the textile
 * workshop owner's vocabulary, so it ships with an `InfoTooltip` explaining
 * what filter the switch actually applies, in plain language.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Input, Switch } from 'antd';
import { Plus, X } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { InfoTooltip } from '@/components/ui';

const DISTRICT_DEBOUNCE_MS = 300;

export default function FacetPanel() {
  const t = useTranslations('connect.search.facets');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Live URL state, recomputed every render so external navigation (back
  // button, tab click, manual URL edit) is reflected without a re-mount.
  const urlSkills = useMemo(() => searchParams.getAll('skills'), [searchParams]);
  const urlDistrict = searchParams.get('district') ?? '';
  const urlOpenToWork = searchParams.get('openToWork') === 'true';
  // `providingServices` mirrors `openToWork` exactly: a boolean people-vertical
  // facet that narrows to members with the "Providing services" intent on. The
  // backend reads `?providingServices=true` alongside `?openToWork=true`.
  const urlProvidingServices = searchParams.get('providingServices') === 'true';
  const hasAnyFacet =
    urlSkills.length > 0 || urlDistrict.length > 0 || urlOpenToWork || urlProvidingServices;

  // Local state for the typing path: a draft skill we are still composing,
  // and the draft district we have not yet pushed. The district sync effect
  // below pushes when the draft settles for `DISTRICT_DEBOUNCE_MS`.
  const [pendingSkill, setPendingSkill] = useState('');
  const [districtDraft, setDistrictDraft] = useState(urlDistrict);

  // Reset the local draft from the URL on external navigation (back button,
  // tab click, manual URL edit) so a stale draft does not linger in the
  // input. Done during render per the React "you might not need an effect"
  // guidance, using a previous-value ref-style pattern so we only reset when
  // the URL value actually changes, never on every render.
  const [prevUrlDistrict, setPrevUrlDistrict] = useState(urlDistrict);
  if (urlDistrict !== prevUrlDistrict) {
    setPrevUrlDistrict(urlDistrict);
    setDistrictDraft(urlDistrict);
  }

  /** Push a new URL with a caller-defined param mutation applied. */
  const pushWith = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  // District debounced sync. Only fires when the draft has actually diverged
  // from the URL (so a back-button trip into a stale draft does not loop).
  useEffect(() => {
    if (districtDraft === urlDistrict) return;
    const timer = setTimeout(() => {
      pushWith((params) => {
        const trimmed = districtDraft.trim();
        if (trimmed) params.set('district', trimmed);
        else params.delete('district');
      });
    }, DISTRICT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [districtDraft, urlDistrict, pushWith]);

  /** Write `next` as the full `skills` list, replacing the existing entries. */
  const writeSkills = useCallback(
    (next: string[]) => {
      pushWith((params) => {
        params.delete('skills');
        next.forEach((s) => params.append('skills', s));
      });
    },
    [pushWith],
  );

  const handleAddSkill = useCallback(() => {
    const trimmed = pendingSkill.trim();
    if (!trimmed) return;
    setPendingSkill('');
    if (urlSkills.includes(trimmed)) return;
    writeSkills([...urlSkills, trimmed]);
  }, [pendingSkill, urlSkills, writeSkills]);

  const handleRemoveSkill = useCallback(
    (skill: string) => {
      const next = urlSkills.filter((s) => s !== skill);
      writeSkills(next);
    },
    [urlSkills, writeSkills],
  );

  const handleOpenToWorkChange = useCallback(
    (checked: boolean) => {
      pushWith((params) => {
        if (checked) params.set('openToWork', 'true');
        else params.delete('openToWork');
      });
    },
    [pushWith],
  );

  const handleProvidingServicesChange = useCallback(
    (checked: boolean) => {
      pushWith((params) => {
        if (checked) params.set('providingServices', 'true');
        else params.delete('providingServices');
      });
    },
    [pushWith],
  );

  const handleClearAll = useCallback(() => {
    pushWith((params) => {
      params.delete('skills');
      params.delete('district');
      params.delete('openToWork');
      params.delete('providingServices');
    });
  }, [pushWith]);

  return (
    <section aria-label={t('title')} className="cn-facet-bar">
      <div style={{ flex: '1 1 200px', minWidth: 0 }}>
        <label
          htmlFor="facet-skill"
          style={{
            display: 'block',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--cr-text-2)',
            marginBottom: 4,
          }}
        >
          {t('skillsLabel')}
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <Input
            id="facet-skill"
            placeholder={t('skillsPlaceholder')}
            value={pendingSkill}
            onChange={(e) => setPendingSkill(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSkill();
              }
            }}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button
            type="button"
            aria-label={t('skillsAddAria')}
            onClick={handleAddSkill}
            disabled={!pendingSkill.trim()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              padding: 0,
              border: 'none',
              borderRadius: 'var(--cr-radius-sm)',
              background: pendingSkill.trim() ? 'var(--cr-primary)' : 'var(--cr-surface-3)',
              color: pendingSkill.trim() ? 'var(--cr-surface)' : 'var(--cr-text-4)',
              cursor: pendingSkill.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            <Plus size={14} aria-hidden />
          </button>
        </div>
        {urlSkills.length > 0 && (
          <ul
            role="list"
            aria-label={t('skillsListAria')}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              listStyle: 'none',
              margin: '6px 0 0',
              padding: 0,
            }}
          >
            {urlSkills.map((skill) => (
              <li key={skill} style={{ display: 'inline-flex' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 4px 3px 10px',
                    borderRadius: 'var(--cr-radius-full)',
                    background: 'var(--cr-primary-light)',
                    border: '1px solid var(--cr-primary-border)',
                    color: 'var(--cr-primary)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    aria-label={t('removeSkill', { skill })}
                    onClick={() => handleRemoveSkill(skill)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 16,
                      height: 16,
                      padding: 0,
                      border: 'none',
                      borderRadius: '50%',
                      background: 'transparent',
                      color: 'var(--cr-text-4)',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={11} aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        <label
          htmlFor="facet-district"
          style={{
            display: 'block',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--cr-text-2)',
            marginBottom: 4,
          }}
        >
          {t('districtLabel')}
        </label>
        <Input
          id="facet-district"
          placeholder={t('districtPlaceholder')}
          value={districtDraft}
          onChange={(e) => setDistrictDraft(e.target.value)}
          allowClear
        />
      </div>

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          alignSelf: 'flex-end',
          paddingBottom: 4,
        }}
      >
        <Switch
          id="facet-open-to-work"
          checked={urlOpenToWork}
          onChange={handleOpenToWorkChange}
          aria-label={t('openToWorkLabel')}
        />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <label
            htmlFor="facet-open-to-work"
            style={{ fontSize: 13, color: 'var(--cr-text)', cursor: 'pointer' }}
          >
            {t('openToWorkLabel')}
          </label>
          <InfoTooltip
            text={t('openToWorkLabel')}
            body={<p style={{ margin: 0 }}>{t('openToWorkHelp')}</p>}
            ariaLabel={t('openToWorkLabel')}
          />
        </span>
      </div>

      {/* Providing-services toggle: mirrors openToWork wiring. Writes
          `?providingServices=true` (people vertical only) so the backend
          narrows to members offering services / job-work. */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          alignSelf: 'flex-end',
          paddingBottom: 4,
        }}
      >
        <Switch
          id="facet-providing-services"
          checked={urlProvidingServices}
          onChange={handleProvidingServicesChange}
          aria-label={t('providingServicesLabel')}
        />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <label
            htmlFor="facet-providing-services"
            style={{ fontSize: 13, color: 'var(--cr-text)', cursor: 'pointer' }}
          >
            {t('providingServicesLabel')}
          </label>
          <InfoTooltip
            text={t('providingServicesLabel')}
            body={<p style={{ margin: 0 }}>{t('providingServicesHelp')}</p>}
            ariaLabel={t('providingServicesLabel')}
          />
        </span>
      </div>

      {hasAnyFacet && (
        <div style={{ flexBasis: '100%', display: 'flex', justifyContent: 'flex-end' }}>
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            aria-label={t('clearAllAria')}
            onClick={handleClearAll}
          >
            {t('clearAll')}
          </DsButton>
        </div>
      )}
    </section>
  );
}
