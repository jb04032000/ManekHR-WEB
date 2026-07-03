'use client';

/**
 * VoiceNoteRecorder - record a voice note for a feed post (Phase 3 - Feed, F8).
 *
 * The low-literacy posting path (design doc §7): record with the `MediaRecorder`
 * API, see a live timer + level animation, then play the result back. On stop
 * the clip uploads to the `connect-audio` bucket and `onRecorded` hands the
 * composer the URL + duration. Auto-transcription is a separate, provider-gated
 * step (build-plan PAID item 3) - the audio always posts without it.
 *
 * JIT shared component (Phase 3). Rendered in isolation on `/design-system`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { uploadService } from '@/lib/services/upload.service';
import { getUploadPolicy, type UploadCategory } from '@/lib/upload-policies.helpers';

interface VoiceNoteRecorderProps {
  /** Called once the recording has uploaded - gives the composer the clip. */
  onRecorded: (audio: { url: string; durationSec: number }) => void;
  /** Called when the recording is cleared, back to the idle state. */
  onClear: () => void;
  /**
   * Upload bucket for the clip. Defaults to `connect-audio` (the feed voice
   * post). The inbox reuses this recorder with `connect-inbox-media` so chat
   * voice notes land in the messaging bucket.
   */
  category?: UploadCategory;
}

/**
 * The recording cap comes from the FE upload-policy mirror, NOT a hardcoded
 * number, so it can never drift from the server limit (`connect-audio` /
 * `connect-inbox-media` both cap at 180s). The server is the real gate -- it
 * re-derives the duration from the buffer and rejects anything over -- but
 * stopping at the cap here means the user can't waste a long recording that
 * would only be bounced on upload. Falls back to 600 only if a category somehow
 * carries no duration policy.
 */
const FALLBACK_MAX_SECONDS = 600;

/** Show the remaining-time countdown once the recording is this close to the cap. */
const COUNTDOWN_THRESHOLD_SEC = 30;

type RecorderStatus = 'idle' | 'recording' | 'uploading' | 'recorded' | 'error';

/** Seconds → `m:ss`. */
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function VoiceNoteRecorder({
  onRecorded,
  onClear,
  category = 'connect-audio',
}: VoiceNoteRecorderProps) {
  const t = useTranslations('connect.feed.voice');

  // Recording cap read from the policy for the bucket in use (keeps FE in step
  // with the server's `connect-audio` / `connect-inbox-media` 180s limit).
  const maxSeconds = getUploadPolicy(category).duration?.max ?? FALLBACK_MAX_SECONDS;

  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Stop the timer + release the mic - safe to call repeatedly. */
  const releaseHardware = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Tear everything down on unmount.
  useEffect(() => {
    return () => {
      releaseHardware();
      setPlaybackUrl((url) => {
        if (url) URL.revokeObjectURL(url);
        return null;
      });
    };
  }, [releaseHardware]);

  const handleStop = useCallback(async () => {
    releaseHardware();
    // Client-claimed duration - sent as a harmless hint; the server overrides it
    // with the duration it parses from the uploaded buffer.
    const durationSec = Math.min(
      maxSeconds,
      Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
    );
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    setPlaybackUrl(URL.createObjectURL(blob));
    setStatus('uploading');
    try {
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
      const res = await uploadService.uploadSingle(file, { category });
      setStatus('recorded');
      onRecorded({ url: res.url, durationSec });
    } catch {
      setStatus('error');
    }
  }, [releaseHardware, onRecorded, category, maxSeconds]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => void handleStop();
      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsed(0);
      setStatus('recording');
      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(secs);
        if (secs >= maxSeconds) stop();
      }, 250);
    } catch {
      setStatus('error');
    }
  }, [handleStop, stop, maxSeconds]);

  const recordAgain = useCallback(() => {
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    setPlaybackUrl(null);
    setElapsed(0);
    setStatus('idle');
    onClear();
  }, [playbackUrl, onClear]);

  return (
    <div
      style={{
        padding: 'var(--cr-space-lg)',
        background: 'var(--cr-surface-2)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        textAlign: 'center',
      }}
    >
      {status === 'error' ? (
        <div role="alert">
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--cr-error)' }}>
            {t('micError')}
          </p>
          <button type="button" onClick={() => void start()} style={pillBtn}>
            {t('tryAgain')}
          </button>
        </div>
      ) : status === 'recorded' && playbackUrl ? (
        <div>
          <audio
            controls
            src={playbackUrl}
            style={{ width: '100%' }}
            aria-label={t('playbackLabel', { duration: formatDuration(elapsed) })}
          />
          <button
            type="button"
            onClick={recordAgain}
            className="inline-flex items-center gap-1.5"
            style={{ ...pillBtn, marginTop: 12 }}
          >
            <RotateCcw size={14} aria-hidden />
            {t('recordAgain')}
          </button>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={status === 'recording' ? stop : () => void start()}
            disabled={status === 'uploading'}
            aria-label={status === 'recording' ? t('stop') : t('record')}
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              border: 'none',
              cursor: status === 'uploading' ? 'default' : 'pointer',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto',
              color: '#fff',
              background: status === 'recording' ? 'var(--cr-error)' : 'var(--cr-primary)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            }}
          >
            {status === 'recording' ? (
              <Square size={26} aria-hidden fill="currentColor" />
            ) : (
              <Mic size={28} aria-hidden />
            )}
          </button>

          <div
            style={{
              marginTop: 14,
              fontFamily: 'monospace',
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--cr-text)',
            }}
          >
            {formatDuration(elapsed)}
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--cr-text-4)' }}>
            {status === 'recording'
              ? t('recordingHint')
              : status === 'uploading'
                ? t('uploading')
                : t('idleHint')}
          </div>

          {/* Remaining-time countdown - surfaces in the final stretch so the
              user knows the recording is about to hit the policy cap. */}
          {status === 'recording' &&
            maxSeconds - elapsed <= COUNTDOWN_THRESHOLD_SEC &&
            (() => {
              const remaining = Math.max(0, maxSeconds - elapsed);
              return (
                <div
                  role="status"
                  aria-live="polite"
                  style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: 'var(--cr-error)' }}
                >
                  {t('timeLeft', { seconds: remaining })}
                </div>
              );
            })()}

          {/* Level animation while recording. */}
          {status === 'recording' && (
            <div
              aria-hidden
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 3,
                height: 28,
                marginTop: 12,
              }}
            >
              {Array.from({ length: 13 }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 3,
                    height: 8 + ((i * 7 + elapsed * 5) % 20),
                    borderRadius: 2,
                    background: 'var(--cr-error)',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const pillBtn: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 'var(--cr-radius-full)',
  border: '1px solid var(--cr-border)',
  background: 'var(--cr-surface)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--cr-text-2)',
};
