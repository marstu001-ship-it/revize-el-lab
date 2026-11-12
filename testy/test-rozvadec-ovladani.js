// Čelní pohled „jako v dílně" — fáze 2: ovládání (2026-11-11). Skutečná klávesnice a myš.
//  1. vkládání příkazem („22x B10"): rozbor zápisů, náhled, přetečení do další řady, výchozí řada, Ctrl+Z, historie
//  2. lišta akcí u výběru: Duplikovat ×n, Hřeben, Chránič nad, Rozdělit fáze, Vyměnit za…, Smazat; geometrie, telefon
//  3. průvodce prvním rozvaděčem (jen poprvé, Přeskočit, Ukázat průvodce, bez localStorage)
//  4. RS2 na nejvýš 25 akcí + strom „kdo koho napájí"
//  5. starý rozvaděč bajtově beze změny (data, PDF, schéma, DXF) proti předchozí verzi (STARA_PORT)
// Všechna data vymyšlená (knihovna „Test LSN / LFN").
const { chromium } = require('./pw');
const path = require('path');
const PORT = process.env.PORT || 8901, STARA = process.env.STARA_PORT || 8902;
const URL = 'http://127.0.0.1:' + PORT + '/index.html', URL0 = 'http://127.0.0.1:' + STARA + '/index.html';
const res = []; const check = (n, ok, d) => { const t = (ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''); res.push(t); if (process.env.LADIT) console.log(t); };
const w = ms => new Promise(r => setTimeout(r, ms));
const SNIMKY = process.env.SNIMKY;   // složka pro snímky (jen na vyžádání)

async function kontext(b, o) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1600, height: 1000 } }, o || {}));
  await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: path.join(__dirname, 'knihovny', r.request().url().split('/').pop()), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  return ctx;
}
async function stranka(ctx, url, err) {
  const p = await ctx.newPage();
  p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(url || URL); await w(900);
  await p.evaluate(() => {
    window.__T = {
      w: ms => new Promise(r => setTimeout(r, ms)),
      cist: () => DOK_TYPY.rozv.cist(dokForm()),
      naj: o => { let r = null; __rz.rady.forEach(a => a.prvky.forEach(x => { if (x.ozn === o) r = x; })); return r; },
      rada: i => __rz.rady[i].prvky.map(x => x.ozn).join(' '),
      ozn: () => __rz.rady.map(a => a.prvky.map(x => x.ozn).join(' ')).join(' | '),
      nahled: () => { const n = document.getElementById('rzc-nahled'); return n ? n.className.replace('rzc-nahled ', '') + ': ' + n.textContent : null; },
      async novy(skrin) { await dokNovy('rozv'); if (skrin) rozvSkrinNastavit(rozvKnihPolozka(skrin)); await __T.w(40); }
    };
  });
  return p;
}
// příkaz skutečnou klávesnicí: / → psaní → (náhled) → Enter
async function prikaz(p, txt, o) {
  o = o || {};
  await p.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
  await p.keyboard.press('/'); await p.keyboard.type(txt); await w(30);
  const n = await p.evaluate(() => __T.nahled());
  if (!o.bezEnter) { await p.keyboard.press('Enter'); await w(60); }
  return n;
}

