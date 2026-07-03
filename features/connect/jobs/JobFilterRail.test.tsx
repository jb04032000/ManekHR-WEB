import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl, screen, fireEvent } from '@/test-utils/render';
import JobFilterRail from './JobFilterRail';
import type { BoardFacets, BoardFilters } from './jobs.types';

// Phase 2 prop contract: the rail consumes server `facets` + the canonical
// multi-select `filters` and edits them via a single `setFilter(patch)`; clear is
// `onClearAll`. (The old value/onChange/resultCount + EMPTY_JOB_FILTERS contract
// was removed when the board went server-driven.)
const EMPTY_FACETS: BoardFacets = {
  total: 0,
  district: [],
  role: [],
  employmentType: [],
  machineType: [],
  skill: [],
  wageType: [],
};

function renderRail(filters: BoardFilters, setFilter = vi.fn(), onClearAll = vi.fn()) {
  renderWithIntl(
    <JobFilterRail
      filters={filters}
      facets={EMPTY_FACETS}
      setFilter={setFilter}
      onClearAll={onClearAll}
    />,
  );
  return { setFilter, onClearAll };
}

describe('JobFilterRail', () => {
  it('renders the pay-type options (always, independent of facets)', () => {
    renderRail({});
    expect(screen.getByText('Daily wage')).toBeInTheDocument();
    expect(screen.getByText('Piece rate')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
  });

  it('emits the selected pay type via setFilter', () => {
    const { setFilter } = renderRail({});
    fireEvent.click(screen.getByText('Piece rate'));
    expect(setFilter).toHaveBeenCalledWith({ wageType: 'piece' });
  });

  it('toggles an active pay type off on a second click', () => {
    const { setFilter } = renderRail({ wageType: 'piece' });
    fireEvent.click(screen.getByText('Piece rate'));
    expect(setFilter).toHaveBeenCalledWith({ wageType: undefined });
  });

  it('offers Clear filters only when a filter is active', () => {
    const { rerender } = renderWithIntl(
      <JobFilterRail filters={{}} facets={EMPTY_FACETS} setFilter={vi.fn()} onClearAll={vi.fn()} />,
    );
    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
    rerender(
      <JobFilterRail
        filters={{ wageType: 'piece' }}
        facets={EMPTY_FACETS}
        setFilter={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });

  it('calls onClearAll when Clear filters is clicked', () => {
    const onClearAll = vi.fn();
    renderRail({ wageType: 'piece' }, vi.fn(), onClearAll);
    fireEvent.click(screen.getByText('Clear filters'));
    expect(onClearAll).toHaveBeenCalled();
  });
});
