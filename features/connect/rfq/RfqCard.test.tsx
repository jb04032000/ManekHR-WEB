import { describe, it, expect } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import RfqCard from './RfqCard';
import QuoteCard from './QuoteCard';
import type { Rfq, Quote } from './rfq.types';

const RFQ: Rfq = {
  _id: 'rfq-1',
  buyerUserId: 'u-buyer',
  title: 'Need 500 m gold zari thread',
  description: 'Pure zari, wholesale.',
  category: 'raw-material',
  quantity: 500,
  unit: 'per-meter',
  budgetMin: 20000,
  budgetMax: 30000,
  neededBy: null,
  location: { district: 'Surat', city: '', state: 'Gujarat' },
  status: 'open',
  quotesCount: 3,
};

const QUOTE: Quote = {
  _id: 'q-1',
  rfqId: 'rfq-1',
  sellerUserId: 'u-seller',
  storefrontId: null,
  price: 24500,
  leadTimeDays: 7,
  message: 'Includes delivery to Surat.',
  status: 'sent',
};

describe('RfqCard', () => {
  it('renders the request title, status, budget and quote count', () => {
    renderWithIntl(<RfqCard rfq={RFQ} />);
    expect(screen.getByText('Need 500 m gold zari thread')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText(/20,000/)).toBeInTheDocument();
    expect(screen.getByText('3 quotes')).toBeInTheDocument();
  });

  it('shows a closing-soon flag when the deadline is near', () => {
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
    renderWithIntl(<RfqCard rfq={{ ...RFQ, neededBy: soon }} />);
    expect(screen.getByText('Closing soon')).toBeInTheDocument();
  });

  it('links to the request detail (title link + Send quote action)', () => {
    renderWithIntl(<RfqCard rfq={RFQ} />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const link of links) expect(link).toHaveAttribute('href', '/connect/rfq/rfq-1');
    expect(screen.getByText('Send quote')).toBeInTheDocument();
  });

  it('shows Negotiable when the buyer set no budget, plus the lowest live quote', () => {
    renderWithIntl(
      <RfqCard rfq={{ ...RFQ, budgetMin: null, budgetMax: null, lowestQuotePrice: 19500 }} />,
    );
    expect(screen.getByText('Negotiable')).toBeInTheDocument();
    expect(screen.getByText(/19,500/)).toBeInTheDocument();
  });

  it('flags a request matching the viewer supply categories and flips to Update quote when quoted', () => {
    renderWithIntl(
      <RfqCard rfq={RFQ} supplyCategories={['raw-material']} alreadyQuoted viewerId="u-someone" />,
    );
    expect(screen.getByText('Matches your work')).toBeInTheDocument();
    expect(screen.getByText('Update quote')).toBeInTheDocument();
  });

  it('swaps Send quote for View quotes on the viewer own request', () => {
    renderWithIntl(<RfqCard rfq={RFQ} viewerId="u-buyer" />);
    expect(screen.queryByText('Send quote')).not.toBeInTheDocument();
    expect(screen.getByText('View quotes')).toBeInTheDocument();
  });
});

describe('QuoteCard', () => {
  it('renders the price, lead time, message and status', () => {
    renderWithIntl(<QuoteCard quote={QUOTE} />);
    expect(screen.getByText('₹24,500')).toBeInTheDocument();
    expect(screen.getByText('Ready in 7 days')).toBeInTheDocument();
    expect(screen.getByText('Includes delivery to Surat.')).toBeInTheDocument();
    expect(screen.getByText('Sent')).toBeInTheDocument();
  });

  it('renders the structured offer: rate breakdown, includes and validity', () => {
    renderWithIntl(
      <QuoteCard
        quote={{
          ...QUOTE,
          rate: 56,
          rateQuantity: 400,
          price: 22400,
          includes: ['approval-sample', 'custom-finishing'],
          validityDays: 7,
          updatedAt: new Date().toISOString(),
        }}
      />,
    );
    expect(screen.getByText('₹22,400')).toBeInTheDocument();
    expect(screen.getByText('₹56 x 400')).toBeInTheDocument();
    expect(screen.getByText('Approval sample before bulk')).toBeInTheDocument();
    // Unknown include strings render humanized, never break.
    expect(screen.getByText('Custom finishing')).toBeInTheDocument();
    expect(screen.getByText(/Valid till/)).toBeInTheDocument();
  });
});
