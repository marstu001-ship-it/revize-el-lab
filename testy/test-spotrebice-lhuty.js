// Spotřebiče — lhůty podle ČSN 33 1600 ed.2/Z2, tabulka 1 (3–96 měsíců),
// druh spotřebičů, návrh lhůty, upozornění, „Použít návrh", překryv
// „Kdy jaká lhůta?" a starý protokol beze změny (proti předchozí verzi, STARA_PORT).
const { chromium } = require('./pw');
const path = require('path');
const BEH = path.join(__dirname, '_beh');
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));

(async () => {
  const br = await chromium.launch({ args: ['--no-sandbox'] });
  const mk = async (port, sirka) => {
    const ctx = await br.newContext({ viewport: { width: sirka || 1500, height: 1000 }, timezoneId: 'Europe/Prague' });
    await ctx.addInitScript(() => {
      navigator.serviceWorker.register = () => new Promise(() => {});
      const T = new Date('2026-11-05T09:00:00Z').getTime(), D0 = Date;
      // zmrazený čas (uložení musí dát v obou verzích totéž)
      window.Date = class extends D0 { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } };
      Math.random = () => 0.4242;
    });
    const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message));
    await p.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(1200);
    return { p, err, ctx };
  };
  const PORT = process.env.PORT || 8901;
  const N = await mk(PORT), p = N.p;

  // ── výpočet návrhu ────────────────────────────────────────────────────
  const v = await p.evaluate(() => {
    const n = (seznam, druh) => spotrLhutaNavrh({ seznam, druh });
    const r = (sk, tr, o) => Object.assign({ nazev: 'x', skupina: sk, trida: tr, sestava: 'P' }, o || {});
    return {
      cIruka: n([r('C', 'I')], 'ruka').lhuta, cIIost: n([r('C', 'II')], 'ostatni').lhuta, eIost: n([r('E', 'I')], 'ostatni').lhuta,
      bIruka: n([r('B', 'I')], 'ruka').lhuta, dIIruka: n([r('D', 'II')], 'ruka').lhuta, smis: n([r('C', 'I')], 'smisene').lhuta,
      pp: n([r('E', 'II', { sestava: 'PP' })], 'ostatni'), bez: n([r('', 'I'), r('', 'II'), r('E', 'I')], 'ostatni'),
      a: n([r('A', 'I'), r('E', 'I')], 'ostatni'), op: n([r('C', 'I', { sestava: 'OP' }), r('E', 'I')], 'ostatni'),
      bezDruhu: n([r('E', 'I')], ''), tab: SPOTR_TAB1_Z2.radky.length, lhuty: SPOTR_LHUTY.join(','),
      popisy: SPOTR_LHUTY.every(l => !!SPOTR_LHUTY_POPIS[l]), hl: SPOTR_TAB1_Z2.hlavicka
    };
  });
  check('tabulka 1 (Z2): 6 řádků, hlavička „ČSN 33 1600 ed.2/Z2, tabulka 1"', v.tab === 6 && v.hl === 'ČSN 33 1600 ed.2/Z2, tabulka 1');
  check('lhůty 3, 6, 12, 24, 48, 96 a každá má popisek', v.lhuty === '3,6,12,24,48,96' && v.popisy, v.lhuty);
  check('návrh: C + I + ruka → 24', v.cIruka === 24, v.cIruka);
  check('návrh: C + II + ostatní → 96', v.cIIost === 96, v.cIIost);
  check('návrh: E + I + ostatní → 96', v.eIost === 96, v.eIost);
  check('návrh: B + I + ruka → 12', v.bIruka === 12, v.bIruka);
  check('návrh: D + II + ruka → 48', v.dIIruka === 48, v.dIIruka);
  check('návrh: smíšené C + I → 24 (přísnější sloupec)', v.smis === 24, v.smis);
  check('návrh: PP se skupinou E → 48 (držené v ruce, tř. I)', v.pp.lhuta === 48 && /třída I, držené v ruce/.test(v.pp.pro), v.pp.lhuta + ' ' + v.pp.pro);
  check('návrh: řádky bez skupiny se přeskočí a spočítají', v.bez.lhuta === 96 && v.bez.bezSk === 2, JSON.stringify(v.bez));
  check('návrh: skupina A se nezapočítá', v.a.lhuta === 96 && v.a.skA === 1);
  check('návrh: odpojitelný přívod OP se nezapočítá', v.op.lhuta === 96 && v.op.op === 1);
  check('návrh: bez druhu se počítá jako držené v ruce', v.bezDruhu.lhuta === 48 && v.bezDruhu.bezDruhu === true);

  // ── karta na obrazovce ────────────────────────────────────────────────
  const k = await p.evaluate(async () => {
    aktTyp = 'spotrebice'; aktPodtyp = 'spotrebice'; novaZprava('spotrebice');
    await new Promise(r => setTimeout(r, 300));
    const zah = document.getElementById('f_zahajeni'); zah.value = '2026-11-05'; zah.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('spotrebice-body').innerHTML = '';
    addSpotrebicRow({ nazev: 'Vrtačka', trida: 'I', skupina: 'C', sestava: 'P', hodnoceni: 'V' });
    addSpotrebicRow({ nazev: 'Monitor', trida: 'II', skupina: 'E', sestava: 'P', hodnoceni: 'V' });
    addSpotrebicRow({ nazev: 'Neznámý', trida: 'I', skupina: '', sestava: 'P' });
    addSpotrebicRow({ nazev: 'Druhý neznámý', trida: 'II', skupina: '', sestava: 'P' });
    spotrLhutaKartaObnovit();
    const t = () => document.getElementById('sp-lhuta-karta').innerText;
    const r = { bezDruhu: t(), lhuta0: gv('f_sp_lhuta'), pristi0: gv('f_pristi'), data0: JSON.stringify(collectSpotrebiceData()) };
    const lh = document.getElementById('f_sp_lhuta');
    lh.value = '48'; lh.dispatchEvent(new Event('change', { bubbles: true }));
    r.delsi = t(); r.upoz = !!document.querySelector('#sp-lhuta-karta .sp-lk-upoz');
    lh.value = '12'; lh.dispatchEvent(new Event('change', { bubbles: true }));
    r.kratsi = t(); r.info = !!document.querySelector('#sp-lhuta-karta .sp-lk-info'); r.upozK = !!document.querySelector('#sp-lhuta-karta .sp-lk-upoz');
    lh.value = '24'; lh.dispatchEvent(new Event('change', { bubbles: true }));
    r.rovna = !document.querySelector('#sp-lhuta-karta .sp-lk-upoz, #sp-lhuta-karta .sp-lk-info');
    // druh „ostatní": vrtačka C I ostatní 96, monitor E II ostatní 96 → návrh 96, bez kliknutí se nic nemění
    const dr = document.getElementById('f_sp_druh'); dr.value = 'ostatni'; dr.dispatchEvent(new Event('change', { bubbles: true }));
    r.ostatni = t(); r.lhutaPred = gv('f_sp_lhuta'); r.dataDruh = collectSpotrebiceData().druh;
    document.querySelector('[data-action="spotrLhutaPouzit"]').click();
    await new Promise(r2 => setTimeout(r2, 100));
    r.lhutaPo = gv('f_sp_lhuta'); r.pristiPo = gv('f_pristi');
    return r;
  });
  check('karta: návrh 24 a poznámka „počítáno jako držené v ruce – upřesněte druh"', /Návrh podle ČSN 33 1600 Z2, tab\. 1: 1× za 24 měsíců/.test(k.bezDruhu) && /\(počítáno jako držené v ruce – upřesněte druh\)/.test(k.bezDruhu), k.bezDruhu.replace(/\s+/g, ' ').slice(0, 200));
  check('karta: „2 spotřebiče bez skupiny – lhůtu nelze navrhnout"', /2 spotřebiče bez skupiny – lhůtu nelze navrhnout/.test(k.bezDruhu));
  check('karta: druh se do dat nezapíše, dokud ho technik nevybere', !/druh/.test(k.data0) && k.dataDruh === 'ostatni', k.data0);
  check('delší lhůta (48) → oranžové upozornění s důvodem', k.upoz && /Zvolená lhůta je delší, než dovoluje ČSN 33 1600 Z2, tab\. 1 pro: skupina C, třída I, držené v ruce \(24 měsíců\)\./.test(k.delsi), k.delsi.replace(/\s+/g, ' ').slice(-200));
  check('kratší lhůta (12) → šedá informace (pozn. 4, 11), ne upozornění', k.info && !k.upozK && /Kratší lhůta je dovolena/.test(k.kratsi));
  check('rovná lhůta → ani upozornění, ani informace', k.rovna);
  check('bez kliknutí se lhůta nezmění (24, návrh 96)', k.lhutaPred === '24' && /1× za 96 měsíců/.test(k.ostatni), k.lhutaPred);
  check('„Použít návrh" nastaví 96 a přepočítá příští revizi (+96 měsíců)', k.lhutaPo === '96' && k.pristiPo === '2034-11-05', k.lhutaPo + ' ' + k.pristiPo);

  // ── PDF bez karty ─────────────────────────────────────────────────────
  const pdf = await p.evaluate(async () => {
    const lh = document.getElementById('f_sp_lhuta'); lh.value = '48'; lh.dispatchEvent(new Event('change', { bubbles: true }));
    spotrebiceNahled(); await new Promise(r => setTimeout(r, 900));
    const t = document.getElementById('spotrebice-pdf-pages').innerText;
    spotrebiceNahledZpet(); await new Promise(r => setTimeout(r, 300));
    return t;
  });
  check('do PDF upozornění ani návrh nejdou, lhůta „1x 48 měsíců" ano', !/Zvolená lhůta je delší|Návrh podle|Kdy jaká lhůta|Spotřebiče na protokolu/.test(pdf) && /1x\s+48\s+měsíců/.test(pdf));

  // ── překryv ───────────────────────────────────────────────────────────
  const m = await p.evaluate(async () => {
    const dr = document.getElementById('f_sp_druh'); dr.value = 'ruka'; dr.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[data-action="spotrLhutyOtevrit"]').click();
    await new Promise(r => setTimeout(r, 150));
    const o = document.getElementById('modal-sp-lhuty');
    return { open: o.classList.contains('open'), text: o.innerText, bunka: (o.querySelector('.sp-t1-bunka') || {}).textContent,
      radek: (o.querySelector('.sp-t1-rad td') || {}).textContent };
  });
  check('„ⓘ Kdy jaká lhůta?" otevře překryv s tabulkou 1', m.open && /Opakovaná zkouška/.test(m.text) && /Opakovaná revize/.test(m.text));
  check('překryv: zvýrazněný řádek C / I a buňka 24 (návrh)', m.radek === 'C' && m.bunka === '24', m.radek + ' ' + m.bunka);
  check('překryv: revize × zkouška, skupiny, druh, zvláštní případy, proč jedna lhůta',
    /ČSN EN 50699/.test(m.text) && /§ 6 vyhl\. 50\/1978 Sb\./.test(m.text) && /revize splní i zkoušku/.test(m.text) && /Skupiny A–E/.test(m.text) &&
    /Vrtačka ve stojanu/.test(m.text) && /pozn\. 11/.test(m.text) && /250 h/.test(m.text) && /samostatný protokol/.test(m.text));
  await p.screenshot({ path: path.join(BEH, 'sp-lhuty-prekryv.png') });
  await p.evaluate(() => { closeModal('modal-sp-lhuty'); const lh = document.getElementById('f_sp_lhuta'); lh.value = '48'; lh.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('sp-lhuta-karta').scrollIntoView({ block: 'start' }); window.scrollBy(0, -170); });
  await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(BEH, 'sp-lhuty-karta.png') });

  // ── telefon: překryv se vejde na 360 px ───────────────────────────────
  const T = await mk(PORT, 360);
  const tel = await T.p.evaluate(async () => {
    aktTyp = 'spotrebice'; aktPodtyp = 'spotrebice'; novaZprava('spotrebice');
    await new Promise(r => setTimeout(r, 300));
    spotrLhutyOtevrit(); await new Promise(r => setTimeout(r, 150));
    const md = document.querySelector('#modal-sp-lhuty .modal'), b = md.getBoundingClientRect();
    return { l: b.left, r: b.right, sw: document.documentElement.scrollWidth, karta: document.getElementById('sp-lhuta-karta').scrollWidth <= document.getElementById('sp-lhuta-karta').clientWidth + 1 };
  });
  check('telefon 360 px: překryv i karta se vejdou na šířku', tel.l >= 0 && tel.r <= 360 && tel.sw <= 360 && tel.karta, JSON.stringify(tel));
  await T.p.screenshot({ path: path.join(BEH, 'sp-lhuty-prekryv-360.png') });

  // ── starý protokol (lhuta 6, bez druhu) beze změny proti předchozí verzi ──
  const S0 = { lhuta: '6', seznam: [{ nazev: 'Varná konvice', oznaceni: 'R-1', trida: 'I', skupina: 'E', sestava: 'P', hodnoceni: 'V', zavady: 'Vyhovuje' }] };
  const stary = async (page) => page.evaluate(async (S0) => {
    aktTyp = 'spotrebice'; aktPodtyp = 'spotrebice'; novaZprava('spotrebice');
    await new Promise(r => setTimeout(r, 200));
    const D = getData(); D.ev_cislo = 'RSP-26-0009'; D.zahajeni = '2026-05-01'; D.pristi = '2026-11-01'; D.spotrebice = JSON.parse(JSON.stringify(S0));
    nacistData(JSON.parse(JSON.stringify(D)));
    await new Promise(r => setTimeout(r, 400));
    const json = JSON.stringify(getData(), (k2, v2) => ['uid', 'timestamp', 'ulozeno'].includes(k2) ? undefined : v2);
    spotrebiceNahled(); await new Promise(r => setTimeout(r, 900));
    const pdfH = document.getElementById('spotrebice-pdf-pages').innerHTML;
    spotrebiceNahledZpet();
    return { json, sp: JSON.stringify(getData().spotrebice), pdfH };
  }, S0);
  const O = await mk(process.env.STARA_PORT || 8902);
  const a = await stary(O.p), b = await stary(p);
  check('starý protokol (lhůta 6, bez druhu): data po otevření bajtově jako v předchozí verzi', a.json === b.json, a.json.length + ' × ' + b.json.length);
  check('starý protokol: S stejné jako v předchozí verzi (lhuta „6", žádné druh)', b.sp === a.sp && /"lhuta":"6"/.test(b.sp) && !/druh/.test(b.sp), b.sp.slice(0, 80));
  check('starý protokol: PDF beze změny proti předchozí verzi', a.pdfH === b.pdfH, a.pdfH.length + ' × ' + b.pdfH.length);

  // ── Novinky ───────────────────────────────────────────────────────────
  const nov = await p.evaluate(() => {
    const k2 = [...document.querySelectorAll('#screen-novinky .scard')].find(c => /Spotřebiče – lhůty podle ČSN 33 1600 Z2/.test(c.textContent));
    const maxD = [...document.querySelectorAll('#screen-novinky [data-nov-datum]')].map(c => c.getAttribute('data-nov-datum')).sort().pop();
    return { je: !!k2, d: k2 && k2.getAttribute('data-nov-datum'), t: k2 ? k2.textContent : '', prvni: k2 && k2 === document.querySelector('#screen-novinky .scard[data-nov-datum]'), maxD };
  });
  check('Novinky: karta „🔌 Spotřebiče – lhůty podle ČSN 33 1600 Z2" nahoře s datem 2026-11-05', nov.je && nov.d === '2026-11-05' && nov.prvni && nov.maxD === '2026-11-05' &&
    /3/.test(nov.t) && /96 měsíců/.test(nov.t) && /Kdy jaká lhůta/.test(nov.t) && /Použít návrh/.test(nov.t), nov.d);

  check('bez chyb stránky', !N.err.length && !T.err.length, N.err.concat(T.err).join(' | '));
  console.log(res.join('\n'));
  await br.close();
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.error('CRASH:', e.message); process.exit(2); });
