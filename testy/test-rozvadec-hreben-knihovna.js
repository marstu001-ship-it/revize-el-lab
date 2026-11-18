// Rozvaděč — propojovací hřeben jako položka knihovny (2026-11-18, blok
// „ROZVADĚČ — HŘEBEN Z KNIHOVNY"). Hlídá: nový druh `hreben` v rozvValidovat
// (poly/prurez/In/polu/roztecMm/prislK/krytky), CSV sloupce na konci šablony
// (prurez, polu, roztec_mm, krytky), panel hřebenu nabízí „Hřeben z knihovny"
// podle pólů a předvolí řadu podle výrobce přístrojů pod ním, výběr zapíše
// `h.knih` + kopii `h.p` a převezme prurez/In, délka z knihovny (`polu` ×
// `roztecMm`) kratší než potřeba = upozornění „potřeba N kusy", `rzhMaterial`
// ukáže výrobce a typ. Obecný hřeben (bez `knih`) se nemění.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: require('path').join(__dirname, 'knihovny', r.request().url().split('/').pop()),
    contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const err = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => err.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(URL); await w(1200);

  // ── 1. rozvValidovat: druh hreben ─────────────────────────────────────
  const val = await p.evaluate(() => ({
    chybejici: rozvValidovat({ druh: 'hreben' }),
    ok: rozvValidovat({ druh: 'hreben', vyrobce: 'Výrobce A', rada: 'VA-M', typ: 'VA-HR-12', poly: '3', prurez: '10', in: '63', polu: '12', roztec_mm: '18', prislK: 'VA-M' }),
    // rozvValidovat čte interní klíče (poly/prurez/In/polu/roztecMm), ne CSV hlavičky — ověří to i import CSV níž
    primo: rozvValidovat({ druh: 'hreben', vyrobce: 'Výrobce A', poly: '3', prurez: '10', In: '63', polu: '12', roztecMm: '18' })
  }));
  check('hreben bez povinných polí (prurez, polu) = chyby', val.chybejici.chyby.some(c => /průřez/.test(c)) && val.chybejici.chyby.some(c => /pólů.?zubů/.test(c)), JSON.stringify(val.chybejici.chyby));
  check('hreben s vyplněnými poli validuje se bez chyb, druh = hreben', val.primo.chyby.length === 0 && val.primo.polozka.druh === 'hreben' &&
    val.primo.polozka.poly === '3' && val.primo.polozka.prurez === 10 && val.primo.polozka.In === 63 && val.primo.polozka.polu === 12 && val.primo.polozka.roztecMm === 18,
    JSON.stringify(val.primo.polozka));
  const neplatne = await p.evaluate(() => rozvValidovat({ druh: 'hreben', poly: '2', prurez: '10', polu: '12' }));
  check('neplatné póly hřebenu (2) = chyba', neplatne.chyby.some(c => /póly hřebenu/.test(c)), JSON.stringify(neplatne.chyby));

  // ── 2. CSV: nové sloupce na konci šablony ─────────────────────────────
  const csvHl = await p.evaluate(() => ROZV_CSV.map(c => c[0]).join(';'));
  check('šablona CSV končí …ovladani;prurez;polu;roztec_mm;krytky;poznamka', /;ovladani;prurez;polu;roztec_mm;krytky;poznamka$/.test(csvHl), csvHl.slice(-70));

  // ── 3. otevřít rozvaděč, přidat vymyšlené „Výrobce A" do knihovny ─────
  await p.evaluate(async () => {
    await dokNovy('rozv');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel') || rozvKnihPolozka('v-sk-3x18-n'));
    await dokNacist();
    var faCsv = 'druh;kategorie;nazev;vyrobce;rada;typ;poly;in;charakteristika;sirka_moduly\n' +
      'pristroj;FA;;Výrobce A;VA-M;VA-FA-16;3;16;B;3\n';
    var fa = rozvImportRozebrat(faCsv, 'fa.csv');
    fa.polozky.forEach(function (q) { q.polozka.id = 'u' + dokUid(); q.polozka.zdroj = 'import'; DOK.rozvKnihovna.push(q.polozka); });
    window.__faKid = fa.polozky[0].polozka.id;
    var hrCsv = 'druh;nazev;vyrobce;rada;typ;poly;prurez;in;polu;roztec_mm;prislusenstvi_k\n' +
      'hreben;;Výrobce A;VA-M;VA-HR-12;3;16;63;12;18;VA-M\n' +
      'hreben;;Výrobce B;VB-X;VB-HR-57;3;10;;57;17,5;\n';
    var hr = rozvImportRozebrat(hrCsv, 'hr.csv');
    window.__importChyby = hr.chyby.length;
    hr.polozky.forEach(function (q) { q.polozka.id = 'u' + dokUid(); q.polozka.zdroj = 'import'; DOK.rozvKnihovna.push(q.polozka); });
    window.__hrAKid = hr.polozky[0].polozka.id; window.__hrBKid = hr.polozky[1].polozka.id;
    await dokZapsat(); rozvKnihovnaZmenena();
    for (var i = 0; i < 3; i++) { var x = rozvVlozit(window.__faKid, 0, __rz.rady[0].prvky.length); x.vyvod = 'Obvod ' + (i + 1); }
    rozvPohledVykreslit(); rozvVlastnostiVykreslit();
  });
  check('CSV import hřebenů (Výrobce A i B) bez chyb', await p.evaluate(() => window.__importChyby === 0));

  // ── 4. hřeben přes vybrané 3 FA (9 modulů, 3P) — panel nabízí knihovnu ─
  const panel1 = await p.evaluate(() => {
    var h = rzhPridat(rzhNovy(0, 0, 9, '3'), 'test');
    __rz.hrVyber = h.uid;
    var volby = rzhKnihVolby(h);
    return { uid: h.uid, volbyId: volby.map(function (it) { return it.id; }), prvniVyrobce: volby[0] && volby[0].vyrobce, html: rzhPanelHtml(h) };
  });
  check('rzhKnihVolby nabízí obě hřeben-položky s 3P a výrobce A (pod hřebenem) je první', panel1.volbyId.length === 2 && panel1.prvniVyrobce === 'Výrobce A', JSON.stringify(panel1));
  check('panel hřebenu obsahuje nabídku „Hřeben z knihovny"', /Hřeben z knihovny/.test(panel1.html) && panel1.html.indexOf('data-hr-pole="knih"') !== -1);

  // ── 5. výběr knihovní položky → h.knih / h.p / prurez / In ────────────
  const po1 = await p.evaluate(() => {
    rzhKnihNastavit(__rz.hrVyber, window.__hrAKid);
    var h = rzhNajit(__rz.hrVyber);
    return { knih: !!h.knih, vyrobce: h.p && h.p.vyrobce, typ: h.p && h.p.typ, prurez: h.prurez, In: h.In, kontrola: rzhKnihKontrola(h) };
  });
  check('h.knih/h.p/prurez/In nastavené z knihovny A (prurez 16, In 63; 12 pólů, rozteč 18 mm → 216 mm, pro 9 pólů/157,5 mm vyhovuje)',
    po1.knih && po1.vyrobce === 'Výrobce A' && po1.typ === 'VA-HR-12' && po1.prurez === 16 && po1.In === 63 && po1.kontrola === null, JSON.stringify(po1));

  // ── 6. prodloužení hřebenu nad délku z knihovny → „potřeba N kusy" ────
  const po2 = await p.evaluate(() => {
    rzhZmenit(__rz.hrVyber, 'test prodlouzeni', function (h) { h.do = h.od + 20; });
    var h = rzhNajit(__rz.hrVyber);
    return { kontrola: rzhKnihKontrola(h), nPolu: rzhPolu(h) };
  });
  check('hřeben prodloužený na 20 pólů (350 mm) přes kapacitu knihovny (216 mm) hlásí „potřeba 2 kusy"',
    po2.nPolu === 20 && po2.kontrola && /potřeba 2 kusy/.test(po2.kontrola.t), JSON.stringify(po2));

  // ── 7. rzhMaterial — výrobce a typ v seznamu materiálu ────────────────
  const mat1 = await p.evaluate(() => rzhMaterial({ skrin: __rz.skrin, rady: __rz.rady, hrebeny: __rz.hrebeny }));
  check('rzhMaterial u hřebenu z knihovny ukazuje výrobce a typ, i počet kusů (2)', mat1.some(t => /Výrobce A VA-HR-12/.test(t) && /, 2 ks/.test(t)), JSON.stringify(mat1));

  // ── 8. „— obecný —" vrátí hřeben na generické chování (bez knih) ──────
  const po3 = await p.evaluate(() => {
    rzhKnihNastavit(__rz.hrVyber, '');
    var h = rzhNajit(__rz.hrVyber);
    return { knih: h.knih, p: h.p, prurez: h.prurez, In: h.In };
  });
  check('„— obecný —" smaže knih i p, průřez (16 mm² z knihovny) se jen tak nezahodí — zůstává, dokud ho technik nezmění', !po3.knih && !po3.p && po3.prurez === 16, JSON.stringify(po3));

  // ── 9. obecný hřeben (bez knih) se chová úplně stejně jako dřív ───────
  const gen = await p.evaluate(() => {
    var h = rzhPridat(rzhNovy(1, 0, 3, '1'), 'obecný test');
    var mat = rzhMaterial({ skrin: __rz.skrin, rady: __rz.rady, hrebeny: __rz.hrebeny });
    return { kontrola: rzhKnihKontrola(h), radek: mat.filter(function (t) { return /1P/.test(t); })[0] };
  });
  check('obecný hřeben (bez knih): rzhKnihKontrola vrací null, materiál ve starém tvaru „…, 1 ks" bez výrobce',
    gen.kontrola === null && /Propojovací hřeben 1P \d+ mm², 3 póly \(zkrátit z \d+\), 1 ks/.test(gen.radek), JSON.stringify(gen));

  check('žádná chyba na stránce', err.length === 0, err.join(' | '));

  await b.close();
  console.log(res.join('\n'));
  const spatne = res.filter(r => r.startsWith('❌')).length;
  console.log('\n' + (res.length - spatne) + ' ✅, ' + spatne + ' ❌');
  process.exit(spatne ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.error(e); process.exit(2); });
