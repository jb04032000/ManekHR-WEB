import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import TrustBadgeRow from './TrustBadgeRow';

describe('TrustBadgeRow', () => {
  it('renders nothing when there are no badges', () => {
    const { container } = renderWithIntl(<TrustBadgeRow badges={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an earned badge with its label', () => {
    renderWithIntl(<TrustBadgeRow badges={['erp']} />);
    expect(screen.getByText('ERP-linked')).toBeInTheDocument();
  });

  it('renders the Verified seller badge (M2.3)', () => {
    renderWithIntl(<TrustBadgeRow badges={['verified']} />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('orders the Verified badge right after ERP-linked', () => {
    renderWithIntl(<TrustBadgeRow badges={['gst', 'verified', 'erp']} max={Infinity} />);
    const labels = screen.getAllByText(/ERP-linked|Verified|GST verified/);
    expect(labels[0]).toHaveTextContent('ERP-linked');
    expect(labels[1]).toHaveTextContent('Verified');
  });

  it('orders badges by tier - ERP-linked first', () => {
    renderWithIntl(<TrustBadgeRow badges={['gst', 'erp']} max={Infinity} />);
    const labels = screen.getAllByText(/ERP-linked|GST verified/);
    expect(labels[0]).toHaveTextContent('ERP-linked');
  });

  it('renders the Broker badge when earned (Slice 1)', () => {
    renderWithIntl(<TrustBadgeRow badges={['broker']} />);
    expect(screen.getByText('Broker')).toBeInTheDocument();
  });

  it('orders the Broker badge after Verified, before the statutory badges', () => {
    renderWithIntl(<TrustBadgeRow badges={['gst', 'broker', 'verified']} max={Infinity} />);
    const labels = screen.getAllByText(/Verified|Broker|GST verified/);
    expect(labels[0]).toHaveTextContent('Verified');
    expect(labels[1]).toHaveTextContent('Broker');
    expect(labels[2]).toHaveTextContent('GST verified');
  });

  it('caps at `max` and shows a "+N more" pill', () => {
    renderWithIntl(<TrustBadgeRow badges={['erp', 'gst', 'udyam', 'mobile', 'email']} max={3} />);
    // 3 shown + overflow of 2
    expect(screen.getByText('+2 more')).toBeInTheDocument();
    expect(screen.queryByText('Mobile verified')).not.toBeInTheDocument();
  });

  it('shows every badge with no overflow when max is Infinity', () => {
    renderWithIntl(
      <TrustBadgeRow badges={['erp', 'gst', 'udyam', 'mobile', 'email']} max={Infinity} />,
    );
    expect(screen.getByText('Email verified')).toBeInTheDocument();
    expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
  });
});
