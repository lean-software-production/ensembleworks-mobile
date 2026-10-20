export function decoder(emit) {
  let pending='';
  return chunk => {
    pending+=chunk.toString();
    while(pending.length) {
      if(pending[0]==='\x1b') {
        if(pending.length===1 || pending==='\x1b[' || pending==='\x1bO') return;
        const match=pending.match(/^\x1b(?:\[|O)([ABCD])/);
        if(match) { emit({A:'rotate',B:'down',C:'right',D:'left'}[match[1]]); pending=pending.slice(3); continue; }
        // CSI and SS3 finals belong to their sequence, never letter bindings.
        const escape=pending.match(/^\x1b[\[O][0-?]*[ -/]*[@-~]/);
        if(escape) pending=pending.slice(escape[0].length);
        else if(/^\x1b[\[O][0-?]*[ -/]*$/.test(pending)) return;
        // Unsupported Alt keys belong to the escape too; never replay
        // their suffix as a standalone pause/restart/quit binding.
        else pending=pending.slice(2);
        continue;
      }
      const key=pending[0]; pending=pending.slice(1);
      const action={p:'pause',r:'restart',q:'quit','\x03':'quit'}[key];
      if(action) emit(action);
    }
  };
}
