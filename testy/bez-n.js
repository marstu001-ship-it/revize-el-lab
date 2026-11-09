// Schéma rozvaděče 2026-11-09 (připomínka uživatele podle výkresu kolegy): nulák
// jističochrániče (RCBO) vede z jeho výstupu (N-FI/FA1) a skupinové N sběrnice
// chráničů mají popisek „N-FI1". Testy, které porovnávají schéma se starou verzí
// znak po znaku, porovnávají bez popisků „N-…", bez čárkovaných odboček N/PE
// a bez teček spojů (ty se u RCBO záměrně změnily). Ostatní kresba (sběrnice,
// značky, texty, rám, razítko) dál znak po znaku. Umí i \" z JSON.stringify.
module.exports = function bezN(s) {
  return String(s == null ? '' : s)
    .replace(/<text [^>]*>N-[^<]*<\/text>/g, '')
    .replace(/<line [^>]*stroke-dasharray=\\?"1\.6 1\\?"[^>]*?(?:\/>|><\/line>)/g, '')
    .replace(/<circle [^>]*r=\\?"0\.45\\?"[^>]*?(?:\/>|><\/circle>)/g, '');
};
