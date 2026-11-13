// Rozvaděč — návod k obsluze a údržbě (ČSN EN IEC 61439-1 ed. 3, čl. 6.2.2), DBO i PSC.
// Hlídá: oddíl „📘 Návod k obsluze" v Dokumentech a tlačítko „📘 Tisk návodu", obsah návodu z návrhu
// (identifikace, kdo smí obsluhovat, tabulka přístrojů, běžná obsluha), interval zkoušky chráničů
// tlačítkem TEST podle výrobce (tabulka od uživatele, jen shoda podle tabulky, smíšené intervaly po
// přístrojích a doporučení, ruční přepsání), že se nevymýšlí (rozvaděč bez chrániče / SPD / pojistek
// nemá jejich odstavce, žádné cizí číslo intervalu), vstupní QF a PSC (osoba poučená / znalá),
// úpravu textu a ↺ výchozí, vypnutý a vlastní oddíl (+ posun, smazání, Ctrl+Z), samostatný tisk
// (A4 na výšku, „Strana i / N", záhlaví), souhrnné PDF až po zaškrtnutí, tip v „Co ještě chybí",
// že se data neotevřením nemění a data revizí zůstanou bajtově stejná.
// (Starý rozvaděč bajtově proti předchozí verzi hlídá test-rozvadec-stara-data.js.)
// Vše vymyšlené (byt 3+1 z testy/rozvadec-byt.js, hala PSC z testy/rozvadec-psc-hala.js).
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
    STORE.technik = Object.assign({}, STORE.technik, { jmeno: 'Petr Vymyšlený', firma: 'Vymyšlená elektro s.r.o.', ico: '12345678', mesto: 'Kyjov' });
    saveStore();
    window.__T = {
      w: ms => new Promise(r => setTimeout(r, ms)),
      dk: (s, v) => { const e = dokForm().querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); },
      zatrh: (s, v) => { const e = dokForm().querySelector(s); e.checked = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); },
      pdf: () => document.getElementById('dok-pdf-pages').innerText,
      prv: () => { const a = []; __rz.rady.forEach(r => r.prvky.forEach(x => a.push(x))); return a; }
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
  const otiskPred = await otisk();

  // ── 1. oddíl a tlačítko v Dokumentech ─────────────────────────────────
  await p.evaluate(() => rozvZalozkaNastavit('dok')); await w(300);
  const o1 = await p.evaluate(() => {
    const det = document.querySelector('#rz-pan-dok details[data-oddil="navod"]');
    const c = dokForm().querySelector('[data-dk="dokVyber.navod"]'), t = document.querySelector('#rz-pan-dok [data-action="tdRNavod"]');
    return { det: !!det, titul: det && det.querySelector('summary').textContent, zavreny: det && !det.open,
      zatrh: c && !c.checked && c.parentNode.textContent.trim(), tisk: t && t.textContent.trim(),
      tiskObrys: t && t.classList.contains('rz-dok-tisk2'), hlavni: document.querySelector('#rz-pan-dok .rz-dok-generuj').textContent.trim(),
      sekci: det ? det.querySelectorAll('[data-nv-on]').length : 0,
      vedleStitku: t && t.parentNode === document.querySelector('[data-action="tdRStitek"]').parentNode };
  });
  check('Dokumenty: sbalený oddíl „📘 Návod k obsluze"', o1.det && o1.titul === '📘 Návod k obsluze' && o1.zavreny, JSON.stringify(o1));
  check('zaškrtávátko „návod k obsluze" (výchozí vypnuto) a obrysové „📘 Tisk návodu" vedle štítku, hlavní akce beze změny',
    o1.zatrh === 'návod k obsluze' && o1.tisk === '📘 Tisk návodu' && o1.tiskObrys && o1.vedleStitku && /Vygenerovat dokumentaci/.test(o1.hlavni));
  check('osm oddílů návodu (každý jde vypnout)', o1.sekci === 8, o1.sekci);

  // ── 2. data se otevřením nezmění, nic se nezapíše ─────────────────────
  const d2 = await p.evaluate(async () => { await dokUlozitOtevreny(); const o = window.__dokOtevreny.data; return { nav: 'navod' in o, vyb: !!(o.dokVyber && 'navod' in o.dokVyber), cist: JSON.stringify(DOK_TYPY.rozv.cist(dokForm())).indexOf('navod') };
  });
  check('po návštěvě Dokumentů a uložení v datech není `navod` ani `dokVyber.navod`', !d2.nav && !d2.vyb && d2.cist === -1, JSON.stringify(d2));

  // ── 3. samostatný tisk návodu (byt 3+1) ───────────────────────────────
  await p.evaluate(async () => { await TD_AKCE.tdRNavod(); }); await w(500);
  const n3 = await p.evaluate(() => {
    const st = Array.from(document.querySelectorAll('#dok-pdf-pages .a4')), t = __T.pdf(), prv = __T.prv().filter(x => ['X', 'XN', 'XPE', 'PRISL', 'VNEJSI', 'REZ'].indexOf(x.p.kat) === -1);
    return { obr: document.getElementById('screen-dok-pdf').classList.contains('active') || !!document.querySelector('#screen-dok-pdf.active'),
      stran: st.length, naSirku: st.some(s => s.classList.contains('a4-landscape')), t,
      zahlavi: (document.querySelector('#dok-pdf-pages .dok-pdf-zahlavi') || {}).innerText,
      patka: Array.from(document.querySelectorAll('#dok-pdf-pages .dok-pdf-strana')).map(e => e.textContent),
      radku: Array.from(document.querySelectorAll('#dok-pdf-pages .rz-nv-tab tr')).filter(r => !r.querySelector('th')).length, prvku: prv.length,
      hl: Array.from(document.querySelectorAll('#dok-pdf-pages .rz-nv-hl td:nth-child(2)')).map(e => e.textContent),
      info: document.getElementById('dok-pdf-info').textContent, nazev: __dokPdf.nazev, ostatni: /Čelní pohled|PROHLÁŠENÍ O SHODĚ|KUSOVÉM OVĚŘENÍ|Technické údaje rozvaděče/i.test(t) };
  });
  check('Tisk návodu: samostatný dokument A4 na výšku, „Strana i / N", záhlaví s označením a výr. č.',
    n3.stran >= 1 && !n3.naSirku && /^Strana 1 \/ \d+$/.test(n3.patka[0]) && /Návod k obsluze · RH1/.test(n3.zahlavi) && /Výrobní číslo: \d{4}-\d{4}/.test(n3.zahlavi) && !n3.ostatni, JSON.stringify([n3.stran, n3.patka, n3.zahlavi]));
  check('název „Návod k obsluze a údržbě", 8 očíslovaných oddílů v pořadí, informace v liště',
    /Návod k obsluze a údržbě/i.test(n3.t) && /1\. Identifikace rozvaděče[\s\S]*2\. Kdo smí rozvaděč obsluhovat[\s\S]*3\. Přehled přístrojů a obvodů[\s\S]*4\. Běžná obsluha[\s\S]*5\. Instalace a připojení[\s\S]*6\. Manipulace a doprava[\s\S]*7\. Údržba a revize[\s\S]*8\. Likvidace/.test(n3.t) && /Návod k obsluze a údržbě · \d+ (strana|strany|stran) na výšku/.test(n3.info) && /_navod\.pdf$/.test(n3.nazev), n3.info + ' ' + n3.nazev);
  check('identifikace: označení RH1, typ, výrobní číslo, norma ČSN EN IEC 61439-3, krytí IP40 / IP20, Un, InA',
    /Označení rozvaděče\s+RH1/.test(n3.t) && /Jmenovitý proud InA\s+40 A/.test(n3.t) && /Typové označení\s+RH1 DBO/.test(n3.t) && /Výrobní číslo\s+\d{4}-\d{4}/.test(n3.t) && /ČSN EN IEC 61439-3/.test(n3.t) && /IP40 \/ IP20/.test(n3.t) && /400\/230 V/.test(n3.t));
  check('tabulka přístrojů a obvodů: řádek za každý přístroj z návrhu, zvýrazněný hlavní vypínač a chrániče',
    n3.radku === n3.prvku && n3.radku >= 12 && n3.hl.length >= 3 && /QM|vypínač/i.test(n3.hl.join(' ')) && /Sporák/.test(n3.t) && /Balkon – venkovní zásuvka/.test(n3.t), JSON.stringify([n3.radku, n3.prvku, n3.hl]));
  check('DBO: laik smí zapínat / vypínat, kryty jen osoba znalá; vstupní přístroj je vypínač (věta o poučené osobě není)',
    /laik/.test(n3.t) && /Kryty a zakrytí smí sejmout jen osoba znalá/.test(n3.t) && !/Vstupní přístroj/.test(n3.t));
  check('běžná obsluha: hlavní vypínač, vybavení, TEST chráničů (obecný chránič = podle návodu výrobce), svodič; bez pojistek (v bytu nejsou)',
    /Celý rozvaděč vypnete hlavním vypínačem -QH1/.test(n3.t) && /nejdřív odpojte nebo vypněte spotřebič/.test(n3.t) && /tlačítkem TEST v intervalu podle návodu výrobce chrániče/.test(n3.t) && /Svodič přepětí \(SPD1\)/.test(n3.t) && !/Pojistky:/.test(n3.t));
  check('nevymýšlí se: žádný interval ani lhůta v měsících / letech, momenty podle výrobce', !/\d+\s*(měsíc|měsíce|měsíců|roky|roků|let)\b/.test(n3.t) && /Utahovací momenty a průřezy svorek: podle návodu výrobce/.test(n3.t) && /Lhůtu pravidelných revizí určí revizní technik podle ČSN 33 1500/.test(n3.t));

  // ── 4. interval zkoušky TEST podle výrobce ────────────────────────────
  const iv = await p.evaluate(() => {
    const f = (v, r, t) => { const q = navodRcdInterval({ vyrobce: v, rada: r || '', typ: t || '' }); return q ? q.mesice : null; };
    return { oez: f('OEZ', 'LFN'), oez2: f('OEZ', '', 'OLI 10B/2/030/A'), oezNe: f('OEZ', 'LTN'), moeller: f('Moeller', 'PF7'), eatonPf6: f('Eaton', 'PF6'), pfl: f('Eaton', 'PFL7'), pfim: f('Eaton', 'PFIM'),
      acti: f('Schneider Electric', 'Acti9 iID'), merlin: f('Merlin Gerin', 'Multi9'), schnMulti: f('Schneider', 'Multi9'), hager: f('Hager', 'CD425'), hagerNe: f('Hager', 'CDC'),
      schrack: f('Schrack', 'BCF6'), schrackAr: f('Schrack', 'AMPARO AR'), abb: f('ABB', 'F200'), obecny: f('obecný', 'LFN'), bez: f('', 'LFN'), nic: f('OEZ', '') };
  });
  check('tabulka výrobců: OEZ LFN / OLI 6, Eaton PF6 / PF7 6 (Moeller = Eaton), PFL 1, Schneider Acti9 iID 6, Merlin Gerin Multi9 1, Hager CD 6, Schrack BCF 1',
    iv.oez === 6 && iv.oez2 === 6 && iv.moeller === 6 && iv.eatonPf6 === 6 && iv.pfl === 1 && iv.acti === 6 && iv.merlin === 1 && iv.schnMulti === 6 && iv.hager === 6 && iv.schrack === 1, JSON.stringify(iv));
  check('mimo tabulku = bez intervalu (OEZ LTN, Eaton PFIM, Hager CDC, Schrack AMPARO AR, ABB, obecný, bez řady, bez výrobce)',
    [iv.oezNe, iv.pfim, iv.hagerNe, iv.schrackAr, iv.abb, iv.obecny, iv.bez, iv.nic].every(x => x === null), JSON.stringify(iv));

  const nast = (a, b2, c) => p.evaluate(([a, b2, c]) => {
    const r = __T.prv().filter(x => x.p.kat === 'FI' || x.p.kat === 'FIFA');   // -FI1, -FI2, -FI/FA1
    [a, b2, c].forEach((q, i) => { r[i].p.vyrobce = q[0]; r[i].p.rada = q[1]; });
    return { oz: r.map(x => x.ozn).join(','), kat: r.map(x => x.p.kat).join(',') };
  }, [a, b2, c]);
  const text = () => p.evaluate(() => navodRcdText(DOK_TYPY.rozv.cist(dokForm())));
  const k0 = await nast(['obecný', ''], ['obecný', ''], ['obecný', '']);
  check('fixtura: dva chrániče a RCBO', k0.kat === 'FI,FI,FIFA', JSON.stringify(k0));
  await nast(['OEZ', 'LFN'], ['OEZ', 'LFN'], ['OEZ', 'OLI']);
  const t1 = await text();
  check('všechny chrániče OEZ → jedna věta „jednou za 6 měsíců“', t1 === 'Chrániče zkoušejte tlačítkem TEST jednou za 6 měsíců.', t1);
  await nast(['OEZ', 'LFN'], ['OEZ', 'LFN'], ['Eaton', 'PFL7']);
  const t2 = await text();
  check('OEZ LFN + Eaton PFL7 → seznam po přístrojích a doporučení „jednou za 1 měsíc“',
    /v těchto intervalech:\n– -FI1 OEZ LFN: 6 měsíců\n– -FI2 OEZ LFN: 6 měsíců\n– -FI\/FA1 Eaton PFL7: 1 měsíc\nNejjednodušší je zkoušet všechny chrániče jednou za 1 měsíc \(nejkratší interval\)\./.test(t2), t2);
  await nast(['OEZ', 'LFN'], ['obecný', ''], ['Schrack', 'AR 40']);
  const t3 = await text();
  check('část chráničů bez údaje → u nich „podle návodu výrobce“, nejkratší jen ze známých',
    /– -FI1 OEZ LFN: 6 měsíců\n– -FI2: podle návodu výrobce\n– -FI\/FA1 Schrack AR 40: podle návodu výrobce\nNejjednodušší je zkoušet všechny chrániče jednou za 6 měsíců \(nejkratší ze známých interval\)/.test(t3), t3);
  await nast(['Schrack', 'AR 40'], ['Schrack', 'AR 40'], ['Schrack', 'AR 40']);
  const t4 = await text();
  check('Schrack AR (mimo tabulku) → „podle návodu výrobce“, bez čísla', /v intervalu podle návodu výrobce chrániče\.$/.test(t4) && !/\d/.test(t4), t4);
  await nast(['Moeller', 'PF7'], ['Moeller', 'PF7'], ['Eaton', 'PF6']);
  const t5 = await text();
  check('Moeller PF7 = Eaton → 6 měsíců', t5 === 'Chrániče zkoušejte tlačítkem TEST jednou za 6 měsíců.', t5);
  await nast(['OEZ', 'LFN'], ['OEZ', 'LFN'], ['Eaton', 'PFL7']);
  await p.evaluate(() => { __T.dk('[data-dk="navod.rcdInterval"]', '3 měsíce'); });
  const t6 = await text();
  check('ruční pole „Zkouška chráničů“ přepíše vše — jedna věta', t6 === 'Chrániče zkoušejte tlačítkem TEST jednou za 3 měsíce.', t6);
  await p.evaluate(() => { __T.dk('[data-dk="navod.rcdInterval"]', ''); });
  await p.evaluate(() => rozvZalozkaNastavit('navrh')); await w(100); await p.evaluate(() => rozvZalozkaNastavit('dok')); await w(300);
  const nap = await p.evaluate(() => (document.querySelector('#rz-pan-dok .rz-nv-rcd') || {}).textContent);
  check('nápověda u formuláře: „Interval podle výrobce: -FI1 OEZ LFN 6 měsíců (uvedeno v návodech), … Eaton PFL7 1 měsíc (elektronické vyhodnocení)“',
    /^Interval podle výrobce: -FI1 OEZ LFN 6 měsíců \(uvedeno v návodech\), -FI2 OEZ LFN 6 měsíců.*-FI\/FA1 Eaton PFL7 1 měsíc \(elektronické vyhodnocení\)\.$/.test(nap || ''), nap);
  const ta = await p.evaluate(() => (dokForm().querySelector('[data-dk="navod.text.obsluha"]') || {}).value);
  check('textarea „Běžná obsluha“ ukazuje složený text se seznamem intervalů', /– -FI\/FA1 Eaton PFL7: 1 měsíc/.test(ta || ''), ta);

  // ── 5. bez chrániče / SPD / pojistek se nic nevymýšlí; pojistky, QF, PSC ─
  const s5 = await p.evaluate(() => {
    const d = DOK_TYPY.rozv.cist(dokForm()), cp = JSON.parse(JSON.stringify(d));
    cp.rady.forEach(r => { r.prvky = r.prvky.filter(x => ['FI', 'FIFA', 'SPD'].indexOf(x.p.kat) === -1); });
    const o1 = navodVychozi(cp).obsluha;
    const fu = JSON.parse(JSON.stringify(cp)); fu.rady[0].prvky.push({ uid: 'u-fu1', ozn: '-FU1', p: { kat: 'FU', In: '32', poly: '3', sirka: 3 }, vlozka: '25 gG' }, { uid: 'u-fu2', ozn: '-FU2', p: { kat: 'FU', poly: '3', sirka: 3 } });
    const o2 = navodVychozi(fu).obsluha;
    const qf = JSON.parse(JSON.stringify(cp)); qf.rady[0].prvky.unshift({ uid: 'u-qf', ozn: '-QF1', privod: true, p: { kat: 'QF', In: '63', poly: '3', sirka: 3 } });
    const k = navodVychozi(qf);
    return { o1, o2, kdoQf: k.kdo, obsQf: k.obsluha, kdoQm: navodVychozi(cp).kdo };
  });
  check('rozvaděč bez chrániče a SPD: v obsluze není TEST ani svodič (jistič a vypínač zůstávají)', !/TEST/.test(s5.o1) && !/Svodič/.test(s5.o1) && !/Pojistky/.test(s5.o1) && /hlavním vypínačem/.test(s5.o1) && /Když jistič/.test(s5.o1), s5.o1);
  check('pojistky: vložka z návrhu „-FU1: 25 A gG“, bez údaje „-FU2: —“', /Pojistky: vyměňujte jen za vložku stejné velikosti/.test(s5.o2) && /-FU1: 25 A gG; -FU2: —\./.test(s5.o2), s5.o2);
  check('vstupní přístroj QF u DBO: jen poučená nebo znalá osoba (čl. 8.5.3); u vypínače věta není',
    /Vstupní přístroj -QF1 smí ovládat jen osoba poučená nebo znalá \(čl\. 8\.5\.3\)/.test(s5.kdoQf) && /přívodním přístrojem -QF1/.test(s5.obsQf) && !/Vstupní přístroj/.test(s5.kdoQm), s5.kdoQf);

  // ── 6. úprava textu, ↺ výchozí, vypnutý a vlastní oddíl ───────────────
  await p.evaluate(() => { __T.dk('[data-dk="navod.text.manip"]', 'Rozvaděč přepravujte ve svislé poloze.'); });
  const e6 = await p.evaluate(async () => { await dokUlozitOtevreny(); const n = window.__dokOtevreny.data.navod; return JSON.stringify(n); });
  check('přepsaný text se uloží (jen ten jeden klíč)', e6 === '{"text":{"manip":"Rozvaděč přepravujte ve svislé poloze."}}', e6);
  await p.evaluate(async () => { await TD_AKCE.tdRNavod(); }); await w(300);
  const pdf6 = await p.evaluate(() => __T.pdf());
  check('PDF obsahuje přepsaný text, ne výchozí', /přepravujte ve svislé poloze/.test(pdf6) && !/Skladujte v suchém prostředí/.test(pdf6));
  await p.evaluate(() => { showScreen('dok-form'); });
  await p.evaluate(() => { TD_AKCE.tdRNvVychozi(document.querySelector('[data-action="tdRNvVychozi"][data-k="manip"]')); });
  const e7 = await p.evaluate(async () => { await dokUlozitOtevreny(); return { n: 'navod' in window.__dokOtevreny.data, v: (dokForm().querySelector('[data-dk="navod.text.manip"]') || {}).value }; });
  check('↺ výchozí vrátí text a klíč z dat zmizí', !e7.n && /Skladujte v suchém prostředí/.test(e7.v), JSON.stringify(e7));
  await p.evaluate(() => { __T.zatrh('[data-nv-on="likvid"]', false); });
  const e8 = await p.evaluate(async () => { await dokUlozitOtevreny(); return JSON.stringify(window.__dokOtevreny.data.navod); });
  check('vypnutý oddíl se uloží jako vyp.likvid', e8 === '{"vyp":{"likvid":true}}', e8);
  await p.evaluate(() => { TD_AKCE.tdRNvPridat(); TD_AKCE.tdRNvPridat(); const r = document.querySelectorAll('.rz-nv-vl');
    r[0].querySelector('.rz-nv-vl-n').value = 'Kontakt na servis'; r[0].querySelector('.rz-nv-vl-t').value = 'Servisní linka: 800 000 000 (vymyšlené).';
    r[1].querySelector('.rz-nv-vl-n').value = 'Záruka'; r[1].querySelector('.rz-nv-vl-t').value = 'Záruční doba podle smlouvy.';
    r[1].querySelector('.rz-nv-vl-n').dispatchEvent(new Event('input', { bubbles: true })); });
  await p.evaluate(() => TD_AKCE.tdRNvDolu(document.querySelector('.rz-nv-vl [data-action="tdRNvDolu"]')));
  const e9 = await p.evaluate(async () => { await dokUlozitOtevreny(); return window.__dokOtevreny.data.navod.vlastni.map(v => v.nadpis).join('|'); });
  check('dva vlastní oddíly, ▼ prohodí pořadí', e9 === 'Záruka|Kontakt na servis', e9);
  await p.evaluate(async () => { await TD_AKCE.tdRNavod(); }); await w(300);
  const pdf9 = await p.evaluate(() => __T.pdf());
  check('PDF: vlastní oddíly jako 8. a 9., vypnutá Likvidace chybí',
    /7\. Údržba a revize[\s\S]*8\. Záruka[\s\S]*Záruční doba podle smlouvy\.[\s\S]*9\. Kontakt na servis[\s\S]*Servisní linka/.test(pdf9) && !/Likvidace/.test(pdf9), pdf9.slice(-300));
  await p.evaluate(() => { showScreen('dok-form'); });
  await p.evaluate(() => TD_AKCE.tdRNvSmazat(document.querySelector('.rz-nv-vl [data-action="tdRNvSmazat"]')));
  const e10 = await p.evaluate(() => ({ n: document.querySelectorAll('.rz-nv-vl').length }));
  await p.evaluate(() => { zpetPosledni(); });
  const e11 = await p.evaluate(() => ({ n: document.querySelectorAll('.rz-nv-vl').length, prvni: document.querySelector('.rz-nv-vl .rz-nv-vl-n').value }));
  check('🗑 Smazat oddíl a Ctrl+Z / ZPĚT ho vrátí na původní místo', e10.n === 1 && e11.n === 2 && e11.prvni === 'Záruka', JSON.stringify([e10, e11]));
  await p.evaluate(() => { __T.zatrh('[data-nv-on="likvid"]', true); document.querySelectorAll('.rz-nv-vl [data-action="tdRNvSmazat"]').forEach(b => TD_AKCE.tdRNvSmazat(b)); });
  const e12 = await p.evaluate(async () => { await dokUlozitOtevreny(); return 'navod' in window.__dokOtevreny.data; });
  check('po vrácení všeho na výchozí v datech opět žádné `navod`', !e12);

  // ── 7. souhrnné PDF až po zaškrtnutí, za protokolem ───────────────────
  await p.evaluate(async () => { await dokNahled(); }); await w(500);
  const s7a = await p.evaluate(() => __T.pdf());
  check('bez zaškrtnutí není návod v souhrnném PDF', !/Návod k obsluze a údržbě/i.test(s7a) && /KUSOVÉM OVĚŘENÍ/i.test(s7a));
  await p.evaluate(() => { showScreen('dok-form'); __T.zatrh('[data-dk="dokVyber.navod"]', true); });
  await p.evaluate(async () => { await dokNahled(); }); await w(500);
  const s7 = await p.evaluate(() => ({ t: __T.pdf(), strana: Array.from(document.querySelectorAll('#dok-pdf-pages .a4')).map(s => s.classList.contains('a4-landscape') ? 'š' : 'v').join('') }));
  const iKo = s7.t.search(/PROTOKOL O KUSOVÉM OVĚŘENÍ/i), iNav = s7.t.search(/Návod k obsluze a údržbě/i);
  check('zaškrtnutý návod je v souhrnném PDF za protokolem o kusovém ověření (stránky návodu na výšku)', iKo > 0 && iNav > iKo && /v+$/.test(s7.strana), iKo + ' < ' + iNav + ' ' + s7.strana);
  const tip = await p.evaluate(() => rzsKontrola().filter(x => /Návod k obsluze se nepřikládá/.test(x.text)).length);
  check('zaškrtnutý návod: tip „Návod k obsluze se nepřikládá“ zmizel', tip === 0, tip);
  await p.evaluate(() => { showScreen('dok-form'); __T.zatrh('[data-dk="dokVyber.navod"]', false); });
  const tip2 = await p.evaluate(() => { const t = rzsKontrola().filter(x => /Návod k obsluze se nepřikládá/.test(x.text)); return { n: t.length, u: t[0] && t[0].u }; });
  check('nezaškrtnutý návod: v „Co ještě chybí“ šedý tip', tip2.n === 1 && tip2.u === 'tip', JSON.stringify(tip2));
  const tp = await p.evaluate(() => { const L = [{ u: 'tip', text: 'Návod k obsluze se nepřikládá — x', __i: 0 }]; return { s: rzsChybiSouhrnText(L), h: rzsChybiSeznamHtml(L), t: rzsChybiVnitrek(L).indexOf('rzs-souhrn-ok') !== -1, m: rzsChybiSouhrnText(L.concat([{ u: 'upoz', text: 'x' }])) }; });
  check('samé tipy nebrání zelenému „✓ Všechno zapojené“, tipy jsou pod ním jako „Tipy:“; s upozorněním ✓ není',
    tp.s === '✓ Všechno zapojené a doplněné' && /Všechno zapojené a doplněné\.<\/div><div class="rzs-tipy-t">Tipy:<\/div><ul class="rzs-seznam rzs-tipy">/.test(tp.h) && tp.t && /^⚠ Co ještě chybí/.test(tp.m), JSON.stringify(tp));
  const ulozeno = await p.evaluate(async () => { await dokUlozitOtevreny(); const o = window.__dokOtevreny.data; return { nav: 'navod' in o, vyb: !!(o.dokVyber && 'navod' in o.dokVyber) }; });
  check('vypnuté zaškrtávátko se neukládá', !ulozeno.nav && !ulozeno.vyb, JSON.stringify(ulozeno));

  // ── 8. chybějící údaje ────────────────────────────────────────────────
  await p.evaluate(() => { rozvZalozkaNastavit('navrh'); rozvZalozkaNastavit('dok'); }); await w(300);
  const ch1 = await p.evaluate(() => { rozvDokChybiVykreslit(); return document.getElementById('rz-nv-chybi').textContent; });
  check('řádek „Chybí:“ u návodu: kontakt (profil bez telefonu a e-mailu; výrobce se předvyplnil z profilu)', /^Chybí: kontakt$/.test(ch1) && !/označení rozvaděče/.test(ch1) && !/výrobní číslo/.test(ch1), ch1);
  await p.evaluate(() => { __T.dk('[data-zrc="vyrobce.nazev"]', 'Vymyšlená elektro s.r.o.'); __T.dk('[data-dk="navod.kontakt"]', '+420 000 000 000, vymyslene@example.cz'); });
  const ch2 = await p.evaluate(() => document.getElementById('rz-nv-chybi').textContent);
  check('po doplnění „✓ Pro návod je vyplněno vše potřebné“', /✓ Pro návod je vyplněno vše potřebné/.test(ch2), ch2);

  // ── 9. PSC hala: žádná obsluha laikem, ČSN EN 50110-1 ed. 4 ───────────
  await p.evaluate(async () => { showScreen('dok-seznam'); });
  const psc = await p.evaluate(require('./rozvadec-psc-hala.js'));
  await p.evaluate(async () => { rozvZalozkaNastavit('dok'); await __T.w(300); await TD_AKCE.tdRNavod(); }); await w(500);
  const n9 = await p.evaluate(() => ({ t: __T.pdf(), stran: document.querySelectorAll('#dok-pdf-pages .a4').length }));
  check('PSC: jen osoba poučená nebo znalá (ČSN EN 50110-1 ed. 4), obsluha laikem se nepřipouští, norma 61439-2',
    /smí obsluhovat jen osoba poučená nebo znalá \(ČSN EN 50110-1 ed\. 4\)/.test(n9.t) && /Obsluha osobou bez elektrotechnické kvalifikace \(laikem\) se nepřipouští/.test(n9.t) && !/v běžném provozu obsluhovat i osoba bez/.test(n9.t) && /ČSN EN IEC 61439-2/.test(n9.t), n9.t.slice(0, 400));
  check('PSC: tabulka přístrojů (MCCB, odpínač…) je v návodu a není tam nic z DBO („Rozvodnici“)', /Přehled přístrojů a obvodů/.test(n9.t) && !/Rozvodnici smí/.test(n9.t), n9.stran);

  // ── 10. data revizí a chyby ───────────────────────────────────────────
  const otiskPo = await otisk();
  check('data revizí (STORE, archiv) po práci s návodem bajtově stejná', otiskPred === otiskPo);
  check('žádná chyba na stránce', err.length === 0, err.join(' | '));

  await b.close();
  console.log(res.join('\n'));
  const spatne = res.filter(r => r.startsWith('❌')).length;
  console.log('\n' + (res.length - spatne) + ' ✅, ' + spatne + ' ❌');
  process.exit(spatne ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.error(e); process.exit(2); });
