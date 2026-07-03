'use client';
import dynamic from 'next/dynamic';

const SetupAdminClient = dynamic(() => import('./SetupAdminClient'), {
  ssr: false,
  loading: () => <div style={{ minHeight: '100vh', background: 'var(--cr-bg)' }} />,
});

export default function SetupAdminWrapper() {
  return <SetupAdminClient />;
}
