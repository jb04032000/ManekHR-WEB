import { redirect } from 'next/navigation';

/**
 * `/connect/marketplace/inquiries` is retired. Inquiries are unified into the
 * Inbox (the messaging hub's Inquiries channel): a sent inquiry now seeds an
 * inbox thread, so the seller replies in one place. Kept as a redirect (not
 * deleted) so old links + inquiry notifications land on the Inbox instead of
 * a 404.
 */
export default function ConnectInquiriesRedirect() {
  redirect('/connect/inbox?channel=inquiry');
}
