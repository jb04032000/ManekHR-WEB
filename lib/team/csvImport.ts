// CSV bulk-import engine for the Team module.
//
// What it does: parses a CSV (CSV ONLY - the wizard rejects .xlsx/.xls before
// reaching here), auto-detects which CSV column feeds each member field, and
// transforms each mapped row into a CreateTeamMemberPayload that the
// `bulkCreateTeamMembers` action posts to the BE.
//
// Cross-module links:
//   • Output shape -> `CreateTeamMemberPayload` (types) -> BE
//     team.service.bulkCreate (must stay field-compatible).
//   • Consumed by components/dashboard/team/import/TeamBulkImportModal.tsx.
//
// Watch: the backend stores a SINGLE `name` field (no first/last split). A CSV
// in the wild often has the surname column first, or split first/last columns
// in either order - so we map First Name and Last Name as separate logical
// inputs and always recompose as "First Last", never relying on column order.
// Keep ALIASES generous; keep MAX_BULK_IMPORT_ROWS in sync with the BE DTO cap.

import Papa from 'papaparse';
import type { BankDetails, CreateTeamMemberPayload, Shift, UpiDetails } from '@/types';

export const MAX_BULK_IMPORT_ROWS = 500;

// Logical import fields. `firstName` + `lastName` are virtual: they don't exist
// on the payload, they recombine into `name`. A single `name`/`fullName`
// column maps to `name` directly and wins over the split columns when present.
export type ImportFieldKey =
  | 'name'
  | 'firstName'
  | 'lastName'
  // NOTE: there is deliberately no `employeeCode` key. Codes are always
  // system-generated, immutable, and non-replaceable (owner request
  // 2026-06-13), so the CSV cannot set or override them.
  | 'mobile'
  | 'email'
  | 'designation'
  | 'department'
  | 'location'
  | 'gender'
  | 'bloodGroup'
  | 'maritalStatus'
  | 'nationality'
  | 'emergencyContactName'
  | 'emergencyContactNumber'
  | 'dateOfBirth'
  | 'dateOfJoining'
  | 'employmentType'
  | 'salaryType'
  | 'salaryAmount'
  | 'address'
  | 'fatherOrSpouseName'
  | 'shift'
  // Statutory & tax
  | 'pan'
  | 'uan'
  | 'aadhaar'
  | 'taxRegime'
  | 'stateOfEmployment'
  | 'pfApplicable'
  | 'esiApplicable'
  | 'esiIpNumber'
  // Payment
  | 'preferredMethod'
  | 'bankName'
  | 'accountHolderName'
  | 'accountNumber'
  | 'ifscCode'
  | 'upiId';

export interface ImportFieldDef {
  key: ImportFieldKey;
  label: string;
  /** Header strings (normalized) that auto-map to this field. */
  aliases: string[];
  /** Short helper shown under the mapping row. */
  hint?: string;
}

