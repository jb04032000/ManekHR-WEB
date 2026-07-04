/**
 * Guide / knowledge content for the marketing `/guides` section.
 *
 * These are long-form, genuinely useful articles (not keyword landing pages) that
 * target informational + AI-answer-engine (AEO/GEO) queries diamond-polishing
 * unit owners and their accountants search. Content is ENGLISH-only on purpose:
 * these are definitional/how-to queries searched in English, and English is
 * where the AEO value is. The page CHROME (navbar/footer) still localizes;
 * only the article body is English data.
 *
 * Each guide renders via app/(marketing)/guides/[slug]/page.tsx with Article +
 * FAQPage + Breadcrumb JSON-LD. Keep facts honest and non-promotional.
 */

export interface GuideSection {
  heading: string;
  /** Paragraphs. Rendered as plain <p> blocks. */
  body: string[];
}

export interface GuideFaq {
  q: string;
  a: string;
}

export interface Guide {
  slug: string;
  badge: string;
  title: string;
  metaTitle: string;
  description: string;
  /** ISO date used for Article dateModified. */
  updated: string;
  intro: string;
  sections: GuideSection[];
  faq: GuideFaq[];
  /** A relevant in-app/landing link shown as the article CTA. */
  cta: { label: string; href: string };
}

export const GUIDES: Guide[] = [
  {
    slug: 'karigar-piece-rate-vs-fixed-salary',
    badge: 'Salary structure',
    title: 'How to structure karigar piece-rate vs fixed salary',
    metaTitle: 'Karigar piece-rate vs fixed salary — how to choose | ManekHR',
    description:
      'A plain guide to paying karigars: when piece-rate (per-piece) pay works better than a fixed monthly salary, how to blend both, and what to track so payroll stays accurate.',
    updated: '2026-07-04',
    intro:
      'Most diamond-polishing units pay karigars in one of two ways — a fixed monthly salary, or a piece-rate tied to pieces polished. Many units actually need a mix. Here is how to think through the choice and set it up so payroll stays simple and fair.',
    sections: [
      {
        heading: 'Fixed salary: when it fits',
        body: [
          'A fixed monthly salary suits roles where output is hard to measure per piece — supervisors, quality checkers, and maintenance staff. It also gives new karigars a stable income while they are still learning, which helps retention in the early months.',
          'Fixed salary is simplest to run: no per-piece counting, no daily reconciliation. The tradeoff is that it does not reward faster or more skilled karigars any differently from slower ones.',
        ],
      },
      {
        heading: 'Piece-rate: when it fits',
        body: [
          'Piece-rate pay ties earnings directly to pieces polished, so it rewards speed and skill and scales naturally with order volume. It suits experienced karigars doing repeatable cutting/polishing work where quality can be checked at handover.',
          'The tradeoff is more admin: every piece needs to be logged against the karigar who worked it, and quality checks matter more since output is the direct driver of pay.',
        ],
      },
      {
        heading: 'Blending both',
        body: [
          'Many units pay a smaller fixed base (covering attendance and stability) plus a piece-rate top-up above a daily/monthly threshold. This keeps income predictable while still rewarding higher output — a common middle ground once a unit has steady order flow.',
        ],
      },
      {
        heading: 'What to track either way',
        body: [
          'Whichever structure you choose, keep clean records per karigar: attendance days, pieces completed (if piece-rate), any advances or deductions, and the final computed salary for the month. Clean records are what make payroll fast and disputes rare — and they are exactly what a staff+salary system should keep for you automatically.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is piece-rate or fixed salary better for diamond polishing?',
        a: 'Neither is universally better — fixed salary suits supervisory or hard-to-measure roles and gives new karigars stability, while piece-rate rewards experienced karigars for speed and output. Many units blend a small fixed base with a piece-rate top-up.',
      },
      {
        q: 'How do I track piece-rate pay accurately?',
        a: 'Log completed pieces against each karigar as work is handed over, and pair it with a quality check at the same point. Keeping this record daily (rather than reconstructing it at month-end) is what keeps piece-rate payroll accurate and disputes low.',
      },
      {
        q: 'Can I change a karigar from fixed salary to piece-rate later?',
        a: 'Yes — many units start new karigars on a fixed salary during training, then move them to piece-rate (or a blended structure) once they are consistently meeting quality and speed benchmarks.',
      },
    ],
    cta: { label: 'See how ManekHR handles salary structures', href: '/erp#team' },
  },
  {
    slug: 'attendance-rules-for-your-unit',
    badge: 'Attendance',
    title: "Setting up attendance rules for your unit",
    metaTitle: 'Setting up attendance rules for your diamond-polishing unit | ManekHR',
    description:
      'A practical guide to defining shift timings, late-marking rules, half-day and leave policies, and holiday calendars for a diamond-polishing unit — so attendance and salary always agree.',
    updated: '2026-07-04',
    intro:
      'Attendance is the foundation salary is built on — if attendance rules are unclear or inconsistent, salary disputes follow. Here is how to set up rules that are simple for karigars to understand and simple for you to run every month.',
    sections: [
      {
        heading: 'Define your shift timings first',
        body: [
          'Start with clear shift start and end times, and a defined grace period (e.g. 10-15 minutes) before a late mark applies. Write this down and share it with every karigar — verbal-only rules are the most common source of "but I was only a few minutes late" disputes.',
        ],
      },
      {
        heading: 'Half-day and late-mark policy',
        body: [
          'Decide, in advance, how late marks convert into deductions — for example, three late marks equal one half-day, or a direct per-minute deduction past the grace period. Whatever the rule, apply it consistently across every karigar so it never looks like favoritism.',
        ],
      },
      {
        heading: 'Leave and holiday calendar',
        body: [
          'Set the number of paid leaves per month or year, and publish your holiday calendar (festivals, weekly off) at the start of the year so there is no ambiguity when a karigar takes a day off around a festival.',
        ],
      },
      {
        heading: 'Keep attendance and salary in sync',
        body: [
          'The real value of clean attendance rules shows up at payroll time: if attendance records (present/absent/half-day/leave) feed directly into the salary calculation, you avoid the manual reconciliation that causes month-end delays and errors. This is exactly why attendance and salary should live in one system rather than two separate registers.',
        ],
      },
    ],
    faq: [
      {
        q: 'What attendance rules should a diamond-polishing unit set?',
        a: 'At minimum: shift timings with a grace period, a clear late-mark-to-deduction rule, a leave allowance, and a published holiday calendar. Writing these down and applying them consistently prevents most salary disputes.',
      },
      {
        q: 'How many late marks should equal a half-day deduction?',
        a: 'There is no universal number — many units use three late marks per half-day, but the right number depends on your shift length and how strict your grace period is. What matters most is applying whatever rule you pick consistently.',
      },
      {
        q: 'Should attendance and salary be tracked in the same system?',
        a: 'Yes — tracking them together removes the manual reconciliation between a separate attendance register and a separate salary sheet, which is where most month-end errors and delays come from.',
      },
    ],
    cta: { label: 'See ManekHR attendance tracking', href: '/erp' },
  },
  {
    slug: 'role-based-permissions-for-your-team',
    badge: 'Roles & permissions',
    title: 'Understanding role-based permissions for your team',
    metaTitle: 'Role-based permissions for your diamond-polishing unit team | ManekHR',
    description:
      'What role-based permissions mean in practice for a diamond-polishing unit: who should see salary data, who can mark attendance, and how to set this up without slowing your team down.',
    updated: '2026-07-04',
    intro:
      'As a unit grows past a handful of people, "everyone can see and edit everything" stops being safe or practical. Role-based permissions let you decide, per person, what they can see and do — without needing to babysit every action yourself.',
    sections: [
      {
        heading: 'Why permissions matter for a small unit too',
        body: [
          'Even a small unit has information that should not be open to everyone — salary figures, personal staff details, and financial records chief among them. Role-based permissions protect this without requiring you to personally approve every action.',
        ],
      },
      {
        heading: 'Common roles in a diamond-polishing unit',
        body: [
          'Owner/manager: full access to staff, attendance, and salary. Supervisor: can mark attendance and view staff for their team, but cannot see salary figures. Accountant/HR staff: can process salary and view staff records, but does not need to alter attendance rules. Karigar/staff (if given app access): can see only their own attendance and payslip.',
        ],
      },
      {
        heading: 'Matching access to responsibility',
        body: [
          'The goal is not to lock everything down — it is to match what someone can see and change to what their job actually requires. A supervisor who marks attendance daily needs fast, easy access to that one function, not a login that also exposes payroll.',
        ],
      },
      {
        heading: 'Setting it up without slowing your team down',
        body: [
          'Start simple: define two or three roles that map to your real team (owner, supervisor, accountant), assign people to them, and only add more granular roles later if you find a genuine gap. Overengineering permissions on day one usually just creates confusion.',
        ],
      },
    ],
    faq: [
      {
        q: 'Do small diamond-polishing units need role-based permissions?',
        a: 'Yes — even a small team usually has salary and personal staff data that should not be visible to everyone. Role-based permissions protect that data without requiring the owner to approve every action personally.',
      },
      {
        q: 'What roles are typical in a diamond-polishing unit?',
        a: 'Common roles are owner/manager (full access), supervisor (attendance for their team), accountant/HR staff (salary processing and staff records), and karigars if given app access (their own attendance and payslip only).',
      },
      {
        q: 'How detailed should permission roles be?',
        a: 'Start with two or three simple roles that map to your actual team structure, then add more specific roles only if you hit a real gap. Setting up too many granular permissions upfront usually adds confusion rather than security.',
      },
    ],
    cta: { label: 'See ManekHR roles & permissions', href: '/erp#roles' },
  },
  {
    slug: 'monthly-payroll-checklist',
    badge: 'Payroll',
    title: 'Monthly payroll checklist for diamond unit owners',
    metaTitle: 'Monthly payroll checklist for diamond-polishing unit owners | ManekHR',
    description:
      'A step-by-step monthly payroll checklist for diamond-polishing unit owners — attendance review, piece-rate/fixed salary calculation, advances and deductions, and payslip generation.',
    updated: '2026-07-04',
    intro:
      'Running payroll for karigars and staff every month has a predictable set of steps — the units that avoid errors and delays are the ones that follow the same checklist every time. Here is that checklist.',
    sections: [
      {
        heading: '1. Close and review attendance',
        body: [
          'Lock the attendance record for the month first — present days, absences, half-days, and approved leave. Review any pending late-mark or leave disputes before you calculate salary, not after; it is much harder to correct a payslip once it is issued.',
        ],
      },
      {
        heading: '2. Calculate earnings',
        body: [
          'For fixed-salary staff, apply the attendance-based deductions to the base salary. For piece-rate karigars, total the pieces completed for the month against the agreed rate. For any blended structure, apply both components.',
        ],
      },
      {
        heading: '3. Apply advances and deductions',
        body: [
          'Subtract any advances given during the month, along with any other agreed deductions (e.g. damage, uniform, loan repayment installments). Keep a running ledger per karigar so advances never get missed or double-counted.',
        ],
      },
      {
        heading: '4. Review before finalizing',
        body: [
          'Before you finalize, do a quick sanity check per person: does the computed salary make sense against their attendance and role? A second pass catches most errors before they reach a payslip.',
        ],
      },
      {
        heading: '5. Generate payslips and pay',
        body: [
          'Issue a clear payslip per karigar/staff member — showing attendance days, earnings, deductions, and the final amount — and process payment. A written payslip, even a simple one, cuts down on "how was this calculated" questions the following month.',
        ],
      },
    ],
    faq: [
      {
        q: 'What is the right order to run monthly payroll?',
        a: 'Close and review attendance first, calculate earnings (fixed and/or piece-rate), apply advances and deductions, do a final sanity review, then generate payslips and pay. Doing attendance review last is the most common source of post-payslip corrections.',
      },
      {
        q: 'How do I track advances given to karigars?',
        a: 'Keep a running ledger per karigar for any advance given during the month, and subtract it during the deductions step of payroll. Without a running ledger, advances are easy to miss or double-count.',
      },
      {
        q: 'Why should I issue a written payslip?',
        a: 'A payslip that shows attendance days, earnings, deductions, and the final amount reduces disputes and repeated questions, since the karigar or staff member can see exactly how their pay was calculated.',
      },
    ],
    cta: { label: 'See ManekHR payroll', href: '/erp#team' },
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
