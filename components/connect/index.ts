/**
 * ManekHR Connect - shared component library.
 *
 * Components are built just-in-time per phase (see
 * docs/connect/connect-build-plan.md → "Shared component inventory"). Every
 * component exported here is also rendered in isolation on the /design-system
 * route. Compose `components/ui/Ds*` primitives - never duplicate them.
 */

// ── Phase 0 - shell ─────────────────────────────────────────────────
export { default as ConnectModuleNav } from './ConnectModuleNav';
export { default as ConnectMobileTabBar } from './ConnectMobileTabBar';
export { default as ConnectSearchBar } from './ConnectSearchBar';

// ── Phase 0 - cross-cutting primitives ──────────────────────────────
export { default as ConnectPage } from './ConnectPage';
export type { ConnectPageProps } from './ConnectPage';
export { default as TrustBadgeRow } from './TrustBadgeRow';
export type { TrustBadgeKind } from './TrustBadgeRow';
export { default as WhatsAppCTA, buildWhatsAppHref } from './WhatsAppCTA';
export { default as WhatsAppIcon } from './WhatsAppIcon';
export { default as ConnectEmptyState } from './ConnectEmptyState';
export { default as ConnectErrorBoundary } from './ConnectErrorBoundary';
export { default as useAnnouncer } from './useAnnouncer';
export type { Announcer } from './useAnnouncer';
export { default as GlobalAnnouncer, announceGlobal } from './globalAnnouncer';
export { default as Rail } from './Rail';
export type { RailProps, RailSide, RailBreakpoint } from './Rail';
export { default as ConnectRightRail } from './ConnectRightRail';
export { default as RailPanel } from './RailPanel';
export type { RailPanelProps } from './RailPanel';
export { default as MiniProfileCard } from './MiniProfileCard';
export type { MiniProfileCardProps } from './MiniProfileCard';
export { default as RailFooter } from './RailFooter';

// ── Phase 2 - network components ────────────────────────────────────
export { default as ModuleTabs } from './ModuleTabs';
export type { ModuleTab } from './ModuleTabs';

// ── Phase 1 - identity components ───────────────────────────────────
export { default as PersonCard } from './PersonCard';
export type { ConnectPerson } from './PersonCard';
export { default as ListingCard } from './ListingCard';
export { default as ListingGridCard } from './ListingGridCard';
export { default as CompanyCard } from './CompanyCard';
export { default as ProfileSection } from './ProfileSection';
export { default as PrivacyBadge } from './PrivacyBadge';
export { default as ProfileStrengthCard } from './ProfileStrengthCard';
export type { StrengthItem } from './ProfileStrengthCard';
export { default as ERPLinkedPanel } from './ERPLinkedPanel';
export { default as ERPCallout } from './ERPCallout';
// ERP-linked consent verification (ADR-0004): the transparency modal + the
// owner-side controls (one-time suggestion banner, persistent settings toggle,
// and the entity link/unlink control reused by company-page + storefront editors).
export { default as ERPConsentModal } from './ERPConsentModal';
export type { ERPConsentModalProps } from './ERPConsentModal';
export { default as ERPConsentBanner } from './ERPConsentBanner';
export { default as ERPConsentSetting } from './ERPConsentSetting';
export { default as ERPEntityLinkControl } from './ERPEntityLinkControl';
export type { ERPEntityLinkControlProps, EntityLinkOutcome } from './ERPEntityLinkControl';
export { default as RateRow } from './RateRow';
export type { RateCardValue } from './RateRow';
export {
  default as ContactPreferenceSelector,
  CONTACT_PREFERENCES,
} from './ContactPreferenceSelector';
export type { ContactPreference } from './ContactPreferenceSelector';

// ── Phase 3 - feed components ───────────────────────────────────────
export { default as PostCard } from './PostCard';
export { default as PublicPostView } from './PublicPostView';
export { default as Composer } from './Composer';
export { default as MediaUploadGrid } from './MediaUploadGrid';
export { default as VoiceNoteRecorder } from './VoiceNoteRecorder';
