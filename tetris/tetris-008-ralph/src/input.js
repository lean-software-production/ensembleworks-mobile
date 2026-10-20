// Byte-oriented decoder: incomplete escape sequences survive chunk boundaries.
// Unknown CSI/SS3 and control strings are consumed, never dispatched as keys.
export function createInputDecoder(onAction) {
  let mode = 'plain';
  let sequence = '';
  return function feed(chunk) {
    for (const byte of Buffer.from(chunk)) {
      const key = String.fromCharCode(byte);
      // OSC ends with BEL or ST; DCS/SOS/PM/APC end only with ST.
      // Keep no payload, so arbitrarily long or unfinished strings stay bounded.
      if (mode === 'osc' || mode === 'string') {
        if ((mode === 'osc' && byte === 7) || (sequence === 'escape' && key === '\\')) {
          mode = 'plain'; sequence = '';
        } else {
          sequence = byte === 27 ? 'escape' : '';
        }
        continue;
      }
      if (byte === 27) { mode = 'escape'; sequence = ''; continue; }
      if (mode === 'escape') {
        mode = key === ']' ? 'osc' : 'PX^_'.includes(key) ? 'string'
          : key === '[' || key === 'O' ? 'sequence'
            : byte >= 0x20 && byte <= 0x2f ? 'intermediate' : 'plain';
        continue;
      }
      if (mode === 'intermediate') {
        // ESC intermediates (20–2F) precede one final (30–7E).
        // Consume the final even when it is an advertised gameplay key.
        if (byte >= 0x30 && byte <= 0x7e) mode = 'plain';
        continue;
      }
      if (mode === 'sequence') {
        if (byte >= 0x40 && byte <= 0x7e) {
          if (!sequence) {
            const action = { A: 'rotate', B: 'down', C: 'right', D: 'left' }[key];
            if (action) onAction(action);
          }
          mode = 'plain'; sequence = '';
        } else if (byte >= 0x20 && byte <= 0x3f) {
          // Bound memory even for a malformed, never-terminated sequence.
          sequence = 'unknown';
        } else { mode = 'plain'; sequence = ''; }
        continue;
      }
      const action = { p: 'toggle-pause', r: 'restart', q: 'quit', '\x03': 'quit' }[key];
      if (action) onAction(action);
    }
  };
}

export function attachInput(input, session, onQuit) {
  const feed = createInputDecoder(action => {
    if (action === 'quit') { onQuit(); return; }
    if (action === 'toggle-pause') action = session.game.status === 'paused' ? 'resume' : 'pause';
    session.dispatch(action);
  });
  input.on('data', feed);
  return () => input.removeListener('data', feed);
}
