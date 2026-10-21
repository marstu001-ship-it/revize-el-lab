Knihovna a písmo pro VEKTOROVÉ PDF schématu zapojení rozvaděče (etapa 3).
Leží v repozitáři, ne na CDN: svg2pdf.js na cdnjs není a písmo musí
fungovat i offline (sw.js je ukládá do cache, záloha programu do ZIPu).

svg2pdf.umd.min.js        svg2pdf.js 2.8.1 (yWorks GmbH, licence MIT —
                          svg2pdf-LICENSE.txt), beze změny z balíčku npm
                          svg2pdf.js@2.8.1 dist/ (jen bez řádku sourceMappingURL).
                          Peer závislost jspdf ^2.0.0 — program má jsPDF 2.5.1.
RobotoCondensed-*.ttf     Roboto Condensed (The Roboto Project Authors, SIL Open
                          Font License 1.1 — RobotoCondensed-OFL.txt), zmenšené
                          (pyftsubset) na latinku s háčky, řečtinu a pár značek
                          (Ω, Δ, ±, ×, ≤, ≥, °, ², –, ·).
