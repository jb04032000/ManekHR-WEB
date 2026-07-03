/**
 * Wave 8 - client-side mirror of `manekhr-backend/src/modules/sms/utils/sms-segments.util.ts`.
 *
 * Powers the live "credits per send" counter in template editors. Keep in
 * lockstep with the BE util - drift = mis-billing visible to customers.
 *
 * Two encodings:
 *   - GSM-7  (default-Latin Alphabet) → 160 chars / 1 segment, 153/seg if multi
 *   - UCS-2  (Hindi, emoji, any non-GSM char) → 70 chars / 1 segment, 67/seg if multi
 *
 * Extension chars (`{`, `}`, `[`, `]`, `~`, `|`, `^`, `\`, `€`, form-feed)
 * occupy 2 GSM-7 code points each. Any character outside the GSM-7 alphabet
 * forces the entire message to UCS-2.
 */

const GSM7_BASIC = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'.split(
    '',
  ),
);

const GSM7_EXTENSION = new Set('{}[]~|^\\€\f'.split(''));

export type SmsEncoding = 'GSM7' | 'UCS2';

export interface SegmentInfo {
  segments: number;
  encoding: SmsEncoding;
  charCount: number;
}

export function computeSegments(text: string | undefined | null): SegmentInfo {
  const body = text ?? '';
  if (body.length === 0) {
    return { segments: 1, encoding: 'GSM7', charCount: 0 };
  }

  let isGsm7 = true;
  let gsmCharCount = 0;
  for (const ch of body) {
    if (GSM7_BASIC.has(ch)) {
      gsmCharCount += 1;
    } else if (GSM7_EXTENSION.has(ch)) {
      gsmCharCount += 2;
    } else {
      isGsm7 = false;
      break;
    }
  }

  if (isGsm7) {
    if (gsmCharCount <= 160) {
      return { segments: 1, encoding: 'GSM7', charCount: gsmCharCount };
    }
    return {
      segments: Math.ceil(gsmCharCount / 153),
      encoding: 'GSM7',
      charCount: gsmCharCount,
    };
  }

  const ucsLen = body.length;
  if (ucsLen <= 70) {
    return { segments: 1, encoding: 'UCS2', charCount: ucsLen };
  }
  return {
    segments: Math.ceil(ucsLen / 67),
    encoding: 'UCS2',
    charCount: ucsLen,
  };
}
