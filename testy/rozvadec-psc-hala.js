// Vymyšlený výkonový rozvaděč PSC „RH-hala" pro testy etapy 5b (spouští se
// v prohlížeči přes page.evaluate). Tři pole: pole 1 = přívodní MCCB 400 A,
// měření (TA, PM) a přípojnice N / PE; pole 2 = výkonové vývody (MCCB 250 A,
// 160 A, lištový pojistkový odpínač NH00, odpínač 160 A); pole 3 = DIN segment s chráničem,
// jističi a mezerou po ½ modulu. Sběrnice přes všechna tři pole (spojky).
module.exports = async function () {
  const w = ms => new Promise(r => setTimeout(r, ms));
  const nast = (sel, v) => { const e = dokForm().querySelector(sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
  await dokNovy('psc');
  nast('[data-dk="oznaceni"]', 'RH-hala'); nast('[data-dk="stavba"]', 'Vymyšlená hala Kyjov'); nast('[data-dk="misto"]', 'Rozvodna nn');
  nast('[data-dk="soustava"]', '3NPE ~400/230 V TN-S'); nast('[data-dk="privodIn"]', '400');
  nast('[data-dk="forma"]', '2b'); nast('[data-dk="provedeni"]', 'volně stojící');
  nast('[data-dk="icw"]', '25'); nast('[data-dk="icwT"]', '1'); nast('[data-dk="ipk"]', '52,5');
  nast('[data-dk="krytiZavreno"]', 'IP54'); nast('[data-dk="krytiOtevreno"]', 'IP20');
  nast('[data-dk="privodKabel"]', '1-CYKY'); nast('[data-dk="privodPrurez"]', '4×240');
  ['v-pole-600', 'v-pole-800', 'v-pole-600'].forEach(k => rozvSkrinNastavit(rozvKnihPolozka(k)));
  for (let pi = 0; pi < 3; pi++) pscDilAkce(pi, 0, 'pridat', 'sbernice');
  const sb = pi => __rz.skrin.pole[pi].dily.findIndex(d => d.druh === 'sbernice');
  pscDilZmena(0, sb(0), 'pas', '40×10'); pscDilZmena(0, sb(0), 'In', '630'); pscDilZmena(0, sb(0), 'icw', '25');
  pscDilZmena(0, sb(0), 'spojka', true); pscDilZmena(1, sb(1), 'spojka', true);
  const deska = pi => pscGeo(__rz).rady.filter(g => g.deska && g.pi === pi)[0].i;
  const din = pi => pscGeo(__rz).rady.filter(g => !g.deska && g.pi === pi)[0].i;
  const vloz = (k, r) => rozvVlozit(k, r, __rz.rady[r].prvky.length);
  __rz.pole = 0;
  const qf = vloz('v-qf-3-400', deska(0));
  ['v-ta-3', 'v-pm-96', 'v-xn', 'v-xpe'].forEach(k => vloz(k, deska(0)));
  __rz.pole = 1;
  const v1 = vloz('v-qf-3-250', deska(1)), v2 = vloz('v-qf-3-160', deska(1)), v3 = vloz('v-fu-nh00-3', deska(1)), v4 = vloz('v-qs-3-160', deska(1));
  __rz.pole = 2;
  const r3 = din(2);
  const fi = vloz('v-fi-4-40-30-A', r3), a = vloz('v-fa-1-B16', r3), b = vloz('v-fa-1-B16', r3), c = vloz('v-fa-1-B10', r3);
  const d = vloz('v-fa-3-C32', r3);
  rozvZmena('test', () => {
    v1.kabel = 'CYKY-J'; v1.prurez = '5×120'; v1.vyvod = 'Lisovna'; v1.p.nastaveni = 'Ir 0,8 In, Isd 6 Ir'; v1.p.icu = 36; v1.obvod = '1';
    v2.kabel = 'CYKY-J'; v2.prurez = '5×70'; v2.vyvod = 'Kompresorovna'; v2.obvod = '2'; v2.pi = '75';
    v3.kabel = 'CYKY-J'; v3.prurez = '5×35'; v3.vyvod = 'Sklad'; v3.pozn = 'vložka gG 100 A'; v3.obvod = '3';
    [a, b, c].forEach((x, i) => { x.faze = 'L' + (i + 1); x.kabel = 'CYKY-J'; x.prurez = '3×2,5'; x.vyvod = ['Zásuvky dílna', 'Světla hala', 'Zásuvky sklad'][i]; });
    d.kabel = 'CYKY-J'; d.prurez = '5×6'; d.vyvod = 'Zásuvka 400 V';
    v4.kabel = 'CYKY-J'; v4.prurez = '5×50'; v4.vyvod = 'Kotelna'; v4.obvod = '4';
    d.mezera = 1.5;   // mezera po ½ modulu v DIN segmentu
  });
  __dokOtevreny.data.tech = Object.assign({}, __dokOtevreny.data.tech, { ina: '400' });   // InA (záložka Dokumenty)
  await dokUlozitOtevreny();
  await w(300);
  return { qf: qf.uid, v1: v1.uid, v4: v4.uid, fa1: a.uid, fa3: c.uid, d: d.uid, uid: __dokOtevreny.uid };
};
