import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('study',Path(__file__).with_name('tetris-008.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class StudyTests(unittest.TestCase):
 def test_frozen_catalogue_keeps_every_clause_and_task_identity(self):
  text=(m.ROOT/'docs/experiments/tetris-007/inputs/plan.md').read_text();tasks=m.frozen_tasks(text)
  self.assertEqual([t['id'] for t in tasks],[f'T{i:02d}' for i in range(1,14)])
  clauses=[l.strip()[2:] for l in text.splitlines() if l.strip().startswith('- ') and not l.strip().startswith('- [')]
  self.assertEqual([a for t in tasks for a in t['acceptance']],clauses)
 def test_resumed_clock_excludes_pause_without_resetting_original_run_time(self):
  record={'started':'2026-10-20T09:00:00+00:00','segments':[{'started':'2026-10-20T09:00:00+00:00','finished':'2026-10-20T09:40:00+00:00'},{'started':'2026-10-20T11:00:00+00:00'}]}
  self.assertEqual(m.elapsed_seconds(record,'2026-10-20T11:05:00+00:00'),45*60)
  record['segments'][-1]['finished']='2026-10-20T11:10:00+00:00'
  self.assertEqual(m.elapsed_seconds(record,'2026-10-20T12:00:00+00:00'),50*60)
 def test_usage_reports_failed_calls_and_does_not_invent_cache_or_usage(self):
  es=[{'type':'machine','machine':'doer','status':'running','time':'a'}, {'type':'usage','machine':'doer','inputTokens':10,'outputTokens':2,'cachedReadTokens':0}, {'type':'machine','machine':'doer','status':'failed','time':'b'}, {'type':'machine','machine':'validator','status':'running','time':'c'}]
  data=m.metrics(es);self.assertEqual(data['io'],12);self.assertEqual(data['cache_read_reports'],1);self.assertEqual(data['model_calls'],2);self.assertEqual(data['phases']['implementation']['input'],10)
if __name__=='__main__':unittest.main()
