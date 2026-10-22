// Rozvaděč — pohled 3D (etapa 5c, DBO i PSC). Záložka „🧊 3D" jen na prohlížení:
// kvádry v mm (CSS 3D), otáčení, pohledy, dveře, klik na přístroj → Návrh,
// telefon (dotyk), obrázek do PDF (vlastní projekce do SVG), starý rozvaděč beze
// změny. Vymyšlený byt 3+1 a hala PSC (testy/rozvadec-byt.js, rozvadec-psc-hala.js).
const { chromium } = require('./pw');
const path = require('path');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, '_beh');

function pomocnik() {
  window.__T = {
    w: ms => new Promise(r => setTimeout(r, ms)),
    nast(sel, v) { const e = dokForm().querySelector(sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); },
    pocty() {
      const n = s => document.querySelectorAll('#r3-svet .r3-box[data-r3="' + s + '"]').length;
      return { pr: n('pristroj'), skrin: n('skrin'), pole: n('pole'), lista: n('lista'), sb: n('sbernice'), deska: n('deska'), dvere: n('dvere') };
    },
    prvku: () => __rz.rady.reduce((s, r) => s + (r.prvky || []).length, 0),
    // šířka a levý okraj čela každého přístroje v 3D (pohled zepředu) a v čelním pohledu (2D)
    cela3d() { const o = {}; document.querySelectorAll('#r3-svet .r3-box[data-r3="pristroj"]').forEach(b => { const r = b.querySelector(':scope > .r3-st[data-st="p"]').getBoundingClientRect(); o[b.getAttribute('data-puid')] = { x: r.left, w: r.width, h: r.height }; }); return o; },
    cela2d() { const svg = rozvSvg(__rz, { k: 1 }), box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden'; box.innerHTML = svg; document.body.appendChild(box);
      const o = {}; box.querySelectorAll('g.rz-pr[data-puid]').forEach(g => { const r = g.querySelector('rect').getBBox(); o[g.getAttribute('data-puid')] = { x: r.x, w: r.width + 0.6, h: r.height }; }); box.remove(); return o; },
    kam: () => { const s = document.getElementById('r3-svet'); return { o: +s.getAttribute('data-o'), s: +s.getAttribute('data-s'), zoom: __r3.zoom, tr: s.style.transform }; },
    dvereRot: () => Array.from(document.querySelectorAll('#r3-svet .r3-box[data-r3="dvere"]')).map(e => /rotateY\(-100deg\)/.test(e.style.transform)),
    bezToastu: () => document.querySelectorAll('.toast, #toast-container, .toast-wrap').forEach(e => e.remove())
  };
}
// skutečná myš: tažení v rámečku 3D
async function tahni(p, dx, dy, o) {
  o = o || {};
  const r = await p.evaluate(() => { const b = document.getElementById('r3-ram').getBoundingClientRect(); return { x: b.left + b.width * 0.2, y: b.top + b.height * 0.5 }; });
  if (o.shift) await p.keyboard.down('Shift');
  await p.mouse.move(r.x, r.y); await p.mouse.down({ button: o.button || 'left' });
  for (let i = 1; i <= 10; i++) await p.mouse.move(r.x + dx * i / 10, r.y + dy * i / 10);
  await p.mouse.up({ button: o.button || 'left' }); if (o.shift) await p.keyboard.up('Shift'); await w(120);
}
function srovnej(a, b) {   // poměr šířek a poloh 3D : 2D musí být všude stejný (±2 %)
  const uid = Object.keys(b).filter(u => a[u]); if (uid.length < 2) return { ok: false, d: 'málo přístrojů' };
  const k = a[uid[0]].w / b[uid[0]].w, x0a = Math.min(...uid.map(u => a[u].x)), x0b = Math.min(...uid.map(u => b[u].x));
  let max = 0;
  uid.forEach(u => { max = Math.max(max, Math.abs(a[u].w / b[u].w / k - 1)); const db = b[u].x - x0b; if (db > 5) max = Math.max(max, Math.abs((a[u].x - x0a) / db / k - 1)); });
  return { ok: max < 0.02, d: uid.length + ' přístrojů, odchylka ' + (max * 100).toFixed(2) + ' %, ' + k.toFixed(2) + ' px/mm' };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const knihovny = async ctx => ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: path.join(__dirname, 'knihovny', r.request().url().split('/').pop()), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await knihovny(ctx);
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(URL); await w(1200); await p.evaluate(pomocnik);

  // ── 1. byt 3+1: záložka a kvádry ───────────────────────────────────────
  await p.evaluate(async () => { STORE.technik = { jmeno: 'Petr Vymyšlený', firma: 'Vymyšlená elektro s.r.o.', ico: '12345678', mesto: 'Kyjov' };
    await dokNacist(); await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-z')); __T.nast('[data-dk="oznaceni"]', 'RH1'); await __T.w(100); });
  await p.evaluate(require('./rozvadec-byt.js')); await w(300);
  const zal = await p.evaluate(() => Array.from(document.querySelectorAll('.rz-zal')).map(x => x.textContent.trim()).join('|'));
  check('editor DBO: čtyři záložky „🧩 Návrh | ⚡ Schéma | 🧊 3D | 📄 Dokumenty"', zal === '🧩 Návrh|⚡ Schéma|🧊 3D|📄 Dokumenty', zal);
  await p.click('.rz-zal[data-z="3d"]'); await w(500);
  const c1 = await p.evaluate(() => Object.assign(__T.pocty(), { prvku: __T.prvku(), rad: __rz.rady.length, akt: document.querySelector('.rz-zal.akt').getAttribute('data-z'),
    info: document.querySelector('.r3-info').textContent, hl: (document.querySelector('.r3-dvere-btn') || {}).textContent }));
  check('byt 3+1: kvádrů = přístroje (20) + skříň + lišty (3)', c1.pr === c1.prvku && c1.prvku === 20 && c1.skrin === 1 && c1.lista === c1.rad && c1.lista === 3, JSON.stringify(c1));
  check('jedna hlavní akce „🚪 Zavřít dveře" (dveře výchozí otevřené)', /🚪 Zavřít dveře/.test(c1.hl || ''), c1.hl);
  check('vestavěná skříň bez rozměrů: „hloubka neuvedena – kreslí se 100 mm"', /hloubka neuvedena – kreslí se 100 mm/.test(c1.info), c1.info.slice(0, 120));
  await p.evaluate(() => __T.bezToastu());
  await p.locator('#r3-ram').screenshot({ path: path.join(OUT, '3d-dbo-sikmo.png') });

  // ── 2. rozměry v mm: pohled zepředu ∝ čelní pohled ──────────────────────
  await p.click('[data-action="tdR3Pohled"][data-p="predni"]'); await w(200);
  const sr = await p.evaluate(() => { const r = document.getElementById('r3-ram'); r.style.perspective = 'none'; const o = { a: __T.cela3d(), b: __T.cela2d() }; r.style.perspective = ''; return o; });
  const s1 = srovnej(sr.a, sr.b);
  check('pohled zepředu: šířky a polohy čel přístrojů úměrné čelnímu pohledu (mm)', s1.ok, s1.d);
  const modul = await p.evaluate(() => { const a = __T.cela3d(), u = __rz.rady[1].prvky[1].uid; return a[u].h / a[u].w; });
  check('modulový přístroj 17,5 × 90 mm (výchozí výška jen pro vzhled)', Math.abs(modul - 90 / 17.5) < 0.12, modul.toFixed(2));

  // ── 3. ovládání: myš, pohledy, kolečko, dvojklik ────────────────────────
  await p.click('[data-action="tdR3Pohled"][data-p="sikmo"]'); await w(100);
  const k0 = await p.evaluate(() => __T.kam());
  await tahni(p, 120, 0);
  const k1 = await p.evaluate(() => __T.kam());
  check('tažení myší otáčí (vodorovně = kolem svislé osy)', k1.o - k0.o >= 40 && k1.s === k0.s, k0.o + ' → ' + k1.o);
  await tahni(p, 0, 600);
  const k2 = await p.evaluate(() => __T.kam());
  check('sklon je omezený na ±80°', k2.s === 80, String(k2.s));
  await tahni(p, 0, -1200);
  const k2b = await p.evaluate(() => __T.kam());
  check('sklon dolů taky nejvýš 80°', k2b.s === -80, String(k2b.s));
  const pv = {};
  for (const [kl, o, s] of [['predni', 0, 0], ['bok', -90, 0], ['shora', 0, 80], ['sikmo', -28, 18]]) {
    await p.click('[data-action="tdR3Pohled"][data-p="' + kl + '"]'); await w(80);
    const k = await p.evaluate(() => __T.kam()); pv[kl] = k.o === o && k.s === s;
  }
  check('tlačítka Zepředu · Zboku · Zhora · Šikmo nastaví pohled', Object.values(pv).every(Boolean), JSON.stringify(pv));
  const pos0 = await p.evaluate(() => __T.kam().tr);
  await tahni(p, 60, 40, { button: 'right' });
  const pos1 = await p.evaluate(() => ({ px: __r3.px, py: __r3.py, o: __T.kam().o }));
  await tahni(p, -30, 0, { shift: true });
  const pos2 = await p.evaluate(() => ({ px: __r3.px, o: __T.kam().o }));
  check('pravé tlačítko i Shift+tažení posouvají (neotáčí)', pos1.px === 60 && pos1.py === 40 && pos1.o === -28 && pos2.px === 30 && pos2.o === -28, JSON.stringify([pos1, pos2]));
  const r = await p.evaluate(() => { const b = document.getElementById('r3-ram').getBoundingClientRect(); return { x: b.left + 30, y: b.top + 30 }; });
  await p.mouse.move(r.x, r.y); await p.mouse.wheel(0, -300); await w(150);
  const z1 = await p.evaluate(() => __r3.zoom);
  await p.click('[data-action="tdR3Zoom"][data-smer="-1"]'); await w(50);
  const z2 = await p.evaluate(() => __r3.zoom);
  check('kolečko přiblíží, „−" oddálí', z1 > 1.05 && z2 < z1, z1.toFixed(2) + ' → ' + z2.toFixed(2));
  await p.mouse.dblclick(r.x, r.y); await w(150);
  const k3 = await p.evaluate(() => Object.assign(__T.kam(), { px: __r3.px }));
  check('dvojklik = výchozí pohled (šikmo, bez posunu a zoomu)', k3.o === -28 && k3.s === 18 && k3.zoom === 1 && k3.px === 0, JSON.stringify(k3).slice(0, 80));

  // ── 4. dveře ───────────────────────────────────────────────────────────
  const d1 = await p.evaluate(() => ({ rot: __T.dvereRot(), steny: document.querySelectorAll('#r3-svet .r3-box[data-r3="telo"]').length }));
  await p.click('.r3-dvere-btn'); await w(400);
  const d2 = await p.evaluate(async () => { await dokUlozitOtevreny(); return { rot: __T.dvereRot(), btn: document.querySelector('.r3-dvere-btn').textContent, data: (dokNajit(__dokOtevreny.uid).data.pohled3d || {}).dvere,
    pr: __T.pocty().pr, steny: document.querySelectorAll('#r3-svet .r3-box[data-r3="telo"]').length, akt: document.querySelector('.rz-zal.akt').getAttribute('data-z') }; });
  check('dveře otevřené = pootočené o 100° na pantu vlevo', d1.rot.length === 1 && d1.rot[0], JSON.stringify(d1.rot));
  check('„Zavřít dveře" je zavře, uloží d.pohled3d.dvere = zavrene, tlačítko nabídne otevření', !d2.rot[0] && d2.data === 'zavrene' && /Otevřít dveře/.test(d2.btn) && d2.akt === '3d', JSON.stringify(d2));
  check('za zavřenými dveřmi se kreslí jen čela přístrojů (těla skupin ne, počet kvádrů stejný)', d2.pr === 20 && d2.steny === 0 && d1.steny >= 3, 'těl ' + d1.steny + ' → ' + d2.steny);
  await p.click('.rz-zal[data-z="navrh"]'); await w(150); await p.click('.rz-zal[data-z="3d"]'); await w(300);
  const d3 = await p.evaluate(() => __T.dvereRot());
  await p.click('.r3-dvere-btn'); await w(300);
  const d4 = await p.evaluate(() => __T.dvereRot());
  check('stav dveří zůstane po přepnutí záložek; znovu otevřít jde', d3[0] === false && d4[0] === true, JSON.stringify([d3, d4]));

  // ── 5. klik na přístroj → Návrh s ním vybraným ──────────────────────────
  await p.click('[data-action="tdR3Pohled"][data-p="predni"]'); await w(150);
  const cil = await p.evaluate(() => { const u = __rz.rady[1].prvky[3].uid, e = document.querySelector('#r3-svet .r3-box[data-puid="' + u + '"] > .r3-st[data-st="p"]').getBoundingClientRect();
    return { u, x: e.left + e.width / 2, y: e.top + e.height * 0.8 }; });
  await p.mouse.click(cil.x, cil.y); await w(400);
  const vyb = await p.evaluate(() => ({ akt: document.querySelector('.rz-zal.akt').getAttribute('data-z'), vyber: __rz.vyber, panel: document.getElementById('rz-pan-navrh').hidden }));
  check('klik na přístroj v 3D přepne na Návrh a vybere ho', vyb.akt === 'navrh' && vyb.vyber === cil.u && !vyb.panel, JSON.stringify(vyb));

  // ── 6. PDF: volba v Dokumentech, obrázek za čelním pohledem ─────────────
  await p.click('.rz-zal[data-z="dok"]'); await w(300);
  const zt = await p.evaluate(() => { const e = dokForm().querySelector('[data-dk="dokVyber.pohled3d"]'); return e ? { t: e.parentNode.textContent.trim(), c: e.checked } : null; });
  check('Dokumenty: zaškrtávátko „pohled 3D (ilustrační)", výchozí vypnuté', zt && /pohled 3D \(ilustrační\)/.test(zt.t) && !zt.c, JSON.stringify(zt));
  const pdfBez = await p.evaluate(() => DOK_TYPY.rozv.pdf(DOK_TYPY.rozv.cist(dokForm())).map(x => x.html || '').join('').indexOf('Pohled 3D') !== -1);
  await p.evaluate(() => { const e = dokForm().querySelector('[data-dk="dokVyber.pohled3d"]'); e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); });
  await w(200);
  await p.evaluate(async () => { await dokUlozitOtevreny(); await dokNahled(); }); await w(1500);
  const pdf = await p.evaluate(() => {
    const st = Array.from(document.querySelectorAll('#dok-pdf-pages .a4'));
    const i3 = st.findIndex(a => /Pohled 3D \(ilustrační\)/.test(a.textContent)), ic = st.findIndex(a => /Seznam přístrojů/.test(a.textContent));
    const s3 = i3 >= 0 ? st[i3].querySelector('svg.r3-pdf-svg') : null;
    const zakaz = s3 ? s3.querySelectorAll('foreignObject, image, filter, mask, style').length : -1;
    return { i3, ic, n: st.length, sirka: i3 >= 0 && st[i3].classList.contains('a4-landscape'), poly: s3 ? s3.querySelectorAll('polygon').length : 0,
      cela: s3 ? s3.querySelectorAll('g[transform^="matrix"]').length : 0, zakaz, w: s3 ? s3.getBoundingClientRect().width : 0, sw: i3 >= 0 ? st[i3].getBoundingClientRect().width : 0,
      text: i3 >= 0 ? st[i3].textContent.slice(-300) : '' };
  });
  check('PDF bez zaškrtnutí obrázek 3D nemá', !pdfBez);
  check('PDF se zaškrtnutím: strana „Pohled 3D (ilustrační)" na šířku hned za seznamem přístrojů', pdf.i3 > 0 && pdf.i3 === pdf.ic + 1 && pdf.sirka, JSON.stringify(pdf).slice(0, 120));
  check('obrázek 3D = vlastní projekce do SVG (mnohoúhelníky, čela přístrojů jako v čelním pohledu, jen jednoduché prvky), vejde se na list',
    pdf.poly > 40 && pdf.cela >= 20 && pdf.zakaz === 0 && pdf.w > 50 && pdf.w <= pdf.sw, 'poly ' + pdf.poly + ', čel ' + pdf.cela + ', ' + Math.round(pdf.w) + '/' + Math.round(pdf.sw) + ' px');
  check('pod obrázkem: ilustrační, výchozí rozměry přístrojů a hloubka neuvedena', /výchozí výškou 90 mm a hloubkou 70 mm/.test(pdf.text) && /hloubka neuvedena/.test(pdf.text), pdf.text.slice(-160));
  await p.locator('#dok-pdf-pages .a4 >> nth=' + pdf.i3).screenshot({ path: path.join(OUT, '3d-pdf-dbo.png') });
  // skutečné PDF (html2canvas) — obrázek se vykreslí, strana není prázdná
  const canv = await p.evaluate(async (i) => {
    const a = document.querySelectorAll('#dok-pdf-pages .a4')[i], c = await html2canvas(a, { scale: 1, backgroundColor: '#fff' });
    const x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let tm = 0; for (let j = 0; j < x.length; j += 16) if (x[j] < 200) tm++;
    return { w: c.width, tm };
  }, pdf.i3);
  check('html2canvas obrázek 3D vykreslí (strana do PDF není prázdná)', canv.tm > 2000, JSON.stringify(canv));
  await p.evaluate(() => TD_AKCE.tdPdfZpet && TD_AKCE.tdPdfZpet()); await w(300);

  // ── 7. starý rozvaděč beze změny (otevření, záložka 3D, uložení) ─────────
  const stary = await p.evaluate(async () => {
    const data = dokKopie(dokNajit(__dokOtevreny.uid).data); delete data.pohled3d; delete data.dokVyber;
    const z = { uid: 'r3-stary', typ: 'rozv', cislo: 'ROZ-0901', vytvoreno: '2026-10-21T08:00:00.000Z', upraveno: '2026-10-21T08:00:00.000Z', data: data };
    DOK.dokumenty = DOK.dokumenty.filter(x => x.uid !== z.uid); DOK.dokumenty.push(dokKopie(z)); await dokZapsat();
    const pred = JSON.stringify(dokNajit(z.uid).data);
    await dokOtevrit(z.uid); await __T.w(300);
    rozvZalozkaNastavit('3d'); await __T.w(200); rozvZalozkaNastavit('navrh');
    dokZmena(); await dokUlozitOtevreny(); await __T.w(100);
    return { pred, po: JSON.stringify(dokNajit(z.uid).data) };
  });
  check('starý rozvaděč: otevření, pohled 3D a uložení nezmění data (bajtově, bez klíče pohled3d)', stary.pred === stary.po && stary.po.indexOf('pohled3d') === -1, stary.pred.length + ' / ' + stary.po.length);

  // ── 8. PSC hala: tři pole, deska, sběrnice ──────────────────────────────
  await p.evaluate(require('./rozvadec-psc-hala.js')); await w(300);
  await p.click('.rz-zal[data-z="3d"]'); await w(600);
  const c8 = await p.evaluate(() => {
    const geo = pscGeo(__rz), din = geo.rady.filter(g => !g.deska).length;
    return Object.assign(__T.pocty(), { prvku: __T.prvku(), din, poli: __rz.skrin.pole.length, info: document.querySelector('.r3-info').textContent, dvere: __T.dvereRot(),
      pruhl: document.querySelectorAll('#r3-svet .r3-box[data-r3="dvere"].r3-pruhl').length,
      med: Array.from(document.querySelectorAll('#r3-svet .r3-box[data-r3="sbernice"] > .r3-st[data-st="p"]')).filter(e => /rgb\(200, 117, 51\)/.test(getComputedStyle(e).backgroundColor)).length });
  });
  check('PSC 3 pole: kvádrů = přístroje + pole + lišty DIN segmentů', c8.pr === c8.prvku && c8.pole === 3 && c8.lista === c8.din && c8.prvku >= 14, JSON.stringify(c8).slice(0, 220));
  check('PSC: montážní desky a sběrnice jako měděné pasy (i spojky do dalšího pole)', c8.deska === 3 && c8.sb >= 15 && c8.med >= 12, 'desky ' + c8.deska + ', pasů ' + c8.sb + ', měděných ' + c8.med);
  check('PSC: každé pole má dveře na pantu vlevo, otevřené kreslené průhledně (nezakryjí sousední pole)', c8.dvere.length === 3 && c8.dvere.every(Boolean) && c8.pruhl === 3, JSON.stringify(c8.dvere));
  check('PSC: pole bez hloubky — „hloubka neuvedena – kreslí se 400 mm", rozměry š × v × h', /hloubka neuvedena – kreslí se 400 mm/.test(c8.info) && /3 pole, 2 000 × 2 000 × 400 mm|3 pole, 2000 × 2000 × 400 mm/.test(c8.info), c8.info.slice(0, 140));
  await p.evaluate(() => __T.bezToastu());
  await p.locator('#r3-ram').screenshot({ path: path.join(OUT, '3d-psc-sikmo.png') });
  await p.click('[data-action="tdR3Pohled"][data-p="predni"]'); await w(200);
  const s8 = await p.evaluate(() => { const r = document.getElementById('r3-ram'); r.style.perspective = 'none'; const a = __T.cela3d(), b = __T.cela2d(), d = {}; r.style.perspective = ''; __rz.rady.forEach(r => (r.prvky || []).forEach(x => { if (x.pos && a[x.uid] && b[x.uid]) d[x.uid] = 1; }));
    const fa = {}, fb = {}; Object.keys(d).forEach(u => { fa[u] = a[u]; fb[u] = b[u]; }); return { a: fa, b: fb }; });
  const s8r = srovnej(s8.a, s8.b);
  check('PSC zepředu: přístroje na montážních deskách ve svých mm (úměrně čelnímu pohledu)', s8r.ok, s8r.d);
  // klik na výkonový jistič
  const cil8 = await p.evaluate(() => { const u = __rz.rady.flatMap(r => r.prvky || []).find(x => x.p.kat === 'QF').uid, e = document.querySelector('#r3-svet .r3-box[data-puid="' + u + '"] > .r3-st[data-st="p"]').getBoundingClientRect();
    return { u, x: e.left + e.width / 2, y: e.top + e.height * 0.85 }; });
  await p.mouse.click(cil8.x, cil8.y); await w(400);
  const v8 = await p.evaluate(() => ({ akt: document.querySelector('.rz-zal.akt').getAttribute('data-z'), vyber: __rz.vyber }));
  check('PSC: klik na výkonový jistič v 3D ho vybere v Návrhu', v8.akt === 'navrh' && v8.vyber === cil8.u, JSON.stringify(v8));
  const psvg = await p.evaluate(() => { const r = rozv3dSvg(DOK_TYPY.rozv.cist(dokForm())); return { poly: (r.svg.match(/<polygon/g) || []).length, w: r.w, h: r.h }; });
  check('PSC: obrázek 3D do PDF (projekce, vejde se 265 × 150 mm)', psvg.poly > 150 && psvg.w <= 265.01 && psvg.h <= 150.01, JSON.stringify(psvg));

  // ── 9. výkon: PSC 3 pole se 150 přístroji ───────────────────────────────
  const vykon = await p.evaluate(async () => {
    await dokNovy('psc'); ['v-pole-800', 'v-pole-800', 'v-pole-800'].forEach(k => rozvSkrinNastavit(rozvKnihPolozka(k)));
    const geo = pscGeo(__rz), din = geo.rady.filter(g => !g.deska).map(g => g.i), deska = geo.rady.filter(g => g.deska).map(g => g.i);
    let n = 0;
    din.forEach(ri => { const mod = pscGeo(__rz).rady[ri].mod; for (let i = 0; i < mod && n < 138; i++) { rozvVlozit('v-fa-1-B16', ri, __rz.rady[ri].prvky.length); n++; } });
    deska.forEach(ri => { for (let i = 0; i < 4 && n < 150; i++) { rozvVlozit('v-qf-3-250', ri, __rz.rady[ri].prvky.length); n++; } });
    rozvZalozkaNastavit('3d'); await __T.w(400);
    const prvku = __T.prvku(), pr = __T.pocty().pr;
    const fps = async () => { let snimky = 0, t0 = performance.now();
      await new Promise(res => { (function krok() { snimky++; __r3.o += 3; __r3.s = 18 + 10 * Math.sin(snimky / 10); r3Kamera(); if (performance.now() - t0 < 1000) requestAnimationFrame(krok); else res(); })(); });
      return snimky / ((performance.now() - t0) / 1000); };
    const L = []; for (let i = 0; i < 5; i++) L.push(await fps());   // nejlepší z pěti (headless bez GPU je hlučný)
    return { prvku, pr, fps: Math.max.apply(null, L), L: L.map(x => x.toFixed(0)).join('/'), steny: document.querySelectorAll('#r3-svet .r3-st').length };
  });
  check('výkon: PSC 3 pole se 150 přístroji se otáčí plynule (snímků/s, headless Chromium)', vykon.pr === vykon.prvku && vykon.prvku === 150 && vykon.fps >= 30, vykon.fps.toFixed(1) + ' snímků/s (' + vykon.L + '), ' + vykon.steny + ' stěn');
  check('žádná chyba na stránce', err.length === 0, err.join(' | '));

  // ── 10. telefon: dotyk ─────────────────────────────────────────────────
  {
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await knihovny(c2);
    await c2.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
    const t = await c2.newPage(); const err2 = [];
    t.on('pageerror', e => err2.push(e.message)); t.on('dialog', d => d.accept());
    await t.goto(URL); await w(1200); await t.evaluate(pomocnik);
    await t.evaluate(async () => { await dokNacist(); await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-z')); });
    await t.evaluate(require('./rozvadec-byt.js')); await w(300);
    await t.evaluate(() => document.querySelector('.rz-zal[data-z="3d"]').scrollIntoView({ block: 'center' })); await w(200);
    const zq = await t.evaluate(() => { const b = document.querySelector('.rz-zal[data-z="3d"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; });
    await t.touchscreen.tap(zq.x, zq.y); await w(600);
    const lay = await t.evaluate(() => { const r = document.getElementById('r3-ram').getBoundingClientRect(); return { akt: document.querySelector('.rz-zal.akt').getAttribute('data-z'), l: r.left, r: r.right, h: r.height,
      sirka: document.documentElement.scrollWidth, tlac: Math.min(...Array.from(document.querySelectorAll('.r3-lista .dok-mini')).map(e => e.getBoundingClientRect().height)),
      info: document.querySelector('.r3-info').textContent }; });
    check('telefon 390 px: záložka 🧊 3D klepnutím, rámeček v šířce displeje, tlačítka ≥ 44 px, bez vodorovného posunu', lay.akt === '3d' && lay.l >= 0 && lay.r <= 390 && lay.h >= 300 && lay.sirka <= 390 && lay.tlac >= 44 && zq.h >= 44, JSON.stringify(lay).slice(0, 200));
    check('telefon: nápověda mluví o prstech', /tažením prstu otáčíte, dvěma prsty přiblížíte/.test(lay.info));
    await t.evaluate(() => document.getElementById('r3-ram').scrollIntoView({ block: 'center' })); await w(200);
    const dot = await t.evaluate(async () => {
      const ram = document.getElementById('r3-ram'), b = ram.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const ev = (typ, id, x, y) => ram.dispatchEvent(new PointerEvent(typ, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: id, isPrimary: id === 1, clientX: x, clientY: y }));
      const k0 = Object.assign({}, __T.kam());
      ev('pointerdown', 1, cx, cy); for (let i = 1; i <= 8; i++) { ev('pointermove', 1, cx + i * 10, cy + i * 4); await new Promise(r => requestAnimationFrame(r)); } ev('pointerup', 1, cx + 80, cy + 32);
      await new Promise(r => setTimeout(r, 50));
      const k1 = Object.assign({}, __T.kam());
      ev('pointerdown', 1, cx - 30, cy); ev('pointerdown', 2, cx + 30, cy);
      for (let i = 1; i <= 8; i++) { ev('pointermove', 1, cx - 30 - i * 8, cy); ev('pointermove', 2, cx + 30 + i * 8, cy); await new Promise(r => requestAnimationFrame(r)); }
      ev('pointerup', 1, cx - 94, cy); ev('pointerup', 2, cx + 94, cy);
      await new Promise(r => setTimeout(r, 50));
      return { k0, k1, k2: Object.assign({}, __T.kam()), stranka: scrollY };
    });
    check('telefon: jeden prst otáčí', dot.k1.o - dot.k0.o >= 25 && dot.k1.s > dot.k0.s, dot.k0.o + '/' + dot.k0.s + ' → ' + dot.k1.o + '/' + dot.k1.s);
    check('telefon: dva prsty přibližují (a neotáčí)', dot.k2.zoom > 2 && dot.k2.o === dot.k1.o, dot.k1.zoom + ' → ' + dot.k2.zoom.toFixed(2));
    await t.evaluate(() => { r3Pohled('predni'); document.getElementById('r3-ram').scrollIntoView({ block: 'center' }); }); await w(300);
    const tq = await t.evaluate(() => { const u = __rz.rady[2].prvky[1].uid, e = document.querySelector('#r3-svet .r3-box[data-puid="' + u + '"] > .r3-st[data-st="p"]').getBoundingClientRect();
      return { u, x: Math.round(e.left + e.width / 2), y: Math.round(e.top + e.height * 0.85) }; });
    await t.touchscreen.tap(tq.x, tq.y); await w(500);
    const tv = await t.evaluate(() => ({ akt: document.querySelector('.rz-zal.akt').getAttribute('data-z'), vyber: __rz.vyber }));
    check('telefon: klepnutí na přístroj ho otevře v Návrhu', tv.akt === 'navrh' && tv.vyber === tq.u, JSON.stringify(tv));
    check('telefon: žádná chyba na stránce', err2.length === 0, err2.join(' | '));
    await c2.close();
  }

  await b.close();
  res.forEach(x => console.log(x));
  const spatne = res.filter(r => r.startsWith('❌')).length;
  console.log(spatne ? 'ŠPATNĚ ' + spatne + ' z ' + res.length : 'VŠE OK (' + res.length + ')');
  process.exit(spatne ? 1 : 0);
})().catch(e => { console.error('SELHALO', e); process.exit(1); });
