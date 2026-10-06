const assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
const nodes = new Map();
function node(id) { if (!nodes.has(id)) nodes.set(id, { hidden: false, textContent: '', innerHTML: '', disabled: false, events: {}, attrs: {}, classList: { toggle() {} }, setAttribute(k,v) { this.attrs[k]=v; }, addEventListener(k,fn) { this.events[k]=fn; } }); return nodes.get(id); }
const snapshot = JSON.parse(fs.readFileSync(__dirname + '/../data/post-close.json', 'utf8'));
let failure = false, calls = [], report = snapshot.reports[0];
const sandbox = { document: { getElementById: node }, Intl, Date, Number, AbortSignal, fetch: async (url, options = {}) => {
  calls.push({url,options}); if (failure) throw Error('網路中斷');
  return { ok: true, json: async () => url.startsWith('data/') ? snapshot : { report, refreshed: options.method === 'POST', message: '已取得官方資料' } };
} };
vm.runInNewContext(fs.readFileSync(__dirname + '/../morning.js', 'utf8'), sandbox);
vm.runInNewContext(fs.readFileSync(__dirname + '/../post-close.js', 'utf8'), sandbox);
(async () => {
  node('tab-post-close').events.click(); await new Promise(setImmediate);
  assert.equal(node('post-close-view').hidden, false); assert.equal(node('close-view').hidden, true); assert.equal(node('morning-view').hidden, true);
  assert.match(node('post-close-cards').innerHTML, /現貨買賣超/); assert.match(node('post-close-cards').innerHTML, /未平倉淨額/);
  await node('post-close-refresh').events.click(); assert.equal(calls.at(-1).options.method, 'POST');
  assert.equal(node('post-close-refresh').disabled, false);
  const before = node('post-close-cards').innerHTML; failure = true; await node('post-close-refresh').events.click();
  assert.equal(node('post-close-cards').innerHTML, before); assert.match(node('post-close-notice').textContent, /保留目前/);
  failure = false;
  node('tab-bulletin').events.click(); await new Promise(setImmediate);
  assert.equal(node('bulletin-view').hidden, false); assert.equal(node('post-close-view').hidden, true);
  assert.match(node('bulletin-rows').innerHTML, /成交金額（億）/); assert.match(node('bulletin-rows').innerHTML, /rowspan="3"/);
  assert.equal(node('bulletin-analysis').textContent, node('post-close-analysis').textContent);
  await node('bulletin-refresh').events.click(); assert.equal(calls.at(-1).options.method, 'POST');
  report = { date: report.date, checkedAt: report.checkedAt, complete: false };
  await node('bulletin-refresh').events.click(); assert.match(node('bulletin-rows').innerHTML, /—/); assert.doesNotMatch(node('bulletin-rows').innerHTML, />0\.00</);
  node('tab-morning').events.click(); assert.equal(node('bulletin-view').hidden, true); assert.equal(node('post-close-view').hidden, true); assert.equal(node('morning-view').hidden, false);
  node('tab-close').events.click(); assert.equal(node('post-close-view').hidden, true); assert.equal(node('close-view').hidden, false);
  assert.equal(node('tab-post-close').attrs['aria-pressed'], 'false');
  console.log('PASS: tabs, institutional amounts, live POST refresh, and failure preservation');
})();