// Order here drives the mapping-UI order and the downloadable template column
// order. First/Last deliberately precede the combined Name so the common
// "surname-first" sheet maps cleanly.
export const IMPORT_FIELDS: ImportFieldDef[] = [
  {
    key: 'firstName',
    label: 'First name',
    aliases: ['firstname', 'first', 'givenname', 'forename', 'fname'],
    hint: 'Combined with Last name as "First Last".',
  },
  {
    key: 'lastName',
    label: 'Last name / Surname',
    aliases: ['lastname', 'last', 'surname', 'familyname', 'lname', 'secondname'],
    hint: 'Even if it appears first in your file, it lands in the surname slot.',
  },
  {
    key: 'name',
    label: 'Full name',
    aliases: ['name', 'fullname', 'employeename', 'membername', 'staffname'],
    hint: 'Use this only if your file has one combined name column.',
  },
  {
    key: 'mobile',
    label: 'Mobile',
    aliases: ['mobile', 'phone', 'phonenumber', 'mobileno', 'contact', 'contactnumber', 'cell'],
  },
  { key: 'email', label: 'Email', aliases: ['email', 'emailaddress', 'mail', 'emailid'] },
  {
    key: 'designation',
    label: 'Designation',
    aliases: ['designation', 'role', 'jobtitle', 'title', 'position'],
  },
  { key: 'department', label: 'Department', aliases: ['department', 'dept', 'team'] },
  {
    key: 'location',
    label: 'Work location (city)',
    aliases: ['location', 'city', 'worklocation', 'branch', 'site', 'office'],
    hint: 'Used on the employee ID card - enter the city.',
  },
  {
    key: 'shift',
    label: 'Shift',
    aliases: ['shift', 'shiftname', 'shifttiming', 'shifttime', 'workshift', 'roster'],
    hint: 'Must match an existing shift name (e.g. Day shift). Unknown names are skipped.',
  },
  { key: 'gender', label: 'Gender', aliases: ['gender', 'sex'] },
  { key: 'bloodGroup', label: 'Blood group', aliases: ['bloodgroup', 'blood', 'bloodtype'] },
  {
    key: 'emergencyContactName',
    label: 'Emergency contact name',
    aliases: ['emergencycontactname', 'emergencyname', 'emergencycontact', 'sosname'],
  },
  {
    key: 'emergencyContactNumber',
    label: 'Emergency contact number',
    aliases: ['emergencycontactnumber', 'emergencynumber', 'emergencyphone', 'sosnumber'],
  },
  {
    key: 'dateOfBirth',
    label: 'Date of birth',
    aliases: ['dateofbirth', 'dob', 'birthdate', 'birthday'],
    hint: 'Accepts DD/MM/YYYY, DD-MM-YYYY or YYYY-MM-DD.',
  },
  {
    key: 'dateOfJoining',
    label: 'Date of joining',
    aliases: ['dateofjoining', 'doj', 'joiningdate', 'joindate', 'startdate'],
  },
  {
    key: 'salaryType',
    label: 'Salary type',
    aliases: ['salarytype', 'paytype', 'wagetype'],
    hint: 'monthly / hourly. Defaults to monthly.',
  },
  {
    key: 'salaryAmount',
    label: 'Salary amount',
    aliases: ['salaryamount', 'salary', 'wage', 'ctc', 'pay', 'monthlysalary'],
  },
  { key: 'address', label: 'Address', aliases: ['address', 'residentialaddress', 'addr'] },
  {
    key: 'fatherOrSpouseName',
    label: "Father's / spouse name",
    aliases: ['fathername', 'fathersname', 'spousename', 'guardianname', 'fatherorspousename'],
  },
  {
    key: 'maritalStatus',
    label: 'Marital status',
    aliases: ['maritalstatus', 'marital', 'maritalstate'],
    hint: 'single / married / divorced / widowed.',
  },
  {
    key: 'nationality',
    label: 'Nationality',
    aliases: ['nationality', 'citizenship'],
    hint: 'Defaults to Indian when blank.',
  },
  {
    key: 'employmentType',
    label: 'Employment type',
    aliases: ['employmenttype', 'emptype', 'jobtype', 'engagementtype'],
    hint: 'full_time / part_time / contract / intern / consultant.',
  },
  // ── Statutory & tax ──────────────────────────────────────────────────────
  {
    key: 'pan',
    label: 'PAN',
    aliases: ['pan', 'panno', 'pannumber', 'pancard'],
    hint: 'Format ABCDE1234F. Invalid values are skipped.',
  },
  {
    key: 'uan',
    label: 'UAN (PF)',
    aliases: ['uan', 'uanno', 'uannumber', 'pfuan'],
    hint: '12-digit PF Universal Account Number.',
  },
  {
    key: 'aadhaar',
    label: 'Aadhaar',
    aliases: ['aadhaar', 'aadhar', 'aadharno', 'aadhaarnumber', 'uidai'],
    hint: '12 digits (checksum-validated). Invalid values are skipped.',
  },
  {
    key: 'taxRegime',
    label: 'Tax regime',
    aliases: ['taxregime', 'regime', 'itregime'],
    hint: 'old / new. Defaults to new.',
  },
  {
    key: 'stateOfEmployment',
    label: 'State of employment',
    aliases: ['stateofemployment', 'state', 'workstate', 'ptstate'],
  },
  {
    key: 'pfApplicable',
    label: 'PF applicable',
    aliases: ['pfapplicable', 'pf', 'epf', 'pfeligible'],
    hint: 'yes / no. Defaults to yes.',
  },
  {
    key: 'esiApplicable',
    label: 'ESI applicable',
    aliases: ['esiapplicable', 'esi', 'esic', 'esieligible'],
    hint: 'yes / no. Defaults to no.',
  },
  {
    key: 'esiIpNumber',
    label: 'ESI IP number',
    aliases: ['esiipnumber', 'esiip', 'ipnumber', 'esinumber'],
  },
  // ── Payment ──────────────────────────────────────────────────────────────
  {
    key: 'preferredMethod',
    label: 'Preferred payment method',
    aliases: ['preferredmethod', 'paymentmethod', 'paymode', 'paymentmode', 'paythrough'],
    hint: 'BANK / UPI / CASH.',
  },
  {
    key: 'bankName',
    label: 'Bank name',
    aliases: ['bankname', 'bank'],
  },
  {
    key: 'accountHolderName',
    label: 'Account holder name',
    aliases: ['accountholdername', 'accountholder', 'acholder', 'beneficiaryname'],
  },
  {
    key: 'accountNumber',
    label: 'Account number',
    aliases: ['accountnumber', 'accountno', 'acno', 'bankaccount', 'accno'],
    hint: '9-18 digits.',
  },
  {
    key: 'ifscCode',
    label: 'IFSC code',
    aliases: ['ifsccode', 'ifsc', 'ifsccodeno'],
    hint: 'Format SBIN0001234.',
  },
  {
    key: 'upiId',
    label: 'UPI ID',
    aliases: ['upiid', 'upi', 'vpa', 'upiaddress'],
    hint: 'Format name@bank.',
  },
];

