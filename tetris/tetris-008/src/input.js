// Stateful decoder: an escape prefix may arrive in a different data chunk.
export function createKeyDecoder(onKey) {
  let pending = '';
  const arrows = { A: 'up', B: 'down', C: 'right', D: 'left' };
  return chunk => {
    pending += chunk.toString();
    while (pending.length) {
      if (pending[0] === '\x1b') {
        if (pending.length === 1) break;
        if (pending[1] === 'O') {
          // SS3 sequences have one final byte; never interpret it as a key.
          if (pending.length < 3) break;
          if (pending[2] === '\x03') onKey('quit');
          pending = pending.slice(3);
        } else if (pending[1] === '[') {
          // CSI ends at its final byte; parameters must not become standalone keys.
          const end = [...pending.slice(2)].findIndex(char => /[\x40-\x7e]/.test(char));
          const interrupt = pending.indexOf('\x03', 2);
          if (interrupt !== -1 && (end === -1 || interrupt < end + 2)) {
            pending = pending.slice(interrupt + 1);
            onKey('quit');
            continue;
          }
          if (end === -1) break;
          const sequence = pending.slice(2, end + 3);
          pending = pending.slice(end + 3);
          if (sequence.length === 1 && arrows[sequence]) onKey(arrows[sequence]);
        } else pending = pending.slice(1);
        continue;
      }
      const char = pending[0];
      pending = pending.slice(1);
      if (char === '\x03') onKey('quit');
      else if ('prq'.includes(char)) onKey(char);
    }
  };
}
