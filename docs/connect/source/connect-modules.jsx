/* Module sub-tab pages - locked by the design decisions doc.
   Jobs / Network / Marketplace each have 3–4 sub-tabs.
   Plus: Empty states gallery, WhatsApp handoff modal. */

/* ---------- Shared sub-tab strip ---------- */
const SubTabs = ({ items, active }) => (
  <div
    style={{
      display: 'flex',
      gap: 0,
      borderBottom: '1px solid var(--neutral-200)',
      background: 'var(--neutral-0)',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 2,
    }}
  >
    {items.map(([id, label, count]) => (
      <div
        key={id}
        style={{
          padding: '14px 14px 12px',
          fontSize: 13,
          color: active === id ? 'var(--indigo-700)' : 'var(--neutral-500)',
          fontWeight: 500,
          borderBottom: '2px solid ' + (active === id ? 'var(--indigo-700)' : 'transparent'),
          marginBottom: -1,
          cursor: 'pointer',
        }}
      >
        {label}{' '}
        {count != null && (
          <span
            style={{
              color: active === id ? 'var(--indigo-400)' : 'var(--neutral-400)',
              fontWeight: 500,
              marginLeft: 4,
            }}
          >
            · {count}
          </span>
        )}
      </div>
    ))}
  </div>
);
window.SubTabs = SubTabs;

