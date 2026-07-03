/* New-user / minimal-karigar persona empty states
   Persona: Bhavin, 22, daily-wage karigar, one phone photo, no portfolio. */

const EmptyProfileScreen = () => (
  <window.ConnectShell title="Profile" activeNav="profile" hideTopSearch={true}>
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
        <div className="cn-profile-head">
          <div
            className="cn-profile-banner"
            style={{ background: 'var(--neutral-100)', display: 'grid', placeItems: 'center' }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: 'var(--neutral-0)',
                border: '1px dashed var(--neutral-300)',
                borderRadius: 999,
                fontSize: 12,
                color: 'var(--neutral-500)',
                cursor: 'pointer',
              }}
            >
              <CIco.Image /> Add a cover photo
            </div>
          </div>
          <div className="head-actions">
            <button className="cn-btn cn-btn-sm">Edit profile</button>
            <button className="cn-btn cn-btn-sm">
              <CIco.More />
            </button>
          </div>
          <div className="body">
            <div className="avwrap">
              <div
                className="av-big"
                style={{ background: 'var(--neutral-200)', color: 'var(--neutral-500)' }}
              >
                BR
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 20,
              }}
            >
              <div style={{ flex: 1 }}>
                <h1>Bhavin Rana</h1>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--neutral-400)',
                    marginTop: 6,
                    fontStyle: 'italic',
                  }}
                >
                  Add a headline - e.g. "Multi-needle operator · 5 yrs · Surat"
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--neutral-500)',
                    marginTop: 10,
                    display: 'flex',
                    gap: 14,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <CIco.MapPin /> Surat
                  </span>
                  <span>0 connections</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                  <Verified kind="mobile" />
                  <Pill
                    style={{
                      borderStyle: 'dashed',
                      background: 'transparent',
                      border: '1px dashed var(--neutral-300)',
                      color: 'var(--neutral-500)',
                    }}
                  >
                    + Add GST or Udyam
                  </Pill>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    padding: '12px 16px',
                    background: 'var(--indigo-50)',
                    border: '1px solid var(--indigo-100)',
                    borderRadius: 10,
                    fontSize: 12,
                    color: 'var(--indigo-700)',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>Profile is 20% complete</div>
                  <div>Recruiters skip incomplete profiles</div>
                </div>
              </div>
            </div>

            {/* "Open to" toggle row - moved from badge soup per critique */}
            <div
              style={{
                marginTop: 18,
                padding: 14,
                background: 'var(--neutral-50)',
                border: '1px solid var(--neutral-200)',
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--neutral-700)',
                  letterSpacing: '0.06em',
                  marginBottom: 10,
                  textTransform: 'uppercase',
                }}
              >
                I am open to · toggle
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  ['Work · daily-wage', true],
                  ['Work · piece-rate', true],
                  ['Work · monthly', false],
                  ['Custom orders', false],
                  ['Bulk deals', false],
                ].map(([l, on]) => (
                  <div
                    key={l}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      borderRadius: 999,
                      background: on ? 'var(--success-50)' : 'var(--neutral-0)',
                      border: '1px solid ' + (on ? 'var(--success-500)' : 'var(--neutral-200)'),
                      fontSize: 12,
                      color: on ? 'var(--success-700)' : 'var(--neutral-500)',
                      fontWeight: 500,
                    }}
                  >
                    <span
                      style={{
                        width: 24,
                        height: 14,
                        borderRadius: 999,
                        background: on ? 'var(--success-500)' : 'var(--neutral-300)',
                        position: 'relative',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: on ? 12 : 2,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: 'white',
                        }}
                      ></span>
                    </span>
                    {l}
                  </div>
                ))}
              </div>
            </div>

            {/* Contact preference - added per critique */}
            <div
              style={{
                marginTop: 12,
                padding: 14,
                background: 'var(--neutral-50)',
                border: '1px solid var(--neutral-200)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--neutral-700)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Contact preference
                </div>
                <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginTop: 2 }}>
                  How should people reach you for inquiries / job invites?
                </div>
              </div>
              <div className="cn-radio-row">
                <span className="cn-radio on">
                  <CIco.Wa /> WhatsApp
                </span>
                <span className="cn-radio">
                  <CIco.Phone /> Call
                </span>
                <span className="cn-radio">
                  <CIco.Inbox /> Connect DM
                </span>
              </div>
            </div>

            <Anno n="1">
              Persona = volume user. 22-year-old daily-wage karigar, just signed up. NOT a portfolio
              specialist.
            </Anno>
          </div>
        </div>

        {/* Portfolio empty */}
        <section className="cn-card cn-card-pad">
          <div className="cn-section-h">
            <h2>Portfolio</h2>
          </div>
          <div
            style={{
              padding: 28,
              textAlign: 'center',
              border: '1px dashed var(--neutral-300)',
              borderRadius: 12,
              marginTop: 6,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                margin: '0 auto',
                background: 'var(--neutral-100)',
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--neutral-400)',
              }}
            >
              <CIco.Image />
            </div>
            <div style={{ marginTop: 12, fontWeight: 700, fontSize: 14 }}>
              Show your work - even one photo is enough
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--neutral-500)',
                marginTop: 6,
                maxWidth: 360,
                margin: '6px auto 0',
                lineHeight: 1.5,
              }}
            >
              Karigars with one or more portfolio pieces get 4× more recruiter views. Phone photo is
              fine.
            </div>
            <div style={{ display: 'inline-flex', gap: 8, marginTop: 16 }}>
              <button className="cn-btn cn-btn-primary">
                <CIco.Image /> Upload photo
              </button>
              <button className="cn-btn">
                <CIco.Video /> Upload short video
              </button>
              <button className="cn-btn">
                <CIco.Wa /> Import from WhatsApp
              </button>
            </div>
            <Anno n="2">
              Video portfolio for industry - added per critique. WhatsApp import is killer for this
              market.
            </Anno>
          </div>
        </section>

        {/* Skills - pre-populated taxonomy with picker */}
        <section className="cn-card cn-card-pad">
          <div className="cn-section-h">
            <h2>Skills</h2>
            <span className="cn-link">Add skill</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--neutral-500)', marginBottom: 12 }}>
            Pick from the embroidery taxonomy - these decide which jobs and inquiries find you.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Pill kind="indigo">Multi-needle operator ✓</Pill>
            <Pill kind="indigo">Computerized ✓</Pill>
            <Pill>+ Aari</Pill>
            <Pill>+ Hand zardozi</Pill>
            <Pill>+ Gota patti</Pill>
            <Pill>+ Kasab</Pill>
            <Pill>+ Beadwork</Pill>
            <Pill>+ Designing</Pill>
            <Pill>+ Pattern-making</Pill>
            <Pill style={{ color: 'var(--indigo-700)' }}>See all 24 skills</Pill>
          </div>
        </section>

        {/* Experience - empty with single CTA */}
        <section className="cn-card cn-card-pad">
          <div className="cn-section-h">
            <h2>Experience</h2>
          </div>
          <div
            style={{
              padding: 22,
              textAlign: 'center',
              border: '1px dashed var(--neutral-300)',
              borderRadius: 12,
              marginTop: 6,
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--neutral-600)' }}>
              Add where you worked. Doesn't need to be formal - "5 yrs at Sharma workshop" is
              enough.
            </div>
            <button className="cn-btn cn-btn-sm" style={{ marginTop: 12 }}>
              + Add experience
            </button>
          </div>
        </section>
      </div>

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
            UNLOCK ERP-LINKED BADGE
          </div>
          <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
            If your workshop uses Zari360 ERP, link your profile to it. ERP-linked profiles get 6×
            more inquiries.
          </div>
          <button className="cn-btn cn-btn-gold" style={{ width: '100%', marginTop: 12 }}>
            Link to my workshop
          </button>
        </div>

        <div className="cn-card cn-card-pad">
          <h3 className="cn-h3">Engagement (30d)</h3>
          {/* Profile views moved here per critique */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            <div className="cn-stat" style={{ padding: '12px 14px' }}>
              <div className="cn-stat-lab">Profile views</div>
              <div className="cn-stat-val" style={{ color: 'var(--neutral-400)' }}>
                0
              </div>
            </div>
            <div className="cn-stat" style={{ padding: '12px 14px' }}>
              <div className="cn-stat-lab">Search appearances</div>
              <div className="cn-stat-val" style={{ color: 'var(--neutral-400)' }}>
                0
              </div>
            </div>
          </div>
          <div
            style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 10, lineHeight: 1.4 }}
          >
            Stats appear once others discover you. Complete profile → discoverable.
          </div>
        </div>

        <div className="cn-card cn-card-pad">
          <h3 className="cn-h3">Recommended next steps</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {[
              ['Add 1 work photo', 'Phone gallery / WhatsApp'],
              ['Pick 3 more skills', '~ 30 seconds'],
              ['Add 1 work experience', 'Even "previous workshop"'],
              ['Request a recommendation', 'Ask someone you worked with'],
            ].map(([t, s]) => (
              <div
                key={t}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 10,
                  background: 'var(--neutral-50)',
                  borderRadius: 8,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: '1.5px solid var(--neutral-300)',
                    display: 'inline-block',
                  }}
                ></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t}</div>
                  <div style={{ fontSize: 11, color: 'var(--neutral-500)' }}>{s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  </window.ConnectShell>
);

window.EmptyProfileScreen = EmptyProfileScreen;
