// Streaming byte decoder. Escape payloads are discarded, never replayed as keys.
export function createInputDecoder(emit) {
  let mode = 'plain';
  let length = 0;
  let stringIsOsc = false;
  const arrows = { A: 'rotate', B: 'down', C: 'right', D: 'left' };
  return function feed(chunk) {
    for (const byte of Buffer.from(chunk)) {
      if (byte === 3) { mode = 'plain'; emit('quit'); continue; }
      if (mode === 'string' || mode === 'string-escape') {
        if ((stringIsOsc && byte === 7) || (mode === 'string-escape' && byte === 92)) mode = 'plain';
        else mode = byte === 27 ? 'string-escape' : 'string';
        continue;
      }
      if (mode === 'escape-intermediate') {
        if (byte === 27) mode = 'escape';
        else if (byte >= 48 && byte <= 126) mode = 'plain';
        continue;
      }
      if (mode === 'escape') {
        length = 0;
        if (byte === 91) mode = 'csi';
        else if (byte === 79) mode = 'ss3';
        else if ([93, 80, 88, 94, 95].includes(byte)) {
          stringIsOsc = byte === 93;
          mode = 'string';
        } else if (byte >= 32 && byte <= 47) mode = 'escape-intermediate';
        else if (byte !== 27) mode = 'plain';
        continue;
      }
      if (mode === 'csi' || mode === 'ss3') {
        if (byte >= 64 && byte <= 126) {
          if (length === 0 && arrows[String.fromCharCode(byte)]) emit(arrows[String.fromCharCode(byte)]);
          mode = 'plain';
        } else if (byte === 27) mode = 'escape';
        else length = 1; // bounded flag: only unmodified cursor sequences are supported
        continue;
      }
      if (byte === 27) { mode = 'escape'; continue; }
      const intent = { p: 'pause', r: 'restart', q: 'quit' }[String.fromCharCode(byte).toLowerCase()];
      if (intent) emit(intent);
    }
  };
}

// Terminal setup/teardown belongs to the caller; this adapter owns only input.
export function attachInput(input, session, onQuit) {
  let closed = false;
  const detach = () => {
    if (closed) return;
    closed = true;
    input.removeListener('data', data);
    input.removeListener('end', end);
  };
  const end = () => { if (!closed) { detach(); session.stop(); onQuit(); } };
  const data = createInputDecoder(intent => {
    if (closed) return;
    if (intent === 'quit') end();
    else session.dispatch(intent);
  });
  input.on('data', data);
  input.on('end', end);
  return detach;
}
