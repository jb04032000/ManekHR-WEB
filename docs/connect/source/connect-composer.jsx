/* Post composition flows
   4 modes: Photo / Product / Job / Job-requirement / Voice-note
   Shown as side-by-side modal-style sheets on the feed background. */

const Sheet = ({ kind, title, eyebrow, children, primary, ghost = 'Cancel' }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      background: 'rgba(14,24,68,0.45)',
      backdropFilter: 'blur(2px)',
      display: 'grid',
      placeItems: 'center',
      padding: 20,
    }}
  >
    <div
      style={{
        width: '100%',
        maxWidth: 560,
        background: 'var(--neutral-0)',
        borderRadius: 16,
        boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '92%',
      }}
    >
      <div
        style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--neutral-200)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'var(--indigo-50)',
            color: 'var(--indigo-700)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {kind}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--neutral-500)',
              letterSpacing: '0.08em',
            }}
          >
            {eyebrow}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>
        </div>
        <CIco.Plus
          style={{ color: 'var(--neutral-400)', transform: 'rotate(45deg)', cursor: 'pointer' }}
        />
      </div>
      <div
        style={{
          padding: 20,
          overflow: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {children}
      </div>
      <div
        style={{
          padding: 16,
          borderTop: '1px solid var(--neutral-200)',
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
          background: 'var(--neutral-50)',
        }}
      >
        <button className="cn-btn">{ghost}</button>
        <button className="cn-btn cn-btn-primary">{primary}</button>
      </div>
    </div>
  </div>
);

const ComposerScreen = () => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gridTemplateRows: 'repeat(2, 1fr)',
      gap: 16,
      padding: 16,
      background: 'var(--neutral-200)',
      minHeight: '100%',
    }}
  >
    {/* PRODUCT */}
    <div
      style={{
        background: 'var(--neutral-100)',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.25,
          pointerEvents: 'none',
          background:
            'repeating-linear-gradient(45deg, var(--neutral-300) 0 1px, transparent 1px 16px)',
        }}
      ></div>
      <Sheet
        kind={<CIco.Store />}
        eyebrow="MARKETPLACE · POST A PRODUCT"
        title="List a product"
        primary="Publish listing"
      >
        <Anno n="1">
          Used by sellers. Multi-image upload, embroidery taxonomy, GST-required HSN code.
        </Anno>
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
            Product photos · 4–8 recommended
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            <Img label="photo 1" style={{ aspectRatio: '1 / 1' }} />
            <Img label="+" style={{ aspectRatio: '1 / 1' }} />
            <Img label="+" style={{ aspectRatio: '1 / 1' }} />
            <div
              style={{
                aspectRatio: '1 / 1',
                border: '1px dashed var(--neutral-300)',
                borderRadius: 8,
                display: 'grid',
                placeItems: 'center',
                color: 'var(--neutral-400)',
                fontSize: 11,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <CIco.Plus />
                <div style={{ marginTop: 4 }}>Add</div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--neutral-500)', marginTop: 6 }}>
            Tip: angles matter for fabric / material. Add detail shots.
          </div>
        </div>
        <div className="cn-input">Title - e.g. "Pure silver zari thread, 5 shades"</div>
        <div className="cn-input-row">
          <div className="cn-input">Category · Threads & zari ▾</div>
          <div className="cn-input">Sub-category · Silver zari ▾</div>
        </div>
        <div className="cn-input-row">
          <div className="cn-input">Price (low) · ₹2,400</div>
          <div className="cn-input">Price (high) · ₹2,800</div>
        </div>
        <div className="cn-input-row">
          <div className="cn-input">Unit · /kg ▾</div>
          <div className="cn-input">MOQ · 5 kg</div>
        </div>
        <div className="cn-input">
          HSN code · 5605.00.10{' '}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--success-700)' }}>
            ✓ valid
          </span>
        </div>
        <div className="cn-input tall">Specs - material, GSM, thread count, dimensions</div>
      </Sheet>
    </div>

    {/* JOB POST */}
    <div
      style={{
        background: 'var(--neutral-100)',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Sheet
        kind={<CIco.Briefcase />}
        eyebrow="JOBS · POST AN OPENING"
        title="Post a job"
        primary="Post job"
      >
        <Anno n="2">
          Daily-wage / piece-rate / monthly all available. Machine-type tag is required for karigar
          roles.
        </Anno>
        <div className="cn-input">Title - e.g. "Multi-needle machine operator"</div>
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
            Employment type
          </div>
          <div className="cn-radio-row" style={{ flexWrap: 'wrap' }}>
            <span className="cn-radio on">Daily-wage</span>
            <span className="cn-radio">Piece-rate</span>
            <span className="cn-radio">Monthly</span>
            <span className="cn-radio">Part-time</span>
            <span className="cn-radio">Apprenticeship</span>
          </div>
        </div>
        <div className="cn-input-row">
          <div className="cn-input">Wage range - ₹650 – ₹900 / day</div>
          <div className="cn-input">Openings · 4</div>
        </div>
        <div className="cn-input-row">
          <div className="cn-input">Location · Surat - Varachha ▾</div>
          <div className="cn-input">Experience · 2+ yrs ▾</div>
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
            Machine type required
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Pill kind="indigo">Multi-head ✓</Pill>
            <Pill kind="indigo">Computerized ✓</Pill>
            <Pill>+ Single-needle</Pill>
          </div>
        </div>
        <div className="cn-input tall">Description - what the role involves</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            background: 'var(--neutral-50)',
            borderRadius: 8,
          }}
        >
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              background: 'var(--indigo-700)',
              display: 'grid',
              placeItems: 'center',
              color: 'white',
            }}
          >
            <CIco.Check2 />
          </span>
          <span style={{ fontSize: 13 }}>Accept voice-note applications</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            background: 'var(--neutral-50)',
            borderRadius: 8,
          }}
        >
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              background: 'var(--indigo-700)',
              display: 'grid',
              placeItems: 'center',
              color: 'white',
            }}
          >
            <CIco.Check2 />
          </span>
          <span style={{ fontSize: 13 }}>WhatsApp-first communication</span>
        </div>
      </Sheet>
    </div>

    {/* JOB REQUIREMENT (karigar / shop looking for work) */}
    <div
      style={{
        background: 'var(--neutral-100)',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Sheet
        kind={<CIco.Users />}
        eyebrow="FEED · I'M LOOKING FOR…"
        title="Post a requirement"
        primary="Post requirement"
      >
        <Anno n="3">
          Inverse of a job post - karigars / workshops broadcasting availability. Routes to Jobs and
          to the "Available karigars near you" feed surface.
        </Anno>
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
            I am looking for…
          </div>
          <div className="cn-radio-row" style={{ flexWrap: 'wrap' }}>
            <span className="cn-radio on">Work for myself</span>
            <span className="cn-radio">Karigars to hire</span>
            <span className="cn-radio">Bulk orders</span>
            <span className="cn-radio">Materials</span>
          </div>
        </div>
        <div className="cn-input">
          Headline - e.g. "Multi-needle karigar available · daily-wage"
        </div>
        <div className="cn-input-row">
          <div className="cn-input">Available from · 1 June</div>
          <div className="cn-input">Hours · 8 hrs/day</div>
        </div>
        <div className="cn-input-row">
          <div className="cn-input">Expected wage · ₹600 – ₹800/day</div>
          <div className="cn-input">Location · Surat-Varachha 5km</div>
        </div>
        <div className="cn-input tall">A few details - experience, machine types, work samples</div>
        <button className="cn-btn">
          <CIco.Mic style={{ color: 'var(--danger-500)' }} /> Record voice instead
        </button>
      </Sheet>
    </div>

    {/* VOICE NOTE POST */}
    <div
      style={{
        background: 'var(--neutral-100)',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Sheet
        kind={<CIco.Mic />}
        eyebrow="FEED · VOICE NOTE POST"
        title="Record a voice post"
        primary="Post voice note"
      >
        <Anno n="4">
          Low-literacy path. Auto-transcribed (Gu / Hi / En). Voice posts go into the feed with
          playable audio + transcript.
        </Anno>

        <div
          style={{
            padding: 28,
            background: 'linear-gradient(180deg, var(--neutral-50), var(--neutral-100))',
            border: '1px solid var(--neutral-200)',
            borderRadius: 12,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              margin: '0 auto',
              borderRadius: '50%',
              background: 'var(--danger-500)',
              color: 'white',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 8px 24px rgba(239,68,68,0.35)',
            }}
          >
            <CIco.Mic style={{ width: 32, height: 32 }} />
          </div>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 22,
              fontWeight: 700,
              marginTop: 16,
              color: 'var(--neutral-900)',
            }}
          >
            0:24
          </div>
          <div style={{ fontSize: 12, color: 'var(--neutral-500)', marginTop: 4 }}>
            Recording · tap to stop
          </div>

          {/* fake waveform */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 3,
              marginTop: 18,
              alignItems: 'center',
              height: 36,
            }}
          >
            {[
              8, 16, 24, 12, 32, 20, 28, 14, 22, 30, 10, 26, 18, 24, 12, 20, 28, 16, 8, 14, 22, 18,
              26, 10, 30, 16, 12,
            ].map((h, i) => (
              <span
                key={i}
                style={{
                  display: 'block',
                  width: 3,
                  height: h,
                  borderRadius: 2,
                  background: i < 14 ? 'var(--danger-500)' : 'var(--neutral-300)',
                }}
              ></span>
            ))}
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
            Transcript (auto)
          </div>
          <div
            style={{
              padding: 12,
              background: 'var(--neutral-50)',
              borderRadius: 8,
              fontSize: 13,
              color: 'var(--neutral-700)',
              lineHeight: 1.5,
            }}
          >
            "Salaam, main Bhavin hu. Multi-needle machine pe 5 saal ka kaam hai. Daily-wage ₹700–800
            pe available hu. Surat Varachha mein. Photo bheju to kya?"
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: 'var(--neutral-500)',
              marginTop: 6,
            }}
          >
            <span>Detected: Hindi / Urdu mix</span>
            <span className="cn-link">Edit transcript</span>
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
            Tag this post as
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Pill kind="indigo">Open to work ✓</Pill>
            <Pill>Open to bulk</Pill>
            <Pill>Showing work</Pill>
            <Pill>Question</Pill>
          </div>
        </div>
      </Sheet>
    </div>
  </div>
);

window.ComposerScreen = ComposerScreen;
