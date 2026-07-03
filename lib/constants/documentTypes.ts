import type { TeamMemberDocumentType } from '@/types';

export type DocumentCategory = 'identity' | 'employment' | 'banking' | 'other';

export interface DocTypeMeta {
  label: string;
  icon: string;
  category: DocumentCategory;
  instruction: string;
  shortHint: string;
  acceptedTypes: string[];
  acceptedTypesHint: string;
  maxSizeMb: number;
  isRequiredForPayroll?: boolean;
  isRecommendedForPayroll?: boolean;
  allowMultiple?: boolean;
  requiresLabel?: boolean;
}

const IMG_PDF = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const IMG_PDF_HINT = 'JPG, PNG, WEBP or PDF';
const PDF_ONLY = ['application/pdf'];
const PDF_ONLY_HINT = 'PDF';

export const DOC_TYPE_META: Record<TeamMemberDocumentType, DocTypeMeta> = {
  aadhaar: {
    label: 'Aadhaar Card',
    icon: 'IdcardOutlined',
    category: 'identity',
    instruction:
      'Upload **both front and back sides** in a single image or PDF. All 12 digits, name, and photo must be clearly readable.',
    shortHint: 'Both sides in one file',
    acceptedTypes: IMG_PDF,
    acceptedTypesHint: IMG_PDF_HINT,
    maxSizeMb: 10,
    isRecommendedForPayroll: true,
  },
  pan: {
    label: 'PAN Card',
    icon: 'IdcardOutlined',
    category: 'identity',
    instruction:
      'Upload the **front of the PAN card**. PAN number, name, and photo must be clearly visible.',
    shortHint: 'Front side only',
    acceptedTypes: IMG_PDF,
    acceptedTypesHint: IMG_PDF_HINT,
    maxSizeMb: 10,
    isRequiredForPayroll: true,
  },
  passport: {
    label: 'Passport',
    icon: 'BookOutlined',
    category: 'identity',
    instruction:
      'Upload the **bio page (photo side) and address page** in a single PDF. Photo, number, and expiry must be readable.',
    shortHint: 'Bio + address page in one PDF',
    acceptedTypes: IMG_PDF,
    acceptedTypesHint: IMG_PDF_HINT,
    maxSizeMb: 10,
  },
  driving_license: {
    label: 'Driving License',
    icon: 'CarOutlined',
    category: 'identity',
    instruction:
      'Upload **both front and back sides** in a single image or PDF. License number and validity must be visible.',
    shortHint: 'Both sides in one file',
    acceptedTypes: IMG_PDF,
    acceptedTypesHint: IMG_PDF_HINT,
    maxSizeMb: 10,
  },
  voter_id: {
    label: 'Voter ID',
    icon: 'IdcardOutlined',
    category: 'identity',
    instruction:
      'Upload **both front and back sides** in a single image or PDF. Name and EPIC number must be readable.',
    shortHint: 'Both sides in one file',
    acceptedTypes: IMG_PDF,
    acceptedTypesHint: IMG_PDF_HINT,
    maxSizeMb: 10,
  },
  offer_letter: {
    label: 'Offer Letter',
    icon: 'FileTextOutlined',
    category: 'employment',
    instruction: 'Upload the **full signed offer letter** as a PDF. Include all pages.',
    shortHint: 'Full signed PDF',
    acceptedTypes: PDF_ONLY,
    acceptedTypesHint: PDF_ONLY_HINT,
    maxSizeMb: 10,
  },
  appointment_letter: {
    label: 'Appointment Letter',
    icon: 'FileTextOutlined',
    category: 'employment',
    instruction: 'Upload the **full signed appointment letter** as a PDF. Include signature page.',
    shortHint: 'Full signed PDF',
    acceptedTypes: PDF_ONLY,
    acceptedTypesHint: PDF_ONLY_HINT,
    maxSizeMb: 10,
  },
  education: {
    label: 'Education Certificate',
    icon: 'ReadOutlined',
    category: 'employment',
    instruction:
      'Upload the **highest qualification certificate**. Combine marksheets into one PDF if multiple pages.',
    shortHint: 'Highest qualification',
    acceptedTypes: IMG_PDF,
    acceptedTypesHint: IMG_PDF_HINT,
    maxSizeMb: 10,
  },
  experience: {
    label: 'Experience Letter',
    icon: 'SolutionOutlined',
    category: 'employment',
    instruction:
      'Upload **relieving letter or experience certificate** from previous employer. PDF preferred.',
    shortHint: 'Relieving / experience letter',
    acceptedTypes: IMG_PDF,
    acceptedTypesHint: IMG_PDF_HINT,
    maxSizeMb: 10,
  },
  passbook: {
    label: 'Bank Passbook / Cancelled Cheque',
    icon: 'BankOutlined',
    category: 'banking',
    instruction:
      'Upload **first page of passbook** or a **cancelled cheque**. Account number, IFSC, and account holder name must be clearly visible.',
    shortHint: 'Passbook page or cancelled cheque',
    acceptedTypes: IMG_PDF,
    acceptedTypesHint: IMG_PDF_HINT,
    maxSizeMb: 10,
    isRecommendedForPayroll: true,
  },
  other: {
    label: 'Other Document',
    icon: 'PaperClipOutlined',
    category: 'other',
    instruction: 'Enter a clear label (e.g. Medical Certificate, NDA). Upload image or PDF.',
    shortHint: 'Label required',
    acceptedTypes: IMG_PDF,
    acceptedTypesHint: IMG_PDF_HINT,
    maxSizeMb: 10,
    allowMultiple: true,
    requiresLabel: true,
  },
};

export const ORDERED_TYPES: TeamMemberDocumentType[] = [
  'aadhaar',
  'pan',
  'passport',
  'driving_license',
  'voter_id',
  'offer_letter',
  'appointment_letter',
  'education',
  'experience',
  'passbook',
  'other',
];

export const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  identity: 'Identity Proof',
  employment: 'Employment',
  banking: 'Banking',
  other: 'Other',
};

export const CATEGORY_DESCRIPTION: Record<DocumentCategory, string> = {
  identity: 'Government-issued IDs used for KYC and statutory filings.',
  employment: 'Offer, appointment, education and experience records.',
  banking: 'Bank account proof for salary disbursal.',
  other: 'Anything else - medical, NDA, contracts, etc.',
};

export const CATEGORY_ORDER: DocumentCategory[] = ['identity', 'employment', 'banking', 'other'];

export function getTypesByCategory(category: DocumentCategory): TeamMemberDocumentType[] {
  return ORDERED_TYPES.filter((t) => DOC_TYPE_META[t].category === category);
}

export function getTypeMeta(type: TeamMemberDocumentType): DocTypeMeta {
  return DOC_TYPE_META[type];
}
