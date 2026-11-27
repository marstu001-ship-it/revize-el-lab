// Oprava 2026-11-26: zaškrtnutá ochranná opatření ve scard-ochrana-char
// (ČSN 33 2000-4-41 ed.3 / ČSN EN 61140 ed.3, tab „A. Popis instalace") se
// ukládaly a obnovovaly (ochrana_checks), ale do vygenerovaného PDF se
// vůbec nedostaly — kolonka „Ochrana před úrazem" zůstávala prázdná, i když
// měl technik vše zaškrtnuté (nahlásil uživatel). Platí pro elektro i stroje,
// u LPS se karta vůbec nenabízí.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901;
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 }, timezoneId: 'Europe/Prague' });
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(900);

  // 1) Žádné zaškrtnutí, žádný volný text — kolonka zůstává prázdná (regrese).
  const bezCheckboxu = await p.evaluate(async () => {
    novaZprava('elektro');
    const set = (id, x) => { const e = document.getElementById(id); if (e) { e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('f_ev_cislo', 'RE-26-9001'); set('f_misto', 'Zkušební objekt A');
    generujPDF();
    await new Promise(r => setTimeout(r, 1500));
    return document.getElementById('pdf-pages').textContent.replace(/\s+/g, ' ');
  });
  check('bez zaškrtnutí a bez volného textu je kolonka na titulce prázdná',
    bezCheckboxu.includes('Ochrana před úrazem:Síť:'));

  // 2) Zaškrtnuté dvě položky z různých skupin — musí se objevit v PDF
  //    (titulní strana i kapitola 2 „Charakteristika zařízení").
  const sZaskrtnutim = await p.evaluate(async () => {
    novaZprava('elektro');
    const set = (id, x) => { const e = document.getElementById(id); if (e) { e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('f_ev_cislo', 'RE-26-9002'); set('f_misto', 'Zkušební objekt B');
    // och-0-0 = Automatické odpojení od zdroje v síti TN...; och-3-0 = Proudový chránič...
    const chk1 = document.getElementById('och-0-0');
    const chk2 = document.getElementById('och-3-0');
    chk1.checked = true; chk1.dispatchEvent(new Event('change', { bubbles: true }));
    chk2.checked = true; chk2.dispatchEvent(new Event('change', { bubbles: true }));
    generujPDF();
    await new Promise(r => setTimeout(r, 1500));
    return document.getElementById('pdf-pages').textContent.replace(/\s+/g, ' ');
  });
  check('PDF obsahuje zaškrtnuté „Automatické odpojení od zdroje v síti TN" (2×, titulka i kap. 2)',
    sZaskrtnutim.split('Automatické odpojení od zdroje v síti TN').length - 1 === 2);
  check('PDF obsahuje zaškrtnuté „Proudový chránič s IΔn ≤ 30 mA" (2×, titulka i kap. 2)',
    sZaskrtnutim.split('Proudový chránič s IΔn ≤ 30 mA').length - 1 === 2);
  check('citace článku normy za pomlčkou se v krátkém výpisu netiskne (čl. 411 / čl. 6.2)',
    !sZaskrtnutim.includes('čl. 411 / čl. 6.2'));
  check('nezaškrtnutá položka ve stejné skupině se netiskne',
    !sZaskrtnutim.includes('Dvojitá nebo zesílená izolace'));

  // 3) Volný text f_ochrana a zaškrtnutí se v PDF objeví OBĚ, vedle sebe.
  const sObojim = await p.evaluate(async () => {
    novaZprava('elektro');
    const set = (id, x) => { const e = document.getElementById(id); if (e) { e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('f_ev_cislo', 'RE-26-9003'); set('f_misto', 'Zkušební objekt C');
    set('f_ochrana', 'Vlastní poznámka k ochraně');
    const chk1 = document.getElementById('och-0-0');
    chk1.checked = true; chk1.dispatchEvent(new Event('change', { bubbles: true }));
    generujPDF();
    await new Promise(r => setTimeout(r, 1500));
    return document.getElementById('pdf-pages').textContent.replace(/\s+/g, ' ');
  });
  check('volný text i zaškrtnutá položka jsou v PDF obě',
    sObojim.includes('Vlastní poznámka k ochraně') && sObojim.includes('Automatické odpojení od zdroje v síti TN'));

  // 4) Uložení do archivu a znovuotevření — zaškrtnutí i tisk přežijí.
  const poUlozeni = await p.evaluate(async () => {
    novaZprava('elektro');
    const set = (id, x) => { const e = document.getElementById(id); if (e) { e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('f_ev_cislo', 'RE-26-9004'); set('f_misto', 'Zkušební objekt D');
    const chk2 = document.getElementById('och-3-0');
    chk2.checked = true; chk2.dispatchEvent(new Event('change', { bubbles: true }));
    saveToArchiv();
    const idx = archiv.findIndex(z => z.data && z.data.ev_cislo === 'RE-26-9004');
    novaZprava('elektro'); // odejít jinam, ať se otevírá opravdu z archivu
    otevritZpravu(idx);
    generujPDF();
    await new Promise(r => setTimeout(r, 1500));
    return document.getElementById('pdf-pages').textContent.replace(/\s+/g, ' ');
  });
  check('po uložení do archivu a znovuotevření se zaškrtnutá položka dál tiskne',
    poUlozeni.includes('Proudový chránič s IΔn ≤ 30 mA'));

  // 5) Stroje — karta se nabízí taky a tiskne se stejně (kapitola 2).
  const stroj = await p.evaluate(async () => {
    novaZprava('stroje');
    const set = (id, x) => { const e = document.getElementById(id); if (e) { e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('f_ev_cislo', 'RS-26-9005'); set('f_misto', 'Zkušební hala E');
    const chk1 = document.getElementById('och-0-0');
    chk1.checked = true; chk1.dispatchEvent(new Event('change', { bubbles: true }));
    generujPDF();
    await new Promise(r => setTimeout(r, 1500));
    return document.getElementById('pdf-pages').textContent.replace(/\s+/g, ' ');
  });
  check('u strojů (karta se tam zobrazuje taky) se zaškrtnutá položka tiskne v kap. 2',
    stroj.includes('Automatické odpojení od zdroje v síti TN'));

  // 6) LPS — karta se vůbec nenabízí, kolonka se netiskne vůbec.
  const lps = await p.evaluate(async () => {
    novaZprava('lps');
    const set = (id, x) => { const e = document.getElementById(id); if (e) { e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('f_ev_cislo', 'RE-26-9006'); set('f_misto', 'Zkušební objekt F');
    generujPDF();
    await new Promise(r => setTimeout(r, 1500));
    return document.getElementById('pdf-pages').textContent.replace(/\s+/g, ' ');
  });
  check('u LPS se kolonka „Ochrana před úrazem" vůbec netiskne', !lps.includes('Ochrana před úrazem:'));

  check('bez chyb stránky', err.length === 0, err.join(' | '));
  await b.close();
  res.forEach(r => console.log(r));
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})();
