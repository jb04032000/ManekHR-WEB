import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/app/messages/en.json';
import StartConversationButton from './StartConversationButton';
import { startInboxContextThread, startInboxDm } from './inbox.actions';
import { isConnectModuleEnabled } from '@/lib/connect/flags';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('./inbox.actions', () => ({ startInboxContextThread: vi.fn(), startInboxDm: vi.fn() }));
vi.mock('@/lib/connect/flags', () => ({ isConnectModuleEnabled: vi.fn(() => true) }));

function renderBtn(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('StartConversationButton', () => {
  beforeEach(() => {
    push.mockReset();
    vi.mocked(startInboxContextThread).mockReset();
    vi.mocked(startInboxDm).mockReset();
    vi.mocked(isConnectModuleEnabled).mockReturnValue(true);
  });

  it('resolves a context thread and navigates to it', async () => {
    vi.mocked(startInboxContextThread).mockResolvedValue({
      ok: true,
      data: { _id: 'th1' },
    } as never);
    renderBtn(
      <StartConversationButton recipientUserId="u2" context={{ type: 'Inquiry', id: 'iq1' }} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /message/i }));

    await waitFor(() =>
      expect(startInboxContextThread).toHaveBeenCalledWith('u2', 'Inquiry', 'iq1'),
    );
    // The unified inbox opens by person (the resolved thread still exists).
    await waitFor(() => expect(push).toHaveBeenCalledWith('/connect/inbox?person=u2'));
  });

  it('opens a plain DM when no context is given', async () => {
    vi.mocked(startInboxDm).mockResolvedValue({ ok: true, data: { _id: 'dm9' } } as never);
    renderBtn(<StartConversationButton recipientUserId="u3" />);

    fireEvent.click(screen.getByRole('button', { name: /message/i }));

    await waitFor(() => expect(startInboxDm).toHaveBeenCalledWith('u3'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/connect/inbox?person=u3'));
  });

  it('renders nothing until the inbox phase is reached', () => {
    vi.mocked(isConnectModuleEnabled).mockReturnValue(false);
    const { container } = renderBtn(<StartConversationButton recipientUserId="u2" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
