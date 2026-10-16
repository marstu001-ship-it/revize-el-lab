// Tvorba dokumentace — protokol o určení vnějších vlivů (ČSN 33 2000-5-51 ed.3).
// Samostatná část programu mimo revize: vlastní úložiště, seznam, číslování,
// vzory a PDF. Test hlídá:
//  - kartu na úvodu (PC v jednom řádku s ostatními, telefon pod nimi),
//  - protokol se dvěma skupinami prostorů, vzor předvyplní kódy, ruční změna
//    kódu, uložení, znovuotevření i po restartu prohlížeče,
//  - číslování POUVV-0001…, kopii, ⟳, vlastní vzor (uložit, použít, upravit,
//    smazat se ZPĚT), skrytí vestavěného vzoru,
//  - PDF obsahuje kódy, NE vysvětlivky,
//  - zálohu a obnovu (samostatná část `dokumentace`),
//  - ODDĚLENÍ: protokol se neobjeví v archivu, naposledy otevřených, plánu
//    revizí ani v hledání a data revizí zůstanou bajt po bajtu stejná.
// Všechna data vymyšlená.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));

function pomocnik() {
  window.__T = {
    w: ms => new Promise(r => setTimeout(r, ms)),
    nast(sel, v, koren) {
      const e = (koren || dokForm()).querySelector(sel);
      e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
    },
    vzor(sk, id) { const s = sk.querySelector('.dk-vzor-vyber'); s.value = id; s.dispatchEvent(new Event('change', { bubbles: true })); },
    // Otisk dat revizí: všechny klíče STORE z IndexedDB + záloha v localStorage
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
    STORE.technik = { jmeno: 'Jan Vymyšlený', mesto: 'Kyjov' }; saveStore();
    novaZprava('elektro'); await __T.w(200);
    const e = id => document.getElementById(id);
    e('f_ev_cislo').value = 'RE-26-0001'; e('f_misto').value = 'Vymyšlený rodinný dům'; e('f_adresa').value = 'Polní 1, Kyjov';
    window.__formDirty = false; saveToArchiv(); showScreen('home'); await __T.w(300);
  });
  const otiskPred = await p.evaluate(() => __T.otiskRevizi());
  const archivPred = await p.evaluate(() => JSON.stringify(archiv));

  // ── 1. karta na úvodu ─────────────────────────────────────────────────
  const karty = await p.evaluate(() => Array.from(document.querySelectorAll('#screen-home .home-grid .home-card'))
    .map(k => ({ t: k.querySelector('.home-card-title').textContent, top: Math.round(k.getBoundingClientRect().top) })));
  check('úvod: čtvrtá karta „Tvorba dokumentace"', karty.length === 4 && karty[3].t === 'Tvorba dokumentace', karty.map(k => k.t).join(' | '));
  check('úvod: na PC všechny čtyři karty v jednom řádku', new Set(karty.map(k => k.top)).size === 1, JSON.stringify(karty.map(k => k.top)));
  await p.click('#screen-home [data-action="tdOtevrit"]'); await w(300);
  const dl = await p.evaluate(() => ({
    akt: document.querySelector('.screen.active').id,
    typy: Array.from(document.querySelectorAll('#dok-dlazdice .dok-dlazdice')).map(x => x.getAttribute('data-typ')).join(),
    text: document.getElementById('dok-dlazdice').innerText,
    vzhled: !!document.querySelector('#dok-dlazdice.home-grid .home-card.dok-dlazdice')
  }));
  check('karta otevře nejdřív dlaždice typů dokumentů (ne seznam)', dl.akt === 'screen-dokumentace', dl.akt);
  check('dlaždice se skládají z DOK_TYPY, vzhled jako karty na úvodu', dl.typy === 'pouvv' && dl.vzhled, dl.typy);
  check('dlaždice: název, popis normy a počet uložených', /Protokol o určení vnějších vlivů/i.test(dl.text) && /Dle ČSN 33 2000-5-51 ed\.3/.test(dl.text) && /Zatím žádný uložený/.test(dl.text), dl.text.replace(/\n/g, ' | '));
  check('dlaždice „připravuje se" nejsou', !/připravuje/i.test(dl.text));
  await p.click('#dok-dlazdice [data-typ="pouvv"]'); await w(300);
  const sez = await p.evaluate(() => ({ akt: document.querySelector('.screen.active').id, tit: document.getElementById('dok-seznam-titul').textContent,
    zpet: !!document.querySelector('#screen-dok-seznam [data-action="tdTypy"]') && document.querySelector('#screen-dok-seznam [data-action="tdTypy"]').textContent }));
  check('dlaždice otevře seznam protokolů s cestou „← Tvorba dokumentace"', sez.akt === 'screen-dok-seznam' && /vnějších vlivů/.test(sez.tit) && /← Tvorba dokumentace/.test(sez.zpet), JSON.stringify(sez));
  await p.click('#screen-dok-seznam [data-action="tdTypy"]'); await w(200);
  check('„← Tvorba dokumentace" vrátí na dlaždice', await p.evaluate(() => document.querySelector('.screen.active').id) === 'screen-dokumentace');
  await p.click('#dok-dlazdice [data-typ="pouvv"]'); await w(300);
  check('upozornění „katalog čeká na kontrolu s normou" je vidět',
    await p.evaluate(() => /čeká na kontrolu s normou/.test(document.getElementById('dok-katalog-info').textContent)));

  // ── 2. nový protokol, dvě skupiny ─────────────────────────────────────
  await p.click('#dok-typy [data-typ="pouvv"]'); await w(300);
  const novy = await p.evaluate(() => ({
    scr: document.getElementById('screen-dok-form').classList.contains('active'),
    cislo: dokForm().querySelector('[data-dk="cislo"]').value,
    ulozeno: DOK.dokumenty.length,
    podklady: dokForm().querySelector('[data-dk="podklady"]').value,
    zd: dokForm().querySelector('[data-dk="zduvodneni"]').value,
    vypracoval: dokForm().querySelector('[data-dk="vypracoval"]').value
  }));
  check('nový protokol dostane číslo POUVV-0001', novy.scr && novy.cislo === 'POUVV-0001', novy.cislo);
  check('nový prázdný protokol se do seznamu sám neuloží', novy.ulozeno === 0, String(novy.ulozeno));
  check('podklady předvyplněné třemi normami', /ČSN 33 2000-5-51 ed\. 3/.test(novy.podklady) && /ČSN 33 2130 ed\. 3/.test(novy.podklady) && /ČSN 33 2000-4-41 ed\. 3/.test(novy.podklady));
  check('obecné zdůvodnění předvyplněné', /^Určení vnějších vlivů je v souladu/.test(novy.zd));
  check('vypracoval předvyplněn z profilu (jen čtení)', novy.vypracoval === 'Jan Vymyšlený', novy.vypracoval);

  const r2 = await p.evaluate(async () => {
    const T = __T, f = dokForm();
    T.nast('[data-dk="stavba"]', 'Vymyšlená administrativní budova');
    T.nast('[data-dk="misto"]', 'Smyšlená 7, 697 01 Kyjov');
    T.nast('[data-dk="predmet"]', 'Elektroinstalace nn');
    T.nast('[data-dk="investor.nazev"]', 'Vymyšlená investorská a.s.');
    T.nast('[data-dk="investor.ico"]', '12345678');
    const o1 = f.querySelector('.dk-osoba');
    T.nast('[data-k="jmeno"]', 'Ing. Petr Vymyšlený', o1); T.nast('[data-k="funkce"]', 'projektant', o1);
    TD_AKCE.tdOsobaPridat();
    const o2 = f.querySelectorAll('.dk-osoba')[1];
    T.nast('[data-k="jmeno"]', 'Eva Smyšlená', o2); T.nast('[data-k="funkce"]', 'za investora', o2);
    let sk = f.querySelector('.dk-skupina');
    dokProstoryVlozit(sk, dokRozborProstoru('Číslo\tNázev místnosti\n101\tKancelář\n102\tChodba\n103\tKancelář vedoucího'));
    T.vzor(sk, 'vest-admin');
    TD_AKCE.tdSkupinaPridat();
    sk = f.querySelectorAll('.dk-skupina')[1];
    dokProstoryVlozit(sk, dokRozborProstoru('104 Sprcha\n105 – Umývárna'));
    T.vzor(sk, 'vest-sprcha');
    const vzorKody = dokKodyCist(sk);
    const pozn = sk.querySelector('[data-k="pozn"]').value;
    // ruční změna kódu: AD4 → AD3
    const s = sk.querySelector('select[data-kod="AD"]'); s.value = 'AD3'; s.dispatchEvent(new Event('change', { bubbles: true }));
    await T.w(1200);
    return { vzorKody, pozn, souhrn: sk.querySelector('.dk-souhrn').textContent, pocet: DOK.dokumenty.length,
             stav: document.getElementById('dok-stav').textContent, skupin: f.querySelectorAll('.dk-skupina').length,
             g1: dokKodyCist(f.querySelector('.dk-skupina')) };
  });
  check('vzor „Administrativa" předvyplní kódy skupiny 1', r2.g1.AD === 'AD1' && r2.g1.BA === 'BA1' && r2.g1.CB === 'CB1' && Object.keys(r2.g1).length === 21, JSON.stringify(r2.g1));
  check('vzor „Sprcha" předvyplní AD4, AG2, AH2 a poznámku o zónách 701', r2.vzorKody.AD === 'AD4' && r2.vzorKody.AG === 'AG2' && r2.vzorKody.AH === 'AH2' && /ČSN 33 2000-7-701/.test(r2.pozn));
  check('ruční změna kódu se promítne do souhrnu', /AD3/.test(r2.souhrn) && !/AD4/.test(r2.souhrn), r2.souhrn.slice(0, 120));
  check('protokol se po změnách sám uložil', r2.pocet === 1 && /Uloženo/.test(r2.stav), r2.stav);

  // ── 3. znovuotevření po restartu prohlížeče ───────────────────────────
  await p.reload(); await w(1200); await p.evaluate(pomocnik);
  const r3 = await p.evaluate(async () => {
    dokOtevritSeznam(); await __T.w(100);
    const seznam = document.getElementById('dok-seznam').textContent;
    document.querySelector('#dok-seznam [data-action="tdDokOtevrit"]').click(); await __T.w(400);
    const f = dokForm(), sk = f.querySelectorAll('.dk-skupina');
    return {
      seznam, stavba: f.querySelector('[data-dk="stavba"]').value, ico: f.querySelector('[data-dk="investor.ico"]').value,
      skupin: sk.length, prostory1: Array.from(sk[0].querySelectorAll('[data-k="n"]')).map(i => i.value),
      c2: Array.from(sk[1].querySelectorAll('[data-k="c"]')).map(i => i.value),
      ad2: sk[1].querySelector('select[data-kod="AD"]').value, vzor2: sk[1].querySelector('.dk-vzor-vyber').value,
      predseda: Array.from(f.querySelectorAll('.dk-osoba')).map(r => r.querySelector('[data-k="jmeno"]').value + (r.querySelector('input[type=radio]').checked ? '*' : '')),
      osoby: DOK.osoby.map(o => o.jmeno + '/' + o.funkce)
    };
  });
  check('seznam ukazuje číslo a stavbu', /POUVV-0001/.test(r3.seznam) && /Vymyšlená administrativní budova/.test(r3.seznam));
  check('po restartu: hlavička zůstala', r3.stavba === 'Vymyšlená administrativní budova' && r3.ico === '12345678');
  check('po restartu: dvě skupiny, prostory (hlavička tabulky přeskočena)', r3.skupin === 2 && r3.prostory1.join('|') === 'Kancelář|Chodba|Kancelář vedoucího' && r3.c2.join('|') === '104|105', JSON.stringify([r3.prostory1, r3.c2]));
  check('po restartu: ručně změněný kód AD3 a vybraný vzor zůstaly', r3.ad2 === 'AD3' && r3.vzor2 === 'vest-sprcha');
  check('po restartu: předseda komise zůstal označený', r3.predseda.join('|') === 'Ing. Petr Vymyšlený*|Eva Smyšlená', r3.predseda.join('|'));
  check('osoby z komise si program pamatuje', r3.osoby.includes('Ing. Petr Vymyšlený/projektant') && r3.osoby.includes('Eva Smyšlená/za investora'), r3.osoby.join(', '));

  // ── 4. číslování, kopie, ⟳, pamatované osoby ──────────────────────────
  const r4 = await p.evaluate(async () => {
    await dokNovy('pouvv'); const c2 = dokForm().querySelector('[data-dk="cislo"]').value;
    __T.nast('[data-dk="stavba"]', 'Druhá vymyšlená stavba');
    const j = dokForm().querySelector('.dk-osoba [data-k="jmeno"]'); j.value = 'Eva Smyšlená'; j.dispatchEvent(new Event('change', { bubbles: true }));
    const funkce = dokForm().querySelector('.dk-osoba [data-k="funkce"]').value;
    await dokUlozitOtevreny();
    await dokKopirovat(DOK.dokumenty.find(x => x.cislo === 'POUVV-0001').uid);
    const cisla = DOK.dokumenty.map(x => x.cislo).sort();
    // ⟳ u dokumentu s přepsaným číslem
    await dokOtevrit(DOK.dokumenty.find(x => x.cislo === 'POUVV-0002').uid);
    __T.nast('[data-dk="cislo"]', 'POUVV-0001'); await __T.w(50);
    const dup = document.getElementById('dok-stav').textContent;
    TD_AKCE.tdCisloDalsi(); const po = dokForm().querySelector('[data-dk="cislo"]').value;
    await dokUlozitOtevreny();
    return { c2, funkce, cisla, dup, po, kopie: DOK.dokumenty.find(x => x.cislo === 'POUVV-0003') };
  });
  check('druhý protokol dostane POUVV-0002', r4.c2 === 'POUVV-0002', r4.c2);
  check('vybraná známá osoba doplní funkci', r4.funkce === 'za investora', r4.funkce);
  check('kopie dostane POUVV-0003 a obsah originálu', r4.cisla.join() === 'POUVV-0001,POUVV-0002,POUVV-0003' && r4.kopie && r4.kopie.data.skupiny.length === 2 && r4.kopie.data.stavba === 'Vymyšlená administrativní budova', r4.cisla.join());
  check('duplicitní číslo program ohlásí', /už má jiný dokument/.test(r4.dup), r4.dup);
  check('⟳ přidělí další volné číslo (POUVV-0004)', r4.po === 'POUVV-0004', r4.po);

  // ── 5. vlastní vzor ───────────────────────────────────────────────────
  const r5 = await p.evaluate(async () => {
    await dokOtevrit(DOK.dokumenty.find(x => x.cislo === 'POUVV-0001').uid);
    const f = dokForm(), sk2 = f.querySelectorAll('.dk-skupina')[1];
    __T.nast('[data-dk="technologie"]', 'Vymyšlené sprchové baterie s termostatem.');
    sk2.querySelector('[data-action="tdVzorZeSkupiny"]').click(); await __T.w(100);
    const okno = document.getElementById('modal-dok-vzor').classList.contains('open');
    const ad = document.querySelector('#dok-vzor-kody select[data-kod="AD"]').value;
    const tech = document.getElementById('dok-vzor-t-technologie').value;
    document.getElementById('dok-vzor-nazev').value = 'Vymyšlená umývárna s AD3';
    await dokVzorUlozit();
    const vl = DOK.vzory[0];
    const vSelectu = Array.from(sk2.querySelectorAll('.dk-vzor-vyber option')).some(o => o.value === vl.id);
    // použít v nové skupině
    TD_AKCE.tdSkupinaPridat(); const sk3 = f.querySelectorAll('.dk-skupina')[2];
    __T.vzor(sk3, vl.id); const kody3 = dokKodyCist(sk3);
    // nabídka textu B z vlastního vzoru
    const nab = Array.from(f.querySelectorAll('.dk-b[data-b="technologie"] .dk-nabidka option')).map(o => o.textContent);
    // upravit
    dokVzorDialog(dokVzor(vl.id), vl.id); document.getElementById('dok-vzor-nazev').value = 'Vymyšlená umývárna (upraveno)'; await dokVzorUlozit();
    const nazev = DOK.vzory[0].nazev;
    // smazat se ZPĚT
    await dokVzorSmazat(vl.id); const poSmazani = DOK.vzory.length;
    const toast = Array.from(document.querySelectorAll('#toast-wrap .toast')).pop();
    toast.querySelector('button').click(); await __T.w(300); await dokNacist();
    const poZpet = DOK.vzory.length;
    await dokVzorSmazat(vl.id);
    // vestavěný skrýt / zobrazit
    await dokVzorSkrytPrepnout('vest-sklad');
    const skryty = !Array.from(sk3.querySelectorAll('.dk-vzor-vyber option')).some(o => o.value === 'vest-sklad');
    const lzeSmazat = !!document.querySelector('#dok-vzory [data-vzor="vest-sklad"] [data-action="tdVzorSmazat"]');
    await dokVzorSkrytPrepnout('vest-sklad');
    const zpet = Array.from(sk3.querySelectorAll('.dk-vzor-vyber option')).some(o => o.value === 'vest-sklad');
    TD_AKCE.tdSkupinaSmazat(sk3.querySelector('[data-action="tdSkupinaSmazat"]'));
    await dokUlozitOtevreny();
    return { okno, ad, tech, vSelectu, kody3, nab, nazev, poSmazani, poZpet, konec: DOK.vzory.length, skryty, zpet, lzeSmazat,
             skupin: DOK.dokumenty.find(x => x.cislo === 'POUVV-0001').data.skupiny.length };
  });
  check('„Uložit jako vlastní vzor" převezme kódy skupiny i texty B', r5.okno && r5.ad === 'AD3' && /sprchové baterie/.test(r5.tech));
  check('vlastní vzor je ve výběru vzoru a předvyplní kódy', r5.vSelectu && r5.kody3.AD === 'AD3' && r5.kody3.AG === 'AG2');
  check('vlastní vzor nabízí svůj text oddílu B', r5.nab.some(t => /Vymyšlená umývárna s AD3/.test(t)), r5.nab.join(' | '));
  check('vlastní vzor jde upravit', r5.nazev === 'Vymyšlená umývárna (upraveno)', r5.nazev);
  check('vlastní vzor jde smazat a vzít ZPĚT', r5.poSmazani === 0 && r5.poZpet === 1 && r5.konec === 0, [r5.poSmazani, r5.poZpet, r5.konec].join());
  check('vestavěný vzor nejde smazat, jen skrýt a zase zobrazit', !r5.lzeSmazat && r5.skryty && r5.zpet);
  check('smazaná skupina z protokolu zmizela', r5.skupin === 2, String(r5.skupin));

  // ── 6. PDF ────────────────────────────────────────────────────────────
  const r6 = await p.evaluate(async () => {
    await dokOtevrit(DOK.dokumenty.find(x => x.cislo === 'POUVV-0001').uid);
    await dokNahled(); await __T.w(200);
    const str = Array.from(document.querySelectorAll('#dok-pdf-pages .a4'));
    const text = str.map(s => s.innerText).join('\n');
    const font = getComputedStyle(str[0]).fontFamily;
    const vyska = Math.max(...str.map(s => s.getBoundingClientRect().height)) / (96 / 25.4);
    const ted = document.querySelector('.screen.active').id;
    TD_AKCE.tdPdfZpet();
    return { n: str.length, text, font, vyska, ted, zpet: document.querySelector('.screen.active').id };
  });
  const T6 = r6.text;
  check('PDF: titul a číslo v záhlaví každé strany', /PROTOKOL O URČENÍ VNĚJŠÍCH VLIVŮ/i.test(T6) && (T6.match(/č\. POUVV-0001/g) || []).length >= r6.n, r6.n + ' stran');
  check('PDF: kódy skupin jako řádky a) b) c)', /a\) Vnější vlivy: AA5, AB5, AC1, AD1/.test(T6) && /a\) Vnější vlivy: AA5, AB5, AC1, AD3, AE1, AF1, AG2, AH2/.test(T6) && /b\) Využití: BA1, BC1, BD1, BE1/.test(T6) && /c\) Konstrukce budov: CA1, CB1/.test(T6));
  check('PDF: věta podle ČSN 33 2000-5-51 ed.3 u každé skupiny', (T6.match(/Podle ČSN 33 2000-5-51 ed\.3 jsou stanoveny vnější vlivy pro objekty, uvedené v bodu B, následovně:/g) || []).length === 2);
  check('PDF: prostory a poznámka', /101 – Kancelář/.test(T6) && /105 – Umývárna/.test(T6) && /ČSN 33 2000-7-701/.test(T6));
  check('PDF: vysvětlivky kódů v PDF NEJSOU', !/\+5 až \+40 °C|Teplota okolí|zanedbatelný|krytí|IPX|běžné \(laici\)|nehořlavé/.test(T6));
  check('PDF: podpisové řádky předsedy, člena komise a vypracovatele', /Předseda komise/.test(T6) && /Člen komise/.test(T6) && /Vypracoval\s+Jan Vymyšlený/.test(T6));
  check('PDF: číslování stran', new RegExp('Strana 1 / ' + r6.n).test(T6));
  check('PDF: bezpatkové písmo, ne psací stroj revizní zprávy', /DM Sans/.test(r6.font) && !/Courier/.test(r6.font), r6.font);
  check('PDF: žádná strana není vyšší než A4', r6.vyska <= 297.6, r6.vyska.toFixed(1) + ' mm');
  check('PDF: náhled a „Zpět" do formuláře', r6.ted === 'screen-dok-pdf' && r6.zpet === 'screen-dok-form');

  // Otisk dat revizí PO práci s protokoly (vytvoření, úpravy, vzory, PDF) —
  // dál už test sahá i na revize (obnova zálohy, plán, otevření zprávy).
  const otiskPo = await p.evaluate(() => __T.otiskRevizi());
  const archivPo = await p.evaluate(() => JSON.stringify(archiv));
  check('oddělení: data revizí po práci s protokoly bajtově stejná (IDB, localStorage, archiv)',
    otiskPred === otiskPo && archivPred === archivPo, otiskPred.length + ' / ' + otiskPo.length);

  // ── 7. záloha a obnova ────────────────────────────────────────────────
  const r7 = await p.evaluate(async () => {
    const j = JSON.parse(await buildZalohaBlob().text());
    const cast = j.dokumentace || {};
    const vArchivu = JSON.stringify(j.archiv).indexOf('POUVV') !== -1;
    const pocet = DOK.dokumenty.length;
    DOK = dokPrazdny(); await dokZapsat();
    obnovZeZalohy(j); await __T.w(300); await dokNacist();
    const obnoveno = DOK.dokumenty.length;
    // starší záloha bez části dokumentace dokumenty nechá být
    const stara = JSON.parse(JSON.stringify(j)); delete stara.dokumentace;
    obnovZeZalohy(stara); await __T.w(300); await dokNacist();
    return { format: cast._format, n: (cast.dokumenty || []).length, vArchivu, pocet, obnoveno, poStare: DOK.dokumenty.length,
             archivZal: (j.archiv || []).length };
  });
  check('záloha: samostatná část „dokumentace" s dokumenty', r7.format === 'revize-el-dokumentace' && r7.n === r7.pocet && r7.pocet === 3, JSON.stringify(r7));
  check('záloha: dokumenty nejsou v archivu zpráv zálohy', !r7.vArchivu && r7.archivZal === 1);
  check('obnova ze zálohy vrátí dokumenty', r7.obnoveno === 3, String(r7.obnoveno));
  check('obnova starší zálohy bez dokumentace dokumenty nechá', r7.poStare === 3, String(r7.poStare));

  // ── 8. ODDĚLENÍ OD REVIZÍ ─────────────────────────────────────────────
  const r8 = await p.evaluate(async () => {
    showScreen('home'); renderArchiv(); await __T.w(100);
    const home = document.getElementById('screen-home').innerText;
    const s = document.getElementById('archiv-search'); s.value = 'POUVV'; s.dispatchEvent(new Event('input', { bubbles: true })); await __T.w(200);
    const hledani = document.getElementById('archiv-container').innerText;
    s.value = 'Vymyšlená administrativní'; s.dispatchEvent(new Event('input', { bubbles: true })); await __T.w(200);
    const hledani2 = document.getElementById('archiv-container').innerText;
    s.value = ''; s.dispatchEvent(new Event('input', { bubbles: true }));
    const recents = document.getElementById('archiv-recents').innerText;
    otevritPlan(); await __T.w(400); document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open'));
    const plan = document.getElementById('screen-plan').innerText;
    // postranní archiv ve formuláři zprávy
    otevritZpravu(0); await __T.w(300); formArchivNastavit(true); await __T.w(100);
    const fa = document.getElementById('fa-seznam').innerText;
    const fh = document.getElementById('fa-hledat'); fh.value = 'POUVV'; fh.dispatchEvent(new Event('input', { bubbles: true })); await __T.w(100);
    const fa2 = document.getElementById('fa-seznam').innerText;
    formArchivNastavit(false); window.__formDirty = false; showScreen('home');
    const typy = Array.from(document.querySelectorAll('#archiv-typ option')).map(o => o.textContent).join('|');
    return { home, hledani, hledani2, recents, plan, fa, fa2, typy, storeKlice: STORE_KEYS.join(),
             vStore: JSON.stringify(STORE).indexOf('POUVV') !== -1 };
  });
  const NIC = /POUVV|Vymyšlená administrativní budova|vnějších vlivů/;
  check('oddělení: v archivu na úvodu protokol není', !NIC.test(r8.home.replace(/Protokol o určení vnějších vlivů a další dokumenty[^\n]*/, '')), '');
  check('oddělení: hledání v archivu protokol nenajde', !NIC.test(r8.hledani) && !NIC.test(r8.hledani2));
  check('oddělení: naposledy otevřené protokol neukazují', !NIC.test(r8.recents));
  check('oddělení: plán revizí protokol nezná', !NIC.test(r8.plan));
  check('oddělení: postranní archiv ani jeho hledání protokol neukazují', !NIC.test(r8.fa) && !NIC.test(r8.fa2));
  check('oddělení: filtr typu v archivu nemá dokumentaci', !/dokument|vliv/i.test(r8.typy), r8.typy);
  check('oddělení: dokumenty nejsou ve STORE ani ve STORE_KEYS', !r8.vStore && !/dok/.test(r8.storeKlice));
  const otisk8 = await p.evaluate(() => __T.otiskRevizi());
  const vlastni = await p.evaluate(async () => ({
    ls: !!localStorage.getItem('revize_el_dok'), idb: Array.isArray(await idbGet('dok_dokumenty')),
    vStore: (await idbGet('archiv') || []).some(z => /POUVV/.test(JSON.stringify(z)))
  }));
  check('vlastní úložiště: localStorage revize_el_dok a IndexedDB dok_dokumenty', vlastni.ls && vlastni.idb && !vlastni.vStore);

  // ── 9. smazání se ZPĚT, hledání v seznamu ─────────────────────────────
  const r9 = await p.evaluate(async () => {
    dokOtevritSeznam(); await __T.w(100);
    const h = document.getElementById('dok-hledat'); h.value = 'umyvarna'; h.dispatchEvent(new Event('input', { bubbles: true }));
    const nalez = document.querySelectorAll('#dok-seznam .dok-polozka').length;
    h.value = ''; h.dispatchEvent(new Event('input', { bubbles: true }));
    const uid = DOK.dokumenty.find(x => x.cislo === 'POUVV-0004').uid;
    await dokSmazat(uid); const po = DOK.dokumenty.length;
    Array.from(document.querySelectorAll('#toast-wrap .toast')).pop().querySelector('button').click(); await __T.w(300);
    await dokNacist();
    return { nalez, po, zpet: DOK.dokumenty.length, polozek: document.querySelectorAll('#dok-seznam .dok-polozka').length };
  });
  const pocetDl = await p.evaluate(() => { dokOtevritTypy(); return document.getElementById('dok-dlazdice').innerText; });
  check('dlaždice ukazuje počet uložených protokolů', /Uloženo: 3 protokoly/.test(pocetDl), pocetDl.replace(/\n/g, ' | '));
  check('hledání v seznamu dokumentů (i podle prostoru, bez háčků)', r9.nalez === 2, String(r9.nalez));
  check('smazání dokumentu se ZPĚT', r9.po === 2 && r9.zpet === 3 && r9.polozek === 3, JSON.stringify(r9));

  check('oddělení: smazání a ZPĚT dokumentu data revizí nezměnily', otisk8 === await p.evaluate(() => __T.otiskRevizi()));

  // ── 10. dvě okna ──────────────────────────────────────────────────────
  const p2 = await ctx.newPage(); p2.on('pageerror', e => err.push('okno 2: ' + e.message));
  await p2.goto(URL); await w(1200); await p2.evaluate(pomocnik);
  await p2.evaluate(async () => { dokOtevritSeznam(); });
  await p.evaluate(async () => { await dokNovy('pouvv'); __T.nast('[data-dk="stavba"]', 'Stavba z prvního okna'); await dokUlozitOtevreny(); });
  await w(700);
  const okno2 = await p2.evaluate(() => ({ n: DOK.dokumenty.length, t: document.getElementById('dok-seznam').innerText }));
  check('druhé okno uvidí nový protokol bez obnovení stránky', okno2.n === 4 && /Stavba z prvního okna/.test(okno2.t), String(okno2.n));
  await p2.evaluate(async () => { await dokOtevrit(DOK.dokumenty.find(x => x.data.stavba === 'Druhá vymyšlená stavba').uid); __T.nast('[data-dk="stavba"]', 'Upraveno ve druhém okně'); await dokUlozitOtevreny(); });
  await w(500);
  const obe = await p.evaluate(async () => { await dokNacist(); return DOK.dokumenty.map(x => x.data.stavba).sort().join('|'); });
  check('uložení ve druhém okně nepřepíše dokument z prvního', /Stavba z prvního okna/.test(obe) && /Upraveno ve druhém okně/.test(obe), obe);

  // ── 11. rozbor vloženého seznamu prostorů ─────────────────────────────
  const r11 = await p.evaluate(() => JSON.stringify(dokRozborProstoru('Č. m.\tNázev\n1.01\tZádveří\nA-12 – Sklad\n0.05: Kotelna\nChodba bez čísla\n\n  2.03   Kuchyňka ')));
  check('rozbor seznamu prostorů (Excel, text, bez čísla, hlavička)',
    r11 === JSON.stringify([{ c: '1.01', n: 'Zádveří' }, { c: 'A-12', n: 'Sklad' }, { c: '0.05', n: 'Kotelna' }, { c: '', n: 'Chodba bez čísla' }, { c: '2.03', n: 'Kuchyňka' }]), r11);

  // ── 12. telefon: karta pod ostatními ──────────────────────────────────
  const m = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const pm = await m.newPage();
  await pm.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  await pm.goto(URL); await w(1000);
  const km = await pm.evaluate(() => Array.from(document.querySelectorAll('#screen-home .home-grid .home-card')).map(k => Math.round(k.getBoundingClientRect().top)));
  check('telefon: karta Tvorba dokumentace pod ostatními', km.length === 4 && km[3] > km[2] && km[2] > km[1], JSON.stringify(km));
  await m.close();

  check('bez chyb stránky', err.length === 0, err.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.error('CRASH:', e.message); process.exit(2); });
