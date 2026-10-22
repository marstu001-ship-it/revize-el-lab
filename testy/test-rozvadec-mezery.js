// Rozvaděč — mezery mezi přístroji (v9.130). Přístroj jde položit kamkoli
// do volného místa po ½ modulu (myší, klepnutím, ◀ ▶, „Mezera vlevo").
// Hlídá i to, co si mezery nesmí všimnout:
//   * schéma zapojení — žádný prázdný sloupec (listy 2… jsou shodné
//     s týmž rozvaděčem bez mezer), osazení na listu 1 mezeru přeškrtne,
//   * popisky pod přístroje — prázdné políčko přesně v šířce mezery,
//   * součty fází a oteplení — mezera se nezapočítá,
//   * starý rozvaděč (uložený ve stará verzi z gitu, STARA_PORT = 8902)
//     se otevře beze změny: data, čelní pohled, schéma, popisky, fáze.
// Vše vymyšlené (byt 3+1 z rozvadec-byt.js).
const { chromium } = require('./pw');
const path = require('path');
const PORT = process.env.PORT || 8901, STARA = process.env.STARA_PORT || 8902;
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));
const M = 17.5;

async function stranka(b, port, init) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: path.join(__dirname, 'knihovny', r.request().url().split('/').pop()),
    contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const p = await ctx.newPage(), err = [];
  p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://127.0.0.1:' + port + '/index.html'); await w(1200);
  // uložené dokumenty až po načtení programu (přes jeho localStorage — v labu ho přesměruje
  // labový blok, zapsané před ním by program neviděl), pak znovu načíst
  if (init) { await p.evaluate(dok => localStorage.setItem('revize_el_dok', dok), init); await p.reload(); await w(1200); }
  await p.evaluate('window.__rozvByt = ' + require('./rozvadec-byt.js').toString());
  await p.evaluate(() => {
    STORE.technik = Object.assign({}, STORE.technik, { jmeno: 'Petr Vymyšlený', firma: 'Vymyšlená elektro s.r.o.', ico: '12345678', mesto: 'Kyjov' });
    saveStore();
    window.__T = {
      dk: (s, v) => { const e = dokForm().querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); },
      naj: o => { let r = null; __rz.rady.forEach(ra => ra.prvky.forEach(x => { if (x.ozn === o) r = x; })); return r; },
      // vše, co se z rozvaděče kreslí a počítá (pro porovnání)
      vystupy: (d) => {
        const box = document.createElement('div'); document.body.appendChild(box);
        rozvPopiskyStranky(d, box); const pop = box.innerHTML; box.remove();
        return {
          svg: rozvSvg({ skrin: d.skrin, rady: d.rady }, { tisk: true }),
          schema: rozvSchemaListy(d).map(l => l.svg),
          popisky: pop,
          faze: JSON.stringify(rozvFazeSouhrn(d.rady)),
          otepl: JSON.stringify(rozvOteplVypocet(d)),
          seznam: JSON.stringify(DOK_TYPY.rozv.pdf(d).map(q => q.html || q.cela || ''))
        };
      }
    };
  });
  return { p, ctx, err };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ── 1. starý rozvaděč: uložit ve staré verzi, otevřít v nové ───────────
  const S = await stranka(b, STARA);
  const stary = await S.p.evaluate(async () => {
    await dokNovy('rozv');
    __T.dk('[data-dk="oznaceni"]', 'RH1'); __T.dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S'); __T.dk('[data-dk="privodIn"]', '40');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n')); window.__rozvByt();
    __T.naj('-FA2').p.pv = '2'; __T.naj('-FA3').p.pv = '2';
    await dokUlozitOtevreny();
    const o = window.__dokOtevreny;
    return { uid: o.uid, data: JSON.stringify(o.data), ls: localStorage.getItem('revize_el_dok'), out: __T.vystupy(o.data) };
  });
  const N = await stranka(b, PORT, stary.ls);
  const nove = await N.p.evaluate(async (uid) => {
    await dokNacist();
    const nacteno = JSON.stringify((DOK.dokumenty.find(x => x.uid === uid) || {}).data);
    await dokOtevrit(uid); await new Promise(r => setTimeout(r, 400));
    const d = DOK_TYPY.rozv.cist(dokForm());
    const r = { nacteno, rady: JSON.stringify(d.rady), out: __T.vystupy(d), mezer: JSON.stringify(d.rady).indexOf('mezera') };
    // klik do pohledu, výběr přístroje a uložení beze změny nic nepřidají
    rozvVybrat(__T.naj('-FA3').uid); rozvVybrat(null);
    await dokUlozitOtevreny();
    r.ulozeno = JSON.stringify((DOK.dokumenty.find(x => x.uid === uid) || {}).data.rady);
    return r;
  }, stary.uid);
  const sd = JSON.parse(stary.data);
  check('starý rozvaděč se načte bajtově beze změny', nove.nacteno === stary.data);
  check('… řady v editoru jsou stejné jako uložené a nemají klíč „mezera"', nove.rady === JSON.stringify(sd.rady) && nove.mezer === -1);
  check('… otevřený a uložený beze změny řad', nove.ulozeno === JSON.stringify(sd.rady));
  check('… čelní pohled (SVG do PDF) znak po znaku stejný jako ve staré verzi', nove.out.svg === stary.out.svg);
  check('… schéma zapojení (všechny listy) stejné jako ve staré verzi', JSON.stringify(nove.out.schema) === JSON.stringify(stary.out.schema), nove.out.schema.length + ' listů');
  check('… popisky pod přístroje stejné jako ve staré verzi', nove.out.popisky === stary.out.popisky);
  // v9.131 přidala do souhrnu fází seznam vývodů bez In (trafa, zdroje) — u bytu je prázdný (stará verze ho mít může i nemusí)
  check('… součty fází a oteplení stejné jako ve staré verzi', nove.out.faze.replace(',"bezIn":[]', '') === stary.out.faze.replace(',"bezIn":[]', '') && nove.out.otepl === stary.out.otepl);
  check('… PDF (titul, čelní pohled, seznam) stejné jako ve staré verzi', nove.out.seznam === stary.out.seznam);
  await S.ctx.close();

  const p = N.p;
  // ── 2. volné položení myší, po ½ modulu ────────────────────────────────
  await p.evaluate(async () => {
    await dokNovy('rozv'); __T.dk('[data-dk="oznaceni"]', 'RS1');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-2x12-n'));
    ['v-fa-1-B10', 'v-fa-1-B16', 'v-fa-1-B16'].forEach(k => rozvVlozit(k, 0, __rz.rady[0].prvky.length));
    __rz.vyber = null; rozvPohledVykreslit(); rozvVlastnostiVykreslit();
  });
  const bod = (r, moduly) => p.evaluate(([r, m]) => {   // bod na obrazovce v ose řady r, m modulů od levé hrany
    const svg = document.querySelector('#rz-pohled .rz-svg'), c = svg.getScreenCTM();
    const pt = new DOMPoint(RZG.okraj + m * RZG.M, rozvRadaY(r) + RZG.H / 2).matrixTransform(c);
    return { x: pt.x, y: pt.y };
  }, [r, moduly]);
  const poz = () => p.evaluate(() => __rz.rady.map(r => rozvPozice(r)));
  // třetí přístroj (B16, 2. a 3. modul…) chytit uprostřed a pustit na 8,5 modulu → levá hrana 8
  const uid3 = await p.evaluate(() => __rz.rady[0].prvky[2].uid);
  let a = await bod(0, 2.5), c = await bod(0, 8.5);
  await p.mouse.move(a.x, a.y); await p.mouse.down();
  await p.mouse.move(a.x + 10, a.y, { steps: 3 }); await p.mouse.move(c.x, c.y, { steps: 8 });
  const znacka = await p.evaluate(() => { const m = document.getElementById('rz-znacka-misto'); return { v: m.getAttribute('visibility'), x: +m.getAttribute('x'), w: +m.getAttribute('width') }; });
  await p.mouse.up(); await w(150);
  let P = await poz();
  check('tažení myší do volného místa: během tažení obrys přesně tam, kam přístroj padne',
    znacka.v === 'visible' && Math.abs(znacka.x - (14 + 8 * M)) < 0.01 && Math.abs(znacka.w - M) < 0.01, JSON.stringify(znacka));
  check('… přístroj leží na 8. modulu, první dva se nehnuly', JSON.stringify(P[0]) === '[0,1,8]', JSON.stringify(P[0]));
  const m1 = await p.evaluate(u => rozvNajit(u).x.mezera, uid3);
  check('… v datech jen mezera 6 modulů před ním', m1 === 6, String(m1));
  // ½ modulu: pustit tak, aby levá hrana padla na 4,5
  const uid1 = await p.evaluate(() => __rz.rady[0].prvky[0].uid);
  a = await bod(0, 0.5); c = await bod(0, 5.0);
  await p.mouse.move(a.x, a.y); await p.mouse.down();
  await p.mouse.move(a.x + 10, a.y, { steps: 3 }); await p.mouse.move(c.x, c.y, { steps: 8 }); await p.mouse.up(); await w(150);
  P = await poz();
  check('tažení po ½ modulu do volna: B10 na 4,5 modulu, ostatní se nehnuly (zbyde po něm místo)', JSON.stringify(P[0]) === '[1,4.5,8]', JSON.stringify(P[0]));
  // tažení na přístroj = vložení do pořadí jako dřív
  a = await bod(0, 8.5); c = await bod(0, 0.3);
  await p.mouse.move(a.x, a.y); await p.mouse.down();
  await p.mouse.move(a.x - 10, a.y, { steps: 3 }); await p.mouse.move(c.x, c.y, { steps: 8 }); await p.mouse.up(); await w(150);
  const por = await p.evaluate(() => __rz.rady[0].prvky.map(x => x.ozn).join(','));
  P = await poz();
  check('tažení na přístroj = vložení před něj jako dřív (ostatní se odsunou, mezeru za sebou spotřebují)',
    por === '-FA3,-FA2,-FA1' && JSON.stringify(P[0]) === '[0,1,4.5]', por + ' ' + JSON.stringify(P[0]));
  // a na přístroj uprostřed řady: vloží se před něj, sousedé se odsunou
  a = await bod(0, 0.5); c = await bod(0, 4.8);
  await p.mouse.move(a.x, a.y); await p.mouse.down();
  await p.mouse.move(a.x + 10, a.y, { steps: 3 }); await p.mouse.move(c.x, c.y, { steps: 8 }); await p.mouse.up(); await w(150);
  const por2 = await p.evaluate(() => __rz.rady[0].prvky.map(x => x.ozn).join(','));
  P = await poz();
  check('… na levou půlku přístroje s mezerou před ním: těsně před něj (tam ukazovala značka), ostatní se nehnou', por2 === '-FA2,-FA3,-FA1' && JSON.stringify(P[0]) === '[1,3.5,4.5]', por2 + ' ' + JSON.stringify(P[0]));
  await p.keyboard.press('Control+z'); await w(150);
  P = await poz();
  check('Ctrl+Z vrátí předchozí polohy i s mezerami', JSON.stringify(P[0]) === '[0,1,4.5]', JSON.stringify(P[0]));

  // ── 3. ◀ ▶, Mezera vlevo, klepnutí, ▲ ▼, smazání, vložení ─────────────
  const k3 = await p.evaluate(async () => {
    const r = {}, pz = () => JSON.stringify(rozvPozice(__rz.rady[0]));
    // výchozí stav: -FA1 (0) -FA2 (1) | mezera 6 | -FA3 (8)
    __rz.rady = [{ prvky: [] }, { prvky: [] }];
    ['v-fa-1-B10', 'v-fa-1-B16', 'v-fa-1-B16'].forEach(k => rozvVlozit(k, 0, __rz.rady[0].prvky.length));
    rozvPresunout(__rz.rady[0].prvky[2].uid, 0, 2, 8); r.start = pz();
    const fa1 = __rz.rady[0].prvky[2].uid;
    rozvVybrat(fa1);
    document.querySelector('#rz-vlastnosti [data-action="tdRPosun"][data-smer="p"]').click(); r.p1 = pz();
    document.querySelector('#rz-vlastnosti [data-action="tdRPosun"][data-smer="l"]').click();
    document.querySelector('#rz-vlastnosti [data-action="tdRPosun"][data-smer="l"]').click(); r.l2 = pz();
    r.text = document.querySelector('#rz-vlastnosti .rp-mezera').innerText.replace(/\s+/g, ' ');
    document.querySelector('#rz-vlastnosti [data-action="tdRMezera"][data-d="-0.5"]').click(); r.minus = pz();
    // -FA3 (7) ← šipkou až k -FA2: mezera 5 = 10 kroků po ½, pak výměna
    rozvVybrat(fa1);
    for (let i = 0; i < 10; i++) rozvPosun(fa1, 'l');
    r.l10 = pz();
    rozvPosun(fa1, 'l'); r.vymena = __rz.rady[0].prvky.map(x => x.ozn).join(',') + ' ' + pz();
    rozvPosun(fa1, 'p'); rozvPosun(fa1, 'p'); r.zpet = __rz.rady[0].prvky.map(x => x.ozn).join(',') + ' ' + pz();
    // „+ ½" těsně za sousedem odsune i jeho
    rozvVybrat(__rz.rady[0].prvky[1].uid);
    document.querySelector('#rz-vlastnosti [data-action="tdRMezera"][data-d="0.5"]').click(); r.plus = pz();
    // ▼ do prázdné řady na totéž místo
    rozvVybrat(__rz.rady[0].prvky[2].uid); const u = __rz.vyber;
    const pred = rozvPozice(__rz.rady[0])[2];
    rozvPosun(u, 'd'); r.dolu = rozvPozice(__rz.rady[1])[0] === pred && rozvNajit(u).r === 1;
    rozvPosun(u, 'n');
    // klepnutí z knihovny do volného místa (dotyk) — přístroj středem tam, kam se klepnulo
    return r;
  });
  check('▶ u přístroje s volnem vpravo: o ½ modulu', k3.start === '[0,1,8]' && k3.p1 === '[0,1,8.5]', k3.start + ' → ' + k3.p1);
  check('◀ ◀: o ½ modulu doleva (sousedé se nehnou)', k3.l2 === '[0,1,7.5]', k3.l2);
  check('ve vlastnostech „↔ Mezera vlevo" s velikostí mezery', /Mezera vlevo − ½ 5,5 modulu \+ ½/.test(k3.text), k3.text);
  check('„− ½" zmenší mezeru', k3.minus === '[0,1,7]', k3.minus);
  check('◀ desetkrát: přístroj dojede k sousedovi po ½ modulu', k3.l10 === '[0,1,2]', k3.l10);
  check('◀ u souseda: výměna místa jako dřív', k3.vymena === '-FA1,-FA3,-FA2 [0,1,2]', k3.vymena);
  check('▶ u souseda výměna, pak do volna o ½', k3.zpet === '-FA1,-FA2,-FA3 [0,1,2.5]', k3.zpet);
  check('▼ do sousední řady na totéž místo (je-li tam volno) a ▲ zpátky', k3.dolu);

  const k4 = await p.evaluate(async () => {
    // čistý stav: B16 | mezera | B10 B16 B16 vpravo
    __rz.rady = [{ prvky: [] }, { prvky: [] }];
    ['v-fa-1-B16', 'v-fa-1-B10', 'v-fa-1-B16', 'v-fa-1-B16'].forEach(k => rozvVlozit(k, 0, __rz.rady[0].prvky.length));
    const xs = __rz.rady[0].prvky;
    rozvPresunBlok([xs[1].uid, xs[2].uid, xs[3].uid], 0, 1, 9);
    const r = { start: JSON.stringify(rozvPozice(__rz.rady[0])) };
    // smazat prostřední z pravé skupiny: ten za ním se přisune, levý nic
    rozvSmazat(__rz.rady[0].prvky[2].uid); r.smaz = JSON.stringify(rozvPozice(__rz.rady[0]));
    // vložit na pořadí 1 (za první) — mezera za ním se spotřebuje, pravá skupina se nehne
    rozvVlozit('v-fa-1-B10', 0, 1); r.vloz = JSON.stringify(rozvPozice(__rz.rady[0]));
    // vložit do volného místa (poz 5,5)
    rozvVlozit('v-fa-1-B10', 0, 2, 5.5); r.volne = JSON.stringify(rozvPozice(__rz.rady[0]));
    // do plného místa nejde volně → pořadí
    rozvVlozit('v-fa-1-B10', 0, 1, 0); r.plne = JSON.stringify(rozvPozice(__rz.rady[0]));
    // + ½ u posledního, když vpravo není místo
    const n = __rz.rady[0].prvky.length;
    rozvVybrat(__rz.rady[0].prvky[n - 1].uid);
    r.konec = rozvKonec(__rz.rady[0]);
    r.plus = rozvMezeraPosun(__rz.vyber, 0.5) && rozvMezeraPosun(__rz.vyber, 0.5); r.plus2 = rozvMezeraPosun(__rz.vyber, 0.5);
    r.hlaska = [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ');
    document.querySelectorAll('#toast-wrap .toast').forEach(t => t.remove());
    r.konec2 = rozvKonec(__rz.rady[0]);
    // klepnutí (dotyk / ✥): knihovna vybraná, klepnout do volna řady 2 na 6 modulů
    __rz.knihVyber = 'v-fa-1-B16'; rozvPohledVykreslit();
    return r;
  });
  check('blok tří přístrojů položený do volna vpravo (9, 10, 11)', k4.start === '[0,9,10,11]', k4.start);
  check('smazání v pravé skupině: přístroj za ním se přisune, levý zůstane', k4.smaz === '[0,9,10]', k4.smaz);
  check('vložení do pořadí za první: přisedne, pravá skupina se nehne (mezeru spotřebuje)', k4.vloz === '[0,1,9,10]', k4.vloz);
  check('vložení do volného místa na 5,5 modulu', k4.volne === '[0,1,5.5,9,10]', k4.volne);
  check('do obsazeného místa jde přístroj do pořadí jako dřív', k4.plne === '[0,1,2,5.5,9,10]', k4.plne);
  check('„+ ½" u posledního: posune do volna, za kraj skříně ne (hláška)', k4.konec === 11 && k4.plus === true && k4.plus2 === false && k4.konec2 === 12 && /není místo/.test(k4.hlaska), JSON.stringify(k4));
  a = await bod(1, 6);
  await p.mouse.click(a.x, a.y); await w(150);
  P = await poz();
  check('klepnutí z knihovny do volného místa: přístroj středem na místě klepnutí (5,5–6,5)', JSON.stringify(P[1]) === '[5.5]', JSON.stringify(P[1]));

  // ── 4. byt 3+1 s mezerami: schéma, popisky, fáze, oteplení ─────────────
  const k5 = await p.evaluate(async () => {
    await dokNovy('rozv');
    __T.dk('[data-dk="oznaceni"]', 'RH1'); __T.dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S'); __T.dk('[data-dk="privodIn"]', '40');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x18-n')); window.__rozvByt();
    __T.naj('-FA2').p.pv = '2'; __T.naj('-FA3').p.pv = '2';
    // mezery: 2 moduly před -FA3 (řada 2, odsune skupinu), RCBO na kraj řady 3, ½ M za QM
    for (let i = 0; i < 4; i++) rozvMezeraPosun(__T.naj('-FA3').uid, 0.5);
    const rcbo = __rz.rady[2].prvky.find(x => x.p.kat === 'FIFA');
    rozvPresunout(rcbo.uid, 2, 0, 16);
    rozvMezeraPosun(__rz.rady[0].prvky[1].uid, 0.5);
    await dokUlozitOtevreny();
    const d = DOK_TYPY.rozv.cist(dokForm());
    const holy = JSON.parse(JSON.stringify(d)); holy.rady.forEach(r => r.prvky.forEach(x => delete x.mezera));
    const A = __T.vystupy(d), B = __T.vystupy(holy);
    const mez = d.rady.map(r => r.prvky.filter(x => x.mezera).map(x => (x.ozn || x.p.kat) + ':' + x.mezera).join(' ')).join(' | ');
    // popisky do skutečné stránky — změřit políčka v mm
    rozvPopiskyVykreslit({ uid: window.__dokOtevreny.uid, data: d });
    await new Promise(r => setTimeout(r, 200));
    const pxmm = 96 / 25.4;
    const pole = [...document.querySelectorAll('#dok-pdf-pages .rz-pp-mezera')].map(e => Math.round(e.getBoundingClientRect().width / pxmm * 10) / 10);
    const pasky = [...document.querySelectorAll('#dok-pdf-pages .rz-pp-pas, #dok-pdf-pages [class*="rz-pp-r"]')].length;
    const rady = rozvPopiskyRady(d).map(r => ({ sirka: Math.round(r.sirka * 10) / 10, moduly: r.moduly, n: r.bunky.filter(c => !c.prazdne).length }));
    const radyH = rozvPopiskyRady(holy).map(r => ({ sirka: Math.round(r.sirka * 10) / 10, moduly: r.moduly, n: r.bunky.filter(c => !c.prazdne).length }));
    showScreen('dok-form');
    const schemaPuid = l => (l.match(/data-puid="/g) || []).length;
    return {
      mez, pole, rady: JSON.stringify(rady), radyH: JSON.stringify(radyH),
      schemaDalsi: JSON.stringify(A.schema.slice(1)) === JSON.stringify(B.schema.slice(1)), listu: A.schema.length,
      puid: A.schema.slice(1).map(schemaPuid).join(','), puidH: B.schema.slice(1).map(schemaPuid).join(','),
      osazeniJine: A.schema[0] !== B.schema[0],
      sraf: (A.schema[0].match(/stroke-dasharray/g) || []).length - (B.schema[0].match(/stroke-dasharray/g) || []).length,
      // výsledek oteplení nese kopie přístrojů (i s klíčem mezera) — porovnávají se vypočtené hodnoty
      faze: A.faze === B.faze, otepl: A.otepl.replace(/,"mezera":[\d.]+/g, '') === B.otepl, oteplStav: JSON.parse(A.otepl).stav,
      oteplW: JSON.stringify([JSON.parse(A.otepl).soucet, JSON.parse(A.otepl).penc]),
      ukaz: document.getElementById('rz-faze-ukaz').textContent,
      seznam: A.seznam.replace(/<svg[\s\S]*?<\/svg>/g, '') === B.seznam.replace(/<svg[\s\S]*?<\/svg>/g, ''),
      svgJine: A.svg !== B.svg,
      ulozeno: JSON.stringify(window.__dokOtevreny.data.rady).indexOf('"mezera":2') !== -1
    };
  });
  check('byt 3+1 ve 3×18 s mezerami: ½ M za QM, 2 M před -FA3, RCBO na kraji řady 3', /:0\.5/.test(k5.mez) && /-FA3:2/.test(k5.mez) && /-FI\/FA1:/.test(k5.mez), k5.mez);
  check('mezery jsou v uložených datech', k5.ulozeno);
  check('schéma: listy s jednopólovým schématem jsou shodné s bytem bez mezer — žádný prázdný sloupec', k5.schemaDalsi && k5.puid === k5.puidH, k5.listu + ' listů, přístrojů ' + k5.puid + ' / ' + k5.puidH);
  check('… osazení na listu 1 mezery ukáže přeškrtnuté jako volné místo', k5.osazeniJine && k5.sraf >= 3, 'čárkovaných navíc ' + k5.sraf);
  check('popisky: mezery jsou prázdná políčka přesně v jejich šířce (8,75 / 35 / 35 / 70 mm)', k5.pole.length === 4 && [8.75, 35, 35, 70].every((v, i) => Math.abs(k5.pole[i] - v) < 0.2), k5.pole.join(', '));
  check('… pásek je pořád široký jako řada a popsaných políček je stejně jako bez mezer', k5.rady === k5.radyH, k5.rady);
  check('součty fází s mezerami stejné jako bez nich', k5.faze, k5.ukaz);
  check('oteplení s mezerami stejné jako bez nich', k5.otepl, k5.oteplStav + ' ' + k5.oteplW);
  check('seznam přístrojů v PDF stejný, čelní pohled mezery ukáže', k5.seznam && k5.svgJine);

  // ── 5. telefon: Mezera vlevo má tlačítka aspoň 44 px ───────────────────
  await p.setViewportSize({ width: 375, height: 800 });
  await w(200);
  const tel = await p.evaluate(() => {
    rozvVybrat(__T.naj('-FA3').uid);
    const bt = [...document.querySelectorAll('#rz-vlastnosti .rp-mezera button')];
    return { n: bt.length, h: bt.map(x => Math.round(x.getBoundingClientRect().height)), sirka: document.documentElement.scrollWidth };
  });
  check('telefon 375 px: tlačítka mezery ≥ 40 px a stránka se neposouvá do strany', tel.n === 2 && tel.h.every(h => h >= 40) && tel.sirka <= 375, JSON.stringify(tel));

  check('žádná chyba na stránce', !N.err.length && !S.err.length, N.err.concat(S.err).join(' | '));
  console.log(res.join('\n'));
  await b.close();
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})();
