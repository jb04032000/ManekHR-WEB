'use client';

/**
 * DesignSystemGallery - renders every shared Connect component in isolation.
 * Reached at /design-system (dev-only). Add a <Section> here for each new
 * component as it is built (ENGINEERING-STANDARDS #11).
 */

import { useState, type ReactNode } from 'react';
import { Layout } from 'antd';
import { Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  TrustBadgeRow,
  WhatsAppCTA,
  ConnectEmptyState,
  ConnectErrorBoundary,
  ConnectModuleNav,
  ConnectMobileTabBar,
  ConnectSearchBar,
  MiniProfileCard,
  ModuleTabs,
  PersonCard,
  PrivacyBadge,
  ProfileSection,
  ProfileStrengthCard,
  ERPLinkedPanel,
  ERPCallout,
  Rail,
  RailFooter,
  RailPanel,
  RateRow,
  ContactPreferenceSelector,
  PostCard,
  Composer,
  MediaUploadGrid,
  VoiceNoteRecorder,
  type ContactPreference,
} from '@/components/connect';
import DsButton from '@/components/ui/DsButton';
import ConnectAppFooter from '@/components/connect/ConnectAppFooter';
import PhotoCarousel from '@/components/connect/PhotoCarousel';
import PhotoLayoutChooser from '@/components/connect/PhotoLayoutChooser';
import ProfileView from '@/features/connect/profile/ProfileView';
import RfqCard from '@/features/connect/rfq/RfqCard';
import QuoteCard from '@/features/connect/rfq/QuoteCard';
import type { Rfq, Quote } from '@/features/connect/rfq/rfq.types';
import type { ConnectProfileBody } from '@/features/connect/profile.types';
import type { HydratedFeedItem } from '@/features/connect/feed.types';

/** Sample RFQ + quote driving the marketplace request demos. */
const SAMPLE_RFQ: Rfq = {
  _id: 'ds-rfq-1',
  buyerUserId: 'ds-buyer-1',
  title: 'Need 400 m gold zari embroidery on cotton',
  description: 'Bridal-grade gold zari on cotton base, fine finishing. Delivery to Surat.',
  category: 'embroidery-zari',
  quantity: 400,
  unit: 'per-meter',
  budgetMin: 18000,
  budgetMax: 26000,
  neededBy: null,
  location: { district: 'Surat', city: 'Surat', state: 'Gujarat' },
  status: 'open',
  quotesCount: 3,
};

const SAMPLE_QUOTE: Quote = {
  _id: 'ds-quote-1',
  rfqId: 'ds-rfq-1',
  sellerUserId: 'ds-seller-1',
  storefrontId: null,
  price: 22000,
  leadTimeDays: 6,
  message: 'Includes fine finishing and delivery to Surat. Sample on request.',
  status: 'sent',
};

/** A self-contained swatch image so the gallery renders with no network. */
const SWATCH =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="%231A2A6C"/></svg>';

/** Sample feed posts driving the PostCard demo. */
const SAMPLE_FEED_POST: HydratedFeedItem = {
  _id: 'ds-post-1',
  authorId: 'ds-author-1',
  kind: 'photo',
  body: 'Bridal lehenga panel: gold zardozi over silk georgette. 60 hours of work. #zardozi #bridal',
  media: [
    { url: SWATCH, type: 'image' },
    { url: SWATCH, type: 'image' },
    { url: SWATCH, type: 'image' },
  ],
  audio: null,
  hashtags: ['zardozi', 'bridal'],
  tags: ['Open to custom orders'],
  visibility: 'public',
  reactionCount: 42,
  commentCount: 8,
  viewCount: 318,
  repostCount: 5,
  viewerReposted: false,
  viewerSaved: false,
  authorErpLinked: true,
  authorSkills: ['Zari'],
  createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  viewerReacted: false,
  author: {
    userId: 'ds-author-1',
    name: 'Meera Sharma',
    avatar: null,
    headline: 'Master karigar · Hand zardozi',
  },
};

