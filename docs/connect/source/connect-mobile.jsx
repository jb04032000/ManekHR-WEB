/* Mobile wireframes - iPhone bezel. Surat embroidery is mobile-first.
   5 frames: Feed · Marketplace browse · Product detail · Profile · Inbox thread. */

/* ---------- Reusable mobile chrome ---------- */
const mNav = (active = 'feed') => (
  <div
    style={{
      position: 'sticky',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--neutral-200)',
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      padding: '8px 4px 28px',
      fontSize: 10,
      fontWeight: 600,
    }}
  >
    {[
      ['feed', 'Home', <CIco.Home />],
      ['network', 'Network', <CIco.Network />],
      ['marketplace', 'Market', <CIco.Store />],
      ['inbox', 'Inbox', <CIco.Inbox />, 3],
      ['you', 'You', <CIco.Users />],
    ].map(([id, label, icon, badge]) => (
      <div
        key={id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: active === id ? 'var(--indigo-700)' : 'var(--neutral-500)',
          position: 'relative',
        }}
      >
        {icon}
        <span>{label}</span>
        {badge && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: '22%',
              background: 'var(--danger-500)',
              color: 'white',
              fontSize: 9,
              fontWeight: 700,
              padding: '0 4px',
              borderRadius: 6,
              minWidth: 14,
              textAlign: 'center',
            }}
          >
            {badge}
          </span>
        )}
      </div>
    ))}
  </div>
);

const mTop = ({ title = 'Connect', back = false, right = null } = {}) => (
  <div
    style={{
      position: 'sticky',
      top: 0,
      zIndex: 5,
      padding: '52px 16px 12px',
      background: 'rgba(250,248,243,0.95)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--neutral-200)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}
  >
    {back ? (
      <span style={{ fontSize: 20, color: 'var(--indigo-700)' }}>‹</span>
    ) : (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'var(--indigo-700)',
          color: 'white',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700,
          fontStyle: 'italic',
        }}
      >
        Z
      </div>
    )}
    <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', flex: 1 }}>
      {title}
    </h1>
    {right || (
      <>
        <CIco.Search style={{ color: 'var(--neutral-700)' }} />
        <div style={{ position: 'relative' }}>
          <CIco.Bell style={{ color: 'var(--neutral-700)' }} />
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -6,
              background: 'var(--danger-500)',
              color: 'white',
              fontSize: 9,
              fontWeight: 700,
              padding: '0 4px',
              borderRadius: 6,
              minWidth: 14,
              textAlign: 'center',
            }}
          >
            9+
          </span>
        </div>
      </>
    )}
  </div>
);

