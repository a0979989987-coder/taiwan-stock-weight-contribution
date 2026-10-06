(() => {
  const el = id => document.getElementById(id);
  const api = 'https://taiwan-weight-points-k928.btcfly.chatgpt.site/api/public-post-close';
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const number = (n, digits = 2, signed = false) => finite(n) ? (signed && n > 0 ? '+' : '') + n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
  const tone = n => finite(n) && n !== 0 ? n > 0 ? 'up' : 'down' : 'flat';
  const time = t => Number.isFinite(Date.parse(t)) ? new Date(t).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) : '—';
  let reports = [], active = null, loading = false, loaded = false;
  function message(text) { el('post-close-notice').hidden = !text; el('post-close-notice').textContent = text; }
  function merge(report, latest = false) {
    if (!report || !/^\d{4}-\d{2}-\d{2}$/.test(report.date)) return;
    const old = reports.find(r => r.date === report.date);
    if (!old || Date.parse(report.checkedAt || report.collectedAt) >= Date.parse(old.checkedAt || old.collectedAt)) reports = [report, ...reports.filter(r => r.date !== report.date)];
    reports.sort((a, b) => b.date.localeCompare(a.date));
    active = latest || !active ? reports[0] : reports.find(r => r.date === active.date) || reports[0];
  }
  const stamp = r => '<p class="post-close-source">資料日 ' + escape(r?.date || '—') + (r?.status === 'stale' ? ' · 沿用上次有效資料' : r?.status === 'unavailable' || !r ? ' · 待公布' : '') + (r?.collectedAt ? ' · 取得 ' + escape(time(r.collectedAt)) : '') + (r?.sourceUrl && /^https:\/\/(www\.twse\.com\.tw|www\.taifex\.com\.tw)\//.test(r.sourceUrl) ? ' · <a href="' + escape(r.sourceUrl) + '" target="_blank" rel="noreferrer">官方來源 ↗</a>' : '') + '</p>';
  function render() {
    if (!active) return;
    el('post-close-title').textContent = active.date.replaceAll('-', '/') + ' 盤後資訊';
    el('post-close-time').textContent = '13:30 後取得 · 最近檢查 ' + time(active.checkedAt || active.collectedAt);
    el('post-close-date').innerHTML = reports.map(r => '<option value="' + escape(r.date) + '">' + escape(r.date.replaceAll('-', '/')) + '</option>').join('');
    el('post-close-date').disabled = false; el('post-close-date').value = active.date;
    const c = active.cash, q = active.quote, inst = active.institutions, f = active.futures;
    const metric = (label, n, suffix = '', signed = false) => '<div><span>' + label + '</span><strong class="' + (signed ? tone(n) : 'flat') + '">' + number(n, 2, signed) + '<small>' + suffix + '</small></strong></div>';
    const names = [['foreign', '外資'], ['trust', '投信'], ['dealer', '自營商']];
    el('post-close-cards').innerHTML = '<article class="morning-card post-close-market"><h2>集中市場</h2><div class="post-close-metrics">' + metric('加權指數', c?.close) + metric('漲跌', c?.change, ' 點', true) + metric('成交金額', finite(c?.turnover) ? c.turnover / 1e8 : null, ' 億') + '</div>' + stamp(c) + '</article>' +
      '<article class="morning-card post-close-market"><h2>台指期日盤 <small>近月 ' + escape(q?.contract || 'TX') + '</small></h2><div class="post-close-metrics">' + metric('收盤指數', q?.close) + metric('漲跌', q?.change, ' 點', true) + metric('漲跌幅', q?.changePct, '%', true) + '</div>' + stamp(q) + '</article>' +
      '<article class="morning-card post-close-institutions"><h2>三大法人現貨買賣超 <small>上市 · 億元</small></h2><div class="post-close-table-wrap"><table><thead><tr><th>法人</th><th>買賣超（億）</th></tr></thead><tbody>' + [...names, ['total', '合計']].map(([key, name]) => '<tr><td>' + name + '</td><td class="numeric ' + tone(inst?.[key]) + '">' + number(finite(inst?.[key]) ? inst[key] / 1e8 : null, 2, true) + '</td></tr>').join('') + '</tbody></table></div>' + stamp(inst) + '</article>' +
      '<article class="morning-card post-close-institutions"><h2>三大法人台指期籌碼 <small>TX 全月份 · 口</small></h2><div class="post-close-table-wrap"><table><thead><tr><th>法人</th><th>交易淨額</th><th>未平倉淨額</th></tr></thead><tbody>' + names.map(([key, name]) => '<tr><td>' + name + '</td><td class="numeric ' + tone(f?.rows?.[key]?.tradingNet) + '">' + number(f?.rows?.[key]?.tradingNet, 0, true) + '</td><td class="numeric ' + tone(f?.rows?.[key]?.openInterestNet) + '">' + number(f?.rows?.[key]?.openInterestNet, 0, true) + '</td></tr>').join('') + '</tbody></table></div>' + stamp(f) + '</article>';
    const summary = [];
    if (finite(c?.change)) summary.push(c.date + ' 加權指數收盤 ' + number(c.close) + '，' + (c.change >= 0 ? '上漲 ' : '下跌 ') + number(Math.abs(c.change)) + ' 點，成交金額 ' + number(c.turnover / 1e8) + ' 億元');
    if (finite(inst?.total)) summary.push(inst.date + ' 三大法人合計' + (inst.total >= 0 ? '買超 ' : '賣超 ') + number(Math.abs(inst.total) / 1e8) + ' 億元');
    const net = f?.rows?.foreign?.openInterestNet;
    if (finite(net)) summary.push(f.date + ' 外資台指期未平倉為' + (net > 0 ? '淨多 ' : net < 0 ? '淨空 ' : '多空持平 ') + number(Math.abs(net), 0) + (net ? ' 口' : ''));
    el('post-close-analysis').textContent = summary.length ? summary.join('；') + '。依官方資料整理。' : '官方資料尚未公布，暫不產生摘要。';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date());
    message(active.date < today ? '顯示歷史或最近有效交易日，各區資料日期分別標示。' : active.complete ? '' : active.message || '部分官方資料待公布，已保留有效資料。');
  }
  async function load(force = false) {
    if (loading) return; loading = true;
    const button = el('post-close-refresh'); button.disabled = true; button.textContent = force ? '抓取中…' : '讀取中…';
    try {
      if (!force) {
        try { const r = await fetch('data/post-close.json', { cache: 'no-store', signal: AbortSignal.timeout(10000) }); if (r.ok) { const s = await r.json(); for (const report of s.reports || []) merge(report); render(); } } catch {}
      }
      const response = await fetch(api, { method: force ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(force ? 90000 : 15000), ...(force ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}) });
      const result = await response.json(); if (!response.ok) throw Error(result.error || '來源暫時無法取得');
      merge(result.report, force); render(); loaded = !!active;
      if (result.message) message(result.message);
      if (!active) message('尚無盤後快照，請在 13:30 後按立即更新。');
    } catch (e) { message('更新未完成：' + (e.name === 'TimeoutError' ? '官方來源回應逾時' : e.message) + '；保留目前有效資料。'); }
    finally { loading = false; button.disabled = false; button.textContent = '立即更新'; }
  }
  el('tab-post-close').addEventListener('click', () => {
    el('close-view').hidden = true; el('morning-view').hidden = true; el('post-close-view').hidden = false;
    for (const id of ['tab-close', 'tab-morning', 'tab-post-close']) { el(id).classList.toggle('selected', id === 'tab-post-close'); el(id).setAttribute('aria-pressed', String(id === 'tab-post-close')); }
    if (!loaded) load();
  });
  el('post-close-refresh').addEventListener('click', () => load(true));
  el('post-close-date').addEventListener('change', e => { active = reports.find(r => r.date === e.target.value); render(); });
})();
