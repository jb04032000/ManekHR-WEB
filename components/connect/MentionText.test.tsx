import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MentionText from './MentionText';

describe('MentionText', () => {
  it('renders plain text unchanged when there are no mentions', () => {
    render(<MentionText text="hello world" />);
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('renders an @display token as a link to its href', () => {
    render(
      <MentionText
        text="hi @Nita Patel welcome"
        mentions={[
          { type: 'profile', refId: 'u1', display: 'Nita Patel', href: '/connect/u/nita' },
        ]}
      />,
    );
    const link = screen.getByRole('link', { name: '@Nita Patel' });
    expect(link).toHaveAttribute('href', '/connect/u/nita');
  });

  it('order-matches duplicate display names left to right', () => {
    render(
      <MentionText
        text="@A and @A again"
        mentions={[
          { type: 'profile', refId: 'u1', display: 'A', href: '/connect/u/a1' },
          { type: 'profile', refId: 'u2', display: 'A', href: '/connect/u/a2' },
        ]}
      />,
    );
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/connect/u/a1');
    expect(links[1]).toHaveAttribute('href', '/connect/u/a2');
  });

  it('renders a mention as plain text when its href is empty (deleted entity)', () => {
    render(
      <MentionText
        text="bye @Gone"
        mentions={[{ type: 'profile', refId: 'x', display: 'Gone', href: '' }]}
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/@Gone/)).toBeInTheDocument();
  });
});
