import { redirect } from 'next/navigation';

/**
 * `/connect/marketplace/mine` is retired. Products belong to a storefront, so
 * they are now managed INSIDE the shop (Storefronts -> a shop -> Products) -
 * there is no standalone flat "my listings" surface. Kept as a redirect (not
 * deleted) so existing bookmarks / links land on the shops hub instead of 404.
 */
export default function ConnectMyListingsRedirect() {
  redirect('/connect/stores');
}