/* ---------- Jobs · Posted Jobs (Pipeline ATS) ---------- */
const PostedJobsPipeline = () => {
  // Industry standard (Greenhouse / Lever / Ashby): counts = CURRENT-in-stage,
  // not cumulative. Past stages don't keep totals.
  const cols = [
    {
      id: 'applied',
      label: 'Applied',
      count: 21,
      bg: 'var(--info-50)',
      border: '#DBE6FF',
      dot: 'var(--info-500)',
    },
    {
      id: 'screened',
      label: 'Screened',
      count: 9,
      bg: 'var(--neutral-50)',
      border: 'var(--neutral-200)',
      dot: 'var(--neutral-400)',
    },
    {
      id: 'interviewed',
      label: 'Interviewed',
      count: 4,
      bg: 'var(--gold-100)',
      border: 'var(--gold-400)',
      dot: 'var(--gold-500)',
    },
    {
      id: 'offered',
      label: 'Offered',
      count: 2,
      bg: 'var(--warning-50)',
      border: '#FBE8C0',
      dot: 'var(--warning-500)',
    },
    {
      id: 'hired',
      label: 'Hired',
      count: 1,
      bg: 'var(--success-50)',
      border: '#C8F1DD',
      dot: 'var(--success-500)',
    },
    {
      id: 'rejected',
      label: 'Rejected',
      count: 19,
      bg: 'var(--neutral-100)',
      border: 'var(--neutral-300)',
      dot: 'var(--neutral-400)',
      collapsed: true,
    },
  ];
  const candidates = {
    applied: [
      {
        n: 'BR',
        name: 'Bhavin Rana',
        sub: 'Multi-head · 5 yrs · Surat',
        wage: '₹700/day',
        when: 'Applied 2h ago',
        stage: '2h',
        erp: false,
        voice: '0:24',
      },
      {
        n: 'IS',
        name: 'Imran Sheikh',
        sub: 'Aari · 8 yrs · Varachha',
        wage: '₹650/day',
        when: 'Applied 5h ago',
        stage: '5h',
        erp: true,
      },
      {
        n: 'AM',
        name: 'Anjali Mehta',
        sub: 'Aari · 9 yrs',
        wage: '₹800/day',
        when: 'Applied 8h ago',
        stage: '8h',
        erp: true,
      },
      {
        n: 'HJ',
        name: 'Hardik Joshi',
        sub: 'Multi-needle · 6 yrs',
        wage: '₹750/day',
        when: 'Applied 1d ago',
        stage: '1d',
        erp: true,
      },
    ],
    screened: [
      {
        n: 'PJ',
        name: 'Priya Joshi',
        sub: 'Hand embroidery · 5 yrs',
        wage: '₹650/day',
        note: 'Fits - schedule call',
        stage: '2d',
        erp: false,
      },
      {
        n: 'RK',
        name: 'Ramesh Kumar',
        sub: 'Computerized · 15 yrs',
        wage: '₹900/day',
        note: 'Senior - offer top of band?',
        stage: '3d',
        erp: true,
        stale: true,
      },
      {
        n: 'VS',
        name: 'Vikas Soni',
        sub: 'Computerized · 7 yrs',
        wage: '₹800/day',
        note: 'Available from 1 June',
        stage: '1d',
        erp: true,
      },
    ],
    interviewed: [
      {
        n: 'DM',
        name: 'Deepak Mistry',
        sub: 'Multi-head · 9 yrs',
        wage: '₹850/day',
        note: 'Strong technical',
        stage: '3d',
        erp: true,
      },
      {
        n: 'RM',
        name: 'Rashida Memon',
        sub: 'Aari · 9 yrs',
        wage: '₹700/day',
        note: 'Trial day Monday',
        stage: '1d',
        erp: true,
      },
    ],
    offered: [
      {
        n: 'SS',
        name: 'Sonia Sheikh',
        sub: 'Multi-head · 6 yrs',
        wage: '₹780/day',
        note: 'Offer ₹800 · awaiting reply',
        stage: '4d',
        erp: true,
        hot: true,
        stale: true,
      },
    ],
    hired: [
      {
        n: 'KD',
        name: 'Kavita Desai',
        sub: 'Multi-head · 8 yrs',
        wage: '₹850/day',
        note: 'Starts 1 June',
        stage: '6d',
        erp: true,
      },
    ],
    rejected: [],
  };

  return (
    <window.ConnectShell title="Jobs" activeNav="jobs">
      <SubTabs
        active="posted"
        items={[
          ['find', 'Find jobs', 248],
          ['applied', 'My applications', 5],
          ['posted', 'Posted jobs', 4],
          ['candidates', 'Candidates', 56],
        ]}
      />

      {/* Page header */}
      <div
        style={{
          padding: '18px 24px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: 'var(--neutral-0)',
          borderBottom: '1px solid var(--neutral-200)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--neutral-500)',
              letterSpacing: '0.06em',
            }}
          >
            POSTED JOB · ANAT TEXTILES
          </div>
          <h1
            style={{ fontSize: 20, fontWeight: 700, margin: '4px 0 0', letterSpacing: '-0.01em' }}
          >
            Machine operator - Multi-head computerized
          </h1>
          <div
            style={{
              fontSize: 12,
              color: 'var(--neutral-500)',
              marginTop: 4,
              display: 'flex',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            <span>Daily-wage · ₹650–₹900</span>
            <span>4 openings · 1 hired · 3 to go</span>
            <span>Posted 2 May · 56 total applicants · 37 active</span>
          </div>
        </div>
        <div style={{ flex: 1 }}></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="cn-btn">
            <CIco.Filter /> Filter
          </button>
          <button className="cn-btn">Sort · Best match ▾</button>
          <button className="cn-btn">
            <CIco.Search />
          </button>
          <button className="cn-btn cn-btn-primary">
            <CIco.Plus /> Add candidate
          </button>
        </div>
      </div>

      <Anno n="1">
        Industry-standard ATS semantics: column counts = currently-in-stage, not cumulative. Total
        processed in page header. Rejected is a 6th column (collapsed by default - most modern ATS
        pattern).
      </Anno>

      {/* Bulk select bar (preview state - would appear on selection) */}
      <div
        style={{
          padding: '8px 24px',
          background: 'var(--indigo-50)',
          borderBottom: '1px solid var(--indigo-100)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 12,
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--indigo-700)' }}>3 candidates selected</span>
        <span style={{ color: 'var(--neutral-500)' }}>·</span>
        <button className="cn-btn cn-btn-sm">Move to Screened</button>
        <button className="cn-btn cn-btn-sm">Send message</button>
        <button className="cn-btn cn-btn-sm" style={{ color: 'var(--danger-700)' }}>
          Reject
        </button>
        <div style={{ flex: 1 }}></div>
        <span style={{ color: 'var(--neutral-500)', cursor: 'pointer' }}>Clear</span>
      </div>

      {/* Pipeline */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr) 90px',
          gap: 12,
          padding: '14px 24px 24px',
          flex: 1,
          minHeight: 0,
        }}
      >
        {cols.map((c) => (
          <div key={c.id} style={{ display: 'flex', flexDirection: 'column', minHeight: 600 }}>
            <div
              style={{
                padding: '10px 12px',
                background: c.bg,
                border: '1px solid ' + c.border,
                borderRadius: '10px 10px 0 0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: c.dot,
                    flexShrink: 0,
                  }}
                ></span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--neutral-700)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {c.label}
                </span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--neutral-500)', fontWeight: 700 }}>
                {c.count}
              </span>
            </div>
            {c.collapsed ? (
              <div
                style={{
                  flex: 1,
                  background: 'var(--neutral-50)',
                  border: '1px solid var(--neutral-200)',
                  borderTop: 'none',
                  borderRadius: '0 0 10px 10px',
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 8,
                  color: 'var(--neutral-500)',
                  fontSize: 11,
                  textAlign: 'center',
                }}
              >
                <div style={{ padding: '20px 8px' }}>
                  19 rejected
                  <br />
                  <span style={{ color: 'var(--neutral-400)' }}>collapsed</span>
                </div>
                <span className="cn-link" style={{ fontSize: 11 }}>
                  Expand →
                </span>
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  background: 'var(--neutral-50)',
                  border: '1px solid var(--neutral-200)',
                  borderTop: 'none',
                  borderRadius: '0 0 10px 10px',
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  overflow: 'auto',
                }}
              >
                {/* Filter chip row */}
                {(candidates[c.id] || []).length > 0 && (
                  <div style={{ display: 'flex', gap: 4, fontSize: 10, paddingBottom: 4 }}>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: 'var(--neutral-0)',
                        border: '1px solid var(--neutral-200)',
                        color: 'var(--neutral-500)',
                        fontWeight: 600,
                      }}
                    >
                      All
                    </span>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: 'var(--neutral-0)',
                        border: '1px solid var(--neutral-200)',
                        color: 'var(--neutral-500)',
                        fontWeight: 600,
                      }}
                    >
                      ERP-linked
                    </span>
                  </div>
                )}
                {(candidates[c.id] || []).map((cand) => (
                  <div
                    key={cand.n}
                    style={{
                      padding: 10,
                      background: 'var(--neutral-0)',
                      border: '1px solid var(--neutral-200)',
                      borderRadius: 8,
                      fontSize: 12,
                      position: 'relative',
                    }}
                  >
                    {cand.hot && (
                      <div
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: 8,
                          fontSize: 9,
                          padding: '1px 6px',
                          background: 'var(--warning-500)',
                          color: 'white',
                          borderRadius: 4,
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                        }}
                      >
                        HOT
                      </div>
                    )}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '16px 28px 1fr',
                        gap: 6,
                        alignItems: 'center',
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
                      <Av name={cand.n} color="var(--indigo-700)" size="sm" />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {cand.name}
                          </span>
                          {cand.erp && <Verified kind="erp" />}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: 'var(--neutral-500)',
                            marginTop: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cand.sub}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 6,
                        fontSize: 10,
                      }}
                    >
                      <span style={{ color: 'var(--neutral-700)', fontWeight: 700 }}>
                        {cand.wage}
                      </span>
                      <span
                        style={{
                          color: cand.stale ? 'var(--danger-700)' : 'var(--neutral-400)',
                          fontWeight: cand.stale ? 700 : 500,
                        }}
                        title="Time in current stage"
                      >
                        {cand.stage} in stage
                      </span>
                    </div>
                    {cand.voice && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          marginTop: 6,
                          padding: '3px 6px',
                          background: 'var(--indigo-50)',
                          borderRadius: 4,
                          fontSize: 10,
                          color: 'var(--indigo-700)',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ▶ <CIco.Mic style={{ width: 10, height: 10 }} /> {cand.voice}
                      </div>
                    )}
                    {cand.note && (
                      <div
                        style={{
                          marginTop: 6,
                          padding: '6px 8px',
                          background: 'var(--gold-100)',
                          borderRadius: 4,
                          fontSize: 10,
                          color: 'var(--gold-700)',
                          lineHeight: 1.4,
                        }}
                      >
                        {cand.note}
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        gap: 4,
                        marginTop: 8,
                        paddingTop: 6,
                        borderTop: '1px dashed var(--neutral-200)',
                      }}
                    >
                      <button
                        className="cn-btn cn-btn-sm"
                        style={{ flex: 1, padding: '4px 6px', fontSize: 10 }}
                      >
                        <CIco.Phone style={{ width: 10, height: 10 }} />
                      </button>
                      <button
                        className="cn-btn cn-btn-sm"
                        style={{ flex: 1, padding: '4px 6px', fontSize: 10 }}
                      >
                        <CIco.Wa style={{ width: 10, height: 10 }} />
                      </button>
                      <button
                        className="cn-btn cn-btn-sm"
                        style={{ flex: 1, padding: '4px 6px', fontSize: 10 }}
                      >
                        Move ▾
                      </button>
                    </div>
                  </div>
                ))}
                {(candidates[c.id] || []).length === 0 && (
                  <div
                    style={{
                      padding: '24px 8px',
                      textAlign: 'center',
                      fontSize: 11,
                      color: 'var(--neutral-400)',
                    }}
                  >
                    -
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Caller-ID intent banner */}
      <div
        style={{
          padding: '14px 24px',
          background: 'var(--indigo-50)',
          borderTop: '1px solid var(--neutral-200)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'var(--indigo-700)',
            color: 'white',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <CIco.Phone />
        </div>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--indigo-700)' }}>
          <b>Caller ID with intent is on.</b> When you call from Connect, candidates' phones show:{' '}
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              padding: '1px 6px',
              background: 'var(--neutral-0)',
              borderRadius: 4,
              marginLeft: 4,
            }}
          >
            Zari360 · Hiring for Multi-head Operator · Anat Textiles
          </span>
        </div>
        <span className="cn-link">Settings</span>
      </div>
    </window.ConnectShell>
  );
};
window.PostedJobsPipeline = PostedJobsPipeline;

