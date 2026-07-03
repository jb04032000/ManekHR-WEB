// Shared layout - sidebar, topbar, main grid. Per-variation tokens are passed via the `theme` prop applied to the root.

const Sidebar = ({ tone = 'cream' }) => {
  // tone: 'cream' = sidebar matches page (current), 'white' = sidebar pulled to white, 'indigo' = dark indigo sidebar
  const isIndigo = tone === 'indigo';
  return (
    <aside
      className="sidebar"
      style={{
        background: isIndigo
          ? 'var(--indigo-800)'
          : tone === 'white'
            ? 'var(--neutral-0)'
            : 'var(--neutral-50)',
        color: isIndigo ? 'var(--neutral-100)' : undefined,
        borderRight: isIndigo ? '1px solid var(--indigo-700)' : '1px solid var(--neutral-200)',
      }}
    >
      <div className="logo">
        <div
          className="logo-mark"
          style={isIndigo ? { background: 'var(--gold-500)', color: 'var(--indigo-800)' } : null}
        >
          Z
        </div>
        <div>
          <div className="logo-text" style={isIndigo ? { color: 'var(--neutral-0)' } : null}>
            Zari360
          </div>
          <div className="logo-sub" style={isIndigo ? { color: 'var(--gold-400)' } : null}>
            CUSTOM
          </div>
        </div>
      </div>

      <div
        className="ws-pill"
        style={
          isIndigo
            ? {
                background: 'var(--indigo-700)',
                borderColor: 'var(--indigo-700)',
                color: 'var(--neutral-100)',
              }
            : null
        }
      >
        <div
          className="ws-dot"
          style={isIndigo ? { background: 'var(--gold-500)', color: 'var(--indigo-800)' } : null}
        >
          W
        </div>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>Workspace 1</span>
        <Ico.Chevron />
      </div>

      {[
        ['Dashboard', Ico.Dashboard, true],
        ['Team', Ico.Team, false],
        ['Attendance', Ico.Calendar, false],
        ['Payroll', Ico.Money, false],
        ['Finance', Ico.Receipt, false, true],
        ['Machines', Ico.Tool, false, true],
        ['Workspace 1', Ico.Building, false, true],
      ].map(([label, Icon, active, hasChevron]) => (
        <div
          key={label}
          className={`nav-item ${active ? 'active' : ''}`}
          style={
            isIndigo
              ? {
                  color: active ? 'var(--neutral-0)' : 'var(--indigo-200)',
                  background: active ? 'var(--indigo-700)' : 'transparent',
                }
              : null
          }
        >
          <Icon className="ico" />
          <span style={{ flex: 1 }}>{label}</span>
          {hasChevron && <Ico.Chevron />}
        </div>
      ))}
    </aside>
  );
};

const Topbar = () => (
  <div className="topbar">
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <Ico.Menu style={{ color: 'var(--neutral-500)' }} />
      <h1>Dashboard</h1>
    </div>
    <div className="topbar-actions">
      <select className="lang">
        <option>English</option>
      </select>
      <div className="bell">
        <Ico.Bell style={{ color: 'var(--neutral-600)' }} />
      </div>
      <div className="avatar">
        <div className="avatar-circle">TU</div>
        <span style={{ fontSize: 13, fontWeight: 500 }}>Test User</span>
      </div>
    </div>
  </div>
);

const Greeting = ({ accentName = false }) => (
  <div className="greet-row">
    <div className="greet">
      <h2>
        Good morning,{' '}
        {accentName ? <span style={{ color: 'var(--indigo-600)' }}>Test</span> : 'Test'}{' '}
        <span>👋</span>
      </h2>
      <p>Workspace 1 · Wednesday, May 6 2026</p>
    </div>
    <button className="btn-refresh">
      <Ico.Refresh /> Refresh
    </button>
  </div>
);

// Donut SVG - radius based attendance ring
const Donut = ({
  pct = 0,
  color = 'var(--success-500)',
  track = 'var(--neutral-200)',
  size = 160,
}) => {
  const r = 64,
    c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      <circle cx="80" cy="80" r={r} stroke={track} strokeWidth="14" fill="none" />
      <circle
        cx="80"
        cy="80"
        r={r}
        stroke={color}
        strokeWidth="14"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform="rotate(-90 80 80)"
      />
    </svg>
  );
};

const AttendanceCard = ({ donutColor }) => (
  <div
    className="card"
    style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      boxShadow: 'var(--card-shadow)',
    }}
  >
    <div className="card-head">
      <h3>Attendance Today</h3>
      <span className="link">View all →</span>
    </div>
    <div className="donut-wrap" style={{ position: 'relative' }}>
      <Donut pct={0} color={donutColor || 'var(--success-500)'} />
      <div
        style={{
          position: 'absolute',
          textAlign: 'center',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="donut-center">0%</div>
        <div className="donut-sub">PRESENT</div>
      </div>
    </div>
    <div className="legend">
      {[
        ['Present', 'var(--success-500)', 0],
        ['Absent', 'var(--danger-500)', 0],
        ['Half Day', 'var(--warning-500)', 0],
        ['Leave', 'var(--info-500)', 0],
        ['Late', 'var(--gold-500)', 0],
        ['Unmarked', 'var(--neutral-300)', 8],
      ].map(([label, color, count]) => (
        <div key={label} className="legend-row">
          <div className="legend-left">
            <span className="legend-dot" style={{ background: color }} />
            {label}
          </div>
          <div className="legend-count">{count}</div>
        </div>
      ))}
    </div>
  </div>
);

const PayrollCard = () => (
  <div
    className="card"
    style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      boxShadow: 'var(--card-shadow)',
    }}
  >
    <h3>Payroll Overview</h3>
    <div className="stat-block">
      <div className="stat-block-label">TOTAL PAYABLE - MAY 2026</div>
      <div className="total-amount">₹1,88,500</div>
    </div>
    <div className="split">
      <div>
        <div className="stat-block-label" style={{ color: 'var(--success-700)' }}>
          PAID
        </div>
        <div className="split-amt" style={{ color: 'var(--success-700)' }}>
          ₹15,000
        </div>
      </div>
      <div>
        <div className="stat-block-label">REMAINING</div>
        <div className="split-amt" style={{ color: 'var(--neutral-700)' }}>
          ₹1,73,500
        </div>
      </div>
    </div>
    <div className="progress-row">
      <span>Payment progress</span>
      <span style={{ fontWeight: 600, color: 'var(--neutral-700)' }}>1/8 Team</span>
    </div>
    <div className="progress">
      <span />
    </div>
    <button className="btn-primary">Generate Payroll</button>
  </div>
);

const LockedCard = ({ subtle = false }) => (
  <div
    className="card locked"
    style={{
      background: subtle ? 'var(--neutral-100)' : 'var(--card-bg)',
      border: '1px dashed var(--neutral-300)',
      boxShadow: 'none',
    }}
  >
    <div className="lock-icon">
      <Ico.Lock />
    </div>
    <div className="lock-title">Machines maintenance is locked</div>
    <div className="lock-body">
      Your Custom (Admin Assigned) plan doesn't include access to this feature.
    </div>
    <button className="btn-upgrade">
      <Ico.Crown /> Upgrade Plan
    </button>
  </div>
);

window.Sidebar = Sidebar;
window.Topbar = Topbar;
window.Greeting = Greeting;
window.AttendanceCard = AttendanceCard;
window.PayrollCard = PayrollCard;
window.LockedCard = LockedCard;
window.Donut = Donut;
