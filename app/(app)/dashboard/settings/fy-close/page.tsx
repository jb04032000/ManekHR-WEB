/**
 * Phase 16 / FIN-15-02 - FY Close settings page.
 *
 * Server-component shell. Page header + subhead per UI-SPEC §FY Close
 * (verbatim copy). The interactive stepper is `FyCloseStepper`.
 */
import FyCloseStepper from './FyCloseStepper';

export default function FyClosePage() {
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
          Financial Year Close
        </h1>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 14,
            color: 'var(--cr-text-3)',
            lineHeight: 1.5,
          }}
        >
          Close the current FY to lock prior-period entries and roll opening balances into the next
          year.
        </p>
      </div>

      <FyCloseStepper />
    </div>
  );
}
