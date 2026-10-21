// v9.46 — kontrolní otisky knihoven (SRI).
// Sandbox nepouští cdnjs, takže se knihovny nasimulují lokálním serverem
// s CORS hlavičkou (corsserver.py) — obyčejný http.server by fetch/SRI shodil.
// Testuje se trojí: (1) se správnými bajty se skript NAČTE, (2) po změně
// jediného bajtu se NENAČTE (jinak by otisk nic nehlídal), (3) offline
// varianta z index-offline.html otisk NEMÁ (jinak by file:// nefungovalo),
// (4) totéž pro svg2pdf z vektor/ (v9.127).
const { chromium } = require('./pw');
const fs = require('fs'), cp = require('child_process'), path = require('path');
const DIR = __dirname, SRC = path.join(__dirname, '..', 'index.html');
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));

const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
const LIBS = [
  ['jspdf/2.5.1/jspdf.umd.min.js', 'jspdf.umd.min.js'],
  ['html2canvas/1.4.1/html2canvas.min.js', 'html2canvas.min.js'],
];

function priprav(dir, tamper) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir + '/lib', { recursive: true });
  let html = fs.readFileSync(SRC, 'utf8');
  LIBS.forEach(([cesta, jm], i) => {
    let b = fs.readFileSync(path.join(DIR, 'knihovny', jm));
    if (tamper === i) { b = Buffer.from(b); b[b.length - 1] = b[b.length - 1] ^ 1; } // 1 bit
    fs.writeFileSync(dir + '/lib/' + jm, b);
    html = html.split(CDN + cesta).join('http://127.0.0.1:8907/' + jm);
  });
  // písma neřešíme, jen ať se test nezdrží
  html = html.replace(/<link href="https:\/\/fonts\.googleapis[^>]*>/, '');
  fs.writeFileSync(dir + '/index.html', html);
}

