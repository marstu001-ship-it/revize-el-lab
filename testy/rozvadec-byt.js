// Vymyšlený rozvaděč bytu 3+1 (skříň 3×12) pro testy konfigurátoru.
// Spouští se v prohlížeči (page.evaluate) s otevřeným editorem rozvaděče.
module.exports = function rozvByt() {
  const R = [
    [['v-qm-3-40', '', ''], ['v-spd-12-3N', '', ''], ['v-fa-3-B25', 'Sporák', '3f', 'CYKY-J', '5×2,5'], ['v-rez-2', '', '']],
    [['v-fi-4-40-30-A', '', '3f'], ['v-fa-1-B10', 'Osvětlení – pokoje', 'L1', 'CYKY-J', '3×1,5'], ['v-fa-1-B10', 'Osvětlení – kuchyň, koupelna', 'L2', 'CYKY-J', '3×1,5'],
     ['v-fa-1-B16', 'Zásuvky – obývací pokoj', 'L3', 'CYKY-J', '3×2,5'], ['v-fa-1-B16', 'Zásuvky – ložnice', 'L1', 'CYKY-J', '3×2,5'],
     ['v-fa-1-B16', 'Zásuvky – dětský pokoj', 'L2', 'CYKY-J', '3×2,5'], ['v-fa-1-B16', 'Kuchyň – zásuvky', 'L3', 'CYKY-J', '3×2,5'],
     ['v-fa-1-B16', 'Kuchyň – linka', 'L1', 'CYKY-J', '3×2,5'], ['v-fa-1-B16', 'Myčka', 'L2', 'CYKY-J', '3×2,5']],
    [['v-fi-4-40-30-A', '', '3f'], ['v-fa-1-B16', 'Pračka', 'L3', 'CYKY-J', '3×2,5'], ['v-fa-1-B16', 'Koupelna – zásuvky', 'L1', 'CYKY-J', '3×2,5'],
     ['v-fa-1-B10', 'Koupelna – ventilátor', 'L2', 'CYKY-J', '3×1,5'], ['v-fa-1-B16', 'Chodba – zásuvky', 'L3', 'CYKY-J', '3×2,5'],
     ['v-fifa-1N-B16', 'Balkon – venkovní zásuvka', 'L2', 'CYKY-J', '3×2,5'], ['v-rez-2', '', '']]
  ];
  R.forEach((rada, r) => rada.forEach(([kid, vyvod, faze, kabel, prurez]) => {
    const x = rozvVlozit(kid, r, __rz.rady[r].prvky.length);
    Object.assign(x, { vyvod, faze: faze || x.faze, kabel: kabel || '', prurez: prurez || '' });
  }));
  __rz.vyber = null;
  rozvPohledVykreslit(); rozvVlastnostiVykreslit(); dokZmena();
};
