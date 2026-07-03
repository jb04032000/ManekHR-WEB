// Per-module contextual guides shown from the breadcrumb "User Guide" button
// (components/ui/UserGuideButton.tsx). Each guide is a short, plain-language
// orientation for the module plus the cross-module relationships a user should
// know. Keyed by the module string from getModuleFromPath() so the breadcrumb
// only surfaces the guide for modules that actually have content authored.
//
// Keep copy plain and owner-friendly (textile SMB audience). Author new modules
// here; UserGuideButton falls back to a "coming soon" note when a key is absent.

export interface ModuleGuideSection {
  heading: string;
  body: string;
}

export interface ModuleGuideRelated {
  /** Display label for the related module. */
  label: string;
  /** Top-level route for the related module (must be stable / not id-scoped). */
  href: string;
  /** One line on how it relates to this module. */
  why: string;
}

export interface ModuleGuide {
  /** Drawer title. */
  title: string;
  /** One-paragraph orientation shown at the top. */
  intro: string;
  sections: ModuleGuideSection[];
  /** Cross-module relationships - rendered as links with a "why". */
  related: ModuleGuideRelated[];
}

export const MODULE_GUIDES: Record<string, ModuleGuide> = {
  finance: {
    title: 'Billing & Accounts',
    intro:
      'Your complete bookkeeping and GST workspace - raise invoices, record payments, track customers and vendors, and see exactly where the money stands. manekhr keeps your books; it never moves money itself.',
    sections: [
      {
        heading: 'Start here',
        body: 'Open Business Profile and add your name, GSTIN, and address so every invoice is legally correct and looks professional. The setup checklist on the dashboard shows what is still pending.',
      },
      {
        heading: 'Day to day',
        body: 'Create tax invoices, quotations, sale orders, proforma, and delivery challans under Sales. Record what customers pay you and what you pay vendors under Payments. Each document posts to your books automatically.',
      },
      {
        heading: 'Stay compliant',
        body: 'GSTR-1, GSTR-3B, e-invoice, and e-way bill are built from your invoices - no double entry. Reports give you the trial balance, profit & loss, balance sheet, and party statements whenever you need them.',
      },
      {
        heading: 'Recording only',
        body: 'Payment modes (cash, bank, UPI, cheque) are labels for your records. manekhr documents the money you receive or pay - it does not collect or send any money on your behalf.',
      },
    ],
    related: [
      {
        label: 'Team',
        href: '/dashboard/team',
        why: 'Who can view or edit billing is decided by the roles & permissions you set for your team.',
      },
      {
        label: 'Parties',
        href: '/dashboard/parties',
        why: 'Your customers and vendors live here. Every invoice and payment is linked to a party.',
      },
      {
        label: 'Payroll',
        href: '/dashboard/salary',
        why: 'Employee salaries are handled separately under Payroll, not in Billing & Accounts.',
      },
    ],
  },
};

export function hasModuleGuide(module: string): boolean {
  return Object.prototype.hasOwnProperty.call(MODULE_GUIDES, module);
}
