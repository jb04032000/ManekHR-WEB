/**
 * AdminPlansPage -- regression test for the workspace-cap field-name mismatch.
 *
 * Bug: the three workspace-cap inputs (Max Workspaces / Max Members per
 * Workspace / Max Total Members) are rendered by <EntitlementsFormFields
 * namePrefix="entitlements" .../> which builds NESTED array names
 * (['entitlements','maxWorkspaces']). The page used to init + read them with a
 * LITERAL dot-string key ('entitlements.maxWorkspaces') -- a DISJOINT flat
 * field. So edit never populated the visible inputs (stale value carried over
 * between plans) and save persisted the ?? fallback instead of the typed value.
 *
 * These tests open Edit on two plans with DIFFERENT caps and assert the input
 * reflects the opened plan, then assert a save sends the typed value nested
 * under payload.entitlements.maxWorkspaces. Mirrors ConnectPromotionsConsole
 * test: mock @/lib/actions server actions before importing the subject.
 *
 * Cross-module link: page.tsx <-> components/admin/entitlements-form-fields.tsx
 * (the shared field component is the source of the nested name shape).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithIntl, screen } from '@/test-utils/render';
import type { Plan, Tier } from '@/types';

const getAdminPlansMock = vi.fn();
const getTiersMock = vi.fn();
const updateAdminPlanMock = vi.fn();
const createAdminPlanMock = vi.fn();
const deleteAdminPlanMock = vi.fn();

vi.mock('@/lib/actions', () => ({
  getAdminPlans: (...a: unknown[]) => getAdminPlansMock(...a),
  getTiers: (...a: unknown[]) => getTiersMock(...a),
  updateAdminPlan: (...a: unknown[]) => updateAdminPlanMock(...a),
  createAdminPlan: (...a: unknown[]) => createAdminPlanMock(...a),
  deleteAdminPlan: (...a: unknown[]) => deleteAdminPlanMock(...a),
}));

import AdminPlansPage from './page';

// Two ERP plans with DIFFERENT workspace caps so a stale carry-over is visible.
function makePlan(over: Partial<Plan> & { _id: string; name: string }): Plan {
  return {
    tier: 'free',
    product: 'erp',
    isActive: true,
    monthlyPrice: 0,
    yearlyPrice: 0,
    entitlements: {
      maxWorkspaces: 1,
      maxMembersPerWorkspace: 5,
      maxTotalMembers: 5,
      modules: ['attendance'],
      features: {
        export: false,
        apiAccess: false,
        advancedRbac: false,
        customRoles: false,
        shifts: false,
        bills: false,
      },
      moduleAccess: [{ module: 'attendance', enabled: true, subFeatures: [] }],
    },
    ...over,
  } as Plan;
}

const PLAN_A = makePlan({
  _id: 'plan-a',
  name: 'Plan A',
  entitlements: {
    maxWorkspaces: 3,
    maxMembersPerWorkspace: 9,
    maxTotalMembers: 11,
    modules: ['attendance'],
    features: {
      export: false,
      apiAccess: false,
      advancedRbac: false,
      customRoles: false,
      shifts: false,
      bills: false,
    },
    moduleAccess: [{ module: 'attendance', enabled: true, subFeatures: [] }],
  },
});

const PLAN_B = makePlan({
  _id: 'plan-b',
  name: 'Plan B',
  entitlements: {
    maxWorkspaces: 10,
    maxMembersPerWorkspace: 40,
    maxTotalMembers: 80,
    modules: ['attendance'],
    features: {
      export: false,
      apiAccess: false,
      advancedRbac: false,
      customRoles: false,
      shifts: false,
      bills: false,
    },
    moduleAccess: [{ module: 'attendance', enabled: true, subFeatures: [] }],
  },
});

const TIERS: Tier[] = [
  {
    _id: 'tier-free',
    name: 'Free',
    key: 'free',
    displayOrder: 0,
    color: 'default',
    isActive: true,
    defaultEntitlements: { maxWorkspaces: 1, maxMembersPerWorkspace: 5, maxTotalMembers: 5 },
  },
];

const openEditFor = async (planName: string) => {
  const editBtn = await screen.findByRole('button', { name: `Edit ${planName}` });
  fireEvent.click(editBtn);
  // Modal title confirms the editor is open.
  await screen.findByText('Edit Plan');
};

// Reads the numeric value the "Max Workspaces" AntD InputNumber currently shows.
const maxWorkspacesInput = () => screen.getByLabelText('Max Workspaces') as HTMLInputElement;

describe('AdminPlansPage workspace-cap fields', () => {
  beforeEach(() => {
    getAdminPlansMock.mockReset();
    getTiersMock.mockReset();
    updateAdminPlanMock.mockReset();
    createAdminPlanMock.mockReset();
    deleteAdminPlanMock.mockReset();
    getAdminPlansMock.mockResolvedValue([PLAN_A, PLAN_B]);
    getTiersMock.mockResolvedValue(TIERS);
    updateAdminPlanMock.mockResolvedValue({});
  });

  it('populates Max Workspaces from the plan being edited (no stale carry-over)', async () => {
    renderWithIntl(<AdminPlansPage />);
    // Wait for plans to load.
    await screen.findByRole('button', { name: 'Edit Plan A' });

    await openEditFor('Plan A');
    await waitFor(() => expect(maxWorkspacesInput().value).toBe('3'));

    // Close (scope Cancel to the open dialog -- the always-mounted
    // "Apply Tier Defaults?" ConfirmModal also has a Cancel button) then open the
    // OTHER plan; the input must reflect Plan B, not stay stale at 3.
    const dialog = screen.getByRole('dialog', { name: /Edit Plan/ });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Cancel$/ }));

    await openEditFor('Plan B');
    await waitFor(() => expect(maxWorkspacesInput().value).toBe('10'));
  }, 60000);

  it('saves the typed Max Workspaces under payload.entitlements.maxWorkspaces', async () => {
    renderWithIntl(<AdminPlansPage />);
    await screen.findByRole('button', { name: 'Edit Plan A' });

    await openEditFor('Plan A');
    await waitFor(() => expect(maxWorkspacesInput().value).toBe('3'));

    // Type a new cap value.
    const input = maxWorkspacesInput();
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.blur(input);

    // Submit via the modal OK button.
    fireEvent.click(screen.getByRole('button', { name: /^OK$/ }));

    await waitFor(() => expect(updateAdminPlanMock).toHaveBeenCalledTimes(1));
    const [planId, payload] = updateAdminPlanMock.mock.calls[0];
    expect(planId).toBe('plan-a');
    expect(payload.entitlements.maxWorkspaces).toBe(7);
  }, 60000);

  // â”€â”€ GST controls (optional-per-plan GST feature) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // The editor exposes a GST on/off Switch + a rate InputNumber. A save must
  // carry gstEnabled + gstRatePercent at the payload ROOT (not in entitlements),
  // mirroring the backend CreatePlanDto. Default ON at 18% when a plan predates
  // the fields. Cross-module link: page.tsx handleSave <-> backend CreatePlanDto.
  it('prefills GST rate to 18 when the plan has no gstRatePercent', async () => {
    renderWithIntl(<AdminPlansPage />);
    await screen.findByRole('button', { name: 'Edit Plan A' });

    await openEditFor('Plan A');
    const rate = screen.getByLabelText('GST rate (%)') as HTMLInputElement;
    await waitFor(() => expect(rate.value).toBe('18'));
  }, 60000);

  it('saves gstEnabled + gstRatePercent at the payload root', async () => {
    renderWithIntl(<AdminPlansPage />);
    await screen.findByRole('button', { name: 'Edit Plan A' });

    await openEditFor('Plan A');
    await waitFor(() => expect(maxWorkspacesInput().value).toBe('3'));

    // Set an explicit GST rate so the save carries a concrete value.
    const rate = screen.getByLabelText('GST rate (%)') as HTMLInputElement;
    fireEvent.change(rate, { target: { value: '12' } });
    fireEvent.blur(rate);

    fireEvent.click(screen.getByRole('button', { name: /^OK$/ }));

    await waitFor(() => expect(updateAdminPlanMock).toHaveBeenCalledTimes(1));
    const [, payload] = updateAdminPlanMock.mock.calls[0];
    // Root-level (NOT under entitlements) per the backend DTO.
    expect(payload.gstEnabled).toBe(true);
    expect(payload.gstRatePercent).toBe(12);
    expect(payload.entitlements.gstEnabled).toBeUndefined();
  }, 60000);

  // â”€â”€ Trial-plan flag (isTrialPlan) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // A plan can be flagged the trial plan: its entitlements = the trial's access.
  // The editor exposes a Switch; a save must carry isTrialPlan at the payload
  // ROOT (next to isDefault), and openEdit must prefill it from the plan.
  // Cross-module link: page.tsx handleSave/openEdit <-> backend CreatePlanDto.isTrialPlan.
  it('prefills the trial-plan switch from the plan being edited', async () => {
    // Plan A is the trial plan; the switch must reflect that on open.
    getAdminPlansMock.mockResolvedValue([makePlan({ ...PLAN_A, isTrialPlan: true }), PLAN_B]);
    renderWithIntl(<AdminPlansPage />);
    await screen.findByRole('button', { name: 'Edit Plan A' });

    await openEditFor('Plan A');
    const trialSwitch = (await screen.findByLabelText('Trial plan')) as HTMLInputElement;
    // AntD Switch renders an aria-checked button; reflect the prefilled value.
    await waitFor(() => expect(trialSwitch.getAttribute('aria-checked')).toBe('true'));
  }, 60000);

  it('saves isTrialPlan at the payload root (defaults false when off)', async () => {
    renderWithIntl(<AdminPlansPage />);
    await screen.findByRole('button', { name: 'Edit Plan A' });

    await openEditFor('Plan A');
    await waitFor(() => expect(maxWorkspacesInput().value).toBe('3'));

    fireEvent.click(screen.getByRole('button', { name: /^OK$/ }));

    await waitFor(() => expect(updateAdminPlanMock).toHaveBeenCalledTimes(1));
    const [, payload] = updateAdminPlanMock.mock.calls[0];
    // Root-level (NOT under entitlements), false by default since Plan A is not a trial plan.
    expect(payload.isTrialPlan).toBe(false);
    expect(payload.entitlements.isTrialPlan).toBeUndefined();
  }, 60000);

  // ── Card content (per-plan marketing.tagline + featureHighlights) ──────────
  // The editor exposes a "Card Content" section: a localized tagline (4 language
  // inputs) + a Form.List of feature bullets (each 4 language inputs). openEdit
  // must prefill from p.marketing; a save must carry marketing.tagline /
  // .featureHighlights at the payload root (mirroring backend CreatePlanDto), drop
  // blank fields, and PRESERVE any other marketing subfields it does not edit.
  // Cross-module link: page.tsx handleSave/openEdit <-> backend CreatePlanDto.marketing;
  // rendered by ErpPricingTable.tsx + PlanCard.tsx via pickLocalized.
  it('prefills the card-content tagline (English) from the plan being edited', async () => {
    getAdminPlansMock.mockResolvedValue([
      makePlan({ ...PLAN_A, marketing: { tagline: { en: 'Custom A tagline' } } }),
      PLAN_B,
    ]);
    renderWithIntl(<AdminPlansPage />);
    await screen.findByRole('button', { name: 'Edit Plan A' });

    await openEditFor('Plan A');
    const tagline = (await screen.findByLabelText('Tagline English')) as HTMLInputElement;
    await waitFor(() => expect(tagline.value).toBe('Custom A tagline'));
  }, 60000);

  it('saves marketing.tagline + featureHighlights at the payload root (blank locales dropped)', async () => {
    renderWithIntl(<AdminPlansPage />);
    await screen.findByRole('button', { name: 'Edit Plan A' });

    await openEditFor('Plan A');
    await waitFor(() => expect(maxWorkspacesInput().value).toBe('3'));

    // Set the English tagline (other languages left blank -> dropped).
    const tagline = screen.getByLabelText('Tagline English') as HTMLInputElement;
    fireEvent.change(tagline, { target: { value: 'Brand new tagline' } });
    fireEvent.blur(tagline);

    // Add one feature bullet and fill only its English value.
    fireEvent.click(screen.getByRole('button', { name: /Add feature/i }));
    const bullet = (await screen.findByLabelText('Feature 1 English')) as HTMLInputElement;
    fireEvent.change(bullet, { target: { value: 'A shiny feature' } });
    fireEvent.blur(bullet);

    fireEvent.click(screen.getByRole('button', { name: /^OK$/ }));

    await waitFor(() => expect(updateAdminPlanMock).toHaveBeenCalledTimes(1));
    const [, payload] = updateAdminPlanMock.mock.calls[0];
    expect(payload.marketing.tagline).toEqual({ en: 'Brand new tagline' });
    expect(payload.marketing.featureHighlights).toEqual([{ en: 'A shiny feature' }]);
  }, 60000);

  it('preserves untouched marketing subfields and omits a blank tagline on save', async () => {
    // Plan A already carries marketing config this form does not edit (badge /
    // displayOrder / isHighlighted). A save must keep them and NOT wipe them.
    getAdminPlansMock.mockResolvedValue([
      makePlan({
        ...PLAN_A,
        marketing: {
          displayOrder: 2,
          isHighlighted: true,
          badge: { label: { en: 'Hot' }, tone: 'gold' },
        } as unknown as Plan['marketing'],
      }),
      PLAN_B,
    ]);
    renderWithIntl(<AdminPlansPage />);
    await screen.findByRole('button', { name: 'Edit Plan A' });

    await openEditFor('Plan A');
    await waitFor(() => expect(maxWorkspacesInput().value).toBe('3'));

    // Submit without touching the (blank) card-content fields.
    fireEvent.click(screen.getByRole('button', { name: /^OK$/ }));

    await waitFor(() => expect(updateAdminPlanMock).toHaveBeenCalledTimes(1));
    const [, payload] = updateAdminPlanMock.mock.calls[0];
    // Untouched subfields survive (not wiped by the $set on the marketing object).
    expect(payload.marketing.displayOrder).toBe(2);
    expect(payload.marketing.isHighlighted).toBe(true);
    expect(payload.marketing.badge).toEqual({ label: { en: 'Hot' }, tone: 'gold' });
    // Blank tagline -> omitted; no bullets -> empty array.
    expect(payload.marketing.tagline).toBeUndefined();
    expect(payload.marketing.featureHighlights).toEqual([]);
  }, 60000);
});
