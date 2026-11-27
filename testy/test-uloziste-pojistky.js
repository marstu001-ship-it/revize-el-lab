// Pojistky úložiště knihovny výrobců (2026-11-27).
//
// 1) Bez IndexedDB (soukromé okno, zakázané úložiště) zbývá jen localStorage
//    (~5 MB na celý program). Knihovnu větší než ~4 MB tam program nezapíše
//    naslepo: import se zastaví s hláškou a dosavadní knihovna zůstane.
// 2) Trvalé úložiště: při startu jednou navigator.storage.persist(),
//    v Nastavení řádek „Úložiště: … · obsazeno X MB" (bez API se neukazuje).
// 3) Výkon: syntetická knihovna 30 000 položek — import, hledání, filtr
//    a vykreslení seznamu.
//
// Vše vymyšlené: „Výrobce A–F", žádná reálná data.
const T = __dirname + '/';
const PORT = process.env.PORT || 8901, STARA = process.env.STARA_PORT || 8902;
const { chromium } = require(T + 'pw');
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d !== undefined ? ' — ' + d : ''));
const info = (s) => console.log('ℹ ' + s);
const w = ms => new Promise(r => setTimeout(r, ms));
const HLASKA = 'Knihovna výrobců se do tohoto zařízení nevejde – naimportujte jen výrobce, které používáte';
const HLASKA_IMPORT = 'Celá knihovna se do tohoto zařízení nevejde – vyberte jen výrobce, které používáte (odhad: ';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const UA_IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

function genCsv(n, od) {
  od = od || 0;
  var header = 'druh;kategorie;nazev;vyrobce;rada;typ;poly;in;charakteristika;icn;sirka_moduly;poznamka;overeno';
  var vyrobci = ['Výrobce A', 'Výrobce B', 'Výrobce C', 'Výrobce D', 'Výrobce E', 'Výrobce F'];
  var chary = ['B', 'C', 'D'], poly = ['1', '3', '1+N', '3+N'];
  var pozn = 'Poznámka z katalogu výrobce s popisem přístroje a odkazem na datový list. '.repeat(2);
  var lines = [header];
  for (var j = 0; j < n; j++) {
    var i = j + od;
    lines.push(['pristroj', 'FA', '', vyrobci[i % 6], 'R' + (i % 9), 'TYP-' + i, poly[i % 4],
      String(6 + (i % 58)), chary[i % 3], '6', '1', pozn + '#' + i, i % 5 === 0 ? 'ano' : ''].join(';'));
  }
  return lines.join('\r\n');
}

async function stranka(b, bezIdb, ctxOpts, port) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1366, height: 900 } }, ctxOpts || {}));
  await ctx.addInitScript((bez) => {
    try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {}
    if (bez) Object.defineProperty(window, 'indexedDB', { get: () => undefined, configurable: true });
    window.__toasty = [];
  }, !!bezIdb);
  const p = await ctx.newPage();
  p.__err = [];
  p.on('pageerror', e => p.__err.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto('http://127.0.0.1:' + (port || PORT) + '/index.html');
  await w(900);
  await p.evaluate(() => { const o = showToast; showToast = function (t, x) { window.__toasty.push(String(t)); return o.apply(this, arguments); }; });
  return p;
}

async function importKnihovnu(p, csvText, jenVyrobci) {
  return p.evaluate(async ([txt, jen]) => {
    await dokNacist();
    const t0 = performance.now();
    await rozvImportSoubor(new File([txt], 'knihovna.csv', { type: 'text/csv' }));
    await new Promise(r => setTimeout(r, 30));
    const t1 = performance.now();
    const bylo = window.__rzImport ? { nove: window.__rzImport.nove, chyby: window.__rzImport.v.chyby.length } : null;
    if (jen && window.__rzImport) {   // zaškrtávátky v náhledu: jen vybraní výrobci
      // každá změna náhled překreslí — zaškrtávátko se proto hledá pokaždé znovu
      [...document.querySelectorAll('#rz-import-obsah .rz-imp-vyr-ch')].map(ch => ch.getAttribute('data-v')).forEach(v => {
        const ch = document.querySelector('#rz-import-obsah .rz-imp-vyr-ch[data-v="' + v + '"]'), chce = jen.indexOf(v) !== -1;
        if (ch.checked !== chce) { ch.checked = chce; ch.dispatchEvent(new Event('change', { bubbles: true })); }
      });
    }
    if (window.__rzImport) await TD_AKCE.tdRImportUlozit();
    return { bylo, nahledMs: +(t1 - t0).toFixed(0), ulozeniMs: +(performance.now() - t1).toFixed(0) };
  }, [csvText, jenVyrobci || null]);
}

