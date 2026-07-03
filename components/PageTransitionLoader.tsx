'use client';
import { useTransition } from 'react';
import { ManekHRStitchLoader } from '@/components/ui/ManekHRStitchLoader';

export default function PageTransitionLoader() {
  const [isPending] = useTransition();

  if (!isPending) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-[9999] pointer-events-none">
      <div className="text-center">
        <ManekHRStitchLoader size={120} />
        <p className="mt-3 text-[13px] text-muted">Loading page…</p>
      </div>
    </div>
  );
}
