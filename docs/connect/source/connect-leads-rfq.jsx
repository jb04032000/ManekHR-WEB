/* Lead Manager full page, RFQ Board full, Empty states gallery, WhatsApp handoff modal */

const LeadManager = () => {
  const stages = [
    { id: 'new', label: 'New', ct: 8, color: 'var(--info-700)', bg: 'var(--info-50)' },
    { id: 'quoted', label: 'Quoted', ct: 3, color: 'var(--warning-700)', bg: 'var(--warning-50)' },
    {
      id: 'negotiating',
      label: 'Negotiating',
      ct: 2,
      color: 'var(--gold-700)',
      bg: 'var(--gold-100)',
    },
    { id: 'won', label: 'Won', ct: 1, color: 'var(--success-700)', bg: 'var(--success-50)' },
    { id: 'lost', label: 'Lost', ct: 5, color: 'var(--neutral-600)', bg: 'var(--neutral-100)' },
  ];

  return (
    <window.ConnectShell title="Marketplace" activeNav="marketplace">
      <SubTabs
        active="leads"
        items={[
          ['browse', 'Browse', null],
          ['leads', 'My leads', 14],
          ['rfq', 'RFQ board', 23],
        ]}
      />

      <div
        style={{
          padding: '18px 24px 6px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: 'var(--neutral-0)',
          borderBottom: '1px solid var(--neutral-200)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
            Lead Manager
          </h1>
          <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginTop: 4 }}>
            Inquiries received on your 84 products · Last 30 days
          </div>
        </div>
        <div style={{ flex: 1 }}></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="cn-btn">All products ▾</button>
          <button className="cn-btn">This month ▾</button>
          <button className="cn-btn">
            <CIco.Filter /> Filter
          </button>
        </div>
      </div>

      {/* Stat row - clickable filter tiles (HubSpot/Pipedrive pattern) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 0,
          background: 'var(--neutral-0)',
          borderBottom: '1px solid var(--neutral-200)',
        }}
      >
        {stages.map((s, i) => (
          <div
            key={s.id}
            style={{
              padding: '16px 18px',
              borderRight: i < 4 ? '1px solid var(--neutral-200)' : 'none',
              background: i === 0 ? s.bg : 'transparent',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            {i === 0 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: s.color,
                }}
              ></div>
            )}
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: s.color,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {s.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>{s.ct}</div>
            <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 2 }}>
              {
                [
                  'inquiries waiting',
                  'quotes pending',
                  'in discussion',
                  'closed this month',
                  'lost',
                ][i]
              }
            </div>
          </div>
        ))}
      </div>

      <Anno n="1">
        Stat tiles are clickable filters (Pipedrive / HubSpot pattern - stats that don't act are
        dead pixels). Filter chip below shows the active slice + a 'stale leads' chip.
      </Anno>

      {/* Search + filter row (added per critique) */}
      <div
        style={{
          padding: '12px 24px',
          background: 'var(--neutral-0)',
          borderBottom: '1px solid var(--neutral-200)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          className="cn-globalsearch"
          style={{ width: 'auto', flex: 1, background: 'var(--neutral-50)' }}
        >
          <CIco.Search />
          <span>Search by buyer name or product…</span>
        </div>
        <Pill kind="indigo">New ×</Pill>
        <Pill style={{ background: 'var(--danger-50)', color: 'var(--danger-700)' }}>
          Stale &gt; 7 days · 4
        </Pill>
        <button className="cn-btn">
          <CIco.Filter /> More filters
        </button>
      </div>

      {/* Tabs */}
      <div className="cn-tabs">
        <div className="cn-tab is-active">
          All <span className="ct">· 14</span>
        </div>
        {stages.map((s) => (
          <div key={s.id} className="cn-tab">
            {s.label} <span className="ct">· {s.ct}</span>
          </div>
        ))}
      </div>

      {/* Lead table */}
      <div style={{ padding: '14px 24px 24px' }}>
        <div className="cn-card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--neutral-50)' }}>
                {['Buyer', 'Inquiry', 'Quantity / value', 'Last action', 'Status', 'Actions'].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--neutral-500)',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--neutral-200)',
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {[
                {
                  av: 'RS',
                  name: 'Roop Bridal Studio',
                  col: 'var(--gold-700)',
                  erp: false,
                  gst: true,
                  product: 'Bridal lehenga panels',
                  when: '12 pcs · 6 wks',
                  value: '₹1,02,000 estimated',
                  last: 'You sent a draft quote · 12m ago',
                  status: ['Negotiating', 'gold'],
                  cta: 'View quote',
                },
                {
                  av: 'KD',
                  name: 'Kavita Desai',
                  col: 'var(--indigo-700)',
                  gst: true,
                  product: 'Pure silver zari thread',
                  when: '20 kg',
                  value: '₹52,000 estimated',
                  last: 'They asked for sample · 2h ago',
                  status: ['Quoted', 'warn'],
                  cta: 'View quote',
                },
                {
                  av: 'DM',
                  name: 'Diamond Beads',
                  col: 'var(--gold-700)',
                  erp: true,
                  gst: true,
                  product: 'Pearl beads · 4mm',
                  when: '50 kg',
                  value: '₹1,10,000 estimated',
                  last: 'New inquiry · 5h ago',
                  status: ['New', 'info'],
                  cta: 'Send quote',
                },
                {
                  av: 'NK',
                  name: 'Nidhi Kapoor (designer)',
                  col: '#8C5A3C',
                  gst: false,
                  product: 'Bridal panel · custom',
                  when: 'Trial · 2 pcs',
                  value: 'Sample request',
                  last: 'New inquiry · 8h ago',
                  status: ['New', 'info'],
                  cta: 'Send quote',
                },
                {
                  av: 'SM',
                  name: 'Suresh Mehta',
                  col: 'var(--indigo-800)',
                  gst: true,
                  product: 'Crystal stones',
                  when: '5 kg',
                  value: '₹12,000 estimated',
                  last: 'No response · 9d',
                  status: ['Quoted', 'warn'],
                  cta: 'Resend quote',
                  stale: true,
                },
                {
                  av: 'AB',
                  name: 'Anand Brands',
                  col: 'var(--indigo-800)',
                  erp: true,
                  gst: true,
                  product: 'Festive dupatta · gota',
                  when: '200 pcs',
                  value: '₹2,80,000 estimated',
                  last: 'Order confirmed · 2d ago',
                  status: ['Won', 'green'],
                  cta: null,
                },
                {
                  av: 'TT',
                  name: 'Tina Trivedi (buyer)',
                  col: '#8C7019',
                  gst: false,
                  product: 'Crystal stones',
                  when: '500g sample',
                  value: '-',
                  last: 'No response · 14d',
                  status: ['Lost', 'gray'],
                  cta: 'Reopen',
                  dim: true,
                },
              ].map((row, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: '1px solid var(--neutral-100)',
                    opacity: row.dim ? 0.55 : 1,
                  }}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          border: '1.5px solid var(--neutral-300)',
                        }}
                      ></span>
                      <Av name={row.av} color={row.col} size="sm" />
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          {row.name}
                          {row.erp && <Verified kind="erp" />}
                          {row.gst && !row.erp && <Verified kind="gst" />}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 2 }}>
                          Buyer
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{row.product}</div>
                    <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 2 }}>
                      {row.when}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600 }}>
                    {row.value}
                  </td>
                  <td
                    style={{
                      padding: '14px 16px',
                      fontSize: 12,
                      color: row.stale ? 'var(--danger-700)' : 'var(--neutral-600)',
                      fontWeight: row.stale ? 600 : 400,
                    }}
                  >
                    {row.stale && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          marginRight: 6,
                        }}
                      >
                        ●{' '}
                      </span>
                    )}
                    {row.last}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
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
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: {
                            info: 'var(--info-500)',
                            warn: 'var(--warning-500)',
                            gold: 'var(--gold-500)',
                            green: 'var(--success-500)',
                            gray: 'var(--neutral-400)',
                          }[row.status[1]],
                        }}
                      ></span>
                      {row.status[0]}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="cn-btn cn-btn-sm">+ Note</button>
                      {row.cta && (
                        <button
                          className={
                            'cn-btn cn-btn-sm ' + (row.cta === 'Send quote' ? 'cn-btn-primary' : '')
                          }
                        >
                          {row.cta}
                        </button>
                      )}
                      <button className="cn-btn cn-btn-sm cn-btn-wa">
                        <CIco.Wa />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </window.ConnectShell>
  );
};
window.LeadManager = LeadManager;

