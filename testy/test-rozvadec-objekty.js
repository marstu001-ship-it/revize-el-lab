// Rozvaděč DBO — objekty (složky) v seznamu rozvaděčů. Test hlídá:
//  - skupinu „Bez objektu", malý odkaz „＋ Nový objekt" a hlavní akci beze změny,
//  - založení objektu s psaním jména přímo v řádku (jako v Průzkumníku),
//  - přesun tažením myší, pravým klikem a polem „Objekt" v hlavičce (i nový objekt),
//  - strom napájení uvnitř objektu (hlavní nahoře, podružné odsazené „napájen z"),
//  - pořadí, které se pod rukama nemění, sbalení, hledání podle objektu,
//  - přejmenování (F2) a smazání objektu (rozvaděče zůstanou) se ZPĚT a Ctrl+Z,
//  - zálohu a obnovu, oddělení od revizí, telefon.
// Všechna data vymyšlená.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));
const BEH = require('path').join(__dirname, '_beh');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: require('path').join(__dirname, 'knihovny', r.request().url().split('/').pop()),
    contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  const err = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => err.push(e.message));
  let odpoved = null;   // co se napíše do prompt()
  p.on('dialog', d => (d.type() === 'prompt' && odpoved != null) ? d.accept(odpoved) : d.accept());
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  await p.goto(URL); await w(1200);

  // revizní zpráva jako pozadí (oddělení)
  await p.evaluate(async () => {
    novaZprava('elektro'); await new Promise(r => setTimeout(r, 200));
    document.getElementById('f_ev_cislo').value = 'RE-26-0007'; document.getElementById('f_misto').value = 'Vymyšlený dům';
    window.__formDirty = false; saveToArchiv(); showScreen('home'); await new Promise(r => setTimeout(r, 300));
  });
  const otisk = () => p.evaluate(async () => {
    const o = {}; for (const k of STORE_KEYS) o[k] = await idbGet(k);
    return JSON.stringify({ o, ls: localStorage.getItem('revize_el_store') });
  });
  const otiskPred = await otisk();

  // čtyři vymyšlené rozvaděče: RH1 napájí RS1 a RS2, RX samostatně
  await p.evaluate(async () => {
    await dokNacist();
    const doc = (uid, cislo, ozn, napajenZ) => ({ uid, typ: 'rozv', cislo, vytvoreno: '2026-10-19T08:00:00Z', upraveno: '2026-10-19T08:00:00Z',
      data: Object.assign(DOK_TYPY.rozv.novy(), { cislo, oznaceni: ozn, stavba: 'Byt Polní 12', napajenZ }) });
    DOK.dokumenty.push(doc('t-rs2', 'ROZ-0003', 'RS2', { uid: 't-rh1', ozn: '-FA3' }), doc('t-rh1', 'ROZ-0001', 'RH1'),
      doc('t-rs1', 'ROZ-0002', 'RS1', { uid: 't-rh1', ozn: '-FA2' }), doc('t-rx', 'ROZ-0004', 'RX'));
    DOK.dokumenty[DOK.dokumenty.length - 1].data.stavba = 'Garáž';
    await dokZapsat();
    dokOtevritTypy(); dokOtevritSeznam('rozv');
  });
  await w(300);
  const stav = () => p.evaluate(() => ({
    skup: Array.from(document.querySelectorAll('#dok-seznam .dok-objekt')).map(h => h.querySelector('.dok-obj-nazev').innerText.trim() +
      (h.querySelector('.dok-obj-obsah') ? '' : '') + ':' + Array.from(h.nextElementSibling.querySelectorAll('.dok-polozka')).map(r => r.getAttribute('data-uid')).join(',')),
    obj: DOK.rozvObjekty.map(o => o.nazev), data: DOK.dokumenty.filter(x => x.typ === 'rozv').reduce((a, x) => (a[x.uid] = x.data.objekt || '', a), {})
  }));
  let s = await stav();
  const z0 = await p.evaluate(() => ({ hl: document.querySelector('#dok-typy .dok-hlavni-akce').innerText.replace(/\s+/g, ' ').trim(),
    novy: !!document.querySelector('#dok-seznam [data-action="tdObjNovy"]') }));
  check('bez objektů: jedna skupina „Bez objektu" se všemi čtyřmi rozvaděči (strom: RH1, RS1, RS2, pak RX)',
    s.skup.length === 1 && s.skup[0] === '📦 Bez objektu:t-rh1,t-rs1,t-rs2,t-rx', s.skup.join(' | '));
  check('hlavní akce zůstává „＋ Navrhnout nový rozvaděč", objekt se zakládá malým odkazem „＋ Nový objekt"',
    z0.hl === '＋ Navrhnout nový rozvaděč' && z0.novy, JSON.stringify(z0));

  // ── nový objekt: jméno se píše hned v řádku ───────────────────────────
  await p.click('#dok-seznam [data-action="tdObjNovy"]'); await w(300);
  const inp = await p.evaluate(() => { const a = document.activeElement; return a && a.classList.contains('dok-obj-input') ? a.value : null; });
  check('„＋ Nový objekt" založí „Nový objekt" a rovnou nabídne psaní jména', inp === 'Nový objekt', String(inp));
  await p.keyboard.type('Byt Polní 12'); await p.keyboard.press('Enter'); await w(300);
  s = await stav();
  const idObj = await p.evaluate(() => DOK.rozvObjekty[0] && DOK.rozvObjekty[0].id);
  check('objekt „Byt Polní 12" uložený, prázdný objekt má nápovědu', s.obj.join() === 'Byt Polní 12' &&
    await p.evaluate(() => /Prázdný objekt/.test(document.getElementById('dok-seznam').innerText)), s.obj.join());

  // ── tažení myší ───────────────────────────────────────────────────────
  await p.dragAndDrop('#dok-seznam .dok-polozka[data-uid="t-rh1"]', '#dok-seznam .dok-objekt[data-obj="' + idObj + '"]'); await w(400);
  s = await stav();
  const toast1 = await p.evaluate(() => Array.from(document.querySelectorAll('.toast')).map(t => t.innerText).join(' | '));
  check('tažením myší je RH1 v objektu (hláška se ZPĚT)', s.data['t-rh1'] === idObj && /RH1 přesunut do objektu „Byt Polní 12"/.test(toast1) && /ZPĚT/.test(toast1), toast1);
  await p.keyboard.press('Control+z'); await w(400);
  s = await stav();
  check('Ctrl+Z vrátí RH1 zpátky do „Bez objektu"', s.data['t-rh1'] === '', JSON.stringify(s.data));
  await p.dragAndDrop('#dok-seznam .dok-polozka[data-uid="t-rh1"]', '#dok-seznam .dok-objekt[data-obj="' + idObj + '"]'); await w(400);

  // ── pravý klik „Přesunout do objektu" ─────────────────────────────────
  await p.click('#dok-seznam .dok-polozka[data-uid="t-rs1"] .dok-p-cislo', { button: 'right' }); await w(200);
  const menu = await p.evaluate(() => Array.from(document.querySelectorAll('.kt-menu .kt-pol')).map(b => b.innerText.replace(/\s+/g, ' ').trim()));
  check('pravý klik na řádek: Otevřít, Náhled PDF, Kopie, Přesunout do objektu…, Smazat', menu.indexOf('Otevřít') === 0 &&
    menu.some(t => t === 'Přesunout do objektu: Byt Polní 12') && menu.some(t => /^Přesunout do nového objektu/.test(t)) && menu.some(t => /Smazat rozvaděč/.test(t)), menu.join(' | '));
  await p.evaluate(() => Array.from(document.querySelectorAll('.kt-menu .kt-pol')).find(b => /Byt Polní 12/.test(b.innerText)).click()); await w(400);

  // ── pole „Objekt" v hlavičce rozvaděče ────────────────────────────────
  await p.evaluate(() => dokOtevrit('t-rs2')); await w(400);
  const volby = await p.evaluate(() => Array.from(dokForm().querySelectorAll('select[data-dk="objekt"] option')).map(o => o.textContent));
  check('hlavička rozvaděče má pole „Objekt" (bez objektu, objekty, ＋ Nový objekt…)',
    volby.join('|') === '— bez objektu —|🏠 Byt Polní 12|＋ Nový objekt…', volby.join('|'));
  await p.evaluate(id => { const e = dokForm().querySelector('select[data-dk="objekt"]'); e.value = id; e.dispatchEvent(new Event('change', { bubbles: true })); }, idObj);
  await w(1200);
  await p.evaluate(() => dokOtevritSeznam()); await w(300);
  s = await stav();
  check('RS2 zařazený polem v hlavičce, objekt má RH1 a pod ním RS1, RS2', s.data['t-rs2'] === idObj &&
    s.skup[0] === '🏠 Byt Polní 12:t-rh1,t-rs1,t-rs2' && s.skup[1] === '📦 Bez objektu:t-rx', s.skup.join(' | '));
  const strom = await p.evaluate(() => Array.from(document.querySelectorAll('#dok-seznam .dok-polozka')).slice(0, 3).map(r =>
    r.className.replace('dok-polozka', '').trim() + '/' + r.querySelector('.dok-p-pod').innerText));
  check('strom napájení: RS1 a RS2 odsazené s „napájen z RH1 (-FA2/-FA3)"', strom[0].indexOf('dok-p-pod1') === -1 &&
    /dok-p-pod1/.test(strom[1]) && /napájen z RH1 \(-FA2\)/.test(strom[1]) && /napájen z RH1 \(-FA3\)/.test(strom[2]), strom.join(' | '));
  await p.screenshot({ path: BEH + '/rozv-objekty.png', fullPage: false });

  // ── pořadí se pod rukama nemění: nový rozvaděč „RA" (abecedně první) ───
  await p.evaluate(async id => {
    await dokNacist();
    DOK.dokumenty.push({ uid: 't-ra', typ: 'rozv', cislo: 'ROZ-0005', data: Object.assign(DOK_TYPY.rozv.novy(), { cislo: 'ROZ-0005', oznaceni: 'RA' }) });
    await dokZapsat(); dokSeznamPolozky();
  }, idObj); await w(200);
  await p.dragAndDrop('#dok-seznam .dok-polozka[data-uid="t-ra"]', '#dok-seznam .dok-obj-obsah[data-obj="' + idObj + '"] .dok-polozka[data-uid="t-rs2"]'); await w(400);
  s = await stav();
  check('rozvaděč přetažený do objektu se zařadí, ostatní se nepohnou (RH1, RS1, RS2 dál pohromadě)',
    s.data['t-ra'] === idObj && /:t-rh1,t-rs1,t-rs2/.test(s.skup[0]) && s.skup[0].split(':')[1].split(',').length === 4, s.skup.join(' | '));
  await p.evaluate(() => dokOtevritSeznam()); await w(200);
  s = await stav();
  check('po novém otevření seznamu se seřadí znovu podle označení (RA, RH1, RS1, RS2)', s.skup[0] === '🏠 Byt Polní 12:t-ra,t-rh1,t-rs1,t-rs2', s.skup[0]);

  // ── sbalení ───────────────────────────────────────────────────────────
  await p.click('#dok-seznam .dok-objekt[data-obj="' + idObj + '"] .dok-obj-pocet'); await w(200);
  const sb = await p.evaluate(id => ({ skryto: document.querySelector('#dok-seznam .dok-obj-obsah[data-obj="' + id + '"]').hidden,
    pocet: document.querySelector('#dok-seznam .dok-objekt[data-obj="' + id + '"] .dok-obj-pocet').innerText }), idObj);
  check('klik na objekt ho sbalí (počet „4 rozvaděče" zůstane vidět)', sb.skryto && sb.pocet === '4 rozvaděče', JSON.stringify(sb));
  await p.keyboard.press('Enter'); await w(200);
  check('Enter na objektu ho zase rozbalí', await p.evaluate(id => !document.querySelector('#dok-seznam .dok-obj-obsah[data-obj="' + id + '"]').hidden, idObj));

  // ── hledání ───────────────────────────────────────────────────────────
  await p.fill('#dok-hledat', 'polni'); await w(200);
  s = await stav();
  check('hledání „polni" najde objekt i se všemi rozvaděči, „Bez objektu" bez nálezu se schová',
    s.skup.length === 1 && s.skup[0].split(':')[1].split(',').length === 4, s.skup.join(' | '));
  await p.fill('#dok-hledat', 'RX'); await w(200);
  s = await stav();
  check('hledání „RX" ukáže jen „Bez objektu" s RX', s.skup.join('|') === '📦 Bez objektu:t-rx', s.skup.join(' | '));
  await p.fill('#dok-hledat', ''); await w(200);

  // ── F2 = přejmenovat, Ctrl+Z ──────────────────────────────────────────
  await p.focus('#dok-seznam .dok-objekt[data-obj="' + idObj + '"]');
  await p.keyboard.press('F2'); await w(200);
  await p.keyboard.press('Control+a'); await p.keyboard.type('Byt Polní 12, Kyjov'); await p.keyboard.press('Enter'); await w(400);
  s = await stav();
  check('F2 na objektu = přejmenovat přímo v řádku', s.obj.join() === 'Byt Polní 12, Kyjov', s.obj.join());
  await p.keyboard.press('Control+z'); await w(400);
  s = await stav();
  check('Ctrl+Z vrátí původní název', s.obj.join() === 'Byt Polní 12', s.obj.join());
  await p.dblclick('#dok-seznam .dok-objekt[data-obj="' + idObj + '"] .dok-obj-nazev b'); await w(200);
  const dbl = await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('dok-obj-input'));
  await p.keyboard.press('Escape'); await w(200);
  s = await stav();
  check('dvojklik na název = přejmenovat, Esc nechá původní', dbl && s.obj.join() === 'Byt Polní 12', String(dbl));

  // ── smazání objektu: rozvaděče zůstanou ───────────────────────────────
  const pocetDok = await p.evaluate(() => DOK.dokumenty.length);
  await p.focus('#dok-seznam .dok-objekt[data-obj="' + idObj + '"]');
  await p.keyboard.press('Delete'); await w(400);
  s = await stav();
  check('Delete na objektu ho smaže, rozvaděče nezmizí — jsou v „Bez objektu"', s.obj.length === 0 &&
    await p.evaluate(() => DOK.dokumenty.length) === pocetDok && s.skup.join('|').indexOf('📦 Bez objektu:') === 0 && Object.values(s.data).every(v => v === ''), s.skup.join(' | '));
  await p.keyboard.press('Control+z'); await w(400);
  s = await stav();
  check('Ctrl+Z vrátí objekt i jeho čtyři rozvaděče', s.obj.join() === 'Byt Polní 12' && ['t-ra', 't-rh1', 't-rs1', 't-rs2'].every(u => s.data[u] === idObj), JSON.stringify(s.data));
  await p.click('#dok-seznam .dok-objekt[data-obj="' + idObj + '"] [data-action="tdObjSmazat"]'); await w(400);
  const t2 = await p.evaluate(() => Array.from(document.querySelectorAll('.toast')).map(t => t.innerText).pop() || '');
  check('🗑 Smazat objekt v řádku — hláška se ZPĚT', /smazán/.test(t2) && /ZPĚT/.test(t2), t2);
  await p.evaluate(() => Array.from(document.querySelectorAll('.toast button')).filter(b => /ZPĚT/.test(b.textContent)).pop().click()); await w(400);
  s = await stav();
  check('ZPĚT v hlášce objekt vrátí', s.obj.join() === 'Byt Polní 12' && s.data['t-rh1'] === idObj);

  // ── nový objekt z hlavičky rozvaděče ──────────────────────────────────
  await p.evaluate(() => dokOtevrit('t-rx')); await w(400);
  await p.click('#dok-form-obsah .rz-hlavicka > summary'); await w(150);   // hlavička je sbalená
  odpoved = 'Dům Lipová 5';
  await p.selectOption('#dok-form-obsah select[data-dk="objekt"]', '__novy'); await w(1300);
  odpoved = null;
  const novy = await p.evaluate(() => { const o = DOK.rozvObjekty.find(x => x.nazev === 'Dům Lipová 5');
    return { id: o && o.id, sel: dokForm().querySelector('select[data-dk="objekt"]').value, ulozeno: (dokNajit('t-rx').data || {}).objekt,
             souhrn: document.getElementById('rz-hl-souhrn').textContent }; });
  check('„＋ Nový objekt…" v hlavičce založí objekt a rozvaděč do něj zařadí', novy.id && novy.sel === novy.id && novy.ulozeno === novy.id &&
    /🏠 Dům Lipová 5/.test(novy.souhrn), JSON.stringify(novy));

  // ── záloha a obnova ───────────────────────────────────────────────────
  const zal = await p.evaluate(async () => {
    const z = dokZalohaData(), kopie = JSON.parse(JSON.stringify(z));
    DOK.rozvObjekty = []; await dokZapsat();
    dokObnovitZeZalohy(kopie); await new Promise(r => setTimeout(r, 300));
    await dokNacist();
    return { vZaloze: (z.rozvObjekty || []).length, poObnove: DOK.rozvObjekty.map(o => o.nazev).sort().join(), idb: ((await idbGet('dok_rozvObjekty')) || []).length,
             radek: dokZalohaRadek({ dokumentace: kopie }) };
  });
  check('záloha nese objekty (část dokumentace) a obnova je vrátí', zal.vZaloze === 2 && zal.poObnove === 'Byt Polní 12,Dům Lipová 5' && zal.idb === 2 &&
    /objekty rozvaděčů: 2/.test(zal.radek), JSON.stringify(zal));

  // ── oddělení od revizí ────────────────────────────────────────────────
  check('data revizí po práci s objekty bajtově stejná', (await otisk()) === otiskPred);
  check('bez chyb v konzoli', !err.length, err.join(' | '));

  // ── telefon ───────────────────────────────────────────────────────────
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await m.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const q = await m.newPage();
  await q.goto(URL); await w(1000);
  await q.evaluate(async () => {
    await dokNacist();
    const o = { id: 'o1', nazev: 'Byt Polní 12' };
    DOK.rozvObjekty = [o];
    DOK.dokumenty = [{ uid: 'a', typ: 'rozv', cislo: 'ROZ-0001', data: Object.assign(DOK_TYPY.rozv.novy(), { oznaceni: 'RH1', objekt: 'o1', stavba: 'Byt Polní 12' }) },
      { uid: 'b', typ: 'rozv', cislo: 'ROZ-0002', data: Object.assign(DOK_TYPY.rozv.novy(), { oznaceni: 'RS1', objekt: 'o1', napajenZ: { uid: 'a', ozn: '-FA2' } }) }];
    await dokZapsat(); dokOtevritSeznam('rozv');
  });
  await w(300);
  const tel = await q.evaluate(() => {
    const h = document.querySelector('#dok-seznam .dok-objekt').getBoundingClientRect();
    return { siroka: document.documentElement.scrollWidth <= window.innerWidth, vyska: h.height, prava: h.right <= window.innerWidth };
  });
  check('telefon 390 px: objekt aspoň 44 px vysoký, nic nepřetéká do strany', tel.siroka && tel.vyska >= 44 && tel.prava, JSON.stringify(tel));
  await q.screenshot({ path: BEH + '/rozv-objekty-telefon.png', fullPage: true });
  await m.close();

  await b.close();
  console.log(res.join('\n'));
  const spatne = res.filter(r => r.startsWith('❌')).length;
  console.log(spatne ? 'ŠPATNĚ: ' + spatne + ' z ' + res.length : 'VŠE OK (' + res.length + ')');
  process.exit(spatne ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.error('SELHALO', e); process.exit(1); });
