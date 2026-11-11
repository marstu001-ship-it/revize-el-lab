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
  if (SNIMKY) { await p.evaluate(() => window.scrollTo(0, document.getElementById('rz-pohled').getBoundingClientRect().top + scrollY - 90)); await p.screenshot({ path: SNIMKY + '/1-pole-prikazu-nahled.png' }); }
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
  await p.evaluate(() => { DOK.rozvKnihovna = []; localStorage.removeItem('revize_el_rz_rada'); });

  check('žádná chyba JavaScriptu', !err.length, err.slice(0, 3).join(' | '));
  await b.close();
  console.log(res.join('\n'));
  const ko = res.filter(r => r.startsWith('❌')).length;
  console.log(ko ? 'SELHALO: ' + ko : 'VŠE OK (' + res.length + ')');
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log('❌ CRASH ' + (e && e.stack || e)); process.exit(1); });
