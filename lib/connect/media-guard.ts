import type { SyntheticEvent } from 'react';

/**
 * Shared "discourage download" props for member-uploaded media across Connect.
 *
 * What: strips the easy download affordances off user media -> hides the native
 *   HTML5 controls download button (`controlsList="nodownload"`) + Picture-in-
 *   Picture, and blocks the right-click "Save video/image as" menu and drag-to-
 *   save. Spread these onto the <video>/<audio>/<img> that render member media.
 * Cross-module: applied in feed (PostCard, PhotoCarousel), chat (inbox
 *   MessageBubble), and the profile / company / marketplace / job video players.
 *   One source of truth so every surface behaves identically - keep the three
 *   variants here in sync rather than re-inlining the attributes. The public
 *   permalink renderer (PublicPostView) is a Server Component and cannot carry
 *   event handlers, so it mirrors the ATTRIBUTE-only half of these inline.
 * Watch: this is NOT real protection. The bytes are still fetchable from the
 *   network tab / direct URL; it only removes the obvious UI affordances. Real
 *   lock-down needs signed short-lived URLs / tokenized streaming (backend).
 *   Do NOT apply to <a download> document links or the composer's own upload
 *   previews - those downloads are intentional.
 *
 * Each object is typed with `as const` and deliberately minimal (only the guard
 * keys). Spreading a broad `Partial<ImgHTMLAttributes>` would reintroduce an
 * optional `src?`/`alt?` that collides with AntD `<Image>`'s stricter props, so
 * we keep the surface to exactly the keys we set.
 */

// Single handler instance reused across all media so we do not allocate a new
// closure per render. Typed with the SyntheticEvent supertype so it stays
// assignable to <video>/<audio>/<img> AND AntD's onContextMenu handler slots.
const blockContextMenu = (e: SyntheticEvent) => e.preventDefault();

export const noDownloadVideoProps = {
  controlsList: 'nodownload',
  disablePictureInPicture: true,
  onContextMenu: blockContextMenu,
} as const;

export const noDownloadAudioProps = {
  controlsList: 'nodownload',
  onContextMenu: blockContextMenu,
} as const;

export const noDownloadImageProps = {
  draggable: false,
  onContextMenu: blockContextMenu,
} as const;
