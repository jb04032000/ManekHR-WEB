'use client';
import { useEffect } from 'react';

function getErrorMessage(error: Error & { digest?: string }): string {
  const msg = error.message as unknown;
  if (typeof msg === 'string') return msg;
  if (msg && typeof msg === 'object') {
    const obj = msg as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
  }
  return 'An unexpected error occurred.';
}

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-page">
      <div className="text-center px-lg">
        <div className="text-[64px] mb-md">⚠️</div>
        <h2 className="font-display font-bold text-2xl text-heading mb-3">Something went wrong</h2>
        <p className="text-sm text-muted mb-lg">{getErrorMessage(error)}</p>
        <button onClick={reset} className="bg-primary text-surface border-none px-[28px] py-3 rounded-lg font-semibold text-sm cursor-pointer">
          Try again
        </button>
      </div>
    </div>
  );
}
