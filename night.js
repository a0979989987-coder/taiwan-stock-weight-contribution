(() => {
 const el=id=>document.getElementById(id);
 const number=(value,d=0)=>Number(value).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
 const time=value=>new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
 async function load(){
  try{
   const response=await fetch('data/night.json',{cache:'no-store',signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw new Error('尚無已儲存夜盤');const r=await response.json();
   if(!Number.isFinite(r.close)||r.close<=0)throw new Error('夜盤資料尚未取得');
   el('night-close').textContent=number(r.close)+' 點';
   el('night-change').textContent=(r.change>0?'+':'')+number(r.change)+' 點（'+(r.changePct>0?'+':'')+number(r.changePct,2)+'%）';
   el('night-change').classList.remove('up','down','flat');el('night-change').classList.add(r.change>0?'up':r.change<0?'down':'flat');
   el('night-range').textContent=number(r.low)+' – '+number(r.high);
   el('night-contract').textContent='近月 TX '+r.contract.slice(0,4)+'/'+r.contract.slice(4)+' · 成交量 '+number(r.volume)+' 口';
   el('night-session').textContent=time(r.sessionStart)+' ～ '+time(r.sessionEnd)+'（台北）';
   el('night-status').textContent=(r.status==='stale'?'來源暫時無法取得，沿用舊資料。':'')+'交易歸屬日 '+r.tradeDate.replaceAll('-','/')+' · 抓取 '+time(r.collectedAt)+' · 每天 08:30 更新';
   if(/^https:\/\/www\.taifex\.com\.tw\//.test(r.sourceUrl))el('night-source').href=r.sourceUrl;
  }catch(error){el('night-status').textContent=error.message+'；保留已顯示資料。';}
 }
 el('night-reload').addEventListener('click',load);load();
})();
