import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import ERPLinkedPanel from './ERPLinkedPanel';

describe('ERPLinkedPanel', () => {
  it('renders the moat panel when linked', () => {
    renderWithIntl(<ERPLinkedPanel linked since={new Date('2024-01-15')} karigarCount={3} />);
    expect(screen.getByText('ERP-LINKED · MOAT SIGNAL')).toBeInTheDocument();
    expect(screen.getByText(/ERP active since Jan 2024/)).toBeInTheDocument();
    expect(screen.getByText(/3 workers on roll/)).toBeInTheDocument();
  });

  it('renders nothing when not linked', () => {
    const { container } = renderWithIntl(<ERPLinkedPanel linked={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
