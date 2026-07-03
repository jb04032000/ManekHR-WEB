import { ApiConfig } from './config';

/**
 * Real-time permission propagation (2026-05-22).
 *
 * Opens an SSE stream to `GET /workspaces/:wsId/me/permission-events` and calls
 * `onChange()` whenever the backend pushes a `permission-change` event (an
 * admin edited the caller's role/overrides). The caller refetches
 * `/me/permissions` immediately, so the UI reflects the change within ~one
 * round-trip with no manual reload and no wait for the 60s notification poll.
 *
 * Why fetch + ReadableStream instead of the native `EventSource`: `EventSource`
 * cannot send an `Authorization` header, and the API authenticates via a Bearer
 * token (not a cookie). The streaming `fetch` reader gives us full header
 * control while preserving SSE framing.
 *
 * Resilient by design: auto-reconnects with capped exponential backoff, and is
 * a pure enhancement: if the stream never connects, the focus-revalidate and
 * notification-poll paths still propagate the change (just slower). Returns a
 * disposer that closes the stream and cancels any pending reconnect.
 */
export function openPermissionStream(workspaceId: string, onChange: () => void): () => void {
  let closed = false;
  let controller: AbortController | null = null;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleReconnect = () => {
    if (closed) return;
    attempt = Math.min(attempt + 1, 6);
    const delay = Math.min(1000 * 2 ** attempt, 30_000);
    reconnectTimer = setTimeout(() => void connect(), delay);
  };

  const connect = async (): Promise<void> => {
    if (closed || typeof window === 'undefined') return;
    const token = window.localStorage.getItem(ApiConfig.token.storageKey);
    if (!token) {
      // Not authenticated yet (cold load / mid-refresh); retry shortly.
      scheduleReconnect();
      return;
    }
    controller = new AbortController();
    try {
      const res = await fetch(
        `${ApiConfig.baseURL}/workspaces/${workspaceId}/me/permission-events`,
        {
          method: 'GET',
          headers: {
            [ApiConfig.token.headerKey]: `${ApiConfig.token.prefix} ${token}`,
            'x-platform': 'web',
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        },
      );
      if (!res.ok || !res.body) {
        scheduleReconnect();
        return;
      }
      attempt = 0; // healthy connection, reset backoff
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done || closed) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line. Keep the trailing partial.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          if (/(^|\n)event:\s*permission-change\b/.test(frame)) {
            onChange();
          }
          // `ping` heartbeat frames are ignored; they exist only to keep the
          // connection alive through idle-timeout proxies.
        }
      }
    } catch {
      // Aborted by the disposer, or a network/stream error; both fall through
      // to a reconnect attempt (unless we were disposed).
    } finally {
      if (!closed) scheduleReconnect();
    }
  };

  void connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    controller?.abort();
  };
}
