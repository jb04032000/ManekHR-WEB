/* Marketplace - IndiaMART-style lead-gen B2B home + Product Detail */

const MarketplaceHome = () => (
  <window.ConnectShell title="Marketplace" activeNav="marketplace">
    <SubTabs
      active="browse"
      items={[
        ['browse', 'Browse', null],
        ['leads', 'My leads', 14],
        ['rfq', 'RFQ board', 23],
      ]}
    />
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search row */}
      <div
        className="cn-card"
        style={{
          padding: 14,
          display: 'grid',
          gridTemplateColumns: '1fr auto auto auto auto auto',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <div className="cn-globalsearch" style={{ width: 'auto', flex: 1 }}>
          <CIco.Search />
          <span>
            Search products, materials, suppliers - "silver zari", "georgette wholesale", "kasab
            Surat"…
          </span>
        </div>
        <div className="cn-input" style={{ padding: '8px 12px', minWidth: 140 }}>
          Surat <CIco.Chevron style={{ marginLeft: 'auto' }} />
        </div>
        <div className="cn-input" style={{ padding: '8px 12px', minWidth: 120 }}>
          Category <CIco.Chevron style={{ marginLeft: 'auto' }} />
        </div>
        <div className="cn-input" style={{ padding: '8px 12px', minWidth: 160 }}>
          Sort · Most relevant <CIco.Chevron style={{ marginLeft: 'auto' }} />
        </div>
        <button className="cn-btn">
          <CIco.Filter /> Filters · 0
        </button>
        <button className="cn-btn cn-btn-primary">Post an RFQ</button>
      </div>

      {/* Recently viewed (added per critique) */}
      <section className="cn-card cn-card-pad" style={{ padding: '12px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--neutral-700)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            Recently viewed
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 10, overflow: 'auto' }}>
            {[
              'Pure silk georgette · 60 GSM',
              'Pearl beads · 4mm',
              'Hand-spun cotton',
              'Crystal stones · oval',
            ].map((t) => (
              <div
                key={t}
                style={{
                  flex: '0 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: 6,
                  paddingRight: 12,
                  background: 'var(--neutral-50)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              >
                <Img label="·" style={{ width: 36, height: 36, borderRadius: 4 }} />
                <span style={{ fontWeight: 600 }}>{t}</span>
              </div>
            ))}
          </div>
          <span className="cn-link">Clear</span>
        </div>
      </section>

      <Anno n="1">
        Lead-gen, not transactional. Buy buttons say "Get quotation". Phone reveal only after seller
        accepts inquiry (Phase 5: free reveals capped per month).
      </Anno>

      {/* Browse by category */}
      <section className="cn-card cn-card-pad">
        <div className="cn-section-h">
          <h2>Browse by category</h2>
          <span className="cn-link">All categories →</span>
        </div>
        <div className="cn-cat-grid">
          {[
            ['Fabrics', 'georgette · silk · net', 'var(--indigo-100)'],
            ['Threads & zari', 'silver · gold · cotton', 'var(--gold-100)'],
            ['Beads & sequins', 'crystal · pearl · plastic', 'var(--indigo-50)'],
            ['Zardozi material', 'dabka · sitara · kora', 'var(--gold-100)'],
            ['Machine accessories', 'needles · frames · hooks', 'var(--neutral-200)'],
            ['Finished garments', 'sarees · lehengas · suits', 'var(--indigo-100)'],
          ].map(([n, sub, bg]) => (
            <div key={n} className="cn-cat">
              <div className="swatch" style={{ background: bg }}></div>
              <div className="name">{n}</div>
              <div className="count">{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Two columns: products + RFQs */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start' }}
      >
        {/* Products */}
        <section className="cn-card cn-card-pad">
          <div className="cn-section-h">
            <h2>Trending in Surat · zardozi material</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <Pill kind="indigo">Verified sellers · 124</Pill>
              <Pill>ERP-linked · 38</Pill>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
              marginTop: 12,
            }}
          >
            {[
              [
                'Pure silver zari thread · 5 shades',
                'Zari Wholesalers',
                '₹2,400 – ₹2,800 / kg',
                'MOQ 5 kg',
                '#8C7019',
                ['gst'],
              ],
              [
                'Pearl beads · 4mm crystal AB',
                'Surat Bead Co.',
                '₹180 – ₹260 / 100g',
                'MOQ 2 kg',
                'var(--indigo-100)',
                ['gst', 'udyam'],
              ],
              [
                'Dabka thread · kora finish',
                'Anand Zari Mills',
                '₹3,100 – ₹3,400 / kg',
                'MOQ 3 kg',
                'var(--gold-100)',
                ['gst', 'erp'],
              ],
              [
                'Sitara · 6mm star sequins',
                'Royal Embellishments',
                '₹120 – ₹160 / 100g',
                'MOQ 1 kg',
                'var(--neutral-200)',
                ['gst'],
              ],
              [
                'Pure silk georgette · 60 GSM',
                'Suresh Fabrics',
                '₹190 – ₹240 / m',
                'MOQ 100 m',
                'var(--indigo-50)',
                ['gst', 'erp'],
              ],
              [
                'Hand-spun cotton thread',
                'Mahalaxmi Threads',
                '₹450 – ₹520 / kg',
                'MOQ 5 kg',
                'var(--gold-100)',
                ['gst'],
              ],
              [
                'Crystal stones · oval cut',
                'Diamond Beads',
                '₹240 – ₹310 / 100g',
                'MOQ 500 g',
                'var(--neutral-200)',
                ['gst', 'udyam'],
              ],
              [
                'Machine needles · DBxK5 (set)',
                'Tooling India',
                '₹85 / box of 10',
                'MOQ 20 boxes',
                'var(--indigo-100)',
                ['gst'],
              ],
            ].map(([title, seller, price, moq, swatch, badges], i) => (
              <div key={i} className="cn-prod">
                <Img
                  label="product photo"
                  style={{
                    aspectRatio: '1 / 1',
                    borderRadius: 0,
                    borderLeft: 0,
                    borderRight: 0,
                    borderTop: 0,
                    background: swatch,
                  }}
                />
                <div className="cn-prod-body">
                  <h4 className="cn-prod-title">{title}</h4>
                  <div className="cn-prod-seller">
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {seller}
                    </span>
                    {badges.includes('erp') && <Verified kind="erp" />}
                    {!badges.includes('erp') && badges.includes('gst') && <Verified kind="gst" />}
                  </div>
                  <div className="cn-prod-price">{price}</div>
                  <div className="cn-prod-meta">{moq} · Surat</div>
                  <div className="cn-prod-cta">
                    <button className="cn-btn cn-btn-primary cn-btn-sm" style={{ flex: 1 }}>
                      Get quotation
                    </button>
                    <button className="cn-btn cn-btn-sm">
                      <CIco.Wa />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* RFQs (BuyLeads) right column */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="cn-card cn-card-pad">
            <div className="cn-section-h">
              <h2>Live RFQs · matching you</h2>
              <span className="cn-link">See all</span>
            </div>
            <Anno n="2">
              RFQ / BuyLeads - buyers post requirements, sellers respond. Free for buyers; sellers
              pay for unlimited access (Phase 5).
            </Anno>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {[
                [
                  'Need 200 m pure silk georgette · gold-tone',
                  'Buyer: ERP-linked · Mumbai',
                  '1h',
                  'Quantity: 200m · Budget: ₹190/m',
                ],
                [
                  'Bulk zardozi karigars for 6 weeks',
                  'Buyer: Verified GST · Surat',
                  '3h',
                  'Target: ₹2,500/saree · 40 pieces',
                ],
                [
                  'Pearl beads - 50 kg one-time',
                  'Buyer: New (mobile only)',
                  '5h',
                  'Budget: ₹220/100g · This month',
                ],
              ].map(([t, who, time, sp]) => (
                <div key={t} className="cn-rfq">
                  <div>
                    <h4>{t}</h4>
                    <div style={{ fontSize: 11, color: 'var(--neutral-500)' }}>
                      {who} · {time} ago
                    </div>
                    <div className="pills">
                      <Pill>{sp}</Pill>
                    </div>
                  </div>
                  <button className="cn-btn cn-btn-primary cn-btn-sm">Send Quote</button>
                </div>
              ))}
            </div>
          </div>

          <div className="cn-card cn-card-pad">
            <h3 className="cn-h3">My lead manager</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 6,
                marginTop: 10,
              }}
            >
              {[
                ['New', 8, 'var(--info-700)'],
                ['Quoted', 3, 'var(--warning-700)'],
                ['Negotiating', 2, 'var(--gold-700)'],
                ['Won', 1, 'var(--success-700)'],
              ].map(([l, v, c]) => (
                <div
                  key={l}
                  style={{
                    padding: '10px 8px',
                    textAlign: 'center',
                    background: 'var(--neutral-50)',
                    borderRadius: 6,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--neutral-500)',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {l}
                  </div>
                </div>
              ))}
            </div>
            <div className="cn-link" style={{ marginTop: 12 }}>
              Open Lead Manager →
            </div>
          </div>
        </aside>
      </div>
    </div>
  </window.ConnectShell>
);

/* Product Detail - single product with quotation flow */
const ProductDetail = () => (
  <window.ConnectShell title="Marketplace" activeNav="marketplace" hideTopSearch={true}>
    <div style={{ padding: '20px 24px' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginBottom: 14 }}>
        Marketplace › Threads & zari ›{' '}
        <span style={{ color: 'var(--neutral-900)' }}>Pure silver zari thread</span>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}
      >
        {/* LEFT - gallery + details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="cn-card" style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Img key={i} label={'img ' + i} style={{ aspectRatio: '1 / 1' }} />
                ))}
              </div>
              <Img label="main product image · zoom on hover" style={{ aspectRatio: '1 / 1' }} />
            </div>
          </div>

          <div className="cn-card cn-card-pad">
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
              Pure silver zari thread - assorted (5 shades)
            </h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <Pill kind="indigo">Threads & zari</Pill>
              <Pill kind="indigo">Silver</Pill>
              <Pill>Made in Surat</Pill>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  color: 'var(--warning-700)',
                }}
              >
                <CIco.Star /> <CIco.Star /> <CIco.Star /> <CIco.Star /> <CIco.Star /> 4.7 · 28
                reviews
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 14,
                marginTop: 18,
                padding: 14,
                background: 'var(--neutral-50)',
                borderRadius: 10,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--neutral-500)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Price range
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                  ₹2,400 – ₹2,800
                  <span style={{ fontSize: 11, color: 'var(--neutral-500)', fontWeight: 500 }}>
                    {' '}
                    /kg
                  </span>
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--neutral-500)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  MOQ
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>5 kg</div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--neutral-500)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Stock
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    marginTop: 4,
                    color: 'var(--success-700)',
                  }}
                >
                  ● In stock
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--neutral-500)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  HSN code
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    marginTop: 4,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  5605.00.10
                </div>
              </div>
            </div>

            <h3 className="cn-h3" style={{ marginTop: 22, marginBottom: 8 }}>
              Specifications
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 0,
                border: '1px solid var(--neutral-200)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {[
                ['Material', 'Real silver-coated thread, cotton core'],
                ['Available shades', '5 (light gold, antique, rose, silver, oxidised)'],
                ['Weight per spool', '250 g'],
                ['Tex / count', '120 dtex'],
                ['Sample available', 'Yes - paid (₹150)'],
                ['Lead time', '3–5 days · in-stock'],
              ].map(([k, v], i) => (
                <div
                  key={k}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '40% 1fr',
                    fontSize: 13,
                    padding: '10px 14px',
                    borderBottom: i < 4 ? '1px solid var(--neutral-100)' : 'none',
                    background: i % 2 ? 'var(--neutral-50)' : 'var(--neutral-0)',
                  }}
                >
                  <span style={{ color: 'var(--neutral-500)' }}>{k}</span>
                  <span style={{ color: 'var(--neutral-900)' }}>{v}</span>
                </div>
              ))}
            </div>

            <h3 className="cn-h3" style={{ marginTop: 22, marginBottom: 8 }}>
              Bulk pricing
            </h3>
            <div className="cn-wage">
              <div className="b">
                <div className="l">5 – 19 kg</div>
                <div className="v">₹2,800 /kg</div>
              </div>
              <div className="b">
                <div className="l">20 – 49 kg</div>
                <div className="v">₹2,600 /kg</div>
              </div>
              <div className="b">
                <div className="l">50+ kg</div>
                <div className="v">₹2,400 /kg</div>
              </div>
            </div>
          </div>

          <div className="cn-card cn-card-pad">
            <h2 className="cn-h2">About the seller</h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '64px 1fr auto',
                gap: 14,
                marginTop: 14,
                alignItems: 'center',
              }}
            >
              <Av name="ZW" color="var(--gold-700)" size="lg" />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Zari Wholesalers</div>
                <div style={{ fontSize: 12, color: 'var(--neutral-600)', marginTop: 2 }}>
                  Surat · 12 years in business · 84 products
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <Verified kind="gst" />
                  <Verified kind="udyam" />
                  <Verified kind="erp" />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--neutral-500)' }}>Avg response</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success-700)' }}>
                  ~ 1 hour
                </div>
                <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 4 }}>
                  Response rate · 94%
                </div>
              </div>
            </div>
          </div>

          {/* Reviews - added per critique */}
          <div className="cn-card cn-card-pad">
            <div className="cn-section-h">
              <h2>Reviews · 28</h2>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  color: 'var(--warning-700)',
                }}
              >
                <CIco.Star />
                <CIco.Star />
                <CIco.Star />
                <CIco.Star />
                <CIco.Star /> 4.7 average
              </span>
            </div>
            <Anno n="4">Reviews unlocked only after both parties confirm deal happened.</Anno>
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}
            >
              {[
                [
                  'Roop Bridal Studio',
                  'Verified buyer · GST',
                  'Quality consistent. 3 saal se kharid raha hu - shades same hain har baar. Time pe delivery.',
                  'May 2026',
                ],
                [
                  'Designer Nidhi K.',
                  'Verified buyer',
                  'Sample first bheja, accha laga. Bulk order ke baad bhi quality same.',
                  'Apr 2026',
                ],
              ].map(([name, kind, body, when]) => (
                <div
                  key={name}
                  style={{ padding: 14, background: 'var(--neutral-50)', borderRadius: 10 }}
                >
                  <div style={{ fontSize: 11, color: 'var(--warning-700)' }}>★★★★★</div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--neutral-700)',
                      marginTop: 6,
                      lineHeight: 1.5,
                    }}
                  >
                    "{body}"
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 8 }}>
                    <b style={{ color: 'var(--neutral-900)' }}>{name}</b> · {kind} · {when}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <span className="cn-link">See all 28 reviews →</span>
            </div>
          </div>

          {/* Similar products - added per critique */}
          <div className="cn-card cn-card-pad">
            <div className="cn-section-h">
              <h2>Similar products</h2>
              <span className="cn-link">See more</span>
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
                ['Antique zari spool', '₹2,600 – ₹3,200 / kg', 'Anand Zari Mills'],
                ['Gold-tone zari', '₹2,800 – ₹3,400 / kg', 'Mahalaxmi Threads'],
                ['Oxidised zari', '₹2,200 – ₹2,500 / kg', 'Surat Zari Co.'],
                ['Kasab zari kit', '₹3,100 – ₹3,500 / kg', 'Royal Embl.'],
              ].map(([t, p, s], i) => (
                <div key={i} className="cn-prod">
                  <Img
                    label="similar product"
                    style={{
                      aspectRatio: '1 / 1',
                      borderRadius: 0,
                      borderTop: 0,
                      borderLeft: 0,
                      borderRight: 0,
                    }}
                  />
                  <div className="cn-prod-body">
                    <div className="cn-prod-title">{t}</div>
                    <div className="cn-prod-price">{p}</div>
                    <div className="cn-prod-meta">{s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer meta */}
          <div
            style={{
              fontSize: 11,
              color: 'var(--neutral-500)',
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0 4px',
            }}
          >
            <span>Last updated · 14 May 2026</span>
            <span>
              <span className="cn-link" style={{ fontSize: 11 }}>
                ⚑ Report listing
              </span>
            </span>
          </div>
        </div>

        {/* RIGHT - quotation panel (sticky) */}
        <aside
          style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div className="cn-card cn-card-pad">
            <h3 className="cn-h2">Get a quotation</h3>
            <Anno n="3">Phone reveal happens after seller accepts. WhatsApp handoff one-tap.</Anno>
            <div className="cn-quote-form" style={{ marginTop: 14 }}>
              <div className="cn-input-row">
                <div className="cn-input">Quantity (kg)</div>
                <div className="cn-input">Target price ₹/kg</div>
              </div>
              <div className="cn-input">Required by · pick date</div>
              <div className="cn-input tall">
                Message to seller - sample / shade / delivery notes
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--neutral-500)',
                    fontWeight: 600,
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Contact preference
                </div>
                <div className="cn-radio-row">
                  <span className="cn-radio on">
                    <CIco.Wa /> WhatsApp
                  </span>
                  <span className="cn-radio">
                    <CIco.Phone /> Call
                  </span>
                  <span className="cn-radio">
                    <CIco.Inbox /> On-platform
                  </span>
                </div>
              </div>
              <button className="cn-btn cn-btn-primary" style={{ padding: '12px 16px' }}>
                Send inquiry
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="cn-btn" style={{ flex: 1 }}>
                  <CIco.Bookmark /> Save
                </button>
                <button className="cn-btn" style={{ flex: 1 }}>
                  + Add to compare
                </button>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--neutral-500)',
                  textAlign: 'center',
                  lineHeight: 1.4,
                }}
              >
                Your phone is hidden until seller responds. You can leave the platform at any time.
              </div>
            </div>
          </div>

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
              This listing is backed by a workshop running Zari360 ERP - real operational data, not
              a self-claim.
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--indigo-200)' }}>
              ERP active since Jan 2022 · 32 karigars on roll · Last invoice 2 days ago
            </div>
          </div>

          <div className="cn-card cn-card-pad" style={{ background: 'var(--neutral-50)' }}>
            <h3 className="cn-h3" style={{ marginBottom: 10 }}>
              Why Zari Wholesalers?
            </h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 12,
                color: 'var(--neutral-700)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                lineHeight: 1.5,
              }}
            >
              <li>ERP-linked - real factory data backs this listing</li>
              <li>94% response rate, replies in ~1 hour</li>
              <li>17 repeat buyers in last 6 months</li>
              <li>Samples available for ₹150 (refundable)</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  </window.ConnectShell>
);

window.MarketplaceHome = MarketplaceHome;
window.ProductDetail = ProductDetail;
