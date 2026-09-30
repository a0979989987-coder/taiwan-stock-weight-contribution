"use client";
import {useEffect,useState,useRef} from 'react';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {Button} from '@/components/ui/button';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import type {MarketView} from '@/lib/market/types';
const num=(v:number|undefined,sign=false)=>v===undefined?'—':(sign&&v>0?'+':'')+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const tone=(v:number|undefined)=>v===undefined||Math.abs(v)<0.0000001?'flat':v>0?'up':'down';
const showDate=(s:string)=>s.replaceAll('-','/');
export default function Home(){
 const [data,setData]=useState<MarketView|null>(null),[message,setMessage]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[selected,setSelected]=useState('latest'),[sort,setSort]=useState('weight'),[desc,setDesc]=useState(true);
 const sequence=useRef(0);
 async function load(date='latest'){
  const id=++sequence.current;setLoading(true);setError('');
  try{const r=await fetch('/api/market'+(date==='latest'?'':'?date='+date),{cache:'no-store'});const d=await r.json() as MarketView & {error?:string};if(!r.ok)throw new Error(d.error??'資料讀取失敗');if(id===sequence.current)setData(d);}
  catch(e){if(id===sequence.current)setError(e instanceof Error?e.message:'讀取失敗');}finally{if(id===sequence.current)setLoading(false);}
 }
 useEffect(()=>{void load()},[]);
 async function update(){
  if(busy)return;setBusy(true);setMessage('');setError('');
  try{const r=await fetch('/api/market',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({force:true})});const result=await r.json() as {error?:string;message:string};if(!r.ok)throw new Error(result.error??'更新失敗');setMessage(result.message);setSelected('latest');await load();}
  catch(e){setError(e instanceof Error?e.message:'更新失敗');}finally{setBusy(false);}
 }
 const report=data?.report;
 const stocks=[...(report?.stocks??[])].sort((a,b)=>{const key=sort as 'weight'|'points'|'changePct';return (desc?-1:1)*(a[key]-b[key])||a.rank-b.rank});
 const waiting=data&&data.latestDate!==data.today;
 return <main><header><div className="brand"><span className="logo">12</span><span>台股觀測<small>TAIEX / AFTER CLOSE</small></span></div><span className="pill">每日盤後 · 收盤價計算</span></header>
 <section className="heading"><div><p className="eyebrow">AFTER THE BELL</p><h1>台股加權點數計算機</h1><p>每日盤後解析十二大權值股對加權指數的影響</p></div><Button className="update-button" onClick={update} disabled={busy||loading}>{busy?'正在抓取官方盤後資料…':'立即更新今日盤後資料'}</Button></section>
 <section className="datebar"><div><strong>{report?showDate(report.date)+' 盤後資料':'等待首筆完整盤後資料'}</strong><span>{data?.latestDate?'最新資料：'+showDate(data.latestDate)+' 盤後':'日期以證交所正式收盤報表為準'}</span></div><div className="history"><label htmlFor="history-date">歷史日期</label><Select value={selected} onValueChange={d=>{setSelected(d);void load(d)}} disabled={loading}><SelectTrigger id="history-date"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="latest">最新盤後</SelectItem>{data?.dates.map(d=><SelectItem key={d} value={d}>{showDate(d)}</SelectItem>)}</SelectContent></Select></div></section>
 {error&&<div className="notice" role="alert">{error}。畫面資料未被覆蓋。<Button onClick={()=>load(selected)} disabled={loading}>重讀已存資料</Button></div>}
 {message&&<div className="notice" role="status">{message}</div>}
 {waiting&&!message&&<div className="info">{data.canUpdate?'今日完整盤後資料尚未入庫。資料延遲或休市時，繼續顯示最近完整交易日。':'尚未收盤或今天為週末，繼續顯示最近完整交易日。'}{data.attempt?.date===data.today&&<span> 最近檢查：{data.attempt.message}</span>}</div>}
 <section className="metrics summary" aria-busy={loading}>
 <article><p>加權指數收盤點數</p><strong>{num(report?.index.close)}</strong><p>前一交易日 {num(report?.index.previousClose)}</p></article>
 <article><p>今日大盤漲跌</p><strong className={tone(report?.index.change)}>{num(report?.index.change,true)}<small> 點</small></strong><p className={tone(report?.index.changePct)}>漲跌幅 {num(report?.index.changePct,true)}%</p></article>
 <article className="primary"><p>十二大權值股淨貢獻 <span>估算</span></p><strong className={tone(report?.totals.net)}>{num(report?.totals.net,true)}<small> 點</small></strong><p>十二檔收盤資料完整後計算</p></article>
 </section>
 <section className="contribution-strip"><div><span>上漲貢獻合計</span><b className="up">{num(report?.totals.positive,true)} 點</b></div><div><span>下跌拖累合計</span><b className="down">{num(report?.totals.negative,true)} 點</b></div><div><span>當日加權指數實際漲跌</span><b className={tone(report?.index.change)}>{num(report?.index.change,true)} 點</b></div></section>
 <section className="board"><div className="board-title"><div><h2>十二大權值股</h2><span>上漲紅色 · 下跌綠色 · 平盤灰色</span></div><div className="sort-controls"><label htmlFor="sort">排序</label><Select value={sort} onValueChange={setSort}><SelectTrigger id="sort"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="weight">權重</SelectItem><SelectItem value="points">貢獻點數</SelectItem><SelectItem value="changePct">漲跌幅</SelectItem></SelectContent></Select><Button onClick={()=>setDesc(!desc)} aria-label="切換排序方向">{desc?'由高到低 ↓':'由低到高 ↑'}</Button></div></div>
 <div className="table-scroll"><Table><TableHeader><TableRow><TableHead>排名 / 股票</TableHead><TableHead>代號</TableHead><TableHead className="numeric">收盤價</TableHead><TableHead className="numeric">前日收盤價</TableHead><TableHead className="numeric">漲跌</TableHead><TableHead className="numeric">漲跌幅</TableHead><TableHead className="numeric">權重</TableHead><TableHead className="numeric">貢獻點數</TableHead></TableRow></TableHeader><TableBody>{stocks.map(s=><TableRow key={s.code}><TableCell><div className="stock"><span className="rank">{String(s.rank).padStart(2,'0')}</span><b>{s.name}</b></div></TableCell><TableCell className="muted">{s.code}</TableCell><TableCell className="numeric">{num(s.close)}</TableCell><TableCell className="numeric muted">{num(s.previousClose)}</TableCell><TableCell className={'numeric '+tone(s.change)}>{num(s.change,true)}</TableCell><TableCell className={'numeric '+tone(s.changePct)}>{num(s.changePct,true)}%</TableCell><TableCell className="numeric">{(s.weight*100).toFixed(4)}%</TableCell><TableCell className={'numeric points '+tone(s.points)}>{num(s.points,true)}</TableCell></TableRow>)}</TableBody></Table></div>
 {!report&&<div className="loading">{loading?'正在讀取已儲存盤後資料…':'尚無完整紀錄。收盤後可按「重新取得今日盤後資料」。'}</div>}</section>
 <footer><p>前一交易日：{report?showDate(report.previousDate):'—'}　權重資料日期：{report?showDate(report.weightDate):'—'}</p><p>儲存時間：{report?new Date(report.savedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'—'}（台北時間）</p><details open><summary>盤後更新與歷史紀錄</summary><p>僅使用證交所每日收盤報表，不抓盤中行情。完整十二檔與前一交易日資料驗證通過後，按交易日期保存；資料不完整、休市或連線失敗時，保留既有結果。歷史名單、權重與計算結果一併固定保存。</p><p>定時工作由 Codex 在本機執行，需保持電腦及 Codex 可運作。13:35、13:40 嘗試取得當日盤後資料；如尚未發布，16:35、16:40 再確認。當日成功後略過後續抓取。開啟網頁只讀取已儲存結果，不啟動行情更新。</p></details><details><summary>估算方式與資料來源</summary><p>個股貢獻點數 ＝ 前一交易日加權指數收盤 × 個股公布權重 ×（當日收盤價 ÷ 前一交易日實際收盤價 − 1）。所有合計先加總未四捨五入數值，再顯示小數兩位。</p><p>排名採期交所最新公布的前十二大市值權重，非當日即時權重。期交所每月底更新權重；除權息、股本及指數基值調整可能造成估算差異，非官方精確歸因。</p><p><a href="https://www.taifex.com.tw/cht/9/futuresQADetail" target="_blank" rel="noreferrer">期交所・權重資料 ↗</a>　<a href="https://www.twse.com.tw/zh/trading/historical/mi-index.html" target="_blank" rel="noreferrer">證交所・每日收盤行情 ↗</a></p></details></footer></main>
}
