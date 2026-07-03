export type FeatureAccessLevel = 'locked' | 'limited' | 'full';

export interface SubFeatureDefinition {
  key: string;
  label: string;
  description?: string;
  supportsLimited: boolean;
}

export interface ModuleFeatureDefinition {
  module: string;
  label: string;
  description?: string;
  subFeatures: SubFeatureDefinition[];
}

export const FEATURE_ACCESS_REGISTRY: ModuleFeatureDefinition[] = [
  {
    module: 'attendance',
    label: 'Attendance',
    description: 'Track employee attendance and working hours',
    subFeatures: [
      {
        key: 'mark',
        label: 'Mark Attendance',
        description: 'Mark attendance for employees',
        supportsLimited: false,
      },
      {
        key: 'edit',
        label: 'Edit Attendance',
        description: 'Edit attendance records',
        supportsLimited: false,
      },
      {
        key: 'bulk_mark',
        label: 'Bulk Mark',
        description: 'Bulk mark attendance for multiple employees',
        supportsLimited: false,
      },
      {
        key: 'export_pdf',
        label: 'Export PDF',
        description: 'Export attendance data as PDF',
        supportsLimited: true,
      },
      {
        key: 'export_excel',
        label: 'Export Excel',
        description: 'Export attendance data as Excel',
        supportsLimited: true,
      },
      {
        key: 'auto_present',
        label: 'Auto-Present',
        description: 'Automatically mark attendance when shifts start',
        supportsLimited: false,
      },
      {
        key: 'advanced_filters',
        label: 'Advanced Filters',
        description: 'Filter attendance by shift and role',
        supportsLimited: false,
      },
      {
        key: 'per_employee_report',
        label: 'Per-Employee Report',
        description: 'Export individual employee attendance report',
        supportsLimited: false,
      },
      {
        key: 'date_range_export',
        label: 'Date Range Export',
        description: 'Export attendance across multiple months or a custom date range',
        supportsLimited: false,
      },
      {
        // BE/web parity fix (2026-07-02): this key existed in the BE registry
        // (api/.../module-features.registry.ts ATTENDANCE block) but was missing here,
        // so the admin editor rendered no toggle and it could not be granted. Mirrors
        // the BE entry exactly (label/description/supportsLimited). Keep in sync.
        key: 'statutory_exports',
        label: 'Statutory Exports',
        description:
          'Generate India statutory compliance documents (MH Form T muster roll, OT register, PF/ESI wage register, LOP audit trail)',
        supportsLimited: false,
      },
      {
        key: 'analytics_charts',
        label: 'Analytics Charts',
        description: 'In-tile sparkline / trend / spike charts on attendance overview KPI cards',
        supportsLimited: false,
      },
      {
        key: 'attendance_muster',
        label: 'Attendance Muster',
        description: 'Month-at-a-glance member × day muster grid',
        supportsLimited: false,
      },
      {
        key: 'overtime_analytics',
        label: 'Overtime Analytics',
        description: 'Overtime worked by member, shift, and day, with cost estimation',
        supportsLimited: false,
      },
      {
        key: 'compliance_report',
        label: 'Compliance & Leaderboards',
        description: 'Attendance defaulters and late / absent leaderboards',
        supportsLimited: false,
      },
      {
        key: 'absence_patterns',
        label: 'Absence Patterns',
        description: 'Bradford-style absence scoring and weekday-cluster detection',
        supportsLimited: false,
      },
      {
        key: 'defaulter_alerts',
        label: 'Defaulter Alerts',
        description:
          'Automated notifications when attendance compliance drops - in-app and email alerts to managers or specific recipients',
        supportsLimited: false,
      },
      {
        key: 'anomaly_detection',
        label: 'Anomaly Detection',
        description:
          'Flag suspicious attendance events - unknown devices, rapid duplicates, missed streaks, off-shift punches, time-travel',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'team',
    label: 'Team',
    description: 'Manage team members and roles',
    subFeatures: [
      {
        key: 'add_member',
        label: 'Add Member',
        description: 'Add new team member',
        supportsLimited: false,
      },
      {
        key: 'edit_member',
        label: 'Edit Member',
        description: 'Edit team member details',
        supportsLimited: false,
      },
      {
        key: 'remove_member',
        label: 'Remove Member',
        description: 'Archive (soft-delete) a team member',
        supportsLimited: false,
      },
      {
        key: 'bulk_import',
        label: 'Bulk Import',
        description: 'Import multiple members at once',
        supportsLimited: false,
      },
      {
        key: 'grant_app_access',
        label: 'Grant App Access',
        description: 'Grant mobile app login access to a member',
        supportsLimited: false,
      },
      {
        key: 'bulk_deactivate',
        label: 'Bulk Deactivate',
        description: 'Bulk deactivate members',
        supportsLimited: false,
      },
      {
        key: 'bulk_restore',
        label: 'Bulk Restore',
        description: 'Bulk restore archived members',
        supportsLimited: false,
      },
      {
        key: 'bulk_archive',
        label: 'Bulk Archive',
        description: 'Bulk archive members',
        supportsLimited: false,
      },
      {
        key: 'restore_member',
        label: 'Restore Member',
        description: 'Restore archived member',
        supportsLimited: false,
      },
      {
        key: 'offboard_member',
        label: 'Offboard Member',
        description: 'Offboard a team member',
        supportsLimited: false,
      },
      {
        key: 'export_team',
        label: 'Export Team',
        description: 'Export team data',
        supportsLimited: true,
      },
      {
        key: 'designation_filter',
        label: 'Designation Filter',
        description: 'Filter team members by designation using filter chips',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'salary',
    label: 'Salary',
    description: 'Manage payroll and salary payments',
    subFeatures: [
      {
        key: 'generate_payroll',
        label: 'Generate Payroll',
        description: 'Generate monthly payroll',
        supportsLimited: false,
      },
      {
        key: 'record_payment',
        label: 'Record Payment',
        description: 'Record salary payment',
        supportsLimited: false,
      },
      {
        key: 'edit_salary',
        label: 'Edit Salary',
        description: 'Edit salary records',
        supportsLimited: false,
      },
      {
        key: 'salary_adjustments_view',
        label: 'View Adjustments',
        description: 'View the salary adjustment register',
        supportsLimited: false,
      },
      {
        key: 'salary_adjustments_create',
        label: 'Create Adjustments',
        description: 'Create salary adjustment entries',
        supportsLimited: false,
      },
      {
        key: 'salary_adjustments_reverse',
        label: 'Reverse Adjustments',
        description: 'Reverse posted salary adjustment entries',
        supportsLimited: false,
      },
      {
        key: 'salary_adjustments_edit_note',
        label: 'Edit Adjustment Notes',
        description: 'Edit salary adjustment metadata later with audit logging',
        supportsLimited: false,
      },
      {
        key: 'salary_adjustments_view_audit',
        label: 'View Adjustment Audit',
        description: 'View audit logs for salary adjustments',
        supportsLimited: false,
      },
      {
        key: 'export_pdf',
        label: 'Export PDF',
        description: 'Export salary slip as PDF',
        supportsLimited: true,
      },
      {
        key: 'export_excel',
        label: 'Export Excel',
        description: 'Export salary data as Excel',
        supportsLimited: true,
      },
      {
        key: 'advance_payments',
        label: 'Advance Payments',
        description: 'Handle advance payment requests',
        supportsLimited: false,
      },
      {
        key: 'split_payments',
        label: 'Split Payments',
        description: 'Split payments across multiple methods',
        supportsLimited: false,
      },
      {
        key: 'bulk_payments',
        label: 'Bulk Payments',
        description: 'Record payments for multiple employees at once',
        supportsLimited: false,
      },
      {
        key: 'commission_tracking',
        label: 'Commission Tracking',
        description: 'Track commission amounts with salary payments',
        supportsLimited: false,
      },
      {
        key: 'salary_components',
        label: 'Salary Components / CTC',
        description: 'Define CTC breakdown with salary component templates',
        supportsLimited: false,
      },
      {
        key: 'payslip_generation',
        label: 'Payslip Generation',
        description: 'Generate and download salary payslips as PDF',
        supportsLimited: true,
      },
      {
        key: 'statutory_compliance',
        label: 'Statutory Compliance Settings',
        description: 'Manage PF, ESI, PT, and TDS statutory payroll settings',
        supportsLimited: false,
      },
      {
        key: 'statutory_tds',
        label: 'Tax Declarations / TDS',
        description: 'Manage tax declarations and monthly TDS projections',
        supportsLimited: false,
      },
      {
        key: 'compliance_exports',
        label: 'Compliance Exports',
        description: 'Export PF ECR, ESI challan, and bank disbursement files',
        supportsLimited: false,
      },
      {
        key: 'form16_generation',
        label: 'Form 16 Generation',
        description: 'Generate salary TDS certificates for a financial year',
        supportsLimited: false,
      },
      {
        key: 'payslip_email',
        label: 'Payslip Email Delivery',
        description: 'Send generated payslips to employees by email',
        supportsLimited: true,
      },
      {
        key: 'gratuity_tracking',
        label: 'Gratuity Tracking',
        description: 'View gratuity liability tracking and long-service summaries',
        supportsLimited: false,
      },
      {
        key: 'lwf_tracking',
        label: 'Labour Welfare Fund',
        description: 'Configure Labour Welfare Fund deductions and state-wise reference rates',
        supportsLimited: false,
      },
      {
        key: 'tds_management',
        label: 'TDS Challan Management',
        description: 'Record TDS challans, monthly deposit liability, and quarterly summaries',
        supportsLimited: false,
      },
      {
        key: 'fnf_settlement',
        label: 'Full & Final Settlement',
        description: 'Initiate, review, and finalise employee full and final settlements',
        supportsLimited: false,
      },
      {
        key: 'salary_increments',
        label: 'Salary Increments',
        description: 'Manage scheduled salary increments and revisions',
        supportsLimited: false,
      },
      {
        key: 'reverse_payment',
        label: 'Reverse Payment',
        description: 'Reverse recorded salary payments',
        supportsLimited: false,
      },
      // 2026-07-02 gating-gap batch: enforced by BE @RequireSubscription on the salary
      // + loan-request controllers but missing here, so the admin editor rendered no
      // toggle -> permanent LOCKED / 403. BE tier defaults: LOCKED on free, FULL on
      // paid tiers (sibling paid-salary cluster). Keep in sync with the BE registry
      // (api/.../module-features.registry.ts) SALARY block.
      {
        key: 'loan_management',
        label: 'Loan Management',
        description: 'Employer loans and 0% employee installment loan requests',
        supportsLimited: false,
      },
      {
        key: 'bonus_tracking',
        label: 'Bonus Tracking',
        description: 'Record and track employee bonus entries alongside payroll',
        supportsLimited: false,
      },
      {
        key: 'daily_wage_ledger',
        label: 'Daily Wage Ledger',
        description: 'Maintain a daily-wage earnings ledger for casual / daily workers',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'shifts',
    label: 'Shifts',
    description: 'Manage work shifts and scheduling',
    subFeatures: [
      {
        key: 'create_shift',
        label: 'Create Shift',
        description: 'Create new shift',
        supportsLimited: false,
      },
      {
        key: 'edit_shift',
        label: 'Edit Shift',
        description: 'Edit shift details',
        supportsLimited: false,
      },
      {
        key: 'delete_shift',
        label: 'Delete Shift',
        description: 'Delete shift',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'holidays',
    label: 'Holidays',
    description: 'Manage workspace holidays and observances',
    subFeatures: [
      {
        key: 'create_holiday',
        label: 'Create Holiday',
        description: 'Create new holiday',
        supportsLimited: false,
      },
      {
        key: 'edit_holiday',
        label: 'Edit Holiday',
        description: 'Edit holiday details',
        supportsLimited: false,
      },
      {
        key: 'delete_holiday',
        label: 'Delete Holiday',
        description: 'Delete holiday',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'roles',
    label: 'Roles',
    description: 'Manage custom roles and permissions',
    subFeatures: [
      {
        key: 'create_role',
        label: 'Create Role',
        description: 'Create custom role',
        supportsLimited: false,
      },
      {
        key: 'edit_role',
        label: 'Edit Role',
        description: 'Edit role permissions',
        supportsLimited: false,
      },
      {
        key: 'delete_role',
        label: 'Delete Role',
        description: 'Delete role',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'settings',
    label: 'Settings',
    description: 'Configure workspace settings',
    subFeatures: [
      {
        key: 'edit_settings',
        label: 'Edit Settings',
        description: 'Edit workspace settings',
        supportsLimited: false,
      },
      {
        key: 'workspace_branding',
        label: 'Workspace Branding',
        description: 'Upload custom logos and footer details for PDF exports',
        supportsLimited: false,
      },
      {
        key: 'pdf_branding',
        label: 'PDF Branding',
        description: 'Use custom branding in exported PDFs across all modules',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'machines',
    label: 'Machines',
    description: 'Manage operational machines and worker assignments',
    subFeatures: [
      {
        key: 'machines_basic',
        label: 'Machine CRUD',
        description: 'Create, edit, and retire machines',
        supportsLimited: false,
      },
      {
        key: 'machines_assignments',
        label: 'Machine Assignments',
        description: 'Assign workers to machines for specific shifts',
        supportsLimited: false,
      },
      {
        // Gates production log CRUD + bulk-entry (Phase 21). Consumed by the
        // sidebar "Bulk Production Entry" crown and the bulk page gate
        // (app/(app)/dashboard/machines/production-logs/bulk). Was missing here,
        // so no admin toggle existed and it always resolved LOCKED. Keep in sync
        // with the BE registry (api/.../module-features.registry.ts) MACHINES block.
        key: 'machines_production',
        label: 'Bulk Production Entry',
        description: 'Record production log CRUD and bulk shift-output entry',
        supportsLimited: false,
      },
      {
        // Gates preventive-maintenance schedule + service-log + maintenance/due
        // (Phase 24). Consumed by the maintenance controller's class-level
        // @RequireSubscription({ module: MACHINES, subFeature: 'machines_maintenance' })
        // and the /dashboard/maintenance/due + MaintenanceDueWidget surfaces. Was
        // missing here so no admin toggle existed and the BE 403'd on
        // GET workspaces/:id/maintenance/due. Keep in sync with the BE registry
        // (api/.../module-features.registry.ts) MACHINES block.
        key: 'machines_maintenance',
        label: 'Machine Maintenance',
        description: 'Schedule preventive maintenance, log work orders, and track due dates',
        supportsLimited: false,
      },
      {
        // Gates downtime entry CRUD + reason catalogue (Phase 22). Consumed by the
        // downtime + downtime-reasons controllers'
        // @RequireSubscription({ module: MACHINES, subFeature: 'machines_downtime' }).
        // Same registry gap as maintenance. Keep in sync with the BE registry
        // (api/.../module-features.registry.ts) MACHINES block.
        key: 'machines_downtime',
        label: 'Downtime Tracking',
        description: 'Record machine downtime with categorised reasons and duration',
        supportsLimited: false,
      },
      {
        key: 'production_utilisation_dashboard',
        label: 'Production Utilisation Dashboard',
        description:
          'Read-only KPI/trend/heatmap dashboard over production output, downtime, and uptime',
        supportsLimited: false,
      },
      {
        // Gates the piece-rate config tab (app/(app)/dashboard/team/[memberId]/page.tsx
        // useFeatureAccess('machines','piece_rate_payroll')) + BE piece-rate routes
        // (salary/team controllers @RequireSubscription module: MACHINES). Was missing
        // here so no admin toggle existed and it always resolved LOCKED. Keep in sync
        // with the BE registry (api/.../module-features.registry.ts) MACHINES block.
        key: 'piece_rate_payroll',
        label: 'Piece-Rate Payroll',
        description: 'Configure and preview piece-rate earnings for workers by machine output',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'locations',
    label: 'Locations',
    description: 'Manage operational sites where machines physically run',
    subFeatures: [
      {
        key: 'location_manage',
        label: 'Manage Locations',
        description: 'Create, edit, and remove operational locations',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'resource_scopes',
    label: 'Resource Scopes',
    description:
      'Row-level access scoping - limit users to specific machines and locations regardless of RBAC role',
    subFeatures: [
      {
        key: 'resource_scope_manage',
        label: 'Manage Resource Scopes',
        description: 'Create and edit per-user machine/location scope assignments',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'reminders',
    label: 'Reminders',
    description:
      'Automated payment and service reminders via in-app, email, SMS, push, and WhatsApp channels',
    subFeatures: [
      // Wave 6 - channel-decomposed canonical taxonomy. Mirrors backend
      // src/common/constants/module-features.registry.ts AppModule.REMINDERS.
      // SMS + WhatsApp are credit-pack billed (not tier-bundled).
      {
        key: 'reminder_rules_view',
        label: 'View Rules',
        description: 'See active reminder rules + audit trail',
        supportsLimited: false,
      },
      {
        key: 'reminder_rules_manage',
        label: 'Manage Rules',
        description: 'Define payment-reminder rules with escalation levels',
        supportsLimited: false,
      },
      {
        key: 'reminder_settings_manage',
        label: 'Reminder Settings',
        description: 'Configure firm-level frequency caps, opt-outs, channel defaults',
        supportsLimited: false,
      },
      {
        key: 'reminder_templates_customize',
        label: 'Custom Templates',
        description: 'Workspace / firm-specific email + SMS templates with variable substitution',
        supportsLimited: false,
      },
      {
        key: 'reminder_channel_in_app',
        label: 'In-App Channel',
        description: 'In-app dashboard reminder feed',
        supportsLimited: false,
      },
      {
        key: 'reminder_channel_email',
        label: 'Email Channel',
        description: 'Send reminder emails via workspace SMTP or relay',
        supportsLimited: false,
      },
      {
        key: 'reminder_channel_sms',
        label: 'SMS Channel',
        description: 'TRAI-compliant DLT SMS via MSG91 - credit-pack billed',
        supportsLimited: false,
      },
      {
        key: 'reminder_channel_whatsapp',
        label: 'WhatsApp Channel',
        description: 'WhatsApp via AiSensy BSP - credit-pack billed',
        supportsLimited: false,
      },
      {
        key: 'reminder_channel_push',
        label: 'Push Channel',
        description: 'Mobile push notifications via Firebase',
        supportsLimited: false,
      },
      {
        key: 'reminder_call_todo_view',
        label: 'View Call Todos',
        description: 'View call-back todo list per customer',
        supportsLimited: false,
      },
      {
        key: 'reminder_call_todo_manage',
        label: 'Manage Call Todos',
        description: 'Manual call-back todos with priority, snooze, completion tracking',
        supportsLimited: false,
      },
      {
        key: 'reminder_auto_escalation',
        label: 'Auto Escalation',
        description: 'Level-3 rules auto-create CallTodo for 21+ day overdue invoices',
        supportsLimited: false,
      },
      {
        key: 'reminder_audit_log',
        label: 'Reminder Audit Log',
        description: 'Full dispatch history with status, recipient (masked), errors',
        supportsLimited: false,
      },
      {
        key: 'reminder_dispatcher_run',
        label: 'Dispatcher Trigger',
        description: 'Manually run / inspect the daily reminder dispatcher cron',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'finance',
    label: 'Finance',
    description:
      'GST-compliant invoicing, bookkeeping, party ledger, banking, fixed assets, and reports',
    subFeatures: [
      // Wave 6 - canonical taxonomy mirroring backend FINANCE module.
      // Source: docs/MODULE_INVENTORY.md §3.2.1 + backend
      // src/common/constants/module-features.registry.ts AppModule.FINANCE.
      //
      // Wave 7 - bare legacy aliases dropped (`finance_basic`, `finance_advanced`).
      // Active legacy keys preserved below for UI consumers (settings/finance,
      // lib/constants.ts FINANCE_VOUCHERS_FEATURE_KEY).
      {
        key: 'finance_accountant_invite',
        label: 'Accountant Invite',
        description: 'Invite a CA / accountant to your books with read-only or full access',
        supportsLimited: false,
      },
      {
        key: 'finance_gstin_byok',
        label: 'GSTIN BYOK',
        description: 'Use your own GSTIN provider API key (consumed by settings/finance page)',
        supportsLimited: false,
      },
      {
        key: 'finance_vouchers',
        label: 'Finance Vouchers (legacy)',
        description:
          'Coarse vouchers gate - superseded by accounting_journal_entries / contra_entries / cash_registers',
        supportsLimited: false,
      },
      // Sales
      {
        key: 'sales_invoicing',
        label: 'Sales Invoicing',
        description: 'Full sales invoice lifecycle - draft, post, approve, cancel, clone, send',
        supportsLimited: false,
      },
      {
        key: 'sales_orders',
        label: 'Sales Orders',
        description: 'Convert quotes to confirmed sales orders',
        supportsLimited: false,
      },
      {
        key: 'sales_quotations',
        label: 'Sales Quotations',
        description: 'Send professional quotations and convert to sale order',
        supportsLimited: false,
      },
      {
        key: 'sales_proforma',
        label: 'Proforma Invoices',
        description: 'Issue pre-sale proforma invoices',
        supportsLimited: false,
      },
      {
        key: 'sales_delivery_challans',
        label: 'Delivery Challans',
        description: 'Move goods to customer with valid GST challans',
        supportsLimited: false,
      },
      {
        key: 'sales_recurring_billing',
        label: 'Recurring Invoices',
        description: 'Auto-generate invoices on a schedule (rent, AMC, retainer)',
        supportsLimited: false,
      },
      {
        key: 'sales_credit_debit_notes',
        label: 'Credit & Debit Notes',
        description: 'Issue / receive returns and adjustments with ITC reversal',
        supportsLimited: false,
      },
      // Purchases
      {
        key: 'purchases_invoicing',
        label: 'Purchase Bills',
        description: 'Record vendor bills with GST and ITC tracking',
        supportsLimited: false,
      },
      {
        key: 'purchases_orders',
        label: 'Purchase Orders',
        description: 'Send POs to vendors and track delivery against them',
        supportsLimited: false,
      },
      {
        key: 'purchases_grn',
        label: 'Goods Receipt (GRN)',
        description: 'Confirm goods received against PO; trigger ITC',
        supportsLimited: false,
      },
      {
        key: 'purchases_grn_returns',
        label: 'GRN Returns',
        description: 'Record purchase returns from GRN',
        supportsLimited: false,
      },
      {
        key: 'purchases_expenses',
        label: 'Expense Vouchers',
        description: 'Record cash / bank expenses (rent, electricity, salaries)',
        supportsLimited: false,
      },
      {
        key: 'purchases_ocr',
        label: 'Vendor Bill OCR',
        description: 'Snap a vendor bill - AI reads everything into the form',
        supportsLimited: false,
      },
      {
        key: 'purchases_payment_outward',
        label: 'Payment Outward',
        description: 'Pay vendors via cheque / NEFT / UPI / mixed modes',
        supportsLimited: false,
      },
      {
        key: 'purchases_capital_goods_itc',
        label: 'Capital Goods ITC',
        description: 'Track ITC on capital goods over multi-year schedule',
        supportsLimited: false,
      },
      {
        key: 'purchases_payables',
        label: 'Payables Listing',
        description: 'View aged payables across vendors',
        supportsLimited: false,
      },
      // Payments
      {
        key: 'payments_payment_in',
        label: 'Payment Receipts',
        description: 'Record customer payments against invoices',
        supportsLimited: false,
      },
      {
        key: 'payments_party_ledger',
        label: 'Party Ledger',
        description: 'Per-party transaction ledger view',
        supportsLimited: false,
      },
      // Banking
      {
        key: 'banking_bank_accounts',
        label: 'Bank Accounts & Reconciliation',
        description: 'Multiple bank accounts with statement reconciliation and running balance',
        supportsLimited: false,
      },
      {
        key: 'banking_cheques',
        label: 'Cheque Register',
        description: 'Track every issued / received cheque through clearing',
        supportsLimited: false,
      },
      {
        key: 'banking_loan_accounts',
        label: 'Loan Accounts & EMI',
        description: 'Loan ledger with auto-EMI posting and amortisation',
        supportsLimited: false,
      },
      // Accounting
      {
        key: 'accounting_journal_entries',
        label: 'Journal Vouchers',
        description: 'Manual debit / credit entries for accountants',
        supportsLimited: false,
      },
      {
        key: 'accounting_contra_entries',
        label: 'Contra Entries',
        description: 'Bank-to-bank, cash-to-bank inter-account transfers',
        supportsLimited: false,
      },
      {
        key: 'accounting_coa',
        label: 'Chart of Accounts',
        description: 'Standard + custom ledger heads',
        supportsLimited: false,
      },
      {
        key: 'accounting_fiscal_years',
        label: 'Fiscal Years',
        description: 'Multi-year books with formal year-end close',
        supportsLimited: false,
      },
      {
        key: 'accounting_voucher_series',
        label: 'Voucher Series',
        description: 'Configure number sequences (INV-001, PO-001…)',
        supportsLimited: false,
      },
      {
        key: 'accounting_items_master',
        label: 'Item Master',
        description: 'Items + services with HSN/SAC, GST rates, pricing tiers',
        supportsLimited: false,
      },
      {
        key: 'accounting_setup_checklist',
        label: 'Setup Checklist',
        description: 'Onboarding guide for new firms',
        supportsLimited: false,
      },
      {
        key: 'accounting_recycle_bin',
        label: 'Recycle Bin',
        description: 'Soft-delete recovery + permanent purge',
        supportsLimited: false,
      },
      {
        key: 'accounting_tally_export',
        label: 'Tally XML Export',
        description: 'Export ledger to Tally XML for legacy ERP bridges',
        supportsLimited: false,
      },
      {
        key: 'accounting_cash_registers',
        label: 'Cash Registers',
        description: 'POS-style daily cash reconciliation',
        supportsLimited: false,
      },
      // Fixed Assets
      {
        key: 'fixed_assets_categories',
        label: 'Asset Categories',
        description: 'Categorise assets - vehicles, machinery, IT, building',
        supportsLimited: false,
      },
      {
        key: 'fixed_assets_register',
        label: 'Asset Register',
        description: 'Maintain a complete fixed-asset register with depreciation',
        supportsLimited: false,
      },
      {
        key: 'fixed_assets_depreciation',
        label: 'Depreciation',
        description: 'Auto-calc straight-line / WDV depreciation; post to ledger',
        supportsLimited: false,
      },
      {
        key: 'fixed_assets_disposal',
        label: 'Asset Disposal',
        description: 'Record sale / scrap of assets with gain / loss to ledger',
        supportsLimited: false,
      },
      {
        key: 'fixed_assets_linking',
        label: 'Asset Linking',
        description: 'Link assets to projects, departments, cost centers',
        supportsLimited: false,
      },
      {
        key: 'fixed_assets_reports',
        label: 'Fixed Asset Reports',
        description: 'Asset register, depreciation schedule, block summary',
        supportsLimited: false,
      },
      // Reports + Parties
      {
        key: 'reports_financial',
        label: 'Financial Reports',
        description: 'Trial balance, P&L, balance sheet, cash flow, GST summaries',
        supportsLimited: false,
      },
      {
        key: 'parties_master',
        label: 'Parties (Customers / Vendors)',
        description: 'Customers and vendors with contacts, GSTIN, addresses',
        supportsLimited: false,
      },
      {
        key: 'party_portal_access',
        label: 'Party Self-Serve Portal',
        description: 'Send customers a self-serve link - they see invoices, ledger, pay online',
        supportsLimited: false,
      },
      // Party intelligence
      {
        key: 'party_intelligence',
        label: 'Party Intelligence (legacy)',
        description: 'Coarse party-intelligence gate',
        supportsLimited: false,
      },
      {
        key: 'party_intelligence_rfm',
        label: 'Party RFM Analytics',
        description: 'Recency / Frequency / Monetary analytics per party',
        supportsLimited: false,
      },
      {
        key: 'party_intelligence_gstin_monitor',
        label: 'GSTIN Monitor',
        description: 'Monitor party GSTIN status changes',
        supportsLimited: false,
      },
      {
        key: 'party_intelligence_timeline',
        label: 'Party Event Timeline',
        description: 'Single timeline of every invoice / payment / communication / note per party',
        supportsLimited: false,
      },
      {
        key: 'party_intelligence_pnl',
        label: 'Party P&L',
        description: 'Per-party profit margin analysis',
        supportsLimited: false,
      },
      {
        key: 'party_intelligence_greetings',
        label: 'Party Greetings',
        description: 'Greeting templates and blacklist controls',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'inventory',
    label: 'Inventory',
    description:
      'Stock management - godowns, lots, batches, serials, transfers, wastage, and samples/consignment',
    subFeatures: [
      {
        key: 'items_master',
        label: 'Items Master',
        description: 'Item + service master with HSN/SAC, GST rates, pricing tiers',
        supportsLimited: false,
      },
      {
        key: 'stock_summary',
        label: 'Stock Summary',
        description: 'Real-time stock per item / per godown',
        supportsLimited: false,
      },
      {
        key: 'stock_movements_view',
        label: 'Stock Movements (View)',
        description: 'Read-only ledger of every stock in/out/transfer',
        supportsLimited: false,
      },
      {
        key: 'godowns',
        label: 'Multi-Godown',
        description: 'Create and manage multiple warehouse/location godowns per firm',
        supportsLimited: false,
      },
      {
        key: 'lots',
        label: 'Lot Tracking',
        description: 'Group items into manufacturing lots for traceability',
        supportsLimited: false,
      },
      {
        key: 'batches',
        label: 'Batch Tracking',
        description: 'Track expiry-managed batches for pharma, food, perishables',
        supportsLimited: false,
      },
      {
        key: 'serial_tracking',
        label: 'Serial Number Tracking',
        description: 'Trace each unit by serial - purchase → sale → return/scrap with audit trail',
        supportsLimited: false,
      },
      {
        key: 'samples',
        label: 'Samples & Consignment',
        description: 'Dispatch samples / consignment without billing; track returns',
        supportsLimited: false,
      },
      {
        key: 'stock_transfers',
        label: 'Stock Transfers',
        description: 'Move stock between godowns with audit trail; lock to prevent double-posting',
        supportsLimited: false,
      },
      {
        key: 'wastage',
        label: 'Wastage / Scrap',
        description: 'Log scrap/damage/shrinkage with reasons; auditable cost tracking',
        supportsLimited: false,
      },
      {
        key: 'barcode',
        label: 'Barcode Scan',
        description: 'Generate barcode labels; scan from any phone camera',
        supportsLimited: false,
      },
      {
        key: 'cess_rules',
        label: 'Cess Rules',
        description: 'Per-item cess configuration for tobacco, luxury, environment levies',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'gst_compliance',
    label: 'GST Compliance',
    description:
      'GST filing suite - GSTR-1, GSTR-3B, e-Invoice, e-Way Bills, Verify-My-Data, ITC-04',
    subFeatures: [
      {
        key: 'gstin_lookup',
        label: 'GSTIN Lookup',
        description: 'Validate any GSTIN against GSTN portal in real time',
        supportsLimited: false,
      },
      {
        key: 'einvoice_generation',
        label: 'e-Invoice (IRN)',
        description: 'Auto-generate IRN + signed e-Invoice QR for B2B sales',
        supportsLimited: false,
      },
      {
        key: 'ewaybill_generation',
        label: 'e-Way Bill',
        description:
          'Generate e-way bills above ₹50k threshold; extend within 8h, cancel within 24h',
        supportsLimited: false,
      },
      {
        key: 'verify_my_data',
        label: 'Verify-My-Data',
        description: 'Pre-filing scan - catches missing GSTINs, mismatched HSN, ITC errors',
        supportsLimited: false,
      },
      {
        key: 'gstr1_filing',
        label: 'GSTR-1 Filing',
        description: 'Generate, validate, and export GSTR-1 (sales return) for portal upload',
        supportsLimited: false,
      },
      {
        key: 'gstr3b_filing',
        label: 'GSTR-3B Filing',
        description: 'Auto-computed GSTR-3B with manual cell overrides + GSTN-compliant JSON',
        supportsLimited: false,
      },
      {
        key: 'itc04_filing',
        label: 'ITC-04 (Job Work)',
        description: 'Quarterly ITC-04 statement for job-work goods movement',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'manufacturing',
    label: 'Manufacturing / BOM',
    description:
      'Production accounting - BOM design, work-order lifecycle, automatic WIP/FG/COGS posting',
    subFeatures: [
      {
        key: 'bom_crud',
        label: 'BOM Design',
        description: 'Design multi-level BOMs - components, alternates, scrap rates',
        supportsLimited: false,
      },
      {
        key: 'bom_explosion',
        label: 'BOM Explosion',
        description: 'Auto-explode BOMs to leaf components for procurement planning',
        supportsLimited: false,
      },
      {
        key: 'bom_costing',
        label: 'Standard Costing',
        description: 'Compute standard cost from live component prices; sync with inventory',
        supportsLimited: false,
      },
      {
        key: 'manufacturing_voucher',
        label: 'Manufacturing Vouchers',
        description: 'Manufacturing journal entries - WIP, FG, COGS in one workflow',
        supportsLimited: false,
      },
      {
        key: 'manufacturing_voucher_lifecycle',
        label: 'Production Lifecycle',
        description:
          'Order-to-completion lifecycle - draft → issue materials → complete → variance posting',
        supportsLimited: false,
      },
      {
        key: 'manufacturing_voucher_register',
        label: 'Production Register',
        description: 'Production register with yields, material totals, bottleneck reports',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'job_work',
    label: 'Job Work',
    description:
      'Job-work cycle - outward/inward challans, processor invoicing, lot tracking, statutory ITC-04',
    subFeatures: [
      {
        key: 'outward',
        label: 'Outward Challan',
        description: 'Send goods to job worker with valid challan and timer for return',
        supportsLimited: false,
      },
      {
        key: 'inward',
        label: 'Inward Challan',
        description: 'Receive processed goods; auto-match against outward challan',
        supportsLimited: false,
      },
      {
        key: 'invoicing',
        label: 'Job Work Invoice',
        description: 'Pay job worker; ITC on service GST',
        supportsLimited: false,
      },
      {
        key: 'lots',
        label: 'Lot Tracking',
        description: 'Group job-work goods into lots for traceability',
        supportsLimited: false,
      },
      {
        key: 'itc04',
        label: 'ITC-04 Report',
        description: 'Auto-generate ITC-04 quarterly statement for GST filing',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'regularization',
    label: 'Attendance Regularization',
    description:
      'Approval workflow for attendance corrections - request, review, approve/reject with full audit trail',
    subFeatures: [
      {
        key: 'request',
        label: 'Request Regularization',
        description: 'Employees request attendance corrections from the app',
        supportsLimited: false,
      },
      {
        key: 'approve',
        label: 'Approve Request',
        description: 'Managers approve correction requests in one tap',
        supportsLimited: false,
      },
      {
        key: 'reject',
        label: 'Reject Request',
        description: 'Managers reject correction requests with reason',
        supportsLimited: false,
      },
      {
        key: 'view_audit',
        label: 'View Audit Trail',
        description: 'See full history of every regularization with actor + reason',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'leave',
    label: 'Leave Management',
    description:
      'Configurable leave-type catalogue, balances & ledger, accrual, multi-day requests, approvals, comp-off, and year-end encashment',
    subFeatures: [
      {
        key: 'apply',
        label: 'Apply for Leave',
        description: 'Workers apply for leave with a live paid-vs-unpaid preview',
        supportsLimited: false,
      },
      {
        key: 'approve',
        label: 'Approve Leave',
        description: 'Managers review and approve or reject leave requests',
        supportsLimited: false,
      },
      {
        key: 'view_balance',
        label: 'View Leave Balance',
        description: 'See accrued, used, pending, and available leave per type',
        supportsLimited: false,
      },
      {
        key: 'configure',
        label: 'Configure Leave',
        description: 'Define leave types, accrual rules, and year-end policy',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'downtime',
    label: 'Machine Downtime',
    description:
      'Track machine downtime - power cuts, breakdowns, changeovers, with categorised reasons',
    subFeatures: [
      {
        key: 'view',
        label: 'View Downtime',
        description: 'View downtime entries and categorised reasons per machine',
        supportsLimited: false,
      },
      {
        key: 'log',
        label: 'Log Downtime',
        description: 'Record machine downtime with category and duration',
        supportsLimited: false,
      },
      {
        key: 'manage_reasons',
        label: 'Manage Downtime Reasons',
        description: 'Define custom downtime reasons for your operations',
        supportsLimited: false,
      },
    ],
  },
  {
    module: 'maintenance',
    label: 'Preventive Maintenance',
    description:
      'Schedule preventive maintenance, log work orders, track MTBF - for industrial customers',
    subFeatures: [
      {
        key: 'view',
        label: 'View Maintenance',
        description: 'View scheduled maintenance + completed work orders',
        supportsLimited: false,
      },
      {
        key: 'schedule',
        label: 'Schedule Maintenance',
        description: 'Schedule preventive maintenance plans per machine',
        supportsLimited: false,
      },
      {
        key: 'log',
        label: 'Log Work Order',
        description: 'Log maintenance work orders with parts, labour, downtime',
        supportsLimited: false,
      },
      {
        key: 'manage',
        label: 'Manage Plans',
        description: 'Create and update maintenance plans + intervals',
        supportsLimited: false,
      },
    ],
  },
];

export const FEATURE_ACCESS_MAP: Record<string, ModuleFeatureDefinition> =
  FEATURE_ACCESS_REGISTRY.reduce(
    (acc, moduleDef) => {
      acc[moduleDef.module] = moduleDef;
      return acc;
    },
    {} as Record<string, ModuleFeatureDefinition>,
  );

export function getDefaultModuleAccess(
  moduleKey: string,
  defaultLevel: FeatureAccessLevel,
): {
  module: string;
  enabled: boolean;
  subFeatures: { key: string; access: FeatureAccessLevel }[];
} {
  const moduleDef = FEATURE_ACCESS_MAP[moduleKey];
  if (!moduleDef) {
    return { module: moduleKey, enabled: false, subFeatures: [] };
  }

  return {
    module: moduleKey,
    enabled: defaultLevel !== 'locked',
    subFeatures: moduleDef.subFeatures.map((sf) => ({
      key: sf.key,
      access: defaultLevel,
    })),
  };
}

export function getAllSubFeatures(): { module: string; key: string; label: string }[] {
  const result: { module: string; key: string; label: string }[] = [];
  for (const mod of FEATURE_ACCESS_REGISTRY) {
    for (const sf of mod.subFeatures) {
      result.push({
        module: mod.module,
        key: sf.key,
        label: sf.label,
      });
    }
  }
  return result;
}

// ── Sales entitlement gates (D-17) ───────────────────────────
// Flat map keyed by feature slug → tiers that unlock it.
// Used by EntitlementGate component to gate UI sections without hitting the API.
export const SALES_FEATURE_ACCESS = {
  sales_upi_qr: { tiers: ['Starter', 'Pro', 'Enterprise'], label: 'UPI QR on invoice' },
  sales_recurring: { tiers: ['Pro', 'Enterprise'], label: 'Recurring Invoice' },
  sales_razorpay_link: { tiers: ['Pro', 'Enterprise'], label: 'Razorpay Payment Link' },
  sales_maker_checker: { tiers: ['Enterprise'], label: 'Maker-Checker Approval' },
  sales_einvoice: { tiers: ['Starter', 'Pro', 'Enterprise'], label: 'e-Invoice (IRN)' },
  sales_ewaybill: { tiers: ['Starter', 'Pro', 'Enterprise'], label: 'e-Way Bill' },
  multi_copy_print: { tiers: ['Free', 'Starter', 'Pro', 'Enterprise'], label: 'Multi-Copy Print' },
} as const;

export type SalesFeatureKey = keyof typeof SALES_FEATURE_ACCESS;
