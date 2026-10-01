import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('morning',Path(__file__).resolve().parents[1]/'scripts/update-morning.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class MorningTests(unittest.TestCase):
 def test_uses_previous_trading_close_not_range_baseline(self):
  raw={'chart':{'result':[{'meta':{'symbol':'TEST','regularMarketTime':172800,'regularMarketPrice':110,'exchangeTimezoneName':'UTC','chartPreviousClose':80},'timestamp':[0,86400,172800],'indicators':{'quote':[{'close':[90,100,110]}]}}]}}
  r=m.parse_chart(raw,'TEST',172801)
  self.assertEqual(r['previousClose'],100)
  self.assertAlmostEqual(r['changePct'],10)
  with self.assertRaises(ValueError):m.parse_chart(raw,'WRONG',172801)
  with self.assertRaises(ValueError):m.parse_chart(raw,'TEST',172799)
 def test_treasury_dates_and_percent_units(self):
  xml='<feed xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata"><m:properties><d:NEW_DATE>2026-09-30T00:00:00</d:NEW_DATE><d:BC_2YEAR>4.88</d:BC_2YEAR><d:BC_10YEAR>5.29</d:BC_10YEAR></m:properties><m:properties><d:NEW_DATE>2026-10-01T00:00:00</d:NEW_DATE><d:BC_2YEAR>4.90</d:BC_2YEAR><d:BC_10YEAR>5.31</d:BC_10YEAR></m:properties></feed>'
  self.assertEqual(m.parse_treasury(xml,'2026-09-30'),[('2026-09-30',4.88,5.29)])
 def test_catalog(self):
  self.assertEqual(len(m.MARKETS),20)
  self.assertEqual(len({r[2] for r in m.MARKETS}),20)

if __name__=='__main__':unittest.main()
