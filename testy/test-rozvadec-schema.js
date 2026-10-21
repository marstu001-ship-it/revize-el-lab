// Rozvaděč DBO — etapa 3: schéma zapojení generované z návrhu (záložka „⚡ Schéma").
// Hlídá: záložky Návrh | Schéma | Dokumenty, list 1 (osazení + tabulka údajů),
// jednopólové schéma bytu 3+1 (QM na přívodu, SPD, sporák 3f, dva chrániče
// s jističi, RCBO, AFDD), značku spotřebiče z názvu, 1f bez fáze → „L?"
// a řádek „Ve schématu chybí", napájení podružného rozvaděče, MET, předřazený
// jistič, velkou skříň 6×24 se 60 vývody (zlom jen na hranici skupiny,
// rozdělená skupina s odkazy /list.sloupec oběma směry, nic nepřeteče rám
// ani razítko, Listů / Výkres), A3, klik na přístroj, číslo obvodu a Pi
// v tabulce, vektorové PDF (písmo vložené, háčky jako text), schéma
// v souhrnném PDF, starý rozvaděč beze změny, telefon. Vše vymyšlené.
const { chromium } = require('./pw');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));
const BEH = path.join(__dirname, '_beh');

async function priprava(p) {
  await p.evaluate('window.__rozvByt = ' + require('./rozvadec-byt.js').toString());
  await p.evaluate(async () => {
    STORE.technik = Object.assign({}, STORE.technik, { jmeno: 'Petr Vymyšlený', firma: 'Vymyšlená elektro s.r.o.', ico: '12345678', mesto: 'Kyjov' });
    saveStore();
    window.__T = {
      dk: (s, v) => { const e = dokForm().querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); },
      cist: () => DOK_TYPY.rozv.cist(dokForm())
    };
    // podružný rozvaděč RS1 (napájený z bytu)
    await dokNovy('rozv'); __T.dk('[data-dk="oznaceni"]', 'RS1'); await dokUlozitOtevreny();
    window.__rs1 = window.__dokOtevreny.uid;
    await dokNovy('rozv');
    __T.dk('[data-dk="oznaceni"]', 'RH1'); __T.dk('[data-dk="stavba"]', 'Byt 3+1, Vymyšlená 12');
    __T.dk('[data-dk="investor.nazev"]', 'Jan Smyšlený'); __T.dk('[data-dk="misto"]', 'Předsíň');
    __T.dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S'); __T.dk('[data-dk="privodIn"]', '40');
    __T.dk('[data-dk="privodKabel"]', 'CYKY-J'); __T.dk('[data-dk="privodPrurez"]', '5×10');
    __T.dk('[data-dk="krytiZavreno"]', 'IP40'); __T.dk('[data-dk="krytiOtevreno"]', 'IP20');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
    window.__rozvByt();
    // AFDD místo rezervy v 3. řadě, podružný rozvaděč z -FA9 (Myčka → RS1), Pi a číslo obvodu
    const r3 = __rz.rady[2].prvky; r3.pop();
    const a = rozvVlozit('v-afdd-1N-B16', 2, r3.length);
    Object.assign(a, { vyvod: 'Dětský pokoj – osvětlení', faze: 'L1', kabel: 'CYKY-J', prurez: '3×1,5' });
    const vse = []; __rz.rady.forEach(r => r.prvky.forEach(x => vse.push(x)));
    const naj = o => vse.filter(x => x.ozn === o)[0];
    naj('-FA9').napaji = [window.__rs1]; naj('-FA9').vyvod = 'Přívod RS1';
    naj('-FA1').pi = '9,6'; naj('-FA1').obvod = '1'; naj('-FA2').obvod = '2';
    naj('-FA4').faze = '';   // 1f bez fáze
    naj('-FA5').kabel = ''; naj('-FA5').prurez = '';
    naj('-FA7').spotr = 'motor'; naj('-FA7').vyvod = 'Kuchyň – digestoř';
    rozvNadrazeneAuto(); rozvPohledVykreslit(); rozvVlastnostiVykreslit(); dokZmena();
    await dokUlozitOtevreny();
  });
}

