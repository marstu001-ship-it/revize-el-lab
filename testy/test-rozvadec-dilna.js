// Čelní pohled „jako v dílně" — fáze 1 (lab v1.64): věrné kresby prvků, propojovací
// hřebeny, průřez a barva vodičů, vývodka. Test hlídá:
//  - každý druh prvku má vlastní kresbu (páčka, tlačítko T, okénko SPD, víčka pojistek,
//    A1/A2 stykače, svorky v barvě funkce, svorkovnice = řada úzkých svorek, mosazná přípojnice,
//    krytka rezervy), stejně na obrazovce i v PDF,
//  - RS2: „Navrhnout hřebeny" → 3 hřebeny s napájecími vodiči, napájení (`nadr`) spočítané
//    přes zapojení po pólech, fáze L1, L2, L3, L1…, materiál (hřebeny, krytky),
//  - hřeben myší: kurzor ↔ na kraji, roztažení přes 5 jističů a zkrácení (napojí / odpojí),
//    posun, strana podle nastavení a přepnutí, krytka klepnutím, Delete, Ctrl+Z,
//  - vodič ze svorky -QH1 na hřeben (tah jako ve vzoru) → fáze podle zubů, Ctrl+Z,
//  - návrh průřezu podle zátěže (40 → 10, 80 → 16, 100 → 25 mm²) a upozornění „nestačí",
//  - průřez a barva vodiče (panel, materiál), vývodka shora / zespodu,
//  - rozvaděč bez hřebenů a vodičů: data bez nových klíčů,
//  - výkon: 150 přístrojů a 10 hřebenů se vykreslí do 200 ms.
// Všechna data vymyšlená.
const { chromium } = require('./pw');
const path = require('path');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => { const t = (ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''); res.push(t); if (process.env.LADIT) console.log(t); };
const w = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: path.join(__dirname, 'knihovny', r.request().url().split('/').pop()), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const p = await ctx.newPage(), err = [];
  p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(URL); await w(1000);
  await p.evaluate('window.__rs2 = ' + require('./rozvadec-rs2.js').toString());
  await p.evaluate(() => {
    STORE.technik = Object.assign({}, STORE.technik, { jmeno: 'Petr Vymyšlený', firma: 'Vymyšlená elektro s.r.o.' }); delete STORE.technik.rz_hreben_strana; saveStore();
    window.__T = {
      w: ms => new Promise(r => setTimeout(r, ms)),
      cist: () => DOK_TYPY.rozv.cist(dokForm()),
      naj: o => { let r = null; __rz.rady.forEach(a => a.prvky.forEach(x => { if (x.ozn === o) r = x; })); return r; },
      videt(el) {
        let bb = el.getBoundingClientRect();
        if (bb.top < 70 || bb.bottom > innerHeight - 50) { window.scrollBy(0, bb.top - innerHeight / 2); bb = el.getBoundingClientRect(); }
        const ram = document.getElementById('rz-svg-ram'), rb = ram.getBoundingClientRect();
        if (bb.left < rb.left + 10 || bb.right > rb.right - 10) { ram.scrollLeft += bb.left - (rb.left + rb.width / 2); bb = el.getBoundingClientRect(); }
        return { x: bb.left + bb.width / 2, y: bb.top + bb.height / 2 };
      },
      mm(x, y) { const M = document.querySelector('#rz-pohled .rz-svg').getScreenCTM(), q = new DOMPoint(x, y).matrixTransform(M); return { x: q.x, y: q.y }; }
    };
  });

  // ── 1. kresby prvků ───────────────────────────────────────────────────
  const kr = await p.evaluate(async () => {
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel'));
    const v = (kid, r) => rozvVlozit(kid, r, __rz.rady[r].prvky.length);
    const qm = v('v-qm-3-63', 0), fa = v('v-fa-1-B16', 0), fi = v('v-fi-4-40-30-A', 0), spd = v('v-spd-2-3N', 0), fu = v('v-fu-3-1038', 0), km = v('v-km-25-2', 0), rez = v('v-rez-2', 0);
    const sv = v('v-x-svork', 1), pn = v('v-x-prip-n', 1), pe = v('v-x-prip-pe', 1), xl = v('v-x-rad-25', 1), xn = v('v-x-rad-25', 1), xp = v('v-x-rad-25', 1);
    xl.faze = 'L1'; xn.funkce = 'N'; xp.funkce = 'PE';
    rozvPohledVykreslit(); await __T.w(50);
    const g = x => document.querySelector('#rz-pohled [data-puid="' + x.uid + '"]');
    const r = {};
    r.druhy = [qm, fa, fi, spd, fu, km, rez, sv, pn, xl].map(x => g(x).getAttribute('data-kresba')).join();
    r.fa = !!g(fa).querySelector('.cp-packa') && g(fa).querySelectorAll('.cp-sroub').length === 2 && !g(fa).querySelector('.cp-tl-T');
    r.fi = !!g(fi).querySelector('.cp-tl-T') && !!g(fi).querySelector('.cp-packa') && g(fi).querySelectorAll('.cp-sroub').length === 8;
    r.qm = (g(qm).querySelector('.cp-packa') || {}).getAttribute && g(qm).querySelector('.cp-packa').getAttribute('fill') === '#b5291c';
    r.spd = g(spd).querySelectorAll('.cp-spd-okno').length === 4 && g(spd).querySelector('.cp-spd-okno').getAttribute('fill') === '#3fa34d';
    r.fu = g(fu).querySelectorAll('.cp-viko').length === 3 && g(fu).querySelectorAll('.cp-vlozka').length === 3;
    r.km = !!g(km).querySelector('.cp-a1') && !!g(km).querySelector('.cp-a2');
    r.rez = !!g(rez).querySelector('.cp-krytka');
    r.svork = g(sv).querySelectorAll('.cp-svorka').length + '|' + !!g(sv).querySelector('.cp-packa') + '|' + g(sv).querySelectorAll('.cp-zarazka').length + '|' + !g(sv).querySelector('.rz-znacka-pruh');
    r.prip = g(pn).querySelectorAll('.cp-izolator').length + '|' + !!g(pn).querySelector('.cp-pripojnice-N') + '|' + (g(pn).querySelector('.cp-pripojnice') || {}).getAttribute('fill') + '|' + !!g(pe).querySelector('.cp-stitek-PE');
    r.svorky = [xl, xn, xp].map(x => (g(x).querySelector('.cp-svorka') || {}).getAttribute('fill')).join() + '|' + !!g(xp).querySelector('.cp-pe-pruh');
    r.sirka = (+g(xl).querySelector('.cp-svorka').getAttribute('width') + 0.3).toFixed(2) + '|' + xl.p.sirkaMm;
    r.text = /-QH1/.test(g(qm).textContent) && /B16/.test(g(fa).textContent) && /40A/.test(g(fi).textContent);
    const t = rozvSvg(__rz, { tisk: true, k: 0.5 });
    r.pdf = /cp-tl-T/.test(t) && /cp-spd-okno/.test(t) && /cp-pripojnice/.test(t) && /data-kresba="X"/.test(t);
    // přepínač funkce svorky ve vlastnostech
    rozvVybrat(xl.uid, false); await __T.w(30);
    const s = document.querySelector('#rz-vlastnosti [data-rp2="funkce"]'); r.volba = !!s;
    if (s) { s.value = 'N'; s.dispatchEvent(new Event('change', { bubbles: true })); await __T.w(30); }
    r.poVolbe = xl.funkce + '|' + (g(xl).querySelector('.cp-svorka') || {}).getAttribute('fill');
    zpetPosledni(); await __T.w(30); r.zpet = String(rozvNajit(xl.uid).x.funkce);
    // dva hlavní pohledy: hustota šroubků podle měřítka
    r.lod = (rozvSvg(__rz, { k: 1.2 }).match(/cp-sroub"/g) || []).length + '<' + (rozvSvg(__rz, { k: 3 }).match(/cp-sroub"/g) || []).length;
    // vývodka shora / zespodu
    r.vyv = /rz-vyvodka-cp/.test(rozvSvg(__rz, { k: 3 })) && /rz-vyvodka-cp/.test(t);
    const yS = +/<g class="rz-vyvodka-cp"[^>]*>(?:<title>[^<]*<\/title>)?<rect x="[\d.]+" y="([\d.]+)"/.exec(rozvSvg({ skrin: __rz.skrin, rady: __rz.rady, privodSmer: 'shora' }, { tisk: true }))[1];
    const yZ = +/<g class="rz-vyvodka-cp"[^>]*>(?:<title>[^<]*<\/title>)?<rect x="[\d.]+" y="([\d.]+)"/.exec(rozvSvg({ skrin: __rz.skrin, rady: __rz.rady, privodSmer: 'zespodu' }, { tisk: true }))[1];
    r.vyvYZ = yS + '|' + yZ + '|' + rozvSvgRozmery(__rz).Hsvg;
    return r;
  });
  check('kresby: každý druh vlastní kresba (data-kresba)', kr.druhy === 'QM,FA,FI,SPD,FU,KM,REZ,X,X,X', kr.druhy);
  check('kresby: jistič s páčkou a šrouby nahoře i dole, bez tlačítka T', kr.fa === true);
  check('kresby: chránič 4P s páčkou a tlačítkem T, šrouby po pólech (8)', kr.fi === true);
  check('kresby: hlavní vypínač s červenou páčkou', kr.qm === true);
  check('kresby: svodič přepětí — 4 výměnné moduly se zeleným okénkem', kr.spd === true);
  check('kresby: pojistkový odpojovač 3P — víčka s okénkem vložky', kr.fu === true);
  check('kresby: stykač se svorkami A1 / A2', kr.km === true);
  check('kresby: rezerva = krytka s rýhou', kr.rez === true);
  check('kresby: svorkovnice 10 ks = řada 10 úzkých svorek se zarážkami, žádná páčka ani pruh výrobce', kr.svork === '10|false|2|true', kr.svork);
  check('kresby: přípojnice N = mosazná lišta, izolátory na koncích, štítek; PE se zelenožlutým štítkem', kr.prip === '2|true|#c9a227|true', kr.prip);
  check('kresby: řadová svorka šedá (fáze), modrá (N), zelenožlutá (PE)', kr.svorky === '#9c9c98,#2f6fd0,#3c9a3c|true', kr.svorky);
  check('kresby: řadová svorka 2,5 mm² má skutečnou šířku (≈ 5,2 mm)', kr.sirka === '5.25|5.2', kr.sirka);
  check('kresby: označení a hodnoty zůstávají čitelné (-QH1, B16, 40A)', kr.text === true);
  check('kresby: PDF čelního pohledu má stejné kresby', kr.pdf === true);
  check('kresby: volba „Svorka je pro" ve vlastnostech, N → modrá, Ctrl+Z vrátí', kr.volba && kr.poVolbe === 'N|#2f6fd0' && kr.zpet === 'undefined', kr.poVolbe + ' ' + kr.zpet);
  check('kresby: při malém měřítku méně šroubků (zjednodušení)', (() => { const [a, c] = kr.lod.split('<').map(Number); return a < c; })(), kr.lod);
  check('vývodka: v pohledu i PDF, shora u horní hrany, zespodu u dolní', kr.vyv && (() => { const [s, z, H] = kr.vyvYZ.split('|').map(Number); return s < 2 && z > H - 5; })(), kr.vyvYZ);

  // ── 2. RS2: Navrhnout hřebeny ─────────────────────────────────────────
  const rs = await p.evaluate(async () => {
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel')); window.__rs2();
    const pred = JSON.stringify(__T.cist().rady);
    rzhNavrhyOtevrit(); await __T.w(30);
    const r = { n: __rzhNavrhy.length, okno: document.getElementById('modal-rz-hrebeny').classList.contains('open'), txt: document.getElementById('rz-hr-obsah').innerText };
    document.getElementById('rz-hr-pouzit').click(); await __T.w(50);
    const d = __T.cist();
    r.heb = (d.hrebeny || []).map(h => h.rada + ':' + h.poly + ':' + h.prurez + ':' + (h.do - h.od) + ':' + h.strana).join(' ');
    r.vod = (d.vodice || []).length;
    const n = __T.naj, nadr = o => { const x = n(o); return x.nadr === '' ? '-QH1' : rzpOzn(x.nadr); };
    r.nadr = ['-FA1', '-FA14', '-FA15', '-FA24', '-FA25', '-FA44'].map(o => o + '<' + nadr(o)).join(' ');
    r.faze = ['-FA1', '-FA2', '-FA3', '-FA4', '-FA5', '-FA25', '-FA26', '-FA27', '-FA28'].map(o => n(o).faze).join(',');
    const S = rzpStav(__rz);
    r.pod = ['-FA1', '-FA14', '-FA23', '-FA44'].every(o => S.vys[n(o).uid].pod);
    r.vstup = S.vys[n('-FA1').uid].vstup;
    r.mat = rzhMaterial(d).join(' | ');
    r.pdf = DOK_TYPY.rozv.pdf(Object.assign({}, d, { dokVyber: { schema: false, tech: false, prohl: false, ko: false } })).map(q => q.html || '').join('');
    r.pdfMat = /Propojovací materiál/.test(r.pdf) && /Propojovací hřeben 3P 10 mm², 14 pólů \(zkrátit z 57\), 1 ks/.test(r.pdf);
    r.pdfHr = (r.pdf.match(/class="rz-hr"/g) || []).length;
    // panel stromu napájení ukazuje FA pod -QH1, ne pod hřebenem
    TD_AKCE.tdRNapRezim(); await __T.w(50);
    r.strom = document.querySelector('#rz-vlastnosti .rz-zap-strom').textContent;
    r.svHr = document.querySelectorAll('#rz-pohled .rz-sv-hr').length;
    TD_AKCE.tdRNapRezim();
    // schéma zapojení čte nadr — FA25 dál pod chráničem
    r.schema = rozvSchemaListy(d).length > 1;
    r.predRady = pred === JSON.stringify(__T.cist().rady.map(x => x)) ? 'stejne' : 'jine';
    return r;
  });
  check('RS2: „Navrhnout hřebeny" najde 3 hřebeny a ukáže okno', rs.n === 3 && rs.okno, rs.n + ' ' + rs.txt.slice(0, 200));
  check('RS2: po potvrzení 3 hřebeny 3P shora s průřezem podle zátěže a 3 napájecí vodiče', rs.heb === '0:3:10:14:nahore 1:3:10:14:nahore 3:3:10:20:nahore' && rs.vod === 3, rs.heb + ' / ' + rs.vod);
  check('RS2: napájení (nadr) spočítané přes hřeben — FA1…FA24 z -QH1, FA25…FA44 z -FI1', rs.nadr === '-FA1<-QH1 -FA14<-QH1 -FA15<-QH1 -FA24<-QH1 -FA25<-FI1 -FA44<-FI1', rs.nadr);
  check('RS2: fáze 1P jističů podle 3P hřebenu L1, L2, L3, L1…', rs.faze === 'L1,L2,L3,L1,L2,L1,L2,L3,L1', rs.faze);
  check('RS2: přístroje na hřebenech pod napětím, vstup shora', rs.pod && rs.vstup === 't', rs.vstup);
  check('RS2: materiál — hřebeny se zkrácením z 57 pólů', /Propojovací hřeben 3P 10 mm², 14 pólů \(zkrátit z 57\), 1 ks/.test(rs.mat) && /20 pólů/.test(rs.mat), rs.mat);
  check('RS2: PDF — hřebeny v čelním pohledu a tabulka „Propojovací materiál"', rs.pdfMat && rs.pdfHr === 3, rs.pdfHr);
  check('RS2: panel „Kdo koho napájí" — jističe pod -QH1 (hřebenem), svorky hřebenů v režimu Zapojení', /└ -FA1…FA22 B10 \[L1,L2,L3\]/.test(rs.strom) && rs.svHr > 40, rs.svHr + ' ' + rs.strom.slice(0, 160));

  // ── 3. hřeben myší ───────────────────────────────────────────────────
  await p.evaluate(async () => {
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-2x24-ocel') || rozvKnihPolozka('v-sk-4x24-ocel'));
    const v = kid => rozvVlozit(kid, 0, __rz.rady[0].prvky.length);
    v('v-qm-3-63'); for (let i = 0; i < 10; i++) v('v-fa-1-B10');
    rozvPrecislovat(); __rz.vyber = null; rozvPohledVykreslit(); rozvVlastnostiVykreslit();
  });
  // nástroj Hřeben: tah myší přes -FA1…FA3
  await p.click('[data-action="tdRHrNastroj"]');
  const tah = await p.evaluate(() => { const g = id => rozvGeom().filter(q => q.uid === __T.naj(id).uid)[0];
    const a = g('-FA1'), c = g('-FA3'); return { a: __T.mm(a.x + 3, a.y + 25), c: __T.mm(c.x + c.w - 3, c.y + 25) }; });
  await p.mouse.move(tah.a.x, tah.a.y); await p.mouse.down(); await p.mouse.move(tah.a.x + 20, tah.a.y, { steps: 3 }); await p.mouse.move(tah.c.x, tah.c.y, { steps: 6 });
  const nahled = await p.evaluate(() => !!(__rz.hrNahled && document.querySelector('#rz-pohled .rz-hr.nahled')));
  await p.mouse.up(); await w(150);
  const h1 = await p.evaluate(() => { const h = __rz.hrebeny[0]; return h ? { od: h.od, do: h.do, poly: h.poly, strana: h.strana, kryte: rzhKryte(h).map(u => rzpOzn(u)).join(), vyb: __rz.hrVyber === h.uid, panel: /Propojovací hřeben/.test(document.getElementById('rz-vlastnosti').textContent), toast: Array.from(document.querySelectorAll('.toast')).map(e => e.textContent).join(' ‖ ') } : null; });
  check('hřeben: nástroj — tah myší přes 3 jističe vytvoří hřeben 1P (náhled během tahu), vybraný s panelem', nahled && h1 && h1.od === 3 && h1.do === 6 && h1.poly === '1' && h1.kryte === '-FA1,-FA2,-FA3' && h1.vyb && h1.panel, JSON.stringify(h1));
  check('hřeben: první hřeben bez nastavení profilu — shora a nabídka „Zespodu?"', h1 && h1.strana === 'nahore' && /zespodu/i.test(h1.toast), h1 && h1.toast);
  await p.click('[data-action="tdRHrNastroj"]');
  // kurzor ↔ na kraji, roztažení přes 5 dalších jističů
  const kraj = await p.evaluate(() => { const el = document.querySelector('#rz-pohled .rz-hr [data-hr-kraj="P"]'); return Object.assign(__T.videt(el), { cur: getComputedStyle(el).cursor }); });
  await p.mouse.move(kraj.x, kraj.y); await w(50);
  const hov = await p.evaluate(() => { const el = document.querySelector('#rz-pohled .rz-hr [data-hr-kraj="P"]'); return getComputedStyle(el).fillOpacity; });
  const cil = await p.evaluate(() => { const g = rozvGeom().filter(q => q.uid === __T.naj('-FA8').uid)[0]; return __T.mm(g.x + g.w - 1, g.y - 2.4); });
  await p.mouse.down(); await p.mouse.move(kraj.x + 15, kraj.y, { steps: 3 }); await p.mouse.move(cil.x, kraj.y, { steps: 8 });
  const bub = await p.evaluate(() => (document.getElementById('rz-nap-stitek') || {}).textContent || '');
  await p.mouse.up(); await w(150);
  const h2 = await p.evaluate(() => { const h = __rz.hrebeny[0], S = rzpStav(__rz); return { n: h.do - h.od, kryte: rzhKryte(h).length, nadr: ['-FA4', '-FA8'].map(o => String(__T.naj(o).nadrRucne)).join(), pod: S.vys[__T.naj('-FA8').uid].pod }; });
  check('hřeben: na kraji kurzor ↔ (ew-resize) a zvýrazněný úchyt', kraj.cur === 'ew-resize' && +hov > 0.4, kraj.cur + ' ' + hov);
  check('hřeben: tažením kraje přes 5 dalších jističů 8 pólů, přístroje napojené (bublina pólů)', h2.n === 8 && h2.kryte === 8 && h2.nadr === 'true,true' && h2.pod && /8 pólů/.test(bub), JSON.stringify(h2) + ' ' + bub);
  // zkrácení zpět → odkryté jističe zpátky na automatiku
  const k2 = await p.evaluate(() => { const el = document.querySelector('#rz-pohled .rz-hr [data-hr-kraj="P"]'); const v = __T.videt(el); const g = rozvGeom().filter(q => q.uid === __T.naj('-FA3').uid)[0]; return { v, c: __T.mm(g.x + g.w - 1, g.y - 2.4) }; });
  await p.mouse.move(k2.v.x, k2.v.y); await p.mouse.down(); await p.mouse.move(k2.v.x - 15, k2.v.y, { steps: 3 }); await p.mouse.move(k2.c.x, k2.v.y, { steps: 8 }); await p.mouse.up(); await w(150);
  const h3 = await p.evaluate(() => { const h = __rz.hrebeny[0]; return { n: h.do - h.od, auto: ['-FA4', '-FA8'].map(o => String(__T.naj(o).nadrRucne)).join(), fa3: String(__T.naj('-FA3').nadrRucne) }; });
  check('hřeben: zkrácením se odkryté jističe odpojí (zpátky na automatiku)', h3.n === 3 && h3.auto === 'false,false' && h3.fa3 === 'true', JSON.stringify(h3));
  await p.keyboard.press('Control+z'); await w(100);
  const z1 = await p.evaluate(() => __rz.hrebeny[0].do - __rz.hrebeny[0].od);
  check('hřeben: Ctrl+Z vrátí délku před zkrácením', z1 === 8, z1);
  // posun za tělo o 2 moduly
  const telo = await p.evaluate(() => __T.videt(document.querySelector('#rz-pohled .rz-hr .rz-hr-telo')));
  await p.mouse.move(telo.x, telo.y); await p.mouse.down(); await p.mouse.move(telo.x + 20, telo.y, { steps: 3 });
  const posun = await p.evaluate(() => { const svg = document.querySelector('#rz-pohled .rz-svg'); return svg.getScreenCTM().a * RZG.M * 2; });
  await p.mouse.move(telo.x + posun, telo.y, { steps: 6 }); await p.mouse.up(); await w(150);
  const h4 = await p.evaluate(() => __rz.hrebeny[0].od + '-' + __rz.hrebeny[0].do);
  check('hřeben: posun za tělo o 2 moduly', h4 === '5-13', h4);
  // klepnutí na zub vybraného hřebenu = krytka
  await p.evaluate(() => { __rz.hrVyber = __rz.hrebeny[0].uid; rozvSvgPrekreslit(); rozvVlastnostiVykreslit(); });
  const zub = await p.evaluate(() => __T.videt(document.querySelector('#rz-pohled .rz-hr .rz-hr-zubhit[data-zub="1"]')));
  await p.mouse.click(zub.x, zub.y); await w(100);
  const kry = await p.evaluate(() => ({ k: JSON.stringify(__rz.hrebeny[0].krytky), mat: rzhMaterial(__T.cist()).join(), zub: !!document.querySelector('#rz-pohled .rz-hr .rz-hr-krytka[data-zub="1"]') }));
  check('hřeben: klepnutí na zub vybraného hřebenu dá krytku (materiál: krytky 1 ks)', kry.k === '[1]' && kry.zub && /krytky 1 ks/.test(kry.mat), JSON.stringify(kry));
  // strana: nastavení a přepnutí (S), kontextová nabídka
  await p.keyboard.press('s'); await w(80);
  const st = await p.evaluate(() => { const h = __rz.hrebeny[0]; const g = rzhGeom(h); return h.strana + '|' + (g.by > g.y + RZG.H - 1) + '|' + rzhKontext(h.uid).map(q => q.popis).join(';'); });
  check('hřeben: klávesa S přepne zespodu (kreslí se pod přístroji), kontextová nabídka Přepnout / 3P / Průřez / Smazat', /^dole\|true\|Přepnout nahoru;1P → 3P;Průřez 10 mm²/.test(st) && /Smazat hřeben/.test(st), st);
  await p.evaluate(() => rzhStranaNastavit('dole', false));
  const st2 = await p.evaluate(() => { const h = rzhNovy(0, 0, 3, '3'); return h.strana + '|' + STORE.technik.rz_hreben_strana; });
  check('hřeben: nastavení „Hřebeny osazuji: zespodu" se pamatuje v profilu a nový hřeben ho převezme', st2 === 'dole|dole', st2);
  await p.evaluate(() => rzhStranaNastavit('nahore', false));
  // Delete smaže, Ctrl+Z vrátí
  await p.evaluate(() => { __rz.hrVyber = __rz.hrebeny[0].uid; rozvSvgPrekreslit(); });
  await p.keyboard.press('Delete'); await w(80);
  const del = await p.evaluate(() => (__rz.hrebeny || []).length + '|' + String(__T.naj('-FA6').nadrRucne));
  await p.keyboard.press('Control+z'); await w(80);
  const del2 = await p.evaluate(() => (__rz.hrebeny || []).length);
  check('hřeben: Delete smaže (přístroje zpátky na automatiku), Ctrl+Z vrátí', del === '0|false' && del2 === 1, del + ' ' + del2);

  // ── 4. vodič ze svorky -QH1 na hřeben (tah jako ve vzoru) ─────────────
  await p.evaluate(() => {
    __rz.hrVyber = __rz.hrebeny[0].uid; rozvVlastnostiVykreslit();
    const s = document.querySelector('#rz-vlastnosti [data-hr-pole="poly"]'); s.value = '3'; s.dispatchEvent(new Event('change', { bubbles: true }));
    TD_AKCE.tdRNapRezim();
  });
  await w(100);
  const body = await p.evaluate(() => ({ a: __T.videt(document.querySelector('#rz-pohled [data-sv="' + __T.naj('-QH1').uid + '|b|0"]')), c: __T.videt(document.querySelector('#rz-pohled .rz-sv-hr')) }));
  await p.mouse.move(body.a.x, body.a.y); await p.mouse.down(); await p.mouse.move(body.a.x + 10, body.a.y + 10, { steps: 3 }); await p.mouse.move(body.c.x, body.c.y, { steps: 10 });
  const bub2 = await p.evaluate(() => (document.getElementById('rz-nap-stitek') || {}).textContent || '');
  await p.mouse.up(); await w(150);
  const vd = await p.evaluate(() => {
    const S = rzpStav(__rz), h = __rz.hrebeny[0], w0 = (__rz.vodice || [])[0];
    return { w: w0 ? w0.a.uid === __T.naj('-QH1').uid && w0.b.uid === h.uid && w0.b.strana === 'h' && w0.n === 3 : false,
      faze: ['-FA5', '-FA6', '-FA7', '-FA8', '-FA9'].map(o => __T.naj(o).faze).join(','), pod: rzhKryte(h).every(u => S.vys[u].pod),
      zdroj: rzhZdroj(h, S) === __T.naj('-QH1').uid };
  });
  check('vodič -QH1 → hřeben: bublina předem, svazek 3f na sběrnici hřebenu', vd.w && /hřeben|3f/.test(bub2), bub2);
  check('vodič -QH1 → hřeben: všechny přístroje na hřebenu pod napětím, fáze podle zubů (-FA5…FA9 = zuby 3–7: L3, L1, L2, L3, L1; zub 2 má krytku)', vd.pod && vd.zdroj && vd.faze === 'L3,L1,L2,L3,L1', vd.faze);
  await p.keyboard.press('Control+z'); await w(100);
  const vz = await p.evaluate(() => (__rz.vodice || []).length + '|' + (rzhZdroj(__rz.hrebeny[0], rzpStav(__rz)) === __T.naj('-QH1').uid));
  check('vodič → hřeben: Ctrl+Z vodič vrátí (hřeben dál napájený automaticky ze společného zdroje)', vz === '0|true', vz);
  await p.evaluate(() => { TD_AKCE.tdRNapRezim(); });

  // ── 5. zátěž a průřez ────────────────────────────────────────────────
  const zt = await p.evaluate(async () => {
    const r = { navrh: [40, 63, 80, 100, 125].map(i => rzhNavrhPrurez(i).prurez).join() };
    const h = __rz.hrebeny[0], qh = __T.naj('-QH1');
    rozvZmena('In', () => { qh.p.In = 80; });
    const k = rzhKontroly(h).map(q => q.t + (q.prurez ? ' [' + q.prurez + ']' : '')).join(' | ');
    r.k = k;
    __rz.hrVyber = h.uid; rozvVlastnostiVykreslit(); await __T.w(30);
    const b = document.querySelector('#rz-vlastnosti .rz-hr-upoz [data-action="tdRHrPrurez"]'); r.btn = !!b; if (b) b.click(); await __T.w(30);
    r.po = __rz.hrebeny[0].prurez + '|' + rzhKontroly(__rz.hrebeny[0]).filter(q => /nestačí/.test(q.t)).length;
    r.panel = document.getElementById('rz-vlastnosti').textContent;
    return r;
  });
  check('průřez: návrh podle zátěže 40 → 10, 63 → 10, 80 → 16, 100 → 25 mm² (125 A → 25 a nestačí)', zt.navrh === '10,10,16,25,25', zt.navrh);
  check('průřez: hřeben 10 mm² napájený z 80 A → upozornění „nestačí – navrhuji 16 mm²" a Použít', /Hřeben 10 mm² nestačí pro zátěž 80 A – navrhuji 16 mm² \[16\]/.test(zt.k) && zt.btn && zt.po === '16|0', zt.k + ' / ' + zt.po);
  check('průřez: panel ukazuje zátěž a zdroj (vypínač -QH1 80 A)', /zátěž 80 A \(vypínač -QH1 80 A\)/.test(zt.panel), zt.panel.slice(0, 300));

  // ── 6. kontroly: chránič + jističe, 3P přístroj na 1P hřebenu, N pod fázovým zubem ──
  const ko = await p.evaluate(async () => {
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel'));
    const v = (kid) => rozvVlozit(kid, 0, __rz.rady[0].prvky.length);
    v('v-qm-3-63'); const fi = v('v-fi-4-40-30-A'); v('v-fa-1-B16'); v('v-fa-3-B25'); const ff = v('v-fifa-1N-B16-30-A') || v('v-afdd-1N-B16');
    rozvPrecislovat();
    const h = rzhNovy(0, 3, 3 + 4 + 1 + 3 + 2, '1');
    rozvZmena('h', () => { __rz.hrebeny = [h]; });
    return rzhKontroly(h).map(q => q.t).join(' | ');
  });
  check('kontroly: chránič s jističi (typ hřebenu), 3P jistič na 1P hřebenu, pól N pod fázovým zubem', /chránič \+ jističe/.test(ko) && /trojfázový na jednofázovém/.test(ko) && /pól N/.test(ko), ko);

  // ── 7. průřez a barva vodiče, materiál ───────────────────────────────
  const vod = await p.evaluate(async () => {
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel'));
    const v = (kid) => rozvVlozit(kid, 0, __rz.rady[0].prvky.length);
    const qh = v('v-qm-3-63'), fu = v('v-fu-3-1038'); rozvPrecislovat();
    const w0 = { uid: rzpVodicUid(), a: { uid: qh.uid, strana: 'b', pol: 0 }, b: { uid: fu.uid, strana: 't', pol: 0 }, n: 3 };
    rozvZmena('w', () => { __rz.vodice = [w0]; });
    TD_AKCE.tdRNapRezim(); __rz.napVodic = w0.uid; rozvVlastnostiVykreslit(); await __T.w(30);
    const s = document.querySelector('#rz-vlastnosti [data-w-pole="prurez"]'), r = { navrh: s ? s.options[0].textContent : '' };
    s.value = '10'; s.dispatchEvent(new Event('change', { bubbles: true })); await __T.w(30);
    r.data = JSON.stringify(__T.cist().vodice[0]);
    r.mat = rzvMaterial(__T.cist()).join(' | ');
    const sb = document.querySelector('#rz-vlastnosti [data-w-pole="barva"]'); sb.value = 'cerna'; sb.dispatchEvent(new Event('change', { bubbles: true })); await __T.w(30);
    r.mat2 = rzvMaterial(__T.cist()).join(' | ');
    r.kresba = Array.from(document.querySelectorAll('#rz-pohled .rz-wire .rz-w')).map(c => c.getAttribute('stroke')).join();
    TD_AKCE.tdRNapRezim();
    return r;
  });
  check('vodič: návrh průřezu podle In zdroje (63 A → 10 mm²), zadaný průřez se uloží', /návrh 10 mm² \(63 A\)/.test(vod.navrh) && /"prurez":"10"/.test(vod.data), vod.navrh + ' ' + vod.data);
  check('vodič: materiál „Vodič H07V-K 10 mm² hnědý / černý / šedý – propojky 1 ks"', vod.mat === 'Vodič H07V-K 10 mm² hnědý – propojky 1 ks | Vodič H07V-K 10 mm² černý – propojky 1 ks | Vodič H07V-K 10 mm² šedý – propojky 1 ks', vod.mat);
  check('vodič: zadaná barva platí pro celý svazek (materiál i kresba)', vod.mat2 === 'Vodič H07V-K 10 mm² černý – propojky 3 ks' && vod.kresba === '#1c1c1c,#1c1c1c,#1c1c1c', vod.mat2 + ' ' + vod.kresba);

  // ── 8. knihovna, staré rozvaděče ──────────────────────────────────────
  const kn = await p.evaluate(async () => {
    const it = rozvKnihPolozka('v-hreben-3-16'), r = { it: it ? it.kat + '|' + rozvPrislTyp(it) + '|' + it.poly : '' };
    r.prislNe = rozvPrislNabidka({ p: { kat: 'FA', rada: '' } }).some(x => rozvPrislTyp(x) === 'hreben');
    r.vsech = rozvKnihovnaVse().filter(x => rozvPrislTyp(x) === 'hreben').length;
    r.csv = rozvPrislTypZTextu('hreben', 'PRISL') + '|' + rozvPrislTypZTextu('propojovací hřeben', 'PRISL');
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel'));
    rozvVlozit('v-qm-3-63', 0, 0); rozvVlozit('v-fa-1-B10', 0, 1); rozvVlozit('v-fa-1-B10', 0, 2);
    const d = __T.cist(); r.klice = ('hrebeny' in d) + '|' + ('vodice' in d) + '|' + JSON.stringify(d.rady).indexOf('funkce');
    // hřeben z knihovny přes vybrané přístroje
    rozvVyberNastavit(__rz.rady[0].prvky.slice(1).map(x => x.uid)); rozvVlozit('v-hreben-3-16', 0, 0);
    r.zKnih = (__rz.hrebeny || []).map(h => h.poly + ':' + h.prurez + ':' + (h.do - h.od)).join();
    return r;
  });
  check('knihovna: obecné hřebeny 1P / 3P 10 / 16 / 25 mm² a 1P+N / 3P+N (PRISL, druh hreben), import CSV pozná „hreben"', kn.it === 'PRISL|hreben|3' && kn.vsech === 8 && kn.csv === 'hreben|hreben', JSON.stringify(kn));
  check('knihovna: hřeben se nenabízí jako příslušenství přístroje; z knihovny přes vybrané → hřeben 3P 16 mm²', kn.prislNe === false && kn.zKnih === '3:16:2', kn.zKnih);
  check('starý / nový rozvaděč bez hřebenů a vodičů: data bez nových klíčů', kn.klice === 'false|false|-1', kn.klice);

  // ── 9. výkon: 150 přístrojů a 10 hřebenů ─────────────────────────────
  const vy = await p.evaluate(async () => {
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-12x24-stoj'));
    for (let r = 0; r < 12; r++) for (let i = 0; i < (r < 6 ? 13 : 12); i++) if (rozvPrvkyVse(__rz.rady).length < 150) { const x = { uid: 'p' + r + '_' + i, knih: 'v-fa-1-B16', p: dokKopie(rozvKnihPolozka('v-fa-1-B16')), ozn: '-FA' + (r * 13 + i + 1), vyvod: 'Obvod ' + i, faze: '', kabel: '', prurez: '' }; __rz.rady[r].prvky.push(x); }
    __rz.hrebeny = []; for (let r = 0; r < 10; r++) __rz.hrebeny.push(rzhNovy(r, 0, 12, '3'));
    rozvZmena('x', () => {});
    const n = rozvPrvkyVse(__rz.rady).length, t = [];
    for (let i = 0; i < 4; i++) { const t0 = performance.now(); rozvPohledVykreslit(); t.push(performance.now() - t0); }
    return { n, h: __rz.hrebeny.length, t: Math.min.apply(null, t.slice(1)), tt: t.map(x => Math.round(x)).join('/') };
  });
  check('výkon: 150 přístrojů a 10 hřebenů se vykreslí do 200 ms', vy.n === 150 && vy.h === 10 && vy.t < 200, vy.n + ' přístrojů, ' + vy.tt + ' ms');

  check('bez chyb v konzoli', !err.length, err.join(' | '));
  await b.close();
  console.log(res.join('\n'));
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.log('❌ SELHALO', e.stack); process.exit(1); });
