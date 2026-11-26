// Zásuvková skříň (2026-11-25, blok „ZÁSUVKOVÁ SKŘÍŇ"). Hlídá: dlaždice ve dvou řádcích
// (DBO · PSC · zásuvkové skříně / riziko LPS · vnější vlivy), typ ZS-0001 bez 3D, zásuvky
// a vidlice v knihovně jen u zásuvkové skříně, vložení zásuvky na čelo (ne do řady), tažení
// myší s mřížkou 5 mm a Ctrl+Z, šipky a Delete, kolize, vazba zásuvka ↔ jistič, svorkovnice
// od výroby (validace, CSV, nezabírá moduly, splní PE), odvozené InA z vidlice a upozornění
// při ručních 40 A, upozornění 30 mA bez poučení (zmizí po poučení), schéma (soustava vývodu,
// lomítka, zásuvky, vidlice, Icn, chránič zalomený), list 1 (jeden výkresový pohled s kótami,
// svorkovnicemi a zásuvkami, jen jednoduché prvky), štítek, Předání a poučení (PDF, data bez
// výchozích textů), uložení a otevření, a že DBO nic z toho nedostane.
// Vše vymyšlené (testy/zasuvkova-skrin.js).
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } });
  await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: require('path').join(__dirname, 'knihovny', r.request().url().split('/').pop()),
    contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  const p = await ctx.newPage();
  const chyby = []; p.on('pageerror', e => chyby.push(e.message));
  await p.goto(URL); await w(1500);
  await p.evaluate(() => { STORE.technik = Object.assign({}, STORE.technik, { jmeno: 'Petr Vymyšlený', firma: 'Vymyšlená elektro s.r.o.', ico: '12345678', mesto: 'Kyjov', osvedceni: '1234/22/EZ-R-E2/A' }); saveStore(); });

  // ── 1. dlaždice a typ ──
  const dl = await p.evaluate(() => { showScreen('dokumentace'); dokDlazdiceVykreslit(); return [...document.querySelectorAll('#dok-dlazdice [data-typ]')].map(e => e.dataset.typ); });
  check('dlaždice: DBO · PSC · zásuvkové skříně / riziko LPS · vnější vlivy', dl.slice(0, 5).join(',') === 'rozv,psc,zs,rlps,pouvv', dl.join(','));
  const sl = await p.evaluate(() => getComputedStyle(document.getElementById('dok-dlazdice')).gridTemplateColumns.split(' ').length);
  check('dlaždice ve třech sloupcích (dva řádky)', sl === 3, sl);
  await p.evaluate('window.__zs = ' + require('./zasuvkova-skrin.js').toString());
  await p.evaluate(async () => { await window.__zs(); });
  await w(500);
  const t1 = await p.evaluate(() => ({ cislo: window.__dokOtevreny.data.cislo || window.__dokOtevreny.cislo, typ: window.__dokOtevreny.typ, rezim: window.__dokOtevreny.data.rezim,
    zal: [...document.querySelectorAll('.rz-zal')].map(b => b.dataset.z).join(','), titul: document.getElementById('dok-form-titul').textContent }));
  check('typ zs, číslo ZS-0001, režim ZS', t1.typ === 'zs' && /^ZS-0001/.test(t1.cislo) && t1.rezim === 'ZS', JSON.stringify(t1));
  check('záložky Návrh, Schéma, Dokumenty — bez 3D', t1.zal === 'navrh,sch,dok', t1.zal);

  // ── 2. knihovna ──
  const kn = await p.evaluate(() => ({ skup: rozvSkupinyKat().map(g => g.k), vid: rozvKnihovnaVse().filter(it => rozvKnihVidet(it, 'pristroj')).some(it => it.kat === 'XZ'),
    vest: rozvVestavene().filter(it => it.kat === 'XZ' || it.kat === 'XP').map(it => it.vyrobce + '|' + (it.overeno ? 1 : 0)) }));
  check('knihovna zásuvkové skříně má skupinu „Zásuvky a vidlice" a zásuvky', kn.skup.indexOf('zas') !== -1 && kn.vid, kn.skup.join(','));
  check('vestavěné zásuvky a vidlice jen obecné a neověřené', kn.vest.length >= 10 && kn.vest.every(v => v === 'obecný|0'), kn.vest.length);

  // ── 3. svorkovnice od výroby ──
  const sv = await p.evaluate(() => {
    const ok = rozvValidovat({ druh: 'skrin', rady: 1, modulu: 12, svorkovnice: 'N pod, PE pod 8' }), zle = rozvValidovat({ druh: 'skrin', rady: 1, modulu: 12, svorkovnice: 'X vlevo' });
    const bez = rozvValidovat({ druh: 'skrin', rady: 1, modulu: 12 }).polozka;
    const np = rzsNP(__rz.rady, __rz);
    const L = rzsKontrola().map(n => n.text);
    return { ok: ok.polozka.svorkovnice, okCh: ok.chyby.length, zle: zle.chyby.join(' '), bezKlic: 'svorkovnice' in bez, volno: rozvVolnoCelkem(__rz), peKap: np.PE.kap, pePot: np.PE.potreba,
      pe: L.some(t => /svorky PE|přípojnice PE/.test(t)), osaz: rozvMaPe({ rezim: 'ZS', skrin: __rz.skrin, rady: __rz.rady }), dbo: rozvMaPe({ rezim: 'DBO', skrin: __rz.skrin, rady: __rz.rady }), dboBez: rozvMaPe({ rezim: 'DBO', skrin: Object.assign({}, __rz.skrin, { svorkovnice: '' }), rady: __rz.rady }) };
  });
  check('svorkovnice od výroby: „N pod, PE pod 8" projde, nesmysl je chyba', sv.ok === 'N pod, PE pod 8' && sv.okCh === 0 && /svorkovnice od výroby/.test(sv.zle), JSON.stringify(sv));
  check('skříň bez svorkovnic nemá klíč (staré skříně beze změny)', sv.bezKlic === false);
  check('svorkovnice od výroby nezabírají moduly (volno 4 M z 16)', sv.volno && sv.volno.volno === 4, JSON.stringify(sv.volno));
  check('PE od výroby splní svorky PE (žádná chyba ani upozornění na PE)', sv.peKap >= sv.pePot && !sv.pe, sv.peKap + '/' + sv.pePot);
  check('kusové ověření 11.7: PE od výroby se počítá u ZS i u DBO (od 2026-11-26), skříň bez svorkovnic ne', sv.osaz === true && sv.dbo === true && sv.dboBez === false);

  // ── 4. CSV ──
  const csv = await p.evaluate(() => {
    const t = ROZV_CSV.map(c => c[0]).join(';') + '\n' + ROZV_CSV.map(c => ({ druh: 'pristroj', kategorie: 'XS2', nazev: 'Zásuvka test', vyrobce: 'Výrobce A', typ: 'VA-T1', in: '32', ue: '230', ip: 'IP44', druh_zasuvky: 'cee', poly_zasuvky: '3P' }[c[0]] || '')).join(';') +
      '\n' + ROZV_CSV.map(c => ({ druh: 'skrin', nazev: 'Skříň test', rady: '1', moduly_v_rade: '12', svorkovnice_od_vyroby: 'N pod, PE pod', rukojet: 'ano' }[c[0]] || '')).join(';');
    const r = rozvImportRozebrat(t, 'test.csv');
    return { hl: ['druh_zasuvky', 'poly_zasuvky', 'svorkovnice_od_vyroby', 'rukojet'].every(k => ROZV_CSV.some(c => c[0] === k)),
      ch: r.chyby.map(c => c.text).join(' | '), r: JSON.stringify(r.polozky.map(x => x.polozka).map(x => [x.kat || x.druh, x.polyZ || '', x.svorkovnice || '', x.rukojet || ''])) };
  });
  check('CSV má sloupce druh_zasuvky, poly_zasuvky, svorkovnice_od_vyroby, rukojet', csv.hl);
  check('import CSV: zásuvka 3P → 2P+E (bez šířky v modulech), skříň se svorkovnicemi a rukojetí', !csv.ch && /XZ","2P\+E/.test(csv.r) && /N pod, PE pod","ano/.test(csv.r), csv.r + ' ' + csv.ch);

  // ── 5. editor čela ──
  const ed = await p.evaluate(() => ({ celo: !!document.getElementById('zs-celo'), n: document.querySelectorAll('#zs-celo [data-zasuvka]').length,
    sv: document.querySelectorAll('#zs-celo [data-svorkovnice]').length, rady: __rz.rady[0].prvky.length }));
  check('editor: čelo pod čelním pohledem se 6 zásuvkami a 2 svorkovnicemi od výroby', ed.celo && ed.n === 6 && ed.sv === 2, JSON.stringify(ed));
  // vložení z knihovny jde na čelo, ne do řady
  const vl = await p.evaluate(() => {
    const pred = __rz.rady[0].prvky.length; __rz.vyber = __rz.rady[0].prvky[5].uid;   // vybraný FA5
    const z = rozvVlozit('v-xz-16-230-3p');
    return { r: __rz.rady[0].prvky.length === pred, ozn: z && z.ozn, nap: z && z.napajen === __rz.rady[0].prvky[5].uid, kol: !!zsKolize({ skrin: __rz.skrin, rady: __rz.rady, celo: __rz.celo })[z.uid], n: __rz.celo.zasuvky.length, vyb: __rz.vyberZas === z.uid };
  });
  check('Vložit zásuvku: na čelo (řada beze změny), -XZ7, napájí vybraný jistič, volné místo bez kolize', vl.r && vl.ozn === '-XZ7' && vl.nap && !vl.kol && vl.n === 7 && vl.vyb, JSON.stringify(vl));
  const pan = await p.evaluate(() => document.getElementById('rz-vlastnosti').innerText);
  check('vlastnosti vybrané zásuvky (napájí ji, póly, poloha)', /-XZ7/.test(pan) && /Napájí ji/i.test(pan) && /Poloha x/i.test(pan), pan.slice(0, 120));
  await p.keyboard.press('Control+z'); await w(200);
  check('Ctrl+Z vrátí vložení zásuvky', await p.evaluate(() => __rz.celo.zasuvky.length === 6));
  // tažení myší
  await p.evaluate(() => { __rz.vyberZas = null; rozvPohledVykreslit(); document.getElementById('zs-celo').scrollIntoView(); });
  await w(200);
  const g = await p.$('#zs-celo [data-zasuvka="z1"]'); const bb = await g.boundingBox();
  const kMm = await p.evaluate(() => { const r = document.querySelector('#zs-celo .zs-celo-svg').getBoundingClientRect(); return r.width / ZS_ED.W * zsCeloVykres.g.k; });   // px na mm skříně
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down();
  await p.mouse.move(bb.x + bb.width / 2 + 12 * kMm, bb.y + bb.height / 2 + 3, { steps: 6 }); await p.mouse.up(); await w(200);
  const ta = await p.evaluate(() => zsZasNajit('z1').pos);
  check('tažení myší: posun po mřížce 5 mm', ta.x % 5 === 0 && ta.y % 5 === 0 && ta.x > 64, JSON.stringify(ta));
  await p.keyboard.press('Control+z'); await w(200);
  check('Ctrl+Z vrátí tažení', await p.evaluate(() => zsZasNajit('z1').pos.x === 64));
  // šipky, Delete
  await p.evaluate(() => { __rz.vyberZas = 'z1'; rozvPohledVykreslit(); rozvVlastnostiVykreslit(); document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
  await p.keyboard.press('ArrowRight'); await w(150);
  check('šipka → posune vybranou zásuvku o 5 mm', await p.evaluate(() => zsZasNajit('z1').pos.x === 69));
  await p.keyboard.press('Delete'); await w(150);
  check('Delete smaže vybranou zásuvku', await p.evaluate(() => !zsZasNajit('z1') && __rz.celo.zasuvky.length === 5));
  await p.keyboard.press('Control+z'); await w(150); await p.keyboard.press('Control+z'); await w(150);
  check('Ctrl+Z vrátí smazání i posun', await p.evaluate(() => !!zsZasNajit('z1') && zsZasNajit('z1').pos.x === 64));
  // kolize
  const ko = await p.evaluate(() => { const d = { skrin: __rz.skrin, rady: __rz.rady, celo: dokKopie(__rz.celo) }; d.celo.zasuvky[1].pos = { x: 164, y: 320 }; d.celo.zasuvky[3].pos = { x: 160, y: 60 }; return Object.keys(zsKolize(d)).sort().join(','); });
  check('kolize: přes jinou zásuvku a přes okno s DIN lištou', ko === 'z1,z2,z3', ko);
  // jistič ukazuje zásuvku
  const jp = await p.evaluate(() => { __rz.vyberZas = null; __rz.vyber = __rz.rady[0].prvky[1].uid; rozvVlastnostiVykreslit(); return (document.querySelector('#rz-vlastnosti .zs-napaji') || {}).textContent || ''; });
  check('vlastnosti jističe: „→ napájí zásuvku: -XZ1 32 A 400 V 5P"', /napájí zásuvku: -XZ1 32 A 400 V 5P/.test(jp), jp);
  await p.evaluate(() => { __rz.vyber = null; rozvVlastnostiVykreslit(); });

  // ── 6. InA, 30 mA ──
  const up = await p.evaluate(() => ({ odv: rozvDokOdvozene(DOK_TYPY.zs.cist(dokForm()))['tech.ina'], L: rzsKontrola().map(n => n.u + ':' + n.text), pr: (document.getElementById('zs-upoz') || {}).textContent || '' }));
  check('InA odvozené = 32 A (menší z chrániče 40 A a vidlice 32 A)', up.odv === '32', up.odv);
  check('upozornění 30 mA nad pohledem i v „Co ještě chybí" (411.3.3)', /30 mA/.test(up.pr) && /411\.3\.3/.test(up.pr) && up.L.some(t => /30 mA/.test(t)), up.pr);
  await p.evaluate(() => rozvZalozkaNastavit('dok')); await w(400);
  await p.evaluate(() => { const e = dokForm().querySelector('[data-dk="tech.ina"]'); e.value = '40'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.evaluate(() => { rozvZalozkaNastavit('navrh'); rozvZalozkaNastavit('dok'); }); await w(400);
  const inaU = await p.evaluate(() => [...document.querySelectorAll('.rz-dok-upoz')].map(e => e.textContent).join(' '));
  check('ruční InA 40 A → upozornění „větší než vidlice 32 A"', /InA 40 A je větší než vidlice 32 A/.test(inaU), inaU);
  check('v „Co ještě chybí" je InA proti vidlici', await p.evaluate(() => rzsKontrola().some(n => /vidlice 32 A/.test(n.text))));
  await p.evaluate(() => { const e = dokForm().querySelector('[data-dk="tech.ina"]'); e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); });
  // poučení
  await p.evaluate(() => {
    const f = dokForm(), c = f.querySelector('[data-dk="dokVyber.pouceni"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true }));
    const r = f.querySelector('.zs-pou-os'); r.querySelector('.zs-pou-j').value = 'Jan Smyšlený'; r.querySelector('.zs-pou-f').value = 'mistr výroby'; r.querySelector('.zs-pou-j').dispatchEvent(new Event('input', { bubbles: true }));
    const d = f.querySelector('[data-dk="pouceni.datum"]'); d.value = '2026-11-25'; d.dispatchEvent(new Event('input', { bubbles: true }));
  });
  check('po poučení (zaškrtnuto + přebírající) upozornění 30 mA zmizí', await p.evaluate(() => !rzsKontrola().some(n => /30 mA/.test(n.text))));
  const dat = await p.evaluate(() => DOK_TYPY.zs.cist(dokForm()));
  check('data poučení: jen zadané (výchozí rozsah a pokyny se neukládají)', dat.pouceni && dat.pouceni.osoby.length === 1 && !dat.pouceni.rozsah && !dat.pouceni.pokyny && !dat.pouceni.obsah && dat.dokVyber.pouceni === true, JSON.stringify(dat.pouceni));
  check('norma výchozí ČSN EN IEC 61439-2', dat.norma === '2', dat.norma);
  await p.evaluate(() => TD_AKCE.tdZsPouceni()); await w(1500);
  const pdf = await p.evaluate(() => ({ n: document.querySelectorAll('#dok-pdf-pages .a4').length, t: document.getElementById('dok-pdf-pages').innerText }));
  check('Předání a poučení: samostatný tisk, NV 194/2022 § 4, osoby, pokyny, výjimka 411.3.3', pdf.n >= 2 && /194\/2022/.test(pdf.t) && /Jan Smyšlený/.test(pdf.t) && /rozviňte/.test(pdf.t) && /411\.3\.3/.test(pdf.t) && /pohyblivý přívod/.test(pdf.t), pdf.n);
  await p.evaluate(() => { document.querySelector('[data-action="dokPdfZpet"], #dok-pdf-zpet') ? document.querySelector('[data-action="dokPdfZpet"], #dok-pdf-zpet').click() : showScreen('dok-form'); }); await w(400);

  // ── 7. schéma a list 1 ──
  const sch = await p.evaluate(() => { const d = DOK_TYPY.zs.cist(dokForm()); return rozvSchemaListy(d).map(x => x.svg); });
  const l2 = sch[1] || '', l1 = sch[0] || '';
  check('schéma: zásuvky -XZ1…XZ6 se soustavou 3/N/PE a 1/N/PE', ['-XZ1', '-XZ6', '3/N/PE', '1/N/PE', '32 A 400 V 5P'].every(t => l2.indexOf(t) !== -1));
  check('schéma: vidlice -XP1 a pohyblivý přívod -WL1', /-XP1/.test(l2) && /-WL1/.test(l2) && /data-vidlice/.test(l2));
  check('schéma: jističe s Icn (C32/3 10 kA, C16/1 6 kA) a typem', /C32\/3 10 kA/.test(l2) && /C16\/1 6 kA/.test(l2) && /VA-C32\/3/.test(l2));
  check('schéma: chránič „40 A 4P 100 mA" a „typ A" (nic zkrácené)', /40 A 4P 100 mA/.test(l2) && />typ A</.test(l2) && !/…<\/text>/.test(l2.slice(0, 20000)));
  check('list 1: osazení zásuvkové skříně se svorkovnicemi N/PE, 6 zásuvkami, rukojetí a kótami', /Osazení zásuvkové skříně/.test(l1) && (l1.match(/data-svorkovnice=/g) || []).length === 2 &&
    (l1.match(/data-zasuvka=/g) || []).length === 6 && /rukojeť/.test(l1) && />550</.test(l1) && />328</.test(l1));
  check('list 1: provedení „přenosná na stojanu", ochrana třída II', /přenosná na stojanu/.test(l1) && /dvojitou nebo zesílenou izolací/.test(l1));
  const tagy = Array.from(new Set((l1 + l2).match(/<([a-z]+)/g).map(t => t.slice(1))));
  check('listy jen z jednoduchých prvků (vektorové PDF)', tagy.every(t => ['svg', 'g', 'line', 'rect', 'circle', 'path', 'text', 'ellipse', 'title'].indexOf(t) !== -1), tagy.join(','));

  // ── 8. štítek ──
  await p.evaluate(() => TD_AKCE.tdRStitek && TD_AKCE.tdRStitek()); await w(800);
  const st = await p.evaluate(() => { const s = document.querySelector('.rz-stitek'); return s ? { t: s.innerText, ce: !!s.querySelector('svg') } : null; });
  check('štítek: InA 32 A, vidlice, ČSN EN IEC 61439-2, CE z rozvCeSvg', st && /32 A/.test(st.t) && /vidlice/i.test(st.t) && /61439-2/.test(st.t) && st.ce, st && st.t.replace(/\n/g, ' | ').slice(0, 200));
  await p.evaluate(() => showScreen('dok-form')); await w(200);

  // ── 8b. připomínky 2026-11-26: kód XZ, tažení zásuvky na čelo, šířka okna, směr přívodu ──
  const kod = await p.evaluate(() => ({ kat: ROZV_KAT_ZS.join(','), z: __rz.celo.zasuvky.every(z => z.p.kat === 'XZ'), xs2: rozvKatZTextu('XS2'), stara: rozvPolozkaNorm({ druh: 'pristroj', kat: 'XS2', nazev: 'x', sirka: '' }).kat, nazev: (rozvKat('XS2') || {}).k }));
  check('kategorie zásuvky XZ (vidlice XP); starší kód XS2 se čte jako XZ (CSV, knihovna)', kod.kat === 'XZ,XP' && kod.z && kod.xs2 === 'XZ' && kod.stara === 'XZ' && kod.nazev === 'XZ', JSON.stringify(kod));
  await p.evaluate(() => { showScreen('dok-form'); rozvZalozkaNastavit('navrh'); __rz.vyber = null; __rz.vyberZas = null; __rzF.skup = 'zas'; rozvKnihovnaVykreslit(); rozvPohledVykreslit(); });
  await p.setViewportSize({ width: 1920, height: 1500 }); await w(400);
  const n0 = await p.evaluate(() => ({ z: __rz.celo.zasuvky.length, r: __rz.rady[0].prvky.length }));
  const pol = p.locator('#dok-form-obsah .rz-polozka[data-kid="v-xz-16-230-3p"]').first();
  const tahni = async (cil) => {
    await p.evaluate(() => window.scrollTo(0, 250)); await w(200);
    const a = await pol.boundingBox(), c = await cil();
    await p.mouse.move(a.x + 40, a.y + 15); await p.mouse.down(); await p.mouse.move(a.x + 60, a.y + 30, { steps: 3 });
    await p.mouse.move(c.x, c.y, { steps: 12 }); await w(150);
    const st = await p.evaluate(() => ({ duch: !!document.querySelector('.rz-duch.zs-duch svg [data-zasuvka], .rz-duch.zs-duch svg circle'), jistic: !!document.querySelector('.rz-duch .rz-duch-svg'),
      cil: __rzTah && __rzTah.cil, ram: document.getElementById('zs-celo').classList.contains('zs-cil') }));
    await p.mouse.up(); await w(300); return st;
  };
  const tc = await tahni(async () => { const r = await p.locator('#zs-celo .zs-celo-svg').boundingBox(); return { x: r.x + r.width * 0.75, y: r.y + r.height * 0.62 }; });
  const pc = await p.evaluate(() => ({ z: __rz.celo.zasuvky.length, r: __rz.rady[0].prvky.length, nova: __rz.celo.zasuvky[__rz.celo.zasuvky.length - 1] }));
  check('tažení zásuvky z knihovny: stín = zásuvka (ne jistič), čelo vyznačené, cíl v mm po 5 mm', tc.duch && !tc.jistic && tc.ram && tc.cil && tc.cil.x % 5 === 0 && tc.cil.y % 5 === 0, JSON.stringify(tc));
  check('puštění na čelo: nová -XZ7 na místě kurzoru, DIN řada beze změny', pc.z === n0.z + 1 && pc.r === n0.r && pc.nova.ozn === '-XZ7' && pc.nova.pos.x === tc.cil.x && pc.nova.pos.y === tc.cil.y, JSON.stringify(pc));
  const td = await tahni(async () => { const r = await p.locator('#rz-pohled .rz-svg').boundingBox(); return { x: r.x + r.width * 0.7, y: r.y + r.height * 0.5 }; });
  const pd = await p.evaluate(() => ({ z: __rz.celo.zasuvky.length, r: __rz.rady[0].prvky.length }));
  check('do DIN řady zásuvku pustit nejde (nic se nevloží)', !td.cil && pd.z === pc.z && pd.r === pc.r, JSON.stringify(pd));
  await p.keyboard.press('Control+z'); await w(300);
  const kl = await p.evaluate(() => { const e = document.querySelector('#dok-form-obsah .rz-polozka[data-kid="v-xz-16-230-3p"]'); e.click(); return { b: (document.querySelector('#rz-pohled .rz-banner') || {}).textContent || '', t: e.title }; });
  check('klepnutí na zásuvku v knihovně: pruh „klepněte na čelo skříně, kam zásuvku dát"', /klepněte na čelo skříně, kam zásuvku dát/.test(kl.b) && /na čelo/.test(kl.t), kl.b);
  const kc = await p.evaluate(() => {
    const svg = document.querySelector('#zs-celo .zs-celo-svg'), r = svg.getBoundingClientRect(), n = __rz.celo.zasuvky.length;
    svg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width * 0.3, clientY: r.top + r.height * 0.85 }));
    return { n: __rz.celo.zasuvky.length - n, vyb: __rz.knihVyber };
  });
  check('klepnutí na čelo zásuvku položí (mřížka 5 mm) a výběr z knihovny skončí', kc.n === 1 && !kc.vyb, JSON.stringify(kc));
  await p.keyboard.press('Control+z'); await w(300);
  const vd = await p.evaluate(() => { const v = dokForm().querySelector('[data-dk="vidlice.In"]'); v.value = ''; const e = document.querySelector('#dok-form-obsah .rz-polozka[data-kid="v-xp-16-230-3p"]'); e.click();
    return { vid: dokForm().querySelector('[data-dk="vidlice.In"]').value, vyb: __rz.knihVyber, tah: e.title }; });
  check('vidlice: klepnutí ji dá rovnou do přívodu (bez tažení a bez výběru)', vd.vid === '16' && !vd.vyb && /přívodu/.test(vd.tah), JSON.stringify(vd));
  await p.evaluate(() => { const v = dokForm().querySelector('[data-dk="vidlice.In"]'); v.value = '32'; v.dispatchEvent(new Event('input', { bubbles: true })); });
  // šířka okna
  for (const sir of [1920, 2560]) {
    await p.setViewportSize({ width: sir, height: 1300 }); await w(500);
    const g = await p.evaluate(() => { const r = q => document.querySelector(q).getBoundingClientRect(); const ram = r('#rz-svg-ram'), ce = r('#zs-celo'), wr = r('#dok-form-obsah');
      return { wrap: Math.round(wr.width), ram: [Math.round(ram.left), Math.round(ram.right), Math.round(ram.top)], ce: [Math.round(ce.left), Math.round(ce.top)], vedle: document.getElementById('rz-pohled').classList.contains('zs-vedle') }; });
    const ok = g.wrap >= sir - 20 && (sir === 2560 ? g.vedle && g.ce[0] > g.ram[1] && Math.abs(g.ce[1] - g.ram[2]) < 30 : !g.vedle && g.ce[1] > g.ram[2]);
    check('šířka ' + sir + ' px: editor přes celou šířku, čelo ' + (sir === 2560 ? 'vedle čelního pohledu' : 'pod čelním pohledem'), ok, JSON.stringify(g));
  }
  await p.setViewportSize({ width: 1500, height: 1100 }); await w(400);
  // směr přívodu
  const smer = async v => p.evaluate(v => { const e = dokForm().querySelector('[data-dk="privodSmer"]'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
    const t = [...document.querySelectorAll('#rz-pohled .rz-svg text')].find(x => x.textContent === 'přívod'), c = [...document.querySelectorAll('#zs-celo text')].find(x => /vývodka/.test(x.textContent));
    return { p: t ? Math.round(+t.getAttribute('y')) : null, c: c ? Math.round(+c.getAttribute('y')) : null }; }, v);
  const s1 = await smer('shora'), s2 = await smer('zespodu');
  check('přívod shora ↔ zespodu: vývodka v čelním pohledu i na čele se překreslí hned', s1.p < 10 && s1.c < 20 && s2.p > s1.p + 30 && s2.c > s1.c + 100, JSON.stringify([s1, s2]));
  await p.evaluate(() => rozvZalozkaNastavit('sch')); await w(600);
  const lst = async v => { await smer(v); await w(500); return p.evaluate(() => [...document.querySelectorAll('#rz-pan-sch svg text')].filter(x => /vývodka/.test(x.textContent)).map(x => Math.round(+x.getAttribute('y')))[0]); };
  const a1 = await lst('shora'), a2 = await lst('zespodu');
  check('přívod shora ↔ zespodu: list 1 schématu se překreslí hned', a1 < a2 - 50, a1 + ' → ' + a2);
  await p.evaluate(() => rozvZalozkaNastavit('navrh'));

  // ── 9. uložení a otevření ──
  const ul = await p.evaluate(async () => {
    await dokUlozitOtevreny(); const uid = window.__dokOtevreny.uid;
    await dokOtevritSeznam('zs'); await dokOtevrit(uid); await new Promise(r => setTimeout(r, 300));
    const d = window.__dokOtevreny.data;
    return { n: (d.celo || {}).zasuvky ? d.celo.zasuvky.length : 0, sv: d.skrin.svorkovnice, ruk: d.skrin.rukojet, vid: (d.vidlice || {}).In, celo: !!document.getElementById('zs-celo') };
  });
  check('uložení a otevření: čelo, svorkovnice, rukojeť, vidlice zůstanou', ul.n === 6 && ul.sv === 'N pod, PE pod' && ul.ruk === 'ano' && ul.vid === '32' && ul.celo, JSON.stringify(ul));

  // ── 10. DBO nic z toho nedostane ──
  const dbo = await p.evaluate(async () => {
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-1x12-n'));
    const x = rozvVlozit('v-xz-16-230-3p');
    const d = DOK_TYPY.rozv.cist(dokForm());
    return { vloz: x == null, kl: ['celo', 'vidlice', 'pouceni', 'norma', 'privodDelka'].filter(k => k in d), skup: rozvSkupinyKat().some(g => g.k === 'zas'),
      zs: rozvKnihovnaVse().filter(it => rozvKnihVidet(it, 'pristroj')).some(it => it.kat === 'XZ' || it.kat === 'XP'), celo: !!document.getElementById('zs-celo'),
      skrin: 'svorkovnice' in d.skrin || 'rukojet' in d.skrin, zal: [...document.querySelectorAll('.rz-zal')].map(b => b.dataset.z).join(',') };
  });
  check('DBO: žádné nové klíče, žádné zásuvky v knihovně, žádné čelo (3D schované i u DBO)', dbo.vloz && !dbo.kl.length && !dbo.skup && !dbo.zs && !dbo.celo && !dbo.skrin && dbo.zal === 'navrh,sch,dok', JSON.stringify(dbo));

  check('žádná chyba stránky', !chyby.length, chyby.slice(0, 3).join(' | '));
  await b.close();
  console.log(res.join('\n'));
  console.log('\n' + res.filter(r => r.startsWith('✅')).length + '/' + res.length + ' kontrol');
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})();
