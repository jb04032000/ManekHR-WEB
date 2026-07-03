import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithIntl, screen, waitFor, act } from '@/test-utils/render';
import VoiceNoteRecorder from './VoiceNoteRecorder';

// The recorder uploads on stop; stub the service so the cap test never hits the
// network (we only care that it STOPS at the policy cap, not what it uploads).
vi.mock('@/lib/services/upload.service', () => ({
  uploadService: {
    uploadSingle: vi.fn().mockResolvedValue({ url: 'https://cdn.test/connect-audio/clip.webm' }),
  },
}));

describe('VoiceNoteRecorder', () => {
  it('renders the idle recorder', () => {
    renderWithIntl(<VoiceNoteRecorder onRecorded={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByRole('button', { name: /start recording/i })).toBeInTheDocument();
  });

  it('shows an error when the microphone is unavailable', async () => {
    // jsdom has no `navigator.mediaDevices` - recording must fail gracefully.
    renderWithIntl(<VoiceNoteRecorder onRecorded={vi.fn()} onClear={vi.fn()} />);
    screen.getByRole('button', { name: /start recording/i }).click();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  // ── Auto-stop at the policy cap (180s for connect-audio), NOT the old 600 ──
  describe('stops recording at the policy cap', () => {
    let stopSpy: ReturnType<typeof vi.fn<() => void>>;

    /** Fake MediaRecorder that records start/stop and fires `onstop` on stop. */
    class FakeMediaRecorder {
      state: 'inactive' | 'recording' = 'inactive';
      ondataavailable: ((e: { data: { size: number } }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        stopSpy();
        this.onstop?.();
      }
    }

    beforeEach(() => {
      vi.useFakeTimers();
      stopSpy = vi.fn<() => void>();
      vi.stubGlobal('MediaRecorder', FakeMediaRecorder as unknown as typeof MediaRecorder);
      // Mic access + object-URL plumbing the component touches on start/stop.
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: () => undefined }] }),
        },
      });
      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn(() => 'blob:fake'),
        revokeObjectURL: vi.fn(),
      });
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
      // Remove the mediaDevices stub so the "mic unavailable" test still holds.
      delete (navigator as { mediaDevices?: unknown }).mediaDevices;
    });

    it('does not stop before 180s but stops by 181s (cap is 180, not 600)', async () => {
      renderWithIntl(<VoiceNoteRecorder onRecorded={vi.fn()} onClear={vi.fn()} />);

      await act(async () => {
        screen.getByRole('button', { name: /start recording/i }).click();
        await vi.advanceTimersByTimeAsync(0); // let getUserMedia resolve + interval arm
      });

      // Just under the 180s cap - must still be recording.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(179_000);
      });
      expect(stopSpy).not.toHaveBeenCalled();

      // Cross the cap - must auto-stop. (At 600 it would keep going.)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });
      expect(stopSpy).toHaveBeenCalled();
    });
  });
});
