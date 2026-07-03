/* Inbox - unified channels: DMs, Inquiries, Applications, Quotes, System
   Notifications - unified, granular */

const InboxScreen = () => (
  <window.ConnectShell
    title="Inbox"
    activeNav="inbox"
    hideTopSearch={true}
    counts={{ inbox: 3, notifications: '9+' }}
  >
    <div className="cn-inbox">
      {/* THREAD LIST */}
      <aside className="list">
        <div className="chips">
          {[
            'All · 28',
            'DMs · 12',
            'Inquiries · 9',
            'Applications · 4',
            'Quotes · 2',
            'System · 1',
          ].map((c, i) => (
            <span key={c} className={'chip ' + (i === 2 ? 'is-active' : '')}>
              {c}
            </span>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {[
            {
              who: 'Roop Bridal Studio',
              kind: 'Inquiry · Bridal lehenga panels',
              snip: 'Hi, we need 12 panels by 15 July, can you…',
              t: '2m',
              av: 'RS',
              c: 'var(--gold-700)',
              unread: true,
              active: true,
            },
            {
              who: 'Imran Sheikh',
              kind: 'DM',
              snip: 'Salaam, sample piece bhej diya hai courier se',
              t: '14m',
              av: 'IS',
              c: '#1A2A6C',
              unread: true,
            },
            {
              who: 'Kavita Desai',
              kind: 'Quote · Pure silver zari',
              snip: 'Final offer ₹2,600/kg for 20kg - ok?',
              t: '1h',
              av: 'KD',
              c: 'var(--indigo-700)',
            },
            {
              who: 'Anat Textiles · Recruiter',
              kind: 'Application · Multi-head op',
              snip: 'Aapki application receive ho gayi. Shortlisted.',
              t: '3h',
              av: 'AT',
              c: 'var(--indigo-700)',
              unread: true,
            },
            {
              who: 'Bhavin Rana',
              kind: 'DM',
              snip: 'Job ke liye kya documents lagenge?',
              t: '5h',
              av: 'BR',
              c: '#0E1844',
            },
            {
              who: 'Diamond Beads',
              kind: 'Quote · Crystal stones',
              snip: 'Quote attached. Validity 7 days.',
              t: '1d',
              av: 'DB',
              c: 'var(--gold-700)',
            },
            {
              who: 'Zari360 System',
              kind: 'System',
              snip: 'GST verification complete. ERP-linked badge issued.',
              t: '2d',
              av: 'Z',
              c: 'var(--indigo-600)',
            },
            {
              who: 'Priya Joshi',
              kind: 'DM',
              snip: 'Workshop visit kal possible?',
              t: '3d',
              av: 'PJ',
              c: 'var(--gold-700)',
            },
          ].map((t, i) => (
            <div key={i} className={'thread-row ' + (t.active ? 'is-active' : '')}>
              <Av name={t.av} color={t.c} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="name">
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.who}
                  </span>
                  <span className="time">{t.t}</span>
                </div>
                <div className="ctx">{t.kind}</div>
                <div className="snip">{t.snip}</div>
              </div>
              {t.unread && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--indigo-600)',
                    alignSelf: 'center',
                  }}
                ></div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* CONVERSATION */}
      <div className="conv">
        <div className="conv-head">
          <Av name="RS" color="var(--gold-700)" />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Roop Bridal Studio <Verified kind="gst" />
            </div>
            <div style={{ fontSize: 12, color: 'var(--neutral-500)' }}>
              Bridal brand · Mumbai · Buyer
            </div>
          </div>
          <button className="cn-btn cn-btn-sm">
            <CIco.Phone /> Call
          </button>
          <button className="cn-btn cn-btn-sm cn-btn-wa">
            <CIco.Wa /> WhatsApp
          </button>
          <button className="cn-btn cn-btn-sm">
            <CIco.More />
          </button>
        </div>

        {/* Pinned context - what is this conversation about */}
        <div className="conv-ctx">
          <CIco.Briefcase />
          <span style={{ flex: 1 }}>
            Inquiry on <b>Bridal lehenga panels</b> - Quantity 12 · Required by 15 July 2026 ·
            Budget ₹8,500/panel
          </span>
          <span className="cn-link">View inquiry</span>
        </div>

        <div className="conv-body">
          <Anno n="1">
            Pinned context = which product / job / page this thread is about. Persists across
            channels.
          </Anno>

          <div
            style={{
              fontSize: 11,
              color: 'var(--neutral-400)',
              textAlign: 'center',
              margin: '8px 0',
            }}
          >
            Today
          </div>

          <div className="bubble them">
            Hi Meera, saw your zardozi portfolio - exactly the style we need for our August
            collection. Can you do 12 panels?<div className="t">10:24 am · seen</div>
          </div>
          <div className="bubble me">
            Haan, definitely. 12 panels in 6 weeks possible. Sample bhejungi pehle for approval?
            <div className="t">10:31 am · seen</div>
          </div>
          <div className="bubble them">
            Yes please. Send 1 sample by courier - full cost we'll cover. Then we can lock the
            order.<div className="t">10:33 am</div>
          </div>

          {/* Auto-quotation card inline */}
          <div
            style={{
              alignSelf: 'flex-start',
              maxWidth: '60%',
              padding: 14,
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--neutral-500)',
                letterSpacing: '0.06em',
              }}
            >
              QUOTATION · DRAFT
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>Bridal panel quote</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginTop: 10,
                fontSize: 12,
              }}
            >
              <div>
                <div style={{ color: 'var(--neutral-500)' }}>Unit price</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>₹8,500</div>
              </div>
              <div>
                <div style={{ color: 'var(--neutral-500)' }}>Quantity</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>12</div>
              </div>
              <div>
                <div style={{ color: 'var(--neutral-500)' }}>Total</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>₹1,02,000</div>
              </div>
              <div>
                <div style={{ color: 'var(--neutral-500)' }}>Lead time</div>
                <div style={{ fontWeight: 700, marginTop: 2 }}>6 weeks</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <button className="cn-btn cn-btn-sm cn-btn-primary">Send quote</button>
              <button className="cn-btn cn-btn-sm">Edit</button>
              <button className="cn-btn cn-btn-sm">
                <CIco.Doc /> PDF
              </button>
            </div>
          </div>

          <div className="bubble me" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CIco.Mic /> 0:24 voice note<div className="t" style={{ marginTop: 0 }}></div>
          </div>
        </div>

        <div className="composer-row">
          <button className="cn-btn cn-btn-sm" style={{ padding: 6 }} title="Send photo">
            <CIco.Image />
          </button>
          <button className="cn-btn cn-btn-sm" style={{ padding: 6 }} title="Attach file">
            <CIco.Doc />
          </button>
          <button className="cn-btn cn-btn-sm" style={{ padding: 6 }} title="Send a product / job">
            <CIco.Briefcase />
          </button>
          <button className="cn-btn cn-btn-sm" style={{ padding: 6 }} title="Send quote">
            <CIco.Receipt />
          </button>
          <div className="input">Type a message - voice note also OK</div>
          <div style={{ position: 'relative' }}>
            <button className="cn-btn cn-btn-sm">Templates ▾</button>
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                right: 0,
                marginBottom: 6,
                background: 'var(--neutral-0)',
                border: '1px solid var(--neutral-200)',
                borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                padding: 6,
                minWidth: 280,
                fontSize: 12,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--neutral-500)',
                  padding: '6px 10px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Auto-reply templates
              </div>
              {[
                'Thanks for inquiry, sending quote shortly',
                'Sample available for ₹150 (refundable)',
                'Production booked for next 4 weeks',
                'Lowest price for this MOQ',
                'Available on call - please WhatsApp first',
              ].map((t) => (
                <div key={t} style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}>
                  {t}
                </div>
              ))}
              <div
                style={{
                  borderTop: '1px solid var(--neutral-100)',
                  padding: '6px 10px',
                  color: 'var(--indigo-700)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + New template
              </div>
            </div>
          </div>
          <button className="cn-btn cn-btn-sm">
            <CIco.Mic />
          </button>
          <button className="cn-btn cn-btn-sm cn-btn-primary">Send</button>
        </div>
      </div>
    </div>
  </window.ConnectShell>
);

/* Notifications - single column list */
const NotificationsScreen = () => (
  <window.ConnectShell
    title="Notifications"
    activeNav="notifications"
    hideTopSearch={true}
    counts={{ notifications: '9+' }}
  >
    <div
      style={{
        padding: '20px 24px',
        display: 'grid',
        gridTemplateColumns: '1fr 320px',
        gap: 20,
        alignItems: 'start',
      }}
    >
      <main className="cn-card" style={{ overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--neutral-200)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 className="cn-h2">Notifications</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="cn-btn cn-btn-sm">Mark all read</button>
            <button className="cn-btn cn-btn-sm">Preferences</button>
          </div>
        </div>

        {/* Filter chips */}
        <div
          className="chips"
          style={{
            display: 'flex',
            gap: 6,
            padding: '12px 16px',
            borderBottom: '1px solid var(--neutral-200)',
            overflow: 'auto',
          }}
        >
          {[
            'All · 12',
            'Mentions · 2',
            'Inquiries · 3',
            'Applications · 1',
            'Network · 4',
            'System · 2',
          ].map((c, i) => (
            <span
              key={c}
              className={'chip ' + (i === 0 ? 'is-active' : '')}
              style={{
                padding: '6px 11px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                background: i === 0 ? 'var(--indigo-700)' : 'var(--neutral-100)',
                color: i === 0 ? 'var(--neutral-0)' : 'var(--neutral-600)',
                whiteSpace: 'nowrap',
              }}
            >
              {c}
            </span>
          ))}
        </div>

        <div>
          {[
            {
              unread: true,
              ic: <CIco.Briefcase />,
              body: (
                <>
                  <b>Anat Textiles</b> shortlisted your application for{' '}
                  <b>Machine operator - Multi-head</b>. Recruiter wants to talk.
                </>
              ),
              t: '15 min ago',
              actions: [
                ['Open application', 'primary'],
                ['Reply via WhatsApp', 'wa'],
              ],
            },
            {
              unread: true,
              ic: <CIco.Inbox />,
              body: (
                <>
                  <b>Roop Bridal Studio</b> sent a new inquiry on <b>Bridal lehenga panels</b> · 12
                  pcs needed.
                </>
              ),
              t: '32 min ago',
              actions: [
                ['Send quote', 'primary'],
                ['View inquiry', ''],
              ],
            },
            {
              unread: true,
              ic: <CIco.Heart />,
              body: (
                <>
                  <b>Kavita Desai and 5 others</b> reacted to your post "Bridal lehenga panel - gold
                  zardozi".
                </>
              ),
              t: '2 hrs ago',
              batch: true,
              actions: [['View post', '']],
            },
            {
              unread: false,
              ic: <CIco.Network />,
              body: (
                <>
                  <b>Imran Sheikh</b> accepted your connection request.
                </>
              ),
              t: '5 hrs ago',
              actions: [
                ['Say hello', 'primary'],
                ['View profile', ''],
              ],
            },
            {
              unread: false,
              ic: <CIco.Comment />,
              body: (
                <>
                  <b>Priya Joshi</b> commented on your post: "Beautiful work! Kya rate per saree?"
                </>
              ),
              t: 'Yesterday',
              actions: [['Reply', 'primary']],
            },
            {
              unread: false,
              ic: <CIco.Bell />,
              body: (
                <>
                  Your saved search <b>"Multi-head Surat ₹500+"</b> matched <b>4 new jobs</b>.
                </>
              ),
              t: 'Yesterday',
              actions: [
                ['View matches', 'primary'],
                ['Edit alert', ''],
              ],
            },
            {
              unread: false,
              ic: <CIco.Check2 />,
              body: (
                <>
                  <b>Zari360 System</b> · Your GST verification is complete. <b>ERP-linked badge</b>{' '}
                  is now visible on your profile.
                </>
              ),
              t: '2 days ago',
              actions: [['See profile', '']],
            },
            {
              unread: false,
              ic: <CIco.Users />,
              body: (
                <>
                  <b>3 people you may know</b> in Surat joined Connect this week.
                </>
              ),
              t: '3 days ago',
              batch: true,
              actions: [['See suggestions', 'primary']],
            },
          ].map((n, i) => (
            <div key={i} className={'cn-notif ' + (n.unread ? 'unread' : '')}>
              <div
                className="ic"
                style={{
                  color: n.unread ? 'var(--indigo-700)' : 'var(--neutral-500)',
                  background: n.unread ? 'var(--neutral-0)' : 'var(--neutral-100)',
                }}
              >
                {n.ic}
              </div>
              <div className="body">
                <div>{n.body}</div>
                <div className="t">
                  {n.t} {n.batch && <Pill style={{ marginLeft: 6 }}>Batched</Pill>}
                </div>
                {n.actions && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {n.actions.map(([label, kind]) => (
                      <button
                        key={label}
                        className={`cn-btn cn-btn-sm ${kind === 'primary' ? 'cn-btn-primary' : kind === 'wa' ? 'cn-btn-wa' : ''}`}
                      >
                        {kind === 'wa' && <CIco.Wa />} {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {n.unread && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--indigo-600)',
                    alignSelf: 'center',
                    flexShrink: 0,
                  }}
                ></div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* RIGHT - preferences preview */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="cn-card cn-card-pad">
          <h3 className="cn-h3">Channels</h3>
          <Anno n="1">
            Per-module granular prefs. Aggressive batching from day one - anti-fatigue (PRD §3).
          </Anno>
          <div
            style={{
              marginTop: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              fontSize: 13,
            }}
          >
            {[
              ['Inquiries (marketplace)', ['Push', 'WhatsApp', 'Email']],
              ['Applications (jobs)', ['Push', 'WhatsApp']],
              ['New messages', ['Push', 'WhatsApp']],
              ['Likes & comments', ['Push (batched)']],
              ['Connection invites', ['Push']],
              ['Marketing & tips', []],
            ].map(([cat, chans]) => (
              <div key={cat}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--neutral-700)' }}>
                  {cat}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  {chans.length === 0 ? (
                    <span style={{ fontSize: 11, color: 'var(--neutral-400)' }}>Off</span>
                  ) : (
                    chans.map((ch) => (
                      <Pill key={ch} kind="indigo">
                        {ch}
                      </Pill>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cn-card cn-card-pad" style={{ background: 'var(--neutral-50)' }}>
          <h3 className="cn-h3">Caller ID (Naukri-style)</h3>
          <div style={{ fontSize: 12, color: 'var(--neutral-700)', marginTop: 6, lineHeight: 1.5 }}>
            When a recruiter calls you about a job, your phone shows the role + company. Spam-prone
            numbers can't ride the same channel.
          </div>
          <Anno n="2">Recruiter cold-contact caps. No "pay-to-be-seen" trap.</Anno>
        </div>
      </aside>
    </div>
  </window.ConnectShell>
);

/* Search (unified) - bonus screen since the PRD calls it out as cross-cutting */
const SearchScreen = () => (
  <window.ConnectShell title="Search" activeNav="">
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="cn-card" style={{ padding: 14, display: 'flex', gap: 10 }}>
        <div
          className="cn-globalsearch"
          style={{ width: 'auto', flex: 1, background: 'var(--neutral-50)' }}
        >
          <CIco.Search />
          <span style={{ color: 'var(--neutral-900)', fontWeight: 600 }}>
            "zari wholesaler Surat"
          </span>
        </div>
        <button className="cn-btn">
          <CIco.Mic /> Voice search
        </button>
      </div>

      <Anno n="1">
        One bar searches people, companies, products, jobs, posts. Synonyms handled (saree/sari,
        kurti/kurta). Voice search for low-literacy users.
      </Anno>

      {/* Type tabs */}
      <div className="cn-card" style={{ padding: 0 }}>
        <div className="cn-tabs" style={{ padding: 0 }}>
          <div className="cn-tab is-active">All · 248</div>
          <div className="cn-tab">
            People <span className="ct">· 92</span>
          </div>
          <div className="cn-tab">
            Products <span className="ct">· 124</span>
          </div>
          <div className="cn-tab">
            Companies <span className="ct">· 18</span>
          </div>
          <div className="cn-tab">
            Jobs <span className="ct">· 8</span>
          </div>
          <div className="cn-tab">
            Posts <span className="ct">· 6</span>
          </div>
        </div>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {/* People top */}
          <section className="cn-card cn-card-pad">
            <div className="cn-section-h">
              <h2>People · Top match</h2>
              <span className="cn-link">All 92 →</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                marginTop: 12,
              }}
            >
              {[
                ['ZW', 'Zari Wholesalers', 'Owner · Surat', '1st', '#8C7019'],
                ['AZ', 'Anand Zari Mills', 'Director · Surat', '2nd', 'var(--gold-700)'],
                ['SK', 'Sunil Kalia', 'Zari trader · 22yrs', '3rd', 'var(--indigo-700)'],
              ].map(([n, name, role, deg, c]) => (
                <div
                  key={n}
                  style={{
                    padding: 14,
                    border: '1px solid var(--neutral-200)',
                    borderRadius: 10,
                    textAlign: 'center',
                  }}
                >
                  <Av name={n} color={c} size="lg" />
                  <div style={{ fontWeight: 700, fontSize: 13, marginTop: 8 }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'var(--neutral-500)' }}>{role}</div>
                  <Pill kind="indigo" style={{ marginTop: 8 }}>
                    {deg} degree
                  </Pill>
                </div>
              ))}
            </div>
          </section>

          {/* Products top */}
          <section className="cn-card cn-card-pad">
            <div className="cn-section-h">
              <h2>Products · Top match</h2>
              <span className="cn-link">All 124 →</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 10,
                marginTop: 12,
              }}
            >
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="cn-prod">
                  <Img
                    label={'zari product ' + i}
                    style={{
                      aspectRatio: '1 / 1',
                      borderRadius: 0,
                      borderTop: 0,
                      borderLeft: 0,
                      borderRight: 0,
                    }}
                  />
                  <div className="cn-prod-body">
                    <div className="cn-prod-title">
                      {
                        [
                          'Pure silver zari',
                          'Antique zari spool',
                          'Gold-tone zari',
                          'Kasab zari kit',
                        ][i - 1]
                      }
                    </div>
                    <div className="cn-prod-price">₹2,400 – ₹3,200</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="cn-card cn-card-pad">
            <h3 className="cn-h3">Refine</h3>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                marginTop: 12,
                fontSize: 13,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--neutral-700)',
                    letterSpacing: '0.06em',
                    marginBottom: 4,
                  }}
                >
                  LOCATION
                </div>
                <Pill kind="indigo">Surat ×</Pill>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--neutral-700)',
                    letterSpacing: '0.06em',
                    marginBottom: 4,
                  }}
                >
                  VERIFIED ONLY
                </div>
                <Pill kind="green">GST + ERP-linked</Pill>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--neutral-700)',
                    letterSpacing: '0.06em',
                    marginBottom: 4,
                  }}
                >
                  SAVE THIS SEARCH
                </div>
                <button className="cn-btn cn-btn-sm" style={{ width: '100%' }}>
                  + Save with alert
                </button>
              </div>
            </div>
          </div>
          <div className="cn-card cn-card-pad" style={{ background: 'var(--neutral-50)' }}>
            <h3 className="cn-h3">Recent searches</h3>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                marginTop: 10,
                fontSize: 13,
              }}
            >
              <div>"silver zari"</div>
              <div>"multi-head Varachha"</div>
              <div>"bridal panel karigar"</div>
              <div>"georgette wholesale 60 gsm"</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </window.ConnectShell>
);

window.InboxScreen = InboxScreen;
window.NotificationsScreen = NotificationsScreen;
window.SearchScreen = SearchScreen;
