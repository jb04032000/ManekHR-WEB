import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen, fireEvent } from '@/test-utils/render';

/**
 * M1.6.2 - SendInquiryModal tests.
 *
 * The modal posts an inquiry via the `sendInquiry` action (mocked here so no
 * real HTTP / cookies). It shows a success panel on a sent inquiry and maps
 * each `InquiryErrorCode` to localized copy - the seller-cap case especially,
 * which must read as "this seller is full this month", not a raw error.
 */
const { sendInquiry } = vi.hoisted(() => ({ sendInquiry: vi.fn() }));
vi.mock('./marketplace.actions', () => ({ sendInquiry }));

import SendInquiryModal from './SendInquiryModal';

function renderOpen() {
  renderWithIntl(
    <SendInquiryModal listingId="L1" sellerName="Meera Sharma" open onClose={() => {}} />,
  );
}

beforeEach(() => {
  sendInquiry.mockReset();
});

describe('SendInquiryModal', () => {
  it('renders the message field and the send button when open', () => {
    renderOpen();
    expect(screen.getByText('Contact the seller')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send inquiry' })).toBeInTheDocument();
  });

  it('caps the message at 1000 characters', () => {
    renderOpen();
    expect(screen.getByRole('textbox')).toHaveAttribute('maxlength', '1000');
  });

  it('shows the success state after a sent inquiry', async () => {
    sendInquiry.mockResolvedValueOnce({ ok: true, data: { _id: 'I1' } });
    renderOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }));
    expect(await screen.findByText('Inquiry sent')).toBeInTheDocument();
    expect(sendInquiry).toHaveBeenCalledWith('L1', '');
  });

  it('shows the seller-cap message on a lead-cap error', async () => {
    sendInquiry.mockResolvedValueOnce({
      ok: false,
      code: 'CONNECT_SELLER_LEAD_CAP_REACHED',
      error: 'full',
    });
    renderOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }));
    expect(
      await screen.findByText(
        'This seller has all the inquiries they can take this month. Try again next month, or look at other listings.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the self-inquiry message when contacting your own listing', async () => {
    sendInquiry.mockResolvedValueOnce({
      ok: false,
      code: 'CONNECT_SELF_INQUIRY_NOT_ALLOWED',
      error: 'self',
    });
    renderOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }));
    expect(
      await screen.findByText('This is your own listing, so you cannot send yourself an inquiry.'),
    ).toBeInTheDocument();
  });

  it('shows the rate-limit message when sending too fast', async () => {
    sendInquiry.mockResolvedValueOnce({ ok: false, code: 'RATE_LIMITED', error: 'slow down' });
    renderOpen();
    fireEvent.click(screen.getByRole('button', { name: 'Send inquiry' }));
    expect(
      await screen.findByText(
        'You are sending inquiries too fast. Please wait a minute and try again.',
      ),
    ).toBeInTheDocument();
  });
});
