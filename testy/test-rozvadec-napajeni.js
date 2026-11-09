// Rozvaděč — kdo koho napájí (připomínka 2026-11-05, rozvaděč RS2 ve škole).
// Test hlídá:
//  - datový model napájení (rozvDeti, rozvPotomci, kruh, upozornění In, smazání → automatika),
//  - volbu „Napájen z" v panelu a „→ napájí",
//  - režim 🔌 Zapojení podle schváleného vzoru (v1.63): vodiče po pólech ze svorky na svorku,
//    napětí od kabelu, bubliny s předpovědí, paralelně na vstup, odpojení do prázdna, přepojení
//    pulzujícím koncem, svazek 3f v barvách fází, N neuchopitelný, přehozené fáze, geometrie tras,
//    telefon 360 px (podržení svorky),
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
// 2026-11-09: výchozí Inc 0,8 In (oprava čl. 10.10.4.1 e) mění Inc a Pv proti starší verzi záměrně — porovnává se bez nich
const bezIncJ = t => JSON.stringify(JSON.parse(t, (k, v) => ['odv', 'odv08', 'inc', 'eff', 'nad08', 'zadano', 'pvInc', 'sumPv', 'celkem', 'prirW', 'rezerva', 'rezervaPct', 'stav'].indexOf(k) !== -1 ? undefined : v));
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

  // ── 3. režim 🔌 Zapojení podle schváleného vzoru (v1.63) ────────────────
  // Scénáře, které uživatel zkoušel ve vzoru vzor-zapojeni.html — skutečnou myší.
  {
    const cz = await kontext(b, { viewport: { width: 1366, height: 1500 } }), ez = [];
    const q = await stranka(cz, URL, ez);
    const pripravit = async (prohodit) => q.evaluate(async (prohodit) => {
      if (__rz && __rz.napRezim) TD_AKCE.tdRNapRezim();
      await __T.rs2();
      ['L1', 'L2', 'L3'].forEach((f, i) => { const x = rozvVlozit('v-x-rad', 2, i); x.ozn = '-X' + (i + 1); x.faze = f; });
      rozvPohledVykreslit(); dokZmena(); zpetVycistit();
      TD_AKCE.tdRNapRezim(); document.querySelectorAll('.toast').forEach(t => t.remove());
    }, prohodit);
    const stitek = () => q.evaluate(() => { const e = document.getElementById('rz-nap-stitek'); return e && e.style.display !== 'none' ? e.textContent : ''; });
    const stitekChyba = () => q.evaluate(() => { const e = document.getElementById('rz-nap-stitek'); return !!e && e.classList.contains('chyba'); });
    // tah myší ze svorky A na bod C; vrací text bubliny těsně před puštěním
    const tahni = async (A, C) => {
      await q.mouse.move(A.x, A.y); await w(40); await q.mouse.down(); await q.mouse.move(A.x + 9, A.y + 9, { steps: 3 });
      await q.mouse.move(C.x, C.y, { steps: 12 }); await w(60);
      const t = await stitek(), ch = await stitekChyba();
      await q.mouse.up(); await w(180);
      return { t, ch };
    };
    const sv = (o, s, k) => q.evaluate(([o, s, k]) => __T.sv(o, s, k), [o, s, k]);
    const vodicu = () => q.evaluate(() => (__rz.vodice || []).length);
    await pripravit();

    const zak = await q.evaluate(() => {
      const r = {};
      r.btn = document.querySelector('.rz-nap-btn').getAttribute('aria-pressed');
      r.banner = document.querySelector('.rz-banner-nap').innerText;
      r.kabel = Array.from(document.querySelectorAll('#rz-pohled [data-sv^="@privod|o|"]')).map(e => e.getAttribute('data-sv')).join();
      r.auto = document.querySelectorAll('#rz-pohled .rz-w-auto').length;
      r.sel = !document.querySelector('#rz-pohled .rz-w');
      r.panel = document.getElementById('rz-vlastnosti').innerText;
      return r;
    });
    check('Zapojení: režim zapnutý, nápověda „Táhni vodič ze svorky na svorku"', zak.btn === 'true' && /Táhni vodič ze svorky na svorku/.test(zak.banner), zak.banner.slice(0, 80));
    check('Zapojení: kabel ve vývodce má jen L1, L2, L3 (tři svorky)', zak.kabel === '@privod|o|0,@privod|o|1,@privod|o|2', zak.kabel);
    check('Zapojení: bez nataženého vodiče jen automatická (čárkovaná) spojení, žádná plná čára', zak.auto > 10 && zak.sel, 'auto ' + zak.auto);
    check('Zapojení: panel „Kdo koho napájí" a seznam přístrojů', /KDO KOHO NAPÁJÍ/i.test(zak.panel) && /-FA25…FA44 B16 \[L1,L2,L3\]/.test(zak.panel) && /-X1\s+bez napětí/.test(zak.panel), zak.panel.slice(0, 160));

    // najetí na svorku: bublina
    let A = await sv('-X1', 't', 0);
    await q.mouse.move(A.x - 30, A.y - 30); await q.mouse.move(A.x, A.y, { steps: 3 }); await w(80);
    const hov = await q.evaluate(() => ({ t: (document.getElementById('rz-nap-stitek') || {}).textContent, c: document.querySelectorAll('#rz-pohled .rz-sv-hov').length, cur: document.querySelector('#rz-pohled .rz-svg').style.cursor }));
    check('najetí na volnou svorku: zvětší se, kurzor ruka, bublina „táhni = nový vodič"', hov.t === 'táhni = nový vodič' && hov.c === 1 && hov.cur === 'grab', JSON.stringify(hov));

    // 1. kabel L1 → X1, L2 → X2, L3 → X3 (tři samostatné tahy), pak X1…X3 dole → QH1 nahoře
    const s1 = [];
    for (let i = 0; i < 3; i++) s1.push(await tahni(await sv('@privod', 'o', i), await sv('-X' + (i + 1), 't', 0)));
    check('1: kabel L1 → -X1 nahoře: bublina „-X1 z kabelu · vstup shora · L1"', s1[0].t === '-X1 z kabelu · vstup shora · L1', s1[0].t);
    const r1a = await q.evaluate(() => ['-X1', '-X2', '-X3'].map(o => __T.naj(o).nadr + ':' + __T.naj(o).nadrRucne).join() + '|' + (__rz.vodice || []).length);
    check('1: tři vodiče z kabelu → -X1…X3 napájené z přívodu (nadr „@privod")', r1a === '@privod:true,@privod:true,@privod:true|3', r1a);
    const s1b = [];
    for (let i = 0; i < 3; i++) s1b.push(await tahni(await sv('-X' + (i + 1), 'b', 0), await sv('-QH1', 't', i)));
    check('1: bublina „-QH1 z -X1 · vstup shora · L1"', s1b[0].t === '-QH1 z -X1 · vstup shora · L1', s1b[0].t);
    check('1: bublina „-QH1 z -X1, -X2 · vstup shora · L1,L2"', s1b[1].t === '-QH1 z -X1, -X2 · vstup shora · L1,L2', s1b[1].t);
    check('1: bublina „-QH1 z -X1…X3 · vstup shora · L1,L2,L3"', s1b[2].t === '-QH1 z -X1…X3 · vstup shora · L1,L2,L3', s1b[2].t);
    const r1 = await q.evaluate(() => {
      const qh = __T.naj('-QH1'), U = ['-X1', '-X2', '-X3'].map(o => __T.naj(o).uid), d = __T.cist(), sv = rozvSchemaListy(d)[1].svg;
      return { sada: JSON.stringify(qh.nadrSvorky) === JSON.stringify(U) && qh.nadrRucne === true, data: (d.vodice || []).length,
        sch: (sv.match(/data-privodni="1"/g) || []).length === 3 && /-X1…X3/.test(sv), panel: document.getElementById('rz-vlastnosti').innerText,
        poly: (d.vodice || []).slice(3).map(v => v.b.pol).join() };
    });
    check('1: -QH1 napájen ze sady -X1…X3 (nadrSvorky), póly 1, 2, 3 podle fáze svorky, 6 vodičů v datech', r1.sada && r1.data === 6 && r1.poly === '0,1,2', JSON.stringify(r1).slice(0, 120));
    check('1: schéma přívod → -X1…X3 → -QH1', r1.sch);
    check('1: panel „-QH1 63 A [L1,L2,L3]  z -X1…X3" a „-QH1 z -X1…X3, vstup shora, L1,L2,L3"', /-QH1 63 A \[L1,L2,L3\]\s+z -X1…X3/.test(r1.panel) && /-QH1\s+z -X1…X3, vstup shora, L1,L2,L3/.test(r1.panel), (r1.panel.match(/-QH1[^\n]*/g) || []).join(' / '));

    // 7. dva póly pod napětím → červeně, nic se neuloží
    const n7 = await vodicu();
    const s7 = await tahni(await sv('-X1', 'b', 0), await sv('-X2', 'b', 0));
    check('7: -X1 dole → -X2 dole (oba pod napětím): červená bublina „tento pól už je pod napětím na obou koncích…", nic se neuloží',
      s7.ch && /tento pól už je pod napětím na obou koncích – nejdřív jeden vodič odpoj/.test(s7.t) && await vodicu() === n7, s7.t);
    const s7b = await tahni(await sv('-X1', 't', 0), await sv('-X1', 'b', 0));
    check('7: na druhou stranu téhož přístroje nic (stejný přístroj)', await vodicu() === n7, s7b.t);

    // 2. horní svorka QH1 → horní svorka SPD1: paralelně na vstup
    const s2 = await tahni(await sv('-QH1', 't', 0), await sv('SPD1', 't', 0));
    check('2: bublina „SPD1 paralelně na vstup -QH1 (před -QH1) · vstup shora · L1,L2,L3 · svazek 3f"', s2.t === 'SPD1 paralelně na vstup -QH1 (před -QH1) · vstup shora · L1,L2,L3 · svazek 3f', s2.t);
    const r2 = await q.evaluate(() => {
      const spd = __T.naj('SPD1'), qh = __T.naj('-QH1'), d = __T.cist(), m = rsModel(d);
      return { pres: !!spd.pres && spd.pres.uid === qh.uid && spd.nadr === '@privod' && spd.nadrRucne === true, sch: m.jedn[0].sloupce[0].uid === spd.uid,
        car: document.querySelectorAll('#rz-pohled .rz-wire[data-wire-dst="' + spd.uid + '"] .rz-w').length };
    });
    check('2: -SPD1 pres = -QH1, nadr „@privod" (zdroj -QH1), svazek 3 čárami; ve schématu odbočka před -QH1', r2.pres && r2.sch && r2.car === 3, JSON.stringify(r2));

    // 3. nový jistič: z jeho HORNÍ svorky na DOLNÍ svorku FI1 pól 2
    await q.evaluate(() => { rozvZmena('t', () => { const x = rozvVlozit('v-fa-1-B16', 2, 3); x.ozn = '-FA91'; x.vyvod = 'Nový'; const y = rozvVlozit('v-fa-1-B16', 2, 4); y.ozn = '-FA92'; y.vyvod = 'Nový 2'; }); __rz.vyber = null; rozvVlastnostiVykreslit(); document.querySelectorAll('.toast').forEach(t => t.remove()); });
    await w(150);
    const s3 = await tahni(await sv('-FA91', 't', 0), await sv('-FI1', 'b', 1));
    check('3: bublina „-FA91 z -FI1 · vstup shora · L2"', s3.t === '-FA91 z -FI1 · vstup shora · L2', s3.t);
    const r3 = await q.evaluate(() => { const S = rzpStav(), fi = __T.naj('-FI1'), x = __T.naj('-FA91');
      return { nadr: x.nadr === fi.uid && x.faze === 'L2', fiAuto: !!document.querySelector('#rz-pohled .rz-w-auto[data-auto-dst="' + fi.uid + '"]') && S.vys[fi.uid].pod && !(__rz.vodice || []).some(v => v.b.uid === fi.uid) }; });
    check('3: -FA91 napájen z -FI1 (nadr), fáze L2; chránič neztratil automatické napájení', r3.nadr && r3.fiAuto, JSON.stringify(r3));

    // 4. z dolní svorky nového jističe na výstup QH1 → napájen zespodu
    const s4 = await tahni(await sv('-FA92', 'b', 0), await sv('-QH1', 'b', 0));
    const r4 = await q.evaluate(() => { const x = __T.naj('-FA92'), S = rzpStav(); return x.nadr === '' && x.nadrRucne === true && S.vys[x.uid].vstup === 'b' && x.faze === 'L1'; });
    check('4: -FA92 z dolní svorky na výstup -QH1: „-FA92 z -QH1 · vstup zespodu · L1", napájen zespodu', s4.t === '-FA92 z -QH1 · vstup zespodu · L1' && r4, s4.t);

    // 8. svazek QH1 → FU1: 3 čáry z pólů 1, 2, 3 na póly 1, 2, 3 v barvách L1, L2, L3
    const s8 = await tahni(await sv('-QH1', 'b', 0), await sv('-FU1', 't', 0));
    const r8 = await q.evaluate(() => {
      const fu = __T.naj('-FU1'), qh = __T.naj('-QH1'), g = document.querySelector('#rz-pohled .rz-wire[data-wire-src="' + qh.uid + '"][data-wire-dst="' + fu.uid + '"]');
      if (!g) return null;
      const G = rzpGeomMapa(), bod = (x, s, k) => { const p = rozvSvorkaBod(G[x.uid], x, s, k); return rozvZaokr(p.x) + ' ' + rozvZaokr(p.y); };
      return Array.from(g.querySelectorAll('.rz-w')).map((c, k) => { const d = c.getAttribute('d').replace(/[ML]/g, ' ').trim().split(/\s+/);
        return { f: c.getAttribute('data-faze'), barva: c.getAttribute('stroke'), zac: d[0] + ' ' + d[1] === bod(qh, 'b', k), kon: d[d.length - 2] + ' ' + d[d.length - 1] === bod(fu, 't', k), dash: c.getAttribute('stroke-dasharray') }; });
    });
    check('8: bublina „-FU1 z -QH1 · vstup shora · L1,L2,L3 · svazek 3f"', s8.t === '-FU1 z -QH1 · vstup shora · L1,L2,L3 · svazek 3f', s8.t);
    check('8: svazek -QH1 → -FU1 = 3 čáry z pólů 1, 2, 3 na póly 1, 2, 3 v barvách L1 hnědá, L2 černá, L3 šedá', !!r8 && r8.length === 3 && r8.every(c => c.zac && c.kon && !c.dash) &&
      r8.map(c => c.f + c.barva).join() === 'L1#8B4513,L2#1c1c1c,L3#8c8c8c', JSON.stringify(r8));

    // 5. FU1 dole → SPD1 dole, pak tah z obsazené svorky SPD1 do prázdna = odpojit
    await tahni(await sv('-FU1', 'b', 0), await sv('SPD1', 'b', 0));
    const n5 = await vodicu();
    A = await sv('SPD1', 'b', 0);
    await q.mouse.move(A.x - 20, A.y + 20); await q.mouse.move(A.x, A.y, { steps: 2 }); await w(80);
    const h5 = await stitek();
    const s5 = await tahni(A, { x: A.x + 40, y: A.y + 24 });   // mezera pod řadou, daleko od svorek
    const r5 = await q.evaluate(() => { const spd = __T.naj('SPD1'), S = rzpStav(); return { bez: [0, 1, 2].every(k => !S.E[spd.uid + ':b:' + k]), toast: Array.from(document.querySelectorAll('.toast')).map(t => t.innerText).join(' ') }; });
    check('5: najetí na obsazenou svorku: „táhni na svorku = další vodič · pusť do prázdna = odpojit"', h5 === 'táhni na svorku = další vodič · pusť do prázdna = odpojit', h5);
    check('5: tah do prázdna: bublina „pusť sem = odpojit vodič -FU1 → SPD1"', s5.t === 'pusť sem = odpojit vodič -FU1 → SPD1', s5.t);
    check('5: po puštění vodič pryč, svorky SPD1 dole bez napětí, lišta „Odpojen vodič -FU1 → SPD1 · ZPĚT"', await vodicu() === n5 - 1 && r5.bez && /Odpojen vodič -FU1 → SPD1/.test(r5.toast) && /ZPĚT/.test(r5.toast), r5.toast);
    await q.evaluate(() => { const b = Array.from(document.querySelectorAll('.toast button')).filter(x => /ZPĚT/.test(x.textContent))[0]; if (b) b.click(); }); await w(150);
    check('5: Zpět vodič vrátí', await vodicu() === n5);

    // 9. 4. pól SPD a FI je N: modrý, neuchopitelný
    const r9 = await q.evaluate(() => { const r = {};
      ['SPD1', '-FI1'].forEach(o => { const u = __T.naj(o).uid, g = document.querySelector('#rz-pohled .rz-svorky[data-sv-uid="' + u + '"]');
        r[o] = g.querySelectorAll('.rz-sv-n').length + '|' + !g.querySelector('[data-sv$="|3"]') + '|' + g.querySelector('.rz-sv-n').getAttribute('fill'); });
      const n = document.querySelector('#rz-pohled .rz-svorky[data-sv-uid="' + __T.naj('SPD1').uid + '"] .rz-sv-n'), b = n.getBoundingClientRect(); r.bod = { x: b.left + b.width / 2, y: b.top + b.height / 2 }; return r; });
    const n9 = await vodicu();
    await tahni(r9.bod, await sv('-FA1', 't', 0));
    check('9: 4. pól SPD1 a -FI1 je N (2 modré svorky, bez data-sv), tah z něj nic nezapojí', r9.SPD1 === '2|true|#1f6fd1' && r9['-FI1'] === '2|true|#1f6fd1' && await vodicu() === n9, JSON.stringify(r9));

    // 6. klik na vodič → koncové svorky pulzují, tah za konec přepojí
    const wid = await q.evaluate(() => { const qh = __T.naj('-QH1'), fu = __T.naj('-FU1'); return (__rz.vodice || []).filter(v => v.a.uid === qh.uid && v.b.uid === fu.uid)[0].uid; });
    const wb = await q.evaluate(wid => { const e = document.querySelector('#rz-pohled .rz-w-hit[data-w="' + wid + '"]'); const t = e.getTotalLength(), p = e.getPointAtLength(t / 2), m = e.getScreenCTM(); const r = new DOMPoint(p.x, p.y).matrixTransform(m); return { x: r.x, y: r.y }; }, wid);
    await q.mouse.click(wb.x, wb.y); await w(150);
    const r6a = await q.evaluate(() => ({ sel: __rz.napVodic, puls: document.querySelectorAll('#rz-pohled .rz-sv-sel').length, panel: document.getElementById('rz-vlastnosti').innerText,
      anim: getComputedStyle(document.querySelector('#rz-pohled .rz-sv-sel')).animationName }));
    check('6: klik na vodič ho vybere, jeho 6 koncových svorek pulzuje, panel „Vodič Z: -QH1 → Na: -FU1"', r6a.sel === wid && r6a.puls === 6 && r6a.anim === 'rzPuls' && /Z: -QH1[^\n]*Na: -FU1/.test(r6a.panel), JSON.stringify(r6a).slice(0, 160));
    A = await sv('-FU1', 't', 0);
    await q.mouse.move(A.x + 20, A.y - 20); await q.mouse.move(A.x, A.y, { steps: 2 }); await w(80);
    const h6 = await stitek();
    check('6: najetí na pulzující svorku: „táhni = přepojit vybraný vodič · pusť do prázdna = odpojit"', h6 === 'táhni = přepojit vybraný vodič · pusť do prázdna = odpojit', h6);
    const s6 = await tahni(A, await sv('-FA23', 't', 0));
    const r6 = await q.evaluate(wid => { const v = (__rz.vodice || []).filter(x => x.uid === wid)[0], fu = __T.naj('-FU1'); return { b: v && __T.naj('-FA23').uid === v.b.uid, fuAuto: fu.nadrRucne === false, n: v && v.n }; }, wid);
    check('6: tah za konec na -FA23 přepojí (týž vodič, svazek 3f), -FU1 zpět na automatiku', r6.b && r6.n === 3 && r6.fuAuto && /-FA23 z -QH1/.test(s6.t), s6.t + ' ' + JSON.stringify(r6));
    await q.keyboard.press('Control+z'); await w(150);
    check('Ctrl+Z vrátí přepojení', await q.evaluate(wid => { const v = (__rz.vodice || []).filter(x => x.uid === wid)[0]; return !!v && v.b.uid === __T.naj('-FU1').uid; }, wid));
    await q.mouse.click(wb.x, wb.y); await w(120);
    const nD = await vodicu();
    await q.keyboard.press('Delete'); await w(150);
    check('Delete odpojí vybraný vodič, Ctrl+Z ho vrátí', await vodicu() === nD - 1 && (await q.keyboard.press('Control+z'), await w(150), await vodicu()) === nD);

    // geometrie: žádný vodič šikmo, přes přístroj ani přes jiný souběžně
    const geo = await q.evaluate(() => {
      const G = rozvGeom(), seg = [], sikme = [], pres = [], prekryv = [], lab = [];
      const oz = u => u === '@privod' ? 'kabel' : rozvNajit(u).x.ozn;
      document.querySelectorAll('#rz-pohled .rz-wire .rz-w').forEach((c, ci) => {
        const g0 = c.closest('.rz-wire'); lab[ci] = oz(g0.getAttribute('data-wire-src')) + '>' + oz(g0.getAttribute('data-wire-dst')) + ':' + c.getAttribute('data-pol');
        const n = c.getAttribute('d').replace(/[ML]/g, ' ').trim().split(/\s+/).map(Number), P = [];
        for (let i = 0; i < n.length; i += 2) P.push([n[i], n[i + 1]]);
        for (let i = 1; i < P.length; i++) {
          const a = P[i - 1], b = P[i];
          if (Math.abs(a[0] - b[0]) > 0.01 && Math.abs(a[1] - b[1]) > 0.01) sikme.push(ci);
          seg.push({ ci, a, b, kraj: i === 1 ? P[0] : i === P.length - 1 ? P[P.length - 1] : null });
          G.forEach(g => { const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]), y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
            if (x2 > g.x + 0.5 && x1 < g.x + g.w - 0.5 && y2 > g.y + 0.5 && y1 < g.y + RZG.H - 0.5) pres.push(rozvNajit(g.uid).x.ozn); });
        }
      });
      for (let i = 0; i < seg.length; i++) for (let j = i + 1; j < seg.length; j++) {
        const s = seg[i], t = seg[j]; if (s.ci === t.ci) continue;
        const hor = q => Math.abs(q.a[1] - q.b[1]) < 0.01, ver = q => Math.abs(q.a[0] - q.b[0]) < 0.01;
        let o = 0;
        if (hor(s) && hor(t) && Math.abs(s.a[1] - t.a[1]) < 0.3) o = Math.min(Math.max(s.a[0], s.b[0]), Math.max(t.a[0], t.b[0])) - Math.max(Math.min(s.a[0], s.b[0]), Math.min(t.a[0], t.b[0]));
        if (ver(s) && ver(t) && Math.abs(s.a[0] - t.a[0]) < 0.3) o = Math.min(Math.max(s.a[1], s.b[1]), Math.max(t.a[1], t.b[1])) - Math.max(Math.min(s.a[1], s.b[1]), Math.min(t.a[1], t.b[1]));
        const spol = s.kraj && t.kraj && Math.abs(s.kraj[0] - t.kraj[0]) < 0.01 && Math.abs(s.kraj[1] - t.kraj[1]) < 0.01;   // vodiče z téže svorky
        if (o > 0.3 && !spol) prekryv.push(s.ci + '/' + t.ci + ' ' + JSON.stringify([s.a, s.b, t.a, t.b, lab[s.ci], lab[t.ci]]));
      }
      return { car: document.querySelectorAll('#rz-pohled .rz-wire .rz-w').length, sikme, pres: Array.from(new Set(pres)), prekryv };
    });
    check('geometrie: žádný natažený vodič není šikmý (' + geo.car + ' čar)', geo.car > 10 && !geo.sikme.length, geo.sikme.join());
    check('geometrie: žádný vodič nevede přes přístroj', !geo.pres.length, geo.pres.join());
    check('geometrie: souběžné vodiče se nepřekrývají (odstup pruhů)', !geo.prekryv.length, geo.prekryv.slice(0, 8).join());
    if (SNIMKY) {
      await q.evaluate(() => { document.querySelectorAll('.toast').forEach(t => t.remove()); __rz.napVodic = null; rozvSvgPrekreslit(); rozvVlastnostiVykreslit(); rozvNapStitekSkryt(); });
      await q.screenshot({ path: path.join(SNIMKY, 'zapojeni-1-rs2.png'), clip: await q.evaluate(() => { const a = document.getElementById('rz-pohled').getBoundingClientRect(), c = document.getElementById('rz-vlastnosti').getBoundingClientRect();
        return { x: a.left - 4, y: a.top + window.scrollY - 4, width: c.right - a.left + 8, height: Math.max(a.height, 900) + 8 }; }) });
      // bublina při tahu a odpojení do prázdna
      const zb = async (A, C, jm) => { await q.mouse.move(A.x, A.y); await q.mouse.down(); await q.mouse.move(A.x + 9, A.y + 9, { steps: 3 }); await q.mouse.move(C.x, C.y, { steps: 12 }); await w(80);
        await q.screenshot({ path: path.join(SNIMKY, jm), clip: { x: Math.max(0, Math.min(A.x, C.x) - 220), y: Math.min(A.y, C.y) - 160 + await q.evaluate(() => window.scrollY), width: 760, height: Math.abs(C.y - A.y) + 330 } }); await q.mouse.move(A.x + 9, A.y + 9, { steps: 2 }); await q.keyboard.press('Escape'); await q.mouse.up(); await w(120); };
      await q.evaluate(() => { rozvZmena('t', () => { const x = rozvVlozit('v-fa-1-B16', 2, 5); x.ozn = '-FA93'; }); __rz.vyber = null; rozvVlastnostiVykreslit(); document.querySelectorAll('.toast').forEach(t => t.remove()); }); await w(120);
      await zb(await sv('-FA93', 't', 0), await sv('-FI1', 'b', 2), 'zapojeni-2-bublina.png');
      const S5 = await sv('SPD1', 'b', 0); await zb(S5, { x: S5.x + 40, y: S5.y + 24 }, 'zapojeni-3-odpojeni.png');
    }

    // 10. kabel L1/L3 přehozené na X3/X1 → fáze se přenesou na jističe
    await pripravit();
    for (const [k, x] of [[2, '-X1'], [1, '-X2'], [0, '-X3']]) await tahni(await sv('@privod', 'o', k), await sv(x, 't', 0));
    for (let i = 0; i < 3; i++) await tahni(await sv('-X' + (i + 1), 'b', 0), await sv('-QH1', 't', i));
    await q.evaluate(() => { rozvZmena('t', () => { const x = rozvVlozit('v-fa-1-B16', 2, 3); x.ozn = '-FA91'; }); __rz.vyber = null; rozvVlastnostiVykreslit(); document.querySelectorAll('.toast').forEach(t => t.remove()); }); await w(120);
    const s10 = await tahni(await sv('-QH1', 'b', 0), await sv('-FA91', 't', 0));
    const r10 = await q.evaluate(() => { const S = rzpStav(), f = o => (S.vys[__T.naj(o).uid] || {}).faze.join();
      return { qh: f('-QH1'), fa1: __T.naj('-FA1').faze + '→' + f('-FA1'), fa3: __T.naj('-FA3').faze + '→' + f('-FA3'), fa91: __T.naj('-FA91').faze, x1: __T.naj('-X1').faze, panel: document.getElementById('rz-vlastnosti').innerText }; });
    check('10: kabel L1 → -X3, L3 → -X1: na -QH1 póly L3,L2,L1; jistič na pólu 1 nese L3, na pólu 3 L1', r10.qh === 'L3,L2,L1' && r10.fa1 === 'L1→L3' && r10.fa3 === 'L3→L1', JSON.stringify(r10).slice(0, 200));
    check('10: jistič natažený z pólu 1 -QH1 dostane fázi L3 (v datech), svorka -X1 si svůj štítek L1 nechá', r10.fa91 === 'L3' && r10.x1 === 'L1' && /-FA91 z -QH1 · vstup shora · L3/.test(s10.t), s10.t);
    check('10: panel ukazuje skutečné fáze (-FA1 z -QH1, vstup shora, L3)', /-FA1\s+z -QH1, vstup (shora|zespodu), L3/.test(r10.panel), JSON.stringify(r10.panel.slice(r10.panel.indexOf("PŘÍSTROJE"), r10.panel.indexOf("PŘÍSTROJE") + 200)));
    check('Zapojení: bez chyb na stránce', ez.length === 0, ez.join(' | '));
    await cz.close();
  }
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

  // ── 6. telefon 360 px: podržení svorky a tažení prstem ─────────────────
  {
    const ctxM = await kontext(b, { viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const errM = [];
    const t = await stranka(ctxM, URL, errM);
    await t.evaluate(async () => { await __T.rs2(); TD_AKCE.tdRNapRezim(); document.querySelectorAll('.toast').forEach(x => x.remove()); });
    await w(250);
    const vel = await t.evaluate(() => { const e = document.querySelector('#rz-pohled [data-sv="' + __T.naj('-FI1').uid + '|b|0"]'); return e.getBoundingClientRect().width; });
    check('telefon: svorky větší (aspoň 6 px na displeji)', vel >= 6, vel);
    const cdp = await ctxM.newCDPSession(t);
    const [A, C] = await t.evaluate(() => {   // obě svorky naráz na displeji
      const el = (o, s) => document.querySelector('#rz-pohled [data-sv="' + __T.u(o) + '|' + s + '|0"]'), st = e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; };
      __T.videt(el('-FA23', 'b')); const a = st(el('-FA23', 'b')), c = st(el('-FA21', 't'));
      window.scrollBy(0, (a.y + c.y) / 2 - innerHeight / 2); return [st(el('-FA23', 'b')), st(el('-FA21', 't'))];
    });
    const tp = (type, pt) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pt ? [{ x: pt.x, y: pt.y }] : [] });
    await tp('touchStart', A); await w(450);
    for (let i = 1; i <= 10; i++) { await tp('touchMove', { x: A.x + (C.x - A.x) * i / 10 + 3, y: A.y + (C.y - A.y) * i / 10 + 3 }); await w(30); }
    await tp('touchEnd'); await w(250);
    check('telefon: podržení svorky -FA23 a tažení prstem na -FA21 (dosah 18 px) zapojí vodič', await t.evaluate(() => (__rz.vodice || []).length === 1 && __T.naj('-FA21').nadr === __T.naj('-FA23').uid));
    const pt = await t.evaluate(() => {   // bod na vodiči, který je vidět v rámečku a není u svorky
      const e = document.querySelector('#rz-pohled .rz-w-hit'), m = e.getScreenCTM(), L = e.getTotalLength(), rb = document.getElementById('rz-svg-ram').getBoundingClientRect();
            for (let i = 1; i < 60; i++) { const p = e.getPointAtLength(L * i / 60), r = new DOMPoint(p.x, p.y).matrixTransform(m);
        const el = r.x > rb.left + 4 && r.x < rb.right - 4 && r.y > 4 && r.y < innerHeight - 4 ? document.elementFromPoint(r.x, r.y) : null;
        if (el && el.closest('[data-w]')) return { x: r.x, y: r.y }; }
      return null; });
    if (pt) { await t.touchscreen.tap(pt.x, pt.y); await w(200); }
    check('telefon: klepnutí na vodič ho vybere (svorky pulzují)', await t.evaluate(() => !!__rz.napVodic && document.querySelectorAll('#rz-pohled .rz-sv-sel').length === 2), JSON.stringify(pt) + ' ' + await t.evaluate(pt => { const e = pt && document.elementFromPoint(pt.x, pt.y); return (e ? e.tagName + '.' + e.getAttribute('class') : '') + ' sel=' + __rz.napVodic + ' n=' + document.querySelectorAll('#rz-pohled .rz-sv-sel').length; }, pt));
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
      // položky, které má i ostrý program v9.140 (bez polí z labu); pojistka a SPD podle kategorie
      const kn = (kid, f) => rozvKnihPolozka(kid) ? kid : (rozvVestavene().filter(f)[0] || {}).id;
      rozvVlozit('v-qm-3-63', 0, 0); const fu = rozvVlozit(kn('v-fu-3-1038', it => it.kat === 'FU' && String(it.poly) === '3'), 0, 1); rozvVlozit(kn('v-spd-2-3N', it => it.kat === 'SPD'), 0, 2);
      rozvVlozit('v-fi-4-40-30-A', 1, 0);
      for (let i = 0; i < 6; i++) Object.assign(rozvVlozit('v-fa-1-B16', 1, i + 1), { vyvod: 'Zásuvky ' + i, faze: ['L1', 'L2', 'L3'][i % 3], kabel: 'CYKY-J', prurez: '3×2,5', pi: '1,2' });
      Object.assign(rozvVlozit('v-fa-3-B25', 2, 0), { vyvod: 'Sporák', kabel: 'CYKY-J', prurez: '5×2,5', pi: '9' });
      rozvVlozit('v-x-rad', 2, 1);
      if (rozvKnihPolozka('v-x-svork')) { const svb = rozvVlozit('v-x-svork', 2, 2); svb.privodni = true; }   // blok přívodních svorek (lab v1.57–v1.59; v9.140 ho nemá)
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
      if (typeof rzpStav === 'function') {   // jen nová verze: ruční „Napájen z" se v režimu Zapojení kreslí čárkovaně ze správného zdroje
        const fa = __rz.rady[1].prvky[1], fuU = __rz.rady[0].prvky[1].uid;
        rozvNapajeniNastavit([fa.uid], fuU); TD_AKCE.tdRNapRezim(); await new Promise(r => setTimeout(r, 100));
        ven.autoRucni = !!document.querySelector('#rz-pohled .rz-w-auto[data-auto-dst="' + fa.uid + '"][data-auto-src="' + fuU + '"]') && !document.querySelector('#rz-pohled .rz-wire') && !('vodice' in __T.cist());
        TD_AKCE.tdRNapRezim(); zpetPosledni();
      }
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
    const BN = require('./bez-n');   // 2026-11-09: N jističochrániče a popisky N-FI se mění záměrně
    check('starý rozvaděč: schéma znak po znaku jako předchozí verze (bez odboček N/PE a popisků N-…)', BN(nov.listy) === BN(puv.listy), rozdil(BN(nov.listy), BN(puv.listy)));
    check('starý rozvaděč: oteplení, fáze a soudobost jako předchozí verze', bezIncJ(nov.otepl) === bezIncJ(puv.otepl) && nov.faze === puv.faze && nov.soud === puv.soud);
    // lab v1.64: čelní pohled má novou kresbu přístrojů a vývodku — porovnává se bez nich (require('./bez-kresby'))
    const BK = require('./bez-kresby');
    check('starý rozvaděč: PDF dokumentace (bloky, čelní pohled bez kresby přístrojů) a DXF jako předchozí verze', BN(BK(nov.pdf)) === BN(BK(puv.pdf)) && BN(nov.dxf) === BN(puv.dxf), rozdil(BN(BK(nov.pdf)), BN(BK(puv.pdf))) || rozdil(BN(nov.dxf), BN(puv.dxf)));
    check('starý rozvaděč: ruční volba „Napájen z" se v režimu Zapojení kreslí jako automatické (čárkované) spojení ze správného zdroje, data bez vodičů', nov.autoRucni === true);
    check('předchozí verze i nová bez chyb', errS.length === 0 && errN.length === 0, errS.concat(errN).join(' | '));
    await ctxN.close();
  }

  check('žádná chyba na stránce', err.length === 0, err.join(' | '));
  console.log(res.join('\n'));
  console.log(res.filter(r => r.startsWith('❌')).length ? 'SELHALO' : 'VŠE OK (' + res.length + ')');
  await b.close();
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})();
