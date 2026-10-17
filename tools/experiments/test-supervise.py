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
                    (run/'record.jsonl').write_text(''.join(json.dumps(e)+'\n' for e in events))
                    s.configuration(code,w)
                    self.assertEqual(s.HALT.is_set(),code=='E01')
                incident=json.loads((root/'results/incident.json').read_text())
                self.assertEqual(incident['experiments'],['E00','E01'])

    def test_unterminated_record_is_not_misread(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp);(p/'record.jsonl').write_text('{"type":"run","status":"running"}\n{"type":')
            self.assertEqual(s.events(p),[{'type':'run','status':'running'}])

if __name__=='__main__':unittest.main()
