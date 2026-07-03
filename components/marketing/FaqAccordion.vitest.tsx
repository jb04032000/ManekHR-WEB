import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FaqAccordion } from './sections/FaqAccordion';

const track = vi.fn();
vi.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => track(...args) }));

const items = [
  { id: 'free', q: 'Is Connect free?', a: 'Yes, it is free to use.' },
  { id: 'sell', q: 'What can I sell?', a: 'Anything the textile trade makes.' },
];

afterEach(cleanup);
beforeEach(() => track.mockClear());

describe('FaqAccordion', () => {
  it('keeps every answer in the DOM (crawlable for answer engines)', () => {
    render(<FaqAccordion page="home" items={items} />);
    expect(screen.getByText('Yes, it is free to use.')).toBeTruthy();
    expect(screen.getByText('Anything the textile trade makes.')).toBeTruthy();
  });

  it('fires marketing.faq_opened with the question id when a question opens', () => {
    render(<FaqAccordion page="home" items={items} />);
    // Item 0 is open by default; opening item 1 should emit the event.
    fireEvent.click(screen.getByText('What can I sell?'));
    expect(track).toHaveBeenCalledWith('marketing.faq_opened', { page: 'home', question: 'sell' });
  });
});
