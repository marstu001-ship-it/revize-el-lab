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
  check('skříň: použití přepne knihovnu na přístroje a ukáže skříň', ul.tab === 'pristroje' && /3 × 12 modulů/.test(ul.pohled), ul.tab + ' | ' + ul.pohled);
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
