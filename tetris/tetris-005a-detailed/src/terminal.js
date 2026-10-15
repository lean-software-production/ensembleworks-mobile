"use strict";

/**
 * Own the terminal modes used by the interactive entry point. Cleanup is safe
 * to call from a quit key, a signal, or an error path in any order.
 */
function createTerminalSession({ input, output, processRef = process, onTerminate = () => {} }) {
  let active = false;
  const signals = ["SIGINT", "SIGTERM"];

  function terminate() {
    onTerminate();
  }

  function start(startApp) {
    if (active) return;
    active = true;
    try {
      input.setRawMode?.(true);
      input.resume?.();
      output.write("\x1b[?1049h\x1b[?25l");
      for (const signal of signals) processRef.once(signal, terminate);
      startApp();
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  function cleanup() {
    if (!active) return;
    active = false;
    for (const signal of signals) processRef.removeListener?.(signal, terminate);
    input.setRawMode?.(false);
    input.pause?.();
    // Show the cursor before leaving the alternate screen so the normal
    // terminal is usable even if a game frame was only partly drawn.
    output.write("\x1b[?25h\x1b[?1049l");
  }

  return { start, cleanup, get active() { return active; } };
}

module.exports = { createTerminalSession };
