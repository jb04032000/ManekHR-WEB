import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App as AntApp } from 'antd';
import userEvent from '@testing-library/user-event';
import { renderWithIntl, screen, waitFor } from '@/test-utils/render';

/**
 * ShareButton interaction test: the WhatsApp action opens a wa.me deep link and
 * the copy fallback writes the canonical link, each firing the typed
 * `connect.share` event with the right surface + channel. The analytics emit is
 * mocked so we assert calls without a real PostHog/GA sink.
 */

const { trackEventSpy } = vi.hoisted(() => ({ trackEventSpy: vi.fn() }));
vi.mock('@/lib/analytics-events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/analytics-events')>();
  return { ...actual, trackEvent: trackEventSpy };
});

import ShareButton from './ShareButton';

const URL = 'https://manekhr.test/products/abc';

function renderButton() {
  return renderWithIntl(
    <AntApp>
      <ShareButton surface="listing" url={URL} name="Banarasi saree" />
    </AntApp>,
  );
}

beforeEach(() => {
  trackEventSpy.mockClear();
  // jsdom has no native share sheet -> the fallback is copy-link.
  delete (navigator as unknown as Record<string, unknown>).share;
});

describe('ShareButton', () => {
  it('opens a wa.me link and fires connect.share{channel:whatsapp} on the WhatsApp action', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderButton();

    await userEvent.click(screen.getByRole('button', { name: /whatsapp/i }));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0][0]).toContain('https://wa.me/?text=');
    expect(openSpy.mock.calls[0][0]).toContain(encodeURIComponent(URL));
    expect(trackEventSpy).toHaveBeenCalledWith('connect.share', {
      surface: 'listing',
      channel: 'whatsapp',
    });
    openSpy.mockRestore();
  });

  it('copies the canonical link and fires connect.share{channel:copy} on the fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderButton();

    // No native share -> the secondary button is the copy-link fallback.
    await userEvent.click(screen.getByRole('button', { name: /copy link/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(URL));
    expect(trackEventSpy).toHaveBeenCalledWith('connect.share', {
      surface: 'listing',
      channel: 'copy',
    });
  });
});
