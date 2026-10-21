// Nová verze a návrat na obrazovku po načtení stránky (hlášení 2026-10-19:
// „program sám skočí na úvod, když jsem chvíli neaktivní").
//  - nová verze (controllerchange) se načte SAMA jen v klidu (úvod, seznam,
//    nastavení, bez dialogu a psaní, nebo schované okno) — s otevřenou
//    zprávou, dokumentem či rozvaděčem jen pruh „Načíst", i po schování okna;
//    po zavření se načte sama a ukáže hlášku,
//  - po načtení stránky v témže okně se vrátí obrazovka, otevřená zpráva
//    i záložka, dokument tvorby dokumentace, rozvaděč, plán, posun,
//  - rozepsané se neztratí (koncept zprávy i dokument se dopíšou hned),
//  - v NOVÉM okně se nic neobnovuje (úvod, koncept nabídne dotaz jako dřív).
// Všechna data vymyšlená.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  // Worker se v testu neregistruje; aby šlo nasimulovat „nová verze", tváří
  // se stránka, že ji worker už řídí (jinak by se převzetí bralo jako první návštěva).
  await ctx.addInitScript(() => {
    try {
      navigator.serviceWorker.register = () => new Promise(() => {});
      Object.defineProperty(navigator.serviceWorker, 'controller', { get: () => ({ fake: true }), configurable: true });
    } catch (e) {}
  });
  const err = [], dotazy = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => err.push(e.message));
  p.on('dialog', d => { dotazy.push(d.message()); d.accept(); });
  const nacti = async () => { await p.reload(); await w(1400); };
  const stav = () => p.evaluate(() => ({
    s: document.querySelector('.screen.active').id,
    tab: (document.querySelector('#screen-form .tab-btn.active') || {}).getAttribute ? document.querySelector('#screen-form .tab-btn.active').getAttribute('data-tab') : '',
    y: Math.round(scrollY)
  }));

  await p.goto(URL); await w(1300);
  // ── zpráva v archivu, otevřená na záložce Měření ──────────────────────
  await p.evaluate(async () => {
    STORE.technik = { jmeno: 'Jan Vymyšlený', mesto: 'Kyjov' }; saveStore();
    novaZprava('elektro'); await new Promise(r => setTimeout(r, 200));
    document.getElementById('f_ev_cislo').value = 'RE-26-0101'; document.getElementById('f_misto').value = 'Vymyšlený dům';
    window.__formDirty = false; saveToArchiv(); localStorage.removeItem('revize_el_autosave');
    const bar = aktivniTabBar(); switchTab('mereni', bar.querySelector('[data-tab="mereni"]'));
  });
  await w(200);
  await nacti();
  let s = await stav();
  const z1 = await p.evaluate(() => ({ ev: document.getElementById('f_ev_cislo').value, uid: window.__openZpravaUid, archivUid: archiv[0].uid }));
  check('po načtení stránky zpět ve formuláři téže zprávy na téže záložce (žádný dotaz)', s.s === 'screen-form' && s.tab === 'mereni' &&
    z1.ev === 'RE-26-0101' && z1.uid === z1.archivUid && dotazy.length === 0, JSON.stringify(s) + ' ' + JSON.stringify(z1));

  // ── rozepsaná zpráva: psaní a hned obnovení (koncept má zpoždění 1,5 s) ─
  await p.evaluate(() => { const bar = aktivniTabBar(); switchTab('titulni', bar.querySelector('[data-tab="titulni"]')); });
  await p.click('#f_misto'); await p.keyboard.press('End'); await p.keyboard.type(' – přístavba');
  await nacti();
  s = await stav();
  const z2 = await p.evaluate(() => ({ misto: document.getElementById('f_misto').value, dirty: !!window.__formDirty, uid: window.__openZpravaUid === archiv[0].uid,
    archivMisto: archiv[0].data.misto }));
  check('rozepsané psaní se neztratí: koncept dopsán při odchodu, zpráva zpátky bez dotazu a dál „neuloženo"',
    s.s === 'screen-form' && s.tab === 'titulni' && z2.misto === 'Vymyšlený dům – přístavba' && z2.dirty && z2.uid && z2.archivMisto === 'Vymyšlený dům' && dotazy.length === 0,
    JSON.stringify(z2) + ' dotazy ' + dotazy.length);
  await p.evaluate(() => { saveToArchiv(); window.__formDirty = false; localStorage.removeItem('revize_el_autosave'); });

  // ── nová verze: žádné samo-obnovení, jen pruh ──────────────────────────
  await p.evaluate(() => { window.__porad = 'stejná stránka'; navigator.serviceWorker.dispatchEvent(new Event('controllerchange')); });
  await w(1200);
  const pr = await p.evaluate(() => {
    const e = document.getElementById('nova-verze');
    return { porad: window.__porad, pruh: !!e && e.offsetHeight > 0 && /nová verze/i.test(e.textContent), btn: (document.getElementById('nova-verze-nacist') || {}).textContent,
             s: document.querySelector('.screen.active').id };
  });
  check('nová verze stránku sama NEOBNOVÍ, ukáže pruh „Je k dispozici nová verze – Načíst"', pr.porad === 'stejná stránka' && pr.pruh && pr.btn === 'Načíst' && pr.s === 'screen-form', JSON.stringify(pr));
  await p.evaluate(() => { document.getElementById('f_adresa').value = 'Polní 7, Kyjov'; document.getElementById('f_adresa').dispatchEvent(new Event('input', { bubbles: true })); });
  await Promise.all([p.waitForNavigation(), p.click('#nova-verze-nacist')]);
  await w(1400);
  s = await stav();
  const z3 = await p.evaluate(() => ({ adresa: document.getElementById('f_adresa').value, porad: window.__porad, pruh: !!document.getElementById('nova-verze') }));
  check('„Načíst" obnoví stránku, vrátí na tutéž obrazovku a rozepsané pole zůstane', z3.porad === undefined && !z3.pruh && s.s === 'screen-form' &&
    z3.adresa === 'Polní 7, Kyjov' && dotazy.length === 0, JSON.stringify(z3) + ' ' + s.s);
  await p.evaluate(() => { saveToArchiv(); window.__formDirty = false; localStorage.removeItem('revize_el_autosave'); });

  // ── dokončená zpráva zůstane jen pro čtení ─────────────────────────────
  await p.evaluate(() => { archiv[0].stav = ''; saveStore(); otevritZpravu(0); showScreen('form'); });
  await nacti();
  const ro = await p.evaluate(() => ({ s: document.querySelector('.screen.active').id, ro: !!window.__formReadOnly }));
  check('dokončená zpráva se vrátí zase jen pro čtení', ro.s === 'screen-form' && ro.ro, JSON.stringify(ro));

  // ── plán revizí, nastavení, posun stránky ──────────────────────────────
  await p.evaluate(() => { otevritPlan(); document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open')); });
  await w(300); await nacti();
  s = await stav();
  check('plán revizí: po načtení zase plán', s.s === 'screen-plan', s.s);
  await p.evaluate(() => { showScreen('nastaveni'); }); await w(100);
  await p.evaluate(() => window.scrollTo(0, 600)); await w(100);
  await nacti();
  s = await stav();
  check('nastavení i s posunem stránky', s.s === 'screen-nastaveni' && Math.abs(s.y - 600) < 40, JSON.stringify(s));

  // ── tvorba dokumentace: protokol rozepsaný a hned obnovení ─────────────
  await p.evaluate(async () => { await dokNovy('pouvv'); });
  await w(200);
  await p.click('[data-dk="stavba"]'); await p.keyboard.type('Vymyšlená stavba');
  await nacti();
  const d1 = await p.evaluate(() => ({ s: document.querySelector('.screen.active').id, stavba: (dokForm().querySelector('[data-dk="stavba"]') || {}).value,
    cislo: (dokForm().querySelector('[data-dk="cislo"]') || {}).value, n: DOK.dokumenty.length }));
  check('protokol: rozepsaný dokument (ukládání za 800 ms) se dopíše a otevře znovu', d1.s === 'screen-dok-form' && d1.stavba === 'Vymyšlená stavba' &&
    d1.cislo === 'POUVV-0001' && d1.n === 1, JSON.stringify(d1));
  await p.evaluate(() => dokOtevritSeznam('pouvv')); await nacti();
  s = await stav();
  const d2 = await p.evaluate(() => ({ typ: __dokTyp, tit: document.getElementById('dok-seznam-titul').textContent }));
  check('seznam dokumentů téhož typu', s.s === 'screen-dok-seznam' && d2.typ === 'pouvv' && /vnějších vlivů/.test(d2.tit), d2.tit);

  // ── rozvaděč: přístroj vložený těsně před obnovením ────────────────────
  // Část s rozvaděčem běží jen, když program typ rozvaděče má (DOK_TYPY.rozv);
  // bez něj se tytéž kontroly obrazovky dělají s protokolem vnějších vlivů.
  const maRozv = await p.evaluate(() => !!(typeof DOK_TYPY !== 'undefined' && DOK_TYPY.rozv));
  const dokTyp = maRozv ? 'rozv' : 'pouvv', dokNazev = maRozv ? 'rozvaděčem' : 'dokumentem';
  if (!maRozv) {
    await p.evaluate(async () => { await dokOtevrit(DOK.dokumenty[0].uid); });
    await w(300);
  } else {
  await p.evaluate(async () => { await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-2x12-n')); await dokUlozitOtevreny();
    rozvVlozit('v-fa-1-B16', 0, 0); rozvVlozit('v-fa-1-B10', 0, 1); });
  await nacti();
  const r1 = await p.evaluate(() => ({ s: document.querySelector('.screen.active').id, typ: document.getElementById('screen-dok-form').getAttribute('data-typ'),
    r: __rz && __rz.rady[0].prvky.map(x => x.ozn).join(','), svg: !!document.querySelector('#rz-pohled .rz-svg') }));
  check('rozvaděč: editor zpátky i s přístroji vloženými těsně před obnovením', r1.s === 'screen-dok-form' && r1.typ === 'rozv' && r1.r === '-FA1,-FA2' && r1.svg, JSON.stringify(r1));
  }
  await p.evaluate(async () => { await dokNahled(); }); await w(500); await nacti();
  s = await stav();
  check('náhled PDF dokumentu → po obnovení editor dokumentu', s.s === 'screen-dok-form', s.s);

  // ── nová verze se načte sama jen v klidu (pokyn uživatele 2026-10-19) ──
  const skryt = (ano) => p.evaluate((a) => {
    window.__vis = a ? 'hidden' : 'visible';
    if (!window.__visOver) { window.__visOver = 1; Object.defineProperty(document, 'visibilityState', { get: () => window.__vis || 'visible', configurable: true }); }
    document.dispatchEvent(new Event('visibilitychange'));
  }, ano);
  const novaVerze = () => p.evaluate(() => { window.__porad = 'stejná stránka'; navigator.serviceWorker.dispatchEvent(new Event('controllerchange')); });
  const cekejNacteni = (ms) => p.waitForNavigation({ timeout: ms }).then(() => true).catch(() => false);
  const porad = () => p.evaluate(() => window.__porad === 'stejná stránka');

  // rozvaděč (nebo dokument) v editoru (tam jsme po předchozí kontrole): jen pruh, ani schované okno nic
  let nav = cekejNacteni(4500);
  await novaVerze(); await w(500); await skryt(true);
  let bylo = await nav; await skryt(false);
  const rz = await p.evaluate(() => ({ s: document.querySelector('.screen.active').id, pruh: !!document.getElementById('nova-verze') }));
  check('nová verze s otevřeným ' + dokNazev + ': jen pruh, nic se neobnoví ani po schování okna', !bylo && await porad() && rz.s === 'screen-dok-form' && rz.pruh, JSON.stringify(rz));
  // zavření (zpět na seznam) → načte se sama, hláška, návrat na seznam
  nav = cekejNacteni(9000);
  await p.evaluate((t) => dokOtevritSeznam(t), dokTyp);
  bylo = await nav; await w(1400);
  const po1 = await p.evaluate(() => ({ s: document.querySelector('.screen.active').id, porad: window.__porad,
    hl: Array.from(document.querySelectorAll('.toast, #toast, [class*="toast"]')).map(e => e.textContent).join(' | '), n: DOK.dokumenty.length }));
  check('po zavření ' + (maRozv ? 'rozvaděče' : 'dokumentu') + ' se nová verze načte sama, vrátí se na seznam a ukáže hlášku', bylo && po1.porad === undefined && po1.s === 'screen-dok-seznam' &&
    /aktualizoval na novou verzi/.test(po1.hl), JSON.stringify(po1));

  // úvod: načte se sama
  await p.evaluate(() => showScreen('home')); await w(1700);
  nav = cekejNacteni(6000); await novaVerze(); bylo = await nav; await w(1400);
  s = await stav();
  check('nová verze na úvodu se načte sama (a zůstane se na úvodu)', bylo && s.s === 'screen-home', s.s);

  // úvod s otevřeným dialogem / s kurzorem v poli: počká, pak se načte
  await w(1700);
  await p.evaluate(() => document.querySelector('.modal-overlay').classList.add('open'));
  nav = cekejNacteni(3500); await novaVerze(); bylo = await nav;
  const dlg = await porad();
  nav = cekejNacteni(6000); await p.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open')));
  const bylo2 = await nav; await w(1400);
  check('otevřený dialog nové verzi zabrání, po zavření se načte', !bylo && dlg && bylo2);
  await w(1700);
  await p.focus('#archiv-search');
  nav = cekejNacteni(3500); await novaVerze(); bylo = await nav;
  const psani = await porad();
  nav = cekejNacteni(6000); await p.evaluate(() => document.activeElement.blur());
  const bylo3 = await nav; await w(1400);
  check('kurzor v poli nové verzi zabrání, po odchodu z pole se načte', !bylo && psani && bylo3);

  // rozepsaná zpráva: jen pruh, ani schované okno; text zůstane; po uložení a zavření se načte
  await p.evaluate(async () => { novaZprava('elektro'); await new Promise(r => setTimeout(r, 200));
    document.getElementById('f_ev_cislo').value = 'RE-26-0177'; });
  await p.click('#f_misto'); await p.keyboard.type('Rozepsaný dům');
  nav = cekejNacteni(4500); await novaVerze(); await w(500); await skryt(true);
  bylo = await nav; await skryt(false);
  const zp = await p.evaluate(() => ({ s: document.querySelector('.screen.active').id, misto: document.getElementById('f_misto').value, pruh: !!document.getElementById('nova-verze') }));
  check('nová verze s otevřenou zprávou: jen pruh, nic se neobnoví ani po schování okna, text zůstane', !bylo && await porad() && zp.s === 'screen-form' && zp.misto === 'Rozepsaný dům' && zp.pruh, JSON.stringify(zp));
  nav = cekejNacteni(9000);
  await p.evaluate(() => { document.activeElement.blur(); saveToArchiv(); showScreen('home'); });
  bylo = await nav; await w(1400);
  const zp2 = await p.evaluate(() => ({ s: document.querySelector('.screen.active').id, z: (archiv.find(z => z.data && z.data.ev_cislo === 'RE-26-0177') || {}).data }));
  check('po zavření zprávy se načte sama a rozepsaný text je uložený', bylo && zp2.s === 'screen-home' && zp2.z && zp2.z.misto === 'Rozepsaný dům', JSON.stringify({ bylo, s: zp2.s, misto: zp2.z && zp2.z.misto, dotazy }));

  // ── nové okno: nic se neobnovuje, koncept se nabízí dotazem jako dřív ──
  await p.evaluate(() => { localStorage.setItem('revize_el_autosave', JSON.stringify({ _t: new Date().toISOString(), uid: '', data: Object.assign(getData ? {} : {}, { typ: 'elektro', ev_cislo: 'RE-26-0199', misto: 'Koncept' }) })); });
  const p2 = await ctx.newPage(); const dotazy2 = [];
  p2.on('dialog', d => { dotazy2.push(d.message()); d.dismiss(); });
  await p2.goto(URL); await w(1400);
  const nove = await p2.evaluate(() => document.querySelector('.screen.active').id);
  check('nové okno začíná na úvodu a koncept nabízí dotazem (sessionStorage je po oknech)', nove === 'screen-home' && dotazy2.length === 1 && /rozepsaná zpráva/.test(dotazy2[0]),
    nove + ' · ' + dotazy2.join(' | '));
  await p2.close();

  // první návštěva: převzetí workerem není nová verze
  const p3 = await b.newPage();
  await p3.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  await p3.goto(URL); await w(1200);
  const prvni = await p3.evaluate(async () => { navigator.serviceWorker.dispatchEvent(new Event('controllerchange')); await new Promise(r => setTimeout(r, 300));
    return !!document.getElementById('nova-verze'); });
  check('první návštěva (worker se teprve instaluje): žádný pruh', !prvni);
  await p3.close();

  check('žádná chyba na stránce', err.length === 0, err.join(' | '));
  console.log(res.join('\n'));
  console.log(res.filter(r => r.startsWith('❌')).length ? 'SELHALO' : 'VŠE OK (' + res.length + ')');
  await b.close();
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})();