/* ---------- Screen 1 · Feed ---------- */
const MobileFeed = () => (
  <window.IOSDevice width={390} height={844}>
    <div
      style={{
        background: 'var(--neutral-100)',
        minHeight: '100%',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: 'var(--neutral-900)',
      }}
    >
      {mTop({ title: 'Feed' })}

      {/* Jobs banner - Jobs reached via this instead of a tab, per design doc §6.1 */}
      <div
        style={{
          margin: '10px 12px 0',
          padding: '10px 12px',
          background: 'linear-gradient(90deg, var(--indigo-50), var(--gold-100))',
          border: '1px solid var(--indigo-100)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--indigo-700)',
            color: 'white',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <CIco.Briefcase />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--indigo-800)' }}>
            3 new jobs match you
          </div>
          <div style={{ fontSize: 11, color: 'var(--indigo-700)' }}>
            Multi-head · Surat · ₹650+/day
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--indigo-700)' }}>View →</span>
      </div>

      {/* Filter strip */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '10px 16px',
          overflowX: 'auto',
          background: 'var(--neutral-50)',
          borderBottom: '1px solid var(--neutral-200)',
          fontSize: 12,
        }}
      >
        <span
          style={{
            padding: '5px 11px',
            borderRadius: 999,
            background: 'var(--indigo-700)',
            color: 'white',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          For You
        </span>
        <span
          style={{
            padding: '5px 11px',
            borderRadius: 999,
            background: 'var(--neutral-100)',
            color: 'var(--neutral-600)',
            whiteSpace: 'nowrap',
          }}
        >
          Following
        </span>
        <span
          style={{
            padding: '5px 11px',
            borderRadius: 999,
            background: 'var(--neutral-100)',
            color: 'var(--neutral-600)',
            whiteSpace: 'nowrap',
          }}
        >
          Trending
        </span>
        <span
          style={{
            padding: '5px 11px',
            borderRadius: 999,
            background: 'var(--neutral-100)',
            color: 'var(--neutral-600)',
            whiteSpace: 'nowrap',
          }}
        >
          Near you
        </span>
      </div>

      {/* Compact composer */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          padding: '12px 16px',
          background: 'var(--neutral-0)',
          borderBottom: '1px solid var(--neutral-200)',
          alignItems: 'center',
        }}
      >
        <Av name="RP" color="var(--indigo-600)" size="sm" />
        <div
          style={{
            flex: 1,
            padding: '8px 14px',
            background: 'var(--neutral-50)',
            borderRadius: 999,
            color: 'var(--neutral-400)',
            fontSize: 12,
          }}
        >
          Share something…
        </div>
        <CIco.Image style={{ color: 'var(--success-700)' }} />
        <CIco.Mic style={{ color: 'var(--danger-500)' }} />
      </div>

      {/* Posts */}
      {[
        {
          name: 'Meera Sharma',
          sub: 'Master karigar · Surat · 2h',
          av: 'MS',
          c: '#8C5A3C',
          erp: true,
          body: 'Bridal lehenga panel - gold zardozi over silk georgette. 60 hrs of work.',
          img: 'bridal panel',
          tags: ['#zardozi', '#bridal'],
          likes: 42,
        },
        {
          name: 'Anat Textiles',
          sub: 'Workshop · 5h · Hiring',
          av: 'AT',
          c: 'var(--indigo-700)',
          erp: true,
          body: 'Hiring 4 multi-needle operators · ₹650–₹900/day daily-wage',
          jobcard: true,
          likes: 18,
        },
      ].map((p, i) => (
        <article
          key={i}
          style={{ background: 'var(--neutral-0)', borderBottom: '8px solid var(--neutral-100)' }}
        >
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px 8px', alignItems: 'center' }}>
            <Av name={p.av} color={p.c} size="sm" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {p.name} {p.erp && <Verified kind="erp" />}
              </div>
              <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 1 }}>{p.sub}</div>
            </div>
            <CIco.More style={{ color: 'var(--neutral-400)' }} />
          </div>
          <div
            style={{
              padding: '0 14px 8px',
              fontSize: 13,
              color: 'var(--neutral-700)',
              lineHeight: 1.5,
            }}
          >
            {p.body}
          </div>
          {p.img && (
            <Img
              label={p.img}
              style={{ aspectRatio: '4 / 3', borderRadius: 0, borderLeft: 0, borderRight: 0 }}
            />
          )}
          {p.jobcard && (
            <div
              style={{
                margin: '0 14px 12px',
                padding: 12,
                background: 'var(--neutral-50)',
                borderRadius: 10,
                border: '1px solid var(--neutral-200)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--neutral-500)',
                  letterSpacing: '0.06em',
                }}
              >
                JOB POST
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                Multi-needle machine operator
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                <Pill>₹650–900/day</Pill>
                <Pill>4 openings</Pill>
              </div>
              <button
                className="cn-btn cn-btn-primary cn-btn-sm"
                style={{ width: '100%', marginTop: 10 }}
              >
                Apply
              </button>
            </div>
          )}
          {p.tags && (
            <div style={{ display: 'flex', gap: 4, padding: '0 14px 10px' }}>
              {p.tags.map((t) => (
                <Pill key={t} kind="indigo">
                  {t}
                </Pill>
              ))}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              borderTop: '1px solid var(--neutral-100)',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--neutral-600)',
            }}
          >
            <div
              style={{
                flex: 1,
                padding: '12px 0',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <CIco.Heart /> {p.likes}
            </div>
            <div
              style={{
                flex: 1,
                padding: '12px 0',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <CIco.Comment /> Comment
            </div>
            <div
              style={{
                flex: 1,
                padding: '12px 0',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 4,
                color: '#128C7E',
              }}
            >
              <CIco.Wa /> Share
            </div>
          </div>
        </article>
      ))}
      {mNav('feed')}
    </div>
  </window.IOSDevice>
);

/* ---------- Screen 2 · Marketplace browse ---------- */
const MobileMarket = () => (
  <window.IOSDevice width={390} height={844}>
    <div
      style={{
        background: 'var(--neutral-100)',
        minHeight: '100%',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {mTop({ title: 'Marketplace' })}

      {/* Search */}
      <div
        style={{
          padding: '10px 16px',
          background: 'var(--neutral-50)',
          borderBottom: '1px solid var(--neutral-200)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 14px',
            background: 'var(--neutral-0)',
            border: '1px solid var(--neutral-200)',
            borderRadius: 999,
            fontSize: 13,
            color: 'var(--neutral-400)',
          }}
        >
          <CIco.Search />
          <span style={{ flex: 1 }}>"silver zari", "georgette wholesale"…</span>
          <CIco.Mic style={{ color: 'var(--danger-500)' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', fontSize: 11 }}>
          <Pill kind="indigo">Surat ×</Pill>
          <Pill kind="green">Verified ×</Pill>
          <Pill>Sort: Recent ▾</Pill>
          <Pill>Filters</Pill>
        </div>
      </div>

      {/* Categories - horizontal scroll */}
      <div style={{ padding: '14px 16px 8px', background: 'var(--neutral-0)' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--neutral-700)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Categories
        </div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
          {[
            ['Fabrics', 'var(--indigo-100)'],
            ['Zari', 'var(--gold-100)'],
            ['Beads', 'var(--indigo-50)'],
            ['Zardozi mat.', 'var(--gold-100)'],
            ['Machines', 'var(--neutral-200)'],
          ].map(([n, bg]) => (
            <div key={n} style={{ flex: '0 0 auto', textAlign: 'center' }}>
              <div
                style={{ width: 54, height: 54, borderRadius: 12, background: bg, marginBottom: 6 }}
              ></div>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{n}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Product grid 2-up (per critique) */}
      <div style={{ padding: '8px 12px 12px' }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            padding: '8px 4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Trending · zardozi material</span>
          <span style={{ fontSize: 11, color: 'var(--neutral-500)', fontWeight: 500 }}>
            124 items
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            ['Pure silver zari thread', '₹2,400 – ₹2,800 /kg', 'Zari Wholesalers', true],
            ['Pearl beads · 4mm', '₹180 – ₹260 /100g', 'Surat Bead Co.', false],
            ['Dabka thread · kora', '₹3,100 – ₹3,400 /kg', 'Anand Zari', true],
            ['Sitara sequins', '₹120 – ₹160 /100g', 'Royal Embl.', false],
          ].map(([t, p, s, erp], i) => (
            <div
              key={i}
              style={{
                background: 'var(--neutral-0)',
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid var(--neutral-200)',
              }}
            >
              <Img label="product" style={{ aspectRatio: '1 / 1', borderRadius: 0, border: 0 }} />
              <div style={{ padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3, minHeight: 30 }}>
                  {t}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{p}</div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--neutral-500)',
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {s} {erp && <Verified kind="erp" />}
                </div>
                <button
                  className="cn-btn cn-btn-primary cn-btn-sm"
                  style={{ width: '100%', marginTop: 8, fontSize: 11, padding: '6px 8px' }}
                >
                  Get quotation
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {mNav('marketplace')}
    </div>
  </window.IOSDevice>
);

/* ---------- Screen 3 · Product detail ---------- */
const MobileProduct = () => (
  <window.IOSDevice width={390} height={844}>
    <div
      style={{
        background: 'var(--neutral-100)',
        minHeight: '100%',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {mTop({
        title: '',
        back: true,
        right: (
          <>
            <CIco.Bookmark style={{ color: 'var(--neutral-700)' }} />
            <CIco.Share style={{ color: 'var(--neutral-700)' }} />
          </>
        ),
      })}

      {/* Gallery */}
      <div style={{ position: 'relative' }}>
        <Img
          label="silver zari · main shot"
          style={{ aspectRatio: '1 / 1', borderRadius: 0, border: 0 }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: i === 0 ? 'var(--neutral-0)' : 'rgba(255,255,255,0.5)',
              }}
            ></span>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 16, background: 'var(--neutral-0)' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>
          Pure silver zari thread - 5 shades
        </h2>
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          <Pill kind="indigo">Threads & zari</Pill>
          <span
            style={{
              fontSize: 11,
              color: 'var(--warning-700)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            ★ 4.7 (28)
          </span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
            marginTop: 14,
            padding: 12,
            background: 'var(--neutral-50)',
            borderRadius: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--neutral-500)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Price
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
              ₹2,400–2,800
              <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--neutral-500)' }}>
                /kg
              </span>
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--neutral-500)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              MOQ
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>5 kg</div>
          </div>
        </div>

        {/* Seller mini */}
        <div
          style={{
            marginTop: 14,
            padding: 12,
            background: 'var(--neutral-50)',
            borderRadius: 10,
            display: 'grid',
            gridTemplateColumns: '40px 1fr auto',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <Av name="ZW" color="var(--gold-700)" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Zari Wholesalers</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <Verified kind="gst" />
              <Verified kind="erp" />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--neutral-500)' }}>Responds</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--success-700)' }}>~1 hr</div>
          </div>
        </div>

        {/* Specs preview */}
        <div style={{ marginTop: 14, fontSize: 13 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--neutral-700)',
              letterSpacing: '0.06em',
              marginBottom: 8,
              textTransform: 'uppercase',
            }}
          >
            Specs
          </div>
          {[
            ['Material', 'Real silver-coated, cotton core'],
            ['Shades', '5 colors'],
            ['HSN', '5605.00.10'],
          ].map(([k, v]) => (
            <div
              key={k}
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 1fr',
                padding: '6px 0',
                borderBottom: '1px solid var(--neutral-100)',
              }}
            >
              <span style={{ color: 'var(--neutral-500)' }}>{k}</span>
              <span>{v}</span>
            </div>
          ))}
          <div
            style={{
              textAlign: 'center',
              padding: '10px 0',
              fontSize: 12,
              color: 'var(--indigo-700)',
              fontWeight: 600,
            }}
          >
            See full specs ↓
          </div>
        </div>

        {/* Reviews preview - added per critique */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--neutral-700)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Reviews · 28
            </div>
            <span style={{ fontSize: 12, color: 'var(--indigo-700)', fontWeight: 600 }}>
              See all
            </span>
          </div>
          <div
            style={{ marginTop: 8, padding: 10, background: 'var(--neutral-50)', borderRadius: 8 }}
          >
            <div style={{ fontSize: 11, color: 'var(--warning-700)' }}>★★★★★</div>
            <div
              style={{ fontSize: 12, color: 'var(--neutral-700)', marginTop: 4, lineHeight: 1.4 }}
            >
              "Quality consistent. 3 saal se kharid raha hu - shades same hain har baar."
            </div>
            <div style={{ fontSize: 10, color: 'var(--neutral-500)', marginTop: 4 }}>
              Roop Bridal Studio · Verified buyer
            </div>
          </div>
        </div>

        {/* Similar products - added per critique */}
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--neutral-700)',
              letterSpacing: '0.06em',
              marginBottom: 8,
              textTransform: 'uppercase',
            }}
          >
            Similar products
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            {['Antique zari', 'Gold-tone zari', 'Kasab kit'].map((t) => (
              <div key={t} style={{ flex: '0 0 110px' }}>
                <Img label={t} style={{ aspectRatio: '1 / 1' }} />
                <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4 }}>{t}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 80 }}></div>
      </div>

      {/* Sticky CTA bar */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px 26px',
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid var(--neutral-200)',
          display: 'flex',
          gap: 8,
        }}
      >
        <button className="cn-btn cn-btn-wa" style={{ padding: '12px 14px' }}>
          <CIco.Wa />
        </button>
        <button
          className="cn-btn cn-btn-primary"
          style={{ flex: 1, padding: '12px 16px', fontSize: 13 }}
        >
          Get quotation
        </button>
      </div>
    </div>
  </window.IOSDevice>
);