(async () => {
  const b = await chromium.launch();
  const err = [];
  const ctx = await kontext(b);
  const p = await stranka(ctx, URL, err);

  // ── 1. vkládání příkazem ──────────────────────────────────────────────
  const roz = await p.evaluate(async () => {
    await __T.novy('v-sk-4x24-ocel');
    const z = t => { const q = rzcRozbor(t); if (!q || q.chyba) return 'CHYBA ' + (q && q.chyba); const P = rzcPolozka(q); return P.chyba ? 'CHYBA ' + P.chyba : q.n + '×' + P.it.id + (q.vlozka ? ' vložka ' + q.vlozka : ''); };
    const T = ['22x B10', '22 B10', '22× b10', 'B16 3P', '3x C16 1P', '2x B25 3f', 'B10 1+N', 'fi 40/30 4p', 'chránič 40 30mA 4P', 'FI 40A 30mA typ A', 'fi 25/30 2p ac',
      'rcbo b16 30', 'fi/fa b16 30mA', 'hl 63 3p', 'vypínač 63A 3P', 'spd t2', 'spd t1+t2 3+1', 'spd t2 3+1', 'pojistky 3p 14x51', 'fu 3p 40gG', 'fu 1p',
      'rezerva 2', '2 M volno', 'svorky 20', '20x svorka 4', '3x svorka 10', 'B10x', 'ahoj', '22x', 'hl 3p', '500x B10', 'B80 1P'];
    const o = {}; T.forEach(t => o[t] = z(t)); return o;
  });
  const cekam = { '22x B10': '22×v-fa-1-B10', '22 B10': '22×v-fa-1-B10', '22× b10': '22×v-fa-1-B10', 'B16 3P': '1×v-fa-3-B16', '3x C16 1P': '3×v-fa-1-C16', '2x B25 3f': '2×v-fa-3-B25',
    'B10 1+N': '1×v-fa-1N-B10', 'fi 40/30 4p': '1×v-fi-4-40-30-A', 'chránič 40 30mA 4P': '1×v-fi-4-40-30-A', 'FI 40A 30mA typ A': '1×v-fi-4-40-30-A', 'fi 25/30 2p ac': '1×v-fi-2-25-30-AC',
    'rcbo b16 30': '1×v-fifa-1N-B16', 'fi/fa b16 30mA': '1×v-fifa-1N-B16', 'hl 63 3p': '1×v-qm-3-63', 'vypínač 63A 3P': '1×v-qm-3-63', 'spd t2': '1×v-spd-2-3N', 'spd t1+t2 3+1': '1×v-spd-12-3N',
    'spd t2 3+1': '1×v-spd-2-31', 'pojistky 3p 14x51': '1×v-fu-3-1451-50', 'fu 3p 40gG': '1×v-fu-3-1451-50 vložka 40 gG', 'fu 1p': '1×v-fu-1-1038',
    'rezerva 2': '1×v-rez-2', '2 M volno': '1×v-rez-2', 'svorky 20': '20×v-x-rad-25', '20x svorka 4': '20×v-x-rad-4', '3x svorka 10': '3×v-x-rad-10' };
  const spatne = Object.keys(cekam).filter(k => roz[k] !== cekam[k]).map(k => k + ' → ' + roz[k]);
  check('příkaz: rozbor všech zápisů z tabulky (jistič, póly, 1+N, chránič, RCBO, vypínač, SPD, pojistky s vložkou, rezerva, svorky)', !spatne.length, spatne.join('; '));
  check('příkaz: nerozpoznaný zápis vrátí „Nerozumím…" (B10x, ahoj, 22x), chybějící proud, moc kusů a přístroj mimo knihovnu',
    /^CHYBA Nerozumím „B10x“ – zkuste např\. 22x B10$/.test(roz['B10x']) && /^CHYBA Nerozumím/.test(roz['ahoj']) && /^CHYBA/.test(roz['22x']) && /chybí proud/.test(roz['hl 3p']) && /1 až 200/.test(roz['500x B10']) && /v knihovně není/.test(roz['B80 1P']),
    [roz['B10x'], roz['ahoj'], roz['22x'], roz['hl 3p'], roz['500x B10'], roz['B80 1P']].join(' | '));

  // pole je nad čelním pohledem, / do něj skočí
  const pole = await p.evaluate(() => { const e = document.getElementById('rzc-pole'), r = document.getElementById('rz-svg-ram'); return e && { ph: e.placeholder, nad: e.getBoundingClientRect().bottom <= r.getBoundingClientRect().top, vPohledu: !!e.closest('#rz-pohled') }; });
  await p.keyboard.press('/');
  const fok = await p.evaluate(() => document.activeElement.id);
  check('příkaz: pole „Napiš, co vložit… (např. 22x B10)" nad čelním pohledem, klávesa / do něj skočí', pole && pole.ph === 'Napiš, co vložit… (např. 22x B10)' && pole.nad && fok === 'rzc-pole', JSON.stringify(pole) + ' ' + fok);
  await p.keyboard.press('Escape');

  // nerozpoznaný zápis nic nevloží
  let n = await prikaz(p, 'B10x');
  let st = await p.evaluate(() => ({ pocet: rozvVse().length, n: __T.nahled(), v: document.getElementById('rzc-pole').value }));
  check('příkaz: „B10x" → „Nerozumím „B10x“ – zkuste např. 22x B10" a nic se nevloží', st.pocet === 0 && /^chyba: Nerozumím „B10x“ – zkuste např\. 22x B10/.test(st.n) && st.v === 'B10x', JSON.stringify(st));
  await p.keyboard.press('Escape');
  st = await p.evaluate(() => ({ v: (document.getElementById('rzc-pole') || {}).value, f: document.activeElement.id }));
  check('příkaz: Esc pole vyprázdní a opustí', st.v === '' && st.f !== 'rzc-pole', JSON.stringify(st));

  // 22x B10 do řady se 24 volnými moduly
  n = await prikaz(p, '22x B10', { bezEnter: true });
  check('příkaz: náhled „22× Jistič 1P B10 → řada 1 · zabere 22 M, zbude 2 M" ještě před Enterem', /^ok: 22× Jistič 1P B10 → řada 1 · zabere 22 M, zbude 2 M/.test(n), n);
  if (SNIMKY) { await p.evaluate(() => { document.getElementById('toast-wrap').innerHTML = ''; window.scrollTo(0, document.getElementById('rz-pohled').getBoundingClientRect().top + scrollY - 90); }); await p.screenshot({ path: SNIMKY + '/1-pole-prikazu-nahled.png' }); }
  await p.keyboard.press('Enter'); await w(80);
  st = await p.evaluate(() => ({ r0: __T.rada(0), pocet: rozvVse().length, vyber: rozvVybrane().length, f: document.activeElement.id, v: document.getElementById('rzc-pole').value, kid: __rz.rady[0].prvky[0].knih, mez: __rz.rady[0].prvky.some(x => x.mezera) }));
  const fa22 = Array.from({ length: 22 }, (_, i) => '-FA' + (i + 1)).join(' ');
  check('příkaz: „22x B10" vloží 22 jističů B10 1P s označením -FA1 … -FA22, těsně vedle sebe', st.r0 === fa22 && st.pocet === 22 && st.kid === 'v-fa-1-B10' && !st.mez, st.r0);
  check('příkaz: po vložení je pole prázdné a připravené na další příkaz, vložené přístroje jsou vybrané', st.f === 'rzc-pole' && st.v === '' && st.vyber === 22, JSON.stringify({ f: st.f, v: st.v, vyber: st.vyber }));
  // Ctrl+Z vrátí celé vložení najednou
  await p.keyboard.press('Control+z'); await w(80);
  st = await p.evaluate(() => rozvVse().length);
  check('příkaz: Ctrl+Z (v prázdném poli) vrátí celé vložení najednou', st === 0, 'zbylo ' + st);
  // historie šipkou nahoru
  await p.keyboard.press('/'); await p.keyboard.press('ArrowUp');
  const h1 = await p.evaluate(() => document.getElementById('rzc-pole').value);
  await p.keyboard.press('ArrowUp'); const h2 = await p.evaluate(() => document.getElementById('rzc-pole').value);
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); const h3 = await p.evaluate(() => document.getElementById('rzc-pole').value);
  check('příkaz: šipka nahoru vrací předchozí příkazy, dolů zpět k prázdnému poli', h1 === '22x B10' && h2 === '22x B10' && h3 === '', [h1, h2, h3].join(' | '));
  await p.keyboard.press('Escape');

  // navazující označení a přetečení do další řady
  await prikaz(p, '22x B10');
  n = await prikaz(p, '30x B16', { bezEnter: true });
  check('příkaz: „30x B16" za -FA22 — náhled předem hlásí „2 do řady 1, 24 do řady 2, 4 do řady 3"', /^ok: 30× Jistič 1P B16 → 2 do řady 1, 24 do řady 2, 4 do řady 3 · zabere 30 M, ve skříni zbude 44 M/.test(n), n);
  await p.keyboard.press('Enter'); await w(80);
  st = await p.evaluate(() => ({ p: __rz.rady.map(a => a.prvky.length).join(), prvni: __rz.rady[0].prvky[22].ozn, posl: __rz.rady[2].prvky[3].ozn, b16: __rz.rady[1].prvky.every(x => x.p.In === 16), pre: rozvPreplnene(__rz).length }));
  check('příkaz: 30 jističů přeteče do dalších řad (24 / 24 / 4), označení plynule -FA23 … -FA52, nic není přeplněné', st.p === '24,24,4,0' && st.prvni === '-FA23' && st.posl === '-FA52' && st.b16 && st.pre === 0, JSON.stringify(st));
  // nevejde se všechno: jen kolik se vejde, a až po Enteru
  n = await prikaz(p, '50x B10', { bezEnter: true });
  const pred = await p.evaluate(() => rozvVse().length);
  check('příkaz: co se nevejde nikam — náhled upozorní „Vejde se jen 44 z 50 — Enter vloží 44" a před Enterem se nic nevloží', /^varuj: ⚠ Vejde se jen 44 z 50 — Enter vloží 44\./.test(n) && pred === 52, n);
  await p.keyboard.press('Enter'); await w(80);
  st = await p.evaluate(() => ({ pocet: rozvVse().length, pre: rozvPreplnene(__rz).length, volno: rozvVolnoCelkem(__rz).volno }));
  check('příkaz: po Enteru se vloží jen 44, skříň je plná a nic nepřetéká', st.pocet === 96 && st.pre === 0 && st.volno === 0, JSON.stringify(st));
  n = await prikaz(p, 'B10');
  st = await p.evaluate(() => rozvVse().length);
  check('příkaz: do plné skříně se nevloží nic a náhled to řekne', /^chyba: ⚠ 1× Jistič 1P B10 — do skříně se už nevejde/.test(n) && st === 96, n);
  await p.keyboard.press('Escape');

  // kam: za vybraný přístroj / konec vybrané řady / první řada s místem; vložka pojistky; hlavní vypínač
  st = await p.evaluate(async () => {
    await __T.novy('v-sk-4x24-ocel');
    return true;
  });
  await prikaz(p, 'hl 63 3p'); await prikaz(p, '4x B16'); 
  await p.evaluate(() => { rozvVyberNastavit([__T.naj('-FA2').uid]); rozvPohledVykreslit(); });
  n = await prikaz(p, 'fu 3p 40gG');
  st = await p.evaluate(() => ({ r: __T.rada(0), vl: __T.naj('-FU1').vlozka, qh: __rz.rady[0].prvky[0].p.kat }));
  check('příkaz: vkládá se za vybraný přístroj (-FU1 za -FA2), pojistka dostane vložku 40 gG, „hl 63 3p" je -QH1', st.r === '-QH1 -FA1 -FA2 -FU1 -FA3 -FA4' && st.vl === '40 gG' && /řada 1 za -FA2/.test(n), st.r + ' | ' + n);
  await p.evaluate(() => { rozvVyberNastavit([]); __rz.aktRada = 2; rozvPohledVykreslit(); });
  await prikaz(p, 'rezerva 2'); await p.evaluate(() => { rozvVyberNastavit([]); rozvPohledVykreslit(); });
  n = await prikaz(p, '2x B25 3f');
  st = await p.evaluate(() => ({ r2: __rz.rady[2].prvky.map(x => x.p.kat + rozvW(x)).join(' '), f: __rz.rady[2].prvky[1].faze }));
  check('příkaz: bez výběru na konec vybrané řady (řada 3: rezerva 2 M, pak 2× B25 3P s fází 3f)', st.r2 === 'REZ2 FA3 FA3' && st.f === '3f', JSON.stringify(st) + ' ' + n);

  // výchozí řada ze syntetické knihovny
  st = await p.evaluate(async () => {
    const mk = (kat, typ, o) => Object.assign({ id: 'u-' + typ, druh: 'pristroj', kat, nazev: typ, vyrobce: 'Test', typ, sirka: 1, zdroj: 'import', overeno: true }, o);
    await __T.novy('v-sk-4x24-ocel');
    DOK.rozvKnihovna = [mk('FA', 'LSN 10B/1', { rada: 'LSN', poly: '1', In: 10, char: 'B', pv: 1.4 }), mk('FA', 'LSN 16B/1', { rada: 'LSN', poly: '1', In: 16, char: 'B', pv: 2.1 }),
      mk('FI', 'LFN 40-4-030A', { rada: 'LFN', poly: '4', In: 40, idn: 30, rcdTyp: 'A', sirka: 4, pv: 3.2 })].map(x => rozvPolozkaNorm(x, 'pristroj'));
    await dokZapsat(); await __T.w(100);
    rozvVlastnostiVykreslit();
    const sel = [...document.querySelectorAll('.rzc-rada')].map(s => s.getAttribute('data-kat') + ':' + [...s.options].map(o => o.textContent).join('/'));
    const s = document.querySelector('.rzc-rada[data-kat="FA"]'); s.value = 'Test|LSN'; s.dispatchEvent(new Event('change', { bubbles: true }));
    return { sel, ulozeno: localStorage.getItem('revize_el_rz_rada'), text: document.querySelector('.rzc-nast').textContent };
  });
  check('výchozí řada: v Nastavení konfigurátoru pole „Výchozí řada" s řadami z knihovny (jističe Test LSN, chrániče Test LFN), uloží se jen do prohlížeče',
    st.sel.join() === 'FA:obecné přístroje/Test LSN,FI:obecné přístroje/Test LFN' && /"FA":"Test\|LSN"/.test(st.ulozeno) && /Výchozí řada/.test(st.text), JSON.stringify(st.sel) + ' ' + st.ulozeno);
  n = await prikaz(p, '3x B10');
  const n2 = await prikaz(p, 'C16 1P');
  st = await p.evaluate(() => ({ a: __rz.rady[0].prvky.map(x => x.knih + ':' + x.p.pv + ':' + (x.p.vyrobce || '')).join(' '), d: JSON.stringify(__T.cist().rady[0].prvky[0].p) }));
  check('výchozí řada: „3x B10" vloží přístroj z řady (Test LSN 10B/1 s Pv 1,4), náhled řadu jmenuje; co v řadě není (C16), je obecné',
    st.a === 'u-LSN 10B/1:1.4:Test u-LSN 10B/1:1.4:Test u-LSN 10B/1:1.4:Test v-fa-1-C16::obecný' && /3× Jistič 1P B10 · Test LSN 10B\/1 →/.test(n) && !/Test/.test(n2), st.a + ' | ' + n);
  await p.evaluate(async () => { DOK.rozvKnihovna = []; await dokZapsat(); localStorage.removeItem('revize_el_rz_rada'); });

  // ── 2. lišta akcí u výběru ────────────────────────────────────────────
  const klikA = async (akce) => { await p.click('#rz-akce [data-action="' + akce + '"]'); await w(80); };
  const lista = () => p.evaluate(() => {
    const el = document.getElementById('rz-akce'); if (!el) return null;
    const b = el.getBoundingClientRect(), ram = document.getElementById('rz-svg-ram').getBoundingClientRect();
    const sel = rozvVybrane().map(u => document.querySelector('#rz-svg-ram [data-puid="' + u + '"]').getBoundingClientRect());
    const prekryv = sel.some(s => !(b.right <= s.left || b.left >= s.right || b.bottom <= s.top || b.top >= s.bottom));
    return { kde: el.getAttribute('data-kde'), tl: [...el.querySelectorAll('button')].map(x => x.textContent.trim()).join(' | '), prekryv, vRamu: b.top >= ram.top && b.bottom <= ram.bottom + 1 && b.left >= ram.left && b.right <= ram.right + 1,
      nadPrvni: b.bottom <= Math.min(...sel.map(s => s.top)), podPosl: b.top >= Math.max(...sel.map(s => s.bottom)), h: Math.round(b.height), pos: getComputedStyle(el).position };
  });
  await p.evaluate(async () => { await __T.novy('v-sk-4x24-ocel'); __rz.aktRada = 1; rozvPohledVykreslit(); });
  let L = await lista();
  check('lišta: bez výběru není', L === null, JSON.stringify(L));
  await prikaz(p, 'B16');
  await p.evaluate(() => document.activeElement.blur());
  L = await lista();
  check('lišta: u jednoho jističe Duplikovat, Chránič nad, Vyměnit za…, Smazat — nad výběrem a nezakrývá ho',
    L && L.tl === '⧉ Duplikovat | 🛡 Chránič nad | 🔁 Vyměnit za… | 🗑 Smazat' && L.kde === 'nad' && L.nadPrvni && !L.prekryv && L.vRamu, JSON.stringify(L));
  // Duplikovat: klik = 1 kopie vedle; ×10 + Enter
  await klikA('tdRaDuplikovat');
  st = await p.evaluate(() => ({ r: __T.rada(1), vyb: rozvVybrane().length }));
  check('lišta: Duplikovat přidá 1 kopii hned vedle (-FA2) a vybere ji', st.r === '-FA1 -FA2' && st.vyb === 1, JSON.stringify(st));
  await p.click('#rza-n'); await p.keyboard.press('Control+a'); await p.keyboard.type('10'); await p.keyboard.press('Enter'); await w(100);
  st = await p.evaluate(() => ({ r: __rz.rady[1].prvky.length, posl: __rz.rady[1].prvky[11].ozn, vyb: rozvVybrane().length, stejne: __rz.rady[1].prvky.every(x => x.knih === 'v-fa-1-B16') }));
  check('lišta: Duplikovat ×10 (číslo do políčka + Enter) přidá 10 kopií, označení -FA3 … -FA12, kopie jsou vybrané', st.r === 12 && st.posl === '-FA12' && st.vyb === 10 && st.stejne, JSON.stringify(st));
  await p.keyboard.press('Control+z'); await w(80);
  st = await p.evaluate(() => __rz.rady[1].prvky.length);
  check('lišta: Ctrl+Z vrátí všech 10 kopií najednou', st === 2, 'zbylo ' + st);

  // Hřeben přes 20 jističů; odmítnutí přes dvě řady
  await p.evaluate(async () => { await __T.novy('v-sk-4x24-ocel'); delete STORE.technik.rz_hreben_strana; __rz.aktRada = 1; rozvPohledVykreslit(); });
  await prikaz(p, '20x B16'); await p.evaluate(() => document.activeElement.blur());
  L = await lista();
  check('lišta: u 20 jističů v řadě přibude Hřeben a Rozdělit fáze; lišta je nad výběrem a nezakrývá ho', L && /🪮 Hřeben/.test(L.tl) && /⚖ Rozdělit fáze/.test(L.tl) && /^Vybráno 20/.test(await p.evaluate(() => document.querySelector('#rz-akce .rza-pocet').textContent)) && L.nadPrvni && !L.prekryv, JSON.stringify(L));
  if (SNIMKY) { await p.evaluate(() => { document.getElementById('toast-wrap').innerHTML = ''; window.scrollTo(0, document.getElementById('rz-pohled').getBoundingClientRect().top + scrollY - 90); }); await w(100); await p.screenshot({ path: SNIMKY + '/2-lista-akci.png' }); }
  await klikA('tdRaHreben');
  st = await p.evaluate(() => { const h = (__rz.hrebeny || [])[0]; return h && { n: __rz.hrebeny.length, rada: h.rada, od: h.od, do: h.do, poly: h.poly, strana: h.strana, kryte: rzhKryte(h).length, vyb: rozvVybrane().length, lista: !!document.getElementById('rz-akce'), d: (__T.cist().hrebeny || []).length }; });
  check('lišta: Hřeben natáhne hřeben přes 20 vybraných jističů (1P, shora, moduly 0–20), výběr zůstane', st && st.n === 1 && st.rada === 1 && st.od === 0 && st.do === 20 && st.poly === '1' && st.strana === 'nahore' && st.kryte === 20 && st.vyb === 20 && st.lista && st.d === 1, JSON.stringify(st));
  await p.keyboard.press('Control+z'); await w(80);
  st = await p.evaluate(() => (__rz.hrebeny || []).length);
  check('lišta: Ctrl+Z hřeben vrátí', st === 0, 'hřebenů ' + st);
  await p.evaluate(() => { rozvVyberNastavit([]); rozvPohledVykreslit(); });
  await prikaz(p, '6x B10'); await p.evaluate(() => document.activeElement.blur());   // 4 do řady 2, 2 do řady 3
  st = await p.evaluate(() => ({ rozl: __rz.rady.map(a => a.prvky.length).join(), cls: document.querySelector('#rz-akce [data-action="tdRaHreben"]').className, tit: document.querySelector('#rz-akce [data-action="tdRaHreben"]').title }));
  await klikA('tdRaHreben');
  const st2 = await p.evaluate(() => ({ h: (__rz.hrebeny || []).length, toast: [...document.querySelectorAll('#toast-wrap > *')].map(x => x.textContent).join(' ¦ ') }));
  check('lišta: Hřeben přes dvě řady odmítne („jen po jedné řadě") a nic neudělá', st.rozl === '0,24,2,0' && /rza-ne/.test(st.cls) && /v jedné řadě/.test(st.tit) && st2.h === 0 && /Hřeben vede jen po jedné řadě/.test(st2.toast), JSON.stringify(st) + ' ' + st2.toast.slice(0, 200));

  // Chránič nad 20 jističi
  await p.evaluate(async () => { await __T.novy('v-sk-4x24-ocel'); localStorage.removeItem('revize_el_rz_fi_hreben'); });
  await prikaz(p, 'hl 63 3p'); await p.evaluate(() => { rozvVyberNastavit([]); __rz.aktRada = 1; rozvPohledVykreslit(); });
  await prikaz(p, '20x B16'); await p.evaluate(() => document.activeElement.blur());
  await klikA('tdRaChranic');
  st = await p.evaluate(() => { const g = k => document.querySelector('#rz-akce .rza-fi[data-fi="' + k + '"]').value; return { In: g('In'), idn: g('idn'), typ: g('typ'), poly: g('poly'), info: document.querySelector('.rza-fi-info').textContent, pocet: rozvVse().length, tl: [...document.querySelectorAll('#rz-akce button')].map(x => x.textContent).join('|') }; });
  check('lišta: Chránič nad nejdřív ukáže návrh 40 A / 30 mA / typ A / 4P (dá se změnit) a nic nevloží', st.In === '40' && st.idn === '30' && st.typ === 'A' && st.poly === '4' && st.pocet === 21 && /Chránič 4P 40 A \/ 30 mA typ A/.test(st.info) && /součet In jističů 320 A/.test(st.info) && /✓ Vložit chránič\|Zrušit/.test(st.tl), JSON.stringify(st));
  await p.selectOption('#rz-akce .rza-fi[data-fi="In"]', '63'); await w(60);
  st = await p.evaluate(() => document.querySelector('.rza-fi-info').textContent);
  check('lišta: parametry chrániče jdou před vložením změnit (63 A)', /Chránič 4P 63 A \/ 30 mA typ A/.test(st), st);
  await p.selectOption('#rz-akce .rza-fi[data-fi="In"]', '40'); await w(60);
  await klikA('tdRaChranicVlozit');
  st = await p.evaluate(() => { const fi = __T.naj('-FI1'), r = __rz.rady[1].prvky; return fi && { prvni: r[0].ozn, kid: fi.knih, n: r.length, pod: r.slice(1).every(x => x.nadr === fi.uid && !x.nadrRucne), vyb: rozvVybrane().length, strom: rozvDeti(fi.uid).length, hreb: (__rz.hrebeny || []).length }; });
  check('lišta: chránič -FI1 40 A / 30 mA 4P je vlevo před prvním jističem a všech 20 jističů je pod ním (automatikou, bez hřebenu)', st && st.prvni === '-FI1' && st.kid === 'v-fi-4-40-30-A' && st.n === 21 && st.pod && st.strom === 20 && st.vyb === 20 && st.hreb === 0, JSON.stringify(st));
  await p.keyboard.press('Control+z'); await w(80);
  // s nastavením „natáhnout hřeben"
  st = await p.evaluate(() => { rozvVyberNastavit([]); rozvPohledVykreslit(); rozvVlastnostiVykreslit(); const c = document.querySelector('.rza-nast-fi'); if (!c) return null; c.click(); const u = localStorage.getItem('revize_el_rz_fi_hreben'); rozvVyberNastavit(__rz.rady[1].prvky.map(x => x.uid)); rozvPohledVykreslit(); return { u, n: __rz.rady[1].prvky.length, popis: c.closest('label').textContent }; });
  check('lišta: nastavení „Při vkládání chrániče natáhnout hřeben" je v Nastavení konfigurátoru (jen v prohlížeči)', st && st.u === '1' && st.n === 20 && /Při vkládání chrániče natáhnout hřeben/.test(st.popis), JSON.stringify(st));
  await klikA('tdRaChranic'); await klikA('tdRaChranicVlozit');
  st = await p.evaluate(() => { const fi = __T.naj('-FI1'), h = (__rz.hrebeny || [])[0], wv = (__rz.vodice || [])[0], r = __rz.rady[1].prvky; return fi && h && wv && { od: h.od, do: h.do, poly: h.poly, kryte: rzhKryte(h).length, zFi: wv.a.uid === fi.uid && wv.b.uid === h.uid, pod: r.slice(1).every(x => x.nadr === fi.uid), faze: r.slice(1, 7).map(x => x.faze).join() }; });
  check('lišta: se zapnutým nastavením chránič napojí jističe hřebenem 3P s vodičem z výstupu chrániče (fáze L1, L2, L3… ze zubů)', st && st.od === 4 && st.do === 24 && st.poly === '3' && st.kryte === 20 && st.zFi && st.pod && st.faze === 'L1,L2,L3,L1,L2,L3', JSON.stringify(st));
  await p.keyboard.press('Control+z'); await w(80);
  st = await p.evaluate(() => ({ n: __rz.rady[1].prvky.length, h: (__rz.hrebeny || []).length, v: (__rz.vodice || []).length }));
  check('lišta: Ctrl+Z vrátí chránič, hřeben i vodič najednou', st.n === 20 && st.h === 0 && st.v === 0, JSON.stringify(st));
  // není místo v řadě
  await p.evaluate(() => { localStorage.removeItem('revize_el_rz_fi_hreben'); rozvVyberNastavit([__rz.rady[1].prvky[19].uid]); rozvPohledVykreslit(); });
  await prikaz(p, '2x B10 3P'); await p.evaluate(() => { document.activeElement.blur(); rozvVyberNastavit(__rz.rady[1].prvky.slice(0, 5).map(x => x.uid)); rozvPohledVykreslit(); });
  await klikA('tdRaChranic');
  st = await p.evaluate(() => ({ dis: document.querySelector('#rz-akce [data-action="tdRaChranicVlozit"]').disabled, info: document.querySelector('.rza-fi-info').textContent, n: __rz.rady[1].prvky.length }));
  check('lišta: když v řadě není místo pro chránič, upozorní a nic neudělá', st.dis && /V řadě 2 není místo pro chránič \(4 moduly, volno 1 modul\)/.test(st.info) && st.n === 21, JSON.stringify(st));
  await klikA('tdRaChranicZrusit');

  // Rozdělit fáze (se zamčenou fází a přístrojem na hřebenu)
  await p.evaluate(async () => { await __T.novy('v-sk-4x24-ocel'); });
  await prikaz(p, '9x B10'); await p.evaluate(() => { document.activeElement.blur(); const r = __rz.rady[0].prvky; r[1].faze = 'L3'; r[1].fazeZamek = true; rozvPohledVykreslit(); });
  await klikA('tdRaFaze');
  st = await p.evaluate(() => ({ f: __rz.rady[0].prvky.map(x => x.faze).join(), toast: [...document.querySelectorAll('#toast-wrap > *')].map(x => x.textContent).join(' ¦ ') }));
  check('lišta: Rozdělit fáze dá L1, L2, L3, L1… a zamčenou fázi vynechá (zůstane L3)', st.f === 'L1,L3,L2,L3,L1,L2,L3,L1,L2' && /1 se zamčenou fází vynecháno/.test(st.toast), st.f + ' ' + st.toast.slice(0, 160));
  await p.keyboard.press('Control+z'); await w(60);
  await p.evaluate(() => { const r = __rz.rady[0].prvky; rozvVyberNastavit(r.slice(0, 4).map(x => x.uid)); rozvPohledVykreslit(); });
  await klikA('tdRaHreben');
  await p.evaluate(() => { rozvVyberNastavit(__rz.rady[0].prvky.map(x => x.uid)); rozvPohledVykreslit(); });
  const fPred = await p.evaluate(() => __rz.rady[0].prvky.slice(0, 4).map(x => x.faze).join());
  await klikA('tdRaFaze');
  st = await p.evaluate(() => ({ f4: __rz.rady[0].prvky.slice(0, 4).map(x => x.faze).join(), f: __rz.rady[0].prvky.slice(4).map(x => x.faze).join(), toast: [...document.querySelectorAll('#toast-wrap > *')].map(x => x.textContent).join(' ¦ ') }));
  check('lišta: u přístrojů na hřebenu Rozdělit fáze jen upozorní, že fáze plyne ze zapojení (ostatní rozdělí)', st.f4 === fPred && st.f === 'L1,L2,L3,L1,L2' && /má fázi ze zapojení \(hřeben \/ vodič\)/.test(st.toast), JSON.stringify({ fPred, f4: st.f4, f: st.f }) + st.toast.slice(-200));

  // Vyměnit za…
  st = await p.evaluate(async () => {
    await __T.novy('v-sk-4x24-ocel');
    DOK.rozvKnihovna = [{ id: 'u-lsn10', druh: 'pristroj', kat: 'FA', nazev: 'Jistič LSN 10B/1', vyrobce: 'Test', rada: 'LSN', typ: 'LSN 10B/1', poly: '1', In: 10, char: 'B', sirka: 1, pv: 1.4, zdroj: 'import', overeno: true },
      { id: 'u-lsn16', druh: 'pristroj', kat: 'FA', nazev: 'Jistič LSN 16B/1', vyrobce: 'Test', rada: 'LSN', typ: 'LSN 16B/1', poly: '1', In: 16, char: 'B', sirka: 1, pv: 2.1, zdroj: 'import', overeno: true }].map(x => rozvPolozkaNorm(x, 'pristroj'));
    await dokZapsat(); await __T.w(100);
    return rozvKnihovnaVse().filter(x => x.vyrobce === 'Test').length;
  });
  await prikaz(p, '5x B10'); await p.evaluate(() => { document.activeElement.blur(); const r = __rz.rady[0].prvky; r.forEach((x, i) => { x.vyvod = 'Světla ' + (i + 1); x.kabel = 'CYKY-J'; x.prurez = '3×1,5'; x.faze = ['L1', 'L2', 'L3'][i % 3]; }); r[2].mezera = 1; rozvPohledVykreslit(); });
  await klikA('tdRaVymenit');
  st = await p.evaluate(() => ({ open: document.getElementById('modal-rz-vymena').classList.contains('open'), pol: [...document.querySelectorAll('.rz-vym-pol')].map(e => e.querySelector('b').textContent + (e.querySelector('button').disabled ? ' (nyní)' : '')).join(' | '), text: document.getElementById('rz-vym-obsah').textContent.slice(0, 160) }));
  check('lišta: Vyměnit za… otevře knihovnu předfiltrovanou na stejnou kategorii, póly, In a charakteristiku (jen B10 1P, bez B16)', st.open && st.pol === 'Jistič LSN 10B/1 | Jistič 1P B10 (nyní)' && /Jistič · 1P · B10/.test(st.text), JSON.stringify(st));
  await p.click('.rz-vym-pol [data-kid="u-lsn10"]'); await w(100);
  st = await p.evaluate(() => { const r = __rz.rady[0].prvky; return { knih: r.map(x => x.knih).join(), pv: r.map(x => x.p.pv).join(), ozn: r.map(x => x.ozn).join(), vyv: r[4].vyvod + '|' + r[4].kabel + '|' + r[4].prurez + '|' + r[4].faze, mez: r[2].mezera, open: document.getElementById('modal-rz-vymena').classList.contains('open') }; });
  check('lišta: výběr nahradí všech 5 přístrojů (Pv 1,4) — označení, pozice (mezera), vývod, kabel i fáze zůstanou', st.knih === 'u-lsn10,u-lsn10,u-lsn10,u-lsn10,u-lsn10' && st.pv === '1.4,1.4,1.4,1.4,1.4' && st.ozn === '-FA1,-FA2,-FA3,-FA4,-FA5' && st.vyv === 'Světla 5|CYKY-J|3×1,5|L2' && st.mez === 1 && !st.open, JSON.stringify(st));
  await p.keyboard.press('Control+z'); await w(60);
  st = await p.evaluate(() => __rz.rady[0].prvky.map(x => x.knih).join());
  check('lišta: Ctrl+Z výměnu vrátí', st === 'v-fa-1-B10,v-fa-1-B10,v-fa-1-B10,v-fa-1-B10,v-fa-1-B10', st);
  await p.evaluate(() => { rozvVyberNastavit(__rz.rady[0].prvky.map(x => x.uid)); rozvPohledVykreslit(); });
  // Smazat + Ctrl+Z, Esc zavře lištu i výběr
  await klikA('tdRSmazat');
  st = await p.evaluate(() => ({ n: rozvVse().length, lista: !!document.getElementById('rz-akce') }));
  await p.keyboard.press('Control+z'); await w(60);
  const poZ = await p.evaluate(() => rozvVse().length);
  check('lišta: Smazat smaže vybrané (lišta zmizí), Ctrl+Z je vrátí', st.n === 0 && !st.lista && poZ === 5, JSON.stringify(st) + ' ' + poZ);
  await p.evaluate(() => { rozvVyberNastavit(__rz.rady[0].prvky.map(x => x.uid)); rozvPohledVykreslit(); });
  await p.keyboard.press('Escape'); await w(60);
  st = await p.evaluate(() => ({ lista: !!document.getElementById('rz-akce'), vyb: rozvVybrane().length }));
  check('lišta: Esc ji zavře i s výběrem', !st.lista && st.vyb === 0, JSON.stringify(st));
  // první řada nahoře: nad ní není místo → lišta pod výběrem; režim Zapojení a tažení lištu schovají
  await p.evaluate(() => { rozvVyberNastavit(__rz.rady[0].prvky.map(x => x.uid)); __rz.kRucni = 2.3; rozvPohledVykreslit(); });
  L = await lista();
  check('lišta: když nad výběrem není místo (první řada), je pod ním a výběr nezakrývá', L && L.kde === 'pod' && L.podPosl && !L.prekryv && L.vRamu, JSON.stringify(L));
  const g1 = await p.evaluate(() => { const b = document.querySelector('#rz-svg-ram [data-puid="' + __rz.rady[0].prvky[0].uid + '"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await p.mouse.move(g1.x, g1.y); await p.mouse.down(); await p.mouse.move(g1.x + 40, g1.y + 60, { steps: 4 });
  const priTahu = await p.evaluate(() => { const e = document.getElementById('rz-akce'); return !e || getComputedStyle(e).display === 'none'; });
  await p.keyboard.press('Escape'); await p.mouse.up(); await w(80);
  await p.evaluate(() => { TD_AKCE.tdRNapRezim(); });
  const vZap = await p.evaluate(() => !!document.getElementById('rz-akce'));
  await p.evaluate(() => { TD_AKCE.tdRNapRezim(); __rz.kRucni = null; rozvPohledVykreslit(); });
  check('lišta: při tažení přístroje se schová a v režimu Zapojení se neukazuje', priTahu && !vZap, JSON.stringify({ priTahu, vZap }));
  await p.evaluate(async () => { DOK.rozvKnihovna = []; await dokZapsat(); });

  // telefon 360 px: lišta je dole na obrazovce
  {
    const ctxM = await kontext(b, { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
    const pm = await stranka(ctxM, URL, err);
    const M = await pm.evaluate(async () => {
      await __T.novy('v-sk-2x12-n'); const a = rozvVlozit('v-fa-1-B16', 0, 0), c = rozvVlozit('v-fa-1-B16', 0, 1);
      rozvVyberNastavit([a.uid, c.uid]); rozvPohledVykreslit(); await __T.w(60);
      const el = document.getElementById('rz-akce'), bb = el.getBoundingClientRect(), pole = document.getElementById('rzc-pole');
      return { pos: getComputedStyle(el).position, dole: Math.round(innerHeight - bb.bottom), l: Math.round(bb.left), w: Math.round(bb.width), h: Math.round(bb.height), tl: [...el.querySelectorAll('button')].every(x => x.getBoundingClientRect().height >= 44), pismo: getComputedStyle(pole).fontSize, sirkaStr: document.documentElement.scrollWidth };
    });
    check('lišta: na šířce 360 px je dole na obrazovce přes celou šířku, tlačítka aspoň 44 px, pole příkazu má písmo 16 px a stránka se nerozšíří', M.pos === 'fixed' && M.dole === 0 && M.l === 0 && M.w === 360 && M.tl && M.pismo === '16px' && M.sirkaStr <= 360, JSON.stringify(M));
    await ctxM.close();
  }

  // ── 3. průvodce prvním rozvaděčem ─────────────────────────────────────
  {
    const cv = await kontext(b), ev = [];
    const v = await stranka(cv, URL, ev);
    const pruv = () => v.evaluate(() => { const e = document.getElementById('rz-pruvodce'); if (!e || e.style.visibility === 'hidden') return null; const c = document.querySelector('.rz-pruv-cil');
      const cb = c ? c.getBoundingClientRect() : null, eb = e.getBoundingClientRect();
      return { videt: !!cb && cb.top >= 100 && (cb.height > 240 ? cb.top < innerHeight - 200 : cb.bottom <= innerHeight) && (cb.height > 240 || eb.bottom <= cb.top || eb.top >= cb.bottom || eb.right <= cb.left || eb.left >= cb.right), t: e.querySelector('b').textContent, cil: c ? (c.id || c.className.replace(/\s*rz-pruv-cil/, '')) : null, tl: [...e.querySelectorAll('button')].map(x => x.textContent).join('|'), vOkne: (r => r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth)(e.getBoundingClientRect()), pe: getComputedStyle(e).pointerEvents }; });
    await v.evaluate(async () => { await dokNovy('rozv'); });
    check('průvodce: před výběrem skříně se neukazuje', await pruv() === null);
    await v.click('#rz-seznam [data-kid="v-sk-4x24-ocel"] [data-action="tdRSkrinPouzit"]'); await w(300);
    let P = await pruv();
    check('průvodce: při prvním novém rozvaděči (po výběru skříně) krok 1 ukazuje na pole příkazu — „Napiš, co vložit – třeba 22x B10" (pole je vidět pod lištami a bublina ho nezakrývá)', P && /^1 \/ 4 · Napiš, co vložit – třeba 22x B10$/.test(P.t) && P.cil === 'rzc-pole' && P.tl === 'Přeskočit|Další →' && P.vOkne && P.pe === 'none' && P.videt, JSON.stringify(P));
    if (SNIMKY) { await v.evaluate(() => { const tw = document.getElementById('toast-wrap'); if (tw) tw.innerHTML = ''; }); await w(100); await v.screenshot({ path: SNIMKY + '/3-pruvodce.png' }); }
    const kroky = [];
    for (let i = 0; i < 3; i++) { await v.click('#rz-pruvodce [data-action="tdRPruvDalsi"]'); await w(150); kroky.push(await pruv()); }
    check('průvodce: krok 2 „Vyber jističe a dej Hřeben nebo Chránič nad" (čelní pohled / lišta akcí), krok 3 „Zapojení: natáhni vodič z kabelu na hlavní vypínač" (tlačítko Zapojení), krok 4 „Hotovo – dokumentaci najdeš v záložce Dokumenty" (záložka)',
      kroky[0] && /^2 \/ 4 · Vyber jističe a dej Hřeben nebo Chránič nad$/.test(kroky[0].t) && /rz-svg-ram|rz-akce/.test(kroky[0].cil) &&
      kroky[1] && /^3 \/ 4 · Zapojení: natáhni vodič z kabelu na hlavní vypínač$/.test(kroky[1].t) && /rz-nap-btn/.test(kroky[1].cil) &&
      kroky[2] && /^4 \/ 4 · Hotovo – dokumentaci najdeš v záložce Dokumenty$/.test(kroky[2].t) && /rz-zal/.test(kroky[2].cil) && /✓ Hotovo/.test(kroky[2].tl) && kroky.every(q => q.vOkne && q.videt), JSON.stringify(kroky));
    await v.click('#rz-pruvodce .rz-pruv-dalsi'); await w(100);
    let stv = await v.evaluate(() => ({ p: !!document.getElementById('rz-pruvodce'), cil: document.querySelectorAll('.rz-pruv-cil').length, n: rozvVse().length, data: JSON.stringify(DOK_TYPY.rozv.cist(dokForm()).rady), klic: localStorage.getItem('revize_el_rz_pruvodce') }));
    check('průvodce: Hotovo ho zavře, nic sám nevložil a zapamatuje se v prohlížeči', !stv.p && !stv.cil && stv.n === 0 && !/uid/.test(stv.data) && stv.klic === '1', JSON.stringify(stv));
    // podruhé se sám neukáže; odkaz „Ukázat průvodce" ho spustí, Přeskočit zavře
    await v.evaluate(async () => { await dokNovy('rozv'); });
    await v.click('#rz-seznam [data-kid="v-sk-4x24-ocel"] [data-action="tdRSkrinPouzit"]'); await w(300);
    check('průvodce: u dalšího nového rozvaděče se už sám neukáže (jen poprvé)', await pruv() === null);
    await v.click('#rz-pohled .rz-pruv-odkaz'); await w(200);
    P = await pruv();
    check('průvodce: „❓ Ukázat průvodce" pod čelním pohledem ho spustí znovu od kroku 1', P && /^1 \/ 4/.test(P.t), JSON.stringify(P));
    await v.keyboard.press('/'); await v.keyboard.type('3x B10'); await v.keyboard.press('Enter'); await w(100);
    stv = await v.evaluate(() => ({ n: rozvVse().length, p: !!document.getElementById('rz-pruvodce') }));
    check('průvodce: nepřekáží — s otevřeným průvodcem jde normálně vkládat příkazem', stv.n === 3 && stv.p, JSON.stringify(stv));
    await v.click('#rz-pruvodce .rz-pruv-preskocit'); await w(100);
    check('průvodce: Přeskočit ho zavře', await v.evaluate(() => !document.getElementById('rz-pruvodce') && !document.querySelector('.rz-pruv-cil')));
    check('průvodce: žádná chyba JavaScriptu', !ev.length, ev.slice(0, 2).join(' | '));
    await cv.close();
    // bez localStorage (vyhazuje výjimku) program nespadne
    const cx = await kontext(b), ex = [];
    await cx.addInitScript(() => {
      const re = /rz_(pruvodce|rada|fi_hreben)/, g = Storage.prototype.getItem, s = Storage.prototype.setItem, r = Storage.prototype.removeItem;
      Storage.prototype.getItem = function (k) { if (re.test(k)) throw new Error('úložiště nejde'); return g.apply(this, arguments); };
      Storage.prototype.setItem = function (k) { if (re.test(k)) throw new Error('úložiště nejde'); return s.apply(this, arguments); };
      Storage.prototype.removeItem = function (k) { if (re.test(k)) throw new Error('úložiště nejde'); return r.apply(this, arguments); };
    });
    const x = await stranka(cx, URL, ex);
    await x.evaluate(async () => { await dokNovy('rozv'); });
    await x.click('#rz-seznam [data-kid="v-sk-4x24-ocel"] [data-action="tdRSkrinPouzit"]'); await w(300);
    const bezA = await x.evaluate(() => !!document.getElementById('rz-pruvodce'));
    await x.keyboard.press('/'); await x.keyboard.type('4x B16'); await x.keyboard.press('Enter'); await w(100);
    await x.evaluate(() => document.activeElement.blur());
    await x.click('#rz-akce [data-action="tdRaChranic"]'); await w(80); await x.click('#rz-akce [data-action="tdRaChranicVlozit"]'); await w(100);
    await x.evaluate(() => { rozvVyberNastavit([]); rozvPohledVykreslit(); rozvVlastnostiVykreslit(); const c = document.querySelector('.rza-nast-fi'); if (c) c.click(); });
    await x.click('#rz-pohled .rz-pruv-odkaz'); await w(200);
    const bez = await x.evaluate(() => ({ p: !!document.getElementById('rz-pruvodce'), r: __rz.rady[0].prvky.map(q => q.ozn).join(' ') }));
    check('bez localStorage (čtení i zápis vyhazuje výjimku): program nespadne, průvodce se sám neukáže, „Ukázat průvodce" i vkládání fungují', !ex.length && !bezA && bez.p && bez.r === '-FI1 -FA1 -FA2 -FA3 -FA4', JSON.stringify(bez) + ' ' + ex.slice(0, 2).join(' | '));
    await cx.close();
  }

  // ── 4. RS2 na nejvýš 25 akcí ──────────────────────────────────────────
  {
    const cr = await kontext(b, { viewport: { width: 1600, height: 1300 } }), er = [];
    const r = await stranka(cr, URL, er);
    await r.evaluate(async () => {
      localStorage.setItem('revize_el_rz_pruvodce', '1'); delete STORE.technik.rz_hreben_strana;
      await dokNovy('rozv');
      __T.u = o => o === '@privod' ? '@privod' : __T.naj(o).uid;
      __T.videt = el => { let bb = el.getBoundingClientRect(); if (bb.top < 110 || bb.bottom > innerHeight - 50) { window.scrollBy(0, bb.top - innerHeight / 2); bb = el.getBoundingClientRect(); } return { x: bb.left + bb.width / 2, y: bb.top + bb.height / 2 }; };
      __T.sv = (o, s, k) => { const e = document.querySelector('#rz-pohled [data-sv="' + __T.u(o) + '|' + s + '|' + (k || 0) + '"]'); return e ? __T.videt(e) : null; };
      __T.radaBod = i => { const svg = document.querySelector('#rz-pohled .rz-svg'); let M = svg.getScreenCTM(); const mm = { x: RZG.okraj + 2.5 * RZG.M, y: rozvRadaY(i) + RZG.H / 2 };
        let q = new DOMPoint(mm.x, mm.y).matrixTransform(M); if (q.y < 110 || q.y > innerHeight - 50) { window.scrollBy(0, q.y - innerHeight / 2); M = svg.getScreenCTM(); q = new DOMPoint(mm.x, mm.y).matrixTransform(M); } return { x: q.x, y: q.y }; };
    });
    let akce = 0;
    const A = {
      async skrin(kid) { akce++; await r.click('#rz-seznam [data-kid="' + kid + '"] [data-action="tdRSkrinPouzit"]'); await w(250); },
      async prikaz(txt) { akce++; await r.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }); await r.keyboard.press('/'); await r.keyboard.type(txt); await r.keyboard.press('Enter'); await w(120); },
      async tlacitko(sel) { akce++; await r.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }); await r.click(sel); await w(150); },
      async klikRada(i) { akce++; const c = await r.evaluate(i => __T.radaBod(i), i); await r.mouse.click(c.x, c.y); await w(120); },
      async tah(odkud, kam) { akce++; const a = await r.evaluate(q => __T.sv(q[0], q[1], q[2]), odkud); await r.mouse.move(a.x, a.y); await w(40); await r.mouse.down(); await r.mouse.move(a.x + 9, a.y + 9, { steps: 3 });
        const cil = () => r.evaluate(q => { const e = document.querySelector('#rz-pohled [data-sv="' + __T.u(q[0]) + '|' + q[1] + '|' + (q[2] || 0) + '"]').getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; }, kam);
        // u kraje rámečku se pohled při tažení sám posouvá — cíl se dorovná jako očima (pořád jeden tah)
        for (let i = 0; i < 6; i++) { const c = await cil(); await r.mouse.move(c.x, c.y, { steps: i ? 3 : 12 }); await w(120); const c2 = await cil(); if (Math.abs(c2.x - c.x) + Math.abs(c2.y - c.y) < 2) break; }
        if (process.env.LADIT) console.log('   tah', JSON.stringify(odkud), '→', JSON.stringify(kam), await r.evaluate(() => { const e = document.getElementById('rz-nap-stitek'); return e ? e.textContent : ''; }));
        await r.mouse.up(); await w(180); }
    };
    await A.skrin('v-sk-4x24-ocel');
    await A.prikaz('3x svorka 10');
    await A.prikaz('hl 63 3p');
    await A.prikaz('pojistky 3p 14x51');
    await A.prikaz('spd t2 3+1');
    await A.klikRada(1);
    await A.prikaz('22x B10');
    await A.tlacitko('#rz-akce [data-action="tdRaHreben"]');
    await A.prikaz('2x B40 3P');
    await A.klikRada(3);
    await A.prikaz('fi 40/30 4p');
    await A.prikaz('20x B16');
    await A.tlacitko('#rz-akce [data-action="tdRaHreben"]');
    await A.tlacitko('#rz-pohled .rz-nap-btn');
    for (let i = 0; i < 3; i++) await A.tah(['@privod', 'o', i], ['-X' + (i + 1), 't', 0]);
    for (let i = 0; i < 3; i++) await A.tah(['-X' + (i + 1), 'b', 0], ['-QH1', 't', i]);
    await A.tah(['-FU1', 't', 0], ['SPD1', 't', 0]);   // -FU1 je napájen zespodu (z výstupu -QH1 v téže mezeře), jeho výstup je nahoře
    const R = await r.evaluate(() => {
      const zd = x => { const z = rozvZdrojEff(x, __rz.rady); return z === '@privod' ? 'přívod' : (z && rozvNajit(z) ? rozvNajit(z).x.ozn : String(z)); };
      const vse = []; __rz.rady.forEach(a => a.prvky.forEach(x => vse.push(x)));
      const sk = {}; vse.forEach(x => { const z = x.p.kat === 'QM' ? 'svorky ' + rozvOznRada((x.nadrSvorky || []).map(u => rozvNajit(u).x)) : zd(x); (sk[z] = sk[z] || []).push(x.ozn); });
      const d = __T.cist(), S = rzpStav(__rz);
      return { rady: __rz.rady.map(a => a.prvky.length).join(), strom: Object.keys(sk).map(z => z + ' → ' + sk[z].join(' ')).join(' ¦ '), hreb: (d.hrebeny || []).map(h => h.rada + ':' + h.od + '-' + h.do + ':' + h.poly + ':' + rzhKryte(h).length).join(), vod: (d.vodice || []).length,
        pre: rozvPreplnene(__rz).length, panel: document.getElementById('rz-vlastnosti').innerText, bezNapeti: vse.filter(x => rzpFaziX(x) > 0 && !(S.vys[x.uid] && S.vys[x.uid].pod)).map(x => x.ozn).join(), fazeB16: __rz.rady[3].prvky.slice(1, 7).map(x => x.faze).join(), ozn: vse.map(x => x.ozn).join(' ') };
    });
    const fa = (a, c) => Array.from({ length: c - a + 1 }, (_, i) => '-FA' + (a + i)).join(' ');
    const stromCekam = 'přívod → -X1 -X2 -X3 ¦ svorky -X1…X3 → -QH1 ¦ -QH1 → -FU1 ' + fa(1, 22) + ' ' + fa(23, 24) + ' -FI1 ¦ -FU1 → SPD1 ¦ -FI1 → ' + fa(25, 44);
    check('RS2: sestaven na nejvýš 25 akcí (skříň, 8 příkazů, 2 kliknutí do řady, 2× Hřeben, Zapojení, 7 tahů vodičů) — akcí: ' + akce, akce <= 25, 'akcí ' + akce);
    check('RS2: strom „kdo koho napájí": přívod → -X1…X3 → -QH1 → { -FU1 → SPD1; -FA1…FA22; -FA23, -FA24; -FI1 → -FA25…FA44 }', R.strom === stromCekam, R.strom);
    check('RS2: 51 přístrojů ve 4 řadách bez přeplnění, 2 hřebeny (22 a 20 pólů), 7 vodičů, všechno pod napětím', R.rady === '6,22,2,21' && R.pre === 0 && R.hreb === '1:0-22:3:22,3:4-24:3:20' && R.vod === 7 && R.bezNapeti === '', JSON.stringify({ rady: R.rady, hreb: R.hreb, vod: R.vod, bez: R.bezNapeti }));
    check('RS2: panel „Kdo koho napájí" ukazuje totéž (-QH1 z -X1…X3, -FA25…FA44 pod -FI1) a jističe pod chráničem mají fáze ze zubů L1, L2, L3…', /-QH1 63 A \[L1,L2,L3\]\s+z -X1…X3/.test(R.panel) && /-FA25…FA44 B16/.test(R.panel) && R.fazeB16 === 'L1,L2,L3,L1,L2,L3', R.fazeB16 + ' ' + (R.panel.match(/-QH1[^\n]*/) || [''])[0]);
    check('RS2: žádná chyba JavaScriptu', !er.length, er.slice(0, 2).join(' | '));
    await cr.close();
  }

  // ── 5. starý rozvaděč: data, čelní pohled, PDF, schéma, DXF beze změny proti předchozí verzi ──
  {
    const rs2 = require('./rozvadec-rs2.js').toString();
    const postav = async (pg) => { await pg.evaluate('window.__rs2 = ' + rs2); return pg.evaluate(async () => {
      await dokNovy('rozv');
      const dk = (s, v) => { const e = dokForm().querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
      dk('[data-dk="oznaceni"]', 'RS2'); dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S'); dk('[data-dk="datum"]', '2026-11-01');
      rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel')); __rs2();
      __rz.rady[0].prvky[5].mezera = 0; __rz.rady[1].prvky[0].pi = '1,2';
      if (typeof rzhNavrhy === 'function') { const N = rzhNavrhy(); N.forEach(q => { __rz.hrebeny = (__rz.hrebeny || []).concat([q.h]); if (q.w) __rz.vodice = (__rz.vodice || []).concat([q.w]); }); rozvZmena('hřebeny', () => {}); }
      dokZmena(); await dokUlozitOtevreny();
      return JSON.stringify(DOK.dokumenty.filter(x => x.uid === window.__dokOtevreny.uid)[0]);
    }); };
    const projit = async (pg, js) => pg.evaluate(async (js) => {
      const dok = JSON.parse(js), d0 = JSON.parse(JSON.stringify(dok.data)), ven = {};
      const t0 = STORE.technik; STORE.technik = { jmeno: 'Petr Vymyšlený', firma: 'Vymyšlená elektro s.r.o.', ico: '12345678', mesto: 'Kyjov' };
      ven.listy = rozvSchemaListy(d0).map(l => l.svg).join('\n');
      ven.dxf = rozvDxfListy(d0).map(l => l.svg).join('\n');
      ven.pdf = DOK_TYPY.rozv.pdf(d0).map(q => q.html || q.cela || '').join('\n');
      STORE.technik = t0;
      await dokNacist();
      DOK.dokumenty = DOK.dokumenty.filter(x => x.uid !== dok.uid).concat([dok]); await dokZapsat();
      await dokOtevrit(dok.uid); await new Promise(r => setTimeout(r, 300));
      ven.celni = rozvSvg(__rz, { tisk: true, k: 0.5 }); ven.obr = rozvSvg(__rz, { k: 3 });
      dokZmena(); await dokUlozitOtevreny(); ven.jenOtevrit = JSON.stringify(DOK.dokumenty.filter(x => x.uid === dok.uid)[0].data);
      rozvZalozkaNastavit('dok'); await new Promise(r => setTimeout(r, 250)); rozvZalozkaNastavit('sch'); await new Promise(r => setTimeout(r, 250)); rozvZalozkaNastavit('navrh'); await new Promise(r => setTimeout(r, 100));
      dokZmena(); await dokUlozitOtevreny();
      ven.data = JSON.stringify(DOK.dokumenty.filter(x => x.uid === dok.uid)[0].data);
      ven.nahled = !!document.getElementById('rzc-pole');
      return ven;
    }, js);
    const cs = await kontext(b), es = [];
    const s = await stranka(cs, URL0, es);
    const stary = await postav(s), puv = await projit(s, stary);
    await cs.close();
    const cn = await kontext(b), en = [];
    const nn = await stranka(cn, URL, en);
    const nov = await projit(nn, stary);
    await cn.close();
    const rozdil = (a, c) => { if (a === c) return ''; let i = 0; while (a[i] === c[i]) i++; return i + ': …' + a.slice(Math.max(0, i - 60), i + 80) + ' ≠ …' + c.slice(Math.max(0, i - 60), i + 80); };
    check('starý rozvaděč (RS2 s hřebeny a vodiči z předchozí verze): otevření a uložení — data bajtově jako uložená; po Dokumentech a Schématu jako v předchozí verzi', nov.jenOtevrit === JSON.stringify(JSON.parse(stary).data) && nov.data === puv.data && nov.nahled, rozdil(nov.jenOtevrit, JSON.stringify(JSON.parse(stary).data)) || rozdil(nov.data, puv.data));
    check('starý rozvaděč: čelní pohled (obrazovka i tisk) znak po znaku jako předchozí verze', nov.celni === puv.celni && nov.obr === puv.obr, rozdil(nov.celni, puv.celni) || rozdil(nov.obr, puv.obr));
    check('starý rozvaděč: PDF dokumentace, schéma i DXF znak po znaku jako předchozí verze', require('./bez-n')(nov.pdf) === require('./bez-n')(puv.pdf) && require('./bez-n')(nov.listy) === require('./bez-n')(puv.listy) && require('./bez-n')(nov.dxf) === require('./bez-n')(puv.dxf) && nov.pdf.length > 5000 && nov.listy.length > 5000 && nov.dxf.length > 5000, rozdil(nov.pdf, puv.pdf) || rozdil(nov.listy, puv.listy) || rozdil(nov.dxf, puv.dxf));
    check('starý rozvaděč: žádná chyba JavaScriptu', !es.length && !en.length, es.concat(en).slice(0, 2).join(' | '));
  }

  check('žádná chyba JavaScriptu', !err.length, err.slice(0, 3).join(' | '));
  await b.close();
  console.log(res.join('\n'));
  const ko = res.filter(r => r.startsWith('❌')).length;
  console.log(ko ? 'SELHALO: ' + ko : 'VŠE OK (' + res.length + ')');
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log('❌ CRASH ' + (e && e.stack || e)); process.exit(1); });
