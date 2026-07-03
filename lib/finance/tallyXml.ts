// D19: extract entity rows from a Tally master-export XML (Gateway of Tally -> Export -> Masters).
// Tag names vary a little by Tally version, so we read the common ones and leave anything missing
// blank for the dry-run to flag - worst case the user fixes a column. Used by the import wizards.

const txt = (el: Element, sel: string) => el.querySelector(sel)?.textContent?.trim() ?? '';

// LEDGER masters under "Sundry Debtors" / "Sundry Creditors" -> party rows (customer / vendor).
export function parseTallyLedgers(doc: Document): Record<string, string>[] {
  return Array.from(doc.querySelectorAll('LEDGER'))
    .filter((l) => {
      const parent = txt(l, 'PARENT').toLowerCase();
      return parent.includes('debtor') || parent.includes('creditor');
    })
    .map((l) => {
      const parent = txt(l, 'PARENT').toLowerCase();
      const address = Array.from(l.querySelectorAll('ADDRESS'))
        .map((a) => a.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(', ');
      return {
        name: l.getAttribute('NAME') ?? txt(l, 'NAME'),
        partyType: parent.includes('creditor') ? 'vendor' : 'customer',
        gstin: txt(l, 'PARTYGSTIN') || txt(l, 'GSTIN'),
        state: txt(l, 'LEDSTATENAME'),
        phone: txt(l, 'LEDGERPHONE') || txt(l, 'PHONE'),
        email: txt(l, 'EMAIL'),
        address,
      };
    })
    .filter((r) => r.name);
}

// STOCKITEM masters -> item rows.
export function parseTallyStockItems(doc: Document): Record<string, string>[] {
  return Array.from(doc.querySelectorAll('STOCKITEM'))
    .map((s) => ({
      name: s.getAttribute('NAME') ?? txt(s, 'NAME'),
      itemType: 'goods',
      unit: txt(s, 'BASEUNITS') || 'NOS',
      hsnSacCode: txt(s, 'HSNCODE').replace(/[^0-9]/g, ''),
      // Tally rate may carry a "%" - keep digits only so the importer parses a clean slab.
      gstRate: (txt(s, 'RATEOFTAX') || txt(s, 'GSTRATE')).replace(/[^0-9.]/g, ''),
      category: txt(s, 'CATEGORY') || txt(s, 'PARENT'),
    }))
    .filter((r) => r.name);
}
