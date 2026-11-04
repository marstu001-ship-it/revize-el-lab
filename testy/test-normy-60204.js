// Normy – ČSN EN 60204-1 ed. 3 (kontrola dávka 2): citace v katalogu vad
// strojů a nápověda měření poklesu napětí (čl. 12.5).
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901;
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));
async function stranka(b) {
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(900);
  return { p, err };
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const { p, err } = await stranka(b);
  const r = await p.evaluate(() => {
    novaZprava('stroje');
    const kat = getTypickeZavady();
    const pokles = STROJE_MERENI_VYCHOZI.find(m => /poklesu napětí/.test(m.p || ''));
    return { kat, pokles };
  });
  const K = re => r.kat.find(z => re.test(z.popis));
  const kat = [
    [/^Nefunkční nebo chybějící prostředek nouzového zastavení/, 'ČSN EN 60204-1 ed.3, čl. 9.2.3.4.2, 10.7'],
    [/^Chybí výstražné tabulky a bezpečnostní značení/, 'ČSN EN 60204-1 ed.3, čl. 16.2'],
    [/^Poškozená izolace nebo mechanická ochrana přívodního kabelu/, 'ČSN EN 60204-1 ed.3, kap. 12 (vodiče a kabely), čl. 13.5']
  ];
  for (const [re, n] of kat) { const z = K(re); check('katalog strojů: ' + String(re).slice(2, 50) + ' → ' + n, z && z.norma === n, z ? z.norma : 'nenalezeno'); }
  check('katalog strojů: nikde čl. 9.2.5.4 ani 16.1', !r.kat.some(z => /9\.2\.5\.4|čl\. 16\.1\b/.test(z.norma)));
  check('měření poklesu napětí: „(12.5)" a v nápovědě čl. 12.5, ne 4.3.2',
    r.pokles && r.pokles.p === 'měření poklesu napětí (12.5)' && /ČSN EN 60204-1 ed\.3, čl\. 12\.5\)/.test(r.pokles.tip) && !/4\.3\.2/.test(r.pokles.p + r.pokles.tip), r.pokles && r.pokles.p);
  check('bez chyb stránky', !err.length, err.join(' | '));
  console.log(res.join('\n'));
  await b.close();
  process.exit(res.some(x => x.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.error('CRASH:', e.message); process.exit(2); });
