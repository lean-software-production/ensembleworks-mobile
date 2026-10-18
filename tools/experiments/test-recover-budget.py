import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('recover',Path(__file__).with_name('recover-budget-batch.py'));r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
class RecoveryTests(unittest.TestCase):
 def fixture(self):
  state={'done':['T01'],'commits':[{'commit':'accepted'}],'active':{'id':'B03','task_ids':['T07','T08'],'work_item':'Batch B03: T07,T08','acceptance':[{'task_id':'T07','checks':['decoder']},{'task_id':'T08','checks':['terminal']}],'requirements':['R11','R12'],'contract_hash':'same'}}
  review={'status':'accepted','decision':{'satisfied':True},'task':{'task':'Batch B03: T07,T08'}}
  contract={'batches':[{'id':'B03','split_after':['T07']}],'tasks':[{'id':'T07','requirements':['R11']},{'id':'T08','requirements':['R12']}]}
  return state,review,contract
 def test_reviewed_prefix_preserves_completion_and_carries_validator_finding(self):
  s,v,c=self.fixture();new,review=r.transition(s,v,c,{'task_ids':['T07']},Path('/archive'),'accepted',[{'issue':'BEL decoder'}])
  self.assertEqual(new['done'],['T01']);self.assertEqual(new['commits'],s['commits']);self.assertEqual(new['active']['task_ids'],['T07']);self.assertEqual(new['active']['requirements'],['R11']);self.assertEqual(new['active']['recovery']['known_validator_findings'][0]['issue'],'BEL decoder');self.assertNotIn('task',review);self.assertTrue(review['decision']['satisfied']);self.assertEqual(s['active']['task_ids'],['T07','T08'])
 def test_rejects_unreviewed_or_nonprefix_or_full_group(self):
  for ids in [['T08'],['T07','T08'],[]]:
   s,v,c=self.fixture()
   with self.assertRaises(ValueError):r.transition(s,v,c,{'task_ids':ids},Path('/archive'),'accepted',[])
 def test_requires_accepted_plan(self):
  s,v,c=self.fixture();v['status']='reviewing'
  with self.assertRaises(ValueError):r.transition(s,v,c,{'task_ids':['T07']},Path('/archive'),'accepted',[])
if __name__=='__main__':unittest.main()
