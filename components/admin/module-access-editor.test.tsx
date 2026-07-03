import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModuleAccessEditor } from './module-access-editor';
import { getDefaultModuleAccessEntries } from '@/lib/utils/subscription.utils';
import type { ModuleAccessEntry } from '@/types';

// Grouping + dead-card hide behaviour for the admin plan module-access editor.
// Editor lives in components/admin/module-access-editor.tsx; the plan page
// (app/(app)/admin/plans/page.tsx) feeds `moduleAccess` and persists the exact
// array `onChange` returns, so preserving hidden-module entries here == saved.

describe('ModuleAccessEditor - Machines grouping + dead-card hide', () => {
  const baseAccess = () => getDefaultModuleAccessEntries('full');

  it('renders a Machines group containing machines + locations + resource_scopes cards', () => {
    render(<ModuleAccessEditor moduleAccess={baseAccess()} onChange={vi.fn()} />);

    // Parent group header.
    expect(screen.getByText('Machines Group')).toBeInTheDocument();

    // The three real machine module cards render (their module Tag text).
    expect(screen.getByText('machines')).toBeInTheDocument();
    expect(screen.getByText('locations')).toBeInTheDocument();
    expect(screen.getByText('resource_scopes')).toBeInTheDocument();
  });

  it('does NOT render the dead downtime / maintenance module cards', () => {
    render(<ModuleAccessEditor moduleAccess={baseAccess()} onChange={vi.fn()} />);

    // Standalone dead module labels must be absent (real control is the
    // machines_downtime / machines_maintenance sub-features inside Machines).
    expect(screen.queryByText('Machine Downtime')).not.toBeInTheDocument();
    expect(screen.queryByText('Preventive Maintenance')).not.toBeInTheDocument();
    // Their module Tags must be absent too.
    expect(screen.queryByText('downtime')).not.toBeInTheDocument();
    expect(screen.queryByText('maintenance')).not.toBeInTheDocument();
  });

  it('renders a non-machine module (salary) normally outside the group', () => {
    render(<ModuleAccessEditor moduleAccess={baseAccess()} onChange={vi.fn()} />);
    expect(screen.getByText('salary')).toBeInTheDocument();
    expect(screen.getByText('Salary')).toBeInTheDocument();
  });

  it('preserves a pre-existing hidden-module (maintenance) entry as pass-through on save', () => {
    // Simulate a plan that already stored a maintenance module entry the admin
    // can no longer see. Toggling a visible module must NOT drop it.
    const stored: ModuleAccessEntry[] = [
      ...baseAccess(),
      {
        module: 'maintenance',
        enabled: true,
        subFeatures: [{ key: 'view', access: 'full' }],
      },
    ];
    const onChange = vi.fn();
    render(<ModuleAccessEditor moduleAccess={stored} onChange={onChange} />);

    // Toggle a visible module off (salary switch is the first switch after
    // attendance...). Simpler: click "Disable All" which maps over the whole array.
    fireEvent.click(screen.getByText('Disable All'));

    expect(onChange).toHaveBeenCalled();
    const emitted = onChange.mock.calls[0][0] as ModuleAccessEntry[];
    const maintenance = emitted.find((m) => m.module === 'maintenance');
    // Entry survives the round-trip (data the admin can't see is not stripped).
    expect(maintenance).toBeDefined();
    // Visible modules still emitted.
    expect(emitted.find((m) => m.module === 'salary')).toBeDefined();
  });
});
