// Hledání v knihovně rozvaděčů podle typu a objednacího čísla (2026-11-27): editor (Přístroje
// i Skříně) i správa knihovny; „672.5616", „6725616", „5616", „OEZ 43246". Objednací číslo
// je od teď samostatné pole `obj` — CSV se sloupci typ I objednací číslo už jedno nepřepíše
// druhé; CSV jen se sloupcem objednací číslo se načte jako dřív (do typu). Vše vymyšlené.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901;
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d !== undefined ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));
const CSV = 'druh;kategorie;nazev;vyrobce;rada;typ;objednaci_cislo;poly;in;charakteristika;sirka_moduly;rady;moduly_v_rade;ip\n' +
  'skrin;;Rozvodnice nástěnná 2×12;Výrobce A;RA;RA-N-2S12;672.5616;;;;;2;12;IP40\n' +
  'skrin;;Rozvodnice nástěnná 3×12;Výrobce A;RA;RA-N-3S12;672.5617;;;;;3;12;IP40\n' +
  'pristroj;FA;Jistič B16/1;Výrobce A;LA;LA-16B-1;418.3267;1;16;B;1;;;\n' +
  'pristroj;FA;Jistič B10/1;Výrobce B;LB;LB-10B-1;43246;1;10;B;1;;;\n';
const CSV_STARY = 'druh;kategorie;vyrobce;objednaci_cislo;poly;in;charakteristika;sirka_moduly\npristroj;FA;Výrobce A;418.9999;1;20;C;1\n';

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const p = await ctx.newPage(); const err = [];
  p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await w(1000);

  // ── 1. import ──
  const im = await p.evaluate(([CSV, CSV_STARY]) => {
    const v = rozvImportRozebrat(CSV, 'k.csv'), st = rozvImportRozebrat(CSV_STARY, 's.csv');
    window.__K = v.polozky.map((q, i) => Object.assign(q.polozka, { id: 'imp' + i, zdroj: 'import' }));
    const bez = rozvPolozkaNorm({ druh: 'pristroj', kat: 'FA', poly: '1', In: 16, sirka: 1 });
    return { typy: v.polozky.map(q => q.polozka.typ + '/' + q.polozka.obj).join(','), ch: v.chyby.length, nez: (v.neznameSloupce || []).length,
      stary: st.polozky.map(q => q.polozka.typ + '/' + (q.polozka.obj || '-')).join(), bezObj: !('obj' in bez),
      sablona: ROZV_CSV.map(c => c[0]).indexOf('objednaci_cislo') !== -1 };
  }, [CSV, CSV_STARY]);
  check('CSV s typem i objednacím číslem: obojí zvlášť, bez chyb a neznámých sloupců', im.typy === 'RA-N-2S12/672.5616,RA-N-3S12/672.5617,LA-16B-1/418.3267,LB-10B-1/43246' && im.ch === 0 && im.nez === 0, im.typy);
  check('starší CSV jen s objednacím číslem: číslo jde do typu jako dřív, `obj` nevznikne', im.stary === '418.9999/-', im.stary);
  check('položka bez objednacího čísla nemá klíč obj (data beze změny); šablona má sloupec objednaci_cislo', im.bezObj && im.sablona);

  // ── 2. editor ──
  await p.evaluate(async () => { await dokNovy('rozv'); DOK.rozvKnihovna = window.__K; rozvKnihovnaZmenena(); });
  await w(300);
  const hledej = async (tab, q) => {
    await p.click('[data-action="tdRTab"][data-tab="' + tab + '"]'); await w(150);
    await p.fill('#rz-hledat', q); await w(250);
    return p.evaluate(() => [...document.querySelectorAll('#rz-seznam .rz-polozka b')].map(b => b.textContent).join(','));
  };
  const S = {};
  for (const [tab, q] of [['skrine', '672.5616'], ['skrine', '6725616'], ['skrine', '5616'], ['skrine', 'RA-N-3S12'], ['pristroje', '418.3267'], ['pristroje', '4183267'], ['pristroje', 'Výrobce B 43246'], ['pristroje', 'LB 4183267']]) S[tab + ':' + q] = await hledej(tab, q);
  check('Skříně: „672.5616", „6725616" i „5616" najdou skříň 2×12', ['672.5616', '6725616', '5616'].every(q => S['skrine:' + q] === 'Rozvodnice nástěnná 2×12'), JSON.stringify(S));
  check('Skříně: typ „RA-N-3S12" najde skříň 3×12', S['skrine:RA-N-3S12'] === 'Rozvodnice nástěnná 3×12');
  check('Přístroje: „418.3267" i „4183267" najdou jistič B16', S['pristroje:418.3267'] === 'Jistič B16/1' && S['pristroje:4183267'] === 'Jistič B16/1');
  check('Přístroje: „Výrobce B 43246" najde, „LB 4183267" ne', S['pristroje:Výrobce B 43246'] === 'Jistič B10/1' && S['pristroje:LB 4183267'] === '');
  await p.fill('#rz-hledat', '418.3267'); await w(250);
  const radek = await p.evaluate(() => { return [...document.querySelectorAll('#rz-seznam .rz-polozka small')].map(s => s.textContent).join('|'); });
  check('řádek v knihovně ukazuje obj. č.', /obj\. č\. 418\.3267/.test(radek), radek);

  // ── 3. správa knihovny ──
  await p.evaluate(() => { dokOtevritSeznam('rozv'); }); await w(400);
  await p.evaluate(() => { DOK.rozvKnihovna = window.__K; rozvKnihovnaZmenena(); const d = document.getElementById('dok-knihovna-karta'); if (d) d.open = true; rozvSpravaVykreslit(); });
  const sp = async q => { await p.fill('#rz-sf-q', q); await w(250); return p.evaluate(() => ({ r: [...document.querySelectorAll('#rz-sprava .dok-vzor-radek b')].map(b => b.textContent).join(','), f: document.activeElement && document.activeElement.id })); };
  const s1 = await sp('6725616'), s2 = await sp('Výrobce B 43246'), s3 = await sp('');
  check('správa knihovny: pole Hledat najde „6725616" a fokus zůstane v poli', s1.r === 'Rozvodnice nástěnná 2×12' && s1.f === 'rz-sf-q', JSON.stringify(s1));
  check('správa knihovny: „Výrobce B 43246" najde jistič B10, prázdné pole ukáže vše', s2.r === 'Jistič B10/1' && s3.r.split(',').length === 4, s2.r + ' | ' + s3.r);

  check('bez chyb na stránce', err.length === 0, err.join(' | '));
  await b.close();
  console.log(res.join('\n'));
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})();
