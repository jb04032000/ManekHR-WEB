/**
 * Institutes Phase 2 - student training credential tests.
 *
 * Covers the two halves of the per-credential confirm + opt-in feature:
 *  1. READ: TrainingList (ProfileView) renders the locked "Confirmed by
 *     [Institute]" verified badge ONLY for confirmStatus==='confirmed', a muted
 *     "Awaiting confirmation" chip for 'pending', and nothing (plain row) for
 *     'self' (and 'declined').
 *  2. WRITE: mapTrainingFormRows (EditSectionModal shaper) derives confirmStatus
 *     from the requestConfirm Switch + the linked companyPageId ('pending' only
 *     when linked + on; 'self' when linked + off; omitted when unlinked), and
 *     round-trips the stable id + shareWithInstitute opt-in.
 *
 * Cross-module: the read badge resolves the institute name from
 * trainingCompanies (company-pages module); a 'pending' write seeds that
 * institute's credential-requests queue on the BE.
 */

import { describe, it, expect, vi } from 'vitest';
import dayjs from 'dayjs';
import { renderWithIntl, screen } from '@/test-utils/render';

// ProfileView (which re-exports TrainingList) pulls in modules that read the
// Next router at import time; stub it so the import graph stays inert.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/connect/profile',
  useSearchParams: () => new URLSearchParams(),
}));

import { TrainingList } from './ProfileView';
import { mapTrainingFormRows, mapLocationPayload, type TrainingFormRow } from './EditSectionModal';
import type { ConnectTrainingItem } from '../profile.types';
import type { CompanyPageRef } from '../feed.types';
import { EMPTY_STATE_DISTRICT } from '../geo/StateDistrictPicker';

const INSTITUTE: CompanyPageRef = {
  id: 'inst-1',
  name: 'Surat Textile Skill Centre',
  slug: 'surat-textile-skill-centre',
  logo: '',
};

const institutes: Record<string, CompanyPageRef> = { 'inst-1': INSTITUTE };

const labels = {
  viewCertificateLabel: 'View certificate',
  awaitingLabel: 'Awaiting confirmation',
  confirmedByLabel: (institute: string) => `Confirmed by ${institute}`,
};

