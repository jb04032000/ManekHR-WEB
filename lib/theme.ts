import type { ThemeConfig } from 'antd';

/**
 * Ant Design theme - ManekHR brand.
 *
 * NOTE: this file is a canonical token-definition exception. Hex literals
 * are required because antd's ConfigProvider does not resolve CSS vars at
 * runtime. Keep hex values in sync with `app/globals.css :root`.
 */
export const theme: ThemeConfig = {
  // Pin the CSS-variable key. AntD v6 turns CSS vars on by default and, when no
  // key is given, derives the `css-var-*` class from React's useId(). In the App
  // Router that counter can resolve differently on the server stream vs client
  // hydration, producing a className mismatch (css-var-_R_lb_ vs css-var-_R_1lb_)
  // and a hydration error on every hard load. A literal key makes the class
  // deterministic on both sides. Links to AntdProvider.tsx (ConfigProvider theme).
  cssVar: { key: 'cr' },
  token: {
    // ── Brand ───────────────────────
    colorPrimary: '#0B6E4F', // emerald-600 (brand primary)
    colorSuccess: '#047857', // success-700
    colorSuccessBg: '#ECFDF5', // success-50
    colorSuccessBorder: '#A7F3D0',
    colorWarning: '#B45309', // warning-700
    colorWarningBg: '#FFFBEB', // warning-50
    colorWarningBorder: '#FDE68A',
    colorError: '#B91C1C', // danger-700
    colorErrorBg: '#FEF2F2', // danger-50
    colorErrorBorder: '#FECACA',
    colorInfo: '#1D4ED8', // info-700
    colorInfoBg: '#EFF6FF', // info-50
    colorInfoBorder: '#BFDBFE',

    // ── Typography ──────────────────
    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontWeightStrong: 700,

    // ── Radius ──────────────────────
    borderRadius: 10,
    borderRadiusLG: 14,
    borderRadiusSM: 8,
    borderRadiusXS: 6,

    // ── Surfaces ────────────────────
    colorBgBase: '#FFFFFF', // neutral-0
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorBgLayout: '#FAF8F3', // cream
    colorBgSpotlight: '#F2EEE6', // neutral-100

    // ── Borders ─────────────────────
    colorBorder: '#E5DFD3', // neutral-200
    colorBorderSecondary: '#F2EEE6', // neutral-100
    lineWidth: 1,

    // ── Text ────────────────────────
    colorText: '#1A1A1A', // charcoal
    colorTextSecondary: '#2E2D2A', // neutral-700
    colorTextTertiary: '#4A4844', // neutral-600
    colorTextQuaternary: '#6B6862', // neutral-500
    colorTextPlaceholder: '#6B6862', // neutral-500 (4.6:1 on white - AA)

    // ── Shadow ──────────────────────
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    boxShadowSecondary: '0 4px 16px rgba(0,0,0,0.08)',

    // ── Motion ──────────────────────
    motionDurationFast: '0.15s',
    motionDurationMid: '0.2s',
    motionDurationSlow: '0.3s',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    motionEaseOut: 'cubic-bezier(0.0, 0, 0.2, 1)',

    // ── Control sizes ───────────────
    controlHeight: 38,
    controlHeightSM: 30,
    controlHeightLG: 46,
    controlPaddingHorizontal: 12,
    paddingContentVertical: 10,
  },

  components: {
    // ── Button ──────────────────────
    Button: {
      fontWeight: 600,
      paddingInline: 18,
      contentFontSize: 14,
      contentLineHeight: 1.5,
      defaultBorderColor: '#E5DFD3', // neutral-200
      defaultColor: '#4A4844', // neutral-600
    },

    // ── Input ───────────────────────
    Input: {
      paddingBlock: 9,
      paddingInline: 12,
      activeShadow: '0 0 0 3px rgba(11,110,79,0.18)',
      hoverBorderColor: '#0B6E4F',
    },

    // ── Select ──────────────────────
    Select: {
      optionSelectedBg: '#E7F2EE', // emerald-50
      optionSelectedColor: '#0B6E4F',
      optionSelectedFontWeight: 600,
    },

    // ── DatePicker ──────────────────
    DatePicker: {
      activeShadow: '0 0 0 3px rgba(11,110,79,0.18)',
      cellActiveWithRangeBg: '#E7F2EE',
    },

    // ── Table ───────────────────────
    Table: {
      headerBg: '#F2EEE6', // neutral-100 (cream-warm)
      headerColor: '#6B6862', // neutral-500
      rowHoverBg: '#F2EEE6',
      borderColor: '#F2EEE6',
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
      headerSplitColor: 'transparent',
    },

    // ── Card ────────────────────────
    Card: {
      headerFontSize: 15,
      headerFontSizeSM: 13,
      headerHeight: 52,
      headerHeightSM: 42,
      paddingLG: 20,
      padding: 20,
    },

    // ── Menu ────────────────────────
    Menu: {
      itemBorderRadius: 10,
      itemPaddingInline: 12,
      itemMarginInline: 4,
      subMenuItemBg: 'transparent',
      itemActiveBg: '#E7F2EE',
      itemSelectedBg: '#E7F2EE',
      itemSelectedColor: '#0B6E4F',
      itemHoverColor: '#0B6E4F',
      itemHoverBg: '#E7F2EE',
      iconSize: 17,
    },

    // ── Layout ──────────────────────
    Layout: {
      siderBg: '#FAF8F3', // cream - matches --cr-sidebar-bg
      headerBg: '#FAF8F3', // cream - unified with sidebar + page
      bodyBg: '#FAF8F3', // cream page
      headerHeight: 64,
    },

    // ── Modal ───────────────────────
    Modal: {
      borderRadiusLG: 20,
      titleFontSize: 16,
      titleLineHeight: 1.4,
      headerBg: '#FFFFFF',
      contentBg: '#FFFFFF',
      footerBg: '#FFFFFF',
      padding: 24,
    },

    // ── Drawer ──────────────────────
    Drawer: {
      borderRadiusLG: 20,
      footerPaddingBlock: 12,
      footerPaddingInline: 20,
    },

    // ── Form ────────────────────────
    Form: {
      labelFontSize: 13,
      labelColor: '#4A4844', // neutral-600
      labelColonMarginInlineEnd: 0,
      verticalLabelPadding: '0 0 6px',
      itemMarginBottom: 16,
    },

    // ── Tabs ────────────────────────
    Tabs: {
      inkBarColor: '#0B6E4F',
      itemActiveColor: '#0B6E4F',
      itemSelectedColor: '#0B6E4F',
      itemHoverColor: '#0B6E4F',
      titleFontSize: 13,
      titleFontSizeLG: 15,
    },

    // ── Tag ─────────────────────────
    Tag: {
      borderRadius: 99,
      fontSizeSM: 11,
      defaultBg: '#F2EEE6', // neutral-100
      defaultColor: '#4A4844', // neutral-600
    },

    // ── Tooltip ─────────────────────
    Tooltip: {
      borderRadius: 8,
      fontSize: 12,
      colorBgSpotlight: '#1A1A1A', // charcoal (dark tooltip on cream)
    },

    // ── Badge ───────────────────────
    Badge: {
      fontFamily: "'DM Sans', sans-serif",
    },

    // ── Alert ───────────────────────
    Alert: {
      borderRadius: 10,
      defaultPadding: '10px 14px',
    },

    // ── Statistic ───────────────────
    Statistic: {
      titleFontSize: 12,
      contentFontSize: 26,
      fontFamily: "'Syne', sans-serif",
    },

    // ── Segmented ───────────────────
    Segmented: {
      itemSelectedBg: '#0B6E4F',
      itemSelectedColor: '#FFFFFF',
      borderRadius: 10,
      trackPadding: 3,
    },

    // ── InputNumber ─────────────────
    InputNumber: {
      activeShadow: '0 0 0 3px rgba(11,110,79,0.18)',
    },

    // ── Progress ────────────────────
    Progress: {
      defaultColor: '#0B6E4F',
      remainingColor: '#F2EEE6',
    },

    // ── Switch ──────────────────────
    Switch: {
      colorPrimary: '#0B6E4F',
      colorPrimaryHover: '#095C42',
    },

    // ── Steps ──────────────────────
    // Drives progress color on the Add-Member wizard step indicator
    // (Personal → Employment → Bank → Documents → Review). Completed +
    // active state both use brand emerald; remaining stays neutral.
    Steps: {
      colorPrimary: '#0B6E4F',
    },
  },
};
