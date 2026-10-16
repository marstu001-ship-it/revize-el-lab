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
  const uvod = await p.evaluate(() => {
    const b = document.querySelector('#screen-dokumentace .dok-drobky [data-action="tdUvod"]');
    const r = b ? b.getBoundingClientRect() : null;
    return { text: b ? b.textContent : '', vlevoNahore: !!r && r.left < 200 && r.top < 200,
             styl: !!b && b.className === document.querySelector('#screen-dok-seznam [data-action="tdTypy"]').className };
  });
  check('dlaždice: vlevo nahoře „← Úvod" ve stylu „← Tvorba dokumentace"', uvod.text === '← Úvod' && uvod.vlevoNahore && uvod.styl, JSON.stringify(uvod));
  await p.click('#screen-dokumentace [data-action="tdUvod"]'); await w(200);
  check('„← Úvod" vrátí na úvodní obrazovku', await p.evaluate(() => document.querySelector('.screen.active').id) === 'screen-home');
  await p.click('#screen-home [data-action="tdOtevrit"]'); await w(300);
  await p.click('#dok-dlazdice [data-typ="pouvv"]'); await w(300);
  const sez = await p.evaluate(() => ({ akt: document.querySelector('.screen.active').id, tit: document.getElementById('dok-seznam-titul').textContent,
    zpet: !!document.querySelector('#screen-dok-seznam [data-action="tdTypy"]') && document.querySelector('#screen-dok-seznam [data-action="tdTypy"]').textContent }));
  check('dlaždice otevře seznam protokolů s cestou „← Tvorba dokumentace"', sez.akt === 'screen-dok-seznam' && /vnějších vlivů/.test(sez.tit) && /← Tvorba dokumentace/.test(sez.zpet), JSON.stringify(sez));
  await p.click('#screen-dok-seznam [data-action="tdTypy"]'); await w(200);
  check('„← Tvorba dokumentace" vrátí na dlaždice', await p.evaluate(() => document.querySelector('.screen.active').id) === 'screen-dokumentace');
  await p.click('#dok-dlazdice [data-typ="pouvv"]'); await w(300);
  check('upozornění „katalog čeká na kontrolu s normou" je vidět',
    await p.evaluate(() => /čeká na kontrolu s normou/.test(document.getElementById('dok-katalog-info').textContent)));
  // přívětivost: jedna hlavní akce nahoře, vzory schované dole, katalog jeden řádek
  const ux = await p.evaluate(() => {
    const b = document.querySelector('#screen-dok-seznam .dok-hlavni-akce'), cs = b && getComputedStyle(b);
    const tlac = Array.from(document.querySelectorAll('#screen-dok-seznam button')).filter(x => x.offsetHeight);
    const sp = document.getElementById('dok-vzory-karta'), wrap = sp.parentElement;
    const ki = document.getElementById('dok-katalog-info'), lh = parseFloat(getComputedStyle(ki).lineHeight) || 18;
    return {
      text: b ? b.textContent.replace(/\s+/g, ' ').trim() : '', akce: b && b.getAttribute('data-action'),
      bg: cs && cs.backgroundColor, barva: cs && cs.color, pismo: cs ? parseFloat(cs.fontSize) : 0, vyska: b ? b.offsetHeight : 0,
      // první viditelné tlačítko za cestou zpět = hlavní akce, nad seznamem
      prvni: tlac[1] === b, nadSeznamem: b && b.getBoundingClientRect().bottom < document.getElementById('dok-seznam').getBoundingClientRect().top,
      prazdno: document.getElementById('dok-seznam').textContent.trim(),
      hledatSchovane: document.getElementById('dok-hledat').offsetHeight === 0,
      sprava: sp.tagName + '|' + sp.open + '|' + sp.querySelector('summary').textContent,
      spravaPosledni: wrap.lastElementChild === sp, vzoryVSprave: sp.contains(document.getElementById('dok-vzory')),
      vzoryVidet: sp.offsetHeight - sp.querySelector('summary').offsetHeight > 8,   // sbalená = jen řádek s nadpisem
      katalogRadek: ki.offsetHeight <= lh * 1.6, katalogBg: getComputedStyle(ki).backgroundColor, katalogH: ki.offsetHeight
    };
  });
  check('hlavní akce: velké plné tlačítko „＋ Vytvořit nový protokol" nahoře nad seznamem',
    ux.text === '＋ Vytvořit nový protokol' && ux.akce === 'tdNovy' && ux.prvni && ux.nadSeznamem && ux.pismo >= 18 && ux.vyska >= 48 &&
    ux.bg === 'rgb(15, 123, 95)' && ux.barva === 'rgb(255, 255, 255)', JSON.stringify(ux));
  check('prázdný seznam: „Zatím tu nic není. Začněte tlačítkem Vytvořit nový protokol." a bez hledání',
    ux.prazdno === 'Zatím tu nic není. Začněte tlačítkem Vytvořit nový protokol.' && ux.hledatSchovane, ux.prazdno);
  check('vzory jsou ve sbalené „⚙ Správa vzorů" úplně dole', /^DETAILS\|false\|⚙ Správa vzorů/.test(ux.sprava) && ux.spravaPosledni && ux.vzoryVSprave && !ux.vzoryVidet, ux.sprava);
  check('upozornění na katalog je jeden nenápadný řádek', ux.katalogRadek && /rgba\(0, 0, 0, 0\)|transparent/.test(ux.katalogBg), ux.katalogH + ' ' + ux.katalogBg);
  await p.click('#dok-vzory-karta > summary'); await w(150);
  check('klik na „⚙ Správa vzorů" ji rozbalí se vzory a „+ Nový vlastní vzor"', await p.evaluate(() =>
    document.getElementById('dok-vzory-karta').open && document.getElementById('dok-vzory-karta').offsetHeight > 300 &&
    document.querySelector('[data-action="tdVzorNovy"]').offsetHeight > 0));
  await p.click('#dok-vzory-karta > summary'); await w(100);

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
    const hledat = document.getElementById('dok-hledat').offsetHeight > 0;
    // klik kamkoli na řádek (ne na tlačítko) otevře protokol
    document.querySelector('#dok-seznam .dok-polozka').click(); await __T.w(400);
    const otevreno = document.getElementById('screen-dok-form').classList.contains('active');
    const f = dokForm(), sk = f.querySelectorAll('.dk-skupina');
    return {
      seznam, hledat, otevreno, stavba: f.querySelector('[data-dk="stavba"]').value, ico: f.querySelector('[data-dk="investor.ico"]').value,
      skupin: sk.length, prostory1: Array.from(sk[0].querySelectorAll('[data-k="n"]')).map(i => i.value),
      c2: Array.from(sk[1].querySelectorAll('[data-k="c"]')).map(i => i.value),
      ad2: sk[1].querySelector('select[data-kod="AD"]').value, vzor2: sk[1].querySelector('.dk-vzor-vyber').value,
      predseda: Array.from(f.querySelectorAll('.dk-osoba')).map(r => r.querySelector('[data-k="jmeno"]').value + (r.querySelector('input[type=radio]').checked ? '*' : '')),
      osoby: DOK.osoby.map(o => o.jmeno + '/' + o.funkce)
    };
  });
  check('seznam ukazuje číslo a stavbu', /POUVV-0001/.test(r3.seznam) && /Vymyšlená administrativní budova/.test(r3.seznam));
  check('s protokoly je vidět hledání a klik na řádek protokol otevře', r3.hledat && r3.otevreno, JSON.stringify({ h: r3.hledat, o: r3.otevreno }));
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

  // ── 13. vestavěné vzory prostorů (schválené 16. 10. 2026) ─────────────
  // Očekávané hodnoty jsou opsané ZE ZADÁNÍ, ne z programu.
  const ZAKLAD = 'AA5 AB5 AC1 AD1 AE1 AF1 AG1 AH1 AK1 AL1 AN1 AP1 AQ1 AR1 AS1 BA1 BC1 BD1 BE1 CA1 CB1';
  const SKLEP = 'AA4 AB4 AC1 AD2 AE1 AF1 AG1 AH1 AK1 AL1 AN1 AP1 AQ1 AR1 AS1 BA1 BC2 BD1 BE1 CA1 CB1';
  const VZORY = [
    ['Bydlení', 'vest-byt', 'Byt – obytné místnosti, kuchyň, předsíň', ZAKLAD, '', 'Bytová jednotka v bytovém domě', 'spotřebiče v kuchyni', 'Běžné čisticí prostředky pro domácnost'],
    ['Bydlení', 'vest-sprcha', 'Koupelna, sprcha, umývárna', 'AA5 AB5 AC1 AD4 AE1 AF1 AG2 AH2 AK1 AL1 AN1 AP1 AQ1 AR1 AS1 BA1 BC1 BD1 BE1 CA1 CB1', '', 'Koupelna se sprchovým koutem nebo vanou', 'otopný žebřík', 'Běžné hygienické a čisticí prostředky'],
    ['Bydlení', 'vest-rd', 'Rodinný dům – obytné prostory', ZAKLAD, '', 'Rodinný dům určený k trvalému bydlení', 'nabíjení elektromobilu', 'Běžné čisticí prostředky pro domácnost'],
    ['Bydlení', 'vest-rd-garaz', 'Rodinný dům – garáž', 'AA4 AB4 AC1 AD2 AE1 AF1 AG2 AH1 AK1 AL1 AN1 AP1 AQ1 AR1 AS1 BA1 BC2 BD1 BE1 CA1 CB1', 'zvažte BE2', 'Garáž pro osobní automobily', 'pohon garážových vrat', 'Pohonné hmoty v nádržích vozidel'],
    ['Bydlení', 'vest-sklep', 'Sklep, suterén', SKLEP, 'vyšší třídu AB / AD', 'Nevytápěné nebo temperované podzemní prostory', 'Osvětlení, zásuvkové obvody.', 'Bez skladování nebezpečných látek.'],
    ['Bytový dům', 'vest-bd-spolecne', 'Bytový dům – společné prostory (chodby, schodiště, vstup)', ZAKLAD, 'zvažte BD2', 'Společné prostory bytového domu', 'schodišťovými automaty', 'Úklidové prostředky'],
    ['Bytový dům', 'vest-bd-sklepy', 'Bytový dům – sklepní kóje, kočárkárna, kolárna, sušárna', SKLEP, '', 'Společné nevytápěné prostory bytového domu', 'Osvětlení, zásuvkové obvody.', 'Bez skladování nebezpečných látek.'],
    ['Bytový dům', 'vest-bd-elektro', 'Bytový dům – elektroměrová rozvodna, hlavní domovní rozvodna', 'AA5 AB5 AC1 AD1 AE1 AF1 AG1 AH1 AK1 AL1 AN1 AP1 AQ1 AR1 AS1 BA4 BC2 BD1 BE1 CA1 CB1', 'BA4 platí pro uzamčený prostor', 'Uzamčený prostor s hlavní domovní rozvodnicí', 'elektroměrové rozvaděče', 'Bez skladování nebezpečných látek.'],
    ['Bytový dům', 'vest-bd-vytah', 'Bytový dům – strojovna výtahu', 'AA5 AB5 AC1 AD1 AE1 AF1 AG1 AH2 AK1 AL1 AN1 AP1 AQ1 AR1 AS1 BA4 BC2 BD1 BE1 CA1 CB1', 'hydraulický olej', 'Uzamčená strojovna výtahu', 'Pohon výtahu', 'Maziva a převodové oleje'],
    ['Technické prostory', 'vest-kotelna', 'Kotelna (plynová, bez trvalé obsluhy)', 'AA5 AB5 AC1 AD1 AE1 AF1 AG1 AH1 AK1 AL1 AN1 AP1 AQ1 AR1 AS1 BA4 BC2 BD1 BE1 CA1 CB1', '', 'Plně automatizovaný zdroj tepla', 'Plynové kotle s hořáky', 'Zemní plyn (palivo, hořlavý plyn)'],
    ['Technické prostory', 'vest-vymenik', 'Výměníková stanice', 'AA5 AB5 AC1 AD2 AE1 AF1 AG1 AH2 AK1 AL1 AN1 AP1 AQ1 AR1 AS1 BA4 BC2 BD1 BE1 CA1 CB1', 'zvažte BC3', 'Výměníková stanice tepla', 'Výměník tepla', 'Otopná voda'],
    ['Technické prostory', 'vest-technicka', 'Technická místnost / sklad čerpadel', 'AA5 AB5 AC1 AD2 AE1 AF1 AG2 AH2 AK1 AL1 AN1 AP1 AQ1 AR1 AS1 BA1 BC1 BD1 BE1 CA1 CB1', '', '', '', ''],
    ['Technické prostory', 'vest-sklad', 'Nevytápěný sklad', 'AA4 AB4 AC1 AD2 AE1 AF1 AG1 AH1 AK1 AL1 AN1 AP1 AQ1 AR1 AS1 BA1 BC1 BD1 BE1 CA1 CB1', '', '', '', ''],
    ['Technické prostory', 'vest-puda', 'Půda, nevytápěné podkroví', 'AA7 AB7 AC1 AD1 AE2 AF1 AG1 AH1 AK1 AL2 AN1 AP1 AQ1 AR1 AS1 BA1 BC1 BD1 BE1 CA2 CB1', 'CA2 platí pro dřevěný krov', 'Nevytápěný půdní prostor pod střechou', 'k anténám a fotovoltaice', 'Bez skladování nebezpečných látek.'],
    ['Administrativa a výroba', 'vest-admin', 'Administrativa / kanceláře / sociální zázemí', ZAKLAD, '', '', '', ''],
    ['Administrativa a výroba', 'vest-vyroba-cista', 'Výrobní hala – čistá výroba (montáž)', 'AA5 AB5 AC1 AD1 AE1 AF1 AG2 AH2 AK1 AL1 AN1 AP1 AQ1 AR1 AS1 BA4 BC2 BD1 BE1 CA1 CB1', 'nepoučené osoby, BA1', 'Výrobní hala pro montáž a lehkou výrobu', 'Montážní pracoviště', 'Provozní kapaliny a maziva'],
    ['Administrativa a výroba', 'vest-vyroba-prasna', 'Výrobní hala – prašná výroba (nehořlavý prach)', 'AA5 AB5 AC1 AD1 AE4 AF1 AG2 AH2 AK1 AL1 AN1 AP1 AQ1 AR1 AS1 BA4 BC2 BD1 BE1 CA1 CB1', '!AG3 při provozu vysokozdvižných vozíků. HOŘLAVÝ PRACH (dřevo, mouka, plasty) = BE2 nebo BE3', 'Výrobní hala s prašným provozem', 'odsávání', 'Provozní kapaliny a maziva'],
    ['Administrativa a výroba', 'vest-dilna', 'Dílna, údržba', 'AA5 AB5 AC1 AD1 AE2 AF1 AG2 AH2 AK1 AL1 AN1 AP1 AQ1 AR1 AS1 BA4 BC2 BD1 BE1 CA1 CB1', '', 'Dílna údržby', 'svářečka, kompresor', 'Maziva, oleje a čisticí prostředky'],
    ['Administrativa a výroba', 'vest-sklad-horlaviny', 'Sklad hořlavých látek', 'AA4 AB4 AC1 AD1 AE1 AF1 AG1 AH1 AK1 AL1 AN1 AP1 AQ1 AR1 AS1 BA4 BC2 BD1 BE2 CA1 CB1', '!HOŘLAVÉ KAPALINY I. TŘÍDY', 'Sklad hořlavých látek a materiálů', 'případně větrání', 'Doplnit konkrétní skladované látky.'],
    ['Venkovní', 'vest-venkovni', 'Venkovní prostory', 'AA7 AB7 AC1 AD4 AE2 AF2 AG2 AH1 AK2 AL2 AN2 AP1 AQ2 AR2 AS2 BA1 BC3 BD1 BE1 CA1 CB1', 'zvažte AD3', 'Venkovní prostory objektu', 'pohony vjezdových bran', 'Bez nebezpečných látek.'],
  ];
  const vz = await p.evaluate(async (VZORY) => {
    const out = [];
    await dokNovy('pouvv');
    const sel = dokForm().querySelector('.dk-vzor-vyber');
    const poradi = Array.from(sel.querySelectorAll('optgroup')).map(g => g.label + ':' + Array.from(g.children).map(o => o.value).join(','));
    const nabB = Array.from(dokForm().querySelectorAll('.dk-b[data-b="popis"] .dk-nabidka optgroup')).map(g => g.label);
    for (const [skupina, id] of VZORY) {
      await dokNovy('pouvv');
      clearTimeout(__dokCasovac);
      const f = dokForm(), sk = f.querySelector('.dk-skupina'), s = sk.querySelector('.dk-vzor-vyber');
      s.value = id; s.dispatchEvent(new Event('change', { bubbles: true }));
      clearTimeout(__dokCasovac); __dokCasovac = null;
      const up = sk.querySelector('.dk-upozorneni');
      out.push({ id, nazev: s.selectedOptions[0].textContent, skupina: s.selectedOptions[0].parentNode.label,
        kody: Object.values(dokKodyCist(sk)).join(' '),
        popis: f.querySelector('[data-dk="popis"]').value, technologie: f.querySelector('[data-dk="technologie"]').value,
        chemikalie: f.querySelector('[data-dk="chemikalie"]').value, pozn: sk.querySelector('[data-k="pozn"]').value,
        upoz: up && up.offsetHeight > 0 ? up.textContent : '', vyrazne: !!(up && up.classList.contains('vyrazne')) });
    }
    window.__dokOtevreny = null;
    return { out, poradi, nabB };
  }, VZORY);
  check('výběr vzoru: skupinové nadpisy v předepsaném pořadí',
    vz.poradi.map(x => x.split(':')[0]).join('|') === 'Bydlení|Bytový dům|Technické prostory|Administrativa a výroba|Venkovní', vz.poradi.map(x => x.split(':')[0]).join('|'));
  const ocekPoradi = ['Bydlení', 'Bytový dům', 'Technické prostory', 'Administrativa a výroba', 'Venkovní']
    .map(s => s + ':' + VZORY.filter(v => v[0] === s).map(v => v[1]).join(','));
  check('výběr vzoru: vzory uvnitř skupin v předepsaném pořadí', JSON.stringify(vz.poradi) === JSON.stringify(ocekPoradi), JSON.stringify(vz.poradi).slice(0, 200));
  check('nabídka „Vložit text ze vzoru" má stejné skupiny ve stejném pořadí', vz.nabB.join('|') === 'Bydlení|Bytový dům|Technické prostory|Administrativa a výroba|Venkovní', vz.nabB.join('|'));
  VZORY.forEach(([skupina, id, nazev, kody, upoz, popis, tech, chem], i) => {
    const r = vz.out[i];
    const kodyOk = r.kody === kody;
    const textyOk = popis ? (r.popis.startsWith(popis) && r.technologie.indexOf(tech) !== -1 && r.chemikalie.startsWith(chem))
                          : (r.popis === '' && r.technologie === '' && r.chemikalie === '');
    const upozOk = upoz ? (r.upoz.indexOf(upoz.replace(/^!/, '')) !== -1 && r.vyrazne === upoz.startsWith('!')) : r.upoz === '';
    check('vzor „' + nazev + '": kódy, texty B, upozornění', r.nazev === nazev && r.skupina === skupina && kodyOk && textyOk && upozOk,
      [r.nazev, r.skupina, kodyOk ? 'kódy OK' : 'kódy ' + r.kody, textyOk ? 'texty OK' : 'texty ' + r.popis.slice(0, 40), upozOk ? 'upoz OK' : 'upoz ' + r.upoz.slice(0, 60)].join(' · '));
  });
  check('koupelna: poznámka o zónách ČSN 33 2000-7-701 zůstala', /ČSN 33 2000-7-701 zóny dle obrázku 701 A-f/.test(vz.out[1].pozn));

  // upozornění nejde do PDF ani do dat protokolu
  const upPdf = await p.evaluate(async () => {
    await dokNovy('pouvv');
    const f = dokForm();
    const st = f.querySelector('[data-dk="stavba"]'); st.value = 'Vymyšlená prašná hala'; st.dispatchEvent(new Event('input', { bubbles: true }));
    const s = f.querySelector('.dk-vzor-vyber'); s.value = 'vest-vyroba-prasna'; s.dispatchEvent(new Event('change', { bubbles: true }));
    const videt = f.querySelector('.dk-upozorneni').offsetHeight > 0;
    await dokNahled(); await new Promise(r => setTimeout(r, 200));
    const text = Array.from(document.querySelectorAll('#dok-pdf-pages .a4')).map(x => x.innerText).join('\n');
    const data = JSON.stringify(DOK.dokumenty.find(x => x.uid === __dokOtevreny.uid).data);
    TD_AKCE.tdPdfZpet();
    return { videt, text, data };
  });
  check('upozornění vzoru se ve formuláři ukáže', upPdf.videt);
  check('upozornění vzoru NENÍ v PDF', !/HOŘLAVÝ PRACH|Upozornění|60079/.test(upPdf.text) && /AE4/.test(upPdf.text));
  check('upozornění vzoru NENÍ v uložených datech protokolu', !/HOŘLAVÝ PRACH|upozorneni/.test(upPdf.data));

  // protokol uložený se vzorem „Sprcha / umývárna" (před přejmenováním) se načte beze změny
  const stary = await p.evaluate(async () => {
    await dokNacist();
    const zaznam = { uid: 'dok-stary-sprcha', typ: 'pouvv', cislo: 'POUVV-0099', vytvoreno: '2026-10-16T05:00:00.000Z', upraveno: '2026-10-16T05:00:00.000Z',
      data: { cislo: 'POUVV-0099', stavba: 'Vymyšlená stará umývárna', investor: {}, zpracovatel: {}, projektant: {}, komise: [],
              podklady: 'X', popis: '', technologie: '', chemikalie: '', zduvodneni: 'Z',
              skupiny: [{ uid: 'g1', prostory: [{ c: '1', n: 'Sprcha' }], vzor: 'vest-sprcha',
                          kody: { AA: 'AA5', AD: 'AD3', BA: 'BA1' }, pozn: 'Stará poznámka ze Sprcha / umývárna' }] } };
    DOK.dokumenty.push(zaznam); await dokZapsat();
    const pred = JSON.stringify(zaznam);
    await dokOtevrit('dok-stary-sprcha'); await new Promise(r => setTimeout(r, 1200));
    const f = dokForm(), sk = f.querySelector('.dk-skupina'), s = sk.querySelector('.dk-vzor-vyber');
    const v = { nazev: s.selectedOptions[0].textContent, kody: dokKodyCist(sk), pozn: sk.querySelector('[data-k="pozn"]').value,
                popis: f.querySelector('[data-dk="popis"]').value, stav: document.getElementById('dok-stav').textContent };
    await dokNacist();
    v.ulozene = JSON.stringify(DOK.dokumenty.find(x => x.uid === 'dok-stary-sprcha'));
    v.pred = pred;
    return v;
  });
  check('starý protokol se vzorem „Sprcha / umývárna" ukáže nový název vzoru', stary.nazev === 'Koupelna, sprcha, umývárna', stary.nazev);
  check('starý protokol: kódy, poznámka a prázdné texty B beze změny', JSON.stringify(stary.kody) === '{"AA":"AA5","AD":"AD3","BA":"BA1"}' &&
    stary.pozn === 'Stará poznámka ze Sprcha / umývárna' && stary.popis === '', JSON.stringify(stary.kody));
  check('starý protokol: pouhé otevření uložená data nepřepíše', stary.ulozene === stary.pred);

  // ── 14. vlastní vzor se jménem, které už existuje ─────────────────────
  const jm = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const okno = () => document.getElementById('modal-dok-vzor-jmeno');
    const ulozJako = async (nazev, pozn) => {
      dokVzorDialog({ nazev, kody: { AA: 'AA5' }, pozn: pozn || '', texty: {} }, null);
      document.getElementById('dok-vzor-nazev').value = nazev;
      await dokVzorUlozit(); await w(50);
    };
    await dokNacist(); DOK.vzory = []; await dokZapsat();
    const r = {};
    await ulozJako('Vymyšlený vzor A', 'první');
    r.prvni = DOK.vzory.map(v => v.nazev).join('|');
    await ulozJako('  vymyšlený   VZOR a ', 'druhá');
    r.dotaz = okno().classList.contains('open') ? document.getElementById('dok-vzor-jmeno-text').textContent : '';
    r.prepsatVidet = document.querySelector('#modal-dok-vzor-jmeno [data-action="tdVzorJmenoPrepsat"]').offsetHeight > 0;
    r.neulozenoPredVolbou = DOK.vzory.length === 1 && DOK.vzory[0].pozn === 'první';
    document.querySelector('#modal-dok-vzor-jmeno [data-action="tdVzorJmenoPrepsat"]').click(); await w(150); await dokNacist();
    r.poPrepsani = DOK.vzory.map(v => v.nazev + '/' + v.pozn).join('|');
    await ulozJako('Vymyšlený vzor A', 'třetí');
    document.querySelector('#modal-dok-vzor-jmeno [data-action="tdVzorJmenoNovy"]').click(); await w(150); await dokNacist();
    r.poNovem = DOK.vzory.map(v => v.nazev + '/' + v.pozn).join('|');
    await ulozJako('Vymyšlený vzor A', 'čtvrtá');
    document.querySelector('#modal-dok-vzor-jmeno [data-action="tdVzorJmenoZpet"]').click(); await w(100); await dokNacist();
    r.poZpet = DOK.vzory.length + ' ' + document.getElementById('modal-dok-vzor').classList.contains('open');
    closeModal('modal-dok-vzor');
    // vestavěný: přepsat nejde, jen nový
    await ulozJako('Kotelna (plynová, bez trvalé obsluhy)');
    r.vestPrepsat = document.querySelector('#modal-dok-vzor-jmeno [data-action="tdVzorJmenoPrepsat"]').offsetHeight > 0;
    r.vestText = document.getElementById('dok-vzor-jmeno-text').textContent;
    document.querySelector('#modal-dok-vzor-jmeno [data-action="tdVzorJmenoNovy"]').click(); await w(150); await dokNacist();
    r.vestNovy = DOK.vzory.map(v => v.nazev).filter(n => /^Kotelna/.test(n)).join('|');
    // „Jako vlastní" dvakrát → „Kotelna (vlastní) 2"
    dokOtevritSeznam('pouvv'); await w(50);
    for (let k = 0; k < 2; k++) {
      document.querySelector('#dok-vzory [data-vzor="vest-kotelna"] [data-action="tdVzorJakoVlastni"]').click(); await w(50);
      await dokVzorUlozit(); await w(50);
      if (okno().classList.contains('open')) { document.querySelector('#modal-dok-vzor-jmeno [data-action="tdVzorJmenoNovy"]').click(); await w(150); }
    }
    await dokNacist();
    r.jakoVlastni = DOK.vzory.map(v => v.nazev).filter(n => /\(vlastní\)/.test(n)).join('|');
    // úprava vzoru se svým vlastním jménem se neptá
    const vl = DOK.vzory.find(v => v.nazev === 'Vymyšlený vzor A'); if (!vl) { r.chyba = DOK.vzory.map(v => v.nazev).join('|'); return r; }
    dokVzorDialog(dokVzor(vl.id), vl.id); await dokVzorUlozit(); await w(50);
    r.vlastniJmenoBezDotazu = !okno().classList.contains('open') && !document.getElementById('modal-dok-vzor').classList.contains('open');
    return r;
  });
  check('stejné jméno vzoru (bez ohledu na velikost a mezery) → dotaz „Přepsat… nebo uložit jako nový?"',
    /Přepsat existující vzor, nebo uložit jako nový\?/.test(jm.dotaz) && jm.prepsatVidet && jm.neulozenoPredVolbou, jm.dotaz);
  check('„Přepsat existující" přepíše a nepřidá druhý', jm.poPrepsani === 'Vymyšlený vzor A/druhá', jm.poPrepsani);
  check('„Uložit jako nový" dostane číslo', jm.poNovem === 'Vymyšlený vzor A/druhá|Vymyšlený vzor A 2/třetí', jm.poNovem);
  check('„Zpět" nic neuloží a nechá okno vzoru otevřené', jm.poZpet === '2 true', jm.poZpet);
  check('jméno vestavěného vzoru: přepsat nejde, jen uložit jako nový s číslem', !jm.vestPrepsat && /vestavěnými/.test(jm.vestText) && jm.vestNovy === 'Kotelna (plynová, bez trvalé obsluhy) 2', jm.vestNovy);
  check('„Jako vlastní" podruhé → „… (vlastní) 2"', jm.jakoVlastni === 'Kotelna (plynová, bez trvalé obsluhy) (vlastní)|Kotelna (plynová, bez trvalé obsluhy) (vlastní) 2', jm.jakoVlastni);
  check('úprava vzoru pod jeho vlastním jménem se neptá', jm.vlastniJmenoBezDotazu);

  // ── 12. telefon: karta pod ostatními ──────────────────────────────────
  const m = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const pm = await m.newPage();
  await pm.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  await pm.goto(URL); await w(1000);
  const km = await pm.evaluate(() => Array.from(document.querySelectorAll('#screen-home .home-grid .home-card')).map(k => Math.round(k.getBoundingClientRect().top)));
  const mu = await pm.evaluate(async () => {
    dokOtevritTypy(); await new Promise(r => setTimeout(r, 100));
    const b = document.querySelector('#screen-dokumentace [data-action="tdUvod"]'), r = b.getBoundingClientRect();
    return { w: r.width, h: r.height, left: r.left, right: r.right, vw: innerWidth };
  });
  const mh = await pm.evaluate(async () => {
    dokOtevritSeznam('pouvv'); await new Promise(r => setTimeout(r, 100));
    const b = document.querySelector('#screen-dok-seznam .dok-hlavni-akce').getBoundingClientRect();
    const k = document.querySelector('#screen-dok-seznam .scard').getBoundingClientRect();
    const s = document.querySelector('#dok-vzory-karta > summary').getBoundingClientRect();
    return { w: Math.round(b.width), kw: Math.round(k.width), h: Math.round(b.height), top: Math.round(b.top), vh: innerHeight, sh: Math.round(s.height) };
  });
  check('telefon: „Vytvořit nový protokol" přes celou šířku a vidět bez posouvání, „Správa vzorů" aspoň 44 px',
    Math.abs(mh.w - mh.kw) <= 2 && mh.h >= 44 && mh.top + mh.h <= mh.vh && mh.sh >= 44, JSON.stringify(mh));
  await pm.evaluate(async () => { dokOtevritTypy(); await new Promise(r => setTimeout(r, 100)); });
  await pm.tap('#screen-dokumentace [data-action="tdUvod"]'); await w(200);
  const muAkt = await pm.evaluate(() => document.querySelector('.screen.active').id);
  check('telefon: „← Úvod" aspoň 44 × 44 px, v displeji, klepnutí vrátí na úvod', mu.w >= 44 && mu.h >= 44 && mu.left >= 0 && mu.right <= mu.vw && muAkt === 'screen-home', JSON.stringify(mu) + ' ' + muAkt);
  check('telefon: karta Tvorba dokumentace pod ostatními', km.length === 4 && km[3] > km[2] && km[2] > km[1], JSON.stringify(km));
  await m.close();

  check('bez chyb stránky', err.length === 0, err.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.error('CRASH:', e.message); process.exit(2); });
