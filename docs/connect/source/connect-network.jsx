/* My Network - connection requests, suggestions, your network list */

const NetworkScreen = () => (
  <window.ConnectShell
    title="My Network"
    activeNav="network"
    counts={{ network: 4, inbox: 3, notifications: '9+' }}
  >
    <SubTabs
      active="invites"
      items={[
        ['invites', 'Invitations', 4],
        ['connections', 'Connections', 248],
        ['following', 'Following', 67],
        ['suggestions', 'Suggestions', null],
      ]}
    />
    <div
      style={{
        padding: '20px 24px',
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gap: 20,
        alignItems: 'start',
      }}
    >
      {/* LEFT */}
      <aside className="cn-card">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--neutral-200)' }}>
          <h3 className="cn-h3">Manage my network</h3>
        </div>
        <div style={{ padding: 6 }}>
          {[
            ['Connections', '248', true],
            ['Following', '67'],
            ['Companies you follow', '14'],
            ['Hashtags', '8'],
            ['Saved searches', '3'],
            ['Blocked', '0'],
          ].map(([n, ct, active]) => (
            <div
              key={n}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                fontSize: 13,
                fontWeight: 500,
                color: active ? 'var(--indigo-700)' : 'var(--neutral-700)',
                background: active ? 'var(--indigo-50)' : 'transparent',
                borderRadius: 8,
                marginBottom: 2,
              }}
            >
              <span>{n}</span>
              <span style={{ color: 'var(--neutral-500)', fontSize: 12 }}>{ct}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        {/* Pending invitations */}
        <section className="cn-card">
          <div
            style={{
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--neutral-200)',
            }}
          >
            <h2 className="cn-h2">Invitations</h2>
            <div style={{ display: 'flex', gap: 4, fontSize: 12, color: 'var(--neutral-500)' }}>
              <span
                style={{
                  padding: '6px 11px',
                  borderRadius: 999,
                  background: 'var(--indigo-700)',
                  color: 'white',
                  fontWeight: 600,
                }}
              >
                Received · 4
              </span>
              <span
                style={{
                  padding: '6px 11px',
                  borderRadius: 999,
                  background: 'var(--neutral-100)',
                  color: 'var(--neutral-600)',
                  fontWeight: 600,
                }}
              >
                Sent · 7
              </span>
              <span
                style={{
                  padding: '6px 11px',
                  borderRadius: 999,
                  background: 'var(--neutral-100)',
                  color: 'var(--neutral-600)',
                  fontWeight: 600,
                }}
              >
                Archive
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              [
                'IS',
                '#1A2A6C',
                'Imran Sheikh',
                'Aari karigar at Self · 8 yrs',
                '12 mutual connections',
                '"Salaam, aapke saath kaam karne ka man hai"',
              ],
              [
                'NK',
                '#8C5A3C',
                'Nidhi Kapoor',
                'Owner, Kapoor Designs · Designer',
                '5 mutual · You work in same area',
                null,
              ],
              [
                'BR',
                '#0E1844',
                'Bhavin Rana',
                'Multi-head machine operator · 5 yrs',
                '8 mutual connections',
                null,
              ],
            ].map(([n, c, name, role, mutual, note]) => (
              <div
                key={n}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr auto',
                  gap: 14,
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--neutral-100)',
                  alignItems: 'center',
                }}
              >
                <Av name={n} color={c} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{name}</span>
                    {n === 'IS' && <Verified kind="erp" />}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--neutral-600)' }}>{role}</div>
                  <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 4 }}>
                    {mutual}
                  </div>
                  {note && (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--neutral-700)',
                        marginTop: 8,
                        padding: '8px 12px',
                        background: 'var(--neutral-50)',
                        borderRadius: 8,
                        fontStyle: 'italic',
                      }}
                    >
                      {note}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="cn-btn cn-btn-sm">Ignore</button>
                  <button className="cn-btn cn-btn-primary cn-btn-sm">Accept</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* People you may know */}
        <section className="cn-card">
          <div
            style={{
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--neutral-200)',
            }}
          >
            <h2 className="cn-h2">People you may know</h2>
            <div style={{ display: 'flex', gap: 6, fontSize: 12 }}>
              <Pill kind="indigo">In your area · Surat</Pill>
              <Pill>Same skills</Pill>
              <Pill>Worked with mutuals</Pill>
              <Pill>Other</Pill>
            </div>
          </div>
          <Anno n="1">
            {' '}
            Recommendations weighted by ERP-linked workspace overlap, same-area, skill match, and
            mutuals. Avoid surfacing by community / religion (anti-pattern from PRD §3).
          </Anno>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 14 }}
          >
            {[
              ['PJ', 'var(--gold-700)', 'Priya Joshi', 'Hand embroidery · 5 yrs', '4 mutual', true],
              [
                'RK',
                'var(--indigo-700)',
                'Ramesh Kumar',
                'Computerized · 15 yrs',
                '12 mutual',
                true,
              ],
              ['SS', '#8C5A3C', 'Sonia Sheikh', 'Designer · Bridal', '3 mutual', false],
              [
                'DM',
                'var(--indigo-800)',
                'Deepak Mistry',
                'Workshop owner · 22 karigars',
                '7 mutual',
                true,
              ],
              ['TT', '#8C7019', 'Tina Trivedi', 'Buyer · Bridal brand', '2 mutual', false],
              [
                'AM',
                'var(--indigo-600)',
                'Anjali Mehta',
                'Master karigar · Aari',
                '9 mutual',
                true,
              ],
            ].map(([n, c, name, sub, mutual, erp]) => (
              <div
                key={n}
                style={{
                  padding: 16,
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 10,
                  textAlign: 'center',
                  background: 'var(--neutral-0)',
                }}
              >
                <div style={{ display: 'grid', placeItems: 'center', marginBottom: 10 }}>
                  <Av name={n} color={c} size="lg" />
                </div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 4,
                    alignItems: 'center',
                  }}
                >
                  {name}
                  {erp && <Verified kind="erp" />}
                </div>
                <div style={{ fontSize: 12, color: 'var(--neutral-600)', marginTop: 4 }}>{sub}</div>
                <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 4 }}>
                  {mutual} connections
                </div>
                <button className="cn-btn" style={{ width: '100%', marginTop: 12 }}>
                  <CIco.Plus /> Connect
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Workshops / companies to follow */}
        <section className="cn-card cn-card-pad">
          <div className="cn-section-h">
            <h2>Workshops & brands to follow</h2>
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
              ['Anat Textiles', '17 karigars · 6 posts / mo'],
              ['Roop Bridal Studio', '24 karigars · 11 posts / mo'],
              ['Sharma Karigars', '3 karigars · 2 posts / mo'],
              ['Zari Wholesalers', '12 yrs · 84 products live'],
            ].map(([co, sub]) => (
              <div
                key={co}
                style={{
                  padding: 12,
                  border: '1px solid var(--neutral-200)',
                  borderRadius: 10,
                  textAlign: 'center',
                  background: 'var(--neutral-0)',
                }}
              >
                <Img
                  label="logo"
                  style={{
                    width: 48,
                    height: 48,
                    margin: '0 auto',
                    aspectRatio: '1 / 1',
                    borderRadius: 8,
                  }}
                />
                <div style={{ fontWeight: 700, fontSize: 13, marginTop: 8 }}>{co}</div>
                <div
                  style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 2, minHeight: 28 }}
                >
                  {sub}
                </div>
                <button className="cn-btn cn-btn-sm" style={{ width: '100%', marginTop: 10 }}>
                  + Follow
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  </window.ConnectShell>
);

window.NetworkScreen = NetworkScreen;
