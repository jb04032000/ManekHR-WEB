/* Jobs - karigar-adapted, daily-wage / piece-rate as first-class */

const JobsHome = () => (
  <window.ConnectShell
    title="Jobs"
    activeNav="jobs"
    counts={{ jobs: 2, inbox: 3, notifications: '9+' }}
  >
    <SubTabs
      active="find"
      items={[
        ['find', 'Find jobs', 248],
        ['applied', 'My applications', 5],
        ['posted', 'Posted jobs', 4],
        ['candidates', 'Candidates', 56],
      ]}
    />
    <div
      style={{
        padding: '20px 24px',
        display: 'grid',
        gridTemplateColumns: '260px 1fr 320px',
        gap: 16,
        alignItems: 'start',
      }}
    >
      {/* LEFT - filters */}
      <aside className="cn-card cn-card-pad">
        <h3 className="cn-h3" style={{ marginBottom: 12 }}>
          Filters
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: 'var(--neutral-700)',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Employment type
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                color: 'var(--neutral-700)',
              }}
            >
              {[
                ['Full-time monthly', 124, false],
                ['Daily-wage karigar', 218, true],
                ['Piece-rate', 96, true],
                ['Part-time', 32, false],
                ['Apprenticeship', 18, false],
                ['Contract', 24, false],
              ].map(([l, n, on]) => (
                <label
                  key={l}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        border: '1.5px solid var(--neutral-300)',
                        background: on ? 'var(--indigo-700)' : 'transparent',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'white',
                      }}
                    >
                      {on && <CIco.Check2 />}
                    </span>
                    {l}
                  </span>
                  <span style={{ color: 'var(--neutral-400)', fontSize: 11 }}>{n}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: 'var(--neutral-700)',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Skills
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Pill kind="indigo">Aari ×</Pill>
              <Pill kind="indigo">Multi-needle ×</Pill>
              <Pill>+ Add skill</Pill>
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: 'var(--neutral-700)',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Daily-wage range
            </div>
            <div className="cn-input" style={{ padding: 8, justifyContent: 'space-between' }}>
              ₹400 <span style={{ color: 'var(--neutral-300)' }}>-</span> ₹1,200
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: 'var(--neutral-700)',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Location · Surat
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['Varachha', 'Katargam', 'Udhna', 'Sachin', 'Bhestan'].map((a) => (
                <label
                  key={a}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        border: '1.5px solid var(--neutral-300)',
                      }}
                    ></span>
                    {a}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: 'var(--neutral-700)',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Machine type
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Pill>Single-needle</Pill>
              <Pill>Multi-head</Pill>
              <Pill>Computerized</Pill>
            </div>
          </div>
        </div>
      </aside>

      {/* MIDDLE - job list */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        <div
          className="cn-card"
          style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10 }}
        >
          <div className="cn-globalsearch" style={{ width: 'auto' }}>
            <CIco.Search />
            <span>Search jobs · "multi-needle Varachha", "designer Surat"</span>
          </div>
          <button className="cn-btn">
            Posted: Last 7 days <CIco.Chevron />
          </button>
          <button className="cn-btn">
            Sort: Most recent <CIco.Chevron />
          </button>
        </div>

        <Anno n="1">
          Daily-wage / piece-rate / monthly salary are all first-class. Most karigars in Surat are
          daily-wage; jobs filter on that by default for karigar profiles.
        </Anno>

        {[
          {
            logo: 'AT',
            co: 'Anat Textiles',
            erp: true,
            title: 'Machine operator - Multi-head computerized',
            sub: 'Surat (Varachha) · Daily-wage · 4 openings',
            wages: ['₹650 – ₹900 / day', '6 days/week', 'Festive · 8 weeks'],
            skills: ['Multi-head', 'Computerized', '2+ yrs'],
            saved: true,
            applied: false,
            posted: '2h ago',
          },
          {
            logo: 'RS',
            co: 'Roop Bridal Studio',
            erp: true,
            title: 'Hand zardozi karigar - bridal panels',
            sub: 'Surat (Udhna) · Piece-rate · 6 openings',
            wages: ['₹2,500 – ₹3,200 / saree', '~ 8 sarees/month', 'Long-term'],
            skills: ['Hand zardozi', 'Bridal', '3+ yrs'],
            saved: false,
            applied: false,
            posted: '5h ago',
          },
          {
            logo: 'KD',
            co: 'Kapoor Designs',
            erp: false,
            title: 'Embroidery designer - pattern making',
            sub: 'Surat (Katargam) · Full-time · 1 opening',
            wages: ['₹35,000 – ₹50,000 / month', 'Full-time', 'On-site'],
            skills: ['Designing', 'Pattern-making', '5+ yrs'],
            saved: false,
            applied: true,
            posted: '1d ago',
          },
          {
            logo: 'SK',
            co: 'Sharma Karigars (workshop)',
            erp: true,
            title: 'Apprentice - hand embroidery',
            sub: 'Surat (Varachha) · Apprenticeship · 3 openings',
            wages: ['₹350 – ₹500 / day', 'Training 6 months', 'Full-time'],
            skills: ['Aari basics', '0–1 yrs'],
            saved: false,
            applied: false,
            posted: '2d ago',
          },
        ].map((j, i) => (
          <article key={i} className="cn-job" style={{ gridTemplateColumns: '52px 1fr', gap: 14 }}>
            <div className="cn-job-logo">{j.logo}</div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div>
                  <h3 className="cn-job-title">{j.title}</h3>
                  <div className="cn-job-co">
                    {j.co}{' '}
                    {j.erp && (
                      <span style={{ marginLeft: 4 }}>
                        <Verified kind="erp" />
                      </span>
                    )}
                  </div>
                  <div className="cn-job-co" style={{ color: 'var(--neutral-500)', marginTop: 2 }}>
                    {j.sub}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--neutral-500)' }}>{j.posted}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="cn-btn cn-btn-sm">
                      <CIco.Bookmark />
                    </button>
                    {j.applied ? (
                      <button
                        className="cn-btn cn-btn-sm"
                        disabled
                        style={{
                          background: 'var(--success-50)',
                          color: 'var(--success-700)',
                          borderColor: 'var(--success-50)',
                        }}
                      >
                        ✓ Applied
                      </button>
                    ) : (
                      <button className="cn-btn cn-btn-primary cn-btn-sm">Apply</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Wage row - emphasis on daily/piece/monthly */}
              <div className="cn-wage" style={{ marginTop: 12 }}>
                {j.wages.map((w, k) => (
                  <div key={k} className="b">
                    <div className="l">{['Wage', 'Schedule', 'Tenure'][k]}</div>
                    <div className="v">{w}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                {j.skills.map((s) => (
                  <Pill key={s} kind="indigo">
                    {s}
                  </Pill>
                ))}
                <Pill>WhatsApp-first communication</Pill>
                <Pill>Voice-note application OK</Pill>
              </div>
            </div>
          </article>
        ))}
      </main>

      {/* RIGHT - recruiter dashboard preview + alerts */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="cn-card cn-card-pad">
          <h3 className="cn-h3">Job alerts</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            <div
              style={{
                padding: 10,
                background: 'var(--neutral-50)',
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13 }}>Multi-needle · Surat · ₹500+/day</div>
              <div style={{ color: 'var(--neutral-500)', marginTop: 2 }}>
                Daily - push + WhatsApp · 4 new today
              </div>
            </div>
            <div
              style={{
                padding: 10,
                background: 'var(--neutral-50)',
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13 }}>Designer roles · Surat</div>
              <div style={{ color: 'var(--neutral-500)', marginTop: 2 }}>
                Weekly - email only · 1 new this week
              </div>
            </div>
            <button className="cn-btn cn-btn-sm" style={{ marginTop: 4 }}>
              <CIco.Plus /> New alert
            </button>
          </div>
        </div>

        <div
          className="cn-card cn-card-pad"
          style={{ background: 'var(--indigo-50)', borderColor: 'var(--indigo-100)' }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--indigo-700)',
              letterSpacing: '0.08em',
            }}
          >
            NVITES · 2 NEW
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--indigo-800)',
              marginTop: 6,
              lineHeight: 1.4,
            }}
          >
            Recruiters directly invited you to apply.
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{ padding: 10, background: 'var(--neutral-0)', borderRadius: 8, fontSize: 12 }}
            >
              <div style={{ fontWeight: 700 }}>Roop Bridal Studio</div>
              <div style={{ color: 'var(--neutral-500)', marginTop: 2 }}>
                "We saw your zardozi portfolio. Interested?"
              </div>
            </div>
            <div
              style={{ padding: 10, background: 'var(--neutral-0)', borderRadius: 8, fontSize: 12 }}
            >
              <div style={{ fontWeight: 700 }}>Anat Textiles</div>
              <div style={{ color: 'var(--neutral-500)', marginTop: 2 }}>
                "Daily-wage opening matches your profile."
              </div>
            </div>
          </div>
          <Anno n="2">
            Nvites - Naukri pattern. Recruiter caps + caller-ID with intent prevent spam.
          </Anno>
        </div>

        <div className="cn-card cn-card-pad">
          <h3 className="cn-h3">Recruiting? (employer)</h3>
          <div style={{ fontSize: 13, color: 'var(--neutral-700)', marginTop: 8, lineHeight: 1.5 }}>
            Post a job, search karigar profiles, manage your pipeline.
          </div>
          <button className="cn-btn cn-btn-primary" style={{ width: '100%', marginTop: 10 }}>
            + Post a job
          </button>
          <button className="cn-btn" style={{ width: '100%', marginTop: 6 }}>
            Open recruiter dashboard
          </button>
        </div>
      </aside>
    </div>
  </window.ConnectShell>
);

