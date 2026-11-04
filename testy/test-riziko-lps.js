// Tvorba dokumentace — Výpočet rizika LPS (ČSN EN IEC 62305-2 ed. 3).
// Hlídá: kontrolní příklad z normy (příloha F.2, rodinný dům) nechráněný
// i chráněný (tolerance 1 %), druhý příklad spočtený v testu vlastními
// vzorci nezávisle na programu, každou tabulku koeficientů, povinné Td,
// převzetí z revize LPS / elektro a protokolu vnějších vlivů (vymyšlený
// objekt — revize se nemění), „Navrhnout ochranu", F a FT podle typu,
// zdroje hodnot v PDF, otevření uloženého dokumentu beze změny dat, telefon.
// Všechna data vymyšlená.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));
const blizko = (a, b, tol) => Math.abs(a - b) <= Math.abs(b) * (tol || 0.01) + 1e-15;

// ── Nezávislý výpočet (vzorce ze zadání, bez kódu programu) ─────────────
function nezavisle(o) {
  const NSG = o.k * 0.1 * o.td, AD = o.L * o.W + 6 * o.H * (o.L + o.W) + Math.PI * 9 * o.H * o.H;
  const ND = NSG * AD * o.CD * 1e-6, PP = o.tz / 8760;
  const linky = o.vedeni.map(v => ({ NL: NSG * 40 * v.LL * v.CI * v.CE * v.CT * 1e-6, PEB: v.PEB }));
  const PAT = o.PLPS * o.Pam * o.rt, PB = o.PS * o.PLPS * o.rf * o.rp;
  let RU = 0, RV = 0;
  linky.forEach(l => { RU += l.NL * (o.Pam * l.PEB * o.rt) * PP * o.LT; RV += l.NL * (l.PEB * o.rf * o.rp) * (PP * o.LF1 + o.LF2); });
  const RAT = ND * PAT * PP * o.LT, RB = ND * PB * (PP * o.LF1 + o.LF2);
  return { AD, ND, RAT, RB, RU, RV, R: RAT + RB + RU + RV };
}

