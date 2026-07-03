import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeTaxClient } from './taxComputeClient';
import type { TaxComputeInput, TaxComputeResult } from './taxComputeClient';
import type { AdditionalCharge, LineItem } from '@/types';

/** Helper: minimal intra-state single-line input */
function makeInput(overrides: Partial<TaxComputeInput> = {}): TaxComputeInput {
  return {
    lines: [],
    additionalCharges: [],
    firmStateCode: '24',
    partyStateCode: '24',
    placeOfSupplyStateCode: '24',
    roundingPolicy: 'half_up',
    ...overrides,
  };
}

function makeLine(overrides: Partial<LineItem> = {}): LineItem {
  return {
    itemId: 'item-001',
    itemName: 'Test Item',
    qty: 1,
    unit: 'pcs',
    ratePaise: 10000,
    discountPct: 0,
    taxRate: 18,
    cessRate: 0,
    isTaxInclusive: false,
    ...overrides,
  };
}

describe('computeTaxClient', () => {
  it('intra-state single line: CGST and SGST are equal halves (18%)', () => {
    // 100 units x Rs100 = Rs10,000 taxable
    // CGST 9% = Rs900; SGST 9% = Rs900; grand = Rs11,800
    const result = computeTaxClient(
      makeInput({
        lines: [makeLine({ itemName: 'Widget', qty: 100, ratePaise: 10000, taxRate: 18 })],
      }),
    );
    assert.equal(result.taxableValuePaise, 1000000); // 100 x 10000 = 1,000,000 paise
    assert.equal(result.cgstPaise, 90000); // 9% of 1,000,000
    assert.equal(result.sgstPaise, 90000); // 9%
    assert.equal(result.igstPaise, 0);
    assert.equal(result.grandTotalPaise, 1180000); // 1,000,000 + 90,000 + 90,000
  });

  it('inter-state single line: IGST equals full GST (18%), CGST/SGST = 0', () => {
    const result = computeTaxClient(
      makeInput({
        partyStateCode: '27',
        placeOfSupplyStateCode: '27',
        lines: [makeLine({ qty: 100, ratePaise: 10000, taxRate: 18 })],
      }),
    );
    assert.equal(result.igstPaise, 180000); // 18% of 1,000,000
    assert.equal(result.cgstPaise, 0);
    assert.equal(result.sgstPaise, 0);
    assert.equal(result.grandTotalPaise, 1180000);
  });

  it('tax-inclusive line: taxable value back-calculated from gross (18%)', () => {
    // 1 unit x Rs118 inclusive @ 18% -> taxable = Rs100 -> CGST=Rs9 SGST=Rs9
    const result = computeTaxClient(
      makeInput({
        lines: [
          makeLine({
            itemName: 'Inclusive Item',
            qty: 1,
            ratePaise: 11800,
            taxRate: 18,
            isTaxInclusive: true,
          }),
        ],
      }),
    );
    assert.equal(result.taxableValuePaise, 10000); // Rs100
    assert.equal(result.cgstPaise, 900); // Rs9
    assert.equal(result.sgstPaise, 900); // Rs9
    assert.equal(result.grandTotalPaise, 11800);
  });

  it('tax-exclusive line with discount % (discount before tax)', () => {
    // 2 units x Rs100 with discountPct=10 -> lineGross = 18000; taxable = 18000
    const result = computeTaxClient(
      makeInput({
        lines: [
          makeLine({
            itemName: 'Widget',
            qty: 2,
            ratePaise: 10000,
            discountPct: 10,
            taxRate: 0,
            cessRate: 0,
          }),
        ],
      }),
    );
    assert.equal(result.taxableValuePaise, 18000);
    assert.equal(result.totalDiscountPaise, 2000); // 10% of 20000
  });

  it('tax-exclusive line with flat discount (discountFlatPaise)', () => {
    // 1 unit x Rs100 with discountFlatPaise=1000 (Rs10) -> taxable = 9000 paise
    const result = computeTaxClient(
      makeInput({
        lines: [
          {
            ...makeLine({ ratePaise: 10000, discountPct: 0, taxRate: 0, cessRate: 0 }),
            discountFlatPaise: 1000,
          },
        ],
      }),
    );
    assert.equal(result.taxableValuePaise, 9000);
    assert.equal(result.totalDiscountPaise, 1000);
  });

  it('cess line: cess computed on taxable value (28% + 12% cess)', () => {
    // 1 unit x Rs100 @ 28% + 12% cess
    // taxable = 10000p; cgst = 1400p; sgst = 1400p; cess = 1200p; total = 14000p
    const result = computeTaxClient(
      makeInput({
        lines: [makeLine({ itemName: 'Pan Masala', ratePaise: 10000, taxRate: 28, cessRate: 12 })],
      }),
    );
    assert.equal(result.cessPaise, 1200); // 12% of 10000
    assert.equal(result.cgstPaise, 1400); // 14%
    assert.equal(result.sgstPaise, 1400); // 14%
    assert.equal(result.grandTotalPaise, 14000);
  });

  it('mixed rates: 5% gives CGST 2.5% + SGST 2.5%', () => {
    // 1 unit x Rs100 @ 5% intra -> CGST 250p + SGST 250p
    const result = computeTaxClient(
      makeInput({
        lines: [makeLine({ itemName: 'Staple', ratePaise: 10000, taxRate: 5, cessRate: 0 })],
      }),
    );
    assert.equal(result.cgstPaise, 250); // 2.5% of 10000
    assert.equal(result.sgstPaise, 250);
    assert.equal(result.grandTotalPaise, 10500);
  });

  it('additional charge isTaxable: true - freight contributes GST', () => {
    // 1 line: 1 unit x Rs100 @ 0% tax
    // freight: Rs100 @ 18% taxable
    const result = computeTaxClient(
      makeInput({
        lines: [makeLine({ ratePaise: 10000, taxRate: 0, cessRate: 0 })],
        additionalCharges: [{ label: 'Freight', amountPaise: 10000, isTaxable: true, taxRate: 18 }],
      }),
    );
    // freight CGST = 9% of 10000 = 900; SGST = 900
    assert.equal(result.cgstPaise, 900);
    assert.equal(result.sgstPaise, 900);
    assert.equal(result.additionalChargesPaise, 10000);
    // grand = 10000 (line) + 10000 (freight) + 900 + 900 = 21800
    assert.equal(result.grandTotalPaise, 21800);
  });

  it('additional charge isTaxable: false - added to grand total only, no GST', () => {
    // 1 unit x Rs100 @ 0% + non-taxable packing charge Rs50
    const result = computeTaxClient(
      makeInput({
        lines: [makeLine({ ratePaise: 10000, taxRate: 0, cessRate: 0 })],
        additionalCharges: [{ label: 'Packing', amountPaise: 5000, isTaxable: false }],
      }),
    );
    assert.equal(result.cgstPaise, 0);
    assert.equal(result.sgstPaise, 0);
    assert.equal(result.additionalChargesPaise, 5000);
    assert.equal(result.grandTotalPaise, 15000); // 10000 + 5000
  });

  it('round-off enabled (round_off_to_rupee): paise truncated', () => {
    // 1 unit x Rs123.45 @ 0% = 12345 paise raw; rounded to 12300 -> roundOff = -45
    const result = computeTaxClient(
      makeInput({
        roundingPolicy: 'round_off_to_rupee',
        lines: [makeLine({ ratePaise: 12345, taxRate: 0, cessRate: 0 })],
      }),
    );
    assert.equal(result.roundOffPaise, -45);
    assert.equal(result.grandTotalPaise, 12300);
  });

  it('TCS pass-through: tcsPaise included in grandTotal', () => {
    const result = computeTaxClient(
      makeInput({
        tcsPaise: 5000,
        lines: [makeLine({ ratePaise: 100000, taxRate: 0, cessRate: 0 })], // Rs1000
      }),
    );
    assert.equal(result.tcsPaise, 5000);
    assert.equal(result.grandTotalPaise, 105000); // 100000 + 5000
  });
});

