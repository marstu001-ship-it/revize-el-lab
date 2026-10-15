// LAB — oddělení dat od ostrého programu (jen v revize-el-lab, NEPŘENÁŠET).
// Ostrý program (/revize-el/) a lab (/revize-el-lab/) běží na GitHub Pages na
// TÉMŽE původu, takže sdílejí localStorage, IndexedDB, BroadcastChannel, cache
// i Origin Private FS. Test to napodobí: jeden server (8930), ve složce
// revize-el/ ostrý program z commitu v9.122 (z něj lab vznikl), ve složce
// revize-el-lab/ pracovní kopie labu. Na téže adrese se nejdřív založí
// vymyšlená data ostrého programu a pak se prokáže, že je lab nečte, nemění
// ani nemaže — a že si naopak ukládá vlastní.
const { chromium } = require('./pw');
const fs = require('fs'), cp = require('child_process'), path = require('path');
const DIR = __dirname, R = path.join(DIR, '..'), B = path.join(DIR, '_beh', 'spolecny');
const OSTRY = '8114304';   // v9.122 — ostrý program v době založení labu
const PORT = 8930, URL = 'http://127.0.0.1:' + PORT;
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));

function priprav() {
  fs.rmSync(B, { recursive: true, force: true });
  fs.mkdirSync(B + '/revize-el', { recursive: true });
  fs.mkdirSync(B + '/revize-el-lab', { recursive: true });
  for (const f of ['index.html', 'sw.js', 'manifest.json']) {
    fs.writeFileSync(B + '/revize-el/' + f, cp.execFileSync('git', ['-C', R, 'show', OSTRY + ':' + f], { maxBuffer: 64 << 20 }));
    fs.copyFileSync(path.join(R, f), B + '/revize-el-lab/' + f);
  }
  fs.writeFileSync(B + '/prazdna.html', '<!doctype html><meta charset="utf-8"><title>surový přístup</title>');
}

// Surový pohled na úložiště původu — ze stránky BEZ labového bloku.
async function snimek(p) {
  return p.evaluate(async () => {
    const ls = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
    const idbDump = name => new Promise(res => {
      const r = indexedDB.open(name);
      r.onupgradeneeded = () => { r.transaction.abort(); };
      r.onerror = () => res(null);
      r.onsuccess = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('kv')) { db.close(); return res({}); }
        const out = {}, tx = db.transaction('kv'), st = tx.objectStore('kv');
        const c = st.openCursor();
        c.onsuccess = () => { const x = c.result; if (x) { out[x.key] = JSON.stringify(x.value); x.continue(); } };
        tx.oncomplete = () => { db.close(); res(out); };
      };
    });
    const dbs = (await indexedDB.databases()).map(d => d.name).sort();
    const idb = { ostra: dbs.includes('revize-el-db') ? await idbDump('revize-el-db') : null,
                  lab: dbs.includes('revize-lab-db') ? await idbDump('revize-lab-db') : null };
    const cache = (await caches.keys()).sort();
    const root = await navigator.storage.getDirectory();
    const opfs = {};
    try {
      const d = await root.getDirectoryHandle('zalohy');
      for await (const [n, h] of d.entries()) opfs[n] = await (await h.getFile()).text();
    } catch (e) {}
    return { ls, dbs, idb, cache, opfs };
  });
}

