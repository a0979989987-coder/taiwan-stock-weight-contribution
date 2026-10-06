import { env } from 'cloudflare:workers';
import { collectPostClose, clock } from '@/lib/market/post-close-source.mjs';

const githubOrigin = 'https://a0979989987-coder.github.io';
const snapshotURL = 'https://raw.githubusercontent.com/a0979989987-coder/taiwan-stock-weight-contribution/main/data/post-close.json';
function json(request: Request, data: unknown, status = 200) {
  const headers: Record<string, string> = { 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (request.headers.get('origin') === githubOrigin) headers['Access-Control-Allow-Origin'] = githubOrigin;
  return Response.json(data, { status, headers });
}
async function database() {
  if (!env.DB) throw Error('資料庫暫時無法取得');
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS post_close_state (id INTEGER PRIMARY KEY CHECK (id=1), payload TEXT, attempted_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0)').run();
  return env.DB;
}
async function saved(db: Awaited<ReturnType<typeof database>>) {
  const row = await db.prepare('SELECT payload FROM post_close_state WHERE id=1').first<{ payload: string }>();
  let report = row?.payload ? JSON.parse(row.payload) : null;
  try {
    const response = await fetch(snapshotURL, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const candidate = (await response.json() as { reports?: any[] }).reports?.[0];
      if (candidate && (!report || candidate.date > report.date || candidate.date === report.date && Date.parse(candidate.collectedAt) > Date.parse(report.collectedAt))) report = candidate;
    }
  } catch { /* The last verified database snapshot remains available. */ }
  return report;
}
export async function OPTIONS(request: Request) {
  if (request.headers.get('origin') !== githubOrigin) return json(request, { error: '不允許此來源' }, 403);
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': githubOrigin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600', Vary: 'Origin' } });
}
export async function GET(request: Request) {
  try { return json(request, { report: await saved(await database()), refreshed: false }); }
  catch { return json(request, { error: '盤後資料暫時無法讀取' }, 503); }
}
export async function POST(request: Request) {
  if (request.headers.get('origin') !== githubOrigin) return json(request, { error: '不允許此來源' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json')) return json(request, { error: '請使用 JSON 請求' }, 415);
  let db: Awaited<ReturnType<typeof database>> | undefined;
  let leased = false;
  try {
    db = await database(); const previous = await saved(db);
    if (clock().minutes < 810) return json(request, { report: previous, refreshed: false, message: '台北時間 13:30 後才抓取盤後資料。' });
    const now = Date.now();
    const lease = await db.prepare('INSERT INTO post_close_state (id,attempted_at,lease_until) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET attempted_at=excluded.attempted_at,lease_until=excluded.lease_until WHERE post_close_state.lease_until < ? AND post_close_state.attempted_at <= ? RETURNING id').bind(now, now + 90000, now, now - 60000).first();
    if (!lease) return json(request, { report: previous, refreshed: false, message: '剛剛已檢查資料，請稍後再試。' });
    leased = true;
    const report = await collectPostClose(previous);
    await db.prepare('UPDATE post_close_state SET payload=?,lease_until=0 WHERE id=1').bind(JSON.stringify(report)).run();
    leased = false;
    return json(request, { report, refreshed: true, message: report.message });
  } catch {
    return json(request, { error: '更新未完成，已保留先前有效資料' }, 503);
  } finally {
    if (leased && db) await db.prepare('UPDATE post_close_state SET lease_until=0 WHERE id=1').run();
  }
}
