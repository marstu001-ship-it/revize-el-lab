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
      typy: v.filter(x => x.druh === 'skrin').map(x => x.rady + 'x' + x.modulu + ':' + x.typSkrine).filter(t => !/:domovni$/.test(t)).join(),
      domovni: v.filter(x => x.druh === 'skrin' && x.typSkrine === 'domovni').length,
      etim: ['FA', 'FI', 'FIFA', 'SPD'].map(k => rozvKat(k).etim).join() + ',' + ROZV_SKRIN_ETIM
    };
  });
  check('vestavěné: jen výrobce „obecný", nic ověřeného', vest.vyrobci === 'obecný' && vest.overene === 0, vest.vyrobci + ' / ověřeno ' + vest.overene);
  check('vestavěné: Pv, Icn, Icu, Ics, InA ani Penc nevymyšlené (prázdné)', vest.pv === 0 && vest.skrineInA === 0, vest.pv + ' / ' + vest.skrineInA);
  check('vestavěné: každý přístroj má šířku v modulech, i ½ modulu', vest.sirky === 0 && vest.polmodul);
  check('vestavěné: všech 15 kategorií', vest.kat === 15, String(vest.kat));
  check('vestavěné: jistič, chránič, RCBO, SPD, hlavní vypínač v zadaném tvaru', vest.jistic && vest.chranic && vest.rcbo && vest.spd && vest.qm);
  check('vestavěné skříně: 1–4×12, 2–4×18 plast nástěnné i zapuštěné, 3–4×24 oceloplech, 5–8×24 oceloplech nástěnné, 10 a 12×24 stojanové',
    vest.skrine === '1x12pn,1x12pz,2x12pn,2x12pz,3x12pn,3x12pz,4x12pn,4x12pz,2x18pn,2x18pz,3x18pn,3x18pz,4x18pn,4x18pz,3x24on,4x24on,5x24on,6x24on,7x24on,8x24on,10x24os,12x24os', vest.skrine);
  check('typ skříně: velké 5–8×24 a stojanové průmyslové, ostatní (16) domovní', vest.typy === '5x24:prumyslova,6x24:prumyslova,7x24:prumyslova,8x24:prumyslova,10x24:prumyslova,12x24:prumyslova' &&
    vest.domovni === 16, vest.typy + ' / domovních ' + vest.domovni);
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
  f.skrineViditelne = await p.evaluate(() => ['vyrobce', 'rady', 'modulu', 'provedeni', 'material'].map(k => { const e = document.querySelector('#rz-filtry-hlavni .rz-f[data-f="' + k + '"]'); return e && e.offsetHeight > 0 ? k : '-'; }).join());
  await p.evaluate(() => __T.filtr('rady', '3')); await p.evaluate(() => __T.filtr('modulu', '12')); f.sk36 = await p.evaluate(() => __T.nalezeno());
  await p.evaluate(() => __T.filtr('provedeni', 'zapuštěná')); f.sk36z = await p.evaluate(() => __T.nalezeno());
  await p.evaluate(() => { TD_AKCE.tdRFiltrZrusit(); __T.filtr('material', 'oceloplech'); }); f.ocel = await p.evaluate(() => __T.nalezeno());
  await p.evaluate(() => TD_AKCE.tdRFiltrZrusit());
  f.typyTl = await p.evaluate(() => Array.from(document.querySelectorAll('#rz-filtry-hlavni .rz-skup')).filter(b => b.offsetHeight > 0).map(b => b.textContent).join('·'));
  await p.click('#rz-filtry-hlavni .rz-skup[data-k="prumyslova"]');
  f.prum = await p.evaluate(() => ({ n: __T.nalezeno(), akt: document.querySelector('#rz-filtry-hlavni .rz-skup.akt').textContent, meta: document.querySelector('#rz-seznam .rz-polozka small').textContent }));
  await p.click('#rz-filtry-hlavni .rz-skup[data-k="historicka"]');
  f.hist = await p.evaluate(() => document.getElementById('rz-seznam').innerText);
  await p.click('#rz-filtry-hlavni .rz-skup[data-k="domovni"]'); f.dom = await p.evaluate(() => __T.nalezeno());
  await p.evaluate(() => TD_AKCE.tdRFiltrZrusit());
  f.velBtn = await p.evaluate(() => { const b = document.getElementById('rz-velikost-btn'); return b && b.offsetHeight > 0 ? b.textContent : ''; });
  await p.evaluate(() => TD_AKCE.tdRTab(document.querySelector('.rz-tab[data-tab="pristroje"]')));
  f.vse = await p.evaluate(() => document.getElementById('rz-kn-pocet').textContent);
  f.viditelne = await p.evaluate(() => ({
    skupiny: Array.from(document.querySelectorAll('#rz-filtry-hlavni .rz-skup')).filter(b => b.offsetHeight > 0).map(b => b.textContent).join('·'),
    sel: ['vyrobce', 'poly', 'In', 'char'].map(k => { const e = document.querySelector('#rz-filtry-hlavni .rz-f[data-f="' + k + '"]'); return e && e.offsetHeight > 0 ? k : '-'; }).join(),
    sbalene: !document.getElementById('rz-filtry').open && ['idn', 'rcdTyp', 'overene', 'oblibene'].every(k => !!document.querySelector('#rz-filtry-obsah .rz-f[data-f="' + k + '"]')),
    souhrn: document.querySelector('#rz-filtry > summary').textContent }));
  await p.click('#rz-filtry-hlavni .rz-skup[data-k="FA"]'); f.fa = await p.evaluate(() => document.getElementById('rz-kn-pocet').textContent);
  f.faAkt = await p.evaluate(() => document.querySelector('#rz-filtry-hlavni .rz-skup.akt').textContent);
  await p.evaluate(() => __T.filtr('poly', '1')); await p.evaluate(() => __T.filtr('char', 'B')); await p.evaluate(() => __T.filtr('In', '16'));
  f.b16 = await p.evaluate(() => Array.from(document.querySelectorAll('#rz-seznam .rz-polozka b')).map(x => x.textContent).join());
  f.pocetB16 = await p.evaluate(() => document.getElementById('rz-kn-pocet').innerText);
  await p.click('#rz-kn-pocet [data-action="tdRFiltrZrusit"]');
  f.poZruseni = await p.evaluate(() => ({ pocet: document.getElementById('rz-kn-pocet').textContent, akt: document.querySelector('#rz-filtry-hlavni .rz-skup.akt').textContent }));
  await p.click('#rz-filtry-hlavni .rz-skup[data-k="FI"]'); await p.evaluate(() => { document.getElementById('rz-filtry').open = true; __T.filtr('idn', '300'); });
  f.fi300 = await p.evaluate(() => __T.nalezeno());
  f.pocetFiltru = await p.evaluate(() => document.getElementById('rz-filtry-pocet').textContent);
  await p.evaluate(() => { TD_AKCE.tdRFiltrZrusit(); document.getElementById('rz-filtry').open = false; });
  await p.click('#rz-filtry-hlavni .rz-skup[data-k="jine"]'); f.jine = await p.evaluate(() => Array.from(new Set(Array.from(document.querySelectorAll('#rz-seznam .rz-ikona')).map(x => x.textContent))).sort().join());
  await p.evaluate(() => TD_AKCE.tdRFiltrZrusit());
  await p.evaluate(() => __T.filtr('q', 'rcbo c16')); f.q = await p.evaluate(() => Array.from(document.querySelectorAll('#rz-seznam .rz-polozka b')).map(x => x.textContent).join());
  await p.evaluate(() => __T.filtr('q', 'svodič')); f.qNic = await p.evaluate(() => document.getElementById('rz-seznam').innerText);
  await p.evaluate(() => { TD_AKCE.tdRFiltrZrusit(); __T.filtr('overene', true); }); f.over = await p.evaluate(() => __T.nalezeno());
  await p.evaluate(() => TD_AKCE.tdRFiltrZrusit());
  check('skříně: výrobce, počet řad, modulů v řadě, provedení a materiál jsou vidět vždy', f.skrineViditelne === 'vyrobce,rady,modulu,provedeni,material', f.skrineViditelne);
  check('filtr skříní: 3 řady × 12 modulů, provedení, materiál', f.skrineVse === 22 && f.sk36 === 2 && f.sk36z === 1 && f.ocel === 8, JSON.stringify([f.skrineVse, f.sk36, f.sk36z, f.ocel]));
  check('karta Skříně: typ jako řada tlačítek Vše · Domovní · Průmyslové · Historické', f.typyTl === 'Vše·Domovní·Průmyslové·Historické', f.typyTl);
  check('filtr typu: průmyslové 6 (u položky „průmyslová"), historické zatím nic, domovní 16', f.prum.n === 6 && f.prum.akt === 'Průmyslové' && /průmyslová/.test(f.prum.meta) &&
    /Nic neodpovídá/.test(f.hist) && f.dom === 16, JSON.stringify(f.prum) + ' / ' + f.dom);
  check('karta Skříně: tlačítko „📐 Vlastní velikost skříně"', /📐 Vlastní velikost skříně/.test(f.velBtn), f.velBtn);
  check('přístroje: kategorie jako řada tlačítek a výrobce, póly, In, charakteristika vždy vidět', f.viditelne.skupiny === 'Vše·Jističe·Chrániče·RCBO·AFDD·SPD·Hl. vypínače·Pojistky·Ostatní' &&
    f.viditelne.sel === 'vyrobce,poly,In,char', JSON.stringify(f.viditelne));
  check('sbalené „Další filtry" jen IΔn, typ chrániče, jen ověřené, jen oblíbené', f.viditelne.sbalene && /^Další filtry/.test(f.viditelne.souhrn), f.viditelne.souhrn);
  check('kategorie Jističe (tlačítko se zvýrazní), počítadlo „Zobrazeno 50 z 80"', /^Zobrazeno 50 z 80 \(v knihovně \d+\)/.test(f.fa) && f.faAkt === 'Jističe', f.fa + ' · ' + f.vse);
  check('filtr: póly + charakteristika + In → právě Jistič 1P B16; „Zrušit filtry" vše vrátí', f.b16 === 'Jistič 1P B16' && /Zrušit filtry/.test(f.pocetB16) &&
    /^Zobrazeno 50 z \d+$/.test(f.poZruseni.pocet) && f.poZruseni.akt === 'Vše', f.b16 + ' · ' + f.pocetB16 + ' · ' + JSON.stringify(f.poZruseni));
  check('filtr IΔn 300 mA u chráničů (v Dalších filtrech, souhrn řekne kolik zapnuto)', f.fi300 === 2 && /1 zapnuto/.test(f.pocetFiltru), f.fi300 + ' ' + f.pocetFiltru);
  check('„Ostatní" = stykače, relé, hodiny, elektroměry, signálky, ovladače, svorky, rezervy', f.jine === 'HL,KA,KM,KT,PJ,REZ,SF,X', f.jine);
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

  // ── 3a. informační pruh v knihovně ────────────────────────────────────
  const INFO = 'Knihovna obsahuje jen obecné přístroje. Skříně a přístroje konkrétních výrobců (OEZ, ABB, Eaton, Hager…) vám pošle Martin – stačí mu napsat. Z licenčních důvodů nejsou součástí programu. Soubor pak stačí přetáhnout sem.';
  const info = await p.evaluate(() => {
    const ed = document.querySelector('.rz-knihovna .rz-info-knihovna');
    const r = { text: ed ? ed.querySelector('.rz-info-text').innerText.replace(/\s+/g, ' ').replace(/ 📂 Vybrat soubor…$/, '').trim() : '',
                vybrat: !!(ed && ed.querySelector('[data-action="tdRImportVybratEd"]')), nahore: !!ed && ed === document.querySelector('.rz-knihovna').firstElementChild,
                tlacitka: ed ? ed.querySelectorAll('button:not([data-action="tdRImportVybratEd"]):not([data-action="tdRInfoPrepni"])').length : -1, vidno: !!ed && ed.offsetHeight > 30,
                prepni: ed ? ed.querySelector('[data-action="tdRInfoPrepni"]').textContent : '' };
    return r;
  });
  check('knihovna v editoru: nahoře informační pruh s textem o přístrojích výrobců od Martina, bez zavírání (jen ▴ sbalit)', info.text === INFO && info.nahore && info.tlacitka === 0 &&
    info.vidno && info.vybrat && info.prepni === '▴', info.text);
  await p.click('.rz-knihovna .rz-info-prepni');
  const sbal = await p.evaluate(async () => {
    const e = document.querySelector('.rz-knihovna .rz-info-knihovna'), r = { text: e.innerText.replace(/\s+/g, ' ').trim(), h: e.offsetHeight,
      ls: localStorage.getItem('revize_el_rz_info'), vybrat: !!e.querySelector('[data-action="tdRImportVybratEd"]'), nahore: e === document.querySelector('.rz-knihovna').firstElementChild };
    const dt = new DataTransfer(); dt.items.add(new File(['kategorie;typ;sirka_moduly\nKA;VV-KA-9;1\n'], 'rele.csv', { type: 'text/csv' }));
    e.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    e.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    await __T.w(300);
    r.drop = document.getElementById('modal-rz-import').classList.contains('open');
    TD_AKCE.tdRImportZavrit();
    return r;
  });
  check('▴ sbalí pruh na jeden řádek „ℹ Data výrobců – přetáhněte soubor sem ▾" (zapamatuje se), sbalený je pořád plocha pro přetažení', /^ℹ Data výrobců – přetáhněte soubor sem 📂 ▾$/.test(sbal.text) &&
    sbal.h < 50 && sbal.ls === 'sbaleno' && sbal.vybrat && sbal.nahore && sbal.drop, JSON.stringify(sbal));
  await p.click('.rz-knihovna .rz-info-prepni');
  const rozb = await p.evaluate(() => ({ text: document.querySelector('.rz-knihovna .rz-info-text').innerText.replace(/\s+/g, ' ').replace(/ 📂 Vybrat soubor…$/, '').trim(),
    ls: localStorage.getItem('revize_el_rz_info') }));
  check('▾ pruh zase rozbalí', rozb.text === INFO && rozb.ls === 'rozbaleno', JSON.stringify(rozb));
  await p.evaluate(() => localStorage.removeItem('revize_el_rz_info'));
  const infoDrop = await p.evaluate(async () => {
    const z = document.querySelector('.rz-knihovna .rz-info-knihovna');
    const dt = new DataTransfer(); dt.items.add(new File(['kategorie;typ;sirka_moduly\nKA;VV-KA-1;1\n'], 'rele.csv', { type: 'text/csv' }));
    z.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    const nad = z.classList.contains('nad');
    z.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    await __T.w(300);
    const r = { nad, open: document.getElementById('modal-rz-import').classList.contains('open'), text: document.getElementById('rz-import-obsah').innerText };
    TD_AKCE.tdRImportZavrit();
    return r;
  });
  check('soubor přetažený na pruh v editoru otevře náhled importu („přetáhnout sem" platí)', infoDrop.nad && infoDrop.open && /Načte se 1/.test(infoDrop.text), infoDrop.text.slice(0, 60));

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
  const ts = await p.evaluate(async () => {
    const r = {};
    const s = (k) => __rzImport ? __rzImport.v.polozky.map(x => [x.polozka.typ, x.polozka.typSkrine, x.polozka.provedeni, x.polozka.rady + 'x' + x.polozka.modulu].join('|')).join(' / ') : '';
    await rozvImportSoubor(new File(['druh;vyrobce;typ;rady;moduly_v_rade;provedeni;material;typ_skrine\n' +
      'skrin;Vymyšlený;S-PR;6;24;stojanová;oceloplech;průmyslová\n' +
      'skrin;Vymyšlený;S-HI;4;20;nástěnná;oceloplech;Historická\n' +
      'skrin;Vymyšlený;S-DO;2;12;;plast;\n' +
      'skrin;Vymyšlený;S-XX;2;12;;plast;garážová\n'], 'skrine.csv'));
    r.s = s(); r.text = document.getElementById('rz-import-obsah').innerText; TD_AKCE.tdRImportZavrit();
    await rozvImportSoubor(new File(['druh;vyrobce;typ;rady;moduly_v_rade\nskrin;Vymyšlený;S-BEZ;3;12\n'], 'bez.csv'));
    r.bez = s(); TD_AKCE.tdRImportZavrit();
    await rozvImportSoubor(new File([JSON.stringify({ _format: 'revize-el-knihovna-rozvadecu', _version: 1, pristroje: [], skrine: [{ druh: 'skrin', vyrobce: 'Vymyšlený', typ: 'S-STARY', rady: 3, modulu: 12 }] })], 'stary.json'));
    r.json = s(); TD_AKCE.tdRImportZavrit();
    r.vKnihovne = DOK.rozvKnihovna.filter(x => x.druh === 'skrin').map(x => rozvPolozkaNorm(x).typSkrine).join();
    return r;
  });
  check('CSV se sloupcem typ_skrine: průmyslová / Historická (s háčky, velkým) / prázdné = domovní, provedení „stojanová"',
    ts.s === 'S-PR|prumyslova|stojanová|6x24 / S-HI|historicka|nástěnná|4x20 / S-DO|domovni||2x12' && /typ skříně „garážová"/.test(ts.text), ts.s + ' · ' + ts.text.replace(/\n/g, ' | ').slice(0, 300));
  check('CSV bez sloupce typ_skrine i starší JSON = domovní; uložené skříně bez typu se čtou jako domovní', ts.bez === 'S-BEZ|domovni||3x12' && ts.json === 'S-STARY|domovni||3x12' &&
    /^(domovni,?)+$/.test(ts.vKnihovne), ts.bez + ' · ' + ts.json + ' · ' + ts.vKnihovne);
  check('šablona CSV má sloupec typ_skrine', /;material;typ_skrine;rady;/.test(imp.sablona.text), imp.sablona.text.trim());

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
  const infoSpr = await p.evaluate(() => { const e = document.querySelector('#rz-sprava .rz-info-knihovna');
    return e && e === document.getElementById('rz-sprava').firstElementChild ? e.innerText.replace(/\s+/g, ' ').trim() : ''; });
  check('s daty výrobců v knihovně se pruh sám sbalí: „V knihovně máte data výrobců (4 položky). Nová data přetáhněte sem."',
    infoSpr === 'ℹ V knihovně máte data výrobců (4 položky). Nová data přetáhněte sem. ▾', infoSpr);
  await p.click('#rz-sprava .rz-info-prepni');
  const infoSpr2 = await p.evaluate(() => { const e = document.querySelector('#rz-sprava .rz-info-knihovna');
    return e && e === document.getElementById('rz-sprava').firstElementChild ? e.querySelector('.rz-info-text').innerText.replace(/\s+/g, ' ').trim() : ''; });
  check('správa knihovny na seznamu: tentýž pruh úplně nahoře (po ▾ celý text)', infoSpr2 === INFO, infoSpr2);
  await p.evaluate(() => { localStorage.removeItem('revize_el_rz_info'); rozvInfoPrekreslit(); });
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
  // ── 3d. velká knihovna: ~600 vymyšlených položek dvou vymyšlených výrobců ──
  // (žádná skutečná data výrobců — „Výrobce A" a „Výrobce B" jsou smyšlení)
  const vk = await p.evaluate(async () => {
    const r = {}, rad = ['druh;kategorie;vyrobce;rada;typ;poly;in;charakteristika;icn;idn;typ_chranice;trida_spd;sirka_moduly;rady;moduly_v_rade;provedeni;material;overeno'];
    const IN = [2, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63];
    let n = 0;
    const pr = (v, kat, poly, In, ch, idn, rcd, spd, sir) => { n++; rad.push(['pristroj', kat, v, 'Řada ' + v.slice(-1), v.slice(-1) + '-' + kat + '-' + n, poly, In, ch, ch ? 6 : '', idn, rcd, spd, sir, '', '', '', '', n % 3 ? 'ano' : 'ne'].join(';')); };
    for (const v of ['Výrobce A', 'Výrobce B']) {
      for (const poly of ['1', '1+N', '3', '3+N']) for (const ch of ['B', 'C', 'D']) for (const In of IN) for (const k of [0, 1]) pr(v, 'FA', poly, In, ch, '', '', '', poly === '1' ? 1 : poly === '3' ? 3 : poly === '1+N' ? 2 : 4);
      for (const In of [25, 40, 63]) for (const idn of [30, 100, 300]) for (const rcd of ['AC', 'A', 'F', 'B']) pr(v, 'FI', '4', In, '', idn, rcd, '', 4);
      for (const t of ['T1+T2', 'T2', 'T3']) pr(v, 'SPD', '3+N', '', '', '', '', t, 4);
    }
    for (const rr of [1, 2, 3, 4]) for (const m of [12, 18, 24]) { n++; rad.push(['skrin', '', 'Výrobce B', 'Skříně B', 'B-SK-' + rr + 'x' + m, '', '', '', '', '', '', '', '', rr, m, m === 24 ? 'nástěnná' : 'zapuštěná', m === 24 ? 'oceloplech' : 'plast', 'ano'].join(';')); }
    r.radku = rad.length - 1;
    let t0 = performance.now();
    await rozvImportSoubor(new File([rad.join('\r\n')], 'vymysleni-vyrobci.csv', { type: 'text/csv' }));
    r.nahled = document.getElementById('rz-import-ulozit').textContent;
    await TD_AKCE.tdRImportUlozit(); await __T.w(200);
    r.importMs = Math.round(performance.now() - t0);
    r.vKnihovne = DOK.rozvKnihovna.length;
    const sp = () => ({ pocet: document.querySelector('#rz-sprava .rz-kn-pocet').innerText, radky: document.querySelectorAll('#rz-sprava .rz-sprava-seznam [data-kid]').length,
      vice: (document.querySelector('#rz-sprava [data-action="tdRSpravaVice"]') || {}).textContent || '', smaz: (document.querySelector('#rz-sprava [data-action="tdRPolSmazatNalezene"]') || {}).textContent || '' });
    r.sprava = sp();
    const sf = (k, v) => { const e = document.querySelector('#rz-sprava .rz-sf[data-sf="' + k + '"]'); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); };
    r.vyrobciSpravy = Array.from(document.querySelectorAll('#rz-sprava .rz-sf[data-sf="vyrobce"] option')).map(o => o.textContent).join('|');
    sf('vyrobce', 'Výrobce A'); r.spravaA = sp();
    TD_AKCE.tdRSpravaVice(); r.spravaA2 = sp();
    sf('skup', 'SPD'); r.spravaASpd = sp();
    sf('skup', ''); sf('vyrobce', 'Výrobce B'); sf('skup', 'skrin'); r.spravaBSk = sp();
    sf('skup', '');
    const predSm = DOK.rozvKnihovna.length;
    await TD_AKCE.tdRPolSmazatNalezene(); await __T.w(100);
    r.smazanoB = predSm + '→' + DOK.rozvKnihovna.length + '|' + DOK.rozvKnihovna.filter(x => x.vyrobce === 'Výrobce B').length + '|' + DOK.rozvKnihovna.filter(x => x.vyrobce === 'Výrobce A').length;
    zpetPosledni(); await __T.w(400); await dokNacist();
    r.zpetB = DOK.rozvKnihovna.length + '|' + DOK.rozvKnihovna.filter(x => x.vyrobce === 'Výrobce B').length;
    sf('vyrobce', '');
    // editor: filtry, počítadlo, „Zobrazit další", rychlost
    await dokOtevrit(DOK.dokumenty.find(d => d.typ === 'rozv').uid); await __T.w(200);
    TD_AKCE.tdRTab(document.querySelector('.rz-tab[data-tab="pristroje"]'));
    const dokPred = JSON.stringify(DOK.dokumenty), genPred = __dokGen;
    t0 = performance.now(); rozvKnihovnaVykreslit(); r.vykresleniMs = Math.round(performance.now() - t0);
    r.ed = { pocet: document.getElementById('rz-kn-pocet').innerText, radky: __T.nalezeno(),
      vyrobci: Array.from(document.querySelectorAll('#rz-filtry-hlavni .rz-f[data-f="vyrobce"] option')).map(o => o.textContent).join('|') };
    t0 = performance.now(); __T.filtr('vyrobce', 'Výrobce B'); r.filtrMs = Math.round(performance.now() - t0);
    document.querySelector('#rz-filtry-hlavni .rz-skup[data-k="FA"]').click();
    r.edB = { pocet: document.getElementById('rz-kn-pocet').innerText, vyrobce: document.querySelector('#rz-filtry-hlavni .rz-f[data-f="vyrobce"]').value,
      vice: (document.querySelector('#rz-seznam [data-action="tdRVice"]') || {}).textContent };
    document.querySelector('#rz-seznam [data-action="tdRVice"]').click();
    r.edB2 = __T.nalezeno();
    __T.filtr('poly', '3+N'); __T.filtr('char', 'D'); __T.filtr('In', '63');
    r.edB3 = Array.from(document.querySelectorAll('#rz-seznam .rz-polozka small')).map(x => x.textContent.split(' · ')[1]).join(',') + '|' + document.getElementById('rz-kn-pocet').innerText;
    TD_AKCE.tdRFiltrZrusit(); __T.filtr('vyrobce', 'Výrobce A'); document.querySelector('#rz-filtry-hlavni .rz-skup[data-k="FI"]').click();
    __T.filtr('rcdTyp', 'F'); __T.filtr('idn', '30');
    r.edA = document.getElementById('rz-kn-pocet').innerText;
    TD_AKCE.tdRTab(document.querySelector('.rz-tab[data-tab="skrine"]'));
    r.skrVyr = Array.from(document.querySelectorAll('#rz-filtry-hlavni .rz-f[data-f="vyrobce"] option')).map(o => o.textContent).join('|');
    __T.filtr('vyrobce', 'Výrobce B'); __T.filtr('rady', '2');
    r.skrB2 = __T.nalezeno();
    TD_AKCE.tdRFiltrZrusit(); TD_AKCE.tdRTab(document.querySelector('.rz-tab[data-tab="pristroje"]')); TD_AKCE.tdRFiltrZrusit();
    await __T.w(1200);
    r.neulozeno = JSON.stringify(DOK.dokumenty) === dokPred && __dokGen === genPred;
    // úklid: oba vymyšlení výrobci pryč (zpátky na seznam)
    await dokUlozitOtevreny(); dokOtevritSeznam('rozv'); document.getElementById('dok-knihovna-karta').open = true;
    for (const v of ['Výrobce A', 'Výrobce B']) { sf('vyrobce', v); await TD_AKCE.tdRPolSmazatNalezene(); await __T.w(100); }
    sf('vyrobce', '');
    r.poUklidu = DOK.rozvKnihovna.length;
    return r;
  });
  check('velká knihovna: import ' + vk.radku + ' vymyšlených položek dvou vymyšlených výrobců', vk.radku >= 590 && vk.vKnihovne === vk.radku + 6 && vk.importMs < 8000,
    JSON.stringify({ radku: vk.radku, nahled: vk.nahled, v: vk.vKnihovne, ms: vk.importMs }));
  check('správa knihovny: počítadlo „Zobrazeno 50 z …", vykreslí jen 50 řádků, „Zobrazit další"', /^Zobrazeno 50 z \d+/.test(vk.sprava.pocet) && vk.sprava.radky === 50 &&
    /Zobrazit dalších 50/.test(vk.sprava.vice) && !vk.sprava.smaz, JSON.stringify(vk.sprava));
  check('správa: výrobce z dat (i importovaní), filtr výrobce, další stránka', vk.vyrobciSpravy === 'všichni|Vymyšlený výrobce|Výrobce A|Výrobce B' &&
    /^Zobrazeno 50 z 3\d\d \(v knihovně/.test(vk.spravaA.pocet) && vk.spravaA2.radky === 100 && /Smazat všech 3\d\d nalezených/.test(vk.spravaA.smaz),
    vk.vyrobciSpravy + ' · ' + JSON.stringify([vk.spravaA, vk.spravaA2.radky]));
  check('správa: výrobce + kategorie (SPD, Skříně)', /^Nalezeno 3 \(v knihovně/.test(vk.spravaASpd.pocet) && vk.spravaASpd.radky === 3 && /^Nalezeno 12/.test(vk.spravaBSk.pocet),
    JSON.stringify([vk.spravaASpd, vk.spravaBSk]));
  check('správa: smazat import jednoho výrobce (ptá se) a ZPĚT ho vrátí', /^\d+→\d+\|0\|3\d\d$/.test(vk.smazanoB) && vk.zpetB.split('|')[1] > 280, vk.smazanoB + ' · ' + vk.zpetB);
  check('editor: výrobce v nabídce podle dat, „obecný" = vestavěné', vk.ed.vyrobci === 'všichni|obecný|Vymyšlený výrobce|Výrobce A|Výrobce B' && vk.ed.radky === 50 &&
    /^Zobrazeno 50 z \d{3}$/.test(vk.ed.pocet), JSON.stringify(vk.ed));
  check('editor: výrobce + Jističe, „Zobrazit další" přidá dalších 50', /^Zobrazeno 50 z 288 \(v knihovně \d+\)/.test(vk.edB.pocet) && vk.edB.vyrobce === 'Výrobce B' &&
    /Zobrazit dalších 50 \(zbývá 238\)/.test(vk.edB.vice) && vk.edB2 === 100, JSON.stringify([vk.edB, vk.edB2]));
  check('editor: póly + charakteristika + In zúží na 2 položky výrobce B', /^Výrobce B,Výrobce B\|Nalezeno 2 /.test(vk.edB3), vk.edB3);
  check('editor: typ chrániče a IΔn v Dalších filtrech', /^Nalezeno 3 /.test(vk.edA), vk.edA);
  check('editor: skříně — výrobce z dat, počet řad', vk.skrVyr === 'všichni|obecný|Vymyšlený výrobce|Výrobce B' && vk.skrB2 === 3, vk.skrVyr + ' · ' + vk.skrB2);
  check('600 položek nezpomalí: vykreslení seznamu i filtr pod 300 ms', vk.vykresleniMs < 300 && vk.filtrMs < 300, vk.vykresleniMs + ' ms / ' + vk.filtrMs + ' ms');
  check('filtry knihovny (i s velkou knihovnou) rozvaděč neuloží ani neoznačí jako změněný', vk.neulozeno);
  check('úklid: smazání importu obou výrobců z knihovny', vk.poUklidu === 6, String(vk.poUklidu));
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

  // ── 5a. kontextové menu přístroje (pravý klik) a schránka ─────────────
  {
  await p.evaluate(async () => {
    __T.rada = r => __rz.rady[r].prvky.map(x => x.ozn || x.p.kat).join(',');
    __T.bod = (r, m) => { const svg = document.querySelector('#rz-pohled .rz-svg'), M = svg.getScreenCTM();
      const q = new DOMPoint(RZG.okraj + m * RZG.M, rozvRadaY(r) + RZG.H / 2).matrixTransform(M); return { x: Math.round(q.x), y: Math.round(q.y) }; };
    window.__rh1 = window.__dokOtevreny.uid;
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
    __T.filtr('q', '');
    ['v-fi-4-40-30-A', 'v-fa-1-B10', 'v-fa-1-B16'].forEach(k => rozvVlozit(k, 0, __rz.rady[0].prvky.length));
    rozvVlozit('v-fa-1-C16', 1, 0);
    __rz.vyber = null; rozvPohledVykreslit(); rozvVlastnostiVykreslit();
    document.getElementById('rz-pohled').scrollIntoView({ block: 'start' });
  });
  await w(200);
  const pk = async (r, m) => { const q = await p.evaluate(([r, m]) => __T.bod(r, m), [r, m]); await p.mouse.click(q.x, q.y, { button: 'right' }); await w(150); };
  const menu = () => p.evaluate(() => { const m = document.querySelector('.kt-menu');
    return m ? Array.from(m.querySelectorAll('.kt-pol')).map(b => (b.disabled ? '(' : '') + b.childNodes[0].textContent.trim() + (b.disabled ? ')' : '')) : null; });
  const klikMenu = async text => { await p.evaluate(t => { const b = Array.from(document.querySelectorAll('.kt-menu .kt-pol')).find(x => x.childNodes[0].textContent.trim() === t); b.click(); }, text); await w(150); };
  await pk(0, 4.5);
  const m1 = await menu();
  const vyb1 = await p.evaluate(() => (rozvNajit(__rz.vyber) || { x: {} }).x.ozn);
  check('pravý klik na přístroj: menu programu se stejnými akcemi jako panel + schránka a rezerva, přístroj se vybere',
    vyb1 === '-FA1' && m1 && m1.join('|') === 'Vlastnosti|Duplikovat|Kopírovat|(Vložit za něj)|Vložit rezervu vedle|Přesunout do řady 2|Přesunout do řady 3|🔢 Přečíslovat označení|Smazat', vyb1 + ' · ' + (m1 || []).join('|'));
  const kl = await p.evaluate(() => Array.from(document.querySelectorAll('.kt-menu .kt-kl')).map(x => x.textContent).join(','));
  check('menu ukazuje klávesy (Ctrl+D, Ctrl+C, Ctrl+V, Delete) a má vzhled menu tabulky měření', kl === 'Ctrl+D,Ctrl+C,Ctrl+V,Delete' &&
    await p.evaluate(() => document.querySelector('.kt-menu').className === 'kt-menu' && !!document.querySelector('.kt-menu .kt-pata')), kl);
  await klikMenu('Vlastnosti');
  const vlk = await p.evaluate(() => ({ fokus: document.activeElement && document.activeElement.getAttribute('data-rp2'), menu: !!document.querySelector('.kt-menu') }));
  check('„Vlastnosti" zavře menu a skočí do pole Název vývodu', vlk.fokus === 'vyvod' && !vlk.menu, JSON.stringify(vlk));
  await p.evaluate(() => document.activeElement.blur());
  const rada = r => p.evaluate(r => __T.rada(r), r);
  await pk(0, 4.5); await klikMenu('Duplikovat');
  const d1 = await rada(0);
  await pk(0, 4.5); await klikMenu('Kopírovat');
  await pk(1, 0.5); const m2 = await menu(); await klikMenu('Vložit za něj');
  const d2 = await rada(1);
  await pk(1, 0.5); await klikMenu('Vložit rezervu vedle');
  const d3 = await rada(1);
  await pk(0, 6.5); await klikMenu('Přesunout do řady 3');
  const d4 = [await rada(0), await rada(2)].join(' / ');
  await pk(1, 0.5); await klikMenu('Smazat');
  const d5 = await rada(1);
  await p.keyboard.press('Control+z'); await w(150);
  const d6 = await rada(1);
  check('Duplikovat z menu: kopie hned vedle s dalším označením', d1 === '-FI1,-FA1,-FA4,-FA2', d1);
  check('Kopírovat → v menu jiného přístroje „Vložit za něj" (Ctrl+V) vloží kopii za něj', m2 && m2.includes('Vložit za něj') && d2 === '-FA3,-FA5', (m2 || []).join('|') + ' · ' + d2);
  check('„Vložit rezervu vedle" dá rezervu 1 M hned za přístroj', d3 === '-FA3,REZ,-FA5', d3);
  check('„Přesunout do řady 3" dá přístroj na konec řady 3', d4 === '-FI1,-FA1,-FA4 / -FA2', d4);
  check('„Smazat" z menu a Ctrl+Z ho vrátí', d5 === 'REZ,-FA5' && d6 === '-FA3,REZ,-FA5', d5 + ' → ' + d6);
  // klávesy: Ctrl+C / Ctrl+V nad vybraným přístrojem (kurzor mimo pole)
  await p.evaluate(() => { document.activeElement && document.activeElement.blur(); __rz.vyber = __rz.rady[0].prvky[0].uid; rozvPohledVykreslit(); rozvVlastnostiVykreslit(); });
  await p.keyboard.press('Control+c'); await w(80);
  await p.evaluate(() => { __rz.vyber = __rz.rady[2].prvky[0].uid; rozvPohledVykreslit(); });
  await p.keyboard.press('Control+v'); await w(120);
  const k1 = await rada(2);
  await p.evaluate(() => { __rz.vyber = null; __rz.aktRada = 1; rozvPohledVykreslit(); });
  await p.keyboard.press('Control+v'); await w(120);
  const k2 = await rada(1);
  check('Ctrl+C / Ctrl+V: kopie chrániče za vybraný přístroj; bez výběru na konec vybrané řady', k1 === '-FA2,-FI2' && k2 === '-FA3,REZ,-FA5,-FI3', k1 + ' | ' + k2);
  await p.click('#rz-vlastnosti, .dok-lista-titul').catch(() => {});
  // Ctrl+V v textovém poli zůstává prohlížeči
  await p.evaluate(() => { __rz.vyber = __rz.rady[0].prvky[1].uid; rozvVlastnostiVykreslit(); document.querySelector('#rz-vlastnosti [data-rp2="vyvod"]').focus(); });
  await p.keyboard.press('Control+v'); await w(120);
  check('Ctrl+V při psaní do pole nevkládá přístroj', (await rada(0)) === '-FI1,-FA1,-FA4');
  // Přečíslovat: tlačítko natrvalo v liště nad pohledem (i s vybraným přístrojem) a v menu
  const pl = await p.evaluate(() => { __rz.vyber = __rz.rady[0].prvky[1].uid; rozvPohledVykreslit(); rozvVlastnostiVykreslit();
    const b = document.querySelector('#rz-pohled .rz-lista [data-action="tdRPrecislovat"]'), z = document.querySelector('#rz-pohled .rz-lista .rz-zoom');
    return { vidi: !!b && b.offsetHeight > 0, uZoomu: !!b && z.contains(b), text: b && b.textContent, vlast: !!document.querySelector('#rz-vlastnosti [data-action="tdRPrecislovat"]') }; });
  check('🔢 Přečíslovat označení je natrvalo v liště vedle − / ＋, i s vybraným přístrojem', pl.vidi && pl.uZoomu && pl.text === '🔢 Přečíslovat označení', JSON.stringify(pl));
  const pr0 = await p.evaluate(() => [0, 1, 2].map(__T.rada).join(' / '));
  await p.click('#rz-pohled .rz-lista [data-action="tdRPrecislovat"]'); await w(120);
  const pr1 = await p.evaluate(() => [0, 1, 2].map(__T.rada).join(' / '));
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('Control+z'); await w(120);
  const pr2 = await p.evaluate(() => [0, 1, 2].map(__T.rada).join(' / '));
  await pk(0, 4.5); await klikMenu('🔢 Přečíslovat označení');
  const pr3 = await p.evaluate(() => [0, 1, 2].map(__T.rada).join(' / '));
  await p.keyboard.press('Control+z'); await w(120);
  check('Přečíslovat z lišty i z menu přečísluje, Ctrl+Z vrátí', pr1 !== pr0 && /^-FI1,-FA1,-FA2 \/ -FA3,REZ,-FA4,-FI2 \/ -FA5,-FI3$/.test(pr1) && pr2 === pr0 && pr3 === pr1,
    pr0 + ' → ' + pr1 + ' → ' + pr2 + ' | menu ' + pr3);
  // Shift + pravý klik = nabídka prohlížeče, pravý klik mimo přístroj nic
  await p.evaluate(() => document.activeElement.blur());
  const sh = await p.evaluate(() => { const q = __T.bod(0, 4.5), el = document.elementFromPoint(q.x, q.y);
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: q.x, clientY: q.y, shiftKey: true });
    el.dispatchEvent(ev); return { zrus: ev.defaultPrevented, menu: !!document.querySelector('.kt-menu') }; });
  check('Shift + pravý klik nechá nabídku prohlížeče', !sh.zrus && !sh.menu, JSON.stringify(sh));
  // znovu otevřít RH1 pro PDF
  await p.evaluate(async () => { await dokUlozitOtevreny(); await dokOtevrit(window.__rh1); });
  await w(300);
  await p.evaluate(() => {
    __T.bod = (r, m) => { const svg = document.querySelector('#rz-pohled .rz-svg'), M = svg.getScreenCTM();
      const q = new DOMPoint(RZG.okraj + m * RZG.M, rozvRadaY(r) + RZG.H / 2).matrixTransform(M); return { x: Math.round(q.x), y: Math.round(q.y) }; };
  });

  }
  // ── 5b. PDF ───────────────────────────────────────────────────────────
  await p.evaluate(async () => {
    const f = dokForm(), dk = (s, v) => { const e = f.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
    dk('[data-dk="icc"]', '6'); dk('[data-dk="investor.adresa"]', 'Vymyšlená 12, 697 01 Kyjov');
    // víc přístrojů, ať se seznam rozdělí do dvou tabulek
    __rz.aktRada = 2; for (let i = 0; i < 4; i++) rozvVlozit('v-fa-1-B6', 2, __rz.rady[2].prvky.length);
    await dokUlozitOtevreny();
    // etapa 1 = jen čelní pohled a seznam (dokumenty etapy 2 hlídá test-rozvadec-dokumenty.js)
    window.__dokOtevreny.data.dokVyber = { cp: true, tech: false, prohl: false, ko: false };
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

  // ── 5c. výběr víc přístrojů, viditelné tažení, posun široké skříně (v1.21) ──
  // Skříň 6×24 (širší než obrazovka), všechno skutečnou myší (page.mouse).
  {
  await p.evaluate(async () => {
    __T.bod = (r, m, dy) => { const svg = document.querySelector('#rz-pohled .rz-svg'), M = svg.getScreenCTM();
      const q = new DOMPoint(RZG.okraj + m * RZG.M, rozvRadaY(r) + (dy == null ? RZG.H / 2 : dy)).matrixTransform(M); return { x: Math.round(q.x), y: Math.round(q.y) }; };
    __T.rada = r => __rz.rady[r].prvky.map(x => x.ozn).join(',');
    __T.sel = () => rozvVybrane().map(u => rozvNajit(u).x.ozn).join(',');
    __T.ram = () => { const r = document.getElementById('rz-svg-ram'); return { l: Math.round(r.scrollLeft), t: Math.round(r.scrollTop), sw: r.scrollWidth, cw: r.clientWidth, sh: r.scrollHeight, ch: r.clientHeight }; };
    __T.naplnit = () => {
      const pis = ['A', 'B', 'C', 'D', 'E', 'F'], poc = [22, 20, 10, 6, 6, 6];
      __rz.rady.forEach((r, ri) => { r.prvky = []; for (let i = 0; i < poc[ri]; i++) { const x = rozvNovyPrvek(rozvKnihPolozka('v-fa-1-B16')); x.ozn = pis[ri] + i; r.prvky.push(x); } });
      rozvVyberNastavit([]); __rz.kotva = null; rozvPohledVykreslit(); rozvVlastnostiVykreslit();
    };
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-6x24-ocel'));
    __T.naplnit();
    document.querySelectorAll('.toast').forEach(t => t.remove());
    __T.ukaz = () => { document.getElementById('rz-svg-ram').scrollIntoView({ block: 'start' }); window.scrollBy(0, -140); };   // lišta formuláře je přilepená nahoře
    __T.ukaz();
  });
  await w(250);
  const ram0 = await p.evaluate(() => __T.ram());
  check('skříň 6×24 je širší i vyšší než rámeček — rámeček se posouvá v obou směrech, posuvník je vidět', ram0.sw > ram0.cw + 200 && ram0.sh > ram0.ch &&
    await p.evaluate(() => { const r = document.getElementById('rz-svg-ram').getBoundingClientRect(); return r.bottom <= innerHeight + 1; }), JSON.stringify(ram0));
  const klik = async (r, m, mod) => { const q = await p.evaluate(([r, m]) => { document.querySelectorAll('.toast').forEach(t => t.remove()); return __T.bod(r, m); }, [r, m]);
    if (mod) await p.keyboard.down(mod); await p.mouse.click(q.x, q.y); if (mod) await p.keyboard.up(mod); await w(120); };
  const sel = () => p.evaluate(() => __T.sel());
  // Ctrl+klik, Shift+klik (i přes řady)
  await klik(0, 1.5); await klik(0, 3.5, 'Control');
  const s1 = await sel();
  await klik(0, 6.5, 'Shift');
  const s2 = await sel();
  const bezTextu = await p.evaluate(() => window.getSelection().isCollapsed);
  await klik(0, 4.5, 'Control');
  const s3 = await sel();
  const pan = await p.evaluate(() => document.getElementById('rz-vlastnosti').innerText);
  await klik(0, 12.5); await klik(1, 1.5, 'Shift');
  const s4 = await sel();
  check('Ctrl+klik přidá přístroj, Shift+klik vybere úsek od posledního kliknutého, Ctrl+klik vybraný ubere', s1 === 'A1,A3' && s2 === 'A3,A4,A5,A6' && s3 === 'A3,A5,A6', [s1, s2, s3].join(' | '));
  check('Shift+klik v pohledu neoznačí text stránky (označený text by Chrome začal táhnout a tažení přístroje by se zrušilo)', bezTextu);
  check('Shift+klik úsek přes řady zleva doprava, shora dolů', s4 === 'A12,A13,A14,A15,A16,A17,A18,A19,A20,A21,B0,B1', s4);
  check('vlastnosti výběru: „Vybráno 3 přístroje", fáze, nadřazený chránič, přesun, smazat', /Vybráno 3 přístroje/.test(pan) && /Fáze všem vybraným/i.test(pan) &&
    /Nadřazený chránič/i.test(pan) && /Přesunout jinam/.test(pan) && /Smazat vybrané \(3\)/.test(pan), pan.replace(/\n/g, ' | ').slice(0, 200));
  // klik do prázdna výběr zruší
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove())); const pz = await p.evaluate(() => __T.bod(0, 8, RZG.H + 9)); await p.mouse.click(pz.x, pz.y); await w(120); const s5 = await sel();
  check('klik do prázdného místa výběr zruší', s5 === '', s5);
  // obdélník tažením z prázdného místa (mezera pod řadou 1 → nahoru doprava)
  let od = await p.evaluate(() => __T.bod(0, 2.3, RZG.H + 9)), kam = await p.evaluate(() => __T.bod(0, 6.4, 10));
  await p.mouse.move(od.x, od.y); await p.mouse.down(); await p.mouse.move(od.x + 8, od.y - 4, { steps: 2 }); await p.mouse.move(kam.x, kam.y, { steps: 8 }); await w(80);
  const ob = await p.evaluate(() => ({ rect: !!document.getElementById('rz-obdelnik'), sel: __T.sel() }));
  await p.mouse.up(); await w(150);
  const s6 = await sel();
  od = await p.evaluate(() => __T.bod(0, 9.2, RZG.H + 9)); kam = await p.evaluate(() => __T.bod(0, 10.6, 10));
  await p.keyboard.down('Control'); await p.mouse.move(od.x, od.y); await p.mouse.down(); await p.mouse.move(kam.x, kam.y, { steps: 8 }); await p.mouse.up(); await p.keyboard.up('Control'); await w(150);
  const s7 = await sel();
  check('obdélník tažením z prázdného místa vybere přístroje, kterých se dotkne (rámeček je vidět)', ob.rect && ob.sel === 'A2,A3,A4,A5,A6' && s6 === 'A2,A3,A4,A5,A6', JSON.stringify(ob) + ' → ' + s6);
  check('Ctrl + obdélník přidá k výběru', s7 === 'A2,A3,A4,A5,A6,A9,A10', s7);
  // tažení 5 přístrojů do řady 2 na místo 18 → 4 se vejdou, 1 pokračuje v řadě 3
  await p.evaluate(() => { rozvVyberNastavit(['A2', 'A3', 'A4', 'A5', 'A6'].map(o => __rz.rady[0].prvky.find(x => x.ozn === o).uid)); rozvPohledVykreslit(); rozvVlastnostiVykreslit(); });
  od = await p.evaluate(() => __T.bod(0, 4.5));
  await p.mouse.move(od.x, od.y); await p.mouse.down(); await p.mouse.move(od.x + 10, od.y + 6, { steps: 3 });
  await p.evaluate(() => { document.getElementById('rz-svg-ram').scrollLeft = 260; }); await w(60);
  kam = await p.evaluate(() => __T.bod(1, 18.05));
  await p.mouse.move(kam.x, kam.y, { steps: 10 }); await w(120);
  const tah = await p.evaluate(([x, y]) => {
    const d = document.querySelector('.rz-duch'), s = d && d.querySelector('svg'), b = s && s.getBoundingClientRect(), z = document.getElementById('rz-znacka');
    const svg = document.querySelector('#rz-pohled .rz-svg'), k = svg.getScreenCTM().a;
    return { duch: !!s, ks: (d && d.querySelector('.rz-duch-ks') || {}).textContent || '', sirka: b ? Math.round(b.width) : 0, ocek: Math.round((5 * RZG.M + 2) * k),
             uKurzoru: b ? (x >= b.left - 5 && x <= b.right + 5 && y >= b.top - 5 && y <= b.bottom + 5) : false, opac: d ? +getComputedStyle(d).opacity : 1,
             sede: document.querySelectorAll('#rz-pohled .rz-tazeny').length, sedeOpac: +getComputedStyle(document.querySelector('#rz-pohled .rz-tazeny')).opacity,
             znacka: z && z.getAttribute('visibility'), kurzor: document.body.classList.contains('rz-tahne') };
  }, [kam.x, kam.y]);
  await p.mouse.up(); await w(250);
  const pres = await p.evaluate(() => ({ r0: __T.rada(0), r1: __T.rada(1), r2: __T.rada(2), sel: __T.sel(), toast: Array.from(document.querySelectorAll('.toast')).map(t => t.textContent).join(' | '),
    chyba: !!document.querySelector('.rz-chyba'), duch: !!document.querySelector('.rz-duch'), sede: document.querySelectorAll('#rz-pohled .rz-tazeny').length }));
  check('při tažení je u kurzoru duch ve stejném měřítku jako přístroje (5 kusů vedle sebe) s „5 ks"', tah.duch && tah.ks === '5 ks' && Math.abs(tah.sirka - tah.ocek) <= 2 && tah.uKurzoru && tah.opac < 1, JSON.stringify(tah));
  check('při tažení je původní místo zašedlé a žlutá značka ukazuje cíl', tah.sede === 5 && tah.sedeOpac < 0.5 && tah.znacka === 'visible' && tah.kurzor, JSON.stringify(tah));
  check('tažení výběru: 5 přístrojů přesunuto jako blok v původním pořadí, co se do řady 2 nevešlo, pokračuje v řadě 3',
    pres.r0 === 'A0,A1,A7,A8,A9,A10,A11,A12,A13,A14,A15,A16,A17,A18,A19,A20,A21' &&
    pres.r1 === 'B0,B1,B2,B3,B4,B5,B6,B7,B8,B9,B10,B11,B12,B13,B14,B15,B16,B17,A2,A3,A4,A5,B18,B19' && pres.r2 === 'A6,C0,C1,C2,C3,C4,C5,C6,C7,C8,C9' &&
    !pres.chyba && pres.sel === 'A2,A3,A4,A5,A6' && !pres.duch && !pres.sede, pres.r1 + ' / ' + pres.r2);
  check('hláška po přesunu řekne, kolik pokračuje v další řadě, a nabídne ZPĚT', /Přesunuto: 5 přístrojů/.test(pres.toast) && /pokračuje 1 v řadě 3/.test(pres.toast) && /ZPĚT/.test(pres.toast), pres.toast);
  await p.keyboard.press('Control+z'); await w(200);
  const zp = await p.evaluate(() => [__T.rada(0), __T.rada(1).split(',').length, __T.rada(2).split(',').length].join(' / '));
  check('jedno Ctrl+Z vrátí celý přesun bloku', zp === 'A0,A1,A2,A3,A4,A5,A6,A7,A8,A9,A10,A11,A12,A13,A14,A15,A16,A17,A18,A19,A20,A21 / 20 / 10', zp);
  // přeplnění: když se kopie bloku do skříně nevejdou, přeplní se jen cílová řada a program to řekne
  const prep = await p.evaluate(() => {
    const o = __rz.rady.map(r => r.prvky.slice());
    __rz.rady.forEach(r => { while (rozvObsazeno(r) < 24) r.prvky.push(rozvNovyPrvek(rozvKnihPolozka('v-fa-1-B16'))); });
    rozvDuplikovatVic(['A0', 'A1', 'A2'].map(z => __rz.rady[0].prvky.find(x => x.ozn === z).uid));
    const r = { r0: rozvObsazeno(__rz.rady[0]), ostatni: __rz.rady.slice(1).every(q => rozvObsazeno(q) === 24), chyba: (document.querySelector('.rz-chyba') || {}).textContent || '',
      toast: Array.from(document.querySelectorAll('.toast')).map(t => t.textContent).join(' | ') };
    zpetPosledni(); __rz.rady.forEach((rr, ri) => rr.prvky = o[ri]); rozvPohledVykreslit();
    return r;
  });
  check('když se blok do skříně nevejde, přeplní se jen cílová řada a program to řekne', prep.r0 === 27 && prep.ostatni && /Řada 1 je přeplněná/.test(prep.chyba) && /Do skříně se nevejdou/.test(prep.toast), JSON.stringify(prep).slice(0, 250));
  // Esc během tažení zruší a nic se nezmění
  await p.evaluate(() => { __T.naplnit(); __T.ukaz(); document.querySelectorAll('.toast').forEach(t => t.remove()); });
  const pred = await p.evaluate(() => JSON.stringify(__rz.rady));
  od = await p.evaluate(() => __T.bod(0, 3.5)); kam = await p.evaluate(() => __T.bod(2, 12.5));
  await p.mouse.move(od.x, od.y); await p.mouse.down(); await p.mouse.move(kam.x, kam.y, { steps: 8 }); await w(80);
  await p.keyboard.press('Escape'); await w(80);
  const esc1 = await p.evaluate(() => ({ duch: !!document.querySelector('.rz-duch'), sede: document.querySelectorAll('#rz-pohled .rz-tazeny').length, z: document.getElementById('rz-znacka').getAttribute('visibility') }));
  await p.mouse.move(kam.x + 20, kam.y, { steps: 2 }); await p.mouse.up(); await w(200);
  const esc2 = await p.evaluate(() => JSON.stringify(__rz.rady));
  check('Esc během tažení: duch a značka zmizí, po puštění myši se nic nezmění', !esc1.duch && !esc1.sede && esc1.z === 'hidden' && esc2 === pred, JSON.stringify(esc1));
  // automatický posun rámečku při tažení k okraji (vodorovně i svisle)
  await p.evaluate(() => { const r = document.getElementById('rz-svg-ram'); r.scrollLeft = 0; r.scrollTop = 0; __T.ukaz(); });
  await w(100);
  const R = await p.evaluate(() => { const r = document.getElementById('rz-svg-ram').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
  od = await p.evaluate(() => __T.bod(1, 2.5));
  await p.mouse.move(od.x, od.y); await p.mouse.down(); await p.mouse.move(od.x + 15, od.y, { steps: 3 });
  await p.mouse.move(R.r - 12, od.y, { steps: 6 }); await w(600);
  const ap = await p.evaluate(() => __T.ram());
  const cilVpravo = await p.evaluate(() => { const z = document.getElementById('rz-znacka'); return z.getAttribute('visibility') === 'visible' ? +z.getAttribute('x1') : 0; });
  await p.mouse.move(R.l + 12, od.y, { steps: 6 }); await w(600);
  const al = await p.evaluate(() => __T.ram());
  await p.mouse.move((R.l + R.r) / 2, Math.min(R.b - 12, 888), { steps: 6 }); await w(600);
  const ad = await p.evaluate(() => __T.ram());
  await p.keyboard.press('Escape'); await p.mouse.up(); await w(150);
  check('tažení k pravému okraji rámeček sám posune doprava (a značka jde se skříní)', ap.l > 150 && cilVpravo > 14 + 15 * 17.5, JSON.stringify(ap) + ' značka x ' + cilVpravo);
  check('tažení k levému okraji ho posune zpátky doleva', al.l < ap.l - 100, al.l + ' < ' + ap.l);
  check('tažení k dolnímu okraji posune rámeček dolů (svisle)', ad.t > 100, JSON.stringify(ad));
  // z knihovny k pravému okraji
  await p.evaluate(() => { const r = document.getElementById('rz-svg-ram'); r.scrollLeft = 0; r.scrollTop = 0; __T.filtr('q', 'Jistič 1P B10'); });
  od = await p.evaluate(() => { const el = document.querySelector('#rz-seznam .rz-polozka .rz-p-text'); const b = el.getBoundingClientRect(); return { x: Math.round(b.left + 20), y: Math.round(b.top + b.height / 2) }; });
  await p.mouse.move(od.x, od.y); await p.mouse.down(); await p.mouse.move(od.x + 15, od.y + 4, { steps: 3 });
  const duchK = await p.evaluate(() => { const s = document.querySelector('.rz-duch svg'); const k = document.querySelector('#rz-pohled .rz-svg').getScreenCTM().a; return s ? [Math.round(s.getBoundingClientRect().width), Math.round((RZG.M + 2) * k)].join('/') : ''; });
  await p.mouse.move(R.r - 10, R.t + 120, { steps: 10 }); await w(600);
  const ak = await p.evaluate(() => __T.ram());
  await p.mouse.move(R.r - 200, R.t + 120, { steps: 4 }); await w(60);
  await p.mouse.up(); await w(200);
  const vk = await p.evaluate(() => ({ n: __rz.rady.reduce((s, r) => s + r.prvky.length, 0), vyb: (rozvNajit(__rz.vyber) || { x: { p: {} } }).x.p.nazev, ram: __T.ram() }));
  const [dw, dk] = duchK.split('/').map(Number);
  check('z knihovny: duch přístroje ve stejném měřítku, u pravého okraje se rámeček posune a přístroj padne na viditelné místo',
    Math.abs(dw - dk) <= 2 && ak.l > 150 && vk.n === 71 && vk.vyb === 'Jistič 1P B10' && vk.ram.l === ak.l, duchK + ' · ' + JSON.stringify(ak) + ' · ' + JSON.stringify(vk));
  // poloha posuvníku se nemění: klik vedle přístroje, klik na přístroj, vložení, smazání, ZPĚT
  await p.evaluate(() => { __T.filtr('q', ''); __T.naplnit(); __T.ukaz(); const r = document.getElementById('rz-svg-ram'); r.scrollLeft = 300; r.scrollTop = 120; });
  await w(150);
  const poloha = [];
  const ted = async () => { const r = await p.evaluate(() => __T.ram()); poloha.push(r.l + ':' + r.t); };
  await ted();
  const prazdno = await p.evaluate(() => { const r = document.getElementById('rz-svg-ram').getBoundingClientRect(); const q = __T.bod(2, 0, RZG.H + 9); return { x: Math.round(r.left + r.width * 0.6), y: q.y }; });
  await p.mouse.click(prazdno.x, prazdno.y); await w(120); await ted();
  const naPr = await p.evaluate(() => { const r = document.getElementById('rz-svg-ram').getBoundingClientRect(); const q = __T.bod(1, 0); return { x: Math.round(r.left + r.width * 0.6), y: q.y }; });
  await p.mouse.click(naPr.x, naPr.y); await w(120); await ted();
  const vybranyPoKliku = await sel();
  await p.mouse.click(naPr.x, naPr.y, { button: 'right' }); await w(150);
  const menuOtevrene = await p.evaluate(() => !!document.querySelector('.kt-menu'));
  await p.evaluate(() => { const b = Array.from(document.querySelectorAll('.kt-menu .kt-pol')).find(b => /rezervu/.test(b.textContent)); if (b) b.click(); }); await w(150); await ted();
  await p.keyboard.press('Delete'); await w(120); await ted();
  await p.keyboard.press('Control+z'); await w(150); await ted();
  check('poloha posuvníku se nezmění: klik vedle přístroje, klik na přístroj, vložení, smazání, Ctrl+Z', poloha.every(x => x === '300:120'), poloha.join(' → '));
  check('klik na přístroj ve odrolované části ho vybere a pravý klik otevře menu (nezavře ho vrácení polohy)', /^B1[0-9]$/.test(vybranyPoKliku) && menuOtevrene, vybranyPoKliku + ' · menu ' + menuOtevrene);
  // zoom: střed rámečku zůstane na stejném místě skříně
  const stred = () => p.evaluate(() => { const r = document.getElementById('rz-svg-ram').getBoundingClientRect(); const s = document.querySelector('#rz-pohled .rz-svg'); const pt = new DOMPoint(r.left + r.width / 2, r.top + r.height / 2).matrixTransform(s.getScreenCTM().inverse()); return [Math.round(pt.x), Math.round(pt.y)]; });
  const z0 = await stred();
  await p.evaluate(() => TD_AKCE.tdRZoom(document.querySelector('[data-action="tdRZoom"][data-z="+"]'))); await w(100);
  const z1 = await stred();
  await p.evaluate(() => TD_AKCE.tdRZoom(document.querySelector('[data-action="tdRZoom"][data-z="-"]'))); await w(100);
  const z2 = await stred();
  check('zoom ＋ / − nechá střed rámečku na stejném místě skříně (neskočí na začátek)', [z1, z2].every(z => Math.abs(z[0] - z0[0]) <= 3 && Math.abs(z[1] - z0[1]) <= 3), [z0, z1, z2].join(' → '));
  await p.evaluate(() => { __rz.zoom = 1; rozvPohledVykreslit(); __T.ukaz(); const r = document.getElementById('rz-svg-ram'); r.scrollLeft = 0; r.scrollTop = 0; });
  // klávesy a menu nad výběrem
  await klik(0, 1.5); await klik(0, 3.5, 'Shift');
  await p.keyboard.press('Control+d'); await w(150);
  const kd = await p.evaluate(() => ({ r0: __T.rada(0), sel: __T.sel(), r1: __T.rada(1) }));
  await p.keyboard.press('Control+z'); await w(150);
  await klik(0, 1.5); await klik(0, 3.5, 'Shift');
  await p.keyboard.press('ArrowRight'); await w(120);
  const ka = await p.evaluate(() => __T.rada(0).split(',').slice(0, 6).join(','));
  await p.keyboard.press('ArrowDown'); await w(120);
  const kdol = await p.evaluate(() => ({ r0: __T.rada(0).split(',').slice(0, 4).join(','), r1: __T.rada(1).split(',').slice(0, 5).join(',') }));
  await p.keyboard.press('Control+c'); await w(80);
  await klik(3, 5.5); await p.keyboard.press('Control+v'); await w(150);
  const kv = await p.evaluate(() => ({ r3: __T.rada(3), sel: __T.sel() }));
  await p.keyboard.press('Delete'); await w(150);
  const kdel = await p.evaluate(() => ({ r3: __T.rada(3), toast: Array.from(document.querySelectorAll('.toast')).map(t => t.textContent).join(' | ') }));
  await p.keyboard.press('Control+z'); await w(150);
  const kz = await p.evaluate(() => __T.rada(3));
  check('Ctrl+D u výběru: kopie celého bloku hned za ním (co se nevejde, pokračuje v další řadě), vybrané jsou kopie',
    kd.r0.startsWith('A0,A1,A2,A3,-FA1,-FA2,A4,') && kd.r1.startsWith('-FA3,B0,') && kd.sel === '-FA1,-FA2,-FA3', JSON.stringify(kd).slice(0, 300));
  check('šipka → posune celý výběr o místo, ↓ do sousední řady na podobné místo', ka === 'A0,A4,A1,A2,A3,A5' && kdol.r0 === 'A0,A4,A5,A6' && kdol.r1 === 'B0,B1,A1,A2,A3', ka + ' | ' + JSON.stringify(kdol));
  check('Ctrl+C / Ctrl+V u výběru: vloží všechny 3 za vybraný přístroj, vložené jsou vybrané', /^D0,D1,D2,D3,D4,D5,[^,]+,[^,]+,[^,]+$/.test(kv.r3) && kv.sel.split(',').length === 3, JSON.stringify(kv));
  check('Delete smaže celý výběr (hláška se ZPĚT), jedno Ctrl+Z ho vrátí', kdel.r3 === 'D0,D1,D2,D3,D4,D5' && /Smazáno: 3 přístroje/.test(kdel.toast) && kz === kv.r3, kdel.r3 + ' | ' + kz);
  // pravý klik nad výběrem
  await klik(0, 1.5); await klik(0, 2.5, 'Control');
  const q = await p.evaluate(() => __T.bod(0, 2.5)); await p.mouse.click(q.x, q.y, { button: 'right' }); await w(150);
  const mv = await p.evaluate(() => ({ m: Array.from(document.querySelectorAll('.kt-menu .kt-pol')).map(b => b.childNodes[0].textContent.trim()).join('|'), sel: __T.sel() }));
  check('pravý klik nad výběrem: menu pro celý výběr (výběr zůstane)', mv.m === 'Duplikovat|Kopírovat|Vložit za ně|Přesunout do řady 1|Přesunout do řady 2|Přesunout do řady 3|Přesunout do řady 4|Přesunout do řady 5|Přesunout do řady 6|Smazat vybrané (2)' &&
    mv.sel.split(',').length === 2, JSON.stringify(mv));
  await p.evaluate(() => { const b = Array.from(document.querySelectorAll('.kt-menu .kt-pol')).find(b => b.textContent.trim().startsWith('Přesunout do řady 5')); if (b) b.click(); }); await w(150);
  const m5 = await p.evaluate(() => __T.rada(4).split(',').slice(-2).join(','));
  check('„Přesunout do řady 5" dá výběr na konec řady 5', m5.split(',').length === 2 && !/^E/.test(m5), m5);
  // vlastnosti výběru: fáze všem, postupně L1–L3
  await p.evaluate(() => { const u = __rz.rady[2].prvky.slice(0, 4).map(x => x.uid); rozvVyberNastavit(u); rozvPohledVykreslit(); rozvVlastnostiVykreslit(); });
  await p.selectOption('#rz-vlastnosti select[data-rpv="faze"]', 'L2'); await w(120);
  const f1 = await p.evaluate(() => __rz.rady[2].prvky.slice(0, 4).map(x => x.faze).join(','));
  await p.selectOption('#rz-vlastnosti select[data-rpv="faze"]', '@L123'); await w(120);
  const f2 = await p.evaluate(() => __rz.rady[2].prvky.slice(0, 4).map(x => x.faze).join(','));
  await p.keyboard.press('Escape'); await w(80);
  const f3 = await sel();
  check('vlastnosti výběru: fáze všem vybraným, „postupně L1, L2, L3"; Esc výběr zruší', f1 === 'L2,L2,L2,L2' && f2 === 'L1,L2,L3,L1' && f3 === '', [f1, f2, f3].join(' | '));
  }

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
    const dl = await t.evaluate(async () => {
      document.getElementById('rz-svg-ram').scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 150));
      const q = __T.bod(1, 0.5), el = document.elementFromPoint(q.x, q.y), o = { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true, clientX: q.x, clientY: q.y };
      el.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise(r => setTimeout(r, 750));
      // první dlouhý stisk zapne výběr více přístrojů (v1.21), další otevře menu
      const rezim = { zap: !!__rz.rezimVyberu, banner: (document.querySelector('.rz-banner-vyber') || {}).textContent || '', menu: !!document.querySelector('.kt-menu') };
      el.dispatchEvent(new PointerEvent('pointerup', o));
      const q2 = __T.bod(1, 0.5), el2 = document.querySelector('#rz-pohled [data-puid="' + __rz.rady[1].prvky[0].uid + '"] rect');   // pruh výběru posunul pohled, hláška může bod zakrýt
      Object.assign(o, { clientX: q2.x, clientY: q2.y });
      el2.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise(r => setTimeout(r, 750));
      const m = document.querySelector('.kt-menu');
      const r = { rezim, menu: m ? Array.from(m.querySelectorAll('.kt-pol')).map(b => b.childNodes[0].textContent.trim()).join('|') : '', vyber: (rozvNajit(__rz.vyber) || { x: {} }).x.ozn };
      el2.dispatchEvent(new PointerEvent('pointerup', o));
      r.vyska = m ? Math.min.apply(null, Array.from(m.querySelectorAll('.kt-pol')).map(b => b.getBoundingClientRect().height)) : 0;
      ktZavrit(); TD_AKCE.tdRVyberZrusit(); return r;
    });
    check('telefon: první dlouhý stisk zapne výběr více přístrojů (pruh nahoře), přístroj je vybraný', dl.rezim.zap && !dl.rezim.menu &&
      /Výběr více přístrojů/.test(dl.rezim.banner) && /Vybráno: 1/.test(dl.rezim.banner), JSON.stringify(dl.rezim));
    check('telefon: ve výběru dlouhý stisk prstem na přístroji otevře totéž menu (položky ≥ 40 px)', /^Vlastnosti\|Duplikovat\|Kopírovat\|Vložit za něj\|Vložit rezervu vedle\|Přesunout do řady 1\|🔢 Přečíslovat označení\|Smazat$/.test(dl.menu) &&
      dl.vyber === '-FI1' && dl.vyska >= 40, JSON.stringify(dl));
    // výběr více prstem: dlouhý stisk -FA1, klepnutí na -FA2, „✥ Přesunout jinam" v pruhu, klepnutí do řady 1
    await t.evaluate(async () => {
      document.getElementById('rz-svg-ram').scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 150));
      const q = __T.bod(1, 4.5), el = document.elementFromPoint(q.x, q.y), o = { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true, clientX: q.x, clientY: q.y };
      el.dispatchEvent(new PointerEvent('pointerdown', o)); await new Promise(r => setTimeout(r, 750)); el.dispatchEvent(new PointerEvent('pointerup', o));
      __rz.dlouhyStisk = 0;
    });
    await w(200);
    await tap(() => __T.bod(1, 5.5));
    const dv1 = await t.evaluate(() => ({ sel: rozvVybrane().map(u => rozvNajit(u).x.ozn).join(','), ban: (document.querySelector('.rz-banner-vyber') || {}).textContent || '',
      panel: document.getElementById('rz-vlastnosti').innerText }));
    q = await vid('.rz-banner-vyber [data-action="tdRPresunKlep"]'); await t.touchscreen.tap(q.x, q.y); await w(350);
    const dv2 = await t.evaluate(() => (document.querySelector('.rz-banner') || {}).textContent || '');
    await t.evaluate(() => document.getElementById('rz-svg-ram').scrollIntoView({ block: 'center' })); await w(200);
    await tap(() => __T.bod(0, 0.2));
    const dv3 = await t.evaluate(() => ({ r: __rz.rady.map(r => r.prvky.map(x => x.ozn).join(',')).join(' / '), rezim: !!__rz.rezimVyberu }));
    check('telefon: výběr více — dlouhý stisk a klepnutí vyberou 2 přístroje, pruh i vlastnosti to říkají', dv1.sel === '-FA1,-FA2' && /Vybráno: 2/.test(dv1.ban) &&
      /Vybráno 2 přístroje/.test(dv1.panel), JSON.stringify(dv1).slice(0, 200));
    check('telefon: „✥ Přesunout jinam" a klepnutí do řady přesune oba přístroje jako blok', /Přesun 2 přístroje/.test(dv2) && dv3.r === '-FA1,-FA2 / -FI1' && !dv3.rezim, dv2 + ' → ' + dv3.r);
    const infoT = await t.evaluate(() => { const e = document.querySelector('.rz-knihovna .rz-info-knihovna'); e.scrollIntoView({ block: 'center' });
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return { l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), fs: parseFloat(cs.fontSize), cely: e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1 }; });
    check('telefon: informační pruh je celý vidět (v šířce displeje, nic neuříznuté)', infoT.l >= 0 && infoT.r <= 375 && infoT.h > 60 && infoT.fs >= 13 && infoT.cely, JSON.stringify(infoT));
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
