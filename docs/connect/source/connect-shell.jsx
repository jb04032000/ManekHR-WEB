// Zari360 Connect - extended icon set (lucide-style)
const CIco = {
  ...window.Ico,
  Home: (p) => (
    <svg
      {...p}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  Feed: (p) => (
    <svg
      {...p}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  ),
  Network: (p) => (
    <svg
      {...p}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="19" r="2.5" />
      <circle cx="19" cy="19" r="2.5" />
      <path d="M11 7l-5 10" />
      <path d="M13 7l5 10" />
      <path d="M8 19h8" />
    </svg>
  ),
  Store: (p) => (
    <svg
      {...p}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M3 9v11h18V9" />
      <path d="M3 9h18" />
      <path d="M9 14h6" />
    </svg>
  ),
  Briefcase: (p) => (
    <svg
      {...p}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Inbox: (p) => (
    <svg
      {...p}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </svg>
  ),
  Search: (p) => (
    <svg
      {...p}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16.65" y2="16.65" />
    </svg>
  ),
  Heart: (p) => (
    <svg
      {...p}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  Comment: (p) => (
    <svg
      {...p}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Share: (p) => (
    <svg
      {...p}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  Wa: (p) => (
    <svg {...p} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91a9.83 9.83 0 0 0-2.91-7.01zm-7.01 15.24a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 0 1-1.26-4.38c0-4.55 3.7-8.25 8.26-8.25 2.2 0 4.28.86 5.83 2.42a8.18 8.18 0 0 1 2.42 5.84c0 4.55-3.7 8.23-8.26 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01a.91.91 0 0 0-.66.31c-.23.25-.86.85-.86 2.07s.88 2.4 1 2.56c.12.16 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.14-1.18-.06-.1-.22-.16-.47-.28z" />
    </svg>
  ),
  Phone: (p) => (
    <svg
      {...p}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72a2 2 0 0 1 1.72 2.03z" />
    </svg>
  ),
  MapPin: (p) => (
    <svg
      {...p}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Plus: (p) => (
    <svg
      {...p}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  More: (p) => (
    <svg
      {...p}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  ),
  Image: (p) => (
    <svg
      {...p}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  Video: (p) => (
    <svg
      {...p}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  ),
  Doc: (p) => (
    <svg
      {...p}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  Mic: (p) => (
    <svg
      {...p}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  ),
  Globe: (p) => (
    <svg
      {...p}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20z" />
    </svg>
  ),
  Check2: (p) => (
    <svg
      {...p}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Star: (p) => (
    <svg
      {...p}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  Bookmark: (p) => (
    <svg
      {...p}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Filter: (p) => (
    <svg
      {...p}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  ),
  Maximize: (p) => (
    <svg
      {...p}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  ),
};
window.CIco = CIco;

/* ---------- Shared Connect Shell ---------- */
const ConnectShell = ({
  title,
  activeNav = 'feed',
  counts = {},
  children,
  hideTopSearch = false,
}) => {
  const nav = [
    { id: 'feed', label: 'Feed', Icon: CIco.Feed },
    { id: 'network', label: 'My Network', Icon: CIco.Network, badge: counts.network },
    { id: 'marketplace', label: 'Marketplace', Icon: CIco.Store },
    { id: 'jobs', label: 'Jobs', Icon: CIco.Briefcase, badge: counts.jobs },
    { id: 'companies', label: 'Companies', Icon: CIco.Building },
    { id: 'inbox', label: 'Inbox', Icon: CIco.Inbox, badge: counts.inbox },
    { id: 'notifications', label: 'Notifications', Icon: CIco.Bell, badge: counts.notifications },
  ];
  const profile = [
    { id: 'profile', label: 'My Profile', Icon: CIco.Users },
    { id: 'store', label: 'My Storefront', Icon: CIco.Store },
    { id: 'leads', label: 'Lead Manager', Icon: CIco.Receipt },
  ];

  return (
    <div className="cn">
      <aside className="cn-side">
        <div className="cn-brand">
          <div className="cn-brand-mark">Z</div>
          <div>
            <div className="cn-brand-text">Zari360</div>
            <div className="cn-brand-sub">Zari360 Connect</div>
          </div>
        </div>

        <div className="cn-toggle">
          <button>
            <CIco.Dashboard style={{ width: 14, height: 14 }} /> ERP
          </button>
          <button className="is-active">
            <CIco.Network style={{ width: 14, height: 14 }} /> Connect
          </button>
        </div>

        <nav className="cn-nav">
          {nav.map(({ id, label, Icon, badge }) => (
            <div key={id} className={`cn-nav-item ${activeNav === id ? 'is-active' : ''}`}>
              <Icon className="ico" />
              <span>{label}</span>
              {badge ? <span className="badge">{badge}</span> : null}
            </div>
          ))}
          <div className="cn-nav-group">Your presence</div>
          {profile.map(({ id, label, Icon }) => (
            <div key={id} className={`cn-nav-item ${activeNav === id ? 'is-active' : ''}`}>
              <Icon className="ico" />
              <span>{label}</span>
            </div>
          ))}
        </nav>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
        <div className="cn-top">
          <div className="cn-top-l">
            <CIco.Menu className="hamb" />
            <h1>{title}</h1>
          </div>
          <div className="cn-top-r">
            {!hideTopSearch && (
              <div className="cn-globalsearch">
                <CIco.Search />
                <span>Search people, products, jobs, posts…</span>
              </div>
            )}
            <div className="cn-lang">
              <CIco.Globe /> EN <CIco.Chevron />
            </div>
            <div className="cn-icon-btn">
              <CIco.Inbox />
              <span className="ct">3</span>
            </div>
            <div className="cn-icon-btn">
              <CIco.Bell />
              <span className="ct">9+</span>
            </div>
            <div className="cn-user">
              <div className="cn-avatar-circle">TU</div>
            </div>
          </div>
        </div>
        <div className="cn-main">{children}</div>
      </div>
    </div>
  );
};

window.ConnectShell = ConnectShell;

/* ---------- Helpers ---------- */
const Img = ({ label, style }) => (
  <div className="cn-img" style={style}>
    {label}
  </div>
);
const Banner = ({ label = 'cover image', style }) => (
  <div className="cn-img cn-img-banner" style={style}>
    {label}
  </div>
);
const Av = ({ name = 'AB', color = 'var(--indigo-700)', size = '' }) => (
  <div
    className={`cn-av ${size === 'sm' ? 'cn-av-sm' : ''} ${size === 'lg' ? 'cn-av-lg' : ''}`}
    style={{ background: color }}
  >
    {name}
  </div>
);
const Pill = ({ children, kind = '' }) => (
  <span className={`cn-tag ${kind ? 'cn-tag-' + kind : ''}`}>{children}</span>
);
const Verified = ({ kind }) => {
  const labels = {
    erp: 'ERP-linked',
    gst: 'GST verified',
    udyam: 'Udyam',
    mobile: 'Mobile verified',
  };
  return (
    <span className={`cn-vbadge ${kind}`}>
      <span className="dot"></span>
      {labels[kind]}
    </span>
  );
};
const Anno = ({ n, children }) => (
  <span className="cn-anno">
    <span className="nmark">{n}.</span> {children}
  </span>
);

window.Img = Img;
window.Banner = Banner;
window.Av = Av;
window.Pill = Pill;
window.Verified = Verified;
window.Anno = Anno;