// ── PREVIEW == POSTED PARITY CONTRACT ───────────────────────────────────────
// These canonical vectors lock the web preview engine (computeTaxClient) to the
// backend posting engine (TaxComputationService.compute). The exact same
// PARITY_VECTORS array + expected numbers MUST exist in:
//   crewroster-backend/src/modules/finance/sales/tax-computation/__tests__/tax-computation.vitest.ts
// If you change either tax engine, update BOTH so the byte-for-byte "what you
// preview is what posts" promise stays enforced. Any drift fails one side here.
type ParityVector = {
  name: string;
  lines: Partial<LineItem>[];
  charges?: AdditionalCharge[];
  firmStateCode: string;
  placeOfSupplyStateCode: string;
  roundingPolicy?: 'half_up' | 'round_off_to_rupee';
  tcsPaise?: number;
  expect: Partial<TaxComputeResult>;
};

const PARITY_VECTORS: ParityVector[] = [
  {
    name: 'intra 18% (qty100 x Rs100) -> CGST=SGST=90000',
    lines: [{ qty: 100, ratePaise: 10000, taxRate: 18 }],
    firmStateCode: '24',
    placeOfSupplyStateCode: '24',
    expect: {
      taxableValuePaise: 1000000,
      cgstPaise: 90000,
      sgstPaise: 90000,
      igstPaise: 0,
      grandTotalPaise: 1180000,
    },
  },
  {
    name: 'inter 18% (qty100 x Rs100) -> IGST=180000',
    lines: [{ qty: 100, ratePaise: 10000, taxRate: 18 }],
    firmStateCode: '24',
    placeOfSupplyStateCode: '27',
    expect: { cgstPaise: 0, sgstPaise: 0, igstPaise: 180000, grandTotalPaise: 1180000 },
  },
  {
    name: 'intra 5% (Rs100) -> half = 2.5%',
    lines: [{ qty: 1, ratePaise: 10000, taxRate: 5 }],
    firmStateCode: '24',
    placeOfSupplyStateCode: '24',
    expect: { cgstPaise: 250, sgstPaise: 250, grandTotalPaise: 10500 },
  },
  {
    name: 'intra 28% + 12% cess (Rs100)',
    lines: [{ qty: 1, ratePaise: 10000, taxRate: 28, cessRate: 12 }],
    firmStateCode: '24',
    placeOfSupplyStateCode: '24',
    expect: { cgstPaise: 1400, sgstPaise: 1400, cessPaise: 1200, grandTotalPaise: 14000 },
  },
  {
    name: 'inter + taxable freight 18% (line @0%)',
    lines: [{ qty: 1, ratePaise: 10000, taxRate: 0 }],
    charges: [{ label: 'Freight', amountPaise: 10000, isTaxable: true, taxRate: 18 }],
    firmStateCode: '24',
    placeOfSupplyStateCode: '27',
    expect: {
      igstPaise: 1800,
      taxableValuePaise: 20000,
      additionalChargesPaise: 10000,
      grandTotalPaise: 21800,
    },
  },
  {
    name: 'round_off_to_rupee (Rs123.45 @0%) -> -45',
    lines: [{ qty: 1, ratePaise: 12345, taxRate: 0 }],
    firmStateCode: '24',
    placeOfSupplyStateCode: '24',
    roundingPolicy: 'round_off_to_rupee',
    expect: { roundOffPaise: -45, grandTotalPaise: 12300 },
  },
  {
    name: 'tax-inclusive 18% (Rs118 incl) -> taxable Rs100',
    lines: [{ qty: 1, ratePaise: 11800, taxRate: 18, isTaxInclusive: true }],
    firmStateCode: '24',
    placeOfSupplyStateCode: '24',
    expect: { taxableValuePaise: 10000, cgstPaise: 900, sgstPaise: 900, grandTotalPaise: 11800 },
  },
];

