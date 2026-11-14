// Knihovna výrobců – vlastní úložiště mimo balík dokumentů (OPRAVA, 2026-11-13).
//
// Do v9.144 byla knihovna rozvaděčů (import dat výrobců, tisíce položek)
// součástí balíku DOK a `dokZapsat()` ji při KAŽDÉM uložení dokumentu
// (automaticky 800 ms po každé změně protokolu či rozvaděče) převáděla na
// JSON a zapisovala do localStorage i IndexedDB znovu celou — u velké
// knihovny (desítky tisíc položek, MB dat) to zdržovalo každé uložení
// a u localStorage (limit v tomhle prohlížeči změřen na 5 MB) hrozilo tiché
// přetečení (QuotaExceededError v try/catch) — tedy ztrátu poslední úpravy
// dokumentu při zavření okna (ta jde do localStorage SYNCHRONNĚ na
// `pagehide`, IndexedDB to nemusí stihnout).
//
// Oprava: knihovna má vlastní úložiště (`dok_rozvKnihovna` v IDB, stejný
// název jako dřív; `revize_el_rz_knihovna` v localStorage bez IDB — iOS)
// a zapisuje se JEN při změně knihovny (import, vlastní položka, úprava,
// smazání, ZPĚT), ne při každém uložení dokumentu. `rozvKnihovnaVse()` má
// mezipaměť (zneplatní ji `rozvKnihovnaZmenena()`), takže se filtr a
// vykreslení knihovny nepočítá znovu při každém stisku klávesy.
//
// Záloha: ruční („Stáhnout zálohu") nese knihovnu celou jako dřív;
// automatická (do složky, po každé změně dat) vynechá import — jen vlastní
// položky uživatele (`rozvKnihovnaBezImportu: true`). Obnova takové zálohy
// importovanou knihovnu nesmaže, jen sloučí vlastní položky podle id.
//
// Vše vymyšlené: syntetická knihovna „Výrobce A–F", žádná reálná data.
const T = __dirname + '/';
const PORT = process.env.PORT || 8901, STARA = process.env.STARA_PORT || 8902;
const { chromium } = require(T + 'pw');
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const info = (s) => console.log('ℹ ' + s);
const w = ms => new Promise(r => setTimeout(r, ms));

// ── Syntetická knihovna (CSV, tak jako reálný import) ───────────────────
function genCsv(n, dlouhyText) {
  var header = 'druh;kategorie;nazev;vyrobce;rada;typ;poly;in;charakteristika;icn;sirka_moduly;poznamka;overeno';
  var vyrobci = ['Výrobce A', 'Výrobce B', 'Výrobce C', 'Výrobce D', 'Výrobce E', 'Výrobce F'];
  var rady = ['LTN', 'LFN', 'ASN', 'R1', 'R2', 'R3'];
  var chary = ['B', 'C', 'D'];
  var poly = ['1', '3', '1+N', '3+N'];
  var pozn = (dlouhyText || 'Poznámka z katalogu výrobce s popisem přístroje, technickými parametry a odkazem na datový list pro montáž do rozváděče a kontrolu jištění. ').repeat(4);
  var lines = [header];
  for (var i = 0; i < n; i++) {
    lines.push(['pristroj', 'FA', '', vyrobci[i % 6], rady[i % 6] + (i % 9), 'TYP-' + i, poly[i % 4],
      String(6 + (i % 58)), chary[i % 3], '6', '1', pozn + ' #' + i, i % 5 === 0 ? 'ano' : ''].join(';'));
  }
  return lines.join('\r\n');
}

async function stranka(b, port, ctxOpts) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1366, height: 900 }, acceptDownloads: true }, ctxOpts || {}));
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const p = await ctx.newPage();
  p.__err = [];
  p.on('pageerror', e => p.__err.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto('http://127.0.0.1:' + port + '/index.html');
  await w(1000);
  return p;
}

