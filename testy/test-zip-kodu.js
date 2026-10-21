// v9.42 — ZIP se zdrojovým kódem programu.
// Past 1: p.evaluate(() => stahnoutKodZip()) čeká na slib a stažení mu zabije
//         kontext → musí být () => { stahnoutKodZip(); }
// Past 2: service worker si po převzetí kontroly stránku sám reloadne
//         (PWA auto-update) a zabije kontext → v testu se vypne jeho
//         REGISTRACE, ne stahování sw.js (ten musí do ZIPu jít).
// Past 3: showSaveFilePicker v headless bez uživatelského gesta nikdy
//         nedoresolvuje → v testu se odstraní, ať se jede cestou stažení.
const { chromium } = require('./pw');
const fs = require('fs'), cp = require('child_process');
const DIR = __dirname;
const res = []; const check = (n, ok, d) => res.push((ok?'✅':'❌')+' '+n+(d?' — '+d:''));

async function stahniZip(url, opts) {
  opts = opts || {};
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1300, height: 900 }, acceptDownloads: true });
  const chyby = []; p.on('pageerror', e => chyby.push(e.message));
  await p.addInitScript(() => {
    try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {}
    try { delete window.showSaveFilePicker; } catch (e) { window.showSaveFilePicker = undefined; }
  });
  if (opts.bezSite) await p.route(/127\.0\.0\.1:8903/, r => r.abort());
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  await p.evaluate(() => showScreen('nastaveni'));
  await p.waitForTimeout(300);
  const t0 = Date.now();
  const cekani = p.waitForEvent('download', { timeout: 90000 });
  await p.evaluate(() => { stahnoutKodZip(); });          // bez await!
  let soubor = null, trvalo = 0;
  try {
    const d = await cekani;
    soubor = DIR + '/_beh/out/' + d.suggestedFilename();
    await d.saveAs(soubor);
    trvalo = Date.now() - t0;
  } catch (e) { /* necháme soubor null */ }
  await b.close();
  return { soubor, trvalo, chyby };
}