describe('computeTaxClient - parity contract (must match backend TaxComputationService)', () => {
  for (const v of PARITY_VECTORS) {
    it(v.name, () => {
      const result = computeTaxClient(
        makeInput({
          lines: v.lines.map((l) => makeLine(l)),
          additionalCharges: v.charges ?? [],
          firmStateCode: v.firmStateCode,
          partyStateCode: v.placeOfSupplyStateCode,
          placeOfSupplyStateCode: v.placeOfSupplyStateCode,
          roundingPolicy: v.roundingPolicy ?? 'half_up',
          tcsPaise: v.tcsPaise,
        }),
      );
      for (const [key, want] of Object.entries(v.expect)) {
        assert.equal(
          (result as unknown as Record<string, number>)[key],
          want,
          `${v.name}: ${key} expected ${want}, got ${(result as unknown as Record<string, number>)[key]}`,
        );
      }
      // Reconciliation invariant: taxable + all-tax + tcs + round-off == grand total.
      // Holds for every parity vector because none carries a NON-taxable charge
      // (taxable charges are already folded into taxableValuePaise by the engine).
      assert.equal(
        result.taxableValuePaise +
          result.cgstPaise +
          result.sgstPaise +
          result.igstPaise +
          result.cessPaise +
          result.tcsPaise +
          result.roundOffPaise,
        result.grandTotalPaise,
        `${v.name}: breakdown does not reconcile to grand total`,
      );
    });
  }
});
