'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FirmsIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/finance');
  }, [router]);
  return null;
}
