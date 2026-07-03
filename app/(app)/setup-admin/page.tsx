import type { Metadata } from 'next';
import SetupAdminWrapper from './SetupAdminWrapper';

export const metadata: Metadata = {
  title: 'Admin Setup',
  description:
    'One-time bootstrap to grant admin privileges to a registered ManekHR account using your backend ADMIN_SETUP_SECRET.',
};

export default function SetupAdminPage() {
  return <SetupAdminWrapper />;
}
