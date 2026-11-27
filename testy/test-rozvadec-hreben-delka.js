// Propojovací hřeben se ZKRACUJE na délku přesně přes přístroje, které propojuje (2026-11-27,
// připomínka ze skládání zásuvkové skříně): natažení myší, tažení za kraj, posun, „Navrhnout
// hřebeny", „Hřeben přes vybrané" i hřeben z knihovny se přichytí na první a poslední přístroj,
// nikdy přes svorky, rezervy ani mezery. Řada QH1, FI1, FA1 3P, FA9–FA11, FA7, FA8, svorky X1…X7.
// Vše vymyšlené.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901;
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d !== undefined ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));

const POSTAV = async () => {
  STORE.technik = STORE.technik || {}; STORE.technik.rz_hreben_strana = 'nahore';
  await dokNovy('zs');
  rozvSkrinNastavit(rozvValidovat({ druh: 'skrin', nazev: 'ZS 24', rady: 1, modulu: 24, ip: 'IP54', material: 'plast', svorkovnice: 'N pod, PE pod' }).polozka);
  ['v-qm-3-40', 'v-fi-4-40-30-A', 'v-fa-3-C32', 'v-fa-1-B16', 'v-fa-1-B16', 'v-fa-1-B16', 'v-fa-1-B10', 'v-fa-1-B10'].forEach(k => rozvVlozit(k, 0, __rz.rady[0].prvky.length));
  for (let i = 0; i < 7; i++) rozvVlozit('v-x-rad-4', 0, __rz.rady[0].prvky.length);
  const pr = __rz.rady[0].prvky; ['-FA1', '-FA9', '-FA10', '-FA11', '-FA7', '-FA8'].forEach((o, i) => { pr[2 + i].ozn = o; });
  __rz.celo = { zasuvky: [] }; __rz.hrebeny = []; __rz.vodice = [];
  __rz.vyber = null; __rz.vic = null; rozvPohledVykreslit(); rozvVlastnostiVykreslit();
};
const STAV = () => {
  const h = (__rz.hrebeny || [])[0], S = rzpStav(__rz), fa = __rz.rady[0].prvky.filter(x => /FA/.test(x.ozn));
  return h ? { od: h.od, do: h.do, poly: h.poly, zuby: rzhZuby(h).map(z => z.x ? z.x.ozn + ':' + z.lab : '–').join(' '),
    pod: fa.map(x => x.ozn + (S.vys[x.uid] && S.vys[x.uid].pod ? '✓' + (x.faze || '') : '✗')).join(' '),
    svorky: rzhZuby(h).some(z => z.x && z.x.p.kat === 'X') } : null;
};

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1700, height: 1000 } });
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await w(1000);
  const box = u => p.evaluate(u => { const x = __rz.rady[0].prvky.find(q => q.ozn === u); const r = document.querySelector('#rz-pohled [data-puid="' + x.uid + '"]').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, u);
  const tah = async (x0, y0, x1, y1) => { await p.mouse.move(x0, y0); await p.mouse.down(); for (let i = 1; i <= 12; i++) { await p.mouse.move(x0 + (x1 - x0) * i / 12, y0 + (y1 - y0) * i / 12); await w(15); } await p.mouse.up(); await w(300); };

  // ── 1. natažení myší od kraje FA1 až do svorek ──
  await p.evaluate(POSTAV.toString().replace(/^async \(\) => /, '(async () => ') + ')()');
  await p.evaluate(() => TD_AKCE.tdRHrNastroj()); await w(250);
  let a = await box('-FA1'), c = await box('-X3');
  await tah(a.x + a.w * 0.2, a.y + a.h * 0.4, c.x + c.w * 0.5, a.y + a.h * 0.4);
  await p.evaluate(() => { if (__rz.hrNastroj) TD_AKCE.tdRHrNastroj(); });
  let s = await p.evaluate(STAV);
  check('natažení myší přes FA1…FA8 až do svorek: hřeben přesně od začátku FA1 do konce FA8 (7–15, 8 pólů), ne přes svorky', s && s.od === 7 && s.do === 15 && !s.svorky, JSON.stringify(s));
  check('3P hřeben: FA1 všemi třemi póly, 1P jističe po zubech L1 L2 L3 L1 L2', s && s.poly === '3' && s.zuby === '-FA1:L1 -FA1:L2 -FA1:L3 -FA9:L1 -FA10:L2 -FA11:L3 -FA7:L1 -FA8:L2', s && s.zuby);
  check('všechny jističe pod hřebenem pod napětím, 1P s fází podle zubu', s && s.pod === '-FA1✓3f -FA9✓L1 -FA10✓L2 -FA11✓L3 -FA7✓L1 -FA8✓L2', s && s.pod);
  const pan = await p.evaluate(() => { __rz.hrVyber = null; __rz.vyber = null; rozvSvgPrekreslit(); rozvVlastnostiVykreslit(); const bt = [...document.querySelectorAll('#rz-pohled button')].find(b => /Zapojení/.test(b.textContent)); bt && bt.click(); return new Promise(r => setTimeout(() => r(document.getElementById('rz-vlastnosti').innerText), 400)); });
  check('panel „Kdo koho napájí": FA1…FA8 z -FI1 (hřebenem)', ['-FA1', '-FA9', '-FA10', '-FA11', '-FA7', '-FA8'].every(o => new RegExp(o.replace('-', '\\-') + '\\s+z \\-FI1 \\(hřebenem\\)').test(pan)), pan.slice(0, 400));
  await p.evaluate(() => { const bt = [...document.querySelectorAll('#rz-pohled button')].find(b => /Zapojení/.test(b.textContent)); bt && bt.click(); });
  await w(300);

  // ── 2. tah za pravý kraj přes svorky a zpět doprostřed FA11 ──
  await p.evaluate(() => { __rz.hrVyber = __rz.hrebeny[0].uid; rozvSvgPrekreslit(); }); await w(200);
  const kraj = await p.evaluate(() => { const e = document.querySelector('#rz-pohled [data-hr-kraj="P"]'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  c = await box('-X5');
  await tah(kraj.x, kraj.y, c.x + c.w / 2, kraj.y);
  s = await p.evaluate(STAV);
  check('kraj tažený přes svorky zůstane na konci FA8 (15)', s.do === 15 && !s.svorky, JSON.stringify(s));
  const k2 = await p.evaluate(() => { const e = document.querySelector('#rz-pohled [data-hr-kraj="P"]'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  c = await box('-FA11');
  await tah(k2.x, k2.y, c.x + c.w * 0.7, k2.y);
  s = await p.evaluate(STAV);
  check('kraj puštěný na FA11 (za jeho středem) se přichytí na konec FA11 (13)', s.do === 13 && s.od === 7, JSON.stringify(s));
  await p.keyboard.press('Control+z'); await w(200);
  check('Ctrl+Z vrátí délku', await p.evaluate(() => __rz.hrebeny[0].do === 15));

  // ── 3. rozsah z bodů (vnitřek): mezera, rezerva a svorky hřeben zastaví ──
  const pr = await p.evaluate(() => ({ a: rzhPrichytit(0, 7.6, 17.5, 7.6), b: rzhPrichytit(0, 15, 18, 15), c: rzhPrichytit(0, 10.2, 12.6, 10.2),
    d: (() => { const x = __rz.rady[0].prvky.find(q => q.ozn === '-FA11'); x.mezera = 1; const r = rzhPrichytit(0, 7, 16, 7); delete x.mezera; return r; })() }));
  check('přichycení: od půli FA1 do svorek = 7–15; jen svorky = nic; střed FA9 a FA11 = 10–13; mezera před FA11 hřeben ukončí (7–12)',
    pr.a.od === 7 && pr.a.do === 15 && pr.b === null && pr.c.od === 10 && pr.c.do === 13 && pr.d.od === 7 && pr.d.do === 12, JSON.stringify(pr));

  // ── 4. Navrhnout hřebeny a Hřeben přes vybrané ──
  const nv = await p.evaluate(() => { __rz.hrebeny = []; __rz.vodice = []; const N = rzhNavrhy(); return N.map(q => q.h.od + '-' + q.h.do + ' ' + q.h.poly).join(','); });
  check('Navrhnout hřebeny: 7–15 3P', nv === '7-15 3', nv);
  const vb = await p.evaluate(() => { __rz.hrebeny = []; const pr = __rz.rady[0].prvky; const u = pr.filter(x => ['-FA9', '-FA10', '-FA11', '-FA7'].indexOf(x.ozn) !== -1).map(x => x.uid);
    __rz.vyber = u[0]; __rz.vic = u; TD_AKCE.tdRHrVybrane(); const h = __rz.hrebeny[0]; return h ? h.od + '-' + h.do : 'nic'; });
  check('Hřeben přes vybrané FA9…FA7: 10–14', vb === '10-14', vb);
  const vbx = await p.evaluate(() => { __rz.hrebeny = []; const u = __rz.rady[0].prvky.filter(x => /^-X[123]$/.test(x.ozn)).map(x => x.uid); __rz.vyber = u[0]; __rz.vic = u; TD_AKCE.tdRHrVybrane(); return (__rz.hrebeny || []).length; });
  check('Hřeben přes vybrané samé svorky: žádný hřeben', vbx === 0, vbx);

  // ── 5. hřeben z knihovny: delší = zkrátit, kratší = upozornění ──
  const kn = await p.evaluate(() => {
    const d = rozvValidovat({ druh: 'hreben', vyrobce: 'Výrobce A', typ: 'HA-3-57', poly: '3', prurez: '16', polu: '57' }).polozka; d.id = 'hd'; d.zdroj = 'import';
    const k = rozvValidovat({ druh: 'hreben', vyrobce: 'Výrobce A', typ: 'HA-3-6', poly: '3', prurez: '16', polu: '6' }).polozka; k.id = 'hk'; k.zdroj = 'import';
    DOK.rozvKnihovna = [d, k]; rozvKnihovnaZmenena();
    __rz.hrebeny = [rzhNovy(0, 7, 15, '3')]; rzhKnihNastavit(__rz.hrebeny[0].uid, 'hd');
    const m1 = rzhMaterial(DOK_TYPY.rozv.cist(dokForm())).join('|');
    rzhKnihNastavit(__rz.hrebeny[0].uid, 'hk');
    const m2 = rzhMaterial(DOK_TYPY.rozv.cist(dokForm())).join('|'), up = (rzhKnihKontrola(__rz.hrebeny[0]) || {}).t || '';
    const pi = rozvValidovat({ druh: 'pristroj', kat: 'PRISL', prislTyp: 'hreben', nazev: 'Hřeben 3P', vyrobce: 'Výrobce A', typ: 'HB-3', poly: '3', prurez: '10', sirka: 1 }).polozka; pi.id = 'hp'; pi.zdroj = 'import';
    __rz.hrebeny = []; const u = __rz.rady[0].prvky.filter(x => /^-FA(1|9)$/.test(x.ozn)).map(x => x.uid); __rz.vyber = u[0]; __rz.vic = u;
    const h3 = rzhZKnihovny(pi);
    return { m1, m2, up, h3: h3 ? h3.od + '-' + h3.do + ' ' + h3.knih : 'nic' };
  });
  check('hřeben z knihovny delší než potřeba: „zkrátit na 8 pólů – kus z délky 57", 1 ks', /8 pólů \(zkrátit na 8 pólů – kus z délky 57\), 1 ks/.test(kn.m1), kn.m1);
  check('hřeben z knihovny kratší: upozornění a 2 kusy', /potřeba 2 kusy za sebou/.test(kn.up) && /, 2 ks/.test(kn.m2), kn.up + ' | ' + kn.m2);
  check('hřeben z knihovny přes vybrané FA1, FA9: 7–11 a nese položku knihovny', kn.h3 === '7-11 hp', kn.h3);

  check('bez chyb na stránce', err.length === 0, err.join(' | '));
  await b.close();
  console.log(res.join('\n'));
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})();
