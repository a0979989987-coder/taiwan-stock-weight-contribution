"""Latest completed TX after-hours session from TAIFEX; never use daytime data."""
import datetime as dt
import json
import re
from html.parser import HTMLParser
from pathlib import Path
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
class Tables(HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None;self.query_date=None;self.text=[]
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if tag=='input' and attrs.get('name')=='queryDate':self.query_date=attrs.get('value')
  if tag=='tr':self.row=[]
  if tag in ('th','td'):self.cell=[]
 def handle_data(self,data):
  self.text.append(data)
  if self.cell is not None:self.cell.append(data)
 def handle_endtag(self,tag):
  if tag in ('th','td') and self.cell is not None:
   if self.row is not None:self.row.append(' '.join(''.join(self.cell).split()))
   self.cell=None
  if tag=='tr' and self.row is not None:self.rows.append(self.row);self.row=None

def numeric(text):
 text=text.replace(',','').replace('▲','').replace('▼','').replace('%','').strip()
 if not re.fullmatch(r'[+-]?\d+(?:\.\d+)?',text):raise ValueError('夜盤數值缺漏')
 return float(text)

def parse(html,requested):
 table=Tables();table.feed(html)
 if table.query_date!=requested.strftime('%Y/%m/%d'):raise ValueError('來源交易日期不符')
 text=' '.join(' '.join(table.text).split())
 match=re.search(r'(\d{4}/\d{2}/\d{2})\s+15:00\s*~\s*次日05:00\s+盤後交易時段行情表',text)
 if not match:raise ValueError('未取得已完成夜盤報表')
 session_start=dt.date.fromisoformat(match[1].replace('/','-'))
 session_end=session_start+dt.timedelta(days=1)
 if session_end>requested:raise ValueError('夜盤尚未結束')
 contracts=[r for r in table.rows if len(r)>=15 and r[0]=='TX' and re.fullmatch(r'\d{6}',r[1])]
 if not contracts:raise ValueError('臺指期近月夜盤尚未公布')
 row=min(contracts,key=lambda r:r[1])
 close,change,pct,volume=numeric(row[5]),numeric(row[6]),numeric(row[7]),numeric(row[8])
 if close<=0 or volume<=0:raise ValueError('近月契約夜盤缺少成交')
 return {'contract':row[1],'close':close,'change':change,'changePct':pct,'open':numeric(row[2]),'high':numeric(row[3]),'low':numeric(row[4]),'volume':int(volume),
         'tradeDate':requested.isoformat(),'sessionStart':session_start.isoformat()+'T15:00:00+08:00','sessionEnd':session_end.isoformat()+'T05:00:00+08:00','status':'ok'}

def main():
 now=dt.datetime.now(ZoneInfo('Asia/Taipei'));path=ROOT/'data/night.json'
 previous=json.loads(path.read_text()) if path.exists() else None
 latest=None;errors=[]
 today=now.date() if now.hour>=5 else now.date()-dt.timedelta(days=1)
 for offset in range(10):
  day=today-dt.timedelta(days=offset)
  url='https://www.taifex.com.tw/cht/3/futDailyMarketReport?'+urllib.parse.urlencode({'queryDate':day.strftime('%Y/%m/%d'),'marketCode':'1','commodity_id':'TX'})
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
   with urllib.request.urlopen(req,timeout=20) as response:html=response.read().decode('utf-8')
   latest={**parse(html,day),'source':'臺灣期貨交易所','sourceUrl':url,'collectedAt':now.isoformat()};break
  except Exception as error:errors.append(str(error)[:160])
 if latest is None:
  latest={**(previous or {}),'status':'stale' if previous and previous.get('close') else 'unavailable','error':errors[0] if errors else '來源無資料','checkedAt':now.isoformat()}
 path.parent.mkdir(exist_ok=True);temporary=path.with_suffix('.tmp')
 temporary.write_text(json.dumps(latest,ensure_ascii=False,indent=2)+'\n');temporary.replace(path)
 print('TX night:',latest.get('tradeDate'),latest.get('contract'),latest['status'])

if __name__=='__main__':main()