(async () => {
  fs.rmSync(DIR + '/_beh/out', { recursive: true, force: true });
  fs.mkdirSync(DIR + '/_beh/out', { recursive: true });

  // ══ 1. PLNÝ ZIP (knihovny dostupné) ═══════════════════════════════
  const plny = await stahniZip('http://127.0.0.1:8904/index.html');
  check('ZIP se stáhne', !!plny.soubor, plny.soubor ? plny.soubor.split('/').pop() : 'nestáhl se');
  if (!plny.soubor) { hotovo(); return; }
  check('název nese verzi', /revize-el-v\d+\.\d+-\d{4}-\d{2}-\d{2}\.zip$/.test(plny.soubor),
    plny.soubor.split('/').pop());
  check('bez chyb stránky', plny.chyby.length === 0, plny.chyby.join(' | '));

  const hlavicka = fs.readFileSync(plny.soubor).slice(0, 2).toString('latin1');
  check('začíná PK', hlavicka === 'PK', hlavicka);

  let test = '';
  try { test = cp.execSync('unzip -t "' + plny.soubor + '"', { encoding: 'utf8' }); } catch (e) { test = 'CHYBA: ' + e.message; }
  check('unzip -t projde (platný ZIP)', /No errors detected/.test(test), test.trim().split('\n').pop());

  const rozbal = DIR + '/_beh/out/rozbaleno';
  cp.execSync('unzip -q -o "' + plny.soubor + '" -d "' + rozbal + '"');
  const je = f => fs.existsSync(rozbal + '/' + f);
  check('obsahuje program', je('index.html') && je('sw.js') && je('manifest.json'));
  check('obsahuje offline variantu', je('index-offline.html'));
  check('obsahuje dokumentaci', je('CLAUDE.md') && je('.github/workflows/pages.yml'));
  check('obsahuje návod', je('JAK-TO-ROZJET.txt'));
  check('obsahuje knihovny', je('knihovny/jspdf.umd.min.js') && je('knihovny/html2canvas.min.js'));
  const pisma = fs.existsSync(rozbal + '/knihovny/pisma')
    ? fs.readdirSync(rozbal + '/knihovny/pisma') : [];
  check('obsahuje písma', pisma.length >= 2, pisma.join(','));
  // vektorové PDF schématu rozvaděče (v9.127): knihovna a písmo z vektor/, bajtově shodné
  const VEKTOR = ['svg2pdf.umd.min.js', 'RobotoCondensed-Regular.ttf', 'RobotoCondensed-Bold.ttf'];
  check('obsahuje vektor/ (svg2pdf a písmo schématu), bajt po bajtu shodné', VEKTOR.every(f => je('vektor/' + f) &&
    Buffer.compare(fs.readFileSync(DIR + '/../vektor/' + f), fs.readFileSync(rozbal + '/vektor/' + f)) === 0), VEKTOR.filter(f => !je('vektor/' + f)).join(','));

  const orig = fs.readFileSync(DIR + '/_beh/zipapp/index.html');
  check('index.html je bajt po bajtu shodný', Buffer.compare(orig, fs.readFileSync(rozbal + '/index.html')) === 0);

  const off = fs.readFileSync(rozbal + '/index-offline.html', 'utf8');
  check('offline varianta nemá externí odkazy', off.indexOf('127.0.0.1:8903') === -1);
  check('offline varianta míří na knihovny/', /src="knihovny\/jspdf/.test(off) && /href="knihovny\/css2\.css"/.test(off),
    (off.match(/knihovny\/[\w.\-]+/g) || []).slice(0,3).join(' '));
  // Porovnání musí být DIFF, ne řádek proti řádku podle pořadí: od v9.46 se
  // z offline varianty vyhazuje i kontrolní otisk (integrity), atributy jsou
  // na vlastních řádcích, takže se tag smrskne a všechno pod ním se posune.
  // Smysl kontroly je „změnily se JEN odkazy na knihovny", ne „přesně 3 řádky".
  fs.writeFileSync(DIR + '/_beh/out/a.html', orig);
  fs.writeFileSync(DIR + '/_beh/out/b.html', off);
  let rozdil = '';
  try { cp.execSync('diff -u "' + DIR + '/_beh/out/a.html" "' + DIR + '/_beh/out/b.html"', { encoding: 'utf8' }); }
  catch (e) { rozdil = e.stdout || ''; }
  const zmeneno = rozdil.split('\n')
    .filter(r => /^[+-]/.test(r) && !/^(\+\+\+|---)/.test(r))
    .map(r => r.slice(1));
  const cizi = zmeneno.filter(r => !/knihovny\/|127\.0\.0\.1:8903|integrity=|crossorigin=|referrerpolicy=|^\s*$/.test(r));
  check('jinak se od originálu neliší', zmeneno.length > 0 && cizi.length === 0,
    'změněných řádků ' + zmeneno.length + ', mimo knihovny: ' + (cizi.slice(0, 2).join(' | ') || 'žádný'));
  check('offline varianta nemá kontrolní otisk (na file:// by neprošel)',
    !/integrity=/.test(off), (off.match(/.{0,40}integrity=.{0,40}/) || ['—'])[0]);

  const css = fs.readFileSync(rozbal + '/knihovny/css2.css', 'utf8');
  check('CSS písem míří na místní soubory', css.indexOf('http') === -1, css.slice(0, 90).replace(/\n/g,' '));

  const navod = fs.readFileSync(rozbal + '/JAK-TO-ROZJET.txt', 'utf8');
  check('návod zmiňuje offline variantu', /index-offline\.html/.test(navod));
  check('návod upozorňuje, že data v ZIPu nejsou', /DATA .* V TOMHLE ZIPU NEJSOU/.test(navod));

  // ══ 2. ROZBALENÝ PROGRAM OPRAVDU BĚŽÍ BEZ SÍTĚ ═══════════════════
  const srv = cp.spawn('python3', ['-m', 'http.server', '8905'], { cwd: rozbal, stdio: 'ignore', detached: true });
  await new Promise(r => setTimeout(r, 1500));
  try {
    const b2 = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
    const p2 = await b2.newPage({ viewport: { width: 1200, height: 800 } });
    const ch2 = []; p2.on('pageerror', e => ch2.push(e.message));
    await p2.addInitScript(() => {
      try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {}
    });
    await p2.route(/127\.0\.0\.1:8903/, r => r.abort());   // „CDN" je mrtvá
    await p2.goto('http://127.0.0.1:8905/index-offline.html', { waitUntil: 'load' });
    await p2.waitForTimeout(1500);
    const stav = await p2.evaluate(async () => {
      aktTyp = 'elektro'; aktPodtyp = 'dum'; novaZprava('elektro');
      await new Promise(r => setTimeout(r, 400));
      return { jspdf: typeof (window.jspdf || {}).jsPDF,
               h2c: typeof window.html2canvas,
               obrazovka: (document.querySelector('.screen.active') || {}).id,
               rozvadecu: document.querySelectorAll('#rozvadece-container [data-rozvadec-id]').length };
    });
    check('rozbalený program se načte bez sítě', stav.obrazovka === 'screen-form', stav.obrazovka);
    check('jsPDF je z přiložené kopie', stav.jspdf === 'function', stav.jspdf);
    check('html2canvas je z přiložené kopie', stav.h2c === 'function', stav.h2c);
    check('jde založit novou zprávu', stav.rozvadecu >= 1, String(stav.rozvadecu));
    check('bez chyb stránky (offline)', ch2.length === 0, ch2.join(' | '));
    await b2.close();
  } finally { try { process.kill(-srv.pid); } catch (e) {} }

  // ══ 3. BEZ SÍTĚ SE ZIP PŘESTO VYROBÍ ═════════════════════════════
  const bez = await stahniZip('http://127.0.0.1:8904/index.html', { bezSite: true });
  check('ZIP vznikne i bez sítě', !!bez.soubor, bez.soubor ? 'ano' : 'ne');
  if (bez.soubor) {
    check('bez sítě to netrvá věčnost (limit v zipStahni)', bez.trvalo < 40000, Math.round(bez.trvalo/1000) + ' s');
    const r2 = DIR + '/_beh/out/rozbaleno-bez';
    cp.execSync('unzip -q -o "' + bez.soubor + '" -d "' + r2 + '"');
    check('program tam je i tak', fs.existsSync(r2 + '/index.html'));
    check('offline varianta se nevyrobí', !fs.existsSync(r2 + '/index-offline.html'));
    const n2 = fs.readFileSync(r2 + '/JAK-TO-ROZJET.txt', 'utf8');
    check('návod přizná, co chybí', /NEPODAŘILO SE STÁHNOUT/.test(n2) && /jspdf/.test(n2),
      (n2.match(/NEPODAŘILO[^\r\n]*/) || [''])[0]);
  }

  hotovo();
  function hotovo() {
    console.log(res.join('\n'));
    process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
  }
})().catch(e => { console.error('CRASH:', e.message); process.exit(2); });
