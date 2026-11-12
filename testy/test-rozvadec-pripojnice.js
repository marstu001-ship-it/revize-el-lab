// Přípojnice N/PE kolmo na DIN lištu (2026-11-12). Hlídá:
//  - přepnutí přípojnice N (6 svorek) podél → kolmo: šířka 2,5 M → 1 M, volné místo řady o 1,5 M větší, přístroje těsně
//    za ní se přisunou; zpět podél vrátí šířku (ZPĚT i Ctrl+Z),
//  - kresba kolmo: svislá mosazná lišta, štítek N (modrý) / PE (zelenožlutý) nahoře, izolátory, 6 šroubů nad sebou,
//  - dlouhá přípojnice (30 svorek) přesahuje řadu → upozornění ve vlastnostech i v „Co ještě chybí",
//  - nastavení „Přípojnice N/PE osazuji: kolmo" platí pro nově vložené, uloží se jen odchylka (x.orientace),
//  - svorková lišta se do volného místa nepočítá; svorkový plán a kontrola počtu svorek fungují stejně,
//  - starý rozvaděč (bez orientace) beze změny: data i čelní pohled proti předchozí verzi (STARA_PORT).
// Všechna data vymyšlená.
const { chromium } = require('./pw');
const path = require('path');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const STARA_PORT = process.env.STARA_PORT || 8902, STARA_URL = 'http://127.0.0.1:' + STARA_PORT + '/index.html';
const res = []; const check = (n, ok, d) => { const t = (ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''); res.push(t); if (process.env.LADIT) console.log(t); };
const w = ms => new Promise(r => setTimeout(r, ms));
const SNIMEK = process.env.SNIMEK || '';

