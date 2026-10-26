// Tvorba dokumentace — „📤 Soubor pro kolegu" (v9.134).
// Technik A uloží protokol o vnějších vlivech a rozvaděč (v objektu) do
// souboru tlačítkem v liště editoru, kolega B (jiný prohlížeč) ho načte
// přetažením do okna i tlačítkem Načíst. Hlídá: soubor nese celý dokument
// i objekt, jde do Tvorby dokumentace (ne do archivu revizí, data revizí
// bajt po bajtu stejná), opakované načtení se ptá (přepsat / nechat),
// otevřený dokument se nepřepíše, ZPĚT, rozepsaná zpráva se neopustí.
// Všechna data vymyšlená.
const { chromium } = require('./pw');
const fs = require('fs');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));

async function okno(b) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(() => {
    try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {}
    try { delete window.showSaveFilePicker; } catch (e) {}
    window.showSaveFilePicker = undefined;
  });
  const p = await ctx.newPage();
  p.__err = []; p.__odpovedi = []; p.__dotazy = [];
  p.on('pageerror', e => p.__err.push(e.message));
  p.on('dialog', d => { p.__dotazy.push(d.message()); const a = p.__odpovedi.length ? p.__odpovedi.shift() : true; a ? d.accept() : d.dismiss(); });
  await p.goto(URL); await w(1200);
  return p;
}

async function otiskRevizi(p) {
  return p.evaluate(async () => {
    const o = {}; for (const k of STORE_KEYS) o[k] = await idbGet(k);
    return JSON.stringify({ o, ls: localStorage.getItem('revize_el_store') });
  });
}

