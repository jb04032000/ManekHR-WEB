import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App } from 'antd';
import { renderWithIntl, waitFor, fireEvent } from '@/test-utils/render';

// Covers the quick-send path (message + Send -> submitFeedback with page scope +
// context) and the empty-message guard. External deps are mocked.
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/team' }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('@/lib/store', () => ({
  useWorkspaceStore: (sel: (s: { currentWorkspaceId: string | null }) => unknown) =>
    sel({ currentWorkspaceId: 'ws1' }),
}));
vi.mock('@/lib/services/upload.service', () => ({
  uploadService: {
    getFilePreviewUrl: () => 'blob:x',
    uploadSingle: vi.fn(),
    deleteFile: vi.fn(),
    revokePreviewUrl: vi.fn(),
  },
}));
vi.mock('@/lib/services/feedback-capture', () => ({
  captureContentRoot: vi.fn(),
  renderRedactedFile: vi.fn(),
  CAPTURE_ROOT_ID: 'z360-capture-root',
}));

const submitFeedback = vi.fn();
vi.mock('@/lib/actions/feedback.actions', () => ({
  submitFeedback: (...a: unknown[]) => submitFeedback(...a),
}));

import FeedbackPanel from './FeedbackPanel';

function renderPanel(onDone = vi.fn()) {
  return renderWithIntl(
    <App>
      <FeedbackPanel module="team" pageLabel="Team" onDone={onDone} />
    </App>,
  );
}

describe('FeedbackPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends a quick message with page scope + context', async () => {
    submitFeedback.mockResolvedValue({});
    const onDone = vi.fn();
    const { getByPlaceholderText, getByText } = renderPanel(onDone);

    fireEvent.change(getByPlaceholderText("What's working, what's missing, what would help?"), {
      target: { value: 'Great page' },
    });
    fireEvent.click(getByText('Send'));

    await waitFor(() => expect(submitFeedback).toHaveBeenCalledTimes(1));
    const [wsId, payload] = submitFeedback.mock.calls[0];
    expect(wsId).toBe('ws1');
    expect(payload).toMatchObject({
      module: 'team',
      message: 'Great page',
      scope: 'page',
    });
    expect(payload.context.path).toBe('/dashboard/team');
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('blocks sending when the message is empty', async () => {
    const { getByText } = renderPanel();
    fireEvent.click(getByText('Send'));
    // Give any async microtasks a tick; submit must NOT fire.
    await Promise.resolve();
    expect(submitFeedback).not.toHaveBeenCalled();
  });
});
