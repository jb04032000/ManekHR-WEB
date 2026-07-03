import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { saveDraft, loadDraft, listDrafts, deleteDraft } from './draftStore.js';

describe('draftStore', () => {
  it('saveDraft + loadDraft round-trip preserves the record', async () => {
    const rec = await saveDraft({
      key: 'test-roundtrip',
      workspaceId: 'w1',
      firmId: 'f1',
      voucherType: 'sale_invoice',
      draftId: 'd1',
      data: { foo: 'bar', amount: 999 },
    });
    assert.equal(rec.workspaceId, 'w1');
    assert.equal(rec.firmId, 'f1');
    assert.equal(rec.voucherType, 'sale_invoice');
    assert.equal(rec.draftId, 'd1');
    assert.deepEqual(rec.data, { foo: 'bar', amount: 999 });

    const loaded = await loadDraft('test-roundtrip');
    assert.ok(loaded, 'expected record to exist');
    assert.deepEqual(loaded.data, { foo: 'bar', amount: 999 });
    assert.equal(loaded.workspaceId, 'w1');
  });

  it('loadDraft of unknown key returns undefined', async () => {
    const r = await loadDraft('nonexistent-key-xyz');
    assert.equal(r, undefined);
  });

  it('listDrafts(prefix) returns only records whose key starts with prefix', async () => {
    await saveDraft({ key: 'finance_draft_w1_f1_si_1', workspaceId: 'w1', firmId: 'f1', voucherType: 'sale_invoice', draftId: '1', data: {} });
    await saveDraft({ key: 'finance_draft_w2_f1_qt_2', workspaceId: 'w2', firmId: 'f1', voucherType: 'quotation', draftId: '2', data: {} });
    await saveDraft({ key: 'finance_draft_w1_f1_qt_3', workspaceId: 'w1', firmId: 'f1', voucherType: 'quotation', draftId: '3', data: {} });

    const w1Records = await listDrafts('finance_draft_w1');
    assert.ok(w1Records.length >= 2, `expected >= 2 w1 records, got ${w1Records.length}`);
    assert.ok(w1Records.every(r => r.key.startsWith('finance_draft_w1')), 'all records should have w1 prefix');

    const w2Records = await listDrafts('finance_draft_w2');
    assert.ok(w2Records.length >= 1, `expected >= 1 w2 record, got ${w2Records.length}`);
  });

  it('deleteDraft removes the record', async () => {
    await saveDraft({ key: 'to-delete', workspaceId: 'w1', firmId: 'f1', voucherType: 'quotation', draftId: 'del1', data: { x: 1 } });
    const before = await loadDraft('to-delete');
    assert.ok(before, 'record should exist before delete');

    await deleteDraft('to-delete');
    const after = await loadDraft('to-delete');
    assert.equal(after, undefined);
  });

  it('saveDraft sets updatedAt to a timestamp >= test start time', async () => {
    const start = Date.now();
    const rec = await saveDraft({ key: 'ts-check', workspaceId: 'w', firmId: 'f', voucherType: 'v', draftId: 'd', data: {} });
    assert.ok(typeof rec.updatedAt === 'number', 'updatedAt should be a number');
    assert.ok(rec.updatedAt >= start, `updatedAt ${rec.updatedAt} should be >= start ${start}`);
  });
});
