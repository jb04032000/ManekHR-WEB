import type { Metadata } from 'next';
import PlatformRestrictedClient from './PlatformRestrictedClient';

export const metadata: Metadata = {
  title: 'Platform Restricted - Upgrade to Continue · ManekHR',
  description:
    'Your current ManekHR subscription does not include access on this platform. Review upgrade options or continue on a supported device.',
  robots: { index: false, follow: false },
};

export default function PlatformRestrictedPage() {
  return <PlatformRestrictedClient />;
}
