import datetime as dt
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('night',Path(__file__).resolve().parents[1]/'scripts/update-night.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class NightTests(unittest.TestCase):
 def fixture(self):
  return '<input name="queryDate" value="2026/10/01"><p>2026/09/30 15:00~次日05:00 盤後交易時段行情表</p><table>'+''.join('<tr>'+''.join('<td>'+v+'</td>' for v in row)+'</tr>' for row in [['TX','202610/202611']+['1']*13,['TX','202611','48000','48600','47900','48430','▼-64','▼-0.13%','210']+['-']*6,['TX','202610','48320','48592','48158','48298','▼-32','▼-0.07%','28717']+['-']*6])+'</table>'
 def test_nearest_month_excludes_spreads(self):
  r=m.parse(self.fixture(),dt.date(2026,10,1));self.assertEqual(r['contract'],'202610');self.assertEqual(r['close'],48298);self.assertEqual(r['change'],-32);self.assertEqual(r['sessionEnd'],'2026-10-01T05:00:00+08:00')
 def test_daytime_and_wrong_date_rejected(self):
  with self.assertRaises(ValueError):m.parse(self.fixture().replace('盤後交易時段行情表','一般交易時段行情表'),dt.date(2026,10,1))
  with self.assertRaises(ValueError):m.parse(self.fixture(),dt.date(2026,10,2))
if __name__=='__main__':unittest.main()
