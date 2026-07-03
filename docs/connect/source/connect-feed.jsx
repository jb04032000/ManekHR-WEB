/* Connect Home / Feed
   Three-column LinkedIn-style layout adapted for the embroidery industry. */

const FeedScreen = () => (
  <window.ConnectShell
    title="Home"
    activeNav="feed"
    counts={{ network: 4, jobs: 2, inbox: 3, notifications: '9+' }}
  >
    <div className="cn-feed-layout">
      {/* LEFT RAIL ─ profile + shortcuts */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="cn-card" style={{ overflow: 'hidden' }}>
          <div
            style={{
              height: 64,
              background: 'linear-gradient(135deg, var(--indigo-100), var(--gold-100))',
            }}
          ></div>
          <div style={{ padding: '0 14px 16px', textAlign: 'center' }}>
            <div style={{ marginTop: -28, display: 'flex', justifyContent: 'center' }}>
              <Av name="RP" color="var(--indigo-600)" size="lg" />
            </div>
            <div style={{ marginTop: 10, fontWeight: 700, fontSize: 15 }}>Rahul Patel</div>
            <div
              style={{ fontSize: 12, color: 'var(--neutral-500)', marginTop: 2, lineHeight: 1.4 }}
            >
              Embroidery designer · Aari & zardozi
              <br />
              Surat, Gujarat
            </div>
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                gap: 4,
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Verified kind="erp" />
              <Verified kind="gst" />
            </div>
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
                  strokeDashoffset={2 * Math.PI * 22 * (1 - 0.65)}
                  strokeLinecap="round"
                  transform="rotate(-90 28 28)"
                />
              </svg>
              <div className="pct">65%</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>Complete your profile</div>
              <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 2 }}>
                Add portfolio + skills to unlock recommendations
              </div>
            </div>
          </div>
        </div>

        <div className="cn-card cn-card-pad">
          <h3 className="cn-h3" style={{ marginBottom: 12 }}>
            Quick Links
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            <div style={{ padding: '6px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span>Saved posts</span>
              <span style={{ color: 'var(--neutral-500)' }}>12</span>
            </div>
            <div style={{ padding: '6px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span>My RFQs</span>
              <span style={{ color: 'var(--neutral-500)' }}>3</span>
            </div>
            <div style={{ padding: '6px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span>Applied jobs</span>
              <span style={{ color: 'var(--neutral-500)' }}>5</span>
            </div>
            <div style={{ padding: '6px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span>My storefront</span>
              <CIco.ArrowRight />
            </div>
          </div>
        </div>

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
            FROM YOUR ERP
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
            17 active karigars, ₹4.49L payroll. Your factory's track record is visible to buyers.
          </div>
          <div className="cn-link" style={{ marginTop: 8 }}>
            Open ERP → Dashboard
          </div>
        </div>
      </aside>

      {/* MIDDLE COLUMN ─ composer + posts */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Composer */}
        <div className="cn-card">
          <div className="cn-composer">
            <Av name="RP" color="var(--indigo-600)" />
            <div className="stub">Share a design, a job opening, or what you're working on…</div>
          </div>
          <div className="cn-composer-actions">
            <div className="cn-composer-action">
              <CIco.Image style={{ color: 'var(--success-700)' }} /> Photo / Carousel
            </div>
            <div className="cn-composer-action">
              <CIco.Video style={{ color: 'var(--info-700)' }} /> Video
            </div>
            <div className="cn-composer-action">
              <CIco.Doc style={{ color: 'var(--warning-700)' }} /> Document
            </div>
            <div className="cn-composer-action">
              <CIco.Briefcase style={{ color: 'var(--indigo-700)' }} /> Job / RFQ
            </div>
            <div className="cn-composer-action">
              <CIco.Mic style={{ color: 'var(--danger-500)' }} /> Voice note
            </div>
          </div>
        </div>

        {/* Feed switch */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 4px',
          }}
        >
          <div style={{ display: 'flex', gap: 4, fontSize: 13 }}>
            <span
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: 'var(--neutral-0)',
                border: '1px solid var(--neutral-200)',
                fontWeight: 600,
                color: 'var(--neutral-900)',
              }}
            >
              For You
            </span>
            <span style={{ padding: '6px 12px', color: 'var(--neutral-500)' }}>Following</span>
            <span style={{ padding: '6px 12px', color: 'var(--neutral-500)' }}>
              Trending designs
            </span>
            <span style={{ padding: '6px 12px', color: 'var(--neutral-500)' }}>
              Near you · Surat
            </span>
          </div>
          <Anno n="1">Algo + Following toggle (Phase 4)</Anno>
        </div>

        {/* Post 1 - photo post from a karigar */}
        <article className="cn-card">
          <div className="cn-post-head">
            <Av name="MS" color="#8C5A3C" />
            <div className="who">
              <div className="name">
                Meera Sharma <Verified kind="erp" />
              </div>
              <div className="sub">
                Master karigar · Hand zardozi · 12 yrs · Surat &nbsp;·&nbsp; 2h
              </div>
            </div>
            <CIco.More style={{ color: 'var(--neutral-400)' }} />
          </div>
          <div className="cn-post-body">
            Bridal lehenga panel - gold zardozi over silk georgette. 60 hrs of work. Looking for
            similar custom orders, July onwards.
          </div>
          <div className="cn-post-imggrid x3">
            <Img label="bridal lehenga panel · close-up" style={{ aspectRatio: '1 / 1' }} />
            <Img label="full panel" />
            <Img label="detail · gold thread" />
          </div>
          <div style={{ display: 'flex', gap: 4, padding: '0 16px 10px' }}>
            <Pill kind="indigo">#zardozi</Pill>
            <Pill kind="indigo">#bridal</Pill>
            <Pill>Open to custom orders</Pill>
          </div>
          <div className="cn-post-foot">
            <div className="react">
              <CIco.Heart /> 42
            </div>
            <div className="react">
              <CIco.Comment /> 8
            </div>
            <div className="react">
              <CIco.Share /> Share
            </div>
            <div className="react wa">
              <CIco.Wa /> WhatsApp
            </div>
          </div>
        </article>

        {/* Post 2 - job requirement */}
        <article className="cn-card">
          <div className="cn-post-head">
            <Av name="AT" color="var(--indigo-700)" />
            <div className="who">
              <div className="name">
                Anat Textiles <Pill kind="green">Hiring</Pill> <Verified kind="erp" />
              </div>
              <div className="sub">Workshop · 17 karigars · Posted by Test User · 5h</div>
            </div>
            <CIco.More style={{ color: 'var(--neutral-400)' }} />
          </div>
          <div className="cn-post-body" style={{ paddingBottom: 0 }}>
            <b>Hiring 4 multi-needle machine operators</b> for festive season production. Daily-wage
            ₹650–₹900 based on machine experience.
          </div>
          <div
            style={{
              margin: '12px 16px',
              padding: 14,
              background: 'var(--neutral-50)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--neutral-500)',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                  }}
                >
                  JOB POST · COMPOSED FROM /JOBS
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>
                  Machine operator - Multi-head computerized
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <Pill>Daily-wage</Pill>
                  <Pill>4 openings</Pill>
                  <Pill>Surat - Varachha</Pill>
                  <Pill>2+ yrs</Pill>
                </div>
              </div>
              <button className="cn-btn cn-btn-primary cn-btn-sm">Apply</button>
            </div>
          </div>
          <div className="cn-post-foot">
            <div className="react">
              <CIco.Heart /> 18
            </div>
            <div className="react">
              <CIco.Comment /> 5
            </div>
            <div className="react">
              <CIco.Bookmark /> Save
            </div>
            <div className="react wa">
              <CIco.Wa /> WhatsApp
            </div>
          </div>
        </article>

        {/* Post 3 - product post (compact) */}
        <article className="cn-card">
          <div className="cn-post-head">
            <Av name="ZW" color="var(--gold-700)" />
            <div className="who">
              <div className="name">
                Zari Wholesalers · Surat <Verified kind="gst" />
              </div>
              <div className="sub">New product · 1d</div>
            </div>
            <CIco.More style={{ color: 'var(--neutral-400)' }} />
          </div>
          <div className="cn-post-body" style={{ paddingBottom: 8 }}>
            Fresh stock - pure silver zari thread, 5 shades. MOQ 5 kg.
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '180px 1fr',
              gap: 14,
              padding: '0 16px 14px',
            }}
          >
            <Img label="silver zari · 5 shades" style={{ aspectRatio: '1 / 1' }} />
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--neutral-500)',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                }}
              >
                PRODUCT · COMPOSED FROM /MARKETPLACE
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>
                Pure silver zari thread - assorted
              </div>
              <div style={{ fontSize: 13, color: 'var(--neutral-700)', marginTop: 6 }}>
                ₹2,400 – ₹2,800 / kg &nbsp;·&nbsp; MOQ 5 kg
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button className="cn-btn cn-btn-primary cn-btn-sm">Get quotation</button>
                <button className="cn-btn cn-btn-wa cn-btn-sm">
                  <CIco.Wa /> WhatsApp
                </button>
              </div>
            </div>
          </div>
        </article>
      </main>

      {/* RIGHT RAIL ─ trending, suggestions, ads */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="cn-card">
          <div
            style={{
              padding: '14px 16px 4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <h3 className="cn-h3">Trending designs</h3>
            <span className="cn-link">See all</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              padding: '8px 16px 16px',
            }}
          >
            <Img label="bridal lehenga" style={{ aspectRatio: '1 / 1' }} />
            <Img label="kurta panel" style={{ aspectRatio: '1 / 1' }} />
            <Img label="dupatta gota" style={{ aspectRatio: '1 / 1' }} />
            <Img label="kasab saree" style={{ aspectRatio: '1 / 1' }} />
          </div>
        </div>

        <div className="cn-card">
          <div
            style={{
              padding: '14px 16px 6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <h3 className="cn-h3">Karigars near you</h3>
            <span className="cn-link">See all</span>
          </div>
          <div className="cn-mini">
            {[
              ['IS', 'Imran Sheikh', 'Aari · 8 yrs · Varachha', '#1A2A6C'],
              ['PJ', 'Priya Joshi', 'Hand embroidery · 5 yrs', '#8C5A3C'],
              ['RK', 'Ramesh Kumar', 'Computerized · 15 yrs', '#0E1844'],
            ].map(([n, name, sub, c]) => (
              <div key={n} className="cn-mini-row">
                <Av name={n} color={c} size="sm" />
                <div className="meta">
                  <div className="n">{name}</div>
                  <div className="s">{sub}</div>
                </div>
                <button className="cn-btn cn-btn-sm">
                  <CIco.Plus /> Connect
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="cn-card cn-card-pad">
          <h3 className="cn-h3" style={{ marginBottom: 10 }}>
            Live RFQs in Surat
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: 10, background: 'var(--neutral-50)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Need 200 m georgette · gold-tone</div>
              <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 2 }}>
                Buyer: Verified · Posted 1h
              </div>
            </div>
            <div style={{ padding: 10, background: 'var(--neutral-50)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Bulk zardozi karigars · 6 wks</div>
              <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 2 }}>
                Buyer: ERP-linked · Posted 3h
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 10,
            color: 'var(--neutral-400)',
            textAlign: 'center',
            padding: '0 8px',
          }}
        >
          About · Privacy · Terms · DPDP
          <br />© 2026 Zari360
        </div>
      </aside>
    </div>
  </window.ConnectShell>
);

window.FeedScreen = FeedScreen;
