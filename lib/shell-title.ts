import { create } from 'zustand';

interface ShellTitleState {
  /** Per-page override for the top-bar title; null = use the route-derived title. */
  title: string | null;
  setTitle: (title: string | null) => void;
}

/**
 * Lets a page override the shell top-bar title for a route the static
 * breadcrumb map cannot name - e.g. a storefront manage page that should show
 * the shop's name instead of the generic "Storefronts". A page sets it in an
 * effect and clears it (null) on unmount; TopHeader prefers it over the
 * route-derived title when present.
 */
export const useShellTitle = create<ShellTitleState>((set) => ({
  title: null,
  setTitle: (title) => set({ title }),
}));
