// Rozvaděč — kdo koho napájí (připomínka 2026-11-05, rozvaděč RS2 ve škole).
// Test hlídá:
//  - datový model napájení (rozvDeti, rozvPotomci, kruh, upozornění In, smazání → automatika),
//  - volbu „Napájen z" v panelu a „→ napájí",
//  - režim 🔌 Zapojení: vodiče ze svorky na svorku (barvy fází, trasy mezerami), tažení ze svorky,
//    strana vstupu, přepojení a odpojení koncem vodiče, klik a klik, rámeček, Ctrl+Z, kontextové menu,
//    telefon 360 px (klepnutí, dlouhý stisk svorky),
//  - jednopólové schéma: řetěz FU1 → SPD1, skupina FI1 (20 sloupců), samostatné vývody,
//    skupina pod jističem, podskupina, přívodní svorky, vložka,
//  - fáze a soudobost bez dvojího započtení napájecího přístroje,
//  - (commit 2) svorková lišta, přípojnice N/PE, obecné položky, import CSV,
//  - (commit 3) „nechat prázdné" a dokumentace pro jiného výrobce,
//  - starý rozvaděč (předchozí verze na STARA_PORT) beze změny: data, schéma, PDF, DXF.
// Všechna data vymyšlená.
const { chromium } = require('./pw');
const path = require('path');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const STARA = process.env.STARA_PORT || 8902, URL_STARA = 'http://127.0.0.1:' + STARA + '/index.html';
const res = []; const check = (n, ok, d) => { const t = (ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''); res.push(t); if (process.env.LADIT) console.log(t); };
const w = ms => new Promise(r => setTimeout(r, ms));
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SNIMKY = process.env.SNIMKY || '';

