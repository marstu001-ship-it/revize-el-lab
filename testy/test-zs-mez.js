// Zs mez — automatické vyhodnocení impedance poruchové smyčky (blok zsLim…).
// Mez Zs,lim = 2/3 × U0 / Ia, Ia = 5/10/20 × In pro B/C/D, jen v síti TN.
// Jen formulář (barva buňky, nápověda, bublina) + nabídka vady C1 po kliknutí.
// Žádná nová data v JSON. Všechna data vymyšlená.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901;
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(900);

  // ── čistá funkce ─────────────────────────────────────────────────────
  const f = await p.evaluate(() => {
    const TN = '1NPE ~50Hz 230V / TN-C-S';
    const v = (ch, a, zsm, idn, soust, rt) => zsLimVypocet({ rowtype: rt || 'obvod', ch, a, zsm, idn: idn || '' }, soust || TN);
    const m = x => x.mez == null ? null : x.mez.toFixed(2);
    return {
      b16ok: v('B', '16', '1,10'), b16ko: v('B', '16', '2,50'),
      c16ok: v('C', '16', '0,90'), c16ko: v('C', '16', '1,00'),
      d10: m(v('D', '10', '')), d10s: v('D', '10', '').stav,
      rcd: v('B', '16', '2,50', '0,03'),
      gg: v('Gg', '16', '0,50'), gg2: v('gG', '16 A', '0,50'),
      prazdna: v('', '16', '0,50'),
      it: v('B', '16', '2,50', '', '3PE ~50Hz 400V / IT'),
      tt: v('B', '16', '2,50', '', '1NPE ~50Hz 230V / TT'),
      carka: v('B', '16', '1,1'), tecka: v('B', '16', '1.1'),
      charB: v('char. B', '16', '1,1'), male: v('b', '16 A', '1,1'), b16ch: v('B16', '', '1,1'),
      a16A: v('B', '16A', '1,1'), bezIn: v('B', '', '1,1'), bezZs: v('B', '16', ''),
      mensi: v('B', '16', '<0,1'), vetsi: v('B', '16', '>20'), nejasne: v('B', '16', '>0,5'), text: v('B', '16', 'neměřeno'),
      rcdTyp: v('A', '25', '2,50', '0,03', null, 'rcd-header'),
      rcbo: v('B/A', '16', '2,50', '0,03', null, 'rcd-header'),
      podradek: v('B', '16', '2,50', '', null, 'rcd-mereni'),
      hranice: v('C', '16', '0,96')
    };
  });
  check('B16 s 1,10 → vyhovuje, mez 1,92', f.b16ok.stav === 'vyhovuje' && f.b16ok.mez.toFixed(2) === '1.92', f.b16ok.stav);
  check('bublina: výpočet krok za krokem', f.b16ok.vysvetleni.indexOf('B16: Ia = 5 × 16 = 80 A; Zs,lim = 2/3 × 230 / 80 = 1,92 Ω; naměřeno 1,10 Ω → vyhovuje') === 0, f.b16ok.vysvetleni);
  check('bublina odkazuje na normu (z katalogu vad C1)', /ČSN 33 2000-4-41 ed\.3/.test(f.b16ok.vysvetleni));
  check('B16 s 2,50 → nevyhovuje', f.b16ko.stav === 'nevyhovuje', f.b16ko.stav);
  check('C16 s 0,90 → vyhovuje, mez 0,96', f.c16ok.stav === 'vyhovuje' && f.c16ok.mez.toFixed(2) === '0.96');
  check('C16 s 1,00 → nevyhovuje', f.c16ko.stav === 'nevyhovuje');
  check('D10 → mez 0,77', f.d10 === '0.77' && f.d10s === 'mez', f.d10);
  check('B16 + IΔn 0,03 s 2,50 → oranžová (posoudit)', f.rcd.stav === 'rcd' && /nevyhovuje jistič, obvod chráněn RCD IΔn = 0,03 A \(30 mA\) – posuďte/.test(f.rcd.vysvetleni), f.rcd.vysvetleni);
  check('Gg 16 → nevyhodnoceno', f.gg.stav === 'nevyhodnoceno' && f.gg.mez === null && f.gg2.stav === 'nevyhodnoceno');
  check('prázdná charakteristika → nevyhodnoceno', f.prazdna.stav === 'nevyhodnoceno');
  check('soustava IT → nevyhodnoceno', f.it.stav === 'nevyhodnoceno' && f.it.mez === null);
  check('soustava TT → nevyhodnoceno', f.tt.stav === 'nevyhodnoceno');
  check('„1,1" i „1.1" → stejný výsledek', f.carka.stav === f.tecka.stav && f.carka.mez === f.tecka.mez && f.carka.stav === 'vyhovuje');
  check('charakteristika tolerantně: „char. B", „b", „B16"', ['charB', 'male', 'b16ch'].every(k => f[k].stav === 'vyhovuje' && f[k].mez.toFixed(2) === '1.92'));
  check('In tolerantně: „16A", „16 A"', f.a16A.stav === 'vyhovuje' && f.male.stav === 'vyhovuje');
  check('bez In → nevyhodnoceno', f.bezIn.stav === 'nevyhodnoceno');
  check('bez naměřené hodnoty → jen mez, bez barvy', f.bezZs.stav === 'mez' && f.bezZs.mez > 1.9);
  check('„<0,1" → vyhovuje, „>20" → nevyhovuje', f.mensi.stav === 'vyhovuje' && f.vetsi.stav === 'nevyhovuje');
  check('„>0,5" (nejednoznačné) a text → bez barvy', f.nejasne.stav === 'mez' && f.text.stav === 'mez');
  check('hlavička chrániče s typem „A" (ne jistič) → nevyhodnoceno', f.rcdTyp.stav === 'nevyhodnoceno');
  check('RCBO „B/A" → vyhodnoceno podle B, s IΔn oranžově', f.rcbo.stav === 'rcd');
  check('podřádek chrániče se nevyhodnocuje', f.podradek.stav === 'nevyhodnoceno');
  check('na hranici (0,96 > 0,9583) se řekne přesná mez', f.hranice.stav === 'nevyhovuje' && /přesně 0,9583 Ω/.test(f.hranice.vysvetleni), f.hranice.vysvetleni);

  // ── formulář ─────────────────────────────────────────────────────────
  await p.evaluate(async () => {
    localStorage.clear(); archiv.length = 0; STORE.archiv = archiv;
    aktTyp = 'elektro'; aktPodtyp = 'prumysl'; novaZprava('elektro');
    await new Promise(r => setTimeout(r, 300));
    switchTab('mereni');
    const tbody = document.querySelector('#rozvadece-container .meas-table tbody');
    document.querySelector('#rozvadece-container .rozv-nazev').value = 'RH';
    while (tbody.querySelectorAll('tr[data-rowtype="obvod"]').length < 5) addMereniRowTo(tbody);
    const rows = Array.from(tbody.querySelectorAll('tr[data-rowtype="obvod"]'));
    const nastav = (tr, sl, v) => { const i = fillCilovyInput(tr, sl); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); };
    const data = [
      ['Světla', 'B', '16', '', '1,10'],
      ['Zásuvky kuchyně', 'B', '16', '', '2,50'],
      ['Koupelna', 'B', '16', '0,03', '2,50'],
      ['Sklep', 'Gg', '16', '', '2,50'],
      ['Garáž', 'C', '16', '', ''],
    ];
    data.forEach((d, i) => { nastav(rows[i], 1, d[0]); nastav(rows[i], 3, d[1]); nastav(rows[i], 4, d[2]); nastav(rows[i], 5, d[3]); nastav(rows[i], 7, d[4]); });
    await new Promise(r => setTimeout(r, 120));
  });
  const stavy = () => p.evaluate(() => Array.from(document.querySelectorAll('#rozvadece-container .meas-table tbody tr[data-rowtype="obvod"]')).map(tr => {
    const td = zsLimBunka(tr, 7); const i = td.querySelector('input');
    return { cls: ['zs-lim-ok', 'zs-lim-chyba', 'zs-lim-rcd'].filter(c => td.classList.contains(c)).join(''), ph: i.placeholder, title: i.title || '',
             bg: getComputedStyle(td).backgroundColor };
  }));
  let s = await stavy();
  check('formulář: vyhovující obvod je zelený', s[0].cls === 'zs-lim-ok' && s[0].bg !== 'rgba(0, 0, 0, 0)', JSON.stringify(s[0]));
  check('formulář: nevyhovující obvod je červený', s[1].cls === 'zs-lim-chyba', JSON.stringify(s[1]));
  check('formulář: obvod s RCD je oranžový', s[2].cls === 'zs-lim-rcd' && /posuďte/.test(s[2].title), JSON.stringify(s[2]));
  check('formulář: pojistka Gg zůstane neutrální (bez barvy, bez bubliny, původní nápověda)', s[3].cls === '' && s[3].title === '' && s[3].ph === '0,23', JSON.stringify(s[3]));
  check('formulář: prázdná buňka ukazuje mez jako nápovědu „≤ 0,96 Ω"', s[4].ph === '≤ 0,96 Ω' && s[4].cls === '', JSON.stringify(s[4]));
  check('formulář: bublina u buňky s výpočtem', /^B16: Ia = 5 × 16 = 80 A/.test(s[0].title), s[0].title);

  // změna In → přepočet
  await p.evaluate(async () => { const tr = document.querySelectorAll('#rozvadece-container tr[data-rowtype="obvod"]')[1];
    const i = fillCilovyInput(tr, 4); i.value = '6'; i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 80)); });
  s = await stavy();
  check('změna In (16 → 6) přepočítá: 2,50 ≤ 5,11 → zelená', s[1].cls === 'zs-lim-ok' && /= 5,11 Ω/.test(s[1].title), s[1].title);
  await p.evaluate(async () => { const tr = document.querySelectorAll('#rozvadece-container tr[data-rowtype="obvod"]')[1];
    const i = fillCilovyInput(tr, 4); i.value = '16'; i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 80)); });

  // napěťová soustava IT → nic se nevyhodnocuje; zpět na TN → barvy zpátky
  await p.evaluate(async () => {
    const boxy = Array.from(document.querySelectorAll('#napetova-checkboxy input[type=checkbox]'));
    const lbl = c => document.querySelector('label[for="' + c.id + '"]').textContent;
    boxy.forEach(c => { c.checked = /IT$/.test(lbl(c)); c.dispatchEvent(new Event('change', { bubbles: true })); });
    await new Promise(r => setTimeout(r, 80));
  });
  s = await stavy();
  check('soustava IT ve formuláři → žádná barva, žádná mez', s.every(x => x.cls === '' && x.title === '' && !/≤/.test(x.ph)), JSON.stringify(s.map(x => x.cls + '|' + x.ph)));
  await p.evaluate(async () => {
    document.querySelectorAll('#napetova-checkboxy input[type=checkbox]').forEach((c, i) => { c.checked = i === 0; c.dispatchEvent(new Event('change', { bubbles: true })); });
    await new Promise(r => setTimeout(r, 80));
  });
  s = await stavy();
  check('zpět na TN → barvy se vrátí', s[0].cls === 'zs-lim-ok' && s[1].cls === 'zs-lim-chyba' && s[2].cls === 'zs-lim-rcd');

  // táhlo / vložení bez událostí → přepočet přes autoSave / renumberRows
  await p.evaluate(async () => { const tr = document.querySelectorAll('#rozvadece-container tr[data-rowtype="obvod"]')[0];
    fillCilovyInput(tr, 7).value = '1.1'; autoSave(); await new Promise(r => setTimeout(r, 80)); });
  s = await stavy();
  check('„1.1" s tečkou ve formuláři → stejně zelená jako „1,10"', s[0].cls === 'zs-lim-ok' && /naměřeno 1,1 Ω/.test(s[0].title), s[0].title);

  // vložení z Excelu → nový řádek se vyhodnotí
  await p.evaluate(async () => {
    vlozitMereniOtevrit({ od: 1, text: 'Pračka\tABB\tB\t16\t\t\t3,00' });
    vlozitMereniPotvrdit(); await new Promise(r => setTimeout(r, 120));
  });
  s = await stavy();
  check('vložení z Excelu: nový obvod B16 s 3,00 → červený', s.length === 6 && s[5].cls === 'zs-lim-chyba', JSON.stringify(s[5]));

  // nabídka vady C1 — nic se nepřidá samo
  const pred = await p.evaluate(() => {
    const h = Array.from(document.querySelectorAll('.zs-c1-nabidka'));
    return { zavad: document.querySelectorAll('#zavady-list .zavada-item').length, hosty: h.length,
             vid: h.map(x => x.style.display !== 'none' && !!x.querySelector('button')), text: h[0] && h[0].textContent };
  });
  check('vada C1 se sama NEPŘIDÁ', pred.zavad === 0, String(pred.zavad));
  check('nabídka „Přidat vadu C1 (obvody: …)" je u měření i u závad', pred.hosty === 2 && pred.vid.every(Boolean), JSON.stringify(pred));
  check('nabídka jmenuje jen červené obvody (2 a 6), ne oranžový', /Přidat vadu C1 \(obvody: RH 2, RH 6\)/.test(pred.text), pred.text);
  await p.evaluate(() => { window.__formDirty = false; switchTab('zaver'); });
  await p.locator('#tab-zaver .zs-c1-nabidka button').click();
  await p.waitForTimeout(200);
  const po = await p.evaluate(() => {
    const it = Array.from(document.querySelectorAll('#zavady-list .zavada-item'));
    const z = it[0];
    return { n: it.length, kod: z && z.querySelector('select[data-action="updZavadaKod"]').value,
             popis: z && z.querySelector('textarea').value, norma: z && z.querySelectorAll('input[type=text]')[1].value,
             dirty: !!window.__formDirty, nabidka: Array.from(document.querySelectorAll('.zs-c1-nabidka')).map(h => h.style.display) };
  });
  check('po kliknutí přibude právě jedna vada C1', po.n === 1 && po.kod === 'C1', JSON.stringify(po));
  check('popis = položka C1 z katalogu + obvody', /^Impedance poruchové smyčky Zsm přesahuje \(2\/3\) × U0\/Ia — obvody: RH: č\. 2 Zásuvky kuchyně \(Zs 2,50 Ω, mez 1,92 Ω\); RH: č\. 6 Pračka \(Zs 3,00 Ω, mez 1,92 Ω\)\.$/.test(po.popis), po.popis);
  check('oranžový obvod (Koupelna) ve vadě není', po.popis.indexOf('Koupelna') === -1);
  check('norma z katalogu', /411\.3\.2/.test(po.norma), po.norma);
  check('zpráva je označená jako změněná', po.dirty);
  check('po přidání se nabídka schová (vada už obvody jmenuje)', po.nabidka.every(d => d === 'none'), JSON.stringify(po.nabidka));

  // ⧉ kopie červeného řádku → kopie se vyhodnotí a nabídka C1 se vrátí
  const kopie = await p.evaluate(async () => {
    const tr = document.querySelectorAll('#rozvadece-container tr[data-rowtype="obvod"]')[1];
    copyRow(tr.querySelector('[data-action="copyRow"]')); await new Promise(r => setTimeout(r, 120));
    const k = document.querySelectorAll('#rozvadece-container tr[data-rowtype="obvod"]')[2];
    const h = document.querySelector('.zs-c1-nabidka');
    return { cls: zsLimBunka(k, 7).className, nab: h.style.display !== 'none', text: h.textContent };
  });
  check('⧉ kopie červeného řádku je taky červená', /zs-lim-chyba/.test(kopie.cls), kopie.cls);
  check('nový červený obvod → nabídka C1 se znovu ukáže', kopie.nab && /obvody: RH 2, RH 3, RH 7/.test(kopie.text), kopie.text);

  // dokončená zpráva: barvy zůstanou, nabídka ne
  const ro = await p.evaluate(async () => {
    const tr = document.querySelectorAll('#rozvadece-container tr[data-rowtype="obvod"]')[0];
    fillCilovyInput(tr, 7).value = '9'; autoSave(); await new Promise(r => setTimeout(r, 80));
    setFormReadOnly(true); switchTab('mereni'); zsLimPrepocet();
    const td = zsLimBunka(tr, 7);
    const h = document.querySelector('.zs-c1-nabidka');
    const v = { cls: td.className, nab: h.offsetHeight };
    setFormReadOnly(false);
    return v;
  });
  check('dokončená zpráva: buňka se dál barví, nabídka C1 schovaná', /zs-lim-chyba/.test(ro.cls) && ro.nab === 0, JSON.stringify(ro));

  // PDF se nemění
  const pdf = await p.evaluate(async () => { generujPDF(); await new Promise(r => setTimeout(r, 1500));
    const t = document.getElementById('pdf-pages').innerText; showScreen('form'); return t; });
  check('do PDF se mez ani výpočet nedostane', !/Zs,lim|≤ 1,92/.test(pdf));

  // ── stará zpráva: data beze změny ────────────────────────────────────
  const stara = await p.evaluate(async () => {
    localStorage.clear(); archiv.length = 0; STORE.archiv = archiv;
    aktTyp = 'elektro'; aktPodtyp = 'dum'; novaZprava('elektro');
    await new Promise(r => setTimeout(r, 300));
    const D = getData();
    D.ev_cislo = 'RE-26-0777'; D.misto = 'Vymyšlený dům 7';
    D.rozvadece[0].nazev = 'RD';
    D.rozvadece[0].mereni = [
      { rowtype: 'obvod', c: '1', n: 'Světla', typ: 'OEZ', ch: 'B', a: '10', idn: '', isc: '', zsm: '0,80', riso: '>20', rpe: '', faze: '', vyp: '', cas: '', t5idn: '', ut: '', kabel: 'CYKY 3×1,5' },
      { rowtype: 'obvod', c: '2', n: 'Zásuvky', typ: 'OEZ', ch: 'B', a: '16', idn: '', isc: '', zsm: '2,50', riso: '>20', rpe: '', faze: '', vyp: '', cas: '', t5idn: '', ut: '', kabel: 'CYKY 3×2,5' },
      { rowtype: 'obvod', c: '3', n: 'Bojler', typ: 'OEZ', ch: 'Gg', a: '16', idn: '', isc: '', zsm: '1,5', riso: '>20', rpe: '', faze: '', vyp: '', cas: '', t5idn: '', ut: '', kabel: '' }
    ];
    D.zavady = [];
    // Uložená zpráva tak, jak ji program zapsal do archivu (bez funkce Zs mez
    // se do dat nic nepřidává, takže tohle je i podoba starých zpráv).
    nacistData(D); await new Promise(r => setTimeout(r, 300));
    saveToArchiv();
    const pred = JSON.parse(JSON.stringify(archiv[0].data));
    // Otevřít znovu (funkce vyhodnotí) a uložit
    nacistData(JSON.parse(JSON.stringify(pred))); await new Promise(r => setTimeout(r, 300));
    const barva = zsLimBunka(document.querySelectorAll('#rozvadece-container tr[data-rowtype="obvod"]')[1], 7).className;
    const titulek = zsLimBunka(document.querySelectorAll('#rozvadece-container tr[data-rowtype="obvod"]')[1], 7).title;
    saveToArchiv();
    const ulozena = JSON.parse(JSON.stringify(archiv[0].data));
    const bezCasu = o => { const c = Object.assign({}, o); delete c.timestamp; return c; };
    const A = bezCasu(pred), B = bezCasu(ulozena);
    const rozdil = Object.keys(Object.assign({}, A, B)).filter(k => JSON.stringify(A[k]) !== JSON.stringify(B[k]));
    return { rozdil, barva, titulek, shodne: JSON.stringify(A) === JSON.stringify(B), zavad: (ulozena.zavady || []).length,
             mereni: JSON.stringify(pred.rozvadece[0].mereni) === JSON.stringify(ulozena.rozvadece[0].mereni),
             zs: /zsLim|zs_lim|zsMez|Zs,lim/i.test(JSON.stringify(ulozena)) };
  });
  check('stará zpráva se po načtení vyhodnotí (červený obvod)', /zs-lim-chyba/.test(stara.barva), stara.barva);
  check('stará zpráva: měření v datech beze změny', stara.mereni);
  check('stará zpráva: vada C1 se nepřidala', stara.zavad === 0);
  check('stará zpráva: JSON před a po uložení je shodný', stara.shodne && stara.rozdil.length === 0, stara.rozdil.join(', '));
  check('stará zpráva: nic z výpočtu se do dat nedostalo', !stara.zs);

  check('bez chyb stránky', err.length === 0, err.join(' | '));
  console.log(res.join('\n'));
  await b.close();
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.error('CRASH:', e.message); process.exit(2); });
