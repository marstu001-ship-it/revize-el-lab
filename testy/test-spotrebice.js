// v9.67 — Revize elektrických spotřebičů (ČSN 33 1600 ed.2), nový typ zprávy.
// Předloha: protokoly kolegy Jana Nováka (snímky 2026-09-17).
// v9.69 — formulář JE protokol: jeden list místo tabů, skutečná pole zprávy
// se do něj stěhují, v PDF je podpisová čára a nikde není vodorovný posuvník.
const { chromium } = require('./pw');
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));

(async () => {
  const br = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await br.newContext({ viewport: { width: 1700, height: 1000 } });
  await ctx.addInitScript(() => { navigator.serviceWorker.register = () => new Promise(() => {}); });
  const p = await ctx.newPage();
  const chyby = []; p.on('pageerror', e => chyby.push(e.message));
  await p.goto('http://127.0.0.1:8901/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1400);

  // ══ 1. Nový typ je zaregistrovaný ═══════════════════════════════
  const typ = await p.evaluate(() => ({
    vTabulce: !!TYPY_ZPRAV.spotrebice,
    label: typInfo('spotrebice').label,
    prefix: typInfo('spotrebice').prefix,
    planDruh: typInfo('spotrebice').planDruh,
    karta: !!document.getElementById('pt-spotrebice'),
    bar: !!document.getElementById('tab-bar-spotrebice'),
    nahled: !!document.getElementById('screen-spotrebice-pdf')
  }));
  check('typ „spotrebice" je v TYPY_ZPRAV', typ.vTabulce && typ.label === 'Spotřebiče', typ.label);
  check('má vlastní prefix a značku do plánu',
    typ.prefix === 'RSP' && typ.planDruh === 'T', typ.prefix + ' / ' + typ.planDruh);
  check('karta na výběru, tab-bar i obrazovka náhledu existují',
    typ.karta && typ.bar && typ.nahled);

  // ══ 2. Nová zpráva ══════════════════════════════════════════════
  const nova = await p.evaluate(async () => {
    localStorage.clear();
    STORE.technik = { jmeno: 'Jan Novák', mesto: 'Uherském Hradišti' };
    archiv.length = 0; STORE.archiv = archiv;
    volbaPodtypu('spotrebice');
    await new Promise(r => setTimeout(r, 900));
    const prvni = document.querySelector('#spotrebice-body tr');
    const pole = Array.from(prvni.querySelectorAll('.sp-pole'));
    return {
      aktTyp: aktTyp,
      bar: getComputedStyle(document.getElementById('tab-bar-spotrebice')).display,
      jineBary: Object.keys(TYPY_ZPRAV).filter(t => t !== 'spotrebice')
        .map(t => getComputedStyle(document.getElementById(TYPY_ZPRAV[t].bar)).display),
      cislo: document.getElementById('f_ev_cislo').value,
      sloupcu: pole.length,
      klice: pole.map(x => x.dataset.k),
      // nápověda MUSÍ být placeholder, ne hodnota
      hodnoty: pole.map(x => x.value).filter(Boolean),
      placeholdery: pole.filter(x => x.placeholder).length,
      // lhůta se od v9.69 nastavuje PŘÍMO V HLAVIČCE protokolu
      lhutaVListu: !!document.querySelector('#spotrebice-list .sp-slot[data-slot="f_sp_lhuta"] > #f_sp_lhuta'),
      lhutaPopisek: (document.querySelector('#spotrebice-list .sp-hlavicka') || {}).innerText || '',
      // elektro-only karty se u spotřebičů schovají
      napetova: getComputedStyle(document.getElementById('scard-napetova')).display,
      vtez: getComputedStyle(document.getElementById('scard-vtez')).display
    };
  });
  check('volba karty přepne typ na „spotrebice"', nova.aktTyp === 'spotrebice', nova.aktTyp);
  check('vidět je JEN tab-bar spotřebičů',
    nova.bar === 'flex' && nova.jineBary.every(d => d === 'none'), nova.jineBary.join(','));
  check('číslo dostane prefix RSP', /^RSP-\d\d-\d{4}$/.test(nova.cislo), nova.cislo);
  check('tabulka má 20 sloupců podle vzoru', nova.sloupcu === 20, String(nova.sloupcu));
  check('sloupce sedí se vzorem (název → závady)',
    nova.klice[0] === 'nazev' && nova.klice[1] === 'oznaceni' &&
    nova.klice[19] === 'zavady', nova.klice.slice(0, 3).join(',') + ' … ' + nova.klice[19]);
  check('NÁPOVĚDA je jen šedý placeholder, ne vyplněná hodnota',
    nova.placeholdery > 0 && nova.hodnoty.every(v => ['P', 'V'].indexOf(v) >= 0),
    'placeholderů ' + nova.placeholdery + ', hodnot ' + JSON.stringify(nova.hodnoty));
  check('lhůta se volí přímo v hlavičce protokolu', nova.lhutaVListu);
  check('u lhůty je v hlavičce citace normy',
    /ČSN 33 1600 ed\.2 . Z2 . Tabulka 1/.test(nova.lhutaPopisek.replace(/\s+/g, ' ')),
    nova.lhutaPopisek.replace(/\s+/g, ' ').slice(0, 60));
  check('elektro-only karty se u spotřebičů schovají',
    nova.napetova === 'none' && nova.vtez === 'none');

  // ══ 3. Lhůta 6 / 12 / 24 a termín příští revize ═════════════════
  const lhuta = await p.evaluate(async () => {
    const zah = document.getElementById('f_zahajeni');
    const pri = document.getElementById('f_pristi');
    const lh = document.getElementById('f_sp_lhuta');
    const volby = Array.from(lh.options).map(o => o.value);
    zah.value = '2025-11-13';
    const out = { volby: volby, vychozi: lh.value };
    for (const v of ['6', '12', '24']) {
      lh.value = v;
      lh.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 120));
      out[v] = pri.value;
    }
    out.info = document.getElementById('sp-lhuta-info').textContent;
    // ruční termín se NEPŘEPISUJE
    pri.value = '2099-01-01';
    zah.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 120));
    out.rucni = pri.value;
    return out;
  });
  check('nabízí se 3 / 6 / 12 / 24 / 48 / 96 měsíců (ČSN 33 1600 Z2, tab. 1)', lhuta.volby.join(',') === '3,6,12,24,48,96', lhuta.volby.join(','));
  check('výchozí lhůta je 24 měsíců', lhuta.vychozi === '24', lhuta.vychozi);
  check('termín příští revize se dopočítá z lhůty',
    lhuta['6'] === '2026-05-13' && lhuta['12'] === '2026-11-13' && lhuta['24'] === '2027-11-13',
    lhuta['6'] + ' / ' + lhuta['12'] + ' / ' + lhuta['24']);
  check('RUČNĚ zapsaný termín program nepřepíše', lhuta.rucni === '2099-01-01', lhuta.rucni);

  // ══ 4. Data přežijí uložení a načtení z archivu ═════════════════
  const kolecko = await p.evaluate(async () => {
    document.getElementById('f_pristi').value = '2027-11-13';
    document.getElementById('f_ev_cislo').value = '000013';
    document.getElementById('f_misto').value = 'VVZ - m.č. 138';
    document.getElementById('f_provozovatel').value = 'Vzorová firma s.r.o.';
    document.getElementById('spotrebice-body').innerHTML = '';
    addSpotrebicRow({ nazev: 'Varná konvice Hyundai', oznaceni: 'R-185', vyrobce: 'Hyundai',
      vyrcislo: '1552107', trida: 'I', skupina: 'E', un: '240', pn: '2,2', sestava: 'P',
      delka: '0,7', rpe: '0,08', riso: '>19,9', metoda: 'V', imA: '0,0', chod: 'V',
      hodnoceni: 'V', zavady: 'Vyhovuje' });
    addSpotrebicPrivod();
    const D1 = getData();
    saveToArchiv();
    await new Promise(r => setTimeout(r, 300));
    // otevřít znovu z archivu
    aktTyp = 'elektro'; novaZprava('elektro');
    await new Promise(r => setTimeout(r, 500));
    const i = archiv.findIndex(z => z.ev_cislo === '000013');
    otevritZpravu(i);
    await new Promise(r => setTimeout(r, 900));
    const D2 = getData();
    return {
      typVArchivu: archiv[i].typ,
      pred: D1.spotrebice, po: D2.spotrebice,
      aktTyp: aktTyp,
      lhutaPole: document.getElementById('f_sp_lhuta').value
    };
  });
  check('zpráva se uloží do archivu jako typ spotrebice',
    kolecko.typVArchivu === 'spotrebice', kolecko.typVArchivu);
  check('po načtení z archivu se vrátí typ i lhůta',
    kolecko.aktTyp === 'spotrebice' && kolecko.lhutaPole === '24',
    kolecko.aktTyp + ' / ' + kolecko.lhutaPole);
  check('spotřebiče přežijí uložení a načtení beze změny',
    JSON.stringify(kolecko.pred) === JSON.stringify(kolecko.po),
    (kolecko.po.seznam || []).length + ' položek');
  check('prodlužovací přívod má předvyplněnou třídu II a sestavu PP',
    kolecko.po.seznam[1].trida === 'II' && kolecko.po.seznam[1].sestava === 'PP',
    JSON.stringify(kolecko.po.seznam[1]).slice(0, 80));

  // ══ 5. PDF — protokol podle vzoru ═══════════════════════════════
  const pdf = await p.evaluate(async () => {
    const pb = document.getElementById('pristroje-body');
    if (pb) {
      const i = pb.querySelectorAll('input');
      if (i[0]) i[0].value = 'Revex 51';
      if (i[1]) i[1].value = '976772';
      if (i[2]) i[2].value = '20454.1-25-E';
    }
    spotrebiceNahled();
    await new Promise(r => setTimeout(r, 900));
    const strany = Array.from(document.querySelectorAll('#spotrebice-pdf-pages .a4'));
    const vse = document.getElementById('spotrebice-pdf-pages').innerText.replace(/\s+/g, ' ');
    const prvni = strany[0];
    return {
      obrazovka: document.querySelector('.screen.active').id,
      stran: strany.length,
      landscape: strany.every(s => s.classList.contains('a4-landscape')),
      pretece: strany.some(s => s.scrollWidth > s.clientWidth + 2),
      text: vse,
      sloupcuVTabulce: prvni.querySelectorAll('.spotr-tab col').length,
      radkuVTabulce: prvni.querySelectorAll('.spotr-tab tbody tr').length,
      svislych: prvni.querySelectorAll('.spotr-tab th.sv').length
    };
  });
  check('náhled se otevřel na vlastní obrazovce',
    pdf.obrazovka === 'screen-spotrebice-pdf', pdf.obrazovka);
  check('protokol je na ŠÍŘKU a nepřetéká',
    pdf.landscape && !pdf.pretece, 'landscape=' + pdf.landscape + ' přetéká=' + pdf.pretece);
  check('má 2 strany jako vzor (tabulka + vysvětlivky)', pdf.stran === 2, String(pdf.stran));
  check('tabulka má 20 sloupců i v PDF', pdf.sloupcuVTabulce === 20, String(pdf.sloupcuVTabulce));
  check('vytiskly se oba spotřebiče', pdf.radkuVTabulce === 2, String(pdf.radkuVTabulce));
  check('úzké hlavičky jsou otočené na výšku jako ve vzoru',
    pdf.svislych >= 10, pdf.svislych + ' otočených');
  check('nadpis a citace normy sedí se vzorem',
    /Revize elektrických spotřebičů/.test(pdf.text) &&
    /o OPAKOVANÝCH REVIZÍCH elektrických spotřebičů provedených podle ČSN 33 1600 ed\.2/.test(pdf.text),
    (pdf.text.match(/o OPAKOVANÝCH[^.]*ed\.2/) || [''])[0]);
  check('hlavička nese číslo protokolu, budovu a obě data',
    /000013/.test(pdf.text) && /VVZ - m\.č\. 138/.test(pdf.text) &&
    /13\. 11\. 2025/.test(pdf.text) && /13\. 11\. 2027/.test(pdf.text));
  check('lhůta je v hlavičce i ve vysvětlivkách',
    /1x 24 měsíců/.test(pdf.text) && /lhůty 1x za 24 měsíců/.test(pdf.text));
  check('měřicí přístroj se vytiskl',
    /Revex 51/.test(pdf.text) && /20454\.1-25-E/.test(pdf.text));
  check('vysvětlivky obsahují všechny značky ze vzoru',
    /S - spotřebič měřen samostatně/.test(pdf.text) &&
    /VR - měření proudu ochranným vodičem jako rozdílového proudu/.test(pdf.text) &&
    /U prodlužovacích přívodů platí třída ochrany II/.test(pdf.text));
  check('podpisový blok s technikem', /Jméno a příjmení revizního technika/.test(pdf.text) &&
    /Jan Novák/.test(pdf.text));
  check('patička číslování stran', /Strana 1\/2/.test(pdf.text) && /Strana 2\/2/.test(pdf.text));
  check('prázdná buňka se tiskne jako „---", ne jako díra', /---/.test(pdf.text));
  // Placeholder se do PDF NESMÍ dostat
  check('nápověda z formuláře se do protokolu NEVYTISKLA',
    !/Vrtačka Makita HP 1630/.test(pdf.text) && !/R-047/.test(pdf.text));

  // ══ 6. Stránkování při větším počtu ═════════════════════════════
  const hodne = await p.evaluate(async () => {
    spotrebiceNahledZpet();
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('spotrebice-body').innerHTML = '';
    for (let i = 1; i <= 40; i++) {
      addSpotrebicRow({ nazev: 'Spotřebič ' + i, oznaceni: 'R-' + i, trida: 'I',
        skupina: 'E', un: '230', sestava: 'P', metoda: 'V', hodnoceni: 'V', zavady: 'Vyhovuje' });
    }
    spotrebiceNahled();
    await new Promise(r => setTimeout(r, 1200));
    const strany = Array.from(document.querySelectorAll('#spotrebice-pdf-pages .a4'));
    return {
      stran: strany.length,
      vysky: strany.map(s => Math.round(s.getBoundingClientRect().height /
        (s.getBoundingClientRect().width / 297))),
      hlavicek: strany.filter(s => s.querySelector('.spotr-tab thead')).length,
      radku: strany.reduce((n, s) => n + s.querySelectorAll('.spotr-tab tbody tr').length, 0),
      pocetStranVHlavicce: (strany[0].innerText.match(/Počet stran:\s*(\d+)/) || [])[1]
    };
  });
  check('40 spotřebičů se rozdělí na víc stran', hodne.stran >= 3, hodne.stran + ' stran');
  check('žádná strana nepřeteče přes výšku A4 na šířku',
    hodne.vysky.every(v => v <= 212), hodne.vysky.join(' / ') + ' mm');
  check('hlavička tabulky se opakuje na každé stránce s daty',
    hodne.hlavicek === hodne.stran - 1, hodne.hlavicek + ' z ' + (hodne.stran - 1));
  check('nezmizel ani jeden spotřebič', hodne.radku === 40, String(hodne.radku));
  check('„Počet stran" v hlavičce sedí se skutečností',
    hodne.pocetStranVHlavicce === String(hodne.stran), hodne.pocetStranVHlavicce + ' vs ' + hodne.stran);

  // ══ 6b. v9.69 — formulář JE protokol ════════════════════════════
  // Jádro stížnosti uživatele: „ať je vizuál výsledného pdf stejný jako to,
  // co vyplňuju" a „posouvat sliderem tabulku je strašný".
  const list = await p.evaluate(async () => {
    aktTyp = 'spotrebice'; aktPodtyp = 'spotrebice'; novaZprava('spotrebice');
    await new Promise(r => setTimeout(r, 800));
    const bar = document.getElementById('tab-bar-spotrebice');
    const wrap = document.querySelector('#spotrebice-list .sp-sheet-wrap');
    const sheet = wrap && wrap.querySelector('.sp-sheet');
    document.getElementById('f_misto').value = 'Dílna č. 4';
    document.getElementById('f_ev_cislo').value = '000013';
    addSpotrebic();
    await new Promise(r => setTimeout(r, 150));
    return {
      tabu: bar.querySelectorAll('.tab-btn').length,
      list: !!sheet,
      // pole zprávy bydlí UVNITŘ protokolu
      vListu: SPOTR_PRENOS.map(id => {
        const el = document.getElementById(id);
        return id + ':' + (!el ? 'CHYBÍ' : (sheet && sheet.contains(el) ? 'ano' : 'JINDE'));
      }),
      // žádný vodorovný posuvník — ani u listu, ani u stránky
      // zmenšený list se musí VEJÍT do svého místa (scrollWidth tu nic neřekne —
      // `transform` mění jen vykreslení, rozvržení zůstává 281 mm)
      posuvnikListu: sheet.getBoundingClientRect().width > wrap.clientWidth + 2,
      posuvnikStranky: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      merítko: sheet.style.transform,
      sirkaListu: sheet.offsetWidth,
      // protokol má na obrazovce všechny části tištěné strany
      casti: ['.sp-hlavicka', '.spotr-tab', '.sp-pristroje', '.sp-vysv',
              '.sp-podpis', '.sp-podpis-cara'].map(sel => !!sheet.querySelector(sel)),
      // hodnota zapsaná do listu doopravdy doputuje do dat zprávy
      dataMisto: getData().misto,
      // překreslení okolí (mění lhůta) pole nezničí
      poPrekresleni: (function() {
        spotrObnovitOkoli();
        const el = document.getElementById('f_vypracovani');
        return !!el && !!el.closest('.sp-sheet');
      })()
    };
  });
  check('jediný krok „Protokol" místo šesti tabů', list.tabu === 1, String(list.tabu));
  check('formulář je jeden list ve tvaru tištěné strany', list.list);
  check('skutečná pole zprávy bydlí přímo v protokolu',
    list.vListu.every(x => /:ano$/.test(x)), list.vListu.join(', '));
  check('NIKDE není vodorovný posuvník',
    !list.posuvnikListu && !list.posuvnikStranky,
    'list=' + list.posuvnikListu + ' stránka=' + list.posuvnikStranky);
  check('list je přesně tak široký jako obsah A4 na šířku (281 mm)',
    Math.abs(list.sirkaListu - 281 * 96 / 25.4) < 3,
    list.sirkaListu + 'px, měřítko ' + (list.merítko || '1:1'));
  check('na obrazovce jsou všechny části tištěné strany včetně podpisové čáry',
    list.casti.every(Boolean), JSON.stringify(list.casti));
  check('zápis do protokolu se propíše do dat zprávy', list.dataMisto === 'Dílna č. 4', list.dataMisto);
  check('překreslení okolí pole zprávy nezničí', list.poPrekresleni);

  // Přístroje se půjčují z tabu Přístroje a musí se vrátit.
  const pr = await p.evaluate(async () => {
    spotrPristrojeOtevrit();
    const v = !!document.querySelector('#sp-pristroje-host .scard');
    spotrPristrojeZavrit();
    await new Promise(r => setTimeout(r, 150));
    return { vPrekryvu: v, vratila: !!document.querySelector('#tab-pristroje .scard'),
             otevreny: document.getElementById('modal-sp-pristroje').classList.contains('open') };
  });
  check('karta měřicích přístrojů se půjčí do překryvu a vrátí zpět',
    pr.vPrekryvu && pr.vratila && !pr.otevreny,
    'v překryvu=' + pr.vPrekryvu + ' vrácena=' + pr.vratila);

  // PDF musí mít podpisovou čáru — to uživatel nahlásil jako chybu v9.67.
  const pod = await p.evaluate(async () => {
    spotrebiceNahled();
    await new Promise(r => setTimeout(r, 700));
    const box = document.getElementById('spotrebice-pdf-pages');
    const posl = box.lastElementChild;
    return { cara: !!posl.querySelector('.sp-podpis-cara'),
             popisky: [...posl.querySelectorAll('.sp-podpis-popisky > div')].map(x => x.textContent.trim()),
             text: posl.innerText.replace(/\s+/g, ' ') };
  });
  check('v PDF je podpisová čára', pod.cara);
  check('pod čarou je vlevo jméno technika a vpravo „podpis"',
    pod.popisky.length === 2 && /Jméno a příjmení revizního technika/.test(pod.popisky[0]) &&
    pod.popisky[1] === 'podpis', JSON.stringify(pod.popisky));
  check('nad čarou stojí jméno technika z profilu',
    /Jan Novák/.test(pod.text));

  // Úzké okno i postranní archiv berou formuláři šířku — protokol se musí
  // přeměřit, jinak by uřízl pravé sloupce. (Pod 1400 px panel LEŽÍ PŘES
  // obsah, takže šířku neubírá — proto se to zkouší na širokém okně.)
  const siroke = await p.evaluate(async () => {
    aktTyp = 'spotrebice'; aktPodtyp = 'spotrebice'; novaZprava('spotrebice');
    await new Promise(r => setTimeout(r, 700));
    const zmer = () => {
      const w = document.querySelector('#spotrebice-list .sp-sheet-wrap');
      const sh = w.querySelector('.sp-sheet');
      return { vejde: sh.getBoundingClientRect().width <= w.clientWidth + 2,
               k: sh.getBoundingClientRect().width / sh.offsetWidth };
    };
    formArchivNastavit(false);
    await new Promise(r => setTimeout(r, 250));
    const bez = zmer();
    formArchivNastavit(true);
    await new Promise(r => setTimeout(r, 300));
    const sP = zmer();
    formArchivSirkaNastav(760, false);      // panel roztažený myší na maximum
    await new Promise(r => setTimeout(r, 300));
    const siroky = zmer();
    formArchivSirkaNastav(280, false);
    formArchivNastavit(false);
    await new Promise(r => setTimeout(r, 300));
    return { bez, sP, siroky, zpet: zmer() };
  });
  check('na širokém okně se protokol tiskne 1:1 (nezmenšuje se)',
    siroke.bez.vejde && siroke.bez.k > 0.999, 'měřítko ' + siroke.bez.k.toFixed(3));
  check('s otevřeným postranním archivem se protokol pořád vejde',
    siroke.sP.vejde, 'měřítko ' + siroke.sP.k.toFixed(3));
  check('roztažený panel protokol zmenší, ne ořízne',
    siroke.siroky.vejde && siroke.siroky.k < siroke.bez.k,
    siroke.bez.k.toFixed(3) + ' → ' + siroke.siroky.k.toFixed(3));
  check('po zavření panelu se protokol zase roztáhne',
    siroke.zpet.vejde && siroke.zpet.k > siroke.siroky.k, siroke.zpet.k.toFixed(3));

  await p.setViewportSize({ width: 1000, height: 900 });
  await p.waitForTimeout(400);
  const uzke = await p.evaluate(() => {
    const w = document.querySelector('#spotrebice-list .sp-sheet-wrap');
    const sh = w.querySelector('.sp-sheet');
    return { vejde: sh.getBoundingClientRect().width <= w.clientWidth + 2,
             k: sh.getBoundingClientRect().width / sh.offsetWidth,
             posuvnik: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2 };
  });
  check('na úzkém okně se protokol zmenší, ale nikdy se neposouvá vodorovně',
    uzke.vejde && uzke.k < 1 && !uzke.posuvnik,
    'měřítko ' + uzke.k.toFixed(3) + ', posuvník ' + uzke.posuvnik);
  await p.setViewportSize({ width: 1700, height: 1000 });
  await p.waitForTimeout(300);

  // ══ 6c. v9.70 — vyplňování jako v Excelu, místo vystavení, vzhled ══
  const excel = await p.evaluate(async () => {
    aktTyp = 'spotrebice'; aktPodtyp = 'spotrebice'; novaZprava('spotrebice');
    await new Promise(r => setTimeout(r, 800));
    const tb = document.getElementById('spotrebice-body');
    tb.innerHTML = '';
    addSpotrebicRow({ nazev: 'Lampa stolní', oznaceni: 'R-178', vyrobce: 'Elektrosvit',
                      trida: 'II', skupina: 'E', un: '230' });
    addSpotrebicRow({ nazev: 'Lednice' });
    const bunka = (i, k) => tb.children[i].querySelector('[data-k="' + k + '"]');
    const klavesa = (el, key, o) => {
      el.focus();
      const e = new KeyboardEvent('keydown', Object.assign({ key, bubbles: true, cancelable: true }, o || {}));
      el.dispatchEvent(e);
      return e.defaultPrevented;
    };

    // ⧉ kopie řádku i s hodnotami, hned pod originál
    copySpotrebic(tb.children[0].querySelector('[data-action="copySpotrebic"]'));
    const kopie = tb.children[1];
    const kopieSedi = ['nazev', 'oznaceni', 'vyrobce', 'trida', 'skupina', 'un']
      .every(k => kopie.querySelector('[data-k="' + k + '"]').value ===
                  tb.children[0].querySelector('[data-k="' + k + '"]').value);
    const kopiePodOriginalem = tb.children[2].querySelector('[data-k="nazev"]').value === 'Lednice';
    tb.removeChild(kopie);

    // Enter = o řádek níž ve STEJNÉM sloupci
    const a = bunka(0, 'vyrobce');
    klavesa(a, 'Enter');
    const poEnteru = document.activeElement.dataset.k + '/' +
      Array.prototype.indexOf.call(tb.children, document.activeElement.closest('tr'));
    // Shift+Enter zpátky nahoru
    klavesa(document.activeElement, 'Enter', { shiftKey: true });
    const poShiftEnteru = document.activeElement.dataset.k + '/' +
      Array.prototype.indexOf.call(tb.children, document.activeElement.closest('tr'));

    // Ctrl+D převezme hodnotu z buňky nad kurzorem
    const cil = bunka(1, 'vyrobce');
    cil.value = '';
    klavesa(cil, 'd', { ctrlKey: true });
    const poCtrlD = cil.value;

    // šipky nahoru/dolů = mezi řádky
    klavesa(bunka(0, 'oznaceni'), 'ArrowDown');
    const poSipce = document.activeElement.dataset.k + '/' +
      Array.prototype.indexOf.call(tb.children, document.activeElement.closest('tr'));

    // ← → jen na KRAJI textu, jinak se jimi opravuje překlep uvnitř slova
    const t = bunka(0, 'vyrobce');
    t.focus(); t.setSelectionRange(3, 3);
    const uvnitrZabraneno = klavesa(t, 'ArrowRight');
    t.setSelectionRange(t.value.length, t.value.length);
    klavesa(t, 'ArrowRight');
    const poSipceVpravo = document.activeElement.dataset.k;

    // Enter na POSLEDNÍM vyplněném řádku založí další
    const predtim = tb.children.length;
    klavesa(bunka(tb.children.length - 1, 'nazev'), 'Enter');
    const proste = tb.children.length;
    // ...a na prázdném už ne
    klavesa(bunka(tb.children.length - 1, 'nazev'), 'Enter');
    const neroste = tb.children.length;

    return { kopieSedi, kopiePodOriginalem, poEnteru, poShiftEnteru, poCtrlD, poSipce,
             uvnitrZabraneno, poSipceVpravo, predtim, proste, neroste };
  });
  check('⧉ zkopíruje řádek i s hodnotami hned pod originál',
    excel.kopieSedi && excel.kopiePodOriginalem);
  check('Enter skočí o řádek níž ve stejném sloupci', excel.poEnteru === 'vyrobce/1', excel.poEnteru);
  check('Shift+Enter skočí zpátky nahoru', excel.poShiftEnteru === 'vyrobce/0', excel.poShiftEnteru);
  check('Ctrl+D převezme hodnotu z buňky nad kurzorem',
    excel.poCtrlD === 'Elektrosvit', excel.poCtrlD);
  check('šipka dolů přejde na další řádek', excel.poSipce === 'oznaceni/1', excel.poSipce);
  check('šipka vpravo UVNITŘ textu jen posune kurzor, buňku nepřepne',
    excel.uvnitrZabraneno === false);
  check('šipka vpravo na konci textu přejde do vedlejšího sloupce',
    excel.poSipceVpravo === 'rok', excel.poSipceVpravo);
  check('Enter na posledním vyplněném řádku založí další',
    excel.proste === excel.predtim + 1, excel.predtim + ' → ' + excel.proste);
  check('na prázdném řádku už Enter další nezakládá',
    excel.neroste === excel.proste, String(excel.neroste));

  // Místo vystavení — revize se dělá u zákazníka, ne v kanceláři technika.
  const misto = await p.evaluate(async () => {
    const pole = document.getElementById('f_predano_misto');
    const vListu = !!(pole && pole.closest('.sp-sheet'));
    pole.value = 'Kyjově';
    pole.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#spotrebice-body [data-k="nazev"]').value = 'Lampa';
    spotrebiceNahled();
    await new Promise(r => setTimeout(r, 700));
    const posl = document.getElementById('spotrebice-pdf-pages').lastElementChild;
    const txt = posl.innerText.replace(/\s+/g, ' ');
    return { vListu, txt, profil: (STORE.technik || {}).mesto };
  });
  check('místo vystavení se vyplňuje přímo v protokolu', misto.vListu);
  check('v PDF je místo ze zprávy, ne město z profilu technika',
    /v Kyjově dne/.test(misto.txt) && misto.txt.indexOf(misto.profil) === -1,
    misto.profil + ' → ' + (misto.txt.match(/v \S+ dne/) || [''])[0]);

  // Vzhled — kvůli tomu to vzniklo („naše zpráva je vizuálně hnusná").
  const vzhled = await p.evaluate(function() {
    const str = document.getElementById('spotrebice-pdf-pages').firstElementChild;
    const list = document.querySelector('#spotrebice-list .sp-sheet');
    const mono = function(el) { return /Courier|monospace/i.test(getComputedStyle(el).fontFamily); };
    const jinaZprava = document.querySelector('#pdf-pages .a4');
    return {
      pdfMono: mono(str), listMono: mono(list),
      thPdf: getComputedStyle(str.querySelector('.spotr-tab th')).backgroundColor,
      thList: getComputedStyle(list.querySelector('.spotr-tab th')).backgroundColor,
      vzorku: document.querySelectorAll('#sp-barvy .sp-barva').length,
      vTisku: (getData().tisk || {}).pozadiTisku,
      elektroMono: jinaZprava ? mono(jinaZprava) : 'nekresleno'
    };
  });
  check('protokol NENÍ psacím strojem — na obrazovce ani v PDF',
    !vzhled.pdfMono && !vzhled.listMono,
    'pdf mono=' + vzhled.pdfMono + ', list mono=' + vzhled.listMono);
  check('hlavičky jsou podbarvené na obrazovce i v PDF, a stejně',
    vzhled.thPdf === vzhled.thList && vzhled.thPdf !== 'rgba(0, 0, 0, 0)',
    vzhled.thList + ' / ' + vzhled.thPdf);
  check('podbarvení se vybírá z palety a ukládá se se zprávou',
    vzhled.vzorku === 6 && !!vzhled.vTisku, vzhled.vzorku + ' vzorků, ' + vzhled.vTisku);

  const barva = await p.evaluate(async () => {
    spotrBarva({ dataset: { barva: '' } });                // „bílá (bez barvy)"
    await new Promise(r => setTimeout(r, 150));
    const list = document.querySelector('#spotrebice-list .sp-sheet');
    const bila = getComputedStyle(list.querySelector('.spotr-tab th')).backgroundColor;
    spotrBarva({ dataset: { barva: '#eefaf0' } });
    await new Promise(r => setTimeout(r, 150));
    return { bila, zelena: getComputedStyle(list.querySelector('.spotr-tab th')).backgroundColor,
             oznacenych: document.querySelectorAll('#sp-barvy .sp-barva.je').length };
  });
  check('volba „bílá" podbarvení opravdu zruší',
    barva.bila === 'rgb(255, 255, 255)', barva.bila);
  check('jiná barva se projeví hned a vzorek se označí',
    barva.zelena === 'rgb(238, 250, 240)' && barva.oznacenych === 1,
    barva.zelena + ', označených ' + barva.oznacenych);

  // Přístroje z PROFILU TECHNIKA — do v9.71 se sahalo po neexistujícím klíči
  // `vyrobni` (správně `vyrCislo`), takže sloupec „Výrobní číslo" zůstal
  // prázdný, i když ho technik měl v Nastavení vyplněný.
  const pristr = await p.evaluate(async () => {
    STORE.pristroje = [
      { nazev: 'Revex 51', vyrCislo: '976772', kalibrace: '20454.1-25-E', platnost: '2027-03-31' },
      { nazev: '', vyrCislo: '21360531', kalibrace: '', platnost: '' }   // jen výrobní číslo
    ];
    saveStore();
    aktTyp = 'spotrebice'; aktPodtyp = 'spotrebice'; novaZprava('spotrebice');
    await new Promise(r => setTimeout(r, 800));
    const radky = (sel) => {
      const t = document.querySelector(sel + ' .sp-pristroje');
      return t ? [...t.querySelectorAll('tbody tr')].map(tr =>
        [...tr.children].map(td => td.textContent.trim())) : [];
    };
    const vListu = radky('#spotrebice-list');
    document.querySelector('#spotrebice-body [data-k="nazev"]').value = 'Lampa';
    spotrebiceNahled();
    await new Promise(r => setTimeout(r, 700));
    return { vListu, vPdf: radky('#spotrebice-pdf-pages') };
  });
  check('výrobní číslo přístroje z profilu je v protokolu na obrazovce',
    (pristr.vListu[0] || [])[1] === '976772', JSON.stringify(pristr.vListu[0]));
  check('výrobní číslo přístroje se vytiskne i do PDF',
    (pristr.vPdf[0] || [])[1] === '976772', JSON.stringify(pristr.vPdf[0]));
  check('číslo kalibračního listu sedí taky',
    (pristr.vPdf[0] || [])[2] === '20454.1-25-E', (pristr.vPdf[0] || [])[2]);
  check('přístroj zapsaný JEN výrobním číslem se neztratí',
    pristr.vPdf.length === 2 && pristr.vPdf[1][1] === '21360531',
    pristr.vPdf.length + ' řádků');

  // ══ 6d. v9.73 — nápověda u voleb ════════════════════════════════
  // „jsem hlava děravá a potřebuju… nápovědu, jaké spotřebiče jsou jaká
  // třída, ať vím, co tam dát."
  const nap = await p.evaluate(async () => {
    aktTyp = 'spotrebice'; aktPodtyp = 'spotrebice'; novaZprava('spotrebice');
    await new Promise(r => setTimeout(r, 800));
    // texty pro sestavu/metodu/hodnocení se MUSÍ brát z legendy protokolu
    const zLegendy = {};
    SPOTR_VYSVETLIVKY.forEach(sl => sl.forEach(pp => {
      String(pp[1]).split('\n').forEach(r => {
        const m = r.match(/^\s*(\S+)\s+-\s+(.+)$/);
        if (m) zLegendy[pp[0] + '|' + m[1]] = m[2].trim();
      });
    }));
    return {
      sestava: SPOTR_NAPOVEDA.sestava,
      sestavaVLegende: ['S', 'P', 'O', 'PP', 'OP'].every(k =>
        SPOTR_NAPOVEDA.sestava[k] === zLegendy['5)|' + k]),
      metodaKlice: Object.keys(SPOTR_NAPOVEDA.metoda),
      metodaVLegende: ['V', 'VR', 'D', 'DR', 'U'].every(k =>
        SPOTR_NAPOVEDA.metoda[k] === zLegendy['6)|' + k]),
      hodnoceniVLegende: SPOTR_NAPOVEDA.chod.V === zLegendy['4)|V'] &&
        SPOTR_NAPOVEDA.chod.N === zLegendy['4)|N'],
      // třída a skupina v legendě vysvětlené nejsou — musí mít vlastní text
      trida: Object.keys(SPOTR_NAPOVEDA.trida),
      skupina: Object.keys(SPOTR_NAPOVEDA.skupina),
      // každá nabízená volba musí mít vysvětlení, žádná nesmí zůstat holá
      chybi: SPOTR_SLOUPCE.filter(c => c.volby).reduce((a, c) => a.concat(
        c.volby.filter(v => v && !spotrNapoveda(c.k, v)).map(v => c.k + ':' + v)), [])
    };
  });
  check('sestava má vysvětlení PŘESNĚ podle legendy protokolu',
    nap.sestavaVLegende, JSON.stringify(nap.sestava.PP));
  check('metoda má všech pět kódů, i „U" z druhého sloupce legendy',
    nap.metodaKlice.join(',') === 'V,VR,D,DR,U' && nap.metodaVLegende, nap.metodaKlice.join(','));
  check('zkouška chodu i celkové hodnocení berou text z legendy', nap.hodnoceniVLegende);
  check('třída má vysvětlené I, II i III', nap.trida.join(',') === 'I,II,III', nap.trida.join(','));
  check('skupina má vysvětlené A–E', nap.skupina.join(',') === 'A,B,C,D,E', nap.skupina.join(','));
  check('ŽÁDNÁ nabízená volba nezůstala bez vysvětlení',
    nap.chybi.length === 0, nap.chybi.join(', ') || 'všechny vysvětlené');

  // Nabídka se otevře kliknutím a ukáže vysvětlení u každé volby
  await p.click('#spotrebice-body [data-k="trida"]');
  await p.waitForTimeout(250);
  const menu = await p.evaluate(() => {
    const b = document.querySelector('.sp-volby');
    if (!b) return { je: false };
    const r = [...b.querySelectorAll('.sp-volba')];
    return { je: true, pocet: r.length,
      kody: r.map(x => x.querySelector('.sp-volba-kod').textContent.trim()),
      popisy: r.map(x => x.querySelector('.sp-volba-popis').textContent.trim()),
      vBody: b.parentElement === document.body,
      naObrazovce: b.getBoundingClientRect().right <= window.innerWidth + 1 &&
                   b.getBoundingClientRect().bottom <= window.innerHeight + 1 };
  });
  check('klepnutí na volbu otevře nabídku s vysvětlivkami', menu.je && menu.pocet === 4,
    menu.pocet + ' položek');
  check('u každé volby je kód i vysvětlení',
    menu.popisy.every(t => t.length > 5) && menu.kody.join(',') === '—,I,II,III',
    menu.kody.join(','));
  check('nabídka vysvětluje, co je která třída',
    /ochranným vodičem/.test(menu.popisy[1]) && /dvojitou nebo zesílenou izolací/.test(menu.popisy[2]),
    menu.popisy[1].slice(0, 40));
  // Leží v body, jinak by ji uřízl overflow zmenšeného listu, a vejde se do okna.
  check('nabídka leží mimo list a vejde se do okna', menu.vBody && menu.naObrazovce);

  // Výběr zapíše hodnotu a promítne se do dat
  const vyber = await p.evaluate(async () => {
    const udalosti = [];
    const sel = document.querySelector('#spotrebice-body [data-k="trida"]');
    sel.addEventListener('input', () => udalosti.push('input'));
    sel.addEventListener('change', () => udalosti.push('change'));
    [...document.querySelectorAll('.sp-volba')].find(x =>
      x.querySelector('.sp-volba-kod').textContent.trim() === 'II').click();
    await new Promise(r => setTimeout(r, 200));
    document.querySelector('#spotrebice-body [data-k="nazev"]').value = 'Vrtačka';
    return { hodnota: sel.value, udalosti, zavrena: !document.querySelector('.sp-volby'),
             titulek: sel.title, vDatech: (getData().spotrebice.seznam[0] || {}).trida };
  });
  check('výběr z nabídky zapíše hodnotu do buňky', vyber.hodnota === 'II', vyber.hodnota);
  check('zápis ohlásí input i change, ať se zpráva označí jako změněná',
    vyber.udalosti.indexOf('input') >= 0 && vyber.udalosti.indexOf('change') >= 0,
    vyber.udalosti.join(','));
  check('po výběru se nabídka zavře', vyber.zavrena);
  check('bublina u buňky říká, co v ní je', /^II — spotřebič s dvojitou/.test(vyber.titulek),
    vyber.titulek.slice(0, 30));
  check('hodnota z nabídky se propíše do dat zprávy', vyber.vDatech === 'II', vyber.vDatech);

  // Esc zavře, klik jinam zavře, Ctrl+D na rozbalovátku pořád funguje
  const ovladani = await p.evaluate(async () => {
    const otevri = (k, i) => {
      const s = document.querySelectorAll('#spotrebice-body [data-k="' + k + '"]')[i || 0];
      s.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      return s;
    };
    const s1 = otevri('skupina');
    const poOtevreni = !!document.querySelector('.sp-volby');
    document.querySelector('.sp-volby').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const poEsc = !!document.querySelector('.sp-volby');
    otevri('skupina');
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const poKliku = !!document.querySelector('.sp-volby');
    // mousedown na rozbalovátku musí být zrušený, aby se neotevřelo nativní
    const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    s1.dispatchEvent(ev);
    const zruseno = ev.defaultPrevented;
    spotrNabidkaZavrit(false);
    // Ctrl+D na rozbalovátku — převzetí hodnoty shora funguje dál
    addSpotrebicRow({ trida: 'III' }); addSpotrebicRow({});
    const rady = document.querySelectorAll('#spotrebice-body tr');
    const cil = rady[rady.length - 1].querySelector('[data-k="trida"]');
    const zdroj = rady[rady.length - 2].querySelector('[data-k="trida"]');
    cil.focus();
    cil.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true, cancelable: true }));
    return { poOtevreni, poEsc, poKliku, zruseno, ctrlD: cil.value, zdroj: zdroj.value };
  });
  check('nabídka jde otevřít i u skupiny', ovladani.poOtevreni);
  check('Esc nabídku zavře', !ovladani.poEsc);
  check('klepnutí jinam nabídku zavře', !ovladani.poKliku);
  check('nativní rozbalovátko se neotevře (mousedown je zrušený)', ovladani.zruseno);
  check('Ctrl+D na rozbalovátku funguje dál', ovladani.ctrlD === 'III',
    ovladani.ctrlD + ' vs ' + ovladani.zdroj);

  // Rolování kolečkem UVNITŘ nabídky ji nesmí zavřít — stejná chyba jako
  // u našeptávání místa (uživatel 2026-09-18). Nabídka má `overflow:auto`,
  // takže u delšího výčtu voleb se v ní roluje.
  const roleni = await p.evaluate(async () => {
    aktTyp = 'spotrebice'; aktPodtyp = 'spotrebice'; novaZprava('spotrebice');
    await new Promise(r => setTimeout(r, 800));
    spotrNabidkaOtevrit(document.querySelector('#spotrebice-body [data-k="metoda"]'));
    await new Promise(r => setTimeout(r, 200));
    const b = document.querySelector('.sp-volby');
    if (!b) return { je: false };
    b.dispatchEvent(new Event('scroll', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    const poUvnitr = !!document.querySelector('.sp-volby');
    document.dispatchEvent(new Event('scroll', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    return { je: true, poUvnitr, poStrance: !!document.querySelector('.sp-volby') };
  });
  check('rolování uvnitř nabídky voleb ji nezavře', roleni.je && roleni.poUvnitr);
  check('rolování stránky nabídku voleb zavře', !roleni.poStrance);

  // Do PDF se nabídka nesmí dostat  // Do PDF se nabídka nesmí dostat
  const vPdf = await p.evaluate(async () => {
    spotrebiceNahled();
    await new Promise(r => setTimeout(r, 700));
    const box = document.getElementById('spotrebice-pdf-pages');
    return { nabidka: box.querySelectorAll('.sp-volby').length,
             selecty: box.querySelectorAll('select').length };
  });
  check('v PDF není ani nabídka, ani rozbalovátka',
    vPdf.nabidka === 0 && vPdf.selecty === 0,
    'nabídek ' + vPdf.nabidka + ', selectů ' + vPdf.selecty);

  // ══ 6e. v9.75 — protokol NESMÍ krást pole jiné zprávě ═══════════
  // Nahlásil uživatel 2026-09-18: „jen u rozpracované zprávy elektro mi
  // zmizelo okénko pro místo revize, zahájení a vypracování zprávy."
  // Protokol spotřebičů zůstal viset ve skrytém tabu a při každé obnově
  // okolí si pole zase přitáhl k sobě.
  const kradez = await p.evaluate(async () => {
    const kde = () => {
      const o = {};
      SPOTR_PRENOS.forEach(id => {
        const el = document.getElementById(id);
        o[id] = !el ? 'CHYBÍ' : (el.closest('#tab-spotrebice') ? 'ukradeno' : 'doma');
      });
      return o;
    };
    // 1) zpráva o spotřebičích — pole patří do protokolu
    aktTyp = 'spotrebice'; aktPodtyp = 'spotrebice'; novaZprava('spotrebice');
    await new Promise(r => setTimeout(r, 800));
    const vProtokolu = Object.values(kde()).every(v => v === 'ukradeno');

    // 2) přepnutí na elektro — pole domů a list se zahodí
    aktTyp = 'elektro'; aktPodtyp = 'dum'; novaZprava('elektro');
    await new Promise(r => setTimeout(r, 700));
    const poPrepnuti = kde();
    const listZahozen = !document.querySelector('#spotrebice-list .sp-sheet');

    // 3) běžná práce na elektro zprávě NESMÍ pole odstěhovat
    const z = document.getElementById('f_zahajeni');
    z.value = '2026-05-01'; z.dispatchEvent(new Event('change', { bubbles: true }));
    const l = document.getElementById('f_sp_lhuta');
    if (l) l.dispatchEvent(new Event('change', { bubbles: true }));
    // …a ani přímé zavolání funkcí, které to dřív dělaly
    spotrObnovitOkoli();
    spotrPrenosPoli(true);
    await new Promise(r => setTimeout(r, 250));
    const poPraci = kde();

    // 4) hodnoty zůstaly a zpráva se uloží se vším
    document.getElementById('f_misto').value = 'Garáže autobusů – V3';
    document.getElementById('f_ev_cislo').value = 'RE-26-10001';
    const D = getData();
    return { vProtokolu, poPrepnuti, listZahozen, poPraci,
             data: { misto: D.misto, cislo: D.ev_cislo } };
  });
  check('u zprávy o spotřebičích pole v protokolu BYDLÍ', kradez.vProtokolu);
  check('po přepnutí na elektro jsou pole zpátky na svém místě',
    Object.values(kradez.poPrepnuti).every(v => v === 'doma'),
    JSON.stringify(kradez.poPrepnuti));
  check('protokol spotřebičů se po přepnutí zahodí, ať nemá co krást',
    kradez.listZahozen);
  check('práce na elektro zprávě pole NEODSTĚHUJE (ani při přímém volání)',
    Object.values(kradez.poPraci).every(v => v === 'doma'),
    JSON.stringify(kradez.poPraci));
  check('hodnoty v polích se přitom nikam neztratí',
    kradez.data.misto === 'Garáže autobusů – V3' && kradez.data.cislo === 'RE-26-10001',
    JSON.stringify(kradez.data));

  // Totéž při otevření zprávy z archivu (uživatel to měl na rozpracované)
  const zArchivu = await p.evaluate(async () => {
    archiv.length = 0;
    archiv.push({ uid: 'e1', typ: 'elektro', podtyp: 'dum', ev_cislo: 'RE-26-10001',
      misto: 'Garáže autobusů – V3', stav: 'aktivni', timestamp: '2026-09-18',
      data: { typ: 'elektro', podtyp: 'dum', ev_cislo: 'RE-26-10001',
              misto: 'Garáže autobusů – V3', adresa: 'Sokolovská 573',
              zahajeni: '2026-05-05', ukonceni: '2026-05-05' } });
    STORE.archiv = archiv;
    // nejdřív spotřebiče, ať protokol vznikne
    aktTyp = 'spotrebice'; aktPodtyp = 'spotrebice'; novaZprava('spotrebice');
    await new Promise(r => setTimeout(r, 700));
    // a teď otevřít elektro zprávu z archivu
    otevritZpravu(0);
    await new Promise(r => setTimeout(r, 800));
    const o = {};
    SPOTR_PRENOS.forEach(id => {
      const el = document.getElementById(id);
      o[id] = !el ? 'CHYBÍ' : (el.closest('#tab-spotrebice') ? 'ukradeno' : 'doma');
    });
    return { kde: o, misto: document.getElementById('f_misto').value,
             vidi: document.getElementById('f_misto').offsetParent !== null };
  });
  check('otevření elektro zprávy z archivu pole nechá doma',
    Object.values(zArchivu.kde).every(v => v === 'doma'), JSON.stringify(zArchivu.kde));
  check('místo revize je po otevření z archivu vyplněné A VIDĚT',
    zArchivu.misto === 'Garáže autobusů – V3' && zArchivu.vidi,
    zArchivu.misto + ' / vidět=' + zArchivu.vidi);

  // ══ 7. Ostatní typy zůstaly nedotčené ═══════════════════════════
  const jine = await p.evaluate(async () => {
    aktTyp = 'elektro'; aktPodtyp = 'dum'; novaZprava('elektro');
    await new Promise(r => setTimeout(r, 600));
    return {
      napetova: getComputedStyle(document.getElementById('scard-napetova')).display,
      vtez: getComputedStyle(document.getElementById('scard-vtez')).display,
      popis: getComputedStyle(document.getElementById('scard-rozsah-popis')).display,
      dok: getComputedStyle(document.getElementById('scard-dokumentace')).display,
      // pole zprávy se musí VRÁTIT na svá místa — přesun je obousměrný
      vratilaSe: SPOTR_PRENOS.map(function(id) {
        var el = document.getElementById(id);
        return id + ':' + (!el ? 'CHYBÍ' : (el.closest('.sp-sheet') ? 'V LISTU' : 'doma'));
      }),
      titulkaMa: ['f_ev_cislo', 'f_misto', 'f_zahajeni', 'f_vypracovani'].every(function(id) {
        var el = document.getElementById(id);
        return el && el.closest('#tab-titulni');
      }),
      bar: getComputedStyle(document.getElementById('tab-bar-el')).display,
      cislo: document.getElementById('f_ev_cislo').value
    };
  });
  check('elektro zpráva má svoje karty zpátky',
    jine.napetova !== 'none' && jine.vtez !== 'none' && jine.bar === 'flex',
    jine.napetova + ' / ' + jine.vtez);
  check('pole zprávy se vrátila z protokolu na svá místa',
    jine.vratilaSe.every(function(x) { return /:doma$/.test(x); }), jine.vratilaSe.join(', '));
  check('na titulní straně elektro revize jsou pole zpátky', jine.titulkaMa);
  check('elektro má zase prefix RE', /^RE-/.test(jine.cislo), jine.cislo);

  // ══ 7b. Popis a dokumentace se VRÁTÍ i STROJŮM ══════════════
  // Nahlásil uživatel 2026-09-21: v záložce „2. Stroj" nešel editovat žádný
  // popis, ačkoli kapitola 3 PDF poslá „Doplňte v záložce 2. Stroj."
  check('po spotřebičích se „A. Rozsah a popis" vrátí i elektro revizi',
    jine.popis !== 'none' && jine.dok !== 'none', jine.popis + ' / ' + jine.dok);

  const stroj = await p.evaluate(async () => {
    aktTyp = 'spotrebice'; aktPodtyp = 'spotrebice'; novaZprava('spotrebice');
    await new Promise(r => setTimeout(r, 600));
    aktTyp = 'stroje'; aktPodtyp = 'stroje'; novaZprava('stroje');
    await new Promise(r => setTimeout(r, 700));
    const b = [...document.querySelectorAll('#tab-bar-stroje .tab-btn')]
      .find(x => /stroj/i.test(x.textContent));
    if (b) b.click();
    await new Promise(r => setTimeout(r, 300));
    const karta = document.getElementById('scard-rozsah-popis');
    const rich = karta ? karta.querySelector('#f_popis ~ .rich-edit, .rich-edit') : null;
    const pole = document.getElementById('f_popis');
    return {
      display: karta ? getComputedStyle(karta).display : '-',
      rodic: karta ? karta.parentNode.id : '-',
      dok: getComputedStyle(document.getElementById('scard-dokumentace')).display,
      nadpis: (document.getElementById('scard-rozsah-popis-title') || {}).textContent || '',
      popisek: (document.getElementById('f-popis-label') || {}).textContent || '',
      editovatelne: !!(pole && pole.parentNode.querySelector('.rich-edit') &&
                       pole.parentNode.querySelector('.rich-edit').offsetParent),
      napoveda: (function () {
        const e = pole && pole.parentNode.querySelector('.rich-edit');
        return e ? (e.getAttribute('data-placeholder') || '') : '';
      })()
    };
  });
  check('a STROJŮM taky — karta „Rozsah a popis" je v záložce 2. Stroj vidět',
    stroj.display !== 'none' && stroj.rodic === 'tab-stroje-objekt' && stroj.dok !== 'none',
    stroj.display + ' v ' + stroj.rodic);
  check('a popis se dá opravdu EDITOVAT (kapitola 3 PDF na ni odkazuje)',
    stroj.editovatelne);
  check('nápověda v prázdném poli je od STROJE, ne od elektro revize',
    /ke stroji/.test(stroj.napoveda) && !/pro elektroinstalaci/.test(stroj.napoveda),
    stroj.napoveda.slice(0, 50));
  check('karta i popisek se u stroje jmenují podle stroje',
    /zařízení stroje/.test(stroj.nadpis) && /zařízení stroje/.test(stroj.popisek),
    stroj.nadpis + ' · ' + stroj.popisek);

  // ══ 8. ZÁCHRANNÁ SÍŤ: přepnutí záložky vrátí ukradená pole ═════
  // Kdyby se pole do protokolu dostala jakoukoli budoucí cestou, technik
  // je dostane zpátky jedním klepnutím, ne až po načtení stránky.
  const sit = await p.evaluate(async () => {
    aktTyp = 'stroje'; aktPodtyp = 'stroje'; novaZprava('stroje');
    await new Promise(r => setTimeout(r, 700));
    // násilím nasimulovat staré chování — pole přestěhovat do listu
    const host = document.getElementById('spotrebice-list');
    host.innerHTML = '<div class="sp-sheet">' +
      SPOTR_PRENOS.map(id => '<span class="sp-slot" data-slot="' + id + '"></span>').join('') +
      '</div>';
    SPOTR_PRENOS.forEach(id => {
      const el = document.getElementById(id);
      const slot = host.querySelector('.sp-slot[data-slot="' + id + '"]');
      if (el && slot) { if (!el.__spotrDomov) el.__spotrDomov = { rodic: el.parentNode, dalsi: el.nextSibling }; slot.appendChild(el); }
    });
    const pred = SPOTR_PRENOS.filter(id => { const el = document.getElementById(id); return el && el.closest('#spotrebice-list'); });
    // a teď jen přepnout záložku
    const b = [...document.querySelectorAll('#tab-bar-stroje .tab-btn')][1];
    if (b) b.click();
    await new Promise(r => setTimeout(r, 300));
    const po = SPOTR_PRENOS.filter(id => { const el = document.getElementById(id); return el && el.closest('#spotrebice-list'); });
    return { pred: pred.length, po: po.length, zbylo: po };
  });
  check('přepnutí záložky vrátí pole zprávy z protokolu domů',
    sit.pred > 0 && sit.po === 0, sit.pred + ' → ' + sit.po +
    (sit.zbylo.length ? ' (zbylo: ' + sit.zbylo.join(', ') + ')' : ''));

  check('bez chyb stránky', chyby.length === 0, chyby.join(' | '));
  await br.close();
  console.log(res.join('\n'));
  console.log(res.every(x => x[0] === '✅') ? '\nVŠE OK (' + res.length + ')' : '\nSELHALO');
  process.exit(res.every(x => x[0] === '✅') ? 0 : 1);
})();