/** Lowercase + strip everything non-alphanumeric for tolerant header matching. */
export function normalizeHeader(h: string): string {
  return (h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Parse a CSV File into headers + row objects. Rejects (throws) when the file
 * isn't a CSV - the UI also pre-filters, this is the defensive backstop.
 */
export function parseCsvFile(file: File): Promise<ParsedCsv> {
  const isCsv =
    /\.csv$/i.test(file.name) ||
    file.type === 'text/csv' ||
    file.type === 'application/vnd.ms-excel'; // some OSes tag .csv as this
  if (!isCsv) {
    return Promise.reject(
      new Error('Only .csv files are supported. Re-save your spreadsheet as CSV and try again.'),
    );
  }
  return new Promise<ParsedCsv>((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const headers = (res.meta.fields ?? []).filter((h) => h && h.trim().length > 0);
        if (headers.length === 0) {
          reject(new Error('No column headers found. The first row must be the column names.'));
          return;
        }
        resolve({ headers, rows: res.data ?? [] });
      },
      error: (err: unknown) =>
        reject(new Error(err instanceof Error ? err.message : 'Could not read the CSV file.')),
    });
  });
}

/** Mapping from logical field key -> chosen CSV header (or '' when unmapped). */
export type ColumnMapping = Partial<Record<ImportFieldKey, string>>;

/**
 * Best-effort auto-mapping: for each field, pick the first CSV header whose
 * normalized form matches one of the field aliases. Each header is used at
 * most once (first claimer wins, following IMPORT_FIELDS order).
 */
export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const taken = new Set<string>();
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  for (const field of IMPORT_FIELDS) {
    const hit = normalized.find((h) => !taken.has(h.raw) && field.aliases.includes(h.norm));
    if (hit) {
      mapping[field.key] = hit.raw;
      taken.add(hit.raw);
    }
  }
  return mapping;
}

