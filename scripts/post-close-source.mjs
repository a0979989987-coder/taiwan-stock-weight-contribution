// Shared official-source collector for scheduled snapshots and the public refresh API.
export const clean = value => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
export function numeric(value) {
  const text = clean(value).replace(/,/g, '').replace(/[▲▼%]/g, '').trim();
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) throw Error('官方數值缺漏');
  const n = Number(text); if (!Number.isFinite(n)) throw Error('官方數值無效'); return n;
}
export function clock(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const v = t => p.find(x => x.type === t).value;
  return { date: `${v('year')}-${v('month')}-${v('day')}`, minutes: Number(v('hour')) * 60 + Number(v('minute')) };
}
const isoROC = value => {
  const m = clean(value).match(/^(\d{3})\/(\d{2})\/(\d{2})$/);
  if (!m) throw Error('交易日期無效'); return `${Number(m[1]) + 1911}-${m[2]}-${m[3]}`;
};
export const urls = date => ({
  cash: `https://www.twse.com.tw/exchangeReport/FMTQIK?response=json&date=${date.replaceAll('-', '')}`,
  institutions: `https://www.twse.com.tw/rwd/zh/fund/BFI82U?response=json&type=day&dayDate=${date.replaceAll('-', '')}`,
  futures: 'https://www.taifex.com.tw/cht/3/futContractsDate?' + new URLSearchParams({ queryDate: date.replaceAll('-', '/'), commodityId: 'TXF' }),
  quote: 'https://www.taifex.com.tw/cht/3/futDailyMarketReport?' + new URLSearchParams({ queryDate: date.replaceAll('-', '/'), marketCode: '0', commodity_id: 'TX' })
});
export function parseCash(raw, target) {
  if (raw.stat !== 'OK' || !Array.isArray(raw.data)) throw Error('市場收盤資料尚未公布');
  const field = name => { const i = raw.fields?.indexOf(name); if (!(i >= 0)) throw Error('市場欄位不符'); return i; };
  const row = raw.data.filter(r => isoROC(r[0]) <= target).at(-1);
  if (!row) throw Error('沒有完整交易日');
  const result = { date: isoROC(row[0]), close: numeric(row[field('發行量加權股價指數')]), change: numeric(row[field('漲跌點數')]), turnover: numeric(row[field('成交金額')]) };
  if (result.close <= 0 || result.turnover < 0 || result.close - result.change <= 0) throw Error('市場收盤值無效');
  return { ...result, changePct: result.change / (result.close - result.change) * 100 };
}
export function parseInstitutions(raw, date) {
  if (raw.stat !== 'OK' || raw.date !== date.replaceAll('-', '') || !Array.isArray(raw.data)) throw Error('法人資料日期不符或尚未公布');
  const index = raw.fields?.findIndex(f => /買賣差額/.test(f)); if (!(index >= 0)) throw Error('法人欄位缺漏');
  const get = re => {
    const rows = raw.data.filter(r => re.test(clean(r[0]).replace(/\s/g, '')));
    if (!rows.length) throw Error('法人分類缺漏');
    const values = rows.map(r => numeric(r[index])); if (!values.every(Number.isSafeInteger)) throw Error('法人金額無效');
    return values.reduce((a, b) => a + b, 0);
  };
  const foreign = get(/^外資及陸資\(不含(?:外資)?自營商\)$/), trust = get(/^投信$/), dealer = get(/^自營商\((自行買賣|避險)\)$/), total = get(/^合計$/);
  if (foreign + trust + dealer !== total) throw Error('法人加總不符');
  return { date, foreign, trust, dealer, total };
}
function rows(html) {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(tr => [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => clean(c[1])));
}
function checkDate(html, date) {
  const tags = [...html.matchAll(/<input\b[^>]*>/gi)].map(m => m[0]);
  const tag = tags.find(t => /(?:name|id)\s*=\s*["']queryDate["']/i.test(t));
  const value = tag?.match(/value\s*=\s*["']([^"']+)["']/i)?.[1];
  if (value !== date.replaceAll('-', '/')) throw Error('期交所來源日期不符');
}
export function parseFutures(html, date) {
  checkDate(html, date);
  const result = {}; let product = null;
  for (const r of rows(html)) {
    if (r.includes('臺股期貨')) product = 'TX';
    else if (r.includes('期貨小計') || r.some(c => /期貨$/.test(c))) product = null;
    if (product !== 'TX') continue;
    const i = r.findIndex(c => ['外資', '投信', '自營商'].includes(c)); if (i < 0) continue;
    const values = r.slice(i + 1); if (values.length !== 12) throw Error('期货法人欄位不完整');
    const n = values.map(numeric); if (!n.every(Number.isSafeInteger) || n[0] - n[2] !== n[4] || n[6] - n[8] !== n[10]) throw Error('期貨法人淨額不符');
    const key = { 外資: 'foreign', 投信: 'trust', 自營商: 'dealer' }[r[i]];
    if (result[key]) throw Error('期貨法人分類重複');
    result[key] = { tradingNet: n[4], openInterestNet: n[10] };
    if (Object.keys(result).length === 3) break; // Ignore the repeated futures subtotal below the TX rows.
  }
  if (Object.keys(result).length !== 3) throw Error('台指期三大法人尚未公布');
  return { date, product: 'TX', rows: result };
}
export function parseQuote(html, date) {
  checkDate(html, date);
  if (!/一般交易時段行情表/.test(clean(html))) throw Error('台指期日盤尚未公布');
  const row = rows(html).filter(r => r[0] === 'TX' && /^\d{6}$/.test(r[1]) && r.length >= 12).sort((a, b) => a[1].localeCompare(b[1]))[0];
  if (!row) throw Error('台指近月日盤資料缺漏');
  const result = { date, contract: row[1], close: numeric(row[5]), change: numeric(row[6]), changePct: numeric(row[7]) };
  if (result.close <= 0) throw Error('台指近月收盤值無效'); return result;
}
export async function collectPostClose(previous = null, now = new Date(), fetcher = fetch) {
  const { date, minutes } = clock(now), collectedAt = now.toISOString();
  if (minutes < 810) return { ...(previous || { date, cash: null, institutions: null, futures: null, quote: null }), checkedAt: collectedAt, message: '台北時間 13:30 後才抓取盤後資料，保留最近結果。' };
  const read = async (url, type) => {
    const r = await fetcher(url, { cache: 'no-store', headers: { Accept: 'application/json,text/html', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw Error('官方資料來源回應 ' + r.status); return type === 'json' ? r.json() : r.text();
  };
  let cash, error;
  try {
    cash = parseCash(await read(urls(date).cash, 'json'), date);
    // Early in a month, a holiday may require the last trading day of the previous month.
  } catch (e) { error = e.message; }
  if (!cash) {
    const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(0);
    try { cash = parseCash(await read(urls(d.toISOString().slice(0, 10)).cash, 'json'), date); } catch {}
  }
  if (!cash) {
    return { ...(previous || { date, cash: null, institutions: null, futures: null, quote: null }), checkedAt: collectedAt, complete: false, message: error || '市場收盤資料尚未公布' };
  }
  const target = cash.date, sourceURLs = urls(target);
  const report = { date: target, collectedAt, checkedAt: collectedAt, cash: { ...cash, status: 'ok', sourceUrl: urls(date).cash, collectedAt } };
  await Promise.all([['institutions', parseInstitutions, 'json'], ['futures', parseFutures, 'text'], ['quote', parseQuote, 'text']].map(async ([key, parser, type]) => {
    try { report[key] = { ...parser(await read(sourceURLs[key], type), target), status: 'ok', sourceUrl: sourceURLs[key], collectedAt }; }
    catch (e) { report[key] = previous?.[key] ? { ...previous[key], status: 'stale', error: e.message } : { date: target, status: 'unavailable', error: e.message, sourceUrl: sourceURLs[key] }; }
  }));
  report.complete = ['cash', 'institutions', 'futures', 'quote'].every(key => report[key]?.status === 'ok' && report[key].date === target);
  report.message = target < date ? '今日尚無完整收盤資料，顯示最近交易日。' : report.complete ? '已重新取得完整盤後資料。' : '部分官方資料尚未公布，已標示待公布或保留舊資料。';
  return report;
}
