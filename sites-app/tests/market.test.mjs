import test from 'node:test';
import assert from 'node:assert/strict';
import {taipeiClock,numeric,parseWeights,parseReport,calculate} from '../lib/market/collect.ts';
const weights={date:'2026-08-31',rows:Array.from({length:12},(_,i)=>({rank:i+1,code:String(2000+i),name:'Stock '+i,weight:i===0?.3:.01}))};
function report(date,indexClose,indexChange,close){return {date,indexClose,indexChange,stocks:new Map(weights.rows.map(w=>[w.code,{name:w.name,close}]))};}
test('23000 × 30% × 1% equals 69; totals include positive, negative and flat',()=>{
 const prev=report('2026-09-18',23000,0,100),curr=report('2026-09-21',23126.35,126.35,100);
 curr.stocks.get('2000').close=101;curr.stocks.get('2001').close=98;
 const d=calculate(curr.date,prev.date,curr,prev,weights);
 assert.equal(d.stocks[0].points,69);assert.equal(d.stocks[1].points,-4.6000000000000005);
 assert.equal(d.totals.positive,69);assert.ok(Math.abs(d.totals.net-64.4)<1e-9);assert.equal(d.stocks[2].points,0);
});
test('missing, stale, skipped-session or nonpositive prices cannot create a report',()=>{
 const prev=report('2026-09-18',23000,0,100),curr=report('2026-09-21',23126.35,126.35,101);
 curr.stocks.delete('2011');assert.throws(()=>calculate(curr.date,prev.date,curr,prev,weights),/缺少/);
 curr.stocks.set('2011',{name:'Stock',close:'--'});assert.throws(()=>calculate(curr.date,prev.date,curr,prev,weights),/缺漏/);
 curr.stocks.set('2011',{name:'Stock',close:0});assert.throws(()=>calculate(curr.date,prev.date,curr,prev,weights),/無效/);
 curr.stocks.set('2011',{name:'Stock',close:101});prev.indexClose=22999;assert.throws(()=>calculate(curr.date,prev.date,curr,prev,weights),/前一交易日/);
 prev.indexClose=23000;assert.throws(()=>calculate(curr.date,prev.date,curr,prev,{...weights,date:'2026-10-01'}),/日期/);
});
test('holiday and wrong-date responses are rejected; no fabricated zero session',()=>{
 assert.throws(()=>parseReport({stat:'很抱歉，沒有符合條件的資料!'},'2026-09-20'),/尚未發布/);
 assert.throws(()=>parseReport({stat:'OK',date:'20260918',tables:[]},'2026-09-21'),/尚未發布/);
 assert.throws(()=>numeric('--'));assert.throws(()=>numeric(''));assert.equal(numeric('47,180.75'),47180.75);
});
test('Taipei close gate and weekend use Taipei calendar',()=>{
 assert.equal(taipeiClock(new Date('2026-09-21T05:29:00Z')).minutes,809);
 assert.equal(taipeiClock(new Date('2026-09-21T05:30:00Z')).minutes,810);
 assert.equal(taipeiClock(new Date('2026-09-18T16:01:00Z')).weekend,true);
 assert.equal(taipeiClock(new Date('2026-09-20T16:01:00Z')).date,'2026-09-21');
});
test('weights require 12 distinct stocks and explicit vintage',()=>{
 assert.throws(()=>parseWeights('<html>maintenance</html>'),/不完整/);
 const html=weights.rows.map(w=>'<tr><td>'+w.rank+'</td><td>'+w.code+'</td><td>'+w.name+'</td><td>'+w.weight*100+'%</td></tr>').join('');
 assert.throws(()=>parseWeights(html),/日期/);
 const parsed=parseWeights(html+'資料日期：2026/8/31');assert.equal(parsed.rows.length,12);assert.equal(parsed.date,'2026-08-31');assert.equal(parsed.rows[0].weight,.3);
});
