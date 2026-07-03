/**
 * boost-targeting.ts - curated vocabulary for Boost Post audience targeting.
 *
 * Values sent to the API must match the string enum / free-text stored on
 * ConnectProfile fields. Do not rename these without a backend migration.
 */

import type { ConnectOnboardingIntent } from '../profile.types';

/**
 * The four Connect persona roles available as targeting dimensions.
 * Values mirror ConnectOnboardingIntent and are sent verbatim to the API
 * in targeting.roles[].
 */
export const BOOST_ROLES: readonly ConnectOnboardingIntent[] = [
  'workshop_owner',
  'karigar',
  'buyer',
  'explorer',
];

/**
 * Curated Gujarat textile hub districts.
 *
 * The VALUE sent to the API is the city name string - it must match the
 * free-text `district` stored on ConnectProfile (a clean city name like
 * "Surat"). Labels in en/gu-en/hi-en use the city name as-is; native
 * Gujarati script labels are in gu.json under connect.ads.boost.audience.districts.*.
 */
export const BOOST_DISTRICTS = [
  'Surat',
  'Ahmedabad',
  'Rajkot',
  'Vadodara',
  'Bhavnagar',
  'Jamnagar',
  'Gandhinagar',
  'Bharuch',
  'Navsari',
  'Valsad',
  'Morbi',
  'Anand',
] as const;

export type BoostDistrict = (typeof BOOST_DISTRICTS)[number];

/**
 * Curated textile trade sectors.
 *
 * The VALUE sent to the API is the label string itself (e.g. "Weaving").
 *
 * Matching: the backend normalises both sides (trim + lowercase) and matches a
 * member if ANY of their free-text `skills` equals a selected sector,
 * case-insensitively (backend ads/lib/targeting-normalize + matchesTargeting +
 * the audience counter all share it, so the estimate equals real delivery).
 * Display-case values here are fine; the live audience estimate endpoint returns
 * the actual reachable count.
 *
 * companySize is intentionally NOT offered as a targeting dimension because
 * the backend never populates companySize on ConnectProfile.
 */
export const BOOST_SECTORS = [
  'Weaving',
  'Spinning',
  'Dyeing',
  'Printing',
  'Embroidery',
  'Stitching',
  'Trading',
  'Job Work',
  'Design',
  'Machinery',
] as const;

export type BoostSector = (typeof BOOST_SECTORS)[number];
