const { chromium } = require('./pw');
const res = []; const check = (n, ok, d) => res.push((ok?'✅':'❌')+' '+n+(d?' — '+d:''));
(async () => {
  const br = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await br.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.addInitScript(() => { navigator.serviceWorker.register = () => new Promise(() => {}); });
  const p = await ctx.newPage();
  const chyby = []; p.on('pageerror', e => chyby.push(e.message));
  await p.goto('http://127.0.0.1:8901/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1300);

  const r = await p.evaluate(() => {
    const karty = [...document.querySelectorAll('#screen-novinky .scard')];
    const spotr = karty.find(k => /Revize elektrických spotřebičů/.test(k.querySelector('.scard-title').textContent));
    const arch = karty.find(k => /Postranní archiv/i.test(k.querySelector('.scard-title').textContent));
    const cis = karty.find(k => /Vlastní číslování zpráv/i.test(k.querySelector('.scard-title').textContent));
    const hrom = karty.find(k => /Hromadné operace v archivu/i.test(k.querySelector('.scard-title').textContent));
    const pren = karty.find(k => /Zprávy pro kolegu/i.test(k.querySelector('.scard-title').textContent));
    const data = karty.map(k => k.dataset.novDatum || '');
    return {
      pocet: karty.length,
      spotrIdx: karty.indexOf(spotr),
      spotrDatum: spotr && spotr.dataset.novDatum,
      spotrTitulek: spotr && spotr.querySelector('.nov-datum') && spotr.querySelector('.nov-datum').textContent.trim(),
      spotrText: spotr ? spotr.innerText.replace(/\s+/g, ' ') : '',
      archText: arch ? arch.innerText.replace(/\s+/g, ' ') : '',
      cisText: cis ? cis.innerText.replace(/\s+/g, ' ') : '',
      cisDatum: cis && cis.dataset.novDatum,
      hromIdx: karty.indexOf(hrom),
      hromDatum: hrom && hrom.dataset.novDatum,
      hromTitulek: hrom && hrom.querySelector('.nov-datum') && hrom.querySelector('.nov-datum').textContent.trim(),
      hromText: hrom ? hrom.innerText.replace(/\s+/g, ' ') : '',
      hromNadNi: data.slice(0, karty.indexOf(hrom)).filter(Boolean),
      hromPodNi: data.slice(karty.indexOf(hrom) + 1).filter(Boolean),
      prenDatum: pren && pren.dataset.novDatum,
      prenTitulek: pren && pren.querySelector('.nov-datum') && pren.querySelector('.nov-datum').textContent.trim(),
      prenText: pren ? pren.innerText.replace(/\s+/g, ' ') : '',
      prenNadNi: data.slice(0, karty.indexOf(pren)).filter(Boolean),
      prenPodNi: data.slice(karty.indexOf(pren) + 1).filter(Boolean),
      celo: data.slice(0, 4),
      // Nad kartou nesmí stát nic staršího, pod ní nic novějšího — skutečný
      // nárok, který přežije přidání další karty (past z v9.58 a v9.71).
      spotrNadNi: data.slice(0, karty.indexOf(spotr)).filter(Boolean),
      spotrPodNi: data.slice(karty.indexOf(spotr) + 1).filter(Boolean),
      bezData: karty.filter(k => !k.dataset.novDatum).length,
      maxDatum: data.filter(Boolean).sort().pop()
    };
  });
  check('karta ke spotřebičům sedí v časovém pořadí',
    r.spotrNadNi.every(function (d) { return d >= r.spotrDatum; }) &&
    r.spotrPodNi.every(function (d) { return d <= r.spotrDatum; }),
    'nad ní ' + r.spotrNadNi.join(',') + ' | pod ní ' + r.spotrPodNi.slice(0, 3).join(','));
  check('má své datum v atributu i v titulku',
    r.spotrDatum === '2026-09-17' && r.spotrTitulek === '17. 9. 2026',
    r.spotrDatum + ' / ' + r.spotrTitulek);
  check('karty na čele jdou od nejnovější',
    r.celo.every((d, i) => i === 0 || d <= r.celo[i - 1]), r.celo.join(' ≥ '));
  check('karet bez data nepřibylo', r.bezData === 2, String(r.bezData));
  // Pulsování 📰 se odvozuje z MAXIMA přes všechny karty, takže to maximum
  // musí sedět s datem karty úplně nahoře — jinak by se o novince nikdo nedozvěděl.
  check('nejnovější datum sedí s kartou na čele', r.maxDatum === r.celo[0],
    r.maxDatum + ' vs ' + r.celo[0]);

  // obsah karty ke spotřebičům
  const mus = ['ČSN 33 1600 ed.2', 'Ctrl+D', 'Shift+Enter', 'prodlužovací přívod',
               'Podbarvení', 'Místo vystavení', 'na šířku', '6 / 12 / 24'];
  mus.forEach(t => check('karta zmiňuje „' + t + '"', r.spotrText.indexOf(t) >= 0));

  // karta k číslování zpráv (v9.72)
  check('karta k číslování zpráv má dnešní datum', r.cisDatum === '2026-09-17', r.cisDatum);
  ['jako dosud', 'předloh', 'Automatické číslování', '⟳', 'vlastní řadu', 'Živá ukázka']
    .forEach(t => check('karta k číslování zmiňuje „' + t + '"', r.cisText.indexOf(t) >= 0));

  // opravená karta k archivu
  check('karta k archivu už netvrdí, že se seznam přeskládává',
    r.archText.indexOf('naposledy otevřené a nakonec zprávy po rocích') === -1);
  ['seřazený podle ev. čísla', 'Filtr podle typu', 'roztáhnout', '⧉', '✕']
    .forEach(t => check('karta k archivu zmiňuje „' + t + '"', r.archText.indexOf(t) >= 0));

  // pulsování 📰 — odvozuje se z max. data
  const puls = await p.evaluate(async () => {
    localStorage.removeItem('revize_el_novinky_seen');
    location.reload();
    return true;
  });
  await p.waitForTimeout(1500);
  const stav = await p.evaluate(() => {
    const b = document.querySelector('[data-action="novinky"], #btn-novinky');
    return { je: !!b, puls: b ? (b.className + ' ' + b.innerHTML).toLowerCase().indexOf('nov') >= 0 : false,
             html: b ? b.className : '' };
  });
  check('tlačítko Novinky upozorňuje na novou kartu', stav.je && stav.puls, stav.html);

  // karta k hromadným operacím (v9.84)
  // **Pozice se NEPINUJE** (past z v9.58, v9.71, v9.84) — kontroluje se nárok,
  // který přežije každou další kartu: nad ní nic staršího, pod ní nic novějšího.
  check('karta k hromadným operacím sedí v časovém pořadí',
    r.hromNadNi.every(function (d) { return d >= r.hromDatum; }) &&
    r.hromPodNi.every(function (d) { return d <= r.hromDatum; }),
    'nad ní ' + r.hromNadNi.join(',') + ' | pod ní ' + r.hromPodNi.slice(0, 3).join(','));
  check('má datum v atributu i v titulku',
    r.hromDatum === '2026-09-22' && r.hromTitulek === '22. 9. 2026',
    r.hromDatum + ' / ' + r.hromTitulek);
  ['oboustrann', 'novém listu', 'ZPĚT', 'Shift', 'Spotřebiče'].forEach(function (t) {
    check('karta zmiňuje „' + t + '"', r.hromText.indexOf(t) >= 0);
  });

  // karta k přenosu zpráv (v9.88)
  check('karta k přenosu zpráv v Novinkách je', !!r.prenDatum, r.prenDatum || 'chybí');
  check('má datum v atributu i v titulku',
    r.prenDatum === '2026-09-22' && r.prenTitulek === '22. 9. 2026',
    r.prenDatum + ' / ' + r.prenTitulek);
  check('a sedí v časovém pořadí',
    r.prenNadNi.every(function (d) { return d >= r.prenDatum; }) &&
    r.prenPodNi.every(function (d) { return d <= r.prenDatum; }),
    'nad ní ' + r.prenNadNi.join(',') + ' | pod ní ' + r.prenPodNi.slice(0, 3).join(','));
  ['Soubor pro kolegu', 'přetáhnout', 'Načíst', 'ZPĚT', 'dokončená', 'jednou dávkou']
    .forEach(function (t) {
      check('karta k přenosu zmiňuje „' + t + '"', r.prenText.indexOf(t) >= 0);
    });

  check('bez chyb stránky', chyby.length === 0, chyby.join(' | '));
  await p.evaluate(() => showScreen('novinky'));
  await p.waitForTimeout(400);
  await p.screenshot({ path: __dirname + '/_beh/novinky.png' });
  await br.close();
  console.log(res.join('\n'));
  console.log(res.every(x => x[0] === '✅') ? '\nVŠE OK (' + res.length + ')' : '\nSELHALO');
})();
