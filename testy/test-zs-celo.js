// Editor čela zásuvkové skříně „jako profesionální program" (2026-11-26, bloky „ZÁSUVKOVÁ SKŘÍŇ — editor čela").
// Skutečnou myší: vložení zásuvky s vybraným jističem na DIN, výběr (klik, Ctrl, Shift, obdélník, Ctrl+A, Esc,
// klik do prázdna), kontextové menu zásuvky a prázdného čela, zarovnání a rozmístění, tažení s přichycením
// a žlutým vodítkem = jedno ZPĚT, šipky 5 / 1 mm, kolize víčka (nález, neblokuje), „Zásuvka s jističem"
// (jedno ZPĚT), kontroly (In, póly, Un, bez napájení), klik na nález, přečíslování, štítky na čelo,
// vrtací plán (měřítko, kóty) a šablona 1:1 na listy A4, pohled Zapojení a natažení vodičů, Zapojit
// automaticky, vodiče ve svorkovém plánu a kusovníku. Dotykem (telefon 375 px): dlouhý stisk = menu,
// tažení prstem, dva prsty = přiblížení. Data: otevřený a uložený rozvaděč beze změny, nové klíče
// jen po použití. Vše vymyšlené (testy/zasuvkova-skrin.js).
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));
const stable = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, q) => (a[q] = v[q], a), {}) : v);

