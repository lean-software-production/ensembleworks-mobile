import importlib.util, shutil, tempfile, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('whole_plan',Path(__file__).with_name('whole-plan.py'));v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
ROOT=Path(__file__).resolve().parents[2]

class WholePlanTests(unittest.TestCase):
    def test_groups_execution_without_changing_models_graph_or_acceptance_inputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp);packet=ROOT/'docs/experiments/tetris-007/inputs'
            shutil.copytree(packet/'assembly-lines',target/'.assembly-lines')
            files={p.relative_to(target):p.read_bytes() for p in target.rglob('*') if p.is_file()}
            v.configure(target)
            for path,data in files.items():
                if path.name!='AGENTS.md':self.assertEqual((target/path).read_bytes(),data)
            machines=target/'.assembly-lines/.machines'
            doer=(machines/'doer/AGENTS.md').read_text();validator=(machines/'validator/AGENTS.md').read_text();planner=(machines/'planner/AGENTS.md').read_text()
            self.assertNotIn('Implement only that task',doer)
            self.assertNotIn('FIRST unfinished task',doer)
            self.assertIn('ENTIRE accepted plan',doer)
            self.assertIn(v.TASK,doer);self.assertIn(v.TASK,planner)
            self.assertIn('Leave ALL parent task checkboxes unchecked',doer)
            self.assertIn('all 13 task',validator)
            self.assertIn('HEAD commit subject',planner)
            for name in ['plan_author','plan_reviewer_opus','plan_reviewer_gemini','plan_reviewer_astra','plan_synthesiser']:
                self.assertIn(v.EXECUTION,(machines/name/'AGENTS.md').read_text())
    def test_control_instruction_drift_fails_instead_of_silently_half_applying(self):
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp);shutil.copytree(ROOT/'docs/experiments/tetris-007/inputs/assembly-lines',target/'.assembly-lines')
            (target/'.assembly-lines/.machines/doer/AGENTS.md').write_text('Changed control')
            with self.assertRaisesRegex(ValueError,'Control doer instructions changed'):v.configure(target)

if __name__=='__main__':unittest.main()
