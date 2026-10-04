const fs = require('fs');

// Repair the malformed regex in the password-reset email template before Node parses server.js.
const file = 'server.js';
let source = fs.readFileSync(file, 'utf8');
const broken = String.raw`base.replace(/\\/$/, '')`;
const fixed = String.raw`base.replace(/\/$/, '')`;
if (source.includes(broken)) {
  source = source.replaceAll(broken, fixed);
  fs.writeFileSync(file, source);
}
require('./server.js');
