// Rozvaděč DBO — návrh a dokumentace (ČSN EN 61439-3), konfigurátor etapa 1.
// Samostatný typ v Tvorbě dokumentace: knihovna skříní a přístrojů, skládání
// v čelním pohledu, seznam přístrojů a PDF. Test hlídá:
//  - dlaždici, seznam s jednou hlavní akcí a sbalenou knihovnou,
//  - vestavěnou knihovnu (jen obecné položky, nic ověřeného) a filtry,
//  - oblíbené, výběr skříně, hlavičku z profilu, uložení a znovuotevření,
//  - ODDĚLENÍ od revizí (archiv a data revizí se nezmění).
// Všechna data vymyšlená.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));

function pomocnik() {
  window.__T = {
    w: ms => new Promise(r => setTimeout(r, ms)),
    nast(sel, v) {
      const e = dokForm().querySelector(sel);
      e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
    },
    filtr(k, v) {
      const e = document.querySelector('.rz-f[data-f="' + k + '"]');
      if (e.type === 'checkbox') { e.checked = v; e.dispatchEvent(new Event('change', { bubbles: true })); }
      else { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }
    },
    nalezeno: () => document.querySelectorAll('#rz-seznam .rz-polozka').length,
    async otiskRevizi() {
      const idbData = {};
      for (const k of STORE_KEYS) idbData[k] = await idbGet(k);
      return JSON.stringify({ idb: idbData, ls: localStorage.getItem('revize_el_store'), autosave: localStorage.getItem('revize_el_autosave') });
    }
  };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  // knihovny PDF z cdnjs (sandbox na CDN nesmí) — tytéž soubory z testy/knihovny (otisky SRI sedí)
  await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: require('path').join(__dirname, 'knihovny', r.request().url().split('/').pop()),
    contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  const err = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => err.push(e.message));
  p.on('dialog', d => d.accept());
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  await p.goto(URL); await w(1200);
  await p.evaluate(pomocnik);

  // ── 0. revizní zpráva jako pozadí (oddělení) ──────────────────────────
  await p.evaluate(async () => {
    STORE.technik = { jmeno: 'Jan Vymyšlený', firma: 'Vymyšlená elektro s.r.o.', ulice: 'Polní 1', psc: '697 01', mesto: 'Kyjov', ico: '12345678' };
    saveStore();
    novaZprava('elektro'); await __T.w(200);
    const e = id => document.getElementById(id);
    e('f_ev_cislo').value = 'RE-26-0001'; e('f_misto').value = 'Vymyšlený rodinný dům';
    window.__formDirty = false; saveToArchiv(); showScreen('home'); await __T.w(300);
  });
  const otiskPred = await p.evaluate(() => __T.otiskRevizi());
  const archivPred = await p.evaluate(() => JSON.stringify(archiv));

  // ── 1. dlaždice a seznam ──────────────────────────────────────────────
  await p.evaluate(() => dokOtevritTypy()); await w(200);
  const dl = await p.evaluate(() => ({
    typy: Array.from(document.querySelectorAll('#dok-dlazdice .dok-dlazdice')).map(x => x.getAttribute('data-typ')).join(),
    text: (document.querySelector('#dok-dlazdice [data-typ="rozv"]') || {}).innerText || ''
  }));
  check('dlaždice „Rozvaděč DBO – návrh a dokumentace" s popisem ČSN EN 61439-3', dl.typy === 'pouvv,rozv' &&
    /Rozvaděč DBO – návrh a dokumentace/i.test(dl.text) && /ČSN EN 61439-3/.test(dl.text), dl.typy + ' | ' + dl.text.replace(/\n/g, ' | '));
  await p.click('#dok-dlazdice [data-typ="rozv"]'); await w(250);
  const sz = await p.evaluate(() => {
    const h = document.querySelector('#dok-typy .dok-hlavni-akce'), kk = document.getElementById('dok-knihovna-karta');
    return { akt: document.querySelector('.screen.active').id, hlavni: h ? h.innerText.replace(/\s+/g, ' ').trim() : '',
             pod: (document.querySelector('#dok-typy .dok-hlavni-pod') || {}).textContent || '',
             kniha: !!kk && kk.style.display !== 'none' && kk.tagName === 'DETAILS' && !kk.open,
             vzory: document.getElementById('dok-vzory-karta').style.display, prazdno: document.getElementById('dok-seznam').innerText };
  });
  check('seznam: hlavní akce „＋ Navrhnout nový rozvaděč", dostane číslo ROZ-0001', sz.akt === 'screen-dok-seznam' &&
    sz.hlavni === '＋ Navrhnout nový rozvaděč' && /ROZ-0001/.test(sz.pod), JSON.stringify(sz));
  check('seznam: knihovna ve sbalené „⚙ Knihovna přístrojů a skříní", správa vzorů schovaná', sz.kniha && sz.vzory === 'none');
  check('seznam: prázdný seznam radí hlavní tlačítko', /Navrhnout nový rozvaděč/.test(sz.prazdno), sz.prazdno);
  const sprava = await p.evaluate(() => { document.getElementById('dok-knihovna-karta').open = true; return document.getElementById('rz-sprava').innerText; });
  check('správa knihovny: počty vestavěných obecných položek', /Vestavěno: \d+ obecných přístrojů a \d+ skříní/.test(sprava), sprava.split('\n')[0]);

  // ── 2. vestavěná knihovna ─────────────────────────────────────────────
  const vest = await p.evaluate(() => {
    const v = rozvVestavene();
    return {
      pocet: v.length, overene: v.filter(x => x.overeno).length,
      vyrobci: Array.from(new Set(v.map(x => x.vyrobce))).join(),
      pv: v.filter(x => x.druh === 'pristroj').filter(x => x.pv !== '' || x.icn !== '' || x.icu !== '' || x.ics !== '').length,
      skrineInA: v.filter(x => x.druh === 'skrin' && (x.ina !== '' || x.penc !== '')).length,
      sirky: v.filter(x => x.druh === 'pristroj' && !(x.sirka > 0)).length,
      kat: Array.from(new Set(v.filter(x => x.druh === 'pristroj').map(x => x.kat))).length,
      jistic: !!v.find(x => x.nazev === 'Jistič 1P B16' && x.In === 16 && x.char === 'B' && x.poly === '1' && x.sirka === 1),
      chranic: !!v.find(x => x.nazev === 'Chránič 4P 40 A / 30 mA typ A' && x.idn === 30 && x.rcdTyp === 'A'),
      rcbo: !!v.find(x => x.nazev === 'RCBO 1+N B16 / 30 mA typ A'),
      spd: !!v.find(x => x.nazev === 'SPD T1+T2 3+N'), qm: !!v.find(x => x.nazev === 'Hlavní vypínač 3P 63 A'),
      polmodul: !!v.find(x => x.sirka === 0.5),
      skrine: v.filter(x => x.druh === 'skrin').map(x => x.rady + 'x' + x.modulu + x.material[0] + x.provedeni[0]).join(),
      etim: ['FA', 'FI', 'FIFA', 'SPD'].map(k => rozvKat(k).etim).join() + ',' + ROZV_SKRIN_ETIM
    };
  });
  check('vestavěné: jen výrobce „obecný", nic ověřeného', vest.vyrobci === 'obecný' && vest.overene === 0, vest.vyrobci + ' / ověřeno ' + vest.overene);
  check('vestavěné: Pv, Icn, Icu, Ics, InA ani Penc nevymyšlené (prázdné)', vest.pv === 0 && vest.skrineInA === 0, vest.pv + ' / ' + vest.skrineInA);
  check('vestavěné: každý přístroj má šířku v modulech, i ½ modulu', vest.sirky === 0 && vest.polmodul);
  check('vestavěné: všech 15 kategorií', vest.kat === 15, String(vest.kat));
  check('vestavěné: jistič, chránič, RCBO, SPD, hlavní vypínač v zadaném tvaru', vest.jistic && vest.chranic && vest.rcbo && vest.spd && vest.qm);
  check('vestavěné skříně: 1–4×12, 2–4×18 plast nástěnné i zapuštěné, 3–4×24 oceloplech',
    vest.skrine === '1x12pn,1x12pz,2x12pn,2x12pz,3x12pn,3x12pz,4x12pn,4x12pz,2x18pn,2x18pz,3x18pn,3x18pz,4x18pn,4x18pz,3x24on,4x24on', vest.skrine);
  check('kódy ETIM 10 u tříd: MCB, RCD, RCBO, SPD, skříň', vest.etim === 'EC000042,EC000003,EC000905,EC000941,EC000214', vest.etim);

  // ── 3. nový rozvaděč: hlavička z profilu, knihovna a filtry ───────────
  await p.click('#dok-typy .dok-hlavni-akce'); await w(400);
  const ed = await p.evaluate(() => ({
    akt: document.querySelector('.screen.active').id,
    typ: document.getElementById('screen-dok-form').getAttribute('data-typ'),
    cislo: dokForm().querySelector('[data-dk="cislo"]').value,
    vyrobce: ['nazev', 'adresa', 'ico'].map(k => dokForm().querySelector('[data-dk="vyrobce.' + k + '"]').value).join(' | '),
    hlOtevrena: document.querySelector('.rz-hlavicka').open,
    souhrn: document.getElementById('rz-hl-souhrn').textContent,
    tab: document.querySelector('.rz-tab.akt').getAttribute('data-tab'),
    bezSkrine: !!document.querySelector('#rz-pohled .rz-bez-skrine'),
    soustavy: Array.from(dokForm().querySelectorAll('[data-dk="soustava"] option')).map(o => o.textContent).join(' | '),
    stav: document.getElementById('dok-stav').textContent
  }));
  check('editor: číslo ROZ-0001, výrobce rozvaděče předvyplněný z profilu', ed.akt === 'screen-dok-form' && ed.typ === 'rozv' && ed.cislo === 'ROZ-0001' &&
    ed.vyrobce === 'Vymyšlená elektro s.r.o. | Polní 1, 697 01 Kyjov | 12345678', JSON.stringify(ed));
  check('editor: hlavička sbalená, souhrn říká, že je nevyplněná', !ed.hlOtevrena && /nevyplněno/.test(ed.souhrn), ed.souhrn);
  check('editor: bez skříně je v knihovně karta Skříně a v pohledu výzva vybrat skříň', ed.tab === 'skrine' && ed.bezSkrine);
  check('editor: soustava 1NPE, 3NPE TN-S, 3PEN TN-C, TN-C-S, TT', /1NPE ~230 V/.test(ed.soustavy) && /TN-S/.test(ed.soustavy) && /3PEN ~400\/230 V TN-C/.test(ed.soustavy) &&
    /TN-C-S/.test(ed.soustavy) && /TT/.test(ed.soustavy), ed.soustavy);
  check('editor: nový prázdný rozvaděč se ještě neukládá', /uloží se, jakmile/.test(ed.stav), ed.stav);

  const f = {};
  f.skrineVse = await p.evaluate(() => __T.nalezeno());
  await p.evaluate(() => __T.filtr('moduly', '36')); f.sk36 = await p.evaluate(() => __T.nalezeno());
  await p.evaluate(() => __T.filtr('provedeni', 'zapuštěná')); f.sk36z = await p.evaluate(() => __T.nalezeno());
  await p.evaluate(() => TD_AKCE.tdRFiltrZrusit());
  await p.evaluate(() => TD_AKCE.tdRTab(document.querySelector('.rz-tab[data-tab="pristroje"]')));
  f.vse = await p.evaluate(() => __T.nalezeno());
  await p.evaluate(() => __T.filtr('kat', 'FA')); f.fa = await p.evaluate(() => __T.nalezeno());
  await p.evaluate(() => __T.filtr('poly', '1')); await p.evaluate(() => __T.filtr('char', 'B')); await p.evaluate(() => __T.filtr('In', '16'));
  f.b16 = await p.evaluate(() => Array.from(document.querySelectorAll('#rz-seznam .rz-polozka b')).map(x => x.textContent).join());
  f.pocetFiltru = await p.evaluate(() => document.getElementById('rz-filtry-pocet').textContent);
  await p.evaluate(() => TD_AKCE.tdRFiltrZrusit());
  await p.evaluate(() => __T.filtr('kat', 'FI')); await p.evaluate(() => __T.filtr('idn', '300'));
  f.fi300 = await p.evaluate(() => __T.nalezeno());
  await p.evaluate(() => TD_AKCE.tdRFiltrZrusit());
  await p.evaluate(() => __T.filtr('q', 'rcbo c16')); f.q = await p.evaluate(() => Array.from(document.querySelectorAll('#rz-seznam .rz-polozka b')).map(x => x.textContent).join());
  await p.evaluate(() => __T.filtr('q', 'svodič')); f.qNic = await p.evaluate(() => document.getElementById('rz-seznam').innerText);
  await p.evaluate(() => { TD_AKCE.tdRFiltrZrusit(); __T.filtr('overene', true); }); f.over = await p.evaluate(() => __T.nalezeno());
  await p.evaluate(() => TD_AKCE.tdRFiltrZrusit());
  check('filtr skříní: počet modulů 36 (3×12, 2×18) a provedení', f.skrineVse === 16 && f.sk36 === 4 && f.sk36z === 2, JSON.stringify([f.skrineVse, f.sk36, f.sk36z]));
  check('filtr přístrojů: kategorie Jistič', f.fa === 80 && f.vse > 80, f.fa + ' z ' + f.vse);
  check('filtr: póly + charakteristika + In → právě Jistič 1P B16', f.b16 === 'Jistič 1P B16' && /4 zapnuto/.test(f.pocetFiltru), f.b16 + ' ' + f.pocetFiltru);
  check('filtr IΔn 300 mA u chráničů', f.fi300 === 2, String(f.fi300));
  check('fulltext bez háčků a velikosti písmen, víc slov', f.q === 'RCBO 1+N C16 / 30 mA typ A', f.q);
  check('fulltext bez výsledku řekne „Nic neodpovídá"', /Nic neodpovídá/.test(f.qNic));
  check('„jen ověřené" — vestavěné ověřené nejsou', f.over === 0, String(f.over));

  // oblíbené
  await p.evaluate(async () => {
    __T.filtr('q', 'Jistič 1P C10');
    await TD_AKCE.tdRHvezda(document.querySelector('#rz-seznam [data-kid="v-fa-1-C10"] [data-action="tdRHvezda"]'));
    __T.filtr('q', '');
  });
  const obl = await p.evaluate(() => ({
    ulozeno: DOK.rozvOblibene.join(),
    prvni: document.querySelector('#rz-seznam .rz-polozka').getAttribute('data-kid'),
    rychle: document.getElementById('rz-rychle').innerText,
    chipy: Array.from(document.querySelectorAll('#rz-rychle .rz-chip')).map(c => c.getAttribute('data-kid')).slice(0, 7).join()
  }));
  check('oblíbené: hvězdička uloží, oblíbená položka je v seznamu první a v rychlém přidání', obl.ulozeno === 'v-fa-1-C10' &&
    obl.prvni === 'v-fa-1-C10' && /★ Oblíbené/i.test(obl.rychle), JSON.stringify(obl));
  check('rychlé přidání: B10 1P, B16 1P, C16 1P, B25 3P, chránič 40/30 4P, hlavní vypínač 3P, rezerva 1 M',
    obl.chipy === 'v-fa-1-B10,v-fa-1-B16,v-fa-1-C16,v-fa-3-B25,v-fi-4-40-30-A,v-qm-3-63,v-rez-1', obl.chipy);
  const filtrNeuklada = await p.evaluate(() => !window.__dokOtevreny.ulozen && DOK.dokumenty.length === 0);
  check('psaní do filtrů ani hvězdička rozvaděč neuloží (není změna dokumentu)', filtrNeuklada);

  // ── 3b. vlastní přístroj a skříň ──────────────────────────────────────
  await p.evaluate(() => { window.ulozitSoubor = (blob, name) => { window.__ul = { blob, name }; return Promise.resolve(true); }; });
  const vl = await p.evaluate(async () => {
    TD_AKCE.tdRVlastni();
    const o = document.getElementById('modal-rz-polozka'), q = k => o.querySelector('[data-rp="' + k + '"]');
    const r = { otevren: o.classList.contains('open'), titul: document.getElementById('rz-pol-titul').textContent };
    q('kat').value = 'FI'; q('kat').dispatchEvent(new Event('change', { bubbles: true }));
    r.poleFI = Array.from(o.querySelectorAll('[data-rp]')).map(e => e.getAttribute('data-rp')).join();
    q('kat').value = 'FA'; q('kat').dispatchEvent(new Event('change', { bubbles: true }));
    r.poleFA = Array.from(o.querySelectorAll('[data-rp]')).map(e => e.getAttribute('data-rp')).join();
    q('vyrobce').value = 'Vymyšlený výrobce'; q('typ').value = 'VV-B16-1'; q('poly').value = '1'; q('In').value = '16 A'; q('char').value = 'B'; q('icn').value = '6';
    await TD_AKCE.tdRPolUlozit();
    r.chyba = document.getElementById('rz-pol-chyby').textContent; r.porad = o.classList.contains('open');
    q('sirka').value = '1,5'; q('overeno').checked = true; q('pv').value = '2,1';
    await TD_AKCE.tdRPolUlozit(); await __T.w(100);
    r.zavren = !o.classList.contains('open');
    r.ulozeno = DOK.rozvKnihovna.map(x => [x.kat, x.vyrobce, x.typ, x.In, x.char, x.icn, x.sirka, x.pv, x.overeno, x.zdroj].join('|')).join();
    __T.filtr('overene', true);
    r.overene = Array.from(document.querySelectorAll('#rz-seznam .rz-polozka b')).map(x => x.textContent).join();
    TD_AKCE.tdRFiltrZrusit();
    TD_AKCE.tdRVlastniSkrin();
    q('rady').value = '2'; q('modulu').value = '18'; q('vyrobce').value = 'Vymyšlený výrobce'; q('ip').value = 'IP41'; q('ina').value = '63';
    await TD_AKCE.tdRPolUlozit(); await __T.w(100);
    r.skrin = DOK.rozvKnihovna.filter(x => x.druh === 'skrin').map(x => rozvNazev(rozvPolozkaNorm(x)) + '|' + x.rady + 'x' + x.modulu + '|' + x.ina).join();
    r.nedokument = !window.__dokOtevreny.ulozen || DOK.dokumenty.length === 0;
    return r;
  });
  check('vlastní přístroj: dialog, u chrániče IΔn a typ, u jističe charakteristika a Icn', vl.otevren && /Vlastní přístroj/.test(vl.titul) &&
    /idn,rcdTyp/.test(vl.poleFI) && !/char/.test(vl.poleFI) && /char,icn,icu,ics/.test(vl.poleFA), vl.poleFI + ' / ' + vl.poleFA);
  check('vlastní přístroj: bez šířky se neuloží a řekne proč', /chybí šířka v modulech/.test(vl.chyba) && vl.porad, vl.chyba);
  check('vlastní přístroj: uložen s desetinnou šířkou 1,5, „16 A" jako číslo, ověřený, zdroj vlastní',
    vl.zavren && vl.ulozeno === 'FA|Vymyšlený výrobce|VV-B16-1|16|B|6|1.5|2.1|true|vlastni', vl.ulozeno);
  check('„jen ověřené" ukáže vlastní ověřený přístroj', vl.overene === 'Jistič 1P B16 · VV-B16-1', vl.overene);
  check('vlastní skříň: 2×18, InA, název se složí z údajů', vl.skrin === 'Skříň, 2×18 modulů|2x18|63', vl.skrin);

  // ── 3c. import CSV (správný i chybný), šablona, export, JSON ──────────
  const imp = await p.evaluate(async () => {
    const r = {};
    TD_AKCE.tdRSablona();
    r.sablona = { name: __ul.name, type: __ul.blob.type, text: await __ul.blob.text(), bom: Array.from(new Uint8Array(await __ul.blob.arrayBuffer()).slice(0, 3)).join() };
    const csv = '﻿druh;kategorie;vyrobce;rada;typ;poly;in;charakteristika;icn;idn;typ_chranice;sirka_moduly;pv;overeno;poznamka\r\n' +
      'pristroj;FA;Vymyšlený výrobce;VV1;VV-C10-1;1P;10;C;6;;;1;1,8;ano;"text; se středníkem"\r\n' +
      ';jistič;Vymyšlený výrobce;VV1;VV-C20-3;3;20 A;C;10;;;3;;ne;\r\n' +
      'pristroj;-FI/FA;Vymyšlený výrobce;VV2;VV-RCBO-B16;1+N;16;B;6;30;A;2;;;\r\n' +
      '\r\n';
    await rozvImportSoubor(new File([csv], 'knihovna.csv', { type: 'text/csv' }));
    const m = document.getElementById('modal-rz-import');
    r.nahled = { open: m.classList.contains('open'), text: document.getElementById('rz-import-obsah').innerText, btn: document.getElementById('rz-import-ulozit').textContent };
    r.predUlozenim = DOK.rozvKnihovna.length;
    await TD_AKCE.tdRImportUlozit(); await __T.w(100);
    r.po = DOK.rozvKnihovna.filter(x => x.zdroj === 'import').map(x => [x.kat, x.typ, x.poly, x.In, x.char, x.idn, x.rcdTyp, x.sirka, x.pv, x.overeno, x.pozn].join('|'));
    // znovu tentýž soubor — aktualizace, žádné duplicity
    await rozvImportSoubor(new File([csv.replace('VV-C10-1;1P;10;C;6;;;1;1,8', 'VV-C10-1;1P;10;C;10;;;1;1,8')], 'knihovna.csv'));
    r.znovu = document.getElementById('rz-import-obsah').innerText;
    await TD_AKCE.tdRImportUlozit(); await __T.w(100);
    r.poZnovu = DOK.rozvKnihovna.length + '|' + DOK.rozvKnihovna.find(x => x.typ === 'VV-C10-1').icn;
    // chybný soubor (cp1250 z českého Excelu)
    const chybny = 'druh,kategorie,výrobce,typ,póly,in,charakteristika,šířka (moduly),rady,moduly v řadě,třída SPD,neznámý sloupec\n' +
      'pristroj,XY,Vymyšlený,T1,1,16,B,1,,,,\n' +
      'pristroj,FA,Vymyšlený,T2,5,16,B,1,,,,\n' +
      'pristroj,FA,Vymyšlený,T3,1,šestnáct,X,,,,,\n' +
      'skrin,,Vymyšlený,S1,,,,,3,,,\n' +
      'pristroj,SPD,Vymyšlený,T4,3+N,,,4,,,T1+T5,\n' +
      'pristroj,FA,Vymyšlený,OK1,1,16,B,1,,,,\n';
    const enc = [];
    for (const ch of chybny) { const m = { 'ý': 0xFD, 'ó': 0xF3, 'ř': 0xF8, 'ě': 0xEC, 'í': 0xED, 'š': 0x9A, 'á': 0xE1, 'ž': 0x9E, 'č': 0xE8, 'ů': 0xF9 }[ch]; enc.push(m || ch.charCodeAt(0)); }
    const pred = JSON.stringify(DOK.rozvKnihovna);
    await rozvImportSoubor(new File([new Uint8Array(enc)], 'chybny.csv'));
    r.chybny = { text: document.getElementById('rz-import-obsah').innerText, btn: document.getElementById('rz-import-ulozit').textContent };
    TD_AKCE.tdRImportZavrit(); await dokNacist();
    r.nezmeneno = JSON.stringify(DOK.rozvKnihovna) === pred;
    // export a zpět přes JSON
    await TD_AKCE.tdRExport();
    r.export = { name: __ul.name, type: __ul.blob.type };
    const json = await __ul.blob.text(), d = JSON.parse(json);
    r.export.format = d._format; r.export.pocty = d.pristroje.length + '/' + d.skrine.length;
    await rozvImportSoubor(new File([json], 'Knihovna.json'));
    r.json = document.getElementById('rz-import-obsah').innerText;
    TD_AKCE.tdRImportZavrit();
    await rozvImportSoubor(new File(['{"pristroje":[{"kat":"KM","sirka":1}]'], 'rozbity.json'));
    r.rozbity = document.getElementById('rz-import-obsah').innerText;
    TD_AKCE.tdRImportZavrit();
    return r;
  });
  check('šablona CSV: jen hlavička, středníky, UTF-8 s BOM, typ text/csv', imp.sablona.type === 'text/csv' && /\.csv$/.test(imp.sablona.name) &&
    imp.sablona.bom === '239,187,191' && /^druh;kategorie;nazev;vyrobce;rada;typ;poly;in;charakteristika;/.test(imp.sablona.text) &&
    imp.sablona.text.trim().split('\n').length === 1, JSON.stringify(imp.sablona).slice(0, 120));
  check('import CSV: náhled před uložením (3 položky, nové 3) a do té doby nic neuloží', imp.nahled.open && /Načte se 3/.test(imp.nahled.text) &&
    /nových 3/.test(imp.nahled.text) && imp.nahled.btn === '✓ Uložit do knihovny (3)' && imp.predUlozenim === 2, imp.nahled.text.replace(/\n/g, ' | '));
  check('import CSV: kód i české slovo kategorie, „1P", „20 A", desetinná čárka, středník v uvozovkách, ověřeno ano/ne',
    imp.po.join(' / ') === 'FA|VV-C10-1|1|10|C|||1|1.8|true|text; se středníkem / FA|VV-C20-3|3|20|C|||3||false| / FIFA|VV-RCBO-B16|1+N|16|B|30|A|2||false|', imp.po.join(' / '));
  check('import podruhé: aktualizuje podle výrobce a typu, nic nezdvojí', /nových 0, aktualizovaných 3/.test(imp.znovu) && imp.poZnovu === '5|10', imp.poZnovu);
  check('chybný CSV (cp1250, čárky): chyby po řádcích, dobrý řádek projde', /Chybných řádků: 5/.test(imp.chybny.text) &&
    /řádek 2: neznámá kategorie „XY"/.test(imp.chybny.text) && /řádek 3: póly „5"/.test(imp.chybny.text) &&
    /řádek 4: .*In „šestnáct" není číslo.*charakteristika „X"|řádek 4: .*chybí šířka/.test(imp.chybny.text) && /řádek 5: chybí počet modulů v řadě/.test(imp.chybny.text) &&
    /řádek 6: třída SPD „T1\+T5"/.test(imp.chybny.text) && /Neznámé sloupce.*neznámý sloupec/.test(imp.chybny.text) && imp.chybny.btn === '✓ Uložit do knihovny (1)',
    imp.chybny.text.replace(/\n/g, ' | '));
  check('chybný import zrušený — knihovna beze změny', imp.nezmeneno);
  check('export JSON: formát revize-el-knihovna-rozvadecu, jen vaše položky', imp.export.type === 'application/json' && imp.export.format === 'revize-el-knihovna-rozvadecu' &&
    imp.export.pocty === '4/1' && /\.json$/.test(imp.export.name), JSON.stringify(imp.export));
  check('import JSON z exportu: pozná stejné položky (aktualizace)', /Načte se 5/.test(imp.json) && /nových 0, aktualizovaných 5/.test(imp.json), imp.json.split('\n').slice(0, 2).join(' | '));
  check('rozbitý JSON: srozumitelná chyba, nic k uložení', /není platný JSON/.test(imp.rozbity), imp.rozbity.slice(0, 120));

  // přetažení souboru na plochu v knihovně (na seznamu) — nesmí ho chytit obecný import
  const drop = await p.evaluate(async () => {
    await dokUlozitOtevreny(); dokOtevritSeznam('rozv');
    document.getElementById('dok-knihovna-karta').open = true;
    const z = document.getElementById('rz-drop');
    const dt = new DataTransfer();
    dt.items.add(new File(['kategorie;typ;sirka_moduly\nKM;VV-KM-1;1\n'], 'stykac.csv', { type: 'text/csv' }));
    z.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    const nad = z.classList.contains('nad');
    z.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    await __T.w(300);
    const r = { nad, open: document.getElementById('modal-rz-import').classList.contains('open'), text: document.getElementById('rz-import-obsah').innerText,
                obecny: document.getElementById('drop-overlay') ? document.getElementById('drop-overlay').classList.contains('on') : false };
    await TD_AKCE.tdRImportUlozit(); await __T.w(200);
    r.sprava = document.getElementById('rz-sprava').innerText;
    return r;
  });
  check('přetažení CSV na vyznačenou plochu: náhled importu, ne obecný import zálohy', drop.nad && drop.open && /Načte se 1/.test(drop.text) && !drop.obecny, drop.text.slice(0, 80));
  check('správa knihovny: vaše položky se zdrojem vlastní / import', /Vaše položky: 6/.test(drop.sprava) && /VV-KM-1/.test(drop.sprava) && /import/i.test(drop.sprava) && /vlastní/i.test(drop.sprava),
    drop.sprava.replace(/\n/g, ' | '));
  const smaz = await p.evaluate(async () => {
    const r = {};
    TD_AKCE.tdRPolUpravit(document.querySelector('#rz-sprava [data-kid] [data-action="tdRPolUpravit"]'));
    const o = document.getElementById('modal-rz-polozka');
    r.upravit = document.getElementById('rz-pol-titul').textContent + '|' + !o.querySelector('.rz-druh');
    o.querySelector('[data-rp="pozn"]').value = 'upraveno';
    await TD_AKCE.tdRPolUlozit(); await __T.w(100);
    r.pozn = DOK.rozvKnihovna[0].pozn + '|' + DOK.rozvKnihovna.length;
    const id = DOK.rozvKnihovna[0].id;
    await TD_AKCE.tdRPolSmazat(document.querySelector('#rz-sprava [data-kid="' + id + '"] [data-action="tdRPolSmazat"]'));
    r.poSmazani = DOK.rozvKnihovna.length;
    zpetPosledni(); await __T.w(400); await dokNacist();
    r.zpet = DOK.rozvKnihovna.length + '|' + (DOK.rozvKnihovna[0].id === id);
    return r;
  });
  check('úprava položky z knihovny (druh se už nemění)', /^✎ Upravit přístroj\|true$/.test(smaz.upravit) && smaz.pozn === 'upraveno|6', JSON.stringify(smaz));
  check('smazání z knihovny jde vzít zpět (Ctrl+Z) na původní místo', smaz.poSmazani === 5 && smaz.zpet === '6|true', JSON.stringify(smaz));
  await p.evaluate(async () => { await dokOtevrit(DOK.dokumenty.find(d => d.typ === 'rozv').uid); });
  await w(300);

  // ── 4. skříň a hlavička, uložení, znovuotevření ───────────────────────
  await p.evaluate(async () => {
    TD_AKCE.tdRTab(document.querySelector('.rz-tab[data-tab="skrine"]'));
    TD_AKCE.tdRSkrinPouzit(document.querySelector('#rz-seznam [data-kid="v-sk-3x12-z"] [data-action="tdRSkrinPouzit"]'));
    document.querySelector('.rz-hlavicka').open = true;
    __T.nast('[data-dk="oznaceni"]', 'RH1'); __T.nast('[data-dk="stavba"]', 'Byt 3+1, Vymyšlená 12');
    __T.nast('[data-dk="investor.nazev"]', 'Petr Smyšlený'); __T.nast('[data-dk="misto"]', 'Předsíň');
    __T.nast('[data-dk="soustava"]', '3NPE ~400/230 V TN-S'); __T.nast('[data-dk="privodIn"]', '25');
    __T.nast('[data-dk="privodSmer"]', 'zespodu'); __T.nast('[data-dk="privodKabel"]', 'CYKY-J'); __T.nast('[data-dk="privodPrurez"]', '5×10');
    __T.nast('[data-dk="krytiZavreno"]', 'IP40'); __T.nast('[data-dk="krytiOtevreno"]', 'IP20');
    await dokUlozitOtevreny();
  });
  const ul = await p.evaluate(() => {
    const x = DOK.dokumenty.find(d => d.typ === 'rozv');
    return { x: x && { cislo: x.cislo, d: x.data }, tab: document.querySelector('.rz-tab.akt').getAttribute('data-tab'),
             souhrn: document.getElementById('rz-hl-souhrn').textContent, pohled: document.getElementById('rz-pohled').innerText };
  });
  check('skříň: použití přepne knihovnu na přístroje a ukáže skříň a volné místo', ul.tab === 'pristroje' && /Rozvodnice 3×12 modulů/.test(ul.pohled) &&
    /Volné místo: 36 \/ 36 modulů/.test(ul.pohled), ul.tab + ' | ' + ul.pohled.replace(/\n/g, ' | '));
  check('uloženo: hlavička i skříň jako KOPIE s odkazem do knihovny, 3 prázdné řady', ul.x && ul.x.cislo === 'ROZ-0001' &&
    ul.x.d.oznaceni === 'RH1' && ul.x.d.soustava === '3NPE ~400/230 V TN-S' && ul.x.d.privodSmer === 'zespodu' && ul.x.d.investor.nazev === 'Petr Smyšlený' &&
    ul.x.d.skrin && ul.x.d.skrin.knih === 'v-sk-3x12-z' && ul.x.d.skrin.modulu === 12 && ul.x.d.skrin.provedeni === 'zapuštěná' &&
    ul.x.d.rady.length === 3 && ul.x.d.model === 1, JSON.stringify(ul.x && ul.x.d).slice(0, 300));
  check('souhrn hlavičky se přepisuje při psaní', ul.souhrn === 'RH1 · Byt 3+1, Vymyšlená 12 · Petr Smyšlený · 3NPE ~400/230 V TN-S', ul.souhrn);

  await p.reload(); await w(1200); await p.evaluate(pomocnik);
  await p.evaluate(async () => { await dokNacist(); dokOtevritSeznam('rozv'); });
  await w(200);
  const radek = await p.evaluate(() => document.getElementById('dok-seznam').innerText.replace(/\n/g, ' | '));
  check('seznam po restartu: číslo, označení – zakázka, odběratel, místo, skříň', /ROZ-0001/.test(radek) && /RH1 – Byt 3\+1, Vymyšlená 12/.test(radek) &&
    /Petr Smyšlený/.test(radek) && /Předsíň/.test(radek) && /Rozvodnice 3×12/.test(radek), radek);
  await p.evaluate(() => { document.getElementById('dok-hledat').value = 'rozvodnice 3x12'; document.getElementById('dok-hledat').dispatchEvent(new Event('input', { bubbles: true })); });
  const hl = await p.evaluate(() => document.querySelectorAll('#dok-seznam .dok-polozka').length);
  check('hledání v seznamu najde rozvaděč podle skříně', hl === 1, String(hl));
  await p.evaluate(async () => { document.getElementById('dok-hledat').value = ''; await dokOtevrit(DOK.dokumenty.find(d => d.typ === 'rozv').uid); });
  await w(300);
  const zn = await p.evaluate(() => ({ o: dokForm().querySelector('[data-dk="oznaceni"]').value, s: dokForm().querySelector('[data-dk="soustava"]').value,
    sk: __rz.skrin && __rz.skrin.knih, rady: __rz.rady.length, tab: document.querySelector('.rz-tab.akt').getAttribute('data-tab') }));
  check('znovuotevření: hlavička, skříň i řady zpátky, knihovna na přístrojích', zn.o === 'RH1' && zn.s === '3NPE ~400/230 V TN-S' && zn.sk === 'v-sk-3x12-z' &&
    zn.rady === 3 && zn.tab === 'pristroje', JSON.stringify(zn));

  // ── 5. skládání v čelním pohledu ──────────────────────────────────────
  // souřadnice na obrazovce pro řadu r a modul m (střed výšky řady)
  await p.evaluate(() => {
    __T.bod = (r, m) => {
      const svg = document.querySelector('#rz-pohled .rz-svg'), M = svg.getScreenCTM();
      const q = new DOMPoint(RZG.okraj + m * RZG.M, rozvRadaY(r) + RZG.H / 2).matrixTransform(M);
      return { x: Math.round(q.x), y: Math.round(q.y) };
    };
    __T.rada = r => __rz.rady[r].prvky.map(x => x.ozn || x.p.kat).join(',');
    __T.knihBod = kid => {
      const el = document.querySelector('#rz-seznam [data-kid="' + kid + '"] .rz-p-text');
      el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect();
      return { x: Math.round(b.left + 20), y: Math.round(b.top + b.height / 2) };
    };
  });
  const tahni = async (od, kam) => {
    await p.mouse.move(od.x, od.y); await p.mouse.down();
    await p.mouse.move(od.x + 15, od.y + 5, { steps: 3 });
    await p.mouse.move(kam.x, kam.y, { steps: 8 }); await w(60);
    await p.mouse.up(); await w(250);
  };
  // přetažení z knihovny do řady 1 (ve spodní části obrazovky je knihovna i pohled)
  await p.evaluate(() => __T.filtr('q', 'Hlavní vypínač 3P 40'));
  let od = await p.evaluate(() => __T.knihBod('v-qm-3-40'));
  let kam = await p.evaluate(() => { document.getElementById('rz-pohled').scrollIntoView({ block: 'start' }); return __T.bod(0, 0.3); });
  od = await p.evaluate(() => __T.knihBod('v-qm-3-40'));
  kam = await p.evaluate(() => __T.bod(0, 0.3));
  await tahni(od, kam);
  const t1 = await p.evaluate(() => ({ r0: __T.rada(0), vyber: __rz.vyber === (__rz.rady[0].prvky[0] || {}).uid,
    kopie: JSON.stringify(__rz.rady[0].prvky[0] && __rz.rady[0].prvky[0].p), knih: (__rz.rady[0].prvky[0] || {}).knih,
    vlastnosti: document.getElementById('rz-vlastnosti').innerText, duch: !!document.querySelector('.rz-duch') }));
  check('tažení myší z knihovny do řady: přístroj je v řadě 1, vybraný, s označením -QM1', t1.r0 === '-QM1' && t1.vyber && !t1.duch &&
    /Vlastnosti přístroje/i.test(t1.vlastnosti) && /-QM1/.test(t1.vlastnosti), t1.r0);
  check('přístroj nese KOPII parametrů z knihovny (i odkaz knih)', t1.knih === 'v-qm-3-40' && /"In":40/.test(t1.kopie) && /"sirka":3/.test(t1.kopie) && !/"id"/.test(t1.kopie), t1.kopie);

  // celý byt 3+1 (zbytek přes vkládání), pak kontroly
  await p.evaluate(() => { __rz.rady.forEach(r => r.prvky = []); });
  await p.evaluate(require('./rozvadec-byt.js'));
  await w(200);
  const byt = await p.evaluate(() => ({
    r: [0, 1, 2].map(__T.rada),
    volno: document.querySelector('.rz-volno').textContent, chyba: !!document.querySelector('.rz-chyba'),
    nadr: __rz.rady[1].prvky.slice(1).every(x => x.nadr === __rz.rady[1].prvky[0].uid) && __rz.rady[2].prvky[1].nadr === __rz.rady[2].prvky[0].uid,
    nadrNe: __rz.rady[0].prvky[2].nadr === '' && __rz.rady[2].prvky[5].nadr === '' && __rz.rady[2].prvky[0].nadr === '',
    svgText: document.querySelector('#rz-pohled .rz-svg').textContent
  }));
  check('byt 3+1: označení podle kategorie a pořadí (-QM1, SPD1, -FA1…, -FI1, -FI/FA1)',
    byt.r[0] === '-QM1,SPD1,-FA1,REZ' && byt.r[1] === '-FI1,-FA2,-FA3,-FA4,-FA5,-FA6,-FA7,-FA8,-FA9' && byt.r[2] === '-FI2,-FA10,-FA11,-FA12,-FA13,-FI/FA1,REZ', byt.r.join(' / '));
  check('byt 3+1: volné místo 0 / 36 modulů, nic přeplněné', /Volné místo: 0 \/ 36 modulů/.test(byt.volno) && !byt.chyba, byt.volno);
  check('nadřazený chránič: jističe automaticky pod chráničem vlevo ve stejné řadě', byt.nadr && byt.nadrNe);
  check('na čele přístroje: označení, In/charakteristika a vývod', /-FA4/.test(byt.svgText) && /B16/.test(byt.svgText) && /Zásuvky – obý/.test(byt.svgText) && /40A/.test(byt.svgText), '');

  // přeplnění
  await p.evaluate(() => { __rz.aktRada = 1; rozvVlozit('v-fa-1-C16', 1, __rz.rady[1].prvky.length); });
  await w(150);
  const pp = await p.evaluate(() => ({ chyba: (document.querySelector('.rz-chyba') || {}).textContent || '', svg: document.querySelector('#rz-pohled .rz-svg').innerHTML,
                                       toast: Array.from(document.querySelectorAll('.toast')).map(t => t.textContent).join(' | ') }));
  check('přeplněná řada: červené upozornění, šrafovaný přístroj, hláška', /Řada 2 je přeplněná o 1 modul/.test(pp.chyba) && /rz-srafa/.test(pp.svg) && /přeplněno o 1 modul/.test(pp.svg) &&
    /Řada 2 je přeplněná/.test(pp.toast), pp.chyba);
  // přesun mezi řadami myší: přebývající C16 z řady 2 do řady 3 místo rezervy (za -FI/FA1)
  await p.evaluate(() => rozvSmazat(__rz.rady[2].prvky.find(x => x.p.kat === 'REZ').uid));
  od = await p.evaluate(() => __T.bod(1, 12.5)); kam = await p.evaluate(() => __T.bod(2, 10.4));
  await tahni(od, kam);
  const mv = await p.evaluate(() => ({ r1: __T.rada(1), r2: __T.rada(2), chyba: !!document.querySelector('.rz-chyba'), volno: document.querySelector('.rz-volno').textContent }));
  check('přesun myší mezi řadami: z přeplněné řady 2 do řady 3, chyba zmizí', mv.r1 === '-FI1,-FA2,-FA3,-FA4,-FA5,-FA6,-FA7,-FA8,-FA9' &&
    mv.r2 === '-FI2,-FA10,-FA11,-FA12,-FA13,-FI/FA1,-FA14' && !mv.chyba && /Volné místo: 1 \/ 36 modulů/.test(mv.volno), mv.r2 + ' | ' + mv.volno);
  // desetinná šířka: vlastní přístroj 1,5 M místo rezervy 2 M v řadě 1
  const dec = await p.evaluate(() => {
    const vl = DOK.rozvKnihovna.find(x => x.typ === 'VV-B16-1');
    rozvSmazat(__rz.rady[0].prvky.find(x => x.p.kat === 'REZ').uid);
    __rz.aktRada = 0; rozvVlozit(vl.id);
    const r = __rz.rady[0].prvky;
    return { sirka: r[r.length - 1].p.sirka, ozn: r[r.length - 1].ozn, obs: rozvObsazeno(__rz.rady[0]), volno: document.querySelector('.rz-volno').textContent,
             svg: document.querySelector('#rz-pohled .rz-svg').textContent };
  });
  check('desetinná šířka 1,5 modulu: řada 11,5 M, volno ½ modulu, celkem 1,5', dec.sirka === 1.5 && dec.ozn === '-FA15' && dec.obs === 11.5 &&
    /Volné místo: 1,5 \/ 36 modulů/.test(dec.volno) && /volno 0,5 \/ 12 M/.test(dec.svg), dec.volno + ' ' + dec.ozn);
  // výběr klepnutím, vlastnosti, ruční nadřazený chránič
  const sel = await p.evaluate(async () => {
    const x = __rz.rady[1].prvky[3]; const b = __T.bod(1, 4 + 2.5);
    document.elementFromPoint(b.x, b.y).dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: b.x, clientY: b.y }));
    await __T.w(50);
    const r = { vybrany: __rz.vyber === x.uid };
    const pole = k => document.querySelector('#rz-vlastnosti [data-rp2="' + k + '"]');
    pole('vyvod').value = 'Zásuvky – obývací pokoj, TV'; pole('vyvod').dispatchEvent(new Event('input', { bubbles: true }));
    pole('faze').value = 'L2'; pole('faze').dispatchEvent(new Event('change', { bubbles: true }));
    pole('kabel').value = 'CYKY-O'; pole('kabel').dispatchEvent(new Event('input', { bubbles: true }));
    r.volby = Array.from(pole('nadr').options).map(o => o.textContent).join(' | ');
    pole('nadr').value = __rz.rady[2].prvky[0].uid; pole('nadr').dispatchEvent(new Event('change', { bubbles: true }));
    r.data = [x.vyvod, x.faze, x.kabel, x.nadr === __rz.rady[2].prvky[0].uid, x.nadrRucne].join('|');
    r.svg = document.querySelector('#rz-pohled .rz-svg').textContent;
    // přesun chrániče jinam ruční volbu nezruší, smazání chrániče ano
    rozvSmazat(__rz.rady[2].prvky[0].uid);
    r.poSmazani = [x.nadrRucne, x.nadr === __rz.rady[1].prvky[0].uid].join('|');
    zpetPosledni(); await __T.w(50);
    return r;
  });
  check('klepnutí na přístroj ho vybere, vlastnosti se zapíšou a hned ukážou v pohledu', sel.vybrany && /^Zásuvky – obývací pokoj, TV\|L2\|CYKY-O\|true\|true$/.test(sel.data) &&
    /Zásuvky – obý/.test(sel.svg), sel.data);
  check('nadřazený chránič jde změnit ručně (nabídka: automaticky, žádný, chrániče)', /^automaticky — -FI1 \| žádný \(přímo z přívodu\) \| -FI1 \(řada 2\) \| -FI2 \(řada 3\)$/.test(sel.volby), sel.volby);
  check('smazaný ručně zvolený chránič → zpátky automaticky', sel.poSmazani === 'false|true', sel.poSmazani);
  // klávesy: Delete, Ctrl+Z, šipky, Ctrl+D, přečíslovat
  await p.evaluate(() => { document.activeElement && document.activeElement.blur(); __rz.vyber = __rz.rady[1].prvky[2].uid; rozvPohledVykreslit(); rozvVlastnostiVykreslit(); });
  await p.keyboard.press('Delete'); await w(100);
  const k1 = await p.evaluate(() => __T.rada(1));
  await p.keyboard.press('Control+z'); await w(150);
  const k2 = await p.evaluate(() => __T.rada(1));
  await p.evaluate(() => { __rz.vyber = __rz.rady[1].prvky[2].uid; rozvPohledVykreslit(); });
  await p.keyboard.press('ArrowRight'); await w(80);
  const k3 = await p.evaluate(() => __T.rada(1));
  await p.keyboard.press('Control+d'); await w(80);
  const k4 = await p.evaluate(() => __T.rada(1));
  await p.keyboard.press('Control+z'); await w(80);
  await p.evaluate(() => rozvPrecislovat()); await w(80);
  const k5 = await p.evaluate(() => [0, 1, 2].map(__T.rada).join(' / '));
  check('Delete smaže vybraný přístroj, Ctrl+Z ho vrátí na místo', k1 === '-FI1,-FA2,-FA4,-FA5,-FA6,-FA7,-FA8,-FA9' && k2 === '-FI1,-FA2,-FA3,-FA4,-FA5,-FA6,-FA7,-FA8,-FA9', k1 + ' → ' + k2);
  check('šipka → posune v řadě, Ctrl+D duplikuje s dalším volným označením', k3 === '-FI1,-FA2,-FA4,-FA3,-FA5,-FA6,-FA7,-FA8,-FA9' && k4 === '-FI1,-FA2,-FA4,-FA3,-FA16,-FA5,-FA6,-FA7,-FA8,-FA9', k3 + ' | ' + k4);
  const PREC = '-QM1,SPD1,-FA1,-FA2 / -FI1,-FA3,-FA4,-FA5,-FA6,-FA7,-FA8,-FA9,-FA10 / -FI2,-FA11,-FA12,-FA13,-FA14,-FI/FA1,-FA15';
  check('Přečíslovat: podle pořadí v řadách zleva doprava', k5 === PREC, k5);
  // tlačítka posunu a rychlé přidání
  const tl = await p.evaluate(() => {
    __rz.vyber = __rz.rady[0].prvky[2].uid; rozvVlastnostiVykreslit();
    TD_AKCE.tdRPosun(document.querySelector('#rz-vlastnosti [data-smer="d"]'));
    const r = { posun: __T.rada(0) + ' / ' + __T.rada(1) };
    TD_AKCE.tdRPosun(document.querySelector('#rz-vlastnosti [data-smer="n"]'));
    r.zpet = __T.rada(0);
    r.rychle = __T.rada(0);
    return r;
  });
  check('▼ / ▲ přesune do sousední řady na podobné místo a zpět', /^-QM1,SPD1,-FA2 \/ -FI1,-FA3,-FA4,-FA5,-FA1,-FA6,/.test(tl.posun) && tl.zpet === '-QM1,SPD1,-FA1,-FA2', tl.posun + ' | ' + tl.zpet);
  const tl2 = await p.evaluate(() => { __rz.aktRada = 1; TD_AKCE.tdRRychle(document.querySelector('#rz-rychle [data-kid="v-rez-1"]')); return __T.rada(2); });
  check('rychlé přidání: plná vybraná řada → na konec první řady, kde je místo', tl.rychle === '-QM1,SPD1,-FA1,-FA2' && tl2 === '-FI2,-FA11,-FA12,-FA13,-FA14,-FI/FA1,-FA15,REZ' &&
    await p.evaluate(() => __rz.aktRada === 2), tl.rychle + ' | ' + tl2);
  await p.evaluate(() => rozvSmazat(__rz.rady[2].prvky[7].uid));

  // uložení a znovuotevření; změna knihovny hotový rozvaděč nezmění
  await p.evaluate(async () => {
    await dokUlozitOtevreny();
    await dokNacist();
    const vl = DOK.rozvKnihovna.find(x => x.typ === 'VV-B16-1'); vl.sirka = 2; vl.In = 20; await dokZapsat();
  });
  await p.reload(); await w(1200); await p.evaluate(pomocnik);
  await p.evaluate(async () => { await dokNacist(); await dokOtevrit(DOK.dokumenty.find(d => d.typ === 'rozv').uid); });
  await w(300);
  const zo = await p.evaluate(() => {
    const vl = __rz.rady[0].prvky.find(x => x.p.typ === 'VV-B16-1'), tv = __rz.rady[1].prvky.find(x => /TV/.test(x.vyvod)) || {};
    return { r: [0, 1, 2].map(r => __rz.rady[r].prvky.map(x => x.ozn || x.p.kat).join(',')).join(' / '),
             vyvod: tv.vyvod + '|' + tv.ozn, faze: tv.faze, vl: vl && [vl.p.sirka, vl.p.In].join('|'),
             svg: !!document.querySelector('#rz-pohled .rz-svg [data-puid]'), volno: document.querySelector('.rz-volno').textContent };
  });
  check('znovuotevření: všechny řady, označení, vývody a fáze zpátky', zo.svg && zo.r === PREC &&
    zo.vyvod === 'Zásuvky – obývací pokoj, TV|-FA4' && zo.faze === 'L2', zo.r + ' | ' + zo.vyvod);
  check('pozdější změna knihovny hotový rozvaděč nezmění (kopie parametrů)', zo.vl === '1.5|16', zo.vl);

  // ── 5b. PDF ───────────────────────────────────────────────────────────
  await p.evaluate(async () => {
    const f = dokForm(), dk = (s, v) => { const e = f.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
    dk('[data-dk="icc"]', '6'); dk('[data-dk="investor.adresa"]', 'Vymyšlená 12, 697 01 Kyjov');
    // víc přístrojů, ať se seznam rozdělí do dvou tabulek
    __rz.aktRada = 2; for (let i = 0; i < 4; i++) rozvVlozit('v-fa-1-B6', 2, __rz.rady[2].prvky.length);
    await dokUlozitOtevreny();
    await dokNahled(); await __T.w(600);
  });
  const pdf = await p.evaluate(() => {
    const st = Array.from(document.querySelectorAll('#dok-pdf-pages .a4'));
    const vse = st.map(s => s.innerText).join('\n');
    const nonRez = __rz.rady.reduce((n, r) => n + r.prvky.filter(x => x.p.kat !== 'REZ').length, 0);
    const radky = Array.from(document.querySelectorAll('#dok-pdf-pages .rz-pdf-tab tr')).filter(tr => tr.querySelector('td'));
    const svg = document.querySelector('#dok-pdf-pages .rz-pdf-pohled svg');
    const stranaSvg = svg && svg.closest('.a4').getBoundingClientRect(), r = svg && svg.getBoundingClientRect();
    return {
      akt: document.querySelector('.screen.active').id, pocet: st.length, nasirku: st.every(s => s.classList.contains('a4-landscape') && Math.abs(s.getBoundingClientRect().width - 297 * 96 / 25.4) < 3),
      strana: /Strana 1 \/ \d/.test(vse), vse,
      tabulek: document.querySelectorAll('#dok-pdf-pages .rz-pdf-tab').length, hlavicek: document.querySelectorAll('#dok-pdf-pages .rz-pdf-tab th').length,
      radku: radky.length, nonRez, rez: radky.some(tr => /Rezerva/.test(tr.innerText)),
      prvni: radky[0] && Array.from(radky[0].children).map(td => td.innerText.trim()).join(' | '),
      fa4: (radky.find(tr => /obývací pokoj, TV/.test(tr.innerText)) || { innerText: '' }).innerText.replace(/\s+/g, ' '),
      overenyBezHvezdy: !!radky.find(tr => /VV-B16-1/.test(tr.innerText) && !/\*/.test(tr.innerText)),
      svg: !!svg, svgVStrance: !!r && r.right <= stranaSvg.right + 1 && r.bottom <= stranaSvg.bottom + 1 && r.width > 300,
      svgMm: svg && svg.getAttribute('width'), vyber: svg && !/#2B579A/.test(svg.innerHTML), znacka: svg && !svg.querySelector('#rz-znacka'),
      info: document.getElementById('dok-pdf-info').textContent
    };
  });
  check('PDF: náhled na šířku (A4 297 mm), číslování stran', pdf.akt === 'screen-dok-pdf' && pdf.nasirku && pdf.strana && pdf.pocet >= 3, pdf.pocet + ' · ' + pdf.info);
  check('PDF: titul a hlavička (zakázka, odběratel, místo, označení, soustava, přívod, kabel, krytí, Icc, výrobce, skříň)',
    /ROZVADĚČ RH1/i.test(pdf.vse) && /ČSN EN 61439-3/.test(pdf.vse) && /č\. ROZ-0001/.test(pdf.vse) && /Byt 3\+1, Vymyšlená 12/.test(pdf.vse) &&
    /Petr Smyšlený/.test(pdf.vse) && /Předsíň/.test(pdf.vse) && /3NPE ~400\/230 V TN-S/.test(pdf.vse) && /25 A, přívod zespodu/.test(pdf.vse) &&
    /CYKY-J 5×10/.test(pdf.vse) && /IP40 \(dveře zavřené\), IP20 \(dveře otevřené\)/.test(pdf.vse) && /6 kA/.test(pdf.vse) &&
    /Vymyšlená elektro s\.r\.o\./.test(pdf.vse) && /IČO: 12345678/.test(pdf.vse) && /Rozvodnice 3×12 modulů, plast, zapuštěná/.test(pdf.vse), '');
  check('PDF: čelní pohled jako obrázek ve stránce (v mm, zmenšený, bez výběru a značky)', pdf.svg && pdf.svgVStrance && /mm$/.test(pdf.svgMm) && pdf.vyber && pdf.znacka &&
    /Zmenšeno na \d+ %/.test(pdf.vse), pdf.svgMm);
  check('PDF: seznam přístrojů bez rezerv — každý přístroj jeden řádek, dlouhý seznam ve dvou tabulkách se záhlavím', pdf.radku === pdf.nonRez && !pdf.rez &&
    pdf.tabulek === 2 && pdf.hlavicek === 18, pdf.radku + '/' + pdf.nonRez + ' · tabulek ' + pdf.tabulek);
  check('PDF: sloupce označení, popis vývodu, typ, In, charakteristika, póly, IΔn, fáze, kabel', pdf.prvni === '-QM1 |  | Hlavní vypínač 3P 40 A * | 40 A |  | 3P |  | 3f | ' &&
    /^-FA4 Zásuvky – obývací pokoj, TV Jistič 1P B16 \* 16 A B 1P L2 CYKY-O 3×2,5$/.test(pdf.fa4.trim()), pdf.prvni + ' || ' + pdf.fa4);
  check('PDF: neověřené přístroje s hvězdičkou a vysvětlivkou, ověřený vlastní bez ní', /\* Údaje přístroje nejsou ověřené/.test(pdf.vse) && pdf.overenyBezHvezdy);
  const obr = await p.evaluate(async () => {
    const el = document.querySelector('#dok-pdf-pages .rz-pdf-pohled');
    const c = await html2canvas(el, { scale: 1, backgroundColor: '#ffffff', logging: false });
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let barvy = new Set(), cervena = 0, modra = 0;
    for (let i = 0; i < d.length; i += 16) {
      barvy.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4));
      if (d[i] > 150 && d[i + 1] < 80 && d[i + 2] < 80) cervena++;
      if (d[i + 2] > 200 && d[i] > 200 && d[i] < 230 && d[i + 1] > 220) modra++;
    }
    const blob = await renderPagesToPDF(Array.from(document.querySelectorAll('#dok-pdf-pages .a4')), dokPdfNazev(), { vratitBlob: true });
    const txt = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));
    return { w: c.width, barvy: barvy.size, cervena, modra, typ: blob.type, vel: blob.size, stran: (txt.match(/\/Type \/Page\b/g) || []).length, nazev: dokPdfNazev() };
  });
  check('PDF: html2canvas čelní pohled opravdu nakreslí (barvy přístrojů, páčka hlavního vypínače)', obr.w > 300 && obr.barvy > 8 && obr.cervena > 10 && obr.modra > 50, JSON.stringify(obr));
  check('PDF: soubor vznikne (jsPDF), strany sedí, název z čísla a zakázky', obr.typ === 'application/pdf' && obr.vel > 20000 && obr.stran === pdf.pocet &&
    /^ROZ-0001_Rozvaděč_Byt_3\+1,_Vymyšlená_12\.pdf$/.test(obr.nazev), obr.stran + ' str. · ' + obr.vel + ' B · ' + obr.nazev);
  const zpet = await p.evaluate(async () => {
    TD_AKCE.tdPdfZpet(); await __T.w(200);
    const r = { akt: document.querySelector('.screen.active').id };
    await dokDopsat(); dokOtevritSeznam('rozv'); await __T.w(100);
    TD_AKCE.tdDokPdf(document.querySelector('#dok-seznam [data-action="tdDokPdf"]')); await __T.w(500);
    r.zeSeznamu = document.querySelector('.screen.active').id + '|' + document.querySelectorAll('#dok-pdf-pages .rz-pdf-pohled svg').length;
    TD_AKCE.tdPdfZpet(); await __T.w(100); r.zpetNaSeznam = document.querySelector('.screen.active').id;
    await dokOtevrit(DOK.dokumenty.find(d => d.typ === 'rozv').uid);
    return r;
  });
  check('PDF: zpět do editoru, „📄 PDF" i ze seznamu', zpet.akt === 'screen-dok-form' && zpet.zeSeznamu === 'screen-dok-pdf|1' && zpet.zpetNaSeznam === 'screen-dok-seznam', JSON.stringify(zpet));

  // ── 6. telefon: klepnutí místo tažení ────────────────────────────────
  {
    const c2 = await b.newContext({ viewport: { width: 375, height: 760 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await c2.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
    const t = await c2.newPage(); const err2 = [];
    t.on('pageerror', e => err2.push(e.message)); t.on('dialog', d => d.accept());
    await t.goto(URL); await w(1200); await t.evaluate(pomocnik);
    await t.evaluate(async () => {
      await dokNacist(); await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-2x12-n'));
      __T.bod = (r, m) => { const svg = document.querySelector('#rz-pohled .rz-svg'), M = svg.getScreenCTM();
        const q = new DOMPoint(RZG.okraj + m * RZG.M, rozvRadaY(r) + RZG.H / 2).matrixTransform(M); return { x: Math.round(q.x), y: Math.round(q.y) }; };
    });
    await w(200);
    const tap = async (fn, arg) => { const q = await t.evaluate(fn, arg); await t.touchscreen.tap(q.x, q.y); await w(350); };
    const vid = async sel => t.evaluate(s => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + 12, y: b.top + b.height / 2 }; }, sel);
    const lay = await t.evaluate(() => {
      const k = document.querySelector('.rz-knihovna').getBoundingClientRect(), p2 = document.getElementById('rz-pohled').getBoundingClientRect(),
            v = document.getElementById('rz-vlastnosti').getBoundingClientRect();
      return { podSebou: k.bottom <= p2.top + 1 && p2.bottom <= v.top + 1, sirka: document.documentElement.scrollWidth };
    });
    check('telefon 375 px: knihovna, čelní pohled a vlastnosti pod sebou, stránka bez vodorovného posunu', lay.podSebou && lay.sirka <= 375, JSON.stringify(lay));
    await t.evaluate(() => __T.filtr('q', 'Jistič 1P B16'));
    let q = await vid('#rz-seznam [data-kid="v-fa-1-B16"] .rz-p-text'); await t.touchscreen.tap(q.x, q.y); await w(500);
    const ban = await t.evaluate(() => ({ vyber: __rz.knihVyber, banner: (document.querySelector('.rz-banner') || {}).textContent || '' }));
    await t.evaluate(() => document.getElementById('rz-svg-ram').scrollIntoView({ block: 'center' })); await w(200);
    await tap(() => __T.bod(1, 0.5));
    const vl1 = await t.evaluate(() => ({ r: __rz.rady.map(r => r.prvky.map(x => x.ozn).join(',')).join(' / '), banner: !!document.querySelector('.rz-banner') }));
    check('telefon: klepnutí na přístroj v knihovně ho vybere (banner „klepněte do řady")', ban.vyber === 'v-fa-1-B16' && /klepněte do řady/.test(ban.banner), ban.banner);
    check('telefon: klepnutí do řady ho tam vloží', vl1.r === ' / -FA1' && !vl1.banner, vl1.r);
    q = await vid('#rz-rychle [data-kid="v-fi-4-40-30-A"]'); await t.touchscreen.tap(q.x, q.y); await w(300);
    q = await vid('#rz-rychle [data-kid="v-fa-1-B10"]'); await t.touchscreen.tap(q.x, q.y); await w(300);
    const vl2 = await t.evaluate(() => __rz.rady.map(r => r.prvky.map(x => x.ozn).join(',')).join(' / '));
    check('telefon: rychlé přidání klepnutím na konec vybrané řady', vl2 === ' / -FA1,-FI1,-FA2', vl2);
    // přesun klepnutím: vybrat -FI1, „✥ Přesunout jinam", klepnout na začátek řady 2
    await t.evaluate(() => document.getElementById('rz-svg-ram').scrollIntoView({ block: 'center' })); await w(200);
    await tap(() => __T.bod(1, 3));
    const vyb = await t.evaluate(() => (rozvNajit(__rz.vyber) || { x: {} }).x.ozn);
    q = await vid('#rz-vlastnosti [data-action="tdRPresunKlep"]'); await t.touchscreen.tap(q.x, q.y); await w(400);
    await t.evaluate(() => document.getElementById('rz-svg-ram').scrollIntoView({ block: 'center' })); await w(200);
    await tap(() => __T.bod(1, 0.2));
    const vl3 = await t.evaluate(() => ({ r: __rz.rady.map(r => r.prvky.map(x => x.ozn).join(',')).join(' / '), nadr: __rz.rady[1].prvky.slice(1).every(x => x.nadr === __rz.rady[1].prvky[0].uid) }));
    check('telefon: klepnutím vybraný přístroj jde „✥ Přesunout jinam" klepnutím do řady', vyb === '-FI1' && vl3.r === ' / -FI1,-FA1,-FA2' && vl3.nadr, vyb + ' → ' + vl3.r);
    const ozn = await t.evaluate(() => { const svg = document.querySelector('#rz-pohled .rz-svg'), r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal; return r.width / vb.width; });
    check('telefon: čelní pohled čitelný (aspoň 2,3 px na mm, posouvá se ve svém rámečku)', ozn >= 2.29, ozn.toFixed(2));
    check('telefon: žádná chyba na stránce', err2.length === 0, err2.join(' | '));
    await c2.close();
  }

  // ── oddělení od revizí ────────────────────────────────────────────────
  const odd = await p.evaluate(async () => {
    showScreen('home'); renderArchiv();
    return { archiv: JSON.stringify(archiv), home: document.getElementById('screen-home').innerText, otisk: await __T.otiskRevizi(),
             vStore: Object.keys(STORE).filter(k => /rozv|dok/i.test(k)).join() };
  });
  check('oddělení: archiv revizí nezměněný a rozvaděč v něm není', odd.archiv === archivPred && !/ROZ-0001/.test(odd.home));
  check('oddělení: data revizí bajtově stejná, ve STORE nic z rozvaděčů', odd.otisk === otiskPred && !odd.vStore, odd.vStore);

  check('žádná chyba na stránce', err.length === 0, err.join(' | '));
  console.log(res.join('\n'));
  console.log(res.filter(r => r.startsWith('❌')).length ? 'SELHALO' : 'VŠE OK (' + res.length + ')');
  await b.close();
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})();