async function pretahnout(p, cesta) {
  const obsah = fs.readFileSync(cesta, 'utf8');
  await p.evaluate(txt => {
    const dt = new DataTransfer();
    dt.items.add(new File([txt], 'soubor.json', { type: 'application/json' }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, obsah);
  await w(800);
}

(async () => {
  const b = await chromium.launch();
  const A = await okno(b);

  // ── A: protokol a rozvaděč v objektu ─────────────────────────────────
  await A.evaluate(async () => {
    STORE.technik = { jmeno: 'Jan Vymyšlený', mesto: 'Kyjov' }; saveStore();
    const nast = (sel, v) => { const e = dokForm().querySelector(sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    showScreen('home');
    await dokNacist();
    DOK.rozvObjekty.push({ id: 'obj-test1', nazev: 'Vymyšlený bytový dům', vytvoreno: new Date().toISOString() });
    await dokZapsat();
    await dokNovy('pouvv'); await new Promise(r => setTimeout(r, 200));
    nast('[data-dk="stavba"]', 'Vymyšlená kotelna Polní 1');
    await dokUlozitOtevreny();
    window.__uidP = window.__dokOtevreny.uid;
  });
  const lista = await A.evaluate(() => {
    const t = Array.from(document.querySelectorAll('#screen-dok-form .dok-lista-akce button')).map(x => x.textContent.trim());
    return t;
  });
  check('v liště editoru je „📤 Soubor pro kolegu" hned za Uložit', lista[0] === '💾 Uložit' && lista[1] === '📤 Soubor pro kolegu', lista.join(' | '));
  const viditelne = await A.evaluate(() => { const e = document.querySelector('[data-action="tdSouborKolegovi"]'); return e.offsetHeight > 0; });
  check('tlačítko je vidět', viditelne);

  let [dl] = await Promise.all([A.waitForEvent('download'), A.click('[data-action="tdSouborKolegovi"]')]);
  const cestaP = await dl.path();
  const soubP = JSON.parse(fs.readFileSync(cestaP, 'utf8'));
  check('název souboru podle čísla dokumentu', /^POUVV-0001_\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  check('soubor má formát revize-el-dokumenty a jeden dokument', soubP._format === 'revize-el-dokumenty' && soubP.dokumenty.length === 1 && soubP.odesilatel === 'Jan Vymyšlený');
  check('soubor nese i neuloženou poslední změnu (uloží se před exportem)', soubP.dokumenty[0].data.stavba === 'Vymyšlená kotelna Polní 1');

  // rozvaděč v objektu
  await A.evaluate(async () => {
    await dokNovy('rozv'); await new Promise(r => setTimeout(r, 300));
    const f = dokForm();
    const o = f.querySelector('[data-dk="oznaceni"]'); o.value = 'RH1'; o.dispatchEvent(new Event('input', { bubbles: true }));
    const s = f.querySelector('[data-dk="objekt"]'); s.value = 'obj-test1'; s.dispatchEvent(new Event('change', { bubbles: true }));
    await dokUlozitOtevreny();
    window.__uidR = window.__dokOtevreny.uid;
  });
  await w(1700);  // pojistka ulozitSoubor proti dvojímu stažení (1,5 s)
  [dl] = await Promise.all([A.waitForEvent('download'), A.click('[data-action="tdSouborKolegovi"]')]);
  const cestaR = await dl.path();
  const soubR = JSON.parse(fs.readFileSync(cestaR, 'utf8'));
  check('rozvaděč si veze svůj objekt', soubR.objekty.length === 1 && soubR.objekty[0].nazev === 'Vymyšlený bytový dům' && soubR.dokumenty[0].data.objekt === 'obj-test1');
  const archivA = await A.evaluate(() => archiv.length);
  check('export nic nepřidal do archivu revizí', archivA === 0, String(archivA));

  // ── B: kolega ─────────────────────────────────────────────────────────
  const B = await okno(b);
  await B.evaluate(async () => {
    novaZprava('elektro'); await new Promise(r => setTimeout(r, 200));
    document.getElementById('f_ev_cislo').value = 'RE-26-0007';
    document.getElementById('f_misto').value = 'Vymyšlený byt';
    window.__formDirty = false; saveToArchiv(); showScreen('home');
  });
  const otiskPred = await otiskRevizi(B);
  await pretahnout(B, cestaP);
  const poP = await B.evaluate(() => ({ n: DOK.dokumenty.length, st: (DOK.dokumenty[0] || {}).data && DOK.dokumenty[0].data.stavba,
    obr: document.querySelector('.screen.active').id, seznam: document.getElementById('dok-seznam').textContent }));
  check('přetažený soubor se načte do Tvorby dokumentace', poP.n === 1 && poP.st === 'Vymyšlená kotelna Polní 1', JSON.stringify(poP.n));
  check('po načtení je vidět seznam protokolů s dokumentem', poP.obr === 'screen-dok-seznam' && poP.seznam.includes('POUVV-0001'));
  check('dotaz jmenuje dokument a odesílatele', B.__dotazy.some(q => q.includes('POUVV-0001') && q.includes('Jan Vymyšlený')));
  check('data revizí jsou po načtení bajtově stejná', (await otiskRevizi(B)) === otiskPred);
  check('dokument není v archivu revizí', await B.evaluate(() => archiv.length === 1 && !JSON.stringify(archiv).includes('POUVV')));

  // rozvaděč přes tlačítko Načíst (zpracovatZpravuData)
  await B.evaluate(txt => { zpracovatZpravuData(JSON.parse(txt)); }, fs.readFileSync(cestaR, 'utf8'));
  await w(800);
  const poR = await B.evaluate(() => ({ n: DOK.dokumenty.length, obj: DOK.rozvObjekty.map(o => o.nazev),
    obr: document.querySelector('.screen.active').id, typ: __dokTyp, txt: document.getElementById('dok-seznam').textContent }));
  check('Načíst (zpracovatZpravuData) pozná soubor dokumentu', poR.n === 2 && poR.typ === 'rozv');
  check('objekt se u kolegy založí a rozvaděč je v něm', poR.obj.includes('Vymyšlený bytový dům') && poR.txt.includes('Vymyšlený bytový dům') && poR.txt.includes('RH1'));

  // opakované načtení: přepsat × nechat
  await A.evaluate(async () => {
    await dokOtevrit(window.__uidP); await new Promise(r => setTimeout(r, 200));
    const e = dokForm().querySelector('[data-dk="stavba"]'); e.value = 'Kotelna – opravená verze'; e.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await w(1700);  // pojistka ulozitSoubor proti dvojímu stažení (1,5 s)
  [dl] = await Promise.all([A.waitForEvent('download'), A.click('[data-action="tdSouborKolegovi"]')]);
  const cestaP2 = await dl.path();
  B.__dotazy = []; B.__odpovedi = [true, false];
  await pretahnout(B, cestaP2);
  let st = await B.evaluate(() => DOK.dokumenty.filter(x => x.typ === 'pouvv').map(x => x.data.stavba));
  check('„Nechat svůj" dokument nepřepíše', st.length === 1 && st[0] === 'Vymyšlená kotelna Polní 1', st.join(','));
  check('druhý dotaz nabízí přepsat / nechat', B.__dotazy.length === 2 && B.__dotazy[1].includes('PŘEPSAT'));
  B.__odpovedi = [true, true];
  await pretahnout(B, cestaP2);
  st = await B.evaluate(() => DOK.dokumenty.filter(x => x.typ === 'pouvv').map(x => x.data.stavba));
  check('„Přepsat" vezme verzi ze souboru, nic se nezdvojí', st.length === 1 && st[0] === 'Kotelna – opravená verze', st.join(','));
  // ZPĚT
  await B.evaluate(async () => { zpetPosledni(); await new Promise(r => setTimeout(r, 500)); });
  st = await B.evaluate(() => DOK.dokumenty.filter(x => x.typ === 'pouvv').map(x => x.data.stavba));
  check('ZPĚT vrátí dokument jako před načtením', st.length === 1 && st[0] === 'Vymyšlená kotelna Polní 1', st.join(','));
  const ls = await B.evaluate(() => JSON.parse(localStorage.getItem('revize_el_dok')).dokumenty.filter(x => x.typ === 'pouvv')[0].data.stavba);
  check('ZPĚT je zapsané i v úložišti', ls === 'Vymyšlená kotelna Polní 1', ls);

  // otevřený dokument se nepřepíše
  const uidP = await A.evaluate(() => window.__uidP);
  await B.evaluate(async uid => { await dokOtevrit(uid); await new Promise(r => setTimeout(r, 200)); }, uidP);
  B.__dotazy = []; B.__odpovedi = [];
  await pretahnout(B, cestaP2);
  st = await B.evaluate(() => DOK.dokumenty.filter(x => x.typ === 'pouvv').map(x => x.data.stavba));
  check('právě otevřený dokument se nepřepíše a program to řekne', st[0] === 'Vymyšlená kotelna Polní 1' && B.__dotazy.some(q => q.includes('otevřený')));

  // rozepsaná zpráva: načtení z ní neodvede
  await B.evaluate(async () => {
    showScreen('home'); otevritZpravu(0); await new Promise(r => setTimeout(r, 300));
    window.__formDirty = true;
  });
  await B.evaluate(async () => { await dokNacist(); DOK.dokumenty = DOK.dokumenty.filter(x => x.typ !== 'rozv'); await dokZapsat(); });
  B.__odpovedi = [];
  await pretahnout(B, cestaR);
  const zustal = await B.evaluate(() => ({ obr: document.querySelector('.screen.active').id, n: DOK.dokumenty.filter(x => x.typ === 'rozv').length }));
  check('z rozepsané zprávy se po načtení neodchází, dokument se přesto uloží', zustal.obr === 'screen-form' && zustal.n === 1, JSON.stringify(zustal));

  // víc souborů naráz (zpráva + dokument)
  await B.evaluate(async () => { window.__formDirty = false; showScreen('home'); await dokNacist(); DOK.dokumenty = []; await dokZapsat(); });
  B.__odpovedi = [];
  await B.evaluate(([t1, t2]) => {
    const dt = new DataTransfer();
    dt.items.add(new File([t1], 'a.json', { type: 'application/json' }));
    dt.items.add(new File([t2], 'b.json', { type: 'application/json' }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, [fs.readFileSync(cestaP, 'utf8'), fs.readFileSync(cestaR, 'utf8')]);
  await w(1000);
  const vic = await B.evaluate(() => DOK.dokumenty.map(x => x.typ).sort().join(','));
  check('dva soubory dokumentů přetažené naráz se načtou oba', vic === 'pouvv,rozv', vic);

  check('bez chyb v konzoli', !A.__err.length && !B.__err.length, A.__err.concat(B.__err).join(' | '));
  console.log(res.join('\n'));
  await b.close();
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})();
