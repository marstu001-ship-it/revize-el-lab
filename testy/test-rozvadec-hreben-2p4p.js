// Rozvaděč — propojovací hřebeny 2P a 4P (2026-11-27, blok „ROZVADĚČ — PROPOJOVACÍ HŘEBENY").
// 2P = dvě přípojnice, zuby střídavě; zapojení L + N (výchozí, `h.zapojeni` chybí) nebo
// dvě fáze (`h.zapojeni = '2L'`); fáze pro automatické napájení `h.faze`. 4P = L1 L2 L3 N
// (jako 3P+N). Import knihovny přijme póly 2 a 4, „Navrhnout hřebeny" dá 2P přes samé
// 2pólové přístroje a 4P přes samé 4pólové. Starý rozvaděč s hřebeny 1 / 3 / 1+N / 3+N
// se otevře a uloží bajtově stejně a jeho čelní pohled je znak po znaku jako ve staré verzi.
// Vše vymyšlené.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901, STARA = process.env.STARA_PORT || 8902;
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d !== undefined ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));

async function stranka(b, port) {
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const p = await ctx.newPage(); p.__err = [];
  p.on('pageerror', e => p.__err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto('http://127.0.0.1:' + port + '/index.html'); await w(1000);
  await p.evaluate(() => { STORE.technik = STORE.technik || {}; STORE.technik.rz_hreben_strana = 'nahore'; });
  return p;
}
// Rozvaděč 3×12: řada 1 = QH 3P + 4× jistič 1+N, řada 2 = 6× jistič 1P, řada 3 = 3× jistič 3+N.
const POSTAV = async () => {
  await dokNovy('rozv');
  rozvSkrinNastavit(rozvKnihovnaVse().filter(i => i.druh === 'skrin' && +i.rady === 3 && +i.modulu === 12)[0]);
  const R = [['v-qm-3-40', 'v-fa-1N-B16', 'v-fa-1N-B16', 'v-fa-1N-B10', 'v-fa-1N-B10'],
             ['v-fa-1-B10', 'v-fa-1-B10', 'v-fa-1-B16', 'v-fa-1-B16', 'v-fa-1-B16', 'v-fa-1-B16'],
             ['v-fa-3N-C16', 'v-fa-3N-C16', 'v-fa-3N-C16']];
  R.forEach((rada, r) => rada.forEach(kid => rozvVlozit(kid, r, __rz.rady[r].prvky.length)));
  __rz.vyber = null; __rz.vic = null;
};

(async () => {
  const b = await chromium.launch();
  const p = await stranka(b, PORT);

  // ── 1. knihovna a import ──
  const val = await p.evaluate(() => ({
    p2: rozvValidovat({ druh: 'hreben', poly: '2', prurez: '16', polu: '12' }),
    p4: rozvValidovat({ druh: 'hreben', poly: '4P', prurez: '16', polu: '12' }),
    p5: rozvValidovat({ druh: 'hreben', poly: '5', prurez: '16', polu: '12' }),
    csv: (() => { const r = rozvImportRozebrat('druh;vyrobce;typ;poly;prurez;polu\nhreben;Výrobce A;S2L-A;2;10;12\nhreben;Výrobce A;S4L-A;4;16;12\n', 'h.csv'); return { n: r.polozky.length, ch: r.chyby.length, poly: r.polozky.map(q => q.polozka.poly) }; })(),
    vest: ['v-hreben-2-16', 'v-hreben-4-16'].map(id => (rozvKnihPolozka(id) || {}).poly)
  }));
  check('hřeben z knihovny s póly 2 projde', val.p2.chyby.length === 0 && val.p2.polozka.poly === '2', JSON.stringify(val.p2.chyby));
  check('hřeben s póly „4P" projde jako 4', val.p4.chyby.length === 0 && val.p4.polozka.poly === '4', JSON.stringify(val.p4.chyby));
  check('jiné póly = chyba „(1, 1+N, 2, 3, 3+N nebo 4)"', val.p5.chyby.some(c => /\(1, 1\+N, 2, 3, 3\+N nebo 4\)/.test(c)), JSON.stringify(val.p5.chyby));
  check('CSV import S2L a S4L bez chyb (póly 2 a 4)', val.csv.ch === 0 && val.csv.poly.join() === '2,4', JSON.stringify(val.csv));
  check('vestavěné obecné hřebeny 2P a 4P', val.vest.join() === '2,4', JSON.stringify(val.vest));

  // ── 2. hřeben 2P L + N přes jističe 1+N ──
  const ln = await p.evaluate(async (POSTAV) => {
    await eval(POSTAV)();
    const h = rzhNovy(0, 3, 11, '2'); rzhPridat(h, 'test');
    const zuby = rzhZuby(h).map(z => z.faze + (z.konflikt ? '!' : '')).join(',');
    const fa = [1, 2, 3, 4].map(i => __rz.rady[0].prvky[i]);
    const S = rzpStav(__rz);
    return { zuby, fazi: rzhFazi(h), faze: fa.map(x => x.faze).join(), pod: fa.every(x => S.vys[x.uid] && S.vys[x.uid].pod),
      nadr: fa.map(x => x.nadr).join() === ['', '', '', ''].join(), kontroly: rzhKontroly(h, S).map(q => q.t), popis: rzhPopis(h),
      mat: rzhMaterial(DOK_TYPY.rozv.cist(dokForm())).join('|'), uid: h.uid,
      svg: rozvSvg(__rz, {}), uloz: JSON.stringify(__rz.hrebeny[0]) };
  }, POSTAV.toString());
  check('2P L + N: zuby střídavě L / N (8 zubů, bez konfliktu)', ln.zuby === '0,N,0,N,0,N,0,N', ln.zuby);
  check('2P L + N: jedna fáze (L) a výchozí zapojení se neukládá', ln.fazi === 1 && !/zapojeni|"faze"/.test(ln.uloz), ln.uloz);
  check('2P L + N: jističe pod napětím, napájené z hlavního vypínače, fáze L1', ln.pod && ln.nadr && ln.faze === 'L1,L1,L1,L1', ln.faze);
  check('2P L + N: bez upozornění v panelu', ln.kontroly.length === 0, JSON.stringify(ln.kontroly));
  check('popis a materiál „2P"', /hřeben 2P/.test(ln.popis) && /Propojovací hřeben 2P/.test(ln.mat), ln.mat);
  check('čelní pohled: popisky L a N nad zuby', /class="rz-hr-f"[^>]*>N</.test(ln.svg) && />L1</.test(ln.svg));

  const lnL2 = await p.evaluate(() => {
    const h = __rz.hrebeny[0];
    rzhZmenit(h.uid, 'test', q => { q.faze = 'L2'; });
    return [1, 2, 3, 4].map(i => __rz.rady[0].prvky[i].faze).join();
  });
  check('2P L + N, fáze L2: všechny jističe dostanou L2', lnL2 === 'L2,L2,L2,L2', lnL2);

  // ── 3. panel: zapojení a fáze ──
  const panel = await p.evaluate(() => {
    const h = __rz.hrebeny[0]; __rz.hrVyber = h.uid; rozvVlastnostiVykreslit();
    const html = document.getElementById('rz-vlastnosti').innerHTML;
    const sel = document.querySelector('#rz-vlastnosti [data-hr-pole="zapojeni"]');
    sel.value = '2L'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    const po2L = JSON.stringify(__rz.hrebeny[0]);
    const sel2 = document.querySelector('#rz-vlastnosti [data-hr-pole="zapojeni"]');
    sel2.value = 'LN'; sel2.dispatchEvent(new Event('change', { bubbles: true }));
    const poLN = JSON.stringify(__rz.hrebeny[0]);
    const polyOpts = [...document.querySelectorAll('#rz-vlastnosti [data-hr-pole="poly"] option')].map(o => o.value).join();
    return { html, po2L, poLN, polyOpts };
  });
  check('panel 2P: volby Zapojení (L + N / dvě fáze) a Fáze', /data-hr-pole="zapojeni"/.test(panel.html) && /dvě fáze/.test(panel.html) && /data-hr-pole="faze"/.test(panel.html));
  check('panel: póly nabízí 2P a 4P', panel.polyOpts === '1,3,1+N,3+N,2,4', panel.polyOpts);
  check('dvě fáze → uloží zapojeni: 2L (a zruší dřívější fázi)', /"zapojeni":"2L"/.test(panel.po2L) && !/"faze"/.test(panel.po2L), panel.po2L);
  check('zpět L + N → klíč zapojeni zmizí', !/zapojeni/.test(panel.poLN), panel.poLN);
  check('dvě fáze na jističích L + N = upozornění „přepněte na L + N"', await p.evaluate(() => {
    rzhZmenit(__rz.hrebeny[0].uid, 't', q => { q.zapojeni = '2L'; });
    const u = rzhKontroly(__rz.hrebeny[0]).map(q => q.t).join(' | ');
    rzhZmenit(__rz.hrebeny[0].uid, 't', q => { delete q.zapojeni; });
    return /přepněte zapojení hřebenu na L \+ N/.test(u);
  }));

  // ── 4. hřeben 2P dvě fáze přes jednopólové jističe ──
  const dv = await p.evaluate(() => {
    const h = rzhNovy(1, 0, 6, '2'); h.zapojeni = '2L'; rzhPridat(h, 'test');
    const fa = () => __rz.rady[1].prvky.map(x => x.faze).join();
    const r = { zuby: rzhZuby(h).map(z => z.faze).join(), fazi: rzhFazi(h), f12: fa(), kontroly: rzhKontroly(h).length };
    rzhZmenit(h.uid, 't', q => { q.faze = 'L2L3'; }); r.f23 = fa();
    rzhZmenit(h.uid, 't', q => { q.faze = 'L1L3'; }); r.f13 = fa();
    const S = rzpStav(__rz); r.pod = __rz.rady[1].prvky.every(x => S.vys[x.uid] && S.vys[x.uid].pod);
    r.svg = rozvSvg(__rz, {});
    return r;
  });
  check('2P dvě fáze: zuby střídavě dvě přípojnice', dv.zuby === '0,1,0,1,0,1' && dv.fazi === 2, dv.zuby);
  check('2P dvě fáze (výchozí L1 + L2): jističe L1, L2 střídavě', dv.f12 === 'L1,L2,L1,L2,L1,L2', dv.f12);
  check('2P dvě fáze, L2 + L3', dv.f23 === 'L2,L3,L2,L3,L2,L3', dv.f23);
  check('2P dvě fáze, L1 + L3 (dva vodiče automatiky)', dv.f13 === 'L1,L3,L1,L3,L1,L3' && dv.pod, dv.f13);
  check('2P dvě fáze: bez upozornění', dv.kontroly === 0, dv.kontroly);

  // ── 5. hřeben 4P přes jističe 3+N ──
  const p4 = await p.evaluate(() => {
    const h = rzhNovy(2, 0, 12, '4'); rzhPridat(h, 'test');
    const S = rzpStav(__rz), fa = __rz.rady[2].prvky;
    return { zuby: rzhZuby(h).map(z => z.faze).join(), kon: rzhZuby(h).some(z => z.konflikt), pod: fa.every(x => S.vys[x.uid] && S.vys[x.uid].pod && S.vys[x.uid].faze.join() === 'L1,L2,L3'),
      popis: rzhPopis(h), kontext: rzhKontext(h.uid).map(q => q.popis).join('|') };
  });
  check('4P: zuby L1 L2 L3 N po řadě, bez konfliktu', p4.zuby === '0,1,2,N,0,1,2,N,0,1,2,N' && !p4.kon, p4.zuby);
  check('4P: jističe 3+N pod napětím L1, L2, L3', p4.pod);
  check('4P: popis „hřeben 4P" a nabídka 4P → 2P', /hřeben 4P/.test(p4.popis) && /4P → 2P/.test(p4.kontext), p4.kontext);

  // ── 6. Navrhnout hřebeny a nabídka z knihovny ──
  const nav = await p.evaluate(() => {
    __rz.hrebeny = []; rozvZmena('t', () => {});
    return rzhNavrhy().map(q => q.h.rada + ':' + q.h.poly).join();
  });
  check('Navrhnout hřebeny: jističe 1+N → 2P, jednopólové → 3P, 3+N → 4P', nav === '0:2,1:3,2:4', nav);
  const kn = await p.evaluate(async () => {
    await dokNacist();
    ['2', '4', '3+N'].forEach((pl, i) => DOK.rozvKnihovna.push(Object.assign(rozvValidovat({ druh: 'hreben', vyrobce: 'Výrobce A', typ: 'H' + i, poly: pl, prurez: '16', polu: '12' }).polozka, { id: 'utest' + i, zdroj: 'import' })));
    rozvKnihovnaZmenena();
    const v = p => rzhKnihVolby(rzhNovy(2, 0, 12, p)).filter(i => /^utest/.test(i.id)).map(i => i.poly).sort().join();
    return { k4: v('4'), k3n: v('3+N'), k2: v('2') };
  });
  check('nabídka z knihovny: 4P i 3P+N k sobě, 2P jen 2P', kn.k4 === '3+N,4' && kn.k3n === '3+N,4' && kn.k2 === '2', JSON.stringify(kn));
  check('žádná chyba stránky', p.__err.length === 0, p.__err.join(' | '));

  // ── 7. starý rozvaděč s hřebeny 1 / 3 / 1+N / 3+N — data i čelní pohled jako ve staré verzi ──
  const STAVBA = async (POSTAV) => {
    await eval(POSTAV)();
    __rz.hrebeny = [rzhNovy(0, 3, 11, '1+N'), rzhNovy(1, 0, 6, '1'), rzhNovy(2, 0, 12, '3+N')];
    const h4 = rzhNovy(1, 0, 6, '3'); h4.strana = 'dole'; __rz.hrebeny.push(h4);
    rozvZmena('t', () => {});
    await dokUlozitOtevreny();
    return { uid: __dokOtevreny.uid, data: JSON.stringify(DOK.dokumenty.find(x => x.uid === __dokOtevreny.uid).data) };
  };
  const ps = await stranka(b, STARA);
  const st = await ps.evaluate(STAVBA, POSTAV.toString());
  const svgStara = await ps.evaluate(() => rozvSvg(__rz, { tisk: true }));
  const nov = await p.evaluate(async (st) => {
    await dokNacist();
    const d = JSON.parse(st.data);
    DOK.dokumenty.push({ uid: 'stary-hr', typ: 'rozv', cislo: 'ROZ-0901', data: d, vytvoreno: new Date().toISOString(), upraveno: new Date().toISOString() });
    await dokZapsat();
    await dokOtevrit('stary-hr'); await new Promise(r => setTimeout(r, 400));
    const cist = JSON.stringify(DOK_TYPY.rozv.cist(dokForm()));
    await dokUlozitOtevreny();
    const ulozeno = JSON.stringify(DOK.dokumenty.find(x => x.uid === 'stary-hr').data);
    return { cist, ulozeno, svg: rozvSvg(__rz, { tisk: true }) };
  }, st);
  check('starý rozvaděč (hřebeny 1/3/1+N/3+N): otevření a uložení bajtově stejně', nov.cist === st.data && nov.ulozeno === st.data);
  check('starý rozvaděč: čelní pohled v tisku znak po znaku jako ve staré verzi', nov.svg === svgStara, nov.svg.length + ' / ' + svgStara.length);

  await b.close();
  res.forEach(r => console.log(r));
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.error('SELHALO', e); process.exit(1); });
