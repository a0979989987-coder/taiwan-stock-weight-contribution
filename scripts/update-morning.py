"""Public market snapshot for the 08:30 Asia/Taipei GitHub Pages briefing."""
import concurrent.futures
import datetime as dt
import json
import math
import os
from pathlib import Path
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
TAIPEI = ZoneInfo('Asia/Taipei')
MARKETS = [
 ('us','道瓊','^DJI',2,''),('us','S&P 500','^GSPC',2,''),
 ('us','NASDAQ','^IXIC',2,''),('us','費城半導體','^SOX',2,''),
 ('asia','台灣加權','^TWII',2,''),('asia','日經225','^N225',2,''),
 ('asia','韓國 KOSPI','^KS11',2,''),('asia','上海綜合','000001.SS',2,''),
 ('indicators','VIX 恐慌指數','^VIX',2,''),('indicators','歐洲 STOXX 50','^STOXX50E',2,''),
 ('commodities','黃金期貨','GC=F',2,'USD/盎司'),('commodities','白銀期貨','SI=F',3,'USD/盎司'),
 ('commodities','WTI 原油期貨','CL=F',2,'USD/桶'),('commodities','布蘭特原油期貨','BZ=F',2,'USD/桶'),
 ('fx','EUR/USD','EURUSD=X',5,''),('fx','USD/JPY','JPY=X',3,''),
 ('fx','USD/CNY','CNY=X',4,''),('fx','USD/TWD','TWD=X',4,''),
 ('fx','美元指數 DXY','DX-Y.NYB',2,''),('crypto','BTC','BTC-USD',2,'USD'),
]

def read(url):
 request = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0','Accept':'application/json,text/xml'})
 with urllib.request.urlopen(request,timeout=25) as response:
  return response.read().decode('utf-8')

def finite(value):
 return isinstance(value,(float,int)) and math.isfinite(value) and value > 0

def parse_chart(raw, symbol, cutoff):
 result = raw['chart']['result'][0]
 meta = result['meta']
 if meta.get('symbol') != symbol:
  raise ValueError('來源代號不符')
 stamps = result.get('timestamp',[])
 closes = result['indicators']['quote'][0]['close']
 pairs = [(int(t),v) for t,v in zip(stamps,closes) if finite(v) and int(t)<=cutoff]
 market_time = meta.get('regularMarketTime')
 price = meta.get('regularMarketPrice')
 if not finite(price) or not isinstance(market_time,(int,float)) or market_time>cutoff:
  raise ValueError('報價缺漏或時間超出快照')
 timezone = ZoneInfo(meta.get('exchangeTimezoneName','UTC'))
 market_day = dt.datetime.fromtimestamp(market_time,timezone).date()
 prior = [v for t,v in pairs if dt.datetime.fromtimestamp(t,timezone).date()<market_day]
 # chartPreviousClose is the close before the requested range, not yesterday's close.
 if not prior:
  raise ValueError('缺少前一交易日收盤價')
 previous = prior[-1]
 # Futures can roll contracts; the provider's session reference avoids comparing
 # the current contract with the preceding candle's expired contract.
 explicit=meta.get('previousClose')
 session_change=meta.get('fulldayChange')
 if finite(explicit):
  previous=explicit
 elif isinstance(session_change,(float,int)) and math.isfinite(session_change) and finite(meta.get('fulldayPrice')) and abs(meta['fulldayPrice']-price)<1e-6 and finite(price-session_change):
  previous=price-session_change
 return {'value':price,'change':price-previous,'changePct':(price/previous-1)*100,
         'previousClose':previous,'quotedAt':dt.datetime.fromtimestamp(market_time,dt.timezone.utc).isoformat(),
         'marketDate':market_day.isoformat(),'status':'ok'}

