#!/usr/bin/env python3
import importlib.util, json, tempfile, unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('supervise',Path(__file__).with_name('supervise.py'))
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)

class CohortTests(unittest.TestCase):
    def test_one_fresh_trial_is_archived_without_retrying_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); w=root/'worktree'; packet=w/'docs/experiments/tetris-007/inputs';packet.mkdir(parents=True);(packet/'plan.md').write_text('frozen')
            run=w/'factory/runs/tetris-007-e00-r4';run.mkdir(parents=True)
            (run/'record.jsonl').write_text(json.dumps({'type':'run','status':'failed','text':'model failed'})+'\n')
            target=w/'tetris/tetris-007-e00-r4';target.mkdir(parents=True)
            with patch.object(s,'RESULTS',root/'results'),patch.object(s,'FIRST_TRIAL',4),patch.object(s,'TRIALS',1),patch.object(s,'COHORT','test'),patch.object(s,'git',return_value='frozen-commit'),patch.object(s.subprocess,'run',return_value=SimpleNamespace(returncode=0,stdout='started',stderr='')) as command:
                s.configuration('E00',w)
                state=json.loads((root/'results/E00.json').read_text())
                self.assertEqual(len(state['trials']),1)
                self.assertEqual(state['trials'][0]['id'],'tetris-007-e00-r4')
                self.assertEqual(state['trials'][0]['status'],'failed')
                self.assertEqual(command.call_count,1)
                self.assertEqual((root/'results/tetris-007-e00-r4/inputs/plan.md').read_text(),'frozen')
                self.assertTrue((root/'results/tetris-007-e00-r4/record.jsonl').exists())
    def test_two_provider_failures_trip_shared_circuit_breaker(self):
        import threading
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            with patch.object(s,'RESULTS',root/'results'),patch.object(s,'FIRST_TRIAL',4),patch.object(s,'TRIALS',1),patch.object(s,'HALT',threading.Event()),patch.object(s,'MODEL_ERRORS',set()),patch.object(s,'git',return_value='checkpoint'),patch.object(s.subprocess,'run',return_value=SimpleNamespace(returncode=0,stdout='',stderr='')):
                for code in ['E00','E01']:
                    w=root/code;packet=w/'docs/experiments/tetris-007/inputs';packet.mkdir(parents=True);(packet/'plan.md').write_text('frozen')
                    run=w/'factory/runs'/f'tetris-007-{code.lower()}-r4';run.mkdir(parents=True)
                    events=[{'type':'diagnostic','modelStopReasons':['error']},{'type':'run','status':'failed'}]
                    def launch(*args,**kwargs):
                        (run/'record.jsonl').write_text(''.join(json.dumps(e)+'\n' for e in events))
                        return SimpleNamespace(returncode=0,stdout='',stderr='')
                    with patch.object(s.subprocess,'run',side_effect=launch):s.configuration(code,w)
                    self.assertEqual(s.HALT.is_set(),code=='E01')
                incident=json.loads((root/'results/incident.json').read_text())
                self.assertEqual(incident['experiments'],['E00','E01'])

    def test_resume_retains_usage_and_ignores_historical_errors_for_circuit_breaker(self):
        import threading
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);w=root/'worktree';run=w/'factory/runs/tetris-007-e00-r5';run.mkdir(parents=True)
            out=root/'results/tetris-007-e00-r5';out.mkdir(parents=True)
            old={'id':'tetris-007-e00-r5','status':'failed','failure':'provider error','started':'original-time'}
            (out/'result.json').write_text(json.dumps(old))
            prior=[{'type':'usage','machine':'doer','inputTokens':10,'outputTokens':3},{'type':'diagnostic','modelStopReasons':['error']},{'type':'run','status':'failed'}]
            record=run/'record.jsonl';record.write_text(''.join(json.dumps(e)+'\n' for e in prior))
            def launch(*args,**kwargs):
                with record.open('a') as f:f.write(json.dumps({'type':'run','status':'failed','text':'non-provider failure'})+'\n')
                return SimpleNamespace(returncode=0,stdout='',stderr='')
            with patch.object(s,'RESULTS',root/'results'),patch.object(s,'FIRST_TRIAL',5),patch.object(s,'TRIALS',1),patch.object(s,'RESUME',True),patch.object(s,'HALT',threading.Event()),patch.object(s,'MODEL_ERRORS',set()),patch.object(s,'git',return_value='checkpoint') as git,patch.object(s.subprocess,'run',side_effect=launch):
                s.configuration('E00',w)
                new=json.loads((out/'result.json').read_text())
                self.assertEqual(new['started'],'original-time')
                self.assertEqual(len(new['resumes']),1)
                self.assertEqual(new['usage']['machines']['doer']['inputTokens'],10)
                self.assertEqual(json.loads((out/'resume-history/result-1.json').read_text()),old)
                self.assertFalse(s.MODEL_ERRORS)
                self.assertTrue(all('tag' not in call.args for call in git.call_args_list))

    def test_whole_plan_commit_guard_allows_one_commit_but_stops_repetition(self):
        self.assertFalse(s.repeated_whole_plan_commits(['Prepare E04']))
        self.assertFalse(s.repeated_whole_plan_commits(['Implement the complete 13-task plan.','Prepare E04']))
        self.assertTrue(s.repeated_whole_plan_commits(['Implement the complete 13-task plan.']*2))

    def test_budget_guard_counts_active_time_and_reported_tokens_without_context_claims(self):
        from datetime import datetime,timezone
        active={'selected_at':'2026-10-18T10:00:00.000Z','budget':{'limits':{'implementation_minutes':30,'validation_minutes':15,'input_output_tokens':100}}}
        events=[{'type':'machine','machine':'doer','status':'running','time':'2026-10-18T10:00:00.000Z'},{'type':'usage','machine':'doer','inputTokens':80,'outputTokens':30,'time':'2026-10-18T10:01:00.000Z'}]
        exceeded=s.budget_overrun(events,active,datetime(2026,10,18,10,31,tzinfo=timezone.utc))
        self.assertEqual(set(exceeded),{'implementation_minutes','input_output_tokens'})
        self.assertEqual(exceeded['implementation_minutes']['observed'],31)
        self.assertIsNone(s.budget_overrun([],None,datetime.now(timezone.utc)))

    def test_unterminated_record_is_not_misread(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);(p/'record.jsonl').write_text('{"type":"run","status":"running"}\n{"type":')
            self.assertEqual(s.events(p),[{'type':'run','status':'running'}])

if __name__=='__main__':unittest.main()
