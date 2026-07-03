import type { ReactNode } from 'react';
import PortalFooter from '../PortalFooter';

/**
 * Centered error-card layout shared by all portal error landings.
 * Hero is hidden on error states per UI-SPEC Interaction Contracts; the
 * "Powered by ManekHR" footer credit is still shown on every state.
 */
export default function ErrorCard({ heading, body }: { heading: string; body: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: 'var(--cr-bg)' }}>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div
          className="w-full max-w-md rounded-lg p-8 text-center"
          style={{
            background: 'var(--cr-surface, #fff)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            border: '1px solid var(--cr-border, var(--cr-border))',
          }}
        >
          <h1 className="mb-3 text-xl" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>
            {heading}
          </h1>
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--cr-text-2, var(--cr-text-4))' }}
          >
            {body}
          </p>
        </div>
      </main>
      <PortalFooter />
    </div>
  );
}
