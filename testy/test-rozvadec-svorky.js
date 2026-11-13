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
    const tr = [...document.querySelectorAll('#rz-pan-dok .rzs-tab tr')].slice(1).filter(x => !x.classList.contains('rzs-np'));
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

  // ── 2. N a PE podle vývodů ────────────────────────────────────────────
  const np = await p.evaluate(async () => {
    const r = {};
    await __T.rs2(48); TD_AKCE.tdRSvPrirad(); await __T.w(100);
    let N = rzsNP(__rz.rady, __rz);
    r.skup = N.N.map(g => g.nazev + ':' + g.vyvody.length + ':' + g.potreba + ':' + g.kap).join(' ');
    r.pe = N.PE.potreba + ':' + N.PE.kap;
    r.fi = N.N.filter(g => g.fi)[0].fi.ozn;
    rozvZalozkaNastavit('dok'); await __T.w(100);
    document.querySelector('#rz-pan-dok [data-oddil="svorky"]').open = true;
    r.nalez = rzsNPNaleza(__rz.rady, __rz).map(n => n.druh).join();
    r.stav = document.getElementById('rzs-obsah').innerText;
    const tl = () => [...document.querySelectorAll('#rzs-obsah [data-action="tdRSvPridatPrip"]')];
    r.tlacitka = tl().map(b => b.textContent).join(' | ');
    // přidat N-FI1, společnou N a PE
    for (const b of tl()) { TD_AKCE.tdRSvPridatPrip(b); await __T.w(100); }
    N = rzsNP(__rz.rady, __rz);
    r.po = N.N.map(g => g.nazev + ':' + g.kap).join(' ') + ' PE:' + N.PE.kap;
    const bar = N.N.filter(g => g.fi)[0].zas[0].x;
    r.nadr = bar.nadr === N.N.filter(g => g.fi)[0].fi.uid && bar.p.prip === 'N';
    r.nalez2 = rzsNPNaleza(__rz.rady, __rz).length;
    r.stav2 = document.getElementById('rzs-obsah').innerText.indexOf('N a PE: přípojnice mají dost svorek') > -1;
    // svorky N a PE v plánu
    const rows = rzsNPRadky(__rz.rady, __rz);
    r.radku = rows.length;
    const f = o => rows.filter(x => x.ozn === o).map(x => x.pot + '=' + x.svorka).join(',');
    r.fa25 = f('-FA25'); r.fa44 = f('-FA44'); r.fa1 = f('-FA1'); r.fa23 = f('-FA23');
    r.prvniFi = rows.filter(x => /přívod N/.test(x.vyvod)).map(x => x.svorka + '(' + x.ozn + ')').join(',');
    r.pospoj = rows.filter(x => x.vyvod === 'ochranné pospojování').map(x => x.svorka).join(',');
    const tabulka = document.getElementById('rzs-obsah').querySelector('.rzs-tab').innerText;
    r.vTab = /N-FI1 · 21/.test(tabulka) && /PE · 47/.test(tabulka);
    // N-FI1 s málo svorkami → „Upravit počet"
    const barX = N.N.filter(g => g.fi)[0].zas[0].x;
    rozvZmena('m', () => { barX.p.pocet = 12; barX.p.sirka = rozvSvorkySirka(12); }); rzsObnovitOddil();
    r.malo = /N-FI1 má 12 svorek, potřeba 21/.test(document.getElementById('rzs-obsah').innerText);
    TD_AKCE.tdRSvNaPocet(document.querySelector('#rzs-obsah [data-action="tdRSvNaPocet"]')); await __T.w(100);
    r.upraveno = barX.p.pocet + '|' + rzsNPNaleza(__rz.rady, __rz).length;
    // RCBO a 3P motor se na N nepočítají
    const potrebaPred = rzsNP(__rz.rady, __rz).N.map(g => g.potreba).join();
    const rc = rozvVlozit('v-fifa-1N-B16', 3, __rz.rady[3].prvky.length), ms = rozvVlozit('v-fa-3-B40', 3, __rz.rady[3].prvky.length);
    ms.spotr = 'motor'; ms.vyvod = 'Motor'; rc.vyvod = 'RCBO'; rozvPrecislovat();
    r.rcbo = potrebaPred + ' → ' + rzsNP(__rz.rady, __rz).N.map(g => g.potreba).join() + ' PE ' + rzsNP(__rz.rady, __rz).PE.potreba;
    // ZPĚT vrátí přidání přípojnic
    return r;
  });
  check('N a PE: vývody s N podle chrániče — společná N 24 vývodů (potřeba 25), N-FI1 20 vývodů (potřeba 21), chránič -FI1', np.skup === 'N:24:25:0 N-FI1:20:21:0' && np.fi === '-FI1', np.skup + ' ' + np.fi);
  check('N a PE: PE = 44 vývodů + 1 přívod + 2 pospojování = 47', np.pe === '47:0', np.pe);
  check('N a PE: bez přípojnic tři nálezy „chybí" a tři tlačítka „Přidat přípojnici …"', np.nalez === 'chybiN,chybiN,chybiPE' && /Přidat přípojnici N \(25 svorek\)/.test(np.tlacitka) && /Přidat přípojnici N-FI1 \(21 svorek\)/.test(np.tlacitka) && /Přidat přípojnici PE \(47 svorek\)/.test(np.tlacitka), np.tlacitka);
  check('N a PE: „Přidat přípojnici" vloží přípojnice se správným počtem svorek, N-FI1 je napájena z chrániče -FI1', np.po === 'N:25 N-FI1:21 PE:47' && np.nadr === true && np.nalez2 === 0 && np.stav2, np.po + ' ' + np.nadr);
  check('N a PE: svorky v plánu — -FA25 → N-FI1 · 2, -FA44 → N-FI1 · 21, -FA1 → N · 2, 3P -FA23 má N i PE', np.fa25 === 'N=N-FI1 · 2,PE=PE · 26' && np.fa44 === 'N=N-FI1 · 21,PE=PE · 45' && np.fa1 === 'N=N · 2,PE=PE · 2' && /^N=N · 24,PE=PE · 24$/.test(np.fa23), [np.fa25, np.fa44, np.fa1, np.fa23].join(' | '));
  check('N a PE: první svorka skupiny = přívod N (N · 1, N-FI1 · 1), poslední dvě svorky PE = ochranné pospojování', np.prvniFi === 'N · 1(),N-FI1 · 1(-FI1)' && np.pospoj === 'PE · 46,PE · 47', np.prvniFi + ' ' + np.pospoj);
  check('N a PE: počet řádků plánu 93 (N 25 + N-FI1 21 + PE 47) a svorky jsou v tabulce', np.radku === 93 && np.vTab, String(np.radku));
  check('N a PE: přípojnice s 12 svorkami → „N-FI1 má 12 svorek, potřeba 21" a „Upravit počet" ji srovná na 21', np.malo && np.upraveno === '21|0', np.upraveno);
  check('N a PE: jističochránič (RCBO) a 3P motor se na N nepočítají (N-FI1 zůstává 21, společná N 25, PE +2)', np.rcbo === '25,21 → 25,21 PE 49', np.rcbo);

  // ── 3. kontrola „Co ještě chybí" ──────────────────────────────────────
  const ko = await p.evaluate(async () => {
    const r = {}, w = ms => new Promise(x => setTimeout(x, ms));
    // hotový RS2: hlavní vypínač ze svorek -X1…X3, svorky vývodů, přípojnice N, N-FI1 a PE
    const sv = await __T.rs2(48);
    const [x1, x2, x3] = __rz.rady[2].prvky.slice(0, 3), qm = __T.naj('-QH1');
    rozvZmena('priv', () => { ['L1', 'L2', 'L3'].forEach((f, i) => { [x1, x2, x3][i].faze = f; }); qm.nadrSvorky = [x1.uid, x2.uid, x3.uid]; qm.nadr = x1.uid; qm.nadrRucne = true; });
    TD_AKCE.tdRSvPrirad(); await w(50);
    rozvZalozkaNastavit('dok'); await w(50);
    dokForm().querySelector('[data-dk="dokVyber.navod"]').checked = true;   // návod k obsluze se přikládá — jinak by v „Co ještě chybí“ svítil jeho tip
    for (let i = 0; i < 3; i++) { const b = document.querySelector('#rzs-obsah [data-action="tdRSvPridatPrip"]'); if (b) { TD_AKCE.tdRSvPridatPrip(b); await w(50); } }
    rozvZalozkaNastavit('navrh'); await w(400);
    r.hotovy = rzsKontrola().map(n => n.u + ': ' + n.text);
    r.pruh = document.getElementById('rz-chybi').innerText.trim();
    r.pruhOtevreno = document.getElementById('rz-chybi').open;
    r.zel = document.querySelector('#rz-chybi summary').classList.contains('rzs-souhrn-ok');
    // oddíl v Dokumentech
    rozvZalozkaNastavit('dok'); await w(100);
    r.dok = (document.querySelector('#rz-pan-dok [data-oddil="chybi"]') || {}).innerText || '';
    rozvZalozkaNastavit('navrh'); await w(100);
    return r;
  });
  check('Co ještě chybí: hotový RS2 (hlavní vypínač ze svorek, svorky, přípojnice N / N-FI1 / PE) → žádný nález', ko.hotovy.length === 0, ko.hotovy.join(' | '));
  check('Co ještě chybí: pruh nad čelním pohledem „✓ Všechno zapojené a doplněné" (zeleně, sbalený) a totéž v Dokumentech', ko.pruh === '✓ Všechno zapojené a doplněné' && ko.zel && !ko.pruhOtevreno && /Všechno zapojené a doplněné/.test(ko.dok) && /Co ještě chybí/.test(ko.dok), ko.pruh + ' / ' + ko.dok.slice(0, 80));

  const nk = await p.evaluate(async () => {
    const r = {}, w = ms => new Promise(x => setTimeout(x, ms));
    // úmyslně neúplný RS2: svorky nikdo nepřiřadil, přípojnice chybí, X1…X3 nic nenapájí, SPD bez předjištění, vložka, hřeben…
    await __T.rs2(40);
    const fu = __T.naj('-FU1'), fa5 = __T.naj('-FA5'), fa6 = __T.naj('-FA6');
    fu.vlozka = '63 gG'; fa5.vyvod = ''; fa6.kabel = ''; fa6.prurez = '';
    const spd2 = rozvVlozit('v-spd-2-3N', 3, __rz.rady[3].prvky.length); spd2.ozn = '-SPD2';
    rzhNavrhyOtevrit(); await w(30); document.getElementById('rz-hr-pouzit').click(); await w(50);
    __T.naj('-QH1').p.In = 80; __rz.hrebeny[0].prurez = 10;
    rozvZmena('x', () => {});
    __dokOtevreny.data.dokVyber = { otepleni: true };
    rozvPohledVykreslit(); await w(400);
    const L = rzsKontrola(); r.L = L;
    const j = (u, re) => L.some(n => n.u === u && re.test(n.text));
    r.txt = L.map(n => n.u + ': ' + n.text);
    r.bezNazvu = j('upoz', /1 vývod bez názvu: -FA5/); r.bezKabelu = j('upoz', /1 vývod bez kabelu: -FA6/);
    r.bezSvorky = j('upoz', /vývodů bez svorky/) || j('upoz', /vývody bez svorky/);
    r.chybiN = j('upoz', /Chybí přípojnice N /) && j('upoz', /Chybí přípojnice N-FI1/);
    r.pe = j('chyba', /Méně než 2 svorky PE/);
    r.vlozka = j('chyba', /Vložka 63 A je větší než jmenovitý proud odpojovače 32 A/);
    r.spd = j('upoz', /-SPD2 nemá předjištění/);
    r.priv = j('upoz', /Svorka je připojena k přívodu, ale nic nenapájí/) || j('upoz', /je připojena k přívodu, ale nic nenapájí/);
    r.hreben = L.some(n => n.u === 'chyba' && n.hr && /nestačí pro zátěž/.test(n.text));
    r.pv = j('tip', /bez Pv/);
    r.poradi = L.map(n => n.u).join(',').replace(/(chyba,)+/, 'chyba,').replace(/(upoz,)+/, 'upoz,').replace(/(tip,?)+/, 'tip');
    r.pruh = document.getElementById('rz-chybi').querySelector('summary').innerText.trim();
    r.cerv = document.querySelector('#rz-chybi summary').classList.contains('rzs-souhrn-chyba');
    // klik na nález vybere přístroj
    document.getElementById('rz-chybi').open = true;
    const tl = [...document.querySelectorAll('#rz-chybi .rzs-n-text')].filter(b => /-FA5/.test(b.textContent))[0];
    tl.click(); await w(100);
    r.vybran = (rozvNajit(__rz.vyber) || { x: {} }).x.ozn;
    const hr = [...document.querySelectorAll('#rz-chybi .rzs-n-text')].filter(b => /nestačí pro zátěž/.test(b.textContent))[0];
    hr.click(); await w(100); r.hrVyber = !!__rz.hrVyber && !!rzhNajit(__rz.hrVyber);
    // tlačítko „Přidat přípojnici" přímo z pruhu
    const pb = document.querySelector('#rz-chybi [data-action="tdRSvPridatPrip"][data-f="PE"]'); r.tlPE = !!pb;
    pb.click(); await w(400);
    r.poPE = rzsNP(__rz.rady, __rz).PE.kap;
    r.zmizelo = !rzsKontrola().some(n => /Méně než 2 svorky PE/.test(n.text));
    return r;
  });
  check('Co ještě chybí: neúplný RS2 — vývod bez názvu / bez kabelu / bez svorky', nk.bezNazvu && nk.bezKabelu && nk.bezSvorky, nk.txt.join(' | '));
  check('Co ještě chybí: chybí přípojnice N a N-FI1, méně než 2 svorky PE (chyba), vložka větší než odpojovač (chyba)', nk.chybiN && nk.pe && nk.vlozka, nk.txt.join(' | '));
  check('Co ještě chybí: SPD bez předjištění, přívodní svorky nic nenapájí, přetížený hřeben (chyba), přístroje bez Pv při zapnutém oteplení (tip)', nk.spd && nk.priv && nk.hreben && nk.pv, nk.txt.join(' | '));
  check('Co ještě chybí: pořadí chyba → upozornění → tip, souhrn v pruhu červeně', /^chyba,upoz,tip$/.test(nk.poradi) && nk.cerv && /^⛔ Co ještě chybí: \d+ chyb\w* · \d+ upozornění · (1 tip|2 tipy)$/.test(nk.pruh), nk.poradi + ' / ' + nk.pruh);
  check('Co ještě chybí: klepnutí na nález vybere přístroj (-FA5) nebo hřeben; tlačítko „Přidat přípojnici PE" v pruhu nález odstraní', nk.vybran === '-FA5' && nk.hrVyber && nk.tlPE && nk.poPE === 47 && nk.zmizelo, nk.vybran + ' ' + nk.poPE);

  // bez napětí a chybějící fáze
  const bn = await p.evaluate(async () => {
    const r = {}, w = ms => new Promise(x => setTimeout(x, ms));
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel'));
    const v = k => rozvVlozit(k, 0, __rz.rady[0].prvky.length);
    const fa = v('v-fa-1-B10'); fa.vyvod = 'Světla'; fa.kabel = 'CYKY-J';
    r.bez = rzsKontrola().filter(n => n.u === 'chyba' && n.uid === fa.uid).map(n => n.text);
    const qm = v('v-qm-3-63'), x1 = v('v-x-rad-25'); x1.nadr = '@privod'; x1.nadrRucne = true; x1.faze = 'L1';
    rozvZmena('priv', () => { qm.nadrSvorky = [x1.uid]; qm.nadr = x1.uid; qm.nadrRucne = true; });
    r.fazi = rzsKontrola().filter(n => n.u === 'chyba' && /chybí fáze/.test(n.text)).map(n => n.text);
    r.bezPoQm = rzsKontrola().filter(n => /nikam zapojený/.test(n.text)).length;
    return r;
  });
  check('Co ještě chybí: přístroj bez hlavního vypínače je „bez napětí" (chyba); hlavní vypínač jen z jedné fáze → „chybí fáze"', bn.bez.length === 1 && /-FA1 není nikam zapojený/.test(bn.bez[0]) && bn.fazi.length >= 1 && /chybí fáze/.test(bn.fazi[0]) && bn.bezPoQm === 0, JSON.stringify(bn));

  // ── 4. vstup a výstup přístroje na první pohled ────────────────────────
  const vv = await p.evaluate(async () => {
    const r = {}, w = ms => new Promise(x => setTimeout(x, ms));
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel'));
    const v = (k, ra) => rozvVlozit(k, ra, __rz.rady[ra].prvky.length);
    const qm = v('v-qm-3-63', 0), fa = v('v-fa-1-B10', 0), fu = v('v-fu-3-1038', 1), spd = v('v-spd-2-3N', 1);
    // pojistkový odpojovač napájený ZESPODU: vodič z výstupu hlavního vypínače na dolní svorky pojistek
    const nw = rzpVodic({ uid: qm.uid, strana: 'b', pol: 0 }, { uid: fu.uid, strana: 'b', pol: 0 });
    rozvZmena('vodic', () => { __rz.vodice = [nw]; }); await w(50);
    TD_AKCE.tdRNapRezim(); await w(100);
    const S = rzpStav(__rz); r.vstup = S.vys[fu.uid].vstup + '|' + S.vys[fu.uid].pod;
    const g = x => document.querySelector('#rz-pohled [data-sv-uid="' + x.uid + '"]');
    r.sipky = [...g(fu).querySelectorAll('.rz-vyst')].map(e => e.getAttribute('data-vyst')).join();
    const kruh = (x, s) => [...g(x).querySelectorAll('.rz-sv')].filter(c => c.getAttribute('data-sv').split('|')[1] === s);
    r.vstupVypln = kruh(fu, 'b').map(c => c.getAttribute('fill')).join() + ' / ' + kruh(fu, 't').map(c => c.getAttribute('fill')).join();
    r.titulky = (kruh(fu, 'b')[0].querySelector('title') || {}).textContent + '|' + (kruh(fu, 't')[0].querySelector('title') || {}).textContent;
    r.spd = g(spd).querySelectorAll('.rz-vyst').length;   // svodič nemá průtok — bez šipek
    r.fa = g(fa).querySelectorAll('.rz-vyst').length + '|' + ((g(fa).querySelector('.rz-vyst') || {}).getAttribute ? g(fa).querySelector('.rz-vyst').getAttribute('data-vyst') : '-');
    // hlavní vypínač napájený shora: výstupní šipky dole
    r.qm = [...g(qm).querySelectorAll('.rz-vyst')].map(e => e.getAttribute('data-vyst')).join();
    // při tažení ze svorky se výstupní strana přístroje zvýrazní
    const bb = g(fu).getBoundingClientRect();
    rzpTahPohyb({ druh: 'nap', start: { uid: fu.uid, strana: 't', pol: 0 }, x: bb.left + bb.width / 2, y: bb.top + bb.height / 2 });
    r.akt = g(fu).querySelectorAll('.rz-vyst-akt').length;
    rzpTahKonec({ druh: 'nap', cil: null, pr: {}, obs: null }); await w(50);
    r.aktPo = g(fu).querySelectorAll('.rz-vyst-akt').length;
    // PDF čelního pohledu se šipkami neznečistí
    r.pdf = /rz-vyst/.test(rozvSvg(__rz, { tisk: true, k: 0.5 }));
    TD_AKCE.tdRNapRezim();
    return r;
  });
  check('vstup / výstup: pojistky napájené zespodu mají vstup dole (plná výplň) a výstup nahoře — tři šipky ▲ a titulky „vstup" / „výstup"', vv.vstup === 'b|true' && vv.sipky === 't,t,t' && /^#1d7a3a,#1d7a3a,#1d7a3a \/ #fff,#fff,#fff$/.test(vv.vstupVypln) && vv.titulky === 'vstup|výstup', JSON.stringify(vv));
  check('vstup / výstup: jistič ve stejné řadě jako hlavní vypínač (napájený z mezery pod řadou) má vstup dole a jednu šipku ▲ nahoře, hlavní vypínač šipky dole, svodič šipky nemá', vv.fa === '1|t' && vv.qm === 'b,b,b' && vv.spd === 0, vv.fa + ' ' + vv.qm + ' ' + vv.spd);
  check('vstup / výstup: při tažení vodiče je výstupní strana přístroje zvýrazněná, po puštění zase ne; do PDF šipky nejdou', vv.akt === 3 && vv.aktPo === 0 && vv.pdf === false, vv.akt + ' ' + vv.aktPo);

  // ── čísla vodičů ──
  const cv = await p.evaluate(async () => {
    const r = {}, w = ms => new Promise(x => setTimeout(x, ms));
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel'));
    const v = (k, ra) => rozvVlozit(k, ra, __rz.rady[ra].prvky.length);
    const qm = v('v-qm-3-63', 0), fu = v('v-fu-3-1038', 1), x1 = v('v-x-rad-25', 1), fa = v('v-fa-1-B10', 1), sv = v('v-x-svork', 2);
    fa.vyvod = 'Světla'; x1.faze = 'L1';
    const vod = (a, b) => { const nw = rzpVodic(a, b); nw.uid = rzpVodicUid(); nw.prurez = '10'; return nw; };
    rozvZmena('w', () => { __rz.vodice = [vod({ uid: '@privod', strana: 'o', pol: 0 }, { uid: qm.uid, strana: 't', pol: 0 }), vod({ uid: '@privod', strana: 'o', pol: 0 }, { uid: x1.uid, strana: 't', pol: 0 }), vod({ uid: qm.uid, strana: 'b', pol: 0 }, { uid: fu.uid, strana: 't', pol: 0 })]; });
    r.pred = JSON.stringify(__T.cist().vodice).indexOf('cislo') + '|' + ('cislovatVodice' in __T.cist());
    TD_AKCE.tdRNapRezim(); await w(100);
    r.tlacitko = !!document.querySelector('#rz-vlastnosti [data-action="tdRCislVod"]');
    TD_AKCE.tdRCislVod(); await w(100);
    const c = __rz.vodice.map(q => JSON.stringify(q.cislo));
    r.cisla = c.join(' ');
    r.stejny = JSON.stringify(__rz.vodice[0].cislo[0]) === JSON.stringify(__rz.vodice[1].cislo);   // fáze L1 z kabelu: stejný uzel = stejné číslo
    r.ruzna = new Set([].concat(__rz.vodice[0].cislo, __rz.vodice[2].cislo)).size === 6;
    r.data = __T.cist().cislovatVodice === true && __T.cist().vodice.every(q => q.cislo != null);
    r.svg = [...document.querySelectorAll('#rz-pohled .rz-w-cislo')].map(e => e.textContent).join(',');
    // materiál propojek a svorkový plán
    const d = __T.cist();
    r.mat = rzvMaterial(d).filter(m => /^vodič/.test(m)).join(' | ');
    // nový vodič ze svorkovnice ke jističi: nový uzel, nové číslo; přepojení stávajícího uzlu číslo drží
    rozvZmena('w2', () => { __rz.vodice = __rz.vodice.concat([vod({ uid: fa.uid, strana: 'b', pol: 0 }, { uid: sv.uid, strana: 't', pol: 0 })]); rzsVodicNaSvorku(__rz.vodice[3]); });
    r.novy = JSON.stringify(__rz.vodice[3].cislo);
    r.tab = rzsTabulkaHtml(rzsModel(__rz.rady, __rz), { cisla: true, vodice: __rz.vodice }).replace(/<[^>]+>/g, ' ');
    r.sloupec = /Vodič č\./.test(r.tab) && new RegExp('-X' + (+/\d+$/.exec(sv.ozn)[0]) + '[^A-Za-z]*L[^-]*-FA1[^-]*Světla.*?' + r.novy).test(r.tab.replace(/\s+/g, ' '));
    // Přečíslovat + Ctrl+Z
    const pred = JSON.stringify(__rz.vodice.map(q => q.cislo));
    TD_AKCE.tdRCislPrecislovat(); await w(100);
    r.precisl = JSON.stringify(__rz.vodice.map(q => q.cislo));
    zpetPosledni(); await w(100); r.zpetPrec = JSON.stringify(__rz.vodice.map(q => q.cislo)) === pred;
    // vypnutí smaže čísla, v datech nic; Ctrl+Z je vrátí
    TD_AKCE.tdRCislVod(); await w(100);
    r.vyp = JSON.stringify(__T.cist().vodice).indexOf('cislo') + '|' + ('cislovatVodice' in __T.cist());
    zpetPosledni(); await w(100); r.zpetVyp = __rz.cislVod === true && __rz.vodice.every(q => q.cislo != null);
    TD_AKCE.tdRNapRezim();
    return r;
  });
  check('čísla vodičů: výchozí vypnuto — v datech žádné `cislo` ani `cislovatVodice`; v panelu Zapojení je tlačítko', cv.pred === '-1|false' && cv.tlacitko, cv.pred);
  check('čísla vodičů: zapnutí přidělí čísla podle potenciálu — vodič z kabelu (L1) do QH1 a do svorky -X1 má stejné číslo, jiné uzly jiná', cv.stejny && cv.ruzna, cv.cisla);
  check('čísla vodičů: uložená jen po zapnutí (`cislovatVodice`, `vodice[i].cislo`), v čelním pohledu u svorek', cv.data && cv.svg.split(',').length >= 6, cv.svg);
  check('čísla vodičů: v seznamu materiálu propojek „vodič 1, H07V-K 10 mm² …"', /^vodič 1, H07V-K 10 mm² hnědý/.test(cv.mat) && /vodič 4/.test(cv.mat), cv.mat);
  check('čísla vodičů: nový vodič ze jističe na svorkovnici dostane nové číslo a objeví se ve svorkovém plánu', /^\d+$/.test(cv.novy) && cv.sloupec, cv.novy);
  check('čísla vodičů: Přečíslovat přidělí čísla znovu od 1, Ctrl+Z je vrátí; vypnutí čísla smaže (v datech nic), Ctrl+Z je vrátí', /^\[\[1,2,3\],1,\[4,5,6\]/.test(cv.precisl) && cv.zpetPrec && cv.vyp === '-1|false' && cv.zpetVyp, cv.precisl + ' ' + cv.vyp);

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
  check('starý rozvaděč (RS2): PDF dokumentace beze změny', bezUid(require('./bez-n')(nov.pdf)) === bezUid(require('./bez-n')(star.pdf)), nov.pdf.length + ' / ' + star.pdf.length);

  check('bez chyb v konzoli', !err.length, err.join(' | '));
  await b.close();
  console.log(res.join('\n'));
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.log('❌ SELHALO', e.stack); process.exit(1); });