/* ---------- Jobs · Candidates tab ---------- */
const CandidatesTab = () => (
  <window.ConnectShell title="Jobs" activeNav="jobs">
    <SubTabs
      active="candidates"
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
        gridTemplateColumns: '260px 1fr',
        gap: 20,
        alignItems: 'start',
      }}
    >
      <aside className="cn-card cn-card-pad">
        <h3 className="cn-h3" style={{ marginBottom: 12 }}>
          Search candidates
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
          <div className="cn-input">Skill: Multi-head ▾</div>
          <div className="cn-input">Location: Surat ▾</div>
          <div className="cn-input">Experience: 2+ yrs ▾</div>
          <div className="cn-input">Wage: ₹400–₹1,200/day</div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--neutral-700)',
                letterSpacing: '0.06em',
                marginBottom: 6,
                textTransform: 'uppercase',
              }}
            >
              Open to
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Pill kind="green">Work ×</Pill>
              <Pill>Available now</Pill>
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--neutral-700)',
                letterSpacing: '0.06em',
                marginBottom: 6,
                textTransform: 'uppercase',
              }}
            >
              Verified only
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <Pill kind="indigo">ERP-linked ✓</Pill>
            </div>
          </div>
          <button className="cn-btn cn-btn-sm" style={{ marginTop: 4 }}>
            + Save this search
          </button>
        </div>
      </aside>

      <main style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            padding: 16,
            background: 'var(--indigo-50)',
            border: '1px solid var(--indigo-100)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: 'var(--indigo-700)',
              color: 'white',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <CIco.Phone />
          </div>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--indigo-700)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--indigo-800)' }}>
              Caller ID with intent
            </div>
            <div style={{ marginTop: 2 }}>
              When you call a candidate from Connect, their phone shows your workshop name + the
              role you're hiring for. Spam-prone numbers can't ride this channel.
            </div>
          </div>
          <span className="cn-link">How it works</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="cn-h2">56 candidates match</h2>
          <span style={{ fontSize: 12, color: 'var(--neutral-500)' }}>Sort · Best match ▾</span>
        </div>

        {[
          {
            n: 'IS',
            name: 'Imran Sheikh',
            sub: 'Aari · 8 yrs · Varachha',
            wage: '₹650 – ₹900/day',
            activity: 'Active today',
            erp: true,
            openTo: ['Work · daily-wage', 'Work · piece-rate'],
          },
          {
            n: 'DM',
            name: 'Deepak Mistry',
            sub: 'Workshop owner · 22 karigars',
            wage: 'Hires & places teams',
            activity: 'Active 2h ago',
            erp: true,
            openTo: ['Custom orders'],
          },
          {
            n: 'AM',
            name: 'Anjali Mehta',
            sub: 'Aari · 9 yrs · Katargam',
            wage: '₹700 – ₹950/day',
            activity: 'Active yesterday',
            erp: true,
            openTo: ['Work · daily-wage'],
          },
          {
            n: 'BR',
            name: 'Bhavin Rana',
            sub: 'Multi-head · 5 yrs · Varachha',
            wage: '₹600 – ₹800/day',
            activity: 'Active today',
            openTo: ['Work · daily-wage', 'Work · piece-rate'],
          },
        ].map((p) => (
          <div
            key={p.n}
            style={{
              padding: 16,
              background: 'var(--neutral-0)',
              border: '1px solid var(--neutral-200)',
              borderRadius: 10,
              display: 'grid',
              gridTemplateColumns: '52px 1fr auto',
              gap: 14,
              alignItems: 'center',
            }}
          >
            <Av name={p.n} color="var(--indigo-700)" />
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {p.name} {p.erp && <Verified kind="erp" />}
              </div>
              <div style={{ fontSize: 12, color: 'var(--neutral-600)', marginTop: 2 }}>{p.sub}</div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--neutral-500)',
                  marginTop: 4,
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <span>{p.wage}</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: 'var(--success-700)',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--success-500)',
                    }}
                  ></span>
                  {p.activity}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                {p.openTo.map((t) => (
                  <Pill key={t} kind="green">
                    {t}
                  </Pill>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="cn-btn cn-btn-sm">
                <CIco.Bookmark />
              </button>
              <button className="cn-btn cn-btn-sm">
                <CIco.Phone />
              </button>
              <button className="cn-btn cn-btn-sm cn-btn-wa">
                <CIco.Wa />
              </button>
              <button className="cn-btn cn-btn-sm cn-btn-primary">Invite to apply</button>
            </div>
          </div>
        ))}
      </main>
    </div>
  </window.ConnectShell>
);
window.CandidatesTab = CandidatesTab;