def quote(item, cutoff):
 group,name,symbol,decimals,unit = item
 url = 'https://query1.finance.yahoo.com/v8/finance/chart/'+urllib.parse.quote(symbol,safe='')+'?interval=1d&range=1mo'
 row = {'id':symbol,'group':group,'name':name,'decimals':decimals,'unit':unit,
        'source':'Yahoo Finance','sourceUrl':'https://finance.yahoo.com/quote/'+urllib.parse.quote(symbol,safe='')+'/'}
 try:
  raw=json.loads(read(url))
  row.update(parse_chart(raw,symbol,int(dt.datetime.now(dt.timezone.utc).timestamp())))
 except Exception as error:
  row.update(value=None,change=None,changePct=None,status='unavailable',error=str(error)[:180])
 return row

def parse_treasury(xml, cutoff_date):
 rows=[]
 for entry in ET.fromstring(xml).iter():
  if entry.tag.split('}')[-1] != 'properties':continue
  data={c.tag.split('}')[-1]:c.text for c in entry}
  date=(data.get('NEW_DATE') or '')[:10]
  if not date or date>cutoff_date:continue
  try:
   two,ten=float(data['BC_2YEAR']),float(data['BC_10YEAR'])
   if not finite(two) or not finite(ten):continue
   rows.append((date,two,ten))
  except (KeyError,ValueError,TypeError):continue
 rows.sort()
 if not rows:raise ValueError('美債殖利率未公布')
 return rows

def yields(now):
 url='https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value='+str(now.year)
 base={'group':'yields','source':'美國財政部','sourceUrl':'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve','unit':'%','decimals':4}
 try:
  rows=parse_treasury(read(url),now.astimezone(ZoneInfo('America/New_York')).date().isoformat())
  latest=rows[-1];previous=rows[-2] if len(rows)>1 else None
  return [{**base,'id':key,'name':name,'value':latest[index],
           'change':(latest[index]-previous[index])*100 if previous else None,
           'changePct':None,'changeUnit':'bp','marketDate':latest[0],
           'quotedAt':None,'status':'ok'}
          for key,name,index in [('US2Y','美債 2 年期',1),('US10Y','美債 10 年期',2)]]
 except Exception as error:
  return [{**base,'id':key,'name':name,'value':None,'change':None,'changePct':None,
           'status':'unavailable','error':str(error)[:180]} for key,name in [('US2Y','美債 2 年期'),('US10Y','美債 10 年期')]]

def main():
 now=dt.datetime.now(TAIPEI)
 path=ROOT/'data/morning.json'
 prior=json.loads(path.read_text()) if path.exists() else {'reports':[]}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  rows=list(pool.map(lambda item:quote(item,int(now.timestamp())),MARKETS))
 rows.extend(yields(now))
 # Missing sources retain the previous known quote, explicitly marked as stale.
 previous={r['id']:r for r in (prior.get('reports') or [{}])[0].get('rows',[])}
 for i,row in enumerate(rows):
  if row['status']=='unavailable' and finite(previous.get(row['id'],{}).get('value')):
   rows[i]={**previous[row['id']], 'status':'stale','error':row['error']}
 report={'date':now.date().isoformat(),'startedAt':now.isoformat(),'collectedAt':dt.datetime.now(TAIPEI).isoformat(),
         'scheduledTime':'08:30 Asia/Taipei','trigger':os.getenv('GITHUB_EVENT_NAME','manual'),
         'rows':rows,'complete':all(r['status']=='ok' for r in rows)}
 reports=[report]+[r for r in prior.get('reports',[]) if r.get('date')!=report['date']]
 reports.sort(key=lambda r:r['date'],reverse=True)
 path.parent.mkdir(exist_ok=True)
 temporary=path.with_suffix('.tmp')
 temporary.write_text(json.dumps({'reports':reports[:90]},ensure_ascii=False,indent=2)+'\n')
 temporary.replace(path)
 print('Morning snapshot:',report['date'],sum(r['status']=='ok' for r in rows),'/',len(rows),'fresh sources')

if __name__=='__main__':main()