/* ---------- Marketplace · RFQ Board ---------- */
const RFQBoard = () => (
  <window.ConnectShell title="Marketplace" activeNav="marketplace">
    <SubTabs
      active="rfq"
      items={[
        ['browse', 'Browse', null],
        ['leads', 'My leads', 14],
        ['rfq', 'RFQ board', 23],
      ]}
    />

    <div
      style={{
        padding: '18px 24px 0',
        background: 'var(--neutral-0)',
        borderBottom: '1px solid var(--neutral-200)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
            RFQ board
          </h1>
          <div style={{ fontSize: 13, color: 'var(--neutral-500)', marginTop: 4 }}>
            Buyers post requirements · sellers respond with quotes. <b>23 open RFQs</b> match your
            categories.
          </div>
        </div>
        <div style={{ flex: 1 }}></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="cn-btn">
            <CIco.Bell /> Saved alerts · 2
          </button>
          <button className="cn-btn cn-btn-primary">Post an RFQ</button>
        </div>
      </div>

      {/* Audience tabs - split per critique */}
      <div style={{ display: 'flex', gap: 0 }}>
        <div
          style={{
            padding: '12px 16px',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--indigo-700)',
            borderBottom: '2px solid var(--indigo-700)',
            marginBottom: -1,
          }}
        >
          Browse RFQs <span style={{ color: 'var(--neutral-500)', fontWeight: 500 }}>· 23</span>
        </div>
        <div
          style={{
            padding: '12px 16px',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--neutral-500)',
          }}
        >
          My RFQs <span style={{ color: 'var(--neutral-400)', fontWeight: 500 }}>· 3 sent</span>
        </div>
      </div>
    </div>

    <Anno n="1">
      "Browse" (seller view) and "My RFQs" (buyer view) split - same page mixed audiences =
      confusing. Saved alerts is the BuyLeads parallel - sellers get pushed when matching RFQ posts.
    </Anno>

    {/* Filters */}
    <div
      style={{
        padding: '12px 24px',
        background: 'var(--neutral-0)',
        borderBottom: '1px solid var(--neutral-200)',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        fontSize: 12,
      }}
    >
      <Pill kind="indigo">Matching my categories ✓</Pill>
      <Pill>All Surat</Pill>
      <Pill>Verified buyers · 14</Pill>
      <Pill>Budget: any</Pill>
      <Pill>Posted: 7 days</Pill>
      <div style={{ flex: 1 }}></div>
      <span style={{ color: 'var(--neutral-500)' }}>Sort: Most recent ▾</span>
    </div>

    <div style={{ padding: '14px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[
        {
          title: 'Need 200 m pure silk georgette · gold-tone · for August collection',
          who: 'Roop Bridal Studio · Mumbai',
          erp: false,
          gst: true,
          qty: '200 m',
          budget: '₹190/m',
          delivery: '15 Jul',
          deliveryDays: 3,
          when: '1h ago',
          resp: 6,
          hot: true,
        },
        {
          title: 'Bulk zardozi karigars for 6 weeks · piece-rate',
          who: 'Anand Brands · Surat',
          erp: true,
          gst: true,
          qty: '40 pieces',
          budget: '₹2,500/saree',
          delivery: '6 weeks',
          deliveryDays: 42,
          when: '3h ago',
          resp: 12,
        },
        {
          title: 'Pearl beads - 50 kg one-time bulk',
          who: 'Diamond Designers · Mumbai',
          erp: false,
          gst: false,
          qty: '50 kg',
          budget: '₹220/100g',
          delivery: 'This month',
          deliveryDays: 18,
          when: '5h ago',
          resp: 4,
        },
        {
          title: 'Multi-head karigar - daily-wage festive',
          who: 'Sharma Karigars · Surat',
          erp: true,
          gst: true,
          qty: '4 people · 8 wks',
          budget: '₹700/day',
          delivery: '5 days',
          deliveryDays: 5,
          when: '1d ago',
          resp: 18,
          urgent: true,
        },
        {
          title: 'Custom embroidery for kids-wear panels',
          who: 'New buyer · Delhi',
          erp: false,
          gst: false,
          qty: '500 pcs',
          budget: 'Open · prompt for anchor',
          delivery: 'Negotiable',
          deliveryDays: 90,
          when: '2d ago',
          resp: 2,
        },
      ].map((r, i) => (
        <div
          key={i}
          style={{
            padding: 16,
            background: 'var(--neutral-0)',
            border: '1px solid ' + (r.hot ? 'var(--gold-400)' : 'var(--neutral-200)'),
            borderRadius: 10,
            display: 'grid',
            gridTemplateColumns: '1fr 220px',
            gap: 16,
            alignItems: 'flex-start',
            position: 'relative',
          }}
        >
          {r.hot && (
            <div
              style={{
                position: 'absolute',
                top: -8,
                left: 16,
                fontSize: 10,
                padding: '2px 8px',
                background: 'var(--gold-500)',
                color: 'var(--indigo-800)',
                borderRadius: 4,
                fontWeight: 700,
                letterSpacing: '0.06em',
              }}
            >
              HOT · 6 RESPONSES SO FAR
            </div>
          )}
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{r.title}</h3>
            <div
              style={{
                fontSize: 12,
                color: 'var(--neutral-500)',
                marginTop: 6,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <span>{r.who}</span>
              {r.gst && <Verified kind="gst" />}
              {r.erp && <Verified kind="erp" />}
              {!r.gst && !r.erp && <Verified kind="mobile" />}
              <span>·</span>
              <span>{r.when}</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                marginTop: 12,
              }}
            >
              <div
                style={{ padding: '8px 12px', background: 'var(--neutral-50)', borderRadius: 8 }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--neutral-500)',
                    letterSpacing: '0.06em',
                  }}
                >
                  QUANTITY
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{r.qty}</div>
              </div>
              <div
                style={{ padding: '8px 12px', background: 'var(--neutral-50)', borderRadius: 8 }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--neutral-500)',
                    letterSpacing: '0.06em',
                  }}
                >
                  TARGET
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{r.budget}</div>
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  background: r.deliveryDays <= 7 ? 'var(--danger-50)' : 'var(--neutral-50)',
                  borderRadius: 8,
                  border:
                    r.deliveryDays <= 7 ? '1px solid var(--danger-500)' : '1px solid transparent',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: r.deliveryDays <= 7 ? 'var(--danger-700)' : 'var(--neutral-500)',
                    letterSpacing: '0.06em',
                  }}
                >
                  NEEDED BY {r.deliveryDays <= 7 && '· URGENT'}
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    marginTop: 2,
                    color: r.deliveryDays <= 7 ? 'var(--danger-700)' : 'var(--neutral-900)',
                  }}
                >
                  {r.delivery}
                </div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginBottom: 8 }}>
              {r.resp} sellers responded ·{' '}
              <span className="cn-link" style={{ fontSize: 11 }}>
                View
              </span>
            </div>
            <button className="cn-btn cn-btn-primary" style={{ width: '100%' }}>
              Send quote
            </button>
            <button className="cn-btn cn-btn-sm" style={{ width: '100%', marginTop: 6 }}>
              View RFQ
            </button>
          </div>
        </div>
      ))}
    </div>
  </window.ConnectShell>
);
window.RFQBoard = RFQBoard;

