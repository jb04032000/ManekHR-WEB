import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

/** Allow public marketing pages; keep authenticated app surfaces out of the index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/dashboard',
        '/auth',
        '/api',
        '/portal',
        '/kiosk',
        '/setup-admin',
        '/invite',
        '/account',
        // The AUTHENTICATED Connect app + its in-app entity mirrors. The public,
        // indexable surfaces live at the root (/u, /company, /store, /p,
        // /products, /jobs). The trailing slash keeps the PUBLIC marketing
        // landing `/connect` (exact) crawlable while excluding `/connect/*`.
        '/connect/',
      ],
    },
    sitemap: `${env.appUrl}/sitemap.xml`,
  };
}
