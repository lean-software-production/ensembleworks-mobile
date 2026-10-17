import importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('maintain',Path(__file__).with_name('maintain.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class MaintenanceTests(unittest.TestCase):
    def test_cannot_stop_early_by_claiming_all_tested(self):
        r={'stop_timer':True,'stop_reason':'all_tested','hypotheses':{'E00':'tested'}}
        self.assertFalse(m.can_stop(r))
        r['hypotheses']={c:'tested' for c in ['E00','E01','E02','E03','E04']};self.assertTrue(m.can_stop(r))
        r['hypotheses']['E04']='running';self.assertFalse(m.can_stop(r))
    def test_explicit_user_input_blocker_can_stop_but_transient_wait_cannot(self):
        self.assertTrue(m.can_stop({'stop_timer':True,'stop_reason':'needs_user_input'}))
        self.assertFalse(m.can_stop({'stop_timer':True,'stop_reason':'continue'}))
        self.assertFalse(m.can_stop({'stop_timer':False,'stop_reason':'needs_user_input'}))
    def test_worker_is_unattended_structured_and_scoped_to_workspace(self):
        c=m.command(Path('/tmp/check-test'))
        self.assertEqual(c[c.index('--cd')+1],str(m.ROOT))
        self.assertIn('approval_policy="never"',c)
        self.assertIn('--output-schema',c)
        self.assertEqual(c[c.index('--output-last-message')+1],'/tmp/check-test/answer.json')
        self.assertIn('--ephemeral',c)
if __name__=='__main__':unittest.main()
