#!/usr/bin/env python3
import importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('combined',Path(__file__).with_name('combined-report.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class CoverageTests(unittest.TestCase):
    def test_unknown_cache_is_not_zero_coverage(self):
        t=m.totals([{'inputTokens':4,'outputTokens':2},{'inputTokens':0,'outputTokens':0,'cachedReadTokens':0}])
        self.assertEqual(t['cachedReadTokens'],{'reported':0,'coverage':1,'calls':2})
        self.assertEqual(t['cachedWriteTokens']['coverage'],0)
        self.assertEqual(t['inputTokens']['reported'],4)
    def test_first_call_cost_excludes_completion_loop(self):
        calls=[{'machine':'doer','inputTokens':10},{'machine':'validator','inputTokens':20},{'machine':'doer','inputTokens':30}]
        first=m.totals([next(c for c in calls if c['machine']=='doer')])
        self.assertEqual(first['inputTokens']['reported'],10)
        self.assertEqual(m.totals(calls)['inputTokens']['reported'],60)
if __name__=='__main__':unittest.main()