const GENDER_MAP: Record<string, 'male' | 'female' | 'other'> = {
  m: 'male',
  male: 'male',
  f: 'female',
  female: 'female',
  o: 'other',
  other: 'other',
};

const MARITAL_MAP: Record<string, 'single' | 'married' | 'divorced' | 'widowed'> = {
  single: 'single',
  unmarried: 'single',
  married: 'married',
  divorced: 'divorced',
  widowed: 'widowed',
  widow: 'widowed',
  widower: 'widowed',
};

const EMPLOYMENT_MAP: Record<
  string,
  'full_time' | 'part_time' | 'contract' | 'intern' | 'consultant'
> = {
  fulltime: 'full_time',
  full_time: 'full_time',
  permanent: 'full_time',
  regular: 'full_time',
  parttime: 'part_time',
  part_time: 'part_time',
  contract: 'contract',
  contractual: 'contract',
  intern: 'intern',
  internship: 'intern',
  trainee: 'intern',
  consultant: 'consultant',
};

const PAYMENT_METHOD_MAP: Record<string, 'BANK' | 'UPI' | 'CASH'> = {
  bank: 'BANK',
  banktransfer: 'BANK',
  neft: 'BANK',
  imps: 'BANK',
  upi: 'UPI',
  cash: 'CASH',
};

/** Strip everything except digits. */
function digitsOnly(raw: string): string {
  return (raw ?? '').replace(/\D/g, '');
}

/** Parse a loose yes/no/true/1 cell into a boolean, or undefined when blank/unknown. */
function parseBool(raw: string): boolean | undefined {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s) return undefined;
  if (['yes', 'y', 'true', '1', 'applicable', 'enabled'].includes(s)) return true;
  if (['no', 'n', 'false', '0', 'na', 'notapplicable', 'disabled'].includes(s)) return false;
  return undefined;
}

/** Normalize blood group like "o+ve", "B positive" -> "O+", "B+". */
function normalizeBloodGroup(raw: string): string {
  const s = raw.toUpperCase().replace(/\s|VE/g, '');
  const m = s.match(/^(A|B|AB|O)\s*([+-]|POS|POSITIVE|NEG|NEGATIVE)?$/);
  if (!m) return raw.trim();
  const group = m[1];
  const sign = m[2];
  if (!sign) return group;
  const pos = sign === '+' || sign === 'POS' || sign === 'POSITIVE';
  return `${group}${pos ? '+' : '-'}`;
}