describe('TrainingList - confirmation markers (read)', () => {
  it('renders the "Confirmed by [Institute]" badge for a confirmed entry', () => {
    const items: ConnectTrainingItem[] = [
      {
        id: 't1',
        instituteName: 'Surat Textile Skill Centre',
        companyPageId: 'inst-1',
        course: 'Advanced zari techniques',
        completedAt: '2024-03-01',
        confirmStatus: 'confirmed',
        confirmedAt: '2024-04-10',
      },
    ];
    renderWithIntl(<TrainingList items={items} institutes={institutes} {...labels} />);
    expect(screen.getByText('Confirmed by Surat Textile Skill Centre')).toBeInTheDocument();
    // The pending chip must NOT appear for a confirmed entry.
    expect(screen.queryByText('Awaiting confirmation')).not.toBeInTheDocument();
  });

  it('renders a muted "Awaiting confirmation" chip for a pending entry', () => {
    const items: ConnectTrainingItem[] = [
      {
        id: 't2',
        instituteName: 'Surat Textile Skill Centre',
        companyPageId: 'inst-1',
        course: 'Zari basics',
        confirmStatus: 'pending',
      },
    ];
    renderWithIntl(<TrainingList items={items} institutes={institutes} {...labels} />);
    expect(screen.getByText('Awaiting confirmation')).toBeInTheDocument();
    // No verified badge while only pending.
    expect(screen.queryByText('Confirmed by Surat Textile Skill Centre')).not.toBeInTheDocument();
  });

  it('renders a self-declared entry plainly with no badge or chip', () => {
    const items: ConnectTrainingItem[] = [
      {
        id: 't3',
        instituteName: 'Surat Textile Skill Centre',
        companyPageId: 'inst-1',
        course: 'Sequins workshop',
        confirmStatus: 'self',
      },
    ];
    renderWithIntl(<TrainingList items={items} institutes={institutes} {...labels} />);
    // The course still renders, but neither marker does.
    expect(screen.getByText('Sequins workshop')).toBeInTheDocument();
    expect(screen.queryByText('Awaiting confirmation')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirmed by Surat Textile Skill Centre')).not.toBeInTheDocument();
  });

  it('renders a declined entry plainly (no verified styling), like self', () => {
    const items: ConnectTrainingItem[] = [
      {
        id: 't4',
        instituteName: 'Surat Textile Skill Centre',
        companyPageId: 'inst-1',
        course: 'Hand embroidery',
        confirmStatus: 'declined',
      },
    ];
    renderWithIntl(<TrainingList items={items} institutes={institutes} {...labels} />);
    expect(screen.getByText('Hand embroidery')).toBeInTheDocument();
    expect(screen.queryByText('Awaiting confirmation')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirmed by Surat Textile Skill Centre')).not.toBeInTheDocument();
  });
});

describe('mapTrainingFormRows - confirm + opt-in shaper (write)', () => {
  it('maps requestConfirm + a linked companyPageId to confirmStatus "pending"', () => {
    const rows: TrainingFormRow[] = [
      {
        id: 't1',
        instituteName: 'Surat Textile Skill Centre',
        companyPageId: 'inst-1',
        requestConfirm: true,
      },
    ];
    const out = mapTrainingFormRows(rows);
    expect(out).toHaveLength(1);
    expect(out[0].confirmStatus).toBe('pending');
  });

  it('maps a linked entry with requestConfirm OFF to confirmStatus "self"', () => {
    const rows: TrainingFormRow[] = [
      {
        id: 't1',
        instituteName: 'Surat Textile Skill Centre',
        companyPageId: 'inst-1',
        requestConfirm: false,
      },
    ];
    const out = mapTrainingFormRows(rows);
    expect(out[0].confirmStatus).toBe('self');
  });

  it('omits confirmStatus when there is no linked companyPageId (free-typed institute)', () => {
    const rows: TrainingFormRow[] = [
      // requestConfirm is true but the institute is free-typed (no companyPageId):
      // a free-typed institute can never be asked to confirm.
      { instituteName: 'Some Local Centre', requestConfirm: true },
    ];
    const out = mapTrainingFormRows(rows);
    expect(out[0].confirmStatus).toBeUndefined();
    expect(out[0].companyPageId).toBeUndefined();
  });

  it('never emits "confirmed" or "declined" even if a stray value were present', () => {
    const rows: TrainingFormRow[] = [
      {
        instituteName: 'Surat Textile Skill Centre',
        companyPageId: 'inst-1',
        requestConfirm: true,
      },
      {
        instituteName: 'Surat Textile Skill Centre',
        companyPageId: 'inst-1',
        requestConfirm: false,
      },
    ];
    const out = mapTrainingFormRows(rows);
    for (const item of out) {
      expect(['self', 'pending']).toContain(item.confirmStatus);
    }
  });

  it('round-trips the stable id and the shareWithInstitute opt-in', () => {
    const rows: TrainingFormRow[] = [
      {
        id: 'srv-id-123',
        instituteName: 'Surat Textile Skill Centre',
        companyPageId: 'inst-1',
        completedAt: dayjs('2024-03-01'),
        requestConfirm: true,
        shareWithInstitute: true,
      },
    ];
    const out = mapTrainingFormRows(rows);
    expect(out[0].id).toBe('srv-id-123');
    expect(out[0].shareWithInstitute).toBe(true);
    // completedAt is serialized to an ISO string.
    expect(typeof out[0].completedAt).toBe('string');
  });

  it('defaults shareWithInstitute to false when linked and the opt-in is off, and omits it when unlinked', () => {
    const rows: TrainingFormRow[] = [
      { instituteName: 'Linked Centre', companyPageId: 'inst-1' },
      { instituteName: 'Free Centre' },
    ];
    const out = mapTrainingFormRows(rows);
    expect(out[0].shareWithInstitute).toBe(false);
    expect(out[1].shareWithInstitute).toBeUndefined();
  });

  it('drops rows with a blank institute name', () => {
    const rows: TrainingFormRow[] = [
      { instituteName: '   ', companyPageId: 'inst-1', requestConfirm: true },
      { instituteName: 'Surat Textile Skill Centre' },
    ];
    const out = mapTrainingFormRows(rows);
    expect(out).toHaveLength(1);
    expect(out[0].instituteName).toBe('Surat Textile Skill Centre');
  });
});

// The header section forwards the StateDistrictPicker triple into the profile
// PATCH via mapLocationPayload. This proves the geo fields actually reach the
// payload that updateMyConnectProfile sends (district NAME + both india-geo
// slugs), so a region-targeted boost can match the saved district.
describe('mapLocationPayload - header location forward (write)', () => {
  it('forwards the canonical district NAME + geoStateSlug + geoDistrictSlug', () => {
    expect(
      mapLocationPayload({
        district: 'Surat',
        geoStateSlug: 'gujarat',
        geoDistrictSlug: 'surat',
      }),
    ).toEqual({ district: 'Surat', geoStateSlug: 'gujarat', geoDistrictSlug: 'surat' });
  });

  it('trims the district NAME', () => {
    expect(
      mapLocationPayload({
        district: '  Rajkot  ',
        geoStateSlug: 'gujarat',
        geoDistrictSlug: 'rajkot',
      }).district,
    ).toBe('Rajkot');
  });

  it('emits empty strings for a cleared / undefined location (clears the stored value)', () => {
    expect(mapLocationPayload(EMPTY_STATE_DISTRICT)).toEqual({
      district: '',
      geoStateSlug: '',
      geoDistrictSlug: '',
    });
    expect(mapLocationPayload(undefined)).toEqual({
      district: '',
      geoStateSlug: '',
      geoDistrictSlug: '',
    });
  });
});
