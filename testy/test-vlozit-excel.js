// v9.92 — vložení bloku buněk z Excelu do tabulky měření.
const { chromium } = require('./pw');
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));

(async () => {
  const br = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await br.newContext({ viewport: { width: 1500, height: 1000 } });
  await ctx.addInitScript(() => { navigator.serviceWorker.register = () => new Promise(() => {}); });
  const p = await ctx.newPage();
  const chyby = []; p.on('pageerror', e => chyby.push(e.message));
  await p.goto('http://127.0.0.1:8901/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { window.confirm = () => true; });

  const novaElektro = async () => {
    await p.evaluate(async () => {
      localStorage.clear(); archiv.length = 0; STORE.archiv = archiv;
      STORE.technik = { jmeno: 'M. Technik' };
      aktTyp = 'elektro'; aktPodtyp = 'dum'; novaZprava('elektro');
      await new Promise(r => setTimeout(r, 800));
      document.querySelector('.tab-btn[data-tab="mereni"]').click();
    });
    await p.waitForTimeout(350);
  };
  // Obsah tabulky měření jako pole řetězců „sloupec|sloupec|…".
  const obsah = (n) => p.evaluate((n) => {
    const tb = document.querySelectorAll('#rozvadece-container tbody')[n || 0];
    return [...tb.querySelectorAll('tr[data-rowtype="obvod"],tr[data-rowtype="rcd-header"]')].map(tr =>
      TEREN_KOLONKY.map(s => { const i = fillCilovyInput(tr, s.i); return i ? i.value : ''; }).join('|'));
  }, n);
  const vlozitDoPole = (txt) => p.evaluate((t) => {
    document.getElementById('vm-text').value = t;
    vlozitMereniRozebrat();
  }, txt);
  const paste = (sel, txt) => p.evaluate(([s, t]) => {
    const inp = document.querySelector(s);
    const dt = new DataTransfer(); dt.setData('text/plain', t);
    const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
    inp.focus();
    inp.dispatchEvent(ev);
    return ev.defaultPrevented;
  }, [sel, txt]);
  const modalOtevreny = () => p.evaluate(() =>
    document.getElementById('modal-vlozit-mereni').classList.contains('open'));

  const TEREN_SL = await p.evaluate(() => {
    const m = {}; TEREN_KOLONKY.forEach((s, i) => { m[s.klic] = i; }); return m;
  });

  const HLAVICKA = 'Název obvodu\tZnačka\tCh./Typ\tA\tKabel typ, průřez\n' +
    'Světla chodba\tEATON\tB\t10\tCYKY 3×1,5\n' +
    'Zásuvky kuchyně\tOEZ\tB\t16\tCYKY 3×2,5\n' +
    'Myčka\tOEZ\tC\t16\tCYKY 3×2,5';

  // ══ 1. Hlavička se rozpozná a sloupce se spárují samy ═════════════
  await novaElektro();
  await p.evaluate(() => vlozitMereniOtevrit({ od: 1 }));
  await vlozitDoPole(HLAVICKA);
  let v = await p.evaluate(() => ({ h: __vlozeni.hlavicka, mapa: __vlozeni.mapa,
    check: document.getElementById('vm-hlavicka').checked,
    potvrdit: document.getElementById('vm-potvrdit').style.display !== 'none' }));
  check('hlavička v prvním řádku se pozná', v.h && v.check);
  check('sloupce se podle ní spárují s tabulkou',
    JSON.stringify(v.mapa) === JSON.stringify([1, 2, 3, 4, 15]), JSON.stringify(v.mapa));
  check('tlačítko „Vložit" se nabídne až po kontrole', v.potvrdit);
  await p.evaluate(() => vlozitMereniPotvrdit());
  await p.waitForTimeout(250);
  let o = await obsah();
  const sl = (radek, klic) => radek.split('|')[TEREN_SL[klic]];
  check('hodnoty padnou do správných sloupců',
    sl(o[0], 'n') === 'Světla chodba' && sl(o[0], 'typ') === 'EATON' &&
    sl(o[0], 'ch') === 'B' && sl(o[0], 'a') === '10' && sl(o[0], 'kabel') === 'CYKY 3×1,5', o[0]);
  check('prázdné výchozí řádky se použijí, nezůstanou viset nahoře',
    o.length === 3, o.length + ' řádků');
  check('vložené řádky se přečíslují 1,2,3',
    o.map(x => x.split('|')[0]).join(',') === '1,2,3', o.map(x => x.split('|')[0]).join(','));

  // ══ 1b. IΔn se nesmí vlít do sloupce A ═══════════════════════════
  await novaElektro();
  await p.evaluate(() => vlozitMereniOtevrit({ od: 1 }));
  await vlozitDoPole('Název obvodu\tA\tIΔn\nZásuvky\t16\t0,03');
  v = await p.evaluate(() => __vlozeni.mapa);
  check('„IΔn" se spáruje s IΔn, ne se jmenovitým proudem A',
    JSON.stringify(v) === JSON.stringify([1, 4, 5]), JSON.stringify(v));
  await p.evaluate(() => vlozitMereniPotvrdit());
  await p.waitForTimeout(250);
  o = await obsah();
  check('a hodnoty sednou do obou sloupců zvlášť',
    sl(o[0], 'a') === '16' && sl(o[0], 'idn') === '0,03', o[0]);

  // ══ 2. ZPĚT vrátí vložení ════════════════════════════════════════
  await novaElektro();
  await p.evaluate(() => vlozitMereniOtevrit({ od: 1 }));
  await vlozitDoPole(HLAVICKA);
  // Staré hlášky pryč, ať se „ZPĚT" netrefí do dřívějšího vložení.
  await p.evaluate(() => { const w = document.getElementById('toast-wrap'); if (w) w.innerHTML = ''; });
  await p.evaluate(() => vlozitMereniPotvrdit());
  await p.waitForTimeout(250);
  await p.evaluate(() => { const b = [...document.querySelectorAll('#toast-wrap button')]
    .filter(x => x.textContent.includes('ZPĚT'))[0]; if (b) b.click(); });
  await p.waitForTimeout(250);
  o = await obsah();
  check('ZPĚT vrátí vložení i nové řádky', o.length === 2 && !o[0].includes('Světla'), o.length + ': ' + o[0]);

  // ══ 3. Bez hlavičky se mapuje podle buňky, do které se vkládalo ══
  await novaElektro();
  const bezHlavicky = 'EATON\tB\t10\nOEZ\tC\t16';
  const cil = '#rozvadece-container tr[data-rowtype="obvod"] td:nth-child(3) input';
  let prevent = await paste(cil, bezHlavicky);
  check('Ctrl+V bloku do buňky si program vezme', prevent && await modalOtevreny());
  v = await p.evaluate(() => ({ od: __vlozeni.od, mapa: __vlozeni.mapa, h: __vlozeni.hlavicka,
    text: document.getElementById('vm-text').value.length }));
  check('mapuje se od sloupce, do kterého se vkládalo',
    !v.h && JSON.stringify(v.mapa) === JSON.stringify([2, 3, 4]), 'od ' + v.od + ' → ' + JSON.stringify(v.mapa));
  check('text ze schránky je v dialogu předvyplněný', v.text > 10);
  const prepsatVidi = await p.evaluate(() =>
    getComputedStyle(document.getElementById('vm-rezim-prepsat').parentNode).display !== 'none' &&
    document.getElementById('vm-rezim-prepsat').checked);
  check('u Ctrl+V do řádku se nabídne „přepsat od tohoto řádku" a je předvolené', prepsatVidi);
  await p.evaluate(() => vlozitMereniPotvrdit());
  await p.waitForTimeout(250);
  o = await obsah();
  check('blok bez hlavičky sedne od té buňky doprava a dolů',
    o[0].split('|')[2] === 'EATON' && o[0].split('|')[3] === 'B' && o[0].split('|')[4] === '10' &&
    o[1].split('|')[2] === 'OEZ', o[0] + ' / ' + o[1]);
  check('a nepřibyl řádek navíc (přepisovalo se do stávajících)', o.length === 2, o.length + ' řádků');

  // ══ 4. Jedna buňka propadne prohlížeči ═══════════════════════════
  await novaElektro();
  prevent = await paste(cil, 'EATON');
  check('vložení JEDNÉ hodnoty si program nebere', !prevent && !(await modalOtevreny()));

  // ══ 5. Ruční přemapování a „nevkládat" ═══════════════════════════
  await novaElektro();
  await p.evaluate(() => vlozitMereniOtevrit({ od: 1 }));
  await vlozitDoPole('Světla\tEATON\tB');
  const premapuj = (i, hodnota) => p.evaluate(([i, h]) => {
    const sel = document.querySelectorAll('.vm-mapa')[i];
    sel.value = h;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }, [i, hodnota]);
  await premapuj(1, '');       // Značka → nevkládat
  await premapuj(2, '15');     // třetí sloupec → Kabel
  await p.waitForTimeout(150);
  v = await p.evaluate(() => __vlozeni.mapa);
  check('sloupec jde přemapovat rukou', JSON.stringify(v) === JSON.stringify([1, null, 15]), JSON.stringify(v));
  await p.evaluate(() => vlozitMereniPotvrdit());
  await p.waitForTimeout(250);
  o = await obsah();
  check('„nevkládat" sloupec se opravdu nevloží a přemapovaný sedne',
    sl(o[0], 'n') === 'Světla' && sl(o[0], 'typ') === '' && sl(o[0], 'kabel') === 'B', o[0]);

  // ══ 6. Prázdná buňka nepřepíše naměřenou hodnotu ═════════════════
  await novaElektro();
  await p.evaluate(() => {
    const tr = document.querySelector('#rozvadece-container tr[data-rowtype="obvod"]');
    fillCilovyInput(tr, 7).value = '0,45';        // Zsm max
    fillCilovyInput(tr, 1).value = 'Původní';
  });
  await p.evaluate(() => vlozitMereniOtevrit({ od: 1 }));
  await vlozitDoPole('Název obvodu\tZsm max (Ω)\nSvětla chodba\t');
  await p.evaluate(() => {
    document.getElementById('vm-rezim-prepsat').checked = false;
    document.getElementById('vm-rezim-nove').checked = true;
    __vlozeni.startTr = document.querySelector('#rozvadece-container tr[data-rowtype="obvod"]');
    document.getElementById('vm-rezim-prepsat').checked = true;
    vlozitMereniPotvrdit();
  });
  await p.waitForTimeout(250);
  o = await obsah();
  check('prázdná buňka z Excelu nesmaže, co je naměřené',
    o[0].split('|')[1] === 'Světla chodba' && o[0].split('|')[7] === '0,45', o[0]);

  // ══ 7. Delší blok než řádků → zbytek se dopíše ═══════════════════
  await novaElektro();
  await p.evaluate(() => {
    __vlozeni = null;
    vlozitMereniOtevrit({ od: 1, startTr: document.querySelector('#rozvadece-container tr[data-rowtype="obvod"]'),
      tbody: document.querySelector('#rozvadece-container tbody') });
  });
  await vlozitDoPole('Světla\nZásuvky\nMyčka\nTrouba\nBojler');
  await p.evaluate(() => {
    document.getElementById('vm-rezim-prepsat').checked = true;
    vlozitMereniPotvrdit();
  });
  await p.waitForTimeout(250);
  o = await obsah();
  check('blok delší než tabulka dopíše zbývající řádky',
    o.length === 5 && sl(o[4], 'n') === 'Bojler', o.length + ' řádků, poslední „' + sl(o[4] || '', 'n') + '"');

  // ══ 8. Buňka s odřádkováním v uvozovkách ═════════════════════════
  await novaElektro();
  await p.evaluate(() => vlozitMereniOtevrit({ od: 1 }));
  await vlozitDoPole('"Světla\nchodba"\tEATON');
  v = await p.evaluate(() => __vlozeni.radky);
  check('buňka s odřádkováním v uvozovkách zůstane jednou buňkou',
    v.length === 1 && v[0][0] === 'Světla\nchodba' && v[0][1] === 'EATON', JSON.stringify(v));
  await p.evaluate(() => vlozitMereniZavrit());

  // ══ 9. Dokončená zpráva ══════════════════════════════════════════
  await novaElektro();
  const tlacitkoVidi = await p.evaluate(() => {
    const b = document.querySelector('[data-action="vlozitExcel"]');
    return !!(b && b.offsetHeight > 0);
  });
  check('tlačítko „📋 Vložit z Excelu" je u rozváděče vidět', tlacitkoVidi);
  await p.evaluate(() => setFormReadOnly(true));
  await p.waitForTimeout(200);
  const zamceno = await p.evaluate(() => {
    const b = document.querySelector('[data-action="vlozitExcel"]');
    return { btn: !!(b && b.offsetHeight > 0),
      paste: (() => {
        const inp = document.querySelector('#rozvadece-container tr[data-rowtype="obvod"] input');
        const dt = new DataTransfer(); dt.setData('text/plain', 'A\tB\nC\tD');
        const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
        inp.dispatchEvent(ev);
        return ev.defaultPrevented;
      })(),
      modal: document.getElementById('modal-vlozit-mereni').classList.contains('open') };
  });
  check('u dokončené zprávy je tlačítko schované a Ctrl+V se nechytá',
    !zamceno.btn && !zamceno.paste && !zamceno.modal, JSON.stringify(zamceno));
  await p.evaluate(() => setFormReadOnly(false));

  // ══ 10. Druhý rozváděč z nabídky ═════════════════════════════════
  await novaElektro();
  await p.evaluate(() => { addRozvadec(); });
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    const karty = document.querySelectorAll('#rozvadece-container [data-rozvadec-id]');
    karty[0].querySelector('.rozv-nazev').value = 'RH';
    karty[1].querySelector('.rozv-nazev').value = 'RM1';
    vlozitMereniOtevrit({ od: 1 });
  });
  await vlozitDoPole('Název obvodu\nSvětla RM1');
  await p.evaluate(() => {
    const sel = document.getElementById('vm-rozvadec');
    sel.value = document.querySelectorAll('#rozvadece-container [data-rozvadec-id]')[1].dataset.rozvadecId;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    vlozitMereniPotvrdit();
  });
  await p.waitForTimeout(250);
  const o0 = await obsah(0), o1 = await obsah(1);
  check('vkládá se do rozváděče vybraného v nabídce',
    o1.some(x => x.includes('Světla RM1')) && !o0.some(x => x.includes('Světla RM1')),
    'RH: ' + o0.length + ' řádků, RM1: ' + o1.map(x => sl(x, 'n')).join(','));
  check('zkopírovaný jediný sloupec i s nadpisem: nadpis do tabulky nespadne',
    !o1.some(x => sl(x, 'n') === 'Název obvodu'), o1.map(x => sl(x, 'n')).join(','));

  // ══ 11. Sloupec Č. proti automatickému číslování ═════════════════
  await novaElektro();
  await p.evaluate(() => vlozitMereniOtevrit({ od: 0 }));
  await vlozitDoPole('Č.\tNázev obvodu\nFA1\tSvětla');
  const varovani = await p.evaluate(() => document.getElementById('vm-nahled').innerText);
  check('náhled upozorní, že sloupec Č. přepíše automatické číslování',
    /automatick[éeá] číslování/i.test(varovani), varovani.slice(0, 160));

  // ══ 12. Chrániče (v9.133) — hlášení kolegy: tabulka ze schématu (výkres
  // RH01) se vložila celá jako jističe. Vymyšlená data podle tvaru výkresu:
  // „FI20, 0,03A, poznámka CHRÁNIČ" a za ním obvody 21–34.
  const RH01 = (() => {
    let t = 'Č.\tNázev obvodu\tCh./Typ\tA\tIΔn\tKabel typ, průřez\tPoznámka\n' +
      'FI20\t\t\t40\t0,03A\t\tCHRÁNIČ\n';
    for (let i = 21; i <= 34; i++) t += i + '\tObvod ' + i + '\t' + (i % 2 ? 'B' : 'C') + '\t' + (i % 3 ? 16 : 10) + '\t\tCYKY 3×2,5\t\n';
    return t;
  })();
  // Druhy po rozboru (s hlavičkou nad řádky).
  const druhyPro = (txt) => p.evaluate((t) => {
    vlozitMereniOtevrit({ od: 1 });
    document.getElementById('vm-text').value = t;
    vlozitMereniRozebrat();
    return { druhy: __vlozeni.druhy.slice(), info: (document.getElementById('vm-chranice') || {}).innerText || '' };
  }, txt);
  const radkyTabulky = () => p.evaluate(() => {
    const tb = document.querySelector('#rozvadece-container tbody');
    return [...tb.children].map(tr => ({ rt: tr.dataset.rowtype,
      v: TEREN_KOLONKY.map(s => { const i = fillCilovyInput(tr, s.i); return i ? i.value : ''; }),
      sel: tr.dataset.rowtype === 'rcd-header' ? tr.querySelector('select').value : null }));
  });

  await novaElektro();
  let ch = await druhyPro(RH01);
  check('RH01: „FI20, 0,03A, CHRÁNIČ" se pozná jako chránič, obvody 21–34 jako obvody',
    ch.druhy[0] === 'chranic' && ch.druhy.slice(1).every(d => d === 'obvod') && ch.druhy.length === 15, ch.druhy.join(','));
  check('nad náhledem: „Poznáno 1 chránič (FI20) se 14 obvody."', /Poznáno 1 chránič \(FI20\) se 14 obvody\./.test(ch.info), ch.info);
  const nahledCh = await p.evaluate(() => {
    const tr = document.querySelector('#vm-tabulka tbody tr[data-ri="0"]'), tr1 = document.querySelector('#vm-tabulka tbody tr[data-ri="1"]');
    return { sel: tr.querySelector('.vm-druh').value, volby: [...tr.querySelectorAll('.vm-druh option')].map(o => o.textContent),
      tucne: getComputedStyle(tr).fontWeight, odsazeni: parseFloat(getComputedStyle(tr1.children[1]).paddingLeft),
      odsazeni0: parseFloat(getComputedStyle(tr.children[1]).paddingLeft), vse: document.querySelectorAll('#vm-tabulka tbody tr[data-ri]').length };
  });
  check('náhled: chránič má jiný řádek a obvody pod ním jsou odsazené',
    nahledCh.sel === 'chranic' && +nahledCh.tucne >= 600 && nahledCh.odsazeni > nahledCh.odsazeni0 + 5, JSON.stringify(nahledCh));
  check('náhled: u řádku přepínač obvod / chránič / jistič s chráničem a vidět jsou všechny řádky',
    nahledCh.volby.join('|') === 'obvod|🛡 chránič|obvod – jistič s chráničem' && nahledCh.vse === 15, nahledCh.volby.join('|') + ' · ' + nahledCh.vse);
  const predVlozenim = await p.evaluate(() => JSON.stringify(getData().rozvadece.map(r => r.mereni)));
  await p.evaluate(() => vlozitMereniPotvrdit());
  await p.waitForTimeout(300);
  let tab = await radkyTabulky();
  check('chránič se vloží jako hlavička chrániče (In 40, IΔn 0,03, název FI20) i s podřádkem',
    tab[0].rt === 'rcd-header' && tab[0].v[TEREN_SL.a] === '40' && tab[0].v[TEREN_SL.idn] === '0,03' &&
    tab[0].v[TEREN_SL.n] === 'FI20' && tab[1].rt === 'rcd-mereni', JSON.stringify(tab.slice(0, 2)));
  const obvodyPod = tab.filter(x => x.rt === 'obvod');
  check('14 obvodů pod chráničem v původním pořadí, prázdné výchozí řádky nezůstaly',
    obvodyPod.length === 14 && obvodyPod[0].v[TEREN_SL.n] === 'Obvod 21' && obvodyPod[13].v[TEREN_SL.n] === 'Obvod 34' &&
    tab.length === 16, tab.map(x => x.rt + ':' + x.v[TEREN_SL.n]).join(','));
  check('naměřené hodnoty chrániče zůstanou prázdné (nic se nevymýšlí)',
    ['isc', 'zsm', 'riso', 'rpe', 'vyp', 'cas', 't5idn', 'ut'].every(k => !tab[0].v[TEREN_SL[k]]));
  const vData = await p.evaluate(() => getData().rozvadece[0].mereni.map(m => m.rowtype + ':' + (m.idn || '')));
  check('getData(): rcd-header s IΔn 0,03 a za ním obvody', vData[0] === 'rcd-header:0,03' && vData[1].startsWith('rcd-mereni') && vData[2] === 'obvod:', vData.slice(0, 3).join(','));
  await p.evaluate(() => zpetPosledni());     // = Ctrl+Z, poslední ZPĚT
  await p.waitForTimeout(250);
  const poZpet = await p.evaluate(() => JSON.stringify(getData().rozvadece.map(r => r.mereni)));
  check('ZPĚT vrátí tabulku přesně do stavu před vložením (i odebrané prázdné řádky)', poZpet === predVlozenim,
    poZpet.length + ' / ' + predVlozenim.length);

  // Další tvary rozpoznání (jen druh, bez vkládání)
  const H = 'Název obvodu\tCh./Typ\tA\tIΔn\tPoznámka\n';
  ch = await druhyPro(H + 'Proudový chránič\tAC\t40\t\t\n' + 'Ochrana koupelna\t\t40\t30\t\n' +
    'Zásuvky\tB/A\t16\t\t\n' + 'Světla\tB\t10\t\t\n' + 'Zásuvky balkon\tB\t16\t30 mA\t\n' +
    'Chránič typ B\t\t40\t30 mA\t\n' + 'Hlavní chránič\tB\t40\t0,03\t\n' + 'Garáž\tC16/A\t16\t\t\n' +
    'Pračka\tB16 A\t16\t\t\n' + 'Venkovní\tA-S\t40\t0,3\t\n' + 'Sauna\tC\t16\t0,03 A\ttyp A\n');
  const ocek = ['chranic', 'chranic', 'rcbo', 'obvod', 'rcbo', 'chranic', 'chranic', 'rcbo', 'rcbo', 'chranic', 'rcbo'];
  check('typ „AC" v Ch./Typ = chránič', ch.druhy[0] === 'chranic', ch.druhy[0]);
  check('IΔn ve vlastním sloupci bez charakteristiky = chránič', ch.druhy[1] === 'chranic', ch.druhy[1]);
  check('„B/A" a „C16/A" zůstanou obvod (jistič s chráničem)', ch.druhy[2] === 'rcbo' && ch.druhy[7] === 'rcbo');
  check('samotné „B" bez IΔn zůstane jistič', ch.druhy[3] === 'obvod', ch.druhy[3]);
  check('„B" + In 16 + 30 mA = jistič s chráničem (RCBO), ne chránič typu B', ch.druhy[4] === 'rcbo', ch.druhy[4]);
  check('„chránič typ B 40 A 30 mA" = chránič (i s „B" v Ch./Typ a slovem chránič)',
    ch.druhy[5] === 'chranic' && ch.druhy[6] === 'chranic', ch.druhy[5] + ',' + ch.druhy[6]);
  check('všech 11 tvarů podle pravidel', JSON.stringify(ch.druhy) === JSON.stringify(ocek), ch.druhy.join(','));
  check('souhrn jmenuje chrániče i jističe s chráničem', /Poznány 5 chrániče|Poznáno 5 chráničů/.test(ch.info) && /Jistič s chráničem: 5/.test(ch.info), ch.info);
  await p.evaluate(() => vlozitMereniPotvrdit());
  await p.waitForTimeout(300);
  tab = await radkyTabulky();
  const najdi = (n) => tab.find(x => x.v[TEREN_SL.n] === n) || { v: [] };
  check('chránič „AC" má typ AC v rozbalovátku, „A-S" typ A, „Chránič typ B" typ B',
    najdi('Proudový chránič').sel === 'AC' && najdi('Venkovní').sel === 'A' && najdi('Chránič typ B').sel === 'B',
    [najdi('Proudový chránič').sel, najdi('Venkovní').sel, najdi('Chránič typ B').sel].join(','));
  check('IΔn chrániče v jednotkách sloupce: 30 → 0,03, „30 mA" → 0,03, 0,3 zůstane',
    najdi('Ochrana koupelna').v[TEREN_SL.idn] === '0,03' && najdi('Chránič typ B').v[TEREN_SL.idn] === '0,03' &&
    najdi('Venkovní').v[TEREN_SL.idn] === '0,3');
  check('RCBO „B" + 30 mA → obvod s Ch. „B" a IΔn 0,03; s „typ A" v řádku Ch. „C/A"',
    najdi('Zásuvky balkon').rt === 'obvod' && najdi('Zásuvky balkon').v[TEREN_SL.ch] === 'B' &&
    najdi('Zásuvky balkon').v[TEREN_SL.idn] === '0,03' && najdi('Sauna').v[TEREN_SL.ch] === 'C/A',
    najdi('Zásuvky balkon').v[TEREN_SL.ch] + ' · ' + najdi('Sauna').v[TEREN_SL.ch]);
  check('„B/A" a „B16 A" se zapíší beze změny jako obvod',
    najdi('Zásuvky').rt === 'obvod' && najdi('Zásuvky').v[TEREN_SL.ch] === 'B/A' && najdi('Pračka').v[TEREN_SL.ch] === 'B16 A');

  // Přepínač v náhledu přebije rozpoznání
  await novaElektro();
  await druhyPro(RH01);
  const prep = await p.evaluate(() => {
    const s = document.querySelector('#vm-tabulka .vm-druh[data-ri="0"]');
    s.value = 'obvod'; s.dispatchEvent(new Event('change', { bubbles: true }));
    const s2 = document.querySelector('#vm-tabulka .vm-druh[data-ri="5"]');
    s2.value = 'chranic'; s2.dispatchEvent(new Event('change', { bubbles: true }));
    return { druhy: __vlozeni.druhy.slice(), info: (document.getElementById('vm-chranice') || {}).innerText || '',
      sel0: document.querySelector('#vm-tabulka .vm-druh[data-ri="0"]') === s };
  });
  check('přepínač u řádku změní druh bez překreslení náhledu a souhrn se přepočítá',
    prep.druhy[0] === 'obvod' && prep.druhy[5] === 'chranic' && prep.sel0 && /s 9 obvody/.test(prep.info), prep.info);
  await p.evaluate(() => vlozitMereniPotvrdit());
  await p.waitForTimeout(300);
  tab = await radkyTabulky();
  check('…a vloží se podle přepínače (FI20 jako obvod, řádek 25 jako chránič)',
    tab[0].rt === 'obvod' && tab.filter(x => x.rt === 'rcd-header').length === 1 &&
    tab.find(x => x.rt === 'rcd-header').v[TEREN_SL.n] === 'Obvod 25', tab.map(x => x.rt).join(','));

  // Zs mez: hlavička chrániče se nevyhodnocuje jako jistič, RCBO ano
  await novaElektro();
  await p.evaluate(async () => {
    const boxy = [...document.querySelectorAll('#napetova-checkboxy input[type=checkbox]')];
    const lbl = c => document.querySelector('label[for="' + c.id + '"]').textContent;
    boxy.forEach(c => { c.checked = /TN-C-S$/.test(lbl(c)); c.dispatchEvent(new Event('change', { bubbles: true })); });
  });
  await druhyPro('Název obvodu\tCh./Typ\tA\tIΔn\tZsm max (Ω)\nChránič typ B\tB\t40\t30 mA\t9\nZásuvky\tB\t16\t30 mA\t9\n');
  await p.evaluate(() => vlozitMereniPotvrdit());
  await p.waitForTimeout(500);
  const zs = await p.evaluate(() => {
    const tb = document.querySelector('#rozvadece-container tbody');
    const h = tb.querySelector('tr[data-rowtype="rcd-header"]'), o = tb.querySelector('tr[data-rowtype="obvod"]');
    const c = tr => { const i = fillCilovyInput(tr, 7); if (!i) return '?';
      return [...i.closest('td').classList].filter(x => /zs-lim/.test(x)).join(' ') + (/^≤/.test(i.placeholder) ? ' mez' : ''); };
    return { h: c(h), o: c(o), sel: h.querySelector('select').value };
  });
  check('Zs mez: vložený chránič (typ B) se nevyhodnocuje jako jistič B, jistič s chráničem ano',
    !/zs-lim-(ok|chyba|rcd)|mez/.test(zs.h) && /zs-lim-(chyba|rcd)/.test(zs.o) && zs.sel === 'B', JSON.stringify(zs));

  // Načtení .xlsx s chráničem — táž cesta
  await novaElektro();
  const xl = await p.evaluate(async () => {
    const radky = [['Místo:', 'X'], [], ['Č.', 'Název obvodu', 'Ch./Typ', 'A', 'IΔn', 'Kabel typ, průřez'],
      ['FI1', 'Proudový chránič', 'A', '40', '0,03', ''], ['2', 'Zásuvky', 'B', '16', '', 'CYKY 3×2,5'], ['3', 'Světla', 'B', '10', '', 'CYKY 3×1,5']];
    const blob = await xlsxVytvor([{ nazev: 'RH', radky: radky, hlavicky: [3] }]);
    const listy = await xlsxCti(await blob.arrayBuffer());
    vlozitMereniOtevrit({ od: 1 });
    vlozitZListu(listy, 'rh.xlsx');
    const d = __vlozeni.druhy.slice();
    vlozitMereniPotvrdit();
    await new Promise(r => setTimeout(r, 200));
    return { d, m: getData().rozvadece[0].mereni.map(m => m.rowtype + ':' + (m.n || '')) };
  });
  check('načtení .xlsx: chránič se pozná a vloží jako chránič s obvody pod ním',
    xl.d.join(',') === 'chranic,obvod,obvod' && xl.m[0] === 'rcd-header:Proudový chránič' &&
    xl.m.filter(x => x.startsWith('obvod:')).map(x => x.slice(6)).join(',') === 'Zásuvky,Světla', JSON.stringify(xl));

  // Bez chrániče se vkládá PŘESNĚ jako dosud — porovnání s předchozí verzí (8902)
  const BEZ = 'Č.\tNázev obvodu\tZnačka\tCh./Typ\tA\tIΔn\tKabel typ, průřez\n' +
    '1\tSvětla\tOEZ\tB\t10\t\tCYKY 3×1,5\n2\tZásuvky\tOEZ\tB/A\t16\t\tCYKY 3×2,5\n3\tSporák\tABB\tC\t3x16A\t\tCYKY 5×2,5\n' +
    '4\tPračka\t\tB16 A\t16\t\t\n5\tFAKTURACE\t\tgG\t25\t\t\n';
  const vlozBez = async (pg) => {
    await pg.evaluate(async (t) => {
      localStorage.clear(); archiv.length = 0; STORE.archiv = archiv; STORE.technik = { jmeno: 'M. Technik' };
      aktTyp = 'elektro'; aktPodtyp = 'dum'; novaZprava('elektro');
      await new Promise(r => setTimeout(r, 800));
      vlozitMereniOtevrit({ od: 1 }); document.getElementById('vm-text').value = t; vlozitMereniRozebrat(); vlozitMereniPotvrdit();
      await new Promise(r => setTimeout(r, 200));
    }, BEZ);
    return pg.evaluate(() => JSON.stringify(getData().rozvadece.map(r => r.mereni)));
  };
  const p2 = await ctx.newPage();
  await p2.goto('http://127.0.0.1:' + (process.env.PORT_STARA || 8902) + '/index.html', { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(1500);
  const stary = await vlozBez(p2), novy = await vlozBez(p);
  check('vložení bez chrániče: tabulka i getData() přesně jako v předchozí verzi', stary === novy, novy.slice(0, 160));
  await p2.close();

  // ══ Karta v Novinkách (schválena 2026-09-24) — hledá se podle titulku,
  // pořadí se ověřuje nárokem „nad ní nic staršího, pod ní nic novějšího".
  const nov = await p.evaluate(() => {
    const karty = [...document.querySelectorAll('#screen-novinky .scard[data-nov-datum]')];
    const i = karty.findIndex(k => /Excel ↔ tabulka měření/.test(k.textContent));
    if (i < 0) return null;
    const d = karty[i].dataset.novDatum;
    return { d, titulekDatum: !!karty[i].querySelector('.nov-datum'),
      nadStarsi: karty.slice(0, i).some(k => k.dataset.novDatum < d),
      podNovejsi: karty.slice(i + 1).some(k => k.dataset.novDatum > d),
      text: karty[i].textContent };
  });
  check('karta v Novinkách existuje a má datum v atributu i v titulku', !!nov && nov.titulekDatum, nov ? nov.d : 'chybí');
  check('karta stojí v časovém pořadí', !!nov && !nov.nadStarsi && !nov.podNovejsi);
  check('karta zmiňuje Ctrl+V, načtení .xlsx i pravý klik',
    !!nov && /Ctrl\+V/.test(nov.text) && /Načíst ze souboru \.xlsx/.test(nov.text) && /Pravý klik/.test(nov.text));

  check('žádné chyby v konzoli', chyby.length === 0, chyby.join(' | '));

  console.log(res.join('\n'));
  console.log('\n' + res.filter(x => x[0] === '✅').length + '/' + res.length + ' prošlo');
  await br.close();
  process.exit(res.some(x => x[0] === '❌') ? 1 : 0);
})();
