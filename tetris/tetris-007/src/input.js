class KeyDecoder {
  constructor() {
    this.buffer = '';
  }

  push(chunk) {
    this.buffer += chunk.toString();
    const keys = [];

    while (this.buffer) {
      if (this.buffer[0] !== '\x1b') {
        keys.push(this.buffer[0]);
        this.buffer = this.buffer.slice(1);
        continue;
      }

      const match = this.buffer.match(/^\x1b(?:\[|O)([ABCD])/);
      if (match) {
        keys.push(`\x1b[${match[1]}`);
        this.buffer = this.buffer.slice(match[0].length);
        continue;
      }

      if (this.buffer === '\x1b' || /^\x1b(?:\[|O)$/.test(this.buffer)) break;

      // An unsupported escape sequence cannot be a game control. Discard its
      // escape byte, then continue parsing any following ordinary keys.
      this.buffer = this.buffer.slice(1);
    }

    return keys;
  }
}

module.exports = { KeyDecoder };
