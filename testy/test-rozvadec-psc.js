// Rozvaděč PSC (výkonový, ČSN EN IEC 61439-2) — etapa 5a. Test hlídá:
//  - tři barevné dlaždice v Tvorbě dokumentace a jejich texty (DBO / PSC),
//  - výstrahu u DBO nad 250 A / vývod nad 125 A a převod na PSC se ZPĚT,
//  - číslování PSC-0001, založení PSC, 3 pole, díly a přeplnění pole,
//  - DIN segment se chová jako řada DBO, MCCB jde na montážní desku,
//  - tažení myší po desce s přichycením (mřížka 5 mm, okraj souseda), kolize,
//  - sběrnici přes dvě pole (spojka), přiřazení přístroje ke sběrnici,
//  - ZPĚT / Ctrl+Z, PDF (pole, umístění, rozměry), import CSV s rozměry v mm,
//  - převod PSC → DBO (odmítnutí s důvody i povolený převod),
//  - DBO bajtově beze změny proti předchozí verzi (8902 = poslední commit),
//  - data revizí beze změny, telefon (klepnutí na desku).
// Všechna data vymyšlená.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const STARA = 'http://127.0.0.1:' + (process.env.PORT_STARA || 8902) + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));
const path = require('path');

function pomocnik() {
  window.__T = {
    w: ms => new Promise(r => setTimeout(r, ms)),
    nast(sel, v) {
      const e = dokForm().querySelector(sel);
      e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
    },
    // bod na obrazovce z mm čelního pohledu
    bodMm(x, y) {
      const svg = document.querySelector('#rz-pohled .rz-svg'), q = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
      return { x: Math.round(q.x), y: Math.round(q.y) };
    },
    deska(pi) { return pscGeo(__rz).rady.filter(g => g.deska && g.pi === pi)[0]; },
    najdi(ozn) { for (const r of __rz.rady) for (const x of r.prvky) if (x.ozn === ozn) return x; return null; },
    rady: () => __rz.rady.map(r => r.prvky.map(x => x.ozn || x.p.kat).join(',')).join(' / '),
    async otiskRevizi() {
      const o = {}; for (const k of STORE_KEYS) o[k] = await idbGet(k);
      return JSON.stringify({ o, ls: localStorage.getItem('revize_el_store'), autosave: localStorage.getItem('revize_el_autosave') });
    }
  };
}

