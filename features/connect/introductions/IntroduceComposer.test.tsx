import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as AntApp } from 'antd';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';

/**
 * IntroduceComposer tests - the "Introduce two people" modal (Broker
 * Introductions, Slice 2). The introductions actions module is mocked so the
 * test asserts the FORM contract (two distinct parties + a buyer role required)
 * and that a valid submit calls createIntroduction with the derived payload.
 *
 * Mirrors features/connect/jobs/JobComposer.template.test.tsx (renderWithIntl +
 * vi.mock the actions). Wrapped in <AntApp> because the composer reads the toast
 * API via AntApp.useApp() (same pattern as InviteStudentsPanel.test.tsx).
 */

const createIntroduction = vi.fn<
  (...a: unknown[]) => Promise<{ ok: boolean; data: { _id: string } }>
>(async () => ({
  ok: true,
  data: { _id: 'intro-1' },
}));
vi.mock('./introductions.actions', () => ({
  createIntroduction: (...a: unknown[]) => createIntroduction(...a),
}));

import IntroduceComposer, { type IntroducePerson } from './IntroduceComposer';

const PEOPLE: IntroducePerson[] = [
  { userId: 'u-buyer', name: 'Ramesh Buyer', avatar: null },
  { userId: 'u-seller', name: 'Suresh Seller', avatar: null },
  { userId: 'u-third', name: 'Third Person', avatar: null },
];

function renderComposer(onCreated = vi.fn()) {
  return renderWithIntl(
    <AntApp>
      <IntroduceComposer open onClose={() => {}} people={PEOPLE} onCreated={onCreated} />
    </AntApp>,
  );
}

/**
 * Open an AntD Select (by its form-item label) and click a dropdown option by
 * text. Two jsdom gotchas this handles:
 *   1. AntD v6 visible options carry no `role="option"` and the `aria-controls`
 *      listbox is a separate a11y node (NOT the options' container), so the
 *      helper targets the visible `.ant-select-item-option` rows.
 *   2. A just-closed select's dropdown lingers (CSS transitions never finish in
 *      jsdom), so several `.ant-select-dropdown`s coexist. Each `mouseDown`
 *      appends a fresh dropdown LAST in document order, so the currently-opening
 *      select's options are always in the LAST dropdown - scope to it so the
 *      click never lands on a stale neighbour's (hidden) option.
 */
async function pickFromSelect(label: string, optionText: string) {
  const combobox = await screen.findByLabelText(label);
  fireEvent.mouseDown(combobox);
  const option = await waitFor(() => {
    const dropdowns = document.querySelectorAll('.ant-select-dropdown');
    const dd = dropdowns[dropdowns.length - 1];
    const opt =
      dd &&
      Array.from(dd.querySelectorAll('.ant-select-item-option')).find(
        (el) => el.textContent === optionText,
      );
    if (!opt) throw new Error(`option "${optionText}" not open for ${label}`);
    return opt as HTMLElement;
  });
  fireEvent.click(option);
}

describe('IntroduceComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not submit (no createIntroduction) until two distinct parties + a buyer are chosen', async () => {
    renderComposer();
    // Submit with an empty form: the required validators block it.
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(screen.getAllByText('Please pick a person.').length).toBeGreaterThan(0);
    });
    expect(createIntroduction).not.toHaveBeenCalled();
  });

  it('requires the two parties to be different', async () => {
    renderComposer();
    await pickFromSelect('First person', 'Ramesh Buyer');
    await pickFromSelect('Second person', 'Ramesh Buyer');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      expect(screen.getAllByText('Please pick two different people.').length).toBeGreaterThan(0);
    });
    expect(createIntroduction).not.toHaveBeenCalled();
  });

  it('submits with the derived payload once two distinct parties + the buyer are set', async () => {
    const onCreated = vi.fn();
    renderComposer(onCreated);

    await pickFromSelect('First person', 'Ramesh Buyer');
    await pickFromSelect('Second person', 'Suresh Seller');
    // The buyer picker only offers the two chosen parties; choose party A as buyer.
    await pickFromSelect('Who is the buyer?', 'Ramesh Buyer');

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(createIntroduction).toHaveBeenCalledTimes(1);
    });
    // partyA = first person, partyB = second person, roleOfA = 'buyer' (A is buyer).
    expect(createIntroduction).toHaveBeenCalledWith(
      expect.objectContaining({
        partyAUserId: 'u-buyer',
        partyBUserId: 'u-seller',
        roleOfA: 'buyer',
      }),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });
});
