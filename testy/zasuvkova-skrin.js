// Vymyšlená zásuvková skříň ZS1 podobné stavby jako přenosný adaptér zákazníka
// (16 M, chránič 4P 40 A 100 mA, FA1 C32/3, FA2–4 C32/1, FA5–6 C16/1, šest zásuvek
// na čele, svorkovnice N a PE od výroby pod lištou, pohyblivý přívod s vidlicí 32 A 5P).
// Knihovna „Výrobce A" je vymyšlená (Icn a typy), žádná data výrobců.
// Spouští se v prohlížeči (page.evaluate) — dokument typu 'zs' se založí sám.
module.exports = async function zsSkrin() {
  const dk = (s, v) => { const e = dokForm().querySelector(s); if (!e) return; e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
  const K = (z, id, o) => Object.assign(dokKopie(rozvKnihPolozka(z)), { id: id, vyrobce: 'Výrobce A', rada: 'VA', zdroj: 'import', overeno: false }, o);
  DOK.rozvKnihovna = (DOK.rozvKnihovna || []).filter(x => !/^va-/.test(x.id)).concat([
    K('v-fa-3-C32', 'va-c32-3', { typ: 'VA-C32/3', icn: 10, nazev: 'Jistič C32/3' }), K('v-fa-1-C32', 'va-c32-1', { typ: 'VA-C32/1', icn: 10, nazev: 'Jistič C32/1' }),
    K('v-fa-1-C16', 'va-c16-1', { typ: 'VA-C16/1', icn: 6, nazev: 'Jistič C16/1' }), K('v-fi-4-40-30-A', 'va-fi-40-4-100', { typ: 'VA-FI 40/4/100/A', idn: 100, nazev: 'Chránič 40 A 4P 100 mA A' })]);
  rozvKnihovnaZmenena();
  await dokNovy('zs');
  dk('[data-dk="oznaceni"]', 'ZS1'); dk('[data-dk="stavba"]', 'Výrobní hala B – přenosná zásuvková skříň');
  dk('[data-dk="investor.nazev"]', 'Vymyšlená výroba a.s.'); dk('[data-dk="misto"]', 'hala B, přenosná');
  dk('[data-dk="soustava"]', '3NPE ~400/230 V TN-S'); dk('[data-dk="krytiZavreno"]', 'IP54');
  dk('[data-dk="privodKabel"]', 'H07RN-F'); dk('[data-dk="privodPrurez"]', '5G6'); dk('[data-dk="privodSmer"]', 'zespodu');
  const sk = rozvValidovat({ druh: 'skrin', nazev: 'Zásuvková skříň s rukojetí 16 M', vyrobce: 'Výrobce A', typ: 'VA-ZS 16M', rady: 1, modulu: 16, ip: 'IP54',
    rozmery: '550 × 328 × 160', trida: 'II', provedeni: 'přenosná na stojanu', material: 'plast', svorkovnice: 'N pod, PE pod', rukojet: 'ano' }).polozka;
  rozvSkrinNastavit(sk);
  [['va-fi-40-4-100', '3f'], ['va-c32-3', '3f', '5×4'], ['va-c32-1', 'L1', '3×4'], ['va-c32-1', 'L2', '3×4'], ['va-c32-1', 'L3', '3×4'], ['va-c16-1', 'L1', '3×2,5'], ['va-c16-1', 'L2', '3×2,5']]
    .forEach(([k, f, pr]) => { const x = rozvVlozit(k, 0, __rz.rady[0].prvky.length); if (!x) return; x.faze = f; if (pr) { x.kabel = 'H07V-K'; x.prurez = pr; } });
  const fa = __rz.rady[0].prvky.filter(x => x.p.kat === 'FA');
  const POS = [[164, 440], [64, 320], [164, 320], [264, 320], [64, 440], [264, 440]];
  const Z = (i, oz, poly, In, ue, ip, druh, typ) => ({ uid: 'z' + i, ozn: oz, napajen: fa[i].uid, pos: { x: POS[i][0], y: POS[i][1] }, p: { kat: 'XS2', druhZas: druh, polyZ: poly, In: In, ue: ue, ip: ip, typ: typ } });
  __rz.celo = { zasuvky: [Z(0, '-XZ1', '3P+N+E', 32, 400, 'IP67', 'cee', 'VA-CEE 32/5h IP67'), Z(1, '-XZ2', '2P+E', 32, 230, 'IP67', 'cee', 'VA-CEE 32/3/6h IP67'),
    Z(2, '-XZ3', '2P+E', 32, 230, 'IP67', 'cee', 'VA-CEE 32/3/6h IP67'), Z(3, '-XZ4', '2P+E', 32, 230, 'IP67', 'cee', 'VA-CEE 32/3/6h IP67'),
    Z(4, '-XZ5', 'dom', 16, 230, 'IP54', 'dom', 'VA-Z16 IP54'), Z(5, '-XZ6', 'dom', 16, 230, 'IP54', 'dom', 'VA-Z16 IP54')] };
  dk('[data-dk="privodDelka"]', '5'); dk('[data-dk="privodOzn"]', '-WL1'); dk('[data-dk="vidlice.ozn"]', '-XP1'); dk('[data-dk="vidlice.In"]', '32');
  dk('[data-dk="vidlice.ue"]', '400'); dk('[data-dk="vidlice.poly"]', '3P+N+E'); dk('[data-dk="vidlice.ip"]', 'IP67');
  __rz.vyber = null; rozvPohledVykreslit(); rozvVlastnostiVykreslit(); dokZmena();
  await dokUlozitOtevreny();
};
