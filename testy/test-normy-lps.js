// Normy – revize LPS podle souboru ČSN EN 62305 (ed. 2 a ed. 3): katalog vad,
// prohlídka, nápovědy měření a převod citací pro volbu „ed. 3" (mapa ed. 2 → ed. 3).
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
  const r = await p.evaluate(async () => {
    novaZprava('lps');
    await new Promise(r => setTimeout(r, 250));
    const s = document.getElementById('lps_prohlidka_norma'); s.value = '62305'; s.dispatchEvent(new Event('change', { bubbles: true })); updateLpsMereniTexts();
    const t = id => (document.getElementById(id) || {}).textContent || '';
    const pro = [].concat.apply([], LPS_PROHLIDKA_62305.map(x => x.items));
    addZavada();
    const volby = Array.from(document.querySelectorAll('.zavada-item select')).map(se => Array.from(se.options).map(o => o.textContent).join(' | ')).join(' || ');
    return { kat: TYPICKE_ZAVADY_LPS, pro, kod: LPS_ZEMNI_KOD, info: t('lps-mereni-info'), zemni: t('lps-metoda-zemni'), prechod: t('lps-metoda-prechod'), volby };
  });
  const K = re => r.kat.find(z => re.test(z.popis)), P = re => r.pro.find(z => re.test(z.t));
  const kat = [
    [/^Naměřený zemní odpor zemniče přesahuje doporučenou hodnotu \(>10 Ω\)$/, 'C2', 'ČSN EN 62305-3 ed.2, čl. 5.4.1'],
    [/^Chybí přepěťová ochrana SPD typu T1/, 'C1', 'ČSN EN 62305-3 ed.2, čl. 6.2; ČSN EN 62305-4 ed.2, kap. 7'],
    [/^Pokročilá koroze/, 'C2', 'ČSN EN 62305-3 ed.2, čl. E.5.6.2.2, E.7'],
    [/^Uvolněné nebo poškozené měřicí \(zkušební\) svorky/, 'C2', 'ČSN EN 62305-3 ed.2, čl. 5.3.6'],
    [/^Svod v místě, kde se zdržují osoby \(do 3 m\), bez opatření proti dotykovému napětí – izolace svodu, zábrana nebo výstraha$/, 'C2', 'ČSN EN 62305-3 ed.2, kap. 8'],
    [/^Nesprávně provedený přechod mezi materiály/, 'C2', 'ČSN EN 62305-3 ed.2, čl. E.5.6.2.2; ČSN 33 2000-5-54 ed.3, čl. 542.2.5'],
    [/^Doporučujeme provést výpočet rizika dle ČSN EN IEC 62305-2 ed\.3/, 'C3', 'ČSN EN IEC 62305-2 ed.3'],
    [/^Doporučujeme doplnit svodiče přepětí SPD typu T2/, 'C3', 'ČSN EN 62305-4 ed.2, kap. 7'],
    [/^Doporučujeme mechanickou ochranu svodu v dosahu osob$/, 'C3', ''],
    [/^Doporučujeme antikorozní ošetření spojů/, 'C3', 'ČSN EN 62305-3 ed.2, čl. E.5.6.2.2']
  ];
  for (const [re, kod, n] of kat) { const z = K(re); check('katalog LPS: ' + String(re).slice(2, 50) + ' → ' + kod + (n ? ' · ' + n : ' · bez článku'), z && z.kod === kod && z.norma === n, z ? z.kod + ' · ' + z.norma : 'nenalezeno'); }
  check('katalog LPS: kód zemního odporu > 10 Ω je konstanta LPS_ZEMNI_KOD = C2', r.kod === 'C2');
  check('katalog LPS: nikde „povolenou", „1,8 m", E.4, 62305-4 čl. 5.6', !r.kat.some(z => /povolenou|1,8 m|čl\. E\.4|62305-4 ed\.2, čl\. 5\.6/.test(z.popis + ' ' + z.norma)));
  check('katalog LPS: štítek „ověřit v ed. 2" jen v nabídce (koroze, přechod materiálů, antikoroze, kap. 8)',
    (r.volby.match(/\[ověřit v ed\. 2\]/g) || []).length === 3 && /\[ověřit číslo v ed\. 2\]/.test(r.volby) && !r.kat.some(z => /ověřit/.test(z.norma)), r.volby.slice(0, 120));
  const pro = [
    [/^Délka zemničů dle třídy LPS$/, 'ČSN EN 62305-3 ed.2, čl. 5.4.2.2, E.5.4.2.2'],
    [/^Provedení uzemnění$/, 'ČSN EN 62305-4 ed.2, čl. 5.2'],
    [/^Zabezpečena co nejnižší hodnota impedance/, 'ČSN EN 62305-4 ed.2, čl. 5.3'],
    [/^SPD koordinovaně umístěny/, 'ČSN EN 62305-4 ed.2, kap. 7']
  ];
  for (const [re, n] of pro) { const z = P(re); check('prohlídka LPS: ' + String(re).slice(2, 40) + ' → ' + n, z && z.csn === n, z ? z.csn : 'nenalezeno'); }
  check('nápověda zemního odporu: doporučení < 10 Ω, je-li to možné (čl. 5.4.1), pospojování',
    /Doporučuje se odpor uzemnění nižší než 10 Ω, je-li to možné \(ČSN EN 62305-3 ed\.2, čl\. 5\.4\.1\)\. Nejúčinnějším opatřením zůstává pospojování\./.test(r.info) && r.info === r.zemni, r.info);
  check('nápověda přechodových odporů: 0,2 Ω „doporučení z praxe", u výztuže ŽB požadavek (čl. 5.3.5)',
    /≤ 0,2 Ω – doporučení z praxe\. U výztuže železobetonu použité jako náhodný svod je 0,2 Ω požadavek normy \(ČSN EN 62305-3 ed\.2, čl\. 5\.3\.5\)\./.test(r.prechod), r.prechod);

  // starší zpráva LPS se starými vadami se načte beze změny (bajtově proti předchozí verzi)
  const D = await p.evaluate(() => {
    novaZprava('lps');
    const D = getData();
    D.ev_cislo = 'RE-25-0042';
    D.zavady = [
      { kod: 'C1', popis: 'Naměřený zemní odpor zemniče přesahuje povolenou hodnotu (>10 Ω)', dalsi: 'svod 3', norma: 'ČSN EN 62305-3 ed.2, čl. 5.4.1', fotky: [] },
      { kod: 'C2', popis: 'Uvolněné nebo poškozené měřicí (zkušební) svorky na svodech', dalsi: '', norma: 'ČSN EN 62305-3 ed.2, čl. 5.3.5', fotky: [] }
    ];
    return D;
  });
  const nacti = async (page) => page.evaluate(async (D) => {
    nacistData(JSON.parse(JSON.stringify(D)));
    await new Promise(r => setTimeout(r, 300));
    return JSON.stringify(getData(), (k, v) => ['uid', 'timestamp', 'ulozeno'].includes(k) ? undefined : v);
  }, D);
  const ps = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  await ps.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  await ps.goto('http://127.0.0.1:' + (process.env.STARA_PORT || 8902) + '/index.html', { waitUntil: 'load' });
  await ps.waitForTimeout(900);
  const jS = await nacti(ps), jN = await nacti(p);
  check('starší zpráva LPS: getData() po načtení bajtově shodné s předchozí verzí', jS === jN, jS.length + ' × ' + jN.length);
  check('starší zpráva LPS: vady se staršími citacemi beze změny', JSON.stringify(JSON.parse(jN).zavady) === JSON.stringify(D.zavady));
  // ── volba ed. 3: citace s čísly článků podle ověřené mapy ed. 2 → ed. 3 ──
  const e3 = await p.evaluate(() => {
    const c = x => citaceNormy(x, '62305e3');
    const o = {
      tab: c('ČSN EN 62305-3 ed.2, čl. 5.3.3, tabulka 4'), e534: c('ČSN EN 62305-3 ed.2, čl. E.5.3.4'),
      d4: c('ČSN EN 62305-4 ed.2, čl. 5.2'), d4b: c('ČSN EN 62305-4 ed.2, kap. 7'), d1: c('ČSN EN 62305-1 ed.2'), d2: c('ČSN EN 62305-2 ed.2'),
      mimo: c('ČSN EN 62305-3 ed.2, čl. 4.2'), mimo2: c('ČSN EN 62305-3 ed.2, čl. E.4.3'),
      tab89: c('ČSN EN 62305-3 ed.2, čl. 6.2.2, tab. 8,9'), kap8: c('ČSN EN 62305-3 ed.2, kap. 8'),
      v1: citaceNormy('ČSN EN 62305-3 ed.2, čl. 5.3.3, tabulka 4', '62305v1'), ed2: citaceNormy('ČSN EN 62305-3 ed.2, čl. 5.3.3, tabulka 4', '62305')
    };
    // žádná citace dílu 3 z programu (katalog, prohlídka, nápovědy), jejíž článek je v mapě, nesmí v ed. 3 ztratit číslo
    const zdroje = [].concat(TYPICKE_ZAVADY_LPS.map(z => z.norma), [].concat.apply([], LPS_PROHLIDKA_62305.map(x => x.items)).map(i => i.csn),
      [document.getElementById('lps-metoda-zemni').textContent, document.getElementById('lps-metoda-prechod').textContent]);
    o.propadle = [];
    zdroje.forEach(t => (t.match(RE_CITACE_ED2) || []).forEach(cit => {
      if (!/^ČSN EN 62305-3/.test(cit) || !/ed\.\s*2[, ]+(čl\.|tab|kap|\d)/.test(cit)) return;
      if (!/ed\.3, (čl\.|tab\.) [A-Z\d]/.test(c(cit))) o.propadle.push(cit + ' → ' + c(cit));
    }));
    const sel = document.getElementById('lps_prohlidka_norma');
    o.volby = Array.from(sel.options).map(x => x.value + '=' + x.textContent).join(' | ');
    o.vychozi = (sel.querySelector('option[selected]') || {}).value;
    return o;
  });
  check('ed. 3: „ČSN EN 62305-3 ed.2, čl. 5.3.3, tabulka 4" → „ČSN EN IEC 62305-3 ed.3, čl. 5.3.3, tab. 5"', e3.tab === 'ČSN EN IEC 62305-3 ed.3, čl. 5.3.3, tab. 5', e3.tab);
  check('ed. 3: „čl. E.5.3.4" → „čl. D.5.3.4"', e3.e534 === 'ČSN EN IEC 62305-3 ed.3, čl. D.5.3.4', e3.e534);
  check('ed. 3: tab. 8,9 → tab. 9, 10; kap. 8 → čl. 8.1', e3.tab89 === 'ČSN EN IEC 62305-3 ed.3, čl. 6.2.2, tab. 9, 10' && e3.kap8 === 'ČSN EN IEC 62305-3 ed.3, čl. 8.1', e3.tab89 + ' / ' + e3.kap8);
  check('ed. 3: díl 4 zůstává ČSN EN 62305-4 ed.2 i s čísly', e3.d4 === 'ČSN EN 62305-4 ed.2, čl. 5.2' && e3.d4b === 'ČSN EN 62305-4 ed.2, kap. 7', e3.d4);
  check('ed. 3: díly 1 a 2 → ČSN EN IEC 62305-1/-2 ed.3', e3.d1 === 'ČSN EN IEC 62305-1 ed.3' && e3.d2 === 'ČSN EN IEC 62305-2 ed.3');
  check('ed. 3: citace mimo mapu bez čísla článku', e3.mimo === 'ČSN EN IEC 62305-3 ed.3' && e3.mimo2 === 'ČSN EN IEC 62305-3 ed.3', e3.mimo + ' / ' + e3.mimo2);
  check('ed. 3: žádná citace dílu 3 z programu, která je v mapě, nepropadne bez čísla', !e3.propadle.length, e3.propadle.join(' ; '));
  check('ed. 2 beze změny, 1. vydání bez čísel', e3.ed2 === 'ČSN EN 62305-3 ed.2, čl. 5.3.3, tabulka 4' && e3.v1 === 'ČSN EN 62305-3 (1. vydání)', e3.v1);
  check('výběr normy: popisky s dobou platnosti, výchozí ed. 2',
    /62305=ČSN EN 62305 ed\. 2 – LPS zřízené podle ed\. 2 \(do 31\. 10\. 2027\)/.test(e3.volby) && /62305e3=ČSN EN IEC 62305 ed\. 3 – nové LPS, povinně od 1\. 11\. 2027/.test(e3.volby) &&
    /1390=ČSN 34 1390 – hromosvody zřízené do 1\. 2\. 2009/.test(e3.volby) && e3.vychozi === '62305', e3.volby);
  // ed. 3 v PDF: prohlídka s čísly článků
  const pdf3 = await p.evaluate(async () => {
    novaZprava('lps'); await new Promise(r => setTimeout(r, 250));
    const s = document.getElementById('lps_prohlidka_norma'); s.value = '62305e3'; s.dispatchEvent(new Event('change', { bubbles: true })); updateLpsMereniTexts();
    const set = (id, x) => { const e = document.getElementById(id); if (e) { e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('f_ev_cislo', 'RE-26-0903'); set('f_misto', 'Nová hala');
    generujPDF(); await new Promise(r => setTimeout(r, 1500));
    return document.getElementById('pdf-pages').textContent.replace(/\s+/g, ' ');
  });
  check('ed. 3 v PDF: prohlídka „čl. 5.3.3, tab. 5", „čl. D.5.3.4", díl 4 „ed.2, kap. 7"',
    /ČSN EN IEC 62305-3 ed\.3, čl\. 5\.3\.3, tab\. 5/.test(pdf3) && /ČSN EN IEC 62305-3 ed\.3, čl\. D\.5\.3\.4/.test(pdf3) && /ČSN EN 62305-4 ed\.2, kap\. 7/.test(pdf3) && !/62305-3 ed\.2/.test(pdf3));
  check('bez chyb stránky', !err.length, err.join(' | '));
  console.log(res.join('\n'));
  await b.close();
  process.exit(res.some(x => x.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.error('CRASH:', e.message); process.exit(2); });
