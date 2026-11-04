// Normy – soudobost podle ČSN 33 2130 ed. 4 (kontrola dávka 2): β(n) bytů
// z tab. B.1 a Ruscova vzorce, Pb podle charakteru odběru T1–T6, cos φ 0,9,
// zdroje β skupin, starší rozvaděč se „stupněm B" beze změny dat.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901;
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));
async function stranka(b) {
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(900);
  return { p, err };
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const { p, err } = await stranka(b);
  const r = await p.evaluate(() => {
    try { localStorage.removeItem(RZS_KLIC); } catch (e) {}
    const B = n => rzsBytyBeta(n, {}).b;
    const o = { b10: B(10), b29: B(29), b30: B(30), b40: B(40), b50: B(50), b60: B(60), b80: B(80), b100: B(100), b37: B(37),
      z30: rzsBytyBeta(30, {}).zdroj, z37: rzsBytyBeta(37, {}).zdroj, o30: rzsBytyBeta(30, {}).overit,
      inf015_10: rzsBytyBeta(10, { byty: { inf: 0.15 } }).b, inf02_10: rzsBytyBeta(10, { byty: { inf: 0.2 } }).b,
      cos: RZS_COS, kuch: rzsBetaVychozi('kuchyne', {}), ev: rzsBetaVychozi('ev', {}) };
    // Pb podle charakteru odběru (n = 1, β = 1 → Pp = Pb)
    const pb = st => rozvSoudVypocet({ rady: [], soudobost: { byty: { zap: true, n: '1', stupen: st } } }).byty;
    o.pbT1 = pb('T1').pb; o.pbT2 = pb('T2').pb; o.pbT3 = pb('T3').pb; o.pbT4 = pb('T4').pb; o.upT4 = rozvSoudVypocet({ rady: [], soudobost: { byty: { zap: true, n: '1', stupen: 'T4' } } }).upoz.join();
    o.pbA = pb('A').pb; o.pbB = pb('B').pb; o.pbC = pb('C').pb; o.pbBez = pb(undefined).pb;
    o.n37 = rozvSoudVypocet({ rady: [], soudobost: { byty: { zap: true, n: '37', stupen: 'T3' } } });
    return o;
  });
  check('β(n): n = 10 → 0,45 (tab. B.1)', r.b10 === 0.45);
  check('β(n): n = 30 → 0,35, 40 → 0,33, 50 → 0,31, 60 → 0,30, 80 → 0,30, 100 → 0,28 (tab. B.1)',
    [r.b30, r.b40, r.b50, r.b60, r.b80, r.b100].join() === '0.35,0.33,0.31,0.3,0.3,0.28', [r.b30, r.b40, r.b50, r.b60, r.b80, r.b100].join());
  check('β(n): n = 37 → 0,33 (vzorec 0,2 + 0,8/√37 = 0,3315), n = 29 → 0,35', r.b37 === 0.33 && r.b29 === 0.35, r.b37 + ' ' + r.b29);
  check('β(n): zdroj „ČSN 33 2130 ed. 4, příloha B, tab. B.1", bez „ověřit"; mimo tabulku vzorec', r.z30 === 'ČSN 33 2130 ed. 4, příloha B, tab. B.1' && r.o30 === false && /βn = β∞ \+ \(1 − β∞\)\/√n, β∞ = 0,2/.test(r.z37), r.z37);
  check('β(n): n = 37 se počítá (žádné „zadejte β ručně"), Pp = 37 × 11 × 0,33 = 134,31 kW', Math.round(r.n37.pp * 100) / 100 === 134.31 && !/ručně/.test(r.n37.upoz.join()), r.n37.pp + ' ' + r.n37.upoz.join());
  check('β∞ = 0,15 v Nastavení → vzorec i pro n v tabulce (n = 10 → 0,15 + 0,85/√10 = 0,42); β∞ = 0,20 → tabulka', r.inf015_10 === 0.42 && r.inf02_10 === 0.45, r.inf015_10 + ' ' + r.inf02_10);
  check('Pb: T1 = T2 = 7 kW, T3 = 11 kW, T4 = zadat (hláška)', r.pbT1 === 7 && r.pbT2 === 7 && r.pbT3 === 11 && r.pbT4 == null && /zadejte Pp na byt \(charakter odběru T4\)/.test(r.upT4), r.upT4);
  check('Pb ze starších dat: A → 7 kW, B → 11 kW, C → zadat, bez údaje → 11 kW', r.pbA === 7 && r.pbB === 11 && r.pbC == null && r.pbBez === 11);
  check('cos φ výchozí 0,9', r.cos === 0.9);
  check('β kuchyně: zdroj „zpracovatel (praxe)", bez „ověřit"', r.kuch.zdroj === 'zpracovatel (praxe)' && !r.kuch.overit && r.kuch.b === 0.4);
  check('β EV: zdroj zpracovatel + ČSN 33 2000-7-722 ed. 3, bez „ověřit"', /^zpracovatel; nabíjecí obvod se dimenzuje na plný proud – ověřit v ČSN 33 2000-7-722 ed\. 3$/.test(r.ev.zdroj) && !r.ev.overit);

  // starší rozvaděč se „stupen: 'B'" (stupeň elektrizace) — otevře se beze změny dat, ukáže T3 a 11 kW
  const st = await p.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
    const e = dokForm().querySelector('[data-dk="oznaceni"]'); e.value = 'RD-STARY'; e.dispatchEvent(new Event('input', { bubbles: true }));
    const x = rozvVlozit('v-qm-3-40', 0, 0); x.vyvod = 'Hlavní vypínač';
    __rz.soud = { byty: { zap: true, n: '10', stupen: 'B' } };
    rozvZmena('t', () => {}); await dokUlozitOtevreny(); const uid = __dokOtevreny.uid;
    const pred = JSON.stringify(dokNajit(uid).data);
    await dokOtevrit(uid); await w(300);
    __rz.vyber = null; __rz.vic = null; rozvVlastnostiVykreslit(); rozvSoudUkazatelHned();
    const pn = document.getElementById('rz-soud-panel'); if (pn) pn.open = true;
    const sel = document.querySelector('#rz-soud-panel [data-rzs="byty.stupen"]');
    const text = pn ? pn.innerText : '';
    await dokUlozitOtevreny();
    const po = JSON.stringify(dokNajit(uid).data);
    const A = JSON.parse(pred), Bb = JSON.parse(po), dif = Object.keys(Object.assign({}, A, Bb)).filter(k => JSON.stringify(A[k]) !== JSON.stringify(Bb[k]));
    return { dif: dif.map(k => k + ':' + JSON.stringify(A[k]) + '→' + JSON.stringify(Bb[k])).join(' ; ').slice(0, 300), shoda: pred === po, sel: sel ? sel.value : '', volby: sel ? Array.from(sel.options).map(o => o.textContent).join(' | ') : '',
      text, pp: rozvSoudVypocet(dokNajit(uid).data).byty, stupen: JSON.parse(po).soudobost.byty.stupen };
  });
  check('starší rozvaděč „stupen: B": data po otevření a uložení bajtově stejná (stupen zůstal B)', st.shoda && st.stupen === 'B', st.stupen + ' ' + st.dif);
  check('starší rozvaděč „stupen: B": výběr ukazuje T3 a 11 kW, výpočet 10 × 11 kW × 0,45 = 49,5 kW',
    st.sel === 'T3' && st.pp.pb === 11 && Math.round(st.pp.pp * 10) / 10 === 49.5 && /10 × 11 kW × 0,45 = 49,5 kW/.test(st.text), st.sel + ' / ' + st.pp.pb);
  check('výběr charakteru odběru T1–T6 s Pb (T4–T6 zadat)', /^T1 standardní spotřebiče – 7 kW \| T2 \+ ohřev vody – 7 kW \| T3 \+ vaření a pečení nad 3,5 kW – 11 kW \| T4 .* – zadat \| T5 .* – zadat \| T6 \+ nabíjení EV – zadat$/.test(st.volby), st.volby);
  const ji = await p.evaluate(() => ({ i: document.getElementById('zk_i').closest('tr').lastElementChild.textContent, pod: DOK_VV_PODKLADY }));
  check('tabulka zkoušek i): ČSN 33 2130 ed.4, čl. 8.7.3, tab. 7', /ČSN 33 2130 ed\.4, čl\. 8\.7\.3, tab\. 7/.test(ji.i) && !/4\.7\.3/.test(ji.i), ji.i);
  check('výchozí podklady protokolu vnějších vlivů: ČSN 33 2130 ed. 4', ji.pod.includes('ČSN 33 2130 ed. 4 – Elektrické instalace nízkého napětí – Vnitřní elektrické rozvody') && !/2130 ed\. 3/.test(ji.pod));
  check('bez chyb stránky', !err.length, err.join(' | '));
  console.log(res.join('\n'));
  await b.close();
  process.exit(res.some(x => x.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.error('CRASH:', e.message); process.exit(2); });