async function kontext(b, o) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1366, height: 900 } }, o || {}));
  await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: path.join(__dirname, 'knihovny', r.request().url().split('/').pop()),
    contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  return ctx;
}
async function stranka(ctx, url, err) {
  const p = await ctx.newPage();
  p.on('pageerror', e => err.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(url); await w(1000);
  await p.evaluate('window.__rs2 = ' + require('./rozvadec-rs2.js').toString());
  await p.evaluate(() => {
    STORE.technik = Object.assign({}, STORE.technik, { jmeno: 'Petr Vymyšlený', firma: 'Vymyšlená elektro s.r.o.', ico: '12345678', mesto: 'Kyjov', ulice: 'Polní 1', psc: '697 01' });
    saveStore();
    window.__T = {
      w: ms => new Promise(r => setTimeout(r, ms)),
      dk: (s, v) => { const e = dokForm().querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); },
      cist: () => DOK_TYPY.rozv.cist(dokForm()),
      naj: o => { let r = null; __rz.rady.forEach(a => a.prvky.forEach(x => { if (x.ozn === o) r = x; })); return r; },
      // střed přístroje (nebo horní / spodní okraj) v souřadnicích okna
      bod(ozn, kde) {
        const x = __T.naj(ozn), g = rozvGeom().filter(q => q.uid === x.uid)[0];
        const svg = document.querySelector('#rz-pohled .rz-svg'), M = svg.getScreenCTM();
        const y = kde === 'dole' ? g.y + RZG.H - 6 : kde === 'nahore' ? g.y + 6 : g.y + RZG.H / 2;
        let pt = new DOMPoint(g.x + g.w / 2, y).matrixTransform(M);
        if (pt.y < 60 || pt.y > innerHeight - 40) { window.scrollBy(0, pt.y - innerHeight / 2); pt = new DOMPoint(g.x + g.w / 2, y).matrixTransform(svg.getScreenCTM()); }
        const ram = document.getElementById('rz-svg-ram'), rb = ram && ram.getBoundingClientRect();
        if (rb && (pt.x < rb.left + 10 || pt.x > rb.right - 10 || pt.y < rb.top + 10 || pt.y > rb.bottom - 10)) {
          ram.scrollLeft += pt.x - (rb.left + rb.width / 2); ram.scrollTop += pt.y - (rb.top + rb.height / 2); pt = new DOMPoint(g.x + g.w / 2, y).matrixTransform(svg.getScreenCTM()); }
        return { x: pt.x, y: pt.y };
      },
      // režim Zapojení: svorky, úchyty a vodiče
      u: o => o === '@privod' ? '@privod' : __T.naj(o).uid,
      videt(el) {
        let b = el.getBoundingClientRect();
        if (b.top < 70 || b.bottom > innerHeight - 50) { window.scrollBy(0, b.top - innerHeight / 2); b = el.getBoundingClientRect(); }
        const ram = document.getElementById('rz-svg-ram'), rb = ram && ram.getBoundingClientRect();
        if (rb && (b.left < rb.left + 10 || b.right > rb.right - 10)) { ram.scrollLeft += b.left - (rb.left + rb.width / 2); b = el.getBoundingClientRect(); }
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      },
      sv(o, s, k) { const e = document.querySelector('#rz-pohled [data-sv="' + __T.u(o) + '|' + s + '|' + (k || 0) + '"]'); return e ? __T.videt(e) : null; },
      uch(src, dst, konec, dp) { const e = document.querySelector('#rz-pohled .rz-uch-g[data-wire-src="' + __T.u(src) + '"][data-wire-dst="' + __T.u(dst) + '"]' + (dp != null ? '[data-dst-pol="' + dp + '"]' : '') + ' [data-uchyt="' + konec + '"]'); return e ? __T.videt(e) : null; },
      draty(src, dst) {
        return Array.from(document.querySelectorAll('#rz-pohled .rz-wire' + (src ? '[data-wire-src="' + __T.u(src) + '"]' : '') + (dst ? '[data-wire-dst="' + __T.u(dst) + '"]' : ''))).map(g => ({
          faze: g.getAttribute('data-wire-faze'), sp: g.getAttribute('data-src-pol'), dp: g.getAttribute('data-dst-pol'), a: g.getAttribute('data-a'), b: g.getAttribute('data-b'),
          auto: g.classList.contains('rz-wire-auto'), barva: g.querySelector('.rz-w').getAttribute('stroke'), dash: g.querySelector('.rz-w').getAttribute('stroke-dasharray') }));
      },
      svBod(o, s, k) { const x = __T.naj(o), g = rozvGeom().filter(z => z.uid === x.uid)[0], q = rozvSvorkaBod(g, x, s, k || 0); return rozvZaokr(q.x) + ' ' + rozvZaokr(q.y); },
      mmBod(x, y) { const M = document.querySelector('#rz-pohled .rz-svg').getScreenCTM(), q = new DOMPoint(x, y).matrixTransform(M); return { x: q.x, y: q.y }; },
      async rs2() {
        await dokNovy('rozv');
        __T.dk('[data-dk="oznaceni"]', 'RS2'); __T.dk('[data-dk="stavba"]', 'Vymyšlená škola'); __T.dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S');
        __T.dk('[data-dk="privodKabel"]', 'CYKY'); __T.dk('[data-dk="privodPrurez"]', '5×10'); __T.dk('[data-dk="privodIn"]', '63');
        rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel'));
        window.__rs2(window.__rs2o);
        await dokUlozitOtevreny();
      }
    };
  });
  return p;
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const err = [];
  const ctx = await kontext(b, { viewport: { width: 1366, height: 1500 } });   // celý rozvaděč 4×24 na obrazovce (tažení mezi řadami)
  const p = await stranka(ctx, URL, err);

  // ── 1. model napájení na RS2 ───────────────────────────────────────────
  const m = await p.evaluate(async () => {
    await __T.rs2();
    const n = __T.naj, r = {};
    r.spdNadr = n('-FU1') && n('SPD1') && n('SPD1').nadr === n('-FU1').uid;
    r.fuDeti = rozvDeti(n('-FU1').uid).map(x => x.ozn).join();
    r.fiDeti = rozvDeti(n('-FI1').uid).map(x => x.ozn);
    r.fiPot = rozvPotomci(n('-FI1').uid).length;
    r.b10 = ['-FA1', '-FA22', '-FA23', '-FA24'].map(o => n(o).nadr === '').every(Boolean);
    r.nadrzeny = (rozvNadrazeny(n('-FA30')) || {}).ozn + '|' + (rozvNadrazeny(n('-FA1')) === null);
    r.koren = rozvKoren(__rz.rady) === n('-QH1').uid && rozvMaNapajeni(n('-QH1')) && rozvDeti('@privod').map(x => x.ozn).join() === '-QH1';
    // kruh: -FU1 napájený z -SPD1, když SPD1 je dítě FU1
    r.kruhLze = rozvLzeNapajet(n('SPD1'), n('-FU1'));
    r.kruhLze2 = rozvLzeNapajet(n('-FA25'), n('-FI1'));
    const ozn0 = n('-FU1').nadr;
    rozvNapajeniNastavit([n('-FU1').uid], n('SPD1').uid);
    r.kruhNic = n('-FU1').nadr === ozn0 && n('-FU1').nadrRucne !== true;
    // upozornění: B16 pod B10
    rozvNapajeniNastavit([n('-FA30').uid], n('-FA2').uid);
    r.upozIn = rozvNapajeniUpoz(n('-FA30')).join(' | ');
    r.upoz3f = (rozvNapajeniNastavit([n('-FA23').uid], n('-FA3').uid), rozvNapajeniUpoz(n('-FA23')).join(' | '));
    zpetPosledni(); zpetPosledni();
    r.zpet = n('-FA30').nadr === n('-FI1').uid && n('-FA23').nadr === '';
    // fáze a soudobost: napájecí přístroj větve se nepočítá dvakrát
    n('-FA23').pi = '9'; n('-FA24').pi = '5';
    const d0 = __T.cist(); r.soud0 = rozvSoudVypocet(d0).skupiny.reduce((s, q) => s + q.pi, 0);
    r.vyvodu0 = rozvFazeSouhrn(d0.rady).vyvodu;
    // smazání -FU1 vrátí -SPD1 na automatiku
    rozvSmazat(n('-FU1').uid);
    r.poSmaz = n('SPD1').nadr === '' && n('SPD1').nadrRucne === false;
    zpetPosledni(); await __T.w(50);
    r.vraceno = n('-FU1') && n('SPD1').nadr === n('-FU1').uid;
    return r;
  });
  check('RS2: -SPD1 napájený z -FU1, -FU1 napájí jen -SPD1', m.spdNadr && m.fuDeti === 'SPD1', m.fuDeti);
  check('RS2: -FI1 napájí -FA25…-FA44 (20 jističů)', m.fiDeti.length === 20 && m.fiDeti[0] === '-FA25' && m.fiDeti[19] === '-FA44' && m.fiPot === 20, m.fiDeti.join());
  check('RS2: B10 a B40 přímo z hlavního vypínače, -QH1 je kořen napájený z přívodu (rozvDeti(\'@privod\') = -QH1)', m.b10 && m.koren && m.nadrzeny === '-FI1|true', m.nadrzeny);
  check('kruh: -FU1 z -SPD1 (SPD1 je dítě FU1) se odmítne, nic se nezmění', m.kruhLze === false && m.kruhLze2 === false && m.kruhNic);
  check('upozornění: B16 pod B10 → jmenovitý proud větší než u nadřazeného', /16 A je větší než u nadřazeného -FA2 \(10 A\)/.test(m.upozIn), m.upozIn);
  check('upozornění: třífázový přístroj pod jednofázovým', /třífázový přístroj pod jednofázovým -FA3/.test(m.upoz3f), m.upoz3f);
  check('Ctrl+Z / ZPĚT vrátí ruční napájení', m.zpet);
  check('smazání -FU1 vrátí -SPD1 na automatiku (nadr \'\'), ZPĚT ho vrátí', m.poSmaz && m.vraceno);

  // ── 2. panel vlastností „Napájen z" ────────────────────────────────────
  const pan = await p.evaluate(async () => {
    const n = __T.naj, r = {};
    rozvVybrat(n('-FI1').uid, false); await __T.w(50);
    r.fi = document.getElementById('rz-vlastnosti').innerText;
    rozvVybrat(n('-FA25').uid, false); await __T.w(50);
    const sel = document.querySelector('#rz-vlastnosti [data-rp2="nadr"]');
    r.label = sel.closest('.f').querySelector('label').textContent;
    r.volby = Array.from(sel.options).map(o => o.textContent);
    r.vybrano = sel.options[sel.selectedIndex].textContent;
    sel.value = n('-FA23').uid; sel.dispatchEvent(new Event('change', { bubbles: true })); await __T.w(50);
    r.nove = n('-FA25').nadr === n('-FA23').uid && n('-FA25').nadrRucne === true;
    r.fa23 = (rozvVybrat(n('-FA23').uid, false), document.getElementById('rz-vlastnosti').innerText);
    zpetPosledni(); await __T.w(50);
    r.zpet = n('-FA25').nadr === n('-FI1').uid;
    rozvVybrat(n('-QH1').uid, false); r.qh = Array.from((document.querySelector('#rz-vlastnosti [data-rp2="nadr"]') || { options: [] }).options).map(o => o.textContent).join(' | ');
    rozvVybrat(n('SPD1').uid, false); r.spd = !!document.querySelector('#rz-vlastnosti [data-rp2="nadr"]');
    rozvVybrat(n('-FU1').uid, false); r.vlozka = !!document.querySelector('#rz-vlastnosti [data-rp2="vlozka"]');
    __rz.vyber = null; rozvVlastnostiVykreslit();
    return r;
  });
  check('panel: volba se jmenuje „Napájen z", první automaticky, pak „z přívodu (před hlavním vypínačem)" a „přímo z hlavního vypínače"', pan.label === 'Napájen z' && /^automaticky — -FI1/.test(pan.volby[0]) &&
    pan.volby[1] === 'z přívodu (před hlavním vypínačem)' && pan.volby[2] === 'přímo z hlavního vypínače', pan.volby.slice(0, 3).join(' | '));
  check('panel: nabídka -FU1 Pojistkový…, -FI1 Chránič 40 A/30 mA 4P, -FA23 Jistič B40 3P; bez sebe a bez -QH1', pan.volby.some(v => /^-FU1 Pojistkový/.test(v)) &&
    pan.volby.indexOf('-FI1 Chránič 40 A/30 mA 4P') !== -1 && pan.volby.indexOf('-FA23 Jistič B40 3P') !== -1 && !pan.volby.some(v => /^-FA25 /.test(v) || /^-QH1/.test(v)), pan.volby.slice(2, 6).join(' | '));
  check('panel: u nadřazeného řádek „→ napájí: -FA25…FA44"', /→ napájí: -FA25…FA44/.test(pan.fi), pan.fi.match(/→ napájí[^\n]*/) + '');
  check('panel: změna volby zapíše nadr (ručně), -FA23 pak „→ napájí: -FA25", ZPĚT vrátí', pan.nove && /→ napájí: -FA25/.test(pan.fa23) && pan.zpet);
  check('panel: hlavní vypínač má volbu „Napájen z" (z přívodu / svorky / přístroje před ním), svodič taky; pojistka má pole Vložka', /^z přívodu( \||$)/.test(pan.qh) && !/-FA|-FI/.test(pan.qh) && pan.spd && pan.vlozka, pan.qh);

  // ── 3. režim 🔌 Zapojení: vodiče ze svorky na svorku ──────────────────
  await p.evaluate(() => { TD_AKCE.tdRNapRezim(); document.querySelectorAll('.toast').forEach(t => t.remove()); });
  await w(150);
  const rez = await p.evaluate(() => {
    const qh = __T.naj('-QH1'), fi = __T.naj('-FI1'), r = {};
    const btn = document.querySelector('.rz-nap-btn');
    r.btn = btn.getAttribute('aria-pressed') + '|' + btn.textContent.trim();
    r.napoveda = document.querySelector('#rz-pohled .rz-napoveda').innerText;
    r.banner = document.querySelector('.rz-banner-nap').innerText;
    r.vyvodka = !!document.querySelector('#rz-pohled [data-nap-privod]');
    r.privQh = __T.draty('@privod', '-QH1').map(d => d.faze + ':' + d.dp + ':' + d.barva).join();
    r.privQhB = __T.draty('@privod', '-QH1').every((d, k) => d.b === __T.svBod('-QH1', 'nahore', k));
    const fiW = __T.draty('-FI1');
    r.fi = fiW.length + '|' + fiW.every(d => d.auto && d.dash) + '|' + fiW.every(d => d.a.split(' ')[1] === __T.svBod('-FI1', 'dole', 0).split(' ')[1]);
    r.fiB = fiW.every(d => { const o = rozvNajit(d.b && document.querySelector('#rz-pohled .rz-wire[data-wire-src="' + fi.uid + '"][data-b="' + d.b + '"]').getAttribute('data-wire-dst')).x.ozn; return d.b === __T.svBod(o, 'nahore', 0); });
    const vod = rozvVodice(__rz); rozvVodiceTrasy(__rz, vod);
    r.fiSk = new Set(vod.filter(v => v.src === fi.uid).map(v => v.sk)).size;
    r.qhVys = vod.filter(v => v.src === qh.uid).every(v => v.as === 'dole') && vod.filter(v => v.src === qh.uid && rozvNajit(v.dst).x.ozn === '-FA1').length === 1;
    r.qhSk = new Set(vod.filter(v => v.src === qh.uid).map(v => v.sk)).size + '/' + vod.filter(v => v.src === qh.uid).length;
    r.fuSpd = __T.draty('-FU1', 'SPD1').map(d => (d.auto ? 'auto' : 'ruční') + ':' + d.faze).join();
    r.svorek = document.querySelectorAll('#rz-pohled [data-sv-uid="' + qh.uid + '"] .rz-sv').length + '|' + document.querySelectorAll('#rz-pohled [data-sv-uid="' + __T.naj('-FA25').uid + '"] .rz-sv').length;
    // geometrie: pravoúhle, nikdy přes obdélník přístroje
    const rects = rozvGeom().map(g => ({ uid: g.uid, x: g.x, y: g.y, w: g.w, h: g.h || RZG.H }));
    let sikme = 0; const pres = [];
    vod.forEach(v => { for (let i = 1; i < v.body.length; i++) { const a = v.body[i - 1], b = v.body[i];
      if (Math.abs(a[0] - b[0]) > 0.01 && Math.abs(a[1] - b[1]) > 0.01) sikme++;
      const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]), y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]), e = 0.05;
      rects.forEach(q => { if (x2 > q.x + e && x1 < q.x + q.w - e && y2 > q.y + e && y1 < q.y + q.h - e) pres.push(rozvNajit(v.src === '@privod' ? v.dst : v.src).x.ozn + '→' + rozvNajit(v.dst).x.ozn + ' přes ' + rozvNajit(q.uid).x.ozn); }); } });
    r.geo = { vodicu: vod.length, sikme, pres: pres.slice(0, 5).join(', ') };
    return r;
  });
  check('režim Zapojení: tlačítko „🔌 Zapojení" zapnuté, nápověda „Táhněte ze svorky na svorku (horní i dolní)…"', /^true\|🔌 Zapojení/.test(rez.btn) &&
    rez.napoveda.indexOf('Táhněte ze svorky na svorku (horní i dolní)') !== -1 && /na vstupní svorky se připojuje paralelně/.test(rez.napoveda) && /skrýt automatická spojení/.test(rez.banner) && !/Napájí…/.test(rez.banner), rez.btn);
  check('vývodka přívodu; z přívodu do -QH1 tři vodiče L1 hnědá, L2 černá, L3 šedá na póly 1, 3, 5 (vstupní svorky nahoře)', rez.vyvodka &&
    rez.privQh === 'L1:0:#8B4513,L2:1:#1c1c1c,L3:2:#8c8c8c' && rez.privQhB, rez.privQh);
  check('svorky po pólech: -QH1 3P 3 + 3, -FA25 1P 1 + 1', rez.svorek === '6|2', rez.svorek);
  check('-FI1 → -FA25…FA44: 20 automatických (čárkovaných) vodičů z výstupní svorky dole na vstupní svorky nahoře, jedna společná sběrnice', rez.fi === '20|true|true' && rez.fiB && rez.fiSk <= 2, rez.fi + ' sk ' + rez.fiSk);
  check('-QH1: výstup dole → vodiče k -FA1… (sousední v řadě sdílejí sběrnici)', rez.qhVys && +rez.qhSk.split('/')[0] < +rez.qhSk.split('/')[1], rez.qhSk);
  check('-FU1 → SPD1 ruční vodič (plný)', /^ruční:/.test(rez.fuSpd), rez.fuSpd);
  check('geometrie: vodiče pravoúhle mezerami a žlaby, žádný úsek přes obdélník přístroje', rez.geo.vodicu > 40 && rez.geo.sikme === 0 && rez.geo.pres === '', JSON.stringify(rez.geo));
  // klepnutí na tělo jen vybere
  let a = await p.evaluate(() => __T.bod('-FA20')); await p.mouse.click(a.x, a.y); await w(120);
  check('klepnutí na tělo přístroje ho jen vybere (žádné zapojování)', await p.evaluate(() => __rz.vyber === __T.naj('-FA20').uid && !__rz.napZdroj));
  await p.keyboard.press('Escape'); await w(60);
  // tažení z výstupní svorky -FI1 na vstupní svorku -FA20
  const poz0 = await p.evaluate(() => JSON.stringify(__rz.rady.map(r => r.prvky.map(x => x.uid))));
  a = await p.evaluate(() => __T.sv('-FI1', 'dole', 0)); let c = await p.evaluate(() => __T.sv('-FA20', 'nahore', 0));
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x + 15, a.y + 10, { steps: 4 }); await p.mouse.move(c.x, c.y, { steps: 12 });
  const tahCara = await p.evaluate(() => document.getElementById('rz-nap-tah').getAttribute('visibility'));
  await p.mouse.up(); await w(150);
  const tah = await p.evaluate(() => ({ ok: __T.naj('-FA20').nadr === __T.naj('-FI1').uid && __T.naj('-FA20').nadrRucne === true && !('vstup' in __T.naj('-FA20')),
    poz: JSON.stringify(__rz.rady.map(r => r.prvky.map(x => x.uid))), d: __T.draty('-FI1', '-FA20')[0] }));
  check('tažení z výstupní svorky -FI1 na vstupní svorku -FA20: zapojeno (ruční, plný vodič), gumový vodič během tažení, přístroje se nepřesunou', tah.ok && tahCara === 'visible' && tah.poz === poz0 && tah.d && !tah.d.auto, JSON.stringify(tah.d));
  await p.keyboard.press('Control+z'); await w(150);
  check('Ctrl+Z vrátí zapojení tažením', await p.evaluate(() => __T.naj('-FA20').nadr === ''));
  // tažení na SPODNÍ svorku → vstup zespodu, bez dotazu
  a = await p.evaluate(() => __T.sv('-FA23', 'dole', 0)); c = await p.evaluate(() => __T.sv('-FA19', 'dole', 0));
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x + 10, a.y + 12, { steps: 4 }); await p.mouse.move(c.x, c.y, { steps: 12 }); await p.mouse.up(); await w(150);
  const dole = await p.evaluate(() => ({ x: __T.naj('-FA19').nadr === __T.naj('-FA23').uid && __T.naj('-FA19').vstup === 'dole', d: (__T.draty('-FA23', '-FA19')[0] || {}).b, sv: __T.svBod('-FA19', 'dole', 0),
    dlg: !!document.querySelector('.modal-overlay.open'), panel: (rozvVybrat(__T.naj('-FA19').uid, false), document.getElementById('rz-vlastnosti').innerText) }));
  check('tažení na spodní svorku -FA19: napájen zespodu (x.vstup \'dole\') bez dotazu, vodič vede do spodních svorek', dole.x && dole.d === dole.sv && !dole.dlg, JSON.stringify(dole).slice(0, 160));
  check('panel: „Napájen: zespodu" s přepnutím jedním klepnutím', /Napájen: zespodu/.test(dole.panel) && await p.evaluate(() => !!document.querySelector('#rz-vlastnosti [data-action="tdRVstup"]')));
  await p.keyboard.press('Escape'); await w(60);
  a = await p.evaluate(() => __T.sv('-FA23', 'dole', 0)); c = await p.evaluate(() => __T.sv('-FA19', 'nahore', 0));
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x + 10, a.y + 12, { steps: 4 }); await p.mouse.move(c.x, c.y, { steps: 12 }); await p.mouse.up(); await w(150);
  check('tažení na horní svorku → zase shora (klíč vstup se smaže, je výchozí)', await p.evaluate(() => !('vstup' in __T.naj('-FA19')) && __T.naj('-FA19').nadr === __T.naj('-FA23').uid));
  await p.keyboard.press('Control+z'); await w(120); await p.keyboard.press('Control+z'); await w(150);
  check('Ctrl+Z ×2 vrátí obojí', await p.evaluate(() => __T.naj('-FA19').nadr === '' && !('vstup' in __T.naj('-FA19'))));
  // v1.62: tažení z HORNÍ (vstupní) svorky napájeného -FA24 → -FA18 paralelně na vstup -FA24 (stejný zdroj), vodič z horní svorky -FA24
  a = await p.evaluate(() => __T.sv('-FA24', 'nahore', 0)); c = await p.evaluate(() => __T.sv('-FA18', 'nahore', 0));
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x + 10, a.y - 12, { steps: 4 }); await p.mouse.move(c.x, c.y, { steps: 12 }); await p.mouse.up(); await w(150);
  const prev = await p.evaluate(() => { const d = __T.draty('-FA24', '-FA18')[0] || {}, x = __T.naj('-FA18'); return { ok: x.nadr === '' && x.nadrRucne === true && x.pres && x.pres.uid === __T.naj('-FA24').uid && !('vstup' in __T.naj('-FA24')), a: d.a, sv: __T.svBod('-FA24', 'nahore', +d.sp || 0) }; });
  check('tažení z horní (vstupní) svorky -FA24: -FA18 paralelně na vstup -FA24 (stejný zdroj — hlavní vypínač), vodič začíná na horní svorce -FA24', prev.ok && prev.a === prev.sv, JSON.stringify(prev));
  await p.keyboard.press('Control+z'); await w(150);
  check('Ctrl+Z vrátí i stranu zdroje', await p.evaluate(() => __T.naj('-FA18').nadr === '' && !('vstup' in __T.naj('-FA24'))));
  // nepřípustný cíl (kruh): -FA25 → -FI1
  a = await p.evaluate(() => __T.sv('-FA25', 'dole', 0)); c = await p.evaluate(() => __T.sv('-FI1', 'nahore', 0));
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x + 8, a.y + 8, { steps: 3 }); await p.mouse.move(c.x, c.y, { steps: 10 });
  const cervena = await p.evaluate(() => document.getElementById('rz-nap-tah').getAttribute('stroke'));
  await p.mouse.up(); await w(150);
  check('tažení na nepřípustný cíl (kruh): čára červená, nic se neuloží', cervena === '#c0392b' && await p.evaluate(() => __T.naj('-FI1').nadr === ''), cervena);
  // klik a klik: výstupní svorka -FA23, pak tři jističe
  a = await p.evaluate(() => __T.sv('-FA23', 'dole', 0)); await p.mouse.click(a.x, a.y); await w(120);
  for (const o of ['-FA19', '-FA20', '-FA21']) { const q = await p.evaluate(o => __T.bod(o), o); await p.mouse.click(q.x, q.y); await w(120); }
  const kk = await p.evaluate(() => ({ ok: ['-FA19', '-FA20', '-FA21'].every(o => __T.naj(o).nadr === __T.naj('-FA23').uid),
    zdroj: __rz.napZdroj === __T.naj('-FA23').uid, banner: document.querySelector('.rz-banner-nap').innerText }));
  check('klik a klik: výstupní svorka -FA23, pak -FA19, -FA20, -FA21 → napájené z -FA23', kk.ok && kk.zdroj && /Napájí -FA23/.test(kk.banner), kk.banner);
  const q21 = await p.evaluate(() => __T.bod('-FA21')); await p.mouse.click(q21.x, q21.y); await w(120);
  check('klik a klik: další klik na napájený ho ubere', await p.evaluate(() => __T.naj('-FA21').nadr === ''));
  await p.keyboard.press('Escape'); await w(80);
  check('Esc ukončí výběr napájejícího', await p.evaluate(() => !__rz.napZdroj));
  for (let i = 0; i < 4; i++) { await p.keyboard.press('Control+z'); await w(100); }
  check('Ctrl+Z vrátí kroky klik a klik (každý jedna operace)', await p.evaluate(() => ['-FA19', '-FA20', '-FA21'].every(o => __T.naj(o).nadr === '')));
  // rámeček + „Napájet z…"
  const r1 = await p.evaluate(() => { const g = rozvGeom().filter(q => q.r === 1); return { a: __T.mmBod(g[0].x - 1, g[0].y + 8), b: __T.mmBod(g[2].x + g[2].w - 2, g[2].y + 20) }; });
  await p.mouse.move(r1.a.x, r1.a.y); await p.mouse.down(); await p.mouse.move(r1.b.x, r1.b.y, { steps: 8 }); await p.mouse.up(); await w(150);
  const vyb = await p.evaluate(() => rozvVybrane().map(u => rozvNajit(u).x.ozn).join());
  await p.evaluate(() => document.querySelector('[data-action="tdRNapZ"]').click()); await w(100);
  const ceka = await p.evaluate(() => document.querySelector('.rz-banner-nap').innerText);
  const qf = await p.evaluate(() => __T.bod('-FA24')); await p.mouse.click(qf.x, qf.y); await w(150);
  const ram = await p.evaluate(() => ['-FA15', '-FA16', '-FA17'].map(o => __T.naj(o).nadr === __T.naj('-FA24').uid).join());
  check('rámeček + „Napájet z…" + klepnutí na -FA24 nastaví napájení všem vybraným', vyb === '-FA15,-FA16,-FA17' && /Klepněte na přístroj \(nebo vývodku přívodu\), který napájí vybrané \(3 přístroje\)/.test(ceka) && ram === 'true,true,true', vyb + ' | ' + ram + ' | ' + ceka);
  // klepnutí na vodič vybere, panel Z / Na, Delete odpojí
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  a = await p.evaluate(() => __T.uch('-FA24', '-FA16', 'dst')); await p.mouse.click(a.x, a.y); await w(150);
  const vod1 = await p.evaluate(() => ({ v: !!__rz.napVodic, panel: document.getElementById('rz-vlastnosti').innerText }));
  check('klepnutí na vodič ho vybere: panel „Z: -FA24 (L…) → Na: -FA16 pól 1", Odpojit, Vrátit na automatiku', vod1.v && /Z: -FA24 \(L\d\) → Na: -FA16 pól 1/.test(vod1.panel) && /Odpojit/.test(vod1.panel) && /Vrátit na automatiku/.test(vod1.panel), vod1.panel.slice(0, 120));
  await p.keyboard.press('Delete'); await w(150);
  check('Delete vybraný vodič odpojí (-FA16 zpátky na automatiku), toast „Odpojeno"', await p.evaluate(() => __T.naj('-FA16').nadr === '' && __T.naj('-FA16').nadrRucne === false && __T.naj('-FA15').nadr === __T.naj('-FA24').uid &&
    Array.from(document.querySelectorAll('.toast')).some(t => /Odpojeno: -FA16/.test(t.textContent))));
  await p.keyboard.press('Control+z'); await w(150);
  check('Ctrl+Z vrátí odpojený vodič', await p.evaluate(() => __T.naj('-FA16').nadr === __T.naj('-FA24').uid));
  // pravé tlačítko na vodiči
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  a = await p.evaluate(() => __T.uch('-FA24', '-FA16', 'dst'));
  await p.mouse.click(a.x, a.y, { button: 'right' }); await w(150);
  const menu = await p.evaluate(() => Array.from(document.querySelectorAll('.kt-menu button, .kt-menu [role="menuitem"]')).map(x => x.textContent.trim()));
  await p.evaluate(() => { const b = Array.from(document.querySelectorAll('.kt-menu button, .kt-menu [role="menuitem"]')).filter(x => /Odpojit/.test(x.textContent))[0]; if (b) b.click(); }); await w(150);
  check('pravý klik na vodiči: Odpojit — vrátit na automatiku; → -FA16 z hlavního vypínače', menu.some(t => /Odpojit — vrátit na automatiku/.test(t)) &&
    await p.evaluate(() => __T.naj('-FA16').nadr === '' && __T.naj('-FA15').nadr === __T.naj('-FA24').uid), menu.join(' | '));
  // skrýt automatická spojení
  const skryt = await p.evaluate(async () => { const cb = document.querySelector('.rz-nap-skryt'); cb.click(); await __T.w(80);
    const r = __T.draty('-FI1').length + '|' + __T.draty('-FA24', '-FA15').length; document.querySelector('.rz-nap-skryt').click(); await __T.w(80); return r; });
  check('„skrýt automatická spojení" schová čárkované vodiče (FI1 → FA25…), ruční zůstanou', skryt === '0|1', skryt);
  if (SNIMKY) { await p.evaluate(() => { document.querySelectorAll('.toast').forEach(t => t.remove()); __rz.vyber = null; __rz.vic = null; rozvPohledVykreslit(); }); await (await p.$('#rz-pohled')).screenshot({ path: path.join(SNIMKY, 'rs2-zapojeni-zakladni.png') }); }
  await p.evaluate(() => { TD_AKCE.tdRNapRezim(); });
  check('mimo režim Zapojení vodiče ani svorky nejsou', await p.evaluate(() => !document.querySelector('#rz-pohled .rz-nap-vrstva')));
  await p.evaluate(() => { rozvNapajeniNastavit(['-FA15', '-FA17'].map(o => __T.naj(o).uid), ''); });

  // ── 4. jednopólové schéma RS2 ─────────────────────────────────────────
  const sch = await p.evaluate(async () => {
    __T.naj('-FU1').vlozka = '40 gG';
    const d = __T.cist(), m = rsModel(d), listy = rozvSchemaListy(d), svg = listy.map(l => l.svg).join('');
    const box = document.createElement('div'); box.innerHTML = listy[1].svg; document.body.appendChild(box);
    const fu = box.querySelector('[data-puid="' + __T.naj('-FU1').uid + '"]'), sp = box.querySelector('[data-puid="' + __T.naj('SPD1').uid + '"]');
    const r = {
      jedn: m.jedn.map(u => (u.fi ? u.fi.ozn + ':' : '') + u.sloupce.length),
      retez: Object.keys(m.retez).map(u => rozvNajit(u).x.ozn + '→' + m.retez[u].ozn).join(),
      fuX: fu && fu.querySelector('[data-znacka]') ? fu.querySelector('[data-znacka]').getAttribute('transform') : '',
      spX: sp && sp.querySelector('[data-znacka]') ? sp.querySelector('[data-znacka]').getAttribute('transform') : '',
      vlozka: /vložka 40 gG/.test(svg), listu: listy.length
    };
    box.remove();
    return r;
  });
  const fi1 = sch.jedn.filter(x => /^-FI1:/.test(x))[0];
  const samost = sch.jedn.filter(x => !/:/.test(x)).length;
  const tx = s => (/translate\(([\d.]+)/.exec(s || '') || [])[1];
  check('schéma: řetěz -FU1 → SPD1 v jednom sloupci (stejné x, SPD pod pojistkou)', sch.retez === '-FU1→SPD1' && tx(sch.fuX) && tx(sch.fuX) === tx(sch.spX), sch.fuX + ' / ' + sch.spX);
  check('schéma: skupina -FI1 s 20 sloupci + chránič, 24 samostatných vývodů + řetěz', fi1 === '-FI1:21' && samost === 25, sch.jedn.join(' '));
  check('schéma: vložka pojistky „vložka 40 gG"', sch.vlozka);

  // ── 5. skupina pod jističem, podskupina, hlubší úroveň ─────────────────
  const pod = await p.evaluate(async () => {
    const n = __T.naj;
    const fi2 = rozvVlozit('v-fi-4-25-30-A', 2, 0), a1 = rozvVlozit('v-fa-1-B16', 2, 1), a2 = rozvVlozit('v-fa-1-B16', 2, 2), k1 = rozvVlozit('v-fa-1-B10', 2, 3);
    Object.assign(a1, { vyvod: 'Kuchyň – zásuvky', faze: 'L1' }); Object.assign(a2, { vyvod: 'Kuchyň – linka', faze: 'L2' }); Object.assign(k1, { vyvod: 'Digestoř', faze: 'L3' });
    rozvNapajeniZapsat([fi2.uid], n('-FA23').uid); rozvNapajeniZapsat([k1.uid], a2.uid); rozvNadrazeneAuto();
    const d = __T.cist(), m = rsModel(d), L = rozvSchemaListy(d);
    const u = m.jedn.filter(u => u.fi && u.fi.uid === n('-FA23').uid)[0];
    const r = { skup: u ? u.sloupce.map(x => x.ozn || x.uid).length : 0, pod: Object.keys(m.pod).length === 1 && m.pod[fi2.uid] && m.pod[fi2.uid].length === 3,
      zplost: m.zplost[k1.uid] === a2.ozn, hloubka: L.length >= 3, text: L.map(l => l.svg).join('').indexOf('z ' + a2.ozn + ' · Digestoř') !== -1 };
    // fáze: -FA23 (napájí) se nepočítá, počítají se jeho vývody
    const f = rozvFazeSouhrn(d.rady); r.vyvodu = f.vyvodu;
    zpetVycistit();
    // úklid: smazat přidané
    [fi2, a1, a2, k1].forEach(x => { const q = rozvNajit(x.uid); if (q) __rz.rady[q.r].prvky.splice(q.i, 1); });
    rozvNadrazeneAuto(); rozvPohledVykreslit(); dokZmena();
    return r;
  });
  check('schéma: skupina pod jističem -FA23 → podskupina chránič → 2 jističe; hlubší úroveň zploštěle „z -FAx · Digestoř"', pod.skup === 5 && pod.pod && pod.zplost && pod.text, JSON.stringify(pod));
  check('fáze: napájecí jistič větve se nezapočítá dvakrát (vývody = koncové)', pod.vyvodu === 24 + 20 - 1 + 2,   // -FA23 a jistič napájející „Digestoř“ se nepočítají, počítají se jejich koncové vývody
    'vývodů ' + pod.vyvodu);

  // ── 6. telefon 360 px: klepnutí a dlouhý stisk svorky ──────────────────
  {
    const ctxM = await kontext(b, { viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const errM = [];
    const t = await stranka(ctxM, URL, errM);
    await t.evaluate(async () => { await __T.rs2(); TD_AKCE.tdRNapRezim(); document.querySelectorAll('.toast').forEach(x => x.remove()); });
    await w(250);
    const vel = await t.evaluate(() => { const e = document.querySelector('#rz-pohled [data-sv="' + __T.naj('-FI1').uid + '|dole|0"]'), u = document.querySelector('#rz-pohled [data-uchyt]');
      return { sv: e.getBoundingClientRect().width, uch: u.getBoundingClientRect().width }; });
    check('telefon: svorky a úchyty vodičů větší (aspoň 6 px na displeji)', vel.sv >= 6 && vel.uch >= 6, JSON.stringify(vel));
    let q = await t.evaluate(() => __T.sv('-FI1', 'dole', 0));
    await t.touchscreen.tap(q.x, q.y); await w(250);
    q = await t.evaluate(() => __T.bod('-FA22')); await t.touchscreen.tap(q.x, q.y); await w(250);
    check('telefon 360 px: klepnutí na výstupní svorku -FI1 a pak na -FA22 nastaví napájení', await t.evaluate(() => __T.naj('-FA22').nadr === __T.naj('-FI1').uid));
    await t.evaluate(() => { __rz.napZdroj = null; rozvPohledVykreslit(); });
    // dlouhý stisk svorky a tažení prstem (CDP dotyk)
    const cdp = await ctxM.newCDPSession(t);
    const [A, C] = await t.evaluate(() => {   // obě svorky naráz na displeji (posun okna na jejich střed)
      const el = (o, s) => document.querySelector('#rz-pohled [data-sv="' + __T.u(o) + '|' + s + '|0"]'), st = e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; };
      __T.videt(el('-FA23', 'dole')); let a = st(el('-FA23', 'dole')), c = st(el('-FA21', 'nahore'));
      window.scrollBy(0, (a.y + c.y) / 2 - innerHeight / 2); return [st(el('-FA23', 'dole')), st(el('-FA21', 'nahore'))];
    });
    const tp = (type, pt) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pt ? [{ x: pt.x, y: pt.y }] : [] });
    await tp('touchStart', A); await w(450);
    for (let i = 1; i <= 10; i++) { await tp('touchMove', { x: A.x + (C.x - A.x) * i / 10, y: A.y + (C.y - A.y) * i / 10 }); await w(30); }
    await tp('touchEnd'); await w(250);
    check('telefon: dlouhý stisk svorky -FA23 a tažení prstem na -FA21 zapojí', await t.evaluate(() => __T.naj('-FA21').nadr === __T.naj('-FA23').uid));
    check('telefon: žádná chyba na stránce', errM.length === 0, errM.join(' | '));
    await ctxM.close();
  }

  // ── 7. svorková lišta, přípojnice, obecné položky (commit 2) ───────────
  const sv = await p.evaluate(async () => {
    const n = __T.naj, r = {};
    const kn = id => rozvKnihPolozka(id);
    r.polozky = ['v-x-svork', 'v-x-prip-n', 'v-x-prip-pe', 'v-fu-3-1451-50', 'v-fu-1-1451-50', 'v-spd-2-31'].map(id => !!kn(id)).join();
    r.fu50 = [kn('v-fu-3-1451-50').In, kn('v-fu-3-1451-50').sirka, kn('v-fu-1-1451-50').sirka].join('|');
    r.hledat = rozvKnihovnaVse().filter(it => it.druh !== 'skrin' && rozvNorm([it.nazev].join(' ')).indexOf('3+1') !== -1).map(it => it.nazev).join();
    const v0 = rozvVolnoCelkem(__rz);
    // řada 3: vývodové svorky -X4…X46 (43 ks), přípojnice N za -FI1 a PE
    const sk = rozvVlozit('v-x-svork', 2, __rz.rady[2].prvky.length);
    const pn = rozvVlozit('v-x-prip-n', 2, __rz.rady[2].prvky.length), pe = rozvVlozit('v-x-prip-pe', 2, __rz.rady[2].prvky.length);
    rozvVybrat(sk.uid, false); await __T.w(30);
    const pc = document.querySelector('#rz-vlastnosti [data-rp2="pocet"]'); pc.value = '43'; pc.dispatchEvent(new Event('input', { bubbles: true })); await __T.w(30);
    sk.ozn = '-X4'; rozvPohledVykreslit();
    r.rozsah = rozvSvorkyRozsah(sk); r.sirka = sk.p.sirka; r.dalsi = rozvDalsiOzn('X');
    r.svg = /-X4…X46/.test(document.querySelector('#rz-pohled .rz-svg').textContent) && /43 ks/.test(document.querySelector('#rz-pohled .rz-svg').textContent);
    // přípojnice N: volba „Napájen z" → -FI1
    rozvVybrat(pn.uid, false); await __T.w(30);
    const nsel = document.querySelector('#rz-vlastnosti [data-rp2="nadr"]'); r.nVolba = !!nsel;
    if (nsel) { nsel.value = n('-FI1').uid; nsel.dispatchEvent(new Event('change', { bubbles: true })); await __T.w(30); }
    r.nNadr = pn.nadr === n('-FI1').uid;
    r.fiDeti = rozvDeti(n('-FI1').uid).length;   // 20 jističů + přípojnice N
    r.fiFaze = rozvFazeSouhrn(__rz.rady).vyvodu;
    // řada 3 jako svorková lišta: nepočítá se do volného místa ani přeplnění
    const vPred = rozvVolnoCelkem(__rz);
    sk.p.pocet = 90; sk.p.sirka = rozvSvorkySirka(90);
    r.preplnPred = rozvPreplnene(__rz).length;
    __rz.vyber = null; rozvVlastnostiVykreslit();
    const zatrh = document.querySelector('#rz-vlastnosti .rz-svorky-rada[data-rada="2"]'); zatrh.checked = true; zatrh.dispatchEvent(new Event('change', { bubbles: true })); await __T.w(50);
    const vPo = rozvVolnoCelkem(__rz);
    r.volno = [v0.celkem, vPred.celkem, vPo.celkem].join('|'); r.preplnPo = rozvPreplnene(__rz).length;
    r.lista = /svorková lišta/.test(document.querySelector('#rz-pohled .rz-svg').textContent) && !/Řada 3: přeplněno/.test(document.querySelector('#rz-pohled .rz-svg').textContent);
    r.dataSv = __T.cist().rady[2].svorky === true;
    sk.p.pocet = 43; sk.p.sirka = rozvSvorkySirka(43); rozvPohledVykreslit();
    // přívodní svorky -X1…X3 před hlavním vypínačem
    const pr = rozvVlozit('v-x-svork', 2, 0); pr.p.pocet = 3; pr.p.sirka = rozvSvorkySirka(3); pr.privodni = true; pr.ozn = '-X1';
    const d = __T.cist(), L = rozvSchemaListy(d), svg1 = L[1].svg;
    r.privod = svg1.indexOf('>-X1…X3<') !== -1;
    r.seznam = DOK_TYPY.rozv.pdf(Object.assign({}, d, { dokVyber: { schema: false, tech: false, prohl: false, ko: false } })).map(q => q.html || '').join('');
    r.seznamX = (r.seznam.match(/<td class="c">-X4…X46<\/td>/g) || []).length === 1 && /43 ks · 2,5–4 mm²/.test(r.seznam);
    // 11.7: s přípojnicí PE bez poznámky, bez ní s poznámkou
    r.ko117s = /V návrhu chybí přípojnice \/ svorky PE/.test(rozvDokHtml(d));
    const d2 = JSON.parse(JSON.stringify(d)); d2.rady.forEach(rr => rr.prvky = rr.prvky.filter(x => x.p.prip !== 'PE'));
    r.ko117bez = /V návrhu chybí přípojnice \/ svorky PE – aspoň 2 svorky pro ochranné pospojování \(čl\. 8\.8\)\./.test(rozvDokHtml(d2));
    // úklid
    [sk, pn, pe, pr].forEach(x => { const q = rozvNajit(x.uid); if (q) __rz.rady[q.r].prvky.splice(q.i, 1); });
    delete __rz.rady[2].svorky; rozvNadrazeneAuto(); rozvPohledVykreslit(); rozvVlastnostiVykreslit(); dokZmena();
    return r;
  });
  check('knihovna: svorkovnice, přípojnice N/PE, pojistkové odpojovače 14×51 50 A (4,5 / 1,5 M), svodič T2 3+1', sv.polozky === 'true,true,true,true,true,true' && sv.fu50 === '50|4.5|1.5', sv.polozky + ' ' + sv.fu50);
  check('knihovna: hledání „3+1" najde „Svodič přepětí T2 3+1"', /Svodič přepětí T2 3\+1/.test(sv.hledat), sv.hledat);
  check('svorkovnice: počet 43 → -X4…X46, šířka 43 × 6 mm v modulech, další -X47', sv.rozsah === '-X4…X46' && sv.sirka === 15 && sv.dalsi === '-X47' && sv.svg, [sv.rozsah, sv.sirka, sv.dalsi, sv.svg].join(' '));
  check('přípojnice N: volba „Napájen z" → -FI1; do fází se nepočítá', sv.nVolba && sv.nNadr && sv.fiDeti === 21 && sv.fiFaze === 44, sv.fiDeti + ' / ' + sv.fiFaze);
  check('svorková lišta: řada se nepočítá do volného místa (96 → 72 M) ani přeplnění, v pohledu „svorková lišta", v datech rady[2].svorky', sv.volno === '96|96|72' && sv.preplnPred === 1 && sv.preplnPo === 0 && sv.lista && sv.dataSv, sv.volno + ' ' + sv.preplnPred + '/' + sv.preplnPo);
  check('schéma: přívodní svorky -X1…X3 na přívodu před -QH1', sv.privod);
  check('seznam přístrojů: svorkovnice jedna řádka -X4…X46 s počtem', sv.seznamX);
  check('kusové ověření 11.7: bez přípojnice PE poznámka „V návrhu chybí přípojnice / svorky PE…", s ní ne', !sv.ko117s && sv.ko117bez);
  // import CSV ve formátu knihovny výrobců (vymyšlené řádky, SPD bez pólů)
  const csv = await p.evaluate(() => {
    const t = 'druh;kategorie;nazev;vyrobce;rada;typ;poly;in;charakteristika;trida_spd;up;sirka_moduly;overeno\n' +
      'pristroj;QM;Vypínač 3P 63 A (dříve vyráběný);Výrobce A;R1;A-63/3;3;63;;;;3;ne\n' +
      'pristroj;FU;Pojistkový odpojovač 3P 14×51;Výrobce A;R1;A-LR603;3;50;;;;4,5;ne\n' +
      'pristroj;SPD;Svodič T2 275 V;Výrobce B;S1;B-SLP-275 V/1;1;;;T2;1,5;1;ne\n' +
      'pristroj;SPD;Svodič N-PE;Výrobce B;S1;B-SLP-NPE V/1;;;;T2;1,5;1;ne\n' +
      'pristroj;SPD;Svodič T2 3+1;Výrobce B;S1;B-SLP-275 V/3+1;3+N;;;T2;1,5;4;ne\n';
    const r = rozvImportRozebrat(t, 'vyrobci.csv');
    return { pol: (r.polozky || []).length, chyby: (r.chyby || []).length, typy: (r.polozky || []).map(x => x.typ).join(',') };
  });
  check('import CSV: 5 řádků bez chyb, i SPD s prázdnými póly', csv.pol === 5 && csv.chyby === 0, JSON.stringify(csv));

  // ── 8. „nechat prázdné" a dokumentace pro jiného výrobce (commit 3) ────
  const np = await p.evaluate(async () => {
    const r = {}, f = () => dokForm();
    STORE.technik.razitko = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    rozvZalozkaNastavit('dok'); await __T.w(200);
    f().querySelectorAll('details.rz-dok-oddil').forEach(x => x.open = true);
    const pole = () => f().querySelector('[data-dk="ko.zkousel.jmeno"]');
    r.pred = pole().value;
    const btn = pole().closest('.f').querySelector('[data-action="tdRBezOdv"]');
    r.btn = btn ? btn.textContent + '|' + btn.title : '';
    btn.click(); await __T.w(150);
    f().querySelectorAll('details.rz-dok-oddil').forEach(x => x.open = true);
    r.po = pole().value; r.ph = pole().placeholder;
    let d = __T.cist(); r.bezOdv = JSON.stringify(d.bezOdv || {}); r.eff = rozvDokEff(d).zkJmeno;
    r.zpetBtn = (pole().closest('.f').querySelector('[data-action="tdRBezOdv"]') || {}).textContent;
    r.pdfKo = DOK_TYPY.rozv.pdf(Object.assign({}, d, { dokVyber: { cp: false, schema: false, tech: false, prohl: false, ko: true, soudobost: false } })).map(q => q.html || '').join('');
    r.pdfKoJmeno = /Petr Vymyšlený/.test(r.pdfKo);
    window.__snimekDok = true;
    // ↺ vrátí jméno z profilu
    pole().closest('.f').querySelector('[data-action="tdRBezOdv"]').click(); await __T.w(150);
    d = __T.cist(); r.vraceno = pole().value + '|' + JSON.stringify(d.bezOdv || null);
    // napsat vlastní text po ✕ → bezOdv pro pole zmizí
    pole().closest('.f').querySelector('[data-action="tdRBezOdv"]').click(); await __T.w(150);
    pole().value = 'Karel Jiný'; pole().dispatchEvent(new Event('input', { bubbles: true }));
    d = __T.cist(); r.napsano = d.ko.zkousel.jmeno + '|' + JSON.stringify(d.bezOdv || null);
    pole().value = ''; pole().dispatchEvent(new Event('input', { bubbles: true }));
    // dokumentace pro jiného výrobce
    const pf = f().querySelector('[data-dk="prohl.funkce"]'); if (pf) { pf.value = 'jednatel'; pf.dispatchEvent(new Event('input', { bubbles: true })); }
    const z = f().querySelector('[data-dk="bezProfilu"]'); r.zatrh = !!z;
    z.checked = true; z.dispatchEvent(new Event('change', { bubbles: true })); await __T.w(150);
    d = __T.cist(); const e = rozvDokEff(d);
    r.bez = [e.pJmeno, e.pMisto, e.zkJmeno, String(e.razitko)].join('|'); r.funkce = e.pFunkce; r.data = d.bezProfilu;
    const pdf = DOK_TYPY.rozv.pdf(Object.assign({}, d, { dokVyber: {} })).map(q => q.html || q.cela || '').join('');
    r.pdfJmeno = /Petr Vymyšlený/.test(pdf); r.pdfRazitko = /rz-ps-razitko/.test(pdf);
    r.schema = /Petr Vymyšlený/.test(rozvSchemaListy(d).map(l => l.svg).join('')); r.kde = (pdf.match(/.{80}Petr Vymyšlený.{40}/) || [''])[0];
    r.zatrhDom = f().querySelector('[data-dk="bezProfilu"]').checked;
    // ručně vyplněné zůstává
    const pj = f().querySelector('[data-dk="prohl.jmeno"]'); pj.value = 'Eva Výrobcová'; pj.dispatchEvent(new Event('input', { bubbles: true }));
    d = __T.cist(); r.rucne = rozvDokEff(d).pJmeno;
    // odškrtnout: zpět profil, klíč se neuloží
    pj.value = ''; pj.dispatchEvent(new Event('input', { bubbles: true }));
    const z2 = f().querySelector('[data-dk="bezProfilu"]'); z2.checked = false; z2.dispatchEvent(new Event('change', { bubbles: true })); await __T.w(150);
    d = __T.cist(); r.zpet = ('bezProfilu' in d) + '|' + rozvDokEff(d).pJmeno;
    delete STORE.technik.razitko;
    return r;
  });
  check('nechat prázdné: u „Zkoušku provedl" (jméno z profilu) tlačítko ✕ „nechat prázdné"', np.pred === 'Petr Vymyšlený' && np.btn === '✕|nechat prázdné', np.pred + ' ' + np.btn);
  check('nechat prázdné: ✕ → pole prázdné s „(prázdné – vyplní se ručně)", bezOdv v datech, v PDF protokolu bez jména', np.po === '' && np.ph === '(prázdné – vyplní se ručně)' &&
    np.bezOdv === '{"ko.zkousel.jmeno":true}' && np.eff === '' && !np.pdfKoJmeno && np.zpetBtn === '↺', np.bezOdv);
  check('nechat prázdné: ↺ vrátí jméno z profilu a klíč zmizí', np.vraceno === 'Petr Vymyšlený|null', np.vraceno);
  check('nechat prázdné: napsaný text platí a „nechat prázdné" pro pole zmizí', np.napsano === 'Karel Jiný|null', np.napsano);
  check('jiný výrobce: zaškrtávátko v Dokumentech; jméno, místo, zkoušející a razítko z profilu se nepoužijí', np.zatrh && np.zatrhDom && np.bez === '|||false' && np.data === true, np.bez);
  check('jiný výrobce: PDF bez jména a razítka z profilu, schéma bez „Vypracoval" z profilu', !np.pdfJmeno && !np.pdfRazitko && !np.schema, [np.pdfJmeno, np.pdfRazitko, np.schema, np.kde].join(' '));
  check('jiný výrobce: ručně vyplněné hodnoty platí (funkce, jméno v prohlášení)', np.funkce === 'jednatel' && np.rucne === 'Eva Výrobcová', np.funkce + ' ' + np.rucne);
  check('jiný výrobce: odškrtnutí vrátí profil, klíč bezProfilu se neukládá', np.zpet === 'false|Petr Vymyšlený', np.zpet);

  // ── 9. pojistkový odpojovač: vložka vs. držák (2026-11-06) ──────────────
  const vl = await p.evaluate(async () => {
    rozvZalozkaNastavit('navrh'); await __T.w(100);
    const fu = __T.naj('-FU1'), spd = __T.naj('SPD1'), r = {};
    const celo = () => (document.querySelector('#rz-pohled [data-puid="' + fu.uid + '"]') || {}).textContent || '';
    const sezn = () => DOK_TYPY.rozv.pdf(Object.assign({}, __T.cist(), { dokVyber: { schema: false, tech: false, prohl: false, ko: false } })).map(q => q.html || '').join('');
    delete fu.vlozka; spd.p.pozn = 'max. předjištění 32 A'; rozvPohledVykreslit();
    rozvVybrat(fu.uid, false); await __T.w(30);
    r.bez = { celo: celo(), upoz: document.getElementById('rp-vlozka-upoz').hidden, spd: rozvNapajeniUpoz(spd).join('|'), sezn: /<td class="c">32 A<\/td>/.test(sezn()) };
    fu.vlozka = '40 gG'; rozvPohledVykreslit(); rozvVybrat(fu.uid, false); await __T.w(30);
    const u = document.getElementById('rp-vlozka-upoz');
    r.s = { celo: celo(), upoz: !u.hidden && u.textContent, spd: rozvNapajeniUpoz(spd).join('|'), sezn: /<td class="c">40 A gG<\/td>/.test(sezn()),
      pop: rozvPopiskyRady ? JSON.stringify(rozvPopiskyRady(__T.cist())).indexOf('40 A gG') !== -1 : true };
    // psaní do pole vložky přepočítá upozornění hned
    const pole = document.querySelector('#rz-vlastnosti [data-rp2="vlozka"]'); pole.value = '25 gG'; pole.dispatchEvent(new Event('input', { bubbles: true }));
    r.psani = document.getElementById('rp-vlozka-upoz').hidden;
    delete fu.vlozka; spd.p.pozn = ''; __rz.vyber = null; rozvPohledVykreslit(); rozvVlastnostiVykreslit(); dokZmena();
    return r;
  });
  check('pojistka bez vložky: v čelním pohledu 32 A, v seznamu 32 A, bez upozornění', /32 A/.test(vl.bez.celo) && !/gG/.test(vl.bez.celo) && vl.bez.upoz === true && vl.bez.sezn && vl.bez.spd === '', JSON.stringify(vl.bez));
  check('pojistka 10×38 (In 32) s vložkou 40 gG: čelní pohled a seznam „40 A gG", popisky taky', /40 A gG/.test(vl.s.celo) && !/32 A/.test(vl.s.celo) && vl.s.sezn && vl.s.pop, JSON.stringify(vl.s));
  check('upozornění „Vložka 40 A je větší než jmenovitý proud odpojovače 32 A." (při psaní 25 gG zmizí)', vl.s.upoz === '⚠ Vložka 40 A je větší než jmenovitý proud odpojovače 32 A.' && vl.psani === true, vl.s.upoz);
  check('kontrola předjištění SPD bere vložku (40 A > max. 32 A)', /předjištění 40 A je vyšší než max\. předjištění svodiče 32 A/.test(vl.s.spd), vl.s.spd);

  // ── 10. napájení z přívodu, přes svorky a před hlavním vypínačem (2026-11-06) ──
  // RS2 přesně podle uživatele: tři samostatné řadové svorky -X1 (L1), -X2 (L2), -X3 (L3);
  // přívod → X1…X3 → QH1; SPD1 z QH1; B10/B40 z QH1; FI1 → FA25…44.
  const pv = await p.evaluate(async () => {
    if (__rz.napRezim) TD_AKCE.tdRNapRezim();
    await __T.rs2(); const n = __T.naj, r = {};
    ['L1', 'L2', 'L3'].forEach((f, i) => { const x = rozvVlozit('v-x-rad', 2, i); x.ozn = '-X' + (i + 1); x.faze = f; });
    rozvNapajeniNastavit([n('SPD1').uid], n('-QH1').uid);
    rozvPohledVykreslit(); dokZmena();
    const qh = n('-QH1'), X = ['-X1', '-X2', '-X3'].map(n), U = X.map(x => x.uid);
    r.oznX = X.map(x => x.ozn + ':' + x.faze + ':' + x.p.kat).join();
    rozvNapajeniNastavit(U, '@privod');
    r.zPrivodu = X.every(x => x.nadr === '@privod' && x.nadrRucne === true);
    rozvNapajeniZVice(U, qh.uid);
    r.sada = JSON.stringify(qh.nadrSvorky) === JSON.stringify(U) && qh.nadr === U[0] && qh.nadrRucne === true;
    r.detiPrivod = rozvDeti('@privod').map(x => x.ozn).join();
    r.detiX1 = rozvDeti(U[0]).map(x => x.ozn).join() + '|' + rozvDeti(U[2]).map(x => x.ozn).join();
    r.spd = n('SPD1').nadr === qh.uid;
    r.b = ['-FA1', '-FA22', '-FA23', '-FA24'].every(o => n(o).nadr === '') && rozvDeti(n('-FI1').uid).length === 20;
    rozvVybrat(U[0], false); await __T.w(30);
    r.panelX1 = document.getElementById('rz-vlastnosti').innerText;
    r.zatrhX1 = !!(document.querySelector('#rz-vlastnosti [data-rp2="privodni"]') || {}).checked;
    rozvVybrat(qh.uid, false); await __T.w(30);
    const sq = document.querySelector('#rz-vlastnosti [data-rp2="nadr"]');
    r.qhVolba = sq.options[sq.selectedIndex].textContent + ' | ' + Array.from(sq.options).map(o => o.textContent).join(' / ');
    r.qhUpoz0 = rozvNapajeniUpoz(qh).join('|');
    // schéma: přívod → svorky → QH1
    const d = __T.cist(), listy = rozvSchemaListy(d), sv = listy[1].svg;
    r.dataSada = JSON.stringify(d.rady[0].prvky[0].nadrSvorky) === JSON.stringify(U);
    r.schSvorky = (sv.match(/data-privodni="1"/g) || []).length;
    r.schText = /-X1…X3/.test(sv) && /L1, L2, L3/.test(sv);
    const doc = new DOMParser().parseFromString(sv, 'image/svg+xml');
    r.schPoradi = U.map(u => +doc.querySelector('[data-puid="' + u + '"] circle').getAttribute('cx')).every(cx => cx < 65 - 8);
    window.__schSvg = sv;
    // přívodní svorky leží uvnitř čárkovaného rámu rozvaděče (oprava v1.61)
    const ram = Array.from(doc.querySelectorAll('rect[stroke-dasharray="3 1.6"]')).sort((a, b2) => +b2.getAttribute('width') - +a.getAttribute('width'))[0];
    const rx = +ram.getAttribute('x'), ry = +ram.getAttribute('y'), rw = +ram.getAttribute('width'), rh = +ram.getAttribute('height');
    r.svUvnitr = Array.from(doc.querySelectorAll('[data-privodni] circle')).map(c => { const cx = +c.getAttribute('cx'), cy = +c.getAttribute('cy'), rr = +c.getAttribute('r');
      return cx - rr > rx && cx + rr < rx + rw && cy - rr > ry && cy + rr < ry + rh; });
    const kab = Array.from(doc.querySelectorAll('text')).filter(t => /CYKY 5×10/.test(t.textContent))[0];
    r.kabVne = !!kab && +kab.getAttribute('x') < rx;
    // uložit a znovu otevřít — sada zůstane
    await dokUlozitOtevreny(); const uid = __dokOtevreny.uid; await dokOtevrit(uid); await __T.w(300);
    r.poOtevreni = JSON.stringify(__T.naj('-QH1').nadrSvorky) === JSON.stringify(U) && ['-X1', '-X2', '-X3'].every(o => __T.naj(o).nadr === '@privod');
    // kontroly: 3P jen ze dvou svorek, svorka z přívodu, která nic nenapájí
    const qh2 = __T.naj('-QH1'), U2 = ['-X1', '-X2', '-X3'].map(o => __T.naj(o).uid);
    rozvZmena('t', () => rozvKorenSvorky(qh2, U2.slice(0, 2)));
    r.upozQh = rozvNapajeniUpoz(qh2).join('|');
    r.upozX3 = rozvNapajeniUpoz(__T.naj('-X3')).join('|');
    zpetPosledni(); await __T.w(30);
    r.zpetSada = JSON.stringify(__T.naj('-QH1').nadrSvorky) === JSON.stringify(U2);
    // kruh: QH1 → X1 a současně X1 → QH1
    r.kruh = rozvLzeNapajet(__T.naj('-QH1'), __T.naj('-X1')) === false;
    rozvNapajeniNastavit([U2[0]], __T.naj('-QH1').uid);
    r.kruhNic = __T.naj('-X1').nadr === '@privod';
    r.qhZJistice = rozvLzeNapajet(__T.naj('-FA1'), __T.naj('-QH1')) === false;   // hlavní vypínač jen ze svorek / přístroje před ním
    // SPD z přívodu → odbočka před QH1 ve schématu + informace o předjištění
    const spd = __T.naj('SPD1');
    rozvNapajeniNastavit([spd.uid], '@privod');
    const d2 = __T.cist(), m = rsModel(d2), s2 = rozvSchemaListy(d2)[1].svg;
    r.spdPrvni = m.jedn[0].sloupce[0].uid === spd.uid;
    const g2 = new DOMParser().parseFromString(s2, 'image/svg+xml').querySelector('[data-puid="' + spd.uid + '"]');
    r.spdOdbocka = !!g2 && Array.from(g2.querySelectorAll('circle')).some(c => c.getAttribute('cx') === '65' && c.getAttribute('cy') === '30');
    r.spdInfo = rozvNapajeniInfo(spd).join('|');
    rozvVybrat(spd.uid, false); await __T.w(30); r.spdPanel = document.getElementById('rz-vlastnosti').innerText;
    r.spdDetiPrivod = rozvDeti('@privod').map(x => x.ozn).join();
    zpetPosledni(); await __T.w(30);
    r.spdZpet = __T.naj('SPD1').nadr === __T.naj('-QH1').uid;
    __rz.vyber = null; rozvPohledVykreslit(); rozvVlastnostiVykreslit();
    return r;
  });
  check('RS2 přívod: tři samostatné řadové svorky -X1 L1, -X2 L2, -X3 L3', pv.oznX === '-X1:L1:X,-X2:L2:X,-X3:L3:X', pv.oznX);
  check('RS2 přívod: přívod → X1…X3 (nadr „@privod"), X1…X3 → QH1 (nadrSvorky, nadr = první)', pv.zPrivodu && pv.sada);
  check('RS2 přívod: rozvDeti(\'@privod\') = -X1, -X2, -X3; rozvDeti(X1) = rozvDeti(X3) = -QH1', pv.detiPrivod === '-X1,-X2,-X3' && pv.detiX1 === '-QH1|-QH1', pv.detiPrivod + ' / ' + pv.detiX1);
  check('RS2 přívod: SPD1 z QH1, B10/B40 z QH1, FI1 → FA25…44', pv.spd && pv.b);
  check('panel svorky: „→ napájí: -QH1 (L1)", zaškrtnuté „Přívodní svorky"', /→ napájí: -QH1 \(L1\)/.test(pv.panelX1) && pv.zatrhX1, (pv.panelX1.match(/→ napájí[^\n]*/) || [''])[0]);
  check('panel hlavního vypínače: „Napájen z" = svorky -X1…X3, nabídka z přívodu a svorek (bez jističů)', /^svorky -X1…X3 \| z přívodu \/ svorky -X1…X3 \/ -X1 Svorka L1/.test(pv.qhVolba) && !/-FA/.test(pv.qhVolba) && pv.qhUpoz0 === '', pv.qhVolba);
  check('schéma: přívod → přívodní svorky -X1…X3 (L1, L2, L3) vlevo od -QH1; data mají sadu svorek', pv.schSvorky === 3 && pv.schText && pv.schPoradi && pv.dataSada, pv.schSvorky + ' ' + pv.schText + ' ' + pv.schPoradi);
  check('schéma: obdélník každé přívodní svorky leží uvnitř čárkovaného rámu rozvaděče, popis kabelu vně rámu', pv.svUvnitr.length === 3 && pv.svUvnitr.every(Boolean) && pv.kabVne, JSON.stringify(pv.svUvnitr) + ' ' + pv.kabVne);
  check('uložení a znovu otevření: sada svorek i napájení z přívodu zůstanou', pv.poOtevreni);
  check('kontrola: „-QH1 3P je napájen jen ze svorek L1, L2."', pv.upozQh === '-QH1 3P je napájen jen ze svorek L1, L2.', pv.upozQh);
  check('kontrola: „-X3 je připojena k přívodu, ale nic nenapájí." (ZPĚT sadu vrátí)', pv.upozX3 === '-X3 je připojena k přívodu, ale nic nenapájí.' && pv.zpetSada, pv.upozX3);
  check('kruh: QH1 nemůže napájet X1, když X1 napájí QH1 — odmítnuto, nic se nezmění; QH1 nejde napájet z jističe za ním', pv.kruh && pv.kruhNic && pv.qhZJistice);
  check('SPD z přívodu: ve schématu první sloupec, odbočka z přívodu před -QH1 (bod u vypínače)', pv.spdPrvni && pv.spdOdbocka);
  check('SPD z přívodu: informace „SPD před hlavním vypínačem – ověřte předjištění…" v panelu, rozvDeti(\'@privod\') ji obsahuje; ZPĚT vrátí', /SPD před hlavním vypínačem – ověřte předjištění podle výrobce \(max\. předjištění\)/.test(pv.spdPanel) &&
    pv.spdInfo !== '' && /SPD1/.test(pv.spdDetiPrivod) && pv.spdZpet, pv.spdDetiPrivod);

  // Playwright: režim Zapojení — vývodka → X1…X3 → QH1, přepojování koncem vodiče
  await p.evaluate(() => { const n = __T.naj; rozvZmena('t', () => { ['-X1', '-X2', '-X3'].forEach(o => { n(o).nadr = ''; n(o).nadrRucne = false; }); rozvKorenSvorky(n('-QH1'), []); });
    if (!__rz.napRezim) TD_AKCE.tdRNapRezim(); document.querySelectorAll('.toast').forEach(t => t.remove()); });
  await w(150);
  const privBod = () => p.evaluate(() => __T.videt(document.querySelector('#rz-pohled [data-nap-privod] rect')));
  const tahni = async (A, C, mezi) => { await p.mouse.move(A.x, A.y); await p.mouse.down(); await p.mouse.move(A.x + 12, A.y + 12, { steps: 4 }); await p.mouse.move(C.x, C.y, { steps: 14 }); if (mezi) await mezi(); await p.mouse.up(); await w(160); };
  let pa = await privBod(), pc = await p.evaluate(() => __T.sv('-X1', 'nahore', 0));
  await tahni(pa, pc);
  check('tažení z vývodky přívodu na horní svorku -X1 nastaví napájení z přívodu', await p.evaluate(() => __T.naj('-X1').nadr === '@privod' && !('vstup' in __T.naj('-X1'))));
  await p.keyboard.press('Control+z'); await w(150);
  check('Ctrl+Z vrátí napájení z přívodu nastavené tažením', await p.evaluate(() => __T.naj('-X1').nadr === ''));
  pa = await privBod(); await p.mouse.click(pa.x, pa.y); await w(120);
  const zdrojPriv = await p.evaluate(() => __rz.napZdroj === '@privod' && /Napájí přívod/.test(document.querySelector('.rz-banner-nap').innerText));
  for (const o of ['-X1', '-X2', '-X3']) { const q = await p.evaluate(o => __T.bod(o), o); await p.mouse.click(q.x, q.y); await w(120); }
  check('klik a klik: vývodka, pak -X1, -X2, -X3 → všechny z přívodu', zdrojPriv && await p.evaluate(() => ['-X1', '-X2', '-X3'].every(o => __T.naj(o).nadr === '@privod')));
  await p.keyboard.press('Escape'); await w(80);
  // rámeček X1…X3 a tažení z výstupní svorky -X2 na -QH1
  let rx = await p.evaluate(() => { const g = rozvGeom().filter(q => q.r === 2); document.querySelector('#rz-pohled [data-puid="' + g[1].uid + '"]').scrollIntoView({ block: 'center', inline: 'center' }); return { a: __T.mmBod(g[0].x - 1, g[0].y + 8), b: __T.mmBod(g[2].x + g[2].w - 1, g[2].y + 20) }; });
  await p.mouse.move(rx.a.x, rx.a.y); await p.mouse.down(); await p.mouse.move(rx.b.x, rx.b.y, { steps: 8 }); await p.mouse.up(); await w(150);
  const vybX = await p.evaluate(() => rozvVybrane().map(u => rozvNajit(u).x.ozn).join());
  pa = await p.evaluate(() => __T.sv('-X2', 'dole', 0)); pc = await p.evaluate(() => __T.sv('-QH1', 'nahore', 1));
  await tahni(pa, pc);
  check('rámeček -X1…X3 a tažení z výstupní svorky -X2 na -QH1 → QH1 napájen ze sady svorek', vybX === '-X1,-X2,-X3' && await p.evaluate(() => JSON.stringify(__T.naj('-QH1').nadrSvorky) === JSON.stringify(['-X1', '-X2', '-X3'].map(o => __T.naj(o).uid))), vybX);
  await p.evaluate(() => { __rz.vyber = null; __rz.vic = null; rozvPohledVykreslit(); rozvVlastnostiVykreslit(); document.querySelectorAll('.toast').forEach(t => t.remove()); });
  const ret = await p.evaluate(() => {
    const vy = rozvVyvodkaGeom(__rz), r = {};
    r.vyv = ['-X1', '-X2', '-X3'].map((o, i) => { const d = __T.draty('@privod', o); return d.length === 1 && d[0].faze === ['L1', 'L2', 'L3'][i] && +d[0].a.split(' ')[1] === rozvZaokr(vy.vy) && d[0].b === __T.svBod(o, 'nahore', 0); });
    r.qh = ['-X1', '-X2', '-X3'].map((o, i) => { const d = __T.draty(o, '-QH1'); return d.length === 1 ? d[0].faze + ':' + d[0].dp + ':' + d[0].barva + ':' + (d[0].a === __T.svBod(o, 'dole', 0)) + ':' + (d[0].b === __T.svBod('-QH1', 'nahore', i)) : 'chybí'; });
    r.faze = ['L1', 'L2', 'L3'].map(f => __T.draty('@privod').concat(['-X1', '-X2', '-X3'].reduce((s, o) => s.concat(__T.draty(o, '-QH1')), [])).filter(d => d.faze === f).length).join();
    r.paralel = __T.draty('@privod', '-QH1').length;
    r.qhVyst = __T.draty('-QH1').every(d => d.sp !== null && d.a.split(' ')[1] === __T.svBod('-QH1', 'dole', 0).split(' ')[1]);
    r.fiFa = __T.draty('-FI1').length;
    return r;
  });
  check('RS2: vývodka nahoře → vodiče L1, L2, L3 do vnější (horní) strany -X1, -X2, -X3', ret.vyv.every(Boolean), JSON.stringify(ret.vyv));
  check('RS2: -X1, -X2, -X3 → -QH1 póly 1, 3, 5 barvou fáze (hnědá, černá, šedá)', JSON.stringify(ret.qh) === JSON.stringify(['L1:0:#8B4513:true:true', 'L2:1:#1c1c1c:true:true', 'L3:2:#8c8c8c:true:true']), JSON.stringify(ret.qh));
  check('RS2: řetěz přívod → X → QH1 má na každou fázi právě 2 vodiče, žádný souběžný vodič vývodka → QH1', ret.faze === '2,2,2' && ret.paralel === 0, ret.faze + ' / ' + ret.paralel);
  check('RS2: -QH1 výstup dole → vodiče k vývodům; -FI1 → -FA25…44 (20)', ret.qhVyst && ret.fiFa === 20);
  if (SNIMKY) await (await p.$('#rz-pohled')).screenshot({ path: path.join(SNIMKY, 'rs2-zapojeni.png') });
  // přepojení: konec vodiče X3 → QH1 na -FU1
  pa = await p.evaluate(() => __T.uch('-X3', '-QH1', 'dst')); pc = await p.evaluate(() => __T.bod('-FU1'));
  await tahni(pa, pc, SNIMKY ? async () => {
    const bb = await p.evaluate(() => { const r = document.getElementById('rz-svg-ram').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width }; });
    await p.screenshot({ path: path.join(SNIMKY, 'rs2-prepojeni.png'), clip: { x: Math.max(0, bb.x), y: Math.max(0, pc.y - 260), width: Math.min(900, bb.w), height: 420 } });
  } : null);
  const prep = await p.evaluate(() => ({ fu: __T.naj('-FU1').nadr === __T.naj('-X3').uid && __T.naj('-FU1').nadrRucne === true,
    qh: JSON.stringify(__T.naj('-QH1').nadrSvorky) === JSON.stringify(['-X1', '-X2'].map(o => __T.naj(o).uid)), dbg: (rozvNajit(__T.naj('-FU1').nadr) || { x: {} }).x.ozn + '|' + (__T.naj('-QH1').nadrSvorky || []).length + '|' + JSON.stringify(window.__dbgTah || null), toast: Array.from(document.querySelectorAll('.toast')).map(t => t.textContent).join(' | ') }));
  check('přepojení: konec vodiče -X3 → -QH1 puštěný na -FU1 → -FU1 napájena z -X3, -QH1 už jen z -X1, -X2', prep.fu && prep.qh && /Přepojeno/.test(prep.toast), prep.toast + ' ' + prep.dbg);
  await p.keyboard.press('Control+z'); await w(150);
  check('Ctrl+Z vrátí přepojení', await p.evaluate(() => (__T.naj('-QH1').nadrSvorky || []).length === 3 && __T.naj('-FU1').nadr !== __T.naj('-X3').uid));
  // puštění do prázdna = odpojit
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  pa = await p.evaluate(() => __T.uch('-X3', '-QH1', 'dst'));
  pc = await p.evaluate(() => { const g = rozvGeom().filter(q => q.r === 3); const L = g[g.length - 1]; return __T.mmBod(L.x + L.w + 20, L.y + RZG.H / 2); });
  const prazdno = await p.evaluate(c => { const c2 = rozvNapCil(c.x, c.y); return c2 ? c2.uid : null; }, pc);
  await tahni(pa, pc);
  const odp = await p.evaluate(() => ({ qh: JSON.stringify(__T.naj('-QH1').nadrSvorky) === JSON.stringify(['-X1', '-X2'].map(o => __T.naj(o).uid)),
    toast: Array.from(document.querySelectorAll('.toast')).map(t => t.textContent).join(' | ') }));
  check('puštění konce vodiče do prázdna ho odpojí, hláška „Odpojeno … ZPĚT"', prazdno === null && odp.qh && /Odpojeno/.test(odp.toast) && /ZPĚT/.test(odp.toast), odp.toast);
  await p.keyboard.press('Control+z'); await w(150);
  check('Ctrl+Z vrátí odpojený vodič', await p.evaluate(() => (__T.naj('-QH1').nadrSvorky || []).length === 3));
  // automatický vodič uchopený a puštěný zpět → ruční
  pa = await p.evaluate(() => __T.uch('-QH1', '-FA1', 'dst')); pc = await p.evaluate(() => __T.sv('-FA1', 'nahore', 0));
  const auto0 = await p.evaluate(() => (__T.draty('-QH1', '-FA1')[0] || {}).auto);
  await tahni(pa, pc);
  check('uchopení čárkovaného automatického vodiče -QH1 → -FA1 z něj udělá ruční (plný)', auto0 === true && await p.evaluate(() => __T.naj('-FA1').nadrRucne === true && __T.naj('-FA1').nadr === '' && __T.draty('-QH1', '-FA1')[0].auto === false));
  await p.keyboard.press('Control+z'); await w(150);
  // konec u zdroje: vodič -QH1 → SPD1 přetažený na -FU1
  pa = await p.evaluate(() => __T.uch('-QH1', 'SPD1', 'src')); pc = await p.evaluate(() => __T.bod('-FU1'));
  await tahni(pa, pc);
  check('konec u zdroje: vodič -QH1 → SPD1 přetažený na -FU1 → SPD1 napájen z -FU1 (ručně)', await p.evaluate(() => __T.naj('SPD1').nadr === __T.naj('-FU1').uid && __T.naj('SPD1').nadrRucne === true));
  await p.keyboard.press('Control+z'); await w(150);
  check('Ctrl+Z vrátí SPD1 pod -QH1', await p.evaluate(() => __T.naj('SPD1').nadr === __T.naj('-QH1').uid));
  // Nastavení „Přístroje napájím: zespodu" mění jen výchozí, nezapisuje do přístrojů
  const zesp = await p.evaluate(() => {
    const d0 = JSON.stringify(__T.cist()), r = {};
    r.nab = /rz-vstup-nast/.test(rozvPiNastaveniHtml());
    localStorage.setItem('revize_el_rz_vstup', 'dole'); rozvSvgPrekreslit();
    r.fa1 = rozvVstup(__T.naj('-FA1')) + '|' + ((__T.draty('-QH1', '-FA1')[0] || {}).b === __T.svBod('-FA1', 'dole', 0));
    r.x1 = rozvVstup(__T.naj('-X1'));
    r.data = JSON.stringify(__T.cist()) === d0 && !rozvPrvkyVse(__rz.rady).some(x => 'vstup' in x);
    localStorage.removeItem('revize_el_rz_vstup'); rozvSvgPrekreslit();
    r.zpet = rozvVstup(__T.naj('-FA1'));
    return r;
  });
  check('nastavení „Přístroje napájím: zespodu": -FA1 napájen zespodu (vodič do spodní svorky), přívodní svorky dál podle vývodky, data beze změny', zesp.nab && zesp.fa1 === 'dole|true' && zesp.x1 === 'nahore' && zesp.data && zesp.zpet === 'nahore', JSON.stringify(zesp));
  // „Napájí…" je v kontextovém menu výběru
  await p.evaluate(() => { rozvZmena('t', () => rozvKorenSvorky(__T.naj('-QH1'), [])); __T.bod('-X2'); });
  rx = await p.evaluate(() => { const g = rozvGeom().filter(q => q.r === 2); document.querySelector('#rz-pohled [data-puid="' + g[1].uid + '"]').scrollIntoView({ block: 'center', inline: 'center' }); return { a: __T.mmBod(g[0].x - 1, g[0].y + 8), b: __T.mmBod(g[2].x + g[2].w - 1, g[2].y + 20) }; });
  await p.mouse.move(rx.a.x, rx.a.y); await p.mouse.down(); await p.mouse.move(rx.b.x, rx.b.y, { steps: 8 }); await p.mouse.up(); await w(150);
  const xb = await p.evaluate(() => __T.bod('-X2'));
  await p.mouse.click(xb.x, xb.y, { button: 'right' }); await w(150);
  const menuNa = await p.evaluate(() => Array.from(document.querySelectorAll('.kt-menu button, .kt-menu [role="menuitem"]')).map(x => x.textContent.trim()));
  await p.evaluate(() => { const b = Array.from(document.querySelectorAll('.kt-menu button, .kt-menu [role="menuitem"]')).filter(x => /^Napájí…/.test(x.textContent.trim()))[0]; if (b) b.click(); }); await w(120);
  const banNa = await p.evaluate(() => document.querySelector('.rz-banner-nap').innerText);
  pc = await p.evaluate(() => __T.bod('-QH1')); await p.mouse.click(pc.x, pc.y); await w(150);
  check('„Napájí…" z kontextového menu výběru: -X1…X3 napájejí -QH1 (klepnutí)', menuNa.some(t => /^Napájí…/.test(t)) && /vybrané \(3 přístroje\) napájejí/.test(banNa) &&
    await p.evaluate(() => (__T.naj('-QH1').nadrSvorky || []).length === 3), menuNa.join(' | '));
  if (SNIMKY) {
    const svg = await p.evaluate(() => rozvSchemaListy(__T.cist())[1].svg);
    const ps = await ctx.newPage(); await ps.setContent('<body style="margin:0;background:#fff">' + svg.replace(/<svg /, '<svg style="width:1600px;height:auto" ') + '</body>'); await w(200);
    await ps.screenshot({ path: SNIMKY + '/rs2-schema-privod.png', fullPage: true }); await ps.close();
  }
  await p.evaluate(() => { if (__rz.napRezim) TD_AKCE.tdRNapRezim(); });

  // ── 11. zapojení přes uzly (v1.62): libovolná svorka, paralelní připojení na vstup ──
  {
    const c11 = await kontext(b, { viewport: { width: 1920, height: 1500 } }), e11 = [];
    const q = await stranka(c11, URL, e11);
    await q.evaluate(async () => {
      await __T.rs2(); const n = __T.naj;
      ['L1', 'L2', 'L3'].forEach((f, i) => { const x = rozvVlozit('v-x-rad', 2, i); x.ozn = '-X' + (i + 1); x.faze = f; });
      const U = ['-X1', '-X2', '-X3'].map(o => n(o).uid);
      rozvNapajeniNastavit(U, '@privod'); rozvNapajeniZVice(U, n('-QH1').uid);
      __rz.vyber = null; TD_AKCE.tdRNapRezim(); document.querySelectorAll('.toast').forEach(t => t.remove());
    });
    await w(200);
    const stitek = () => q.evaluate(() => { const e = document.getElementById('rz-nap-stitek'); return e && e.style.display !== 'none' ? e.textContent : ''; });
    let st = '';
    const tah = async (fa, fc, uloz) => {
      await q.evaluate(fc); const A = await q.evaluate(fa), C = await q.evaluate(fc);
      await q.mouse.move(A.x, A.y); await q.mouse.down(); await q.mouse.move(A.x + 10, A.y + 10, { steps: 4 }); await q.mouse.move(C.x, C.y, { steps: 14 });
      st = await stitek(); if (uloz && SNIMKY) await q.screenshot({ path: path.join(SNIMKY, uloz), clip: { x: Math.max(0, C.x - 520), y: Math.max(0, C.y - 170), width: 820, height: 300 } });
      await q.mouse.up(); await w(200); await q.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
    };
    // a) SPD paralelně na horních (vstupních) svorkách QH1 → před vypínačem
    await tah(() => __T.sv('-QH1', 'nahore', 0), () => __T.sv('SPD1', 'nahore', 0), 'spd-paralelne-qh1.png');
    const par = await q.evaluate(() => {
      const n = __T.naj, s = n('SPD1'), qh = n('-QH1'), r = {};
      r.data = s.nadr === '@privod' && s.nadrRucne === true && JSON.stringify(s.pres) === JSON.stringify({ uid: qh.uid, strana: 'vstup' });
      const d = __T.draty('-QH1', 'SPD1'); r.dr = d.length === 1 && d[0].a === __T.svBod('-QH1', 'nahore', 0) && d[0].b === __T.svBod('SPD1', 'nahore', 0);
      const g = document.querySelector('#rz-pohled .rz-wire[data-wire-dst="' + s.uid + '"]'), body = g.getAttribute('data-body');
      const ys = g.querySelector('.rz-w').getAttribute('d').match(/-?[\d.]+ -?[\d.]+/g).map(t => +t.split(' ')[1]);
      r.useky = +body - 1; r.mezera = ys.every(y => y <= rozvRadaY(0) + 0.01 && y >= 0);
      r.svazek = d[0] && d[0].barva === '#3d3d3d' && d[0].faze === '3f+N';
      const m = rsModel(__T.cist()); r.sch = m.jedn[0].sloupce[0].uid === s.uid && rozvPredHlavnim(s);
      rozvVybrat(s.uid, false); r.panel = document.getElementById('rz-vlastnosti').innerText;
      const sel = document.querySelector('#rz-vlastnosti [data-rp2="nadr"]'); r.volba = sel.options[sel.selectedIndex].textContent;
      __rz.vyber = null; rozvVlastnostiVykreslit();
      return r;
    });
    check('v1.62: tah z horní svorky -QH1 na SPD1 → štítek „SPD1 paralelně na vstup -QH1 (před vypínačem)"', /paralelně na vstup -QH1 \(před vypínačem\)/.test(st), st);
    check('SPD paralelně před vypínačem: SPD1.nadr = zdroj QH1 (přívod přes X1…X3 → „@privod"), pres = {QH1, vstup}', par.data);
    check('SPD paralelně: vodič z horní svorky -QH1 na horní svorku SPD1, nejvýš 3 úseky, jen mezerou nad řadou s QH1', par.dr && par.useky <= 3 && par.mezera, par.useky + ' ' + par.mezera);
    check('SPD paralelně: 3P → 3+N jedna čára (svazek „3f+N") tmavě šedě', par.svazek);
    check('SPD paralelně: ve schématu odbočka před -QH1 (první sloupec, před hlavním vypínačem)', par.sch);
    check('panel: „Napájen: paralelně na vstupních svorkách -QH1 (před vypínačem)" a volba „paralelně na vstup -QH1 (před vypínačem)"',
      /Napájen: paralelně na vstupních svorkách -QH1 \(před vypínačem\)/.test(par.panel) && par.volba === 'paralelně na vstup -QH1 (před vypínačem)', par.volba);
    await q.keyboard.press('Control+z'); await w(150);
    check('Ctrl+Z vrátí paralelní připojení', await q.evaluate(() => __T.naj('SPD1').nadr === __T.naj('-FU1').uid && !__T.naj('SPD1').pres));
    // b) SPD za vypínačem: dolní svorka QH1
    await tah(() => __T.sv('-QH1', 'dole', 0), () => __T.sv('SPD1', 'nahore', 0));
    check('SPD za vypínačem: tah z dolní svorky -QH1 → SPD1 napájen z -QH1 (bez pres), ve schématu za vypínačem', await q.evaluate(() => {
      const s = __T.naj('SPD1'); return rozvZdrojEff(s) === __T.naj('-QH1').uid && s.nadrRucne === true && !s.pres && !rozvPredHlavnim(s); }), st);
    // c) nový jistič: z horní svorky na výstup QH1, z dolní na výstup FI1, do prázdna nic
    await q.evaluate(() => { const x = rozvVlozit('v-fa-1-B16', 1, __rz.rady[1].prvky.length); x.ozn = '-FA99'; dokZmena(); rozvPohledVykreslit(); });
    await w(150);
    await tah(() => __T.sv('-FA99', 'nahore', 0), () => __T.sv('-QH1', 'dole', 2), 'novy-jistic-z-horni.png');
    const nj1 = await q.evaluate(() => { const x = __T.naj('-FA99'); return x.nadr === '' && x.nadrRucne === true && !('vstup' in x) && __T.draty('-QH1', '-FA99')[0].b === __T.svBod('-FA99', 'nahore', 0); });
    check('nový jistič: tah z jeho HORNÍ svorky na dolní svorku -QH1 → napájen z -QH1, vstup nahoře (štítek „napájet z -QH1")', nj1 && st === 'napájet z -QH1', st);
    if (SNIMKY) await (await q.$('#rz-pohled')).screenshot({ path: path.join(SNIMKY, 'novy-jistic-zapojeny.png') });
    await tah(() => __T.sv('-FA99', 'dole', 0), () => __T.sv('-FI1', 'dole', 0));
    check('nový jistič: tah z jeho DOLNÍ svorky na výstup -FI1 → napájen z -FI1, vstup dole', await q.evaluate(() => { const x = __T.naj('-FA99'); return x.nadr === __T.naj('-FI1').uid && x.vstup === 'dole' && __T.naj('-FI1').nadr === ''; }), st);
    const d0 = await q.evaluate(() => JSON.stringify(__T.cist()));
    await tah(() => __T.sv('-FA99', 'nahore', 0), () => { const g = rozvGeom().filter(z => z.r === 3), L = g[g.length - 1]; return __T.mmBod(L.x + L.w + 25, L.y + RZG.H / 2); });
    check('nový jistič: tah z horní svorky do prázdna → nic se nezmění', await q.evaluate(d0 => JSON.stringify(__T.cist()) === d0, d0) && st === '');
    // d) dva nezapojené přístroje (svorky bez napájení): směr podle tahu
    await q.evaluate(() => { ['-X4', '-X5', '-X6', '-X7'].forEach((o, i) => { const x = rozvVlozit('v-x-rad', 2, 3 + i); x.ozn = o; x.faze = 'L1'; }); dokZmena(); rozvPohledVykreslit(); });
    await w(150);
    const sede = await q.evaluate(() => document.querySelector('#rz-pohled .rz-svorky[data-sv-uid="' + __T.naj('-X4').uid + '"] .rz-sv').getAttribute('stroke'));
    await tah(() => __T.sv('-X4', 'dole', 0), () => __T.sv('-X5', 'nahore', 0));
    const d1 = await q.evaluate(() => ({ x5: __T.naj('-X5').nadr === __T.naj('-X4').uid && !('vstup' in __T.naj('-X5')), x4: !('vstup' in __T.naj('-X4')) }));
    await tah(() => __T.sv('-X7', 'nahore', 0), () => __T.sv('-X6', 'dole', 0));
    const d2 = await q.evaluate(() => ({ x6: __T.naj('-X6').nadr === __T.naj('-X7').uid && __T.naj('-X6').vstup === 'dole', x7: __T.naj('-X7').vstup === 'dole' }));
    check('dva nezapojené: svorky volných přístrojů šedé; X4 dole → X5 nahoře = X5 z X4; X7 nahoře → X6 dole = X6 z X7 (výstup X7 nahoře, vstup X6 dole)',
      sede === '#b0b0b0' && d1.x5 && d1.x4 && d2.x6 && d2.x7, sede + ' ' + JSON.stringify(d1) + JSON.stringify(d2));
    // e) kreslení: bez čárkovaných obdélníků, krátké trasy, nic přes svorkovou lištu ani cizí řady
    const kr = await q.evaluate(() => {
      const r = { rect: document.querySelectorAll('#rz-pohled .rz-nap-vrstva rect[stroke-dasharray]').length, dlouhe: [], radou: [], stejna: [] };
      const mod = +__rz.skrin.modulu, x0 = RZG.okraj, x1 = RZG.okraj + mod * RZG.M;
      const radky = __rz.rady.map((rr, i) => ({ i: i, y0: rozvRadaY(i), y1: rozvRadaY(i) + RZG.H }));
      const rada = u => { const g = rozvGeom().filter(z => z.uid === u)[0]; return g ? g.r : -1; };
      document.querySelectorAll('#rz-pohled .rz-wire').forEach(g => {
        const pts = g.querySelector('.rz-w').getAttribute('d').match(/-?[\d.]+ -?[\d.]+/g).map(t => t.split(' ').map(Number));
        const src = g.getAttribute('data-wire-src'), dst = g.getAttribute('data-wire-dst'), ra = rada(src), rb = rada(dst), jm = (rozvNajit(dst) || { x: {} }).x.ozn;
        if (pts.length - 1 > 5) r.dlouhe.push(jm);
        const a = g.getAttribute('data-a').split(' ').map(Number), b2 = g.getAttribute('data-b').split(' ').map(Number);
        if (ra === rb && ra >= 0 && Math.abs(a[1] - b2[1]) < 0.01 && pts.length - 1 > 3) r.stejna.push(jm);
        for (let k = 0; k + 1 < pts.length; k++) {
          const [px, py] = pts[k], [qx, qy] = pts[k + 1];
          radky.forEach(R => { if (R.i === ra || R.i === rb) return;
            const sx0 = Math.min(px, qx), sx1 = Math.max(px, qx), sy0 = Math.min(py, qy), sy1 = Math.max(py, qy);
            if (sx1 > x0 + 0.5 && sx0 < x1 - 0.5 && sy1 > R.y0 + 0.5 && sy0 < R.y1 - 0.5) r.radou.push(jm + '×řada' + (R.i + 1)); });
        }
      });
      return r;
    });
    check('kreslení: v režimu Zapojení žádné čárkované obdélníky (rect se stroke-dasharray)', kr.rect === 0, kr.rect);
    check('kreslení: žádný vodič nemá víc než 5 úseků; mezi svorkami na stejné straně téže řady nejvýš 3', !kr.dlouhe.length && !kr.stejna.length, kr.dlouhe.concat(kr.stejna).join());
    check('kreslení: žádný vodič nevede přes svorkovou lištu ani přes řadu, se kterou nesouvisí', !kr.radou.length, kr.radou.slice(0, 6).join());
    if (SNIMKY) await (await q.$('#rz-pohled')).screenshot({ path: path.join(SNIMKY, 'rs2-v162.png') });
    check('v1.62: bez chyb na stránce', e11.length === 0, e11.join(' | '));
    await c11.close();
  }

  // ── skákající zoom (oprava 2026-11-06) ──────────────────────────────────
  // Skutečné posuvníky (headless je jinak schovává) a výška okna na hraně, kdy
  // dřív každé klepnutí přepnulo svislý posuvník rámečku a s ním měřítko.
  {
    const bz = await chromium.launch({ executablePath: CHROME, ignoreDefaultArgs: ['--hide-scrollbars'] });
    for (const vp of [{ width: 1920, height: 910 }, { width: 1920, height: 905 }, { width: 1366, height: 768 }, { width: 360, height: 740, mobil: true }]) {
      const cz = await kontext(bz, vp.mobil ? { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true } : { viewport: { width: vp.width, height: vp.height } });
      const ez = [], pz = await stranka(cz, URL, ez);
      await pz.evaluate(async () => { await __T.rs2(); __rz.vyber = null; rozvPohledVykreslit(); rozvVlastnostiVykreslit(); });
      await w(200);
      for (const nap of [false, true]) {
        if (nap) { await pz.evaluate(() => TD_AKCE.tdRNapRezim()); await w(150); }
        const ks = [];
        for (const o of ['-QH1', '-FA3', '-FA20', '-FI1', '-FA30', '-FA5', 'SPD1', '-FA40', '-FA24', '-FA10']) {
          const q = await pz.evaluate(o => __T.bod(o, 'nahore'), o);
          if (vp.mobil) await pz.touchscreen.tap(q.x, q.y); else await pz.mouse.click(q.x, q.y);
          await w(160);
          ks.push(await pz.evaluate(() => { const r = document.getElementById('rz-svg-ram'), s = r.querySelector('.rz-svg'); return (r.__k || 0).toFixed(4) + '/' + s.getAttribute('width'); }));
        }
        const ruzne = Array.from(new Set(ks));
        check('zoom: 10× klepnutí na přístroje ' + (nap ? 'v režimu Napájení' : 'v normálním režimu') + ' (' + vp.width + '×' + vp.height + ') — měřítko i šířka SVG beze změny', ruzne.length === 1, ruzne.join(' | '));
      }
      check('zoom (' + vp.width + '): bez chyb na stránce', ez.length === 0, ez.join(' | '));
      await cz.close();
    }
    await bz.close();
  }

  // ── starý rozvaděč z předchozí verze: data, schéma, PDF beze změny ─────
  {
    const ctxS = await kontext(b), errS = [];
    const s = await stranka(ctxS, URL_STARA, errS);
    const stary = await s.evaluate(async () => {
      await dokNovy('rozv');
      __T.dk('[data-dk="oznaceni"]', 'RH1'); __T.dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S'); __T.dk('[data-dk="datum"]', '2026-11-01');
      __T.dk('[data-dk="privodKabel"]', 'CYKY'); __T.dk('[data-dk="privodPrurez"]', '5×10');
      rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel'));
      rozvVlozit('v-qm-3-63', 0, 0); const fu = rozvVlozit('v-fu-3-1038', 0, 1); rozvVlozit('v-spd-2-3N', 0, 2);
      rozvVlozit('v-fi-4-40-30-A', 1, 0);
      for (let i = 0; i < 6; i++) Object.assign(rozvVlozit('v-fa-1-B16', 1, i + 1), { vyvod: 'Zásuvky ' + i, faze: ['L1', 'L2', 'L3'][i % 3], kabel: 'CYKY-J', prurez: '3×2,5', pi: '1,2' });
      Object.assign(rozvVlozit('v-fa-3-B25', 2, 0), { vyvod: 'Sporák', kabel: 'CYKY-J', prurez: '5×2,5', pi: '9' });
      rozvVlozit('v-x-rad', 2, 1);
      const svb = rozvVlozit('v-x-svork', 2, 2); svb.privodni = true;   // blok přívodních svorek (v1.57–v1.59)
      Object.assign(rozvVlozit('v-fa-1-B6', 2, 3), { predHlavnim: true, vyvod: 'Ovládání – CENTRAL STOP', faze: 'L1' });   // jistič ovládání na přívodu
      fu.pozn = 'vložka 25 gG';
      rozvPrecislovat(); dokZmena(); await dokUlozitOtevreny();
      const dok = JSON.parse(JSON.stringify(DOK.dokumenty.filter(x => x.uid === window.__dokOtevreny.uid)[0]));
      dok.data.otepleni = Object.assign({}, dok.data.otepleni, { okoli55: true });   // starší klíče (v9.139)
      dok.data.soudobost = { byty: { zap: true, n: 4, stupen: 'B' } };
      return JSON.stringify(dok);
    });
    // otevřít, projít Dokumenty a Schéma, uložit — v obou verzích; spočítat schéma, oteplení, fáze, soudobost, PDF, DXF
    const projit = async (pg, js) => pg.evaluate(async (js) => {
      const dok = JSON.parse(js), d0 = JSON.parse(JSON.stringify(dok.data));
      const ven = { listy: rozvSchemaListy(d0).map(l => l.svg).join('\n'),
        otepl: JSON.stringify(rozvOteplVypocet(d0), (k, v) => k === 'x' ? (v && v.uid) : v),
        faze: JSON.stringify(rozvFazeSouhrn(d0.rady), (k, v) => (k === 'bez' || k === 'bezIn') ? (v || []).length : v),
        soud: JSON.stringify(rozvSoudVypocet(d0), (k, v) => (k === 'x') ? (v && v.uid) : (k === 'vyvody' || k === 'bezPi') ? (v || []).length : v),
        dxf: rozvDxfListy(d0).map(l => l.svg).join('\n'),
        pdf: DOK_TYPY.rozv.pdf(d0).map(q => q.html || q.cela || '').join('\n') };
      await dokNacist();
      DOK.dokumenty = DOK.dokumenty.filter(x => x.uid !== dok.uid).concat([dok]); await dokZapsat();
      await dokOtevrit(dok.uid); await new Promise(r => setTimeout(r, 300));
      await dokUlozitOtevreny(); ven.jenOtevrit = JSON.stringify(DOK.dokumenty.filter(x => x.uid === dok.uid)[0].data);
      rozvZalozkaNastavit('dok'); await new Promise(r => setTimeout(r, 250));
      rozvZalozkaNastavit('sch'); await new Promise(r => setTimeout(r, 250)); rozvZalozkaNastavit('navrh'); await new Promise(r => setTimeout(r, 100));
      await dokUlozitOtevreny();
      ven.data = JSON.stringify(DOK.dokumenty.filter(x => x.uid === dok.uid)[0].data);
      return ven;
    }, js);
    const puv = await projit(s, stary);
    await ctxS.close();
    const ctxN = await kontext(b), errN = [];
    const nn = await stranka(ctxN, URL, errN);
    const nov = await projit(nn, stary);
    const rozdil = (a, b2) => { if (a === b2) return ''; let i = 0; while (a[i] === b2[i]) i++; return a.slice(Math.max(0, i - 60), i + 80) + ' ≠ ' + b2.slice(Math.max(0, i - 60), i + 80); };
    check('starý rozvaděč: otevření, Dokumenty, Schéma a uložení — data bajtově jako v předchozí verzi', nov.data === puv.data, rozdil(nov.data, puv.data));
    check('starý rozvaděč: otevření a uložení (bez Dokumentů) — data bajtově jako uložená', nov.jenOtevrit === JSON.stringify(JSON.parse(stary).data), rozdil(nov.jenOtevrit, JSON.stringify(JSON.parse(stary).data)));
    check('starý rozvaděč: schéma znak po znaku jako předchozí verze', nov.listy === puv.listy, rozdil(nov.listy, puv.listy));
    check('starý rozvaděč: oteplení, fáze a soudobost jako předchozí verze', nov.otepl === puv.otepl && nov.faze === puv.faze && nov.soud === puv.soud);
    check('starý rozvaděč: PDF dokumentace (bloky) a DXF jako předchozí verze', nov.pdf === puv.pdf && nov.dxf === puv.dxf, rozdil(nov.pdf, puv.pdf) || rozdil(nov.dxf, puv.dxf));
    check('předchozí verze i nová bez chyb', errS.length === 0 && errN.length === 0, errS.concat(errN).join(' | '));
    await ctxN.close();
  }

  check('žádná chyba na stránce', err.length === 0, err.join(' | '));
  console.log(res.join('\n'));
  console.log(res.filter(r => r.startsWith('❌')).length ? 'SELHALO' : 'VŠE OK (' + res.length + ')');
  await b.close();
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})();
