import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React, { useState } from 'react';
import {
  AdvanceWindowControl,
  AdvanceWindowPolicy,
} from '@/app/(app)/dashboard/salary/components/salary/AdvanceWindowControl';

// Provide real label strings so the radio options and spinbutton aria-labels render correctly.
// The component uses t('advanceWindow.*') keys; we supply them here so the test can
// query by role name rather than falling back to key-path strings.
const messages = {
  salarySettings: {
    advanceWindow: {
      anyDay: 'Any day of the month',
      fixedDay: 'A single day',
      window: 'A range of days',
      startDay: 'From day',
      endDay: 'to day',
      to: 'to',
    },
    disbursement: {
      salaryDateSuffix: 'of month',
    },
  },
};
afterEach(cleanup);

// Stateful wrapper so the controlled component re-renders after onChange fires.
function Wrapper({ onChange }: { onChange: (p: AdvanceWindowPolicy) => void }) {
  const [policy, setPolicy] = useState<AdvanceWindowPolicy>({ mode: 'any_day' });
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <AdvanceWindowControl
        value={policy}
        disabled={false}
        onChange={(p) => {
          setPolicy(p);
          onChange(p);
        }}
      />
    </NextIntlClientProvider>
  );
}

describe('AdvanceWindowControl', () => {
  it('emits a window policy when window mode + days are chosen', () => {
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    // Select the "A range of days" radio option (value="window")
    fireEvent.click(screen.getByRole('radio', { name: /range/i }));
    // After mode switch, two spinbuttons for start/end day should appear
    const [start, end] = screen.getAllByRole('spinbutton');
    fireEvent.change(start, { target: { value: '21' } });
    fireEvent.change(end, { target: { value: '23' } });
    fireEvent.blur(end);
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({ mode: 'window', windowStartDay: 21, windowEndDay: 23 });
  });
});
