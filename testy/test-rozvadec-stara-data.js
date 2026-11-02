// Data se novou verzí nemění (přenos konfigurátoru z labu, v9.135).
// Stará verze z gitu (STARA_PORT, 8902; servery.sh STARA=<commit>) × pracovní kopie:
//   * starý rozvaděč (s vypínačem — do v9.134 -QM1 — a ručním Pi) po otevření, projití záložek a uložení
//     bajtově stejný — nic se nepřeznačí, nezapíše se typ obvodu, skupina ani β,
//   * revizní zpráva (getData i archiv po uložení) bajtově stejná, zmrazený čas,
//   * záloha ze staré verze se obnoví beze ztráty, nová ve výchozím stavu bez fotek předloh,
//   * import knihovny CSV se 43, 50 i 51 sloupci.
// Vše vymyšlené (byt 3+1, „Výrobce A / B").
const T = __dirname + '/';
const PORT = process.env.PORT || 8901, STARA = process.env.STARA_PORT || 8902;
const { chromium } = require(T + 'pw');
const path = require('path');
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));

async function stranka(b, port) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: path.join(T, 'knihovny', r.request().url().split('/').pop()),
    contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await ctx.addInitScript(() => {
    try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {}
    // zmrazený čas a náhoda
    const T0 = Date.UTC(2026, 9, 30, 9, 0, 0); let tick = 0;
    const OD = Date;
    function FD(...a) { if (!(this instanceof FD)) return new OD(T0).toString(); return a.length ? new OD(...a) : new OD(T0); }
    FD.prototype = OD.prototype; FD.now = () => T0; FD.UTC = OD.UTC; FD.parse = OD.parse;
    window.Date = FD;
    let s = 12345; Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  });
  const p = await ctx.newPage(), err = [];
  p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://127.0.0.1:' + port + '/index.html'); await w(1500);
  await p.evaluate('window.__rozvByt = ' + require(T + 'rozvadec-byt.js').toString());
  await p.evaluate(() => {
    STORE.technik = Object.assign({}, STORE.technik, { jmeno: 'Petr Vymyšlený', firma: 'Vymyšlená elektro s.r.o.', ico: '12345678', mesto: 'Kyjov' });
    saveStore();
    window.__T = {
      dk: (s, v) => { const e = dokForm().querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); },
      naj: o => { let r = null; __rz.rady.forEach(ra => ra.prvky.forEach(x => { if (x.ozn === o) r = x; })); return r; }
    };
  });
  return { p, err };
}

// otevře rozvaděč, projde záložky a vybere přístroj, uloží; vrátí data
const otevritUlozit = async (p, uid) => p.evaluate(async (uid) => {
  await dokNacist();
  const nacteno = JSON.stringify((DOK.dokumenty.find(x => x.uid === uid) || {}).data);
  await dokOtevrit(uid); await new Promise(r => setTimeout(r, 500));
  for (const z of ['sch', 'dok', 'navrh']) { try { rozvZalozkaNastavit(z); } catch (e) {} await new Promise(r => setTimeout(r, 300)); }
  const q = __T.naj('-FA3'); if (q) { rozvVybrat(q.uid); rozvVybrat(null); }
  const cist = JSON.stringify(DOK_TYPY.rozv.cist(dokForm()));
  await dokUlozitOtevreny();
  const ulozeno = JSON.stringify((DOK.dokumenty.find(x => x.uid === uid) || {}).data);
  return { nacteno, cist, ulozeno };
}, uid);

