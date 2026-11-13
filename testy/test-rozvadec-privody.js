// Rozvaděč — víc přívodů (2026-11-13, blok „ROZVADĚČ — VÍC PŘÍVODŮ").
// Hlídá: karta „＋ Další přívod" v hlavičce (pole, ▲ ▼, 🗑 Odebrat), uložení do
// `d.privody` (klíč jen s druhým přívodem), souhrn v liště „Přívod 1: N · Přívod 2: M"
// s klikem na výběr přístrojů, propojené přívody = chyba v „Co ještě chybí" (zmizí
// po odpojení vodiče), odebrání přívodu s napojenými přístroji se ptá a jde ZPĚT /
// Ctrl+Z, odebráním posledního přívodu navíc klíč `privody` zmizí, a že se starý
// jednopřívodový rozvaděč (byt 3+1) nezmění — žádný `privody` v datech, ukazatel
// v liště schovaný.
// Vymyšlený byt 3+1 z testy/rozvadec-byt.js.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
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
