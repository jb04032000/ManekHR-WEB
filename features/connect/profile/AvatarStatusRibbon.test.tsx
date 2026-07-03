import { it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import AvatarStatusRibbon from './AvatarStatusRibbon';

const messages = {
  connect: {
    profile: {
      intents: {
        ribbon: {
          hiring: 'HIRING',
          work: 'OPEN TO WORK',
          deals: 'OPEN TO DEALS',
          customOrders: 'TAKING ORDERS',
        },
      },
    },
  },
};
const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );

it('shows the highest-priority active intent (hiring outranks work)', () => {
  wrap(
    <AvatarStatusRibbon openTo={{ work: true, hiring: true, deals: false, customOrders: false }} />,
  );
  expect(screen.getByText('HIRING')).toBeInTheDocument();
  expect(screen.queryByText('OPEN TO WORK')).not.toBeInTheDocument();
});
it('falls back to work when hiring is off', () => {
  wrap(
    <AvatarStatusRibbon
      openTo={{ work: true, hiring: false, deals: false, customOrders: false }}
    />,
  );
  expect(screen.getByText('OPEN TO WORK')).toBeInTheDocument();
});
it('ignores the paused deals and customOrders intents', () => {
  // PAUSED 2026-06-09 - Connect open-to options: these no longer drive the ribbon.
  const { container } = wrap(
    <AvatarStatusRibbon openTo={{ work: false, hiring: false, deals: true, customOrders: true }} />,
  );
  expect(container).toBeEmptyDOMElement();
});
it('renders nothing when no intent is active', () => {
  const { container } = wrap(
    <AvatarStatusRibbon
      openTo={{ work: false, hiring: false, deals: false, customOrders: false }}
    />,
  );
  expect(container).toBeEmptyDOMElement();
});
