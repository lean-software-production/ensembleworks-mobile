const test=require('node:test'),assert=require('node:assert/strict');
const {validate}=require('./tetris-008-planner.cjs');
const tasks=Array.from({length:13},(_,i)=>({id:`T${String(i+1).padStart(2,'0')}`,title:`Task ${i}`,requirements:[`R${String(i+1).padStart(2,'0')}`],acceptance:['frozen']}));
const contract=groups=>({tasks:structuredClone(tasks),batches:groups.map(task_ids=>({task_ids,split_after:[]}))});
const ids=tasks.map(t=>t.id);
test('same frozen tasks execute as singleton, full plan or logical groups',()=>{
 validate(contract(ids.map(id=>[id])),{mode:'ralph',tasks});
 validate(contract([ids]),{mode:'one-shot',tasks});
 validate(contract([ids.slice(0,6),ids.slice(6)]),{mode:'implement-in-batches',tasks});
});
test('refuses modified scope, changed order and incompatible execution units',()=>{
 const c=contract([ids]);c.tasks[0].acceptance=['weakened'];assert.throws(()=>validate(c,{mode:'one-shot',tasks}),/Frozen/);
 assert.throws(()=>validate(contract([[...ids].reverse()]),{mode:'one-shot',tasks}),/order/);
 assert.throws(()=>validate(contract([ids]),{mode:'ralph',tasks}),/singleton/);
 assert.throws(()=>validate(contract(ids.map(id=>[id])),{mode:'one-shot',tasks}),/exactly one/);
 assert.throws(()=>validate(contract([ids]),{mode:'implement-in-batches',tasks}),/2 and 12/);
 const split=contract([ids]);split.batches[0].split_after=['T04'];assert.throws(()=>validate(split,{mode:'one-shot',tasks}),/automatic splitting/);
});
test('harmless JSON object-key reordering preserves task identity',()=>{
 const c=contract([ids]);c.tasks=c.tasks.map(t=>({acceptance:t.acceptance,requirements:t.requirements,title:t.title,id:t.id}));validate(c,{mode:'one-shot',tasks});
});
