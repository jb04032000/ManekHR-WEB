import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { ModuleAvailabilityEditor } from './module-availability-editor';

// Grouping + toggle behaviour for the admin Module Availability editor
// (Coming Soon vs Upgrade presentation flags). Editor lives in
// components/admin/module-availability-editor.tsx; the settings page
// (app/(app)/admin/settings/page.tsx) persists the exact array `onChange`
// returns via PATCH /admin/settings { comingSoonModules }.

// Mirrors app/messages/en.json admin.moduleAvailability.* (keep in sync).
const messages = {
  admin: {
    moduleAvailability: {
      comingSoon: 'Coming Soon',
      upgrade: 'Upgrade',
      groupAccounting: 'Accounting Group',
      groupTimeAttendance: 'Time & Attendance Group',
      groupMachines: 'Machines Group',
      otherModules: 'Other Modules',
      allComingSoon: 'All Coming Soon',
      allUpgrade: 'All Upgrade',
    },
  },
};

const renderEditor = (comingSoonModules: string[], onChange = vi.fn()) => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ModuleAvailabilityEditor comingSoonModules={comingSoonModules} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return onChange;
};

afterEach(cleanup);

describe('ModuleAvailabilityEditor', () => {
  it('renders the three named groups + the flat Other Modules section', () => {
    renderEditor([]);

    expect(screen.getByText('Accounting Group')).toBeInTheDocument();
    expect(screen.getByText('Time & Attendance Group')).toBeInTheDocument();
    expect(screen.getByText('Machines Group')).toBeInTheDocument();
    expect(screen.getByText('Other Modules')).toBeInTheDocument();

    // Accounting members render inside (module Tag text).
    expect(screen.getByText('finance')).toBeInTheDocument();
    expect(screen.getByText('inventory')).toBeInTheDocument();
    expect(screen.getByText('gst_compliance')).toBeInTheDocument();
    expect(screen.getByText('job_work')).toBeInTheDocument();
  });

  it('does NOT render the hidden bills / downtime / maintenance cards', () => {
    renderEditor([]);

    expect(screen.queryByText('bills')).not.toBeInTheDocument();
    expect(screen.queryByText('downtime')).not.toBeInTheDocument();
    expect(screen.queryByText('maintenance')).not.toBeInTheDocument();
  });

  it('toggling a module ON adds it without dropping other flags', () => {
    const onChange = renderEditor(['machines']);

    // Row switch is labelled "<label>: <state>" for a11y + targeting.
    fireEvent.click(screen.getByRole('switch', { name: /^Finance:/ }));

    expect(onChange).toHaveBeenCalledWith(['machines', 'finance']);
  });

  it('toggling a module OFF removes only that module', () => {
    const onChange = renderEditor(['finance', 'machines']);

    fireEvent.click(screen.getByRole('switch', { name: /^Finance:/ }));

    expect(onChange).toHaveBeenCalledWith(['machines']);
  });

  it('group "All Coming Soon" flags the whole group, preserving flags outside it (incl. hidden modules)', () => {
    // 'bills' is hidden from the editor but must survive the round-trip.
    const onChange = renderEditor(['bills']);

    fireEvent.click(screen.getAllByText('All Coming Soon')[0]); // Accounting group

    const emitted = onChange.mock.calls[0][0] as string[];
    expect(emitted).toContain('bills');
    expect(emitted).toContain('finance');
    expect(emitted).toContain('inventory');
    expect(emitted).toContain('gst_compliance');
    expect(emitted).toContain('job_work');
    // Other groups untouched.
    expect(emitted).not.toContain('machines');
  });

  it('group "All Upgrade" clears only that group', () => {
    const onChange = renderEditor(['finance', 'inventory', 'machines']);

    fireEvent.click(screen.getAllByText('All Upgrade')[0]); // Accounting group

    expect(onChange).toHaveBeenCalledWith(['machines']);
  });
});
