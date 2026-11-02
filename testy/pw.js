// Najde Playwright — cesta se mezi prostředími Claude Code liší
// (/opt/node-tools, /opt/node22/…). Testy ho berou přes require('./pw').
const kandidati = [
  '/opt/node-tools/node_modules/playwright-core',
  '/opt/node22/lib/node_modules/playwright/node_modules/playwright-core',
  'playwright-core', 'playwright',
];
let pw = null;
for (const k of kandidati) { try { pw = require(k); break; } catch (e) { /* další */ } }
if (!pw) throw new Error('Playwright nenalezen — doplňte cestu do testy/pw.js');
module.exports = pw;
// Testy mají místy napevno executablePath z jiného prostředí (chromium-1194);
// když tam prohlížeč není, spustí se ten, který k Playwrightu patří.
if (pw.chromium && !pw.chromium.__cestaOpravena) {
  const fs = require('fs'), puv = pw.chromium.launch.bind(pw.chromium);
  pw.chromium.launch = (o) => {
    if (o && o.executablePath && !fs.existsSync(o.executablePath)) { o = Object.assign({}, o); delete o.executablePath; }
    return puv(o);
  };
  pw.chromium.__cestaOpravena = true;
}
