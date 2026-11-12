// Čelní pohled „jako v dílně" (2026-11-08): přístroje mají novou kresbu (cpKresba) a skříň
// vývodku přívodu. Testy, které porovnávají rozvaděč se starou verzí znak po znaku, porovnávají
// čelní pohled BEZ kresby přístrojů: každá skupina <g class="rz-pr …">…</g> se nahradí značkou
// s data-puid a vývodka se vypustí. Jinde (schéma, seznam, štítek, data, DXF) dál znak po znaku.
// Umí i řetězce s escapovanými uvozovkami (\" z JSON.stringify).
module.exports = function bezKresby(s) {
  s = String(s == null ? '' : s);
  const vzory = [/<g class=\\?"rz-pr[\s"\\]/g, /<g class=\\?"rz-vyvodka-cp\\?"/g];
  for (const vz of vzory) {
    let out = '', i = 0, m;
    vz.lastIndex = 0;
    while ((m = vz.exec(s))) {
      const start = m.index; let j = start, hl = 0;
      // vyvážené <g … </g>
      while (j < s.length) {
        if (s.startsWith('</g>', j)) { hl--; j += 4; if (hl === 0) break; continue; }
        if (s.startsWith('<g', j) && /[\s>]/.test(s[j + 2])) { hl++; j += 2; continue; }
        j++;
      }
      const kus = s.slice(start, j), pu = /data-puid=\\?"([^"\\]*)/.exec(kus);
      out += s.slice(i, start) + (vz === vzory[0] ? '<P' + (pu ? ' ' + pu[1] : '') + '/>' : '');
      i = j; vz.lastIndex = j;
    }
    s = out + s.slice(i);
  }
  // 2026-11-12: tečky vodivých spojů ve schématu se zvětšily a přibyly (záměrně) — starý r="0.45" i nový data-spoj se vypouští
  return s.replace(/<circle [^>]*(?:data-spoj=\\?"1\\?"|r=\\?"0\.45\\?")[^>]*?(?:\/>|><\/circle>)/g, '');
};