const knihovny = ctx => ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
  path: path.join(__dirname, 'knihovny', r.request().url().split('/').pop()),
  contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await knihovny(ctx);
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const err = [], alerty = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => err.push(e.message));
  p.on('dialog', d => { if (d.type() === 'alert') alerty.push(d.message()); d.accept(); });
  await p.goto(URL); await w(1200); await p.evaluate(pomocnik);

  // revizní zpráva jako pozadí (oddělení od revizí)
  await p.evaluate(async () => {
    novaZprava('elektro'); await __T.w(200);
    document.getElementById('f_ev_cislo').value = 'RE-26-0003'; document.getElementById('f_misto').value = 'Vymyšlená hala';
    window.__formDirty = false; saveToArchiv(); showScreen('home'); await __T.w(300);
  });
  const otiskPred = await p.evaluate(() => __T.otiskRevizi());

  // ── 1. tři barevné dlaždice ──────────────────────────────────────────
  await p.evaluate(async () => { await dokNacist(); dokOtevritTypy(); }); await w(250);
  const dl = await p.evaluate(() => {
    const L = Array.from(document.querySelectorAll('#dok-dlazdice .dok-dlazdice'));
    const lum = c => { const m = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
    const kontrast = el => { let bg = 'rgb(255,255,255)', e = el; while (e) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bg = c; break; } e = e.parentElement; }
      const a = lum(getComputedStyle(el).color), z = lum(bg); return Math.round((Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05) * 10) / 10; };
    const info = () => L.map(x => ({ typ: x.getAttribute('data-typ'), text: x.innerText.replace(/\s+/g, ' '),
      okraj: getComputedStyle(x).borderTopColor, titul: getComputedStyle(x.querySelector('.home-card-title')).color,
      k: kontrast(x.querySelector('.home-card-title')) }));
    window.__info = info;
    return { svetle: info() };
  });
  await p.evaluate(() => document.documentElement.classList.add('dark')); await w(700);
  dl.tmave = await p.evaluate(() => window.__info());
  await p.evaluate(() => document.documentElement.classList.remove('dark')); await w(700);
  const T = (typ, m) => (dl[m || 'svetle'].find(x => x.typ === typ) || {});
  check('tři dlaždice: protokol, DBO, PSC', dl.svetle.map(x => x.typ).join() === 'pouvv,rozv,psc', dl.svetle.map(x => x.typ).join());
  check('text dlaždice DBO doslova', T('rozv').text.includes('Rozvodnice pro obsluhu laiky (byty, domy, kanceláře) – do 250 A, vývody do 125 A. ČSN EN IEC 61439-3'), T('rozv').text);
  check('text dlaždice PSC doslova', T('psc').text.includes('Výkonové rozvaděče – nad 250 A nebo s obsluhou jen poučenou osobou. ČSN EN IEC 61439-2'), T('psc').text);
  check('barvy: protokol modrý, DBO zelený, PSC oranžový (okraj i nadpis)', T('pouvv').okraj === 'rgb(43, 87, 154)' && T('rozv').okraj === 'rgb(15, 123, 95)' &&
    T('psc').okraj === 'rgb(168, 84, 0)' && T('psc').titul === 'rgb(168, 84, 0)', dl.svetle.map(x => x.okraj + '/' + x.titul).join(' · '));
  check('kontrast nadpisů dlaždic ≥ 4,5 : 1 ve světlém i tmavém režimu', dl.svetle.concat(dl.tmave).every(x => x.k >= 4.5),
    dl.svetle.map(x => x.typ + ' ' + x.k).join(', ') + ' | tmavý: ' + dl.tmave.map(x => x.typ + ' ' + x.k).join(', '));

  // ── 2. DBO nad 250 A → výstraha a převod na PSC se ZPĚT ───────────────
  await p.evaluate(async () => {
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-z'));
    __T.nast('[data-dk="oznaceni"]', 'RH-hala'); await __T.w(100);
    rozvVlozit('v-fa-1-B16'); rozvVlozit('v-fa-1-B10'); await __T.w(900);
  });
  const dbo0 = await p.evaluate(() => ({ upoz: !!dokForm().querySelector('.rz-psc-upoz'), cislo: __dokOtevreny.data.cislo, uid: __dokOtevreny.uid }));
  await p.evaluate(async () => { __T.nast('[data-dk="privodIn"]', '400'); await __T.w(300); });
  const dbo1 = await p.evaluate(() => { const u = dokForm().querySelector('.rz-psc-upoz'); return { text: u ? u.innerText : '', pred: !!(u && u.nextElementSibling && u.nextElementSibling.classList.contains('rz-hlavicka')) }; });
  await p.evaluate(async () => { __T.nast('[data-dk="privodIn"]', '63'); await __T.w(200); });
  const dbo2 = await p.evaluate(() => !!dokForm().querySelector('.rz-psc-upoz'));
  await p.evaluate(async () => { const x = rozvVlozit('v-fa-1-B16'); rozvZmena('test In', () => { x.p.In = 160; }); await __T.w(200); });
  const dbo3 = await p.evaluate(() => (dokForm().querySelector('.rz-psc-upoz') || {}).innerText || '');
  check('DBO do 250 A / 125 A: žádná výstraha (v DOM nic)', !dbo0.upoz && !dbo2, JSON.stringify([dbo0.upoz, dbo2]));
  check('DBO s přívodem 400 A: jeden oranžový řádek „Nad 250 A / 125 A jde o PSC – převést na PSC?" nad hlavičkou', /Nad 250 A \/ 125 A jde o PSC – převést na PSC\?/.test(dbo1.text) &&
    /přívod 400 A/.test(dbo1.text) && /Převést na PSC/.test(dbo1.text) && dbo1.pred, dbo1.text);
  check('DBO s vývodem 160 A: výstraha jmenuje vývod', /vývod -FA3 160 A/.test(dbo3), dbo3);
  await p.click('.rz-psc-upoz [data-action="tdPscZDbo"]'); await w(700);
  const prev = await p.evaluate(() => ({ typ: __dokOtevreny.typ, uid: __dokOtevreny.uid, cislo: __dokOtevreny.data.cislo, rezim: __rz.rezim,
    pole: __rz.skrin.pole.length, dily: __rz.skrin.pole[0].dily.map(d => d.druh + ':' + d.rady + 'x' + d.modulu).join(), rady: __T.rady(),
    ulozeno: (dokNajit(__dokOtevreny.uid) || {}).typ, barva: document.getElementById('screen-dok-form').getAttribute('data-barva'),
    toast: Array.from(document.querySelectorAll('.toast')).map(t => t.innerText).join(' | ') }));
  check('převod na PSC: stejný dokument (uid), číslo PSC-0001, uloženo jako PSC, oranžová lišta', prev.typ === 'psc' && prev.uid === dbo0.uid && prev.cislo === 'PSC-0001' &&
    prev.ulozeno === 'psc' && prev.rezim === 'PSC' && prev.barva === 'oranzova' && /dřív ROZ-/.test(prev.toast), JSON.stringify(prev));
  check('převod na PSC: skříň 3×12 = jedno pole s DIN segmentem 3×12, přístroje zůstaly v řadách', prev.pole === 1 && prev.dily === 'din:3x12' && prev.rady === '-FA1,-FA2,-FA3 /  / ', prev.dily + ' | ' + prev.rady);
  await p.evaluate(() => { const t = Array.from(document.querySelectorAll('.toast')).find(t => /Převedeno na výkonový/.test(t.innerText)); t.querySelector('button').click(); });
  await w(700);
  const zpet = await p.evaluate(() => ({ typ: __dokOtevreny.typ, cislo: __dokOtevreny.data.cislo, rezim: __rz.rezim, sk: __rz.skrin.knih, ulozeno: (dokNajit(__dokOtevreny.uid) || {}).typ, upoz: !!dokForm().querySelector('.rz-psc-upoz') }));
  check('ZPĚT převodu: zase DBO se svým číslem ROZ, skříní a výstrahou', zpet.typ === 'rozv' && /^ROZ-/.test(zpet.cislo) && zpet.cislo === dbo0.cislo && zpet.rezim !== 'PSC' &&
    zpet.sk === 'v-sk-3x12-z' && zpet.ulozeno === 'rozv' && zpet.upoz, JSON.stringify(zpet));

  // ── 3. nový PSC: číslo, tři pole, díly ────────────────────────────────
  await p.evaluate(async () => { await dokOtevritSeznam('psc'); }); await w(300);
  const sezn = await p.evaluate(() => ({ hl: (document.querySelector('#dok-typy .dok-hlavni-akce') || {}).innerText || '', pod: (document.querySelector('#dok-typy .dok-hlavni-pod') || {}).textContent || '',
    barva: document.getElementById('screen-dok-seznam').getAttribute('data-barva') }));
  check('seznam PSC: hlavní akce, číslo PSC-0001, oranžový', /Navrhnout nový/i.test(sezn.hl) && /PSC-0001/.test(sezn.pod) && sezn.barva === 'oranzova', JSON.stringify(sezn));
  await p.click('#dok-typy .dok-hlavni-akce'); await w(500);
  const novy = await p.evaluate(() => ({ typ: __dokOtevreny.typ, cislo: __dokOtevreny.data.cislo, rezim: __dokOtevreny.data.rezim, tab: (document.querySelector('.rz-tab[data-tab="skrine"]') || {}).innerText || '',
    hl: !!dokForm().querySelector('[data-dk="forma"]') && !!dokForm().querySelector('[data-dk="icw"]') && !!dokForm().querySelector('[data-dk="ipk"]') && !!dokForm().querySelector('[data-dk="provedeni"]'),
    zal: !!dokForm().querySelector('.rz-zal') }));
  check('nový PSC: číslo PSC-0001, režim PSC, karta „Pole a skříně", v hlavičce forma, Icw, Ipk, provedení', novy.typ === 'psc' && novy.cislo === 'PSC-0001' && novy.rezim === 'PSC' &&
    /Pole a skříně/.test(novy.tab) && novy.hl, JSON.stringify(novy));
  const formy = await p.evaluate(() => Array.from(dokForm().querySelectorAll('[data-dk="forma"] option')).map(o => o.value).filter(Boolean).join(','));
  check('forma vnitřního oddělení: 1, 2a, 2b, 3a, 3b, 4a, 4b', formy === '1,2a,2b,3a,3b,4a,4b', formy);
  // první pole tlačítkem v knihovně, další dvě přes funkci
  await p.evaluate(() => { const e = document.querySelector('#rz-seznam [data-kid="v-pole-600"] [data-action]'); e.scrollIntoView({ block: 'center' }); });
  await p.click('#rz-seznam [data-kid="v-pole-600"] [data-action]'); await w(300);
  await p.evaluate(async () => { rozvSkrinNastavit(rozvKnihPolozka('v-pole-800')); rozvSkrinNastavit(rozvKnihPolozka('v-pole-400')); await __T.w(200); });
  const pole = await p.evaluate(() => ({ n: __rz.skrin.pole.length, sirky: __rz.skrin.pole.map(p => p.sirka + 'x' + p.vyska).join(),
    svg: document.querySelectorAll('#rz-pohled [data-pole]').length, tabs: document.querySelectorAll('#rz-vlastnosti .psc-pole-tabs button').length,
    dily: __rz.skrin.pole.map(p => p.dily.map(d => d.druh).join('+')).join(' | '), rady: __rz.rady.length }));
  check('tři pole vedle sebe 600 / 800 / 400 × 2000 mm, každé s DIN segmentem a montážní deskou', pole.n === 3 && pole.sirky === '600x2000,800x2000,400x2000' && pole.svg === 3 &&
    pole.tabs === 3 && pole.dily === 'din+deska | din+deska | din+deska', JSON.stringify(pole));

  // DIN segment = řada DBO
  await p.evaluate(async () => { __rz.pole = 0; __rz.aktRada = 0; ['v-fi-4-40-30-A', 'v-fa-1-B16', 'v-fa-1-B16', 'v-fa-1-B10'].forEach(k => rozvVlozit(k)); await __T.w(200); });
  const din = await p.evaluate(() => { const r = __rz.rady[0].prvky; return { oz: r.map(x => x.ozn).join(','), pos: r.some(x => x.pos), nadr: r[1].nadr === r[0].uid, faze: r.map(x => x.faze).join(',') }; });
  check('DIN segment jako řada DBO: přístroje zleva za sebou, označení, nadřazený chránič, bez polohy v mm', din.oz === '-FI1,-FA1,-FA2,-FA3' && !din.pos && din.nadr, JSON.stringify(din));
  await p.evaluate(async () => { rozvZmena('Vložení 30 jističů', () => { for (let i = 0; i < 30; i++) __rz.rady[0].prvky.push(rozvNovyPrvek(rozvKnihPolozka('v-fa-1-B16'))); }, { toast: 'Vloženo 30' }); await __T.w(200); });
  const pre = await p.evaluate(() => ({ L: pscPreplnene(__rz).map(x => x.text), svg: /přeplněno/.test(document.querySelector('#rz-pohled .rz-svg').textContent) }));
  check('přeplněná řada DIN segmentu hlášená červeně jako u DBO', pre.L.some(t => /Pole 1, řada 1 je přeplněná/.test(t)) && pre.svg, pre.L.join(' | '));
  await p.evaluate(async () => { zpetPosledni(); await __T.w(200); });
  const po40 = await p.evaluate(() => __rz.rady[0].prvky.length);
  check('Ctrl+Z / ZPĚT vrátí přeplnění zpět', po40 === 4, String(po40));

  // přeplnění pole díly
  await p.evaluate(async () => { __rz.vyber = null; __rz.vic = null; for (let i = 0; i < 3; i++) pscDilAkce(2, 0, 'pridat', 'deska'); await __T.w(200); });
  const dp = await p.evaluate(() => ({ g: pscGeo(__rz).pole[2].preplneno, panel: (document.querySelector('#rz-vlastnosti .psc-preplneno') || {}).innerText || '',
    L: pscPreplnene(__rz).map(x => x.text).join(' | '), cerv: !!document.querySelector('#rz-pohled [data-pole="2"] [stroke="#c0392b"], #rz-pohled .psc-preplneni') }));
  check('díly vyšší než užitná výška pole: červeně v panelu i v hlášení', dp.g > 0 && /vyšší než užitná výška/.test(dp.panel) && /Pole 3: díly jsou vyšší/.test(dp.L), JSON.stringify(dp));
  await p.keyboard.press('Escape');
  await p.evaluate(async () => { document.activeElement && document.activeElement.blur(); }); await w(50);
  for (let i = 0; i < 3; i++) { await p.keyboard.press('Control+z'); await w(120); }
  const dp2 = await p.evaluate(() => ({ g: pscGeo(__rz).pole[2].preplneno, dily: __rz.skrin.pole[2].dily.length }));
  check('Ctrl+Z vrátí přidané díly', dp2.g <= 0 && dp2.dily === 2, JSON.stringify(dp2));

  // ── 4. MCCB na montážní desku, přichycení, kolize ─────────────────────
  await p.evaluate(async () => { __rz.pole = 1; rozvVlozit('v-qf-3-630'); rozvVlozit('v-qs-3-400'); await __T.w(200); });
  const mc = await p.evaluate(() => {
    const qf = __T.najdi('-QF1'), qs = __T.najdi('-QS1'), g = __T.deska(1);
    return { qfR: __rz.rady.indexOf(__rz.rady.find(r => r.prvky.includes(qf))), deska: g.i, pole: g.pi, qf: qf && qf.pos, qs: qs && qs.pos, w: pscRozmer(qf).w, sqs: pscRozmer(qs) };
  });
  check('MCCB a odpínač jdou rovnou na montážní desku vybraného pole, každý na volné místo', mc.qfR === mc.deska && mc.pole === 1 && mc.qf && mc.qs &&
    (mc.qs.x >= mc.qf.x + mc.w || mc.qs.y > mc.qf.y), JSON.stringify(mc));
  // tažení skutečnou myší: QF k pravému okraji QS, 2 mm vedle → přichytí se k okraji
  await p.evaluate(() => document.getElementById('rz-svg-ram').scrollIntoView({ block: 'start' })); await w(150);
  await p.evaluate(() => { const qs = __T.najdi('-QS1'); rozvZmena('t', () => { qs.pos = { x: 22, y: 20 }; }); });
  await p.evaluate(() => { const qf = __T.najdi('-QF1'); rozvZmena('t', () => { qf.pos = { x: 330, y: 60 }; }); });
  await w(150);
  // rámeček pohledu posunout tak, aby deska pole 2 byla vidět
  await p.evaluate(() => { const g = __T.deska(1), ram = document.getElementById('rz-svg-ram'), svg = document.querySelector('#rz-pohled .rz-svg');
    const k = svg.getScreenCTM().a; ram.scrollLeft = Math.max(0, (g.x0 + 20) * k - 20); ram.scrollTop = Math.max(0, (g.y - 10) * k);
    ram.scrollIntoView({ block: 'start' }); });
  await w(200);
  const tah = await p.evaluate(() => {
    const g = __T.deska(1), qf = __T.najdi('-QF1'), qs = __T.najdi('-QS1'), s = pscRozmer(qf), sq = pscRozmer(qs);
    const od = __T.bodMm(g.x0 + qf.pos.x + s.w / 2, g.y + qf.pos.y + s.h / 2);
    const kam = __T.bodMm(g.x0 + 22 + sq.w + 2.2 + s.w / 2, g.y + 63 + s.h / 2);
    const r = document.getElementById('rz-svg-ram').getBoundingClientRect();
    return { od, kam, cilX: 22 + sq.w, videt: [od, kam].every(b => b.x > r.left && b.x < r.right && b.y > r.top && b.y < r.bottom && b.y < innerHeight) };
  });
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  await p.mouse.move(tah.od.x, tah.od.y); await p.mouse.down();
  await p.mouse.move(tah.od.x + 12, tah.od.y + 6, { steps: 3 }); await p.mouse.move(tah.kam.x, tah.kam.y, { steps: 10 }); await w(120);
  const behem = await p.evaluate(() => ({ duch: !!document.querySelector('.rz-duch'), zd: (document.getElementById('rz-zd') || { getAttribute: () => '' }).getAttribute('visibility'),
    vx: +(document.getElementById('rz-zd-vx') || { getAttribute: () => 0 }).getAttribute('x1') }));
  await p.mouse.up(); await w(300);
  const pTah = await p.evaluate(() => __T.najdi('-QF1').pos);
  check('tažení myší po desce: duch a značka místa se svislým vodítkem u okraje souseda', behem.duch && behem.zd === 'visible' && behem.vx > 0, JSON.stringify(behem) + ' vidět ' + tah.videt);
  check('přichycení: levý okraj MCCB přesně na pravém okraji odpínače, výška na mřížce 5 mm', pTah.x === tah.cilX && pTah.y % 5 === 0, JSON.stringify(pTah) + ' čekáno x ' + tah.cilX);
  // posun šipkou = 5 mm
  await p.keyboard.press('ArrowDown'); await w(150);
  const sip = await p.evaluate(() => __T.najdi('-QF1').pos);
  check('šipka na desce posune o 5 mm', sip.x === pTah.x && sip.y === pTah.y + 5, JSON.stringify(sip));
  // kolize
  await p.evaluate(() => { const qf = __T.najdi('-QF1'), qs = __T.najdi('-QS1'); pscBlokNaDesku([qf.uid], __T.deska(1).i, { x: qs.pos.x + 10, y: qs.pos.y + 10 }); });
  await w(200);
  const kol = await p.evaluate(() => ({ n: document.querySelectorAll('#rz-pohled .rz-kolize').length, L: pscPreplnene(__rz).map(x => x.text).join(' | '),
    lista: (document.querySelector('#rz-pohled') || {}).innerText || '' }));
  check('překryv na desce: oba přístroje červeně orámované a hlášené', kol.n === 2 && /překrývají nebo z ní vyčnívají/.test(kol.L), kol.n + ' | ' + kol.L);
  await p.keyboard.press('Control+z'); await w(200);
  const kol2 = await p.evaluate(() => ({ n: document.querySelectorAll('#rz-pohled .rz-kolize').length, pos: __T.najdi('-QF1').pos }));
  check('Ctrl+Z vrátí přístroj z kolize na původní místo', kol2.n === 0 && kol2.pos.y === sip.y && kol2.pos.x === sip.x, JSON.stringify(kol2));
  // výběr víc + kopie na desku
  await p.evaluate(async () => { const qf = __T.najdi('-QF1'), qs = __T.najdi('-QS1'); rozvVyberNastavit([qf.uid, qs.uid], qf.uid); rozvSvgPrekreslit(); });
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('Control+c'); await p.keyboard.press('Control+v'); await w(250);
  const kop = await p.evaluate(() => { const d = __rz.rady[__T.deska(1).i].prvky; return { oz: d.map(x => x.ozn).sort().join(','), kol: Object.keys(pscKolize(__rz, pscGeo(__rz))).length, pos: d.every(x => x.pos) }; });
  check('Ctrl+C / Ctrl+V na desce: kopie s novými označeními na volné místo, bez překryvu', kop.oz === '-QF1,-QF2,-QS1,-QS2' && kop.pos && kop.kol === 0, JSON.stringify(kop));
  await p.keyboard.press('Control+z'); await w(150);

  // ── 5. sběrnice přes dvě pole ─────────────────────────────────────────
  await p.evaluate(async () => {
    pscDilAkce(0, 0, 'pridat', 'sbernice'); pscDilAkce(1, 0, 'pridat', 'sbernice');
    const di0 = __rz.skrin.pole[0].dily.findIndex(d => d.druh === 'sbernice');
    pscDilZmena(0, di0, 'pas', '40×10'); pscDilZmena(0, di0, 'In', '630'); pscDilZmena(0, di0, 'icw', '25');
    await __T.w(150);
  });
  const sb1 = await p.evaluate(() => pscSbernice(__rz.skrin).chains.length);
  // spojka zaškrtnutím v panelu pole 1
  await p.evaluate(() => { TD_AKCE.tdPscPole({ getAttribute: () => '0' }); });
  await w(150);
  await p.evaluate(() => { const c = document.querySelector('#rz-vlastnosti .psc-dp[data-dp="spojka"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await w(200);
  const sb2 = await p.evaluate(() => { const S = pscSbernice(__rz.skrin); const c = S.chains[0];
    return { n: S.chains.length, pole: c.dily.map(d => d.pi).join(','), pas2: c.dily[1] && c.dily[1].dl.pas, In2: c.dily[1] && c.dily[1].dl.In,
      spojka: document.querySelectorAll('#rz-pohled .psc-spojka').length, popis: pscSbPopis(c.dily[0].dl), svg: [...document.querySelectorAll('#rz-pohled [data-sbernice]')].length }; });
  check('dvě sběrnice bez spojky = dvě, se spojkou jedna přes pole 1 a 2 (údaje platí pro celou)', sb1 === 2 && sb2.n === 1 && sb2.pole === '0,1' && sb2.spojka >= 1 && sb2.svg >= 2,
    sb1 + ' → ' + JSON.stringify(sb2));
  await p.evaluate(() => { const c = pscSbernice(__rz.skrin).chains[0]; pscDilZmena(1, __rz.skrin.pole[1].dily.indexOf(c.dily[1].dl), 'In', '800'); });
  const sb3 = await p.evaluate(() => pscSbernice(__rz.skrin).chains[0].dily.map(d => d.dl.In).join(','));
  check('In zadané v kterémkoli poli se zapíše do celé sběrnice; popis „3+N+PE · Cu 40×10 · 630 A · Icw 25 kA"', sb3 === '800,800' && sb2.popis === '3+N+PE · Cu 40×10 · 630 A · Icw 25 kA', sb3 + ' | ' + sb2.popis);
  // přístroj na desce „napájen ze sběrnice"
  await p.evaluate(async () => { __rz.vyber = __T.najdi('-QF1').uid; __rz.vic = null; rozvSvgPrekreslit(); rozvVlastnostiVykreslit(); await __T.w(100);
    const s = document.querySelector('#rz-vlastnosti [data-rp2="sbernice"]'); s.value = s.options[1].value; s.dispatchEvent(new Event('change', { bubbles: true })); await __T.w(200); });
  const nap = await p.evaluate(() => ({ sb: __T.najdi('-QF1').sbernice, id: pscSbernice(__rz.skrin).chains[0].id, um: (document.querySelector('#rz-vlastnosti .rp-psc-umisteni') || {}).innerText || '' }));
  check('přístroj na desce: „Napájen ze sběrnice" a umístění „Pole 2 · montážní deska (x …, y …)"', nap.sb === nap.id && /Pole 2 · montážní deska \(x \d+ mm, y \d+ mm\)/.test(nap.um), JSON.stringify(nap));

  // pole: kopie, přesun, odebrání se ZPĚT
  await p.evaluate(async () => { pscPoleAkce(0, 'kopie'); await __T.w(200); });
  const pk = await p.evaluate(() => ({ n: __rz.skrin.pole.length, oz: __rz.rady.slice(0, 6).map(r => r.prvky.map(x => x.ozn).join(',')).join(' / '), sp: __rz.skrin.pole[1].dily.some(d => d.spojka) }));
  await p.keyboard.press('Control+z'); await w(150);
  await p.evaluate(async () => { pscPoleAkce(2, 'vlevo'); await __T.w(150); });
  const pv = await p.evaluate(() => __rz.skrin.pole.map(x => x.sirka).join(','));
  await p.keyboard.press('Control+z'); await w(150);
  const pz = await p.evaluate(() => __rz.skrin.pole.map(x => x.sirka).join(','));
  check('pole: kopie vedle (nová označení, spojka se nekopíruje), přesun doleva, vše se ZPĚT', pk.n === 4 && /-FA\d{2}|-FI2/.test(pk.oz) && !pk.sp && pv === '600,400,800' && pz === '600,800,400',
    JSON.stringify(pk) + ' | ' + pv + ' → ' + pz);

  // kóty
  const koty = await p.evaluate(() => ({ k: !!document.querySelector('#rz-pohled .psc-koty'), t: (document.querySelector('#rz-pohled .psc-koty') || {}).textContent || '' }));
  await p.click('[data-action="tdPscKoty"]'); await w(150);
  const koty2 = await p.evaluate(() => !!document.querySelector('#rz-pohled .psc-koty'));
  await p.click('[data-action="tdPscKoty"]'); await w(150);
  const koty3 = await p.evaluate(() => !!document.querySelector('#rz-pohled .psc-koty'));
  check('kóty v mm jsou zapnuté a tlačítkem 📏 Kóty jdou vypnout a zapnout', koty.k && /1800|600/.test(koty.t) && !koty2 && koty3, koty.t.slice(0, 80));

  // screenshot pro uživatele
  await p.evaluate(() => document.querySelector('.dok-wrap').scrollIntoView({ block: 'start' })); await w(200);
  await p.screenshot({ path: path.join(__dirname, '_beh', 'psc-editor.png'), fullPage: false });

  // ── 6. PDF ─────────────────────────────────────────────────────────────
  await p.evaluate(async () => { await dokUlozitOtevreny(); await dokNahledZeSeznamu(__dokOtevreny.uid); await __T.w(600); });
  const pdf = await p.evaluate(() => ({ text: Array.from(document.querySelectorAll('#dok-pdf-pages .a4')).map(a => a.innerText).join('\n'), n: document.querySelectorAll('#dok-pdf-pages .a4').length,
    svg: !!document.querySelector('#dok-pdf-pages .rz-svg-psc') }));
  check('PDF: titul PSC podle ČSN EN IEC 61439-2, řádek Pole, čelní pohled', /výkonový rozvaděč \(PSC\)/i.test(pdf.text) && /ČSN EN IEC 61439-2/.test(pdf.text) && /\bPole\b/.test(pdf.text) && pdf.svg, pdf.n + ' stran');
  check('PDF: seznam přístrojů s umístěním („pole 2 / deska", „pole 1 / řada 1") a rozměry', /pole 2 \/ deska/i.test(pdf.text) && /pole 1 \/ řada 1/i.test(pdf.text) && /Rozměry/.test(pdf.text) && /\d+ × \d+ mm/.test(pdf.text),
    (pdf.text.match(/.*pole 2 \/ deska.*/i) || [''])[0]);
  await p.screenshot({ path: path.join(__dirname, '_beh', 'psc-pdf.png') });
  await p.evaluate(() => TD_AKCE.tdPdfZpet()); await w(300);

  // ── 7. import CSV s rozměry ────────────────────────────────────────────
  const csv = await p.evaluate(() => {
    const hl = 'druh;kategorie;nazev;vyrobce;rada;typ;poly;in;charakteristika;icn;icu;ics;icw;idn;typ_chranice;trida_spd;up;sirka_moduly;sirka_mm;vyska_mm;hloubka_mm;uzitna_sirka_mm;uzitna_vyska_mm;pv;ue;nastaveni;provedeni;material;typ_skrine;rady;moduly_v_rade;ip;ik;ina;penc;rozmery;trida_ochrany;overeno;poznamka';
    const sablona = ROZV_CSV.map(c => c[0]).join(';');
    const t = '﻿' + hl + '\r\n' +
      'pristroj;QF;;Výrobce A;VA-M;VA-QF-250;3;250;;;36;36;5;;;;;;105;161;86;;;48;690;Ir 0,4–1 In;;;;;;;;;;;;ne;\r\n' +
      'pristroj;QF;;Výrobce A;VA-M;VA-QF-BEZ;3;160;;;25;;;;;;;;;;;;;;;;;;;;;;;;;;;ne;\r\n' +
      'pole;;Pole 600;Výrobce A;VA-P;VA-P-6;;;;;;;;;;;;;600;2000;400;500;1800;;;;volně stojící;oceloplech;;;;IP55;IK10;1600;;;I;ne;\r\n';
    const v = rozvImportRozebrat(t, 'vyrobce-a.csv');
    const stare = rozvImportRozebrat('druh;kategorie;vyrobce;typ;poly;in;charakteristika;sirka_moduly\npristroj;FA;Výrobce B;VB-16;1;16;B;1\n', 'stare.csv');
    return { sablona: sablona === hl, pol: v.polozky.map(x => x.polozka), chyby: v.chyby.map(c => c.radek + ': ' + c.text), stare: stare.polozky.map(x => JSON.stringify(x.polozka)), stareCh: stare.chyby.length };
  });
  const qf = csv.pol.find(x => x.kat === 'QF') || {}, pl = csv.pol.find(x => x.druh === 'pole') || {};
  check('šablona CSV = přesně zadaná hlavička (39 sloupců)', csv.sablona, '');
  check('CSV: MCCB s rozměry v mm, Icu/Ics/Icw, nastavením spouští a Pv celkem', qf.sirkaMm === 105 && qf.vyskaMm === 161 && qf.hloubkaMm === 86 && qf.icu === 36 && qf.icw === 5 &&
    qf.pv === 48 && qf.pvCelkem === true && /Ir 0,4/.test(qf.nastaveni || '') && qf.overeno === false, JSON.stringify(qf));
  check('CSV: MCCB bez rozměrů v mm = chyba řádku (rozměry povinné)', csv.chyby.length === 1 && /^3: /.test(csv.chyby[0]) && /mm/.test(csv.chyby[0]), csv.chyby.join(' | '));
  check('CSV: pole 600 × 2000 mm s užitnými rozměry a provedením volně stojící', pl.druh === 'pole' && pl.sirkaMm === 600 && pl.vyskaMm === 2000 && pl.uzitnaVyskaMm === 1800 &&
    pl.provedeni === 'volně stojící' && pl.ip === 'IP55', JSON.stringify(pl));
  check('staré CSV bez nových sloupců: přístroj se načte bez nových klíčů', csv.stareCh === 0 && csv.stare.length === 1 && !/sirkaMm|icw|nastaveni|pvCelkem/.test(csv.stare[0]), csv.stare[0]);

  // ── 8. PSC → DBO ───────────────────────────────────────────────────────
  alerty.length = 0;
  await p.evaluate(async () => { await dokOtevrit((DOK.dokumenty.find(x => x.typ === 'psc' && x.data.skrin && x.data.skrin.pole.length === 3) || {}).uid); await __T.w(300); });
  await p.evaluate(() => document.querySelector('[data-action="tdPscNaDbo"]').click()); await w(400);
  const nd = await p.evaluate(() => __dokOtevreny.typ);
  check('PSC → DBO nejde: hláška říká proč (3 pole, deska, sběrnice, přístroje jen pro PSC), dokument zůstal PSC', nd === 'psc' && /DBO převést nejde/.test(alerty[0] || '') &&
    /má 3 pole/.test(alerty[0]) && /montážní deska/.test(alerty[0]) && /sběrnice/.test(alerty[0]) && /přístroje jen pro PSC/.test(alerty[0]), (alerty[0] || '').replace(/\n/g, ' '));
  await p.evaluate(async () => {
    await dokNovy('psc'); rozvSkrinNastavit(rozvKnihPolozka('v-pole-600'));
    const R = __rz.skrin.pole[0].dily.findIndex(d => d.druh === 'deska'); pscDilAkce(0, R, 'odebrat');
    rozvVlozit('v-fa-1-B16'); rozvVlozit('v-fa-1-B10'); await __T.w(900);
  });
  const predDbo = await p.evaluate(() => ({ uid: __dokOtevreny.uid, oz: __T.rady() }));
  await p.evaluate(() => document.querySelector('[data-action="tdPscNaDbo"]').click()); await w(700);
  const doDbo = await p.evaluate(() => ({ typ: __dokOtevreny.typ, uid: __dokOtevreny.uid, cislo: __dokOtevreny.data.cislo, rezim: __rz.rezim, sk: __rz.skrin && __rz.skrin.rady + 'x' + __rz.skrin.modulu,
    oz: __T.rady(), ts: __rz.skrin && __rz.skrin.typSkrine }));
  check('jednoduchý PSC (jedno pole, jen DIN segment) → DBO: stejné uid, číslo ROZ, skříň z DIN segmentu, přístroje zůstaly', doDbo.typ === 'rozv' && doDbo.uid === predDbo.uid &&
    /^ROZ-/.test(doDbo.cislo) && doDbo.rezim !== 'PSC' && /^\d+x\d+$/.test(doDbo.sk) && doDbo.oz.startsWith('-FA1,-FA2'), JSON.stringify(doDbo));

  // ── 9. data revizí beze změny ──────────────────────────────────────────
  const otiskPo = await p.evaluate(() => __T.otiskRevizi());
  check('data revizí po práci s PSC bajtově stejná', otiskPred === otiskPo, '');

  // ── 10. DBO beze změny proti předchozí verzi (8902 = poslední commit) ──
  {
    const ctxS = await b.newContext({ viewport: { width: 1366, height: 900 } });
    await knihovny(ctxS);
    await ctxS.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
    const s = await ctxS.newPage(); s.on('dialog', d => d.accept());
    await s.goto(STARA); await w(1200); await s.evaluate(pomocnik);
    // vymyšlený byt 3+1 postavený ve STARÉ verzi — data se pak vloží do obou
    await s.evaluate(async () => { await dokNacist(); await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-z'));
      __T.nast('[data-dk="oznaceni"]', 'RH1'); __T.nast('[data-dk="privodIn"]', '40'); await __T.w(100); });
    await s.evaluate(require('./rozvadec-byt.js')); await w(1000);
    const data = await s.evaluate(async () => { await dokUlozitOtevreny(); return dokKopie(dokNajit(__dokOtevreny.uid).data); });
    const zkus = async (pg) => pg.evaluate(async (data) => {
      await dokNacist();
      const z = { uid: 'dbo-stejny', typ: 'rozv', cislo: 'ROZ-0777', vytvoreno: '2026-10-21T08:00:00.000Z', upraveno: '2026-10-21T08:00:00.000Z', data: data };
      DOK.dokumenty = DOK.dokumenty.filter(x => x.uid !== z.uid); DOK.dokumenty.push(dokKopie(z)); await dokZapsat();
      const pred = JSON.stringify(dokNajit(z.uid).data);
      await dokOtevrit(z.uid); await __T.w(300);
      const svg = rozvSvg(__rz, { k: 3 }), svgT = rozvSvg(__rz, { tisk: true, k: 0.5 });
      const html = document.querySelector('#screen-dok-form .dok-wrap').innerHTML;
      const knih = document.getElementById('rz-seznam').innerHTML;
      dokZmena(); await dokUlozitOtevreny(); await __T.w(100);
      const po = JSON.stringify(dokNajit(z.uid).data);
      await dokNahledZeSeznamu(z.uid); await __T.w(500);
      const pdf = Array.from(document.querySelectorAll('#dok-pdf-pages .a4')).map(a => a.innerHTML).join('\n');
      return { pred, po, svg, svgT, html, knih, pdf };
    }, data);
    const A = await zkus(s), B = await zkus(p);
    check('starý DBO: otevření a uložení nezmění data (nová verze, bajtově)', B.pred === B.po, B.pred.length + ' / ' + B.po.length);
    check('DBO: uložená data po otevření a uložení stejná jako ve předchozí verzi', A.po === B.po, '');
    check('DBO: čelní pohled (obrazovka i tisk) znak po znaku stejný jako ve předchozí verzi', A.svg === B.svg && A.svgT === B.svgT, A.svg.length + ' / ' + B.svg.length);
    const rozdil = (a, c) => { let i = 0; while (i < a.length && a[i] === c[i]) i++; return i + ': …' + a.slice(Math.max(0, i - 60), i + 80) + ' ⟷ …' + c.slice(Math.max(0, i - 60), i + 80); };
    check('DBO: celý editor (hlavička, knihovna, pohled, vlastnosti) stejný jako ve předchozí verzi', A.html === B.html, A.html === B.html ? '' : rozdil(A.html, B.html));
    check('DBO: PDF návrhu stejné jako ve předchozí verzi', A.pdf === B.pdf, A.pdf === B.pdf ? '' : rozdil(A.pdf, B.pdf));
    await s.evaluate(() => TD_AKCE.tdPdfZpet && TD_AKCE.tdPdfZpet());
    await ctxS.close();
    await p.evaluate(async () => { await dokNacist(); DOK.dokumenty = DOK.dokumenty.filter(x => x.uid !== 'dbo-stejny'); await dokZapsat(); TD_AKCE.tdPdfZpet(); });
  }

  // ── 11. telefon: klepnutí na přístroj v knihovně a na desku ────────────
  {
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await knihovny(c2);
    await c2.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
    const t = await c2.newPage(); const err2 = [];
    t.on('pageerror', e => err2.push(e.message)); t.on('dialog', d => d.accept());
    await t.goto(URL); await w(1200); await t.evaluate(pomocnik);
    await t.evaluate(async () => { await dokNacist(); await dokNovy('psc'); rozvSkrinNastavit(rozvKnihPolozka('v-pole-600')); rozvSkrinNastavit(rozvKnihPolozka('v-pole-800')); await __T.w(200); });
    const vid = async sel => t.evaluate(s => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + 12, y: b.top + b.height / 2 }; }, sel);
    await t.evaluate(() => { const e = document.querySelector('.rz-f[data-f="q"]'); e.value = 'Výkonový jistič 3P 250'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await w(200);
    await t.evaluate(() => document.querySelectorAll('.toast').forEach(x => x.remove()));
    let q = await vid('#rz-seznam [data-kid="v-qf-3-250"] .rz-p-text'); await t.touchscreen.tap(q.x, q.y); await w(500);
    const ban = await t.evaluate(() => ({ v: __rz.knihVyber, b: (document.querySelector('.rz-banner') || {}).textContent || '', tab: __rzF.tab, n: document.querySelectorAll('#rz-seznam .rz-polozka').length, el: !!document.querySelector('#rz-seznam [data-kid="v-qf-3-250"]') }));
    await t.evaluate(() => document.getElementById('rz-svg-ram').scrollIntoView({ block: 'center' })); await w(200);
    await t.evaluate(() => { const g = __T.deska(1), ram = document.getElementById('rz-svg-ram'), k = document.querySelector('#rz-pohled .rz-svg').getScreenCTM().a;
      ram.scrollLeft = Math.max(0, (g.x0 + 160) * k - ram.clientWidth / 2); ram.scrollTop = Math.max(0, (g.y + 150) * k - ram.clientHeight / 2);
      const b = __T.bodMm(g.x0 + 160, g.y + 150); window.scrollBy(0, b.y - innerHeight / 2);
      document.querySelectorAll('.toast').forEach(x => x.remove()); });
    await w(250);
    q = await t.evaluate(() => { const g = __T.deska(1); return __T.bodMm(g.x0 + 160, g.y + 150); });
    const naBode = await t.evaluate(b => { const e = document.elementFromPoint(b.x, b.y); return e ? e.tagName + '.' + (e.getAttribute('class') || '') : 'nic'; }, q);
    await t.touchscreen.tap(q.x, q.y); await w(400);
    const vl = await t.evaluate(() => { const g = __T.deska(1), x = __rz.rady[g.i].prvky[0]; return { oz: x && x.ozn, pos: x && x.pos, sirka: document.documentElement.scrollWidth }; });
    check('telefon: klepnutí na MCCB v knihovně a na desku ho tam vloží (přichycený na 5 mm)', ban.v === 'v-qf-3-250' && /klepněte na montážní desku/.test(ban.b) && vl.oz === '-QF1' && vl.pos && vl.pos.x % 5 === 0 && vl.pos.y % 5 === 0,
      JSON.stringify([ban, vl, naBode]));
    check('telefon: stránka bez vodorovného posunu (široký rozvaděč se posouvá ve svém rámečku)', vl.sirka <= 390, String(vl.sirka));
    await t.screenshot({ path: path.join(__dirname, '_beh', 'psc-telefon.png'), fullPage: false });
    check('telefon: bez chyb JavaScriptu', !err2.length, err2.join(' | '));
    await c2.close();
  }

  check('bez chyb JavaScriptu', !err.length, err.join(' | '));
  await b.close();
  console.log(res.join('\n'));
  const spatne = res.filter(r => r.startsWith('❌')).length;
  console.log('\n' + (res.length - spatne) + ' / ' + res.length + ' v pořádku');
  process.exit(spatne ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.log('SELHALO: ' + (e && e.stack || e)); process.exit(1); });
