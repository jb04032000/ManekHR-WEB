import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl, screen, fireEvent } from '@/test-utils/render';
import PhotoLayoutChooser from './PhotoLayoutChooser';

/**
 * Covers the grid vs slideshow picker: it renders both options in a labelled
 * group, marks the selected one with aria-pressed, and reports the picked layout
 * back to the caller.
 */
describe('PhotoLayoutChooser', () => {
  it('renders both layout options inside a labelled group', () => {
    renderWithIntl(<PhotoLayoutChooser value="grid" onChange={() => {}} />);
    expect(screen.getByRole('group', { name: /photo layout/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /grid/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /slideshow/i })).toBeInTheDocument();
  });

  it('marks the selected layout with aria-pressed', () => {
    renderWithIntl(<PhotoLayoutChooser value="grid" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /grid/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /slideshow/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('calls onChange with the picked layout', () => {
    const onChange = vi.fn();
    renderWithIntl(<PhotoLayoutChooser value="grid" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /slideshow/i }));
    expect(onChange).toHaveBeenCalledWith('carousel');
  });

  it('reflects the carousel value as the pressed option', () => {
    renderWithIntl(<PhotoLayoutChooser value="carousel" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /slideshow/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
