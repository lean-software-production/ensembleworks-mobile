const { runTerminal } = require('./game');

if (require.main === module) {
  runTerminal();
}

module.exports = { runTerminal };