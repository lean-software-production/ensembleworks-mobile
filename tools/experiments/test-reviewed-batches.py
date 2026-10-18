import importlib.util,json,shutil,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('variant',Path(__file__).with_name('reviewed-batches.py'));v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
class ReviewedBatchesTests(unittest.TestCase):
 def test_same_model_profile_and_distinct_reviewed_batch_policy(self):
  for whole in [False,True]:
   with tempfile.TemporaryDirectory() as tmp:
    target=Path(tmp)/'tetris/game';target.mkdir(parents=True);shutil.copytree(ROOT/'docs/experiments/tetris-007/inputs/assembly-lines',target/'.assembly-lines')
    old={p.parent.name:json.loads(p.read_text()).get('model') for p in (target/'.assembly-lines/.machines').glob('*/machine.json')};v.configure(target,whole)
    for p in (target/'.assembly-lines/.machines').glob('*/machine.json'):
     c=json.loads(p.read_text())
     if p.parent.name=='planner':self.assertNotIn('model',c)
     else:self.assertEqual(c.get('model'),old[p.parent.name])
    for name in ['plan_author','plan_reviewer_opus','plan_reviewer_gemini','plan_reviewer_astra','plan_synthesiser']:
     text=(target/f'.assembly-lines/.machines/{name}/AGENTS.md').read_text();self.assertIn('batch-plan',text);self.assertIn('R01–R13',text)
     self.assertEqual('EXACTLY ONE batch' in text,whole)
    self.assertIn('active.work_item',(target/'.assembly-lines/.machines/doer/AGENTS.md').read_text())
if __name__=='__main__':unittest.main()
