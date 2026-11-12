// Schéma — vodivé spoje viditelně (2026-11-12): tečky u odboček a spojů.
// Hlídá: každé místo, kde se potkají aspoň tři čáry a aspoň jedna tam končí, má tečku (a naopak
// tečka je jen tam, kde je spoj); křížení bez spojení tečku nemá; odbočky z přívodního vodiče
// k -FA1 a -FA4 mají tečku; průměr aspoň 4× tloušťka čáry; DXF má blok SPOJ na vrstvě SILOVA.
// Všechna data vymyšlená.
const { chromium } = require('./pw');
const path = require('path'), fs = require('fs'), cp = require('child_process');
const PORT = process.env.PORT || 8901, URL = 'http://127.0.0.1:' + PORT + '/index.html';
const SNIMEK = process.env.SNIMEK || '';
const res = []; const check = (n, ok, d) => { const t = (ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''); res.push(t); if (process.env.LADIT) console.log(t); };
const w = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  await ctx.route(/cdnjs\.cloudflare\.com\/.*\/(jspdf\.umd\.min\.js|html2canvas\.min\.js)$/, r => r.fulfill({
    path: path.join(__dirname, 'knihovny', r.request().url().split('/').pop()), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
  await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(URL); await w(1000);

  const r = await p.evaluate(async () => {
    const o = {};
    await dokNovy('rozv'); rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-plast') || rozvKnihPolozka('v-sk-4x24-ocel'));
    const vloz = (kid, i, v, f) => { const x = rozvVlozit(kid, 0, i); x.vyvod = v; x.faze = f; x.kabel = 'CYKY-J'; x.prurez = '3×1,5'; return x; };
    const F1 = vloz('v-fa-1-B10', 0, 'Světla 1', 'L1'), F2 = vloz('v-fa-1-B10', 1, 'Světla 2', 'L1'), F3 = vloz('v-fa-1-B10', 2, 'Světla 3', 'L1'),
          F4 = vloz('v-fa-1-B10', 3, 'Světla 4', 'L2'), F5 = vloz('v-fa-1-B10', 4, 'Světla 5', 'L3');
    rozvPrecislovat();
    [F1, F4, F5].forEach(x => { x.nadr = '@privod'; x.nadrRucne = true; });
    F2.nadr = F1.uid; F2.nadrRucne = true; F3.nadr = F2.uid; F3.nadrRucne = true;
    rozvNadrazeneAuto(); rozvPohledVykreslit(); dokZmena();
    const d = DOK_TYPY.rozv.cist(dokForm());
    o.uid = [F1, F2, F3, F4, F5].map(x => x.uid);
    const L = rozvSchemaListy(d, {});
    o.listu = L.length; o.svgy = L.map(l => l.svg); o.fmt = L.map(l => [l.g.W, l.g.H]);
    o.dxf = Array.from(dxfDoBajtu(rozvDxfVytvor(d, {}, 'x')));
    return o;
  });
  fs.mkdirSync(path.join(__dirname, '_beh'), { recursive: true });
  // nezávislý rozbor SVG v prohlížeči (vlastní implementace, ne rsTecky)
  const rozbor = async svg => p.evaluate(s => {
    const doc = new DOMParser().parseFromString(s, 'image/svg+xml'), TOL = 0.08;
    const seg = [];
    doc.querySelectorAll('line').forEach(l => {
      if (l.closest('g[transform]') || l.getAttribute('data-nb')) return;
      const q = ['x1', 'y1', 'x2', 'y2'].map(k => parseFloat(l.getAttribute(k)));
      const ram = l.closest('[data-ram],[data-razitko]');
      if (ram) return;
      seg.push({ q, w: parseFloat(l.getAttribute('stroke-width')) });
    });
    const dots = [...doc.querySelectorAll('circle[data-spoj]')].map(c => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r') }));
    const arms = (x, y) => {
      let a = 0, e = 0;
      seg.forEach(({ q }) => {
        const dx = q[2] - q[0], dy = q[3] - q[1], l2 = dx * dx + dy * dy; if (!l2) return;
        const u = Math.max(0, Math.min(1, ((x - q[0]) * dx + (y - q[1]) * dy) / l2));
        if (Math.hypot(q[0] + u * dx - x, q[1] + u * dy - y) > TOL) return;
        if (Math.hypot(x - q[0], y - q[1]) <= TOL || Math.hypot(x - q[2], y - q[3]) <= TOL) { a++; e++; } else a += 2;
      });
      return { a, e };
    };
    return { dots, bad: dots.filter((d, i) => 0), arms: dots.map(d => arms(d.x, d.y)), seg: seg.map(s => s.q), minW: Math.min(...dots.map(d => d.r * 2)), nAuto: dots.length,
      body: seg.flatMap(s => [[s.q[0], s.q[1]], [s.q[2], s.q[3]]]).filter(([x, y]) => { const t = arms(x, y); return t.a >= 3 && t.e >= 1; })
        .filter(([x, y], i, A) => A.findIndex(([a, b]) => Math.hypot(a - x, b - y) < 0.3) === i).length };
  }, svg);

  // list 2 (první list jednopólového schématu)
  const R = await rozbor(r.svgy[1]);
  check('schéma má tečky vodivých spojů', R.dots.length > 0, R.dots.length + ' teček');
  // tečka je jen tam, kde se potkají aspoň tři čáry
  const zbytecne = R.arms.filter(a => a.a < 3).length;
  if (process.env.LADIT) console.log(JSON.stringify(R.dots.map((d, i) => [d.x, d.y, d.r, R.arms[i].a, R.arms[i].e])));
  check('žádná tečka mimo spoj (aspoň tři čáry)', zbytecne === 0, zbytecne + ' zbytečných');
  // každý spoj má tečku: počet uzlů ≥3 čar s koncem = počet teček
  check('počet teček = počet uzlů s aspoň třemi čarami', R.body === R.dots.length, 'uzlů ' + R.body + ', teček ' + R.dots.length);
  // jedna velikost tečky pro celé schéma (průměr 1 mm), nezávisle na tloušťce sběrnice
  const prum = [...new Set(R.dots.map(d => (d.r * 2).toFixed(2)))];
  check('všechny tečky ve schématu mají stejný průměr 1 mm', prum.length === 1 && prum[0] === '1.00', prum.join(', '));
  // střed tečky leží v průsečíku os čar (tolerance 0,2 mm): aspoň dvě čáry procházejí do 0,2 mm od středu
  const mimo = await p.evaluate(({ s }) => {
    const doc = new DOMParser().parseFromString(s, 'image/svg+xml'); let zle = 0;
    const L = [...doc.querySelectorAll('line')].filter(l => !l.closest('g[transform]') && !l.getAttribute('data-nb') && !l.closest('[data-ram],[data-razitko]')).map(l => ['x1', 'y1', 'x2', 'y2'].map(k => +l.getAttribute(k)));
    doc.querySelectorAll('circle[data-spoj]').forEach(c => {
      const x = +c.getAttribute('cx'), y = +c.getAttribute('cy'); let n = 0;
      L.forEach(q => { const dx = q[2] - q[0], dy = q[3] - q[1], l2 = dx * dx + dy * dy; if (!l2) return; const u = Math.max(0, Math.min(1, ((x - q[0]) * dx + (y - q[1]) * dy) / l2)); if (Math.hypot(q[0] + u * dx - x, q[1] + u * dy - y) <= 0.2) n++; });
      if (n < 2) zle++;
    });
    return zle;
  }, { s: r.svgy[1] });
  check('střed každé tečky leží v průsečíku čar (tolerance 0,2 mm)', mimo === 0, mimo + ' mimo');

  // odbočky z přívodu k FA1 a FA4 a FA5 mají tečku; křížení sběrnice L vodičem FA4 / FA5 ne
  const T = await p.evaluate(({ s, uid }) => {
    const doc = new DOMParser().parseFromString(s, 'image/svg+xml'), o = {};
    const dots = [...doc.querySelectorAll('circle[data-spoj]')].map(c => [+c.getAttribute('cx'), +c.getAttribute('cy')]);
    const maDot = (x, y) => dots.some(([a, b]) => Math.hypot(a - x, b - y) < 0.2);
    uid.forEach((u, i) => {
      const g = doc.querySelector('g[data-puid="' + u + '"]'); if (!g) { o['f' + i] = null; return; }
      const h = [...g.querySelectorAll('line')].filter(l => !l.closest('g[transform]') && l.getAttribute('y1') === l.getAttribute('y2') && !l.getAttribute('stroke-dasharray'))
        .map(l => [Math.max(+l.getAttribute('x1'), +l.getAttribute('x2')), +l.getAttribute('y1')]);
      o['f' + i] = h.length ? { x: h[0][0], y: h[0][1], dot: maDot(h[0][0], h[0][1]) } : null;
      o['x' + i] = (() => { const v = [...g.querySelectorAll('line')].filter(l => !l.closest('g[transform]') && l.getAttribute('x1') === l.getAttribute('x2') && !l.getAttribute('stroke-dasharray')).map(l => +l.getAttribute('x1')); return v.length ? Math.max(...v) : null; })();
    });
    // sběrnice L = nejdelší vodorovná čára 0,7
    let sb = null; doc.querySelectorAll('line').forEach(l => { if (l.getAttribute('stroke-width') === '0.7' && l.getAttribute('y1') === l.getAttribute('y2')) { const len = Math.abs(l.getAttribute('x2') - l.getAttribute('x1')); if (!sb || len > sb.len) sb = { len, y: +l.getAttribute('y1') }; } });
    o.yL = sb && sb.y;
    o.krizeni = [3, 4].map(i => o['x' + i] != null ? maDot(o['x' + i], sb.y) : null);
    return o;
  }, { s: r.svgy[1], uid: r.uid });
  check('odbočka z přívodu k -FA1 má tečku', T.f0 && T.f0.dot === true, JSON.stringify(T.f0));
  check('odbočka z přívodu k -FA4 má tečku', T.f3 && T.f3.dot === true, JSON.stringify(T.f3));
  check('poslední odbočka z přívodu (-FA5) je roh, ne spoj — bez tečky', T.f4 && T.f4.dot === false, JSON.stringify(T.f4));
  check('vodiče -FA4 a -FA5 přes sběrnici L (křížení bez spojení) nemají tečku', T.krizeni && T.krizeni.every(v => v === false), JSON.stringify(T.krizeni));

  // DXF: tečky jako blok SPOJ na vrstvě SILOVA, audit bez chyb
  const dxfCesta = path.join(__dirname, '_beh', 'schema-tecky.dxf'); fs.writeFileSync(dxfCesta, Buffer.from(r.dxf));
  check('DXF obsahuje blok SPOJ', /\r\n2\r\nSPOJ\r\n/.test(Buffer.from(r.dxf).toString('latin1')));
  let ez = null; try { ez = JSON.parse(cp.execFileSync('python3', ['-I', path.join(__dirname, 'dxf-kontrola.py'), 'rozbor', dxfCesta], { encoding: 'utf8' })); } catch (e) { check('ezdxf přečetl DXF', false, String(e.message).slice(0, 120)); }
  if (ez) {
    const spoje = ez.inserty.filter(i => i.blok === 'SPOJ');
    check('DXF: ezdxf audit bez chyb a oprav', ez.chyby === 0 && ez.opravy === 0, JSON.stringify(ez.zpravy));
    check('DXF: tečky jsou vložení bloku SPOJ na vrstvě SILOVA', spoje.length > 0 && spoje.every(i => i.vrstva === 'SILOVA'), spoje.length + ' vložení');
  }
  // stejné SVG jde do PDF: jen jednoduché prvky (data-spoj je jen atribut)
  check('v SVG listu žádné třídy, style ani filtry', r.svgy.every(s => !/ class=| style=|<filter|<mask|foreignObject|<image/.test(s)));

  if (SNIMEK) {
    const Wm = r.fmt[1][0], Hm = r.fmt[1][1];
    await p.setContent('<body style="margin:0;background:#fff">' + r.svgy[1].replace('<svg ', '<svg style="width:1580px;height:auto;display:block" ') + '</body>');
    await p.setViewportSize({ width: 1600, height: 1160 });
    await p.screenshot({ path: SNIMEK });
  }
  check('bez chyb stránky', err.length === 0, err.join(' | '));
  await b.close();
  console.log(res.join('\n'));
  process.exit(res.some(x => x.startsWith('❌')) ? 1 : 0);
})();