(async () => {
  const b = await chromium.launch();

  // ═══ 1) Bez IndexedDB: malá knihovna projde, velká se zastaví ═══
  {
    const p = await stranka(b, true);
    check('bez IndexedDB program běží (idb === null)', await p.evaluate(() => idb === null));
    const male = await importKnihovnu(p, genCsv(200));
    const st1 = await p.evaluate(() => ({ n: DOK.rozvKnihovna.length, ls: (localStorage.getItem('revize_el_rz_knihovna') || '').length }));
    check('bez IndexedDB malá knihovna (200) se uloží do localStorage', st1.n === 200 && st1.ls > 0, JSON.stringify(st1));
    const dokPred = await p.evaluate(() => localStorage.getItem('revize_el_dok'));

    const velke = genCsv(15000, 1000);
    info('velký import: 15 000 položek, CSV ' + (Buffer.byteLength(velke) / 1048576).toFixed(1) + ' MB');
    await p.evaluate(() => { window.__toasty.length = 0; });
    const r = await importKnihovnu(p, velke);
    await w(200);
    const st2 = await p.evaluate(() => ({ n: DOK.rozvKnihovna.length, lsN: JSON.parse(localStorage.getItem('revize_el_rz_knihovna') || '[]').length,
      toasty: window.__toasty.slice(), modal: document.getElementById('modal-rz-import').classList.contains('open') }));
    check('velký import bez IndexedDB náhled ukázal (15 000 bez chyb)', r.bylo && r.bylo.chyby === 0 && r.bylo.nove === 15000, JSON.stringify(r.bylo));
    check('velký import bez IndexedDB se ZASTAVIL — v paměti zůstalo 200', st2.n === 200, st2.n);
    check('… v localStorage zůstala dosavadní knihovna (200)', st2.lsN === 200, st2.lsN);
    check('… hláška s výběrem výrobců a odhadem velikosti', st2.toasty.some(t => t.indexOf(HLASKA_IMPORT) === 0 && /Výrobce [A-F] \d,\d MB/.test(t)), JSON.stringify(st2.toasty));
    check('… dokumenty (revize_el_dok) beze změny', (await p.evaluate(() => localStorage.getItem('revize_el_dok'))) === dokPred);
    const vyb = await p.evaluate(() => ({ open: document.getElementById('modal-rz-import').classList.contains('open'),
      det: !!(document.getElementById('rz-imp-vyr') || {}).open, n: document.querySelectorAll('#rz-import-obsah .rz-imp-vyr-ch').length,
      txt: (document.getElementById('rz-imp-nevejde') || {}).textContent || '' }));
    check('… okno importu zůstane otevřené a zaškrtávátka výrobců jsou rovnou nabídnutá', vyb.open && vyb.det && vyb.n === 6 && vyb.txt.indexOf(HLASKA_IMPORT) === 0, JSON.stringify(vyb));
    const v3 = await p.evaluate(async () => {
      ['Výrobce C', 'Výrobce D', 'Výrobce E', 'Výrobce F'].forEach(v => { const ch = document.querySelector('.rz-imp-vyr-ch[data-v="' + v + '"]'); ch.checked = false; ch.dispatchEvent(new Event('change', { bubbles: true })); });
      const btn = document.getElementById('rz-import-ulozit').textContent;
      await TD_AKCE.tdRImportUlozit(); await new Promise(r => setTimeout(r, 100));
      const vyr = {}; DOK.rozvKnihovna.forEach(x => { vyr[x.vyrobce] = (vyr[x.vyrobce] || 0) + 1; });
      return { btn, n: DOK.rozvKnihovna.length, lsN: JSON.parse(localStorage.getItem('revize_el_rz_knihovna') || '[]').length, vyr };
    });
    check('… výběr 2 výrobců projde (200 + 5 000) a uloží se', v3.btn === '✓ Uložit do knihovny (5000)' && v3.n === 5200 && v3.lsN === 5200 && v3.vyr['Výrobce C'] === 33, JSON.stringify(v3));
    await importKnihovnu(p, velke, ['Výrobce C']);
    const st4 = await p.evaluate(() => ({ n: DOK.rozvKnihovna.length, c: DOK.rozvKnihovna.filter(x => x.vyrobce === 'Výrobce C').length }));
    check('… výběr jde doplnit dalším importem (+ Výrobce C, nic se nezdvojí)', st4.n === 7700 && st4.c === 2533, JSON.stringify(st4));
    await importKnihovnu(p, velke, ['Výrobce A']);
    check('… opakovaný import téhož výrobce položky aktualizuje, nezdvojí', (await p.evaluate(() => DOK.rozvKnihovna.length)) === 7700);
    check('… žádná chyba stránky', p.__err.length === 0, p.__err.join(' | '));

    // Přímý zápis velké knihovny (např. z obnovy zálohy) taky nepřepíše uloženou.
    const prime = await p.evaluate(async () => {
      window.__toasty.length = 0;
      const vel = []; for (let i = 0; i < 12000; i++) vel.push({ id: 'x' + i, druh: 'pristroj', kat: 'FA', nazev: 'Jistič '.repeat(60) + i });
      const ok = await dokKnihovnaZapsat(vel);
      return { ok, lsN: JSON.parse(localStorage.getItem('revize_el_rz_knihovna') || '[]').length, t: window.__toasty.slice() };
    });
    check('přímý zápis velké knihovny bez IndexedDB vrátí false a nic nepřepíše', prime.ok === false && prime.lsN === 7700 && prime.t.indexOf(HLASKA) !== -1, JSON.stringify({ ok: prime.ok, n: prime.lsN }));
    await p.context().close();
  }

  // ═══ 1b) iOS (UA iPhone): knihovna v IndexedDB, revize dál jen v localStorage ═══
  {
    const AKCE = async () => {   // stejné kroky ve staré i nové verzi
      STORE.technik = Object.assign({}, STORE.technik, { jmeno: 'Petr Vymyšlený', mesto: 'Kyjov' });
      STORE.odberatele = [{ id: 'o1', nazev: 'Vymyšlená s.r.o.' }];
      saveStore(); await new Promise(r => setTimeout(r, 300));
      return localStorage.getItem('revize_el_store');
    };
    const pS = await stranka(b, false, { userAgent: UA_IPHONE, hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } }, STARA);
    const lsStara = await pS.evaluate(AKCE);
    await pS.context().close();
    const p = await stranka(b, false, { userAgent: UA_IPHONE, hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    const z = await p.evaluate(() => ({ ios: IS_IOS, idb: idb === null, knih: !!idbKnih }));
    check('iOS: revize bez IndexedDB (idb === null), knihovna má vlastní IndexedDB', z.ios && z.idb && z.knih, JSON.stringify(z));
    const lsNova = await p.evaluate(AKCE);
    check('iOS: revize v localStorage bajtově stejně jako ve staré verzi', !!lsNova && lsNova === lsStara, (lsNova || '').length + ' / ' + (lsStara || '').length);
    const r = await importKnihovnu(p, genCsv(15000));
    const st = await p.evaluate(async () => {
      const keys = await new Promise(res => { const q = idbKnih.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).getAllKeys(); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
      return { n: DOK.rozvKnihovna.length, idbN: ((await knihKvGet(idbKnih, 'dok_rozvKnihovna')) || []).length, keys, ls: localStorage.getItem('revize_el_rz_knihovna'), store: !!localStorage.getItem('revize_el_store') };
    });
    check('iOS: knihovna 15 000 položek se uloží do IndexedDB', st.n === 15000 && st.idbN === 15000, JSON.stringify({ n: st.n, idb: st.idbN }));
    check('iOS: v IndexedDB je JEN knihovna, revize dál v localStorage', JSON.stringify(st.keys) === '["dok_rozvKnihovna"]' && st.store && st.ls === null, JSON.stringify(st.keys));
    const po = await p.evaluate(async () => { await dokNacist(); return DOK.rozvKnihovna.length; });
    check('iOS: knihovna se z IndexedDB znovu načte', po === 15000, po);
    check('iOS: žádná chyba stránky', p.__err.length === 0, p.__err.join(' | '));
    await p.context().close();
  }
  // ═══ 1c) iOS bez IndexedDB: výběr výrobců ═══
  {
    const p = await stranka(b, true, { userAgent: UA_IPHONE, hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    check('iOS bez IndexedDB: knihovna nemá kam do IndexedDB', await p.evaluate(() => !idbKnih && !idb));
    await importKnihovnu(p, genCsv(15000));
    const st = await p.evaluate(() => ({ n: DOK.rozvKnihovna.length, t: window.__toasty.slice(), open: document.getElementById('modal-rz-import').classList.contains('open') }));
    check('iOS bez IndexedDB: celá knihovna se nevejde → hláška s výběrem výrobců', st.n === 0 && st.open && st.t.some(t => t.indexOf(HLASKA_IMPORT) === 0), JSON.stringify(st.t));
    await p.evaluate(async () => {
      ['Výrobce D', 'Výrobce E', 'Výrobce F'].forEach(v => { const ch = document.querySelector('.rz-imp-vyr-ch[data-v="' + v + '"]'); ch.checked = false; ch.dispatchEvent(new Event('change', { bubbles: true })); });
      await TD_AKCE.tdRImportUlozit();
    });
    const st2 = await p.evaluate(() => ({ n: DOK.rozvKnihovna.length, lsN: JSON.parse(localStorage.getItem('revize_el_rz_knihovna') || '[]').length }));
    check('iOS bez IndexedDB: import 3 výrobců projde (localStorage)', st2.n === 7500 && st2.lsN === 7500, JSON.stringify(st2));
    await p.context().close();
  }
  // ═══ 1d) iPad s desktopovým UA (Macintosh + dotyk): beze změny ═══
  {
    const p = await stranka(b, false, { userAgent: UA_IPAD_DESKTOP, hasTouch: true });
    const z = await p.evaluate(() => ({ ios: IS_IOS, idb: !!idb, stejne: idbKnih === idb }));
    check('iPad s desktopovým UA: IndexedDB pro všechno jako dřív', !z.ios && z.idb && z.stejne, JSON.stringify(z));
    await p.context().close();
  }

  // ═══ 2) S IndexedDB: velký import projde ═══
  {
    const p = await stranka(b, false);
    const r = await importKnihovnu(p, genCsv(15000));
    const n = await p.evaluate(() => DOK.rozvKnihovna.length);
    check('s IndexedDB se velký import (15 000) uloží', n === 15000, n);
    const n2 = await p.evaluate(async () => (await idbGet('dok_rozvKnihovna') || []).length);
    check('… a je v IndexedDB', n2 === 15000, n2);
    await p.context().close();
  }

  // ═══ 3) Trvalé úložiště a řádek v Nastavení ═══
  {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    await ctx.addInitScript(() => {
      try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {}
      window.__persist = 0; let trvale = false;
      navigator.storage.persist = () => { window.__persist++; trvale = true; return Promise.resolve(true); };
      navigator.storage.persisted = () => Promise.resolve(trvale);
      navigator.storage.estimate = () => Promise.resolve({ usage: 12.34 * 1048576, quota: 1e10 });
    });
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await w(1200);
    check('při startu se jednou požádá o trvalé úložiště', await p.evaluate(() => window.__persist) === 1, await p.evaluate(() => window.__persist));
    await p.evaluate(() => showScreen('nastaveni')); await w(300);
    const t = await p.evaluate(() => { const e = document.getElementById('nast-uloziste'); return { t: e.textContent, vis: e.offsetHeight > 0 }; });
    check('Nastavení: „Úložiště: trvalé · obsazeno 12,3 MB"', t.vis && t.t === 'Úložiště: trvalé · obsazeno 12,3 MB', JSON.stringify(t));
    await p.evaluate(() => showScreen('nastaveni'));
    check('opakované otevření Nastavení o úložiště znovu nežádá', await p.evaluate(() => window.__persist) === 1);
    await ctx.close();

    const ctx2 = await b.newContext();
    await ctx2.addInitScript(() => {
      try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {}
      navigator.storage.persist = () => Promise.resolve(false);
      navigator.storage.persisted = () => Promise.resolve(false);
      navigator.storage.estimate = () => Promise.resolve({ usage: 0.5 * 1048576 });
    });
    const p2 = await ctx2.newPage();
    await p2.goto('http://127.0.0.1:' + PORT + '/index.html'); await w(1000);
    await p2.evaluate(() => showScreen('nastaveni')); await w(300);
    const t2 = await p2.evaluate(() => document.getElementById('nast-uloziste').textContent);
    check('nepovolené trvalé: „Úložiště: může ho prohlížeč smazat · obsazeno 0,5 MB"', t2 === 'Úložiště: může ho prohlížeč smazat · obsazeno 0,5 MB', t2);
    await ctx2.close();

    const ctx3 = await b.newContext();
    await ctx3.addInitScript(() => {
      try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {}
      Object.defineProperty(navigator, 'storage', { get: () => undefined, configurable: true });
    });
    const p3 = await ctx3.newPage(); p3.__err = []; p3.on('pageerror', e => p3.__err.push(e.message));
    await p3.goto('http://127.0.0.1:' + PORT + '/index.html'); await w(1000);
    await p3.evaluate(() => showScreen('nastaveni')); await w(300);
    const t3 = await p3.evaluate(() => { const e = document.getElementById('nast-uloziste'); return { vis: e.offsetHeight > 0, t: e.textContent }; });
    check('bez navigator.storage se řádek neukazuje a nic nespadne', !t3.vis && p3.__err.length === 0, JSON.stringify(t3) + ' ' + p3.__err.join('|'));
    await ctx3.close();
  }

  // ═══ 4) Výkon: 30 000 položek ═══
  {
    const p = await stranka(b, false);
    const r = await importKnihovnu(p, genCsv(30000));
    info('import 30 000: náhled ' + r.nahledMs + ' ms, uložení ' + r.ulozeniMs + ' ms');
    check('import 30 000 položek bez chyb', r.bylo && r.bylo.chyby === 0 && (await p.evaluate(() => DOK.rozvKnihovna.length)) === 30000);
    check('uložení importu 30 000 pod 5 s', r.ulozeniMs < 5000, r.ulozeniMs + ' ms');
    await p.evaluate(async () => { await dokNovy('rozv'); rozvKnihovnaVse(); });
    await w(300);
    const casy = await p.evaluate(() => {
      const m = (fn) => { const t = performance.now(); fn(); return +(performance.now() - t).toFixed(1); };
      __rzF.tab = 'pristroje'; rozvKnihovnaVykreslit();   // zahřátí (nový rozvaděč otevře kartu Skříně)
      const vykresleni = m(() => { rozvFiltryVykreslit(); rozvKnihovnaVykreslit(); });
      __rzF.q = 'typ-2999'; const hledani = m(() => rozvKnihovnaVykreslit());
      const pocet = () => (document.getElementById('rz-kn-pocet') || {}).textContent || '';
      const txtHledani = pocet();
      __rzF.q = 'b16'; const hledani2 = m(() => rozvKnihovnaVykreslit());
      __rzF.q = ''; __rzF.vyrobce = 'Výrobce C'; const filtr = m(() => rozvKnihovnaVykreslit());
      const txt = pocet();
      __rzF.vyrobce = '';
      return { vykresleni, hledani, hledani2, filtr, txtHledani, txt };
    });
    info('30 000 položek — vykreslení ' + casy.vykresleni + ' ms, hledání ' + casy.hledani + ' / ' + casy.hledani2 + ' ms, filtr výrobce ' + casy.filtr + ' ms · ' + casy.txt);
    check('vykreslení seznamu knihovny pod 100 ms', casy.vykresleni < 100, casy.vykresleni + ' ms');
    check('hledání (konkrétní typ) pod 100 ms', casy.hledani < 100, casy.hledani + ' ms');
    check('hledání (b16) pod 100 ms', casy.hledani2 < 100, casy.hledani2 + ' ms');
    check('hledání „typ-2999" opravdu něco našlo', /Nalezeno [1-9]/.test(casy.txtHledani), casy.txtHledani);
    check('filtr výrobce zúžil seznam (5 000 z 30 000)', /5\s?000/.test(casy.txt), casy.txt);
    check('filtr výrobce pod 100 ms', casy.filtr < 100, casy.filtr + ' ms');
    check('žádná chyba stránky', p.__err.length === 0, p.__err.join(' | '));
    await p.context().close();
  }

  await b.close();
  res.forEach(r => console.log(r));
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.error('SELHALO', e); process.exit(1); });