// Prvky výkresu mimo rám a razítko nesmí přetéct vnitřní rám ani zasáhnout razítko.
const presahy = (p, svg) => p.evaluate(svg => {
  const box = document.createElement('div'); box.style.cssText = 'position:absolute;left:0;top:0';
  box.innerHTML = svg; document.body.appendChild(box);
  const s = box.querySelector('svg'), vb = s.getAttribute('viewBox').split(' ').map(Number), W = vb[2], H = vb[3];
  s.setAttribute('width', W * 4); s.setAttribute('height', H * 4);
  const R = s.getBoundingClientRect(), k = R.width / W, chyby = [];
  const raz = { x0: W - 10 - 128, y0: H - 10 - 36 };
  s.querySelectorAll('line, rect, path, circle, ellipse, text').forEach(el => {
    if (el.closest('[data-ram],[data-razitko]') || (el.tagName === 'rect' && el.parentNode === s)) return;
    const b = el.getBoundingClientRect(); if (!b.width && !b.height) return;
    const x0 = (b.left - R.left) / k, y0 = (b.top - R.top) / k, x1 = (b.right - R.left) / k, y1 = (b.bottom - R.top) / k;
    const t = (el.textContent || el.tagName).slice(0, 30);
    if (x0 < 10 - 0.2 || y0 < 10 - 0.2 || x1 > W - 10 + 0.2 || y1 > H - 10 + 0.2) chyby.push('rám: ' + t);
    else if (x1 > raz.x0 + 0.2 && y1 > raz.y0 + 0.2) chyby.push('razítko: ' + t);
  });
  box.remove();
  return chyby;
}, svg);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: path.join(__dirname, 'knihovny', r.request().url().split('/').pop()),
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
  const otiskPred = await otisk();
  await priprava(p);

  // ── 1. záložky a záložka Schéma ───────────────────────────────────────
  const z0 = await p.evaluate(() => Array.from(document.querySelectorAll('.rz-zal')).map(b => b.textContent + (b.classList.contains('akt') ? '*' : '')).join('|'));
  check('editor: záložky „🧩 Návrh | ⚡ Schéma | 📄 Dokumenty", otevřený Návrh', z0 === '🧩 Návrh*|⚡ Schéma|📄 Dokumenty', z0);
  await p.click('.rz-zal[data-z="sch"]'); await w(500);
  const z1 = await p.evaluate(() => {
    const g = document.querySelector('#rz-pan-sch .rz-sch-tisk'), pan = document.getElementById('rz-pan-sch').getBoundingClientRect();
    return { sch: !document.getElementById('rz-pan-sch').hidden, navrh: !document.getElementById('rz-pan-navrh').hidden,
      akce: g && g.textContent, nahore: g && g.getBoundingClientRect().top - pan.top < 120, plne: g && getComputedStyle(g).backgroundColor,
      info: document.getElementById('rz-sch-info').textContent, svg: !!document.querySelector('#rz-sch-ram svg'),
      chybi: document.getElementById('rz-sch-chybi').innerText, aktivni: rozvEditorAktivni(),
      odkazy: Array.from(document.querySelectorAll('#rz-sch-chybi [data-action="tdRSchVybrat"]')).map(a => a.textContent).join(',') };
  });
  check('záložka Schéma: jedna hlavní akce „🖨 Tisk schématu (PDF)" nahoře, plné tlačítko', z1.sch && !z1.navrh && z1.akce === '🖨 Tisk schématu (PDF)' && z1.nahore &&
    z1.plne !== 'rgba(0, 0, 0, 0)', JSON.stringify(z1));
  check('náhled listu (SVG), „List 1 / 2 · osazení a údaje · A4", klávesy návrhu neplatí', z1.svg && z1.info === 'List 1 / 2 · osazení a údaje · A4' && !z1.aktivni, z1.info);
  check('„Ve schématu chybí: 1× fáze (-FA4), 1× kabel (-FA5)" s odkazy na přístroje', /^Ve schématu chybí: 1× fáze \(-FA4\), 1× kabel \(-FA5\)/.test(z1.chybi) && z1.odkazy === '-FA4,-FA5', z1.chybi);

  // ── 2. list 1: osazení a tabulka údajů ────────────────────────────────
  const L = await p.evaluate(() => rozvSchemaListy(__T.cist()).map(l => ({ svg: l.svg, fmt: l.g.fmt, W: l.g.W, H: l.g.H })));
  const txt = svg => (svg.match(/<text[^>]*>([^<]*)<\/text>/g) || []).map(t => t.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
  const t1 = txt(L[0].svg), t2 = txt(L[1].svg);
  check('výkres bytu: 2 listy A4 297 × 210 (osazení + jednopólové schéma)', L.length === 2 && L.every(l => l.W === 297 && l.H === 210 && l.fmt === 'A4'), L.length);
  check('list 1: nadpis „Osazení rozvaděče RH1" a „Rozvodnice 3×12 modulů, IP40 / IP20"', t1.includes('Osazení rozvaděče RH1') && t1.includes('Rozvodnice 3×12 modulů, IP40 / IP20'), t1.slice(0, 4).join(' | '));
  const osaz = ['-QM1', 'SPD1', '-FA1', '-FI1', '-FA9', '-FI2', '-FI/FA1', '-FA14'].every(o => t1.includes(o));
  check('list 1: osazení ze čelního pohledu (svislé označení přístrojů)', osaz && /rotate\(-90/.test(L[0].svg), t1.filter(x => /^-|SPD/.test(x)).join(' '));
  const rad = ['Rozvaděč', 'Rozvodná soustava', 'Ochrana před nebezpečným dotykem', 'Typ', 'Provedení', 'Přívod / vývody', 'Rozměr', 'Krytí', 'Vnější vlivy', 'Pi [kW]', 'Pm [kW]', 'Hmotnost'];
  check('list 1: tabulka údajů má všech 12 řádků v pořadí', rad.every((r, i) => t1.indexOf(r) !== -1 && (i === 0 || t1.indexOf(r) > t1.indexOf(rad[i - 1]))), rad.filter(r => !t1.includes(r)).join(','));
  check('tabulka: RH1 – Předsíň, 3/N/PE AC 400/230 V 50 Hz TN-S, nástěnná, plast, přívod shora, IP40 / IP20',
    ['RH1 – Předsíň', '3/N/PE AC 400/230 V 50 Hz TN-S', 'nástěnná, plast', 'přívod shora', 'IP40 / IP20'].every(x => t1.includes(x)));
  check('ochrana před dotykem odvozená z dat (chrániče 30 mA), bez čísla normy', t1.some(x => /^automatickým odpojením od zdroje; doplňková ochrana proudovým/.test(x)) && !t1.some(x => /ČSN/.test(x)));
  check('rohové razítko: Vypracoval z profilu, Akce, Investor, Název výkresu „Rozvaděč RH1", Projekt, Zakázka ROZ-…, Soubor, Listů 2, Výkres 1',
    ['Vypracoval', 'Petr Vymyšlený', 'Akce', 'Byt 3+1, Vymyšlená 12', 'Investor', 'Jan Smyšlený', 'Název výkresu', 'Rozvaděč RH1', 'Projekt', 'Zakázka', 'Soubor', 'Listů', 'Výkres'].every(x => t1.includes(x)) &&
    t1[t1.indexOf('Listů') + 1] === '2' && t1[t1.indexOf('Výkres') + 1] === '1' && t1.some(x => /^ROZ-\d+_schema_RH1\.pdf$/.test(x)));
  check('rám se zónami 1–8 nahoře i dole a A–F vlevo i vpravo', ['1', '8', 'A', 'F'].every(z => t1.filter(x => x === z).length >= 2));

  // ── 3. jednopólové schéma bytu ────────────────────────────────────────
  check('list 2: čárkovaný obrys „Rozvaděč RH1", sběrnice L1, L2, L3 / N / PE, soustava', t2.includes('Rozvaděč RH1') && t2.includes('L1, L2, L3') && t2.includes('N') && t2.includes('PE') &&
    t2.includes('3/N/PE AC 400/230 V 50 Hz TN-S') && /stroke-dasharray="3 1.6"/.test(L[1].svg));
  check('přívod: kabel CYKY-J 5×10, bez předřazeného jističe žádný elektroměrový rozvaděč', t2.includes('CYKY-J 5×10') && !t2.includes('Elektroměrový rozvaděč'));
  const sl = await p.evaluate(svg => {
    const d = document.createElement('div'); d.innerHTML = svg; const o = {};
    d.querySelectorAll('svg > g[data-puid]').forEach(g => {
      const x = rozvNajit(g.getAttribute('data-puid')); if (!x) return;
      const t = Array.from(g.querySelectorAll('text')).map(e => e.textContent);
      const zn = Array.from(g.querySelectorAll('[data-znacka]')).map(e => e.getAttribute('data-znacka'));
      o[x.x.ozn] = { t: t.join(' | '), zn: zn.join(',') };
    });
    return o;
  }, L[1].svg);
  check('hlavní vypínač -QM1 na přívodu (značka vypínače, 40 A)', sl['-QM1'] && sl['-QM1'].zn === 'vypinac' && /40 A/.test(sl['-QM1'].t), JSON.stringify(sl['-QM1']));
  check('SPD1 se svodičem a uzemněním (T1+T2), bez vývodu', sl['SPD1'] && sl['SPD1'].zn === 'spd' && /T1\+T2/.test(sl['SPD1'].t), JSON.stringify(sl['SPD1']));
  check('sporák -FA1: jistič B25, 3f „L1 L2 L3 · CYKY-J 5×2,5", spotřebič „jiné"', sl['-FA1'] && /^jistic,jine$/.test(sl['-FA1'].zn) && /B25/.test(sl['-FA1'].t) &&
    /L1 L2 L3 · CYKY-J 5×2,5/.test(sl['-FA1'].t) && /Sporák/.test(sl['-FA1'].t), JSON.stringify(sl['-FA1']));
  check('chrániče -FI1 a -FI2 se svorkami 1/2 a popisem 40 A 30 mA typ A', ['-FI1', '-FI2'].every(o => sl[o] && sl[o].zn === 'chranic' && /40 A 30 mA typ A/.test(sl[o].t) && /\| 1 \| 2/.test(sl[o].t)),
    JSON.stringify(sl['-FI1']));
  check('RCBO -FI/FA1 (značka RCBO, B16 30 mA typ A) a AFDD -FA14', sl['-FI/FA1'] && /^rcbo,/.test(sl['-FI/FA1'].zn) && /B16 30 mA typ A/.test(sl['-FI/FA1'].t) &&
    sl['-FA14'] && /^afdd,/.test(sl['-FA14'].zn) && /AFDD B16/.test(sl['-FA14'].t), JSON.stringify([sl['-FI/FA1'], sl['-FA14']]));
  check('spotřebič z názvu: „Osvětlení" → světlo, „Zásuvky" → zásuvka, „Kuchyň – linka" → jiné, ručně motor',
    /,svetlo$/.test(sl['-FA2'].zn) && /,zasuvka$/.test(sl['-FA4'].zn) && /,jine$/.test(sl['-FA8'].zn) && /,motor$/.test(sl['-FA7'].zn), [sl['-FA2'].zn, sl['-FA4'].zn, sl['-FA8'].zn, sl['-FA7'].zn].join(' '));
  check('1f bez fáze → „L? · CYKY-J 3×2,5" (červeně)', /L\? · CYKY-J 3×2,5/.test(sl['-FA4'].t) && /fill="#b00000"[^>]*>L\? ·/.test(L[1].svg), sl['-FA4'].t);
  check('napájení podružného rozvaděče: místo spotřebiče „RS1"', /RS1/.test(sl['-FA9'].t) && sl['-FA9'].zn === 'jistic', JSON.stringify(sl['-FA9']));
  check('tabulka pod schématem: OBVOD č. a Pi /kW/ — 1, 2 a 9,6, prázdné Pi = „–"', t2.includes('OBVOD č.') && t2.includes('Pi /kW/') && t2.includes('9,6') && t2.includes('–'));
  const ps1 = await presahy(p, L[1].svg), ps0 = await presahy(p, L[0].svg);
  check('nic nepřetéká rám ani nezasahuje do razítka (list 1 i 2)', !ps0.length && !ps1.length, ps0.concat(ps1).slice(0, 6).join(' · '));
  check('výkres jen z jednoduchých prvků: žádné class, style, filter, mask, foreignObject, image', L.every(l => !/ class=| style=|<filter|<mask|<foreignObject|<image|<use/.test(l.svg)));

  // ── 4. klik na přístroj → Návrh s vybraným přístrojem; ◀ ▶ a zoom ────
  await p.click('[data-action="tdRSchList"][data-smer="1"]'); await w(200);
  const kl = await p.evaluate(() => {
    const info = document.getElementById('rz-sch-info').textContent, s = document.querySelector('#rz-sch-ram svg'), w0 = +s.getAttribute('width');
    return { info, w0 };
  });
  await p.click('[data-action="tdRSchZoom"][data-smer="1"]'); await w(150);
  const w1 = await p.evaluate(() => +document.querySelector('#rz-sch-ram svg').getAttribute('width'));
  check('▶ přepne na „List 2 / 2 · jednopólové schéma", ＋ zvětší', kl.info === 'List 2 / 2 · jednopólové schéma · A4' && w1 > kl.w0 * 1.2, kl.info + ' ' + kl.w0 + '→' + w1);
  const cil = await p.evaluate(() => { const vse = []; __rz.rady.forEach(r => r.prvky.forEach(x => vse.push(x))); return vse.filter(x => x.ozn === '-FA5')[0].uid; });
  await p.evaluate(uid => document.querySelector('#rz-sch-ram g[data-puid="' + uid + '"] text').scrollIntoView({ block: 'center' }), cil);
  await p.click('#rz-sch-ram g[data-puid="' + cil + '"] text >> nth=0'); await w(300);
  const po = await p.evaluate(() => ({ zal: __rz.zalozka, vyber: __rz.vyber, navrh: !document.getElementById('rz-pan-navrh').hidden,
    vl: (document.querySelector('#rz-vlastnosti .rp-hlava') || {}).textContent }));
  check('klik na přístroj ve výkresu → záložka Návrh s vybraným -FA5 a jeho vlastnostmi', po.zal === 'navrh' && po.navrh && po.vyber === cil && /-FA5/.test(po.vl), JSON.stringify(po));
  // odkaz z řádku „chybí" vybere přístroj
  await p.click('.rz-zal[data-z="sch"]'); await w(300);
  await p.click('#rz-sch-chybi [data-action="tdRSchVybrat"] >> nth=0'); await w(300);
  const po2 = await p.evaluate(() => { const z = rozvNajit(__rz.vyber); return { zal: __rz.zalozka, ozn: z && z.x.ozn }; });
  check('odkaz v řádku „chybí" vybere -FA4 v Návrhu', po2.zal === 'navrh' && po2.ozn === '-FA4', JSON.stringify(po2));

  // ── 5. vlastnosti: spotřebič ve schématu, obvod, Pi ───────────────────
  const vl = await p.evaluate(() => {
    const s = document.querySelector('#rz-vlastnosti [data-rp2="spotr"]');
    const o = { prvni: s && s.options[0].textContent, volby: s && Array.from(s.options).map(x => x.value).join(','), obvod: !!document.querySelector('#rz-vlastnosti [data-rp2="obvod"]'),
      pi: !!document.querySelector('#rz-vlastnosti [data-rp2="pi"]') };
    const v = document.querySelector('#rz-vlastnosti [data-rp2="vyvod"]'); v.value = 'Koupelna – světlo'; v.dispatchEvent(new Event('input', { bubbles: true }));
    o.prvni2 = s.options[0].textContent;
    s.value = 'motor'; s.dispatchEvent(new Event('change', { bubbles: true }));
    o.ulozeno = rozvNajit(__rz.vyber).x.spotr;
    s.value = ''; s.dispatchEvent(new Event('change', { bubbles: true }));
    o.smazano = !('spotr' in rozvNajit(__rz.vyber).x);
    v.value = 'Zásuvky – ložnice'; v.dispatchEvent(new Event('input', { bubbles: true }));
    return o;
  });
  check('vlastnosti: „Spotřebič ve schématu" = „podle názvu (zásuvka)", zásuvka/světlo/motor/jiné, Obvod č., Pi', vl.prvni === 'podle názvu (zásuvka)' && vl.volby === ',zasuvka,svetlo,motor,jine' && vl.obvod && vl.pi, JSON.stringify(vl));
  check('předpověď se mění s názvem a neukládá se (uloží se jen ruční volba)', vl.prvni2 === 'podle názvu (světlo)' && vl.ulozeno === 'motor' && vl.smazano, JSON.stringify(vl));

  // ── 6. MET, předřazený jistič, A3 ─────────────────────────────────────
  await p.evaluate(() => { __T.dk('[data-dk="privodJistic"]', '3×40 A, char. B'); });
  await p.click('.rz-zal[data-z="sch"]'); await w(300);
  await p.evaluate(() => { const d = document.querySelector('details[data-oddil="schema"]'); d.open = true; });
  await p.check('[data-dk="schema.metKreslit"]');
  await p.fill('.rz-sch-met', 'vodovod\nplyn\nústřední topení'); await w(500);
  const Lm = await p.evaluate(() => { const d = __T.cist(); return { met: d.schema.met, kr: d.schema.metKreslit, l: rozvSchemaListy(d)[1].svg }; });
  const tm = txt(Lm.l);
  check('MET vpravo (zaškrtnuté): „MET", vodovod, plyn, ústřední topení + uzemnění; v datech seznam řádků', tm.includes('MET') && ['vodovod', 'plyn', 'ústřední topení'].every(x => tm.includes(x)) &&
    /data-znacka="uzemneni"|<g transform="translate\([\d.]+ [\d.]+\)"><line/.test(Lm.l) && Lm.kr === true && JSON.stringify(Lm.met) === '["vodovod","plyn","ústřední topení"]', JSON.stringify(Lm.met));
  check('předřazený jistič: čárkovaný „Elektroměrový rozvaděč" s jističem „3×40 A, char. B" a In 40 A', tm.includes('Elektroměrový rozvaděč') && tm.includes('3×40 A, char. B') && tm.includes('In 40 A'));
  check('s MET pořád nic nepřetéká', !(await presahy(p, Lm.l)).length);
  await p.selectOption('[data-dk="schema.format"]', 'A3'); await w(500);
  const a3 = await p.evaluate(() => { const L = rozvSchemaListy(__T.cist()); return { n: L.length, W: L[0].g.W, H: L[0].g.H, info: document.getElementById('rz-sch-info').textContent, kap: L[1] && rsGeom('A3', true, true).kap, kap4: rsGeom('A4', true, true).kap }; });
  check('A3: listy 420 × 297, na list se vejde víc sloupců (písmo stejné)', a3.W === 420 && a3.H === 297 && a3.kap > a3.kap4 && /A3$/.test(a3.info), JSON.stringify(a3));

  // ── 7. vektorové PDF jen schématu ─────────────────────────────────────
  await p.evaluate(async () => { await TD_AKCE.tdRSchPdf(); }); await w(500);
  const nah = await p.evaluate(() => ({ n: dokPdfStranky().length, a3: dokPdfStranky().every(s => s.classList.contains('rz-sch-a3')), info: document.getElementById('dok-pdf-info').textContent, nazev: dokPdfNazev() }));
  check('🖨 Tisk schématu: náhled 2 listy A3, název ROZ-…_schema_RH1.pdf', nah.n === 2 && nah.a3 && /^ROZ-\d+_schema_RH1\.pdf$/.test(nah.nazev) && /2 listy · A3 na šířku/.test(nah.info), JSON.stringify(nah));
  const pdfUloz = async (soubor) => {
    const r = await p.evaluate(async () => {
      const blob = await renderPagesToPDF(dokPdfStranky(), 'x.pdf', { vratitBlob: true }); if (!blob) return null;
      const a = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode.apply(null, a.subarray(i, i + 8192));
      return { b64: btoa(s), vekt: window.__pdfVektor };
    });
    if (r) fs.writeFileSync(soubor, Buffer.from(r.b64, 'base64'));
    return r;
  };
  const f1 = path.join(BEH, 'schema-a3.pdf'), r1 = await pdfUloz(f1);
  let info1 = '', fonty1 = '', text1 = '';
  try { info1 = execFileSync('pdfinfo', [f1]).toString(); fonty1 = execFileSync('pdffonts', [f1]).toString(); text1 = execFileSync('pdftotext', [f1, '-']).toString(); } catch (e) { info1 = String(e); }
  check('PDF schématu je vektorové (svg2pdf), 2 strany A3', r1 && r1.vekt === true && /Pages:\s+2/.test(info1) && /1190\.55 pts \(A3\)|841\.89 x 1190\.55/.test(info1), (info1.match(/Pages.*|Page size.*/g) || []).join(' '));
  check('písmo RozvSchema vložené v PDF, háčky jako text („Rozvaděč RH1", „Osvětlení – pokoje", „Ochrana před nebezpečným dotykem")',
    /RozvSchema\s+CID TrueType\s+Identity-H\s+yes/.test(fonty1) && /Rozvaděč RH1/.test(text1) && /Osvětlení – pokoje/.test(text1) && /Ochrana před nebezpečným dotykem/.test(text1), fonty1.split('\n').slice(2, 4).join(' / '));
  check('PDF schématu je malé (pod 200 kB)', fs.existsSync(f1) && fs.statSync(f1).size < 200000, fs.existsSync(f1) ? fs.statSync(f1).size + ' B' : '');

  // ── 8. schéma v souhrnném PDF (Dokumenty) ─────────────────────────────
  await p.evaluate(() => TD_AKCE.tdPdfZpet()); await w(300);
  await p.evaluate(() => rozvZalozkaNastavit('dok')); await w(300);
  const vyb = await p.evaluate(() => Array.from(document.querySelectorAll('.rz-dok-vyber input')).map(i => (i.checked ? '☑' : '☐') + i.parentNode.textContent.trim()).join('|'));
  check('Dokumenty: zaškrtávátko „schéma zapojení" (výchozí zapnuté) za čelním pohledem', vyb === '☑čelní pohled a seznam přístrojů|☑schéma zapojení|☑technické údaje|☑prohlášení o shodě|☑protokol o kusovém ověření|☐ověření oteplení (příloha)|☐popisky pod přístroje', vyb);
  await p.evaluate(async () => { await TD_AKCE.tdRDokPdf(); }); await w(600);
  const sou = await p.evaluate(() => dokPdfStranky().map(s => s.classList.contains('rz-sch-strana') ? 'S' + (s.classList.contains('rz-sch-a3') ? '3' : '4') : (s.classList.contains('a4-landscape') ? 'L' : 'P')).join(''));
  check('souhrnné PDF: čelní pohled (na šířku), pak 2 listy schématu A3, pak strany na výšku', /^L+S3S3P+$/.test(sou), sou);
  const f2 = path.join(BEH, 'schema-souhrn.pdf'), r2 = await pdfUloz(f2);
  let info2 = ''; try { info2 = execFileSync('pdfinfo', ['-f', '1', '-l', '20', f2]).toString(); } catch (e) {}
  const vel = (info2.match(/Page\s+\d+ size:\s+[\d.]+ x [\d.]+/g) || []).map(x => /1190/.test(x) ? '3' : '4').join('');
  check('souhrnné PDF: listy schématu A3 vektorově mezi stranami A4', r2 && r2.vekt === true && /^4+334+$/.test(vel), vel);

  // ── 9. velká skříň 6×24 se 60 vývody (A4) ─────────────────────────────
  await p.evaluate(async () => {
    await dokNovy('rozv');
    __T.dk('[data-dk="oznaceni"]', 'RS2'); __T.dk('[data-dk="stavba"]', 'Vymyšlená dílna, Polní 7'); __T.dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-6x24-ocel'));
    let n = 0;
    const fa = (r, nadr) => { n++; const x = rozvVlozit(n % 3 ? 'v-fa-1-B16' : 'v-fa-1-B10', r, __rz.rady[r].prvky.length);
      Object.assign(x, { vyvod: (n % 3 ? 'Zásuvky ' : 'Osvětlení ') + 'místnost ' + n, faze: ['L1', 'L2', 'L3'][n % 3], kabel: 'CYKY-J', prurez: '3×2,5', obvod: String(n) });
      if (nadr) { x.nadr = nadr; x.nadrRucne = true; } };
    const fi1 = rozvVlozit('v-fi-4-40-30-A', 0, 0);
    for (let i = 0; i < 20; i++) fa(0);
    for (let i = 0; i < 10; i++) fa(1, fi1.uid);   // skupina -FI1 má 30 obvodů (víc než list)
    rozvVlozit('v-fi-4-40-30-A', 1, __rz.rady[1].prvky.length); for (let i = 0; i < 10; i++) fa(1);
    rozvVlozit('v-fi-4-40-30-A', 2, 0); for (let i = 0; i < 10; i++) fa(2);
    rozvVlozit('v-fi-4-40-30-A', 3, 0); for (let i = 0; i < 10; i++) fa(3);
    rozvVlozit('v-qm-3-63', 4, 0); rozvVlozit('v-km-25-4', 4, 1); rozvVlozit('v-kt-hodiny', 4, 2);
    rozvNadrazeneAuto(); rozvPohledVykreslit(); dokZmena(); await dokUlozitOtevreny();
  });
  const V = await p.evaluate(() => {
    const d = __T.cist(), m = rsModel(d), L = rozvSchemaListy(d), Lr = rsRozlozit(m, 'A4', false);
    return { n: rozvDokPrvky(d).filter(x => x.p.kat === 'FA').length, svg: L.map(l => l.svg),
      listy: Lr.map(l => l.kusy.map(k => (k.fi ? k.fi.ozn : 'x') + ':' + k.n + (k.pred ? '<' : '') + (k.dalsi ? '>' : '')).join(' ')) };
  });
  check('velká skříň: 60 vývodů, 5 listů (osazení + 4 listy schématu)', V.n === 60 && V.svg.length === 5, V.n + ' / ' + V.svg.length + ' · ' + V.listy.join(' ‖ '));
  check('zlom jen na hranici skupiny; skupina -FI1 (31 sloupců) rozdělená na dva listy, -FI2 se ke zbytku nevejde → nový list', V.listy.join(' ‖ ') === '-FI1:18> ‖ -FI1:13< ‖ -FI2:11 -FI3:11 ‖ -FI4:11', V.listy.join(' ‖ '));
  const tv = V.svg.map(txt);
  const odk = tv[1].filter(x => /pokračuje na \/3\./.test(x)), odk2 = tv[2].filter(x => /pokračování z \/2\./.test(x));
  check('odkazy oběma směry: „-FI1 pokračuje na /3.x" a „-FI1 (pokračování z /2.y)"', odk.some(x => /^-FI1 pokračuje na \/3\.\d$/.test(x)) && odk2.some(x => /^-FI1 \(pokračování z \/2\.\d\)$/.test(x)), odk.concat(odk2).join(' | '));
  check('sběrnice L, N, PE pokračují na další list a navazují z předchozího', tv[1].some(x => /^L, N, PE pokračují na \/3\.\d$/.test(x)) && tv[2].some(x => /^L, N, PE z \/2\.\d$/.test(x)) &&
    tv[4].some(x => /^L, N, PE z \/4\.\d$/.test(x)) && !tv[4].some(x => /pokračují na/.test(x)));
  const lv = tv.map(t => t[t.indexOf('Listů') + 1] + '/' + t[t.indexOf('Výkres') + 1]);
  check('razítko: Listů 5, Výkres 1–5', lv.join(' ') === '5/1 5/2 5/3 5/4 5/5', lv.join(' '));
  check('každý list má celý rám, razítko a sběrnice', V.svg.every(s => /data-ram="1"/.test(s) && /data-razitko="1"/.test(s)) && tv.slice(1).every(t => t.includes('PE') && t.includes('N')));
  check('poznámka: ovládací obvody (-KM1, -KT1) se nekreslí', tv[1].some(x => /^Ovládací obvody nejsou na výkresu zakresleny/.test(x)) && tv[1].includes('-KM1') && tv[1].includes('-KT1'));
  const pres = []; for (const s of V.svg) pres.push(...(await presahy(p, s)));
  check('velká skříň: nic nepřetéká rám ani razítko na žádném listu', !pres.length, pres.slice(0, 6).join(' · '));

  // ── 10. starý rozvaděč beze změny ─────────────────────────────────────
  const stary = await p.evaluate(async () => {
    const x = DOK.dokumenty.filter(z => z.typ === 'rozv' && z.data.oznaceni === 'RS1')[0];
    const pred = JSON.stringify(x.data);
    await dokOtevrit(x.uid); rozvZalozkaNastavit('sch'); await new Promise(r => setTimeout(r, 300)); rozvZalozkaNastavit('navrh');
    await new Promise(r => setTimeout(r, 1200));
    const po = JSON.stringify(DOK.dokumenty.filter(z => z.uid === x.uid)[0].data);
    return { stejne: pred === po, schema: 'schema' in JSON.parse(po) };
  });
  check('starý rozvaděč (bez údajů schématu): otevření a záložka Schéma data nezmění', stary.stejne && !stary.schema, JSON.stringify(stary));

  // ── 11. data revizí beze změny, telefon ───────────────────────────────
  check('data revizí po práci se schématem bajtově stejná', (await otisk()) === otiskPred);
  await p.setViewportSize({ width: 375, height: 800 }); await w(300);
  await p.evaluate(async () => { const x = DOK.dokumenty.filter(z => z.typ === 'rozv' && z.data.oznaceni === 'RH1')[0]; await dokOtevrit(x.uid); rozvZalozkaNastavit('sch'); });
  await w(400);
  const tel = await p.evaluate(() => {
    const g = document.querySelector('.rz-sch-tisk').getBoundingClientRect(), r = document.getElementById('rz-sch-ram');
    return { sirka: Math.round(g.width), sw: document.documentElement.scrollWidth, ram: r.scrollWidth >= r.clientWidth };
  });
  check('telefon 375 px: hlavní akce přes celou šířku, stránka se do strany neposouvá', tel.sirka > 280 && tel.sw <= 375, JSON.stringify(tel));

  check('bez chyb na stránce', !err.length, err.slice(0, 3).join(' | '));
  await b.close();
  console.log(res.join('\n'));
  const spatne = res.filter(r => r.startsWith('❌')).length;
  console.log('\n' + (res.length - spatne) + ' / ' + res.length + ' v pořádku');
  process.exit(spatne ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.log('SELHALO: ' + e.stack); process.exit(1); });