(async () => {
  const srv = [];
  const start = (port, root) => {
    const p = cp.spawn('python3', [DIR + '/corsserver.py', String(port), root], { stdio: 'ignore' });
    srv.push(p); return p;
  };
  const br = await chromium.launch({ args: ['--no-sandbox'] });
  try {
    for (const [jmeno, tamper, cekamOk] of [['nedotčené knihovny', -1, true],
                                            ['jspdf o 1 bit jinak', 0, false],
                                            ['html2canvas o 1 bit jinak', 1, false]]) {
      const dir = DIR + '/_beh/sritest';
      priprav(dir, tamper);
      const a = start(8906, dir), b = start(8907, dir + '/lib');
      await new Promise(r => setTimeout(r, 600));
      const ctx = await br.newContext();
      await ctx.addInitScript(() => { navigator.serviceWorker.register = () => new Promise(() => {}); });
      const p = await ctx.newPage();
      const chyby = [];
      p.on('console', m => { if (m.type() === 'error') chyby.push(m.text()); });
      await p.goto('http://127.0.0.1:8906/index.html', { waitUntil: 'load' });
      const stav = await p.evaluate(() => ({
        jspdf: !!((window.jspdf && window.jspdf.jsPDF) || window.jsPDF),
        h2c: !!window.html2canvas,
      }));
      const nactenoVse = stav.jspdf && stav.h2c;
      check('SRI: ' + jmeno + ' → knihovny ' + (cekamOk ? 'se načtou' : 'se NENAČTOU'),
            nactenoVse === cekamOk, 'jspdf=' + stav.jspdf + ' html2canvas=' + stav.h2c);
      if (!cekamOk) {
        check('  …a prohlížeč řekne proč (integrity v chybě)',
              chyby.some(t => /integrity/i.test(t)), chyby[0] || 'žádná chyba v konzoli');
      }
      await ctx.close(); a.kill(); b.kill();
      await new Promise(r => setTimeout(r, 200));
    }

    // 3) offline varianta nesmí otisk nést
    const html = fs.readFileSync(SRC, 'utf8');
    const m = html.match(/function zipBezOtisku[\s\S]*?\n}\n/);
    check('zipBezOtisku existuje v programu', !!m);
    if (m) {
      const fn = new Function('return (' + m[0].replace(/^function /, 'function ') + ')')();
      const vzor = '<script src="knihovny/jspdf.umd.min.js"\n integrity="sha384-XXX"\n crossorigin="anonymous" referrerpolicy="no-referrer"><\/script>' +
                   '<script src="https://cdn.example/x.js" integrity="sha384-YYY"><\/script>';
      const out = fn(vzor);
      check('offline: u knihovny/ otisk zmizel', !/knihovny[\s\S]*?sha384-XXX/.test(out), out.split('\n')[0]);
      check('offline: crossorigin u knihovny/ zmizel', !/knihovny\/jspdf[^>]*crossorigin/.test(out));
      check('offline: cizí skript zůstal nedotčený', out.indexOf('sha384-YYY') !== -1);
      check('offline: cesta na knihovnu zůstala', out.indexOf('knihovny/jspdf.umd.min.js') !== -1);
    }

    // 4) svg2pdf z vektor/ (v9.127) — načítá se až při PDF schématu rozvaděče,
    //    se stejného původu, ale s otiskem: správné bajty projdou, o bit jiné ne,
    //    otisk sedí se souborem a z disku (file://) se otisk nenastaví.
    const kod = fs.readFileSync(SRC, 'utf8');
    const otisk = (kod.match(/var VEKTOR_OTISK = '([^']+)'/) || [])[1];
    const spoc = 'sha384-' + require('crypto').createHash('sha384').update(fs.readFileSync(path.join(DIR, '..', 'vektor', 'svg2pdf.umd.min.js'))).digest('base64');
    check('svg2pdf: otisk v programu sedí se souborem vektor/svg2pdf.umd.min.js', otisk === spoc, otisk + ' × ' + spoc);
    for (const [jmeno, tamper, cekamOk] of [['svg2pdf nedotčený', false, true], ['svg2pdf o 1 bit jinak', true, false]]) {
      const dir = DIR + '/_beh/sritest';
      fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir + '/vektor', { recursive: true });
      fs.copyFileSync(SRC, dir + '/index.html');
      fs.readdirSync(path.join(DIR, '..', 'vektor')).forEach(f => fs.copyFileSync(path.join(DIR, '..', 'vektor', f), dir + '/vektor/' + f));
      if (tamper) { const f = dir + '/vektor/svg2pdf.umd.min.js', bb = fs.readFileSync(f); bb[bb.length - 2] ^= 1; fs.writeFileSync(f, bb); }
      const a = start(8906, dir); await new Promise(r => setTimeout(r, 600));
      const ctx = await br.newContext();
      await ctx.addInitScript(() => { navigator.serviceWorker.register = () => new Promise(() => {}); });
      const p = await ctx.newPage(); const chyby = [];
      p.on('console', m => { if (m.type() === 'error') chyby.push(m.text()); });
      // knihovny z cdnjs sandbox nepustí — jsPDF se podstrčí z testy/knihovny
      await p.route(/cdnjs\.cloudflare\.com.*jspdf/, r => r.fulfill({ body: fs.readFileSync(path.join(DIR, 'knihovny', 'jspdf.umd.min.js')), contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
      await p.route(/cdnjs\.cloudflare\.com.*html2canvas/, r => r.fulfill({ body: fs.readFileSync(path.join(DIR, 'knihovny', 'html2canvas.min.js')), contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }));
      await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ body: '', contentType: 'text/css' }));
      await p.goto('http://127.0.0.1:8906/index.html', { waitUntil: 'load' });
      const v = await p.evaluate(async () => { const x = await vektorNacist(); const s = document.querySelector('script[src*="svg2pdf"]');
        return { ok: !!x, integrity: s ? s.integrity : null }; });
      check('SRI: ' + jmeno + ' → ' + (cekamOk ? 'se načte' : 'se NENAČTE (PDF schématu pak jako obrázek)'), v.ok === cekamOk && v.integrity === otisk, JSON.stringify(v));
      if (!cekamOk) check('  …a prohlížeč řekne proč (integrity v chybě)', chyby.some(t => /integrity/i.test(t)), chyby[0] || 'žádná chyba v konzoli');
      await ctx.close(); a.kill(); await new Promise(r => setTimeout(r, 200));
    }
    {
      const dir = DIR + '/_beh/sritest';
      const ctx = await br.newContext();
      await ctx.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
      const p = await ctx.newPage();
      await p.route(/^https?:/, r => r.abort());
      await p.goto('file://' + dir + '/index.html', { waitUntil: 'load' }).catch(() => {});
      const v = await p.evaluate(async () => { try { await vektorNacist(); } catch (e) {} const s = document.querySelector('script[src*="svg2pdf"]');
        return s ? s.getAttribute('integrity') : 'žádný skript'; }).catch(e => 'chyba: ' + e.message);
      check('offline z disku (file://): svg2pdf se načítá bez otisku', v === null, String(v));
      await ctx.close();
    }
  } finally {
    await br.close(); srv.forEach(p => { try { p.kill(); } catch (e) {} });
    fs.rmSync(DIR + '/_beh/sritest', { recursive: true, force: true });
  }
  console.log(res.join('\n'));
  console.log(res.every(r => r[0] === '✅') ? '\nVŠE OK (' + res.length + ')' : '\nSELHALO');
  process.exit(res.every(r => r[0] === '✅') ? 0 : 1);
})();
