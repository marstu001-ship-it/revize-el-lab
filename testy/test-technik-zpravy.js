// Technik a přístroje ve zprávě od kolegy zůstanou jeho (pokyn uživatele
// 2026-10-19). Do té doby nacistData() při KAŽDÉM otevření přepsal technika
// i přístroje vlastním profilem a PDF bralo razítko a podpis vždy z profilu.
// Všichni technici, přístroje i obrázky jsou vymyšlené.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: require('path').join(__dirname, 'knihovny', r.request().url().split('/').pop()), contentType: 'application/javascript',
    headers: { 'Access-Control-Allow-Origin': '*' } }));
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const p = await ctx.newPage();
  const err = [];
  p.on('pageerror', e => err.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(URL); await w(1300);

  // ── příprava: můj profil a zpráva od kolegy (vyrobená ve formuláři) ──
  const prip = await p.evaluate(async () => {
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    STORE.technik = { jmeno: 'Jan Vymyšlený', osvedceni: 'VYM-001', opravneni: 'VYM-OPR', ulice: 'Polní 1', psc: '697 01', mesto: 'Kyjov',
      ico: '11111111', dic: 'CZ11111111', mobil: '600 000 001', email: 'jan@vymysleny.example', razitko: PNG, podpis: PNG };
    STORE.pristroje = [{ nazev: 'Můj měřák MM1', vyrCislo: 'MOJE-1', kalibrace: 'KL-MOJE', platnost: '2027-01-31' }];
    saveStore();
    const zpravaKolegy = (typ, ev) => {
      novaZprava(typ);
      const s = (id, v) => { document.getElementById(id).value = v; };
      s('f_ev_cislo', ev); s('f_misto', 'Dům kolegy ' + ev);
      s('f_rt_jmeno', 'Petr Kolega'); s('f_rt_osvedceni', 'KOL-777'); s('f_rt_opravneni', 'KOL-OPR');
      s('f_rt_adresa', 'Jiná 5, Brno'); s('f_rt_ico', '');
      const pb = document.getElementById('pristroje-body'); pb.innerHTML = '';
      addPristrojRow({ nazev: 'Kolegův měřák KM9', vyrCislo: 'KOL-9', kalibrace: 'KL-KOL', platnost: '2026-12-31' }, 1);
      return getData();
    };
    const D = zpravaKolegy('elektro', 'RE-26-0900');
    const Ds = zpravaKolegy('spotrebice', 'RSP-26-0901');
    Ds.spotrebice = { lhuta: '12', seznam: [{ id: 'S1', nazev: 'Varná konvice', typ: 'VK-1', trida: 'I', skupina: 'B', sestava: 'O', un: '230',
      metoda: 'V', iunik: '0,12', riso: '>200', rpe: '0,05', chod: 'V', zavady: 'Vyhovuje', hodnoceni: 'V' }] };
    window.__D = D; window.__Ds = Ds;
    window.__formDirty = false; localStorage.removeItem('revize_el_autosave');
    archiv.length = 0; saveStore();
    return { rt: [D.rt_jmeno, D.rt_osvedceni, D.rt_ico].join('|'), pr: D.pristroje.map(x => x.nazev).join() };
  });
  check('příprava: zpráva kolegy má jeho technika a přístroj', prip.rt === 'Petr Kolega|KOL-777|' && prip.pr === 'Kolegův měřák KM9', JSON.stringify(prip));

  const formular = () => p.evaluate(() => ({
    rt: ['f_rt_jmeno', 'f_rt_osvedceni', 'f_rt_opravneni', 'f_rt_adresa', 'f_rt_ico'].map(id => document.getElementById(id).value).join('|'),
    pr: collectPristroje().map(x => [x.nazev, x.vyrCislo, x.kalibrace, x.platnost].join('/')).join(';'),
    badge: document.getElementById('rt-badge').innerText.replace(/\s+/g, ' ').trim(),
    profil: STORE.technik.jmeno + '|' + STORE.technik.osvedceni + '|' + STORE.pristroje.map(x => x.nazev).join()
  }));
  const KOLEGA = 'Petr Kolega|KOL-777|KOL-OPR|Jiná 5, Brno|', KOL_PR = 'Kolegův měřák KM9/KOL-9/KL-KOL/2026-12-31';
  const MOJE = 'Jan Vymyšlený|VYM-001|VYM-OPR|Polní 1, 697 01 Kyjov|11111111', MOJE_PR = 'Můj měřák MM1/MOJE-1/KL-MOJE/2027-01-31';
  const PROFIL = 'Jan Vymyšlený|VYM-001|Můj měřák MM1';

  // ── 1. ze souboru (tlačítko Načíst) ──────────────────────────────────
  await p.evaluate(() => { zpracovatZpravuData(JSON.parse(JSON.stringify(window.__D))); });
  await w(300);
  let f = await formular();
  check('zpráva kolegy ze souboru: technik ze zprávy, ne z mého profilu', f.rt === KOLEGA, f.rt);
  check('zpráva kolegy ze souboru: přístroje ze zprávy', f.pr === KOL_PR, f.pr);
  check('štítek ukazuje technika zprávy a jeden řádek „jiný technik"', /Petr Kolega/.test(f.badge) && /KOL-777/.test(f.badge) &&
    /Zprávu zpracoval jiný technik než je ve vašem profilu\./.test(f.badge) && !/Jan Vymyšlený/.test(f.badge), f.badge);
  check('můj profil se otevřením nezměnil', f.profil === PROFIL, f.profil);

  // uložení: data přesně jako v souboru (i prázdné IČO kolegy zůstane prázdné)
  const ul = await p.evaluate(() => {
    saveToArchiv();
    const z = archiv.find(x => x.data.ev_cislo === 'RE-26-0900').data, D = window.__D;
    const k = ['rt_jmeno', 'rt_osvedceni', 'rt_opravneni', 'rt_adresa', 'rt_ico'];
    return { stejne: k.every(x => z[x] === D[x]) && JSON.stringify(z.pristroje) === JSON.stringify(D.pristroje),
      rt: k.map(x => z[x]).join('|'), pr: JSON.stringify(z.pristroje) };
  });
  check('po otevření a uložení má zpráva rt_* i přístroje přesně jako v souboru (moje IČO se nedopíše)', ul.stejne, ul.rt + ' · ' + ul.pr);

  // ── 2. z archivu (pouhé otevření nic nezmění) ─────────────────────────
  const ar = await p.evaluate(async () => {
    showScreen('home');
    const pred = JSON.stringify(archiv);
    const i = archiv.findIndex(x => x.data.ev_cislo === 'RE-26-0900');
    otevritZpravu(i); showScreen('form');
    await new Promise(r => setTimeout(r, 200));
    const z = archiv[archiv.findIndex(x => x.data.ev_cislo === 'RE-26-0900')];
    return { stejne: JSON.stringify(archiv.map(x => x.data)) === JSON.stringify(JSON.parse(pred).map(x => x.data)), dirty: !!window.__formDirty };
  });
  f = await formular();
  check('z archivu: technik a přístroje ze zprávy', f.rt === KOLEGA && f.pr === KOL_PR, f.rt + ' · ' + f.pr);
  check('z archivu: pouhé otevření data nezmění a zprávu neoznačí jako změněnou', ar.stejne && !ar.dirty, JSON.stringify(ar));

  // ── 3. z postranního archivu ─────────────────────────────────────────
  await p.evaluate(async () => {
    novaZprava('elektro'); window.__formDirty = false; showScreen('form');
    const z = archiv.find(x => x.data.ev_cislo === 'RE-26-0900');
    formArchivOtevrit(z.uid); await new Promise(r => setTimeout(r, 300));
  });
  f = await formular();
  check('z postranního archivu: technik a přístroje ze zprávy', f.rt === KOLEGA && f.pr === KOL_PR, f.rt);

  // ── 4. z balíku zpráv ────────────────────────────────────────────────
  await p.evaluate(async () => {
    const pol = { uid: 'kolega-balik-1', stav: 'aktivni', ev_cislo: 'RE-26-0902', misto: 'Balík', typ: 'elektro', timestamp: new Date().toISOString(),
      data: Object.assign(JSON.parse(JSON.stringify(window.__D)), { ev_cislo: 'RE-26-0902' }) };
    novaZprava('elektro'); window.__formDirty = false; showScreen('home');
    zpracovatZpravuData({ _format: 'revize-el-zpravy', _version: 1, zpravy: [pol] });
    await new Promise(r => setTimeout(r, 300));
    otevritZpravu(archiv.findIndex(x => x.uid === 'kolega-balik-1')); showScreen('form');
    await new Promise(r => setTimeout(r, 200));
  });
  f = await formular();
  check('z balíku zpráv: technik a přístroje ze zprávy', f.rt === KOLEGA && f.pr === KOL_PR, f.rt + ' · ' + f.pr);

  // ── 5. tlačítko „Vyplnit z mého profilu" u rozpracované zprávy ────────
  const btn = await p.evaluate(() => {
    const t = document.querySelector('#rt-badge [data-action="technikZProfilu"]'), pz = document.querySelector('[data-action="pristrojeZProfilu"]');
    return { t: !!t && t.offsetHeight > 0, p: !!pz, ro: !!window.__formReadOnly };
  });
  check('rozpracovaná zpráva: „↻ Vyplnit z mého profilu" u technika i u přístrojů', btn.t && btn.p && !btn.ro, JSON.stringify(btn));
  await p.click('#rt-badge [data-action="technikZProfilu"]'); await w(100);
  await p.evaluate(() => { const b = document.querySelector('[data-action="pristrojeZProfilu"]'); switchTab('pristroje', aktivniTabBar().querySelector('[data-tab="pristroje"]')); });
  await p.click('[data-action="pristrojeZProfilu"]'); await w(100);
  f = await formular();
  const dirty = await p.evaluate(() => !!window.__formDirty);
  check('„Vyplnit z mého profilu" přepíše technika i přístroje mými a označí zprávu jako změněnou', f.rt === MOJE && f.pr === MOJE_PR && dirty &&
    !/jiný technik/.test(f.badge), f.rt + ' · ' + f.pr + ' · ' + f.badge);
  await p.evaluate(() => { window.__formDirty = false; localStorage.removeItem('revize_el_autosave'); });

  // ── 6. nová, Navázat, ⧉ Kopírovat = moje nové zprávy ──────────────────
  await p.evaluate(() => { showScreen('home'); novaZprava('elektro'); showScreen('form'); });
  f = await formular();
  check('nová zpráva: technik a přístroje z profilu', f.rt === MOJE && f.pr === MOJE_PR, f.rt);
  await p.evaluate(() => { window.__formDirty = false; showScreen('home'); navazatZpravu(archiv.findIndex(x => x.data.ev_cislo === 'RE-26-0900')); });
  await w(300);
  f = await formular();
  check('🔗 Navázat na zprávu kolegy: nová zpráva je moje (technik a přístroje z profilu)', f.rt === MOJE && f.pr === MOJE_PR, f.rt + ' · ' + f.pr);
  await p.evaluate(async () => {
    window.__formDirty = false; showScreen('form');
    const z = archiv.find(x => x.data.ev_cislo === 'RE-26-0900');
    formArchivKopirovat(z.uid); await new Promise(r => setTimeout(r, 400));
  });
  f = await formular();
  check('⧉ Kopírovat zprávu kolegy: kopie je moje (technik a přístroje z profilu)', f.rt === MOJE && f.pr === MOJE_PR, f.rt + ' · ' + f.pr);
  const puvodni = await p.evaluate(() => { const z = archiv.find(x => x.data.ev_cislo === 'RE-26-0900').data; return z.rt_jmeno + '|' + z.pristroje[0].nazev; });
  check('původní zpráva kolegy v archivu zůstala jeho', puvodni === 'Petr Kolega|Kolegův měřák KM9', puvodni);

  // ── 7. stará zpráva bez technika: doplní se z profilu jako dřív ───────
  await p.evaluate(async () => {
    window.__formDirty = false;
    const D = Object.assign(JSON.parse(JSON.stringify(window.__D)), { ev_cislo: 'RE-20-0001', rt_jmeno: '', rt_osvedceni: '', rt_opravneni: '', rt_adresa: '', rt_ico: '', pristroje: [] });
    delete D.rt_jmeno; delete D.rt_osvedceni;
    nacistData(D); showScreen('form'); await new Promise(r => setTimeout(r, 200));
  });
  f = await formular();
  check('stará zpráva bez jména i osvědčení technika: technik a přístroje z profilu jako dřív', f.rt === MOJE && f.pr === MOJE_PR && !/jiný technik/.test(f.badge), f.rt);

  // ── 8. razítko a podpis: u cizí zprávy ne, u vlastní ano ──────────────
  const pdf = async (ev) => p.evaluate(async (ev) => {
    window.__formDirty = false; showScreen('home');
    otevritZpravu(archiv.findIndex(x => x.data.ev_cislo === ev)); showScreen('form');
    await new Promise(r => setTimeout(r, 200));
    window.__tiskZpravy = { razitko: true, podpis: true };
    generujPDF(); await new Promise(r => setTimeout(r, 1500));
    const pg = document.getElementById('pdf-pages');
    return { razitko: pg.querySelectorAll('img.razitko-pdf').length, podpis: pg.querySelectorAll('img[alt="podpis"]').length,
      technik: /Petr Kolega/.test(pg.innerText), panel: (document.getElementById('pdf-nastaveni') || {}).innerText || '' };
  }, ev);
  const cizi = await pdf('RE-26-0900');
  check('PDF zprávy kolegy: moje razítko ani podpis se nevloží, technik je kolega', cizi.razitko === 0 && cizi.podpis === 0 && cizi.technik, JSON.stringify({ r: cizi.razitko, p: cizi.podpis, t: cizi.technik }));
  check('panel tisku řekne proč', /zprávu zpracoval jiný technik/.test(cizi.panel), cizi.panel.slice(0, 200).replace(/\n/g, ' | '));
  await p.evaluate(async () => { showScreen('home'); novaZprava('elektro'); document.getElementById('f_ev_cislo').value = 'RE-26-0950'; document.getElementById('f_misto').value = 'Můj dům'; saveToArchiv(); });
  const moje = await pdf('RE-26-0950');
  check('PDF vlastní zprávy: razítko i podpis se vloží', moje.razitko >= 1 && moje.podpis >= 1 && !/jiný technik/.test(moje.panel), JSON.stringify({ r: moje.razitko, p: moje.podpis }));

  // ── 9. spotřebiče kolegy: seznam i protokol jednoho spotřebiče ─────────
  const sp = await p.evaluate(async () => {
    window.__formDirty = false; showScreen('home');
    nacistData(JSON.parse(JSON.stringify(window.__Ds))); saveToArchiv(); showScreen('form');
    window.__tiskZpravy = { razitko: true, podpis: true };
    await new Promise(r => setTimeout(r, 300));
    spotrebiceNahled(); await new Promise(r => setTimeout(r, 900));
    const st = document.getElementById('screen-spotrebice-pdf');
    const seznam = { text: st.innerText, razitko: st.querySelectorAll('img.razitko-pdf').length, podpis: st.querySelectorAll('img[alt="podpis"]').length };
    showScreen('form'); await new Promise(r => setTimeout(r, 200));
    spotrJedenNahled(document.querySelector('#spotrebice-body tr .sp-pole')); await new Promise(r => setTimeout(r, 900));
    const jeden = { text: st.innerText, razitko: st.querySelectorAll('img.razitko-pdf').length, podpis: st.querySelectorAll('img[alt="podpis"]').length };
    return { seznam, jeden };
  });
  check('spotřebiče kolegy, seznam: technik a přístroj kolegy, bez mého razítka a podpisu', /Petr Kolega/.test(sp.seznam.text) && /KOL-777/.test(sp.seznam.text) &&
    /Kolegův měřák KM9/.test(sp.seznam.text) && !/Jan Vymyšlený|Můj měřák/.test(sp.seznam.text) && sp.seznam.razitko === 0 && sp.seznam.podpis === 0,
    JSON.stringify({ r: sp.seznam.razitko, p: sp.seznam.podpis }));
  check('spotřebiče kolegy, protokol jednoho spotřebiče: technik kolega, žádný můj telefon, e-mail, IČO, razítko ani podpis',
    /Petr Kolega/.test(sp.jeden.text) && /KOL-777/.test(sp.jeden.text) && /Kolegův měřák KM9/.test(sp.jeden.text) &&
    !/600 000 001|jan@vymysleny|11111111|Jan Vymyšlený|Můj měřák/.test(sp.jeden.text) && sp.jeden.razitko === 0 && sp.jeden.podpis === 0,
    JSON.stringify({ r: sp.jeden.razitko, p: sp.jeden.podpis }));

  // ── 10. dokončená zpráva: tlačítka schovaná ───────────────────────────
  const dok = await p.evaluate(async () => {
    showScreen('home');
    const i = archiv.findIndex(x => x.data.ev_cislo === 'RE-26-0900'); archiv[i].stav = ''; saveStore();
    otevritZpravu(i); showScreen('form'); await new Promise(r => setTimeout(r, 200));
    const t = document.querySelector('#rt-badge [data-action="technikZProfilu"]'), pz = document.querySelector('[data-action="pristrojeZProfilu"]');
    technikZProfilu(); pristrojeZProfilu();
    return { ro: !!window.__formReadOnly, t: t ? getComputedStyle(t).display : 'chybí', p: pz ? getComputedStyle(pz).display : 'chybí',
      rt: document.getElementById('f_rt_jmeno').value, pr: collectPristroje()[0].nazev };
  });
  check('dokončená zpráva: „Vyplnit z mého profilu" schované a nic nepřepíše', dok.ro && dok.t === 'none' && dok.p === 'none' && dok.rt === 'Petr Kolega' &&
    dok.pr === 'Kolegův měřák KM9', JSON.stringify(dok));

  const prof = await p.evaluate(() => STORE.technik.jmeno + '|' + STORE.technik.osvedceni + '|' + STORE.pristroje.map(x => x.nazev).join());
  check('můj profil se za celý test nezměnil', prof === PROFIL, prof);
  check('žádná chyba na stránce', err.length === 0, err.join(' | '));
  console.log(res.join('\n'));
  console.log(res.filter(r => r.startsWith('❌')).length ? 'SELHALO' : 'VŠE OK (' + res.length + ')');
  await b.close();
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})();
