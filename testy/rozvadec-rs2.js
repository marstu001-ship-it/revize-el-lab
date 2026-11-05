// Vymyšlený rozvaděč RS2 (škola) — připomínka 2026-11-05: kdo koho napájí.
// Spouští se v prohlížeči (page.evaluate) s otevřeným editorem rozvaděče a
// skříní 4×24. Zapojení:
//   přívod → (svorky -X1..X3) → -QH1 63 A 3P
//     ├─ -FU1 pojistkový odpojovač 3P → -SPD1 T2
//     ├─ -FA1..FA22 B10 1P, -FA23, -FA24 B40 3P (bez chrániče)
//     └─ -FI1 40 A/30 mA 4P → -FA25..FA44 B16 1P
module.exports = function rozvRs2(o) {
  o = o || {};
  const fu = o.fu || 'v-fu-3-1038', spd = o.spd || 'v-spd-2-3N';
  const L = ['L1', 'L2', 'L3'];
  const vloz = (kid, r, vyvod, faze) => { const x = rozvVlozit(kid, r, __rz.rady[r].prvky.length); if (vyvod) x.vyvod = vyvod; if (faze) x.faze = faze; x.kabel = x.kabel || ''; return x; };
  vloz('v-qm-3-63', 0);
  const F = vloz(fu, 0);
  const S = vloz(spd, 0);
  for (let i = 1; i <= 14; i++) Object.assign(vloz('v-fa-1-B10', 0, 'Učebna ' + i + ' – světla', L[(i - 1) % 3]), { kabel: 'CYKY-J', prurez: '3×1,5' });
  for (let i = 15; i <= 22; i++) Object.assign(vloz('v-fa-1-B10', 1, 'Chodba ' + (i - 14) + ' – světla', L[(i - 1) % 3]), { kabel: 'CYKY-J', prurez: '3×1,5' });
  Object.assign(vloz('v-fa-3-B40', 1, 'Kuchyň – sporák'), { kabel: 'CYKY-J', prurez: '5×10' });
  Object.assign(vloz('v-fa-3-B40', 1, 'Tělocvična – podružný'), { kabel: 'CYKY-J', prurez: '5×10' });
  vloz('v-fi-4-40-30-A', 3);
  for (let i = 25; i <= 44; i++) Object.assign(vloz('v-fa-1-B16', 3, 'Učebna ' + (i - 24) + ' – zásuvky', L[(i - 25) % 3]), { kabel: 'CYKY-J', prurez: '3×2,5' });
  rozvPrecislovat();
  S.nadrRucne = true; S.nadr = F.uid;   // -FU1 → -SPD1
  rozvNadrazeneAuto();
  __rz.vyber = null;
  rozvPohledVykreslit(); rozvVlastnostiVykreslit(); dokZmena();
  return { fu: F.uid, spd: S.uid };
};