/* ---------- Screen 4 · Profile ---------- */
const MobileProfile = () => (
  <window.IOSDevice width={390} height={844}>
    <div
      style={{
        background: 'var(--neutral-100)',
        minHeight: '100%',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {mTop({
        title: 'Profile',
        back: true,
        right: <CIco.More style={{ color: 'var(--neutral-700)' }} />,
      })}

      {/* Banner + avatar */}
      <div style={{ position: 'relative', background: 'var(--neutral-0)' }}>
        <Banner
          label="cover"
          style={{ height: 100, borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: 0 }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            padding: '0 16px',
          }}
        >
          <div
            style={{
              marginTop: -44,
              width: 88,
              height: 88,
              borderRadius: '50%',
              background: 'var(--indigo-100)',
              color: 'var(--indigo-700)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: 28,
              border: '4px solid var(--neutral-0)',
            }}
          >
            MS
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '10px 0' }}>
            <button className="cn-btn cn-btn-sm">Message</button>
            <button className="cn-btn cn-btn-primary cn-btn-sm">
              <CIco.Plus /> Connect
            </button>
          </div>
        </div>
        <div style={{ padding: '4px 16px 16px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
            Meera Sharma
          </h2>
          <div style={{ fontSize: 13, color: 'var(--neutral-700)', marginTop: 4 }}>
            Master karigar · Hand zardozi · Aari
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--neutral-500)',
              marginTop: 6,
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <span>Varachha, Surat</span>
            <span>12 yrs</span>
            <span>248 connections</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
            <Verified kind="erp" />
            <Verified kind="gst" />
            <Pill kind="green">Open to custom orders</Pill>
          </div>
        </div>
      </div>

      {/* Tab strip */}
      <div
        style={{
          display: 'flex',
          background: 'var(--neutral-0)',
          borderTop: '1px solid var(--neutral-200)',
          borderBottom: '1px solid var(--neutral-200)',
          position: 'sticky',
          top: 102,
          fontSize: 12,
        }}
      >
        {['About', 'Portfolio', 'Experience', 'Reviews'].map((t, i) => (
          <div
            key={t}
            style={{
              flex: 1,
              padding: '12px 0',
              textAlign: 'center',
              fontWeight: 600,
              color: i === 1 ? 'var(--indigo-700)' : 'var(--neutral-500)',
              borderBottom: i === 1 ? '2px solid var(--indigo-700)' : 'none',
            }}
          >
            {t}
          </div>
        ))}
      </div>

      {/* Portfolio tab content */}
      <div style={{ padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          {[
            'bridal panel',
            'dupatta gota',
            'saree pallu',
            'kurta aari',
            'lehenga seq.',
            'suit beads',
            'kasab accy',
            'fabric zardozi',
            'silk lehenga',
          ].map((l) => (
            <Img key={l} label={l} style={{ aspectRatio: '1 / 1', borderRadius: 4 }} />
          ))}
        </div>
      </div>
      {mNav('')}
    </div>
  </window.IOSDevice>
);

/* ---------- Screen 5 · Inbox thread ---------- */
const MobileInbox = () => (
  <window.IOSDevice width={390} height={844}>
    <div
      style={{
        background: 'var(--neutral-50)',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Top */}
      <div
        style={{
          padding: '52px 16px 12px',
          background: 'var(--neutral-0)',
          borderBottom: '1px solid var(--neutral-200)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ fontSize: 20, color: 'var(--indigo-700)' }}>‹</span>
        <Av name="RS" color="var(--gold-700)" size="sm" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            Roop Bridal <Verified kind="gst" />
          </div>
          <div style={{ fontSize: 11, color: 'var(--neutral-500)' }}>Online · Buyer · Mumbai</div>
        </div>
        <CIco.Phone style={{ color: 'var(--indigo-700)' }} />
        <CIco.Wa style={{ color: '#128C7E' }} />
      </div>

      {/* Pinned context */}
      <div
        style={{
          padding: '10px 14px',
          background: 'var(--indigo-50)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          color: 'var(--indigo-700)',
        }}
      >
        <CIco.Briefcase />
        <div style={{ flex: 1 }}>
          <b>Bridal panels</b> · 12 pcs by 15 Jul · Budget ₹8,500
        </div>
        <span style={{ fontWeight: 600 }}>View</span>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          overflow: 'auto',
        }}
      >
        <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--neutral-400)' }}>Today</div>
        <div
          style={{
            maxWidth: '78%',
            alignSelf: 'flex-start',
            padding: '10px 13px',
            background: 'var(--neutral-0)',
            border: '1px solid var(--neutral-200)',
            borderRadius: 14,
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          Hi Meera, saw your zardozi portfolio - exactly the style we need.
          <div style={{ fontSize: 9, color: 'var(--neutral-400)', marginTop: 4 }}>10:24 am</div>
        </div>
        <div
          style={{
            maxWidth: '78%',
            alignSelf: 'flex-end',
            padding: '10px 13px',
            background: 'var(--indigo-700)',
            color: 'white',
            borderRadius: 14,
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          Haan, 12 panels in 6 weeks possible. Sample bhejungi pehle?
          <div style={{ fontSize: 9, opacity: 0.7, marginTop: 4 }}>10:31 am · seen</div>
        </div>

        {/* Inline quotation */}
        <div
          style={{
            maxWidth: '82%',
            alignSelf: 'flex-start',
            padding: 12,
            background: 'var(--neutral-0)',
            border: '1px solid var(--neutral-200)',
            borderRadius: 14,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--neutral-500)',
              letterSpacing: '0.06em',
            }}
          >
            QUOTATION DRAFT
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>Bridal panel quote</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
              marginTop: 8,
              fontSize: 11,
            }}
          >
            <div>
              <span style={{ color: 'var(--neutral-500)' }}>Unit</span>
              <div style={{ fontWeight: 700 }}>₹8,500</div>
            </div>
            <div>
              <span style={{ color: 'var(--neutral-500)' }}>Qty</span>
              <div style={{ fontWeight: 700 }}>12</div>
            </div>
            <div>
              <span style={{ color: 'var(--neutral-500)' }}>Total</span>
              <div style={{ fontWeight: 700 }}>₹1,02,000</div>
            </div>
            <div>
              <span style={{ color: 'var(--neutral-500)' }}>Lead</span>
              <div style={{ fontWeight: 700 }}>6 wks</div>
            </div>
          </div>
          <button
            className="cn-btn cn-btn-primary cn-btn-sm"
            style={{ width: '100%', marginTop: 8, fontSize: 11 }}
          >
            Send quote
          </button>
        </div>

        <div
          style={{
            maxWidth: '78%',
            alignSelf: 'flex-end',
            padding: '10px 14px',
            background: 'var(--indigo-700)',
            color: 'white',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
          }}
        >
          <CIco.Mic /> 0:24 voice
        </div>
      </div>

      {/* Composer */}
      <div
        style={{
          padding: '8px 12px 26px',
          background: 'var(--neutral-0)',
          borderTop: '1px solid var(--neutral-200)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <CIco.Plus style={{ color: 'var(--neutral-500)' }} />
        <div
          style={{
            flex: 1,
            padding: '8px 14px',
            background: 'var(--neutral-100)',
            borderRadius: 999,
            fontSize: 12,
            color: 'var(--neutral-400)',
          }}
        >
          Message · voice note OK
        </div>
        <CIco.Mic style={{ color: 'var(--danger-500)' }} />
      </div>
    </div>
  </window.IOSDevice>
);

window.MobileFeed = MobileFeed;
window.MobileMarket = MobileMarket;
window.MobileProduct = MobileProduct;
window.MobileProfile = MobileProfile;
window.MobileInbox = MobileInbox;

/* ---------- Screen 6 · Mobile Lead Manager (workshop owner) ---------- */
const MobileLeadManager = () => (
  <window.IOSDevice width={390} height={844}>
    <div
      style={{
        background: 'var(--neutral-50)',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Top - sub-tab bar + page title */}
      <div
        style={{
          padding: '52px 16px 0',
          background: 'var(--neutral-0)',
          borderBottom: '1px solid var(--neutral-200)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20, color: 'var(--indigo-700)' }}>‹</span>
          <h1
            style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', flex: 1 }}
          >
            Lead Manager
          </h1>
          <CIco.Search style={{ color: 'var(--neutral-700)' }} />
          <CIco.Filter style={{ color: 'var(--neutral-700)' }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 6, marginBottom: 10 }}>
          14 active · 6 won this month
        </div>
        <div style={{ display: 'flex', gap: 0, fontSize: 12, marginTop: 4 }}>
          {[
            ['Browse', false],
            ['My leads', true],
            ['RFQ', false],
          ].map(([t, on]) => (
            <div
              key={t}
              style={{
                padding: '10px 12px',
                fontWeight: 600,
                color: on ? 'var(--indigo-700)' : 'var(--neutral-500)',
                borderBottom: '2px solid ' + (on ? 'var(--indigo-700)' : 'transparent'),
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* Stat tiles - horizontal scroll, tap to filter */}
      <div
        style={{
          padding: '12px 12px 8px',
          background: 'var(--neutral-0)',
          borderBottom: '1px solid var(--neutral-200)',
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
        }}
      >
        {[
          ['New', 8, 'info', true],
          ['Quoted', 3, 'warn'],
          ['Negotiating', 2, 'gold'],
          ['Won', 1, 'green'],
          ['Lost', 5, 'gray'],
        ].map(([l, n, k, on]) => (
          <div
            key={l}
            style={{
              flex: '0 0 auto',
              padding: '8px 14px',
              minWidth: 80,
              borderRadius: 10,
              background: on
                ? {
                    info: 'var(--info-50)',
                    warn: 'var(--warning-50)',
                    gold: 'var(--gold-100)',
                    green: 'var(--success-50)',
                    gray: 'var(--neutral-100)',
                  }[k]
                : 'var(--neutral-50)',
              border:
                '1.5px solid ' +
                (on
                  ? {
                      info: 'var(--info-500)',
                      warn: 'var(--warning-500)',
                      gold: 'var(--gold-500)',
                      green: 'var(--success-500)',
                      gray: 'var(--neutral-400)',
                    }[k]
                  : 'transparent'),
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: {
                  info: 'var(--info-700)',
                  warn: 'var(--warning-700)',
                  gold: 'var(--gold-700)',
                  green: 'var(--success-700)',
                  gray: 'var(--neutral-600)',
                }[k],
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {l}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{n}</div>
          </div>
        ))}
      </div>

      {/* Active filter row */}
      <div
        style={{
          padding: '10px 14px',
          background: 'var(--info-50)',
          borderBottom: '1px solid var(--info-100)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: 'var(--info-700)',
        }}
      >
        <span style={{ fontWeight: 700 }}>Filter: New</span>
        <span style={{ opacity: 0.7 }}>· 8 leads</span>
        <span style={{ flex: 1 }}></span>
        <span style={{ fontWeight: 700, cursor: 'pointer' }}>Clear</span>
      </div>

      {/* Lead list - card per lead */}
      <div
        style={{
          flex: 1,
          padding: '10px 12px 100px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          overflow: 'auto',
        }}
      >
        {[
          {
            av: 'DM',
            name: 'Diamond Beads',
            col: 'var(--gold-700)',
            erp: true,
            gst: true,
            product: 'Pearl beads · 4mm',
            when: '50 kg',
            value: '₹1,10,000 estimated',
            last: '5h ago',
            status: ['New', 'info'],
            cta: 'Send quote',
          },
          {
            av: 'NK',
            name: 'Nidhi Kapoor',
            col: '#8C5A3C',
            gst: false,
            product: 'Bridal panel · custom',
            when: 'Trial · 2 pcs',
            value: 'Sample request',
            last: '8h ago',
            status: ['New', 'info'],
            cta: 'Send quote',
          },
          {
            av: 'KD',
            name: 'Kavita Desai',
            col: 'var(--indigo-700)',
            gst: true,
            product: 'Pure silver zari',
            when: '20 kg',
            value: '₹52,000',
            last: '12h ago · they asked for sample',
            status: ['Quoted', 'warn'],
            cta: 'View quote',
          },
          {
            av: 'SM',
            name: 'Suresh Mehta',
            col: 'var(--indigo-800)',
            gst: true,
            product: 'Crystal stones',
            when: '5 kg',
            value: '₹12,000',
            last: 'No response · 9d',
            status: ['Quoted', 'warn'],
            cta: 'Resend quote',
            stale: true,
          },
        ].map((row, i) => (
          <div
            key={i}
            style={{
              padding: 14,
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 12,
              position: 'relative',
            }}
          >
            {row.stale && (
              <div
                style={{
                  position: 'absolute',
                  top: -7,
                  right: 12,
                  fontSize: 9,
                  padding: '2px 8px',
                  background: 'var(--danger-500)',
                  color: 'white',
                  borderRadius: 4,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }}
              >
                STALE · 9 DAYS
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Av name={row.av} color={row.col} size="sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {row.name}
                  </span>
                  {row.erp && <Verified kind="erp" />}
                  {row.gst && !row.erp && <Verified kind="gst" />}
                </div>
                <div style={{ fontSize: 10, color: 'var(--neutral-500)' }}>Buyer · {row.last}</div>
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 700,
                  background: {
                    info: 'var(--info-50)',
                    warn: 'var(--warning-50)',
                    gold: 'var(--gold-100)',
                    green: 'var(--success-50)',
                    gray: 'var(--neutral-100)',
                  }[row.status[1]],
                  color: {
                    info: 'var(--info-700)',
                    warn: 'var(--warning-700)',
                    gold: 'var(--gold-700)',
                    green: 'var(--success-700)',
                    gray: 'var(--neutral-600)',
                  }[row.status[1]],
                }}
              >
                {row.status[0]}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                padding: '8px 0',
                borderTop: '1px dashed var(--neutral-200)',
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{row.product}</div>
                <div style={{ fontSize: 11, color: 'var(--neutral-500)' }}>{row.when}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{row.value}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                className={'cn-btn cn-btn-sm ' + (row.cta === 'Send quote' ? 'cn-btn-primary' : '')}
                style={{ flex: 1, fontSize: 11 }}
              >
                {row.cta}
              </button>
              <button className="cn-btn cn-btn-sm" style={{ padding: '6px 10px' }}>
                + Note
              </button>
              <button className="cn-btn cn-btn-sm cn-btn-wa" style={{ padding: '6px 10px' }}>
                <CIco.Wa />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom tab bar */}
      {mNav('marketplace')}
    </div>
  </window.IOSDevice>
);
window.MobileLeadManager = MobileLeadManager;
