import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl, screen, waitFor, fireEvent } from '@/test-utils/render';

// Mock the picker server action so the typeahead resolves synchronously in tests
// (no network). The real action lives in features/connect/mention.actions.
vi.mock('@/features/connect/mention.actions', () => ({
  suggestMentions: vi.fn(),
}));

import { suggestMentions } from '@/features/connect/mention.actions';
import MentionTextArea from './MentionTextArea';

const mockSuggest = vi.mocked(suggestMentions);

/** One suggestion shaped like the backend `/connect/mention/suggest` response. */
function nita() {
  return {
    type: 'profile' as const,
    id: 'u1',
    display: 'Nita Patel',
    href: '/connect/u/u1',
    avatar: null,
  };
}

/**
 * Controlled harness: MentionTextArea is fully controlled (value + mentions in,
 * onChange out), so the test owns the state and re-renders on every onChange -
 * exactly how Composer / CommentBox drive it.
 */
function Harness({
  onChange,
  initialValue = '',
}: {
  onChange?: (v: string, m: { type: string; refId: string; display: string }[]) => void;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [mentions, setMentions] = useState<
    { type: 'profile' | 'company' | 'storefront'; refId: string; display: string }[]
  >([]);
  return (
    <MentionTextArea
      value={value}
      mentions={mentions}
      onChange={(v, m) => {
        setValue(v);
        setMentions(m);
        onChange?.(v, m);
      }}
      aria-label="Post text"
    />
  );
}

describe('MentionTextArea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuggest.mockResolvedValue({ ok: true, data: [nita()] });
  });

  it('(a) fires suggestMentions with the active @query as the user types', async () => {
    const user = userEvent.setup();
    renderWithIntl(<Harness />);
    const box = screen.getByLabelText('Post text');
    await user.click(box);
    await user.type(box, 'hi @ni');

    // Debounced - wait for the picker fetch with a query containing "ni".
    await waitFor(() => {
      expect(mockSuggest).toHaveBeenCalled();
    });
    const lastCall = mockSuggest.mock.calls[mockSuggest.mock.calls.length - 1];
    expect(String(lastCall[0])).toContain('ni');
  });

  it('(b) selecting a suggestion inserts @display and records the picked mention', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIntl(<Harness onChange={onChange} />);
    const box = screen.getByLabelText('Post text');
    await user.click(box);
    await user.type(box, 'hi @ni');

    // The dropdown row for the returned suggestion appears once the fetch settles.
    const option = await screen.findByText('Nita Patel');
    await user.click(option);

    await waitFor(() => {
      // The latest onChange must carry the inserted token + the picked mention.
      const calls = onChange.mock.calls;
      const last = calls[calls.length - 1];
      expect(last[0]).toContain('@Nita Patel');
      expect(last[1]).toEqual(
        expect.arrayContaining([{ type: 'profile', refId: 'u1', display: 'Nita Patel' }]),
      );
    });
  });

  it('(c) editing the @display token out reconciles the mention back out of the list', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithIntl(<Harness onChange={onChange} />);
    const box = screen.getByLabelText('Post text') as HTMLTextAreaElement;
    await user.click(box);
    await user.type(box, 'hi @ni');
    const option = await screen.findByText('Nita Patel');
    await user.click(option);

    // After select the textarea holds "hi @Nita Patel " with a mention recorded.
    await waitFor(() => {
      expect(box.value).toContain('@Nita Patel');
    });

    // Wipe the field entirely - the "@Nita Patel" token is gone, so the picked
    // mention must be reconciled out (atomic chips, no orphan tags).
    fireEvent.change(box, { target: { value: '' } });

    await waitFor(() => {
      const last = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(last[1]).toEqual([]);
    });
  });
});
