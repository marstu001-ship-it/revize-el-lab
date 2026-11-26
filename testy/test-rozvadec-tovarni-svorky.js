// Připomínky 2026-11-26 k DBO a PSC: svorkovnice N / PE od výroby i u DBO (splní kontrolu svorek
// i 11.7, „Co ještě chybí" nevyžaduje PE na liště, kreslí se v čelním pohledu i na listu osazení,
// ve svorkovém plánu „od výroby"), 3D schované u DBO i PSC (uložené pohled3d a dokVyber.pohled3d
// zůstanou bajtově, 3D strana nejde do PDF), přívod shora / zespodu se překreslí hned.
// Skříň bez svorkovnic od výroby se nemění — znak po znaku hlídá test-rozvadec-psc.js.
// Vše vymyšlené (testy/rozvadec-byt.js).
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1100 } });
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const p = await ctx.newPage(); const chyby = []; p.on('pageerror', e => chyby.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(URL); await w(1500);
  await p.evaluate('window.__rozvByt = ' + require('./rozvadec-byt.js').toString());
  const zaloz = sv => p.evaluate(async (sv) => {
    const dk = (s, v) => { const e = dokForm().querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    STORE.technik = Object.assign({}, STORE.technik, { jmeno: 'Petr Vymyšlený', mesto: 'Kyjov' });
    await dokNovy('rozv'); dk('[data-dk="oznaceni"]', 'RH1'); dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S'); dk('[data-dk="privodKabel"]', 'CYKY-J'); dk('[data-dk="privodPrurez"]', '5×10');
    const sk = dokKopie(rozvKnihPolozka('v-sk-3x12-n')); if (sv) sk.svorkovnice = sv;
    rozvSkrinNastavit(sk); window.__rozvByt(); await new Promise(r => setTimeout(r, 300));
  }, sv);

  // ── 1. svorkovnice N a PE od výroby pod lištou ──
  await zaloz('N pod, PE pod');
  const a = await p.evaluate(() => {
    const d = DOK_TYPY.rozv.cist(dokForm()), np = rzsNP(d.rady, d), L = rzsKontrola().map(n => n.text).join(' | ');
    const svg = document.querySelector('#rz-pohled .rz-svg').outerHTML, tisk = rozvSvg(__rz, { tisk: true, k: 0.5 }), osaz = rozvSvg(d, { osazeni: true });
    const pl = rzsNPRadky(d.rady, d).map(r => r.svorka).join(',');
    return { pe: np.PE.kap + '/' + np.PE.potreba, n: np.N.map(g => g.nazev + ' ' + g.kap + '/' + g.potreba).join(','), maPe: rozvMaPe(d), L,
      obr: /od výroby/.test(svg) && />N<\/text>/.test(svg) && />PE<\/text>/.test(svg), tisk: /od výroby/.test(tisk), osaz: /od výroby/.test(osaz) && !/class=/.test(rozvTovSvorkySvg(d, true)), pl,
      volno: rozvVolnoCelkem(__rz).volno };
  });
  check('DBO: PE od výroby splní svorky PE (17/17) a 11.7, „Co ještě chybí" PE na liště nevyžaduje', a.pe === '17/17' && a.maPe && !/svorky PE|přípojnice PE/.test(a.L), a.pe + ' | ' + a.L);
  check('DBO: N od výroby pokryje společné N; skupiny za chrániči (N-FI1, N-FI2) jedna svorkovnice nepokryje a dál se hlásí', /^N 2\/2,N-FI1 0\/9,N-FI2 0\/5$/.test(a.n) && /N-FI1/.test(a.L), a.n);
  check('DBO: svorkovnice nezabírají moduly (volno beze změny)', a.volno === 0, a.volno);
  check('DBO: kreslí se v čelním pohledu (obrazovka i tisk) a na listu osazení (jen jednoduché prvky)', a.obr && a.tisk && a.osaz, JSON.stringify(a).slice(0, 120));
  check('svorkový plán: svorky PE „od výroby"', /PE \(od výroby\) · 1/.test(a.pl) && /N \(od výroby\)/.test(a.pl), a.pl.slice(0, 200));
  await p.evaluate(() => rozvZalozkaNastavit('sch')); await w(800);
  const l1 = await p.evaluate(() => { const t = [...document.querySelectorAll('#rz-pan-sch svg text')].map(x => x.textContent).join(' '); return { od: /od výroby/.test(t), pop: /svorkovnice od výroby: N pod lištou, PE pod lištou/.test(t) }; });
  check('list osazení: svorkovnice nakreslené a v popisu skříně „svorkovnice od výroby: N pod lištou, PE pod lištou"', l1.od && l1.pop, JSON.stringify(l1));
  await p.evaluate(() => rozvZalozkaNastavit('navrh')); await w(300);

  // ── 2. nad lištou a na boku ──
  await zaloz('N nad, PE bok');
  const nb = await p.evaluate(() => {
    const t = [...document.querySelectorAll('#rz-pohled .rz-svg text')];
    const n = t.find(x => x.textContent === 'N'), pe = t.find(x => x.textContent === 'PE'), r1 = rozvRadaY(0), W = rozvSvgRozmery(__rz).W, din = RZG.okraj + 12 * RZG.M;
    return { nNad: n && +n.getAttribute('y') < r1, peBok: pe && +pe.getAttribute('x') > din && +pe.getAttribute('x') < W };
  });
  check('nad lištou se kreslí nad první řadou, na boku v pravém okraji skříně', nb.nNad && nb.peBok, JSON.stringify(nb));

  // ── 3. skříň bez svorkovnic od výroby: nic navíc ──
  await zaloz('');
  const bez = await p.evaluate(() => { const d = DOK_TYPY.rozv.cist(dokForm()); return { s: rozvTovSvorkySvg(__rz, false), k: 'svorkovnice' in d.skrin, pe: rozvMaPe(d) }; });
  check('skříň bez svorkovnic od výroby: nic se nekreslí, žádný klíč, PE se dál vyžaduje', bez.s === '' && !bez.k && bez.pe === false, JSON.stringify(bez));

  // ── 4. 3D schované, uložená data zůstanou ──
  const d3 = await p.evaluate(async () => {
    const o = window.__dokOtevreny; o.data = DOK_TYPY.rozv.cist(dokForm());
    o.data.pohled3d = { dvere: 'zavrene' }; o.data.dokVyber = Object.assign({}, o.data.dokVyber, { pohled3d: true });
    const zaz = DOK.dokumenty.find(x => x.uid === o.uid) || null;
    if (zaz) zaz.data = dokKopie(o.data); else DOK.dokumenty.push({ uid: o.uid, typ: 'rozv', cislo: o.cislo || 'ROZ-0901', data: dokKopie(o.data) });
    await dokZapsat();
    const uid = o.uid;
    // první průchod Dokumenty uloží výrobní číslo (to platí i bez 3D) — porovnává se až druhé otevření a uložení
    await dokOtevrit(uid); await new Promise(r => setTimeout(r, 300)); rozvZalozkaNastavit('dok'); await new Promise(r => setTimeout(r, 300)); rozvZalozkaNastavit('navrh'); dokZmena(); await dokUlozitOtevreny();
    await dokOtevrit(uid); await new Promise(r => setTimeout(r, 300));
    const pred = JSON.stringify(dokNajit(uid).data);
    const zal = [...document.querySelectorAll('.rz-zal')].map(x => x.dataset.z).join(',');
    rozvZalozkaNastavit('dok'); await new Promise(r => setTimeout(r, 400));
    const zatrh = !!dokForm().querySelector('[data-dk="dokVyber.pohled3d"]');
    const pdf = DOK_TYPY.rozv.pdf(DOK_TYPY.rozv.cist(dokForm())).map(q => q.html || q.cela || '').join(' ');
    rozvZalozkaNastavit('navrh'); dokZmena(); await dokUlozitOtevreny();
    return { pred, po: JSON.stringify(dokNajit(uid).data), zal, zatrh, pdf3d: /Pohled 3D/.test(pdf) };
  });
  check('DBO: bez záložky 🧊 3D a bez zaškrtávátka „pohled 3D" v Dokumentech', d3.zal === 'navrh,sch,dok' && !d3.zatrh, d3.zal);
  check('DBO: uložené pohled3d a dokVyber.pohled3d zůstanou (otevřený a uložený rozvaděč bajtově stejně)', d3.pred === d3.po && /"pohled3d":\{"dvere":"zavrene"\}/.test(d3.po) && /"dokVyber":\{[^}]*"pohled3d":true/.test(d3.po), d3.pred.length + ' / ' + d3.po.length);
  check('DBO: 3D strana nejde do PDF ani s uloženým zaškrtnutím', !d3.pdf3d);
  const psc = await p.evaluate(async () => { await dokNovy('psc'); await new Promise(r => setTimeout(r, 300)); const z = [...document.querySelectorAll('.rz-zal')].map(x => x.dataset.z).join(',');
    rozvZalozkaNastavit('dok'); await new Promise(r => setTimeout(r, 300)); const t = !!dokForm().querySelector('[data-dk="dokVyber.pohled3d"]'); rozvZalozkaNastavit('navrh'); return { z, t }; });
  check('PSC: bez záložky 🧊 3D a bez zaškrtávátka', psc.z === 'navrh,sch,dok' && !psc.t, JSON.stringify(psc));

  // ── 5. přívod shora / zespodu se překreslí hned ──
  await zaloz('');
  const smer = v => p.evaluate(v => { const e = dokForm().querySelector('[data-dk="privodSmer"]'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
    const t = [...document.querySelectorAll('#rz-pohled .rz-svg text')].find(x => x.textContent === 'přívod'); return t ? Math.round(+t.getAttribute('y')) : null; }, v);
  const s1 = await smer('zespodu'), s2 = await smer('shora');
  check('DBO: přívod zespodu ↔ shora — vývodka v čelním pohledu se přesune hned', s1 > 100 && s2 < 10, s1 + ' → ' + s2);

  check('žádná chyba stránky', !chyby.length, chyby.slice(0, 3).join(' | '));
  await b.close();
  console.log(res.join('\n'));
  console.log('\n' + res.filter(r => r.startsWith('✅')).length + '/' + res.length + ' kontrol');
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})();
