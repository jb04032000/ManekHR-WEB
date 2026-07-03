/* Company Page - LinkedIn Pages, B2B-tilted */

const CompanyScreen = () => (
  <window.ConnectShell title="Company" activeNav="companies" hideTopSearch={true}>
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Banner + head */}
      <div className="cn-co-head" style={{ overflow: 'hidden' }}>
        <div className="cn-co-banner">
          <Banner
            label="cover · workshop floor / production line"
            style={{ width: '100%', height: '100%', borderRadius: 0 }}
          />
        </div>
        <div className="body">
          <div className="logo">AT</div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 20,
            }}
          >
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
                Anat Textiles
              </h1>
              <div style={{ fontSize: 14, color: 'var(--neutral-700)', marginTop: 4 }}>
                Workshop · Embroidery production · Surat, Gujarat
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--neutral-500)',
                  marginTop: 6,
                  display: 'flex',
                  gap: 14,
                  flexWrap: 'wrap',
                }}
              >
                <span>Founded 2014</span>
                <span>17 karigars on roll</span>
                <span>1,240 followers</span>
                <span>12 jobs posted · 84 products</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                <Verified kind="erp" />
                <Verified kind="gst" />
                <Verified kind="udyam" />
                <Pill kind="green">Hiring · 4 roles</Pill>
                <Pill kind="indigo">Open to bulk orders</Pill>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="cn-btn cn-btn-primary">
                <CIco.Plus /> Follow
              </button>
              <button className="cn-btn">
                <CIco.Inbox /> Message
              </button>
              <button className="cn-btn cn-btn-wa">
                <CIco.Wa />
              </button>
              <button className="cn-btn">
                <CIco.More />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="cn-tabs" style={{ marginTop: 0 }}>
          <div className="cn-tab is-active">Home</div>
          <div className="cn-tab">About</div>
          <div className="cn-tab">
            Posts <span className="ct">· 86</span>
          </div>
          <div className="cn-tab">
            Products <span className="ct">· 84</span>
          </div>
          <div className="cn-tab">
            Jobs <span className="ct">· 4</span>
          </div>
          <div className="cn-tab">
            People <span className="ct">· 17</span>
          </div>
          <div className="cn-tab">
            Reviews <span className="ct">· 28</span>
          </div>
        </div>
      </div>

      {/* Body - two columns */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {/* About */}
          <section className="cn-card cn-card-pad">
            <div className="cn-section-h">
              <h2>About</h2>
              <span className="cn-link">See all details</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--neutral-700)', lineHeight: 1.6 }}>
              Surat-based embroidery workshop. 17 karigars, 6 multi-head + 4 single-needle machines.
              Specialises in bridal & festive lehenga panels, dupattas, and brand-customised work.
              Direct relationships with 12 brands across Mumbai, Delhi and Surat.
            </p>
            <div
              className="cn-wage"
              style={{ marginTop: 18, gridTemplateColumns: 'repeat(4, 1fr)' }}
            >
              <div className="b">
                <div className="l">Specialisation</div>
                <div className="v" style={{ fontSize: 13 }}>
                  Zardozi · Aari · Multi-head
                </div>
              </div>
              <div className="b">
                <div className="l">Machine capacity</div>
                <div className="v" style={{ fontSize: 13 }}>
                  10 machines
                </div>
              </div>
              <div className="b">
                <div className="l">Production / month</div>
                <div className="v" style={{ fontSize: 13 }}>
                  ~ 1,800 pcs
                </div>
              </div>
              <div className="b">
                <div className="l">Languages</div>
                <div className="v" style={{ fontSize: 13 }}>
                  Gu · Hi · En
                </div>
              </div>
            </div>
            <Anno n="1">
              Machine capacity, production/month, and languages are surfaced for buyer↔seller match
              - embroidery-specific fields not in LinkedIn.
            </Anno>
          </section>

          {/* Featured post */}
          <section className="cn-card">
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--neutral-200)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <h2 className="cn-h2" style={{ flex: 1 }}>
                Recent posts
              </h2>
              <Pill kind="gold">Featured</Pill>
              <span className="cn-link">View all</span>
            </div>
            <div className="cn-post-head">
              <Av name="AT" color="var(--indigo-700)" />
              <div className="who">
                <div className="name">Anat Textiles · Posted by Test User</div>
                <div className="sub">5 hours ago · Job opening</div>
              </div>
            </div>
            <div className="cn-post-body" style={{ paddingBottom: 8 }}>
              Hiring 4 multi-needle machine operators for festive season production. Daily-wage
              ₹650–₹900.
            </div>
            <div className="cn-post-imggrid x2">
              <Img label="workshop floor" style={{ aspectRatio: '4 / 3' }} />
              <Img label="machine close-up" style={{ aspectRatio: '4 / 3' }} />
            </div>
            <div className="cn-post-foot">
              <div className="react">
                <CIco.Heart /> 18
              </div>
              <div className="react">
                <CIco.Comment /> 5
              </div>
              <div className="react">
                <CIco.Share /> Share
              </div>
              <div className="react wa">
                <CIco.Wa /> WhatsApp
              </div>
            </div>
          </section>

          {/* Products preview */}
          <section className="cn-card cn-card-pad">
            <div className="cn-section-h">
              <h2>
                Products{' '}
                <span style={{ color: 'var(--neutral-500)', fontSize: 13, fontWeight: 500 }}>
                  · 84
                </span>
              </h2>
              <span className="cn-link">See all</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 10,
                marginTop: 12,
              }}
            >
              {[
                ['Bridal lehenga panel', '₹8,500 – ₹14,000', 'MOQ 5 pcs'],
                ['Festive dupatta · gota', '₹1,200 – ₹2,400', 'MOQ 20 pcs'],
                ['Saree pallu zardozi', '₹3,500 – ₹6,800', 'MOQ 10 pcs'],
                ['Custom panel · brand work', 'On request', 'MOQ 50 pcs'],
              ].map(([t, p, moq]) => (
                <div key={t} className="cn-prod">
                  <Img
                    label="product"
                    style={{
                      aspectRatio: '1 / 1',
                      borderRadius: 0,
                      borderLeft: 0,
                      borderRight: 0,
                      borderTop: 0,
                    }}
                  />
                  <div className="cn-prod-body">
                    <div className="cn-prod-title">{t}</div>
                    <div className="cn-prod-price">{p}</div>
                    <div className="cn-prod-meta">{moq}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Open jobs preview */}
          <section className="cn-card cn-card-pad">
            <div className="cn-section-h">
              <h2>
                Open jobs{' '}
                <span style={{ color: 'var(--neutral-500)', fontSize: 13, fontWeight: 500 }}>
                  · 4
                </span>
              </h2>
              <span className="cn-link">See all</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {[
                ['Machine operator - Multi-head', 'Daily-wage · ₹650–900/day · 4 openings'],
                ['Hand karigar - Aari', 'Piece-rate · ₹1,800–2,400/saree · 3 openings'],
                ['QC Supervisor', 'Full-time · ₹22k–28k/month · 1 opening'],
                ['Apprentice - embroidery', '₹350–500/day · 6 openings'],
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
                  <button className="cn-btn cn-btn-sm cn-btn-primary">Apply</button>
                </div>
              ))}
            </div>
          </section>

          {/* People */}
          <section className="cn-card cn-card-pad">
            <div className="cn-section-h">
              <h2>People · 17</h2>
              <span className="cn-link">See all</span>
            </div>
            <Anno n="2">
              People auto-populated from team members who list this workspace as Experience (consent
              required).
            </Anno>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 10,
                marginTop: 14,
              }}
            >
              {[
                ['TU', 'Test User', 'Founder'],
                ['MS', 'Meera Sharma', 'Master karigar'],
                ['RP', 'Rahul Patel', 'Designer'],
                ['IS', 'Imran Sheikh', 'Aari karigar'],
                ['NK', 'Nidhi Kapoor', 'QC Lead'],
              ].map(([n, name, role], i) => (
                <div key={n} style={{ textAlign: 'center' }}>
                  <Av
                    name={n}
                    color={
                      ['#8C5A3C', '#1A2A6C', 'var(--gold-700)', '#0E1844', 'var(--indigo-600)'][i]
                    }
                    size="lg"
                  />
                  <div style={{ fontWeight: 700, fontSize: 12, marginTop: 8 }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'var(--neutral-500)' }}>{role}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            className="cn-card cn-card-pad"
            style={{
              background: 'var(--indigo-700)',
              color: 'var(--neutral-0)',
              borderColor: 'var(--indigo-700)',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--gold-400)',
                letterSpacing: '0.1em',
              }}
            >
              ERP-LINKED PAGE
            </div>
            <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
              Stats are not self-reported. Drawn from a running Zari360 ERP workspace.
            </div>
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 11,
                color: 'var(--indigo-200)',
              }}
            >
              <div>● 17 karigars on payroll · this month</div>
              <div>● Attendance ledger · 24 months</div>
              <div>● ₹4.49L payroll · May 2026</div>
            </div>
          </div>

          <div className="cn-card cn-card-pad">
            <h3 className="cn-h3">Page admins</h3>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <Av name="TU" color="#8C5A3C" size="sm" />
              <Av name="MS" color="var(--indigo-700)" size="sm" />
              <button className="cn-btn cn-btn-sm">+ Add admin</button>
            </div>
          </div>

          <div className="cn-card cn-card-pad">
            <h3 className="cn-h3">Recommendations · 6</h3>
            <div
              style={{
                fontSize: 13,
                color: 'var(--neutral-700)',
                marginTop: 8,
                lineHeight: 1.5,
                padding: 10,
                background: 'var(--neutral-50)',
                borderRadius: 8,
              }}
            >
              "Bulk orders Anat ne 3 saal se time pe deliver kiye. Quality consistent."
              <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 6 }}>
                - Roop Bridal Studio · GST verified
              </div>
            </div>
            <Anno n="3">
              Reviews unlocked only after both parties confirm deal happened. Prevents fake reviews
              (PRD §3 anti-pattern).
            </Anno>
          </div>

          <div className="cn-card cn-card-pad">
            <h3 className="cn-h3">Similar workshops</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {['Sharma Karigars', 'Roop Bridal Studio', 'Kapoor Designs'].map((c) => (
                <div
                  key={c}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr auto',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: 'var(--indigo-50)',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      color: 'var(--indigo-700)',
                      fontSize: 11,
                    }}
                  >
                    {c
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{c}</div>
                  <button className="cn-btn cn-btn-sm">Follow</button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  </window.ConnectShell>
);

window.CompanyScreen = CompanyScreen;
