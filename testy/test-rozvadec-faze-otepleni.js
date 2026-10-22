// Rozvaděč DBO — etapa 4: symetrie fází a ověření oteplení výpočtem.
// Hlídá: součty proudů po fázích bytu 3+1 (3f na všech fázích, Ib místo In,
// bez fáze s odkazem), ukazatel v liště, práh, barvy fází jen na obrazovce;
// přefázování (2P chránič drží skupinu na jedné fázi, zamčená fáze a 3f se
// nehnou, náhled a Zrušit nic nezmění, Použít + Ctrl+Z vrátí vše, jen vybrané);
// oteplení s vymyšlenými Pv a Penc (výpočet na W přesně, (Inc/In)², přirážka,
// RDF z tabulky, chybějící Pv / Penc / 55 °C = neúplné, Pv do kopie přístroje,
// ne do knihovny, nad 630 A se nepočítá), PDF stránka a odkaz v prohlášení
// a protokolu jen při „vyhovuje", starý rozvaděč beze změny, data revizí
// beze změny, telefon. Vše vymyšlené.
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
  const otisk = () => p.evaluate(async () => {
    const o = {}; for (const k of STORE_KEYS) if (k !== 'technik' && k !== 'pristroje') o[k] = await idbGet(k);
    return JSON.stringify({ o, arch: JSON.stringify(archiv) });
  });
  const otiskPred = await otisk();
  await p.evaluate('window.__rozvByt = ' + require('./rozvadec-byt.js').toString());
  await p.evaluate(async () => {
    STORE.technik = Object.assign({}, STORE.technik, { jmeno: 'Petr Vymyšlený', firma: 'Vymyšlená elektro s.r.o.', ico: '12345678', mesto: 'Kyjov' });
    saveStore();
    window.__T = {
      dk: (s, v) => { const e = dokForm().querySelector(s); if (e.type === 'checkbox') e.checked = v; else e.value = v;
        e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); },
      cist: () => DOK_TYPY.rozv.cist(dokForm()),
      naj: o => { let r = null; __rz.rady.forEach(ra => ra.prvky.forEach(x => { if (x.ozn === o) r = x; })); return r; },
      ukaz: () => document.getElementById('rz-faze-ukaz').textContent,
      txt: B => B.map(q => (q.html || q.cela || '')).join(' ').replace(/<[^>]+>/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
    };
    // starý rozvaděč (bez fází i oteplení) pro kontrolu „beze změny"
    await dokNovy('rozv'); __T.dk('[data-dk="oznaceni"]', 'RS9'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-1x12-n'));
    rozvVlozit('v-fa-1-B16', 0, 0); dokZmena(); await dokUlozitOtevreny();
    window.__stary = window.__dokOtevreny.uid;
    await dokNovy('rozv');
    __T.dk('[data-dk="oznaceni"]', 'RH1'); __T.dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S'); __T.dk('[data-dk="privodIn"]', '40');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n')); window.__rozvByt(); await dokUlozitOtevreny();
    __rz.vyber = null; rozvVlastnostiVykreslit(); rozvPohledVykreslit();
  });

  // ── 1. součty po fázích ───────────────────────────────────────────────
  const f1 = await p.evaluate(() => {
    const s = rozvFazeSouhrn(__rz.rady), pan = document.querySelector('#rz-vlastnosti .rp-faze');
    return { ukaz: __T.ukaz(), n3: s.F.L1.n, vyv: s.vyvodu, bezIb: s.bezIb, pan: pan && pan.innerText, gr: pan && pan.querySelectorAll('.rp-faze-g i').length,
      nesT: pan && pan.querySelector('.rp-faze-nes').title, lista: !!document.getElementById('rz-faze-ukaz').closest('.rz-lista, .rz-pohled-lista, [class*="lista"]') };
  });
  check('byt 3+1: ukazatel v liště „L1 83 A · L2 93 A · L3 89 A · 11,3 %"', f1.ukaz === 'L1 83 A · L2 93 A · L3 89 A · 11,3 %', f1.ukaz);
  check('panel Fáze ve vlastnostech: tři sloupce grafu, ΣIn, nesymetrie se vzorcem v bublině',
    f1.gr === 3 && /ΣIn 83 A/.test(f1.pan) && /Nesymetrie 11,3 %/.test(f1.pan) && /\(93 − 83\) \/ 88,3 × 100 % = 11,3 %/.test(f1.nesT), f1.nesT);
  check('3f sporák B25 se počítá na všech fázích, SPD, QM a chrániče ne (14 vývodů)', f1.vyv === 14 && f1.n3 === 5 && f1.bezIb === 14, JSON.stringify({ v: f1.vyv, n: f1.n3 }));
  check('„Ib nevyplněno u 14 přístrojů – počítá se In"', /Ib nevyplněno u 14 přístrojů – počítá se In/.test(f1.pan));
  const f2 = await p.evaluate(() => {
    __T.naj('-FA2').ib = '6'; __T.naj('-FA4').faze = '';
    rozvPohledVykreslit(); rozvVlastnostiVykreslit();
    const pan = document.querySelector('#rz-vlastnosti .rp-faze');
    const r = { ukaz: __T.ukaz(), pan: pan.innerText };
    document.querySelector('[data-action="tdRFazeBez"]').click();
    r.vyb = __rz.vyber === __T.naj('-FA4').uid;
    return r;
  });
  check('Ib má přednost před In (FA2 Ib 6 A → L1 79 A), bez fáze se do fází nepočítá', f2.ukaz.startsWith('L1 79 A · L2 93 A · L3 73 A'), f2.ukaz);
  check('„bez fáze: 1 vývod, 16 A" a „ukázat v pohledu" ho vybere', /bez fáze: 1 vývod, 16 A/.test(f2.pan) && f2.vyb && /Ib nevyplněno u 13 přístrojů/.test(f2.pan), f2.pan.split('\n').filter(x => /bez|Ib/.test(x)).join(' | '));
  const f3 = await p.evaluate(() => {
    __T.naj('-FA2').ib = ''; __T.naj('-FA4').faze = 'L3';
    __rz.vyber = null; rozvPohledVykreslit(); rozvVlastnostiVykreslit();
    const pr = document.querySelector('.rf-prah'); pr.value = '5'; pr.dispatchEvent(new Event('input', { bubbles: true }));
    const nad = document.getElementById('rz-faze-ukaz').classList.contains('rz-faze-nad');
    const cb = document.querySelector('.rf-barvy'); cb.checked = true; cb.dispatchEvent(new Event('input', { bubbles: true }));
    const pruhy = document.querySelectorAll('#rz-svg-ram .rz-faze-pruh, .rz-svg-ram .rz-faze-pruh').length;
    const tisk = /rz-faze-pruh/.test(rozvSvg(__rz, { tisk: true }));
    cb.checked = false; cb.dispatchEvent(new Event('input', { bubbles: true }));
    return { nad, pruhy, tisk, prah: __T.cist().faze };
  });
  check('práh 5 %: nesymetrie 11,3 % → ukazatel zvýrazněný, práh v datech (faze.prah)', f3.nad && f3.prah && f3.prah.prah === '5', JSON.stringify(f3.prah));
  check('barvy fází: pruhy v čelním pohledu, v tisku (PDF) ne', f3.pruhy > 10 && !f3.tisk, f3.pruhy);

  // ── 2. přefázování ────────────────────────────────────────────────────
  await p.evaluate(async () => {
    await dokNovy('rozv'); __T.dk('[data-dk="oznaceni"]', 'RF1');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-2x12-n'));
    const V = (kid, r, o) => Object.assign(rozvVlozit(kid, r, __rz.rady[r].prvky.length), o);
    V('v-fi-2-40-30-A', 0, { faze: 'L1' });
    V('v-fa-1-B16', 0, { faze: 'L1', vyvod: 'Kuchyň – zásuvky' });
    V('v-fa-1-B10', 0, { faze: 'L1', vyvod: 'Kuchyň – světla' });
    V('v-fa-1-B16', 1, { faze: 'L1', vyvod: 'Zamčený', fazeZamek: true });
    V('v-fa-1-B16', 1, { faze: 'L1', vyvod: 'Pokoj 1' });
    V('v-fa-1-B16', 1, { faze: 'L1', vyvod: 'Pokoj 2' });
    V('v-fa-3-B25', 1, { faze: '3f', vyvod: 'Sporák' });
    V('v-fa-1-B10', 1, { faze: '', vyvod: 'Půda' });
    rozvNadrazeneAuto(); __rz.vyber = null; rozvPohledVykreslit(); rozvVlastnostiVykreslit(); dokZmena(); await dokUlozitOtevreny();
  });
  const pr0 = await p.evaluate(() => ({ json: JSON.stringify(__rz.rady), ukaz: __T.ukaz(), grp: __T.naj('-FA1').nadr === __T.naj('-FI1').uid && __T.naj('-FA2').nadr === __T.naj('-FI1').uid }));
  check('zkušební rozvaděč: FA1 + FA2 pod dvoupólovým -FI1, vše na L1, FA6 3f, FA7 bez fáze', pr0.grp && /^L1 99 A · L2 25 A · L3 25 A/.test(pr0.ukaz), pr0.ukaz);
  await p.click('#rz-vlastnosti .rz-prefazovat'); await w(300);
  const n1 = await p.evaluate(() => {
    const m = document.getElementById('modal-rz-faze');
    return { open: m.classList.contains('open'), txt: document.getElementById('rz-faze-obsah').innerText, zm: document.querySelectorAll('#rz-faze-obsah tr.rf-zmena').length,
      pouzit: m.querySelector('[data-action="tdRPrefazovatPouzit"]').textContent, json: JSON.stringify(__rz.rady) };
  });
  check('Přefázovat: nejdřív náhled (před → po, změny zvýrazněné), data zatím beze změny',
    n1.open && /Nesymetrie [\d,]+ % → [\d,]+ %/.test(n1.txt) && n1.zm > 0 && /✓ Použít \(\d+ přístroj/.test(n1.pouzit) && n1.json === pr0.json, n1.txt.split('\n')[0] + ' · ' + n1.pouzit);
  await p.click('#modal-rz-faze [data-action="tdRPrefazovatZrusit"]'); await w(200);
  check('Zrušit: okno zavřené, nic se nezměnilo', await p.evaluate(j => !document.getElementById('modal-rz-faze').classList.contains('open') && JSON.stringify(__rz.rady) === j, pr0.json));
  await p.click('#rz-vlastnosti .rz-prefazovat'); await w(200);
  await p.click('#modal-rz-faze [data-action="tdRPrefazovatPouzit"]'); await w(400);
  const n2 = await p.evaluate(() => {
    const f = o => __T.naj(o).faze, s = rozvFazeSouhrn(__rz.rady);
    return { fi: f('-FI1'), fa1: f('-FA1'), fa2: f('-FA2'), fa3: f('-FA3'), fa6: f('-FA6'), fa7: f('-FA7'), nes: s.nes, ukaz: __T.ukaz(),
      zpet: Array.from(document.querySelectorAll('.toast button, #toast button')).some(b => /ZPĚT/i.test(b.textContent)) };
  });
  check('2P chránič drží skupinu: -FI1, -FA1, -FA2 na téže fázi', n2.fa1 === n2.fa2 && n2.fi === n2.fa1, [n2.fi, n2.fa1, n2.fa2].join(','));
  check('zamčená fáze (-FA3 🔒) zůstala L1, 3f (-FA6) beze změny, vývod bez fáze dostal fázi', n2.fa3 === 'L1' && n2.fa6 === '3f' && /^L[123]$/.test(n2.fa7), [n2.fa3, n2.fa6, n2.fa7].join(','));
  check('nesymetrie po přefázování menší, hláška se ZPĚT', n2.nes < 30 && n2.zpet, n2.ukaz);
  await p.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
  await p.keyboard.press('Control+z'); await w(400);
  check('Ctrl+Z vrátí všechny fáze, jak byly', await p.evaluate(j => JSON.stringify(__rz.rady) === j, pr0.json));
  const n3 = await p.evaluate(() => {
    const u = [__T.naj('-FA4').uid, __T.naj('-FA5').uid];
    rozvVyberNastavit(u, u[0]); rozvPohledVykreslit(); rozvVlastnostiVykreslit();
    const btn = document.querySelector('#rz-vlastnosti .rz-prefazovat'); btn.click();
    const r = { btn: btn.textContent, txt: document.getElementById('rz-faze-obsah').innerText };
    TD_AKCE.tdRPrefazovatPouzit();
    r.f = ['-FA1', '-FA2', '-FA4', '-FA5', '-FA7'].map(o => __T.naj(o).faze);
    return r;
  });
  check('jen vybrané (FA4, FA5): „⚖ Přefázovat vybrané…", ostatní zůstanou', /vybrané/.test(n3.btn) && /jen vybrané/.test(n3.txt) &&
    n3.f[0] === 'L1' && n3.f[1] === 'L1' && n3.f[4] === '' && n3.f[2] !== n3.f[3], n3.f.join(','));
  const zamek = await p.evaluate(() => {
    __rz.vyber = __T.naj('-FA3').uid; __rz.vic = null; rozvVlastnostiVykreslit();
    const c = document.querySelector('#rz-vlastnosti [data-rp2="fazeZamek"]');
    return { je: !!c, ch: c && c.checked, txt: c && c.closest('label').textContent };
  });
  check('vlastnosti přístroje: „🔒 Zamknout fázi" zaškrtnuté u zamčeného', zamek.je && zamek.ch && /Zamknout fázi/.test(zamek.txt), zamek.txt);

  // ── 3. oteplení výpočtem ──────────────────────────────────────────────
  await p.evaluate(async () => {
    await dokNovy('rozv'); __T.dk('[data-dk="oznaceni"]', 'RO1'); __T.dk('[data-dk="soustava"]', '1NPE ~230 V TN-S');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-1x12-n'));
    const V = (kid, o) => Object.assign(rozvVlozit(kid, 0, __rz.rady[0].prvky.length), o);
    V('v-qm-1-40', {}); V('v-fa-1-B16', { faze: 'L1', ib: '8', vyvod: 'Zásuvky' }); V('v-fa-1-B16', { faze: 'L1', ib: '12', vyvod: 'Kuchyň' });
    __rz.vyber = null; rozvPohledVykreslit(); rozvVlastnostiVykreslit(); dokZmena(); await dokUlozitOtevreny();
    rozvZalozkaNastavit('dok'); document.querySelector('[data-oddil="otepleni"]').open = true;
  });
  await w(300);
  const o0 = await p.evaluate(() => {
    const odd = document.querySelector('[data-oddil="otepleni"]'), ods = Array.from(document.querySelectorAll('#rz-pan-dok [data-oddil]')).map(x => x.getAttribute('data-oddil'));
    return { ods, radky: odd.querySelectorAll('.rot-tab tr[data-uid]').length, chybi: odd.querySelectorAll('.rot-tab tr.rot-chybi').length, vys: odd.querySelector('#rot-vysledek').innerText,
      ceka: odd.querySelectorAll('.dk-ceka, [class*="ceka"]').length, sum: odd.querySelector('summary').textContent };
  });
  check('oddíl „Oteplení" mezi Technickými údaji a Prohlášením', o0.ods.indexOf('otepleni') === o0.ods.indexOf('tech') + 1 && o0.ods.indexOf('prohl') === o0.ods.indexOf('otepleni') + 1, o0.ods.join(','));
  check('bez Pv: 3 oranžové řádky „doplňte Pv", výsledek neúplné', o0.radky === 3 && o0.chybi === 3 && /Neúplné – chybí: Pv u 3 přístrojů,/.test(o0.vys), o0.vys);
  check('podmínky, 0,8 In a RDF mají štítek „čeká na ověření v ČSN"', o0.ceka >= 3, o0.ceka);
  const pvVyp = async (sel, v) => { await p.fill(sel, v); await w(80); };
  const uids = await p.evaluate(() => ['-QM1', '-FA1', '-FA2'].map(o => __T.naj(o).uid));
  await pvVyp('.rot-pv[data-uid="' + uids[0] + '"]', '1,5');
  await pvVyp('.rot-pv[data-uid="' + uids[1] + '"]', '2');
  await pvVyp('.rot-pv[data-uid="' + uids[2] + '"]', '2'); await w(200);
  const o1 = await p.evaluate(() => {
    const v = rozvOteplVypocet(__T.cist()), r = v.radky.map(q => Math.round(q.pvInc * 1000) / 1000);
    return { r, inc: v.radky.map(q => q.eff), sum: v.sumPv, celkem: v.celkem, vys: document.getElementById('rot-vysledek').innerText,
      kopie: __T.naj('-FA1').p.pv, knih: rozvKnihPolozka('v-fa-1-B16').pv, stav: v.stav };
  });
  check('Pv při Inc = Pv × póly × (Inc/In)²: QM 0,375 W (Inc 20 A), FA1 0,5 W (Ib 8), FA2 1,125 W (Ib 12)',
    o1.r.join('|') === '0.375|0.5|1.125' && o1.inc.join('|') === '20|8|12', o1.r.join('|') + ' / ' + o1.inc.join('|'));
  check('Pv se uložilo do kopie přístroje, knihovna beze změny', o1.kopie === 2 && (o1.knih === '' || o1.knih == null), JSON.stringify([o1.kopie, o1.knih]));
  check('bez Penc a 55 °C: neúplné, chybí Penc i prohlášení o 55 °C', o1.stav === 'neuplne' && /Penc/.test(o1.vys) && /55 °C/.test(o1.vys), o1.vys);
  await p.evaluate(() => { __T.dk('[data-dk="otepleni.pevne"]', '3'); __T.dk('[data-dk="otepleni.penc"]', '10'); });
  await w(150);
  const o2 = await p.evaluate(() => ({ vys: document.getElementById('rot-vysledek').innerText, stav: rozvOteplVypocet(__T.cist()).stav }));
  check('Penc zadané, 55 °C nezaškrtnuté → pořád neúplné', o2.stav === 'neuplne' && /55 °C/.test(o2.vys) && !/Penc skříně —|chybí:.*Penc/.test(o2.vys), o2.vys);
  await p.check('[data-dk="otepleni.okoli55"]'); await w(200);
  const o3 = await p.evaluate(() => { const v = rozvOteplVypocet(__T.cist()); return { vys: document.getElementById('rot-vysledek').innerText, v: [v.sumPv, v.prirW, v.pevne, v.celkem, v.rezerva, v.rezervaPct].map(x => Math.round(x * 1000) / 1000) }; });
  check('ΣPv 2 W + přirážka 50 % 1 W + pevné 3 W = 6 W ≤ Penc 10 W → vyhovuje, rezerva 4 W (40 %)',
    o3.v.join('|') === '2|1|3|6|4|40' && /✓ Vyhovuje — rezerva 4 W \(40 %\)/.test(o3.vys) && /= 6 W/.test(o3.vys), o3.vys.replace(/\n/g, ' '));
  await p.selectOption('[data-dk="otepleni.prirazka"]', '30'); await w(150);
  const o4 = await p.evaluate(() => rozvOteplVypocet(__T.cist()).celkem);
  check('přirážka 30 % (Schneider – jen spoje): 2 + 0,6 + 3 = 5,6 W', Math.abs(o4 - 5.6) < 1e-9, o4);
  await p.selectOption('[data-dk="otepleni.prirazka"]', '50');
  await p.selectOption('[data-dk="otepleni.rdfRezim"]', 'tabulka'); await w(150);
  const o5 = await p.evaluate(() => { const v = rozvOteplVypocet(__T.cist()); return { r: v.radky.map(q => Math.round(q.pvInc * 1000) / 1000), sum: Math.round(v.sumPv * 1000) / 1000,
    info: document.getElementById('rot-rdf-info').textContent, rdf: rozvDokEff(__T.cist()).rdf, tech: (__T.cist().tech || {}).rdf }; });
  check('RDF z tabulky (2 vývody → 0,8): QM 0,24 + FA1 0,32 + FA2 0,72 = 1,28 W', o5.r.join('|') === '0.24|0.32|0.72' && o5.sum === 1.28 && /RDF 0,8 podle počtu vývodů \(2\)/.test(o5.info), o5.r.join('|'));
  check('RDF jde do technických údajů jako odvozená hodnota (uloží se prázdná)', /0,8/.test(String(o5.rdf)) && !o5.tech, JSON.stringify([o5.rdf, o5.tech]));
  await p.selectOption('[data-dk="otepleni.rdfRezim"]', 'bez'); await w(100);
  // ruční Inc
  await p.fill('.rot-inc[data-uid="' + uids[2] + '"]', '16'); await w(150);
  const o6 = await p.evaluate(() => { const d = __T.cist(), v = rozvOteplVypocet(d); return { inc: d.otepleni.inc, pv: v.radky[2].pvInc, n08: v.radky[2].nad08, cel: v.radky[2] }; });
  check('ruční Inc 16 A u FA2: Pv 2 W, „> 0,8 In" označené, v datech jen ruční Inc', o6.pv === 2 && o6.n08 && JSON.stringify(o6.inc) === JSON.stringify({ [uids[2]]: 16 }), JSON.stringify(o6.inc));
  await p.fill('.rot-inc[data-uid="' + uids[2] + '"]', ''); await w(150);
  // PDF: vyhovuje → stránka + odkazy
  const pdf1 = await p.evaluate(async () => {
    await dokUlozitOtevreny();
    const d = __T.cist(), t = __T.txt(DOK_TYPY.rozv.pdf(d)), vb = (d.dokVyber || {}).otepleni;
    const zatrh = document.querySelector('[data-dk="dokVyber.otepleni"]');
    return { str: /OVĚŘENÍ OTEPLENÍ VÝPOČTEM/.test(t), vys: /VYHOVUJE — ΣPv 6 W ≤ Penc 10 W, rezerva 4 W \(40 %\)/.test(t),
      prohl: /ověření oteplení výpočtem dle čl\. 10\.10\.4\.2 – příloha/.test(t), pril: /Přílohy/.test(t), ceka: /čeká na ověření/.test(t), vb, zatrh: zatrh && zatrh.checked,
      clanek: /dle čl\. 10\.10\.4\.2 ČSN EN IEC 61439-1/.test(t) };
  });
  check('vyhovuje: PDF stránka „OVĚŘENÍ OTEPLENÍ VÝPOČTEM dle čl. 10.10.4.2" s výsledkem, zaškrtávátko samo zapnuté (neuloží se)',
    pdf1.str && pdf1.vys && pdf1.clanek && pdf1.zatrh && (pdf1.vb === undefined || pdf1.vb === ''), JSON.stringify(pdf1));
  check('vyhovuje: odkaz v prohlášení (bod 7) a v protokolu kusového ověření (Přílohy), bez štítků „čeká na ověření"', pdf1.prohl && pdf1.pril && !pdf1.ceka);
  await p.evaluate(() => __T.dk('[data-dk="otepleni.penc"]', '5')); await w(150);
  const pdf2 = await p.evaluate(() => { const d = __T.cist(), t = __T.txt(DOK_TYPY.rozv.pdf(d));
    return { vys: document.getElementById('rot-vysledek').innerText, str: /OVĚŘENÍ OTEPLENÍ/.test(t), prohl: /oteplení výpočtem dle čl/.test(t), zatrh: document.querySelector('[data-dk="dokVyber.otepleni"]').checked }; });
  check('nevyhovuje (Penc 5 W): „Překročeno o 1 W – větší skříň, nižší Inc, nebo ověřit zkouškou."', /překročeno o 1 W – větší skříň, nižší Inc, nebo ověřit zkouškou/.test(pdf2.vys), pdf2.vys);
  check('nevyhovuje: stránka ani odkaz v prohlášení se nepřiloží', !pdf2.str && !pdf2.prohl && !pdf2.zatrh, JSON.stringify(pdf2));
  await p.evaluate(() => __T.dk('[data-dk="otepleni.penc"]', '10')); await w(150);
  // celé PDF (náhled) — stránka oteplení je na výšku se záhlavím
  await p.evaluate(async () => { await TD_AKCE.tdRDokPdf(); }); await w(1200);
  const pdf3 = await p.evaluate(() => { const s = dokPdfStranky(), i = s.findIndex(x => /OVĚŘENÍ OTEPLENÍ VÝPOČTEM/.test(x.innerText));
    return { i, n: s.length, land: i >= 0 && s[i].classList.contains('a4-landscape'), pre: i >= 0 && s[i].scrollHeight <= s[i].clientHeight + 2 }; });
  check('náhled PDF dokumentace: stránka oteplení na výšku, obsah se vejde', pdf3.i >= 0 && !pdf3.land && pdf3.pre, JSON.stringify(pdf3));
  await p.evaluate(async () => { const x = DOK.dokumenty.filter(z => z.typ === 'rozv' && z.data.oznaceni === 'RO1')[0]; await dokOtevrit(x.uid); rozvZalozkaNastavit('dok'); });
  await w(300);
  // nad 630 A
  const nad = await p.evaluate(() => {
    __T.dk('[data-dk="tech.ina"]', '800'); rozvZalozkaNastavit('navrh'); rozvZalozkaNastavit('dok');
    const odd = document.querySelector('[data-oddil="otepleni"]'), d = __T.cist(); odd.open = true;
    const r = { stav: rozvOteplVypocet(d).stav, txt: odd.innerText, tab: !!odd.querySelector('.rot-tab'), pdf: /OVĚŘENÍ OTEPLENÍ/.test(__T.txt(DOK_TYPY.rozv.pdf(d))),
      vyber: !!document.querySelector('[data-dk="dokVyber.otepleni"]') };
    __T.dk('[data-dk="tech.ina"]', ''); return r;
  });
  check('InA 800 A: nepočítá se, „platí jen pro jeden prostor do 630 A – ověřte jinak", žádná stránka ani zaškrtávátko',
    nad.stav === 'nelze' && /platí jen pro jeden prostor do 630 A – ověřte jinak/.test(nad.txt) && !nad.tab && !nad.pdf && !nad.vyber, JSON.stringify({ s: nad.stav, t: nad.tab, p: nad.pdf, v: nad.vyber }));
  // uložená data: jen zadané, odvozené prázdné
  const ul = await p.evaluate(async () => { await dokUlozitOtevreny(); const x = DOK.dokumenty.filter(z => z.typ === 'rozv' && z.data.oznaceni === 'RO1')[0]; return x.data.otepleni; });
  check('v datech oteplení jen zadané hodnoty (pevné 3, Penc 10, 55 °C), přirážka/RDF/výsledek ne',
    ul && ul.pevne === '3' && ul.penc === '10' && ul.okoli55 === true && !ul.prirazka && !ul.rdfRezim && !('vysledek' in ul) && !ul.inc, JSON.stringify(ul));

  // ── 3b. transformátor, zdroj, zásuvka (2026-10-22): bez In se nesčítá, Pv jen z dat ──
  const tz = await p.evaluate(async () => {
    await dokNovy('rozv');
    __T.dk('[data-dk="oznaceni"]', 'RT1'); __T.dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S'); __T.dk('[data-dk="privodIn"]', '25');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-2x12-n'));
    const fa = rozvVlozit('v-fa-1-B16'), t = rozvVlozit('v-tr-zvon-8'), g = rozvVlozit('v-zd-24-60'), xs = rozvVlozit('v-xs-16');
    Object.assign(fa, { faze: 'L1' }); Object.assign(t, { faze: 'L1' }); Object.assign(g, { faze: 'L2' }); Object.assign(xs, { faze: 'L3' });
    rozvNadrazeneAuto(); dokZmena(); __rz.vyber = null; rozvVlastnostiVykreslit(); rozvPohledVykreslit();
    const s1 = rozvFazeSouhrn(__rz.rady), pan1 = document.querySelector('#rz-vlastnosti .rp-faze').innerText;
    g.ib = '0,3'; dokZmena(); rozvVlastnostiVykreslit();
    const s2 = rozvFazeSouhrn(__rz.rady), pan2 = document.querySelector('#rz-vlastnosti .rp-faze').innerText;
    const d = __T.cist(); d.otepleni = { okoli55: true, penc: '20' };
    const v1 = rozvOteplVypocet(d);
    const rad = q => [q.x.ozn, q.konst ? 'konst' : 'In', q.chybi || ''].join(':');
    const r = { s1: [s1.F.L1.zatez, s1.F.L2.zatez, s1.F.L3.zatez, s1.F.L1.In + s1.F.L2.In + s1.F.L3.In, s1.bezIn.length, s1.bezIb, s1.vyvodu].join(','),
      pan1: pan1.split('\n').filter(x => /bez In|Ib nevyplněno/.test(x)).join(' | '),
      s2: [s2.F.L1.zatez, s2.F.L2.zatez, s2.F.L3.zatez, s2.bezIn.length].join(','), pan2: pan2.split('\n').filter(x => /bez In/.test(x)).join(' | '),
      ot1: v1.radky.map(rad).join(' '), stav1: v1.stav, chybi1: v1.chybi.join('; ') };
    [fa, t, g, xs].forEach((x, i) => { x.p.pv = ['2', '1,5', '4', '0,5'][i]; });
    const d2 = __T.cist(); d2.otepleni = { okoli55: true, penc: '20' };
    const v2 = rozvOteplVypocet(d2), q = o => v2.radky.filter(y => y.x.ozn === o)[0];
    r.ot2 = ['-T1', '-G1'].map(o => q(o).pvInc).join(',') + '|' + v2.stav;
    r.sumPv = Math.round(v2.sumPv * 1000) / 1000;
    // In 16 A, Ib/In: jistič (16/16)² × 2 = 2, zásuvka (16/16)² × 0,5 × 2 póly (1+N) = 1, trafo 1,5 a zdroj 4 celkem = 8,5 W
    await dokUlozitOtevreny();
    return r;
  });
  check('fáze: transformátor a zdroj bez In se do součtu nepočítají (L1 16 A jen jistič), zásuvka 16 A ano; „bez In: 2 přístroje"',
    tz.s1 === '16,0,16,32,2,2,4' && /bez In: 2 přístroje/.test(tz.pan1) && /Ib nevyplněno u 2 přístrojů/.test(tz.pan1), tz.s1 + ' / ' + tz.pan1);
  check('fáze: s vyplněným Ib se zdroj počítá z Ib (L2 0,3 A) a z „bez In" zmizí', tz.s2 === '16,0.3,16,1' && /bez In: 1 přístroj/.test(tz.pan2), tz.s2 + ' / ' + tz.pan2);
  check('oteplení: transformátor a zdroj jako řádky „Pv celkem", bez Pv „doplňte Pv" a výsledek neúplný',
    /-T1:konst:doplňte Pv/.test(tz.ot1) && /-G1:konst:doplňte Pv/.test(tz.ot1) && /-XS1:In:doplňte Pv/.test(tz.ot1) && tz.stav1 === 'neuplne', tz.ot1 + ' / ' + tz.stav1);
  check('oteplení: Pv transformátoru a zdroje se nepřepočítává proudem (1,5 W a 4 W), ΣPv 8,5 W', tz.ot2 === '1.5,4|vyhovuje' && tz.sumPv === 8.5, tz.ot2 + ' / ' + tz.sumPv);

  // ── 4. starý rozvaděč, data revizí, telefon ───────────────────────────
  const st = await p.evaluate(async () => {
    const x = DOK.dokumenty.filter(z => z.uid === window.__stary)[0], pred = JSON.stringify(x.data);
    await dokOtevrit(x.uid); rozvVlastnostiVykreslit(); rozvZalozkaNastavit('dok');
    const o = document.querySelector('[data-oddil="otepleni"]'); if (o) o.open = true;
    await new Promise(r => setTimeout(r, 200)); rozvZalozkaNastavit('navrh'); await new Promise(r => setTimeout(r, 1200));
    const po = JSON.parse(JSON.stringify(DOK.dokumenty.filter(z => z.uid === x.uid)[0].data));
    return { stejne: pred === JSON.stringify(po), faze: 'faze' in po, ot: 'otepleni' in po };
  });
  check('starý rozvaděč: otevření, panel fází a oddíl Oteplení data nezmění', st.stejne && !st.faze && !st.ot, JSON.stringify(st));
  check('data revizí po práci s fázemi a oteplením bajtově stejná', (await otisk()) === otiskPred);
  await p.setViewportSize({ width: 375, height: 800 }); await w(300);
  const tel = await p.evaluate(async () => {
    const x = DOK.dokumenty.filter(z => z.typ === 'rozv' && z.data.oznaceni === 'RH1')[0]; await dokOtevrit(x.uid);
    __rz.vyber = null; rozvVlastnostiVykreslit(); await new Promise(r => setTimeout(r, 200));
    const pan = document.querySelector('#rz-vlastnosti .rp-faze').getBoundingClientRect(), sw1 = document.documentElement.scrollWidth;
    rozvZalozkaNastavit('dok'); document.querySelector('[data-oddil="otepleni"]').open = true; await new Promise(r => setTimeout(r, 200));
    return { pan: Math.round(pan.width), sw1, sw2: document.documentElement.scrollWidth };
  });
  check('telefon 375 px: panel fází i oddíl Oteplení bez posunu stránky do strany', tel.pan > 250 && tel.sw1 <= 375 && tel.sw2 <= 375, JSON.stringify(tel));

  check('bez chyb na stránce', !err.length, err.slice(0, 3).join(' | '));
  await b.close();
  console.log(res.join('\n'));
  const spatne = res.filter(r => r.startsWith('❌')).length;
  console.log('\n' + (res.length - spatne) + ' / ' + res.length + ' v pořádku');
  process.exit(spatne ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.log('SELHALO: ' + e.stack); process.exit(1); });
