/**
 * Connect profile edit - payload schema + money helpers.
 *
 * The edit form collects rupees and `dayjs` dates; the API wants integer
 * paise and ISO strings. These helpers + the zod schema form the typed,
 * validated boundary the form parses its payload through before it ever
 * reaches the server action - no unchecked shape crosses into the API layer.
 */

import { z } from 'zod';

/** Rupees (form input) → integer paise (API), or `undefined` when unset / ≤ 0. */
export function rupeesToPaise(rupees?: number | null): number | undefined {
  if (rupees == null || !Number.isFinite(rupees) || rupees <= 0) return undefined;
  return Math.round(rupees * 100);
}

/** Integer paise (API) → rupees (form input), or `undefined` when unset. */
export function paiseToRupees(paise?: number | null): number | undefined {
  if (paise == null || !Number.isFinite(paise)) return undefined;
  return Math.round(paise) / 100;
}

const ratePaise = z.number().int().min(0).optional();

// Rich per-intent "open to" details (mirrors backend ConnectOpenToDetail).
// Links the profile edit form to the openTo booleans: detail is a short
// (<=160 char) free-text, audience gates who sees it. Keep the 160 cap and
// the audience enum in lockstep with the BE schema.
const openToDetailSchema = z.object({
  detail: z.string().trim().max(160).optional(),
  audience: z.enum(['all', 'network']).default('all'),
});
const openToDetailsSchema = z
  .object({
    work: openToDetailSchema.optional(),
    hiring: openToDetailSchema.optional(),
    deals: openToDetailSchema.optional(),
    customOrders: openToDetailSchema.optional(),
  })
  .optional();

/**
 * Canonical shape of a Connect profile update - mirrors the backend
 * `UpdateConnectProfileDto`. **All fields are optional** - the PATCH is
 * partial, the backend `UpdateConnectProfileInput` is partial, and the
 * per-section edit modals (`EditSectionModal`) send only the section's
 * fields. Per-field validators (length caps, enum membership) still
 * apply when a field is present. Earlier this schema required every key
 * because the old all-in-one `ProfileEditForm` re-sent the whole profile
 * on every save; that form is gone.
 */
export const connectProfileUpdateSchema = z
  .object({
    headline: z.string().max(160),
    bio: z.string().max(2000),
    banner: z.string(),
    skills: z.array(z.string().trim().min(1).max(60)),
    district: z.string().max(80),
    // Structured canonical location (additive; optional so per-section saves that
    // omit it still validate). Slugs from the india-geo dataset + optional city.
    geoStateSlug: z.string().max(60).optional(),
    geoDistrictSlug: z.string().max(80).optional(),
    geoCity: z.string().max(80).optional(),
    contactPreference: z.enum(['whatsapp', 'phone', 'dm']),
    visibility: z.enum(['public', 'connections', 'hidden']),
    // Broker / dalal self-declaration (Broker badge, Slice 1). A simple boolean
    // toggle carried by the header/about edit section; the BE stamps `brokerSince`
    // on the first false→true flip (not sent here). Mirrors the BE
    // UpdateConnectProfileDto `isBroker`. `.partial()` below makes it optional.
    isBroker: z.boolean(),
    openTo: z
      .object({
        work: z.boolean(),
        hiring: z.boolean(),
        deals: z.boolean(),
        customOrders: z.boolean(),
      })
      // `work` and `hiring` are mutually exclusive - a profile cannot advertise
      // "looking for work" and "hiring" at the same time (opposite sides of the
      // labour market). The editor flips one off when the other turns on; this
      // is the validation backstop so a both-on payload can never be saved.
      .refine((o) => !(o.work && o.hiring), {
        message: 'open_to_work_hiring_exclusive',
        path: ['hiring'],
      }),
    openToDetails: openToDetailsSchema,
    rateCard: z.object({
      dailyWage: ratePaise,
      pieceRate: ratePaise,
      monthly: ratePaise,
    }),
    portfolio: z.array(
      z.object({
        image: z.string().min(1),
        caption: z.string().max(280).optional(),
        machineType: z.string().max(80).optional(),
        workType: z.string().max(80).optional(),
      }),
    ),
    // Services I provide - free-typed list (mirrors backend ServiceItemDto).
    // Each item: a required title (<=120) + an optional one-line note (<=160).
    services: z.array(
      z.object({
        title: z.string().trim().min(1).max(120),
        note: z.string().max(160).optional(),
      }),
    ),
    // Intro video - at most one clip (mirrors backend profile `videos`, max 1).
    // Only `url` + optional `posterUrl` cross the boundary; the backend derives
    // `durationSec` and ownership-checks both URLs. Keep the max(1) in lockstep
    // with the MediaUploadGrid `max={1}` cap in EditSectionModal and the BE DTO.
    videos: z
      .array(
        z.object({
          url: z.string().min(1),
          posterUrl: z.string().optional(),
        }),
      )
      .max(1),
    experience: z.array(
      z.object({
        workshop: z.string().trim().min(1).max(160),
        role: z.string().max(120).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        description: z.string().max(1000).optional(),
        // Optional link to a ManekHR CompanyPage (company-pages module). Set when
        // the owner picks a platform company from the AutoComplete; left unset for
        // a free-typed company name. Kept so the value survives the schema parse
        // into the PATCH payload (otherwise zod strips the unknown key).
        companyPageId: z.string().optional().nullable(),
      }),
    ),
    // Training / course credentials (self-declared) - mirrors the experience block
    // above (and the BE ConnectTrainingItem). `instituteName` is the required
    // free-text display name; `companyPageId` optionally links an institute
    // CompanyPage (kind='institute', company-pages module) so the read can show
    // its logo + link; `certificateUrl` is a self-supplied https URL. No
    // verification this phase - rendered plainly in ProfileView's Training list.
    training: z.array(
      z.object({
        // Stable server-assigned id, round-tripped so editing an existing entry
        // preserves it (new rows omit it; the server assigns one). Optional +
        // survive-the-parse, same reason as companyPageId below.
        id: z.string().optional(),
        instituteName: z.string().trim().min(1).max(160),
        course: z.string().max(120).optional(),
        completedAt: z.string().optional(),
        certificateUrl: z.string().url().optional(),
        // Same survive-the-parse reason as experience.companyPageId above.
        companyPageId: z.string().optional().nullable(),
        // Confirmation request lifecycle (Phase 2). The student may only ever
        // SEND 'self' (self-declared, default) or 'pending' (asked the linked
        // institute to confirm). 'confirmed'/'declined' are institute-owner
        // states the BE rejects from the student, so they are NOT in this enum.
        confirmStatus: z.enum(['self', 'pending']).optional(),
        // Per-credential DPDP opt-in to the institute's public alumni/placements
        // page (default OFF in the editor). Mirrors the BE shareWithInstitute.
        shareWithInstitute: z.boolean().optional(),
      }),
    ),
  })
  .partial();

export type ConnectProfileUpdate = z.infer<typeof connectProfileUpdateSchema>;
