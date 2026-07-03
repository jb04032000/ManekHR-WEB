import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import RateRow from './RateRow';

describe('RateRow', () => {
  it('shows a set rate, Indian-rupee formatted from paise', () => {
    renderWithIntl(<RateRow rateCard={{ dailyWage: 75000 }} />);
    expect(screen.getByText(/₹750/)).toBeInTheDocument();
  });

  it('hides rate types that are not set', () => {
    renderWithIntl(<RateRow rateCard={{ dailyWage: 75000 }} />);
    expect(screen.queryByText('Piece rate')).not.toBeInTheDocument();
    expect(screen.queryByText('Monthly')).not.toBeInTheDocument();
  });

  it('shows a not-set message when no rates are set', () => {
    renderWithIntl(<RateRow rateCard={null} />);
    expect(screen.getByText('No rates added yet.')).toBeInTheDocument();
  });
});