/* ---------- Empty States Gallery ---------- */
const EmptyTile = ({ tag, icon, head, sub, cta, secondary }) => (
  <div
    style={{
      background: 'var(--neutral-0)',
      border: '1px solid var(--neutral-200)',
      borderRadius: 12,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 8,
    }}
  >
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--neutral-500)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      {tag}
    </div>
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: 'var(--neutral-50)',
        border: '1px dashed var(--neutral-300)',
        color: 'var(--neutral-400)',
        display: 'grid',
        placeItems: 'center',
        margin: '8px 0',
      }}
    >
      {icon}
    </div>
    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', maxWidth: 280 }}>
      {head}
    </div>
    <div style={{ fontSize: 12, color: 'var(--neutral-500)', lineHeight: 1.5, maxWidth: 280 }}>
      {sub}
    </div>
    <button className="cn-btn cn-btn-primary cn-btn-sm" style={{ marginTop: 8 }}>
      {cta}
    </button>
    {secondary && (
      <span className="cn-link" style={{ fontSize: 11 }}>
        {secondary}
      </span>
    )}
  </div>
);

const EmptyStatesGallery = () => (
  <div style={{ padding: 24, background: 'var(--neutral-100)', minHeight: '100%' }}>
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
          Empty states gallery
        </h1>
        <span style={{ fontSize: 13, color: 'var(--neutral-500)' }}>
          per design doc §5 - every screen has a designed empty state
        </span>
      </div>
      <Anno n="1">
        Recipe: tag · single icon · specific headline · why-fix subhead · primary CTA · optional
        secondary. Designed for "the user most likely to land here" - day-1 karigar for
        buyer/applicant surfaces, workspace owner for seller/employer surfaces. Persona-locked per
        screen, not blanket.
      </Anno>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 14 }}
      >
        <EmptyTile
          tag="FEED · NO FOLLOWS · KARIGAR"
          icon={<CIco.Feed />}
          head="Your feed is quiet"
          sub="Follow 3 workshops and connect with karigars to fill it."
          cta="Find people in Surat"
          secondary="Watch 60-second tour"
        />
        <EmptyTile
          tag="PROFILE · NO PORTFOLIO · KARIGAR"
          icon={<CIco.Image />}
          head="Add work samples"
          sub="Buyers and recruiters look at these first. Phone photo is fine."
          cta="Add a work sample"
        />
        <EmptyTile
          tag="PROFILE · NO SKILLS · KARIGAR"
          icon={<CIco.Plus />}
          head="What kind of embroidery do you do?"
          sub="Add 3 skills so people can find you when they search."
          cta="Add skills"
        />
        <EmptyTile
          tag="NETWORK · NO INVITES · ANYONE"
          icon={<CIco.Network />}
          head="No pending invitations"
          sub="When people invite you to connect, they'll appear here."
          cta="Find people to connect"
        />
        <EmptyTile
          tag="INBOX · NO THREADS · ANYONE"
          icon={<CIco.Inbox />}
          head="No messages yet"
          sub="Inquiries, job applications, and DMs will arrive here."
          cta="Browse marketplace"
        />
        <EmptyTile
          tag="MARKETPLACE · NO LEADS · BUYER"
          icon={<CIco.Receipt />}
          head="No inquiries yet"
          sub="Inquiries you send appear here. Browse to start."
          cta="Browse products"
        />
        <EmptyTile
          tag="JOBS · NOT APPLIED · KARIGAR"
          icon={<CIco.Briefcase />}
          head="You haven't applied to any jobs"
          sub="128 open positions in Surat - daily-wage, piece-rate, monthly."
          cta="Find jobs"
        />
        <EmptyTile
          tag="JOBS · NO POSTED JOBS · OWNER"
          icon={<CIco.Plus />}
          head="Post your first job"
          sub="Search 86 karigars and designers in Surat the moment you publish."
          cta="Post a job"
        />
        <EmptyTile
          tag="SEARCH · NO RESULTS · ANYONE"
          icon={<CIco.Search />}
          head={`No results for "zardosi suarat"`}
          sub="Try broader keywords. Did you mean 'zardozi surat'?"
          cta="Try suggestion"
          secondary="Clear filters"
        />
        <EmptyTile
          tag="RFQ BOARD · NO MATCHES · SELLER"
          icon={<CIco.Doc />}
          head="No open RFQs match your categories"
          sub="Post your own RFQ to invite quotes from sellers."
          cta="Post an RFQ"
        />
        <EmptyTile
          tag="STOREFRONT · NO PRODUCTS · OWNER"
          icon={<CIco.Store />}
          head="Add your first product"
          sub="Buyers find suppliers via product searches. Even 1 listing makes you discoverable."
          cta="Add product"
        />
        <EmptyTile
          tag="COMPANY · NO POSTS · OWNER"
          icon={<CIco.Feed />}
          head="Share an update or pin a case study"
          sub="Followers see your posts in their feed. Case studies with delivery metrics work best."
          cta="Post update"
        />
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: 'var(--neutral-0)',
          border: '1px dashed var(--neutral-300)',
          borderRadius: 10,
          fontSize: 12,
          color: 'var(--neutral-600)',
          lineHeight: 1.5,
        }}
      >
        <div
          style={{ fontWeight: 700, color: 'var(--neutral-900)', marginBottom: 6, fontSize: 13 }}
        >
          Known gaps · follow-up gallery
        </div>
        Lead Manager · no leads · &nbsp;|&nbsp; Network · Following with 0 companies followed ·
        &nbsp;|&nbsp; Posted Jobs · 0 applications received · &nbsp;|&nbsp; Notifications · all
        caught up
        <div style={{ marginTop: 6, color: 'var(--neutral-500)' }}>
          These weren't part of this pass - covered in v2 of the gallery.
        </div>
      </div>
    </div>
  </div>
);
window.EmptyStatesGallery = EmptyStatesGallery;