// Import přes SKUTEČNÝ náhled importu (rozvImportSoubor → modal → tdRImportUlozit).
async function importKnihovnu(p, csvText) {
  return p.evaluate(async (txt) => {
    await dokNacist();
    const file = new File([txt], 'knihovna.csv', { type: 'text/csv' });
    await rozvImportSoubor(file);
    await new Promise(r => setTimeout(r, 30));
    const bylo = window.__rzImport ? { nove: window.__rzImport.nove, chyby: window.__rzImport.v.chyby.length } : null;
    if (window.__rzImport) await TD_AKCE.tdRImportUlozit();
    return bylo;
  }, csvText);
}

async function otevritRozvadec(p) {
  return p.evaluate(async () => {
    await dokNovy('rozv');
    return window.__dokOtevreny.uid;
  });
}

function nastavOznaceni(p, hodnota) {
  return p.evaluate((h) => {
    const e = dokForm().querySelector('[data-dk="oznaceni"]');
    e.value = h;
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }, hodnota);
}

(async () => {
  const b = await chromium.launch();
  const csv15k = genCsv(15000);
  const velikostCsvMB = (Buffer.byteLength(csv15k, 'utf8') / (1024 * 1024)).toFixed(2);
  info('Syntetická knihovna: 15000 položek, CSV ' + velikostCsvMB + ' MB (6 vymyšlených výrobců „Výrobce A–F")');

  // ═══════════════════════════════════════════════════════════════════
  // 0) Před opravou (STARA_PORT = poslední commit PŘED touhle opravou,
  //    v9.144): ověřit, co platilo — velikost revize_el_dok, QuotaExceeded,
  //    časy. NENÍ součást trvalé regrese (port 8902 se s dalšími commity
  //    posune), jen jednorázový důkaz pro zprávu.
  // ═══════════════════════════════════════════════════════════════════
  {
    const p = await stranka(b, STARA);
    await importKnihovnu(p, csv15k);
    await w(300);
    const pred = await p.evaluate(async () => {
      const t0 = performance.now();
      let hodilo = false, zprava = '';
      try { localStorage.setItem('__test_quota', JSON.stringify(Object.assign({ _zapsano: new Date().toISOString() }, DOK))); localStorage.removeItem('__test_quota'); }
      catch (e) { hodilo = true; zprava = e.name || String(e); }
      const t1 = performance.now();
      const ls = localStorage.getItem('revize_el_dok');
      return { hodilo, zprava, dokZapsatMs: +(t1 - t0).toFixed(1), lsKB: ls ? Math.round(ls.length / 1024) : 0 };
    });
    info('Port ' + STARA + ' (STARA_PORT — „poslední commit"): revize_el_dok po importu 15000 položek = ' + pred.lsKB + ' kB; ' +
      'localStorage.setItem celého DOK ' + (pred.hodilo ? ('HODILO ' + pred.zprava) : 'prošlo') + '; čas pokusu o zápis ' + pred.dokZapsatMs + ' ms');
    // Nezávisí na tom, zda STARA_PORT je ještě v9.144 (bez téhle opravy) nebo
    // už opravený kód — platí obecně: JSON celého DOK s 15000 položkami
    // v knihovně (tolik má v paměti KAŽDÁ verze po importu) do 5MB
    // localStorage nejde (QuotaExceededError). Přesně proto měl starý
    // dokZapsat() tenhle zápis tiše selhávat.
    check('velký balík (dokumenty + knihovna 15000 položek) nejde celý do localStorage (QuotaExceededError)', pred.hodilo, pred.zprava);
    await p.context().close();
  }

  // ═══════════════════════════════════════════════════════════════════
  // 1) Import 15000 položek na NOVÉM kódu → revize_el_dok neobsahuje
  //    knihovnu a je malý; uložení dokumentu nezapíše dok_rozvKnihovna;
  //    změna knihovny ho zapíše. Časy dokZapsat / filtr / otevření editoru.
  // ═══════════════════════════════════════════════════════════════════
  const p1 = await stranka(b, PORT);
  {
    const bylo = await importKnihovnu(p1, csv15k);
    check('import 15000 položek skutečným náhledem proběhl bez chyb', !!bylo && bylo.chyby === 0, JSON.stringify(bylo));
    await w(300);

    const stav = await p1.evaluate(() => {
      const ls = localStorage.getItem('revize_el_dok');
      let obj = null; try { obj = JSON.parse(ls); } catch (e) {}
      return {
        lsKB: ls ? Math.round(ls.length / 1024) : 0,
        maKnihovnu: !!(obj && Array.isArray(obj.rozvKnihovna) && obj.rozvKnihovna.length),
        pocetVKnihovne: (DOK.rozvKnihovna || []).length
      };
    });
    check('po importu je v knihovně 15000 položek', stav.pocetVKnihovne === 15000, stav.pocetVKnihovne);
    check('revize_el_dok po importu NEOBSAHUJE knihovnu', !stav.maKnihovnu, JSON.stringify(stav));
    check('revize_el_dok je pod 500 kB (jen dokumenty, vzory, osoby, objekty)', stav.lsKB < 500, stav.lsKB + ' kB');

    // Spy na idbSetMulti — která volání sahají na dok_rozvKnihovna.
    await p1.evaluate(() => {
      window.__idbWrites = [];
      const puv = idbSetMulti;
      idbSetMulti = function (obj) { window.__idbWrites.push(Object.keys(obj)); return puv(obj); };
    });

    const uid = await otevritRozvadec(p1);
    await nastavOznaceni(p1, 'RH1-test');
    await w(1200);   // 800ms autosave doběhne
    const zapisyDokument = await p1.evaluate(() => window.__idbWrites.slice());
    const sahlNaKnihovnu = zapisyDokument.some(ks => ks.indexOf('dok_rozvKnihovna') !== -1);
    check('uložení dokumentu (bez změny knihovny) NEZAPISUJE dok_rozvKnihovna do IDB', !sahlNaKnihovnu, JSON.stringify(zapisyDokument));

    await p1.evaluate(() => { window.__idbWrites.length = 0; });
    await p1.evaluate(async () => {
      await dokNacist();
      const it = DOK.rozvKnihovna[0];
      it.pozn = it.pozn + ' UPRAVENO';
      await dokZapsat();
      rozvKnihovnaZmenena();
    });
    await w(200);
    const zapisyKnihovna = await p1.evaluate(() => window.__idbWrites.slice());
    check('změna knihovny JE vidět mezi zápisy do IDB', zapisyKnihovna.some(ks => ks.indexOf('dok_rozvKnihovna') !== -1), JSON.stringify(zapisyKnihovna));

    // ── Časy ──────────────────────────────────────────────────────────
    const casy = await p1.evaluate(async () => {
      const t0 = performance.now(); await dokZapsat(); const dokZapsatMs = performance.now() - t0;
      const t1 = performance.now(); rozvFiltryVykreslit(); rozvKnihovnaVykreslit(); const vykresliMs = performance.now() - t1;
      __rzF.q = 'b16'; const t2 = performance.now(); rozvKnihovnaVykreslit(); const filtrMs = performance.now() - t2;
      __rzF.q = '';
      return { dokZapsatMs: +dokZapsatMs.toFixed(1), vykresliMs: +vykresliMs.toFixed(1), filtrMs: +filtrMs.toFixed(1) };
    });
    info('Časy při 15000 položkách — dokZapsat(): ' + casy.dokZapsatMs + ' ms · vykreslení knihovny: ' + casy.vykresliMs +
      ' ms · filtr (psaní do hledání): ' + casy.filtrMs + ' ms');
    check('dokZapsat() pod 50 ms (cíl spec.)', casy.dokZapsatMs < 50, casy.dokZapsatMs + ' ms');
    check('filtr knihovny pod 100 ms (cíl spec.)', casy.filtrMs < 100, casy.filtrMs + ' ms');

    const casEditoru = await p1.evaluate(async () => {
      const t0 = performance.now();
      await dokNovy('rozv');
      return +(performance.now() - t0).toFixed(1);
    });
    info('Otevření editoru rozvaděče (knihovna 15000 položek): ' + casEditoru + ' ms');
    check('otevření editoru rozvaděče pod 1 s (cíl spec.)', casEditoru < 1000, casEditoru + ' ms');
  }

  // ═══════════════════════════════════════════════════════════════════
  // 2) Zavření okna těsně po úpravě — IDB zdržena, localStorage musí
  //    stihnout synchronně. Na opravě úprava přežije; na staré verzi
  //    (v9.144, demonstrace mimo trvalou regresi) se ztratí.
  // ═══════════════════════════════════════════════════════════════════
  async function zavreniOknaScenar(p, csvText) {
    await importKnihovnu(p, csvText);
    await w(300);
    const uid = await otevritRozvadec(p);
    await nastavOznaceni(p, 'RH-PUVODNI');
    await w(1200);   // první uložení doběhne normálně (IDB i localStorage)
    // Zdržet IDB zápis — simuluje okno, které se zavře dřív, než IDB dopíše.
    await p.evaluate(() => {
      const puv = idbSetMulti;
      idbSetMulti = function (obj) { return new Promise((resolve) => { setTimeout(() => { puv(obj).then(resolve); }, 4000); }); };
    });
    await nastavOznaceni(p, 'RH-PRED-ZAVRENIM');
    await p.evaluate(() => { dokZmena(); dokUlozitHned(); });   // sync localStorage hned, IDB za 4 s
    await w(250);   // dřív, než zdržený IDB zápis doběhne
    await p.reload();   // „zavření okna" — rozjetý setTimeout(4000) v téhle stránce zanikne
    await w(1200);
    return p.evaluate(async (uid) => {
      await dokNacist();
      const x = DOK.dokumenty.find(d => d.uid === uid);
      return x ? x.data.oznaceni : null;
    }, uid);
  }

  {
    const p = await stranka(b, PORT);
    const vysledek = await zavreniOknaScenar(p, csv15k);
    check('OPRAVA: úprava před zavřením okna (IDB zdržena) PŘEŽILA — localStorage bez knihovny se vejde',
      vysledek === 'RH-PRED-ZAVRENIM', 'oznaceni=' + vysledek);
    check('bez chyb v konzoli (scénář zavření okna)', !p.__err.length, p.__err.join(' | '));
    await p.context().close();
  }
  {
    // Jen demonstrace chyby na staré verzi — NEPOČÍTÁ se do res[] (8902 je
    // „poslední commit" a s dalšími commity přestane být v9.144).
    const p = await stranka(b, STARA);
    const vysledek = await zavreniOknaScenar(p, csv15k);
    info('PŘED OPRAVOU (port ' + STARA + '): úprava před zavřením okna → ' + (vysledek === 'RH-PRED-ZAVRENIM'
      ? 'PŘEŽILA (neočekáváno)' : 'ZTRACENA (oznaceni=' + vysledek + ') — přesně ten dokumentovaný bug'));
    await p.context().close();
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3) iOS bez IndexedDB — malá knihovna se vejde do localStorage,
  //    velká (15000) ne: hláška, dokumenty zůstanou v pořádku.
  // ═══════════════════════════════════════════════════════════════════
  {
    const p = await stranka(b, PORT, { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' });
    const jeIos = await p.evaluate(() => IS_IOS);
    check('simulace iOS: IS_IOS === true (žádná IndexedDB)', jeIos === true);
    const maIdb = await p.evaluate(() => idb);
    check('simulace iOS: idb je null', maIdb === null);

    // malá knihovna (200 položek) se vejde
    await importKnihovnu(p, genCsv(200));
    await w(200);
    const stavMala = await p.evaluate(() => ({
      pocet: (DOK.rozvKnihovna || []).length,
      vLs: JSON.parse(localStorage.getItem('revize_el_rz_knihovna') || '[]').length,
      bezUloziste: window.__dokKnihovnaBezUloziste
    }));
    check('iOS: malá knihovna (200) je v DOK i v revize_el_rz_knihovna', stavMala.pocet === 200 && stavMala.vLs === 200, JSON.stringify(stavMala));
    check('iOS: „bez úložiště" není nastaveno u malé knihovny', !stavMala.bezUloziste);

    const uid = await otevritRozvadec(p);
    await nastavOznaceni(p, 'IOS-DOKUMENT');
    await w(1200);
    const dokOk = await p.evaluate(async (uid) => {
      await dokNacist();
      const x = DOK.dokumenty.find(d => d.uid === uid);
      return x ? x.data.oznaceni : null;
    }, uid);
    check('iOS: dokument se uloží a obnoví (bez IDB)', dokOk === 'IOS-DOKUMENT', String(dokOk));

    // velká knihovna (15000) se do localStorage (sdílené 5 MB) nevejde
    const velkaInfo = await importKnihovnu(p, csv15k);
    await w(300);
    const stavVelka = await p.evaluate(() => ({
      pocet: (DOK.rozvKnihovna || []).length,
      bezUloziste: window.__dokKnihovnaBezUloziste
    }));
    check('iOS: po importu 15000 je knihovna v paměti', stavVelka.pocet === 15000, stavVelka.pocet);
    check('iOS: velká knihovna se do localStorage NEVEŠLA — „bez úložiště" je true', stavVelka.bezUloziste === true, JSON.stringify(stavVelka));

    // dokumenty (jiné úložiště) tím nejsou poškozené
    await nastavOznaceni(p, 'IOS-PO-PRETECENI');
    await w(1200);
    const dokOk2 = await p.evaluate(async (uid) => {
      await dokNacist();
      const x = DOK.dokumenty.find(d => d.uid === uid);
      return x ? x.data.oznaceni : null;
    }, uid);
    check('iOS: dokumenty zůstanou v pořádku i po přetečení knihovny', dokOk2 === 'IOS-PO-PRETECENI', String(dokOk2));
    check('bez chyb v konzoli (scénář iOS)', !p.__err.length, p.__err.join(' | '));
    await p.context().close();
  }

  // ═══════════════════════════════════════════════════════════════════
  // 4) Přechod ze staré podoby (v9.144): knihovna v IDB i v revize_el_dok.
  //    NEPOUŽÍVÁ STARA_PORT — ten je „poslední commit" a v regresi po
  //    tomhle commitu už žádnou starou podobu neslouží. Stará podoba se
  //    proto na OPRAVENÉM kódu (PORT) přímo zapíše do úložiště tak, jak by
  //    ji zapsal starý dokZapsat() (celý DOK_IDB, tedy i rozvKnihovna,
  //    najednou do localStorage i IDB) — totéž, co reálně zůstane
  //    v prohlížeči uživatele, který aktualizuje z v9.144.
  // ═══════════════════════════════════════════════════════════════════
  {
    const p = await stranka(b, PORT);
    const uidRozv = await otevritRozvadec(p);
    await nastavOznaceni(p, 'RH-PRECHOD');
    await w(1200);   // dokument uložený normálně, opraveným kódem

    const predOtisk = await p.evaluate(async (n) => {
      await dokNacist();
      DOK.rozvKnihovna = Array.from({ length: n }, (_, i) => ({
        id: 'u' + i, druh: 'pristroj', kat: 'FA', vyrobce: 'Výrobce A', rada: 'LTN' + (i % 9),
        typ: 'TYP-' + i, poly: '1', In: 16, sirka: 1, zdroj: 'import'
      }));
      // simulace STARÉHO dokZapsat() (do v9.144): celý DOK_IDB (i knihovna) najednou
      const t = new Date().toISOString();
      localStorage.setItem('revize_el_dok', JSON.stringify(Object.assign({ _zapsano: t }, DOK)));
      if (idb) {
        const o = { dok_zapsano: t };
        DOK_IDB.forEach(k => { o['dok_' + k] = DOK[k]; });
        await idbSetMulti(o);
      }
      return {
        knihPocet: DOK.rozvKnihovna.length,
        dokumenty: JSON.stringify(DOK.dokumenty.map(d => d.data)),
        maKnihovnuVls: !!JSON.parse(localStorage.getItem('revize_el_dok') || '{}').rozvKnihovna,
        maKnihovnuVIdb: Array.isArray(await idbGet('dok_rozvKnihovna'))
      };
    }, 300);
    check('přechod: stará podoba úložiště má knihovnu v IDB i v revize_el_dok (výchozí stav)',
      predOtisk.maKnihovnuVls && predOtisk.maKnihovnuVIdb, JSON.stringify(predOtisk));

    await p.reload();   // opravený kód znovu nad touhle (starou podobou) storage
    await w(1200);

    const poOtisk = await p.evaluate(async (uid) => {
      await dokNacist();
      const x = DOK.dokumenty.find(d => d.uid === uid);
      return {
        knihPocet: (DOK.rozvKnihovna || []).length,
        dokumenty: JSON.stringify(DOK.dokumenty.map(d => d.data)),
        maKnihovnuVls: !!JSON.parse(localStorage.getItem('revize_el_dok') || '{}').rozvKnihovna,
        oznaceni: x ? x.data.oznaceni : null
      };
    }, uidRozv);
    check('přechod: po novém čtení je knihovna celá (300 položek)', poOtisk.knihPocet === 300, poOtisk.knihPocet);
    check('přechod: revize_el_dok knihovnu po načtení dál nenese', !poOtisk.maKnihovnuVls);
    check('přechod: dokumenty (rozvaděč RH-PRECHOD) bajtově beze změny', poOtisk.dokumenty === predOtisk.dokumenty && poOtisk.oznaceni === 'RH-PRECHOD');
    check('bez chyb v konzoli (scénář přechodu)', !p.__err.length, p.__err.join(' | '));
    await p.context().close();
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5) Víc oken — import v jednom, druhé knihovnu uvidí (BroadcastChannel).
  //    Dvě okna téhož prohlížeče = dvě stránky v JEDNOM BrowserContextu
  //    (samostatné `newContext()` by byly dvě izolovaná „profilová" úložiště).
  // ═══════════════════════════════════════════════════════════════════
  {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
    await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
    const url = 'http://127.0.0.1:' + PORT + '/index.html';
    const pA = await ctx.newPage(); await pA.goto(url); await w(800);
    const pB = await ctx.newPage(); await pB.goto(url); await w(800);
    await importKnihovnu(pA, genCsv(50));
    await w(600);
    const pocetB = await pB.evaluate(async () => { await dokNacist(); return DOK.rozvKnihovna.length; });
    check('dvě okna: import v okně A se objeví v okně B', pocetB === 50, pocetB);
    await ctx.close();
  }

  // ═══════════════════════════════════════════════════════════════════
  // 6) Záloha — ruční (celá), automatická (bez importu), obnova.
  // ═══════════════════════════════════════════════════════════════════
  {
    const p = await stranka(b, PORT);
    await importKnihovnu(p, genCsv(100));   // „import" (zdroj: 'import')
    await p.evaluate(async () => {
      await dokNacist();
      DOK.rozvKnihovna.push({ id: 'uVlastni1', druh: 'pristroj', kat: 'FA', nazev: 'Vlastní jistič', zdroj: 'vlastni', poly: '1', In: 16 });
      await dokZapsat();
      rozvKnihovnaZmenena();
    });
    await w(300);

    // ruční záloha nese knihovnu celou (101 položek)
    const rucni = await p.evaluate(async () => {
      const blob = buildZalohaBlob();
      const text = await blob.text();
      return JSON.parse(text);
    });
    check('ruční záloha nese celou knihovnu (101 položek)', (rucni.dokumentace.rozvKnihovna || []).length === 101, rucni.dokumentace.rozvKnihovna.length);
    check('ruční záloha nemá příznak rozvKnihovnaBezImportu', !rucni.dokumentace.rozvKnihovnaBezImportu);

    // automatická záloha vynechá import (jen vlastní — 1 položka)
    const auto = await p.evaluate(async () => {
      const blob = buildZalohaBlob(null, true);
      const text = await blob.text();
      return JSON.parse(text);
    });
    check('automatická záloha nese jen vlastní položky (1)', (auto.dokumentace.rozvKnihovna || []).length === 1 &&
      auto.dokumentace.rozvKnihovna[0].id === 'uVlastni1', JSON.stringify(auto.dokumentace.rozvKnihovna));
    check('automatická záloha má příznak rozvKnihovnaBezImportu', auto.dokumentace.rozvKnihovnaBezImportu === true);

    // obnova automatické zálohy na čistém stavu, kde import ZŮSTAL a přibyla další vlastní položka
    await p.evaluate(async () => {
      await dokNacist();
      DOK.rozvKnihovna.push({ id: 'uVlastni2', druh: 'pristroj', kat: 'FA', nazev: 'Druhá vlastní (po záloze)', zdroj: 'vlastni', poly: '1', In: 20 });
      await dokZapsat();
      rozvKnihovnaZmenena();
    });
    await p.evaluate((data) => { window.__autoBackupData = data; }, auto);
    const poObnove = await p.evaluate(async () => {
      dokObnovitZeZalohy(window.__autoBackupData.dokumentace);
      await new Promise(r => setTimeout(r, 100));
      return {
        celkem: DOK.rozvKnihovna.length,
        import: DOK.rozvKnihovna.filter(x => x.zdroj === 'import').length,
        maVlastni2: DOK.rozvKnihovna.some(x => x.id === 'uVlastni2')
      };
    });
    check('obnova automatické zálohy NESMAZALA importovanou knihovnu (100)', poObnove.import === 100, poObnove.import);
    check('obnova automatické zálohy nesmazala vlastní položku vzniklou AŽ PO záloze (merge podle id)', poObnove.maVlastni2);
    check('celkem po obnově 102 položek (100 import + uVlastni1 + uVlastni2)', poObnove.celkem === 102, poObnove.celkem);

    // starší záloha s celou knihovnou (bez příznaku) se obnoví jako dřív (plné přepsání)
    const stareFormat = JSON.parse(JSON.stringify(rucni));   // 101 položek, bez rozvKnihovnaBezImportu
    await p.evaluate((data) => { window.__stareZalohaData = data; }, stareFormat);
    const poStare = await p.evaluate(async () => {
      dokObnovitZeZalohy(window.__stareZalohaData.dokumentace);
      await new Promise(r => setTimeout(r, 100));
      return DOK.rozvKnihovna.length;
    });
    check('starší záloha (celá knihovna, bez příznaku) obnoví přesně svůj počet (101)', poStare === 101, poStare);

    check('bez chyb v konzoli (scénář záloh)', !p.__err.length, p.__err.join(' | '));
    await p.context().close();
  }

  console.log(res.join('\n'));
  const spatne = res.filter(r => r.startsWith('❌')).length;
  console.log('\nCELKEM ŠPATNĚ: ' + spatne);
  await b.close();
  process.exit(spatne ? 1 : 0);
})();
