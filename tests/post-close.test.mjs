import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCash, parseInstitutions, parseFutures, parseQuote, collectPostClose, urls } from '../scripts/post-close-source.mjs';
const fixture = JSON.parse(await readFile(new URL('./fixtures/post-close.json', import.meta.url), 'utf8'));
const date = '2026-10-06';
test('cash uses dated market close and exact turnover in TWD, excluding future rows', () => {
  const raw = structuredClone(fixture.cash); raw.data.push(['115/10/07', '1', '1', '1', '99999', '1']);
  const r = parseCash(raw, date); assert.equal(r.date, date); assert.equal(r.close, 49822.55); assert.equal(r.turnover, 1021722793978);
  assert.ok(Math.abs(r.changePct - 110.51 / 49712.04 * 100) < 1e-9);
});
test('institutional totals sum dealer own trading and hedging; exclude duplicate foreign dealer', () => {
  const r = parseInstitutions(fixture.institutions, date); assert.equal(r.dealer, 1721212199); assert.equal(r.total, r.foreign + r.trust + r.dealer);
  assert.throws(() => parseInstitutions(fixture.institutions, '2026-10-05'), /日期/);
  const broken = structuredClone(fixture.institutions); broken.data.at(-1)[3] = '0'; assert.throws(() => parseInstitutions(broken, date), /加總/);
});
test('TX positioning parses rowspan identities, preserves signed contracts, ignores subtotal', () => {
  const r = parseFutures(fixture.futures, date); assert.deepEqual(r.rows.foreign, { tradingNet: -2479, openInterestNet: -79517 });
  assert.equal(r.rows.trust.openInterestNet, 76208);
  assert.throws(() => parseFutures(fixture.futures.replace('-2,479', '-2,480'), date), /淨額/);
  assert.throws(() => parseFutures(fixture.futures, '2026-10-05'), /日期/);
  assert.throws(() => parseFutures('<input name="queryDate" value="2026/10/06"><p>查無資料</p>', date), /尚未公布/);
});
test('near month price excludes spreads, weekly contracts and night reports', () => {
  const r = parseQuote(fixture.quote, date); assert.equal(r.contract, '202610'); assert.equal(r.close, 50060); assert.equal(r.change, 116);
  assert.throws(() => parseQuote(fixture.quote.replace('一般交易時段行情表', '盤後交易時段行情表'), date), /日盤/);
});
test('refresh acquires all official sources and does not mix unavailable dates', async () => {
  const previous = { date: '2026-10-05', futures: { date: '2026-10-05', status: 'ok', rows: { foreign: { tradingNet: 3295, openInterestNet: -77004 } } } };
  const source = urls(date); let calls = 0;
  const report = await collectPostClose(previous, new Date('2026-10-06T09:00:00Z'), async url => {
    calls++; if (url === source.futures) throw Error('來源尚未公布');
    return { ok: true, json: async () => url === source.cash ? fixture.cash : fixture.institutions, text: async () => fixture.quote };
  });
  assert.equal(calls, 4); assert.equal(report.date, date); assert.equal(report.cash.status, 'ok');
  assert.equal(report.futures.date, '2026-10-05'); assert.equal(report.futures.status, 'stale'); assert.equal(report.complete, false);
});
test('before 13:30 no official acquisition; previous snapshot remains intact', async () => {
  const previous = { date: '2026-10-05', cash: { date: '2026-10-05', close: 49712.04 } };
  const result = await collectPostClose(previous, new Date('2026-10-06T05:29:00Z'), () => assert.fail('must not fetch before close'));
  assert.equal(result.cash.close, 49712.04); assert.match(result.message, /13:30/);
});
test('holiday at month start uses last prior trading day and requests institutions for that day', async () => {
  const prior = structuredClone(fixture.cash); prior.data = [fixture.cash.data.at(-1)];
  const inst = structuredClone(fixture.institutions); const target = '2026-11-01'; const requested = [];
  const result = await collectPostClose(null, new Date('2026-11-01T09:00:00Z'), async url => {
    requested.push(url);
    if (url === urls(target).cash) return { ok: true, json: async () => ({ stat: '沒有符合條件的資料', data: [] }) };
    if (url.includes('FMTQIK')) return { ok: true, json: async () => prior };
    return { ok: true, json: async () => inst, text: async () => url.includes('futContracts') ? fixture.futures : fixture.quote };
  });
  assert.equal(result.date, date); assert.ok(requested.includes(urls(date).futures)); assert.match(result.message, /最近交易日/);
});