/* ---------- WhatsApp handoff modal preview ---------- */
const WhatsAppHandoff = () => (
  <div
    style={{
      padding: 24,
      background: 'rgba(14,24,68,0.65)',
      minHeight: '100%',
      display: 'grid',
      placeItems: 'center',
      position: 'relative',
    }}
  >
    {/* Backdrop note - show that this is a modal over context, not a route */}
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: 24,
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace',
        color: 'rgba(255,255,255,0.6)',
        maxWidth: 280,
        lineHeight: 1.5,
      }}
    >
      ↑ translucent 65% backdrop over the page beneath; page remains visible (greyed) so user knows
      this is a modal, not a separate route
    </div>

    <div
      style={{
        maxWidth: 480,
        width: '100%',
        background: 'var(--neutral-0)',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
      }}
    >
      <div
        style={{
          padding: '18px 22px',
          background: '#25D366',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <CIco.Wa style={{ width: 28, height: 28 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', opacity: 0.85 }}>
            OPENING WHATSAPP
          </div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Continue with Zari Wholesalers</div>
        </div>
        <CIco.Plus style={{ transform: 'rotate(45deg)', opacity: 0.8, cursor: 'pointer' }} />
      </div>

      <div style={{ padding: 22 }}>
        <div style={{ fontSize: 13, color: 'var(--neutral-700)', lineHeight: 1.5 }}>
          You're about to leave Connect. <b>Edit the message</b> if you want - it sends as-is on
          WhatsApp:
        </div>

        {/* Editable preview (user-controlled = trust, per UX rule) */}
        <div
          style={{
            marginTop: 14,
            padding: 16,
            background: '#DCF8C6',
            borderRadius: 14,
            borderTopRightRadius: 4,
            position: 'relative',
            fontSize: 13,
            color: 'var(--neutral-900)',
            lineHeight: 1.5,
            border: '1.5px solid #25D366',
            boxShadow: '0 0 0 4px rgba(37,211,102,0.12)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 10,
              fontSize: 9,
              fontWeight: 700,
              color: '#128C7E',
              letterSpacing: '0.06em',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ✎ EDITABLE
          </div>
          <div contentEditable suppressContentEditableWarning style={{ outline: 'none' }}>
            Hi <b>Zari Wholesalers</b>,
          </div>
          <div style={{ marginTop: 8 }} contentEditable suppressContentEditableWarning>
            I sent an inquiry on Zari360 Connect about <b>Pure silver zari thread - 5 shades</b> -
          </div>
          <div style={{ marginTop: 4 }} contentEditable suppressContentEditableWarning>
            Quantity: <b>20 kg</b> · Target price: <b>₹2,600/kg</b> · Delivery by: <b>15 June</b>
          </div>
          <div style={{ marginTop: 8 }} contentEditable suppressContentEditableWarning>
            Can we discuss here?
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--neutral-500)' }}>
            - Rahul Patel (via Zari360 Connect)
          </div>
          <div
            style={{
              position: 'absolute',
              right: 12,
              bottom: 6,
              fontSize: 10,
              color: 'var(--neutral-500)',
            }}
          >
            preview · sends as ✓✓ on WhatsApp
          </div>
        </div>

        <Anno n="1">
          Editable inline (industry rule: never lock the message - destroys trust). "via Zari360
          Connect" footer trains the network. Backdrop is translucent - modal sits over context, not
          as a route.
        </Anno>

        <div
          style={{
            marginTop: 14,
            padding: 12,
            background: 'var(--neutral-50)',
            borderRadius: 8,
            fontSize: 11,
            color: 'var(--neutral-600)',
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              color: 'var(--neutral-700)',
              marginBottom: 4,
              fontSize: 12,
              letterSpacing: '0.02em',
            }}
          >
            What does NOT happen
          </div>
          • We don't record WhatsApp messages
          <br />
          • We don't sync the thread back
          <br />• Seller's number is not auto-saved to your contacts
        </div>

        <label
          style={{
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--neutral-600)',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              border: '1.5px solid var(--neutral-300)',
            }}
          ></span>
          Skip this confirmation for <b style={{ color: 'var(--neutral-900)' }}>Zari Wholesalers</b>{' '}
          next time
        </label>

        <div
          style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 8, fontStyle: 'italic' }}
        >
          On desktop: opens WhatsApp Web in a new tab · On mobile: opens WhatsApp app
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button className="cn-btn" style={{ flex: 1 }}>
            Cancel
          </button>
          <button className="cn-btn cn-btn-wa" style={{ flex: 2, padding: '12px 16px' }}>
            <CIco.Wa /> Continue on WhatsApp
          </button>
        </div>
      </div>
    </div>
  </div>
);
window.WhatsAppHandoff = WhatsAppHandoff;
