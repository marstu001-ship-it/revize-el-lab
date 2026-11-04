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
  ['ČSN 33 2000-6 ed.2, čl. 64.3.10', 'ČSN 33 2000-6 ed.2, čl. 6.4.3.10']
];
const opravyPouzite = new Set();
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
    a.text = opravText(a.text);
    const c = await otisk(nova.p, v);
    const shodaText = a.text === c.text, shodaData = a.data === c.data, shodaKap = a.kap === c.kap;
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
  console.log('\nzáměrně změněné řetězce v PDF (' + opravyPouzite.size + '):' + (opravyPouzite.size ? '\n   ' + [...opravyPouzite].join('\n   ') : ' žádné'));
  console.log('\nchyby stránky — stará: ' + (stara.err.length ? stara.err.join(' | ') : 'žádné') +
              ', nová: ' + (nova.err.length ? nova.err.join(' | ') : 'žádné'));
  console.log(vse && !nova.err.length ? '\n✅ VŠECHNY VARIANTY ELEKTRO I LPS SE CHOVAJÍ IDENTICKY'
                                      : '\n❌ NĚCO SE ROZEŠLO');
  await b.close();
  process.exit(vse && !nova.err.length ? 0 : 1);
})().catch(e => { console.error('CRASH:', e.message); process.exit(2); });