const SAMPLE_FEED_TEXT_POST: HydratedFeedItem = {
  _id: 'ds-post-2',
  authorId: 'ds-author-2',
  kind: 'text',
  body: 'Looking for 4 multi-needle machine operators for the festive season. Daily wage based on machine experience.',
  media: [],
  audio: null,
  hashtags: [],
  tags: ['Hiring karigars'],
  visibility: 'public',
  reactionCount: 5,
  commentCount: 2,
  viewCount: 47,
  repostCount: 0,
  viewerReposted: false,
  viewerSaved: false,
  authorErpLinked: false,
  authorSkills: [],
  createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
  viewerReacted: true,
  author: {
    userId: 'ds-author-2',
    name: 'Anand Patel',
    avatar: null,
    headline: 'Workshop owner',
  },
};

/** Sample profile data driving the ProfileView demo. */
const SAMPLE_PROFILE: ConnectProfileBody = {
  headline: 'Master zari karigar · 14 years · Multi-head',
  bio: 'Hand and machine zari embroidery for bridal and festive wear. I lead a small team on multi-head machines and take pride in clean, on-time finishing.',
  banner: SWATCH,
  skills: ['Zari', 'Sequins', 'Aari', 'Hand embroidery'],
  portfolio: [
    {
      image: SWATCH,
      caption: 'Bridal lehenga border',
      machineType: 'Multi-head',
      workType: 'Zari',
    },
    { image: SWATCH, caption: 'Festive dupatta', machineType: 'Single-head', workType: 'Sequins' },
  ],
  experience: [
    {
      workshop: 'Surat Embroidery Works',
      role: 'Senior karigar',
      from: '2018-04-01',
      to: null,
      description: 'Lead karigar on bridal orders.',
    },
  ],
  // Self-declared training credential (no companyPageId link) - exercises the
  // ProfileView Training list's free-text branch (no logo link, no verified
  // styling).
  training: [
    {
      instituteName: 'Surat Textile Skill Centre',
      course: 'Advanced zari techniques',
      completedAt: '2017-06-01',
    },
  ],
  services: [{ title: 'Digitizing', note: 'DST files for multi-head machines' }],
  recommendations: [
    {
      fromUserId: '000000000000000000000001',
      text: 'Excellent finishing and always on time.',
      createdAt: '2025-01-10',
    },
  ],
  rateCard: { dailyWage: 90000, pieceRate: 250000 },
  openTo: { work: true, hiring: false, deals: true, customOrders: true },
  openToDetails: {},
  visibility: 'public',
  contactPreference: 'whatsapp',
  strength: 70,
};

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 'var(--cr-space-2xl)' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, color: 'var(--cr-text)' }}>
        {title}
      </h2>
      <p style={{ margin: '0 0 var(--cr-space-md)', fontSize: 13, color: 'var(--cr-text-4)' }}>
        {note}
      </p>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--cr-space-lg)',
          alignItems: 'flex-start',
          padding: 'var(--cr-space-lg)',
          background: 'var(--cr-surface)',
          border: '1px solid var(--cr-border)',
          borderRadius: 'var(--cr-radius-lg)',
        }}
      >
        {children}
      </div>
    </section>
  );
}

/** Throws on demand - drives the ConnectErrorBoundary demo. */
function Bomb() {
  const [boom, setBoom] = useState(false);
  if (boom) throw new Error('Design-system demo - intentional error');
  return (
    <DsButton dsVariant="danger" dsSize="sm" onClick={() => setBoom(true)}>
      Trigger render error
    </DsButton>
  );
}

function ErrorBoundaryDemo() {
  const [resetKey, setResetKey] = useState(0);
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-sm)', minWidth: 280 }}
    >
      <ConnectErrorBoundary key={resetKey}>
        <Bomb />
      </ConnectErrorBoundary>
      <DsButton dsVariant="ghost" dsSize="sm" onClick={() => setResetKey((k) => k + 1)}>
        Reset demo
      </DsButton>
    </div>
  );
}

