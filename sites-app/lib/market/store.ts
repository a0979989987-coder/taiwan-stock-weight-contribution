import { env } from 'cloudflare:workers';
import type {DailyReport,MarketView,Attempt} from './types';
import {taipeiClock,collect,tradingDates} from './collect';
function db(){if(!env.DB)throw new Error('歷史資料庫暫時無法使用');return env.DB;}
export async function view(date?:string):Promise<MarketView>{
 const database=db();
 const dates=(await database.prepare('SELECT date FROM daily_reports ORDER BY date DESC').all<{date:string}>()).results.map(r=>r.date);
 const chosen=date??dates[0];
 const record=chosen?await database.prepare('SELECT payload FROM daily_reports WHERE date = ?').bind(chosen).first<{payload:string}>():null;
 if(date&&!record)throw new Error('找不到該日期的已儲存資料');
 const clock=taipeiClock();
 const attempt=await database.prepare('SELECT date, status, message, attempted_at FROM update_attempts ORDER BY attempted_at DESC LIMIT 1').first<Attempt>();
 return {report:record?JSON.parse(record.payload):null,dates,latestDate:dates[0]??null,attempt,today:clock.date,canUpdate:!clock.weekend&&clock.minutes>=810};
}
async function save(report:DailyReport,replaceExisting=false){
 // Never write partial data or replace historical dates. A user-triggered refresh may replace only today's validated snapshot.
 await db().prepare('INSERT INTO daily_reports (date,previous_date,payload,created_at) VALUES (?,?,?,?) ON CONFLICT(date) DO UPDATE SET previous_date=excluded.previous_date,payload=excluded.payload,created_at=excluded.created_at WHERE ? = 1').bind(report.date,report.previousDate,JSON.stringify(report),report.savedAt,replaceExisting?1:0).run();
}
export async function updateToday(options:{force?:boolean}={}){
 const force=options.force===true;
 const clock=taipeiClock(),date=clock.date,database=db();
 if(clock.weekend)return {status:'closed',message:'週末不建立交易紀錄，顯示最近已儲存的盤後資料。'};
 if(clock.minutes<810)return {status:'before_close',message:'尚未到台北時間 13:30，不抓取盤中行情。'};
 const existing=await database.prepare('SELECT date FROM daily_reports WHERE date=?').bind(date).first();
 if(existing&&!force)return {status:'complete',message:'今日十二檔完整盤後資料已儲存，無須重複抓取。'};
 const now=Date.now();
 const lock=await database.prepare("INSERT INTO update_attempts (date,attempted_at,status,message,lease_until) VALUES (?,?,'running','正在檢查完整盤後報表',?) ON CONFLICT(date) DO UPDATE SET attempted_at=excluded.attempted_at,status=excluded.status,message=excluded.message,lease_until=excluded.lease_until WHERE update_attempts.lease_until < ? OR (? = 1 AND update_attempts.status != 'running') RETURNING date").bind(date,new Date(now).toISOString(),now+120000,now,force?1:0).first();
 if(!lock)return {status:'cooldown',message:'剛剛已檢查資料，請稍後再試（最多兩分鐘）。'};
 let status='pending',message='';
 try {
   const dates=await tradingDates(date),previous=dates.filter(d=>d<date).at(-1);
   if(!previous)throw new Error('缺少前一交易日，保留原有資料');
   // First installation starts with the most recent fully published session.
   const any=await database.prepare('SELECT date FROM daily_reports LIMIT 1').first();
   if(!any){const prior=dates.filter(d=>d<previous).at(-1);if(prior){try{await save(await collect(previous,prior));}catch(e){console.warn('Initial history unavailable',String(e));}}}
   const report=await collect(date,previous);
   await save(report,force);status='complete';message=force?'已立即重新抓取並更新 '+date+' 的完整盤後資料。':date+' 十二檔完整盤後資料已儲存。';
 }catch(e){message=(e instanceof Error?e.message:'官方資料暫時無法取得')+'；未覆蓋最近完整結果。';}
 await database.prepare('UPDATE update_attempts SET status=?,message=?,lease_until=0 WHERE date=?').bind(status,message,date).run();
 return {status,message};
}
