/**
 * Connect feed banner (public shape). Mirrors the backend
 * `BannerService.PublicBanner` payload from `GET /connect/banners`:
 * `imageUrl` is already a signed/public URL, `linkUrl` empty = non-clickable,
 * `alt` is the accessibility text. Consumed by FeedBannerCarousel (rendered in
 * FeedScreen between the composer and the module tabs).
 */
export interface FeedBanner {
  id: string;
  imageUrl: string;
  linkUrl: string;
  alt: string;
  order: number;
}

/**
 * Admin row shape from `GET /admin/connect/banners` (mirrors the backend
 * `BannerService.AdminBanner`): all fields incl. state + ISO window bounds.
 * `imageUrl` is signed for preview. Consumed by the admin banners console.
 */
export interface AdminBanner extends FeedBanner {
  title: string;
  isActive: boolean;
  liveFrom: string | null;
  liveUntil: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Create/update payload for the admin banner form. */
export interface BannerInput {
  imageUrl?: string;
  linkUrl?: string;
  title?: string;
  alt?: string;
  order?: number;
  isActive?: boolean;
  liveFrom?: string | null;
  liveUntil?: string | null;
}
