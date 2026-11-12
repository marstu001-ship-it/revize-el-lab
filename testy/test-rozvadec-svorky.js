// Čelní pohled „jako v dílně" — fáze 3 (2026-11-12): svorkový plán, N a PE podle vývodů,
// kontrola „Co ještě chybí", vstup / výstup přístroje na první pohled a čísla vodičů.
// Test hlídá:
//  - RS2 se svorkovnicí: „Přiřadit svorky" dá 44 vývodům svorky -X4…, 3P jističe po 3 svorkách,
//    chybějící svorky se ohlásí a „Prodloužit svorkovnici" je doplní, ruční výběr, Ctrl+Z,
//  - tah vodiče ze jističe na svorku v režimu Zapojení zapíše totéž,
//  - svorkový plán do PDF jen po zapnutí; rozvaděč bez zásahu = data a PDF beze změny.
// Všechna data vymyšlená. Porovnání se starým programem: STARA_PORT (8902 = vydání před fází 3).
const { chromium } = require('./pw');
const path = require('path');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const STARA_PORT = process.env.STARA_PORT || 8902, STARA_URL = 'http://127.0.0.1:' + STARA_PORT + '/index.html';
const res = []; const check = (n, ok, d) => { const t = (ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''); res.push(t); if (process.env.LADIT) console.log(t); };
const w = ms => new Promise(r => setTimeout(r, ms));

