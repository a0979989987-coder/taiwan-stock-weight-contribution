const $=id=>document.getElementById(id);let history=[],active=null,sort='weight',desc=true;
const num=(v,sign=false)=>v==null?'—':(sign&&v>0?'+':'')+Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const tone=v=>v==null||Math.abs(v)<1e-10?'flat':v>0?'up':'down';
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>s.replaceAll('-','/');
function setTone(el,v){el.classList.remove('up','down','flat');el.classList.add(tone(v));}
function render(){if(!active)return;const r=active;$('report-title').textContent=date(r.date)+' 盤後資料';$('latest-label').textContent='最新資料：'+date(history[0].date)+' 盤後';$('index-close').textContent=num(r.index.close);$('index-previous').textContent=num(r.index.previousClose);$('index-change').innerHTML=num(r.index.change,true)+'<small> 點</small>';setTone($('index-change'),r.index.change);$('index-pct').textContent='漲跌幅 '+num(r.index.changePct,true)+'%';setTone($('index-pct'),r.index.changePct);$('net-points').innerHTML=num(r.totals.net,true)+'<small> 點</small>';setTone($('net-points'),r.totals.net);for(const [id,val] of [['positive-points',r.totals.positive],['negative-points',r.totals.negative],['actual-points',r.index.change]]){$(id).textContent=num(val,true)+' 點';setTone($(id),val)}$('meta').textContent='前一交易日：'+date(r.previousDate)+'　權重資料日期：'+date(r.weightDate);$('saved').textContent='資料更新時間：'+new Date(r.savedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})+'（台北時間）';const rows=[...r.stocks].sort((a,b)=>(desc?-1:1)*(a[sort]-b[sort])||a.rank-b.rank);$('stocks').innerHTML=rows.map(s=>`<tr><td><div class="stock"><span class="rank">${String(s.rank).padStart(2,'0')}</span><b>${escapeHtml(s.name)}</b></div></td><td class="muted">${escapeHtml(s.code)}</td><td class="numeric">${num(s.close)}</td><td class="numeric muted">${num(s.previousClose)}</td><td class="numeric ${tone(s.change)}">${num(s.change,true)}</td><td class="numeric ${tone(s.changePct)}">${num(s.changePct,true)}%</td><td class="numeric">${(s.weight*100).toFixed(4)}%</td><td class="numeric points ${tone(s.points)}">${num(s.points,true)}</td></tr>`).join('');$('loading').hidden=true}
const API='https://taiwan-weight-points-k928.btcfly.chatgpt.site/api/public-market';
function notice(message){$('notice').hidden=false;$('notice').textContent=message;}
function mergeReport(report,selectLatest=false){
 if(report){if(!/^\d{4}-\d{2}-\d{2}$/.test(report.date)||!report.index||!report.totals||!Array.isArray(report.stocks)||report.stocks.length!==12)throw new Error('資料格式不完整');
 history=history.filter(r=>r.date!==report.date);history.push(report);}
 history.sort((a,b)=>b.date.localeCompare(a.date));
 if(!history.length)return;
 active=selectLatest||!active?history[0]:history.find(r=>r.date===active.date)||history[0];
 $('history-date').innerHTML=history.map(r=>'<option value="'+r.date+'">'+date(r.date)+'</option>').join('');
 $('history-date').disabled=false;$('history-date').value=active.date;render();
}
async function requestMarket(method='GET'){
 const response=await fetch(API,{method,cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(120000),...(method==='POST'?{headers:{'Content-Type':'application/json'},body:'{}'}:{})});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'HTTP '+response.status);return data;
}
async function start(){
 const results=await Promise.allSettled([
 fetch('data/history.json',{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error('歷史資料無法讀取');const rows=await r.json();if(!Array.isArray(rows))throw new Error('歷史格式錯誤');return rows;}),
 requestMarket()
 ]);
 if(results[0].status==='fulfilled')history=results[0].value;
 try{mergeReport(results[1].status==='fulfilled'?results[1].value.report:null,true);}
 catch(e){notice(e.message);}
 if(!history.length){$('loading').textContent='尚無完整盤後資料，請按立即更新';notice('請按立即更新取得官方盤後資料。');}
}
let refreshing=false;
$('refresh').addEventListener('click',async()=>{
 if(refreshing)return;refreshing=true;const button=$('refresh');button.disabled=true;button.textContent='正在抓取官方資料…';notice('正在重新抓取證交所盤後報表，請稍候…');
 try{const data=await requestMarket('POST');mergeReport(data.report,true);notice(data.message||'資料已更新');}
 catch(e){notice('更新未完成：'+(e.name==='TimeoutError'?'官方資料回應逾時，請稍後再試':e.message)+'。保留目前完整資料。');}
 finally{refreshing=false;button.disabled=false;button.textContent='立即更新盤後資料';}
});
$('history-date').addEventListener('change',e=>{active=history.find(r=>r.date===e.target.value);render()});$('sort').addEventListener('change',e=>{sort=e.target.value;render()});$('direction').addEventListener('click',()=>{desc=!desc;$('direction').textContent=desc?'由高到低 ↓':'由低到高 ↑';render()});start();
