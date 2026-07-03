import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithIntl, screen, fireEvent, waitFor } from '@/test-utils/render';
import type { ConnectProfile } from '../profile.types';

/**
 * Intro-video edit flow for the Connect profile (the `videos` section of
 * EditSectionModal). Mirrors the marketplace ListingForm.test.tsx video test:
 * the MediaUploadGrid is STUBBED with a video-mode button that fires BOTH the
 * upload (onChange) and the captured poster (onPosters), so the modal's
 * video-build path is exercised end to end and we can assert the PATCH payload
 * carries `videos: [{ url, posterUrl }]`.
 */

// The grid stub: a single button that, on click, simulates a clip upload + a
// captured poster frame (the same shape MediaUploadGrid emits in video mode).
vi.mock('@/components/connect/MediaUploadGrid', () => ({
  default: ({
    mediaKind = 'image',
    onChange,
    onPosters,
  }: {
    mediaKind?: 'image' | 'video' | 'document';
    onChange: (urls: string[]) => void;
    onPosters?: (map: Record<string, string>) => void;
  }) =>
    mediaKind === 'video' ? (
      <button
        type="button"
        onClick={() => {
          onChange(['https://cdn/clip.mp4']);
          onPosters?.({ 'https://cdn/clip.mp4': 'https://cdn/poster.jpg' });
        }}
      >
        mock-video-upload
      </button>
    ) : (
      <button type="button" onClick={() => onChange(['https://cdn/img.jpg'])}>
        mock-image-upload
      </button>
    ),
}));

// The modal saves through `updateMyConnectProfile`; capture the parsed payload.
const updateMyConnectProfile = vi.fn(async (payload: unknown) => ({
  ok: true as const,
  data: { ...(payload as object) } as ConnectProfile,
}));
vi.mock('../profile.actions', () => ({
  updateMyConnectProfile: (payload: unknown) => updateMyConnectProfile(payload),
  searchCompanyPages: vi.fn(async () => ({ ok: true, data: [] })),
}));

// The header section also touches the User avatar; not exercised here, but the
// module imports it, so stub it.
vi.mock('@/lib/actions', () => ({
  updateProfile: vi.fn(async () => ({})),
}));

// useAuthStore is a zustand selector hook AND carries store statics
// (getState / subscribe) that lib/api/client.ts touches at import time. Stub
// both the hook call and the statics so the whole import graph stays happy.
vi.mock('@/lib/store', () => {
  const state = { user: { profilePicture: '' }, updateUser: vi.fn(), isAppLocked: false };
  const useAuthStore = ((selector: (s: unknown) => unknown) => selector(state)) as unknown as {
    (selector: (s: unknown) => unknown): unknown;
    getState: () => typeof state;
    subscribe: () => () => void;
  };
  useAuthStore.getState = () => state;
  useAuthStore.subscribe = () => () => {};
  return { useAuthStore };
});

import EditSectionModal from './EditSectionModal';

function makeProfile(over: Partial<ConnectProfile> = {}): ConnectProfile {
  return {
    userId: 'u1',
    headline: 'Master zari karigar',
    bio: 'Bio',
    banner: '',
    skills: [],
    portfolio: [],
    experience: [],
    training: [],
    services: [],
    recommendations: [],
    openTo: { work: false, hiring: false, deals: false, customOrders: false },
    openToDetails: {},
    visibility: 'public',
    contactPreference: 'whatsapp',
    strength: 50,
    ...over,
  };
}

describe('EditSectionModal - intro video', () => {
  beforeEach(() => {
    updateMyConnectProfile.mockClear();
  });

  it('captures an uploaded clip + poster and saves videos:[{url,posterUrl}]', async () => {
    renderWithIntl(
      <EditSectionModal
        open
        section="videos"
        profile={makeProfile()}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Upload a clip (the stub fires onChange + onPosters together).
    fireEvent.click(screen.getByRole('button', { name: 'mock-video-upload' }));
    // Save the section.
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateMyConnectProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          videos: [{ url: 'https://cdn/clip.mp4', posterUrl: 'https://cdn/poster.jpg' }],
        }),
      ),
    );
  });

  it('preserves an existing clip and its stored poster on an unchanged save', async () => {
    renderWithIntl(
      <EditSectionModal
        open
        section="videos"
        profile={makeProfile({
          videos: [{ url: 'https://cdn/old.mp4', posterUrl: 'https://cdn/old-poster.jpg' }],
        })}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Save without touching the grid - the existing clip + poster ride through.
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(updateMyConnectProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          videos: [{ url: 'https://cdn/old.mp4', posterUrl: 'https://cdn/old-poster.jpg' }],
        }),
      ),
    );
  });
});