/** Strip non-digits, drop a leading +91/91/0 to expose the 10-digit core. */
function digits10(raw: string): string {
  let d = (raw ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

/**
 * Convert a date cell to ISO `YYYY-MM-DD`. Accepts DD/MM/YYYY, DD-MM-YYYY,
 * YYYY-MM-DD, YYYY/MM/DD. Returns '' when it can't confidently parse - Indian
 * sheets are day-first, so ambiguous DD/MM is read day-first (never US M/D).
 */
function toIsoDate(raw: string): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    const [, d, mo, yRaw] = m;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return '';
}

export interface MappedRow {
  rowNumber: number; // 1-based source row (excludes header)
  payload: CreateTeamMemberPayload;
  errors: string[]; // blocking - row is excluded from import
  warnings: string[]; // non-blocking - value dropped or coerced
}

function cell(row: Record<string, string>, mapping: ColumnMapping, key: ImportFieldKey): string {
  const header = mapping[key];
  if (!header) return '';
  return (row[header] ?? '').toString().trim();
}

/**
 * Build the full name from mapped columns. A combined `name` column wins;
 * otherwise compose "First Last" from the split columns regardless of which
 * column came first in the CSV (the surname-first case).
 */
function resolveName(row: Record<string, string>, mapping: ColumnMapping): string {
  const full = cell(row, mapping, 'name');
  if (full) return full.replace(/\s+/g, ' ').trim();
  const first = cell(row, mapping, 'firstName');
  const last = cell(row, mapping, 'lastName');
  return `${first} ${last}`.replace(/\s+/g, ' ').trim();
}

/**
 * Transform parsed rows into payloads using the mapping, validating each row.
 * Fully-empty rows are skipped silently. The caller imports only rows with no
 * `errors`; `warnings` are surfaced but don't block.
 */
export function buildMappedRows(
  parsed: ParsedCsv,
  mapping: ColumnMapping,
  shifts: Shift[] = [],
): MappedRow[] {
  const out: MappedRow[] = [];
  // Resolve shift NAMES from the CSV to shift ObjectIds: the BE shiftId is
  // @IsMongoId and rejects a plain name. Built once per call (small list).
  // -> listShifts feeds the `shifts` arg from the Team page.
  const shiftIdByName = new Map<string, string>();
  for (const s of shifts) {
    const id = s.id ?? s._id;
    if (id) shiftIdByName.set(normalizeHeader(s.name), id);
  }
  parsed.rows.forEach((row, idx) => {
    // Skip blank lines (every mapped cell empty).
    const anyValue = IMPORT_FIELDS.some((f) => cell(row, mapping, f.key) !== '');
    if (!anyValue) return;

    const errors: string[] = [];
    const warnings: string[] = [];
    const payload: CreateTeamMemberPayload = { name: '' };

    const name = resolveName(row, mapping);
    if (!name) errors.push('Name is required (map Full name, or First + Last name).');
    payload.name = name;

    // Employee code is intentionally NOT read from the CSV — it is always
    // system-generated, immutable, and non-replaceable (owner request
    // 2026-06-13). Any such column in the file is ignored.

    const mobileRaw = cell(row, mapping, 'mobile');
    if (mobileRaw) {
      const d = digits10(mobileRaw);
      if (d.length === 10 && /^[6-9]/.test(d)) payload.mobile = d;
      else warnings.push(`Mobile "${mobileRaw}" isn't a valid 10-digit number - left blank.`);
    }

    const email = cell(row, mapping, 'email');
    if (email) {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) payload.email = email;
      else warnings.push(`Email "${email}" looks invalid - left blank.`);
    }

    const designation = cell(row, mapping, 'designation');
    if (designation) payload.designation = designation;
    const department = cell(row, mapping, 'department');
    if (department) payload.department = department;
    const location = cell(row, mapping, 'location');
    if (location) payload.location = location;
    const address = cell(row, mapping, 'address');
    if (address) payload.address = address;
    const fatherOrSpouseName = cell(row, mapping, 'fatherOrSpouseName');
    if (fatherOrSpouseName) payload.fatherOrSpouseName = fatherOrSpouseName;

    const genderRaw = cell(row, mapping, 'gender');
    if (genderRaw) {
      const g = GENDER_MAP[genderRaw.toLowerCase()];
      if (g) payload.gender = g;
      else warnings.push(`Gender "${genderRaw}" not recognised - left blank.`);
    }

    const bloodGroup = cell(row, mapping, 'bloodGroup');
    if (bloodGroup) payload.bloodGroup = normalizeBloodGroup(bloodGroup);

    const emergencyContactName = cell(row, mapping, 'emergencyContactName');
    if (emergencyContactName) payload.emergencyContactName = emergencyContactName;
    const emergencyContactNumber = cell(row, mapping, 'emergencyContactNumber');
    if (emergencyContactNumber) {
      const d = digits10(emergencyContactNumber);
      if (d.length === 10) payload.emergencyContactNumber = d;
      else
        warnings.push(`Emergency number "${emergencyContactNumber}" isn't 10 digits - left blank.`);
    }

    const dob = cell(row, mapping, 'dateOfBirth');
    if (dob) {
      const iso = toIsoDate(dob);
      if (iso) payload.dateOfBirth = iso;
      else warnings.push(`Date of birth "${dob}" couldn't be read - left blank.`);
    }
    const doj = cell(row, mapping, 'dateOfJoining');
    if (doj) {
      const iso = toIsoDate(doj);
      if (iso) payload.dateOfJoining = iso;
      else warnings.push(`Date of joining "${doj}" couldn't be read - left blank.`);
    }

    const salaryTypeRaw = cell(row, mapping, 'salaryType').toLowerCase();
    if (salaryTypeRaw === 'hourly') payload.salaryType = 'hourly';
    else if (salaryTypeRaw === 'monthly') payload.salaryType = 'monthly';

    const salaryRaw = cell(row, mapping, 'salaryAmount');
    if (salaryRaw) {
      const n = Number(salaryRaw.replace(/[,₹\s]/g, ''));
      if (Number.isFinite(n) && n >= 0) payload.salaryAmount = n;
      else warnings.push(`Salary "${salaryRaw}" isn't a number - left blank.`);
    }

    // ── Personal / employment classification ───────────────────────────────
    const maritalRaw = cell(row, mapping, 'maritalStatus');
    if (maritalRaw) {
      const m = MARITAL_MAP[maritalRaw.toLowerCase().replace(/\s/g, '')];
      if (m) payload.maritalStatus = m;
      else warnings.push(`Marital status "${maritalRaw}" not recognised - left blank.`);
    }
    const nationality = cell(row, mapping, 'nationality');
    if (nationality) payload.nationality = nationality;

    const employmentRaw = cell(row, mapping, 'employmentType');
    if (employmentRaw) {
      const e = EMPLOYMENT_MAP[employmentRaw.toLowerCase().replace(/[\s-]/g, '')];
      if (e) payload.employmentType = e;
      else warnings.push(`Employment type "${employmentRaw}" not recognised - left blank.`);
    }

    // ── Statutory & tax ────────────────────────────────────────────────────
    const panRaw = cell(row, mapping, 'pan');
    if (panRaw) {
      const pan = panRaw.toUpperCase().replace(/\s/g, '');
      if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) payload.pan = pan;
      else warnings.push(`PAN "${panRaw}" is invalid (expected ABCDE1234F) - left blank.`);
    }
    const uanRaw = cell(row, mapping, 'uan');
    if (uanRaw) {
      const uan = digitsOnly(uanRaw);
      if (uan.length === 12) payload.uan = uan;
      else warnings.push(`UAN "${uanRaw}" isn't 12 digits - left blank.`);
    }
    const aadhaarRaw = cell(row, mapping, 'aadhaar');
    if (aadhaarRaw) {
      const aadhaar = digitsOnly(aadhaarRaw);
      // 12-digit shape check only; the backend runs the Verhoeff checksum and
      // will reject a structurally-valid-but-wrong number for the whole row.
      if (aadhaar.length === 12) payload.aadhaar = aadhaar;
      else warnings.push(`Aadhaar "${aadhaarRaw}" isn't 12 digits - left blank.`);
    }
    const taxRaw = cell(row, mapping, 'taxRegime').toLowerCase();
    if (taxRaw === 'old' || taxRaw === 'new') payload.taxRegime = taxRaw;
    else if (taxRaw) warnings.push(`Tax regime "${taxRaw}" must be old/new - left blank.`);
    const stateOfEmployment = cell(row, mapping, 'stateOfEmployment');
    if (stateOfEmployment) payload.stateOfEmployment = stateOfEmployment;
    const pfApplicable = parseBool(cell(row, mapping, 'pfApplicable'));
    if (pfApplicable !== undefined) payload.pfApplicable = pfApplicable;
    const esiApplicable = parseBool(cell(row, mapping, 'esiApplicable'));
    if (esiApplicable !== undefined) payload.esiApplicable = esiApplicable;
    const esiIpNumber = cell(row, mapping, 'esiIpNumber');
    if (esiIpNumber) payload.esiIpNumber = esiIpNumber;

    // ── Payment routing + bank / UPI ───────────────────────────────────────
    const methodRaw = cell(row, mapping, 'preferredMethod');
    if (methodRaw) {
      const method = PAYMENT_METHOD_MAP[methodRaw.toLowerCase().replace(/[\s_-]/g, '')];
      if (method) payload.preferredMethod = method;
      else warnings.push(`Payment method "${methodRaw}" must be BANK/UPI/CASH - left blank.`);
    }
    const bankName = cell(row, mapping, 'bankName');
    const accountHolderName = cell(row, mapping, 'accountHolderName');
    const accountNumberRaw = cell(row, mapping, 'accountNumber');
    const ifscRaw = cell(row, mapping, 'ifscCode');
    const bank: Partial<BankDetails> = {};
    if (bankName) bank.bankName = bankName;
    if (accountHolderName) bank.accountHolderName = accountHolderName;
    if (accountNumberRaw) {
      const acc = digitsOnly(accountNumberRaw);
      if (acc.length >= 9 && acc.length <= 18) bank.accountNumber = acc;
      else warnings.push(`Account number "${accountNumberRaw}" must be 9-18 digits - left blank.`);
    }
    if (ifscRaw) {
      const ifsc = ifscRaw.toUpperCase().replace(/\s/g, '');
      if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) bank.ifscCode = ifsc;
      else warnings.push(`IFSC "${ifscRaw}" is invalid (expected SBIN0001234) - left blank.`);
    }
    // BE BankDetailsDto fields are each optional, so a partial bank block is
    // accepted; cast satisfies the all-required FE BankDetails interface.
    if (Object.keys(bank).length > 0) payload.bankDetails = bank as BankDetails;

    const upiRaw = cell(row, mapping, 'upiId');
    if (upiRaw) {
      const upi = upiRaw.trim();
      if (/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/.test(upi)) {
        payload.upiDetails = { upiId: upi } as UpiDetails;
      } else {
        warnings.push(`UPI ID "${upiRaw}" is invalid (expected name@bank) - left blank.`);
      }
    }

    // Shift: match the CSV value against an existing shift name and pin
    // scheduleType so the member lands on a shift schedule. An unmatched name
    // warns (non-blocking) rather than failing the whole row.
    const shiftRaw = cell(row, mapping, 'shift');
    if (shiftRaw) {
      const id = shiftIdByName.get(normalizeHeader(shiftRaw));
      if (id) {
        payload.shiftId = id;
        payload.scheduleType = 'shift';
      } else {
        warnings.push(`Shift "${shiftRaw}" doesn't match any workspace shift and was left blank.`);
      }
    }

    out.push({ rowNumber: idx + 1, payload, errors, warnings });
  });
  return out;
}

