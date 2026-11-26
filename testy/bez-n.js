// Schéma rozvaděče 2026-11-09 (připomínka uživatele podle výkresu kolegy): nulák
// jističochrániče (RCBO) vede z jeho výstupu (N-FI/FA1) a skupinové N sběrnice
// chráničů mají popisek „N-FI1". Testy, které porovnávají schéma se starou verzí
// znak po znaku, porovnávají bez popisků „N-…", bez čárkovaných odboček N/PE
// a bez teček spojů (ty se u RCBO záměrně změnily). Ostatní kresba (sběrnice,
// značky, texty, rám, razítko) dál znak po znaku. Umí i \" z JSON.stringify.
//
// 2026-11-20 (víc přívodů — porovnání se schváleným výkresem kolegy, viz
// `testy/test-rozvadec-privody.js` a CLAUDE.md oddíl „ROZVADĚČ — REŽIM
// NAPÁJENÍ"): dvě DALŠÍ záměrné změny, globální (platí pro VŠECHNY
// rozvaděče, ne jen víceprivodové), odlišitelné geometrií čárky
// (dx = x2−x1, dy = y2−y1 — vždy stejné bez ohledu na polohu):
// - rsLomitka (lomítka počtu vodičů NA VÝVODU, 3/5 čárek za obyčejným
//   jističem, 2 za výstupem transformátoru/zdroje): dx=2, dy=−1.2 —
//   mohla se zaměnit za počet fází, v referenčních výkresech kolegy
//   nejsou → ZRUŠENA ÚPLNĚ.
// - rsLomitkaVodorovne (vrchol PŘÍVODNÍHO KABELU): dx=1.2, dy=−2 —
//   bývalo 5 (3f) / 3 (1f) čárek počítajících L+N+PE dohromady, teď
//   3 / 1 (jen fáze — N a PE mají svou vlastní značku tam, kde se
//   připojují) → POČET ZMĚNĚN, ne zrušeno.
// Stripne se KAŽDÁ čárka té geometrie na obou stranách srovnání (na počtu
// nezáleží — až se po odstranění zbytek shoduje, srovnání je bajtově OK).
// (Mimochodem: koncový RCBO se teď taky připojuje na N plným spojem jako
// kterýkoli jiný přístroj, bez vlastního popisku „N-FI/FAx" — to řeší už
// filtr o pár řádků výš, nic dalšího tu nepotřebuje.)
//
// 2026-11-26: list osazení (list 1) se porovnává bez obsahu — viz konec funkce.
// 2026-11-25: rozvaděč BEZ zadané soustavy s 3pólovým hlavním vypínačem se kreslí jako
// trojfázový (dřív „L" a jedno lomítko — vypadal jednofázově, hlášení uživatele). Popisek
// sběrnice „L1, L2, L3" se porovnává jako „L"; lomítka přívodu výš už vynechává bezGeom.
module.exports = function bezN(s) {
  const bezGeom = (txt, dx, dy) => txt.replace(/<line x1=\\?"(-?[\d.]+)\\?" y1=\\?"(-?[\d.]+)\\?" x2=\\?"(-?[\d.]+)\\?" y2=\\?"(-?[\d.]+)\\?" stroke=\\?"#000\\?" stroke-width=\\?"0\.22\\?" fill=\\?"none\\?"\s*(?:\/>|><\/line>)/g,
    (m, x1, y1, x2, y2) => (Math.abs((+x2 - +x1) - dx) < 0.02 && Math.abs((+y2 - +y1) - dy) < 0.02) ? '' : m);
  let t = String(s == null ? '' : s)
    .replace(/<text [^>]*>N-[^<]*<\/text>/g, '')
    .replace(/<line [^>]*stroke-dasharray=\\?"1\.6 1\\?"[^>]*?(?:\/>|><\/line>)/g, '')
    .replace(/<circle [^>]*r=\\?"0\.45\\?"[^>]*?(?:\/>|><\/circle>)/g, '')
    .replace(/<circle [^>]*data-spoj=\\?"1\\?"[^>]*?(?:\/>|><\/circle>)/g, '');   // 2026-11-12: tečky vodivých spojů (OPRAVA schématu)
  t = bezGeom(t, 2, -1.2);    // 2026-11-20: lomítka vývodu zrušena
  t = bezGeom(t, 1.2, -2);    // 2026-11-20: lomítka přívodního kabelu 5/3 → 3/1
  t = t.replace(/(font-weight=\\?"bold\\?" fill=\\?"#000\\?">)L1, L2, L3(<\/text>)/g, '$1L$2');   // 2026-11-25: 3f bez zadané soustavy
  // 2026-11-26: list osazení (list 1 schématu) kreslí přístroje ČB čárovou kresbou s kótami skříně —
  // záměrná změna listu 1 VŠECH DBO; porovnání se starou verzí list osazení vynechá celý (zbytek dál znak po znaku).
  t = t.replace(/<svg\b(?:(?!<\/svg>)[\s\S])*?Osazení rozvaděče(?:(?!<\/svg>)[\s\S])*<\/svg>/g, '');
  return t;
};
