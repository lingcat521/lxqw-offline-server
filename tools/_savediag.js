const H = require('./_harness.js');
H.boot();
let n = 0;
const orig = window.MOCK_SAVE;
window.MOCK_SAVE = function () { n++; return orig.apply(null, arguments); };
let i = 0;
const iv = setInterval(() => {
  console.log('t=' + (++i) + 's  MOCK_SAVE calls=' + n + '  POSTs=' + (global.__posts || 0));
  if (i >= 10) { clearInterval(iv); process.exit(0); }
}, 1000);