/**
 * Selectable columns for the downloadable template. The owner ticks which
 * details they want to collect; the template is generated with just those
 * columns + one example row. NOTE: documents are intentionally absent -
 * files can't travel in a CSV, they're uploaded per-member after import.
 *
 * `defaultOn` reflects the common minimum set. Employee Code is deliberately
 * absent: codes are always system-generated, immutable, and non-replaceable
 * (owner request 2026-06-13), so the CSV can neither set nor override them.
 */
export interface TemplateField {
  key: ImportFieldKey;
  header: string;
  example: string;
  defaultOn: boolean;
  /** Cannot be unticked (a name source is mandatory). */
  required?: boolean;
}

export const TEMPLATE_FIELDS: TemplateField[] = [
  { key: 'firstName', header: 'First Name', example: 'Anita', defaultOn: true, required: true },
  { key: 'lastName', header: 'Last Name', example: 'Sharma', defaultOn: true },
  { key: 'mobile', header: 'Mobile', example: '9876543210', defaultOn: true },
  { key: 'email', header: 'Email', example: 'anita@example.com', defaultOn: true },
  { key: 'designation', header: 'Designation', example: 'Machine Operator', defaultOn: true },
  { key: 'department', header: 'Department', example: 'Production', defaultOn: false },
  { key: 'location', header: 'Work Location (City)', example: 'Surat', defaultOn: true },
  { key: 'shift', header: 'Shift', example: 'Day shift', defaultOn: true },
  { key: 'employmentType', header: 'Employment Type', example: 'full_time', defaultOn: false },
  { key: 'gender', header: 'Gender', example: 'Female', defaultOn: false },
  { key: 'dateOfBirth', header: 'Date of Birth', example: '12/05/1995', defaultOn: false },
  { key: 'maritalStatus', header: 'Marital Status', example: 'single', defaultOn: false },
  { key: 'bloodGroup', header: 'Blood Group', example: 'O+', defaultOn: false },
  { key: 'nationality', header: 'Nationality', example: 'Indian', defaultOn: false },
  {
    key: 'fatherOrSpouseName',
    header: "Father's / Spouse Name",
    example: 'Suresh Sharma',
    defaultOn: false,
  },
  { key: 'address', header: 'Address', example: '12 MG Road, Surat', defaultOn: false },
  {
    key: 'emergencyContactName',
    header: 'Emergency Contact Name',
    example: 'Ramesh Sharma',
    defaultOn: false,
  },
  {
    key: 'emergencyContactNumber',
    header: 'Emergency Contact Number',
    example: '9123456780',
    defaultOn: false,
  },
  { key: 'dateOfJoining', header: 'Date of Joining', example: '01/04/2024', defaultOn: true },
  { key: 'salaryType', header: 'Salary Type', example: 'monthly', defaultOn: false },
  { key: 'salaryAmount', header: 'Salary Amount', example: '25000', defaultOn: true },
  // ── Statutory & tax ────────────────────────────────────────────────────
  { key: 'pan', header: 'PAN', example: 'ABCDE1234F', defaultOn: false },
  { key: 'uan', header: 'UAN', example: '100123456789', defaultOn: false },
  { key: 'aadhaar', header: 'Aadhaar', example: '', defaultOn: false },
  { key: 'taxRegime', header: 'Tax Regime', example: 'new', defaultOn: false },
  { key: 'stateOfEmployment', header: 'State of Employment', example: 'Gujarat', defaultOn: false },
  { key: 'pfApplicable', header: 'PF Applicable', example: 'Yes', defaultOn: false },
  { key: 'esiApplicable', header: 'ESI Applicable', example: 'No', defaultOn: false },
  { key: 'esiIpNumber', header: 'ESI IP Number', example: '', defaultOn: false },
  // ── Payment ─────────────────────────────────────────────────────────────
  { key: 'preferredMethod', header: 'Preferred Payment Method', example: 'BANK', defaultOn: false },
  { key: 'bankName', header: 'Bank Name', example: 'HDFC Bank', defaultOn: false },
  {
    key: 'accountHolderName',
    header: 'Account Holder Name',
    example: 'Anita Sharma',
    defaultOn: false,
  },
  { key: 'accountNumber', header: 'Account Number', example: '50100123456789', defaultOn: false },
  { key: 'ifscCode', header: 'IFSC Code', example: 'HDFC0001234', defaultOn: false },
  { key: 'upiId', header: 'UPI ID', example: 'anita@okhdfc', defaultOn: false },
];

/**
 * Build a starter template CSV containing only the chosen columns, in the
 * canonical TEMPLATE_FIELDS order, with one filled example row. Falls back to
 * the default set when nothing is selected.
 */
export function buildTemplateCsv(selectedKeys?: ImportFieldKey[]): string {
  const set = new Set(selectedKeys ?? TEMPLATE_FIELDS.filter((f) => f.defaultOn).map((f) => f.key));
  const chosen = TEMPLATE_FIELDS.filter((f) => f.required || set.has(f.key));
  const fields = chosen.map((f) => f.header);
  const example = chosen.map((f) => f.example);
  return Papa.unparse({ fields, data: [example] });
}