async function otevri(b, url, vp) {
  const ctx = await b.newContext({ viewport: vp || { width: 1600, height: 1000 } });
  await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: path.join(__dirname, 'knihovny', r.request().url().split('/').pop()), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const p = await ctx.newPage(); p.__err = [];
  p.on('pageerror', e => p.__err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(url); await w(1000);
  await p.evaluate('window.__rs2 = ' + require('./rozvadec-rs2.js').toString());
  await p.evaluate(() => {
    STORE.technik = Object.assign({}, STORE.technik, { jmeno: 'Petr Vymyšlený', firma: 'Vymyšlená elektro s.r.o.' }); saveStore();
    window.__T = {
      w: ms => new Promise(r => setTimeout(r, ms)),
      cist: () => DOK_TYPY.rozv.cist(dokForm()),
      naj: o => { let r = null; __rz.rady.forEach(a => a.prvky.forEach(x => { if (x.ozn === o) r = x; })); return r; },
      // RS2 + tři přívodní svorky -X1…X3 a vývodová svorkovnice -X4 (n svorek)
      async rs2(n) {
        await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel')); window.__rs2();
        for (let i = 0; i < 3; i++) { const x = rozvVlozit('v-x-rad-25', 2, i); x.nadr = '@privod'; x.nadrRucne = true; }
        const sv = rozvVlozit('v-x-svork', 2, 3);
        rozvZmena('sv', () => { sv.p.pocet = n || 40; sv.p.sirka = rozvSvorkySirka(n || 40); });
        rozvPrecislovat(); rozvPohledVykreslit(); dokZmena();
        return sv;
      }
    };
  });
  return { ctx, p };
}

(async () => {
  const b = await chromium.launch();
  const { p } = await otevri(b, URL), err = p.__err;

  // ── 1. svorkový plán ──────────────────────────────────────────────────
  const sv = await p.evaluate(async () => {
    const r = {}, sv = await __T.rs2(40);
    r.puv = JSON.stringify(__T.cist().rady).indexOf('"svorky":[') + '|' + ('svorkovyPlanPdf' in __T.cist());
    r.ozn = sv.ozn;
    rozvZalozkaNastavit('dok'); await __T.w(100);
    const od = document.querySelector('#rz-pan-dok [data-oddil="svorky"]'); r.oddil = !!od;
    od.open = true;
    r.tl = !!document.querySelector('#rz-pan-dok [data-action="tdRSvPrirad"]');
    r.pred = document.getElementById('rzs-stav').innerText;
    r.sirka = document.querySelector('#rz-pan-dok .rzs-tab') ? document.querySelectorAll('#rz-pan-dok .rzs-tab tr').length : 0;
    TD_AKCE.tdRSvPrirad(); await __T.w(100);
    const naj = o => __T.naj(o).svorky || [];
    const lab = o => { const M = rzsModel(__rz.rady); const v = M.V.filter(y => y.x.ozn === o)[0]; return v.slots.map(s => s.label).join('+'); };
    r.fa1 = lab('-FA1'); r.fa22 = lab('-FA22'); r.fa23 = lab('-FA23'); r.fa24 = lab('-FA24'); r.fa25 = lab('-FA25'); r.fa44 = lab('-FA44') || 'žádná';
    const M = rzsModel(__rz.rady);
    r.chybi = M.V.reduce((a, v) => a + v.chybi, 0); r.vyvodu = M.V.length;
    r.stav = document.getElementById('rzs-stav').innerText;
    r.tlProd = !!document.querySelector('#rzs-stav [data-action="tdRSvProdlouzit"]');
    r.ulozeno = JSON.stringify(__T.cist().rady).indexOf('"svorky":[') > -1;
    TD_AKCE.tdRSvProdlouzit(document.querySelector('#rzs-stav [data-action="tdRSvProdlouzit"]')); await __T.w(100);
    const M2 = rzsModel(__rz.rady);
    r.po = M2.V.reduce((a, v) => a + v.chybi, 0) + '|' + M2.L.length + '|' + sv.p.pocet;
    r.fa44b = M2.V.filter(y => y.x.ozn === '-FA44')[0].slots.map(s => s.label).join('+');
    r.stav2 = document.getElementById('rzs-stav').innerText;
    // tabulka: řádky = 48 pólů, každý vývod právě jednou na svorku
    const tr = [...document.querySelectorAll('#rz-pan-dok .rzs-tab tr')].slice(1);
    r.radku = tr.length;
    r.radek1 = [...tr[0].children].map(td => td.querySelector('select') ? td.querySelector('select').selectedOptions[0].textContent : td.textContent).join('|');
    r.fa23r = tr.filter(t => t.children[2].textContent === '-FA23').map(t => t.children[1].textContent + ':' + t.querySelector('select').selectedOptions[0].textContent).join(',');
    // ruční změna: FA1 na -X51, Ctrl+Z
    const s44 = document.querySelector('#rz-pan-dok .rzs-vyber[data-uid="' + __T.naj('-FA44').uid + '"]');
    s44.value = ''; s44.dispatchEvent(new Event('change', { bubbles: true })); await __T.w(100);   // uvolní -X51
    const sel = document.querySelector('#rz-pan-dok .rzs-vyber[data-uid="' + __T.naj('-FA1').uid + '"]');
    const opt = [...sel.options].filter(o => /X51$/.test(o.textContent))[0]; r.moznost = !!opt;
    sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); await __T.w(100);
    r.rucne = lab('-FA1') + '|' + rzsModel(__rz.rady).L.filter(s => !s.vyvod).length;
    zpetPosledni(); await __T.w(100); r.zpet = lab('-FA1');
    return r;
  });
  check('svorky: svorkovnice -X4 po třech přívodních -X1…X3, oddíl „Svorky" v Dokumentech, před zásahem v datech nic', sv.ozn === '-X4' && sv.oddil && sv.tl && sv.puv === '-1|false', sv.ozn + ' ' + sv.puv);
  check('svorky: 40 svorek nestačí pro 44 vývodů — chybí 8, nabídne „Prodloužit svorkovnici o 8 svorek"', sv.chybi === 8 && sv.vyvodu === 44 && sv.tlProd && /Chybí 8 svorek/.test(sv.stav), sv.stav);
  check('svorky: 1P jističe dostanou svorky v pořadí čelního pohledu (-FA1 → -X4, -FA22 → -X25)', sv.fa1 === '-X4' && sv.fa22 === '-X25', sv.fa1 + ' ' + sv.fa22);
  check('svorky: 3P jistič po třech svorkách za sebou (-FA23 → -X26+-X27+-X28, -FA24 → -X29+-X30+-X31)', sv.fa23 === '-X26+-X27+-X28' && sv.fa24 === '-X29+-X30+-X31', sv.fa23 + ' | ' + sv.fa24);
  check('svorky: po zásahu se přiřazení uloží do dat vývodů (x.svorky)', sv.ulozeno === true);
  check('svorky: „Prodloužit" doplní svorkovnici na 48 svorek a přiřadí zbytek (-FA44 → -X51)', sv.po === '0|48|48' && sv.fa44b === '-X51' && /Každý vývod má svorky/.test(sv.stav2), sv.po + ' ' + sv.fa44b);
  check('svorky: tabulka — 48 řádků, svorka | potenciál | z přístroje | vývod | kabel | průřez', sv.radku === 48 && /^-X4\|L1\|-FA1\|Učebna 1 – světla\|CYKY-J 3×1,5\|1,5$/.test(sv.radek1), sv.radek1);
  check('svorky: 3P vývod má tři řádky L1, L2, L3', sv.fa23r === 'L1:-X26,L2:-X27,L3:-X28', sv.fa23r);
  check('svorky: ruční výběr svorky v tabulce (-FA1 → -X51), volná svorka -X4 se uvolní, Ctrl+Z vrátí', sv.moznost && sv.rucne === '-X51|1' && sv.zpet === '-X4', sv.rucne + ' ' + sv.zpet);

  // ── tah vodiče ze jističe na svorku (režim Zapojení) ──
  const vo = await p.evaluate(async () => {
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel'));
    const v = (k, r) => rozvVlozit(k, r, __rz.rady[r].prvky.length);
    v('v-qm-3-63', 0); const fa = v('v-fa-1-B10', 0), xr = v('v-x-rad-25', 1), sv = v('v-x-svork', 1);
    fa.vyvod = 'Světla'; rozvPohledVykreslit();
    const r = { pred: JSON.stringify(fa.svorky || null) };
    // vodič z výstupní (dolní) svorky jističe na svorkovnici
    const nw = rzpVodic({ uid: fa.uid, strana: 'b', pol: 0 }, { uid: sv.uid, strana: 't', pol: 0 });
    rzpTahKonec({ druh: 'novy', cil: true, pr: { ok: true, nw } }); await __T.w(50);
    r.po = JSON.stringify(fa.svorky);
    r.model = rzsModel(__rz.rady).V.filter(y => y.x.uid === fa.uid)[0].slots.map(s => s.label).join();
    r.sv = sv.ozn;
    zpetPosledni(); await __T.w(50); r.zpet = JSON.stringify(__rz.rady[0].prvky.filter(x => x.uid === fa.uid)[0].svorky || null);
    return r;
  });
  check('vodič ze jističe na svorkovnici (režim Zapojení) zapíše x.svorky; Ctrl+Z ho vrátí', vo.pred === 'null' && /"i":1/.test(vo.po) && vo.model === vo.sv && vo.zpet === 'null', JSON.stringify(vo));

  // ── svorkový plán v PDF ──
  const pdf = await p.evaluate(async () => {
    await __T.rs2(48); TD_AKCE.tdRSvPrirad(); await __T.w(100);
    const d = __T.cist(), r = {};
    const vse = x => DOK_TYPY.rozv.pdf(x).map(q => q.html || q.cela || '').join('');
    r.vyp = /Svorkový plán/.test(vse(d));
    const d2 = Object.assign({}, d, { svorkovyPlanPdf: true }); const B = DOK_TYPY.rozv.pdf(d2), h = B.map(q => q.html || '').join('');
    r.zap = /Svorkový plán/.test(h); r.strana = B.filter(q => /Svorkový plán/.test(q.html || ''))[0].strana;
    r.radku = (h.match(/<tr[^>]*>\s*<td class="c rzs-sv">-X/g) || []).length;
    r.hlavicka = /<th>Svorka<\/th><th>Potenciál<\/th><th>Z přístroje<\/th><th>Vývod<\/th><th>Kabel<\/th><th>Průřez<\/th>/.test(h);
    r.pozice = B.findIndex(q => /Svorkový plán/.test(q.html || '')) > B.findIndex(q => /Seznam přístrojů/.test(q.html || ''));
    // zaškrtávátko v Dokumentech
    rozvZalozkaNastavit('dok'); await __T.w(100);
    const cb = document.querySelector('#rz-pan-dok [data-dk="svorkovyPlanPdf"]'); r.cb = !!cb && !cb.checked;
    r.dataPred = 'svorkovyPlanPdf' in __T.cist();
    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
    r.dataPo = __T.cist().svorkovyPlanPdf === true;
    return r;
  });
  check('PDF: svorkový plán se bez zapnutí nepřidá', pdf.vyp === false);
  check('PDF: po zapnutí samostatná strana na výšku za seznamem přístrojů, 48 řádků svorek', pdf.zap && pdf.strana === 'vyska' && pdf.pozice && pdf.radku === 48 && pdf.hlavicka, JSON.stringify(pdf));
  check('PDF: zaškrtávátko „Svorkový plán do dokumentace" — v datech jen zapnuté', pdf.cb && pdf.dataPred === false && pdf.dataPo === true);

  // ── starý rozvaděč: data i PDF beze změny proti staré verzi ──
  const nov = await p.evaluate(async () => {
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel')); window.__rs2(); await __T.w(100);
    const d = __T.cist(); d.vyroba = {}; d.datum = '2026-01-01'; d.cislo = 'ROZ-0001';
    return { d: JSON.stringify(d), pdf: DOK_TYPY.rozv.pdf(d).map(q => q.html || q.cela || '').join('') };
  });
  const { p: ps } = await otevri(b, STARA_URL);
  const star = await ps.evaluate(async () => {
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel')); window.__rs2(); await __T.w(100);
    const d = __T.cist(); d.vyroba = {}; d.datum = '2026-01-01'; d.cislo = 'ROZ-0001';
    return { d: JSON.stringify(d), pdf: DOK_TYPY.rozv.pdf(d).map(q => q.html || q.cela || '').join('') };
  });
  const bezUid = s => { const m = {}; let n = 0; return s.replace(/\b[a-z][a-z0-9]{11,14}\b/g, q => m[q] || (m[q] = 'U' + (++n))); };
  if (process.env.LADIT_DIFF) { require('fs').writeFileSync(__dirname + '/_beh/d-nov.txt', bezUid(nov.pdf)); require('fs').writeFileSync(__dirname + '/_beh/d-star.txt', bezUid(star.pdf)); require('fs').writeFileSync(__dirname + '/_beh/dd-nov.txt', bezUid(nov.d)); require('fs').writeFileSync(__dirname + '/_beh/dd-star.txt', bezUid(star.d)); }
  check('starý rozvaděč (RS2) bez zásahu: data bajtově stejná jako ve starém programu', bezUid(nov.d) === bezUid(star.d), nov.d.length + ' / ' + star.d.length);
  check('starý rozvaděč (RS2): PDF dokumentace beze změny', bezUid(nov.pdf) === bezUid(star.pdf), nov.pdf.length + ' / ' + star.pdf.length);

  check('bez chyb v konzoli', !err.length, err.join(' | '));
  await b.close();
  console.log(res.join('\n'));
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.log('❌ SELHALO', e.stack); process.exit(1); });
