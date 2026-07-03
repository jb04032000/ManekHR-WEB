import { describe, it, expect, vi } from 'vitest';
import { renderWithIntl, screen } from '@/test-utils/render';
import ProfileView from './ProfileView';
import type { ConnectProfileBody } from '../profile.types';

function makeProfile(over: Partial<ConnectProfileBody> = {}): ConnectProfileBody {
  return {
    headline: 'Master zari karigar',
    bio: 'Fourteen years of zari embroidery.',
    banner: '',
    skills: ['Zari', 'Sequins', 'Aari'],
    portfolio: [{ image: 'x.jpg', caption: 'Border' }],
    experience: [{ workshop: 'Surat Embroidery', role: 'Karigar', from: '2018-04-01', to: null }],
    training: [],
    services: [],
    recommendations: [],
    rateCard: { dailyWage: 95000 },
    openTo: { work: true, hiring: false, deals: false, customOrders: false },
    openToDetails: {},
    visibility: 'public',
    contactPreference: 'whatsapp',
    strength: 80,
    ...over,
  };
}

describe('ProfileView', () => {
  it('renders the display name and headline', () => {
    renderWithIntl(
      <ProfileView
        userId="test-user-id"
        profile={makeProfile()}
        displayName="Meera Sharma"
        erpLinked={false}
        isOwner={false}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Meera Sharma' })).toBeInTheDocument();
    expect(screen.getByText('Master zari karigar')).toBeInTheDocument();
  });

  it('renders (does not crash) when a legacy profile omits the training array', () => {
    // Repro of the live "Connect could not load" crash: an older profile doc
    // predating the Institutes `training` field comes back from the API without
    // the key. ProfileView read `profile.training.length` unguarded and threw
    // "Cannot read properties of undefined (reading 'length')", blanking the
    // whole route. The `?? []` guard must keep the profile rendering.
    const legacy = makeProfile();
    delete (legacy as Partial<ConnectProfileBody>).training;
    renderWithIntl(
      <ProfileView
        userId="test-user-id"
        profile={legacy}
        displayName="Meera Sharma"
        erpLinked={false}
        isOwner={false}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Meera Sharma' })).toBeInTheDocument();
  });

  it('shows the edit affordance and strength card for the owner', () => {
    renderWithIntl(
      <ProfileView
        userId="test-user-id"
        profile={makeProfile()}
        displayName="Meera Sharma"
        erpLinked={false}
        isOwner
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText('Edit profile')).toBeInTheDocument();
    expect(screen.getByText('Profile strength')).toBeInTheDocument();
  });

  it('hides the strength card and edit affordance from a public viewer', () => {
    renderWithIntl(
      <ProfileView
        userId="test-user-id"
        profile={makeProfile()}
        displayName="Meera Sharma"
        erpLinked={false}
        isOwner={false}
      />,
    );
    expect(screen.queryByText('Profile strength')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit profile')).not.toBeInTheDocument();
  });

  it('shows the ERP-linked panel when the profile is ERP-linked', () => {
    renderWithIntl(
      <ProfileView
        userId="test-user-id"
        profile={makeProfile()}
        displayName="Meera Sharma"
        erpLinked
        erpSince="2023-06-01"
        isOwner={false}
      />,
    );
    expect(screen.getByText(/MOAT SIGNAL/i)).toBeInTheDocument();
  });

  it('omits the ERP-linked panel when the profile is not ERP-linked', () => {
    renderWithIntl(
      <ProfileView
        userId="test-user-id"
        profile={makeProfile()}
        displayName="Meera Sharma"
        erpLinked={false}
        isOwner={false}
      />,
    );
    expect(screen.queryByText(/MOAT SIGNAL/i)).not.toBeInTheDocument();
  });

  it('shows owner empty-state hints on an unfilled profile', () => {
    renderWithIntl(
      <ProfileView
        userId="test-user-id"
        profile={makeProfile({ bio: '', skills: [], portfolio: [], experience: [] })}
        displayName="Anand Patel"
        erpLinked={false}
        isOwner
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText(/Add a few lines about your work/i)).toBeInTheDocument();
  });

  it('renders skill chips', () => {
    renderWithIntl(
      <ProfileView
        userId="test-user-id"
        profile={makeProfile()}
        displayName="Meera Sharma"
        erpLinked={false}
        isOwner={false}
      />,
    );
    expect(screen.getByText('Aari')).toBeInTheDocument();
  });

  // The flat openTo pill row was replaced by the rich IntentCards block. With
  // `work: true` the visitor sees the "Open to work" intent card title + its
  // send-a-message CTA (real `en.json` `connect.profile.intents.*` keys).
  it('renders the open-to intent card instead of the old pill row', () => {
    renderWithIntl(
      <ProfileView
        userId="test-user-id"
        profile={makeProfile()}
        displayName="Meera Sharma"
        erpLinked={false}
        isOwner={false}
      />,
    );
    // The intent card is an accessible section labelled by its title, and it
    // carries the deep-link CTA. ("Open to work" also appears in the avatar
    // status ribbon, so match the unique CTA + the section role.)
    expect(screen.getByRole('region', { name: 'Open to work' })).toBeInTheDocument();
    expect(screen.getByText('Send a message')).toBeInTheDocument();
  });

  // The header avatar is now a ConnectAvatar that carries the open-to status
  // ring + pill (single source of truth; the old AvatarStatusRibbon was retired
  // from this surface). With hiring=true the size-96 avatar shows the "Hiring"
  // pill label (real en.json connect.profile.intents.ribbon.hiring). The hiring
  // intent card title is also "Hiring", so both surfaces render the label - the
  // avatar pill is the second occurrence beyond the intent card.
  it('shows the hiring status on the header avatar', () => {
    renderWithIntl(
      <ProfileView
        userId="test-user-id"
        profile={makeProfile({
          openTo: { work: false, hiring: true, deals: false, customOrders: false },
        })}
        displayName="Meera Sharma"
        erpLinked={false}
        isOwner={false}
      />,
    );
    // Avatar pill + intent card title both read "Hiring".
    expect(screen.getAllByText('Hiring').length).toBeGreaterThanOrEqual(2);
  });

  // A linked experience entry (companyPageId present in experienceCompanies)
  // renders the company name as a link to /company/<slug>, and the ongoing
  // entry surfaces the current-company line under the headline.
  it('links an experience entry to its company page and shows the current company', () => {
    renderWithIntl(
      <ProfileView
        userId="test-user-id"
        profile={makeProfile({
          experience: [
            {
              workshop: 'Zari Mills',
              role: 'Karigar',
              from: '2018-04-01',
              to: null,
              companyPageId: 'page-1',
            },
          ],
          experienceCompanies: {
            'page-1': {
              id: 'page-1',
              name: 'Zari Mills',
              slug: 'zari-mills',
              logo: '',
              erpLinked: false,
            },
          },
        })}
        displayName="Meera Sharma"
        erpLinked={false}
        isOwner={false}
      />,
    );
    // Both the experience list AND the right-side current-company header card
    // link the company name to its public page.
    const links = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === '/company/zari-mills');
    expect(links.length).toBeGreaterThanOrEqual(1);
    // The ongoing entry name appears (current-company on the right + experience
    // list). LinkedIn-style: just the logo + name, no "Current" label / box.
    expect(screen.getAllByText('Zari Mills').length).toBeGreaterThanOrEqual(1);
  });

  // Training credentials (self-declared). A linked entry (companyPageId resolves
  // in trainingCompanies) links the institute name to /company/<slug> and shows
  // the institute logo; a self-declared entry (no/unresolved companyPageId)
  // renders plain with no link. Mirrors the experience linked-vs-freetext branch.
  it('links a training institute to its company page and renders a self-declared one plain', () => {
    renderWithIntl(
      <ProfileView
        userId="test-user-id"
        profile={makeProfile({
          training: [
            {
              instituteName: 'Surat Design Academy',
              course: 'Advanced Zari',
              completedAt: '2022-06-01',
              companyPageId: 'inst-1',
            },
            { instituteName: 'Self Taught Studio', course: 'Hand Embroidery' },
          ],
          trainingCompanies: {
            'inst-1': {
              id: 'inst-1',
              name: 'Surat Design Academy',
              slug: 'surat-design-academy',
              logo: 'https://cdn/logo.png',
              erpLinked: false,
            },
          },
        })}
        displayName="Meera Sharma"
        erpLinked={false}
        isOwner={false}
      />,
    );
    // The linked institute name links to its public page.
    const links = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === '/company/surat-design-academy');
    expect(links.length).toBeGreaterThanOrEqual(1);
    // The self-declared institute name renders (as plain text, not a link).
    const plain = screen.getByText('Self Taught Studio');
    expect(plain).toBeInTheDocument();
    expect(plain.closest('a')).toBeNull();
  });

  // Intro video (poster-first player) - renders the <video> element (matched by
  // its aria-label, real en.json connect.profile.video.play) ONLY when the
  // profile carries a clip. Mirrors the marketplace listing video pattern.
  it('renders the intro video player when the profile has a video', () => {
    renderWithIntl(
      <ProfileView
        userId="test-user-id"
        profile={makeProfile({
          videos: [{ url: 'https://cdn/clip.mp4', posterUrl: 'https://cdn/poster.jpg' }],
        })}
        displayName="Meera Sharma"
        erpLinked={false}
        isOwner={false}
      />,
    );
    const player = screen.getByLabelText('Play video');
    expect(player).toBeInTheDocument();
    expect(player).toHaveAttribute('src', 'https://cdn/clip.mp4');
    expect(player).toHaveAttribute('poster', 'https://cdn/poster.jpg');
  });

  // A visitor (non-owner) sees NO intro-video section when there is no clip.
  it('omits the intro video section for a visitor when there is no video', () => {
    renderWithIntl(
      <ProfileView
        userId="test-user-id"
        profile={makeProfile({ videos: [] })}
        displayName="Meera Sharma"
        erpLinked={false}
        isOwner={false}
      />,
    );
    expect(screen.queryByLabelText('Play video')).not.toBeInTheDocument();
    expect(screen.queryByText('Intro video')).not.toBeInTheDocument();
  });

  // The owner with no clip sees the section header + an empty-hint to add one,
  // but no <video> player.
  it('shows the owner an empty hint to add an intro video when none is set', () => {
    renderWithIntl(
      <ProfileView
        userId="test-user-id"
        profile={makeProfile({ videos: [] })}
        displayName="Meera Sharma"
        erpLinked={false}
        isOwner
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText('Intro video')).toBeInTheDocument();
    expect(screen.getByText(/Add a short video to introduce yourself/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Play video')).not.toBeInTheDocument();
  });

  // Owner-only profile-view count is appended to the social-proof stats row.
  it('shows the profile-views stat for the owner when provided', () => {
    renderWithIntl(
      <ProfileView
        userId="test-user-id"
        profile={makeProfile()}
        displayName="Meera Sharma"
        erpLinked={false}
        isOwner
        onEdit={vi.fn()}
        stats={{ connections: 12, followers: 5 }}
        profileViews={42}
      />,
    );
    expect(screen.getByText('42 profile views')).toBeInTheDocument();
  });
});
