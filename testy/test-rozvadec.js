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
    // počká, až se stránka i rámeček přestanou posouvat (program po klepnutí plynule roluje
    // k pohledu / vlastnostem — při zátěži celé regrese to trvá déle než pevná čekací doba)
    async klid() {
      let last = '', same = 0;
      for (let i = 0; i < 240 && same < 4; i++) {
        await new Promise(r => requestAnimationFrame(r));
        const ram = document.getElementById('rz-svg-ram'), y = scrollY + ',' + (ram ? ram.scrollLeft + ',' + ram.scrollTop : '');
        if (y === last) same++; else { same = 0; last = y; }
      }
    },
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
  check('dlaždice „Rozvaděč DBO – návrh a dokumentace" s popisem ČSN EN IEC 61439-3', dl.typy === 'pouvv,rozv,psc' &&
    /Rozvaděč DBO – návrh a dokumentace/i.test(dl.text) && /ČSN EN (IEC )?61439-3/.test(dl.text), dl.typy + ' | ' + dl.text.replace(/\n/g, ' | '));
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
  check('vestavěné: všech 18 kategorií (i transformátor, zdroj, zásuvka na lištu)', vest.kat === 18, String(vest.kat));
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
  check('přístroje: kategorie jako řada tlačítek a výrobce, póly, In, charakteristika vždy vidět', f.viditelne.skupiny === 'Vše·Jističe·Chrániče·RCBO·AFDD·SPD·Vypínače·Pojistky·Trafa a zdroje·Ostatní' &&
    f.viditelne.sel === 'vyrobce,poly,In,char', JSON.stringify(f.viditelne));
  check('sbalené „Další filtry" jen IΔn, typ chrániče, jen ověřené, jen oblíbené', f.viditelne.sbalene && /^Další filtry/.test(f.viditelne.souhrn), f.viditelne.souhrn);
  check('kategorie Jističe (tlačítko se zvýrazní), počítadlo „Zobrazeno 50 z 80"', /^Zobrazeno 50 z 80 \(v knihovně \d+\)/.test(f.fa) && f.faAkt === 'Jističe', f.fa + ' · ' + f.vse);
  check('filtr: póly + charakteristika + In → právě Jistič 1P B16; „Zrušit filtry" vše vrátí', f.b16 === 'Jistič 1P B16' && /Zrušit filtry/.test(f.pocetB16) &&
    /^Zobrazeno 50 z \d+$/.test(f.poZruseni.pocet) && f.poZruseni.akt === 'Vše', f.b16 + ' · ' + f.pocetB16 + ' · ' + JSON.stringify(f.poZruseni));
  check('filtr IΔn 300 mA u chráničů (v Dalších filtrech, souhrn řekne kolik zapnuto)', f.fi300 === 2 && /1 zapnuto/.test(f.pocetFiltru), f.fi300 + ' ' + f.pocetFiltru);
  check('„Ostatní" = stykače, relé, hodiny, elektroměry, signálky, ovladače, svorky, zásuvka na lištu, rezervy', f.jine === 'HL,KA,KM,KT,PJ,REZ,SF,X,XS', f.jine);
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
  check('tažení myší z knihovny do řady: přístroj je v řadě 1, vybraný, s označením -QH1', t1.r0 === '-QH1' && t1.vyber && !t1.duch &&
    /Vlastnosti přístroje/i.test(t1.vlastnosti) && /-QH1/.test(t1.vlastnosti), t1.r0);
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
  check('byt 3+1: označení podle kategorie a pořadí (-QH1, SPD1, -FA1…, -FI1, -FI/FA1)',
    byt.r[0] === '-QH1,SPD1,-FA1,REZ' && byt.r[1] === '-FI1,-FA2,-FA3,-FA4,-FA5,-FA6,-FA7,-FA8,-FA9' && byt.r[2] === '-FI2,-FA10,-FA11,-FA12,-FA13,-FI/FA1,REZ', byt.r.join(' / '));
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
  const PREC = '-QH1,SPD1,-FA1,-FA2 / -FI1,-FA3,-FA4,-FA5,-FA6,-FA7,-FA8,-FA9,-FA10 / -FI2,-FA11,-FA12,-FA13,-FA14,-FI/FA1,-FA15';
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
  check('▼ / ▲ přesune do sousední řady na podobné místo a zpět', /^-QH1,SPD1,-FA2 \/ -FI1,-FA3,-FA4,-FA5,-FA1,-FA6,/.test(tl.posun) && tl.zpet === '-QH1,SPD1,-FA1,-FA2', tl.posun + ' | ' + tl.zpet);
  const tl2 = await p.evaluate(() => { __rz.aktRada = 1; TD_AKCE.tdRRychle(document.querySelector('#rz-rychle [data-kid="v-rez-1"]')); return __T.rada(2); });
  check('rychlé přidání: plná vybraná řada → na konec první řady, kde je místo', tl.rychle === '-QH1,SPD1,-FA1,-FA2' && tl2 === '-FI2,-FA11,-FA12,-FA13,-FA14,-FI/FA1,-FA15,REZ' &&
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
    window.__dokOtevreny.data.dokVyber = { cp: true, schema: false, tech: false, prohl: false, ko: false };
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
      vListu: Array.from(document.querySelectorAll('#dok-pdf-pages .a4')).every(a => a.getBoundingClientRect().height <= 210 * 96 / 25.4 + 1),
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
  check('PDF: seznam přístrojů bez rezerv — každý přístroj jeden řádek, dlouhý seznam dělený po stranách se záhlavím, nic nepřetéká', pdf.radku === pdf.nonRez && !pdf.rez &&
    pdf.tabulek >= 2 && pdf.hlavicek === pdf.tabulek * 9 && pdf.vListu, pdf.radku + '/' + pdf.nonRez + ' · tabulek ' + pdf.tabulek);
  check('PDF: sloupce označení, popis vývodu, typ, In, charakteristika, póly, IΔn, fáze, kabel', pdf.prvni === '-QH1 |  | Hlavní vypínač 3P 40 A * | 40 A |  | 3P |  | 3f | ' &&
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

  // ── 5b'. seznam přístrojů s dvouřádkovými řádky (hlášení 2026-10-22) ────
  // Pevných 18 řádků na stranu přeteklo, když měl typ druhý řádek s výrobcem
  // a popis vývodu se zalomil — konec seznamu se v PDF uřízl.
  const dlouhy = await p.evaluate(async () => {
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-6x24-ocel'));
    const pop = ['Osvětlení (chodba, koupelna, WC, pokoj, technická místnost, šatna, kuchyně)', 'Zásuvky kuchyně – linka u okna a ostrůvek',
      'Myčka nádobí a mikrovlnná trouba', 'Proudový chránič pro kuchyni, koupelnu a terasu'];
    let n = 0;
    __rz.rady.forEach(r => { r.prvky = []; for (let i = 0; i < 7; i++) { const x = rozvNovyPrvek(rozvKnihPolozka('v-fa-1-B16')); n++;
      x.ozn = '-FA' + n; x.vyvod = pop[n % 4]; x.kabel = 'CYKY-J'; x.prurez = '3×2,5'; x.faze = 'L' + (1 + n % 3);
      x.p.nazev = 'Proudový chránič s jističem 1+N B16 30 mA typ A'; x.p.vyrobce = 'Výrobce A'; x.p.rada = 'R1 řada';
      x.p.typ = 'VA-B16-1N-030-A-' + n; r.prvky.push(x); } });
    rozvPohledVykreslit(); await dokUlozitOtevreny();
    window.__dokOtevreny.data.dokVyber = { cp: true, schema: false, tech: false, prohl: false, ko: false };
    await dokNahled(); await __T.w(600);
    const tab = Array.from(document.querySelectorAll('#dok-pdf-pages .rz-pdf-tab'));
    const radky = tab.flatMap(t => Array.from(t.querySelectorAll('tr')).filter(tr => tr.querySelector('td')));
    return { n, radku: radky.length, ozn: radky.map(tr => tr.cells[0].innerText.trim()).join(','), tabulek: tab.length,
      dvoj: radky.filter(tr => tr.querySelector('small')).length, hlav: tab.every(t => t.querySelectorAll('th').length === 9),
      vListu: tab.every(t => t.getBoundingClientRect().bottom <= t.closest('.a4').querySelector('.dok-pdf-paticka').getBoundingClientRect().top + 1),
      vyskaListu: Math.max.apply(null, Array.from(document.querySelectorAll('#dok-pdf-pages .a4')).map(a => Math.round(a.getBoundingClientRect().height))),
      stran: document.querySelectorAll('#dok-pdf-pages .a4').length };
  });
  const cekane = Array.from({ length: dlouhy.n }, (_, i) => '-FA' + (i + 1)).join(',');
  check('PDF: seznam s dvouřádkovými řádky (výrobce pod typem) — všech 42 přístrojů, nic se neuřízne, záhlaví na každé straně',
    dlouhy.n === 42 && dlouhy.radku === 42 && dlouhy.ozn === cekane && dlouhy.dvoj === 42 && dlouhy.hlav && dlouhy.vListu && dlouhy.vyskaListu <= Math.round(210 * 96 / 25.4) + 1 && dlouhy.tabulek >= 3,
    JSON.stringify({ radku: dlouhy.radku, tabulek: dlouhy.tabulek, vListu: dlouhy.vListu, vyskaListu: dlouhy.vyskaListu, stran: dlouhy.stran }));

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
    const tap = async (fn, arg) => { await t.evaluate(() => __T.klid()); const q = await t.evaluate(fn, arg); await t.touchscreen.tap(q.x, q.y); await w(350); };
    const vid = async sel => t.evaluate(async s => { await __T.klid(); const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); await __T.klid();
      const b = e.getBoundingClientRect(); return { x: b.left + 12, y: b.top + b.height / 2 }; }, sel);
    const naRam = () => t.evaluate(async () => { await __T.klid(); document.getElementById('rz-svg-ram').scrollIntoView({ block: 'center' }); await __T.klid(); });
    const lay = await t.evaluate(() => {
      const k = document.querySelector('.rz-knihovna').getBoundingClientRect(), p2 = document.getElementById('rz-pohled').getBoundingClientRect(),
            v = document.getElementById('rz-vlastnosti').getBoundingClientRect();
      return { podSebou: k.bottom <= p2.top + 1 && p2.bottom <= v.top + 1, sirka: document.documentElement.scrollWidth };
    });
    check('telefon 375 px: knihovna, čelní pohled a vlastnosti pod sebou, stránka bez vodorovného posunu', lay.podSebou && lay.sirka <= 375, JSON.stringify(lay));
    await t.evaluate(() => __T.filtr('q', 'Jistič 1P B16'));
    let q = await vid('#rz-seznam [data-kid="v-fa-1-B16"] .rz-p-text'); await t.touchscreen.tap(q.x, q.y); await w(500);
    const ban = await t.evaluate(() => ({ vyber: __rz.knihVyber, banner: (document.querySelector('.rz-banner') || {}).textContent || '' }));
    await naRam();
    await tap(() => __T.bod(1, 0.5));
    const vl1 = await t.evaluate(() => ({ r: __rz.rady.map(r => r.prvky.map(x => x.ozn).join(',')).join(' / '), banner: !!document.querySelector('.rz-banner') }));
    check('telefon: klepnutí na přístroj v knihovně ho vybere (banner „klepněte do řady")', ban.vyber === 'v-fa-1-B16' && /klepněte do řady/.test(ban.banner), ban.banner);
    check('telefon: klepnutí do řady ho tam vloží', vl1.r === ' / -FA1' && !vl1.banner, vl1.r);
    q = await vid('#rz-rychle [data-kid="v-fi-4-40-30-A"]'); await t.touchscreen.tap(q.x, q.y); await w(300);
    q = await vid('#rz-rychle [data-kid="v-fa-1-B10"]'); await t.touchscreen.tap(q.x, q.y); await w(300);
    const vl2 = await t.evaluate(() => __rz.rady.map(r => r.prvky.map(x => x.ozn).join(',')).join(' / '));
    check('telefon: rychlé přidání klepnutím na konec vybrané řady', vl2 === ' / -FA1,-FI1,-FA2', vl2);
    // přesun klepnutím: vybrat -FI1, „✥ Přesunout jinam", klepnout na začátek řady 2
    await naRam();
    await tap(() => __T.bod(1, 3));
    const vyb = await t.evaluate(() => (rozvNajit(__rz.vyber) || { x: {} }).x.ozn);
    q = await vid('#rz-vlastnosti [data-action="tdRPresunKlep"]'); await t.touchscreen.tap(q.x, q.y); await w(400);
    await naRam();
    await tap(() => __T.bod(1, 0.2));
    const vl3 = await t.evaluate(() => ({ r: __rz.rady.map(r => r.prvky.map(x => x.ozn).join(',')).join(' / '), nadr: __rz.rady[1].prvky.slice(1).every(x => x.nadr === __rz.rady[1].prvky[0].uid) }));
    check('telefon: klepnutím vybraný přístroj jde „✥ Přesunout jinam" klepnutím do řady', vyb === '-FI1' && vl3.r === ' / -FI1,-FA1,-FA2' && vl3.nadr, vyb + ' → ' + vl3.r);
    const dl = await t.evaluate(async () => {
      await __T.klid(); document.getElementById('rz-svg-ram').scrollIntoView({ block: 'center' }); await __T.klid();
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
      await __T.klid(); document.getElementById('rz-svg-ram').scrollIntoView({ block: 'center' }); await __T.klid();
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
    await naRam();
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

  // ── transformátory, zdroje, zásuvka, ostatní (2026-10-22) ─────────────
  const tz = await p.evaluate(async () => {
    const r = {};
    r.kat = ['TR', 'ZD', 'XS', 'JINE'].map(k => { const x = rozvKat(k); return x ? x.k + x.ozn : '-'; }).join();
    r.oznKolize = ['TR', 'ZD', 'XS', 'JINE'].map(k => rozvKat(k).ozn).filter(o => ROZV_KAT.filter(k => k.ozn === o).length > 1).join();
    r.vest = ['v-tr-zvon-8', 'v-tr-zvon-16', 'v-tr-bezp-25', 'v-tr-bezp-63', 'v-zd-24-30', 'v-zd-24-60', 'v-zd-12-15', 'v-xs-16'].map(id => {
      const x = rozvKnihPolozka(id); return x ? [x.kat, rozvCisloText(x.sirka), x.vykon === undefined ? '' : x.vykon, x.pv, x.overeno, x.vyrobce].join('|') : 'CHYBÍ ' + id; }).join(' ; ');
    r.stareKlice = ['v-fa-1-B16', 'v-fi-4-40-30-A', 'v-sk-3x12-n'].some(id => ['vykon', 'uVstup', 'uVystup', 'iVystup', 'ozn'].some(k => k in rozvKnihPolozka(id)));
    // knihovna: tlačítko „Trafa a zdroje"
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
    TD_AKCE.tdRTab(document.querySelector('.rz-tab[data-tab="pristroje"]'));
    document.querySelector('#rz-filtry-hlavni .rz-skup[data-k="TRZD"]').click();
    r.trzd = Array.from(new Set(Array.from(document.querySelectorAll('#rz-seznam .rz-ikona')).map(x => x.textContent))).sort().join() + '|' + __T.nalezeno();
    TD_AKCE.tdRFiltrZrusit();
    // vložení: označení, čelo, popisky, PDF
    const fa = rozvVlozit('v-fa-1-B6'), t = rozvVlozit('v-tr-zvon-16'), g = rozvVlozit('v-zd-24-60'), xs = rozvVlozit('v-xs-16');
    r.ozn = [fa, t, g, xs].map(x => x.ozn).join();
    r.celo = [t, g, xs].map(x => rozvCelo(x.p).filter(Boolean).join(' ')).join(' ; ');
    r.svg = /230\/8\/12 V/.test(document.querySelector('#rz-pohled .rz-svg').innerHTML) && /60 W/.test(document.querySelector('#rz-pohled .rz-svg').innerHTML);
    r.pop = [t, g, xs].map(x => rozvPopiskaHodnota(x.p)).join(' ; ');
    r.nadr = rozvNazev(rozvPolozkaNorm({ kat: 'TR', uVstup: '230', uVystup: '12', vykon: 16 })) + ' / ' + rozvNazev(rozvPolozkaNorm({ kat: 'ZD', uVystup: '24 DC', vykon: 60 }));
    const pdf = DOK_TYPY.rozv.pdf(DOK_TYPY.rozv.cist(dokForm())).map(x => x.html || '').join('').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    r.pdf = /-T1 Zvonkový transformátor 8\/12 V 16 VA 230\/8\/12 V 16 VA/.test(pdf) && /-G1 Napájecí zdroj 24 V DC 60 W/.test(pdf) && /-XS1 Zásuvka na DIN lištu 16 A/.test(pdf);
    // vlastní „Ostatní přístroj" s předponou
    TD_AKCE.tdRVlastniPristroj();
    const o = document.getElementById('modal-rz-polozka'), q = k => o.querySelector('[data-rp="' + k + '"]');
    r.volby = Array.from(q('kat').options).map(x => x.value).filter(v => ['TR', 'ZD', 'XS', 'JINE'].indexOf(v) !== -1).join();
    q('kat').value = 'ZD'; q('kat').dispatchEvent(new Event('change', { bubbles: true }));
    r.poleZD = Array.from(o.querySelectorAll('[data-rp]')).map(e => e.getAttribute('data-rp')).filter(k => /vykon|uV|iV|pv/.test(k)).join() + '|' +
      Array.from(o.querySelectorAll('label')).map(l => l.textContent).filter(t => /^Výkon|Pv/.test(t)).join('|');
    q('kat').value = 'JINE'; q('kat').dispatchEvent(new Event('change', { bubbles: true }));
    r.poleJ = Array.from(o.querySelectorAll('[data-rp]')).map(e => e.getAttribute('data-rp')).join();
    q('ozn').value = '-RE'; q('sirka').value = '1';
    await TD_AKCE.tdRPolUlozit();
    r.chybaNazev = document.getElementById('rz-pol-chyby').textContent;
    q('nazev').value = 'Stmívač'; q('ozn').value = '-RE 1';
    await TD_AKCE.tdRPolUlozit();
    r.chybaPred = document.getElementById('rz-pol-chyby').textContent;
    q('ozn').value = '-RE'; q('pv').value = '1,2';
    await TD_AKCE.tdRPolUlozit(); await __T.w(100);
    r.zavren = !o.classList.contains('open');
    const jn = DOK.rozvKnihovna.filter(x => x.kat === 'JINE')[0];
    r.jine = jn ? [jn.nazev, jn.ozn, jn.sirka, jn.pv, jn.zdroj].join('|') : 'neuloženo';
    const j1 = rozvVlozit(jn.id), j2 = rozvVlozit(jn.id);
    r.oznJ = j1.ozn + ',' + j2.ozn;
    j1.ozn = 'xx'; t.ozn = 'yy';
    rozvPrecislovat();
    r.precisl = __rz.rady[0].prvky.map(x => x.ozn).join();
    // stará položka bez nových klíčů zůstane stejná
    r.normStary = JSON.stringify(rozvPolozkaNorm({ kat: 'FA', In: 16, sirka: 1 })) === JSON.stringify(Object.assign(rozvPolozkaNorm({ kat: 'FA', In: 16, sirka: 1 }), {}))
      && !('vykon' in rozvPolozkaNorm({ kat: 'FA', In: 16, sirka: 1 })) && !('ozn' in rozvPolozkaNorm({ kat: 'FA', ozn: '-X', sirka: 1 }));
    // import CSV s novými sloupci i bez nich
    const csv1 = 'druh;kategorie;nazev;in;sirka_moduly;vykon;u_vstup;u_vystup;i_vystup\r\n' +
      'pristroj;trafo;;;2;16 VA;230;12;\r\n' +
      'pristroj;napájecí zdroj;LED zdroj;;3;60 W;230;24 DC;2,5\r\n' +
      'pristroj;zásuvka;;16;3;;;;\r\n' +
      'pristroj;ostatní;Domácí telefon;;2;;;;\r\n' +
      'pristroj;ostatní;;;1;;;;\r\n';
    const i1 = rozvImportRozebrat(csv1, 'trafa.csv');
    r.imp1 = i1.polozky.map(x => [x.polozka.kat, x.polozka.vykon === undefined ? '' : x.polozka.vykon, x.polozka.uVstup || '', x.polozka.uVystup || '',
      x.polozka.iVystup === undefined ? '' : x.polozka.iVystup, x.polozka.In].join('|')).join(' ; ');
    r.imp1chyby = i1.chyby.map(c => c.radek + ':' + c.text).join(' ; ');
    const i2 = rozvImportRozebrat('kategorie;typ;sirka_moduly\nKA;VV-KA-77;1\n', 'stare.csv');
    r.imp2 = i2.polozky.length === 1 && !i2.chyby.length && !['vykon', 'uVstup', 'uVystup', 'iVystup', 'ozn'].some(k => k in i2.polozky[0].polozka);
    window.ulozitSoubor = (blob, name) => { window.__ul = { blob, name }; return Promise.resolve(true); };
    TD_AKCE.tdRSablona();
    r.sablona = await window.__ul.blob.text();
    // zakreslení z revizní zprávy: jen návrh, jistič zůstane jističem
    const z = { uid: 'zz-tr', ev_cislo: 'RE-26-0999', data: { misto: 'Vymyšlený dům', rozvadece: [{ uid: 'r-tr', nazev: 'RH', mereni: [
      { rowtype: 'obvod', c: '1', n: 'Zvonek', a: '6', ch: 'B' }, { rowtype: 'obvod', c: '2', n: 'LED pásek kuchyň', a: '10', ch: 'B' },
      { rowtype: 'obvod', c: '3', n: 'Lednice', a: '16', ch: 'B' }, { rowtype: 'obvod', c: '4', n: 'Zásuvky', a: '16', ch: 'B' }] }] } };
    const rb = rzzRozbor(z.data.rozvadece[0], rzzVyrobceZnamy(), rozvKnihovnaVse());
    r.navrhy = rb.prvky.map(a => a.navrh ? a.navrh.kat : '-').join();
    __rzZR = { navrhy: {} };
    const nh = rzzNavrhyHtml('r-tr', rb.prvky.filter(a => a.navrh));
    r.navrhHtml = (nh.match(/data-rzz-navrh/g) || []).length + '|' + / checked/.test(nh) + '|' + /Obvod „Zvonek": přidat za jistič transformátor/.test(nh);
    const kat = v => v.docs[0].data.rady.map(rr => rr.prvky.map(x => x.p.kat).join(',')).join('/');
    r.bez = kat(rzzPrevod(z, ['r-tr'], { rady: {}, objekt: '' }));
    const s2 = rzzPrevod(z, ['r-tr'], { rady: {}, objekt: '', navrhy: { 'r-tr|0': true, 'r-tr|1': true } });
    r.s = kat(s2);
    const prv = []; s2.docs[0].data.rady.forEach(rr => rr.prvky.forEach(x => prv.push(x)));
    const tr = prv.filter(x => x.p.kat === 'TR')[0];
    r.tr = tr ? [tr.vyvod, (tr.upoz || []).join(), tr.ozn].join('|') : '';
    __rzZR = null;
    return r;
  });
  check('nové kategorie TR -T, ZD -G, XS -XS, Ostatní -A a žádná předpona se neopakuje', tz.kat === 'TR-T,ZD-G,XS-XS,JINE-A' && !tz.oznKolize, tz.kat + ' / ' + tz.oznKolize);
  check('vestavěné: zvonkový 8/16 VA (2 M), bezpečnostní 25/63 VA (3 M), zdroje 30 W 2 M / 60 W 3 M / 15 W 1 M, zásuvka 16 A 3 M — obecné, Pv prázdné, neověřené',
    tz.vest === 'TR|2|8||false|obecný ; TR|2|16||false|obecný ; TR|3|25||false|obecný ; TR|3|63||false|obecný ; ZD|2|30||false|obecný ; ZD|3|60||false|obecný ; ZD|1|15||false|obecný ; XS|3|||false|obecný', tz.vest);
  check('staré vestavěné položky nové klíče nedostaly (beze změny)', !tz.stareKlice && tz.normStary);
  check('knihovna: tlačítko „Trafa a zdroje" ukáže transformátory a zdroje (7)', tz.trzd === 'TR,ZD|7', tz.trzd);
  check('vložení: označení -FA1, -T1, -G1, -XS1', tz.ozn === '-FA1,-T1,-G1,-XS1', tz.ozn);
  check('čelo: transformátor „230/8/12 V 16 VA", zdroj „24 V 60 W", zásuvka 16 A (i v čelním pohledu)', tz.celo === '230/8/12 V 16 VA ; 24 V 60 W ; zás. 16 A' && tz.svg, tz.celo);
  check('popisky pod přístroje: „8/12 V 16 VA", „24 V 60 W", „16 A"; název z údajů „Transformátor 230/12 V 16 VA"',
    tz.pop === '8/12 V 16 VA ; 24 V 60 W ; 16 A' && tz.nadr === 'Transformátor 230/12 V 16 VA / Napájecí zdroj 24 V DC 60 W', tz.pop + ' / ' + tz.nadr);
  check('seznam v PDF: transformátor s napětím a výkonem, zdroj, zásuvka', tz.pdf);
  check('vlastní přístroj nabízí transformátor, zdroj, zásuvku i ostatní; u zdroje výkon ve W, Pv celkem', tz.volby === 'TR,ZD,XS,JINE' &&
    /vykon,uVstup,uVystup,iVystup/.test(tz.poleZD) && /Výkon \(W\)/.test(tz.poleZD) && /Pv \(W celkem za přístroj\)/.test(tz.poleZD), tz.volby + ' / ' + tz.poleZD);
  check('„Ostatní": předpona označení, bez názvu se neuloží, předpona s mezerou/číslicí neprojde, pak uloženo',
    /,ozn,/.test(tz.poleJ) && /povinný název/.test(tz.chybaNazev) && /předpona označení/.test(tz.chybaPred) && tz.zavren && tz.jine === 'Stmívač|-RE|1|1.2|vlastni', tz.chybaNazev + ' / ' + tz.chybaPred + ' / ' + tz.jine);
  check('„Ostatní" s předponou -RE: označení -RE1, -RE2 a přečíslování předponu respektuje', tz.oznJ === '-RE1,-RE2' && tz.precisl === '-FA1,-T1,-G1,-XS1,-RE1,-RE2', tz.oznJ + ' / ' + tz.precisl);
  check('import CSV: trafo, napájecí zdroj, zásuvka, ostatní (výkon s VA/W, napětí jako text); ostatní bez názvu = chyba řádku',
    tz.imp1 === 'TR|16|230|12|| ; ZD|60|230|24 DC|2.5| ; XS|||||16 ; JINE|||||' && /6:.*povinný název/.test(tz.imp1chyby), tz.imp1 + ' / ' + tz.imp1chyby);
  check('import CSV bez nových sloupců projde beze změny; šablona má vykon;u_vstup;u_vystup;i_vystup za ue', tz.imp2 && /;ue;vykon;u_vstup;u_vystup;i_vystup;nastaveni;/.test(tz.sablona), tz.sablona.trim());
  check('zakreslení: „Zvonek" → návrh transformátoru, „LED pásek" → zdroj, „Lednice" ani „Zásuvky" ne; nabídka nezaškrtnutá',
    tz.navrhy === 'TR,ZD,-,-' && tz.navrhHtml === '2|false|true', tz.navrhy + ' / ' + tz.navrhHtml);
  check('zakreslení: bez potvrzení jen jističe; po potvrzení jistič zůstane a za ním transformátor / zdroj s upozorněním',
    tz.bez === 'FA,FA,FA,FA' && tz.s === 'FA,TR,FA,ZD,FA,FA' && /^Zvonek\|navrženo podle názvu obvodu/.test(tz.tr), tz.bez + ' → ' + tz.s + ' / ' + tz.tr);

  // ── orientace podle fotky: pruh výrobce, čísla pozic, předloha (2026-10-26) ──
  const fotkaCesta = require('path').join(__dirname, '_beh', 'rz-fotka.png');
  require('fs').mkdirSync(require('path').dirname(fotkaCesta), { recursive: true });
  require('fs').writeFileSync(fotkaCesta, Buffer.from(await p.evaluate(() => {   // vymyšlená „fotka" řady: 12 modulů po 60 px od x = 140
    const c = document.createElement('canvas'); c.width = 1000; c.height = 700; const g = c.getContext('2d');
    g.fillStyle = '#777'; g.fillRect(0, 0, 1000, 700); g.fillStyle = '#ddd'; g.fillRect(140, 330, 720, 40);
    for (let m = 0; m < 12; m++) { if (m === 5 || m === 6) continue; g.fillStyle = m < 3 ? '#e44' : '#fff'; g.fillRect(140 + m * 60 + 2, 250, 56, 200); }
    return c.toDataURL('image/png').split(',')[1];
  }), 'base64'));
  const ori = await p.evaluate(async () => {
    try { localStorage.removeItem('revize_el_rz_cisla'); } catch (e) {}
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
    const V = (kid, vyr, rada, r) => { const x = rozvVlozit(kid, r, __rz.rady[r].prvky.length); x.p.vyrobce = vyr; x.p.rada = rada; return x; };
    V('v-fa-1-B16', 'Hager', 'MY', 0); V('v-fa-1-B10', 'Hager', 'NF', 0); V('v-fa-1-B16', 'OEZ', 'LSN', 0); V('v-fa-1-C16', 'Eaton', 'PLS6', 0);
    V('v-fa-1-B16', 'Výrobce A', 'R1', 0); V('v-fa-1-B16', 'obecný', '', 0);
    rozvZmena('test', () => {}); __rz.vyber = null; rozvPohledVykreslit(); rozvVlastnostiVykreslit(); await __T.w(150);
    const gs = Array.from(document.querySelectorAll('#rz-svg-ram .rz-pr')).map(g => {
      const pr = g.querySelector('.rz-znacka-pruh'), t = g.querySelector('.rz-znacka-text');
      return { fill: pr && pr.getAttribute('fill'), t: t ? t.textContent : '', fs: t ? +t.getAttribute('font-size') : 0,
               tw: t ? t.getBBox().width : 0, pw: pr ? +pr.getAttribute('width') : 0, tit: (g.querySelector('title') || {}).textContent || '' };
    });
    // kontrast bílého textu na všech barvách tabulky
    const L = h => { const c = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const kon = Object.values(ROZV_ZNACKY).map(z => z.b).concat([ROZV_ZNACKA_SEDA]).map(b => 1.05 / (L(b) + 0.05));
    const ram = document.getElementById('rz-svg-ram'), cisla = Array.from(ram.querySelectorAll('.rz-cislo'));
    const r = { gs, konMin: Math.min.apply(null, kon), pocet: cisla.length, prvni2: cisla[12] && cisla[12].textContent,
                peCisla: getComputedStyle(ram.querySelector('.rz-cisla')).pointerEvents, data1: JSON.stringify([__rz.rady, __rz.skrin]) };
    // přepínač od 1 / průběžně
    const nast = document.querySelector('.rz-nast-pohledu'); r.nast = !!nast;
    const radio = nast.querySelector('input[value="rada"]'); radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); await __T.w(100);
    r.prvni2rada = document.querySelectorAll('#rz-svg-ram .rz-cislo')[12].textContent; r.ls = localStorage.getItem('revize_el_rz_cisla');
    r.data2 = JSON.stringify([__rz.rady, __rz.skrin]); r.dd = r.data1 === r.data2 ? '' : r.data1.slice(0, 300) + ' ≠ ' + r.data2.slice(0, 300);
    const r2 = document.querySelector('.rz-nast-pohledu input[value="prubezne"]'); r2.checked = true; r2.dispatchEvent(new Event('change', { bubbles: true })); await __T.w(100);
    // úzký pohled (oddálení): každé druhé číslo
    r.malo = (rozvCislaPozicSvg(0, 12, 12, 0.6).match(/rz-cislo/g) || []).length; r.dost = (rozvCislaPozicSvg(0, 12, 12, 2.3).match(/rz-cislo/g) || []).length;
    return r;
  });
  const hg = ori.gs[0], oez = ori.gs[2];
  check('pruh výrobce: 1modulový Hager MY nese „hager MY" na modré, text se vejde do pruhu a písmo ≥ 2,6 mm (čitelné)',
    hg.t === 'hager MY' && hg.fill === '#1f5e99' && hg.tw > 0 && hg.tw <= hg.pw && hg.fs >= 2.6, JSON.stringify(hg));
  check('pruh výrobce: Hager NF, OEZ LSN (červená), Eaton PLS6 — každý výrobce svou barvou, řada v textu',
    ori.gs[1].t === 'hager NF' && oez.t === 'OEZ LSN' && oez.fill === '#9b2c2c' && ori.gs[3].t === 'Eaton PLS6' && ori.gs[3].fill !== hg.fill && ori.gs[3].tw <= ori.gs[3].pw,
    ori.gs.map(g => g.t + ' ' + g.fill).join(' | '));
  check('pruh výrobce: neznámý výrobce šedě se jménem, obecný šedě bez textu; celý název v bublině',
    ori.gs[4].fill === '#6e6e6e' && /^Výrobce A/.test(ori.gs[4].t) && /Výrobce A R1/.test(ori.gs[4].tit) && ori.gs[5].fill === '#6e6e6e' && ori.gs[5].t === '' && /Hager MY/.test(hg.tit), ori.gs[4].t + ' / ' + hg.tit);
  check('pruh výrobce: bílý text má na každé barvě kontrast ≥ 4,5 : 1', ori.konMin >= 4.5, ori.konMin.toFixed(2));
  check('čísla pozic: 36 čísel nad třemi řadami, průběžně (2. řada od 13), klik propadne (pointer-events none)',
    ori.pocet === 36 && ori.prvni2 === '13' && ori.peCisla === 'none', ori.pocet + ' / ' + ori.prvni2 + ' / ' + ori.peCisla);
  check('čísla pozic: volba „každou řadu od 1" (2. řada od 1), pamatuje se jen v prohlížeči, data rozvaděče beze změny a nic k uložení',
    ori.nast && ori.prvni2rada === '1' && ori.ls === 'rada' && ori.data1 === ori.data2, ori.prvni2rada + ' / ' + ori.ls + ' ' + ori.dd);
  check('čísla pozic: při malém měřítku jen každé druhé (6 z 12), jinak všechna', ori.malo === 6 && ori.dost === 12, ori.malo + ' / ' + ori.dost);
  // klik na číslo skutečnou myší: nic nevybere, rámeček se neposune
  await p.evaluate(async () => { __rz.zoom = 2.5; rozvPohledVykreslit(); await __T.w(100); const r = document.getElementById('rz-svg-ram'); r.scrollLeft = 120; await __T.w(50); });
  const cil = await p.evaluate(() => { const t = Array.from(document.querySelectorAll('#rz-svg-ram .rz-cislo')).filter(e => { const b = e.getBoundingClientRect(), rb = document.getElementById('rz-svg-ram').getBoundingClientRect(); return b.left > rb.left && b.right < rb.right && b.top > rb.top; })[2];
    const b = t.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, sl: document.getElementById('rz-svg-ram').scrollLeft, n: t.textContent,
      pod: (document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) || {}).className.baseVal || '' }; });
  await p.mouse.click(cil.x, cil.y); await w(200);
  const poKliku = await p.evaluate(() => ({ vyber: __rz.vyber, vic: (__rz.vic || []).length, sl: document.getElementById('rz-svg-ram').scrollLeft }));
  check('klik na číslo pozice: nevybere přístroj a scrollLeft rámečku se nezmění', !poKliku.vyber && !poKliku.vic && poKliku.sl === cil.sl && !/rz-cislo/.test(cil.pod),
    'číslo ' + cil.n + ' · pod ním ' + cil.pod + ' · ' + JSON.stringify(poKliku) + ' / ' + cil.sl);
  await p.evaluate(async () => { __rz.zoom = 1; rozvPohledVykreslit(); await dokUlozitOtevreny(); });

  // předloha z fotky: nahrání, ořez rohy skutečnou myší, použití
  await p.click('[data-action="tdRzpOtevrit"]'); await w(200);
  await p.selectOption('#rzp-rada', '0');
  await p.setInputFiles('#rzp-soubor', fotkaCesta); await w(600);
  const cv = await p.$eval('#rzp-canvas', c => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, k: r.width / 1000 }; });
  const roh = async (sel, fx, fy) => {
    const h = await p.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const c = { x: cv.x + fx * cv.k, y: cv.y + fy * cv.k };
    await p.mouse.move(h.x, h.y); await p.mouse.down(); await p.mouse.move((h.x + c.x) / 2, (h.y + c.y) / 2, { steps: 4 }); await p.mouse.move(c.x, c.y, { steps: 4 }); await p.mouse.up();
  };
  await roh('.rzp-h[data-roh="tl"]', 140, 240); await roh('.rzp-h[data-roh="br"]', 860, 460);
  const orez = await p.evaluate(() => ({ f: __rzp.f, mrizka: document.getElementById('rzp-ram').style.backgroundSize, zac: !!document.querySelector('.rzp-zac'), kon: !!document.querySelector('.rzp-kon') }));
  check('předloha: fotka se načte, rohy obdélníku jdou táhnout myší na začátek a konec řady, uvnitř mřížka 12 modulů',
    Math.abs(orez.f.x - 0.14) < 0.01 && Math.abs(orez.f.x + orez.f.w - 0.86) < 0.01 && Math.abs(orez.f.y - 240 / 700) < 0.02 && /8\.33/.test(orez.mrizka) && orez.zac && orez.kon, JSON.stringify(orez));
  // otočení a narovnání se dá použít a zase vrátit
  await p.evaluate(async () => {
    const u = document.getElementById('rzp-uhel'); u.value = 4; u.dispatchEvent(new Event('input', { bubbles: true })); await __T.w(150);
    window.__rotW = __rzp.rc.width; u.value = 0; u.dispatchEvent(new Event('input', { bubbles: true })); await __T.w(150);
  });
  const rot = await p.evaluate(() => ({ s4: window.__rotW, s0: __rzp.rc.width }));
  check('předloha: narovnání (±10°) otočí plátno, návrat na 0° vrátí rozměr', rot.s4 > rot.s0 && rot.s0 === 1000, JSON.stringify(rot));
  await p.click('#rzp-pouzit'); await w(700);
  const pre = await p.evaluate(async () => {
    const im = document.querySelector('#rz-svg-ram image.rz-predloha'), v = await idbGet('dok_rzPredlohy'), uid = window.__dokOtevreny.uid, rec = v && v[uid] && v[uid][0];
    const dok = JSON.stringify(dokNajit(uid) || {}), ls = localStorage.getItem(DOK_LS) || '';
    return { im: im && [im.getAttribute('x'), im.getAttribute('width'), im.getAttribute('opacity'), im.getAttribute('pointer-events')].join(), modal: document.getElementById('modal-rz-predloha').classList.contains('open'),
             rec: rec && { jpeg: /^data:image\/jpeg/.test(rec.src), w: rec.w, h: rec.h }, vDok: /data:image/.test(dok) || /rzPredloh/.test(dok), vLs: /data:image/.test(ls), lista: !!document.querySelector('.rz-predloha-r') };
  });
  check('předloha: přes řadu 1 ve stejné šířce jako řada (x = 14 mm, 12 × 17,5 mm), poloprůhledná, klik propadá',
    pre.im === '14,210,0.5,none' && !pre.modal && pre.lista, pre.im);
  check('předloha: uložená JPEG ≤ 1600 px v IndexedDB (dok_rzPredlohy), NE v datech rozvaděče ani v localStorage kopii',
    pre.rec && pre.rec.jpeg && pre.rec.w <= 1600 && pre.rec.w > 300 && !pre.vDok && !pre.vLs, JSON.stringify(pre));
  // přístroje jdou dál vybírat klepnutím přes předlohu
  const prKlik = await p.evaluate(() => { const g = document.querySelector('#rz-svg-ram .rz-pr[data-puid]'), b = g.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height * 0.7, uid: g.getAttribute('data-puid') }; });
  await p.mouse.click(prKlik.x, prKlik.y); await w(200);
  check('předloha: přístroj pod fotkou jde dál vybrat myší', await p.evaluate(u => __rz.vyber === u, prKlik.uid));
  // průhlednost, skrýt
  const ovl = await p.evaluate(async () => {
    const r = document.querySelector('.rzp-op'); r.value = 80; r.dispatchEvent(new Event('input', { bubbles: true })); await __T.w(500);
    const op = document.querySelector('#rz-svg-ram image.rz-predloha').getAttribute('opacity');
    TD_AKCE.tdRzpSkryt(document.querySelector('[data-action="tdRzpSkryt"]')); await __T.w(100);
    const skr = !document.querySelector('#rz-svg-ram image.rz-predloha');
    TD_AKCE.tdRzpSkryt(document.querySelector('[data-action="tdRzpSkryt"]')); await __T.w(100);
    return { op, skr, zpet: !!document.querySelector('#rz-svg-ram image.rz-predloha') };
  });
  check('předloha: posuvník průhlednosti (80 % → opacity 0,2), Skrýt / Ukázat', ovl.op === '0.2' && ovl.skr && ovl.zpet, JSON.stringify(ovl));
  // PDF a tisk: bez čísel a bez fotky, pruh výrobce ano
  const pdfOri = await p.evaluate(async () => {
    window.__dokOtevreny.data.dokVyber = { cp: true, schema: true, tech: false, prohl: false, ko: false };
    await dokNahled(); await __T.w(700);
    const h = document.getElementById('dok-pdf-pages').innerHTML;
    const sch = rozvSchemaListy(DOK_TYPY.rozv.cist(dokForm())).map(l => l.svg).join('');
    const r = { cislo: /rz-cislo/.test(h), foto: /<image|rz-predloha|blob:|data:image\/jpeg/.test(h), pruh: /hager MY/.test(h), schCislo: /rz-cislo|<image/.test(sch) };
    TD_AKCE.tdPdfZpet(); await __T.w(200);
    return r;
  });
  check('PDF a tisk: čelní pohled bez čísel pozic a bez fotky předlohy, pruh se značkou ano; schéma bez čísel i fotky',
    !pdfOri.cislo && !pdfOri.foto && pdfOri.pruh && !pdfOri.schCislo, JSON.stringify(pdfOri));
  // záloha: výchozí bez fotek, se zaškrtnutím s nimi
  const zal = await p.evaluate(async () => {
    const bez = await buildZalohaBlob().text();
    const stary = { a: STORE.last_backup_at, b: STORE.archiv_count_at_last_backup };   // export zapíše čas zálohy — po testu vrátit
    let s = null; const puv = window.ulozitSoubor; window.ulozitSoubor = async b => { s = await b.text(); };
    const ch = document.getElementById('zaloha-predlohy'); ch.checked = true; await exportDatabaze(); await __T.w(300); ch.checked = false; window.ulozitSoubor = puv;
    if (stary.a === undefined) delete STORE.last_backup_at; else STORE.last_backup_at = stary.a;
    if (stary.b === undefined) delete STORE.archiv_count_at_last_backup; else STORE.archiv_count_at_last_backup = stary.b;
    saveStore(); renderZalohaStatus();
    const j = JSON.parse(s);
    return { bez: /rzPredlohy|data:image\/jpeg/.test(bez), s: !!(j.rzPredlohy && j.rzPredlohy[window.__dokOtevreny.uid]), vychozi: document.getElementById('zaloha-predlohy').defaultChecked };
  });
  check('záloha: výchozí bez fotek předloh; zaškrtnutím „Přiložit i fotky předloh" jdou do souboru', !zal.bez && zal.s && !zal.vychozi, JSON.stringify(zal));
  // obnovení po znovunačtení
  const uidPre = await p.evaluate(() => window.__dokOtevreny.uid);
  await p.reload(); await w(1300); await p.evaluate(pomocnik);
  const obn = await p.evaluate(async u => { await dokOtevrit(u); await __T.w(600); const im = document.querySelector('#rz-svg-ram image.rz-predloha');
    return { im: !!im, op: im && im.getAttribute('opacity'), pruh: !!document.querySelector('.rz-znacka-text') }; }, uidPre);
  check('předloha: po znovunačtení stránky se obnoví i s průhledností', obn.im && obn.op === '0.2' && obn.pruh, JSON.stringify(obn));
  // úložiště plné: srozumitelná hláška, nic nespadne, předloha se nepřidá
  const plno = await p.evaluate(async () => {
    const rr0 = rzpPro(window.__dokOtevreny.uid); if (!rr0 || !rr0[0]) return { hl: 'CHYBÍ předloha: ' + JSON.stringify(rr0 && Object.keys(rr0)) };
    const puv = idb; let hl = '';
    const puvAlert = window.alert; window.alert = m => { hl = m; };
    idb = { transaction() { throw new DOMException('plno', 'QuotaExceededError'); } };
    rzpOtevrit(1, rr0[0].src);
    await __T.w(500); await TD_AKCE.tdRzpPouzit(); idb = puv; window.alert = puvAlert;
    const r = { hl, rada2: !!(__rzpVse[window.__dokOtevreny.uid] || {})[1], otevreno: document.getElementById('modal-rz-predloha').classList.contains('open') };
    TD_AKCE.tdRzpZavrit(); return r;
  });
  check('předloha: když se do úložiště nevejde — hláška „nevešla", nic nespadne a předloha se nepřidá', /nevešla/.test(plno.hl) && !plno.rada2 && plno.otevreno, JSON.stringify(plno));
  // smazání se ZPĚT
  const sm = await p.evaluate(async () => {
    TD_AKCE.tdRzpSmazat(document.querySelector('[data-action="tdRzpSmazat"]')); await __T.w(200);
    const bez = !document.querySelector('#rz-svg-ram image.rz-predloha'), v = await idbGet('dok_rzPredlohy');
    return { bez, idb: !!(v && v[window.__dokOtevreny.uid]) };
  });
  check('předloha: 🗑 Smazat ji odebere z pohledu i z úložiště', sm.bez && !sm.idb, JSON.stringify(sm));
  // pole kabelu jde přepsat vlastním textem (připomínka uživatele 2026-10-26)
  await p.evaluate(async () => { const x = __rz.rady[0].prvky[0]; x.kabel = 'CYKY-J'; __rz.vyber = x.uid; rozvVlastnostiVykreslit(); await __T.w(100); });
  await p.click('#rz-vlastnosti [data-rp2="kabel"]'); await w(100);
  const kab1 = await p.$eval('#rz-vlastnosti [data-rp2="kabel"]', e => ({ v: e.value, oz: e.selectionEnd - e.selectionStart }));
  await p.keyboard.type('rezerva'); await w(150);
  const kab2 = await p.evaluate(() => __rz.rady[0].prvky[0].kabel);
  check('vývodový kabel: klepnutím se pole nevyprázdní (jen označí) a jde přepsat vlastním textem „rezerva"', kab1.v === 'CYKY-J' && kab1.oz === 6 && kab2 === 'rezerva',
    JSON.stringify(kab1) + ' → ' + kab2);

  // ── čelní pohled na šířku okna (připomínka 2026-10-27) ──────────────────
  const sir = await p.evaluate(async () => {
    const info = () => { const r = document.getElementById('rz-svg-ram'); return { cw: r.clientWidth, sw: r.scrollWidth, k: r.__k, rucni: __rz.kRucni || null,
      btn: (document.querySelector('[data-action="tdRNaSirku"]') || {}).getAttribute && document.querySelector('[data-action="tdRNaSirku"]').getAttribute('aria-pressed') }; };
    const r = {};
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n')); await __T.w(200); r.a = info();
    return r;
  });
  await p.setViewportSize({ width: 1920, height: 1000 }); await w(500);
  const sir2 = await p.evaluate(async () => {
    const info = () => { const r = document.getElementById('rz-svg-ram'); return { cw: r.clientWidth, sw: r.scrollWidth, k: r.__k, rucni: __rz.kRucni || null }; };
    const r = { a1920: info() };
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-4x24-ocel')); await __T.w(250); r.b1920 = info();
    TD_AKCE.tdRZoom(document.querySelector('[data-action="tdRZoom"][data-z="+"]')); await __T.w(150); r.zoom = info();
    return r;
  });
  await p.setViewportSize({ width: 1366, height: 900 }); await w(500);
  const sir3 = await p.evaluate(async () => {
    const info = () => { const r = document.getElementById('rz-svg-ram'); return { cw: r.clientWidth, sw: r.scrollWidth, k: r.__k, rucni: __rz.kRucni || null }; };
    const r = { drzi: info() };
    TD_AKCE.tdRNaSirku(); await __T.w(150); r.auto1366 = info();
    r.pressed = document.querySelector('[data-action="tdRNaSirku"]').getAttribute('aria-pressed');
    return r;
  });
  check('na šířku okna: výchozí stav (tlačítko „⇔ Na šířku okna" zapnuté), ruční měřítko není', sir.a.btn === 'true' && !sir.a.rucni, JSON.stringify(sir.a));
  check('na šířku okna 1920 px: 3×12 i 4×24 bez vodorovného posuvníku a rámeček široký (> 1100 px)',
    sir2.a1920.sw <= sir2.a1920.cw && sir2.b1920.sw <= sir2.b1920.cw && sir2.a1920.cw > 1100 && sir2.b1920.k > 2.3, JSON.stringify([sir2.a1920, sir2.b1920]));
  check('po změně okna se měřítko přepočítá (3×12 na 1366 px menší než na 1920 px)', sir2.a1920.k > sir.a.k, sir.a.k + ' → ' + sir2.a1920.k);
  check('ruční ＋ drží měřítko i po změně velikosti okna; „Na šířku okna" ho zruší (4×24 na 1366 px: nejmenší čitelné, posuvník smí zůstat)',
    sir2.zoom.rucni && Math.abs(sir3.drzi.k - sir2.zoom.k) < 1e-6 && !sir3.auto1366.rucni && sir3.auto1366.k === 2.3 && sir3.pressed === 'true', JSON.stringify([sir2.zoom, sir3]));

  // ── přepínač barev: výrobce | ampéráž (2026-10-27) ──────────────────────
  const amp = await p.evaluate(async () => {
    try { localStorage.removeItem('revize_el_rz_barvy'); } catch (e) {}
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
    const V = (kid, In, r) => { const x = rozvVlozit(kid, r, __rz.rady[r].prvky.length); if (In != null) x.p.In = In; x.p.vyrobce = 'OEZ'; x.p.rada = 'LSN'; return x; };
    [1, 2, 4, 6, 8, 10].forEach(i => V('v-fa-1-B16', i, 0)); [13, 16, 20, 25, 32, 40].forEach(i => V('v-fa-1-B16', i, 1));
    [50, 63, 3].forEach(i => V('v-fa-1-B16', i, 2)); V('v-spd-12-1N', null, 2);
    rozvZmena('test', () => {}); __rz.vyber = null; rozvPohledVykreslit(); await __T.w(100);
    const r = { vychozi: rozvBarvyRezim(), vyrobceText: (document.querySelector('#rz-svg-ram .rz-znacka-text') || {}).textContent };
    document.querySelector('[data-action="tdRBarvy"][data-r="proud"]').click(); await __T.w(150);
    const g = Array.from(document.querySelectorAll('#rz-svg-ram .rz-pr')).map(e => { const pr = e.querySelector('.rz-znacka-pruh'), t = e.querySelector('.rz-znacka-text');
      return { fill: pr && pr.getAttribute('fill'), nazev: pr && pr.getAttribute('data-amp'), t: t ? t.textContent : '', tf: t ? t.getAttribute('fill') : '', obrys: pr && pr.getAttribute('stroke') }; });
    r.g = g; r.ls = localStorage.getItem('revize_el_rz_barvy');
    r.data = JSON.stringify(__rz.rady).includes('barv');
    r.leg = document.querySelectorAll('.rz-barvy-leg .rz-leg-r').length;
    window.__dokOtevreny.data.dokVyber = { cp: true, schema: false, tech: false, prohl: false, ko: false };
    await dokNahled(); await __T.w(600);
    const h = document.getElementById('dok-pdf-pages').innerHTML;
    r.pdfProud = /data-amp="písková"/.test(h) && />13 A</.test(h);
    TD_AKCE.tdPdfZpet(); await __T.w(150);
    document.querySelector('[data-action="tdRBarvy"][data-r="vyrobce"]').click(); await __T.w(100);
    await dokNahled(); await __T.w(600);
    const h2 = document.getElementById('dok-pdf-pages').innerHTML;
    r.pdfVyrobce = !/data-amp=/.test(h2) && /OEZ LSN/.test(h2);
    TD_AKCE.tdPdfZpet(); await __T.w(150);
    return r;
  });
  const ag = amp.g, A = i => ag[i] || {};
  check('barvy: výchozí „výrobce" (pruh OEZ LSN), přepínač „ampéráž" se pamatuje jen v prohlížeči, data rozvaděče beze změny',
    amp.vychozi === 'vyrobce' && amp.vyrobceText === 'OEZ LSN' && amp.ls === 'proud' && !amp.data, JSON.stringify([amp.vychozi, amp.vyrobceText, amp.ls]));
  check('barvy podle In: 1 A černá, 2 růžová, 4 hnědá, 6 zelená, 8 světle zelená, 10 červená, 13 písková, 16 šedá, 20 modrá, 25 žlutá, 32 fialová, 40 černá, 50 bílá, 63 měděná',
    ag.slice(0, 14).map(x => x.nazev).join() === 'černá,růžová,hnědá,zelená,světle zelená,červená,písková,šedá,modrá,žlutá,fialová,černá,bílá,měděná' &&
    A(6).fill === '#d9c28d' && A(6).t === '13 A', ag.map(x => x.nazev + ' ' + x.fill).join(' | '));
  check('barvy podle In: In je v pruhu textem (čitelné i černobíle), bílá s rámečkem a tmavým textem, černá se světlým textem',
    A(12).obrys && A(12).tf === '#111' && A(0).tf === '#fff' && A(11).t === '40 A', JSON.stringify([A(0), A(11), A(12)]));
  check('barvy podle In: 3 A (bez kódu) šedá s textem, SPD bez In šedá bez textu; legenda ⓘ má všechny barvy',
    A(14).nazev === 'bez barevného kódu' && A(14).t === '3 A' && A(15).nazev === 'bez In' && A(15).t === '' && amp.leg === 18, JSON.stringify([A(14), A(15), amp.leg]));
  check('barvy: do PDF jde právě zapnutý režim (ampéráž → písková 13 A, výrobce → OEZ LSN)', amp.pdfProud && amp.pdfVyrobce);

  // ── vypínače: -QH hlavní, -Q ostatní (2026-10-27) ──────────────────────
  const qh = await p.evaluate(async () => {
    const r = {};
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
    const a = rozvVlozit('v-qm-3-63', 0, 0), b = rozvVlozit('v-qm-1-32', 1, 0), c = rozvVlozit('v-qm-1-32', 1, 1);
    r.auto = [a.ozn, b.ozn, c.ozn].join(); r.hl = rozvJeHlavni(rozvNajit(a.uid).x);
    __rz.vyber = b.uid; rozvVlastnostiVykreslit();
    const ch = document.querySelector('#rz-vlastnosti [data-rp2="hlavni"]'); r.chVid = !!ch && !ch.checked;
    ch.checked = true; ch.dispatchEvent(new Event('input', { bubbles: true })); await __T.w(100);
    r.dva = __rz.rady.map(rr => rr.prvky.map(x => x.ozn).join(',')).join(' / ');
    TD_AKCE.tdRPrecislovat(); await __T.w(100);
    r.prec = __rz.rady.map(rr => rr.prvky.map(x => x.ozn).join(',')).join(' / ');
    // starý rozvaděč s -QM1: otevření ho nezmění, nabídne se přečíslování
    await dokUlozitOtevreny();
    const uid = window.__dokOtevreny.uid, dok = dokNajit(uid);
    dok.data.rady[0].prvky[0].ozn = '-QM1'; dok.data.rady[1].prvky.forEach((x, i) => { x.ozn = '-QM' + (i + 2); delete x.hlavni; }); delete dok.data.rady[0].prvky[0].hlavni;
    await dokZapsat(); const pred = JSON.stringify(dokNajit(uid).data);
    await dokOtevrit(uid); await __T.w(300);
    r.stare = __rz.rady.map(rr => rr.prvky.map(x => x.ozn).join(',')).join(' / ');
    r.upoz = (document.querySelector('.rz-qm-upoz') || {}).innerText || '';
    await dokUlozitOtevreny(); await __T.w(100);
    r.beze = JSON.stringify(dokNajit(uid).data) === pred && window.__dokOtevreny.ulozen !== false;
    TD_AKCE.tdRQmPrecislovat(); await __T.w(100);
    r.qmPrec = __rz.rady.map(rr => rr.prvky.map(x => x.ozn).join(',')).join(' / ');
    r.upozPo = !!document.querySelector('.rz-qm-upoz');
    // „Nechat" schová nabídku natrvalo pro tento rozvaděč
    __rz.rady[0].prvky[0].ozn = '-QM1'; rozvPohledVykreslit();
    TD_AKCE.tdRQmNechat(); r.nechat = !document.querySelector('.rz-qm-upoz');
    r.kat = rozvKat('QM').nazev;
    return r;
  });
  check('vypínače: první je automaticky hlavní -QH1, další vypínače -Q1, -Q2', qh.auto === '-QH1,-Q1,-Q2' && qh.hl, qh.auto);
  check('vypínače: zaškrtávátko „Hlavní vypínač" ve vlastnostech → dva hlavní -QH1, -QH2 (ostatní -Q zůstane)', qh.chVid && qh.dva === '-QH1 / -QH2,-Q2 / ', qh.dva);
  check('vypínače: „Přečíslovat označení" čísluje podle role', qh.prec === '-QH1 / -QH2,-Q1 / ', qh.prec);
  check('vypínače: starý rozvaděč s -QM1 se otevřením nezmění a nabídne „Přečíslovat na QH/Q?"',
    qh.stare === '-QM1 / -QM2,-QM3 / ' && qh.beze && /starší značení vypínačů \(QM\)/.test(qh.upoz), qh.stare + ' | ' + qh.upoz);
  check('vypínače: „Přečíslovat vypínače" → hlavní -QH, ostatní -Q, nabídka zmizí; „Nechat" ji schová; kategorie „Vypínač / odpínač"',
    qh.qmPrec === '-QH1 / -Q1,-Q2 / ' && !qh.upozPo && qh.nechat && qh.kat === 'Vypínač / odpínač', qh.qmPrec);

  // ── typ obvodu a značka zásuvky ve schématu (2026-10-27) ───────────────
  const zas = await p.evaluate(async () => {
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
    const V = (kid, vyvod, faze) => { const x = rozvVlozit(kid, 0, __rz.rady[0].prvky.length); x.vyvod = vyvod; if (faze) x.faze = faze; x.kabel = 'CYKY-J'; x.prurez = '3×2,5'; return x; };
    V('v-fa-1-B16', 'Zásuvky kuchyň', 'L1'); V('v-fa-1-B10', 'Osvětlení obývák', 'L2'); V('v-fa-3-B16', 'Zásuvka 400 V dílna'); const b = V('v-fa-1-B16', 'Bojler', 'L3');
    rozvZmena('test', () => {}); await __T.w(100);
    const d = DOK_TYPY.rozv.cist(dokForm()), svg = rozvSchemaListy(d).map(l => l.svg).join('');
    const r = { zas: (svg.match(/data-znacka="zasuvka"/g) || []).length, svet: (svg.match(/data-znacka="svetlo"/g) || []).length, tri: /3\/N\/PE/.test(svg),
                ulozeno: __rz.rady[0].prvky.map(x => x.spotr || '').join() };
    __rz.vyber = b.uid; rozvVlastnostiVykreslit();
    const sel = document.querySelector('#rz-vlastnosti [data-rp2="spotr"]');
    r.label = sel.closest('.f').querySelector('label').textContent; r.volby = Array.from(sel.options).map(o => o.textContent).join('|');
    window.__dokOtevreny.data.dokVyber = { cp: false, schema: true, tech: false, prohl: false, ko: false };
    await dokNahled(); await __T.w(700);
    r.pdf = (document.getElementById('dok-pdf-pages').innerHTML.match(/data-znacka="zasuvka"/g) || []).length;
    TD_AKCE.tdPdfZpet(); await __T.w(150);
    return r;
  });
  check('typ obvodu: pole „Typ obvodu" (podle názvu / zásuvky / světla / spotřebič / motor / jiný), odhad z názvu se neukládá',
    zas.label === 'Typ obvodu' && zas.volby === 'podle názvu (jiný)|zásuvky|světla|spotřebič|motor|jiný' && zas.ulozeno === ',,,', JSON.stringify(zas));
  check('schéma: zásuvkové vývody končí značkou zásuvky (2×), trojfázová s „3/N/PE", osvětlení svítidlem', zas.zas === 2 && zas.tri && zas.svet === 1, JSON.stringify(zas));
  check('schéma v PDF: značky zásuvek jsou i v listech PDF', zas.pdf === 2, zas.pdf);

  // ── průběžný odhad oteplení v liště (2026-10-27) ──────────────────────
  const ot = await p.evaluate(async () => {
    const st = async () => { await __T.w(200); const e = document.getElementById('rz-otepl-ukaz'); return { hid: e.hidden, c: e.className, t: e.textContent, tit: e.title }; };
    const r = {};
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
    for (let i = 0; i < 6; i++) { const x = rozvVlozit('v-fa-1-B16', 0, __rz.rady[0].prvky.length); x.p.pv = 2.5; x.ib = 12; }
    rozvVlozit('v-fa-1-B16', 1, 0); rozvZmena('t', () => {});
    r.bez = await st();
    const v = rozvOteplVypocet(DOK_TYPY.rozv.cist(dokForm()));
    r.celkem = v.celkem;
    for (const pen of [60, 15, 10]) { __rz.skrin.penc = pen; rozvZmena('p', () => {}); r['p' + pen] = await st(); }
    // klik → podrobný výpočet (Dokumenty, oddíl oteplení); celkem sedí s listem
    document.getElementById('rz-otepl-ukaz').click(); await __T.w(400);
    const od = document.querySelector('#rz-pan-dok [data-oddil="otepleni"]');
    r.list = od && od.open && !document.getElementById('rz-pan-dok').hidden ? od.querySelector('.rot-souc').textContent : '';
    rozvZalozkaNastavit('navrh'); await __T.w(100);
    // živě: smazání přístroje sníží odhad
    rozvSmazat(__rz.rady[0].prvky[0].uid); r.poSmazani = await st();
    // knihovna skříní: značka ≈ % u skříně s Penc
    DOK.rozvKnihovna.push(rozvPolozkaNorm({ nazev: 'Testovací skříň s Penc', rady: 3, modulu: 12, penc: 20 }, 'skrin'));
    document.querySelector('.rz-tab[data-tab="skrine"]').click(); await __T.w(200);
    r.knih = Array.from(document.querySelectorAll('.rz-otepl-knih')).map(e => e.textContent).join();
    DOK.rozvKnihovna.pop(); document.querySelector('.rz-tab[data-tab="pristroje"]').click();
    window.__dokOtevreny.data.dokVyber = { cp: true, schema: false, tech: false, prohl: false, ko: false };
    await dokNahled(); await __T.w(500);
    r.pdf = /Oteplení ≈|rz-otepl/.test(document.getElementById('dok-pdf-pages').innerHTML);
    TD_AKCE.tdPdfZpet(); await __T.w(150);
    return r;
  });
  const cel = t => (/≈ (\d+) \/ (\d+) W \((\d+) %\)/.exec(t) || []).slice(1).join('/');
  check('oteplení v liště: bez Penc šedě „skříň nemá Penc – doplnit", přístroj bez Pv se jmenuje (1 přístroj bez Pv)',
    !ot.bez.hid && /bezPenc/.test(ot.bez.c) && /skříň nemá Penc – doplnit/.test(ot.bez.t) && /\(1 přístroj bez Pv\)/.test(ot.bez.t) && /závazný je list Výpočet oteplení/.test(ot.bez.tit), JSON.stringify(ot.bez));
  check('oteplení v liště: zelená < 80 %, oranžová 80–100 %, červená > 100 % (Penc 60 / 15 / 10 W)',
    /zelena/.test(ot.p60.c) && /oranzova/.test(ot.p15.c) && /cervena/.test(ot.p10.c) && cel(ot.p60.t) === '13/60/21' && cel(ot.p10.t) === '13/10/127', [ot.p60.t, ot.p15.t, ot.p10.t].join(' | '));
  check('oteplení v liště = list „Výpočet oteplení" (stejná funkce); klik otevře podrobný výpočet', Math.round(ot.celkem) === 13 && /= 12,7 W/.test(ot.list), ot.list);
  check('oteplení v liště se přepočítá při smazání přístroje; do PDF nejde', /≈ 11 \//.test(ot.poSmazani.t) && !ot.pdf, ot.poSmazani.t);
  check('knihovna skříní: u skříně s Penc odhad „≈ 53 %" (s vloženými přístroji)', ot.knih === '≈ 53 %', ot.knih);

  // ── odhad instalovaného příkonu Pi (2026-10-27) ───────────────────────
  const pi = await p.evaluate(async () => {
    const r = {}, inp = (sel, v) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
    const vysl = () => (document.getElementById('rz-pi-vysl') || {}).textContent || '';
    const tl = () => document.getElementById('rz-pi-pouzit');
    const otevri = async uid => { __rz.vyber = uid; rozvVlastnostiVykreslit(); document.querySelector('#rz-vlastnosti [data-action="tdRPiOdhad"]').click(); await __T.w(100); };
    try { localStorage.removeItem('revize_el_rz_pi'); } catch (e) {}
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
    const V = (kid, vyvod) => { const x = rozvVlozit(kid, 0, __rz.rady[0].prvky.length); x.vyvod = vyvod; x.faze = 'L1'; return x; };
    const a = V('v-fa-1-B16', 'Zásuvky kuchyň'), b = V('v-fa-1-B16', 'Kuchyň – sporák'), m = V('v-fa-3-B16', 'Kompresor'), c = V('v-fa-1-B10', 'Osvětlení');
    rozvZmena('t', () => {}); await __T.w(100);
    // zásuvky: 8 × 0,2 kW = 1,6 kW
    await otevri(a.uid);
    r.typ = document.querySelector('#rz-pi-obsah [data-pi="typ"]').value; r.prikon = document.querySelector('#rz-pi-obsah [data-pi="prikon"]').value;
    r.tlPred = tl().disabled;
    inp('#rz-pi-obsah [data-pi="n"]', '8'); r.vysl = vysl(); r.tlPo = tl().disabled;
    tl().click(); await __T.w(150);
    let y = rozvNajit(a.uid).x; r.pi = y.pi; r.odhad = y.piOdhad;
    __rz.vyber = a.uid; rozvVlastnostiVykreslit();
    let st = document.querySelector('#rz-vlastnosti .rz-pi-odhad'); r.stitek = !st.hidden && st.textContent === 'odhad' && st.title;
    r.pole = document.querySelector('#rz-vlastnosti [data-rp2="pi"]').value;
    r.cist = (DOK_TYPY.rozv.cist(dokForm()).rady[0].prvky.filter(q => q.uid === a.uid)[0] || {}).piOdhad;
    // schéma: ≈ u odhadu a vysvětlivka
    let svg = rozvSchemaListy(DOK_TYPY.rozv.cist(dokForm())).map(l => l.svg).join('');
    r.schOdhad = />≈1,6</.test(svg) && /≈ = odhad instalovaného příkonu/.test(svg);
    // ruční přepsání štítek zruší
    inp('#rz-vlastnosti [data-rp2="pi"]', '1,8'); await __T.w(100);
    y = rozvNajit(a.uid).x; st = document.querySelector('#rz-vlastnosti .rz-pi-odhad');
    r.rucne = y.pi === '1,8' && !('piOdhad' in y) && st.hidden;
    svg = rozvSchemaListy(DOK_TYPY.rozv.cist(dokForm())).map(l => l.svg).join('');
    r.schRucne = />1,8</.test(svg) && !/≈1,8/.test(svg) && !/≈ = odhad/.test(svg);
    // ruční hodnotu odhad nepřepíše
    await otevri(a.uid); inp('#rz-pi-obsah [data-pi="n"]', '10');
    r.blok = tl().disabled && /ručně zadaná hodnota/.test(document.getElementById('rz-pi-obsah').textContent);
    TD_AKCE.tdRPiPouzit(); await __T.w(100); r.blokPi = rozvNajit(a.uid).x.pi;
    TD_AKCE.tdRPiZavrit();
    // spotřebič: rychlé volby, sporák 9 kW, TČ zadat
    b.spotr = 'spotrebic'; await otevri(b.uid);
    r.volby = Array.from(document.querySelectorAll('.rz-pi-volba')).map(e => e.textContent).join('|');
    document.querySelector('.rz-pi-volba[data-v="tc"]').click(); await __T.w(50);
    r.tc = document.querySelector('#rz-pi-obsah [data-pi="prikon"]').value === '' && tl().disabled;
    document.querySelector('.rz-pi-volba[data-v="sporak"]').click(); await __T.w(50);
    r.sporak = document.querySelector('#rz-pi-obsah [data-pi="prikon"]').value;
    inp('#rz-pi-obsah [data-pi="prikon"]', '9,5'); tl().click(); await __T.w(150);
    y = rozvNajit(b.uid).x; r.spPi = y.pi + ' | ' + y.piOdhad;
    // motor: Pn ze štítku
    m.spotr = 'motor'; await otevri(m.uid);
    r.motorPole = !!document.querySelector('#rz-pi-obsah [data-pi="prikon"]') && !document.querySelector('#rz-pi-obsah [data-pi="n"]') && /Pn ze štítku/.test(document.getElementById('rz-pi-obsah').textContent);
    inp('#rz-pi-obsah [data-pi="prikon"]', '5,5'); tl().click(); await __T.w(150);
    r.motor = rozvNajit(m.uid).x.pi;
    // Nastavení konfigurátoru: jiné výchozí příkony, jen v prohlížeči
    await otevri(c.uid);
    r.svetlo = document.querySelector('#rz-pi-obsah [data-pi="prikon"]').value;
    document.querySelector('#rz-pi-obsah .rz-pi-nastaveni').open = true;
    inp('#rz-pi-obsah .rz-pi-nast[data-pin="svetlo"]', '0,05'); TD_AKCE.tdRPiZavrit();
    await otevri(c.uid); r.svetlo2 = document.querySelector('#rz-pi-obsah [data-pi="prikon"]').value;
    inp('#rz-pi-obsah [data-pi="n"]', '12'); r.svVysl = vysl(); TD_AKCE.tdRPiZavrit();
    r.ls = localStorage.getItem('revize_el_rz_pi');
    __rz.vyber = null; rozvVlastnostiVykreslit();
    r.panel = !!document.querySelector('#rz-vlastnosti .rz-pi-nastaveni .rz-pi-nast[data-pin="zasuvka"]');
    r.vData = /0,05|0\.05/.test(JSON.stringify(DOK_TYPY.rozv.cist(dokForm())));
    TD_AKCE.tdRPiVychozi(); r.poReset = localStorage.getItem('revize_el_rz_pi');
    return r;
  });
  check('Pi odhad: zásuvky — typ podle názvu, výchozí 0,2 kW/ks, 8 × 0,2 = 1,6 kW, bez počtu „Použít" nejde',
    pi.typ === 'zasuvka' && pi.prikon === '0,2' && pi.tlPred && !pi.tlPo && /Pi ≈ 1,6 kW/.test(pi.vysl) && pi.pi === '1,6', JSON.stringify([pi.typ, pi.prikon, pi.vysl, pi.pi]));
  check('Pi odhad: v poli Pi se štítkem „odhad" (bublina s výpočtem), uloží se do rozvaděče',
    pi.odhad === '8 zásuvek × 0,2 kW' && pi.stitek === 'odhad: 8 zásuvek × 0,2 kW' && pi.pole === '1,6' && pi.cist === pi.odhad, JSON.stringify([pi.odhad, pi.stitek, pi.cist]));
  check('Pi odhad: ve schématu „≈1,6" a vysvětlivka; po ručním přepsání štítek i ≈ zmizí', pi.schOdhad && pi.rucne && pi.schRucne, JSON.stringify([pi.schOdhad, pi.rucne, pi.schRucne]));
  check('Pi odhad nikdy nepřepíše ručně zadanou hodnotu („Použít" vypnuté, hláška)', pi.blok && pi.blokPi === '1,8', pi.blokPi);
  check('Pi odhad: spotřebič — rychlé volby (bojler 2 … nabíječka EV 11, TČ a jiný zadat), sporák 9 kW, hodnota jde přepsat',
    /Bojler 2 kW/.test(pi.volby) && /Sporák 9 kW/.test(pi.volby) && /Varná deska 7,4 kW/.test(pi.volby) && /Nabíječka EV 11 kW/.test(pi.volby) &&
    /Tepelné čerpadlo – zadat/.test(pi.volby) && pi.tc && pi.sporak === '9' && pi.spPi === '9,5 | Sporák 9,5 kW', pi.volby + ' / ' + pi.spPi);
  check('Pi odhad: motor — jen Pn ze štítku (5,5 kW)', pi.motorPole && pi.motor === '5,5', pi.motor);
  check('Pi odhad: Nastavení konfigurátoru — svítidlo 0,03 → 0,05 kW/ks platí příště, jen v prohlížeči (ne v rozvaděči), ↺ vrátí výchozí',
    pi.svetlo === '0,03' && pi.svetlo2 === '0,05' && /12 svítidel × 0,05 kW/.test(pi.svVysl) && /Pi ≈ 0,6 kW/.test(pi.svVysl) &&
    /"svetlo":0\.05/.test(pi.ls || '') && pi.panel && !pi.vData && !pi.poReset, JSON.stringify([pi.svetlo, pi.svetlo2, pi.svVysl, pi.ls, pi.panel, pi.vData, pi.poReset]));

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
