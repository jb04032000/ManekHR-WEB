'use client';

/**
 * useConnectSocket - the Connect feed realtime client (Phase 3 - Feed, F9).
 *
 * One shared Socket.IO connection for the session. Authentication uses a
 * short-lived **socket ticket** (`getSocketTicket`) re-fetched on every
 * (re)connect, so the httpOnly access token never reaches this code. If the
 * gateway is unreachable the socket retries quietly in the background and the
 * feed simply runs without live updates - nothing is surfaced to the user.
 *
 * Event names mirror the backend `connect/feed/feed-realtime.ts`.
 */

import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { env } from '@/lib/env';
import { getSocketTicket } from '../feed.actions';

/** Server → client events. */
const FEED_EVENTS = { newPost: 'feed:new-post', postActivity: 'post:activity' } as const;
/** Client → server events. */
const FEED_CLIENT_EVENTS = { watchPost: 'post:watch', unwatchPost: 'post:unwatch' } as const;

/** `feed:new-post` payload. */
export interface NewPostEvent {
  postId: string;
  authorId: string;
}

/** `post:activity` payload - a post's live counts. */
export interface PostActivityEvent {
  postId: string;
  reactionCount: number;
  commentCount: number;
}

/** The backend Socket.IO origin - `backendApiUrl` minus its `/api` prefix. */
const SOCKET_URL = `${env.backendApiUrl.replace(/\/api\/?$/, '')}/connect`;

let socket: Socket | null = null;

/**
 * The shared Connect socket, created lazily. `auth` is a function so a fresh
 * ticket is fetched on every connect attempt - expiry needs no special
 * handling.
 */
function getConnectSocket(): Socket {
  if (socket) return socket;
  socket = io(SOCKET_URL, {
    withCredentials: true,
    auth: (cb) => {
      void getSocketTicket().then((res) => cb({ ticket: res.ok ? res.data.ticket : '' }));
    },
  });
  return socket;
}

/**
 * Subscribe to new posts from followed authors. `onNewPost` MUST be stable
 * (wrap it in `useCallback`).
 */
export function useFeedRealtime(onNewPost: (event: NewPostEvent) => void): void {
  useEffect(() => {
    const s = getConnectSocket();
    s.on(FEED_EVENTS.newPost, onNewPost);
    return () => {
      s.off(FEED_EVENTS.newPost, onNewPost);
    };
  }, [onNewPost]);
}

/**
 * Watch one post for live reaction / comment counts. `onActivity` MUST be
 * stable (wrap it in `useCallback`).
 */
export function usePostRealtime(
  postId: string,
  onActivity: (event: PostActivityEvent) => void,
): void {
  useEffect(() => {
    const s = getConnectSocket();
    const handler = (event: PostActivityEvent) => {
      if (event.postId === postId) onActivity(event);
    };
    s.on(FEED_EVENTS.postActivity, handler);
    s.emit(FEED_CLIENT_EVENTS.watchPost, postId);
    return () => {
      s.emit(FEED_CLIENT_EVENTS.unwatchPost, postId);
      s.off(FEED_EVENTS.postActivity, handler);
    };
  }, [postId, onActivity]);
}
