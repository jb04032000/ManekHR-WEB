import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl, screen, fireEvent } from '@/test-utils/render';
import ContactPreferenceSelector from './ContactPreferenceSelector';

describe('ContactPreferenceSelector', () => {
  it('renders the three contact options as radios', () => {
    renderWithIntl(<ContactPreferenceSelector value="whatsapp" />);
    expect(screen.getByRole('radio', { name: /WhatsApp/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Call/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /DM/ })).toBeInTheDocument();
  });

  it('marks the selected option', () => {
    renderWithIntl(<ContactPreferenceSelector value="phone" />);
    expect(screen.getByRole('radio', { name: /Call/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('fires onChange with the picked preference', () => {
    const onChange = vi.fn();
    renderWithIntl(<ContactPreferenceSelector value="whatsapp" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: /Call/ }));
    expect(onChange).toHaveBeenCalledWith('phone');
  });

  it('renders a single informational pill (no radios) when readOnly', () => {
    renderWithIntl(<ContactPreferenceSelector value="whatsapp" readOnly />);
    // Read mode is informational - the active channel as one static pill, not a
    // row of (disabled) radios (changed 2026-05-20 to avoid a dead-CTA row).
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText(/WhatsApp/)).toBeInTheDocument();
  });
});
