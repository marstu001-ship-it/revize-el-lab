// v9.78 — protokol jen pro jeden spotřebič z řádku (vzor ILLKO Studio).
const { chromium } = require('./pw');
const res = []; const check = (n, ok, d) => res.push((ok?'✅':'❌')+' '+n+(d?' — '+d:''));

(async () => {
  const br = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await br.newContext({ viewport: { width: 1400, height: 1100 } });
  await ctx.addInitScript(() => { navigator.serviceWorker.register = () => new Promise(() => {}); });
  const p = await ctx.newPage();
  const chyby = []; p.on('pageerror', e => chyby.push(e.message));
  await p.goto('http://127.0.0.1:8901/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1400);

  const zaloz = () => p.evaluate(async () => {
    localStorage.clear();
    STORE.technik = { jmeno: 'Jan Novák', osvedceni: '000123', mobil: '+420 600 000 000',
      email: 'jan.novak@example.cz', ico: '12345678', dic: 'CZ12345678', mesto: 'Uh. Hradišti' };
    STORE.pristroje = [{ nazev: 'REVEX max', vyrCislo: 'W2284', kalibrace: 'R0808M',
                         platnost: '2028-05-20' }];
    archiv.length = 0; STORE.archiv = archiv;
    aktTyp = 'spotrebice'; aktPodtyp = 'spotrebice'; novaZprava('spotrebice');
    await new Promise(r => setTimeout(r, 900));
    document.getElementById('f_provozovatel').value = 'Vzorová firma s.r.o.';
    document.getElementById('f_provozovatel_ico').value = '12345678';
    document.getElementById('f_misto').value = 'Hasičárna';
    document.getElementById('f_zahajeni').value = '2026-08-17';
    document.getElementById('f_pristi').value = '2027-02-17';
  });
  const vypln = (o) => p.evaluate((o) => {
    const tb = document.getElementById('spotrebice-body');
    Object.keys(o).forEach(k => {
      const e = tb.children[0].querySelector('[data-k="' + k + '"]');
      if (e) e.value = o[k];
    });
  }, o);
  const protokol = () => p.evaluate(async () => {
    const tb = document.getElementById('spotrebice-body');
    spotrJedenNahled(tb.children[0].querySelector('[data-action="spotrJedenNahled"]'));
    await new Promise(r => setTimeout(r, 500));
    const str = document.querySelectorAll('#spotrebice-pdf-pages .a4');
    return { stran: str.length,
      landscape: str.length ? str[0].classList.contains('a4-landscape') : null,
      text: str.length ? str[0].innerText.replace(/\s+/g, ' ') : '',
      html: str.length ? str[0].innerHTML : '',
      soubor: spotrebiceNazevSouboru(), rezim: __spotrRezim };
  });

  // ══ 1. Tlačítko a základní podoba ═══════════════════════════════
  await zaloz();
  const tlacitko = await p.evaluate(() => {
    const tr = document.querySelector('#spotrebice-body tr');
    const b = [...tr.querySelectorAll('.sp-del .sp-x')].map(x => x.getAttribute('data-action'));
    return { akce: b, pdf: !!tr.querySelector('[data-action="spotrJedenNahled"]'),
             kolu: document.querySelectorAll('#spotrebice-list .spotr-tab colgroup col').length };
  });
  check('v řádku je tlačítko na protokol jednoho spotřebiče', tlacitko.pdf, tlacitko.akce.join(','));
  check('generování protokolu je až na kraji řádku (za ⧉ a ✕)',
    tlacitko.akce.join(',') === 'copySpotrebic,delSpotrebic,spotrJedenNahled',
    tlacitko.akce.join(','));
  const kraj = await p.evaluate(() => {
    const tr = document.querySelector('#spotrebice-body tr');
    const b = [...tr.querySelectorAll('.sp-del .sp-x')].map(x => x.getBoundingClientRect());
    const bunka = tr.querySelector('.sp-del').getBoundingClientRect();
    return { pdfPravy: b[2].right, nejvic: Math.max(...b.map(x => x.right)),
             mezera: b[2].left - b[1].right, hrana: bunka.right - b[2].right };
  });
  check('protokol je nejpravější tlačítko řádku',
    Math.abs(kraj.pdfPravy - kraj.nejvic) < 0.5, kraj.pdfPravy.toFixed(1) + ' px');
  check('a je od úprav řádku oddělený mezerou', kraj.mezera >= 5,
    kraj.mezera.toFixed(1) + ' px mezera, ' + kraj.hrana.toFixed(1) + ' px k hraně buňky');
  check('sloupec tlačítek má vlastní <col> (tři tlačítka vedle sebe)',
    tlacitko.kolu === 21, tlacitko.kolu + ' colů');

  await vypln({ oznaceni: '001', nazev: 'Hasičský vysavač RÖSSLE', trida: 'I', skupina: 'C',
    delka: '10,0', sestava: 'P', un: '230', rpe: '0,33', riso: '>100',
    metoda: 'U', imA: '0,1', chod: 'V', hodnoceni: 'V', zavady: 'Vyhovuje' });
  const a = await protokol();
  check('vygeneruje se JEDNA strana', a.stran === 1, String(a.stran));
  check('protokol je NA VÝŠKU (ne na šířku jako seznam)', a.landscape === false);
  check('nadpis a norma sedí se vzorem',
    /Protokol o opakované revizi elektrického spotřebiče/.test(a.text) &&
    /dle ČSN 33 1600 ed\.2/.test(a.text));
  check('celkové hodnocení je v hlavičce', /Celkové hodnocení: Vyhovuje/.test(a.text));

  // ══ 2. Údaje z ŘÁDKU ════════════════════════════════════════════
  [['název spotřebiče', 'Hasičský vysavač RÖSSLE'], ['ID z označení', 'Spotřebič ID: 001'],
   ['třída ochrany', 'Třída ochrany: I'], ['skupina', 'Skupina: C'],
   ['délka přívodu', 'Délka přívodu: 10,0 m'], ['odpor PE obvodu', 'Rpe 0,33 Ω'],
   ['izolační odpor', 'RisoM-PE >100 MΩ']
  ].forEach(x => check('v protokolu je ' + x[0], a.text.indexOf(x[1]) >= 0, x[1]));
  check('„Připojení" se složí ze sestavy a napětí',
    /Připojení: Pevně připojeným přívodem, 230 V/.test(a.text));
  check('umístění se vezme z místa protokolu', /Umístění: Hasičárna/.test(a.text));

  // proud patří na řádek podle METODY, ostatní zůstanou prázdné
  check('proud je na řádku podle zvolené metody (U → IaltEq)',
    /Náhradní unikající proud IaltEq 0,1 mA/.test(a.text), 'U');
  check('ostatní řádky proudů zůstaly prázdné',
    !/IdirEq 0,1/.test(a.text) && !/IdifEq 0,1/.test(a.text) && !/IdirTouch 0,1/.test(a.text),
    'jen jeden řádek nese hodnotu');

  // ══ 3. Údaje z PROFILU technika a přístroje ═════════════════════
  [['jméno technika', 'Jan Novák'], ['ev. číslo', '000123'],
   ['telefon', '+420 600 000 000'], ['e-mail', 'jan.novak@example.cz'],
   ['IČO', '12345678'], ['DIČ', 'CZ12345678'],
   ['přístroj', 'REVEX max'], ['výrobní číslo přístroje', 'W2284'],
   ['číslo kalibrace', 'R0808M'], ['platnost kalibrace', '20. 5. 2028']
  ].forEach(x => check('z profilu se doplní ' + x[0], a.text.indexOf(x[1]) >= 0, x[1]));
  check('termín příští revize je z protokolu', /17\. 2\. 2027/.test(a.text));

  // ══ 3b. Kolonka „Dodavatel" — kdo revizi DODAL ══════════════════
  const dod = async (zmena) => {
    // Od 2026-10-19 si zpráva drží technika, se kterým vznikla — změnu
    // profilu do ní přenese až „↻ Vyplnit z mého profilu" (technikZProfilu).
    await p.evaluate((z) => { showScreen('form'); Object.assign(STORE.technik, z); technikZProfilu(); }, zmena);
    return (await protokol()).text;
  };
  const dodOsvc = await dod({});
  check('OSVČ (IČO v profilu, bez firmy) je dodavatelem sám',
    /Dodavatel: Jan Novák/.test(dodOsvc));
  const dodFirma = await dod({ firma: 'Elektro Novák s.r.o.' });
  check('vyplněná firma přebíjí jméno technika',
    /Dodavatel: Elektro Novák s\.r\.o\./.test(dodFirma) && !/Dodavatel: Jiří/.test(dodFirma));
  const dodZam = await dod({ firma: '', ico: '', dic: '' });
  check('bez firmy i bez IČO zůstane kolonka PRÁZDNÁ (zaměstnanec)',
    /Dodavatel: IČO:/.test(dodZam) && !/Dodavatel: Jiří/.test(dodZam),
    (dodZam.match(/Dodavatel:[^:]*IČO/) || ['(nenalezeno)'])[0]);
  check('jméno technika zůstává v kolonce „Revizi provedl"',
    /Revizi provedl a protokol vystavil: Jan Novák/.test(dodZam));
  await p.evaluate(() => {
    STORE.technik.ico = '12345678'; STORE.technik.dic = 'CZ12345678'; technikZProfilu();
  });

  // ══ 4. Výsledek — z POSLEDNÍHO sloupce, ale N přebíjí ═══════════
  await p.evaluate(() => showScreen('form'));
  await vypln({ zavady: 'Poškozený přívodní kabel u vidlice', hodnoceni: 'V' });
  const b = await protokol();
  check('text závady v posledním sloupci = NEVYHOVUJE',
    /Celkové hodnocení: NEVYHOVUJE/.test(b.text) && /není z hlediska bezpečnosti schopen provozu/.test(b.text));
  check('a závada se do protokolu vypíše',
    /Poškozený přívodní kabel u vidlice/.test(b.text));

  await p.evaluate(() => showScreen('form'));
  await vypln({ zavady: 'Vyhovuje', hodnoceni: 'N' });
  const c = await protokol();
  check('výslovné N v celkovém hodnocení PŘEBÍJÍ text „Vyhovuje"',
    /Celkové hodnocení: NEVYHOVUJE/.test(c.text),
    'závady=Vyhovuje, hodnocení=N → ' + (/NEVYHOVUJE/.test(c.text) ? 'NEVYHOVUJE' : 'Vyhovuje'));

  await p.evaluate(() => showScreen('form'));
  await vypln({ zavady: '', hodnoceni: 'V' });
  const d = await protokol();
  check('prázdný sloupec závad = bez závad, vyhovuje',
    /Celkové hodnocení: Vyhovuje/.test(d.text));

  // ══ 5. Prázdný řádek a návrat k seznamu ═════════════════════════
  const prazdny = await p.evaluate(async () => {
    showScreen('form');
    let hlaska = '';
    const puv = window.alert; window.alert = (t) => { hlaska = t; };
    const tb = document.getElementById('spotrebice-body');
    addSpotrebic();
    const novy = tb.children[tb.children.length - 1];
    spotrJedenNahled(novy.querySelector('[data-action="spotrJedenNahled"]'));
    await new Promise(r => setTimeout(r, 250));
    window.alert = puv;
    return { hlaska, obrazovka: (document.querySelector('.screen.active') || {}).id };
  });
  check('prázdný řádek protokol neudělá a řekne proč',
    /prázdný/i.test(prazdny.hlaska) && prazdny.obrazovka === 'screen-form',
    prazdny.hlaska || '(bez hlášky)');

  const zpetSeznam = await p.evaluate(async () => {
    spotrebiceNahled();
    await new Promise(r => setTimeout(r, 600));
    const str = document.querySelectorAll('#spotrebice-pdf-pages .a4');
    return { landscape: str[0].classList.contains('a4-landscape'), rezim: __spotrRezim,
             soubor: spotrebiceNazevSouboru() };
  });
  check('seznam se pak pořád tiskne NA ŠÍŘKU', zpetSeznam.landscape && zpetSeznam.rezim === 'seznam');
  check('název souboru se liší podle režimu',
    /^Protokol_spotrebic_/.test(a.soubor) && /^Revize_spotrebicu_/.test(zpetSeznam.soubor),
    a.soubor.slice(0, 30) + ' vs ' + zpetSeznam.soubor.slice(0, 30));

  // ══ 6. Všechny protokoly do jednoho souboru ══════════════
  await p.evaluate(async () => {
    showScreen('form');
    const tb = document.getElementById('spotrebice-body');
    while (tb.children.length > 1) tb.removeChild(tb.lastElementChild);
    const set = (tr, k, v) => { const e = tr.querySelector('[data-k="' + k + '"]'); if (e) e.value = v; };
    set(tb.children[0], 'oznaceni', '001');
    set(tb.children[0], 'nazev', 'Hasičský vysavač');
    addSpotrebic();
    set(tb.children[1], 'oznaceni', '002');
    set(tb.children[1], 'nazev', 'Vrtačka Narex');
    set(tb.children[1], 'metoda', 'D');
    set(tb.children[1], 'imA', '0,2');
    await new Promise(r => setTimeout(r, 100));
  });
  const vsechny = await p.evaluate(async () => {
    spotrVsechnyNahled();
    await new Promise(r => setTimeout(r, 600));
    const str = [...document.querySelectorAll('#spotrebice-pdf-pages .a4')];
    return { stran: str.length, rezim: __spotrRezim,
      landscape: str.some(x => x.classList.contains('a4-landscape')),
      text: str.map(x => x.innerText.replace(/\s+/g, ' ')),
      soubor: spotrebiceNazevSouboru(),
      tlacitko: (document.getElementById('sp-rezim') || {}).textContent,
      zpet: __spotrZpet };
  });
  check('každý spotřebič dostane vlastní stranu', vsechny.stran === 2, String(vsechny.stran));
  check('všechny strany jsou NA VÝŠKU', vsechny.landscape === false);
  check('první strana patří prvnímu spotřebiči',
    /Hasičský vysavač/.test(vsechny.text[0]) && !/Vrtačka/.test(vsechny.text[0]));
  check('druhá strana druhému a má SVůJ proud na svém řádku',
    /Vrtačka Narex/.test(vsechny.text[1]) &&
    /Dotykový proud \(přímá metoda\) IdirTouch 0,2 mA/.test(vsechny.text[1]),
    vsechny.text[1].slice(0, 40));
  check('strany jsou očíslované „Strana i / N"',
    /Strana 1 \/ 2/.test(vsechny.text[0]) && /Strana 2 \/ 2/.test(vsechny.text[1]));
  check('název souboru je vlastní pro hromadný protokol',
    /^Protokoly_spotrebicu_/.test(vsechny.soubor), vsechny.soubor.slice(0, 40));
  check('tlačítko režimu teď nabízí návrat na seznam',
    /Zpět na seznam/.test(vsechny.tlacitko || ''), vsechny.tlacitko);
  check('šipka Zpět pořád míří do formuláře, ne na náhled',
    vsechny.zpet === 'form', vsechny.zpet);

  const zpetRezim = await p.evaluate(async () => {
    spotrebiceRezim();                       // ze „všechny" zpátky na seznam
    await new Promise(r => setTimeout(r, 600));
    const str = [...document.querySelectorAll('#spotrebice-pdf-pages .a4')];
    return { rezim: __spotrRezim, landscape: str[0].classList.contains('a4-landscape'),
      tlacitko: (document.getElementById('sp-rezim') || {}).textContent, zpet: __spotrZpet };
  });
  check('tlacítkem se přepne zpátky na seznam na šířku',
    zpetRezim.rezim === 'seznam' && zpetRezim.landscape &&
    /Protokoly po jednom/.test(zpetRezim.tlacitko || ''), zpetRezim.tlacitko);
  check('a šipka Zpět se přepnutím nerozbila', zpetRezim.zpet === 'form', zpetRezim.zpet);

  check('bez chyb stránky', chyby.length === 0, chyby.join(' | '));
  await br.close();
  console.log(res.join('\n'));
  console.log(res.every(x => x[0] === '✅') ? '\nVŠE OK (' + res.length + ')' : '\nSELHALO');
})();
