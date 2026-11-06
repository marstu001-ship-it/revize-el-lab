// Rozvaděč — kdo koho napájí (připomínka 2026-11-05, rozvaděč RS2 ve škole).
// Test hlídá:
//  - datový model napájení (rozvDeti, rozvPotomci, kruh, upozornění In, smazání → automatika),
//  - volbu „Napájen z" v panelu a „→ napájí",
//  - režim 🔗 Napájení: tažení myší, klik a klik, rámeček + „Napájet z…", Ctrl+Z, kontextové menu,
//    telefon 360 px (klepnutí),
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
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
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
        return { x: pt.x, y: pt.y };
      },
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
    r.koren = rozvKoren(__rz.rady) === n('-QH1').uid && !rozvMaNapajeni(n('-QH1'));
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
  check('RS2: B10 a B40 přímo z hlavního vypínače, -QH1 je kořen bez volby napájení', m.b10 && m.koren && m.nadrzeny === '-FI1|true', m.nadrzeny);
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
    rozvVybrat(n('-QH1').uid, false); r.qh = !document.querySelector('#rz-vlastnosti [data-rp2="nadr"]');
    rozvVybrat(n('SPD1').uid, false); r.spd = !!document.querySelector('#rz-vlastnosti [data-rp2="nadr"]');
    rozvVybrat(n('-FU1').uid, false); r.vlozka = !!document.querySelector('#rz-vlastnosti [data-rp2="vlozka"]');
    __rz.vyber = null; rozvVlastnostiVykreslit();
    return r;
  });
  check('panel: volba se jmenuje „Napájen z", první automaticky, pak „přímo z hlavního vypínače"', pan.label === 'Napájen z' && /^automaticky — -FI1/.test(pan.volby[0]) && pan.volby[1] === 'přímo z hlavního vypínače', pan.volby.slice(0, 3).join(' | '));
  check('panel: nabídka -FU1 Pojistkový…, -FI1 Chránič 40 A/30 mA 4P, -FA23 Jistič B40 3P; bez sebe a bez -QH1', pan.volby.some(v => /^-FU1 Pojistkový/.test(v)) &&
    pan.volby.indexOf('-FI1 Chránič 40 A/30 mA 4P') !== -1 && pan.volby.indexOf('-FA23 Jistič B40 3P') !== -1 && !pan.volby.some(v => /^-FA25 /.test(v) || /^-QH1/.test(v)), pan.volby.slice(2, 6).join(' | '));
  check('panel: u nadřazeného řádek „→ napájí: -FA25…FA44"', /→ napájí: -FA25…FA44/.test(pan.fi), pan.fi.match(/→ napájí[^\n]*/) + '');
  check('panel: změna volby zapíše nadr (ručně), -FA23 pak „→ napájí: -FA25", ZPĚT vrátí', pan.nove && /→ napájí: -FA25/.test(pan.fa23) && pan.zpet);
  check('panel: hlavní vypínač volbu nemá, svodič ano; pojistka má pole Vložka', pan.qh && pan.spd && pan.vlozka);

  // ── 3. režim 🔗 Napájení myší ─────────────────────────────────────────
  await p.evaluate(() => { TD_AKCE.tdRNapRezim(); document.querySelectorAll('.toast').forEach(t => t.remove()); });
  await w(150);
  const rez = await p.evaluate(() => ({
    btn: document.querySelector('.rz-nap-btn').getAttribute('aria-pressed'),
    banner: (document.querySelector('.rz-banner-nap') || {}).innerText || '',
    sipek: document.querySelectorAll('#rz-pohled .rz-nap-vrstva [data-nap-rodic]').length,
    napoveda: document.querySelector('#rz-pohled .rz-napoveda').innerText,
    fiSipka: !!document.querySelector('#rz-pohled [data-nap-rodic="' + __T.naj('-FI1').uid + '"] line[data-nap-deti]')
  }));
  check('režim Napájení: tlačítko zapnuté, nápověda „Táhněte od přístroje…"', rez.btn === 'true' && /Táhněte od přístroje, který napájí, k přístroji, který je napájen\. Nebo klepněte na napájející a pak na napájené\./.test(rez.napoveda));
  check('režim Napájení: šipky od -FU1 a -FI1 (FI1 jednou šipkou se sběrnicí), napájení z hlavního vypínače skryté', rez.sipek === 2 && rez.fiSipka, 'šipek ' + rez.sipek);
  // tažení z -FI1 na -FA20 (1f B10 z hlavního)
  const zpetDelka0 = await p.evaluate(() => (window.__zpetZasobnik || []).length);
  let a = await p.evaluate(() => __T.bod('-FI1', 'dole')), c = await p.evaluate(() => __T.bod('-FA20'));
  const poz0 = await p.evaluate(() => JSON.stringify(__rz.rady.map(r => r.prvky.map(x => x.uid))));
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(a.x + 20, a.y + 10, { steps: 4 });
  await p.mouse.move(c.x, c.y, { steps: 12 });
  const tahCara = await p.evaluate(() => document.getElementById('rz-nap-tah').getAttribute('visibility'));
  await p.mouse.up(); await w(150);
  const tah = await p.evaluate(() => ({ ok: __T.naj('-FA20').nadr === __T.naj('-FI1').uid && __T.naj('-FA20').nadrRucne === true,
    poz: JSON.stringify(__rz.rady.map(r => r.prvky.map(x => x.uid))) }));
  check('tažení myší z -FI1 na -FA20 nastaví napájení (čára během tažení), přístroje se nepřesunou', tah.ok && tahCara === 'visible' && tah.poz === poz0);
  await p.keyboard.press('Control+z'); await w(150);
  check('Ctrl+Z vrátí napájení nastavené tažením', await p.evaluate(() => __T.naj('-FA20').nadr === ''));
  // nepřípustný cíl: tažení z -FA25 na -FI1 (kruh) → nic
  a = await p.evaluate(() => __T.bod('-FA25', 'dole')); c = await p.evaluate(() => __T.bod('-FI1'));
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 10 });
  const cervena = await p.evaluate(() => document.getElementById('rz-nap-tah').getAttribute('stroke'));
  await p.mouse.up(); await w(150);
  check('tažení na nepřípustný cíl (kruh): čára červená, nic se neuloží', cervena === '#c0392b' && await p.evaluate(() => __T.naj('-FI1').nadr === ''), cervena);
  // klik a klik: -FA23 a pak tři jističe
  for (const o of ['-FA23', '-FA19', '-FA20', '-FA21']) { const q = await p.evaluate(o => __T.bod(o), o); await p.mouse.click(q.x, q.y); await w(120); }
  const kk = await p.evaluate(() => ({ ok: ['-FA19', '-FA20', '-FA21'].every(o => __T.naj(o).nadr === __T.naj('-FA23').uid),
    zdroj: __rz.napZdroj === __T.naj('-FA23').uid, banner: document.querySelector('.rz-banner-nap').innerText }));
  check('klik a klik: -FA23, pak -FA19, -FA20, -FA21 → napájené z -FA23', kk.ok && kk.zdroj && /Napájí -FA23/.test(kk.banner), kk.banner);
  const q21 = await p.evaluate(() => __T.bod('-FA21')); await p.mouse.click(q21.x, q21.y); await w(120);
  check('klik a klik: další klik na napájený ho ubere (z hlavního vypínače)', await p.evaluate(() => __T.naj('-FA21').nadr === ''));
  await p.keyboard.press('Escape'); await w(80);
  check('Esc ukončí výběr napájejícího', await p.evaluate(() => !__rz.napZdroj));
  for (let i = 0; i < 4; i++) { await p.keyboard.press('Control+z'); await w(100); }   // 3× přidat + 1× ubrat
  check('Ctrl+Z vrátí kroky klik a klik (každý jedna operace)', await p.evaluate(() => ['-FA19', '-FA20', '-FA21'].every(o => __T.naj(o).nadr === '')));
  // rámeček + „Napájet z…"
  const r1 = await p.evaluate(() => { const g = rozvGeom().filter(q => q.r === 1); const svg = document.querySelector('#rz-pohled .rz-svg'), M = svg.getScreenCTM();
    const A = new DOMPoint(g[0].x - 1, g[0].y - 1.5).matrixTransform(M), B = new DOMPoint(g[2].x + g[2].w - 2, g[2].y + 10).matrixTransform(M); return { a: { x: A.x, y: A.y }, b: { x: B.x, y: B.y } }; });
  await p.mouse.move(r1.a.x, r1.a.y); await p.mouse.down(); await p.mouse.move(r1.b.x, r1.b.y, { steps: 8 }); await p.mouse.up(); await w(150);
  const vyb = await p.evaluate(() => rozvVybrane().map(u => rozvNajit(u).x.ozn).join());
  await p.evaluate(() => document.querySelector('[data-action="tdRNapZ"]').click()); await w(100);
  const ceka = await p.evaluate(() => document.querySelector('.rz-banner-nap').innerText);
  const qf = await p.evaluate(() => __T.bod('-FA24')); await p.mouse.click(qf.x, qf.y); await w(150);
  const ram = await p.evaluate(() => ['-FA15', '-FA16', '-FA17'].map(o => __T.naj(o).nadr === __T.naj('-FA24').uid).join());
  check('rámeček + „Napájet z…" + klepnutí na -FA24 nastaví napájení všem vybraným', vyb === '-FA15,-FA16,-FA17' && /Klepněte na přístroj, který napájí vybrané \(3 přístroje\)/.test(ceka) && ram === 'true,true,true', vyb + ' | ' + ram);
  // pravé tlačítko na šipce
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const sip = await p.evaluate(() => { const el = document.querySelector('#rz-pohled [data-nap-deti="' + __T.naj('-FA16').uid + '"]'); const bb = el.getBoundingClientRect(); return { x: bb.left + bb.width / 2, y: bb.top + bb.height / 2 }; });
  await p.mouse.click(sip.x, sip.y, { button: 'right' }); await w(150);
  const menu = await p.evaluate(() => Array.from(document.querySelectorAll('.kt-menu button, .kt-menu [role="menuitem"]')).map(x => x.textContent.trim()));
  await p.evaluate(() => { const b = Array.from(document.querySelectorAll('.kt-menu button, .kt-menu [role="menuitem"]')).filter(x => /Odpojit/.test(x.textContent))[0]; if (b) b.click(); }); await w(150);
  check('pravý klik na šipce: Odpojit / Vrátit na automatiku; Odpojit → z hlavního vypínače', menu.some(t => /Odpojit — napájet z hlavního vypínače/.test(t)) && menu.some(t => /Vrátit na automatiku/.test(t)) &&
    await p.evaluate(() => __T.naj('-FA16').nadr === '' && __T.naj('-FA15').nadr === __T.naj('-FA24').uid), menu.join(' | '));
  // geometrie šipek (2026-11-06): pravoúhle, mezerou nad řadou / po okraji rámu, nikdy přes přístroj
  const geo = await p.evaluate(() => {
    rozvNapajeniNastavit([__T.naj('-FA1').uid], __T.naj('-FA24').uid);   // dítě v jiné řadě než nadřazený
    __rzNap.skrytHlavni = false; rozvSvgPrekreslit();
    const rects = rozvGeom().map(g => ({ uid: g.uid, x: g.x, y: g.y, w: g.w, h: g.h || RZG.H }));
    const segs = [];
    document.querySelectorAll('#rz-pohled .rz-nap-vrstva path[data-nap-deti], #rz-pohled .rz-nap-vrstva line[data-nap-deti]').forEach(el => {
      const rod = el.closest('[data-nap-rodic]').getAttribute('data-nap-rodic');
      let pts = el.tagName === 'line' ? [[+el.getAttribute('x1'), +el.getAttribute('y1')], [+el.getAttribute('x2'), +el.getAttribute('y2')]]
        : (el.getAttribute('d').match(/-?[\d.]+\s+-?[\d.]+/g) || []).map(s => s.trim().split(/\s+/).map(Number));
      for (let i = 1; i < pts.length; i++) segs.push({ a: pts[i - 1], b: pts[i], rod, line: el.tagName === 'line' });
    });
    let sikme = 0, okraj = 0; const pres = [], prekryv = [];
    segs.forEach(s => {
      const [a, b] = [s.a, s.b];
      if (Math.abs(a[0] - b[0]) > 0.01 && Math.abs(a[1] - b[1]) > 0.01) sikme++;
      const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]), y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]), e = 0.05;
      if (Math.abs(a[0] - b[0]) < 0.01 && y2 - y1 > 40) okraj++;   // svislá čára přes řadu = po okraji rámu
      rects.forEach(r => { if (x2 > r.x + e && x1 < r.x + r.w - e && y2 > r.y + e && y1 < r.y + r.h - e) pres.push(rozvNajit(r.uid).x.ozn); });
    });
    // vodorovné úseky různých nadřazených ve stejné výšce se nepřekrývají
    const vod = segs.filter(s => !s.line && Math.abs(s.a[1] - s.b[1]) < 0.01 && Math.abs(s.a[0] - s.b[0]) > 0.01);
    vod.forEach((s, i) => vod.slice(i + 1).forEach(t => {
      if (s.rod !== t.rod && Math.abs(s.a[1] - t.a[1]) < 0.01 && Math.min(Math.max(s.a[0], s.b[0]), Math.max(t.a[0], t.b[0])) - Math.max(Math.min(s.a[0], s.b[0]), Math.min(t.a[0], t.b[0])) > 0.05) prekryv.push(s.a[1]);
    }));
    const r = { segs: segs.length, sikme, okraj, pres: Array.from(new Set(pres)).join(','), prekryv: prekryv.length };
    zpetPosledni(); __rzNap.skrytHlavni = true; rozvSvgPrekreslit();
    return r;
  });
  check('šipky Napájení pravoúhle: žádný šikmý úsek, žádný úsek přes obdélník přístroje (RS2 i s napájením z hlavního vypínače)', geo.segs > 20 && geo.sikme === 0 && geo.pres === '', JSON.stringify(geo));
  check('šipky Napájení: do jiné řady po okraji rámu, čáry ve stejné mezeře se nepřekrývají', geo.okraj >= 1 && geo.prekryv === 0, JSON.stringify(geo));
  if (SNIMKY) { await p.evaluate(() => { document.querySelectorAll('.toast').forEach(t => t.remove()); __rz.vyber = null; __rz.vic = null; rozvPohledVykreslit(); }); await (await p.$('#rz-pohled')).screenshot({ path: path.join(SNIMKY, 'rs2-napajeni.png') }); }
  await p.evaluate(() => { TD_AKCE.tdRNapRezim(); });
  check('mimo režim Napájení šipky nejsou', await p.evaluate(() => !document.querySelector('#rz-pohled .rz-nap-vrstva')));
  // vrátit -FA15,-FA17 na přímé napájení
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

  // ── 6. telefon 360 px: klepnutí ────────────────────────────────────────
  {
    const ctxM = await kontext(b, { viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const errM = [];
    const t = await stranka(ctxM, URL, errM);
    await t.evaluate(async () => { await __T.rs2(); TD_AKCE.tdRNapRezim(); document.querySelectorAll('.toast').forEach(x => x.remove()); });
    await w(200);
    for (const o of ['-FI1', '-FA22']) {
      await t.evaluate(o => document.getElementById('rz-svg-ram') && (() => { const q = __T.naj(o), g = rozvGeom().filter(x => x.uid === q.uid)[0], ram = document.getElementById('rz-svg-ram'), k = ram.__k || 3; ram.scrollLeft = Math.max(0, g.x * k - 60); ram.scrollTop = Math.max(0, g.y * k - 60); })(), o);
      await w(100);
      const q = await t.evaluate(o => __T.bod(o), o); await t.touchscreen.tap(q.x, q.y); await w(250);
    }
    const tel = await t.evaluate(() => __T.naj('-FA22').nadr === __T.naj('-FI1').uid);
    check('telefon 360 px: klepnutí na -FI1 a pak na -FA22 nastaví napájení', tel);
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
