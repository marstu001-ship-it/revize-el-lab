// Normy – dávka 3: konfigurátor rozvaděčů podle ČSN EN IEC 61439-1 ed. 3
// a 61439-2 ed. 3 — kusové ověření (11.4 spojitost, 11.9 tab. 8), štítek
// (čl. 6.1, třída II čl. 8.4.4), oteplení (10.10.4.1, 10.10.4.2.1), RDF PSC
// (tab. 101, motory) a příloha D (tab. D.1). Všechna data vymyšlená.
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
  await p.evaluate(() => {
    window.__N = {
      w: ms => new Promise(r => setTimeout(r, ms)),
      nast(sel, v) { const e = dokForm().querySelector(sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); },
      async dbo(oz) {
        await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
        __N.nast('[data-dk="oznaceni"]', oz); __N.nast('[data-dk="soustava"]', '3NPE ~400/230 V TN-S'); __N.nast('[data-dk="privodIn"]', '40');
      }
    };
  });

  // ── tab. 8 a 11.4 (čisté funkce) ──
  const f = await p.evaluate(() => ({
    t8: [400, 250, 690, 800, 60, 1000].map(u => rozvTab8(u).ac).join(','), dc: rozvTab8(400).dc,
    pe: [rozvPeStav('9', '0,08'), rozvPeStav('10', '0,12'), rozvPeStav('10', '0,08')].map(s => s.i + '/' + s.r).join(',')
  }));
  check('tab. 8: Ui 400 → 1 890 V, 250 → 1 500 V, 690 → 1 890 V, 800 → 2 000 V (60 → 1 000, 1 000 → 2 200)', f.t8 === '1890,1500,1890,2000,1000,2200' && f.dc === 2670, f.t8);
  check('11.4: 9 A nevyhovuje, 0,12 Ω nevyhovuje, 10 A a 0,08 Ω vyhovuje', f.pe === 'chyba/ok,ok/chyba,ok/ok', f.pe);

  // ── formulář Dokumenty DBO: 11.4 pole, Ui, třída II ──
  const fo = await p.evaluate(async () => {
    await __N.dbo('RN-T1');
    __rz.skrin.trida = 'II'; __N.nast('[data-dk="krytiZavreno"]', 'IP20'); rozvZmena('t', () => {});
    rozvZalozkaNastavit('dok'); await __N.w(200);
    const f = dokForm(), q = s => f.querySelector(s);
    const r = { pe: !!q('[data-dk="ko.pe.i"]') && !!q('[data-dk="ko.pe.r"]'), ui: q('[data-dk="ko.ui"]').value, au: q('[data-dk="ko.a.u"]').value,
      tr2: q('[data-dk="stitek.tridaII"]').checked, upoz: (q('.rz-tr2-ip') || {}).textContent || '', nazev115: Array.from(f.querySelectorAll('.rz-ko-tab tr[data-cl="11.5"] td'))[1].textContent };
    const ii = q('[data-dk="ko.pe.i"]'); ii.value = '9'; ii.dispatchEvent(new Event('input', { bubbles: true }));
    const rr = q('[data-dk="ko.pe.r"]'); rr.value = '0,08'; rr.dispatchEvent(new Event('input', { bubbles: true }));
    r.barvy = ii.className + '|' + rr.className;
    ii.value = '10'; ii.dispatchEvent(new Event('input', { bubbles: true })); r.barvy2 = ii.className;
    const ui = q('[data-dk="ko.ui"]'); ui.value = '250'; ui.dispatchEvent(new Event('input', { bubbles: true })); r.au250 = q('[data-dk="ko.a.u"]').value;
    __N.nast('[data-dk="krytiZavreno"]', 'IP2XC'); rozvZalozkaNastavit('navrh'); rozvZalozkaNastavit('dok'); await __N.w(150);
    r.upoz2 = !!dokForm().querySelector('.rz-tr2-ip');
    const d = DOK_TYPY.rozv.cist(dokForm());
    r.ulozeno = JSON.stringify({ tr: (d.stitek || {}).tridaII, ui: (d.ko || {}).ui, au: ((d.ko || {}).a || {}).u, pe: (d.ko || {}).pe });
    return r;
  });
  check('11.4: pole „měřicí proud" a „největší naměřený odpor", 9 A červeně, 0,08 Ω zeleně, 10 A zeleně', fo.pe && /rz-iso-chyba/.test(fo.barvy.split('|')[0]) && /rz-iso-ok/.test(fo.barvy.split('|')[1]) && /rz-iso-ok/.test(fo.barvy2), fo.barvy);
  check('11.9: Ui odvozené 400 V (3f) → zkušební napětí 1 890 V; Ui 250 → 1 500 V', fo.ui === '400' && fo.au === '1890' && fo.au250 === '1500', fo.ui + ' ' + fo.au + ' ' + fo.au250);
  check('11.5 „Vestavění vestavných součástí"', fo.nazev115 === 'Vestavění vestavných součástí', fo.nazev115);
  check('třída II: značka výchozí zapnutá; IP20 → upozornění IP2XC (čl. 8.4.4 c), IP2XC → bez upozornění', fo.tr2 && /IP2XC/.test(fo.upoz) && /8\.4\.4 c/.test(fo.upoz) && !fo.upoz2, fo.upoz);
  check('odvozené (Ui, zkušební napětí, značka třídy II) se neukládají; 11.4 měření ano', /"tr":""/.test(fo.ulozeno) && /"ui":"250"/.test(fo.ulozeno) && /"au":""/.test(fo.ulozeno) && /"pe":\{"i":"10","r":"0,08"\}/.test(fo.ulozeno), fo.ulozeno);

  // ── štítek: Un a fn i bez rozšířené části (čl. 6.1) ──
  const st = await p.evaluate(() => {
    const d = DOK_TYPY.rozv.cist(dokForm()); d.stitek = Object.assign({}, d.stitek, { rozsirena: false });
    const box = document.createElement('div'); box.innerHTML = rozvStitekTabulkaHtml(d, ROZV_STITKY['90x45']);
    const box2 = document.createElement('div'); box2.innerHTML = rozvStitekJednoducheHtml(d, ROZV_STITKY['90x45']);
    const d2 = Object.assign({}, d, { stitek: Object.assign({}, d.stitek, { rozsirena: true }) });
    const box3 = document.createElement('div'); box3.innerHTML = rozvStitekTabulkaHtml(d2, ROZV_STITKY['90x45']);
    return { t: box.textContent, j: box2.textContent, znak: !!box3.querySelector('svg') && box3.innerHTML.split('<svg').length - 1 };
  });
  check('štítek bez rozšířené části: Un a fn (400/230 V, 50 Hz), InA, výrobce, typ, datum, IEC 61439-3 (čl. 6.1)',
    /400\/230 V, 50 Hz/.test(st.t) && /Jmenovitý proud InA/.test(st.t) && /IEC 61439-3/.test(st.t) && /400\/230 V, 50 Hz/.test(st.j), st.t.slice(0, 160));
  check('štítek třídy II: značka třídy II (výchozí) vedle CE', st.znak >= 2, st.znak);

  // ── oteplení: starý rozvaděč s okoli55 = true, pole 60 °C → 25 K ──
  const ot = await p.evaluate(async () => {
    await __N.dbo('RN-OT');
    const d0 = DOK_TYPY.rozv.cist(dokForm()); d0.otepleni = { okoli55: true, penc: '20' };
    __dokOtevreny.data = d0; await dokUlozitOtevreny(); const uid = __dokOtevreny.uid;
    const ulozeno = x => { const z = DOK.dokumenty.filter(q => q.uid === uid)[0]; return JSON.stringify(z.data.otepleni); };
    const pred = JSON.stringify(DOK.dokumenty.filter(q => q.uid === uid)[0].data);
    window.__dokOtevreny = null; await dokOtevrit(uid); await __N.w(300);
    const po = JSON.stringify(DOK_TYPY.rozv.cist(dokForm()));
    const v = rozvOteplVypocet(DOK.dokumenty.filter(q => q.uid === uid)[0].data);
    rozvZalozkaNastavit('dok'); document.querySelector('[data-oddil="otepleni"]').open = true; await __N.w(200);
    const tm = dokForm().querySelector('[data-dk="otepleni.tmax"]'), dov = document.getElementById('rot-dovolene').textContent;
    const otPo = JSON.stringify((DOK_TYPY.rozv.cist(dokForm()).otepleni));
    tm.value = '60'; tm.dispatchEvent(new Event('input', { bubbles: true })); await __N.w(150);
    const v60 = rozvOteplVypocet(DOK_TYPY.rozv.cist(dokForm()));
    const cer = rozvOteplVypocet({ rezim: 'DBO', rady: [], otepleni: { penc: '20' } });
    return { shoda: pred === po, otPred: ulozeno(), otPo, tmax: v.tmax, potv: v.tmaxPotvrzeno, dov: v.dovolene, tmVal: tm.getAttribute('value'), dovText: dov,
      d60: v60.dovolene, t60: v60.tmax, cerVych: cer.tmaxVychozi, cerChybi: cer.chybi.join(', ') };
  });
  check('starý rozvaděč „okoli55: true": otevření bajtově beze změny dat; po Dokumentech zůstane okoli55 a nové klíče (tmax, okoli, vodice125) nepřibudou',
    ot.shoda && /"okoli55":true/.test(ot.otPo) && !/"tmax"|"okoli"|"vodice125"/.test(ot.otPo), ot.otPred + ' → ' + ot.otPo);
  check('starý rozvaděč „okoli55: true" počítá s 55 °C (potvrzeno), dovolené oteplení 55 − 35 = 20 K', ot.tmax === 55 && ot.potv && ot.dov === 20 && ot.tmVal === '55' && /55 − 35 = 20 K/.test(ot.dovText), ot.dovText);
  check('pole 60 °C → dovolené oteplení 25 K', ot.t60 === 60 && ot.d60 === 25, ot.d60);
  check('bez hodnoty: výchozí 55 °C „ověřte u výrobce", výsledek neúplný', ot.cerVych && /maximální provozní teplota/.test(ot.cerChybi), ot.cerChybi);

  // ── PSC: RDF tab. 101, motorový vývod 0,8 ──
  const ps = await p.evaluate(async () => {
    await dokNovy('psc'); __N.nast('[data-dk="soustava"]', '3NPE ~400/230 V TN-S'); __N.nast('[data-dk="privodIn"]', '160');
    rozvSkrinNastavit(rozvKnihPolozka('v-pole-600'));
    const din = pscGeo(__rz).rady.filter(g => !g.deska)[0].i;
    const v = k => rozvVlozit(k, din, __rz.rady[din].prvky.length);
    const a = v('v-fa-3-B16'), b2 = v('v-fa-3-B16'), c = v('v-fa-3-B16'), m = v('v-fa-3-B16');
    [a, b2, c, m].forEach(x => { x.ib = '10'; x.faze = '3f'; });
    m.spotr = 'motor'; m.vyvod = 'Čerpadlo'; rozvZmena('t', () => {});
    const d = DOK_TYPY.rozv.cist(dokForm()); d.otepleni = { rdfRezim: 'tabulka' };
    const r = rozvOteplVypocet(d), eff = uid => (r.radky.filter(q => q.x.uid === uid)[0] || {}).eff;
    const big = Object.assign({}, d); big.rady = dokKopie(d.rady); rfVse(big.rady).filter(x => x.uid === m.uid)[0].pi = '120';
    const r2 = rozvOteplVypocet(big);
    return { k: r.rdf.k, n: r.rdf.n, txt: r.rdf.text, effA: eff(a.uid), effM: eff(m.uid), effM2: (r2.radky.filter(q => q.x.uid === m.uid)[0] || {}).eff };
  });
  check('PSC tab. 101: 3 hlavní obvody → 0,9 (10 A → 9 A); motorový vývod 0,8 (10 A → 8 A), nad 100 kW 1,0',
    ps.k === 0.9 && ps.n === 3 && Math.abs(ps.effA - 9) < 1e-9 && Math.abs(ps.effM - 8) < 1e-9 && Math.abs(ps.effM2 - 10) < 1e-9 && /tab\. 101/.test(ps.txt) && /motorové vývody 0,8/.test(ps.txt), JSON.stringify(ps));

  // ── příloha D: 12 skupin ──
  const D1 = await p.evaluate(async () => {
    rozvZalozkaNastavit('dok'); await __N.w(200);
    const tb = document.getElementById('rz-ov-tbody');
    const sk = pscOvPolozky().filter(q => q.c).map(q => q.c);
    const pdf = pscPdfOvereni(DOK_TYPY.rozv.cist(dokForm()), rozvDokEff(DOK_TYPY.rozv.cist(dokForm()))).map(x => x.html).join('');
    const z54 = Array.from(tb.querySelector('tr[data-ov="ko11_4"] select').options).map(o => o.value).join(',');
    return { sk: sk.join(','), radky: tb.querySelectorAll('tr[data-ov]').length, ceka: !!document.querySelector('.rz-ov-tab .rz-ceka'), pdf: /příloha D, tab\. D\.1/.test(pdf) && /12\. Elektromagnetická kompatibilita/.test(pdf), z54,
      pozn: /příloha D, tab\. D\.1/.test(document.querySelector('[data-oddil="overeni"]').textContent) };
  });
  check('příloha D: 12 skupin tab. D.1 (1–12), položky s články, bez štítku „čeká"', D1.sk === '1,2,3,4,5,6,7,8,9,10,11,12' && D1.radky === 24 && !D1.ceka && D1.pozn && D1.pdf, D1.sk + ' / ' + D1.radky);
  check('příloha D: u spojitosti ochranného obvodu (10.5.2, jen Z) nabídka jen zkouška a dokumentace', D1.z54 === ',dokumentace,zkouska', D1.z54);

  check('bez chyb stránky', !err.length, err.join(' | '));
  console.log(res.join('\n'));
  await b.close();
  process.exit(res.some(x => x.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.error('CRASH:', e.message); process.exit(2); });