(async () => {
  priprav();
  const srv = cp.spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: B, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 700));
  const br = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    const ctx = await br.newContext();
    // Dialog výběru složky / Uložit jako se v headless neotevře — nahradí se
    // DŘÍV než labový blok, který je pak obaluje (tak jako skutečné API).
    await ctx.addInitScript(() => {
      window.showDirectoryPicker = async () => window.__testSlozka;
      window.showSaveFilePicker = async o => {
        window.__ulozitJako = o;
        const e = new Error('test'); e.name = 'AbortError'; throw e;
      };
    });
    const surova = await ctx.newPage();
    await surova.goto(URL + '/prazdna.html');

    // ── 1. vymyšlená data ostrého programu ─────────────────────────────
    await surova.evaluate(async () => {
      const st = { technik: { jmeno: 'Ostrý Technik' }, pristroje: [], odberatele: [], snippety: [],
        archiv: [{ uid: 'ostra-1', typ: 'elektro', ev_cislo: 'OSTRA-0001', misto: 'Ostrý objekt',
                   timestamp: '2026-10-01T08:00:00.000Z', stav: '', data: { ev_cislo: 'OSTRA-0001', typ: 'elektro', f_misto: 'Ostrý objekt' } }] };
      localStorage.setItem('revize_el_store', JSON.stringify(st));
      localStorage.setItem('revize_el_theme', 'dark');
      localStorage.setItem('revize_el_novinky_seen', '2099-01-01');
      localStorage.setItem('revize_el_autosave', JSON.stringify({ _t: '2026-10-01T08:00:00Z', uid: '', data: { ev_cislo: 'OSTRA-KONCEPT', typ: 'elektro' } }));
      localStorage.setItem('revize_el_fiktivni_klic', 'ostrý program — nesahat');
      await new Promise(res => {
        const r = indexedDB.open('revize-el-db', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => {
          const tx = r.result.transaction('kv', 'readwrite'), s = tx.objectStore('kv');
          s.put(st.technik, 'technik'); s.put(st.archiv, 'archiv'); s.put([], 'pristroje');
          tx.oncomplete = () => { r.result.close(); res(); };
        };
      });
      const c = await caches.open('revize-el-v9.122-20261013');
      await c.put('/revize-el/index.html', new Response('ostrý program v cache'));
      const root = await navigator.storage.getDirectory();
      const d = await root.getDirectoryHandle('zalohy', { create: true });
      const zapis = async (n, t) => { const w = await (await d.getFileHandle(n, { create: true })).createWritable(); await w.write(t); await w.close(); };
      for (let i = 1; i <= 25; i++) await zapis('revize-el-zaloha-2026-01-' + String(i).padStart(2, '0') + '_10-00.json', 'OSTRÁ ZÁLOHA ' + i);
      for (let i = 1; i <= 25; i++) await zapis('revize-lab-zaloha-2026-02-' + String(i).padStart(2, '0') + '_10-00.json', 'labová záloha ' + i);
      await zapis('cizi-soubor.txt', 'nesahat');
      await root.getDirectoryHandle('ciste', { create: true });
    });
    const pred = await snimek(surova);
    const ostreKlice = Object.keys(pred.ls).filter(k => k.startsWith('revize_el_'));
    check('data ostrého programu založena (5 klíčů, IDB, cache, 25 záloh)',
      ostreKlice.length === 5 && pred.idb.ostra && pred.cache.length === 1 &&
      Object.keys(pred.opfs).filter(n => n.startsWith('revize-el-')).length === 25);

    // ── 2. lab se načte a data ostrého programu nevidí ─────────────────
    const lab = await ctx.newPage();
    const dialogy = [];
    lab.on('dialog', d => { dialogy.push(d.message()); d.accept(); });
    await lab.goto(URL + '/revize-el-lab/index.html');
    await lab.waitForFunction(() => typeof saveStore === 'function');
    await lab.waitForTimeout(1500);
    const v = await lab.evaluate(() => ({
      jmeno: (STORE.technik || {}).jmeno || '',
      archiv: JSON.stringify(STORE.archiv || []),
      tmavy: document.documentElement.classList.contains('dark'),
      koncept: !!document.querySelector('#draft-banner, .draft-banner') && /OSTRA-KONCEPT/.test(document.body.innerText),
      text: document.body.innerText,
      fiktivni: localStorage.getItem('revize_el_fiktivni_klic'),
      stitek: (document.querySelector('.lab-stitek') || {}).textContent || '',
      stitekVidet: !!document.querySelector('.lab-stitek') && document.querySelector('.lab-stitek').offsetHeight > 0,
      titulek: document.title,
      lista: getComputedStyle(document.querySelector('.topbar')).backgroundColor,
      ver: document.querySelector('.topbar .ver').textContent,
    }));
    check('lab nenačetl technika ostrého programu', v.jmeno !== 'Ostrý Technik' && !/Ostrý Technik/.test(v.text), v.jmeno);
    check('lab nevidí zprávu ostrého programu v archivu', !/OSTRA-0001/.test(v.archiv) && !/OSTRA-0001/.test(v.text));
    check('lab nepřevzal tmavý režim ostrého programu', !v.tmavy);
    check('lab nenabízí koncept ostrého programu', !/OSTRA-KONCEPT/.test(v.text));
    check('klíč ostrého programu přes localStorage.getItem nepřečte', v.fiktivni === null, String(v.fiktivni));
    check('štítek LAB je v liště vidět', v.stitekVidet && /^LAB v\d/.test(v.stitek), v.stitek);
    check('titulek stránky obsahuje LAB', /LAB/.test(v.titulek), v.titulek);
    check('lišta má labovou barvu (oranžová)', v.lista === 'rgb(194, 65, 12)', v.lista);
    check('verze ostrého programu v liště zůstala nedotčená', /v9\.122/.test(v.ver), v.ver);

    // ── 3. lab ukládá — do vlastních klíčů ─────────────────────────────
    await lab.evaluate(() => {
      STORE.technik = Object.assign({}, STORE.technik, { jmeno: 'Labový Technik' });
      saveStore();
      toggleTheme();
      localStorage.setItem('revize_el_novinky_seen', '2026-10-15');
      localStorage.removeItem('revize_el_fiktivni_klic');   // smí smazat jen svou kopii
    });
    await lab.waitForTimeout(800);

    // ── 4. okna: lab ↔ ostrý program se neslyší, lab ↔ lab ano ──────────
    await lab.evaluate(() => {
      window.__nacteno = 0;
      const o = storeZJinehoOkna;
      storeZJinehoOkna = function() { window.__nacteno++; return o.apply(this, arguments); };
    });
    await surova.evaluate(() => {
      window.__ostryKanal = [];
      const k = new BroadcastChannel('revize-el-store');
      k.onmessage = e => window.__ostryKanal.push(e.data);
      window.__k = k;
    });
    await lab.evaluate(() => saveStore());
    await lab.waitForTimeout(600);
    check('uložení v labu nedorazí kanálem ostrému programu',
      (await surova.evaluate(() => window.__ostryKanal.length)) === 0);
    await surova.evaluate(() => {
      window.__k.postMessage({ okno: 'ostry', t: Date.now() });
      localStorage.setItem('revize_el_store', localStorage.getItem('revize_el_store'));
      localStorage.setItem('revize_el_fiktivni_klic', 'ostrý program — nesahat');
    });
    await lab.waitForTimeout(800);
    check('ohlášení ostrého programu (kanál i storage) lab nenačítá', (await lab.evaluate(() => window.__nacteno)) === 0);
    const lab2 = await ctx.newPage();
    await lab2.goto(URL + '/revize-el-lab/index.html');
    await lab2.waitForFunction(() => typeof saveStore === 'function');
    await lab2.waitForTimeout(1200);
    const jmeno2 = await lab2.evaluate(() => (STORE.technik || {}).jmeno);
    check('druhé okno labu načte data labu', jmeno2 === 'Labový Technik', jmeno2);
    await lab2.evaluate(() => { STORE.technik.jmeno = 'Labový Technik 2'; saveStore(); });
    await lab.waitForTimeout(1000);
    const po2 = await lab.evaluate(() => ({ n: window.__nacteno, j: STORE.technik.jmeno }));
    check('labová okna se dál slaďují (hlídání dvou oken funguje)', po2.n >= 1 && po2.j === 'Labový Technik 2', JSON.stringify(po2));
    await lab2.close();

    // ── 5. automatická záloha do složky ────────────────────────────────
    await lab.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      window.__testSlozka = await root.getDirectoryHandle('zalohy');
    });
    dialogy.length = 0;
    await lab.evaluate(() => vybratSlozkuZaloh());
    await lab.waitForTimeout(600);
    check('složku se zálohami ostrého programu lab odmítne',
      dialogy.some(d => /ostrého programu/.test(d)) && (await lab.evaluate(() => backupDirHandle === null)), dialogy.join(' | '));
    // zápis zálohy do sdílené složky (zálohy by si technik neměl plést, ale i kdyby):
    const zal = await lab.evaluate(async () => {
      backupDirHandle = window.__testSlozka;
      const ok = await autoZaloha(true);
      await rotaceZaloh();   // autoZaloha ji pouští bez čekání — doběhnout dřív, než se složka změní
      return { ok, jmeno: STORE.auto_zaloha_soubor };
    });
    check('lab zálohu zapsal', zal.ok, JSON.stringify(zal));
    await lab.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      window.__testSlozka = await root.getDirectoryHandle('ciste');
      backupDirHandle = null;
    });
    dialogy.length = 0;
    await lab.evaluate(() => vybratSlozkuZaloh());
    await lab.waitForTimeout(800);
    check('vlastní (prázdnou) složku lab přijme', await lab.evaluate(() => backupDirHandle && backupDirHandle.name === 'ciste'), dialogy.join(' | '));
    await lab.evaluate(async () => { backupDirHandle = null; });

    // ── 6. Uložit jako / stažení ───────────────────────────────────────
    await lab.evaluate(() => ulozitSoubor(new Blob(['{}'], { type: 'application/json' }), 'Zpravy_3_2026-10-15.json'));
    const uj = await lab.evaluate(() => window.__ulozitJako || {});
    check('Uložit jako nabídne název s LAB_ a vlastní složku dialogu',
      uj.suggestedName === 'LAB_Zpravy_3_2026-10-15.json' && uj.id === 'revize-lab', JSON.stringify(uj));
    const [dl] = await Promise.all([
      lab.waitForEvent('download'),
      lab.evaluate(() => stahnoutSoubor(new Blob(['x'], { type: 'application/json' }), 'Plan_revizi_2026-10-15.json')),
    ]);
    check('stažený soubor má předponu LAB_', dl.suggestedFilename() === 'LAB_Plan_revizi_2026-10-15.json', dl.suggestedFilename());

    // ── 7. service worker labu ─────────────────────────────────────────
    const sw = await lab.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      return { scope: r.scope };
    });
    await lab.waitForTimeout(800);
    check('service worker labu má rozsah jen /revize-el-lab/', /\/revize-el-lab\/$/.test(sw.scope), sw.scope);

    // ── 8. surový pohled: ostrá data bajt po bajtu stejná ──────────────
    const po = await snimek(surova);
    const zmeny = ostreKlice.filter(k => po.ls[k] !== pred.ls[k]);
    check('všech 5 klíčů ostrého programu v localStorage beze změny', zmeny.length === 0, zmeny.join(', '));
    const noveOstre = Object.keys(po.ls).filter(k => k.startsWith('revize_el_') && !(k in pred.ls));
    check('lab nezaložil žádný klíč revize_el_…', noveOstre.length === 0, noveOstre.join(', '));
    check('IndexedDB revize-el-db beze změny', JSON.stringify(po.idb.ostra) === JSON.stringify(pred.idb.ostra));
    const labKlice = Object.keys(po.ls).filter(k => k.startsWith('revize_lab_'));
    check('lab ukládá do vlastních klíčů revize_lab_…',
      labKlice.includes('revize_lab_store') && labKlice.includes('revize_lab_theme') &&
      /Labový Technik/.test(po.ls.revize_lab_store) && po.ls.revize_lab_novinky_seen === '2026-10-15', labKlice.join(', '));
    check('lab má vlastní IndexedDB revize-lab-db', po.idb.lab && /Labový Technik/.test(po.idb.lab.technik || ''), po.dbs.join(', '));
    check('cache ostrého programu zůstala', po.cache.includes('revize-el-v9.122-20261013'), po.cache.join(', '));
    check('lab má vlastní cache revize-el-lab-…', po.cache.some(n => /^revize-el-lab-v\d+\.\d+-\d{8}$/.test(n)), po.cache.join(', '));
    const ostreZal = Object.keys(po.opfs).filter(n => n.startsWith('revize-el-'));
    check('25 záloh ostrého programu ve složce beze změny',
      ostreZal.length === 25 && ostreZal.every(n => po.opfs[n] === pred.opfs[n]), ostreZal.length + ' souborů');
    const labZal = Object.keys(po.opfs).filter(n => n.startsWith('revize-lab-zaloha-'));
    check('lab píše revize-lab-zaloha-… a rotace drží 20 labových', labZal.length === 20 &&
      labZal.some(n => /Labový Technik/.test(po.opfs[n])), labZal.length + ' souborů');
    check('cizí soubor ve složce zůstal', po.opfs['cizi-soubor.txt'] === 'nesahat');

    // ── 9. ostrý program dál vidí svá data ─────────────────────────────
    const ostry = await ctx.newPage();
    await ostry.goto(URL + '/revize-el/index.html');
    await ostry.waitForFunction(() => typeof saveStore === 'function');
    await ostry.waitForTimeout(1500);
    const o = await ostry.evaluate(() => ({ j: (STORE.technik || {}).jmeno, a: JSON.stringify(STORE.archiv), stitek: !!document.querySelector('.lab-stitek') }));
    check('ostrý program po labu načte svá data (technik i zprávu)', o.j === 'Ostrý Technik' && /OSTRA-0001/.test(o.a), o.j);
    check('ostrý program nemá štítek LAB', !o.stitek);
  } catch (e) {
    check('test doběhl', false, 'CRASH ' + (e && e.stack || e));
  } finally {
    await br.close();
    srv.kill();
  }
  console.log(res.join('\n'));
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})();
