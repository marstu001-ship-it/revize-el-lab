// Normy – opravy citací (kontrola dávka 1: revize). Tabulka zkoušek a–i
// (formulář i PDF), katalog typických vad, bublina meze Zs, lhůty v dialogu
// „Výpočet termínu příští revize" a starší zpráva beze změny dat.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901;
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 }, timezoneId: 'Europe/Prague' });
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(900);

  const ZK = {
    d: 'ČSN 33 2000-6 ed.2, čl. 6.4.3.5, příl. B',
    g: 'ČSN 33 2000-6 ed.2, čl. 6.4.3.6',
    ch: 'ČSN 33 2000-6 ed.2, čl. 6.4.3.10'
  };
  // ── tabulka zkoušek ve formuláři ──────────────────────────────────────
  const form = await p.evaluate(() => {
    novaZprava('elektro');
    const r = {};
    ['d', 'g', 'ch'].forEach(k => { const s = document.getElementById('zk_' + k); r[k] = s ? s.closest('tr').lastElementChild.textContent : ''; });
    r.vse = Array.from(document.querySelectorAll('select[id^="zk_"]')).map(s => s.closest('tr').lastElementChild.textContent).join(' | ');
    return r;
  });
  for (const k of ['d', 'g', 'ch']) check('formulář ' + k + ') cituje ' + ZK[k], form[k].includes(ZK[k]), form[k]);
  check('formulář: žádné „ed.3, čl. 6.4.3.5", „61.3.10" ani „64.3.10"', !/2000-6 ed\.3|61\.3\.10|64\.3\.10/.test(form.vse));

  // ── tabulka zkoušek v PDF ─────────────────────────────────────────────
  const pdf = await p.evaluate(async () => {
    const set = (id, x) => { const e = document.getElementById(id); if (e) { e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('f_ev_cislo', 'RE-26-0900'); set('f_misto', 'Zkušební dům');
    generujPDF();
    await new Promise(r => setTimeout(r, 1500));
    return document.getElementById('pdf-pages').textContent.replace(/\s+/g, ' ');
  });
  for (const k of ['d', 'g', 'ch']) check('PDF ' + k + ') cituje ' + ZK[k], pdf.includes(ZK[k]));
  check('PDF: žádné „2000-6 ed.3", „61.3.10" ani „64.3.10"', !/2000-6 ed\.3|61\.3\.10|64\.3\.10/.test(pdf));

  // ── katalog vad ───────────────────────────────────────────────────────
  const kat = await p.evaluate(() => TYPICKE_ZAVADY.map(z => ({ kod: z.kod, popis: z.popis, norma: z.norma })));
  const najdi = re => kat.find(z => re.test(z.popis));
  const ocek = [
    [/^Impedance poruchové smyčky/, 'C1', 'ČSN 33 2000-4-41 ed.3, čl. 411.4.4; ČSN 33 2000-6 ed.2, čl. D.6.4.3.7.3'],
    [/^Vybavovací čas proudového chrániče při IΔn přesahuje 0,3 s \(typ S 0,5 s\)$/, 'C1', 'ČSN 33 2000-6 ed.2, příloha NA'],
    [/^Propojení vodičů N a PE/, 'C1', 'ČSN 33 2000-5-54 ed.3, čl. 543.4.3; ČSN 33 2000-4-41 ed.3, čl. 411.4.5'],
    [/^Obvod v místnosti s vanou nebo sprchou bez proudového chrániče IΔn ≤ 30 mA$/, 'C1', 'ČSN 33 2000-7-701 ed.2, čl. 701.415.1; ed.3, čl. 701.415.101'],
    [/^Zásuvka v nedovolené zóně koupelny \(v zóně 0 žádná, v zónách 1 a 2 jen obvody SELV nebo PELV\)$/, 'C1', 'ČSN 33 2000-7-701 ed.2, čl. 701.512.4; ed.3, čl. 701.512.2.4.101'],
    [/^Chybí předložená projektová dokumentace/, 'C1', 'ČSN 33 2000-6 ed.2/Z2, příloha E (Dokumentace předložená k provedení revize); NV č. 190/2022 Sb., § 10 písm. c)'],
    [/^Chybí protipožární přepážky/, 'C2', 'ČSN 33 2000-5-52 ed.2, čl. 527.2'],
    [/^Chybí nebo je nefunkční svodič přepětí \(SPD\), ačkoli je ochrana před přepětím vyžadována$/, 'C2', 'ČSN 33 2000-4-443 ed.3, čl. 443.4'],
    [/^Doporučujeme doplnit svodič přepětí T2/, 'C3', 'ČSN 33 2000-4-443 ed.3, čl. 443.4, 443.5'],
    [/^Doporučujeme pravidelnou kontrolu funkce tlačítka TEST/, 'C3', 'návod výrobce chrániče; ČSN 33 2000-6 ed.2, čl. 6.4.3.10']
  ];
  for (const [re, kod, norma] of ocek) {
    const z = najdi(re);
    check('katalog: ' + String(re).slice(2, 50) + ' → ' + kod + ', ' + norma.slice(0, 45), z && z.kod === kod && z.norma === norma, z ? z.kod + ' ' + z.norma : 'nenalezeno');
  }
  check('katalog: stará vada „Zásuvka v prostoru zón 0–1" už není', !najdi(/Zásuvka v prostoru zón 0–1/));
  check('katalog: nikde 4-44 ani 4-42 ani 411.3.2', !kat.some(z => /2000-4-44 |2000-4-42|411\.3\.2/.test(z.norma)));
  check('katalog: C1 vady jsou pohromadě před C2', kat.findIndex(z => z.kod === 'C2') > kat.map(z => z.kod).lastIndexOf('C1'));

  // ── bublina meze Zs ───────────────────────────────────────────────────
  const zs = await p.evaluate(() => zsLimVypocet({ rowtype: 'obvod', ch: 'B', a: '16', zsm: '1,10', idn: '' }, '1NPE ~50Hz 230V / TN-C-S').vysvetleni);
  check('bublina meze Zs: ČSN 33 2000-4-41 ed.3, čl. 411.4.4; ČSN 33 2000-6 ed.2, čl. D.6.4.3.7.3',
    zs.includes('ČSN 33 2000-4-41 ed.3, čl. 411.4.4; ČSN 33 2000-6 ed.2, čl. D.6.4.3.7.3'), zs);

  // ── lhůty v dialogu ───────────────────────────────────────────────────
  const lh = await p.evaluate(() => {
    novaZprava('elektro');
    openModalRevize();
    const sel = document.getElementById('m_typ_obj'), dat = document.getElementById('m_datum');
    const texty = Array.from(sel.options).map(o => o.textContent);
    const skupiny = Array.from(sel.querySelectorAll('optgroup')).map(g => g.label + ':' + g.children.length);
    const pouzij = (txt, datum) => {
      const o = Array.from(sel.options).find(x => x.textContent === txt); o.selected = true;
      dat.value = datum; updateRevizeLhuta();
      const vys = document.getElementById('m_vysledek').textContent;
      potvrditRevize();
      return { pristi: document.getElementById('f_pristi').value, lhuta: document.getElementById('f_lhuta').value, vys };
    };
    const r = { texty, skupiny, pozn: (document.getElementById('m_typ_pozn') || {}).textContent };
    openModalRevize(); r.st = pouzij('Prozatímní zařízení staveniště (0,5 roku)', '2026-04-15');
    openModalRevize(); r.st31 = pouzij('Prozatímní zařízení staveniště (0,5 roku)', '2026-08-31');
    openModalRevize(); r.pet = pouzij('Zděné obytné a kancelářské budovy (5 let)', '2026-04-15');
    openModalRevize(); r.mokre = pouzij('Prostředí mokré (1 rok)', '2026-04-15');
    closeModal('modal-revize');
    return r;
  });
  const maT = t => lh.texty.includes(t);
  check('lhůty: „Pojízdné a převozné prostředky (1 rok)" a „Prozatímní zařízení staveniště (0,5 roku)"',
    maT('Pojízdné a převozné prostředky (1 rok)') && maT('Prozatímní zařízení staveniště (0,5 roku)') && !lh.texty.some(t => /Pojízdné prostředky, staveniště/.test(t)));
  check('lhůty: shromažďování > 250 osob a zděné obytné budovy přejmenované',
    maT('Prostory pro shromažďování více než 250 osob – divadla, kina, obchodní domy, stanice (2 roky)') && maT('Zděné obytné a kancelářské budovy (5 let)'));
  check('lhůty: skupina tab. 1a (11 prostředí) a hořlavé stavby', lh.skupiny.join('|') === 'Podle prostředí (ČSN 33 1500, tab. 1a):11|Hořlavé stavby:1', lh.skupiny.join('|'));
  check('lhůty: poznámka „Platí nejkratší ze lhůt (čl. 3.8)"', lh.pozn === 'Platí nejkratší ze lhůt (čl. 3.8)');
  check('staveniště 15. 4. 2026 → 15. 10. 2026 (+6 měsíců, ne konec roku)', lh.st.pristi === '2026-10-15', JSON.stringify(lh.st));
  check('staveniště: text lhůty 6 měsíců bez čl. 3.9', /^6 měsíců — do 10\/2026/.test(lh.st.lhuta) && !/3\.9/.test(lh.st.lhuta) && /6 měsíců/.test(lh.st.vys), lh.st.lhuta);
  check('staveniště 31. 8. 2026 → 28. 2. 2027 (poslední den měsíce)', lh.st31.pristi === '2027-02-28', lh.st31.pristi);
  check('5 let: 15. 4. 2026 → 15. 4. 2031, text „5 let — do 04/2031 … č. 3.9" (beze změny)',
    lh.pet.pristi === '2031-04-15' && /^5 let — do 04\/2031 .*ČSN 33 1500 č\. 3\.9/.test(lh.pet.lhuta), lh.pet.pristi + ' ' + lh.pet.lhuta);
  check('prostředí mokré 1 rok → 15. 4. 2027', lh.mokre.pristi === '2027-04-15');

  // ── dávka 4: ČSN 33 2000-7-701 ed.3 a ed.2 v seznamu norem, zóny v protokolu ──
  const n701 = await p.evaluate(() => {
    const vse = []; Object.keys(NORMY).forEach(t => (NORMY[t] || []).forEach(g => (g.items || g.polozky || []).forEach(i => vse.push(i))));
    const najdi = id => { for (const t of Object.keys(NORMY)) { const s = JSON.stringify(NORMY[t]); } return vse.find(i => i.id === id); };
    return { e3: najdi('csn2000701'), e2: najdi('csn2000701e2'), zony: DOK_VV_ZONY_701 };
  });
  check('seznam norem: csn2000701 = ed.3 od 07/2025', n701.e3 && n701.e3.od === 'od 07/2025' && n701.e3.t === 'ČSN 33 2000-7-701 ed.3 — Prostory s vanou nebo sprchou', JSON.stringify(n701.e3));
  check('seznam norem: nová csn2000701e2 (ed.2 souběžně do 6. 12. 2027)', n701.e2 && n701.e2.od === '09/2007 – 12/2027' && n701.e2.c === false &&
    n701.e2.t === 'ČSN 33 2000-7-701 ed.2 — Prostory s vanou nebo sprchou (souběžně do 6. 12. 2027)', JSON.stringify(n701.e2));
  check('protokol vnějších vlivů: zóny bez „701 A-f", s čl. 701.30', !/701 A-f/.test(n701.zony) && /čl\. 701\.30 \(ed\.2: obrázky 701\.1 a 701\.2; ed\.3: čl\. 701\.30\.102 až 701\.30\.104, obrázky 1 až 11\)/.test(n701.zony));
  const stary701 = await p.evaluate(async () => {
    await dokNacist();
    const zaznam = { uid: 'dok-stary-701', typ: 'pouvv', cislo: 'POUVV-0098', vytvoreno: '2026-10-16T05:00:00.000Z', upraveno: '2026-10-16T05:00:00.000Z',
      data: { cislo: 'POUVV-0098', stavba: 'Vymyšlená koupelna', investor: {}, zpracovatel: {}, projektant: {}, komise: [],
              podklady: 'X', popis: '', technologie: '', chemikalie: '', zduvodneni: 'Z',
              skupiny: [{ uid: 'g1', prostory: [{ c: '1', n: 'Koupelna' }], vzor: 'vest-sprcha',
                          kody: { AD: 'AD4' }, pozn: 'Prostory umýváren a sprchovacích koutů jsou určeny dle ČSN 33 2000-7-701 zóny dle obrázku 701 A-f: x' }] } };
    DOK.dokumenty.push(zaznam); await dokZapsat();
    const pred = JSON.stringify(zaznam);
    await dokOtevrit('dok-stary-701'); await new Promise(r => setTimeout(r, 1200));
    const pozn = dokForm().querySelector('.dk-skupina [data-k="pozn"]').value;
    await dokNacist();
    return { pred, po: JSON.stringify(DOK.dokumenty.find(x => x.uid === 'dok-stary-701')), pozn };
  });
  check('starý protokol se „701 A-f" se otevře bajtově beze změny', stary701.pred === stary701.po && /701 A-f/.test(stary701.pozn));

  // ── starší zpráva se starými citacemi vad se načte beze změny ──────────
  // Táž zpráva se načte do předchozí verze (STARA_PORT, výchozí 8902 = HEAD)
  // i do nové a getData() se porovná bajtově; vady navíc proti souboru.
  const D = await p.evaluate(() => {
    novaZprava('elektro');
    const D = getData();
    D.ev_cislo = 'RE-25-0007';
    D.normy_checks = ['n-csn2000701'];
    D.zavady = [
      { kod: 'C2', popis: 'Chybí předložená projektová dokumentace skutečného provedení', dalsi: '', norma: 'NV č. 190/2022 Sb., § 10 písm. c)', fotky: [] },
      { kod: 'C1', popis: 'Zásuvka v prostoru zón 0–1 koupelny bez RCD 30 mA', dalsi: 'koupelna', norma: 'ČSN 33 2000-7-701 ed.3, čl. 701.415', fotky: [] },
      { kod: 'C2', popis: 'Chybí nebo je nefunkční svodič přepětí (SPD)', dalsi: '', norma: 'ČSN 33 2000-4-44 ed.3, čl. 443', fotky: [] }
    ];
    return D;
  });
  const nacti = async (page) => page.evaluate(async (D) => {
    nacistData(JSON.parse(JSON.stringify(D)));
    await new Promise(r => setTimeout(r, 300));
    return JSON.stringify(getData(), (k, v) => ['uid', 'timestamp', 'ulozeno'].includes(k) ? undefined : v);
  }, D);
  const ps = await b.newPage({ viewport: { width: 1500, height: 1000 }, timezoneId: 'Europe/Prague' });
  await ps.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  await ps.goto('http://127.0.0.1:' + (process.env.STARA_PORT || 8902) + '/index.html', { waitUntil: 'load' });
  await ps.waitForTimeout(900);
  const jStara = await nacti(ps), jNova = await nacti(p);
  check('starší zpráva: getData() po načtení bajtově shodné s předchozí verzí', jStara === jNova, jStara.length + ' × ' + jNova.length);
  check('starší zpráva: vady se staršími citacemi zůstaly beze změny', JSON.stringify(JSON.parse(jNova).zavady) === JSON.stringify(D.zavady));

  check('bez chyb stránky', !err.length, err.join(' | '));
  console.log(res.join('\n'));
  await b.close();
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.error('CRASH:', e.message); process.exit(2); });
