/* Connect - Onboarding (intent question) + Day-1 zero-state home
   Routes new users into the right module based on intent. */

const OnboardingScreen = () => (
  <window.ConnectShell title="Welcome" activeNav="" hideTopSearch={true}>
    <div
      style={{ padding: '32px 24px', display: 'grid', placeItems: 'start center', minHeight: 0 }}
    >
      <div style={{ maxWidth: 820, width: '100%' }}>
        {/* Step bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 20,
            fontSize: 12,
            color: 'var(--neutral-500)',
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--indigo-700)',
              color: 'white',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
            }}
          >
            1
          </span>
          <span style={{ color: 'var(--neutral-900)', fontWeight: 600 }}>
            Tell us why you're here
          </span>
          <span
            style={{ flex: 1, height: 2, background: 'var(--neutral-200)', margin: '0 8px' }}
          ></span>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--neutral-200)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            2
          </span>
          <span>Set up profile</span>
          <span
            style={{ flex: 1, height: 2, background: 'var(--neutral-200)', margin: '0 8px' }}
          ></span>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--neutral-200)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            3
          </span>
          <span>Add 3 connections</span>
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
          Aapka Zari360 Connect par swagat hai 👋
        </h1>
        <p
          style={{ fontSize: 16, color: 'var(--neutral-600)', margin: '8px 0 0', lineHeight: 1.5 }}
        >
          What brings you here? Pick one - we'll set up your home screen around it.{' '}
          <span style={{ color: 'var(--neutral-400)' }}>
            (You can do everything later - this just routes you faster.)
          </span>
        </p>

        <Anno n="1">
          Single most important screen for routing users into the right module. Mirrors strategy
          doc's intent question.
        </Anno>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 22 }}>
          {[
            {
              tag: 'Workshop owner',
              icon: <CIco.Building />,
              title: 'Run my business',
              body: 'Manage karigars, payroll, attendance. Find bulk orders and buyers.',
              routes: 'Lands on: ERP Dashboard + Connect Feed',
              accent: 'var(--indigo-700)',
              recommended: true,
            },
            {
              tag: 'Karigar / Designer',
              icon: <CIco.Users />,
              title: "I'm looking for work",
              body: 'Show your portfolio, find daily-wage / piece-rate / monthly jobs near you.',
              routes: 'Lands on: Profile setup → Jobs Home',
              accent: 'var(--gold-700)',
            },
            {
              tag: 'Buyer / Brand',
              icon: <CIco.Store />,
              title: 'Buy fabric & materials',
              body: 'Discover verified Surat wholesalers. Send RFQs, get quotations.',
              routes: 'Lands on: Marketplace Home',
              accent: 'var(--indigo-600)',
            },
            {
              tag: 'Just exploring',
              icon: <CIco.Search />,
              title: 'Just looking around',
              body: "I'll figure it out. Show me everything.",
              routes: 'Lands on: Feed (default)',
              accent: 'var(--neutral-500)',
            },
          ].map((opt, i) => (
            <div
              key={i}
              style={{
                padding: 22,
                background: 'var(--neutral-0)',
                border: i === 0 ? '2px solid var(--indigo-700)' : '1px solid var(--neutral-200)',
                borderRadius: 14,
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {opt.recommended && (
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--gold-700)',
                    background: 'var(--gold-100)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    letterSpacing: '0.06em',
                  }}
                >
                  RECOMMENDED FOR YOU
                </div>
              )}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: opt.accent,
                  color: 'white',
                  display: 'grid',
                  placeItems: 'center',
                  marginBottom: 14,
                }}
              >
                {opt.icon}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--neutral-500)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {opt.tag}
              </div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  margin: '4px 0 8px',
                  letterSpacing: '-0.01em',
                }}
              >
                {opt.title}
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--neutral-600)', lineHeight: 1.5 }}>
                {opt.body}
              </p>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 11,
                  color: 'var(--neutral-500)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {opt.routes}
              </div>
            </div>
          ))}
        </div>

        <Anno n="2">
          "Recommended" = inferred from ERP context. If user signed up via ERP onboarding, default
          to Workshop owner.
        </Anno>

        <div
          style={{
            marginTop: 26,
            padding: 18,
            background: 'var(--indigo-50)',
            border: '1px solid var(--indigo-100)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--indigo-800)' }}>
              You can pick more than one later
            </div>
            <div style={{ fontSize: 13, color: 'var(--indigo-700)', marginTop: 4 }}>
              Many users are workshop owners AND buyers. We'll keep showing all the modules in the
              sidebar - this just picks where you land.
            </div>
          </div>
          <button className="cn-btn cn-btn-primary">Continue →</button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <span className="cn-link">Skip - just take me to the feed</span>
        </div>
      </div>
    </div>
  </window.ConnectShell>
);

/* Day-1 zero-state Feed - after onboarding, before any activity */
const ZeroFeedScreen = () => (
  <window.ConnectShell title="Home" activeNav="feed" counts={{}}>
    <div className="cn-feed-layout">
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="cn-card" style={{ overflow: 'hidden' }}>
          <div
            style={{
              height: 56,
              background: 'var(--neutral-100)',
              borderBottom: '1px solid var(--neutral-200)',
            }}
          ></div>
          <div style={{ padding: '0 14px 16px', textAlign: 'center' }}>
            <div style={{ marginTop: -24, display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'var(--neutral-100)',
                  border: '2px solid var(--neutral-0)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--neutral-400)',
                }}
              >
                <CIco.Plus />
              </div>
            </div>
            <div style={{ marginTop: 10, fontWeight: 700, fontSize: 14 }}>Hi, Rahul 👋</div>
            <div
              style={{ fontSize: 12, color: 'var(--neutral-500)', marginTop: 4, lineHeight: 1.4 }}
            >
              Add a photo and a one-line headline so people know who you are
            </div>
            <button className="cn-btn cn-btn-primary" style={{ width: '100%', marginTop: 12 }}>
              Complete your profile
            </button>
          </div>
          <div className="cn-divider"></div>
          <div className="cn-pc">
            <div className="cn-pc-ring">
              <svg viewBox="0 0 56 56">
                <circle
                  cx="28"
                  cy="28"
                  r="22"
                  fill="none"
                  stroke="var(--neutral-200)"
                  strokeWidth="5"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="22"
                  fill="none"
                  stroke="var(--indigo-600)"
                  strokeWidth="5"
                  strokeDasharray={2 * Math.PI * 22}
                  strokeDashoffset={2 * Math.PI * 22 * (1 - 0.15)}
                  strokeLinecap="round"
                  transform="rotate(-90 28 28)"
                />
              </svg>
              <div className="pct">15%</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>Just getting started</div>
              <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 2 }}>
                Each step adds visibility
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Setup checklist - the hero of day 1 */}
        <div
          className="cn-card"
          style={{
            background: 'linear-gradient(135deg, var(--indigo-700), var(--indigo-800))',
            color: 'var(--neutral-0)',
            border: 0,
          }}
        >
          <div style={{ padding: '22px 22px 14px' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--gold-400)',
                letterSpacing: '0.1em',
              }}
            >
              YOUR FIRST 5 MINUTES
            </div>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                margin: '8px 0 6px',
                letterSpacing: '-0.01em',
              }}
            >
              Get set up - feed comes alive after these 4 steps
            </h2>
            <div style={{ fontSize: 13, color: 'var(--indigo-200)' }}>
              Right now your feed is empty because we don't know what to show. Help us learn.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { done: true, n: 1, t: 'Pick your intent', s: '"I am looking for work"', cta: null },
              {
                done: false,
                n: 2,
                t: 'Add a profile photo + headline',
                s: 'Even a phone photo is fine',
                cta: 'Add photo',
              },
              {
                done: false,
                n: 3,
                t: 'Add 1 work sample to portfolio',
                s: "Photo or short video of work you've done",
                cta: 'Upload',
              },
              {
                done: false,
                n: 4,
                t: 'Follow 3 people or workshops',
                s: "We'll suggest some near you in Surat",
                cta: 'See suggestions',
              },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr auto',
                  gap: 14,
                  padding: '14px 22px',
                  borderTop: '1px solid rgba(255,255,255,0.12)',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: s.done ? 'var(--gold-500)' : 'rgba(255,255,255,0.15)',
                    color: s.done ? 'var(--indigo-800)' : 'rgba(255,255,255,0.7)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {s.done ? <CIco.Check2 /> : s.n}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      textDecoration: s.done ? 'line-through' : 'none',
                      opacity: s.done ? 0.6 : 1,
                    }}
                  >
                    {s.t}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--indigo-200)', marginTop: 2 }}>
                    {s.s}
                  </div>
                </div>
                {s.cta ? (
                  <button className="cn-btn cn-btn-gold cn-btn-sm">{s.cta}</button>
                ) : (
                  <CIco.Check2 style={{ color: 'var(--gold-400)' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        <Anno n="3">
          Setup checklist is the FEED on day 1. Don't show empty feed posts and a tiny "complete
          your profile" nudge - flip it: checklist is the hero, feed comes second.
        </Anno>

        {/* Below the checklist - taste of what's coming */}
        <div
          style={{
            padding: '14px 4px',
            fontSize: 13,
            color: 'var(--neutral-500)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span>
            <b style={{ color: 'var(--neutral-900)' }}>Some posts from Surat</b> · for now, until
            your feed personalises
          </span>
        </div>

        {/* Sample post (greyed) */}
        <article className="cn-card" style={{ opacity: 0.92 }}>
          <div className="cn-post-head">
            <Av name="MS" color="#8C5A3C" />
            <div className="who">
              <div className="name">
                Meera Sharma <Verified kind="erp" />
              </div>
              <div className="sub">Master karigar · Hand zardozi · Surat</div>
            </div>
          </div>
          <div className="cn-post-body">
            Bridal lehenga panel - gold zardozi over silk georgette.
          </div>
          <div className="cn-post-imggrid x2">
            <Img label="bridal panel" style={{ aspectRatio: '4 / 3' }} />
            <Img label="detail" style={{ aspectRatio: '4 / 3' }} />
          </div>
          <div className="cn-post-foot">
            <div className="react">
              <CIco.Heart /> Like
            </div>
            <div className="react">
              <CIco.Comment /> Comment
            </div>
            <div className="react wa">
              <CIco.Wa /> WhatsApp
            </div>
          </div>
        </article>
      </main>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="cn-card cn-card-pad">
          <h3 className="cn-h3">3 people to follow first</h3>
          <Anno n="4">
            First-follow suggestions matter more than anything else. ERP-linked + Surat + similar
            skill → highest quality.
          </Anno>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {[
              ['IS', 'Imran Sheikh', 'Aari · 8 yrs · Varachha', '#1A2A6C', true],
              ['DM', 'Deepak Mistry', 'Workshop · 22 karigars', 'var(--indigo-800)', true],
              ['NP', 'Neha Patel', 'Aari · Same area', '#0E1844', false],
            ].map(([n, name, sub, c, erp]) => (
              <div
                key={n}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr auto',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <Av name={n} color={c} />
                <div>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {name}
                    {erp && <Verified kind="erp" />}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--neutral-500)' }}>{sub}</div>
                </div>
                <button className="cn-btn cn-btn-sm">+ Follow</button>
              </div>
            ))}
          </div>
        </div>

        <div
          className="cn-card cn-card-pad"
          style={{ background: 'var(--gold-100)', borderColor: 'var(--gold-400)' }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--gold-700)',
              letterSpacing: '0.08em',
            }}
          >
            WHATSAPP PROMPT
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--gold-700)',
              marginTop: 6,
              lineHeight: 1.45,
            }}
          >
            "Apne dost karigars ko bula" - invite people you already work with via WhatsApp.
          </div>
          <button className="cn-btn cn-btn-wa" style={{ width: '100%', marginTop: 12 }}>
            <CIco.Wa /> Invite via WhatsApp
          </button>
        </div>
      </aside>
    </div>
  </window.ConnectShell>
);

window.OnboardingScreen = OnboardingScreen;
window.ZeroFeedScreen = ZeroFeedScreen;