async function priprav(p) {
  await p.goto(URL); await w(1500);
  await p.evaluate(() => { STORE.technik = Object.assign({}, STORE.technik, { jmeno: 'Petr Vymyšlený', mesto: 'Kyjov' }); saveStore(); });
  await p.evaluate('window.__zs = ' + require('./zasuvkova-skrin.js').toString());
  await p.evaluate(async () => { await window.__zs(); document.querySelectorAll('.toast').forEach(t => t.remove()); });
  await w(500);
}
const bodMm = (p, x, y) => p.evaluate(([x, y]) => { const s = document.querySelector('#zs-celo .zs-celo-svg').getBoundingClientRect(), g = zsCeloEditorSvg.g; return { x: s.left + (g.x0 + x * g.k) * s.width / ZS_ED.W, y: s.top + (g.y0 + y * g.k) * s.height / ZS_ED.H }; }, [x, y]);
const zasBod = async (p, u) => { const q = await p.evaluate(u => zsZasNajit(u).pos, u); return bodMm(p, q.x, q.y); };
const ukaz = p => p.evaluate(() => { document.querySelectorAll('.toast').forEach(t => t.remove()); document.getElementById('zs-celo').scrollIntoView({ block: 'center' }); });

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1200 } });
  const p = await ctx.newPage(); const chyby = []; p.on('pageerror', e => chyby.push(e.message)); p.on('dialog', d => d.accept());
  await priprav(p);

  // ── 0. data: otevření a uložení nic nepřidá ──
  const d0 = await p.evaluate(async () => { await dokUlozitOtevreny(); const u = __dokOtevreny.uid, ul = dokKopie(DOK.dokumenty.find(x => x.uid === u).data); await dokOtevrit(u); await new Promise(r => setTimeout(r, 400)); return { ul: ul, ct: DOK_TYPY.zs.cist(dokForm()) }; });
  check('otevřený rozvaděč se čte beze změny (žádné nové klíče: vodice, vrtani, vicko…)', stable(d0.ul) === stable(d0.ct) && !('vodice' in (d0.ct.celo || {})) && !d0.ct.vrtani, '');
  await w(300); await ukaz(p);

  // ── 1. vložení s vybraným jističem na DIN (skutečné kliky) ──
  const fa3 = await p.evaluate(() => __rz.rady[0].prvky[3].uid);
  const din = p.locator(`#rz-pohled .rz-svg [data-puid="${fa3}"]`).first(); await din.scrollIntoViewIfNeeded(); await din.click(); await w(200);
  await p.evaluate(() => TD_AKCE.tdZsKnihovna()); await w(200);
  const vl = p.locator('.rz-polozka[data-kid="v-xz-16-400-5p"] [data-action="tdRVlozit"]').first(); await vl.scrollIntoViewIfNeeded(); await vl.click(); await w(300);
  const v1 = await p.evaluate(fa3 => { const z = zsZasNajit(__rz.vyberZas); return { n: __rz.celo.zasuvky.length, ozn: z && z.ozn, nap: z && z.napajen === fa3, din: __rz.vyber, kol: z && !!zsKolizeDuvody(zsData())[z.uid] }; }, fa3);
  check('vybraný jistič na DIN vložení neblokuje: -XZ7 na čele, napájí ji -FA3, DIN výběr zrušen, bez kolize', v1.n === 7 && v1.ozn === '-XZ7' && v1.nap && !v1.din && !v1.kol, JSON.stringify(v1));
  await p.keyboard.press('Escape'); await w(150);
  check('Esc zruší výběr zásuvky', await p.evaluate(() => !__rz.vyberZas));
  await p.keyboard.press('Control+z'); await w(200);
  check('Ctrl+Z vrátí vložení', await p.evaluate(() => __rz.celo.zasuvky.length === 6));

  // ── 2. výběr: klik, Ctrl, Shift, klik do prázdna, obdélník, Ctrl+A ──
  await ukaz(p);
  let q = await zasBod(p, 'z1'); await p.mouse.click(q.x, q.y); await w(120);
  q = await zasBod(p, 'z2'); await p.keyboard.down('Control'); await p.mouse.click(q.x, q.y); await p.keyboard.up('Control'); await w(120);
  q = await zasBod(p, 'z3'); await p.keyboard.down('Shift'); await p.mouse.click(q.x, q.y); await p.keyboard.up('Shift'); await w(120);
  check('klik + Ctrl+klik + Shift+klik = tři vybrané', await p.evaluate(() => zsVybrane().sort().join(',') === 'z1,z2,z3'), await p.evaluate(() => zsVybrane().join(',')));
  q = await bodMm(p, 30, 520); await p.mouse.click(q.x, q.y); await w(150);
  check('klik do prázdného čela výběr zruší', await p.evaluate(() => !zsVybrane().length));
  const a = await bodMm(p, 20, 290), c2 = await bodMm(p, 320, 350);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move((a.x + c2.x) / 2, (a.y + c2.y) / 2, { steps: 4 });
  const obd = await p.evaluate(() => !!document.querySelector('#zs-celo .zs-obd'));
  await p.mouse.move(c2.x, c2.y, { steps: 4 }); await p.mouse.up(); await w(200);
  check('výběr obdélníkem (rámeček vidět) vybere zásuvky v řadě', obd && await p.evaluate(() => zsVybrane().sort().join(',') === 'z1,z2,z3'), await p.evaluate(() => zsVybrane().join(',')));
  await p.keyboard.press('Control+a'); await w(150);
  check('Ctrl+A na čele vybere všechny zásuvky (ne přístroje DIN)', await p.evaluate(() => zsVybrane().length === 6 && !__rz.vic));
  await p.keyboard.press('Escape'); await w(100);

  // ── 3. kontextové menu ──
  q = await zasBod(p, 'z1'); await p.mouse.click(q.x, q.y, { button: 'right' }); await w(250);
  const m1 = await p.evaluate(() => [...document.querySelectorAll('.kt-menu .kt-pol')].map(e => e.textContent).join('|'));
  check('menu zásuvky: Vlastnosti, Napájí ji, Duplikovat, Kopírovat, Vložit, Rozmístit, Vycentrovat, Přečíslovat, Smazat i s jističem', ['Vlastnosti', 'Napájí ji', 'Duplikovat', 'Kopírovat', 'Vložit', 'Rozmístit', 'Vycentrovat', 'Přečíslovat', 'Smazat', 'i s jističem'].every(t => m1.includes(t)), m1);
  await p.keyboard.press('Escape'); await w(100);
  q = await bodMm(p, 30, 520); await p.mouse.click(q.x, q.y, { button: 'right' }); await w(250);
  const m2 = await p.evaluate(() => [...document.querySelectorAll('.kt-menu .kt-pol')].map(e => e.textContent).join('|'));
  check('menu prázdného čela: Vložit zásuvku sem, Vložit, Vybrat vše, Přečíslovat', ['Vložit zásuvku sem', 'Vybrat vše', 'Přečíslovat'].every(t => m2.includes(t)), m2);
  await p.keyboard.press('Escape'); await w(100);

  // ── 4. zarovnání a rozmístění (výběr myší, akce z menu) ──
  await p.evaluate(() => rozvZmena('t', () => { zsZasNajit('z1').pos = { x: 60, y: 300 }; zsZasNajit('z2').pos = { x: 170, y: 330 }; zsZasNajit('z3').pos = { x: 262, y: 312 }; }));
  await ukaz(p);
  for (const [u, sh] of [['z1', 0], ['z2', 1], ['z3', 1]]) { q = await zasBod(p, u); if (sh) await p.keyboard.down('Shift'); await p.mouse.click(q.x, q.y); if (sh) await p.keyboard.up('Shift'); await w(80); }
  q = await zasBod(p, 'z2'); await p.mouse.click(q.x, q.y, { button: 'right' }); await w(200);
  const mz = await p.evaluate(() => [...document.querySelectorAll('.kt-menu .kt-pol')].map(e => e.textContent).join('|'));
  check('menu nad výběrem tří zásuvek nabízí Zarovnat ▸ a Rozmístit rovnoměrně ▸', /Zarovnat/.test(mz) && /Rozmístit/.test(mz), mz.slice(0, 100));
  await p.locator('.kt-menu .kt-pol', { hasText: 'Zarovnat' }).first().click(); await w(200);
  const zn = p.locator('.kt-menu .kt-pol', { hasText: /nahoru|horní/i }).first();
  if (await zn.count()) await zn.click(); await w(200);
  const zr = await p.evaluate(() => ['z1', 'z2', 'z3'].map(u => zsZasNajit(u).pos.y));
  check('Zarovnat nahoru (menu) — tři zásuvky na stejné výšce', zr[0] === zr[1] && zr[1] === zr[2] && zr[0] === 300, zr.join(','));
  await p.evaluate(() => zsRozmistit('h')); await w(150);
  const rx = await p.evaluate(() => ['z1', 'z2', 'z3'].map(u => zsZasNajit(u).pos.x));
  check('Rozmístit rovnoměrně vodorovně: stejné rozestupy', Math.abs((rx[1] - rx[0]) - (rx[2] - rx[1])) <= 0.5, rx.join(','));
  await p.keyboard.press('Control+z'); await w(150);
  check('Ctrl+Z vrátí rozmístění jedním krokem', await p.evaluate(() => zsZasNajit('z2').pos.x === 170));
  await p.keyboard.press('Escape');

  // ── 5. tažení s přichycením a vodítkem ──
  await ukaz(p);
  const z4 = await zasBod(p, 'z4'), cil = await bodMm(p, 63, 470);
  await p.mouse.move(z4.x, z4.y); await p.mouse.down(); await p.mouse.move(z4.x + 8, z4.y + 4, { steps: 3 }); await p.mouse.move(cil.x, cil.y, { steps: 10 }); await w(100);
  const vod = await p.evaluate(() => document.querySelectorAll('#zs-celo .zs-vodx, #zs-celo .zs-vody').length);
  await p.mouse.up(); await w(200);
  const p4 = await p.evaluate(() => zsZasNajit('z4').pos);
  check('tažení: přichycení ke středu zásuvky nad ní (x 60) se žlutým vodítkem', vod > 0 && p4.x === 60, vod + ' ' + JSON.stringify(p4));
  await p.keyboard.press('Control+z'); await w(150);
  check('tažení = jedno ZPĚT', await p.evaluate(() => zsZasNajit('z4').pos.x === 64 && zsZasNajit('z4').pos.y === 440));
  // šipky
  q = await zasBod(p, 'z5'); await p.mouse.click(q.x, q.y); await w(100);
  await p.keyboard.press('ArrowLeft'); await w(80); await p.keyboard.press('Shift+ArrowUp'); await w(120);
  const p5 = await p.evaluate(() => zsZasNajit('z5').pos);
  check('šipka 5 mm, Shift+šipka 1 mm', p5.x === 259 && p5.y === 439, JSON.stringify(p5));
  await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await w(150); await p.keyboard.press('Escape');

  // ── 6. kolize víčka ──
  await p.evaluate(() => rozvZmena('t', () => { zsZasNajit('z1').pos = { x: 64, y: 380 }; }));
  const kv = await p.evaluate(() => ({ d: Object.values(zsKolizeDuvody(zsData())).map(x => x.join(' | ')).join(' | '), n: rzsKontrola().filter(n => /-XZ2/.test(n.text) && /víčko/.test(n.text)).length, odh: zsVicko(zsZasNajit('z1')).odhad, cerv: !!document.querySelector('#zs-celo [data-zasuvka="z1"] .zs-kol, #zs-celo .zs-kol') }));
  check('kolize víčka: „víčko se neodklopí – narazí na zásuvku", nález v Co ještě chybí, víčko výchozí návrh', /víčko se neodklopí – narazí na zásuvku -XZ2/.test(kv.d) && kv.n >= 1 && kv.odh, JSON.stringify(kv));
  await p.evaluate(() => rozvZmena('t', () => { zsZasNajit('z1').pos.vicko = 0; zsZasNajit('z1').p.vicko = 20; }));
  check('prostor pro víčko z knihovny / zadaný (20 mm) má přednost před návrhem', await p.evaluate(() => !zsVicko(zsZasNajit('z1')).odhad && zsVicko(zsZasNajit('z1')).mm === 20));
  await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await w(150);

  // ── 7. Zásuvka s jističem (klik) ──
  const pred = await p.evaluate(() => ({ z: __rz.celo.zasuvky.length, j: __rz.rady.reduce((a, r) => a + r.prvky.length, 0) }));
  await ukaz(p); await p.locator('[data-action="tdZsSJisticem"]').click(); await w(250);
  await p.locator('.kt-menu .kt-pol', { hasText: 'CEE 32 A 400 V 5P' }).first().click(); await w(400);
  const zj = await p.evaluate(() => { const z = zsZasNajit(__rz.vyberZas), J = zsJisticNajit(z.napajen); return { z: __rz.celo.zasuvky.length, j: __rz.rady.reduce((a, r) => a + r.prvky.length, 0), h: J && (J.p.char + J.p.In + '/' + J.p.poly) }; });
  check('„＋ Zásuvka s jističem" 32 A 5P → zásuvka + jistič C32 3P, propojené', zj.z === pred.z + 1 && zj.j === pred.j + 1 && zj.h === 'C32/3', JSON.stringify(zj));
  await p.keyboard.press('Escape'); await p.keyboard.press('Control+z'); await w(250);
  check('jedno ZPĚT odebere zásuvku i jistič', await p.evaluate(p0 => __rz.celo.zasuvky.length === p0.z && __rz.rady.reduce((a, r) => a + r.prvky.length, 0) === p0.j, pred));

  // ── 8. kontroly ──
  await p.evaluate(() => rozvZmena('t', () => { const z = zsZasNajit('z5'); z.napajen = __rz.rady[0].prvky[1].uid; }));
  await p.evaluate(() => rozvZmena('t', () => { const z = zsZasNajit('z4'); z.p.polyZ = '3P+N+E'; z.p.ue = 400; }));
  await p.evaluate(() => rozvZmena('t', () => { const z = zsZasNajit('z2'); delete z.napajen; }));
  const K = await p.evaluate(() => rzsKontrola().map(n => n.u + ':' + n.text));
  check('chyba: jistič větší než zásuvka (-FA1 32 A na -XZ6 16 A)', K.some(t => /^chyba:.*32 A je větší než zásuvka -XZ6 16 A/.test(t)), K.join(' / '));
  check('chyba: 1P jistič na zásuvce 5P', K.some(t => /^chyba:.*1pólový.*-XZ5.*5P/.test(t)), '');
  check('chyba: Un zásuvky neodpovídá napětí vývodu', K.some(t => /^chyba:.*Un zásuvky -XZ5 400 V/.test(t)), '');
  check('upozornění: zásuvka bez napájení', K.some(t => /^upoz:.*-XZ3.*(nenapájí|bez napájení|napájí ji)/i.test(t)), '');
  check('tip: součet In zásuvek proti vidlici (jen informace)', K.some(t => /^tip:.*Součet In zásuvek/.test(t)), '');
  await p.evaluate(() => { rzsChybiVykreslit(); document.getElementById('rz-chybi').open = true; }); await w(200);
  const nl = p.locator('#rz-chybi [data-action="tdRChybiKlik"]', { hasText: '-XZ3' }).first();
  if (await nl.count()) { await nl.scrollIntoViewIfNeeded(); await nl.click(); await w(200); }
  check('klik na nález vybere zásuvku', await p.evaluate(() => __rz.vyberZas === 'z2'), await p.evaluate(() => __rz.vyberZas));
  for (let i = 0; i < 3; i++) { await p.keyboard.press('Escape'); await p.keyboard.press('Control+z'); await w(120); }

  // ── 9. přečíslování podle polohy ──
  await p.evaluate(() => rozvZmena('t', () => { zsZasNajit('z0').ozn = '-XZ9'; }));
  await p.evaluate(() => zsPrecislovat(false)); await w(150);
  const oz = await p.evaluate(() => __rz.celo.zasuvky.slice().sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x).map(z => z.ozn).join(','));
  check('Přečíslovat zásuvky podle polohy (shora zleva)', oz === '-XZ1,-XZ2,-XZ3,-XZ4,-XZ5,-XZ6', oz);
  await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await w(150);

  // ── 10. štítky, vrtací plán, šablona 1:1 ──
  const st = await p.evaluate(() => { const box = document.createElement('div'); document.body.appendChild(box); const r = zsStitkyStranky(DOK_TYPY.zs.cist(dokForm()), box); const t = box.innerText; const n = box.querySelectorAll('.rz-orez').length; box.remove(); return { r, t, n }; });
  check('štítky na čelo: 6 ks na 1 listu, „-XZ1 · 400 V 32 A · -FA1", ořezové značky, pokyn 100 %', st.r.kusu === 6 && st.r.stran === 1 && /-XZ1 · 400 V 32 A · -FA1/.test(st.t) && st.n === 48 && /100 %/.test(st.t), JSON.stringify(st.r) + ' ' + st.n);
  const vp = await p.evaluate(() => { const d = DOK_TYPY.zs.cist(dokForm()); d.dokVyber = { vrtani: true }; const v = zsVrtaniSvg(d); d.vrtani = { sablona: '1' }; const L = zsSablonaListy(d), B = DOK_TYPY.zs.pdf(d);
    return { m: v.meritko, fmt: v.fmt, retez: /řetězově/.test(v.svg), dopl: /výřez – doplňte/.test(v.svg), n: L.length, sab: B.filter(x => x.cela && /zs-sab-strana/.test(x.cela)).length, l1: L[0].svg, l6: L[5].svg, prost: L.every(s => !/clipPath|<mask|<image|<style|class=/.test(s.svg)) }; });
  check('vrtací plán: list s kótami v měřítku, které se vejde (1:5), řetězové kóty, „výřez – doplňte"', vp.m === 5 && vp.retez && vp.dopl, vp.m + ' ' + vp.fmt);
  check('šablona 1:1: čelo 328 × 550 mm na 2 × 3 listy A4 (přesah 10 mm), v PDF 6 listů', vp.n === 6 && vp.sab === 6, vp.n + '/' + vp.sab);
  check('šablona: číslo listu, schéma skládání, úsečka 50 mm, pokyn 100 %, přesah', /list 1 \/ 6/.test(vp.l1) && /skládání 2 × 3/.test(vp.l1) && /Kontrolní úsečka 50 mm/.test(vp.l1) && /skutečné velikosti \(100 %\)/.test(vp.l1) && /přesah – přiložte list 2/.test(vp.l1) && /list 6 \/ 6/.test(vp.l6), '');
  check('šablona: na výšku 210 × 297 mm, jen jednoduché prvky (vektorové PDF)', /viewBox="0 0 210 297"/.test(vp.l1) && vp.prost, '');
  const sabMm = await p.evaluate(() => { const d = DOK_TYPY.zs.cist(dokForm()); const L = zsSablonaListy(d); const s = L[2].svg; const m = s.match(/<line[^>]*x1="([\d.]+)"[^>]*y1="([\d.]+)"[^>]*x2="([\d.]+)"[^>]*y2="([\d.]+)"/); const z = zsZasNajit('z1').pos; return { x: 10 + z.x - 0, y: 10 + z.y - 267, s: s.indexOf('-XZ2') >= 0 }; });
  check('šablona 1:1: středy otvorů v mm (list 3 nese -XZ2 ve skutečné velikosti)', sabMm.s, JSON.stringify(sabMm));
  // volba v Dokumentech se uloží jen když je zvolená
  await p.evaluate(() => rozvZalozkaNastavit('dok')); await w(400);
  const vol = await p.evaluate(() => { const f = dokForm(), s = f.querySelector('[data-dk="vrtani.sablona"]'); if (!s) return null; const pr = DOK_TYPY.zs.cist(f).vrtani; s.value = '1'; s.dispatchEvent(new Event('change', { bubbles: true })); return { pr: pr, po: DOK_TYPY.zs.cist(f).vrtani }; });
  check('volba „Šablona 1:1 (víc listů A4)" v Dokumentech, ukládá se jen zvolená', vol && !vol.pr && vol.po && vol.po.sablona === '1', JSON.stringify(vol));
  await p.evaluate(() => { const s = dokForm().querySelector('[data-dk="vrtani.sablona"]'); s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true })); rozvZalozkaNastavit('navrh'); }); await w(400);

  // ── 11. Zapojení: natažení vodičů myší, automaticky, svorkový plán, kusovník ──
  await p.evaluate(() => { TD_AKCE.tdZsPohled(document.querySelector('[data-action="tdZsPohled"][data-p="zapojeni"]') || { getAttribute: () => 'zapojeni', dataset: { p: 'zapojeni' } }); });
  await p.evaluate(() => { if (__rz.zsPohled !== 'zapojeni') { __rz.zsPohled = 'zapojeni'; zsCeloPrekreslit(); } }); await w(200); await ukaz(p);
  const sv = k => p.evaluate(k => { const e = document.querySelector('[data-zs-sv="' + k + '"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, k);
  const tah = async (od, kam) => { const A = await sv(od), B = await sv(kam); if (!A || !B) return false; await p.mouse.move(A.x, A.y); await p.mouse.down(); await p.mouse.move(A.x + 4, A.y + 4, { steps: 2 }); await p.mouse.move(B.x, B.y, { steps: 8 }); await p.mouse.up(); await w(150); return true; };
  const j0 = await p.evaluate(() => zsZasNajit('z0').napajen);
  for (let k = 0; k < 3; k++) await tah('J|' + j0 + '|' + k, 'Z|z0|L' + (k + 1));
  const SK = await p.evaluate(() => Object.keys(zsBodyZapojeni(zsData())).filter(k => /^S\|/.test(k)));
  const nK = SK.filter(k => /^S\|0\|/.test(k)), peK = SK.filter(k => /^S\|1\|/.test(k));
  await tah(nK[2], 'Z|z0|N'); await tah(peK[2], 'Z|z0|PE');
  const V = await p.evaluate(() => (__rz.celo.vodice || []).filter(w => w.b.u === 'z0').map(w => w.b.s + ':' + w.prurez).sort().join(','));
  check('pohled Zapojení: 5 vodičů myší k -XZ1 (L1 L2 L3 N PE, 4 mm² podle jističe 32 A)', V === 'L1:4,L2:4,L3:4,N:4,PE:4', V);
  const spatne = await tah('J|' + j0 + '|0', 'Z|z4|N');
  check('vodič fáze na svorku N zásuvky se nepřipojí', spatne && await p.evaluate(() => !(__rz.celo.vodice || []).some(w => w.b.u === 'z4' && w.b.s === 'N')));
  await p.keyboard.press('Control+z'); await w(150);
  check('Ctrl+Z vrátí poslední vodič', await p.evaluate(() => (__rz.celo.vodice || []).filter(w => w.b.u === 'z0').length === 4));
  await p.keyboard.press('Control+Shift+z').catch(() => {});
  await p.evaluate(() => TD_AKCE.tdZsZapojAuto()); await w(300);
  const au = await p.evaluate(() => { const V = __rz.celo.vodice || []; return { n: V.length, z5: V.filter(w => w.b.u === 'z4').map(w => w.b.s).sort().join(','), z1: V.filter(w => w.b.u === 'z0').length }; });
  check('⚡ Zapojit automaticky doplní L / N / PE všem zásuvkám (5P = 5, 1f = 3 vodiče)', au.z1 === 5 && au.z5 === 'L,N,PE' && au.n === 5 + 5 * 3, JSON.stringify(au));
  const plan = await p.evaluate(() => { const d = DOK_TYPY.zs.cist(dokForm()); return { R: zsVodiceRadky(d), mat: rzvMaterial(d), html: rzsObsahHtml(d.rady, d) }; });
  check('svorkový plán: vodiče k zásuvkám (od – do – průřez – barva)', plan.R.length === 20 && plan.R.some(r => r.od === '-FA1:2' && r.do === '-XZ1:L1' && r.pr === '4') && /Vodiče k zásuvkám na čele/.test(plan.html), plan.R.length);
  check('kusovník: vodiče k zásuvkám sečtené po průřezu a barvě', plan.mat.some(t => /H07V-K 4 mm² hnědý – k zásuvkám na čele/.test(t)) && plan.mat.some(t => /2,5 mm² zelenožlutý/.test(t)), plan.mat.join(' / '));
  check('vodiče se uloží jen u zapojeného rozvaděče (celo.vodice)', await p.evaluate(() => (DOK_TYPY.zs.cist(dokForm()).celo.vodice || []).length === 20));
  await p.evaluate(() => { __rz.zsPohled = null; zsCeloPrekreslit(); });
  check('žádná chyba na stránce (PC)', chyby.length === 0, chyby.join(' | '));

  // ── 12. dotyk: telefon 375 px ──
  const ctxM = await b.newContext({ viewport: { width: 375, height: 760 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const t = await ctxM.newPage(); const errM = []; t.on('pageerror', e => errM.push(e.message)); t.on('dialog', d => d.accept());
  await priprav(t); await ukaz(t);
  const cdp = await ctxM.newCDPSession(t);
  const tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  // dlouhý stisk = menu
  let A = await zasBod(t, 'z1');
  await tp('touchStart', [{ x: A.x, y: A.y }]); await w(800); await tp('touchEnd', []); await w(300);
  const mm = await t.evaluate(() => [...document.querySelectorAll('.kt-menu .kt-pol')].map(e => e.textContent).join('|'));
  check('telefon: dlouhý stisk zásuvky otevře nabídku (Vlastnosti, Duplikovat, Smazat)', /Vlastnosti/.test(mm) && /Duplikovat/.test(mm) && /Smazat/.test(mm), mm.slice(0, 80));
  check('telefon: zvednutí prstu po dlouhém stisku nespustí položku pod prstem (označení beze změny)', await t.evaluate(() => __rz.celo.zasuvky.map(z => z.ozn).join(',') === '-XZ1,-XZ2,-XZ3,-XZ4,-XZ5,-XZ6' && !!document.querySelector('.kt-menu')));
  check('telefon: zásuvka nezměnila polohu dlouhým stiskem', await t.evaluate(() => zsZasNajit('z1').pos.x === 64 && zsZasNajit('z1').pos.y === 320));
  await t.keyboard.press('Escape'); await w(150);
  // tažení prstem
  A = await zasBod(t, 'z5'); const B2 = await bodMm(t, 234, 500);
  await tp('touchStart', [{ x: A.x, y: A.y }]); await w(60);
  for (let i = 1; i <= 10; i++) { await tp('touchMove', [{ x: A.x + (B2.x - A.x) * i / 10, y: A.y + (B2.y - A.y) * i / 10 }]); await w(30); }
  await tp('touchEnd', []); await w(300);
  const pz = await t.evaluate(() => zsZasNajit('z5').pos);
  check('telefon: tažení prstem posune zásuvku', pz.y > 470, JSON.stringify(pz));
  // dva prsty = přiblížení
  A = await bodMm(t, 150, 400); const z0 = await t.evaluate(() => __rz.zsZoom || 1);
  await tp('touchStart', [{ x: A.x - 20, y: A.y, id: 1 }, { x: A.x + 20, y: A.y, id: 2 }]); await w(40);
  for (let i = 1; i <= 8; i++) { await tp('touchMove', [{ x: A.x - 20 - i * 8, y: A.y, id: 1 }, { x: A.x + 20 + i * 8, y: A.y, id: 2 }]); await w(30); }
  await tp('touchEnd', []); await w(300);
  const z1 = await t.evaluate(() => __rz.zsZoom || 1);
  check('telefon: dva prsty přiblíží čelo', z1 > z0 * 1.3, z0 + ' → ' + z1);
  const sir = await t.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  check('telefon: stránka se neposouvá do strany', sir);
  check('telefon: žádná chyba na stránce', errM.length === 0, errM.join(' | '));
  await ctxM.close();

  await b.close();
  console.log(res.join('\n'));
  console.log('\n' + res.filter(r => r.startsWith('✅')).length + '/' + res.length + ' prošlo');
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})();
