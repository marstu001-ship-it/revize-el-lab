// Rozvaděč — pojistková vložka jako položka knihovny (2026-11-18, blok
// „ROZVADĚČ — POJISTKOVÁ VLOŽKA Z KNIHOVNY"). Hlídá: nový druh `vlozka`
// v rozvValidovat (velikost/In/char/ue/icu/pv), nové pole FU `velikost` a
// `pvMaxVlozky`, CSV sloupce na konci šablony, panel pojistkového odpínače
// nabízí „Vložka z knihovny" podle velikosti, výběr zapíše x.vlozka (text,
// jako dřív) i x.vlozkaP (kopie), ruční přepis textu vložku z knihovny
// odpojí, oteplení FU sečte Pv odpínače i vložky (Inc/In_vložky)² × póly
// a ukáže obě složky, překročení `pv_max_vlozky` hlásí upozornění. Starý
// rozvaděč (bez vlozkaP) se nemění — hlídá i `testy/test-otepleni-pv.js`.
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

  // ── 1. rozvValidovat: druh vlozka ─────────────────────────────────────
  const val = await p.evaluate(() => ({
    chybejici: rozvValidovat({ druh: 'vlozka' }),
    ok: rozvValidovat({ druh: 'vlozka', vyrobce: 'Výrobce A', rada: 'VA-10x38', typ: 'VA-25gG', velikost: '10x38', In: '25', char: 'gG', ue: '500', icu: '100', pv: '3,2' }),
    neplatnaVel: rozvValidovat({ druh: 'vlozka', velikost: 'bordel', In: '25' }),
    neplatnyChar: rozvValidovat({ druh: 'vlozka', velikost: '10x38', In: '25', char: 'XX' })
  }));
  check('vlozka bez povinných polí (velikost, In) = chyby', val.chybejici.chyby.some(c => /velikost vložky/.test(c)) && val.chybejici.chyby.some(c => /chybí In/.test(c)), JSON.stringify(val.chybejici.chyby));
  check('vlozka s vyplněnými poli validuje se bez chyb, druh = vlozka, velikost „10×38"', val.ok.chyby.length === 0 && val.ok.polozka.druh === 'vlozka' &&
    val.ok.polozka.velikost === '10×38' && val.ok.polozka.In === 25 && val.ok.polozka.char === 'gG' && val.ok.polozka.pv === 3.2, JSON.stringify(val.ok.polozka));
  check('neplatná velikost = chyba', val.neplatnaVel.chyby.some(c => /velikost vložky/.test(c)));
  check('neplatná charakteristika = chyba', val.neplatnyChar.chyby.some(c => /charakteristika vložky/.test(c)));

  // ── 2. CSV: nové sloupce na konci šablony ─────────────────────────────
  const csvHl = await p.evaluate(() => ROZV_CSV.map(c => c[0]).join(';'));
  check('šablona CSV končí …krytky;velikost;pv_max_vlozky;poznamka', /;krytky;velikost;pv_max_vlozky;poznamka$/.test(csvHl), csvHl.slice(-60));

  // ── 3. FU s velikostí (CSV) a vložka z knihovny (CSV) ─────────────────
  await p.evaluate(async () => {
    await dokNovy('rozv');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n') || rozvKnihPolozka('v-sk-4x24-ocel'));
    await dokNacist();
    var fuCsv = 'druh;kategorie;nazev;vyrobce;rada;typ;poly;in;sirka_moduly;velikost;pv_max_vlozky\n' +
      'pristroj;FU;;Výrobce A;VA-OD;VA-FU-63;3;63;3;10x38;8\n';
    var fu = rozvImportRozebrat(fuCsv, 'fu.csv');
    window.__fuChyby = fu.chyby.length;
    fu.polozky.forEach(function (q) { q.polozka.id = 'u' + dokUid(); q.polozka.zdroj = 'import'; DOK.rozvKnihovna.push(q.polozka); });
    window.__fuKid = fu.polozky[0].polozka.id;
    var vlCsv = 'druh;nazev;vyrobce;rada;typ;velikost;in;charakteristika;pv\n' +
      'vlozka;;Výrobce A;VA-10x38;VA-25gG;10x38;25;gG;3,2\n' +
      'vlozka;;Výrobce A;VA-10x38;VA-10gG;10x38;10;gG;1,1\n';
    var vl = rozvImportRozebrat(vlCsv, 'vl.csv');
    window.__vlChyby = vl.chyby.length;
    vl.polozky.forEach(function (q) { q.polozka.id = 'u' + dokUid(); q.polozka.zdroj = 'import'; DOK.rozvKnihovna.push(q.polozka); });
    window.__vl25Kid = vl.polozky[0].polozka.id;
    await dokZapsat(); rozvKnihovnaZmenena();
    var x = rozvVlozit(window.__fuKid, 0, __rz.rady[0].prvky.length);
    window.__fuUid = x.uid;
    __rz.vyber = x.uid; __rz.vic = null;
    rozvPohledVykreslit(); rozvVlastnostiVykreslit();
  });
  check('CSV import FU s velikostí/pvMaxVlozky i vložek bez chyb', await p.evaluate(() => window.__fuChyby === 0 && window.__vlChyby === 0));
  const fuP = await p.evaluate(() => rozvNajit(window.__fuUid).x.p);
  check('FU v řadě má velikost 10×38 a pvMaxVlozky 8 W', fuP.velikost === '10×38' && fuP.pvMaxVlozky === 8, JSON.stringify(fuP));

  // ── 4. panel nabízí „Vložka z knihovny" podle velikosti ───────────────
  const panelHtml = await p.evaluate(() => rozvVlozkyHtml(rozvNajit(window.__fuUid).x));
  check('panel odpínače nabízí „Vložka z knihovny" se dvěma shodami velikosti 10×38', /Vložka z knihovny/.test(panelHtml) &&
    (panelHtml.match(/<option value="udok/g) || []).length === 2);

  // ── 5. výběr vložky z knihovny → x.vlozka (text) i x.vlozkaP (kopie) ──
  const po1 = await p.evaluate(() => {
    rozvVlozkaKnihNastavit(window.__fuUid, window.__vl25Kid);
    var x = rozvNajit(window.__fuUid).x;
    return { vlozka: x.vlozka, vlozkaP: x.vlozkaP };
  });
  check('výběr vložky 25 gG z knihovny zapsal x.vlozka „25 A gG" i x.vlozkaP (Pv 3,2 W)',
    /25\s*A\s*gG/.test(po1.vlozka) && po1.vlozkaP && po1.vlozkaP.pv === 3.2 && po1.vlozkaP.In === 25, JSON.stringify(po1));

  // ── 6. oteplení: Pv odpínače + Pv vložky (Inc/In_vložky)² × póly ──────
  const otepl = await p.evaluate(() => {
    var f = dokForm(), d = DOK_TYPY.rozv.cist(f);
    var v = rozvOteplVypocet(d);
    var q = v.radky.filter(function (r) { return r.x.uid === window.__fuUid; })[0];
    return q ? { pvIn: q.pvIn, pvVlozka: q.pvVlozka, pvInc: q.pvInc, eff: q.eff, text: rotPvIncText(q) } : null;
  });
  // FU bez vlastního Pv (import nemá sloupec pv) → pvIn '' (chybí); pvVlozka musí
  // přesto vyjít — Pv_vložky(3,2 W) × (Inc/25)² × 3 pólů — a „pvVlozka" se do dat
  // přidá JEN s vybranou vložkou (starý rozvaděč tenhle klíč nemá vůbec).
  check('oteplení: Pv vložky se spočítá i když odpínač vlastní Pv nemá (jen vložka)',
    otepl && otepl.pvIn === '' && otepl.pvVlozka > 0 && otepl.pvInc === otepl.pvVlozka, JSON.stringify(otepl));
  const ocek = +otepl.pvVlozka, spocteno = 3.2 * 3 * Math.pow(otepl.eff / 25, 2);
  check('Pv vložky odpovídá vzorci 3,2 W × (Inc/25 A)² × 3 póly', Math.abs(ocek - spocteno) < 0.05, ocek + ' vs ' + spocteno.toFixed(3));
  check('rotPvIncText ukazuje obě složky zvlášť („z toho vložka")', /z toho vložka/.test(otepl.text), otepl.text);

  // ── 7. překročení pv_max_vlozky (8 W) → upozornění ────────────────────
  const upoz1 = await p.evaluate(() => rozvVlozkaUpoz(rozvNajit(window.__fuUid).x));
  check('Pv vložky (3,2 W) pod limitem pvMaxVlozky (8 W) — bez upozornění', !upoz1, upoz1);
  await p.evaluate(() => {
    var x = rozvNajit(window.__fuUid).x;
    x.vlozkaP = Object.assign({}, x.vlozkaP, { pv: 20 });   // simulace větší vložky, překročí 8 W
  });
  const upoz2 = await p.evaluate(() => rozvVlozkaUpoz(rozvNajit(window.__fuUid).x));
  check('Pv vložky (20 W) nad limitem pvMaxVlozky (8 W) — upozornění', /Pv 20 W/.test(upoz2) && /8 W/.test(upoz2), upoz2);

  // ── 8. ruční přepis textu vložky odpojí knihovnu (DOM) ────────────────
  await p.evaluate(() => {
    var x = rozvNajit(window.__fuUid).x; x.vlozkaP = { id: 'x', pv: 3.2, In: 25 };
    __rz.vyber = x.uid; rozvVlastnostiVykreslit();
  });
  await p.evaluate(() => {
    var inp = document.querySelector('[data-rp2="vlozka"]');
    inp.value = '40 gG';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const po2 = await p.evaluate(() => { var x = rozvNajit(window.__fuUid).x; return { vlozka: x.vlozka, vlozkaP: x.vlozkaP }; });
  check('ruční přepis pole „Vložka" smaže x.vlozkaP, text se uloží', po2.vlozka === '40 gG' && !po2.vlozkaP, JSON.stringify(po2));

  check('žádná chyba na stránce', err.length === 0, err.join(' | '));

  await b.close();
  console.log(res.join('\n'));
  const spatne = res.filter(r => r.startsWith('❌')).length;
  console.log('\n' + (res.length - spatne) + ' ✅, ' + spatne + ' ❌');
  process.exit(spatne ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.error(e); process.exit(2); });
