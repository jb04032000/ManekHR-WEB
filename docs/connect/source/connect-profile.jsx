/* Person Profile - embroidery-adapted (Profile module from PRD) */

const ProfileScreen = () => (
  <window.ConnectShell title="Profile" activeNav="profile">
    <div
      style={{
        padding: '20px 24px',
        display: 'grid',
        gridTemplateColumns: '1fr 320px',
        gap: 20,
        alignItems: 'start',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        {/* Profile head */}
        <div className="cn-profile-head">
          <div className="cn-profile-banner">
            <Banner
              label="cover photo · workshop / work-in-progress"
              style={{ width: '100%', height: '100%', borderRadius: 0 }}
            />
          </div>
          <div className="head-actions">
            <button className="cn-btn cn-btn-sm">Edit profile</button>
            <button className="cn-btn cn-btn-sm">
              <CIco.More />
            </button>
          </div>
          <div className="body">
            <div className="avwrap">
              <div className="av-big">MS</div>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 20,
              }}
            >
              <div>
                <h1>Meera Sharma</h1>
                <div style={{ fontSize: 14, color: 'var(--neutral-700)', marginTop: 4 }}>
                  Master karigar - Hand zardozi · Aari
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
                  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <CIco.MapPin /> Varachha, Surat
                  </span>
                  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <CIco.Globe /> Gujarati, Hindi, English
                  </span>
                  <span>12 years in industry</span>
                  <span>248 connections</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                  <Verified kind="erp" />
                  <Verified kind="gst" />
                  <Verified kind="mobile" />
                  <Pill kind="green">Open to custom orders</Pill>
                  <Pill kind="indigo">Open to work</Pill>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button className="cn-btn cn-btn-primary">
                  <CIco.Plus /> Connect
                </button>
                <button className="cn-btn">
                  <CIco.Inbox /> Message
                </button>
                <button className="cn-btn cn-btn-wa">
                  <CIco.Wa /> WhatsApp
                </button>
              </div>
            </div>

            {/* Service offerings (was mixed with engagement - fixed per critique) */}
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--neutral-700)',
                letterSpacing: '0.06em',
                marginTop: 18,
                marginBottom: 8,
                textTransform: 'uppercase',
              }}
            >
              Service offerings
            </div>
            <div className="cn-wage" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="b">
                <div className="l">Daily-wage rate</div>
                <div className="v">₹650 – ₹900</div>
              </div>
              <div className="b">
                <div className="l">Piece-rate</div>
                <div className="v">₹2,500 / saree</div>
              </div>
              <div className="b">
                <div className="l">Response time</div>
                <div className="v">~ 2 hrs</div>
              </div>
            </div>

            {/* Contact preference selector - added per critique */}
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: 'var(--neutral-50)',
                border: '1px solid var(--neutral-200)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--neutral-700)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Prefers contact via
              </div>
              <div className="cn-radio-row">
                <span className="cn-radio on">
                  <CIco.Wa /> WhatsApp
                </span>
                <span className="cn-radio">
                  <CIco.Phone /> Call
                </span>
                <span className="cn-radio">
                  <CIco.Inbox /> DM
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Annotation */}
        <Anno n="1">
          "Verified by Zari360 ERP" is the moat-signal - only users with an active ERP workspace get
          it. Sits above GST + mobile verification.
        </Anno>

        {/* About */}
        <section className="cn-card cn-card-pad">
          <div className="cn-section-h">
            <h2>About</h2>
            <span className="right">
              Gujarati · Hindi · English{' '}
              <span className="cn-link" style={{ marginLeft: 8 }}>
                Translate
              </span>
            </span>
          </div>
          <p style={{ margin: 0, color: 'var(--neutral-700)', lineHeight: 1.6, fontSize: 14 }}>
            12 years working hand zardozi and aari in Surat. Specialise in bridal lehenga panels,
            dupattas, and high-detail kasab work. Family workshop with 3 karigars under me. Looking
            for direct designer / brand orders for the wedding season.
          </p>
        </section>

        {/* Portfolio */}
        <section className="cn-card cn-card-pad">
          <div className="cn-section-h">
            <h2>
              Portfolio{' '}
              <span style={{ color: 'var(--neutral-500)', fontSize: 13, fontWeight: 500 }}>
                · 18 pieces
              </span>
            </h2>
            <span className="cn-link">See all</span>
          </div>
          <Anno n="2">
            Visual proof &gt; text. Every piece tags machine type + work type + hours.
          </Anno>
          <div
            className="cn-port-grid"
            style={{ marginTop: 14, gridTemplateColumns: 'repeat(4, 1fr)' }}
          >
            <Img label="bridal panel · zardozi" />
            <Img label="dupatta · gota patti" />
            <Img label="saree pallu · kasab" />
            <Img label="kurta · aari" />
            <Img label="lehenga · sequins" />
            <Img label="suit panel · beadwork" />
            <Img label="accessory · kasab" />
            <Img label="fabric · zardozi" />
          </div>
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              fontSize: 12,
              color: 'var(--neutral-500)',
            }}
          >
            <Pill>Hand zardozi · 6</Pill>
            <Pill>Aari · 5</Pill>
            <Pill>Gota patti · 3</Pill>
            <Pill>Kasab · 4</Pill>
          </div>
        </section>

        {/* Experience */}
        <section className="cn-card cn-card-pad">
          <div className="cn-section-h">
            <h2>Experience</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              [
                'SS',
                'var(--indigo-700)',
                'Lead karigar · Sharma Karigars (self)',
                'Owner & lead karigar · Workshop',
                'May 2018 – Present · 8 yrs',
                'Built a 3-karigar workshop after 5 yrs as employee. Direct orders from designers and brands.',
              ],
              [
                'RB',
                'var(--gold-700)',
                'Senior karigar · Roop Bridal Studio',
                'Bridal lehenga specialist',
                'Jan 2014 – Apr 2018 · 4 yrs',
                'Bridal lehenga zardozi work. ~140 lehengas/year, 6-person zardozi team.',
              ],
            ].map(([n, c, title, role, time, desc]) => (
              <div key={n} style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: 14 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    background: 'var(--neutral-100)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    color: c,
                  }}
                >
                  {n}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
                  <div style={{ fontSize: 13, color: 'var(--neutral-600)' }}>{role}</div>
                  <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginTop: 2 }}>
                    {time}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--neutral-700)',
                      marginTop: 8,
                      lineHeight: 1.5,
                    }}
                  >
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Skills */}
        <section className="cn-card cn-card-pad">
          <div className="cn-section-h">
            <h2>Skills & endorsements</h2>
            <span className="cn-link">Add skill</span>
          </div>
          <Anno n="3">
            Pre-built embroidery taxonomy - no free-text. Endorsements come from connections you've
            worked with.
          </Anno>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
            {[
              ['Hand zardozi', 42, true],
              ['Aari', 28, true],
              ['Gota patti', 18, false],
              ['Kasab work', 22, false],
              ['Sequins / beadwork', 11, false],
              ['Bridal embroidery', 31, true],
            ].map(([s, ct, top]) => (
              <div
                key={s}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'var(--neutral-50)',
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {s} {top && <Pill kind="gold">Top skill</Pill>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 2 }}>
                    {ct} endorsements
                  </div>
                </div>
                <button className="cn-btn cn-btn-sm">+ Endorse</button>
              </div>
            ))}
          </div>
        </section>

        {/* Recommendations */}
        <section className="cn-card cn-card-pad">
          <div className="cn-section-h">
            <h2>Recommendations</h2>
            <span className="cn-link">Ask for one</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 12 }}>
              <Av name="KD" color="var(--indigo-700)" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  Kavita Desai · Designer, Roop Bridal Studio
                </div>
                <div style={{ fontSize: 11, color: 'var(--neutral-500)' }}>
                  Worked together · 2014–2018
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--neutral-700)',
                    marginTop: 8,
                    lineHeight: 1.5,
                  }}
                >
                  "Meera ka kaam fast bhi hai aur fine bhi. 4 saal mein kabhi delay nahi hua. Bridal
                  lehenga zardozi ke liye Surat mein top karigar."
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* RIGHT RAIL */}
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
            ERP-LINKED · MOAT SIGNAL
          </div>
          <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
            This profile is backed by real operational data - active workspace, attendance, payroll.
            Not just a self-claim.
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--indigo-200)' }}>
            ERP active since Jan 2024 · 3 karigars on roll
          </div>
        </div>

        <div className="cn-card cn-card-pad">
          <h3 className="cn-h3" style={{ marginBottom: 10 }}>
            People also viewed
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['NP', 'Neha Patel', 'Aari karigar · Surat', '#0E1844'],
              ['VS', 'Vikas Soni', 'Computerized embroidery · 7 yrs', '#8C5A3C'],
              ['RM', 'Rashida Memon', 'Hand zardozi · 9 yrs', '#142158'],
              ['HJ', 'Hardik Joshi', 'Multi-needle · Surat', '#8C7019'],
            ].map(([n, name, sub, c]) => (
              <div
                key={n}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr auto',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <Av name={n} color={c} size="sm" />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'var(--neutral-500)' }}>{sub}</div>
                </div>
                <button className="cn-btn cn-btn-sm">Connect</button>
              </div>
            ))}
          </div>
        </div>

        <div className="cn-card cn-card-pad">
          <h3 className="cn-h3" style={{ marginBottom: 10 }}>
            Engagement (30d)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="cn-stat" style={{ padding: '12px 14px' }}>
              <div className="cn-stat-lab">Profile views</div>
              <div className="cn-stat-val">126</div>
            </div>
            <div className="cn-stat" style={{ padding: '12px 14px' }}>
              <div className="cn-stat-lab">Search appearances</div>
              <div className="cn-stat-val">38</div>
            </div>
            <div className="cn-stat" style={{ padding: '12px 14px' }}>
              <div className="cn-stat-lab">Post impressions</div>
              <div className="cn-stat-val">2.1k</div>
            </div>
            <div className="cn-stat" style={{ padding: '12px 14px' }}>
              <div className="cn-stat-lab">Inquiries</div>
              <div className="cn-stat-val">9</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </window.ConnectShell>
);

window.ProfileScreen = ProfileScreen;
