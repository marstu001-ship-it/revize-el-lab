// Oteplení rozvaděče (2026-11-09):
// 1) výchozí Inc = ručně → Ib → 0,8 In (čl. 10.10.4.1 e) — B16 bez Ib a Inc
//    = 12,8 A, Pv × 0,64, bez „> 0,8 In"; ruční 16 → „> 0,8 In"; náznak „0,8 In = 12,8";
// 2) „Doplnit Pv z knihovny…" — vymyšlená řada „Test LSN" (B10 / B16 1P s Pv)
//    a „Test LFN" (chránič): tlačítko jen s knihovnou a chybějícím Pv, skupiny,
//    předvolba řady podle chrániče v rozvaděči, zapíše jen p.pv + p.pvZdroj,
//    RCBO a C16 bez shody vypíše, poznámka „z Test LSN …", Ctrl+Z vrátí vše;
// 2b) Penc skříně z knihovny: řádek jen u skříně bez Penc, řazení podle podobnosti,
//    filtr výrobce, zapíše jen penc + pencZdroj, rozložení beze změny, Ctrl+Z;
// 3) starý rozvaděč: otevření a uložení data bajtově nemění.
// Žádná data výrobců — vše vymyšlené.
const { chromium } = require('./pw');
const path = require('path');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: path.join(__dirname, 'knihovny', r.request().url().split('/').pop()),
    contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const err = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => err.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(URL); await w(1200);

  // ── 0. starý rozvaděč (uložený bez Inc, Ib a Pv) ─────────────────────
  await p.evaluate(async () => {
    window.__T = {
      dk: (s, v) => { const e = dokForm().querySelector(s); if (e.type === 'checkbox') e.checked = v; else e.value = v;
        e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); },
      cist: () => DOK_TYPY.rozv.cist(dokForm()),
      naj: o => { let r = null; __rz.rady.forEach(ra => ra.prvky.forEach(x => { if (x.ozn === o) r = x; })); return r; }
    };
    await dokNovy('rozv'); __T.dk('[data-dk="oznaceni"]', 'RS9'); __T.dk('[data-dk="soustava"]', '1NPE ~230 V TN-S');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-1x12-n'));
    const V = (kid, o) => Object.assign(rozvVlozit(kid, 0, __rz.rady[0].prvky.length), o || {});
    V('v-qm-1-40'); V('v-fa-1-B16', { faze: 'L1' }); dokZmena(); await dokUlozitOtevreny();
    window.__stary = window.__dokOtevreny.uid;
  });
  const staryPred = await p.evaluate(async () => { await dokNacist(); return JSON.stringify(DOK.dokumenty.find(x => x.uid === window.__stary)); });

  // ── 1. výchozí Inc 0,8 In ────────────────────────────────────────────
  await p.evaluate(async () => {
    await dokNovy('rozv'); __T.dk('[data-dk="oznaceni"]', 'RO1'); __T.dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S'); __T.dk('[data-dk="privodIn"]', '40');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-2x12-n') || rozvKnihPolozka('v-sk-3x12-n'));
    const V = (kid, o) => Object.assign(rozvVlozit(kid, 0, __rz.rady[0].prvky.length), o || {});
    V('v-qm-3-40'); V('v-fi-4-40-30-A');
    ['L1', 'L2', 'L3'].forEach(f => V('v-fa-1-B16', { faze: f, vyvod: 'Zásuvky ' + f }));
    V('v-fa-1-B10', { faze: 'L1', vyvod: 'Světla' }); V('v-fa-1-C16', { faze: 'L2', vyvod: 'Pračka' });
    V('v-fifa-1N-B16', { faze: 'L3', vyvod: 'Koupelna' });
    __rz.vyber = null; rozvPohledVykreslit(); rozvVlastnostiVykreslit(); dokZmena(); await dokUlozitOtevreny();
    rozvZalozkaNastavit('dok'); document.querySelector('[data-oddil="otepleni"]').open = true;
  });
  await w(300);
  const i1 = await p.evaluate(() => {
    const fa = __T.naj('-FA1'); fa.p.pv = 2; dokZmena();
    const v = rozvOteplVypocet(__T.cist()), q = v.radky.find(r => r.x.uid === fa.uid);
    rozvZalozkaNastavit('dok'); document.querySelector('[data-oddil="otepleni"]').open = true;
    const tr = document.querySelector('.rot-tab tr[data-uid="' + fa.uid + '"]');
    return { eff: q.eff, pvInc: Math.round(q.pvInc * 10000) / 10000, nad: q.nad08, ph: tr.querySelector('.rot-inc').placeholder, z08: tr.querySelector('[data-rot="08"]').textContent,
      pozn: Array.from(document.querySelectorAll('[data-oddil="otepleni"] .dk-pozn')).map(x => x.textContent).join(' | '),
      tit: tr.querySelector('.rot-inc').title,
      fi: (() => { const f = v.radky.find(r => r.x.ozn === '-FI1'); return { eff: f.eff, nad: f.nad08 }; })(),
      nadVse: v.nad08.length };
  });
  check('B16 bez Inc a Ib: Inc 12,8 A (0,8 In), Pv při Inc = 2 × 0,64 = 1,28 W, bez „> 0,8 In"', i1.eff === 12.8 && i1.pvInc === 1.28 && !i1.nad && i1.z08 === '✓', JSON.stringify(i1));
  check('náznak v poli Inc „0,8 In = 12,8" a bublina „0,8 In (čl. 10.10.4.1 e)"', i1.ph === '0,8 In = 12,8' && /0,8 In \(čl\. 10\.10\.4\.1 e\)/.test(i1.tit), i1.ph + ' / ' + i1.tit);
  check('poznámka pod tabulkou: „Prázdné Inc = Ib; chybí-li Ib, 0,8 In (čl. 10.10.4.1 e). U chráničů a hlavního vypínače součet proudů vývodů za nimi."',
    i1.pozn.indexOf('Prázdné Inc = Ib; chybí-li Ib, 0,8 In (čl. 10.10.4.1 e). U chráničů a hlavního vypínače součet proudů vývodů za nimi.') !== -1, i1.pozn.slice(0, 200));
  check('chránič = součet vývodů za ním (z jejich výchozího Inc), bez „> 0,8 In"; žádný řádek s „> 0,8 In"', i1.fi.nad === false && i1.nadVse === 0 && i1.fi.eff > 0, JSON.stringify(i1.fi));
  await p.fill('.rot-inc[data-uid="' + (await p.evaluate(() => __T.naj('-FA1').uid)) + '"]', '16'); await w(200);
  const i2 = await p.evaluate(() => {
    const fa = __T.naj('-FA1'), v = rozvOteplVypocet(__T.cist()), q = v.radky.find(r => r.x.uid === fa.uid);
    return { eff: q.eff, nad: q.nad08, z08: document.querySelector('.rot-tab tr[data-uid="' + fa.uid + '"] [data-rot="08"]').textContent, pvInc: q.pvInc };
  });
  check('ručně zadané Inc 16 → „> 0,8 In", Pv při Inc 2 W', i2.eff === 16 && i2.nad && /> 0,8 In/.test(i2.z08) && i2.pvInc === 2, JSON.stringify(i2));
  await p.fill('.rot-inc[data-uid="' + (await p.evaluate(() => __T.naj('-FA1').uid)) + '"]', ''); await w(100);
  const i3 = await p.evaluate(() => { const fa = __T.naj('-FA2'); fa.ib = '14'; const v = rozvOteplVypocet(__T.cist()); const q = v.radky.find(r => r.x.uid === fa.uid); const r = { eff: q.eff, nad: q.nad08, f1: v.radky.find(r => r.x.ozn === '-FA1').eff };
    fa.ib = '10'; const v2 = rozvOteplVypocet(__T.cist()); r.eff2 = v2.radky.find(r => r.x.uid === fa.uid).eff; r.nad2 = v2.radky.find(r => r.x.uid === fa.uid).nad08;
    r.fiNad = v.radky.find(r => r.x.ozn === '-FI1').nad08; fa.ib = ''; return r; });
  check('Ib 14 A u B16 → Inc 14 a „> 0,8 In"; Ib 10 → bez; prázdné ruční Inc → zpět 12,8', i3.eff === 14 && i3.nad && i3.eff2 === 10 && !i3.nad2 && i3.f1 === 12.8, JSON.stringify(i3));

  // ── 2. Doplnit Pv z knihovny ─────────────────────────────────────────
  const t0 = await p.evaluate(() => { __T.naj('-FA1').p.pv = ''; dokZmena(); rozvZalozkaNastavit('dok'); document.querySelector('[data-oddil="otepleni"]').open = true;
    const l = document.querySelector('.rot-pvk-lista'); return { je: !!l, hidden: l ? l.hidden : null }; });
  check('bez knihovny výrobců tlačítko „Doplnit Pv z knihovny…" není vidět', t0.je && t0.hidden === true, JSON.stringify(t0));
  await p.evaluate(async () => {
    await dokNacist();
    const P = o => DOK.rozvKnihovna.push(rozvPolozkaNorm(Object.assign({ druh: 'pristroj', vyrobce: 'Test', zdroj: 'import', sirka: 1 }, o), 'pristroj'));
    P({ id: 'u-t-lsn10', kat: 'FA', rada: 'LSN', typ: 'LSN 10B/1', poly: '1', In: 10, char: 'B', pv: 1.8 });
    P({ id: 'u-t-lsn16', kat: 'FA', rada: 'LSN', typ: 'LSN 16B/1', poly: '1', In: 16, char: 'B', pv: 2.2 });
    P({ id: 'u-t-lsn25', kat: 'FA', rada: 'LSN', typ: 'LSN 25B/3', poly: '3', In: 25, char: 'B', pv: 2.5 });
    P({ id: 'u-t-ltn16', kat: 'FA', rada: 'LTN', typ: 'LTN 16B/1', poly: '1', In: 16, char: 'B' });   // bez Pv → řada se nenabízí
    P({ id: 'u-t-lfn40', kat: 'FI', rada: 'LFN', typ: 'LFN 40/4/030/A', poly: '4', In: 40, idn: 30, rcdTyp: 'A', pv: 1.5, sirka: 4 });
    P({ id: 'u-t-asn40', kat: 'QM', rada: 'ASN', typ: 'ASN 40/3', poly: '3', In: 40, pv: 1.1, sirka: 3 });
    await dokZapsat();
    // chránič FI1 je už z řady Test LFN (bez Pv) → předvolba u chráničů
    Object.assign(__T.naj('-FI1').p, { vyrobce: 'Test', rada: 'LFN', typ: 'LFN 40/4/030/A' });
    dokZmena(); rozvZalozkaNastavit('dok'); document.querySelector('[data-oddil="otepleni"]').open = true;
  });
  await w(200);
  const t1 = await p.evaluate(() => !document.querySelector('.rot-pvk-lista').hidden);
  check('s knihovnou výrobců a chybějícím Pv je tlačítko vidět', t1);
  const radyLTN = await p.evaluate(() => rozvPvKnihRady().map(r => rozvPvKnihRadaText(r)).join(','));
  check('nabízí jen řady s vyplněným Pv (LTN bez Pv ne)', !/LTN/.test(radyLTN) && /Test LSN/.test(radyLTN) && /Test LFN/.test(radyLTN), radyLTN);
  const pred = await p.evaluate(() => JSON.stringify(__T.cist()));
  await p.click('.rot-pvk-lista button'); await w(300);
  const d1 = await p.evaluate(() => {
    const sk = Array.from(document.querySelectorAll('#rz-pvk-obsah .rz-pvk-sk')).map(x => ({ t: x.querySelector('b').textContent, v: x.querySelector('select').value,
      o: Array.from(x.querySelectorAll('option')).map(o => o.textContent).join(',') }));
    return { open: document.getElementById('modal-rz-pvknih').classList.contains('open'), sk };
  });
  const g = n => d1.sk.find(x => x.t.indexOf(n) === 0) || {};
  check('dialog: skupiny „Jistič 1P – 5 ks", „RCBO 1+N – 1 ks", „Chránič 4P – 1 ks", „Hlavní vypínač 3P – 1 ks"',
    d1.open && g('Jistič 1P').t === 'Jistič 1P – 5 ks' && g('RCBO 1+N').t === 'RCBO 1+N – 1 ks' && g('Chránič 4P').t === 'Chránič 4P – 1 ks' && g('Hlavní vypínač 3P').t === 'Hlavní vypínač 3P – 1 ks', JSON.stringify(d1.sk.map(x => x.t)));
  check('chránič má předvybranou řadu, kterou už FI1 v rozvaděči má (Test LFN)', g('Chránič').v === 'Test|LFN', g('Chránič').v);
  check('jističe nabízejí jen řady s Pv u jističů (Test LSN), ne LFN', /Test LSN/.test(g('Jistič').o) && !/LFN/.test(g('Jistič').o), g('Jistič').o);
  await p.selectOption('#rz-pvk-obsah select[data-pvk="FA|1"]', 'Test|LSN');
  await p.selectOption('#rz-pvk-obsah select[data-pvk="FIFA|1+N"]', 'Test|LSN').catch(() => {});
  await w(200);
  const d2 = await p.evaluate(() => ({ pres: Array.from(document.querySelectorAll('.rz-pvk-pres li')).map(x => x.textContent), btn: document.getElementById('rz-pvk-pouzit').textContent,
    stav: Array.from(document.querySelectorAll('.rz-pvk-stav')).map(x => x.textContent) }));
  check('RCBO: v knihovně není řada s Pv pro RCBO — dialog to vypíše', d2.stav.some(x => /není řada s Pv/.test(x)), d2.stav.join(' | '));
  check('C16 v řadě není: „-FA5 C16 1P: v řadě Test LSN není – doplňte ručně"', d2.pres.indexOf('-FA5 C16 1P: v řadě Test LSN není – doplňte ručně') !== -1, d2.pres.join(' | '));
  await p.screenshot({ path: path.join(__dirname, '_beh', 'otepleni-pv-dialog.png'), clip: await p.evaluate(() => { const r = document.querySelector('#modal-rz-pvknih .modal').getBoundingClientRect(); return { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 }; }) });
  await p.click('#rz-pvk-pouzit'); await w(400);
  const a1 = await p.evaluate(() => {
    const D = __T.cist(), vse = []; D.rady.forEach(r => r.prvky.forEach(x => vse.push(x)));
    const by = o => vse.find(x => x.ozn === o);
    const v = rozvOteplVypocet(D);
    return { fa1: [by('-FA1').p.pv, by('-FA1').p.pvZdroj], fa4: [by('-FA4').p.pv, by('-FA4').p.pvZdroj], fa5: by('-FA5').p.pv, rcbo: by('-FI/FA1') ? by('-FI/FA1').p.pv : 'x',
      fi: [by('-FI1').p.pv, by('-FI1').p.pvZdroj], qh: [by('-QH1').p.pv, by('-QH1').p.pvZdroj],
      nazev: by('-FA1').p.nazev, vyr: by('-FA1').p.vyrobce, knih: by('-FA1').knih, typ: by('-FA1').p.typ,
      pozn: (document.querySelector('.rot-tab tr[data-uid="' + by('-FA1').uid + '"] .rot-pvz') || {}).textContent,
      open: document.getElementById('modal-rz-pvknih').classList.contains('open'),
      chybi: v.radky.filter(q => q.chybi).map(q => q.x.ozn).join(',') };
  });
  check('doplnění zapsalo Pv a zdroj: -FA1 B16 2,2 „Test LSN 16B/1", -FA4 B10 1,8, chránič 1,5, hlavní vypínač 1,1',
    a1.fa1[0] === 2.2 && a1.fa1[1] === 'Test LSN 16B/1' && a1.fa4[0] === 1.8 && a1.fi[0] === 1.5 && a1.fi[1] === 'Test LFN 40/4/030/A' && a1.qh[0] === 1.1, JSON.stringify(a1));
  check('ostatní údaje přístroje beze změny (název, výrobce „obecný", knih, typ)', a1.vyr === 'obecný' && a1.knih === 'v-fa-1-B16' && /Jistič/.test(a1.nazev || 'Jistič') && !a1.typ, JSON.stringify([a1.nazev, a1.vyr, a1.knih, a1.typ]));
  check('C16 a RCBO bez shody zůstaly bez Pv („doplňte Pv")', a1.fa5 === '' && a1.rcbo === '' && /-FA5/.test(a1.chybi), a1.chybi);
  check('v tabulce šedá poznámka „z Test LSN 16B/1"', a1.pozn === 'z Test LSN 16B/1', a1.pozn);
  await p.keyboard.press('Control+z'); await w(400);
  const z1 = await p.evaluate(() => JSON.stringify(__T.cist()));
  check('Ctrl+Z vrátí celé doplnění najednou (data jako před doplněním)', z1 === pred, z1.length + ' / ' + pred.length);
  // ruční přepsání Pv zruší zdroj
  await p.click('.rot-pvk-lista button'); await w(200);
  await p.selectOption('#rz-pvk-obsah select[data-pvk="FA|1"]', 'Test|LSN'); await w(100);
  await p.click('#rz-pvk-pouzit'); await w(300);
  const uid1 = await p.evaluate(() => __T.naj('-FA1').uid);
  await p.fill('.rot-pv[data-uid="' + uid1 + '"]', '2,5'); await w(200);
  const r1 = await p.evaluate(() => ({ pv: __T.naj('-FA1').p.pv, z: __T.naj('-FA1').p.pvZdroj, pozn: !!document.querySelector('.rot-tab tr[data-uid="' + __T.naj('-FA1').uid + '"] .rot-pvz') }));
  check('ruční přepsání Pv poznámku „z …" a pvZdroj zruší', r1.pv === 2.5 && r1.z === undefined && !r1.pozn, JSON.stringify(r1));
  // uložení a znovu otevření drží pvZdroj
  const u1 = await p.evaluate(async () => { await dokUlozitOtevreny(); const uid = window.__dokOtevreny.uid; await dokOtevrit(uid); return { fa4: __T.naj('-FA4').p.pvZdroj }; });
  check('po uložení a otevření zůstane pvZdroj („Test LSN 10B/1")', u1.fa4 === 'Test LSN 10B/1', JSON.stringify(u1));

  // ── 2b. Penc skříně z knihovny ───────────────────────────────────────
  const p0 = await p.evaluate(async () => {
    await dokNacist();
    const S = o => DOK.rozvKnihovna.push(rozvPolozkaNorm(Object.assign({ druh: 'skrin', zdroj: 'import' }, o), 'skrin'));
    S({ id: 'u-t-sk-424', vyrobce: 'Test', typ: 'RZG-4x24', nazev: 'Rozvodnice 4×24', rady: 4, modulu: 24, material: 'oceloplech', provedeni: 'nástěnná', penc: 80 });
    S({ id: 'u-t-sk-212', vyrobce: 'Test', typ: 'RZP-2x12', nazev: 'Rozvodnice 2×12', rady: 2, modulu: 12, material: 'plast', provedeni: 'nástěnná', penc: 30 });
    S({ id: 'u-b-sk-212', vyrobce: 'Výrobce B', typ: 'B-212', nazev: 'Skříň 2×12', rady: 2, modulu: 12, material: 'plast', provedeni: 'zapuštěná', penc: 25 });
    S({ id: 'u-t-sk-bez', vyrobce: 'Test', typ: 'BEZ-PENC', rady: 2, modulu: 12, material: 'plast', provedeni: 'nástěnná' });
    await dokZapsat();
    rozvZalozkaNastavit('dok'); document.querySelector('[data-oddil="otepleni"]').open = true;
    return { skrin: JSON.stringify(__rz.skrin), rady: JSON.stringify(__rz.rady), rad: __rz.skrin.rady, mod: __rz.skrin.modulu, penc: __rz.skrin.penc,
      lista: !document.querySelector('.rot-pvk-lista').hidden };
  });
  check('skříň bez Penc a knihovna se skříněmi s Penc → tlačítko je vidět', p0.lista && (p0.penc === '' || p0.penc == null), JSON.stringify([p0.lista, p0.penc, p0.rad, p0.mod]));
  await p.click('.rot-pvk-lista button'); await w(300);
  const p1 = await p.evaluate(() => {
    const r = document.querySelector('#rz-pvk-obsah .rz-pvk-penc');
    return { je: !!r, t: r && r.querySelector('b').textContent, o: r ? Array.from(r.querySelectorAll('select[data-pvk-penc] option')).map(x => x.value) : [],
      v: r ? Array.from(r.querySelectorAll('select[data-pvk-penc-vyr] option')).map(x => x.value) : [] };
  });
  check('dialog má řádek „Skříň – Penc", jen skříně s Penc, nejpodobnější (2×12 plast nástěnná) nahoře', p1.je && p1.t === 'Skříň – Penc' && p1.o[1] === 'u-t-sk-212' && p1.o[2] === 'u-b-sk-212' && p1.o.indexOf('u-t-sk-bez') === -1 && p1.o.indexOf('u-t-sk-424') === 3, JSON.stringify(p1));
  await p.selectOption('#rz-pvk-obsah select[data-pvk-penc-vyr]', 'Výrobce B'); await w(150);
  const p2 = await p.evaluate(() => Array.from(document.querySelectorAll('#rz-pvk-obsah select[data-pvk-penc] option')).map(x => x.value));
  check('filtr podle výrobce nabídne jen jeho skříně', p2.join(',') === ',u-b-sk-212', p2.join(','));
  await p.selectOption('#rz-pvk-obsah select[data-pvk-penc-vyr]', ''); await w(100);
  await p.selectOption('#rz-pvk-obsah select[data-pvk-penc]', 'u-t-sk-212'); await w(150);
  await p.selectOption('#rz-pvk-obsah select[data-pvk="FA|1"]', '').catch(() => {});
  await p.evaluate(() => document.querySelectorAll('#rz-pvk-obsah select[data-pvk]').forEach(s => { s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); }));
  await w(150);
  const pBtn = await p.evaluate(() => document.getElementById('rz-pvk-pouzit').textContent);
  await p.screenshot({ path: path.join(__dirname, '_beh', 'otepleni-penc-dialog.png'), clip: await p.evaluate(() => { const r = document.querySelector('#modal-rz-pvknih .modal').getBoundingClientRect(); return { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 }; }) });
  await p.click('#rz-pvk-pouzit'); await w(400);
  const p3 = await p.evaluate(() => {
    const D = __T.cist(), sk = Object.assign({}, D.skrin); const pz = (document.querySelector('[data-oddil="otepleni"] .rot-pvz[title*="Penc"]') || {}).textContent;
    const v = rozvOteplVypocet(D); delete sk.penc; delete sk.pencZdroj;
    return { penc: D.skrin.penc, zdroj: D.skrin.pencZdroj, sk: JSON.stringify(sk), rady: JSON.stringify(__rz.rady), pz, vpenc: v.penc, pole: (dokForm().querySelector('[data-dk="otepleni.penc"]') || {}).value };
  });
  check('tlačítko jen pro Penc: „✓ Doplnit Penc"', /Doplnit Penc$/.test(pBtn), pBtn);
  check('po výběru se zapíše jen Penc 30 a zdroj „Test RZP-2x12"; výpočet bere Penc 30', p3.penc === 30 && p3.zdroj === 'Test RZP-2x12' && p3.vpenc === 30, JSON.stringify([p3.penc, p3.zdroj, p3.vpenc, p3.pole]));
  const skPred = JSON.parse(p0.skrin); delete skPred.penc; delete skPred.pencZdroj;
  check('rozměry, řady skříně i rozložení přístrojů beze změny', p3.sk === JSON.stringify(skPred) && p3.rady === p0.rady, '');
  check('u Penc šedá poznámka „z Test RZP-2x12"', p3.pz === 'z Test RZP-2x12', p3.pz);
  await p.keyboard.press('Control+z'); await w(400);
  const p4 = await p.evaluate(() => ({ penc: __rz.skrin.penc, z: __rz.skrin.pencZdroj }));
  check('Ctrl+Z vrátí Penc i zdroj', (p4.penc === '' || p4.penc == null) && p4.z === undefined, JSON.stringify(p4));
  const p5 = await p.evaluate(async () => {
    __rz.skrin.penc = 45; dokZmena(); rozvZalozkaNastavit('dok'); document.querySelector('[data-oddil="otepleni"]').open = true;
    TD_AKCE.tdRPvkOtevrit(); await new Promise(r => setTimeout(r, 150));
    const r = { radek: !!document.querySelector('#rz-pvk-obsah .rz-pvk-penc'), open: document.getElementById('modal-rz-pvknih').classList.contains('open') };
    TD_AKCE.tdRPvkZavrit(); __rz.skrin.penc = ''; dokZmena(); return r;
  });
  check('skříň s vyplněným Penc → řádek „Skříň – Penc" se neukáže', !p5.radek, JSON.stringify(p5));

  // ── 3. starý rozvaděč bajtově ────────────────────────────────────────
  const staryPo = await p.evaluate(async () => {
    await dokOtevrit(window.__stary); await new Promise(r => setTimeout(r, 300));
    rozvZalozkaNastavit('dok'); await new Promise(r => setTimeout(r, 200)); rozvZalozkaNastavit('navrh');
    await dokUlozitHned && dokUlozitHned(); await dokNacist();
    return JSON.stringify(DOK.dokumenty.find(x => x.uid === window.__stary));
  });
  check('starý rozvaděč: otevření, návštěva Dokumentů a uložení data bajtově nemění', staryPo === staryPred, staryPo.length + ' / ' + staryPred.length);
  const so = await p.evaluate(() => { const v = rozvOteplVypocet(DOK_TYPY.rozv.cist(dokForm())); return v.radky.map(q => q.x.ozn + ':' + q.eff).join(','); });
  check('starý rozvaděč: oteplení s výchozím Inc 0,8 In (B16 → 12,8)', /-FA1:12\.8/.test(so), so);

  check('bez chyb na stránce', !err.length, err.join(' | '));
  await b.close();
  console.log(res.join('\n'));
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})();
