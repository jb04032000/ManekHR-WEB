import type { ExportField } from './types';
import type { TeamMember } from '@/types';
import { fmt } from '@/lib/utils';

/**
 * All exportable fields for the Team module.
 *
 * DEFAULT SET (defaultEnabled: true) - 8 fields:
 *   Name, Designation, Mobile, Email, Salary Amount,
 *   Salary Type, Status, Date of Joining
 *
 * CUSTOM-ONLY SET (defaultEnabled: false) - 8 fields:
 *   Gender, Blood Group, Date of Birth, Address,
 *   Emergency Contact, Emergency Mobile, Weekly Off, App Access
 */
export const TEAM_EXPORT_FIELDS: ExportField<TeamMember>[] = [
  // ── Default fields ──────────────────────────────────────────────
  {
    key: 'name',
    label: 'Name',
    defaultEnabled: true,
    getValue: (m) => m.name,
  },
  {
    key: 'designation',
    label: 'Designation',
    defaultEnabled: true,
    getValue: (m) => m.designation ?? '-',
  },
  {
    key: 'mobile',
    label: 'Mobile',
    defaultEnabled: true,
    getValue: (m) => m.mobile ?? '-',
  },
  {
    key: 'email',
    label: 'Email',
    defaultEnabled: true,
    getValue: (m) => m.email ?? '-',
  },
  {
    key: 'salaryAmount',
    label: 'Salary Amount',
    defaultEnabled: true,
    getValue: (m) => m.salaryAmount ?? 0,
    pdfValue: (m) =>
      `Rs.${Number(m.salaryAmount ?? 0).toLocaleString('en-IN')}/${m.salaryType === 'hourly' ? 'hr' : 'mo'}`,
  },
  {
    key: 'salaryType',
    label: 'Salary Type',
    defaultEnabled: true,
    getValue: (m) => (m.salaryType === 'hourly' ? 'Hourly' : 'Monthly'),
  },
  {
    key: 'status',
    label: 'Status',
    defaultEnabled: true,
    getValue: (m) => {
      if (m.isDeleted) return 'Archived';
      if (!m.isActive) return 'Inactive';
      if (m.dateOfResignation && new Date(m.dateOfResignation) > new Date()) return 'Offboarding';
      return 'Active';
    },
  },
  {
    key: 'dateOfJoining',
    label: 'Date of Joining',
    defaultEnabled: true,
    getValue: (m) => (m.dateOfJoining ? fmt(m.dateOfJoining) : '-'),
  },
  {
    key: 'shift',
    label: 'Shift',
    defaultEnabled: true,
    getValue: (m) => m.shift?.name ?? '-',
  },

  // ── Custom-only fields ───────────────────────────────────────────
  {
    key: 'gender',
    label: 'Gender',
    defaultEnabled: false,
    getValue: (m) => (m.gender ? m.gender.charAt(0).toUpperCase() + m.gender.slice(1) : '-'),
  },
  {
    key: 'bloodGroup',
    label: 'Blood Group',
    defaultEnabled: false,
    getValue: (m) => m.bloodGroup ?? '-',
  },
  {
    key: 'dateOfBirth',
    label: 'Date of Birth',
    defaultEnabled: false,
    getValue: (m) => (m.dateOfBirth ? fmt(m.dateOfBirth) : '-'),
  },
  {
    key: 'address',
    label: 'Address',
    defaultEnabled: false,
    getValue: (m) => m.address ?? '-',
  },
  {
    key: 'emergencyContactName',
    label: 'Emergency Contact',
    defaultEnabled: false,
    getValue: (m) => m.emergencyContactName ?? '-',
  },
  {
    key: 'emergencyContactNumber',
    label: 'Emergency Mobile',
    defaultEnabled: false,
    getValue: (m) => m.emergencyContactNumber ?? '-',
  },
  {
    key: 'weeklyOff',
    label: 'Weekly Off',
    defaultEnabled: false,
    getValue: (m) => (m.weeklyOff && m.weeklyOff.length > 0 ? m.weeklyOff.join(', ') : '-'),
  },
];
