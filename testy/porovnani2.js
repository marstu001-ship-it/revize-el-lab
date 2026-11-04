// A/B regrese: stará verze (git HEAD) na 8902, nová na 8901.
// `stroje` a `spotrebice` jsou z porovnání DAT vyňaté: jsou to kontejnery
// vlastních typů zpráv, u elektro a LPS zůstávají prázdné a jejich přibytí
// nic netiskne. Text PDF se porovnává dál znak po znaku.
// Vyplní stejnou zprávu v obou a porovná TEXT vygenerovaného PDF znak po
// znaku, plus data zprávy a nadpisy kapitol. Hlavní záchranná síť projektu.
const { chromium } = require('./pw');

async function otisk(page, v) {
  return await page.evaluate(async (v) => {
    localStorage.clear();
    STORE.technik = { jmeno:'M. Technik', ulice:'Zkušební 1', psc:'697 01', mesto:'Kyjov' };
    archiv.length = 0; STORE.archiv = archiv; STORE.tisk = {};
    aktTyp = v.typ; aktPodtyp = v.podtyp || 'dum';
    novaZprava(v.typ);
    await new Promise(r => setTimeout(r, 250));
    if (v.norma) {
      const s = document.getElementById('lps_prohlidka_norma');
      if (s) { s.value = v.norma; lpsVolbaNormy(); await new Promise(r => setTimeout(r, 200)); }
    }
    const set = (id, x) => { const e = document.getElementById(id); if (e) { e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('f_ev_cislo','RE-26-0100'); set('f_misto','Testovací objekt'); set('f_adresa','Ulice 1\n123 45 Město');
    set('f_provozovatel','Provozovatel s.r.o.'); set('f_zahajeni','2026-04-01'); set('f_ukonceni','2026-04-01');
    set('f_vypracovani','2026-04-02'); set('f_pristi','2031-04-01'); set('f_celkovy_vysledek','schopno');
    magicPopis(); magicZaver();
    const D = getData();
    generujPDF();
    await new Promise(r => setTimeout(r, 1400));
    const st = Array.from(document.querySelectorAll('#pdf-pages .a4'));
    return {
      data: JSON.stringify(D, (k, val) => ['uid','ulozeno','predchudce_uid','timestamp','stroje','spotrebice'].includes(k) ? undefined : val),
      stran: st.length,
      kap: Array.from(document.querySelectorAll('#pdf-pages .sec-head')).map(h => h.textContent.trim().replace(/\s+/g,' ')).join(' | '),
      text: st.map(s => s.textContent.replace(/\s+/g,' ').trim()).join('\n§\n')
    };
  }, v);
}

// Záměrně opravené citace norem (FUNKCE: Normy – opravy citací, dávka 1).
// Ve staré verzi se v textu PDF nahradí novým zněním, takže se porovnání
// zastaví jen na jiném rozdílu. Které se opravdu uplatnily, se vypíše.
const OPRAVY_TEXTU = [
  ['ČSN 33 2000-6 ed.3, čl. 6.4.3.5, příl. B', 'ČSN 33 2000-6 ed.2, čl. 6.4.3.5, příl. B'],
  ['ČSN 33 2000-6 ed.2, čl. 61.3.10', 'ČSN 33 2000-6 ed.2, čl. 6.4.3.6'],
  ['ČSN 33 2000-6 ed.2, čl. 64.3.10', 'ČSN 33 2000-6 ed.2, čl. 6.4.3.10'],
  // dávka 2: ČSN 34 1390 — prohlídka (bod + citace), patička měření, vzorový popis
  ["Provedení jímacího zařízení (hřebenové vedení, jímací tyče, náhodné jímače)ČSN 34 1390, čl. 35–41Odpovídá", "Provedení jímacího zařízení (hřebenové vedení, jímací tyče, náhodné jímače)ČSN 34 1390, čl. 16 až 19Odpovídá"],
  ["Uspořádání jímacího vedení po obvodu střechy a ochrana vyčnívajících částíČSN 34 1390, čl. 36Odpovídá", "Uspořádání jímacího vedení po obvodu střechy a ochrana vyčnívajících částíČSN 34 1390, čl. 17, 18Odpovídá"],
  ["Vzdálenosti jímačů od hořlavých stavebních hmotČSN 34 1390, čl. 42Odpovídá", "Vzdálenosti jímačů od hořlavých stavebních hmotČSN 34 1390, čl. 35Odpovídá"],
  ["Stav a koroze jímacích vodičů a spojůČSN 34 1390, čl. 124Odpovídá", "Stav a koroze jímacích vodičů a spojůČSN 34 1390, čl. 21 až 24, 54Odpovídá"],
  ["Počet svodů (obvykle min. 2, v rozích objektu)ČSN 34 1390, čl. 46Odpovídá", "Počet svodů (1 na 15 m hřebene, resp. 30 m obvodu)ČSN 34 1390, čl. 32Odpovídá"],
  ["Vzdálenost svodů od hořlavých částí budovyČSN 34 1390, čl. 51Odpovídá", "Vzdálenost svodů od hořlavých částí budovyČSN 34 1390, čl. 35Odpovídá"],
  ["Zkušební svorky — umístění ≈ 1,5 m nad zemí, označeníČSN 34 1390, čl. 50Odpovídá", "Zkušební svorky — asi 2 m nad zemí, přístupnéČSN 34 1390, čl. 45Odpovídá"],
  ["Mechanická ochrana svodu v dosahu osobČSN 34 1390, čl. 52Odpovídá", "Mechanická ochrana svodu v dosahu osobČSN 34 1390, čl. 38 b) (do výšky asi 1,7 m)Odpovídá"],
  ["Celistvost a stav spojů svodůČSN 34 1390, čl. 124Odpovídá", "Celistvost a stav spojů svodůČSN 34 1390, čl. 41 až 44Odpovídá"],
  ["Uzemnění jednotlivých svodů (doporučeno ≤ 15 Ω)ČSN 34 1390, čl. 55Odpovídá", "Uzemnění jednotlivých svodů (≤ 20 Ω)ČSN 34 1390, čl. 55 b)Odpovídá"],
  ["Celkový zemní odpor soustavyČSN 34 1390, čl. 55Odpovídá", "Skupina zemničů spojená nad zemí (< 15 Ω)ČSN 34 1390, čl. 55 c)Odpovídá"],
  ["Materiál a průřez zemničů (FeZn, Cu)ČSN 34 1390, čl. 56Odpovídá", "Materiál a průřez zemničů (FeZn, Cu)ČSN 34 1390, čl. 53Odpovídá"],
  ["Hloubka uložení zemničůČSN 34 1390, čl. 57Odpovídá", "Hloubka uložení zemničůČSN 34 1390, čl. 53 b)Odpovídá"],
  ["Pospojování kovových částí vstupujících do objektuČSN 34 1390, čl. 62Odpovídá", "Pospojování kovových částí vstupujících do objektuČSN 34 1390, čl. 61 až 66Odpovídá"],
  ["Provedení svorkových spojů a jejich přístupnostČSN 34 1390, čl. 123Odpovídá", "Provedení svorkových spojů a jejich přístupnostČSN 34 1390, čl. 41 až 45Odpovídá"],
  ["Celistvost LPS, přechodové odpory (≤ 0,2 Ω)ČSN 34 1390, čl. 124Odpovídá", "Celistvost LPS, přechodové odpory (≤ 0,2 Ω)ČSN 34 1390, čl. 41 až 44; mez 0,2 Ω podle ČSN EN 62305-3Odpovídá"],
  ["Dokumentace LPS a zápisy z předchozích revizíČSN 34 1390, čl. 129Odpovídá", "Dokumentace LPS a zápisy z předchozích revizíČSN 34 1390, čl. 12, 201Odpovídá"],
  ["Doporučená hodnota zemního odporu jednotlivých svodů ≤ 15 Ω dle ČSN 34 1390, čl. 55.Přechodové odpory spojů vodičů ≤ 0,2 Ω dle ČSN 34 1390, čl. 124.", "ČSN 34 1390: Zemní odpor zemniče jednoho svodu nemá být větší než 20 Ω (čl. 55 b); skupina zemničů spojená nad zemí < 15 Ω (čl. 55 c).Přechodové odpory spojů vodičů ≤ 0,2 Ω (podle ČSN EN 62305-3)."],
  ["od hořlavých částí střechy vyhovuje požadavkům ČSN 34 1390 čl. 42.", "od hořlavých částí střechy vyhovuje požadavkům ČSN 34 1390 čl. 35."],
  ["V dosahu osob (do výšky 1,8 m) jsou svody opatřeny", "V dosahu osob (do výšky asi 1,7 m, čl. 38) jsou svody opatřeny"],
  ["umístěny ve výšce cca 1,5 m nad zemí, jsou přístupné a označené dle ČSN 34 1390 čl. 50.", "umístěny ve výšce asi 2 m nad zemí, jsou přístupné a označené dle ČSN 34 1390 čl. 45."],
  ["se doporučuje ≤ 15 Ω (ČSN 34 1390 čl. 55).", "se doporučuje ≤ 20 Ω (ČSN 34 1390 čl. 55)."],
  ["s uzemňovací soustavou dle ČSN 34 1390 čl. 62.", "s uzemňovací soustavou dle ČSN 34 1390 čl. 61 až 66."],
  ["požadavek ≤ 0,2 Ω dle ČSN 34 1390 čl. 124.", "požadavek ≤ 0,2 Ω."]
];
const opravyPouzite = new Set(), zlomy = [];
function opravText(t) {
  OPRAVY_TEXTU.forEach(([a, b]) => { if (t.includes(a)) { opravyPouzite.add(a + ' → ' + b); t = t.split(a).join(b); } });
  return t;
}

(async () => {
  const varianty = [
    { jmeno:'elektro / rodinný dům', typ:'elektro', podtyp:'dum' },
    { jmeno:'elektro / byt',         typ:'elektro', podtyp:'byt' },
    { jmeno:'elektro / průmysl',     typ:'elektro', podtyp:'prumysl' },
    { jmeno:'elektro / spol.prostory', typ:'elektro', podtyp:'spolecne' },
    { jmeno:'LPS / ČSN EN 62305 ed.2', typ:'lps', norma:'62305' },
    { jmeno:'LPS / ČSN EN 62305 ed.3', typ:'lps', norma:'62305ed3' },
    { jmeno:'LPS / ČSN 34 1390',       typ:'lps', norma:'1390' }
  ];
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const mk = async (port) => {
    const p = await b.newPage({ viewport: { width: 1500, height: 1100 } });
    const err = [];
    p.on('pageerror', e => err.push(e.message));
    await p.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
    await p.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(900);
    return { p, err };
  };
  const stara = await mk(8902), nova = await mk(8901);
  const res = [];
  let vse = true;
  for (const v of varianty) {
    const a = await otisk(stara.p, v);
    a.text = opravText(a.text); a.data = opravText(a.data);
    const c = await otisk(nova.p, v);
    // Kratší opravený text smí posunout zlom stránky — porovná se i bez
    // záhlaví a patičky stránek (počet stran se hlídá dál).
    const bezZlomu = t => t.split('\n§\n').map(s => s.replace(/^.{0,12}\d{3}\/\d{3}RE-\d\d-\d{4}/, '').replace(/M\. Technik, Zkušební 1, 697 01 Kyjovev\. číslo: Revize EL \d{4}$/, '')).join('');
    const zlom = a.text !== c.text && bezZlomu(a.text) === bezZlomu(c.text);
    if (zlom) zlomy.push(v.jmeno);
    const shodaText = a.text === c.text || zlom, shodaData = a.data === c.data, shodaKap = a.kap === c.kap;
    const ok = shodaText && shodaData && shodaKap && a.stran === c.stran;
    if (!ok) vse = false;
    res.push((ok ? '✅' : '❌') + ' ' + v.jmeno.padEnd(26) +
      ' stran ' + a.stran + '→' + c.stran +
      '  text PDF ' + (shodaText ? 'shodný' : 'LIŠÍ SE') +
      ', data ' + (shodaData ? 'shodná' : 'LIŠÍ SE') +
      ', kapitoly ' + (shodaKap ? 'shodné' : 'LIŠÍ SE'));
    if (!shodaData) {
      // Ať je hned vidět PROČ — nové klíče v datech jsou u aditivní změny
      // v pořádku, změněná hodnota u existujícího klíče v pořádku není.
      const oa = JSON.parse(a.data), oc = JSON.parse(c.data);
      const klice = new Set([...Object.keys(oa), ...Object.keys(oc)]);
      const rozd = [];
      klice.forEach(k => {
        const x = JSON.stringify(oa[k]), y = JSON.stringify(oc[k]);
        if (x !== y) rozd.push('     ' + k + ': stará=' + String(x).slice(0,60) + '  nová=' + String(y).slice(0,60));
      });
      res.push('   liší se klíče:'); res.push(...rozd);
    }
    if (!shodaText) {
      const ra = a.text.split('\n'), rc = c.text.split('\n');
      for (let i = 0; i < Math.max(ra.length, rc.length); i++) {
        if (ra[i] !== rc[i]) { res.push('   stará: ' + String(ra[i]).slice(0,200)); res.push('   nová : ' + String(rc[i]).slice(0,200)); break; }
      }
    }
  }
  console.log(res.join('\n'));
  if (zlomy.length) console.log('\nposunutý zlom stránky (po opravených textech): ' + zlomy.join(', '));
  console.log('\nzáměrně změněné řetězce v PDF (' + opravyPouzite.size + '):' + (opravyPouzite.size ? '\n   ' + [...opravyPouzite].join('\n   ') : ' žádné'));
  console.log('\nchyby stránky — stará: ' + (stara.err.length ? stara.err.join(' | ') : 'žádné') +
              ', nová: ' + (nova.err.length ? nova.err.join(' | ') : 'žádné'));
  console.log(vse && !nova.err.length ? '\n✅ VŠECHNY VARIANTY ELEKTRO I LPS SE CHOVAJÍ IDENTICKY'
                                      : '\n❌ NĚCO SE ROZEŠLO');
  await b.close();
  process.exit(vse && !nova.err.length ? 0 : 1);
})().catch(e => { console.error('CRASH:', e.message); process.exit(2); });
