// Rozvaděč DBO — „📋 Zakreslit z revizní zprávy". Test hlídá:
//  - krok 1: jen zprávy elektro (LPS ani stroje ne), hledání, rok, nejnovější nahoře,
//  - krok 2: rozvaděče se zaškrtávátky, „napájen z", objekt, výběr řady výrobce, souhrn,
//  - převod: hlavička ze zprávy, jistič / chránič / RCBO / pojistka, 3x16A, póly,
//    upozornění (póly, proud, výrobce bez dat), jiný řádek do poznámky,
//    nejmenší vhodná skříň, nadřazený chránič, vazby napájení, zdroj zprávy,
//  - ZPĚT smaže zakreslené i nový objekt, data revizí bajtově stejná, telefon.
// Všechna data vymyšlená (výrobce „Výrobce A" s řadami R1 / R2).
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));
const BEH = require('path').join(__dirname, '_beh');

function priprava() {
  const o = (c, n, typ, ch, a, x) => Object.assign({ rowtype: 'obvod', rcdGroup: '', napaji: [], napajiNazev: [], c, n, typ, ch, a, idn: '',
    isc: '', zsm: '0,5', riso: '>20', rpe: '', faze: '', vyp: '', cas: '', t5idn: '', ut: '', kabel: '' }, x || {});
  const rozvadece = [
    { uid: 'r-rh', nazev: 'RH', umisteni: 'Chodba', privod: 'CYKY-J 5×10', hlavniJistic: '3x25A B', faze: [], auto_cislovani: true, mereni: [
      o('1', 'Sporák', 'Výrobce A', 'B', '3x16A', { kabel: 'CYKY-J 5×2,5' }),
      o('2', 'Vývod RS1', 'Výrobce A R2', 'B', '1×20', { kabel: 'CYKY-J 3×4', napaji: ['r-rs1'] }),
      o('3', 'Vývod RS2', 'Hager', 'C', '25', { napaji: ['r-rs2'] }),
      o('4', 'Pojistky', '', 'gG', '3x32'),
      { rowtype: 'info', napaji: [], napajiNazev: [], c: '5', popis: 'Elektroměr', hodnota: 'výr. č. 123' }
    ] },
    { uid: 'r-rs1', nazev: 'RS1', umisteni: 'Kuchyň', privod: 'CYKY-J 3×4', hlavniJistic: '', faze: [], auto_cislovani: true, mereni: [
      o('1', 'Chránič 4P', 'Výrobce A', 'A', '40', { rowtype: 'rcd-header', rcdGroup: 'g1', idn: '0,03' }),
      { rowtype: 'rcd-mereni', rcdGroup: 'g1', c: '', n: '', typ: '', ch: '', a: '', idn: '', zsm: '', riso: '', faze: 'A-', vyp: '18', cas: '20', t5idn: '', ut: '', kabel: '' },
      o('2', 'Zásuvky', 'Výrobce A', 'B', '1x16', { faze: 'L2' }),
      o('3', 'Světla', 'Výrobce A', 'B', '1x10'),
      o('4', 'RCBO balkon', '', 'B/A', '1x16', { rowtype: 'rcd-header', rcdGroup: 'g2', idn: '0,03' }),
      o('5', 'Myčka', '', 'C/A', '1x16', { idn: '0,03' }),
      o('6', 'Svorka', '', '', '')
    ] },
    { uid: 'r-rs2', nazev: 'RS2', umisteni: 'Garáž', privod: '', hlavniJistic: '', faze: [], auto_cislovani: true, mereni: [
      o('1', 'Garáž', 'Výrobce A', 'C', '1x16')
    ] }
  ];
  const data = { typ: 'elektro', podtyp: 'dum', ev_cislo: 'RE-26-0012', misto: 'Byt Polní 12', adresa: 'Polní 12, 697 01 Kyjov',
    zahajeni: '2026-10-19', ukonceni: '2026-10-19', vypracovani: '2026-10-19',
    provozovatel: 'Jan Vymyšlený\nPolní 12\n697 01 Kyjov\nIČ: 12345678', provozovatel_ico: '',
    napetova_soustava: '1NPE ~50Hz 230V / TN-C-S, 3PEN ~50Hz 400V / TN-C-S', rozvadece, zavady: [], pristroje: [] };
  const z = (uid, typ, ev, misto, datum, d) => ({ uid, typ, podtyp: 'dum', ev_cislo: ev, misto, datum, stav: '', data: Object.assign({ typ, ev_cislo: ev, misto, zahajeni: datum, rozvadece: [] }, d || {}) });
  archiv.unshift(z('z-stara', 'elektro', 'RE-25-0003', 'Garáž Lipová', '2025-05-02', { rozvadece: [{ uid: 'x1', nazev: 'RG', mereni: [] }] }));
  archiv.unshift(z('z-lps', 'lps', 'RE-26-0013', 'Hromosvod Polní', '2026-10-18'));
  archiv.unshift(z('z-stroj', 'stroje', 'RS-26-0002', 'Lis Polní', '2026-10-18'));
  archiv.unshift({ uid: 'z-byt', typ: 'elektro', podtyp: 'dum', ev_cislo: 'RE-26-0012', misto: 'Byt Polní 12', datum: '2026-10-19', stav: '', data });
  saveStore();
  // knihovna: vymyšlený výrobce se dvěma řadami
  const P = (id, rada, kat, poly, In, ch, x) => Object.assign({ id, druh: 'pristroj', kat, vyrobce: 'Výrobce A', rada, typ: rada + '-' + id, poly, In, char: ch, sirka: kat === 'FI' ? 4 : (poly === '3' ? 3 : 1), zdroj: 'import', overeno: true }, x || {});
  DOK.rozvKnihovna = [P('a1', 'R1', 'FA', '3', 16, 'B'), P('a2', 'R2', 'FA', '3', 16, 'B'), P('a3', 'R1', 'FA', '1', 20, 'B'), P('a4', 'R2', 'FA', '1', 20, 'B'),
    P('a5', 'R1', 'FA', '1', 16, 'B'), P('a6', 'R1', 'FA', '1', 10, 'B'), P('a7', 'R2', 'FA', '1', 10, 'B'),
    P('a8', 'R1', 'FI', '4', 40, '', { idn: 30, rcdTyp: 'A' })];
  return dokZapsat();
}

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
  await p.evaluate(priprava); await w(300);
  const otisk = () => p.evaluate(async () => {
    const o = {}; for (const k of STORE_KEYS) o[k] = await idbGet(k);
    return JSON.stringify({ o, ls: localStorage.getItem('revize_el_store'), arch: JSON.stringify(archiv) });
  });
  const otiskPred = await otisk();

  await p.evaluate(() => { dokOtevritTypy(); dokOtevritSeznam('rozv'); }); await w(300);
  const tl = await p.evaluate(() => {
    const h = document.querySelector('#dok-typy .dok-hlavni-akce'), d = document.querySelector('#dok-typy .dok-druha-akce');
    return { druha: d ? d.innerText.trim() : '', vedle: d && Math.abs(d.getBoundingClientRect().top - h.getBoundingClientRect().top) < 4,
             plne: getComputedStyle(h).backgroundColor, obrys: d ? getComputedStyle(d).backgroundColor : '' };
  });
  check('na seznamu vedle hlavní akce obrysové tlačítko „📋 Zakreslit z revizní zprávy"', tl.druha === '📋 Zakreslit z revizní zprávy' && tl.vedle &&
    tl.obrys === 'rgba(0, 0, 0, 0)', JSON.stringify(tl));

  // ── krok 1 ────────────────────────────────────────────────────────────
  await p.click('#dok-typy .dok-druha-akce'); await w(300);
  const k1 = () => p.evaluate(() => Array.from(document.querySelectorAll('#rzz-zpravy .rzz-zprava')).map(b => b.getAttribute('data-zuid')));
  let z1 = await k1();
  const k1t = await p.evaluate(() => document.querySelector('#rzz-zpravy .rzz-zprava').innerText.replace(/\s+/g, ' '));
  check('krok 1: jen zprávy elektro, nejnovější nahoře (LPS a stroje v nabídce nejsou)', z1.join() === 'z-byt,z-stara' &&
    await p.evaluate(() => document.querySelectorAll('#rzz-zpravy .rzz-zprava').length) === 2, z1.join());
  check('krok 1: u zprávy ev. číslo, místo, datum a počet rozvaděčů', /RE-26-0012/.test(k1t) && /Byt Polní 12/.test(k1t) && /19\. 10\. 2026/.test(k1t) && /3 rozvaděče/.test(k1t), k1t);
  await p.fill('#rzz-hledat', 'RG'); await w(150);
  z1 = await k1();
  check('krok 1: hledání i podle názvu rozvaděče („RG")', z1.join() === 'z-stara', z1.join());
  await p.fill('#rzz-hledat', ''); await p.selectOption('#rzz-rok', '2026'); await w(150);
  z1 = await k1();
  check('krok 1: filtr roku', z1.join() === 'z-byt', z1.join());
  await p.screenshot({ path: BEH + '/rozv-zrevize-krok1.png' });

  // ── krok 2 ────────────────────────────────────────────────────────────
  await p.click('#rzz-zpravy [data-zuid="z-byt"]'); await w(400);
  const k2 = await p.evaluate(() => ({
    rozvy: Array.from(document.querySelectorAll('.rzz-rozv')).map(l => (l.querySelector('input').checked ? '☑' : '☐') + l.innerText.replace(/\s+/g, ' ').trim()),
    vse: document.getElementById('rzz-vse').checked, obj: document.getElementById('rzz-obj').value, objNazev: document.getElementById('rzz-obj-nazev').value,
    rada: Array.from(document.querySelectorAll('.rzz-rada')).map(r => r.innerText.replace(/\s+/g, ' ') + '=' + r.querySelector('select').value),
    souhrn: document.getElementById('rzz-souhrn').innerText, ok: document.getElementById('rzz-ok').textContent
  }));
  check('krok 2: tři rozvaděče zaškrtnuté, u nich umístění, počet obvodů, „napájen z RH"', k2.rozvy.length === 3 && k2.vse &&
    /^☑RH · Chodba · 4 obvody/.test(k2.rozvy[0]) && /RS1 · Kuchyň · 6 obvodů · napájen z RH/.test(k2.rozvy[1]) && /RS2 · Garáž · 1 obvod · napájen z RH/.test(k2.rozvy[2]), k2.rozvy.join(' | '));
  check('krok 2: u rozvaděče navržená skříň (RH 1×12, RS1 2×12)', /Rozvodnice 1×12/.test(k2.rozvy[0]) && /Rozvodnice 2×12/.test(k2.rozvy[1]), k2.rozvy.join(' | '));
  check('krok 2: „Zařadit do objektu" předvyplněno místem revize (nový objekt)', k2.obj === '__novy' && k2.objNazev === 'Byt Polní 12', k2.obj + ' ' + k2.objNazev);
  check('krok 2: výběr řady výrobce, předvolená řada napsaná ve značce (R2)', k2.rada.length === 1 && /Výrobce A – jističe: řada/.test(k2.rada[0]) && /=R2$/.test(k2.rada[0]), k2.rada.join(' | '));
  check('krok 2: souhrn přístrojů (podle dat výrobce, obecné, bez značky, k doplnění, jiné řádky)',
    /^11 přístrojů: /.test(k2.souhrn) && /podle dat Výrobce A/.test(k2.souhrn) && /data výrobce nejsou v knihovně/.test(k2.souhrn) && /bez značky/.test(k2.souhrn) &&
    /k doplnění/.test(k2.souhrn) && /jiné řádky \(1\)/.test(k2.souhrn), k2.souhrn);
  check('krok 2: tlačítko „✓ Zakreslit vybrané (3)"', k2.ok === '✓ Zakreslit vybrané (3)', k2.ok);
  await p.screenshot({ path: BEH + '/rozv-zrevize-krok2.png' });
  await p.click('#rzz-vse'); await w(200);
  const nic = await p.evaluate(() => ({ ok: document.getElementById('rzz-ok').textContent, dis: document.getElementById('rzz-ok').disabled }));
  check('„Označit vše" odškrtne všechny, tlačítko se vypne', nic.ok === '✓ Zakreslit vybrané (0)' && nic.dis, JSON.stringify(nic));
  await p.click('#rzz-vse'); await w(200);

  // ── zakreslit ─────────────────────────────────────────────────────────
  const pocetPred = await p.evaluate(() => DOK.dokumenty.length);
  await p.click('#rzz-ok'); await w(600);
  const po = await p.evaluate(() => {
    const docs = DOK.dokumenty.filter(x => x.data && x.data.zdrojRevize);
    const obj = DOK.rozvObjekty.find(o => o.nazev === 'Byt Polní 12');
    return { n: docs.length, obj: obj && obj.id, vObj: docs.every(d => d.data.objekt === (obj && obj.id)), modal: document.getElementById('modal-rz-zrevize').classList.contains('open'),
      akt: document.querySelector('.screen.active').id, skup: Array.from(document.querySelectorAll('#dok-seznam .dok-objekt')).map(h => h.innerText.replace(/\s+/g, ' ')),
      rozbaleny: obj && !document.querySelector('#dok-seznam .dok-obj-obsah[data-obj="' + obj.id + '"]').hidden,
      toast: Array.from(document.querySelectorAll('.toast')).map(t => t.innerText).pop() || '', cisla: docs.map(d => d.cislo + ':' + d.data.oznaceni).join(',') };
  });
  check('zakresleno: 3 rozvaděče v novém objektu „Byt Polní 12", seznam s rozbaleným objektem', po.n === 3 && po.obj && po.vObj && !po.modal &&
    po.akt === 'screen-dok-seznam' && po.rozbaleny && /🏠 Byt Polní 12 3 rozvaděče/.test(po.skup[0]), JSON.stringify(po));
  check('čísla ROZ podle pořadí ve zprávě', po.cisla === 'ROZ-0001:RH,ROZ-0002:RS1,ROZ-0003:RS2', po.cisla);
  check('hláška se souhrnem a ZPĚT', /Zakresleno: 3 rozvaděče do objektu „Byt Polní 12"/.test(po.toast) && /ZPĚT/.test(po.toast), po.toast);
  const strom = await p.evaluate(() => Array.from(document.querySelectorAll('#dok-seznam .dok-polozka')).map(r => r.querySelector('.dok-p-hlavni').innerText.replace(/\s+/g, ' ')));
  check('v objektu strom napájení: RH, pod ním RS1 a RS2 „napájen z RH (-FA2 / -FA3)"', /RH/.test(strom[0]) && /RS1.*napájen z RH \(-FA2\)/.test(strom[1]) && /RS2.*napájen z RH \(-FA3\)/.test(strom[2]), strom.join(' | '));
  await p.screenshot({ path: BEH + '/rozv-zrevize-seznam.png' });

  // ── ZPĚT ──────────────────────────────────────────────────────────────
  await p.keyboard.press('Control+z'); await w(500);
  const zp = await p.evaluate(() => ({ n: DOK.dokumenty.filter(x => x.data && x.data.zdrojRevize).length, obj: DOK.rozvObjekty.length, celkem: DOK.dokumenty.length }));
  check('Ctrl+Z (ZPĚT) smaže zakreslené rozvaděče i nový objekt', zp.n === 0 && zp.obj === 0 && zp.celkem === pocetPred, JSON.stringify(zp));

  await p.click('#dok-typy .dok-druha-akce'); await w(300);
  await p.click('#rzz-zpravy [data-zuid="z-byt"]'); await w(300);
  await p.click('#rzz-ok'); await w(600);
  // ── převod hodnot ─────────────────────────────────────────────────────
  const D = await p.evaluate(() => {
    const g = o => DOK.dokumenty.find(x => x.data && x.data.oznaceni === o && x.data.zdrojRevize);
    const pr = d => d.data.rady.reduce((a, r, i) => a.concat(r.prvky.map(x => Object.assign({ rada: i }, x))), []);
    const out = {};
    ['RH', 'RS1', 'RS2'].forEach(o => { const d = g(o); out[o] = { uid: d.uid, data: d.data, pr: pr(d) }; });
    return out;
  });
  const RH = D.RH.data;
  check('hlavička RH: označení, zakázka = místo revize, odběratel = provozovatel (IČ z textu), místo = umístění + adresa',
    RH.oznaceni === 'RH' && RH.stavba === 'Byt Polní 12' && RH.investor.nazev === 'Jan Vymyšlený' && RH.investor.ico === '12345678' &&
    RH.investor.adresa === 'Polní 12, 697 01 Kyjov' && RH.misto === 'Chodba, Polní 12, 697 01 Kyjov', JSON.stringify({ i: RH.investor, m: RH.misto }));
  check('hlavička RH: soustava (3f přístroj → TN-C-S 3f), přívod In z hlavního jističe, přívodní kabel', RH.soustava === '3PEN/3NPE ~400/230 V TN-C-S' &&
    RH.privodIn === 25 && RH.privodKabel === 'CYKY-J 5×10', RH.soustava + ' | ' + RH.privodIn + ' | ' + RH.privodKabel);
  check('soustava jen při jednoznačné shodě (RS2 s jističem 1P zůstane prázdná)', D.RS2.data.soustava === '', D.RS2.data.soustava);
  check('jiný řádek se nepřevádí — je v poznámce rozvaděče', /5 – Elektroměr – výr\. č\. 123/.test(RH.pozn) && D.RH.pr.length === 4, RH.pozn);
  check('zdroj: zdrojRevize s ev. číslem, uid zprávy a rozvaděče', RH.zdrojRevize.ev_cislo === 'RE-26-0012' && RH.zdrojRevize.uid === 'z-byt' && RH.zdrojRevize.rozvUid === 'r-rh');
  const f = D.RH.pr;
  check('RH: sporák 3x16A → jistič 3P B16 podle dat Výrobce A ve zvolené řadě R2, kabel rozdělený', f[0].p.kat === 'FA' && f[0].p.poly === '3' && f[0].p.In === 16 &&
    f[0].p.char === 'B' && f[0].p.vyrobce === 'Výrobce A' && f[0].p.rada === 'R2' && f[0].knih === 'a2' && f[0].ozn === '-FA1' && f[0].vyvod === 'Sporák' &&
    f[0].kabel === 'CYKY-J' && f[0].prurez === '5×2,5' && !f[0].upoz, JSON.stringify(f[0]));
  check('RH: vývod RS1 (1×20) → B20 1P, napájí RS1', f[1].p.In === 20 && f[1].p.poly === '1' && f[1].ozn === '-FA2' && JSON.stringify(f[1].napaji) === JSON.stringify([D.RS1.uid]), JSON.stringify(f[1]));
  check('RH: Hager C25 bez pólů → obecný jistič, výrobce Hager, upozornění „doplňte póly" a „data výrobce nejsou v knihovně"',
    f[2].p.vyrobce === 'Hager' && f[2].p.char === 'C' && f[2].p.In === 25 && f[2].p.poly === '1' && f[2].knih === 'v-fa-1-C25' &&
    (f[2].upoz || []).join('|') === 'doplňte póly|doplňte typ – data výrobce nejsou v knihovně', JSON.stringify(f[2]));
  check('RH: pojistka gG 3x32 → pojistkový odpínač 3P, vložka v poznámce, bez výrobce', f[3].p.kat === 'FU' && f[3].p.poly === '3' && f[3].p.vyrobce === '' &&
    f[3].pozn === 'vložka gG 32 A' && f[3].ozn === '-FU1', JSON.stringify(f[3]));
  check('RH: skříň nejmenší vhodná plastová nástěnná 1×12 (8 M + rezerva)', RH.skrin.rady === 1 && RH.skrin.modulu === 12 && RH.skrin.material === 'plast' &&
    RH.skrin.provedeni === 'nástěnná', JSON.stringify(RH.skrin));
  const s1 = D.RS1.pr;
  check('RS1: chránič 4P 40 A / 30 mA typ A podle dat výrobce, první v řadě', s1[0].p.kat === 'FI' && s1[0].p.poly === '4' && s1[0].p.idn === 30 &&
    s1[0].p.rcdTyp === 'A' && s1[0].knih === 'a8' && s1[0].rada === 0, JSON.stringify(s1[0]));
  check('RS1: obvody za chráničem pod ním (nadřazený chránič), fáze L2 ze zprávy', s1[1].nadr === s1[0].uid && s1[2].nadr === s1[0].uid &&
    s1[1].faze === 'L2' && s1[1].knih === 'a5', JSON.stringify(s1.slice(1, 3).map(x => [x.ozn, x.nadr, x.faze])));
  check('RS1: hlavička B/A s IΔn → RCBO 1+N B16 / 30 mA (obecné, bez značky)', s1[3].p.kat === 'FIFA' && s1[3].p.poly === '1+N' && s1[3].p.char === 'B' &&
    s1[3].p.In === 16 && s1[3].p.idn === 30 && s1[3].p.vyrobce === '' && s1[3].ozn === '-FI/FA1', JSON.stringify(s1[3]));
  check('RS1: obvod C/A s IΔn → RCBO C16', s1[4].p.kat === 'FIFA' && s1[4].p.char === 'C' && s1[4].ozn === '-FI/FA2', JSON.stringify(s1[4]));
  check('RS1: obvod bez čitelného In → jistič z údajů zprávy (1 modul, neověřený) s upozorněním', s1[5].p.kat === 'FA' && s1[5].p.In === '' &&
    s1[5].p.sirka === 1 && s1[5].p.overeno === false && s1[5].knih === '' && (s1[5].upoz || []).join('|') === 'doplňte póly|doplňte jmenovitý proud', JSON.stringify(s1[5]));
  check('RS1: skříň 2×12 (11 M se do 1×12 s rezervou nevejde), napájen z RH (-FA2)', D.RS1.data.skrin.rady === 2 && D.RS1.data.skrin.modulu === 12 &&
    D.RS1.data.napajenZ.uid === D.RH.uid && D.RS1.data.napajenZ.ozn === '-FA2', JSON.stringify([D.RS1.data.skrin.nazev, D.RS1.data.napajenZ]));
  check('RS2: C16 výrobce A bez shody v jeho datech → obecný s upozorněním', D.RS2.pr[0].p.vyrobce === 'Výrobce A' && D.RS2.pr[0].knih === 'v-fa-1-C16' &&
    /shodný přístroj není/.test((D.RS2.pr[0].upoz || []).join()), JSON.stringify(D.RS2.pr[0]));

  // ── otevřený rozvaděč: hlavička a vlastnosti ──────────────────────────
  await p.evaluate(uid => dokOtevrit(uid), D.RS1.uid); await w(500);
  await p.evaluate(() => { dokForm().querySelector('.rz-hlavicka').open = true; });
  const ed = await p.evaluate(() => {
    const hl = dokForm().querySelector('.rz-hlavicka').innerText;
    const upozSvg = document.querySelectorAll('#rz-pohled .rz-upoz').length;
    const u = __rz.rady[0].prvky[5].uid; rozvVybrat(u, false);
    const v = document.getElementById('rz-vlastnosti').innerText;
    return { hl, upozSvg, v };
  });
  check('hlavička: nenápadně „Zakresleno ze zprávy RE-26-0012 (19. 10. 2026)" a „Napájen z RH (-FA2)"',
    /📋 Zakresleno ze zprávy RE-26-0012 \(19\. 10\. 2026\)/.test(ed.hl) && /⚡ Napájen z RH \(-FA2\)/.test(ed.hl), ed.hl.slice(0, 160));
  check('čelní pohled: přístroje k doplnění mají oranžovou značku „!"', ed.upozSvg === 1, String(ed.upozSvg));
  check('vlastnosti: upozornění „doplňte póly · doplňte jmenovitý proud" s „✓ Hotovo"', /⚠ doplňte póly · doplňte jmenovitý proud/.test(ed.v) && /Hotovo/.test(ed.v), ed.v.slice(0, 200));
  await p.click('#rz-vlastnosti [data-action="tdRUpozHotovo"]'); await w(300);
  check('„✓ Hotovo" upozornění schová', await p.evaluate(() => !__rz.rady[0].prvky[5].upoz && !document.querySelector('#rz-vlastnosti .rp-upoz')));
  await p.screenshot({ path: BEH + '/rozv-zrevize-rozvadec.png' });
  await p.evaluate(uid => dokOtevrit(uid), D.RH.uid); await w(400);
  const nap = await p.evaluate(() => { rozvVybrat(__rz.rady[0].prvky[1].uid, false); return document.getElementById('rz-vlastnosti').innerText; });
  check('vlastnosti jističe -FA2 v RH: „→ napájí: RS1"', /→ napájí: RS1/.test(nap), nap.slice(0, 160));
  await p.evaluate(() => dokOtevritSeznam('rozv')); await w(300);

  // ── do existujícího objektu, jen jeden rozvaděč ───────────────────────
  await p.evaluate(async () => {
    await dokNacist(); DOK.dokumenty = DOK.dokumenty.filter(x => !(x.data && x.data.zdrojRevize)); DOK.rozvObjekty = []; await dokZapsat();
    await dokObjZalozit('Byt Polní 12'); dokSeznamPolozky();
  }); await w(200);
  await p.click('#dok-typy .dok-druha-akce'); await w(300);
  await p.click('#rzz-zpravy [data-zuid="z-byt"]'); await w(300);
  const ex = await p.evaluate(() => document.getElementById('rzz-obj').selectedOptions[0].textContent);
  await p.click('.rzz-rozv input[data-rzz-rozv="r-rh"]'); await p.click('.rzz-rozv input[data-rzz-rozv="r-rs2"]'); await w(200);
  const jeden = await p.evaluate(() => document.getElementById('rzz-ok').textContent);
  await p.click('#rzz-ok'); await w(500);
  const ex2 = await p.evaluate(() => { const d = DOK.dokumenty.filter(x => x.data && x.data.zdrojRevize);
    return { n: d.length, ozn: d[0] && d[0].data.oznaceni, obj: DOK.rozvObjekty.length, v: d[0] && d[0].data.objekt === DOK.rozvObjekty[0].id, nz: d[0] && d[0].data.napajenZ }; });
  check('objekt stejného jména se předvybere; jen RS1 → 1 rozvaděč, napájen z RH (jen jménem — RH se nezakreslil)', ex === '🏠 Byt Polní 12' &&
    jeden === '✓ Zakreslit vybrané (1)' && ex2.n === 1 && ex2.ozn === 'RS1' && ex2.obj === 1 && ex2.v && ex2.nz && !ex2.nz.uid && ex2.nz.nazev === 'RH', ex + ' ' + jeden + ' ' + JSON.stringify(ex2));
  const pod = await p.evaluate(() => Array.from(document.querySelectorAll('#dok-seznam .dok-polozka')).find(r => /RS1/.test(r.innerText)).querySelector('.dok-p-pod').innerText);
  check('v seznamu „napájen z RH" i bez zakresleného RH', /napájen z RH/.test(pod), pod);

  check('archiv a data revizí po zakreslení bajtově stejná', (await otisk()) === otiskPred);
  check('bez chyb v konzoli', !err.length, err.join(' | '));

  // ── telefon ───────────────────────────────────────────────────────────
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await m.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const q = await m.newPage();
  await q.goto(URL); await w(1000);
  await q.evaluate(priprava); await q.evaluate(() => { dokOtevritTypy(); dokOtevritSeznam('rozv'); }); await w(300);
  const t1 = await q.evaluate(() => { const h = document.querySelector('#dok-typy .dok-hlavni-akce').getBoundingClientRect(), d = document.querySelector('#dok-typy .dok-druha-akce').getBoundingClientRect();
    return { pod: d.top >= h.bottom - 1, sirka: Math.round(d.width), okno: window.innerWidth, vys: d.height }; });
  check('telefon: „Zakreslit z revizní zprávy" pod hlavní akcí přes celou šířku', t1.pod && t1.sirka >= t1.okno - 40 && t1.vys >= 44, JSON.stringify(t1));
  await q.screenshot({ path: BEH + '/rozv-zrevize-telefon-seznam.png' });
  await q.tap('#dok-typy .dok-druha-akce'); await w(300);
  await q.tap('#rzz-zpravy [data-zuid="z-byt"]'); await w(400);
  const t2 = await q.evaluate(() => ({ siroka: document.documentElement.scrollWidth <= window.innerWidth,
    modal: document.querySelector('#modal-rz-zrevize .modal').getBoundingClientRect().right <= window.innerWidth + 1 }));
  check('telefon: krok 2 se vejde na šířku', t2.siroka && t2.modal, JSON.stringify(t2));
  await q.screenshot({ path: BEH + '/rozv-zrevize-telefon.png' });
  await m.close();

  await b.close();
  console.log(res.join('\n'));
  const spatne = res.filter(r => r.startsWith('❌')).length;
  console.log(spatne ? 'ŠPATNĚ: ' + spatne + ' z ' + res.length : 'VŠE OK (' + res.length + ')');
  process.exit(spatne ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.error('SELHALO', e); process.exit(1); });