async function otevri(b, url) {
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: path.join(__dirname, 'knihovny', r.request().url().split('/').pop()), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const p = await ctx.newPage(); p.__err = [];
  p.on('pageerror', e => p.__err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(url); await w(1000);
  await p.evaluate(() => {
    window.__T = {
      w: ms => new Promise(r => setTimeout(r, ms)),
      cist: () => DOK_TYPY.rozv.cist(dokForm()),
      naj: o => { let r = null; __rz.rady.forEach(a => a.prvky.forEach(x => { if (x.ozn === o) r = x; })); return r; },
      pocatek: async () => { await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-plast') || rozvKnihPolozka('v-sk-4x24-ocel')); }
    };
  });
  return { ctx, p };
}

(async () => {
  const b = await chromium.launch();
  const { p } = await otevri(b, URL), err = p.__err;

  const A = await p.evaluate(async () => {
    const o = {};
    await __T.pocatek();
    const f1 = rozvVlozit('v-fa-1-B10', 0, 0), pn = rozvVlozit('v-x-prip-n', 0, 1), f2 = rozvVlozit('v-fa-1-B10', 0, 2);
    rozvZmena('n', () => rozvPripPocetNastavit(pn, 6)); rozvPrecislovat();
    o.uid = pn.uid; o.pred = { w: rozvW(pn), f2: rozvPozice(__rz.rady[0])[2], volno: rozvVolnoCelkem(__rz).volno, klic: 'orientace' in pn };
    rozvPripOrientace([pn.uid], true);
    const q = __T.naj(pn.ozn);
    o.po = { w: rozvW(q), f2: rozvPozice(__rz.rady[0])[2], volno: rozvVolnoCelkem(__rz).volno, orient: q.orientace, podel: q.p.sirkaPodel };
    const svg = document.getElementById('rz-svg-ram').innerHTML;
    const g = document.querySelector('#rz-svg-ram [data-puid="' + pn.uid + '"]');
    const lis = g.querySelector('.cp-pripojnice');
    o.kresba = { svisle: +lis.getAttribute('height') > +lis.getAttribute('width'), sroubu: g.querySelectorAll('.cp-sroub-p').length, stitek: !!g.querySelector('.cp-stitek-N'),
      izol: g.querySelectorAll('.cp-izolator').length, kolmoTrida: !!g.querySelector('.cp-pripojnice-kolmo') };
    const st = g.querySelector('.cp-stitek-N'), ib = lis;
    o.stitekNahore = +st.getAttribute('y') < +ib.getAttribute('y');
    o.ulozeno = JSON.stringify(__T.cist().rady[0].prvky.find(x => x.uid === pn.uid)).includes('"orientace":"kolmo"');
    // ZPĚT
    return o;
  });
  check('podél lišty: 6 svorek = 2,5 M, bez klíče orientace', A.pred.w === 2.5 && A.pred.klic === false, JSON.stringify(A.pred));
  check('kolmo: přípojnice zabere 1 M, uvolní 1,5 M a přístroj za ní se přisune', A.po.w === 1 && A.po.volno - A.pred.volno === 1.5 && A.pred.f2 - A.po.f2 === 1.5, JSON.stringify(A.po));
  check('kolmo: uloženo jen x.orientace = "kolmo" (+ p.sirkaPodel)', A.ulozeno && A.po.orient === 'kolmo' && A.po.podel === 2.5);
  check('kresba kolmo: svislá mosazná lišta, 6 šroubů, 2 izolátory, štítek N nahoře', A.kresba.svisle && A.kresba.sroubu === 6 && A.kresba.izol === 2 && A.kresba.stitek && A.stitekNahore && A.kresba.kolmoTrida, JSON.stringify(A.kresba));

  const B = await p.evaluate(async () => {
    const o = {}, uid = __T.cist().rady[0].prvky.find(x => x.p.prip === 'N').uid;
    // ZPĚT (Ctrl+Z) vrátí šířku i pozice
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true })); await __T.w(100);
    let x = rozvNajit(uid).x; o.zpet = { w: rozvW(x), klic: 'orientace' in x, f2: rozvPozice(__rz.rady[0])[2] };
    // tlačítko v liště akcí a kontextové menu
    rozvVybrat(uid, false); await __T.w(150);
    const tl = document.querySelector('#rz-akce [data-action="tdRaPrip"]'); o.tl = tl && tl.textContent;
    tl.click(); await __T.w(100);
    o.listaKolmo = rozvPripKolmo(rozvNajit(uid).x);
    o.kontext = rozvKontextPolozky(uid).map(q => q.popis).filter(t => /lišt/.test(t));
    // vlastnosti: volba Osazení
    rozvVybrat(uid, true); await __T.w(100);
    const sel = document.querySelector('#rz-vlastnosti [data-rp2="orientace"]'); o.sel = sel && sel.value;
    sel.value = 'podel'; sel.dispatchEvent(new Event('change', { bubbles: true })); await __T.w(100);
    o.zpetPodel = !rozvPripKolmo(rozvNajit(uid).x) && rozvW(rozvNajit(uid).x) === 2.5; o.dbg = [!!sel, rozvPripKolmo(rozvNajit(uid).x), rozvW(rozvNajit(uid).x)];
    return o;
  });
  check('Ctrl+Z vrátí osazení podél lišty (šířka, klíč, pozice)', B.zpet.w === 2.5 && B.zpet.klic === false, JSON.stringify(B.zpet));
  check('lišta akcí u výběru má „↕ Kolmo na lištu" a funguje', /Kolmo na lištu/.test(B.tl || '') && B.listaKolmo === true, B.tl);
  check('kontextová nabídka nabízí přepnutí osazení', B.kontext.length === 1 && /podél/.test(B.kontext[0]), B.kontext.join('|'));
  check('vlastnosti: volba Osazení přepíná zpět podél lišty', B.sel === 'kolmo' && B.zpetPodel === true, JSON.stringify(B.dbg) + B.sel);

  // PE kolmo, přesah dlouhé přípojnice a kontrola „Co ještě chybí"
  const C = await p.evaluate(async () => {
    const o = {}; await __T.pocatek();
    const pe = rozvVlozit('v-x-prip-pe', 0, 0); rozvZmena('n', () => rozvPripPocetNastavit(pe, 6)); rozvPrecislovat();
    rozvPripOrientace([pe.uid], true); await __T.w(100);
    const g = document.querySelector('#rz-svg-ram [data-puid="' + pe.uid + '"]');
    o.stitekPE = !!g.querySelector('.cp-stitek-PE'); o.pruhPE = !!g.querySelector('.cp-pe-pruh') || g.innerHTML.indexOf('cp-stitek-PE') > -1;
    o.bezPresahu = !rozvPripPresah(rozvNajit(pe.uid).x) && !rzsKontrola().some(n => /přesahuje/.test(n.text));
    rozvZmena('n', () => rozvPripPocetNastavit(rozvNajit(pe.uid).x, 30));
    const x = rozvNajit(pe.uid).x; o.w30 = rozvW(x); o.presah = rozvPripPresah(x); o.kontrola = rzsKontrola().filter(n => /přesahuje řadu/.test(n.text)).length;
    rozvVybrat(pe.uid, true); await __T.w(100);
    const u = document.getElementById('rp-prip-upoz'); o.upoz = u && !u.hidden && /přesahuje řadu – ověřte místo ve skříni/.test(u.textContent);
    // svorková lišta se nepočítá, počet svorek ve svorkovém plánu je beze změny
    o.zasobniky = rzsZasobniky(__rz.rady).map(z => z.n);
    return o;
  });
  check('přípojnice PE kolmo má zelenožlutý štítek', C.stitekPE && C.pruhPE);
  check('6 svorek se vejde do výšky řady (bez upozornění)', C.bezPresahu === true);
  check('30 svorek kolmo přesahuje řadu: upozornění ve vlastnostech i v „Co ještě chybí"', C.presah && C.upoz && C.kontrola === 1 && C.w30 === 1, JSON.stringify(C));
  check('svorkový plán počítá svorky stejně (30 svorek PE)', C.zasobniky.indexOf(30) !== -1, JSON.stringify(C.zasobniky));

  // svorková lišta + kolmá přípojnice se nepočítá do volného místa
  const D = await p.evaluate(async () => {
    const o = {}; await __T.pocatek();
    const pn = rozvVlozit('v-x-prip-n', 0, 0); rozvZmena('n', () => rozvPripPocetNastavit(pn, 6));
    o.volnoPodel = rozvVolnoCelkem(__rz).volno;
    rozvZmena('l', () => { __rz.rady[0].svorky = true; });
    o.volnoLista = rozvVolnoCelkem(__rz).volno;
    rozvPripOrientace([pn.uid], true);
    o.volnoListaKolmo = rozvVolnoCelkem(__rz).volno;
    return o;
  });
  check('na svorkové liště se přípojnice (ani kolmá) do volného místa nepočítá', D.volnoLista === D.volnoListaKolmo && D.volnoLista < D.volnoPodel, JSON.stringify(D));

  // nastavení konfigurátoru: „kolmo" platí pro nově vložené; uloží se jen odchylka
  const E = await p.evaluate(async () => {
    const o = {}; await __T.pocatek();
    const a0 = rozvVlozit('v-x-prip-n', 0, 0); o.vychozi = { klic: 'orientace' in a0, w: rozvW(a0) };
    rozvVybrat(a0.uid, false); rozvPohledVykreslit();
    const sel = (() => { rozvVybrat(null, false); const el = document.createElement('div'); el.innerHTML = rzaNastaveniHtml(); return el.querySelector('.rza-prip'); })();
    o.maNastaveni = !!sel && sel.value === 'podel';
    const rz = document.getElementById('rz-pohled'); 
    const s2 = document.createElement('select'); s2.className = 'rza-prip'; s2.innerHTML = '<option value="podel">p</option><option value="kolmo" selected>k</option>'; document.body.appendChild(s2);
    s2.value = 'kolmo'; s2.dispatchEvent(new Event('change', { bubbles: true })); s2.remove();
    o.ulozeno = localStorage.getItem(RZ_PRIP_KLIC);
    const a1 = rozvVlozit('v-x-prip-pe', 0, 1); o.nova = { orient: a1.orientace, w: rozvW(a1) };
    localStorage.removeItem(RZ_PRIP_KLIC);
    const a2 = rozvVlozit('v-x-prip-n', 0, 2); o.po = { klic: 'orientace' in a2 };
    return o;
  });
  check('výchozí osazení je podél lišty a bez klíče orientace; nastavení je v konfigurátoru', E.vychozi.klic === false && E.maNastaveni === true, JSON.stringify(E.vychozi));
  check('nastavení „kolmo" platí pro nově vložené (1 M, uloženo x.orientace)', E.ulozeno === 'kolmo' && E.nova.orient === 'kolmo' && E.nova.w === 1, JSON.stringify(E.nova));
  check('po návratu nastavení na „podél" nové přípojnice klíč nemají', E.po.klic === false);

  // starý rozvaděč bez orientace: data a čelní pohled jako ve předchozí verzi
  const sta = await otevri(b, STARA_URL);
  const dat = async pg => pg.evaluate(async () => {
    await __T.pocatek();
    const f1 = rozvVlozit('v-fa-1-B10', 0, 0), pn = rozvVlozit('v-x-prip-n', 0, 1), f2 = rozvVlozit('v-fa-1-B10', 0, 2), pe = rozvVlozit('v-x-prip-pe', 1, 0);
    rozvZmena('n', () => { pn.p.pocet = 6; pn.p.sirka = rozvSvorkySirka(6); pe.p.pocet = 10; pe.p.sirka = rozvSvorkySirka(10); }); rozvPrecislovat(); rozvPohledVykreslit(); dokZmena();
    const d = __T.cist(); d.cislo = 'ROZ-0001'; d.datum = '2026-01-01';
    return { d: JSON.stringify(d.rady), svg: rozvSvg(__rz, { tisk: true }).replace(/\buid-[a-z0-9]+|data-puid="[^"]*"/g, '') };
  });
  const [n1, s1] = [await dat(p), await dat(sta.p)];
  check('starý rozvaděč (podél lišty) beze změny: data řad bajtově jako ve předchozí verzi', n1.d.replace(/"uid":"[^"]*"|"knih":"[^"]*"/g, '') === s1.d.replace(/"uid":"[^"]*"|"knih":"[^"]*"/g, ''), n1.d.length + ' / ' + s1.d.length);
  check('starý rozvaděč (podél lišty): čelní pohled znak po znaku jako ve předchozí verzi', n1.svg === s1.svg, n1.svg.length + ' / ' + s1.svg.length);

  if (SNIMEK) {
    await p.evaluate(async () => {
      await __T.pocatek();
      const L = ['v-fa-1-B10', 'v-fa-1-B10', 'v-fa-1-B10', 'v-fa-1-B10'];
      L.forEach((k, i) => rozvVlozit(k, 0, i));
      const n = rozvVlozit('v-x-prip-n', 0, 4), e = rozvVlozit('v-x-prip-pe', 0, 5);
      rozvVlozit('v-fa-1-B16', 0, 6);
      L.forEach((k, i) => rozvVlozit(k, 1, i));
      const n2 = rozvVlozit('v-x-prip-n', 1, 4), e2 = rozvVlozit('v-x-prip-pe', 1, 5);
      rozvZmena('n', () => { [n, e, n2, e2].forEach(x => rozvPripPocetNastavit(x, 6)); }); rozvPrecislovat();
      rozvPripOrientace([n.uid, e.uid], true);
      __rz.vyber = null; __rz.vic = null; rozvPohledVykreslit(); await __T.w(200);
      document.querySelectorAll('[class*=toast],#toast-box,.toast').forEach(e => e.remove());
    });
    await p.locator('#rz-svg-ram').screenshot({ path: SNIMEK });
  }
  check('bez chyb v konzoli', !err.length && !sta.p.__err.length, err.concat(sta.p.__err).join(' | '));
  await b.close();
  console.log(res.join('\n'));
  process.exit(res.some(x => x.startsWith('❌')) ? 1 : 0);
})();
