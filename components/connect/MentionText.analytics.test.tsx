import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Isolated so the trackEvent spy does not leak into MentionText.test.tsx.
vi.mock('@/lib/analytics-events', () => ({
  trackEvent: vi.fn(),
  ConnectEvents: { mentionClicked: 'connect.mentions.clicked' },
}));
import { trackEvent, ConnectEvents } from '@/lib/analytics-events';
import MentionText from './MentionText';

describe('MentionText analytics', () => {
  it('fires mentionClicked with the entity type when a tag chip is followed', () => {
    render(
      <MentionText
        text="see @Acme"
        mentions={[
          { type: 'company', refId: 'c1', display: 'Acme', href: '/connect/company/acme' },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('link', { name: '@Acme' }));
    expect(trackEvent).toHaveBeenCalledWith(ConnectEvents.mentionClicked, { entity: 'company' });
  });
});