async function otiskRevizi(p) {
  return p.evaluate(async () => {
    const o = {}; for (const k of STORE_KEYS) o[k] = await idbGet(k);
    return JSON.stringify({ o, ls: localStorage.getItem('revize_el_store'), a: archiv });
  });
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const p = await ctx.newPage();
  const err = []; p.on('pageerror', e => err.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(URL); await w(1200);

  // ── tabulky koeficientů (každá jedním testem) ─────────────────────────
  const tab = await p.evaluate(() => {
    const v = (s) => s.map(o => o[2]);
    return {
      CD: v(RL_CD), CI: v(RL_CI), CE: v(RL_CE), PS: v(RL_PS), LPS: v(RL_LPS), PEB: v(RL_PEB), PSPD: v(RL_PSPD),
      CLD: RL_STIN.map(o => o[2]), CLI: RL_STIN.map(o => o[3]), PLD: RL_PLD, PLDUW: RL_PLD_UW, KS3: v(RL_KS3),
      rt: v(RL_RT_POV), Pam: v(RL_PAM), rf: v(RL_RF), rp: v(RL_RP), ztr: RL_ZTRATY, RT: RL_RT,
      CT: [rlVypocet({ typ: 'rd', v: { L: '10', W: '10', H: '5', td: '20' }, vedeni: [{ uid: 'a', druh: 'nn', sekce: [{ uid: 'b', vn: true }] }], zony: [] }).vedeni[0].sekce[0].CT,
           rlVypocet({ typ: 'rd', v: { L: '10', W: '10', H: '5', td: '20' }, vedeni: [{ uid: 'a', druh: 'nn', sekce: [{ uid: 'b' }] }], zony: [] }).vedeni[0].sekce[0].CT],
      pld: [rlPLD('nest', 'r1', 2.5), rlPLD('st_sp', 'r5', 2.5), rlPLD('st_sp', 'r1', 1.5), rlPLD('st_sp', 'r20', 12), rlPLD('st_sp', 'r1', 3)],
      ks: (() => { const r = rlVypocet({ typ: 'rd', v: { L: '10', W: '10', H: '5', td: '20', wm1: '5', wm2: '20' }, vedeni: [], zony: [] }); return [r.KS1, r.KS2]; })(),
      rM: [350 / 1.5, 2000 / Math.pow(2.5, 1.8)]
    };
  });
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  check('tab. A.1 CD', eq(tab.CD, [0.25, 0.5, 1, 2]));
  check('tab. A.2 CI', eq(tab.CI, [1, 0.3, 0.01]));
  check('tab. A.3 CT (VN s trafem / NN)', eq(tab.CT, [0.2, 1]));
  check('tab. A.4 CE', eq(tab.CE, [1, 0.5, 0.1, 0.01]));
  check('tab. B.1 Pam', eq(tab.Pam, [0.1, 0.01, 0.01, 0.001, 0]));
  check('tab. B.2 rt', eq(tab.rt, [1e-2, 1e-3, 1e-4, 1e-5]));
  check('tab. B.3 PLPS', eq(tab.LPS, [1, 0.2, 0.1, 0.05, 0.02, 0.01, 0.001]));
  check('tab. B.4 PS', eq(tab.PS, [1, 0.5]));
  check('tab. B.5 rp', eq(tab.rp, [1, 0.5, 0.2]));
  check('tab. B.6 rf', eq(tab.rf, [1, 0.1, 1e-3, 0.1, 1e-2, 1e-3, 0]));
  check('tab. B.7 PSPD', eq(tab.PSPD, [1, 0.05, 0.02, 0.01, 1e-4, 5e-5, 1e-5]));
  check('tab. B.9 CLD / CLI', eq(tab.CLD, [1, 1, 1, 1, 1, 0, 0, 0]) && eq(tab.CLI, [1, 0.2, 0.3, 0.1, 0, 0, 0, 0]));
  check('tab. B.10 KS3', eq(tab.KS3, [1, 0.5, 0.2, 0.01, 1e-4]));
  check('tab. B.11 PLD (tabulka)', eq(tab.PLDUW, [0.35, 0.5, 1, 1.5, 2.5, 4, 6, 12]) &&
    eq(tab.PLD.r20, [1, 1, 1, 1, 0.95, 0.9, 0.8, 0.4]) && eq(tab.PLD.r5, [1, 1, 0.9, 0.8, 0.6, 0.3, 0.1, 0.02]) && eq(tab.PLD.r1, [1, 0.85, 0.6, 0.4, 0.2, 0.04, 0.02, 0.005]));
  check('tab. B.11 PLD (výběr: nestíněné 1, Uw mezi sloupci → nižší sloupec)', eq(tab.pld, [1, 0.6, 0.4, 0.4, 0.2]), JSON.stringify(tab.pld));
  check('tab. B.13 PEB', eq(tab.PEB, [1, 0.05, 0.02, 0.01]));
  check('tab. C.2 ztráty (nejvyšší z rozsahu)', eq(tab.ztr, { velmi: { LF: 0.2, LO: 0.01 }, vysoka: { LF: 0.1, LO: 1e-3 }, normalni: { LF: 0.05, LO: 5e-4 }, nizka: { LF: 0.02, LO: 1e-4 } }));
  check('rov. B.7 KS1 = 0,12·wm, nejvýš 1', blizko(tab.ks[0], 0.6) && tab.ks[1] === 1, JSON.stringify(tab.ks));
  check('RT = 10⁻⁵', tab.RT === 1e-5);

  // ── dlaždice a nový výpočet, povinné Td ───────────────────────────────
  await p.evaluate(async () => { STORE.technik = { jmeno: 'Jan Vymyšlený', mesto: 'Kyjov' }; saveStore(); try { localStorage.removeItem(RL_LS_TD); } catch (e) {} dokOtevritTypy(); });
  await w(200);
  check('dlaždice „Výpočet rizika LPS" v Tvorbě dokumentace', await p.locator('.dok-dlazdice[data-typ="rlps"]').count() === 1);
  await p.click('.dok-dlazdice[data-typ="rlps"]'); await w(200);
  await p.click('[data-action="tdNovy"]'); await w(300);
  check('nový výpočet začíná výběrem typu objektu (14 dlaždic)', await p.locator('.rl-typ').count() === 14);
  const otisk0 = await otiskRevizi(p);
  await p.click('.rl-typ[data-typ="rd"]'); await w(200);
  check('bez Td výpočet stojí s hláškou', (await p.textContent('#rl-vys')).includes('Doplňte počet bouřkových dnů Td'));
  for (const [k, v] of [['L', '15'], ['W', '20'], ['H', '6']]) await p.fill('[data-rl="' + k + '"]', v);
  await w(150);
  const bezTd = await p.evaluate(() => { const r = rlVypocet(__rl.d); return { ch: r.chyby.map(c => c.k), R: r.R, panel: document.querySelector('#rl-vys').innerText }; });
  check('vyplněné rozměry, bez Td: výsledek se nespočítá (žádné R)', bezTd.ch.join() === 'td' && bezTd.R === undefined && !bezTd.panel.includes('R ='), bezTd.ch.join());
  check('pole Td je zvýrazněné jako povinné', await p.locator('.rl-pole.rl-chybi[data-pole="td"]').count() === 1);
  await p.fill('[data-rl="td"]', '40'); await w(150);
  check('Td se pamatuje pro příští výpočet', await p.evaluate(() => localStorage.getItem(RL_LS_TD)) === '40');

  // ── příklad F.2 (rodinný dům) ─────────────────────────────────────────
  await p.evaluate(() => {
    const d = __rl.d, nn = d.vedeni[0], z = d.zony[0];
    TD_AKCE.tdRlVedeniPridat({ getAttribute: () => 'tel' });
    const tel = d.vedeni[1];
    Object.assign(d.v, { cd: '1', ps: 'zdivo', lps: '0' });
    d.v['s.' + nn.sekce[0].uid + '.ll'] = '1000'; d.v['v.' + nn.uid + '.uw'] = '2.5';
    d.v['s.' + tel.sekce[0].uid + '.ll'] = '800'; d.v['v.' + tel.uid + '.uw'] = '1.5';
    Object.assign(d.v, { ['z.' + z.uid + '.rt']: 'asfalt', ['z.' + z.uid + '.rf']: 'pniz', ['z.' + z.uid + '.rp']: 'zadne', ['z.' + z.uid + '.tz']: '4380', ['z.' + z.uid + '.te']: '8760' });
    rlKreslit(); dokZmena();
  });
  await w(200);
  const f2 = await p.evaluate(() => {
    const r = rlVypocet(__rl.d), Z = r.zony[0];
    return { AD: r.AD, AM: r.AM, rM: r.rM, ND: r.ND, NM: r.NM, ALP: r.vedeni[0].sekce[0].AL, AIP: r.vedeni[0].sekce[0].AI, ALT: r.vedeni[1].sekce[0].AL, AIT: r.vedeni[1].sekce[0].AI,
      NLP: r.vedeni[0].NL, NIP: r.vedeni[0].NI, NLT: r.vedeni[1].NL, NIT: r.vedeni[1].NI, sk: Z.sk, R: r.R, vyh: r.vyhovuje,
      verdikt: document.querySelector('.rl-v-titul').textContent, nej: (document.querySelector('.rl-g-radek.nej b') || {}).textContent };
  });
  const F2 = [['AD', 2.58e3], ['AM', 1.87e5], ['rM', 233], ['ND', 2.06e-2], ['NM', 0.75], ['ALP', 4.00e4], ['AIP', 7.69e5], ['ALT', 3.20e4], ['AIT', 1.54e6],
    ['NLP', 0.32], ['NIP', 3.07], ['NLT', 0.256], ['NIT', 6.17]];
  F2.forEach(([k, v]) => check('F.2: ' + k + ' = ' + v, blizko(f2[k], v), String(f2[k])));
  check('F.2 nechráněný: RAT ≈ 0', f2.sk.RA < 0.001e-5, String(f2.sk.RA));
  check('F.2 nechráněný: RB = 0,062·10⁻⁵', blizko(f2.sk.RB, 0.062e-5), String(f2.sk.RB));
  check('F.2 nechráněný: RU = 0,003·10⁻⁵', blizko(f2.sk.RU, 0.003e-5, 0.05), String(f2.sk.RU));
  check('F.2 nechráněný: RV = 1,728·10⁻⁵', blizko(f2.sk.RV, 1.728e-5), String(f2.sk.RV));
  check('F.2 nechráněný: R = 1,793·10⁻⁵ > RT', blizko(f2.R, 1.793e-5) && !f2.vyh, String(f2.R));
  check('F.2: výsledek „Ochrana je potřeba"', /Ochrana je potřeba/.test(f2.verdikt), f2.verdikt);
  check('F.2: graf zvýrazní RV jako hlavní složku', f2.nej === 'RV', f2.nej);

  // ── Navrhnout ochranu ─────────────────────────────────────────────────
  await p.click('[data-action="tdRlNavrh"]'); await w(250);
  const nav = await p.$$eval('#modal-rl-navrh .rl-var-t', e => e.map(x => x.textContent));
  check('Navrhnout ochranu: nejlevnější = SPD LPL IV na obou vedeních', /^1\. SPD na vstupu na všech vedeních \(LPL III–IV\)$/.test(nav[0] || ''), nav.join(' | '));
  check('návrh nabízí nejvýš 3 nedominované varianty', nav.length >= 1 && nav.length <= 3 && !nav.slice(1).some(t => /SPD na vstupu na všech vedeních \(LPL (II|I)\)$/.test(t)), nav.join(' | '));
  await p.click('#modal-rl-navrh [data-action="tdRlNavrhPouzit"][data-i="0"]'); await w(250);
  const chr = await p.evaluate(() => { const r = rlVypocet(__rl.d), Z = r.zony[0]; return { sk: Z.sk, R: r.R, vyh: r.vyhovuje, t: document.querySelector('.rl-v-titul').textContent }; });
  check('F.2 chráněný (PEB 0,05): RB = 0,062·10⁻⁵', blizko(chr.sk.RB, 0.062e-5), String(chr.sk.RB));
  check('F.2 chráněný: RU ≈ 0', chr.sk.RU < 0.001e-5, String(chr.sk.RU));
  check('F.2 chráněný: RV = 0,086·10⁻⁵', blizko(chr.sk.RV, 0.0864e-5), String(chr.sk.RV));
  check('F.2 chráněný: R = 0,149·10⁻⁵ ≤ RT, vyhovuje', blizko(chr.R, 0.149e-5) && chr.vyh && /vyhovuje/.test(chr.t), String(chr.R));
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('Control+z'); await w(250);
  check('Ctrl+Z vrátí stav před návrhem', await p.evaluate(() => Math.abs(rlVypocet(__rl.d).R - 1.793e-5) < 0.02e-5));
  await p.evaluate(() => { __rl.d.vedeni.forEach(v => { __rl.d.v['v.' + v.uid + '.peb'] = 'IV'; }); rlKreslit(); dokZmena(); });

  // ── druhý příklad: spočteno nezávisle v testu ─────────────────────────
  const druhyApp = await p.evaluate(() => {
    const d = JSON.parse(JSON.stringify(__rl.d)), z = d.zony[0];
    d.v.kat = 'normalni'; d.v['z.' + z.uid + '.rp'] = 'rucni'; d.v['z.' + z.uid + '.tz'] = '2000';
    d.vedeni.forEach(v => { d.v['v.' + v.uid + '.peb'] = '0'; });
    const r = rlVypocet(d), Z = r.zony[0];
    return { AD: r.AD, ND: r.ND, RAT: Z.sk.RA, RB: Z.sk.RB, RU: Z.sk.RU, RV: Z.sk.RV, R: r.R, LO: [r.LO1, r.LO2] };
  });
  const ind = nezavisle({ k: 2, td: 40, L: 15, W: 20, H: 6, CD: 1, tz: 2000, PLPS: 1, PS: 1, Pam: 1, rt: 1e-5, rf: 1e-3, rp: 0.5, LT: 1e-2, LF1: 5e-2, LF2: 5e-2,
    vedeni: [{ LL: 1000, CI: 1, CE: 1, CT: 1, PEB: 1 }, { LL: 800, CI: 1, CE: 1, CT: 1, PEB: 1 }] });
  ['AD', 'ND', 'RAT', 'RB', 'RU', 'RV', 'R'].forEach(k => check('2. příklad (normální kategorie, rp 0,5, tz 2000 h): ' + k, blizko(druhyApp[k], ind[k], 1e-6), druhyApp[k] + ' / ' + ind[k]));
  check('2. příklad: LO u normální kategorie bez zaškrtnutí = 0', druhyApp.LO[0] === 0 && druhyApp.LO[1] === 0);

  // ── F a FT podle typu objektu ─────────────────────────────────────────
  const ft = await p.evaluate(() => ['rd', 'muzeum', 'nemocnice', 'prumysl', 'vybus', 'datac'].map(t => { const d = { typ: t, v: {}, prevz: {} }; return t + ':' + rlHod(d, 'hodnotitF').v + '/' + rlHod(d, 'ft').v; }));
  check('F hodnotit: nemocnice, průmysl, výbušné, datové centrum ano; RD a muzeum ne; FT 0,1 u kritických', ft.join(',') === 'rd:/1,muzeum:/1,nemocnice:1/0.1,prumysl:1/0.1,vybus:1/1,datac:1/0.1', ft.join(','));
  const fRoz = await p.evaluate(() => { const d = JSON.parse(JSON.stringify(__rl.d)); const a = rlVypocet(d); d.v.hodnotitF = '1'; const b = rlVypocet(d); return [a.F, a.vyhovuje, b.vyhovuje]; });
  check('F se zobrazí vždy, o ochraně rozhoduje jen se zaškrtnutím', fRoz[0] > 1 && fRoz[1] === true && fRoz[2] === false, JSON.stringify(fRoz));

  // ── převzetí z revize LPS, revize elektro a protokolu vnějších vlivů ──
  await p.evaluate(async () => {
    archiv.push({ uid: 'rl-test-lps', typ: 'lps', ev_cislo: 'RE-26-9901', misto: 'Vymyšlený dům, Polní 99, Kyjov', datum: '2026-05-01',
      data: { typ: 'lps', ev_cislo: 'RE-26-9901', misto: 'Vymyšlený dům, Polní 99, Kyjov', ukonceni: '2026-05-01',
        lps: { trida: 'III', spd: 'SPD T1 v hlavním rozvaděči', zemina: 'písčitá', material_strechy: 'pálená krytina', typ_objektu: 'pro bytové účely', lpz: 'LPZ 0A, LPZ 1' } } });
    archiv.push({ uid: 'rl-test-el', typ: 'elektro', ev_cislo: 'RE-26-9902', misto: 'Vymyšlený dům, Polní 99, Kyjov', datum: '2026-05-02',
      data: { typ: 'elektro', ev_cislo: 'RE-26-9902', misto: 'Vymyšlený dům, Polní 99, Kyjov', ukonceni: '2026-05-02',
        rozvadece: [{ nazev: 'RD', privod: 'AYKY 4×16 ze skříně SS100', mereni: [{ rowtype: 'obvod', c: '1', n: 'SPD T1+T2', typ: '' }] }] } });
    archiv.push({ uid: 'rl-test-jiny', typ: 'lps', ev_cislo: 'RE-26-9903', misto: 'Úplně jiná hala, Brno', datum: '2026-06-01', data: { typ: 'lps', misto: 'Úplně jiná hala, Brno', lps: { trida: 'I' } } });
    await saveStore();
    await dokNacist();
    DOK.dokumenty.push({ uid: 'rl-test-vv', typ: 'pouvv', cislo: 'POUVV-0901', data: { cislo: 'POUVV-0901', stavba: 'Vymyšlený dům, Polní 99, Kyjov', skupiny: [{ uid: 'g', kody: { BE: 'BE2', BD: 'BD3' }, prostory: [] }] } });
    await dokZapsat();
    __rl.d.misto = 'Vymyšlený dům, Polní 99, Kyjov'; __rl.d.vedeni.forEach(v => { delete __rl.d.v['v.' + v.uid + '.peb']; }); rlKreslit();
  });
  const otiskA = await otiskRevizi(p);
  await p.click('.rl-prevzit-radek [data-action="tdRlPrevzit"]'); await w(250);
  const pred = await p.evaluate(() => ['lps', 'elektro', 'pouvv'].map(k => (document.querySelector('#modal-rl-prevzit input[name="rlp-' + k + '"]:checked') || {}).value));
  check('převzetí: předvybraná revize LPS, elektro a protokol téhož objektu', pred.join() === 'rl-test-lps,rl-test-el,rl-test-vv', pred.join());
  await p.click('[data-action="tdRlPrevzitPotvrdit"]'); await w(300);
  const pv = await p.evaluate(() => {
    const d = __rl.d, nn = d.vedeni.find(v => v.druh === 'nn'), z = d.zony[0];
    return { lps: rlHod(d, 'lps'), peb: rlHod(d, 'v.' + nn.uid + '.peb'), uloz: rlHod(d, 's.' + nn.sekce[0].uid + '.uloz'), kat: rlHod(d, 'kat'), rf: rlHod(d, 'z.' + z.uid + '.rf'),
      chipy: document.querySelectorAll('.rl-z-prevz:not(.ok)').length, potvrdVse: !!document.querySelector('[data-action="tdRlPotvrditVse"]'),
      por: (document.querySelector('.rl-porovnani') || {}).textContent || '', zem: document.body.innerText.includes('zeminu „písčitá"') };
  });
  check('z revize LPS: třída LPS III (PLPS), označeno a nepotvrzeno', pv.lps.v === 'III' && pv.lps.z === 'prevz' && /revize LPS RE-26-9901/.test(pv.lps.zdroj) && !pv.lps.ok, JSON.stringify(pv.lps));
  check('z revize LPS: SPD na vstupu podle třídy (odhad)', pv.peb.v === 'IV' && /odhad/.test(pv.peb.zdroj), JSON.stringify(pv.peb));
  check('z revize elektro: přípojka AYKY → podzemní', pv.uloz.v === 'pod' && /revize elektro RE-26-9902/.test(pv.uloz.zdroj), JSON.stringify(pv.uloz));
  check('z protokolu: BE2 → riziko požáru vysoké, BD3 → kategorie vysoká', pv.rf.v === 'pvys' && pv.kat.v === 'vysoka' && /POUVV-0901/.test(pv.kat.zdroj), pv.rf.v + ' ' + pv.kat.v);
  check('převzaté hodnoty mají štítek „✓ Potvrdit" a tlačítko Potvrdit vše', pv.chipy >= 4 && pv.potvrdVse, String(pv.chipy));
  check('zemina z revize jen jako připomínka u ρ', pv.zem);
  check('porovnání s revizí LPS: „Revize RE-26-9901 uvádí LPS III – …"', /Revize RE-26-9901 uvádí LPS III – /.test(pv.por), pv.por);
  await p.click('[data-action="tdRlPotvrditVse"]'); await w(200);
  check('Potvrdit vše: žádná nepotvrzená hodnota', await p.locator('.rl-z-prevz:not(.ok)').count() === 0);
  check('převzetí revize ani protokol nezměnilo (data revizí bajtově stejná)', await otiskRevizi(p) === otiskA);
  check('dokument je uložený jen v tvorbě dokumentace', await p.evaluate(async () => { await dokUlozitOtevreny(); return !archiv.some(z => z.typ === 'rlps') && DOK.dokumenty.some(x => x.typ === 'rlps'); }));

  // ── PDF se zdroji hodnot ──────────────────────────────────────────────
  await p.click('[data-action="tdNahled"]'); await w(1200);
  const pdf = await p.evaluate(() => ({ n: document.querySelectorAll('#dok-pdf-pages .a4[data-vektor]').length, t: Array.from(document.querySelectorAll('#dok-pdf-pages svg')).map(s => s.textContent).join(' '),
    ram: document.querySelectorAll('#dok-pdf-pages [data-ram]').length, raz: document.querySelectorAll('#dok-pdf-pages [data-razitko]').length,
    sir: Array.from(document.querySelectorAll('#dok-pdf-pages .a4')).every(a => a.classList.contains('a4-landscape')) }));
  check('PDF: vektorové listy na šířku s rámem a razítkem', pdf.n >= 2 && pdf.ram === pdf.n && pdf.raz === pdf.n && pdf.sir, pdf.n + ' listů');
  ['Zdroj hodnoty', 'zadáno', 'z typu objektu', 'převzato: revize LPS RE-26-9901', 'tab. A.1', 'rov. A.5', 'Složky rizika', 'Porovnání s revizí RE-26-9901',
   'Výpočet podle ČSN EN IEC 62305-2 ed. 3; hodnoty ztrát a koeficientů zvolil zpracovatel.'].forEach(s => check('PDF obsahuje „' + s + '"', pdf.t.includes(s)));
  await p.click('[data-action="tdPdfZpet"]'); await w(300);

  // ── otevření uloženého dokumentu nemění data ──────────────────────────
  const ulozeny = await p.evaluate(async () => { await dokUlozitOtevreny(); const uid = window.__dokOtevreny.uid; await dokNacist(); return { uid, j: JSON.stringify(dokNajit(uid)) }; });
  await p.evaluate(() => dokOtevritSeznam('rlps')); await w(200);
  await p.evaluate(uid => dokOtevrit(uid), ulozeny.uid); await w(1500);
  await p.evaluate(() => dokOtevritSeznam('rlps')); await w(1200);
  const po = await p.evaluate(async uid => { await dokNacist(); return JSON.stringify(dokNajit(uid)); }, ulozeny.uid);
  check('otevření a zavření uloženého výpočtu data nezmění', po === ulozeny.j);
  check('seznam ukazuje výsledek výpočtu', /vyhovuje|ochrana potřeba/.test(await p.textContent('#dok-seznam')));
  const stary = await p.evaluate(async () => {   // dokument uložený bez nepovinných klíčů (starší podoba)
    await dokNacist();
    DOK.dokumenty.push({ uid: 'rl-stary', typ: 'rlps', cislo: 'RLPS-0900', data: { cislo: 'RLPS-0900', typ: 'kanc', v: { L: '30', W: '12', H: '9', td: '25' }, vedeni: [], zony: [{ uid: 'z1', druh: 'vnitrni' }] } });
    await dokZapsat(); const pred = JSON.stringify(dokNajit('rl-stary'));
    await dokOtevrit('rl-stary'); await new Promise(r => setTimeout(r, 1300)); await dokNacist();
    return { stejne: pred === JSON.stringify(dokNajit('rl-stary')), r: rlVypocet(__rl.d).R };
  });
  check('starší dokument bez nepovinných klíčů se otevře, spočítá a nezmění', stary.stejne && stary.r > 0, JSON.stringify(stary));

  // ── data revizí po celé práci ─────────────────────────────────────────
  await p.evaluate(async () => { archiv.splice(0, archiv.length, ...archiv.filter(z => !/^rl-test/.test(z.uid))); await saveStore(); });
  check('data revizí po práci s výpočty bajtově stejná jako na začátku', await otiskRevizi(p) === otisk0);

  // ── příloha k revizní zprávě LPS (porovnání s verzí bez přílohy na STARA_PORT) ──
  const STARA = 'http://127.0.0.1:' + (process.env.STARA_PORT || 8902) + '/index.html';
  const zprava = async (pg, vybrat) => pg.evaluate(async (vybrat) => {
    const D = { typ: 'lps', podtyp: 'lps', ev_cislo: 'RE-26-9950', misto: 'Vymyšlený dům, Polní 99, Kyjov', adresa: 'Polní 99, Kyjov',
      zahajeni: '2026-05-01', ukonceni: '2026-05-01', vypracovani: '2026-05-01', provozovatel: 'Jan Vymyšlený', prilohy: 'Protokol o měření zemničů',
      lps: { trida: 'III', typ_objektu: 'pro bytové účely', prohlidka_norma: '62305' } };
    aktTyp = 'lps'; aktPodtyp = 'lps'; novaZprava('lps'); nacistData(D);
    const cekej = () => new Promise(r => { window.__pdfHotovoCb = r; generujPDF(); setTimeout(r, 6000); });
    await cekej(); await new Promise(r => setTimeout(r, 300));
    if (vybrat) {
      const sel = document.getElementById('tisk-rlps');
      if (!sel) return { chybi: true };
      sel.value = vybrat; sel.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => { window.__pdfHotovoCb = r; setTimeout(r, 6000); }); await new Promise(r => setTimeout(r, 300));
    }
    const data = getData(); delete data.uid; delete data.timestamp;   // čas uložení se liší vždy
    const pages = document.getElementById('pdf-pages');
    return { html: Array.from(pages.querySelectorAll('.a4:not(.rl-priloha)')).map(a => a.outerHTML).join(''), n: pages.querySelectorAll('.a4').length,
      pril: pages.querySelectorAll('.a4.rl-priloha[data-vektor]').length, text: pages.innerText, data: JSON.stringify(data), tisk: JSON.stringify(data.tisk),
      volba: !!document.getElementById('tisk-rlps') };
  }, vybrat);
  const st = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await st.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const sp = await st.newPage(); await sp.goto(STARA); await sp.waitForTimeout(1200);
  await sp.evaluate(() => { STORE.technik = { jmeno: 'Jan Vymyšlený', mesto: 'Kyjov' }; saveStore(); });
  await p.evaluate(() => { STORE.technik = { jmeno: 'Jan Vymyšlený', mesto: 'Kyjov' }; saveStore(); });
  const stara = await zprava(sp, '');
  await p.evaluate(() => showScreen('home')); await w(200);
  const uidRl = await p.evaluate(async () => { await dokNacist(); return DOK.dokumenty.find(x => x.typ === 'rlps' && x.data && x.data.nazev !== undefined).uid; });
  const rozdil = (x, y) => { let i = 0; while (i < x.length && x[i] === y[i]) i++; return i >= x.length && x.length === y.length ? '' : '…' + x.slice(Math.max(0, i - 60), i + 60) + ' ≠ ' + y.slice(Math.max(0, i - 60), i + 60); };
  const bez = await zprava(p, '');
  check('příloha: v panelu tisku revize LPS je volba „Přiložit výpočet rizika"', bez.volba);
  check('příloha: bez zaškrtnutí je PDF revize znak po znaku stejné jako ve verzi bez přílohy', bez.html === stara.html && bez.n === stara.n, bez.n + ' / ' + stara.n + ' ' + rozdil(bez.html, stara.html));
  check('příloha: bez zaškrtnutí jsou data zprávy stejná jako ve verzi bez přílohy', bez.data === stara.data, rozdil(bez.data, stara.data));
  const s = await zprava(p, uidRl);
  check('příloha: se zaškrtnutím se listy výpočtu připojí na konec PDF (vektorově)', s.pril >= 2 && s.n === bez.n + s.pril, s.n + ' = ' + bez.n + ' + ' + s.pril);
  check('příloha: v seznamu příloh v PDF přibude řádek', /Výpočet rizika úderu blesku RLPS-\d+/.test(s.text) && /Protokol o měření zemničů/.test(s.text));
  check('příloha: pole Seznam příloh ve zprávě se nezměnilo, volba je jen v nastavení tisku', JSON.parse(s.data).prilohy === 'Protokol o měření zemničů' && JSON.parse(s.tisk).rlpsPriloha === uidRl, s.tisk);
  const zpet = await p.evaluate(async () => {
    const sel = document.getElementById('tisk-rlps'); sel.value = ''; sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => { window.__pdfHotovoCb = r; setTimeout(r, 6000); }); await new Promise(r => setTimeout(r, 300));
    tiskUlozitVychozi(); return { tisk: JSON.stringify(getData().tisk), vych: JSON.stringify(STORE.tisk), pril: document.querySelectorAll('#pdf-pages .rl-priloha').length };
  });
  check('příloha: odebrání volby vrátí PDF i nastavení zprávy, do výchozích se příloha nedostane', zpet.pril === 0 && !/rlpsPriloha/.test(zpet.tisk + zpet.vych), JSON.stringify(zpet));
  await st.close();

  // ── telefon 375 px ────────────────────────────────────────────────────
  const m = await b.newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true });
  await m.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const t = await m.newPage(); await t.goto(URL); await w(1200);
  await t.evaluate(async () => { await dokNovy('rlps'); TD_AKCE.tdRlTyp({ getAttribute: () => 'rd' }); Object.assign(__rl.d.v, { L: '15', W: '20', H: '6', td: '40' }); rlKreslit(); });
  await w(300);
  const mob = await t.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    vysNahore: document.querySelector('#rl-vys').getBoundingClientRect().top < document.querySelector('.rl-form').getBoundingClientRect().top,
    btn: document.querySelector('.rl-hlavni').getBoundingClientRect().width }));
  check('telefon: žádný vodorovný posun stránky', mob.sw <= mob.cw, mob.sw + ' / ' + mob.cw);
  check('telefon: výsledek nad formulářem, hlavní akce přes celou šířku', mob.vysNahore && mob.btn > 300, JSON.stringify(mob));
  await t.screenshot({ path: __dirname + '/_beh/rlps/telefon.png' });

  check('bez chyb na stránce', !err.length, err.join(' | '));
  await b.close();
  console.log(res.join('\n'));
  const spatne = res.filter(r => r.startsWith('❌')).length;
  console.log('\n' + (res.length - spatne) + ' / ' + res.length + ' v pořádku');
  process.exit(spatne ? 1 : 0);
})().catch(e => { console.error('SELHALO', e); process.exit(1); });