/** Interactive ContactPreferenceSelector - local state. */
function ContactPreferenceDemo() {
  const [pref, setPref] = useState<ContactPreference>('whatsapp');
  return <ContactPreferenceSelector value={pref} onChange={setPref} />;
}

function ComposerDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DsButton dsVariant="primary" dsSize="sm" onClick={() => setOpen(true)}>
        Open composer
      </DsButton>
      <Composer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default function DesignSystemGallery() {
  const t = useTranslations('connect.designSystem');

  return (
    <main
      style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--cr-space-xl) var(--cr-space-lg)' }}
    >
      <header style={{ marginBottom: 'var(--cr-space-xl)' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 700, color: 'var(--cr-text)' }}>
          {t('title')}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--cr-text-4)' }}>{t('subtitle')}</p>
      </header>

      <Section
        title="ProfileSection"
        note="Shared editable-section primitive - title + titleAside + actions + body + optional footer. Replaces ad-hoc per-file section chrome across ProfileView and adjacent surfaces."
      >
        <ProfileSection title="Plain section">
          <p style={{ margin: 0 }}>Body content lives here.</p>
        </ProfileSection>
        <ProfileSection
          title="With aside + actions"
          titleAside={<PrivacyBadge />}
          actions={
            <DsButton dsVariant="ghost" dsSize="sm">
              Edit
            </DsButton>
          }
        >
          <p style={{ margin: 0 }}>
            Title aside hosts inline trust / privacy markers; actions hosts edit / add / overflow
            buttons.
          </p>
        </ProfileSection>
        <ProfileSection title="With footer" footer={<a href="#">Show all →</a>}>
          <p style={{ margin: 0 }}>Footer slot for global per-section actions.</p>
        </ProfileSection>
      </Section>

      <Section
        title="PrivacyBadge"
        note="Eye-icon 'Private to you' pill - drops on cards whose contents are visible only to the signed-in viewer (own-profile strength, future analytics)."
      >
        <PrivacyBadge />
        <PrivacyBadge label="Only your connections" />
      </Section>

      <Section
        title="TrustBadgeRow"
        note="Tiered trust badges - ERP-linked then GST, Udyam, mobile, email. Caps at max with a +N more pill."
      >
        <TrustBadgeRow badges={['erp']} />
        <TrustBadgeRow badges={['erp', 'gst', 'udyam']} />
        <TrustBadgeRow badges={['erp', 'gst', 'udyam', 'mobile', 'email']} />
        <TrustBadgeRow badges={['erp', 'gst', 'udyam', 'mobile', 'email']} max={Infinity} />
        <TrustBadgeRow badges={['erp', 'gst']} size="sm" />
      </Section>

      <Section
        title="WhatsAppCTA"
        note="Always-green wa.me handoff. Free deep link - no WhatsApp Business API."
      >
        <WhatsAppCTA phone="919876543210" prefill="Hi - via ManekHR Connect" />
        <WhatsAppCTA label="continue" phone="919876543210" />
        <WhatsAppCTA iconOnly phone="919876543210" />
        <div style={{ width: 240 }}>
          <WhatsAppCTA fullWidth phone="919876543210" />
        </div>
      </Section>

      <Section
        title="ConnectEmptyState"
        note="The locked empty-state recipe - icon, headline, subhead, primary plus secondary action."
      >
        <div
          style={{
            width: 340,
            border: '1px dashed var(--cr-border)',
            borderRadius: 'var(--cr-radius-md)',
          }}
        >
          <ConnectEmptyState
            variant="inline"
            icon={<Inbox size={24} />}
            title="No messages yet"
            description="Inquiries, job applications and DMs will arrive here."
            primaryAction={{ label: 'Browse marketplace', href: '#' }}
            secondaryAction={{ label: 'Learn more', href: '#' }}
          />
        </div>
      </Section>

      <Section
        title="ConnectErrorBoundary"
        note="Component-level boundary. Catches a child render error, shows a recoverable fallback, reports to Sentry."
      >
        <ErrorBoundaryDemo />
      </Section>

      <Section
        title="ConnectSearchBar"
        note="Global Connect search - routes to /connect/search on submit."
      >
        <div style={{ width: 360 }}>
          <ConnectSearchBar />
        </div>
      </Section>

      <Section
        title="ConnectModuleNav"
        note="Connect-mode desktop sidebar. Module items are phase-gated - not-yet-live modules render disabled."
      >
        <Layout
          style={{
            height: 520,
            width: 240,
            border: '1px solid var(--cr-border)',
            borderRadius: 'var(--cr-radius-md)',
            overflow: 'hidden',
          }}
        >
          <ConnectModuleNav
            collapsed={false}
            onCollapse={() => {}}
            mobileOpen={false}
            onMobileClose={() => {}}
          />
        </Layout>
      </Section>

      <Section
        title="ConnectMobileTabBar"
        note="Locked 5-tab bottom bar - mobile only (md:hidden). Resize the viewport below 768px to preview it inside the frame."
      >
        <div
          style={{
            position: 'relative',
            transform: 'translateZ(0)',
            width: 390,
            height: 120,
            background: 'var(--cr-bg)',
            border: '1px solid var(--cr-border)',
            borderRadius: 'var(--cr-radius-md)',
            overflow: 'hidden',
          }}
        >
          <ConnectMobileTabBar />
        </div>
      </Section>

      <Section
        title="ModuleTabs"
        note="URL-synced tab bar for Connect module screens. Tabs link to ?tab=<key>; the active tab is read from the live search param so the shell never remounts. Optional count badges; scrolls horizontally on narrow screens."
      >
        <div style={{ width: '100%', maxWidth: 520 }}>
          <ModuleTabs
            tabs={[
              { key: 'invitations', label: 'Invitations', count: 4 },
              { key: 'connections', label: 'Connections', count: 248 },
              { key: 'following', label: 'Following', count: 67 },
            ]}
            defaultTab="invitations"
            ariaLabel="Demo network tabs"
          />
        </div>
      </Section>

      <Section
        title="PersonCard"
        note="A person across discovery surfaces. `row` is the compact rail variant; `card` is the grid variant."
      >
        <div style={{ width: 320 }}>
          <PersonCard
            person={{
              userId: '1',
              name: 'Meera Sharma',
              headline: 'Master karigar · Hand zardozi',
              badges: ['erp', 'gst'],
            }}
            action={
              <DsButton dsVariant="primary" dsSize="sm">
                Connect
              </DsButton>
            }
          />
        </div>
        <div style={{ width: 220 }}>
          <PersonCard
            variant="card"
            person={{
              userId: '2',
              name: 'Vikas Soni',
              headline: 'Computerized embroidery · 7 yrs',
              badges: ['erp'],
            }}
            action={
              <DsButton dsVariant="primary" dsSize="sm">
                Connect
              </DsButton>
            }
          />
        </div>
      </Section>

      <Section
        title="RateRow"
        note="Daily-wage / piece-rate / monthly - shows only what is set. Info icon explains the three rate types."
      >
        <div style={{ width: 420 }}>
          <RateRow rateCard={{ dailyWage: 75000, pieceRate: 250000, monthly: 1800000 }} />
        </div>
        <div style={{ width: 240 }}>
          <RateRow rateCard={{ dailyWage: 65000 }} />
        </div>
        <div style={{ width: 220 }}>
          <RateRow rateCard={null} />
        </div>
      </Section>

      <Section
        title="ContactPreferenceSelector"
        note="WhatsApp / Call / DM. Interactive on the edit screen; read-only on a public profile."
      >
        <ContactPreferenceDemo />
        <ContactPreferenceSelector value="phone" readOnly />
      </Section>

      <Section
        title="ProfileStrengthCard"
        note="Completion meter + actionable checklist - each incomplete item carries its own Add CTA."
      >
        <div style={{ width: 340 }}>
          <ProfileStrengthCard
            strength={60}
            items={[
              { key: 'headline', label: 'Add a headline', done: true },
              { key: 'banner', label: 'Add a cover photo', done: true },
              { key: 'skills', label: 'Add 3 skills', done: true },
              {
                key: 'portfolio',
                label: 'Add a work sample',
                done: false,
                action: { label: 'Add', href: '#' },
              },
              {
                key: 'experience',
                label: 'Add your experience',
                done: false,
                action: { label: 'Add', href: '#' },
              },
            ]}
          />
        </div>
      </Section>

      <Section
        title="ERPLinkedPanel"
        note="The moat trust panel - explains what ERP-linked means. Renders nothing when the entity is not ERP-linked."
      >
        <div style={{ width: 320 }}>
          <ERPLinkedPanel linked since={new Date('2024-01-15')} karigarCount={3} />
        </div>
      </Section>

      <Section
        title="ERPCallout"
        note="'From your ERP' - shown to a workshop owner: their ERP track record is visible to buyers on Connect."
      >
        <div style={{ width: 340 }}>
          <ERPCallout karigarCount={17} payrollPaise={44950000} />
        </div>
      </Section>

      <Section
        title="ProfileView"
        note="The read-only profile - owner variant (strength card + edit affordance) then the public variant. Composes TrustBadgeRow, RateRow, ContactPreferenceSelector, ProfileStrengthCard and ERPLinkedPanel."
      >
        <div style={{ width: '100%' }}>
          <ProfileView
            userId="design-system-sample"
            profile={SAMPLE_PROFILE}
            displayName="Meera Sharma"
            erpLinked
            erpSince="2023-06-01"
            isOwner
            onEdit={() => {}}
          />
        </div>
        <div style={{ width: '100%' }}>
          <ProfileView
            userId="design-system-sample"
            profile={SAMPLE_PROFILE}
            displayName="Meera Sharma"
            erpLinked
            erpSince="2023-06-01"
            isOwner={false}
          />
        </div>
      </Section>

      <Section
        title="PostCard"
        note="One feed post - renders all five kinds (text / photo / video / document / voice). Header, body, media, hashtag + intent pills, and a footer with a wired Like toggle."
      >
        <div style={{ width: '100%', maxWidth: 560 }}>
          <PostCard post={SAMPLE_FEED_POST} viewerId="ds-author-1" onboarded={true} />
        </div>
        <div style={{ width: '100%', maxWidth: 560 }}>
          <PostCard post={SAMPLE_FEED_TEXT_POST} viewerId="ds-author-1" onboarded={true} />
        </div>
      </Section>

      <Section
        title="PhotoCarousel"
        note="Author-chosen slideshow for a multi-photo post (mediaLayout 'carousel'). One photo per slide with swipe / arrows / dots / counter, each opening the lightbox. The work is shown whole (contain, no crop)."
      >
        <div style={{ width: '100%', maxWidth: 560 }}>
          <PhotoCarousel media={SAMPLE_FEED_POST.media} />
        </div>
      </Section>

      <Section
        title="MediaUploadGrid"
        note="Multi-photo upload for the composer - each tile uploads immediately with its own progress, then emits the completed URLs."
      >
        <div style={{ width: 360 }}>
          <MediaUploadGrid onChange={() => {}} />
        </div>
      </Section>

      <Section
        title="PhotoLayoutChooser"
        note="Grid vs slideshow picker for a multi-photo post. The composer and the Edit Post modal both use it, shown only when 2+ photos are attached. Both selected states are shown below: grid, then slideshow."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360 }}>
          <PhotoLayoutChooser value="grid" onChange={() => {}} />
          <PhotoLayoutChooser value="carousel" onChange={() => {}} />
        </div>
      </Section>

      <Section
        title="VoiceNoteRecorder"
        note="The low-literacy voice posting path - record with the MediaRecorder API, play it back, then upload. Auto-transcription is a separate, provider-gated step."
      >
        <div style={{ width: 360 }}>
          <VoiceNoteRecorder onRecorded={() => {}} onClear={() => {}} />
        </div>
      </Section>

      <Section
        title="Composer"
        note="The post-composition sheet - text + photo modes (video / document / voice arrive in Wave 5). Opens as a modal over the feed."
      >
        <ComposerDemo />
      </Section>

      <Section
        title="Rail + RailPanel"
        note="Slot-based side rails. `<Rail side>` wraps an ordered stack of panels; new content (ads, promos, widgets) drops in by adding a sibling. `<RailPanel>` owns the consistent card chrome + optional eyebrow title row with a right-aligned action."
      >
        <div style={{ width: 220 }}>
          <Rail side="left" sticky={false} breakpoint="lg">
            <RailPanel title="Quick links">
              <a
                href="#"
                className="no-underline"
                style={{
                  display: 'block',
                  padding: '7px 0',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: 'var(--cr-text-2)',
                }}
              >
                My profile
              </a>
              <a
                href="#"
                className="no-underline"
                style={{
                  display: 'block',
                  padding: '7px 0',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: 'var(--cr-text-2)',
                }}
              >
                My network
              </a>
            </RailPanel>
            <RailPanel
              title="People to follow"
              titleAction={
                <a href="#" className="no-underline" style={{ color: 'var(--cr-primary)' }}>
                  See all
                </a>
              }
            >
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--cr-text-4)', lineHeight: 1.5 }}>
                List of people cards would go here.
              </p>
            </RailPanel>
          </Rail>
        </div>
      </Section>

      <Section
        title="MiniProfileCard"
        note="Left-rail card showing viewer identity, headline, and a quick 'View profile' link. Banner block + offset avatar + name + headline + view link. Owns its own card chrome (banner needs to bleed to top edges) so sits as a direct Rail child."
      >
        <div style={{ width: 220 }}>
          <MiniProfileCard
            name="Meera Sharma"
            avatar={null}
            headline="Master karigar · Hand zardozi · 12 years"
            banner={null}
          />
        </div>
        <div style={{ width: 220 }}>
          <MiniProfileCard name="Anand Patel" avatar={null} headline={null} banner={null} />
        </div>
      </Section>

      <Section
        title="ConnectAppFooter (page-bottom footer)"
        note="The page-bottom footer, rendered once by the shell. Real links only (About / Contact / Terms); Made in India + copyright line; mobile language toggle; sample-content note. Shown on rail-less pages and below xl; on right-rail pages the RailFooter (below) takes over instead, so only one ever shows."
      >
        <div
          style={{
            width: '100%',
            background: 'var(--cr-page)',
            borderRadius: 'var(--cr-radius-lg)',
          }}
        >
          <ConnectAppFooter />
        </div>
      </Section>

      <Section
        title="RailFooter (right-rail footer)"
        note="The ambient footer at the bottom of a right rail (LinkedIn pattern), so it stays reachable on infinite pages where the page bottom is never scrolled to. Same links/copy as ConnectAppFooter. Rendered automatically by <Rail side='right'>; mutually exclusive with the page-bottom footer."
      >
        <div
          style={{
            width: 320,
            padding: 'var(--cr-space-md)',
            background: 'var(--cr-page)',
            borderRadius: 'var(--cr-radius-lg)',
          }}
        >
          <RailFooter />
        </div>
      </Section>

      <Section
        title="RfqCard + QuoteCard"
        note="The marketplace request-for-quote cards. RfqCard is a whole-card link to the request detail (explicit aria-label so the screen-reader name stays concise); QuoteCard renders a structured one-shot offer (price + lead time + message + status) with an optional footer action slot used by the buyer's accept / seller's withdraw controls."
      >
        <div style={{ width: 340 }}>
          <RfqCard rfq={SAMPLE_RFQ} />
        </div>
        <div style={{ width: 340 }}>
          <QuoteCard quote={SAMPLE_QUOTE} sellerName="Rajesh Mehta Textiles" />
        </div>
      </Section>
    </main>
  );
}
