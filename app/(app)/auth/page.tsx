import type { Metadata } from 'next';
import { Suspense } from 'react';
import AuthClient from './AuthClient';

export const metadata: Metadata = { title: 'Sign In' };

export default function AuthPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--cr-bg)' }} />}>
      <AuthClient />
    </Suspense>
  );
}