const zpravaOtevritUlozit = async (p) => p.evaluate(async () => {
  otevritZpravu(0); await new Promise(r => setTimeout(r, 600));
  const D = JSON.stringify(getData());
  saveToArchiv(); await new Promise(r => setTimeout(r, 300));
  return { D, archiv: JSON.stringify(STORE.archiv) };
});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const S = await stranka(b, STARA), N = await stranka(b, PORT);

  // ── stará verze: zpráva + rozvaděč + záloha ───────────────────────────────
  const st = await S.p.evaluate(async () => {
    archiv.length = 0; STORE.archiv = archiv;
    aktTyp = 'elektro'; aktPodtyp = 'dum'; novaZprava('elektro'); await new Promise(r => setTimeout(r, 300));
    const set = (id, x) => { const e = document.getElementById(id); if (e) { e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('f_ev_cislo', 'RE-26-0100'); set('f_misto', 'Testovací objekt'); set('f_adresa', 'Ulice 1\n123 45 Město');
    set('f_provozovatel', 'Provozovatel s.r.o.'); set('f_zahajeni', '2026-04-01'); set('f_ukonceni', '2026-04-01');
    set('f_vypracovani', '2026-04-02'); set('f_pristi', '2031-04-01'); set('f_celkovy_vysledek', 'schopno');
    magicPopis(); magicZaver();
    saveToArchiv(); await new Promise(r => setTimeout(r, 300));

    await dokNovy('rozv');
    __T.dk('[data-dk="oznaceni"]', 'RH1'); __T.dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S'); __T.dk('[data-dk="privodIn"]', '40');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n')); window.__rozvByt();
    __T.naj('-FA2').pi = '1,5'; __T.naj('-FA3').p.pv = '2';
    dokZmena(); await dokUlozitOtevreny();
    const uid = window.__dokOtevreny.uid;
    const zaloha = await buildZalohaBlob().text();
    return { uid, zaloha, csv: ROZV_CSV.map(c => c[0]) };
  });
  // označení vypínače, jak ho dala stará verze (do v9.134 -QM1, od v9.135 -QH1)
  const oznQ = j => (j.match(/"ozn": ?"-Q[MH]?\d*"/g) || []).map(x => x.replace(/\s/g, '')).join(',');
  const oznStare = oznQ(st.zaloha);
  check('stará verze: rozvaděč má vypínač (' + oznStare + ')', !!oznStare);
  const staryRozv = await otevritUlozit(S.p, st.uid);
  const staraZprava = await zpravaOtevritUlozit(S.p);

  // ── nová verze: obnova zálohy ze staré verze ───────────────────────────────────
  const ob = await N.p.evaluate(async (z) => {
    archiv.length = 0; STORE.archiv = archiv;
    obnovZeZalohy(JSON.parse(z)); await new Promise(r => setTimeout(r, 800));
    await dokNacist();
    return { archiv: JSON.stringify(STORE.archiv), dok: JSON.stringify(DOK.dokumenty), knih: JSON.stringify(DOK.rozvKnihovna), obj: JSON.stringify(DOK.rozvObjekty) };
  }, st.zaloha);
  const zal = JSON.parse(st.zaloha);
  check('záloha ze staré verze: archiv obnoven bajtově', ob.archiv === JSON.stringify(zal.archiv));
  check('záloha ze staré verze: dokumenty obnoveny bajtově', ob.dok === JSON.stringify(zal.dokumentace.dokumenty));
  check('záloha ze staré verze: knihovna a objekty', ob.knih === JSON.stringify(zal.dokumentace.rozvKnihovna || []) && ob.obj === JSON.stringify(zal.dokumentace.rozvObjekty || []));

  const novyRozv = await otevritUlozit(N.p, st.uid);
  check('starý rozvaděč: načtená data stejná jako ve staré verzi', novyRozv.nacteno === staryRozv.nacteno);
  check('starý rozvaděč: cist() po otevření bajtově jako ve staré verzi', novyRozv.cist === staryRozv.cist,
    novyRozv.cist.length + ' × ' + staryRozv.cist.length);
  check('starý rozvaděč: uložená data po otevření a uložení bajtově jako ve staré verzi', novyRozv.ulozeno === staryRozv.ulozeno);
  check('starý rozvaděč: označení vypínače se nepřeznačilo (' + oznStare + ')', oznQ(novyRozv.ulozeno) === oznStare, oznQ(novyRozv.ulozeno));
  check('starý rozvaděč: nezapsal se typ obvodu, skupina ani β soudobosti',
    !/"typObv|"soud|"beta"|"obvTyp/.test(novyRozv.ulozeno), (novyRozv.ulozeno.match(/"(typObv|soud\w*|beta|obvTyp)"/g) || []).join(','));
  check('starý rozvaděč: Pi se nedopočítalo (jen ručně zadané 1,5)', (novyRozv.ulozeno.match(/"pi":/g) || []).length === (staryRozv.ulozeno.match(/"pi":/g) || []).length);
  if (novyRozv.ulozeno !== staryRozv.ulozeno) {
    const a = staryRozv.ulozeno, c = novyRozv.ulozeno; let i = 0; while (a[i] === c[i]) i++;
    console.log('ROZDÍL @' + i + '\n stará: ' + a.slice(i - 80, i + 120) + '\n nová:  ' + c.slice(i - 80, i + 120));
  }

  const novaZpr = await zpravaOtevritUlozit(N.p);
  check('zpráva: getData() bajtově jako ve staré verzi', novaZpr.D === staraZprava.D);
  check('zpráva: archiv po uložení bajtově jako ve staré verzi', novaZpr.archiv === staraZprava.archiv);

  // ── nová záloha bez fotek předloh ────────────────────────────────────
  const nz = await N.p.evaluate(async () => { const t = await buildZalohaBlob().text(); return { predlohy: /rzPredlohy/.test(t), chk: !!document.getElementById('zaloha-predlohy'), chkVych: (document.getElementById('zaloha-predlohy') || {}).checked }; });
  check('záloha ve výchozím stavu bez fotek předloh', !nz.predlohy && nz.chk && nz.chkVych === false, JSON.stringify(nz));

  // ── import CSV 43 / 50 / 51 sloupců ──────────────────────────────────
  const im = await N.p.evaluate(() => {
    const nove = ROZV_CSV.map(c => c[0]);
    const OVL = ['uc', 'kontakty', 'ie_ac1', 'pe_ac3_kw', 'rozsah_nastaveni', 'prislusenstvi_k', 'montaz', 'typ_prislusenstvi'];
    const stare = nove.filter(k => OVL.indexOf(k) < 0);   // šablona do v9.134
    const radek = h => h.map(k => ({ druh: 'pristroj', kategorie: 'FA', nazev: 'Jistič test', vyrobce: 'Výrobce A', typ: 'VA-B16-' + h.length,
      poly: '1', in: '16', charakteristika: 'B', icn: '6', sirka_moduly: '1', overeno: 'ne', kontakty: '', montaz: '', typ_prislusenstvi: '' }[k] || '')).join(';');
    const s50 = nove.filter(k => k !== 'typ_prislusenstvi');
    const vys = {};
    for (const [n, h] of [['43', stare], ['50', s50], ['51', nove]]) {
      const v = rozvImportRozebrat(h.join(';') + '\r\n' + radek(h) + '\r\n', 'k' + n + '.csv');
      vys[n] = { sl: h.length, pol: v.polozky.length, chyby: v.chyby.length, nezn: (v.neznameSloupce || []).length, typ: v.polozky[0] && v.polozky[0].polozka.typ };
    }
    // nový řádek s příslušenstvím (51 sloupců)
    const pr = nove.map(k => ({ druh: 'pristroj', kategorie: 'PRISL', nazev: 'Napěťová spoušť', vyrobce: 'Výrobce B', typ: 'VB-NS', sirka_moduly: '0,5',
      montaz: 'bok vpravo', typ_prislusenstvi: 'nap', uc: '230 V AC' }[k] || '')).join(';');
    const v = rozvImportRozebrat(nove.join(';') + '\r\n' + pr + '\r\n', 'p.csv');
    vys.prisl = v.polozky[0] ? { montaz: v.polozky[0].polozka.montaz, typ: v.polozky[0].polozka.prislTyp, chyby: v.chyby.length } : { chyby: JSON.stringify(v.chyby) };
    return vys;
  });
  check('import CSV se 43 sloupci (šablona do v9.134)', im['43'].pol === 1 && !im['43'].chyby && !im['43'].nezn, JSON.stringify(im['43']));
  check('import CSV s 50 sloupci (bez typ_prislusenstvi)', im['50'].sl === 50 && im['50'].pol === 1 && !im['50'].chyby && !im['50'].nezn, JSON.stringify(im['50']));
  check('import CSV s 51 sloupci', im['51'].sl === 51 && im['51'].pol === 1 && !im['51'].chyby && !im['51'].nezn, JSON.stringify(im['51']));
  check('import 51: příslušenství s montáží a typem', im.prisl.montaz === 'bok vpravo' && im.prisl.typ === 'nap' && !im.prisl.chyby, JSON.stringify(im.prisl));

  check('bez chyb stránky', !S.err.length && !N.err.length, S.err.concat(N.err).join(' | '));
  console.log(res.join('\n'));
  await b.close();
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.log('CRASH ' + e.stack); process.exit(1); });