/* Job detail page */
const JobDetail = () => (
  <window.ConnectShell title="Jobs" activeNav="jobs" hideTopSearch={true}>
    <div style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginBottom: 14 }}>
        Jobs › Daily-wage ›{' '}
        <span style={{ color: 'var(--neutral-900)' }}>Machine operator - Multi-head</span>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div className="cn-card cn-card-pad">
            <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 14 }}>
              <div className="cn-job-logo" style={{ width: 56, height: 56, fontSize: 20 }}>
                AT
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
                  Machine operator - Multi-head computerized
                </h1>
                <div style={{ fontSize: 14, color: 'var(--neutral-700)', marginTop: 4 }}>
                  Anat Textiles <Verified kind="erp" />
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--neutral-500)',
                    marginTop: 4,
                    display: 'flex',
                    gap: 14,
                    flexWrap: 'wrap',
                  }}
                >
                  <span>
                    <CIco.MapPin style={{ verticalAlign: 'middle', marginRight: 2 }} /> Surat -
                    Varachha
                  </span>
                  <span>Posted 2h ago</span>
                  <span>32 applications</span>
                </div>
              </div>
            </div>

            <div
              className="cn-wage"
              style={{ marginTop: 18, gridTemplateColumns: 'repeat(4, 1fr)' }}
            >
              <div className="b">
                <div className="l">Daily wage</div>
                <div className="v">₹650 – ₹900</div>
              </div>
              <div className="b">
                <div className="l">Type</div>
                <div className="v">Daily-wage</div>
              </div>
              <div className="b">
                <div className="l">Openings</div>
                <div className="v">4</div>
              </div>
              <div className="b">
                <div className="l">Experience</div>
                <div className="v">2+ yrs</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
              <Pill kind="indigo">Multi-head</Pill>
              <Pill kind="indigo">Computerized</Pill>
              <Pill>6 days / week</Pill>
              <Pill>Festive · 8 weeks</Pill>
              <Pill>WhatsApp-first</Pill>
              <Pill>Voice-note application accepted</Pill>
            </div>
          </div>

          <div className="cn-card cn-card-pad">
            <h2 className="cn-h2">About the role</h2>
            <p
              style={{
                margin: '10px 0 0',
                fontSize: 14,
                color: 'var(--neutral-700)',
                lineHeight: 1.6,
              }}
            >
              Operating multi-head computerized embroidery machines for festive-season production. 4
              positions for 8 weeks (June – July). Daily wage based on experience and machine type.
              Lunch + tea provided. Possibility of long-term role after the season.
            </p>
            <h3 className="cn-h3" style={{ marginTop: 22 }}>
              What you'll do
            </h3>
            <ul
              style={{
                margin: '8px 0 0 18px',
                padding: 0,
                fontSize: 14,
                color: 'var(--neutral-700)',
                lineHeight: 1.6,
              }}
            >
              <li>Load designs and run multi-head machines (6 / 9 head)</li>
              <li>Quality check finished panels before packaging</li>
              <li>Basic machine maintenance - needle changes, thread tension</li>
            </ul>
            <h3 className="cn-h3" style={{ marginTop: 18 }}>
              Requirements
            </h3>
            <ul
              style={{
                margin: '8px 0 0 18px',
                padding: 0,
                fontSize: 14,
                color: 'var(--neutral-700)',
                lineHeight: 1.6,
              }}
            >
              <li>2+ years on multi-head or single-needle computerized</li>
              <li>Comfortable reading design files (DST / EMB)</li>
              <li>Surat-based, can travel to Varachha workshop</li>
            </ul>
          </div>

          <div className="cn-card cn-card-pad">
            <h2 className="cn-h2">About Anat Textiles</h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '52px 1fr auto',
                gap: 14,
                marginTop: 10,
                alignItems: 'center',
              }}
            >
              <Av name="AT" color="var(--indigo-700)" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Anat Textiles · Workshop</div>
                <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>
                  17 karigars · ERP active since 2024 · 12 jobs posted
                </div>
              </div>
              <button className="cn-btn cn-btn-sm">+ Follow</button>
            </div>
            <div
              style={{
                marginTop: 14,
                display: 'flex',
                gap: 16,
                padding: '12px 14px',
                background: 'var(--neutral-50)',
                borderRadius: 10,
                fontSize: 12,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <CIco.Star style={{ color: 'var(--warning-700)' }} /> <b>4.6</b> · 12 reviews
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color: 'var(--success-700)',
                }}
              >
                ● Hires within 7 days · usually
              </span>
            </div>
          </div>

          {/* Salary benchmark - added per critique */}
          <div
            className="cn-card cn-card-pad"
            style={{ background: 'var(--indigo-50)', borderColor: 'var(--indigo-100)' }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--indigo-700)',
                letterSpacing: '0.08em',
              }}
            >
              SALARY BENCHMARK · SURAT · MULTI-HEAD
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                marginTop: 10,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--indigo-700)',
                    letterSpacing: '0.06em',
                  }}
                >
                  LOW · 25TH PCT
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>₹520</div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--indigo-700)',
                    letterSpacing: '0.06em',
                  }}
                >
                  MEDIAN
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    marginTop: 2,
                    color: 'var(--indigo-700)',
                  }}
                >
                  ₹720
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--indigo-700)',
                    letterSpacing: '0.06em',
                  }}
                >
                  HIGH · 75TH PCT
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>₹950</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--indigo-700)', marginTop: 10 }}>
              This role offers ₹650–₹900 - competitive with market median. Drawn from 218 active
              daily-wage listings in Surat.
            </div>
          </div>

          {/* Similar jobs - added per critique */}
          <div className="cn-card cn-card-pad">
            <div className="cn-section-h">
              <h2>Similar jobs</h2>
              <span className="cn-link">See all</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {[
                ['Multi-head op · Sharma Karigars', '₹600–₹850 / day · Varachha · 3 openings'],
                ['Computerized machine op · Roop Bridal', '₹700–₹950 / day · Udhna · 2 openings'],
                [
                  'Single-needle karigar · Kapoor Designs',
                  '₹500–₹700 / day · Katargam · 4 openings',
                ],
              ].map(([t, sub]) => (
                <div
                  key={t}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    background: 'var(--neutral-50)',
                    borderRadius: 8,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{t}</div>
                    <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginTop: 2 }}>
                      {sub}
                    </div>
                  </div>
                  <button className="cn-btn cn-btn-sm">View</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* APPLY PANEL */}
        <aside
          style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div className="cn-card cn-card-pad">
            <h3 className="cn-h2">Apply for this role</h3>
            <Anno n="3">
              Application = profile + optional cover note + optional voice note. WhatsApp handoff
              for low-literacy candidates.
            </Anno>
            <div className="cn-quote-form" style={{ marginTop: 14 }}>
              <div className="cn-input">Your profile · Rahul Patel</div>
              <div className="cn-input tall">
                Cover note (optional) - kya kaam pehle kiya, kab join kar sakte ho
              </div>
              <button className="cn-btn">
                <CIco.Mic style={{ color: 'var(--danger-500)' }} /> Record voice note instead
              </button>
              <button className="cn-btn cn-btn-primary" style={{ padding: '12px 16px' }}>
                Send application
              </button>
              <button className="cn-btn cn-btn-wa">Apply via WhatsApp</button>
            </div>
          </div>
          <div className="cn-card cn-card-pad" style={{ background: 'var(--neutral-50)' }}>
            <h3 className="cn-h3">Application tracking</h3>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                marginTop: 10,
                fontSize: 12,
              }}
            >
              {[
                'Applied',
                'Viewed by recruiter',
                'Shortlisted',
                'Interview',
                'Offered / Hired',
              ].map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: i === 0 ? 'var(--indigo-700)' : 'var(--neutral-200)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'white',
                      fontSize: 9,
                    }}
                  >
                    {i === 0 ? '●' : ''}
                  </span>
                  <span
                    style={{
                      color: i === 0 ? 'var(--neutral-900)' : 'var(--neutral-500)',
                      fontWeight: i === 0 ? 600 : 400,
                    }}
                  >
                    {s}{' '}
                    {i === 0 && (
                      <Pill kind="indigo" style={{ marginLeft: 4 }}>
                        You're here
                      </Pill>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="cn-divider" style={{ margin: '14px 0' }}></div>
            <button
              className="cn-btn cn-btn-sm"
              style={{ width: '100%', color: 'var(--danger-700)' }}
            >
              Withdraw application
            </button>
          </div>
        </aside>
      </div>
    </div>
  </window.ConnectShell>
);

window.JobsHome = JobsHome;
window.JobDetail = JobDetail;
