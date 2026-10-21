// Rozvaděč DBO — etapa 2: dokumenty z návrhu (záložka „Dokumenty").
// Hlídá: přepínač Návrh | Dokumenty, předvyplnění z návrhu (a že se
// odvozené hodnoty ukládají prázdné), zrcadlová pole s hlavičkou, výrobní
// číslo (řada, přepsání, duplicita), štítek (povinné údaje, CE, skutečná
// velikost v mm, rozšířená část, třída II), prohlášení (7 bodů doslova,
// RoHS), protokol (9 položek, výsledky prázdné, „prohlídky S vyhovují",
// metoda B jen do 630 A a 500 V, porovnání ≥ 1 MΩ), technické údaje
// (prázdné řádky se netisknou), PDF na šířku i na výšku, starý rozvaděč
// beze změny, polozapuštěná skříň, data revizí beze změny, telefon.
// Vše vymyšlené (byt 3+1 z testy/rozvadec-byt.js).
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));
const BEH = require('path').join(__dirname, '_beh');
const MM = 96 / 25.4;

async function priprava(p) {
  await p.evaluate('window.__rozvByt = ' + require('./rozvadec-byt.js').toString());
  await p.evaluate(async () => {
    STORE.technik = Object.assign({}, STORE.technik, { jmeno: 'Petr Vymyšlený', firma: 'Vymyšlená elektro s.r.o.', ico: '12345678',
      ulice: 'Polní 1', psc: '697 01', mesto: 'Kyjov' });
    STORE.pristroje = [{ nazev: 'Vymyšlený tester VT-1', vyrCislo: 'VV-123', kalibrace: '2026-03-01', platnost: '2027-03-01' }];
    saveStore();
    window.__T = {
      w: ms => new Promise(r => setTimeout(r, ms)),
      dk: (s, v) => { const e = dokForm().querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); },
      txt: s => Array.from(document.querySelectorAll(s)).map(e => e.innerText).join('\n')
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
  const otisk = () => p.evaluate(async () => {
    const o = {}; for (const k of STORE_KEYS) if (k !== 'technik' && k !== 'pristroje') o[k] = await idbGet(k);
    return JSON.stringify({ o, arch: JSON.stringify(archiv) });
  });
  await priprava(p);
  const otiskPred = await otisk();
  const ROK = await p.evaluate(() => String(new Date().getFullYear()));

  // ── 1. přepínač Návrh | Dokumenty ─────────────────────────────────────
  const z0 = await p.evaluate(() => ({ tl: Array.from(document.querySelectorAll('.rz-zal')).map(b => b.textContent + (b.classList.contains('akt') ? '*' : '')).join('|'),
    navrh: !document.getElementById('rz-pan-navrh').hidden, dok: !document.getElementById('rz-pan-dok').hidden }));
  check('editor: nahoře přepínač „🧩 Návrh | ⚡ Schéma | 📄 Dokumenty", otevřený Návrh', z0.tl === '🧩 Návrh*|⚡ Schéma|📄 Dokumenty' && z0.navrh && !z0.dok, JSON.stringify(z0));
  await p.click('.rz-zal[data-z="dok"]'); await w(200);
  const z1 = await p.evaluate(() => {
    const g = document.querySelector('#rz-pan-dok .rz-dok-generuj'), hl = document.querySelector('#rz-pan-dok').getBoundingClientRect();
    return { navrh: !document.getElementById('rz-pan-navrh').hidden, dok: !document.getElementById('rz-pan-dok').hidden,
      akce: g && g.textContent, nahore: g && g.getBoundingClientRect().top - hl.top < 120, plne: g && getComputedStyle(g).backgroundColor,
      vyber: Array.from(document.querySelectorAll('.rz-dok-vyber input')).map(i => (i.checked ? '☑' : '☐') + i.parentNode.textContent.trim()).join('|'),
      stitek: (document.querySelector('[data-action="tdRStitek"]') || {}).textContent,
      popisky: (document.querySelector('[data-action="tdRPopisky"]') || {}).textContent,
      oddily: Array.from(document.querySelectorAll('.rz-dok-oddil')).map(d => d.querySelector('summary').textContent + (d.open ? '+' : '-')).join('|'),
      aktivni: rozvEditorAktivni() };
  });
  check('záložka Dokumenty: jedna hlavní akce „📄 Vygenerovat dokumentaci (PDF)" nahoře, plné tlačítko', z1.dok && !z1.navrh && z1.akce === '📄 Vygenerovat dokumentaci (PDF)' &&
    z1.nahore && z1.plne !== 'rgba(0, 0, 0, 0)', JSON.stringify(z1));
  check('výběr do PDF: čelní pohled a seznam · technické údaje · prohlášení · protokol (vše zaškrtnuté), štítek zvlášť',
    z1.vyber === '☑čelní pohled a seznam přístrojů|☑schéma zapojení|☑technické údaje|☑prohlášení o shodě|☑protokol o kusovém ověření|☐ověření oteplení (příloha)|☐popisky pod přístroje' && z1.stitek === '🏷 Tisk štítku' &&
    z1.popisky === '🏷 Tisk popisků přístrojů', z1.vyber);
  check('oddíly sbalitelné: Výroba a značení (otevřený) · Technické údaje · Oteplení · Prohlášení · Kusové ověření', z1.oddily ===
    '🏭 Výroba a značení+|📋 Technické údaje-|🌡 Oteplení — ověření výpočtem (čl. 10.10.4.2)-|📜 Prohlášení o shodě-|🔧 Kusové ověření (čl. 11)-', z1.oddily);
  check('na záložce Dokumenty nefungují klávesy návrhu (Delete nesmaže skrytý přístroj)', z1.aktivni === false);
  await p.screenshot({ path: BEH + '/rz-dok-zalozka.png' });

  // ── 2. předvyplnění z návrhu ──────────────────────────────────────────
  const pv = await p.evaluate(() => {
    const v = s => (dokForm().querySelector(s) || {}).value;
    return { vc: v('[data-dk="vyroba.cislo"]'), typ: v('[data-dk="vyroba.typ"]'), dat: v('[data-dk="vyroba.datum"]'), dnes: __rz.o.data.datum.slice(0, 7),
      un: v('[data-dk="tech.un"]'), fn: v('[data-dk="tech.fn"]'), sit: v('[data-dk="tech.sit"]'), icc: v('[data-zrc="icc"]'), ipz: v('[data-zrc="krytiZavreno"]'),
      vyr: v('[data-zrc="vyrobce.nazev"]'), ps: v('[data-dk="prohl.cislo"]'), ko: v('[data-dk="ko.cislo"]'), pj: v('[data-dk="prohl.jmeno"]'),
      p115: v('[data-dk="ko.p.k11_5"]'), p1110: v('[data-dk="ko.p.k11_10"]'), p112: v('[data-dk="ko.p.k11_2"]'), p116: v('[data-dk="ko.p.k11_6"]'),
      ina: v('[data-dk="tech.ina"]'), inaPh: dokForm().querySelector('[data-dk="tech.ina"]').placeholder, znec: v('[data-dk="tech.znec"]'),
      chybi: document.getElementById('rz-dok-chybi').innerText };
  });
  check('předvyplněno: výrobní číslo ' + ROK + '-0001, typ z označení a skříně, datum výroby z data', pv.vc === ROK + '-0001' && pv.typ === 'RH1 DBO 3×12 M' && pv.dat === pv.dnes, JSON.stringify(pv).slice(0, 200));
  check('předvyplněno ze soustavy: Un 400/230 V, fn 50 Hz, druh sítě 3/N/PE AC TN-S; Icc a krytí z hlavičky; výrobce z profilu',
    pv.un === '400/230 V' && pv.fn === '50 Hz' && pv.sit === '3/N/PE AC TN-S' && pv.icc === '6' && pv.ipz === 'IP40' && pv.vyr === 'Vymyšlená elektro s.r.o.', '');
  check('čísla dokumentů z výrobního čísla: PS-' + ROK + '-0001, KO-' + ROK + '-0001; podepisuje technik z profilu', pv.ps === 'PS-' + ROK + '-0001' && pv.ko === 'KO-' + ROK + '-0001' && pv.pj === 'Petr Vymyšlený', pv.ps + ' ' + pv.ko);
  check('poznámky protokolu z návrhu (krytí, přístroje, spoje, chrániče) — výsledky ne', /deklarované krytí IP40 \/ IP20 \(zavřeno\/otevřeno\)/.test(pv.p112) &&
    /^osazení a značení dle seznamu přístrojů \(\d+ ks: -QM1, SPD1, -FA1/.test(pv.p115) && pv.p116 === 'namátkově zkontrolováno __ spojů, utahovací moment dle výrobce přístroje' &&
    /tlačítkem T \(-FI1, -FI2, -FI\/FA1\)$/.test(pv.p1110), pv.p115 + ' | ' + pv.p1110);
  check('InA a stupeň znečištění se nevymýšlí (prázdné, InA s nápovědou podle přívodu)', pv.ina === '' && /přívod v hlavičce: 40 A/.test(pv.inaPh) && pv.znec === '', pv.inaPh);
  check('řádek „Chybí:" s odkazem na InA', /^Chybí: .*InA/.test(pv.chybi) && !/výrobní číslo/.test(pv.chybi), pv.chybi);
  await p.click('#rz-dok-chybi [data-cil*="tech.ina"]'); await w(400);
  const naPole = await p.evaluate(() => ({ f: document.activeElement && document.activeElement.getAttribute('data-dk'), open: document.querySelector('[data-oddil="tech"]').open }));
  check('odkaz v „Chybí" otevře oddíl a skočí do pole', naPole.f === 'tech.ina' && naPole.open, JSON.stringify(naPole));
  await p.fill('[data-dk="tech.ina"]', '40'); await w(100);
  await p.fill('[data-zrc="icc"]', '10'); await w(100);
  const zr = await p.evaluate(async () => { const h = dokForm().querySelector('[data-dk="icc"]').value; await dokUlozitOtevreny(); const d = __rz.o.data;
    return { h, icc: d.icc, ina: d.tech.ina, un: d.tech.un, typ: d.vyroba.typ, vc: d.vyroba.cislo, ps: d.prohl.cislo, p115: d.ko.p.k11_5, chybi: document.getElementById('rz-dok-chybi').innerText }; });
  check('zrcadlové pole: Icc napsané v Dokumentech je i v hlavičce a v datech', zr.h === '10' && zr.icc === '10', JSON.stringify(zr));
  check('odvozené hodnoty se ukládají prázdné (mění se s návrhem), vyplněné ano', zr.ina === '40' && zr.un === '' && zr.typ === '' && zr.ps === '' && zr.p115 === '' && zr.vc === ROK + '-0001', JSON.stringify(zr));
  check('po doplnění „✓ Pro štítek a prohlášení je vyplněno vše potřebné."', /^✓ Pro štítek a prohlášení je vyplněno vše potřebné\.$/.test(zr.chybi), zr.chybi);
  // přejmenování → typové označení se změní samo
  await p.click('.rz-zal[data-z="navrh"]'); await w(100);
  await p.evaluate(() => { document.querySelector('.rz-hlavicka').open = true; });
  await p.fill('[data-dk="oznaceni"]', 'RH2'); await w(100);
  await p.click('.rz-zal[data-z="dok"]'); await w(150);
  const typ2 = await p.evaluate(() => dokForm().querySelector('[data-dk="vyroba.typ"]').value);
  check('typové označení jde s návrhem (přejmenování RH1 → RH2)', typ2 === 'RH2 DBO 3×12 M', typ2);
  await p.click('.rz-zal[data-z="navrh"]'); await w(100); await p.fill('[data-dk="oznaceni"]', 'RH1'); await w(100);
  await p.click('.rz-zal[data-z="dok"]'); await w(150);

  // ── 3. výrobní číslo: řada, duplicita, ⟳ ──────────────────────────────
  const prvniUid = await p.evaluate(() => __rz.o.uid);
  const vc2 = await p.evaluate(async () => {
    await dokNovy('rozv'); rozvZalozkaNastavit('dok'); await __T.w(50);
    const r = { nove: dokForm().querySelector('[data-dk="vyroba.cislo"]').value };
    __T.dk('[data-dk="vyroba.cislo"]', r.nove.slice(0, 5) + '0001'); await __T.w(50);
    r.dup = document.getElementById('rz-vc-dup').textContent;
    TD_AKCE.tdRVyrCislo(); await __T.w(50);
    r.znovu = dokForm().querySelector('[data-dk="vyroba.cislo"]').value; r.dup2 = document.getElementById('rz-vc-dup').textContent;
    __T.dk('[data-dk="vyroba.cislo"]', 'VLASTNI-7'); await dokUlozitOtevreny();
    r.ulozeno = __rz.o.data.vyroba.cislo; r.uid = __rz.o.uid;
    return r;
  });
  check('výrobní číslo: další rozvaděč dostane ' + ROK + '-0002; stejné číslo jiného rozvaděče se ohlásí; ⟳ přidělí volné; jde přepsat',
    vc2.nove === ROK + '-0002' && /už má ROZ-0001 \(RH1\)/.test(vc2.dup) && vc2.znovu === ROK + '-0002' && vc2.dup2 === '' && vc2.ulozeno === 'VLASTNI-7', JSON.stringify(vc2));
  await p.evaluate(async uid => { DOK.dokumenty = DOK.dokumenty.filter(x => x.uid !== uid); await dokZapsat(); }, vc2.uid);
  await p.evaluate(async uid => { await dokOtevrit(uid); rozvZalozkaNastavit('dok'); }, prvniUid); await w(200);

  // ── 4. štítek — tabulka s popsanými políčky (v1.22) ───────────────────
  // každé políčko: popisek nahoře (5–7,2 pt, šedý), hodnota pod ním; nic nepřetéká
  const stitekInfo = () => p.evaluate(() => {
    const s = document.querySelector('#dok-pdf-pages .rz-stitek'), r = s.getBoundingClientRect(), ce = s.querySelector('svg.rz-ce'), MMx = 96 / 25.4, PT = 96 / 72;
    const bunky = Array.from(s.querySelectorAll('.rz-sc')).map(c => {
      const l = c.querySelector('.rz-sc-l'), v = c.querySelector('.rz-sc-v');
      return { l: l ? l.textContent : '', v: v ? v.innerText.replace(/\s+/g, ' ').trim() : '', ok: c.scrollHeight <= c.clientHeight + 0.5 && c.scrollWidth <= c.clientWidth + 0.5 && (!l || l.scrollWidth <= l.clientWidth + 0.5),
        lpt: l ? parseFloat(getComputedStyle(l).fontSize) / PT : 0, vpt: v ? parseFloat(getComputedStyle(v).fontSize) / PT : 0, lbarva: l ? getComputedStyle(l).color : '',
        w: c.getBoundingClientRect().width / MMx, radek: Array.from(c.parentNode.parentNode.children).indexOf(c.parentNode), vRadku: c.parentNode.children.length };
    });
    return { akt: document.querySelector('.screen.active').id, w: r.width, h: r.height, tab: s.classList.contains('rz-st-tab'), bunky, text: s.innerText.replace(/\s+/g, ' '),
      ce: ce && ce.getBoundingClientRect().height / MMx, cesty: ce ? ce.querySelectorAll('path').length : 0, img: s.querySelectorAll('img').length,
      logo: (() => { const i = s.querySelector('img.rz-st-logo'); return i ? i.getBoundingClientRect().height / MMx : 0; })(),
      vejde: (() => { const o = s.querySelector('.rz-st-obsah'); return o.scrollHeight <= o.clientHeight + 1; })(),
      info: document.getElementById('dok-pdf-info').textContent, kusu: document.querySelectorAll('#dok-pdf-pages .rz-stitek').length,
      stran: document.querySelectorAll('#dok-pdf-pages .a4').length, orez: document.querySelectorAll('#dok-pdf-pages .rz-orez').length,
      pokyn: (document.querySelector('.rz-st-pokyn') || {}).innerText || '', list: document.querySelector('#dok-pdf-pages .a4').getBoundingClientRect().width,
      tr2: !!s.querySelector('.rz-tr2') };
  });
  const stitekS = (nast) => p.evaluate(async nast => {
    await dokOtevrit(__rz.o.uid); rozvZalozkaNastavit('dok');
    for (const [k, v] of Object.entries(nast)) {
      const e = dokForm().querySelector('[data-dk="' + k + '"]');
      if (e.type === 'checkbox') { e.checked = !!v; e.dispatchEvent(new Event('change', { bubbles: true })); } else __T.dk('[data-dk="' + k + '"]', v);
    }
    await TD_AKCE.tdRStitek(); await __T.w(300);
  }, nast);
  const bunka = (st, l) => st.bunky.find(b => b.l === l) || {};
  await p.click('[data-action="tdRStitek"]'); await w(500);
  const st = await stitekInfo();
  check('štítek ve skutečné velikosti: 90 × 45 mm na listu A4 (210 mm), nic se nezmenšuje', Math.abs(st.w - 90 * MM) < 1 && Math.abs(st.h - 45 * MM) < 1 &&
    Math.abs(st.list - 210 * MM) < 2 && st.akt === 'screen-dok-pdf', st.w.toFixed(1) + '×' + st.h.toFixed(1));
  check('štítek je tabulka s popsanými políčky (výchozí): Výrobce · Typové označení · Označení rozvaděče · Výrobní číslo · Datum výroby · napětí a kmitočet · Soustava · InA · Icc · Krytí IP',
    st.tab && st.bunky.filter(b => b.l).map(b => b.l).join('|') === 'Výrobce|Typové označení|Označení rozvaděče|Výrobní číslo|Datum výroby|Jmenovité napětí a kmitočet|Soustava|Jmenovitý proud InA|Zkratová odolnost Icc|Krytí IP (zavřeno / otevřeno)',
    st.bunky.map(b => b.l).join('|'));
  check('hodnoty v políčkách: výrobce s adresou a IČO, typ, RH1, výr. č., RRRR/MM, 400/230 V, 50 Hz, 3/N/PE AC TN-S, 40 A, 10 kA, IP40 / IP20',
    /^Vymyšlená elektro s\.r\.o\. Polní 1, 697 01 Kyjov · IČO 12345678$/.test(bunka(st, 'Výrobce').v) && bunka(st, 'Typové označení').v === 'RH1 DBO 3×12 M' &&
    bunka(st, 'Označení rozvaděče').v === 'RH1' && bunka(st, 'Výrobní číslo').v === ROK + '-0001' && /^\d{4}\/\d{2}$/.test(bunka(st, 'Datum výroby').v) &&
    bunka(st, 'Jmenovité napětí a kmitočet').v === '400/230 V, 50 Hz' && bunka(st, 'Soustava').v === '3/N/PE AC TN-S' && bunka(st, 'Jmenovitý proud InA').v === '40 A' &&
    bunka(st, 'Zkratová odolnost Icc').v === '10 kA' && bunka(st, 'Krytí IP (zavřeno / otevřeno)').v === 'IP40 / IP20', JSON.stringify(st.bunky.map(b => b.v)));
  check('spodní pás přes celou šířku: ČSN EN IEC 61439-3 (IEC 61439-3) — beze změny', st.bunky.some(b => b.v === 'ČSN EN IEC 61439-3 (IEC 61439-3)' && b.vRadku === 1));
  check('popisky drobně (5–7,2 pt) a šedě, hodnoty větší a tučně', st.bunky.filter(b => b.l).every(b => b.lpt >= 5 - 0.05 && b.lpt <= 7.2 && b.vpt > b.lpt) &&
    bunka(st, 'Výrobní číslo').lbarva !== 'rgb(0, 0, 0)', st.bunky.filter(b => b.l).map(b => b.lpt.toFixed(1) + '/' + b.vpt.toFixed(1)).join(' '));
  check('značka CE nakreslená (SVG, žádný obrázek) v horním pásu vpravo, výška aspoň 8 mm', st.cesty === 2 && !st.img && st.ce >= 8 - 0.05 && st.bunky[1].radek === 0 && st.bunky[1].l === '', (st.ce || 0).toFixed(1) + ' mm');
  check('90 × 45: každé políčko i celý štítek bez přetečení, ořezové značky, pokyn „Tiskněte ve skutečné velikosti (100 %)" s úsečkou 50 mm',
    st.vejde && st.bunky.every(b => b.ok) && st.orez === 8 && /Tiskněte ve skutečné velikosti \(100 %\)/.test(st.pokyn) && /50 mm/.test(st.pokyn) && !/zvolte větší/.test(st.info), st.info);
  check('bez třídy ochrany se políčko Třída nekreslí a značka třídy II netiskne', !st.bunky.some(b => b.l === 'Třída ochrany') && !st.tr2);
  await p.screenshot({ path: BEH + '/rz-dok-stitek.png' });
  await stitekS({ 'stitek.vel': '70x35', 'stitek.kusu': '12', 'tech.trida': 'II', 'stitek.tridaII': true });
  const st2 = await stitekInfo();
  check('štítek 70 × 35 mm, 12 kusů na list, třída II se značkou — každé políčko se vejde, písmo ne pod 5 pt, CE ≥ 5 mm', Math.abs(st2.w - 70 * MM) < 1 && Math.abs(st2.h - 35 * MM) < 1 &&
    st2.kusu === 12 && st2.stran === 1 && st2.tr2 && st2.vejde && st2.bunky.every(b => b.ok && (!b.l || b.lpt >= 4.95) && b.vpt >= 4.95) && st2.ce >= 5 - 0.05 &&
    bunka(st2, 'Třída ochrany').v === 'II', JSON.stringify(st2.bunky.map(b => b.l + (b.ok ? '' : '✗'))));
  check('70 × 35: soustava, napětí a kmitočet v jednom políčku; proud, Icc, krytí a třída v jednom řádku', bunka(st2, 'Soustava, jmenovité napětí a kmitočet').v === '3/N/PE AC 400/230 V 50 Hz TN-S' &&
    bunka(st2, 'Proud InA').vRadku === 4, JSON.stringify(st2.bunky.map(b => b.l)));
  await stitekS({ 'stitek.vel': '100x60', 'stitek.kusu': '1' });
  const st3 = await stitekInfo();
  check('štítek 100 × 60 mm: větší písmo, každé políčko se vejde, CE ≥ 8 mm', Math.abs(st3.w - 100 * MM) < 1 && Math.abs(st3.h - 60 * MM) < 1 && st3.vejde &&
    st3.bunky.every(b => b.ok) && bunka(st3, 'Výrobní číslo').vpt > bunka(st, 'Výrobní číslo').vpt && st3.ce >= 8, bunka(st3, 'Výrobní číslo').vpt.toFixed(1) + ' pt');
  await stitekS({ 'stitek.vel': '90x45', icc: '' });
  const st4 = await stitekInfo();
  const ina4 = bunka(st4, 'Jmenovitý proud InA');
  check('Icc prázdné = políčko Icc chybí a InA se roztáhne přes celý řádek', !st4.bunky.some(b => /Icc/.test(b.l)) && ina4.vRadku === 1 && ina4.w > 80, JSON.stringify(ina4));
  await stitekS({ icc: '10', 'stitek.rozsirena': false });
  const st5 = await stitekInfo();
  check('bez rozšířené části jen povinné údaje (InA zůstane; Icc, IP, soustava ne)', bunka(st5, 'Jmenovitý proud InA').v === '40 A' && !/Icc|IP40|TN-S/.test(st5.text), st5.text);
  await stitekS({ 'stitek.rozsirena': true, 'stitek.styl': 'jednoduche' });
  const st6 = await stitekInfo();
  check('rozvržení „jednoduché": staré řádky textu (Rozvaděč nn typ, Výr. č., Rok/měs., norma, síť, InA), žádná políčka', !st6.tab && !st6.bunky.length &&
    /Rozvaděč nn typ: RH1 DBO 3×12 M/.test(st6.text) && new RegExp('Výr\\. č\\.: ' + ROK + '-0001 Rok/měs\\.: \\d{4}/\\d{2}').test(st6.text) &&
    /ČSN EN IEC 61439-3 \(IEC 61439-3\)/.test(st6.text) && /3\/N\/PE AC 400\/230 V 50 Hz TN-S/.test(st6.text) && /InA 40 A/.test(st6.text) && st6.vejde && st6.cesty === 2, st6.text);
  // přeplněný malý štítek → hláška, písmo nikdy pod 5 pt
  await stitekS({ 'stitek.styl': 'tabulka', 'stitek.vel': '70x35', 'tech.trida': '', 'vyroba.typ': 'Rozvaděč pro rodinný dům s fotovoltaikou, wallboxem a tepelným čerpadlem — typ velmi dlouhý' });
  const st7 = await stitekInfo();
  check('když se údaje nevejdou ani při 5 pt: hláška „zvolte větší štítek", písmo nejde pod 5 pt', /zvolte větší štítek/.test(st7.info) &&
    st7.bunky.every(b => b.vpt >= 4.95 && (!b.l || b.lpt >= 4.95)), st7.info);
  // logo výrobce (profil technika, max. 400 px, vlevo od CE)
  await stitekS({ 'stitek.vel': '90x45', 'vyroba.typ': '' });
  const lg = await p.evaluate(async () => {
    await dokOtevrit(__rz.o.uid); rozvZalozkaNastavit('dok');
    const c = document.createElement('canvas'); c.width = 900; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#2B579A'; g.fillRect(0, 0, 900, 300);
    const blob = await new Promise(r => c.toBlob(r, 'image/png')), f = new File([blob], 'logo.png', { type: 'image/png' });
    await new Promise(r => rozvLogoNacist(f, r)); await __T.w(100);
    const im = new Image(); im.src = STORE.technik.logo; await new Promise(r => { im.onload = r; });
    const r = { w: im.naturalWidth, h: im.naturalHeight, png: /^data:image\/png/.test(STORE.technik.logo), nahled: !!document.querySelector('.rz-logo-nahled'),
      zatrh: !!dokForm().querySelector('[data-dk="stitek.logo"]'), zaloha: (await buildZalohaBlob().text()).indexOf(STORE.technik.logo.slice(0, 80)) !== -1 };
    return r;
  });
  check('logo: nahrané v oddílu Výroba a značení se zmenší na 400 px (PNG zůstane PNG), uloží do profilu technika a jde do zálohy',
    lg.w === 400 && lg.h === 133 && lg.png && lg.nahled && lg.zatrh && lg.zaloha, JSON.stringify(lg));
  await p.evaluate(async () => { await TD_AKCE.tdRStitek(); await __T.w(300); });
  const st8 = await stitekInfo();
  check('logo na štítku vlevo od CE, nejvýš tak vysoké jako CE; CE pořád ≥ 8 mm, všechno se vejde', st8.img === 1 && st8.logo > 1 && st8.logo <= st8.ce + 0.05 &&
    st8.ce >= 8 - 0.05 && st8.bunky.every(b => b.ok), (st8.logo || 0).toFixed(1) + ' / ' + (st8.ce || 0).toFixed(1));
  await stitekS({ 'stitek.logo': false });
  const st9 = await stitekInfo();
  await p.evaluate(async () => { await dokOtevrit(__rz.o.uid); rozvZalozkaNastavit('dok'); TD_AKCE.tdRLogoSmazat(); });
  const lg2 = await p.evaluate(() => ({ logo: !!STORE.technik.logo, tl: !!document.querySelector('[data-action="tdRLogoVybrat"]') }));
  check('logo jde vypnout zaškrtávátkem i odebrat z profilu (tlačítko „Nahrát logo" zůstane)', st9.img === 0 && !lg2.logo && lg2.tl, JSON.stringify(lg2));
  await p.evaluate(async () => {
    await dokOtevrit(__rz.o.uid); rozvZalozkaNastavit('dok');
    __T.dk('[data-dk="stitek.vel"]', '90x45'); __T.dk('[data-dk="stitek.kusu"]', '1'); __T.dk('[data-dk="tech.trida"]', '');
    const l = dokForm().querySelector('[data-dk="stitek.logo"]'); if (l) { l.checked = true; l.dispatchEvent(new Event('change', { bubbles: true })); }
    await dokUlozitOtevreny();
  });

  // ── 4a. popisky pod přístroje ─────────────────────────────────────────
  const popisky = () => p.evaluate(async () => {
    await TD_AKCE.tdRPopisky(); await __T.w(300);
    const MMx = 96 / 25.4;
    return { info: document.getElementById('dok-pdf-info').textContent, stran: Array.from(document.querySelectorAll('#dok-pdf-pages .a4')).map(s => s.classList.contains('a4-landscape')),
      pasky: Array.from(document.querySelectorAll('.rz-pp-pasek')).map(x => ({ r: +x.dataset.rada, c: +x.dataset.cast, w: x.getBoundingClientRect().width / MMx,
        bunky: Array.from(x.children).map(c => ({ w: c.getBoundingClientRect().width / MMx, t: c.innerText.replace(/\s+/g, ' ').trim(), prazdne: c.classList.contains('rz-pp-prazdne'),
          prekryv: c.classList.contains('rz-pp-prekryv'), ok: c.scrollHeight <= c.clientHeight + 0.5 && c.scrollWidth <= c.clientWidth + 0.5 })), h: x.getBoundingClientRect().height / MMx })),
      dal: document.querySelectorAll('.rz-pp-dal').length, orez: document.querySelectorAll('#dok-pdf-pages .rz-orez').length,
      pokyn: (document.querySelector('.rz-popisky-list .rz-st-pokyn') || {}).innerText || '', nazev: dokPdfNazev() };
  });
  await p.evaluate(async () => {
    await dokOtevrit(__rz.o.uid); rozvZalozkaNastavit('dok');
    __rz.rady[1].prvky[3].vyvod = 'Obývací pokoj – zásuvky u televize, internetový router, satelitní přijímač a herní konzole'; await dokUlozitOtevreny();
  });
  const pp = await popisky();
  const r2 = pp.pasky.find(x => x.r === 1) || { bunky: [] }, dlouhy = r2.bunky[3] || {};
  check('popisky: tlačítko „🏷 Tisk popisků přístrojů" — náhled na šířku, ořezové značky, pokyn ke skutečné velikosti s úsečkou 50 mm',
    pp.stran.length === 1 && pp.stran[0] && pp.orez === 8 * pp.pasky.length && /skutečné velikosti \(100 %\)/.test(pp.pokyn) && /50 mm/.test(pp.pokyn) &&
    /popisky\.pdf$/.test(pp.nazev), pp.info);
  check('pro každou řadu jeden pásek široký přesně moduly × 17,5 mm (3 × 210 mm), výška 12 mm', pp.pasky.length === 3 && pp.pasky.every(x => Math.abs(x.w - 210) <= 0.2 && Math.abs(x.h - 12) <= 0.2),
    pp.pasky.map(x => x.w.toFixed(2) + '×' + x.h.toFixed(1)).join(' '));
  check('políčko přístroje má šířku přístroje, nahoře označení, pod ním vývod a hodnota (B16, 40A/30mA); rezerva prázdná',
    Math.abs(r2.bunky[0].w - 4 * 17.5) <= 0.2 && r2.bunky[0].t === '-FI1 40A/30mA' && /^-FA3 /.test(r2.bunky[2].t) && / B10$/.test(r2.bunky[2].t) &&
    pp.pasky[0].bunky.some(b => b.prazdne && !b.t), r2.bunky.slice(0, 3).map(b => b.t).join(' | '));
  check('dlouhý název vývodu se zalomí a zmenší (případně zkrátí „…"), nikdy nepřeteče', pp.pasky.every(x => x.bunky.every(b => b.ok)) && /^-FA4 Obývací pokoj.*… B16$/.test(dlouhy.t) && dlouhy.ok, dlouhy.t);
  await p.evaluate(async () => { await dokOtevrit(__rz.o.uid); rozvZalozkaNastavit('dok'); __T.dk('[data-dk="popisky.vyska"]', '9'); await dokUlozitOtevreny(); });
  const pp9 = await popisky();
  check('výška pásku 9 mm (volba 9 / 12 / 15), obsah se pořád vejde', pp9.pasky.every(x => Math.abs(x.h - 9) <= 0.2 && x.bunky.every(b => b.ok)), pp9.pasky.map(x => x.h.toFixed(1)).join(' '));
  await p.evaluate(async () => { await dokOtevrit(__rz.o.uid); rozvZalozkaNastavit('dok'); __T.dk('[data-dk="popisky.vyska"]', '12'); __rz.rady[1].prvky[3].vyvod = 'Zásuvky – obývací pokoj'; await dokUlozitOtevreny(); });
  // dlouhá řada (6 × 24) — rozdělí se s překryvem
  const ppd = await p.evaluate(async () => {
    const puvodni = __rz.o.uid;
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-6x24-ocel'));
    rozvVlozit('v-fi-4-40-30-A', 0, 0); for (let i = 0; i < 18; i++) rozvVlozit('v-fa-1-B16', 0, __rz.rady[0].prvky.length);
    rozvVlozit('v-fa-1-B16', 1, 0);
    await dokUlozitOtevreny(); rozvZalozkaNastavit('dok');
    window.__ppNovy = __rz.o.uid; window.__ppPuvodni = puvodni;
  }).then(popisky);
  const r0 = ppd.pasky.filter(x => x.r === 0), r1 = ppd.pasky.filter(x => x.r === 1);
  check('pásek delší než list (24 M = 420 mm) se rozdělí s překryvem jednoho políčka a značkou „pokračuje"', r0.length === 2 && r0.every(x => x.w <= 297 - 24) &&
    Math.abs(r0[0].w + r0[1].w - 420 - r0[1].bunky[0].w) <= 0.3 && r0[1].bunky[0].prekryv && !r0[0].bunky.some(b => b.prekryv) && ppd.dal === 2,
    r0.map(x => x.w.toFixed(1)).join(' + ') + ' · pokračuje ' + ppd.dal);
  check('volné místo v řadě = prázdná políčka po modulech (řada 2: 1 jistič + 23 modulů volna)', r1.length === 2 &&
    r1[0].bunky.filter(b => b.prazdne).length + r1[1].bunky.filter(b => b.prazdne && !b.prekryv).length === 23 && /^-FA19 /.test(r1[0].bunky[0].t), r1.map(x => x.bunky.length).join('+'));
  await p.evaluate(async () => { DOK.dokumenty = DOK.dokumenty.filter(x => x.uid !== window.__ppNovy); await dokZapsat(); await dokOtevrit(window.__ppPuvodni); rozvZalozkaNastavit('dok'); });
  // popisky i v PDF dokumentace, když jsou zaškrtnuté
  const ppPdf = await p.evaluate(async () => {
    const c = dokForm().querySelector('[data-dk="dokVyber.popisky"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true }));
    ['tech', 'prohl', 'ko'].forEach(k => { const e = dokForm().querySelector('[data-dk="dokVyber.' + k + '"]'); e.checked = false; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await TD_AKCE.tdRDokPdf(); await __T.w(400);
    const r = { stran: document.querySelectorAll('#dok-pdf-pages .a4').length, pasky: document.querySelectorAll('#dok-pdf-pages .rz-pp-pasek').length, info: document.getElementById('dok-pdf-info').textContent };
    await dokOtevrit(__rz.o.uid); rozvZalozkaNastavit('dok');
    ['tech', 'prohl', 'ko'].forEach(k => { const e = dokForm().querySelector('[data-dk="dokVyber.' + k + '"]'); e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); });
    c.checked = false; const c2 = dokForm().querySelector('[data-dk="dokVyber.popisky"]'); c2.checked = false; c2.dispatchEvent(new Event('change', { bubbles: true }));
    await dokUlozitOtevreny();
    return r;
  });
  check('zaškrtnuté „popisky pod přístroje" jdou i do PDF dokumentace (za čelní pohled)', ppPdf.pasky === 3 && ppPdf.stran >= 2 && /popisky pod přístroje \(1 list\)/.test(ppPdf.info), JSON.stringify(ppPdf));

  // ── 4b. přístroje různých výrobců (jen informace) ─────────────────────
  const mix = await p.evaluate(async () => {
    await dokOtevrit(__rz.o.uid); rozvZalozkaNastavit('navrh');
    const r = { bez: !!document.querySelector('#rz-vlastnosti .rp-mix') };
    const pr = __rz.rady[1].prvky;
    pr[1].p.vyrobce = 'Výrobce A'; pr[2].p.vyrobce = 'Výrobce A'; pr[3].p.vyrobce = 'Výrobce B';
    __rz.vyber = null; __rz.vic = null; rozvVlastnostiVykreslit();
    const m = document.querySelector('#rz-vlastnosti .rp-mix');
    r.text = m ? m.innerText.replace(/\s+/g, ' ') : '';
    m.querySelector('[data-v="Výrobce A"]').click(); await __T.w(100);
    r.vybrano = rozvVybrane().map(u => rozvNajit(u).x.uid).join(',') === [pr[1].uid, pr[2].uid].join(',');
    r.zvyrazneno = document.querySelectorAll('#rz-pohled .rz-svg [data-puid] rect[stroke="#2B579A"]').length;
    TD_AKCE.tdRVyberZrusit();
    await dokUlozitOtevreny();
    rozvZalozkaNastavit('dok');
    ['tech', 'prohl', 'ko'].forEach(k => { const e = dokForm().querySelector('[data-dk="dokVyber.' + k + '"]'); e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await TD_AKCE.tdRDokPdf(); await __T.w(400);
    r.pdf = /výrobců/.test(document.getElementById('dok-pdf-pages').innerText);
    await dokOtevrit(__rz.o.uid);
    const pr2 = __rz.rady[1].prvky; [1, 2, 3].forEach(i => { pr2[i].p.vyrobce = 'obecný'; }); await dokUlozitOtevreny();
    return r;
  });
  check('mix výrobců: obecné se nepočítají, u různých výrobců jeden nenápadný řádek „Přístroje 2 výrobců: Výrobce A (2), Výrobce B (1)"', !mix.bez &&
    /^Přístroje 2 výrobců: Výrobce A \(2\), Výrobce B \(1\)/.test(mix.text), mix.text);
  check('klepnutí na výrobce jeho přístroje v pohledu vybere (zvýrazní); do PDF nic nejde', mix.vybrano && mix.zvyrazneno === 2 && !mix.pdf, JSON.stringify(mix));
  await p.evaluate(async () => { await dokOtevrit(__rz.o.uid); rozvZalozkaNastavit('dok'); });


  // ── 5. prohlášení o shodě ─────────────────────────────────────────────
  const pdfJen = (co) => p.evaluate(async co => {
    await dokOtevrit(__rz.o.uid); rozvZalozkaNastavit('dok');
    ['cp', 'schema', 'tech', 'prohl', 'ko'].forEach(k => { const c = dokForm().querySelector('[data-dk="dokVyber.' + k + '"]'); c.checked = co.indexOf(k) !== -1; c.dispatchEvent(new Event('change', { bubbles: true })); });
    await TD_AKCE.tdRDokPdf(); await __T.w(400);
    const st = Array.from(document.querySelectorAll('#dok-pdf-pages .a4'));
    return { pocet: st.length, nasirku: st.map(s => s.classList.contains('a4-landscape')), text: st.map(s => s.innerText).join('\n'),
      zahlavi: st.map(s => s.querySelector('.dok-pdf-zahlavi').innerText.replace(/\s+/g, ' ')), prvni: st.map(s => { const o = s.querySelector('.dok-pdf-obsah').firstElementChild; return o ? o.innerText.slice(0, 40) : ''; }) };
  }, co);
  const ps = await pdfJen(['prohl']);
  const BODY = ['1. Model výrobku/výrobek (číslo dávky, výrobku či typu nebo sériové číslo):', '2. Jméno a adresa výrobce:',
    '3. Toto prohlášení o shodě se vydává na výhradní odpovědnost výrobce.', '4. Předmět prohlášení:',
    '5. Výše popsaný předmět prohlášení je ve shodě s příslušnými harmonizačními právními předpisy Evropské unie:',
    '6. Použité harmonizované normy a jiné technické specifikace:', '7. Další informace:'];
  check('prohlášení: na výšku, nadpis „EU PROHLÁŠENÍ O SHODĚ č. PS-' + ROK + '-0001", záhlaví výrobce a výrobní číslo', ps.pocet === 1 && !ps.nasirku[0] &&
    ps.text.indexOf('EU PROHLÁŠENÍ O SHODĚ č. PS-' + ROK + '-0001') !== -1 && /Vymyšlená elektro s\.r\.o\. Výrobní číslo: \d{4}-0001/.test(ps.zahlavi[0]), ps.zahlavi[0]);
  check('prohlášení: všech 7 bodů doslova a v pořadí', BODY.every((b, i) => ps.text.indexOf(b) !== -1 && (i === 0 || ps.text.indexOf(b) > ps.text.indexOf(BODY[i - 1]))),
    BODY.filter(b => ps.text.indexOf(b) === -1).join(' | '));
  check('prohlášení: model, výrobce s IČO, předmět z údajů rozvaděče', ps.text.indexOf('Rozvaděč nn RH1 DBO 3×12 M, výrobní číslo ' + ROK + '-0001') !== -1 &&
    /Vymyšlená elektro s\.r\.o\., Polní 1, 697 01 Kyjov, IČO 12345678/.test(ps.text) &&
    /Rozvodnice pro obsluhu laiky \(DBO\) dle ČSN EN IEC 61439-3, 400\/230 V 50 Hz, 3\/N\/PE AC TN-S, InA 40 A, IP40 \/ IP20, rok výroby \d{4}, zakázka Byt 3\+1, Vymyšlená 12, místo určení Předsíň\./.test(ps.text), '');
  check('prohlášení bod 5 a 6: NV 118/2016 a 117/2016, normy ed. 3 a ed. 2 — bez RoHS', /– nařízení vlády č\. 118\/2016 Sb\. \(směrnice 2014\/35\/EU\)/.test(ps.text) &&
    /– nařízení vlády č\. 117\/2016 Sb\. \(směrnice 2014\/30\/EU\)/.test(ps.text) && /– ČSN EN IEC 61439-1 ed\. 3 \(EN IEC 61439-1:2021\)/.test(ps.text) &&
    /– ČSN EN IEC 61439-3 ed\. 2 \(EN IEC 61439-3:2024\)/.test(ps.text) && !/481\/2012/.test(ps.text) && !/63000/.test(ps.text), '');
  check('prohlášení bod 7: odkaz na protokol o kusovém ověření; podpisový blok', new RegExp('kusové ověření dle čl\\. 11 – protokol č\\. KO-' + ROK + '-0001 ze dne').test(ps.text) &&
    /Podepsáno za a jménem: Vymyšlená elektro s\.r\.o\./.test(ps.text) && /Místo, datum vydání\s*Kyjov/.test(ps.text) && /Petr Vymyšlený/.test(ps.text), '');
  check('do PDF nejde štítek „čeká na ověření v ČSN"', !/čeká na ověření/.test(ps.text));
  await p.screenshot({ path: BEH + '/rz-dok-prohlaseni.png' });
  await p.evaluate(async () => { await dokOtevrit(__rz.o.uid); rozvZalozkaNastavit('dok'); const c = dokForm().querySelector('[data-dk="rohs"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); await dokUlozitOtevreny(); });
  const ps2 = await pdfJen(['prohl']);
  check('s RoHS: NV č. 481/2012 Sb. a ČSN EN IEC 63000', /– nařízení vlády č\. 481\/2012 Sb\. \(směrnice 2011\/65\/EU ve znění směrnice \(EU\) 2015\/863\)/.test(ps2.text) && /– ČSN EN IEC 63000/.test(ps2.text), '');
  await p.evaluate(async () => { await dokOtevrit(__rz.o.uid); rozvZalozkaNastavit('dok'); const c = dokForm().querySelector('[data-dk="rohs"]'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); await dokUlozitOtevreny(); });

  // ── 6. protokol o kusovém ověření ─────────────────────────────────────
  await p.evaluate(async () => { await dokOtevrit(__rz.o.uid); rozvZalozkaNastavit('dok'); document.querySelector('[data-oddil="ko"]').open = true; });
  const ko = await p.evaluate(() => {
    const tr = Array.from(document.querySelectorAll('.rz-ko-tab tr[data-cl]'));
    const met = document.querySelector('.rz-ko-metoda');
    return { radky: tr.map(r => r.getAttribute('data-cl') + ':' + r.getAttribute('data-zp')).join(','), nazvy: tr.map(r => r.children[1].childNodes[0].textContent.trim()).join('|'),
      vysl: tr.map(r => r.querySelector('select').value).join(','), metody: Array.from(met.options).map(o => o.value).join(','),
      au: document.querySelector('[data-dk="ko.a.u"]').value, auPh: document.querySelector('[data-dk="ko.a.u"]').placeholder, at: document.querySelector('[data-dk="ko.a.t"]').value,
      iso: ['l1', 'l2', 'l3', 'n'].map(k => document.querySelector('[data-dk="ko.b.' + k + '"]').value).join(''),
      ceka: Array.from(document.querySelectorAll('#rz-pan-dok .rz-ceka')).map(c => c.closest('label, td, th, div').textContent.replace(/čeká na ověření v ČSN/, '').trim()) };
  });
  check('protokol: 9 položek čl. 11.2–11.10 se způsobem S / S/P / P podle podkladu', ko.radky === '11.2:S,11.3:S/P,11.4:S/P,11.5:S,11.6:S/P,11.7:S,11.8:P,11.9:P,11.10:P' &&
    ko.nazvy === 'Stupeň krytí krytu|Vzdušné vzdálenosti a povrchové cesty|Ochrana před úrazem el. proudem a celistvost ochranných obvodů|Zabudování spínacích přístrojů a komponent|Vnitřní elektrické obvody a spoje|Svorky pro vnější vodiče|Mechanická funkce|Dielektrické vlastnosti|Zapojení, provozní vlastnosti a funkce', ko.radky);
  check('výsledky prázdné, zkušební napětí nepředvyplněné (nápověda tab. 8), doba 1 s, izolační odpory prázdné', ko.vysl === ',,,,,,,,' && ko.au === '' && /tab\. 8/.test(ko.auPh) &&
    ko.at === '1' && ko.iso === '', JSON.stringify(ko).slice(0, 200));
  check('metoda B (izolační odpor) nabídnuta — hlavní vypínač 40 A, Un 400 V', ko.metody === ',A,B', ko.metody);
  await p.click('[data-action="tdRKoS"]'); await w(150);
  const koS = await p.evaluate(() => Array.from(document.querySelectorAll('.rz-ko-tab tr[data-cl]')).map(r => r.querySelector('select').value || '-').join(','));
  check('„Všechny prohlídky (S) vyhovují" vyplní jen 11.2, 11.5 a 11.7 (zkoušky P ani S/P ne)', koS === 'vyhovuje,-,-,vyhovuje,-,vyhovuje,-,-,-', koS);
  await p.selectOption('.rz-ko-metoda', 'B'); await w(100);
  await p.fill('[data-dk="ko.b.l1"]', '0,5'); await p.fill('[data-dk="ko.b.l2"]', '>200'); await p.fill('[data-dk="ko.b.l3"]', '1'); await w(100);
  const iso = await p.evaluate(() => ['l1', 'l2', 'l3', 'n'].map(k => { const i = document.querySelector('[data-dk="ko.b.' + k + '"]');
    return (i.classList.contains('rz-iso-ok') ? 'ok' : i.classList.contains('rz-iso-chyba') ? 'chyba' : '-') + ':' + i.parentNode.querySelector('.rz-iso-stav').textContent; }).join('|'));
  const bVid = await p.evaluate(() => ({ b: !document.querySelector('.rz-ko-met[data-met="B"]').hidden, a: !document.querySelector('.rz-ko-met[data-met="A"]').hidden }));
  check('metoda B: hodnoty se jen porovnají s ≥ 1 MΩ a obarví (0,5 nevyhovuje, >200 a 1 vyhovuje, prázdné nic)', iso === 'chyba:✗ nevyhovuje|ok:✓ vyhovuje|ok:✓ vyhovuje|-:' && bVid.b && !bVid.a, iso);
  await p.selectOption('.rz-ko-pridat', '0'); await w(100);
  await p.fill('[data-dk="ko.zkousel.datum"]', '2026-10-20'); await w(50);
  await p.evaluate(() => dokUlozitOtevreny());
  const b630 = await p.evaluate(async () => {
    const qm = __rz.rady[0].prvky[0]; const pred = qm.p.In; qm.p.In = 800;
    rozvZalozkaNastavit('dok'); document.querySelector('[data-oddil="ko"]').open = true;
    const r = { metody: Array.from(document.querySelector('.rz-ko-metoda').options).map(o => o.value).join(','), pozn: document.querySelector('.rz-ko-bpozn').textContent,
      upoz: !!document.querySelector('.rz-ko-met[data-met="B"] .rp-upoz') };
    qm.p.In = pred; rozvZalozkaNastavit('dok'); return r;
  });
  check('přívodní přístroj nad 630 A: metodu B program sám nenabídne (už zvolená zůstane s varováním)', /do 630 A a Un do 500 V/.test(b630.pozn) && /800 A/.test(b630.pozn) && b630.upoz, JSON.stringify(b630));
  const b630b = await p.evaluate(async () => { const u = await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-1x12-n')); rozvVlozit('v-qm-3-100', 0, 0); __rz.rady[0].prvky[0].p.In = 800;
    rozvZalozkaNastavit('dok'); const r = Array.from(document.querySelector('.rz-ko-metoda').options).map(o => o.value).join(','); return r; });
  check('… a u nového rozvaděče s přívodním přístrojem 800 A je v nabídce jen metoda A', b630b === ',A', b630b);
  await p.evaluate(async uid => { window.__dokOtevreny = null; await dokOtevrit(uid); rozvZalozkaNastavit('dok'); }, prvniUid); await w(150);
  const kp = await pdfJen(['ko']);
  check('protokol v PDF: na výšku, hlavička (výrobce, zákazník, typ, výr. č., normy, Un, fn, InA, Icc, IP, druh sítě)', !kp.nasirku[0] &&
    kp.text.indexOf('PROTOKOL O KUSOVÉM OVĚŘENÍ č. KO-' + ROK + '-0001') !== -1 && /Jan Smyšlený/.test(kp.text) && /ČSN EN IEC 61439-1 ed\. 3, ČSN EN IEC 61439-3 ed\. 2/.test(kp.text) &&
    /400\/230 V \/ 50 Hz/.test(kp.text) && /3\/N\/PE AC TN-S/.test(kp.text) && /IP40 \/ IP20/.test(kp.text), kp.zahlavi[0]);
  check('protokol v PDF: výsledky jen vyplněné (S), měření izolačního odporu jen zadané hodnoty, měřicí přístroj, podpisy',
    /11\.2\s+Stupeň krytí krytu\s+S\s+vyhovuje/.test(kp.text) && /11\.8\s+Mechanická funkce\s+P\s*\n/.test(kp.text) &&
    /L1–PE 0,5 MΩ, L2–PE >200 MΩ, L3–PE 1 MΩ, N–PE …… \(kritérium ≥ 1 MΩ\)/.test(kp.text) && /Vymyšlený tester VT-1, výr\. č\. VV-123/.test(kp.text) &&
    /Zapojení provedl/.test(kp.text) && /Zkoušku provedl \(zkušební technik\)\s+Petr Vymyšlený/.test(kp.text) && /S = prohlídka, P = zkouška/.test(kp.text), '');
  check('štítky „čeká na ověření v ČSN" ve formuláři (RoHS, třída II, IP, IK, umístění, znečištění, rozměry, 11.4, tab. 8, kvalifikace), v PDF ne',
    ko.ceka.length >= 9 && !/čeká na ověření/.test(kp.text), ko.ceka.join(' | '));
  await p.screenshot({ path: BEH + '/rz-dok-protokol.png' });

  // ── 7. technické údaje a celé PDF ─────────────────────────────────────
  const tu = await pdfJen(['tech']);
  check('technické údaje: na výšku, vyplněné hodnoty, prázdné řádky se netisknou', !tu.nasirku[0] && /Technické údaje rozvaděče/i.test(tu.text) &&
    /Jmenovité napětí Un\s+400\/230 V/.test(tu.text) && /Jmenovitý proud rozvaděče InA\s+40 A/.test(tu.text) && /Zkratová odolnost Icc\s+10 kA/.test(tu.text) &&
    /IP40 \(dveře zavřené\), IP20 \(dveře otevřené\)/.test(tu.text) && !/Hmotnost/.test(tu.text) && !/Stupeň znečištění/.test(tu.text) && !/RDF/.test(tu.text), '');
  const vse = await pdfJen(['cp', 'tech', 'prohl', 'ko']);
  const iPs = vse.prvni.findIndex(x => /EU PROHLÁŠENÍ/.test(x)), iKo = vse.prvni.findIndex(x => /PROTOKOL O KUSOVÉM/.test(x)), iTu = vse.prvni.findIndex(x => /Technické údaje/i.test(x));
  check('celé PDF: čelní pohled a seznam na šířku, technické údaje, prohlášení a protokol každý od nové strany na výšku', vse.nasirku[0] && iTu > 0 && iPs > iTu && iKo > iPs &&
    !vse.nasirku[iTu] && !vse.nasirku[iPs] && !vse.nasirku[iKo] && /Strana 1 \/ \d+/.test(vse.text), vse.nasirku.join(',') + ' ' + [iTu, iPs, iKo].join(','));
  await p.evaluate(() => TD_AKCE.tdPdfZpet());

  // ── 8. starý rozvaděč bez nových polí ─────────────────────────────────
  const stary = await p.evaluate(async () => {
    const d = dokKopie(__rz.o.data);
    ['rezim', 'rohs', 'dokVyber', 'vyroba', 'tech', 'stitek', 'prohl', 'ko'].forEach(k => delete d[k]);
    const z = { uid: 'stary-rz', typ: 'rozv', cislo: 'ROZ-0090', vytvoreno: '2026-10-18T10:00:00.000Z', upraveno: '2026-10-18T10:00:00.000Z', data: d };
    await dokNacist(); DOK.dokumenty.push(dokKopie(z)); await dokZapsat();
    const pred = JSON.stringify(dokNajit('stary-rz'));
    await dokOtevrit('stary-rz'); rozvZalozkaNastavit('dok'); await __T.w(100); rozvZalozkaNastavit('navrh'); await __T.w(100);
    await dokOtevritSeznam('rozv'); await __T.w(100); await dokNacist();
    const po = JSON.stringify(dokNajit('stary-rz'));
    await dokNahledZeSeznamu('stary-rz'); await __T.w(300);
    const n = document.querySelectorAll('#dok-pdf-pages .a4').length;
    DOK.dokumenty = DOK.dokumenty.filter(x => x.uid !== 'stary-rz'); await dokZapsat();
    return { stejne: pred === po, n };
  });
  check('starý rozvaděč bez nových polí: otevření i přepnutí záložek ho nezmění, PDF se vytvoří', stary.stejne && stary.n >= 3, JSON.stringify(stary));
  const v120 = await p.evaluate(async () => {
    const d = dokKopie(__rz.o.data);
    delete d.popisky; d.stitek = { vel: '90x45', kusu: '1', rozsirena: true, tridaII: false };
    d.dokVyber = { cp: true, tech: true, prohl: true, ko: true };
    const z = { uid: 'v120-rz', typ: 'rozv', cislo: 'ROZ-0091', vytvoreno: '2026-10-20T10:00:00.000Z', upraveno: '2026-10-20T10:00:00.000Z', data: d };
    await dokNacist(); DOK.dokumenty.push(dokKopie(z)); await dokZapsat();
    const pred = JSON.stringify(dokNajit('v120-rz'));
    await dokOtevrit('v120-rz'); rozvZalozkaNastavit('dok'); await __T.w(100);
    const r = { popisky: dokForm().querySelector('[data-dk="dokVyber.popisky"]').checked, styl: dokForm().querySelector('[data-dk="stitek.styl"]').value };
    rozvZalozkaNastavit('navrh'); await __T.w(100);
    await dokOtevritSeznam('rozv'); await __T.w(100); await dokNacist();
    r.stejne = pred === JSON.stringify(dokNajit('v120-rz'));
    await dokOtevrit('v120-rz'); await TD_AKCE.tdRStitek(); await __T.w(300);
    r.tab = !!document.querySelector('#dok-pdf-pages .rz-st-tab');
    await dokNacist();   // tisk štítku formulář uloží — původní hodnoty musí zůstat (nová pole jen přibudou)
    const po = dokNajit('v120-rz').data, puv = JSON.parse(pred).data;
    const podmnozina = (a, b) => a === b || (a && b && typeof a === 'object' && typeof b === 'object' && Object.keys(a).every(k => podmnozina(a[k], b[k])));
    r.stejne2 = ['rady', 'skrin', 'stitek', 'dokVyber', 'tech', 'oznaceni', 'vyrobce'].every(k => podmnozina(puv[k], po[k]));
    DOK.dokumenty = DOK.dokumenty.filter(x => x.uid !== 'v120-rz'); await dokZapsat();
    await dokOtevrit(__rz.o.uid === 'v120-rz' ? DOK.dokumenty.find(x => x.typ === 'rozv').uid : __rz.o.uid);
    return r;
  });
  check('rozvaděč z v1.20 (štítek bez rozvržení, výběr bez popisků): načte se beze změny dat, tisk štítku nic nepřepíše, štítek jako tabulka, popisky nezaškrtnuté',
    v120.stejne && v120.stejne2 && v120.tab && !v120.popisky && v120.styl === 'tabulka', JSON.stringify(v120));

  // ── 9. polozapuštěná skříň ────────────────────────────────────────────
  const polo = await p.evaluate(() => {
    const v = rozvValidovat({ druh: 'skrin', rady: '2', modulu: '12', provedeni: 'polozapustena' }), v2 = rozvValidovat({ druh: 'skrin', rady: '2', modulu: '12', provedeni: 'Polozapuštěná' });
    rozvPolozkaDialog(null, 'skrin');
    const f = Array.from(document.querySelectorAll('#rz-pol-obsah [data-rp="provedeni"] option')).map(o => o.value).join(',');
    TD_AKCE.tdRPolZavrit();
    const vel = rozvVelikostHtml({}, 'x');
    return { a: v.polozka.provedeni, b: v2.polozka.provedeni, chyby: v.chyby.length, f, vel: /polozapuštěná/.test(vel) };
  });
  check('provedení „polozapuštěná": import CSV (i bez háčků), formulář vlastní skříně, vlastní velikost', polo.a === 'polozapuštěná' && polo.b === 'polozapuštěná' &&
    !polo.chyby && /zapuštěná,polozapuštěná/.test(polo.f) && polo.vel, JSON.stringify(polo));

  check('data revizí po práci s dokumenty bajtově stejná', (await otisk()) === otiskPred);
  check('bez chyb v konzoli', !err.length, err.join(' | '));

  // ── 10. telefon ───────────────────────────────────────────────────────
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await m.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const q = await m.newPage();
  const err2 = []; q.on('pageerror', e => err2.push(e.message));
  await q.goto(URL); await w(1000);
  await priprava(q);
  await q.tap('.rz-zal[data-z="dok"]'); await w(250);
  await q.evaluate(() => document.querySelectorAll('.rz-dok-oddil').forEach(d => { d.open = true; }));
  const t = await q.evaluate(() => { const e = document.querySelector('.rz-dok-generuj'), g = e.getBoundingClientRect(), zal = document.querySelector('.rz-zal').getBoundingClientRect();
    const k = e.parentNode, cs = getComputedStyle(k), vnitrni = k.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return { siroka: document.documentElement.scrollWidth <= window.innerWidth, gw: Math.round(g.width), karta: Math.round(vnitrni), zal: Math.round(zal.height) }; });
  check('telefon: Dokumenty bez vodorovného posunu stránky, hlavní akce přes celou šířku karty, záložky ≥ 44 px', t.siroka && t.gw >= t.karta - 2 && t.zal >= 44, JSON.stringify(t));
  await q.evaluate(() => window.scrollTo(0, 0));
  await q.screenshot({ path: BEH + '/rz-dok-telefon.png' });
  check('telefon: bez chyb', !err2.length, err2.join(' | '));
  await m.close();

  await b.close();
  console.log(res.join('\n'));
  const spatne = res.filter(r => r.startsWith('❌')).length;
  console.log(spatne ? 'ŠPATNĚ: ' + spatne + ' z ' + res.length : 'VŠE OK (' + res.length + ')');
  process.exit(spatne ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.error('SELHALO', e); process.exit(1); });
