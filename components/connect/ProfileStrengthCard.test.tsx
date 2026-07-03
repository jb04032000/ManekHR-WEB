import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import ProfileStrengthCard, { type StrengthItem } from './ProfileStrengthCard';

const items: StrengthItem[] = [
  { key: 'headline', label: 'Add a headline', done: true },
  {
    key: 'portfolio',
    label: 'Add a work sample',
    done: false,
    action: { label: 'Add', href: '#' },
  },
];

describe('ProfileStrengthCard', () => {
  it('shows the strength percentage', () => {
    renderWithIntl(<ProfileStrengthCard strength={60} items={items} />);
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('renders every checklist item', () => {
    renderWithIntl(<ProfileStrengthCard strength={60} items={items} />);
    expect(screen.getByText('Add a headline')).toBeInTheDocument();
    expect(screen.getByText('Add a work sample')).toBeInTheDocument();
  });

  it('shows a CTA only for incomplete items', () => {
    renderWithIntl(<ProfileStrengthCard strength={60} items={items} />);
    expect(screen.getByRole('link', { name: 'Add' })).toBeInTheDocument();
  });
});
