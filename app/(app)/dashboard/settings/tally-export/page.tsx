/**
 * Phase 16 / FIN-15-01 - Tally Export settings page.
 *
 * Server-component shell. Page header + subhead per UI-SPEC §Tally Export
 * (verbatim copy). The interactive form is the client component
 * `TallyExportForm` (form + validator card + recent-exports list).
 */
import TallyExportForm from './TallyExportForm';

export default function TallyExportPage() {
  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ marginBottom: 48 /* 2xl per UI-SPEC §Spacing */ }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.2,
            margin: 0,
            color: 'var(--cr-text)',
          }}
        >
          Tally Export
        </h1>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 14,
            color: 'var(--cr-text-3)',
            lineHeight: 1.5,
          }}
        >
          Export vouchers and masters as Tally XML. Imports cleanly into Tally ERP 9 and TallyPrime.
        </p>
      </div>

      <TallyExportForm />
    </div>
  );
}
