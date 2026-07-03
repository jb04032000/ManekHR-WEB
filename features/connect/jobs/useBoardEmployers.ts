'use client';

/**
 * Batch-resolves employer identity for the board cards (Phase 3.2). Page-posted
 * jobs (companyPageId set) resolve to a CompanyPage via getCompanyPageRefs;
 * person-posted jobs (no page) resolve to a person via getPeople. Returns a
 * `Record<jobId, JobEmployerRef>` the card reads directly.
 *
 * Cross-module links:
 * - features/connect/entities/company-page.actions.getCompanyPageRefs (page id ->
 *   { id, name, slug, logo, erpLinked }).
 * - features/connect/network.actions.getPeople (user id -> { name, avatar }; NO
 *   ERP concept, so person rows are never badged).
 * - JobBoard passes the returned map into JobCard as `employer`.
 *
 * Gotcha: results grow via Load more. We resolve ONLY the ids that are not
 * already in the map (the new page's), one batch per kind, and MERGE into the
 * existing map - we never refetch the whole board. The dedupe is by source id
 * (pageId / userId), then fanned back out to every jobId that shares it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getCompanyPageRefs } from '../entities/company-page.actions';
import { getPeople } from '../network.actions';
import type { Job, JobEmployerRef } from './jobs.types';

export function useBoardEmployers(jobs: Job[]): Record<string, JobEmployerRef> {
  const [map, setMap] = useState<Record<string, JobEmployerRef>>({});
  // Track which source ids we have already resolved so Load more only fetches the
  // new ones. Refs (not state) so they do not retrigger the effect.
  const resolvedPages = useRef<Set<string>>(new Set());
  const resolvedPeople = useRef<Set<string>>(new Set());

  const resolve = useCallback(async (batch: Job[]) => {
    // Split into page-posted vs person-posted, collecting only unresolved ids.
    const pageIdToJobs = new Map<string, string[]>();
    const userIdToJobs = new Map<string, string[]>();
    for (const j of batch) {
      if (j.companyPageId) {
        const arr = pageIdToJobs.get(j.companyPageId) ?? [];
        arr.push(j._id);
        pageIdToJobs.set(j.companyPageId, arr);
      } else if (j.companyUserId) {
        const arr = userIdToJobs.get(j.companyUserId) ?? [];
        arr.push(j._id);
        userIdToJobs.set(j.companyUserId, arr);
      }
    }
    const newPageIds = [...pageIdToJobs.keys()].filter((id) => !resolvedPages.current.has(id));
    const newUserIds = [...userIdToJobs.keys()].filter((id) => !resolvedPeople.current.has(id));
    if (newPageIds.length === 0 && newUserIds.length === 0) return;

    // Mark as in-flight/resolved up front so a second results change does not
    // re-request the same ids (idempotent merge below tolerates the race).
    newPageIds.forEach((id) => resolvedPages.current.add(id));
    newUserIds.forEach((id) => resolvedPeople.current.add(id));

    // ONE batch per kind.
    const [pagesRes, peopleRes] = await Promise.all([
      newPageIds.length ? getCompanyPageRefs(newPageIds) : Promise.resolve({ ok: true, data: [] }),
      newUserIds.length ? getPeople(newUserIds) : Promise.resolve({ ok: true, data: [] }),
    ]);

    const patch: Record<string, JobEmployerRef> = {};
    if (pagesRes.ok) {
      for (const ref of pagesRes.data) {
        const ref2 = ref as {
          id: string;
          name: string;
          logo?: string;
          slug?: string;
          erpLinked?: boolean;
          // Forward hook: passed through to the card so a future GST-verified badge
          // lights up automatically once the BE ref carries this (off until then).
          gstVerified?: boolean;
        };
        const employer: JobEmployerRef = {
          name: ref2.name,
          logo: ref2.logo || undefined,
          slug: ref2.slug || undefined,
          erpLinked: !!ref2.erpLinked,
          gstVerified: !!ref2.gstVerified,
        };
        for (const jobId of pageIdToJobs.get(ref2.id) ?? []) patch[jobId] = employer;
      }
    }
    if (peopleRes.ok) {
      for (const person of peopleRes.data) {
        const p = person as { userId: string; name: string; avatar: string | null };
        // isPerson = true => JobCard never renders the ERP badge for this row.
        const employer: JobEmployerRef = {
          name: p.name,
          logo: p.avatar || undefined,
          isPerson: true,
        };
        for (const jobId of userIdToJobs.get(p.userId) ?? []) patch[jobId] = employer;
      }
    }
    if (Object.keys(patch).length) setMap((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    // Async batch resolve: every setMap inside `resolve` runs AFTER an await
    // (microtask boundary), never synchronously in the effect body, so it does
    // not cause the cascading render the rule guards against. This is a
    // synchronize-with-external-system fetch (the employer refs for the loaded
    // jobs), which is exactly what effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async post-await fetch resolve, see note
    void resolve(jobs);
  }, [jobs, resolve]);

  return map;
}
