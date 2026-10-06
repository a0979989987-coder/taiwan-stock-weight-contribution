(() => {
 const el=id=>document.getElementById(id);
 const groups=[['us','美國股市'],['asia','亞洲市場'],['indicators','市場指標'],['commodities','商品市場'],['fx','外匯市場'],['yields','美國公債殖利率'],['crypto','加密貨幣']];
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let reports=[],active=null,loaded=false;
 const number=(v,d=2)=>v==null?'—':(Math.abs(v)<.5*Math.pow(10,-d)?0:Number(v)).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
 const sign=v=>v>0?'+':'';
 const tone=v=>v==null||Math.abs(v)<.005?'flat':v>0?'up':'down';
 function message(text){el('morning-notice').hidden=false;el('morning-notice').textContent=text;}
 function render(){
  if(!active)return;
  el('morning-title').textContent=active.date.replaceAll('-','/')+' 金融日報';
  el('morning-time').textContent='每天 13:30 後（台北，13:35 排程）・實際抓取 '+new Date(active.collectedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei'}).format(new Date());
  el('morning-notice').hidden=true;
  if(active.date<today)message('今日早報尚未更新，顯示最近已儲存快照。');
  else if(!active.complete)message('部分來源暫時無法取得，各列已標示資料狀態。');
  el('morning-cards').innerHTML=groups.map(([id,name])=>'<article class="morning-card"><h2>'+name+'</h2>'+active.rows.filter(r=>r.group===id).map(r=>{
   const value=number(r.value,r.decimals)+(r.group==='yields'&&r.value!=null?'%':'');
   const change=r.group==='yields'?(r.change==null?'—':sign(r.change)+number(r.change,1)+' bp'):(r.changePct==null?'—':sign(r.changePct)+number(r.changePct)+'%');
   const quoted=r.quotedAt?new Date(r.quotedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):r.marketDate||'未取得';
   const kind=r.quoteKind==='previous-close'?' · 前一交易日收盤':'';
   const state=r.status==='stale'?' · 沿用舊資料':r.status==='unavailable'?' · 暫無資料':'';
   const sourceUrl=/^https:\/\/(finance\.yahoo\.com|home\.treasury\.gov)\//.test(r.sourceUrl||'')?r.sourceUrl:'#';
   return '<div class="morning-row '+(r.status==='stale'?'stale':'')+'"><span class="morning-name">'+escape(r.name)+'</span><strong class="morning-value">'+value+'</strong><span class="morning-change '+tone(r.group==='yields'?r.change:r.changePct)+'">'+change+'</span><small>'+escape(quoted)+'（'+(r.quotedAt?'台北時間':'來源日期')+'）'+escape(kind)+escape(state)+(r.unit?' · '+escape(r.unit):'')+' · <a href="'+escape(sourceUrl)+'" target="_blank" rel="noreferrer">'+escape(r.source)+'</a></small></div>';
  }).join('')+'</article>').join('');
  const us=active.rows.filter(r=>r.group==='us'&&r.status==='ok'&&r.changePct!=null);
  const rising=us.filter(r=>r.changePct>=.005).length,falling=us.filter(r=>r.changePct<=-.005).length;
  const oil=active.rows.find(r=>r.id==='CL=F'&&r.status==='ok');
  const vix=active.rows.find(r=>r.id==='^VIX'&&r.status==='ok');
  const text=[];
  if(us.length)text.push('美股主要指數 '+rising+' 項上漲、'+falling+' 項下跌');
  if(vix)text.push('VIX '+number(vix.value)+'（'+sign(vix.changePct)+number(vix.changePct)+'%）');
  if(oil)text.push('WTI '+sign(oil.changePct)+number(oil.changePct)+'%');
  el('morning-focus').textContent=text.length?text.join('；')+'。依本次行情快照整理。':'來源資料不足，暫不產生市場摘要。';
 }
 async function load(){
  const button=el('morning-reload');button.disabled=true;button.textContent='讀取中…';
  try{
   const response=await fetch('data/morning.json',{cache:'no-store',signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw new Error('早報快照尚未取得');
   const data=await response.json();if(!Array.isArray(data.reports)||!data.reports.length)throw new Error('尚無已儲存早報');
   const previous=active?.date;reports=data.reports;active=reports.find(r=>r.date===previous)||reports[0];
   el('morning-date').innerHTML=reports.map(r=>'<option value="'+escape(r.date)+'">'+escape(r.date.replaceAll('-','/'))+'</option>').join('');
   el('morning-date').disabled=false;el('morning-date').value=active.date;loaded=true;render();
  }catch(error){message(error.message+'；已保留目前資料。');}
  finally{button.disabled=false;button.textContent='重新讀取';}
 }
 function show(morning){el('close-view').hidden=morning;el('morning-view').hidden=!morning;if(el('post-close-view'))el('post-close-view').hidden=true;for(const [id,selected] of [['tab-close',!morning],['tab-morning',morning],['tab-post-close',false]]){if(!el(id))continue;el(id).classList.toggle('selected',selected);el(id).setAttribute('aria-pressed',String(selected));}if(morning&&!loaded)load();}
 el('tab-close').addEventListener('click',()=>show(false));el('tab-morning').addEventListener('click',()=>show(true));
 el('morning-reload').addEventListener('click',load);
 el('morning-date').addEventListener('change',e=>{active=reports.find(r=>r.date===e.target.value);render();});
})();
