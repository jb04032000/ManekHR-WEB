import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import WhatsAppCTA, { buildWhatsAppHref } from './WhatsAppCTA';

describe('buildWhatsAppHref', () => {
  it('builds a bare wa.me link with no phone', () => {
    expect(buildWhatsAppHref()).toBe('https://wa.me/');
  });

  it('strips non-digits from the phone', () => {
    expect(buildWhatsAppHref('+91 98765-43210')).toBe('https://wa.me/919876543210');
  });

  it('URL-encodes the prefill text', () => {
    expect(buildWhatsAppHref('919876543210', 'Hi there')).toBe(
      'https://wa.me/919876543210?text=Hi%20there',
    );
  });
});

describe('WhatsAppCTA', () => {
  it('renders a link to the wa.me deep link, opening in a new tab', () => {
    renderWithIntl(<WhatsAppCTA phone="919876543210" prefill="hello" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://wa.me/919876543210?text=hello');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('shows the default "message" label', () => {
    renderWithIntl(<WhatsAppCTA phone="919876543210" />);
    expect(screen.getByText('Message on WhatsApp')).toBeInTheDocument();
  });

  it('hides the label when iconOnly', () => {
    renderWithIntl(<WhatsAppCTA iconOnly phone="919876543210" />);
    expect(screen.queryByText('Message on WhatsApp')).not.toBeInTheDocument();
  });
});
