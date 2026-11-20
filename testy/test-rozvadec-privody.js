// Rozvaděč — víc přívodů (2026-11-13, blok „ROZVADĚČ — VÍC PŘÍVODŮ").
// Hlídá: karta „＋ Další přívod" v hlavičce (pole, ▲ ▼, 🗑 Odebrat), uložení do
// `d.privody` (klíč jen s druhým přívodem), souhrn v liště „Přívod 1: N · Přívod 2: M"
// s klikem na výběr přístrojů, propojené přívody = chyba v „Co ještě chybí" (zmizí
// po odpojení vodiče), odebrání přívodu s napojenými přístroji se ptá a jde ZPĚT /
// Ctrl+Z, odebráním posledního přívodu navíc klíč `privody` zmizí, a že se starý
// jednopřívodový rozvaděč (byt 3+1) nezmění — žádný `privody` v datech, ukazatel
// v liště schovaný.
// PZ (přepínač zdrojů, 2026-11-19, dořešení výkresu — odpověď uživatele na
// otázku A/B/C): case 1 (oba vstupy přímo z přívodů, bez vypínače mezi — PZ
// je kořen obou, žádné dva úseky, jedna sběrnice) a case 2 (PZ za hlavními
// vypínači — dva úseky, žádná čára přes hranici, jen odkaz „ze sběrnice …
// (/list.sloupec)" u PZ a protiodkaz „na -Q… vstup II (/list.sloupec)" na
// sběrnici druhého přívodu), nová značka se dvěma vstupy vedle sebe (svorky
// 1/3) a výstupem dole (2), kolize popisků v okolí PZ (getBBox), vektorové
// PDF obsahuje „Přívod 2" (viz `testy/_beh/case2.pdf`, ověřeno ručně
// `pdftotext`). Kreslí `rsUseky`/`rsPrivodMostSvg` (případ 1) a
// `rsHlavaHtml`/`rsPzVstupIIHtml`/`rsPz2Predpocet` (případ 2) v index.html.
// Vymyšlený byt 3+1 z testy/rozvadec-byt.js.
// Schéma bere topologii ZE STEJNÉHO VÝPOČTU jako panel „Kdo koho napájí"
// (2026-11-20, oprava podle hlášení uživatele): přístroj zapojený JEN
// nataženým vodičem — bez vyplněného „Napájen z" — se dřív ve schématu
// kreslil podle statického stromu (jen `x.nadr`), takže vyšel pod ŠPATNÝM
// přívodem. `testy/rozvadec-roz0001.json` je přesně ten soubor, na kterém
// se chyba nahlásila: QH1 je na kabel přívodu 2 zapojen jen vodičem, FA1→
// FA2→FA3 jsou na jeho výstup napojené taky jen vodičem (paralelně).
const { chromium } = require('./pw');
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const BEH = path.join(__dirname, '_beh'); try { fs.mkdirSync(BEH, { recursive: true }); } catch (e) {}
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: require('path').join(__dirname, 'knihovny', r.request().url().split('/').pop()),
    contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const err = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => err.push(e.message));
  p.on('dialog', d => d.accept());
  await p.goto(URL); await w(1200);
  const otisk = () => p.evaluate(async () => {
    const o = {}; for (const k of STORE_KEYS) if (k !== 'technik' && k !== 'pristroje') o[k] = await idbGet(k);
    return JSON.stringify({ o, arch: JSON.stringify(archiv) });
  });

  await p.evaluate('window.__rozvByt = ' + require('./rozvadec-byt.js').toString());
  await p.evaluate(async () => {
    window.__T = {
      priv: (i, pole, v) => { const e = document.querySelector('[data-priv-i="' + i + '"] [data-priv="' + pole + '"]');
        if (e.type === 'checkbox') e.checked = v; else e.value = v;
        e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); },
      dk: (s, v) => { const e = dokForm().querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
    };
    await dokNovy('rozv');
    __T.dk('[data-dk="oznaceni"]', 'RH1'); __T.dk('[data-dk="stavba"]', 'Byt 3+1, Vymyšlená 12');
    __T.dk('[data-dk="investor.nazev"]', 'Jan Smyšlený'); __T.dk('[data-dk="misto"]', 'Předsíň');
    __T.dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S'); __T.dk('[data-dk="privodIn"]', '40');
    __T.dk('[data-dk="krytiZavreno"]', 'IP40'); __T.dk('[data-dk="krytiOtevreno"]', 'IP20'); __T.dk('[data-dk="icc"]', '6');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
    window.__rozvByt();
    await dokUlozitOtevreny();
  });

  // ── 1. starý jednopřívodový rozvaděč — beze změny ─────────────────────
  const stary1 = await p.evaluate(() => {
    const d = window.__dokOtevreny.data;
    return { privody: 'privody' in d, ukaz: (document.getElementById('rz-privod-ukaz') || {}).hidden, karty: document.querySelectorAll('#rz-privody .rz-priv-karta').length };
  });
  check('byt bez druhého přívodu: žádné `privody` v datech, lišta schovaná, žádná karta navíc',
    !stary1.privody && stary1.ukaz === true && stary1.karty === 0, JSON.stringify(stary1));
  const otiskPred = await otisk();

  // ── 2. „＋ Další přívod" — karta, pole, uložení ────────────────────────
  await p.evaluate(() => TD_AKCE.tdRPrivodPridat());
  const p2 = await p.evaluate(() => ({ karty: document.querySelectorAll('#rz-privody .rz-priv-karta').length,
    titul: (document.querySelector('[data-priv-i="0"] .dk-blok-t') || {}).textContent.trim() }));
  check('＋ Další přívod přidá kartu „Přívod 2"', p2.karty === 1 && /^Přívod 2/.test(p2.titul), JSON.stringify(p2));
  await p.evaluate(() => {
    __T.priv(0, 'ozn', 'Přívod 2 – HDO');
    __T.priv(0, 'kabel', 'CYKY-J'); __T.priv(0, 'prurez', '5×6'); __T.priv(0, 'in', '25');
    __T.priv(0, 'zdrojText', 'druhý elektroměr (HDO)');
  });
  await p.evaluate(async () => { await dokUlozitOtevreny(); });
  const d3 = await p.evaluate(() => window.__dokOtevreny.data.privody);
  check('uloží se `d.privody` se zadanými poli a vlastním uid, N sdílené výchozí true',
    Array.isArray(d3) && d3.length === 1 && d3[0].kabel === 'CYKY-J' && d3[0].prurez === '5×6' && d3[0].in === '25' &&
    d3[0].zdrojText === 'druhý elektroměr (HDO)' && d3[0].nSpolecne !== false && !!d3[0].uid, JSON.stringify(d3));

  // ── 3. pořadí (▲ ▼) se dvěma extra přívody ────────────────────────────
  await p.evaluate(() => TD_AKCE.tdRPrivodPridat());
  await p.evaluate(() => { __T.priv(1, 'ozn', 'Přívod 3 – záloha'); });
  await p.evaluate(() => TD_AKCE.tdRPrivodPosun(document.querySelector('[data-priv-i="1"] [data-action="tdRPrivodPosun"][data-smer="-1"]')));
  const poradi = await p.evaluate(() => __rz.privody.map(x => x.ozn));
  check('▲ u druhého extra přívodu prohodí pořadí', poradi.join('|') === 'Přívod 3 – záloha|Přívod 2 – HDO', poradi.join('|'));
  // vrátit zpátky a smazat třetí přívod, ať se dál testuje jen s jedním extra přívodem
  await p.evaluate(() => TD_AKCE.tdRPrivodPosun(document.querySelector('[data-priv-i="0"] [data-action="tdRPrivodPosun"][data-smer="1"]')));
  await p.evaluate(() => TD_AKCE.tdRPrivodOdebrat(document.querySelector('[data-priv-i="1"] [data-action="tdRPrivodOdebrat"]')));
  const po3 = await p.evaluate(() => __rz.privody.map(x => x.ozn));
  check('zpátky jen „Přívod 2 – HDO"', po3.join('|') === 'Přívod 2 – HDO', po3.join('|'));

  // ── 4. souhrn v liště, klik vybere přístroje napájené z přívodu ───────
  const u1 = await p.evaluate(() => (document.getElementById('rz-privod-ukaz') || {}).innerHTML);
  check('lišta s dvěma přívody: „Přívod 1: … · Přívod 2 – HDO: 0 přístrojů" (nic na něj zatím nenapájí)',
    /Přívod 1:\s*\d+\s*přístroj/.test(u1) && /Přívod 2 – HDO:\s*0\s*přístroj/.test(u1), u1);
  const uidExtra = await p.evaluate(() => '@privod~' + __rz.privody[0].uid);
  const feed = await p.evaluate((uidExtra) => {
    const x = __rz.rady[0].prvky.find(q => q.p.kat === 'FA' && q.vyvod === 'Sporák');   // jistič „Sporák" z fixtury
    x.nadr = uidExtra; x.nadrRucne = true;
    rozvPohledVykreslit();
    return x.uid;
  }, uidExtra);
  const u2 = await p.evaluate(() => (document.getElementById('rz-privod-ukaz') || {}).innerHTML);
  check('po ručním napájení jističe z přívodu 2 se počet v liště zvedne na 1', /Přívod 2 – HDO:\s*1\s*přístroj/.test(u2), u2);
  const vyber = await p.evaluate(() => {
    document.querySelector('.rz-priv-uk-btn:nth-of-type(2)').click();
    return __rz.vyber;
  });
  check('klik na „Přívod 2 – HDO" v liště vybere napájený jistič v pohledu', vyber === feed, vyber + ' / ' + feed);

  // ── 5. propojené přívody = chyba v „Co ještě chybí" ───────────────────
  await p.evaluate((uidExtra) => {
    const w2 = rzpVodic({ uid: '@privod', strana: 'o', pol: 0 }, { uid: uidExtra, strana: 'o', pol: 0 });
    w2.uid = rzpVodicUid(); __rz.vodice.push(w2);
  }, uidExtra);
  const ch1 = await p.evaluate(() => rzsKontrola().filter(x => x.u === 'chyba' && /napájen z víc přívodů|propojené/.test(x.text)));
  check('kabel propojující oba přívody → chyba „…přívody jsou propojené"', ch1.length > 0, JSON.stringify(ch1));
  await p.evaluate(() => { __rz.vodice.pop(); });
  const ch2 = await p.evaluate(() => rzsKontrola().filter(x => x.u === 'chyba' && /propojené/.test(x.text)));
  check('odpojení vodiče mezi přívody chybu zase zhasne', ch2.length === 0, JSON.stringify(ch2));

  // ── 6. odebrání přívodu s napojeným přístrojem — dotaz, ZPĚT, Ctrl+Z ──
  await p.evaluate(() => TD_AKCE.tdRPrivodOdebrat(document.querySelector('[data-priv-i="0"] [data-action="tdRPrivodOdebrat"]')));
  const r1 = await p.evaluate((uid) => ({ n: __rz.privody.length, nadr: __rz.rady[0].prvky.find(q => q.uid === uid).nadr }), feed);
  check('odebrání přívodu (po potvrzení) ho smaže a napojený jistič se vrátí na automatické napájení',
    r1.n === 0 && r1.nadr === '', JSON.stringify(r1));
  await p.evaluate(() => zpetPosledni());
  const r2 = await p.evaluate((uid) => ({ n: __rz.privody.length, oz: __rz.privody[0] && __rz.privody[0].ozn, nadr: __rz.rady[0].prvky.find(q => q.uid === uid).nadr }), feed);
  check('ZPĚT (zpetPosledni) vrátí přívod i ruční napájení jističe', r2.n === 1 && r2.oz === 'Přívod 2 – HDO' && r2.nadr === uidExtra, JSON.stringify(r2));

  // ── 7. odebráním posledního přívodu zmizí klíč `privody` ──────────────
  await p.evaluate(() => TD_AKCE.tdRPrivodOdebrat(document.querySelector('[data-priv-i="0"] [data-action="tdRPrivodOdebrat"]')));
  await p.evaluate(async () => { await dokUlozitOtevreny(); });
  const d7 = await p.evaluate(() => ({ priv: 'privody' in window.__dokOtevreny.data, karty: document.querySelectorAll('#rz-privody .rz-priv-karta').length,
    ukaz: (document.getElementById('rz-privod-ukaz') || {}).hidden }));
  check('po odebrání posledního extra přívodu `privody` v datech není, karta zmizela, lišta schovaná',
    !d7.priv && d7.karty === 0 && d7.ukaz === true, JSON.stringify(d7));

  // ── 9. přepínač zdrojů (PZ) — kategorie, dva vstupy, kontrola (2026-11-18) ──
  // Nový rozvaděč, přesně případ uživatele: Q1 63 A z přívodu 1 (→ FI1 a jističe,
  // FI/FA1, FI/FA2), QH1 40 A z přívodu 2 (→ FA1, FA2 paralelně).
  await p.evaluate(async () => {
    await dokNovy('rozv');
    __T.dk('[data-dk="oznaceni"]', 'RS2'); __T.dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
    const pr = (kat, o) => Object.assign({ uid: rozvUid(), knih: null, p: Object.assign({ kat, vyrobce: 'obecný', poly: '3', In: '40', sirka: 4 }, o || {}), ozn: '', vyvod: '', faze: '' }, {});
    const Q1 = pr('QM', { In: '63' }); Q1.ozn = '-Q1'; Q1.nadr = '@privod';
    const FI1 = pr('FI', { In: '40', idn: '0.03', poly: '4' }); FI1.ozn = '-FI1';
    const FA1b = pr('FA', { In: '16', poly: '1', char: 'B' }); FA1b.ozn = '-FA1b'; FA1b.nadr = FI1.uid;
    const QH1 = pr('QM', { In: '40' }); QH1.ozn = '-QH1'; QH1.hlavni = true; QH1.nadr = '@privod~pv1';
    const FA1 = pr('FA', { In: '16', poly: '1', char: 'B' }); FA1.ozn = '-FA1'; FA1.nadr = QH1.uid;
    const FA2 = pr('FA', { In: '16', poly: '1', char: 'B' }); FA2.ozn = '-FA2'; FA2.nadr = QH1.uid;
    __rz.rady = [{ prvky: [Q1, FI1, FA1b] }, { prvky: [QH1, FA1, FA2] }];
    __rz.privody = [{ uid: 'pv1', ozn: 'Přívod 2', kabel: 'CYKY-J', prurez: '4Bx10', in: '40' }];
    await dokUlozitOtevreny();
  });
  const koreny2 = await p.evaluate(() => {
    const d = window.__dokOtevreny.data;
    return { k1: rozvKorenPrivodu(d.rady, '@privod'), k2: rozvKorenPrivodu(d.rady, '@privod~pv1'), qm: rsModel(d).qm && rsModel(d).qm.ozn,
             jedn: rsModel(d).jedn.map(u => u.sloupce.map(x => x.ozn).join('>')) };
  });
  check('Q1 a QH1 jsou každý kořen svého přívodu (žádný se nekreslí jako dítě toho druhého)',
    koreny2.k1 && koreny2.k2 && koreny2.k1 !== koreny2.k2 && koreny2.qm === '-Q1' && !koreny2.jedn.some(j => /^-Q1>|>-Q1(>|$)/.test(j)),
    JSON.stringify(koreny2));
  check('žádný přístroj přívodu 2 (-QH1, -FA1, -FA2) neleží ve stromu pod -Q1',
    !koreny2.jedn.some(j => j.startsWith('-Q1>')), JSON.stringify(koreny2.jedn));

  // ── 9b. PZ jako přístroj — validace, panel se dvěma vstupy ────────────
  const pzVal = await p.evaluate(() => rozvValidovat({ druh: 'pristroj', kat: 'PZ', poly: '3', In: '63', sirka: '4', ovladani: 'rucni' }));
  check('kategorie PZ se validuje (ovládání, In, póly)', pzVal.chyby.length === 0 && pzVal.polozka.kat === 'PZ' && pzVal.polozka.ovladani === 'rucni', JSON.stringify(pzVal));

  await p.evaluate(async () => {
    await dokNovy('rozv');
    __T.dk('[data-dk="oznaceni"]', 'RS3'); __T.dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
    const pr = (kat, o) => Object.assign({ uid: rozvUid(), knih: null, p: Object.assign({ kat, vyrobce: 'obecný', poly: '3', In: '40', sirka: 4 }, o || {}), ozn: '', vyvod: '', faze: '' }, {});
    const Q1 = pr('QM', { In: '63' }); Q1.ozn = '-Q1'; Q1.nadr = '@privod';
    const PZ = pr('PZ', { In: '63', ovladani: 'rucni' }); PZ.ozn = '-Q2'; PZ.nadr = '@privod'; PZ.nadr2 = '@privod~pv1';
    const FA1 = pr('FA', { In: '16', poly: '1', char: 'B' }); FA1.ozn = '-FA1'; FA1.nadr = PZ.uid;
    const FA2 = pr('FA', { In: '16', poly: '1', char: 'B' }); FA2.ozn = '-FA2'; FA2.nadr = PZ.uid;
    __rz.rady = [{ prvky: [Q1, PZ, FA1, FA2] }];
    __rz.privody = [{ uid: 'pv1', ozn: 'Přívod 2', kabel: 'CYKY-J', prurez: '4Bx10', in: '40' }];
    __rz.vyber = PZ.uid; __rz.vic = null;
    window.__T0_PZ2 = { PZ: PZ.uid, FA1: FA1.uid, FA2: FA2.uid };
    window.__T0_PZ2_FA1 = FA1.uid;
    await dokUlozitOtevreny();
    rozvVlastnostiVykreslit();
  });
  const panel = await p.evaluate(() => ({
    labely: Array.from(document.querySelectorAll('.rp-napajen label')).map(l => l.textContent),
    nadr2val: (document.querySelector('[data-rp2="nadr2"]') || {}).value
  }));
  check('panel PZ: „Napájen z (vstup I)" a „(vstup II)" se dvěma vybranými hodnotami',
    panel.labely.some(t => /vstup I\)/.test(t)) && panel.labely.some(t => /vstup II\)/.test(t)) && panel.nadr2val === '@privod~pv1', JSON.stringify(panel));

  const kont9 = await p.evaluate(() => rzsKontrola());
  check('PZ s oběma vstupy: žádná chyba „propojené přívody" (to je účel PZ)',
    !kont9.some(k => k.u === 'chyba' && /propojen/.test(k.text)), JSON.stringify(kont9.filter(k => k.u === 'chyba')));
  check('kontrola hlásí upozornění (ne chybu) „oba vstupy jsou napájené" u -Q2',
    kont9.some(k => k.u === 'upoz' && /-Q2.*oba vstupy jsou napájené/.test(k.text)), JSON.stringify(kont9.filter(k => k.u === 'upoz')));

  // jinudy propojené (bez PZ) — FA1 dostane DVA manuální vodiče přímo z obou přívodů,
  // mimo PZ úplně (manuální vodič do přístroje potlačí jeho automatický — proto nejde
  // použít nadr/PZ zároveň, ale přesně TOHLE je ten „propojeno jinudy" případ)
  await p.evaluate(() => {
    const w1 = rzpVodic({ uid: '@privod', strana: 'o', pol: 0 }, { uid: window.__T0_PZ2_FA1, strana: 't', pol: 0 });
    w1.uid = rzpVodicUid(); __rz.vodice.push(w1);
    const w2 = rzpVodic({ uid: '@privod~pv1', strana: 'o', pol: 0 }, { uid: window.__T0_PZ2_FA1, strana: 't', pol: 0 });
    w2.uid = rzpVodicUid(); __rz.vodice.push(w2);
  });
  const kont10 = await p.evaluate(() => rzsKontrola());
  check('propojení JINUDY (ne přes PZ) zůstává chyba', kont10.some(k => k.u === 'chyba' && /propojen/.test(k.text)), JSON.stringify(kont10.filter(k => k.u === 'chyba')));

  // ── 9c. PZ případ 1 — oba vstupy PŘÍMO z přívodů, bez vypínače mezi
  // (odpověď uživatele 2026-11-19): žádné dva úseky, dva kabely sbíhají
  // do PZ, z jeho výstupu JEDNA sběrnice. ────────────────────────────────
  await p.evaluate(async () => {
    await dokNovy('rozv');
    __T.dk('[data-dk="oznaceni"]', 'RS4'); __T.dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
    const pr = (kat, o) => Object.assign({ uid: rozvUid(), knih: null, p: Object.assign({ kat, vyrobce: 'obecný', poly: '3', In: '40', sirka: 4 }, o || {}), ozn: '', vyvod: '', faze: '' }, {});
    const PZ = pr('PZ', { In: '63', ovladani: 'rucni' }); PZ.ozn = '-Q1'; PZ.nadr = '@privod'; PZ.nadr2 = '@privod~pv1';
    const FA1 = pr('FA', { In: '16', poly: '1', char: 'B' }); FA1.ozn = '-FA1'; FA1.nadr = PZ.uid; FA1.vyvod = 'Obvod A'; FA1.kabel = 'CYKY-J'; FA1.prurez = '3×1,5'; FA1.faze = 'L1';
    const FA2 = pr('FA', { In: '16', poly: '1', char: 'B' }); FA2.ozn = '-FA2'; FA2.nadr = PZ.uid; FA2.vyvod = 'Obvod B'; FA2.kabel = 'CYKY-J'; FA2.prurez = '3×1,5'; FA2.faze = 'L2';
    __rz.rady = [{ prvky: [PZ, FA1, FA2] }];
    __rz.privody = [{ uid: 'pv1', ozn: 'Přívod 2', kabel: 'CYKY-J', prurez: '4Bx10', in: '40', nSpolecne: true }];
    window.__T0_PZ1 = PZ.uid;
    await dokUlozitOtevreny();
  });
  const pz1 = await p.evaluate(() => {
    const d = window.__dokOtevreny.data;
    const koreny = { k1: rozvKorenPrivodu(d.rady, '@privod'), k2: rozvKorenPrivodu(d.rady, '@privod~pv1') };
    const listy = rozvSchemaListy(d), list1 = listy[1].svg;
    return { koreny, pz: koreny.k1 === window.__T0_PZ1, svg: list1,
      sberniceN: (list1.match(/L1, L2, L3/g) || []).length, deliciCara: /1\.4 1/.test(list1) };
  });
  check('případ 1: PZ je kořen OBOU přívodů zároveň (rozvKorenPrivodu)', pz1.koreny.k1 === pz1.koreny.k2 && pz1.pz, JSON.stringify(pz1.koreny));
  check('případ 1: dva kabely (Přívod 1, Přívod 2) do PZ, svorky 1 a 3, výstup 2', /Přívod 1/.test(pz1.svg) && /Přívod 2/.test(pz1.svg) && />1<\/text>/.test(pz1.svg) && />3<\/text>/.test(pz1.svg) && />2<\/text>/.test(pz1.svg));
  check('případ 1: JEDNA fázová sběrnice (ne dvě), žádná čárkovaná hranice úseků', pz1.sberniceN === 1 && !pz1.deliciCara, JSON.stringify(pz1));
  check('případ 1: FA1 i FA2 (oba přívody) visí ze stejného výstupu PZ — žádný z nich není v jiném úseku', /-FA1/.test(pz1.svg) && /-FA2/.test(pz1.svg));

  // ── 9d. PZ případ 2 — za hlavními vypínači (odpověď uživatele 2026-11-19):
  // dva úseky, žádná čára přes hranici, jen odkaz + protiodkaz „/list.sloupec". ──
  await p.evaluate(async () => {
    await dokNovy('rozv');
    __T.dk('[data-dk="oznaceni"]', 'RS5'); __T.dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
    const pr = (kat, o) => Object.assign({ uid: rozvUid(), knih: null, p: Object.assign({ kat, vyrobce: 'obecný', poly: '3', In: '40', sirka: 4 }, o || {}), ozn: '', vyvod: '', faze: '' }, {});
    const Q1 = pr('QM', { In: '63' }); Q1.ozn = '-Q1'; Q1.nadr = '@privod';
    const PZ = pr('PZ', { In: '32', ovladani: 'ats' }); PZ.ozn = '-Q2'; PZ.nadr = Q1.uid; PZ.nadr2 = '@privod~pv1';
    const FA1 = pr('FA', { In: '16', poly: '1', char: 'B' }); FA1.ozn = '-FA1'; FA1.nadr = PZ.uid; FA1.vyvod = 'Obvod A'; FA1.kabel = 'CYKY-J'; FA1.prurez = '3×1,5'; FA1.faze = 'L1';
    const FA2 = pr('FA', { In: '16', poly: '1', char: 'B' }); FA2.ozn = '-FA2'; FA2.nadr = PZ.uid; FA2.vyvod = 'Obvod B'; FA2.kabel = 'CYKY-J'; FA2.prurez = '3×1,5'; FA2.faze = 'L2';
    __rz.rady = [{ prvky: [Q1, PZ, FA1, FA2] }];
    __rz.privody = [{ uid: 'pv1', ozn: 'Přívod 2', kabel: 'CYKY-J', prurez: '4Bx10', in: '40', nSpolecne: true }];
    window.__T0_PZ2b = PZ.uid;
    await dokUlozitOtevreny();
  });
  const pz2 = await p.evaluate(() => {
    const d = window.__dokOtevreny.data;
    const koreny = { k1: rozvKorenPrivodu(d.rady, '@privod'), k2: rozvKorenPrivodu(d.rady, '@privod~pv1') };
    const listy = rozvSchemaListy(d), list1 = listy[1].svg;
    const odkaz = (list1.match(/ze sběrnice Přívod 2 \(\/\d\.\d+\)/) || [])[0];
    const protiodkaz = (list1.match(/na -Q2 vstup II \(\/\d\.\d+\)/) || [])[0];
    return { koreny, svg: list1, odkaz, protiodkaz, pzUid: window.__T0_PZ2b,
      deliciCara: /1\.4 1/.test(list1), sberniceN: (list1.match(/L1, L2, L3/g) || []).length };
  });
  check('případ 2: Q1 (ne PZ) je kořen přívodu 1 — PZ je BĚŽNÝ přístroj v jeho úseku',
    pz2.koreny.k1 && pz2.koreny.k1 !== pz2.pzUid && !pz2.koreny.k2, JSON.stringify(pz2.koreny));
  check('případ 2: dva úseky (dvě sběrnice), čárkovaná hranice mezi nimi', pz2.sberniceN === 2 && pz2.deliciCara, JSON.stringify(pz2));
  check('případ 2: u PZ odkaz „ze sběrnice Přívod 2 (/list.sloupec)"', !!pz2.odkaz, pz2.svg.length + ' znaků, odkaz=' + pz2.odkaz);
  check('případ 2: na sběrnici přívodu 2 protiodkaz „na -Q2 vstup II (/list.sloupec)"', !!pz2.protiodkaz, pz2.protiodkaz);
  check('případ 2: odkaz i protiodkaz míří na STEJNÝ list (čísla listu se shodují)',
    pz2.odkaz && pz2.protiodkaz && pz2.odkaz.match(/\/(\d)\./)[1] === pz2.protiodkaz.match(/\/(\d)\./)[1]);

  // vektorové PDF (svg2pdf) obsahuje „Přívod 2" — ověřuje pdftotext, ne jen SVG
  await p.evaluate(async () => { rozvZalozkaNastavit('sch'); rozvSchKreslit(); await TD_AKCE.tdRSchPdf(); });
  await w(500);
  const pdfR = await p.evaluate(async () => {
    const blob = await renderPagesToPDF(dokPdfStranky(), 'x.pdf', { vratitBlob: true }); if (!blob) return null;
    const a = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode.apply(null, a.subarray(i, i + 8192));
    return { b64: btoa(s), vekt: window.__pdfVektor };
  });
  let pdfText = '';
  if (pdfR) {
    const f = path.join(BEH, 'rozvadec-privody-pz2.pdf');
    fs.writeFileSync(f, Buffer.from(pdfR.b64, 'base64'));
    try { pdfText = execFileSync('pdftotext', [f, '-']).toString(); } catch (e) { pdfText = String(e); }
  }
  check('vektorové PDF schématu (případ 2) je skutečně vektorové a pdftotext v něm najde „Přívod 2", „vstup II" i „ze sběrnice"',
    pdfR && pdfR.vekt === true && pdfText.includes('Přívod 2') && pdfText.includes('vstup II') && pdfText.includes('ze sběrnice'), pdfText.slice(0, 400));

  // kolize popisků v okolí PZ (požadavek uživatele 2026-11-19, bod 4) — žádné
  // dva texty ve výkresu PZ (případ 1 i 2) se navzájem nepřekrývají
  const kolizeCheck = async (listSvg, label) => {
    const r = await p.evaluate((svg) => {
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const host = document.importNode(doc.documentElement, true);
      host.style.position = 'absolute'; host.style.left = '-9999px'; host.style.width = '297mm';
      document.body.appendChild(host);
      const texty = Array.from(host.querySelectorAll('text')).filter(t => /vstup|Přívod|-Q[12]|^[123]$|A ATS|1-0-2/.test(t.textContent));
      const boxy = texty.map(t => { const b = t.getBoundingClientRect(); return { t: t.textContent, x: b.x, y: b.y, w: b.width, h: b.height }; });
      host.remove();
      let koliznich = 0;
      for (let i = 0; i < boxy.length; i++) for (let j = i + 1; j < boxy.length; j++) {
        const a = boxy[i], b = boxy[j];
        const prekryv = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        if (prekryv) koliznich++;
      }
      return { koliznich, n: boxy.length, boxy };
    }, listSvg);
    check('kolize popisků v okolí PZ (' + label + '): žádné dva texty se nepřekrývají', r.koliznich === 0, JSON.stringify(r.boxy.map(b => b.t)));
  };
  await kolizeCheck(pz1.svg, 'případ 1');
  await kolizeCheck(pz2.svg, 'případ 2');

  // CSV: sloupec ovladani se importuje
  const csvPz = await p.evaluate(() => {
    const h = ROZV_CSV.map(c => c[0]);
    const radek = h.map(k => ({ druh: 'pristroj', kategorie: 'PZ', nazev: 'Přepínač zdrojů test', vyrobce: 'Výrobce A', typ: 'PZ-TEST',
      poly: '3', in: '63', sirka_moduly: '4', ovladani: 'ats', overeno: 'ne' }[k] || '')).join(';');
    const v = rozvImportRozebrat(h.join(';') + '\r\n' + radek + '\r\n', 'pz.csv');
    return { pol: v.polozky.length, chyby: v.chyby, ovladani: v.polozky[0] && v.polozky[0].polozka.ovladani };
  });
  check('CSV import: sloupec `ovladani` se čte (ats)', csvPz.pol === 1 && csvPz.chyby.length === 0 && csvPz.ovladani === 'ats', JSON.stringify(csvPz));

  // ── 10. SKUTEČNÁ fixtura ROZ-0001 (přiložený soubor uživatele) — PŮVODNÍ
  // hlášená chyba: QH1 je zapojen JEN vodičem na kabel přívodu 2 (žádné
  // vyplněné „Napájen z"), FA1 → FA2 → FA3 jsou na QH1 napojeny řetězem
  // výstup→výstup (paralelně), taky jen vodičem. Dřív se to vykreslilo na
  // sběrnici přívodu 1, protože schéma znalo jen statický `x.nadr`. Soubor
  // je přesně ten, který uživatel poslal (`testy/rozvadec-roz0001.json`,
  // žádná osobní data — investor/místo/adresa jsou v něm prázdné). ───────
  const roz0001json = JSON.parse(require('fs').readFileSync(path.join(__dirname, 'rozvadec-roz0001.json'), 'utf8'));
  await p.evaluate(async (data) => { await dokSouborNacist(data); }, roz0001json);
  const rz1 = await p.evaluate(async () => {
    const polozka = DOK.dokumenty.find(x => x.cislo === 'ROZ-0001');
    await dokOtevrit(polozka.uid);
    const d = window.__dokOtevreny.data;
    const S = rzsTopologie(d);
    const privod2uid = d.privody[0].uid, uidPrivod2 = '@privod~' + privod2uid;
    const vse = {}; rozvPrvkyVse(d.rady).forEach(x => { vse[x.uid] = x; });
    const oznUid = {}; rozvPrvkyVse(d.rady).forEach(x => { oznUid[x.ozn] = x.uid; });
    const korenPanel = {};   // podle panelu (rzsPrivodKorene) — TOTÉŽ, co vidí „Kdo koho napájí"
    ['-QH1', '-FA1', '-FA2', '-FA3', '-Q1', '-FI1', '-FA4', '-FA5', '-FA6', '-FI/FA1', '-FI/FA2'].forEach(oz => {
      korenPanel[oz] = rzsPrivodKorene(S, oznUid[oz]);
    });
    const listy = rozvSchemaListy(d), list1 = listy[1].svg;
    // Ve schématu: kterému úseku (přívodu) patří přístroj PODLE TÉHOŽ VSTUPU
    // (`rsUseky`), ze kterého skutečně kreslí `rozvSchemaListy` — spolehlivější
    // než hledat sloupec v SVG podle sousedství textu.
    const useky = rsUseky(d, S);
    const usekOzn = {}, jednPo = {};   // jednPo[ozn] = délka chainu, do kterého ozn ve svém úseku spadl
    useky.forEach(u => {
      if (u.qm) usekOzn[u.qm.ozn] = u.zaznam.uid;
      u.model.jedn.forEach(j => j.sloupce.forEach((x, i) => { usekOzn[x.ozn] = u.zaznam.uid; jednPo[x.ozn] = { delka: j.sloupce.length, index: i, chain: j.sloupce.map(q => q.ozn).join('>') }; }));
    });
    return { korenPanel, usekOzn, jednPo, privod2uid, uidPrivod2,
      listCount: listy.length, list1obsahujeOba: list1.includes('Přívod 1') && list1.includes('Přívod 2') };
  });
  check('ROZ-0001: panel „Kdo koho napájí" (rzsPrivodKorene) řadí QH1+FA1+FA2+FA3 pod přívod 2, zbytek pod přívod 1',
    rz1.korenPanel['-QH1'] === rz1.uidPrivod2 && rz1.korenPanel['-FA1'] === rz1.uidPrivod2 && rz1.korenPanel['-FA2'] === rz1.uidPrivod2 && rz1.korenPanel['-FA3'] === rz1.uidPrivod2 &&
    rz1.korenPanel['-Q1'] === '@privod' && rz1.korenPanel['-FI1'] === '@privod' && rz1.korenPanel['-FA4'] === '@privod' && rz1.korenPanel['-FA5'] === '@privod' &&
    rz1.korenPanel['-FA6'] === '@privod' && rz1.korenPanel['-FI/FA1'] === '@privod' && rz1.korenPanel['-FI/FA2'] === '@privod', JSON.stringify(rz1.korenPanel));
  check('ROZ-0001: schéma (rsUseky — stejný vstup, který kreslí rozvSchemaListy) řadí QH1/FA1/FA2/FA3 do STEJNÉHO úseku jako panel',
    rz1.usekOzn['-QH1'] === rz1.uidPrivod2 && rz1.usekOzn['-FA1'] === rz1.uidPrivod2 && rz1.usekOzn['-FA2'] === rz1.uidPrivod2 && rz1.usekOzn['-FA3'] === rz1.uidPrivod2 &&
    rz1.usekOzn['-Q1'] !== rz1.uidPrivod2 && rz1.usekOzn['-FI/FA1'] !== rz1.uidPrivod2, JSON.stringify(rz1.usekOzn));
  check('ROZ-0001: FA1/FA2/FA3 jsou PLOCHÍ sourozenci (každý vlastní chain délky 1), ne řetězec FA1→FA2→FA3',
    ['-FA1', '-FA2', '-FA3'].every(oz => rz1.jednPo[oz] && rz1.jednPo[oz].delka === 1 && rz1.jednPo[oz].index === 0),
    JSON.stringify(rz1.jednPo));
  check('ROZ-0001: vygenerovaný list schématu obsahuje popisky obou přívodů', rz1.listCount >= 2 && rz1.list1obsahujeOba, JSON.stringify({ listCount: rz1.listCount, oba: rz1.list1obsahujeOba }));
  // otevření a zpětné uložení nesmí nic přepsat (stejné pravidlo jako u ostatních rozvaděčů)
  const rz2 = await p.evaluate(async () => {
    const pred = JSON.stringify(window.__dokOtevreny.data);
    rozvSchKreslit && rozvZalozkaNastavit('navrh');
    await dokUlozitOtevreny();
    const po = JSON.stringify(window.__dokOtevreny.data);
    return pred === po;
  });
  check('ROZ-0001: otevření a uložení beze změny dat (žádné tiché přepsání)', rz2 === true);

  // ── 8. data revizí beze změny po celé práci s přívody ─────────────────
  const otiskPo = await otisk();
  check('data revizí (STORE, archiv) po práci s přívody bajtově stejná', otiskPred === otiskPo);
  check('žádná chyba na stránce', err.length === 0, err.join(' | '));

  await b.close();
  console.log(res.join('\n'));
  const spatne = res.filter(r => r.startsWith('❌')).length;
  console.log('\n' + (res.length - spatne) + ' ✅, ' + spatne + ' ❌');
  process.exit(spatne ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.error(e); process.exit(2); });
