// Mobil — program musí jít ovládat na telefonu (360–414 px na výšku
// i telefon na šířku). Projde všechny obrazovky, záložky každého typu zprávy,
// dialogy, nabídky a bubliny a u každého stavu hledá:
//   posun-stránky   stránka je širší než displej (vodorovný posun celé stránky)
//   přesah          prvek leze za kraj displeje (a nejde k němu doscrollovat)
//   oříznuto        text uříznutý (overflow hidden / text-overflow) nebo
//                   rozbalovátko užší než zvolená hodnota
//   přetéká         text leze z prvku přes sousední (overflow visible)
//   nedosažitelné   ovládací prvek, na který nejde doscrollovat ani klepnout
//   zakryto         ovládací prvek trvale zakrytý pevně umístěným prvkem
//   pevný-prvek     pevně umístěný prvek zabírá velkou část displeje
//   mimo-obrazovku  dialog / nabídka / bublina se otevřela za krajem displeje
//   písmo<16        vstupní pole s písmem pod 16 px (iPhone při klepnutí přiblíží)
//   malý-prvek      ovládací prvek menší než 40 × 40 px
//   nalepené        dva ovládací prvky blíž než 4 px (a menší než 44 px ve směru, kde sousedí)
// Povolená výjimka: obsah uvnitř rámečku s vlastním vodorovným posunem
// (tabulka měření, náhled A4…) — je dosažitelný posunem rámečku. Takové
// rámečky se jen vypíšou (vnitrniPosun), nepočítají se jako problém.
//
// REZIM=test (výchozí)   ✅/❌ za každý stav a šířku — součást regrese
// REZIM=soupis           navíc JSON + snímky (375 px) do $VYSTUP
// REZIM=pc               jen snímky celé stránky v 1366 a 1920 px do $VYSTUP
// REZIM=pcstyly          v 1366 a 1920 px otisk spočítaných stylů a polohy KAŽDÉHO
//                        prvku v každém stavu do $VYSTUP/styly.json (porovnání PC
//                        před a po úpravě bez šumu z rasterizace snímků)
// Všechna data vymyšlená. Čas a náhoda jsou zmrazené (shodné snímky).
const { chromium } = require('./pw');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 8901;
const REZIM = process.env.REZIM || 'test';
const VYSTUP = process.env.VYSTUP || path.join(__dirname, '_beh', 'mobil');
const JEN = process.env.STAVY ? new RegExp(process.env.STAVY) : null;
const VPJEN = process.env.VP ? process.env.VP.split(',') : null;
const MOBIL = [
  { n: '360', w: 360, h: 740 }, { n: '375', w: 375, h: 812 }, { n: '390', w: 390, h: 844 },
  { n: '414', w: 414, h: 896 }, { n: 'na šířku', w: 844, h: 390 },
];
const PC = [{ n: '1366', w: 1366, h: 768 }, { n: '1920', w: 1920, h: 1080 }];
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));

// ── v prohlížeči: data, úklid, kontrola ─────────────────────────────────
function pomocnik() {
  const w = ms => new Promise(r => setTimeout(r, ms));
  const nastav = (id, v) => { const e = document.getElementById(id); if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); } };
  const bunka = (tr, sl, v) => { const i = fillCilovyInput(tr, sl); if (i) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); } };
  const M = window.__M = {};
  M.w = w;
  M.akce = (jmeno, koren) => {
    const el = Array.from((koren || document).querySelectorAll('[data-action="' + jmeno + '"]')).find(e => e.offsetParent !== null || e.getClientRects().length);
    if (el) el.click();
    return !!el;
  };
  M.fixture = async () => {
    localStorage.clear(); archiv.length = 0; STORE.archiv = archiv;
    Object.assign(STORE.technik = STORE.technik || {}, { jmeno: 'Jan Vymyšlený', osvedceni: '1234/5/26/EZ-E2A', telefon: '+420 600 000 000',
      email: 'jan.vymysleny@example.cz', mesto: 'Kyjov', ico: '12345678' });
    // ELEKTRO — průmysl, dva rozváděče provázané, chránič, jiný řádek, závady
    aktPodtyp = 'prumysl'; novaZprava('elektro'); await w(250);
    nastav('f_ev_cislo', 'RE-26-0101');
    nastav('f_misto', 'Vymyšlená výrobní hala 3 – lisovna a sklad hotových výrobků');
    nastav('f_adresa', 'Průmyslová 1234/56, 697 01 Kyjov');
    nastav('f_provozovatel', 'Vymyšlená strojírna s.r.o., Průmyslová 1234/56, 697 01 Kyjov, IČO 12345678');
    switchTab('mereni');
    let karta = document.querySelector('#rozvadece-container [data-rozvadec-id]');
    karta.querySelector('.rozv-nazev').value = 'RH';
    let tb = karta.querySelector('tbody');
    while (tb.querySelectorAll('tr[data-rowtype="obvod"]').length < 4) addMereniRowTo(tb);
    const ob = Array.from(tb.querySelectorAll('tr[data-rowtype="obvod"]'));
    [['Světla kancelář', 'B', '10', '', '0,85'], ['Zásuvky dílna – pracovní stůl u okna', 'B', '16', '', '2,50'],
     ['Koupelna', 'B', '16', '0,03', '2,50'], ['Vývod do RS1', 'C', '32', '', '0,40']].forEach((d, i) => {
      bunka(ob[i], 1, d[0]); bunka(ob[i], 2, 'OEZ LTN'); bunka(ob[i], 3, d[1]); bunka(ob[i], 4, d[2]); bunka(ob[i], 5, d[3]); bunka(ob[i], 7, d[4]);
      bunka(ob[i], 8, '>20'); bunka(ob[i], 15, 'CYKY-J 3×2,5');
    });
    addRcdRow(karta.querySelector('[data-action="addRcdRow"]') || null);
    M.akce('addInfoRow', karta);
    addRozvadec(); await w(50);
    const karty = document.querySelectorAll('#rozvadece-container [data-rozvadec-id]');
    const k2 = karty[karty.length - 1];
    k2.querySelector('.rozv-nazev').value = 'RS1';
    const uid2 = k2.dataset.rozvUid;
    if (uid2 && typeof napajiZapsat === 'function') napajiZapsat(ob[3], [uid2], []);
    if (typeof stromZajistitTlacitka === 'function') stromZajistitTlacitka();
    addZavada(); addZavada();
    const zt = document.querySelectorAll('#zavady-list .zavada-item textarea');
    if (zt[0]) zt[0].value = 'V rozváděči RH chybí označení obvodů a schéma zapojení, kryty nejsou zajištěny proti otevření nepovolanou osobou.';
    addDokumentace();
    window.__formDirty = false; saveToArchiv();
    // LPS
    aktPodtyp = 'lps'; novaZprava('lps'); await w(250);
    nastav('f_ev_cislo', 'RE-26-0102'); nastav('f_misto', 'Vymyšlený rodinný dům s garáží');
    nastav('f_adresa', 'Polní 12, 697 01 Kyjov');
    for (let i = 0; i < 3; i++) M.akce('addLpsMereni') || (typeof addLpsMereni === 'function' && addLpsMereni());
    window.__formDirty = false; saveToArchiv();
    // STROJE
    aktPodtyp = 'dum'; novaZprava('stroje'); await w(250);
    nastav('f_ev_cislo', 'RS-26-0001'); nastav('f_misto', 'Vymyšlená kuchyně školní jídelny');
    document.querySelectorAll('#stroje-blok input[type=text]').forEach((e, i) => { if (i < 6 && !e.value) e.value = ['Konvektomat', 'CPC 61', 'Vymyšlený výrobce a.s.', 'VC-0001', '2019', 'Kuchyně'][i]; });
    window.__formDirty = false; saveToArchiv();
    // SPOTŘEBIČE
    novaZprava('spotrebice'); await w(250);
    nastav('f_ev_cislo', 'RSP-26-0001'); nastav('f_misto', 'Vymyšlená kancelář – 2. patro');
    for (let i = 0; i < 3; i++) addSpotrebic();
    window.__formDirty = false; saveToArchiv();
    // TVORBA DOKUMENTACE — protokol o určení vnějších vlivů se dvěma skupinami
    await dokNovy('pouvv');
    const f = dokForm(), dk = (s, v, r) => { const e = (r || f).querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
    dk('[data-dk="stavba"]', 'Vymyšlená administrativní budova s dlouhým názvem stavby'); dk('[data-dk="investor.nazev"]', 'Vymyšlená stavební s.r.o.');
    dk('[data-dk="misto"]', 'Polní 12, 697 01 Kyjov'); dk('[data-k="jmeno"]', 'Ing. Petr Vymyšlený'); dk('[data-k="funkce"]', 'projektant');
    let sk = f.querySelector('.dk-skupina');
    dokProstoryVlozit(sk, dokRozborProstoru('101\tKancelář\n102\tChodba'));
    let sel = sk.querySelector('.dk-vzor-vyber'); sel.value = 'vest-kotelna'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    TD_AKCE.tdSkupinaPridat(); sk = f.querySelectorAll('.dk-skupina')[1];
    dokProstoryVlozit(sk, dokRozborProstoru('104 Sprcha'));
    sel = sk.querySelector('.dk-vzor-vyber'); sel.value = 'vest-sprcha'; sel.dispatchEvent(new Event('change', { bubbles: true }));
    await dokUlozitOtevreny();
    // ROZVADĚČ DBO — byt 3+1 ve skříni 3×12
    await dokNovy('rozv');
    dk('[data-dk="oznaceni"]', 'RH1'); dk('[data-dk="stavba"]', 'Byt 3+1, Vymyšlená 12'); dk('[data-dk="investor.nazev"]', 'Petr Smyšlený');
    rozvSkrinNastavit(rozvKnihPolozka('v-sk-3x12-n'));
    if (window.__rozvByt) window.__rozvByt();   // testy/rozvadec-byt.js
    await dokUlozitOtevreny();
    showScreen('home');
  };
  M.dok = async () => { await dokOtevrit(DOK.dokumenty.find(x => x.typ === 'pouvv').uid); await w(150); };
  M.zrevize = async () => {
    // vymyšlená zpráva jen v paměti (nic se neukládá)
    const o = (c, n, typ, ch, a, x) => Object.assign({ rowtype: 'obvod', napaji: [], c, n, typ, ch, a, idn: '', kabel: '' }, x || {});
    if (!archiv.some(z => z.uid === 'm-zr')) archiv.unshift({ uid: 'm-zr', typ: 'elektro', ev_cislo: 'RE-26-0012', misto: 'Byt Polní 12', datum: '2026-10-19', stav: '',
      data: { typ: 'elektro', ev_cislo: 'RE-26-0012', misto: 'Byt Polní 12', zahajeni: '2026-10-19', provozovatel: 'Jan Vymyšlený\nPolní 12', napetova_soustava: '1NPE ~50Hz 230V / TN-C-S',
        rozvadece: [{ uid: 'm-rh', nazev: 'RH', umisteni: 'Chodba', mereni: [o('1', 'Sporák', 'Hager', 'B', '3x16A'), o('2', 'Vývod RS1', '', 'B', '1x20', { napaji: ['m-rs1'] })] },
          { uid: 'm-rs1', nazev: 'RS1 kuchyň', umisteni: 'Kuchyň', mereni: [o('1', 'Chránič', '', 'A', '40', { rowtype: 'rcd-header', idn: '0,03' }), o('2', 'Zásuvky', '', 'B', '1x16')] }] } });
    dokOtevritSeznam('rozv'); await w(100); TD_AKCE.tdRZRevize(); await w(100);
  };
  M.rozv = async () => { await dokOtevrit(DOK.dokumenty.find(x => x.typ === 'rozv').uid); await w(200); };
  M.otevri = async (ev) => {
    const i = archiv.findIndex(z => (z.ev_cislo || (z.data && z.data.ev_cislo)) === ev);
    otevritZpravu(i); await w(400);
    if (window.__formReadOnly) setFormReadOnly(false);
    window.__formDirty = false;
  };
  M.uklid = async () => {
    document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open'));
    document.querySelectorAll('.kt-menu, .sp-volby, .zs-lim-bublina').forEach(e => e.remove());
    if (typeof zsLimBublinaSkryj === 'function') zsLimBublinaSkryj();
    const tl = document.getElementById('txt-lista'); if (tl) tl.style.display = 'none';
    const tw = document.getElementById('toast-wrap'); if (tw) tw.innerHTML = '';
    if (typeof formArchivZapnut === 'function' && formArchivZapnut()) formArchivNastavit(false);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (window.__formReadOnly) setFormReadOnly(false);
    try { localStorage.removeItem('revize_el_rz_info'); } catch (e) {}
    window.__formDirty = false;
    showScreen('home'); window.scrollTo(0, 0); await w(30);
  };

  // ── kontrola ──
  const vid = el => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    return true;
  };
  const GEN = /\d{2,}|^(ns|n|och|chk|rozv|rcd)-/;
  const sig = el => {
    const casti = [];
    let e = el;
    for (let i = 0; i < 3 && e && e !== document.body; i++) {
      let s = e.tagName.toLowerCase();
      if (e.id && !GEN.test(e.id)) { casti.unshift(s + '#' + e.id); break; }
      const cl = Array.from(e.classList).filter(c => !/^(active|open|selected|dirty|saved|zs-lim-(ok|chyba|rcd)|mr-vybrany|row-|fill-|kt-aktivni)/.test(c)).slice(0, 2);
      if (cl.length) s += '.' + cl.join('.');
      if (e.dataset && e.dataset.action) s += '[' + e.dataset.action + ']';
      if (e.type && e.tagName === 'INPUT') s += '[' + e.type + ']';
      casti.unshift(s);
      e = e.parentElement;
    }
    const kontext = el.closest('[id]:not(input):not(textarea):not(select)');
    const k = kontext && kontext !== el && !GEN.test(kontext.id) && casti[0].indexOf('#') === -1 ? '#' + kontext.id + ' … ' : '';
    return k + casti.join(' > ');
  };
  const popis = el => (el.getAttribute('aria-label') || el.title || el.placeholder || el.value || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  const posunPredek = el => {
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && a.scrollWidth > a.clientWidth + 1) return a;
    }
    return null;
  };
  const pevnyPredek = el => {
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const p = getComputedStyle(a).position;
      if (p === 'fixed' || (p === 'sticky' && !a.closest('table'))) return a;
    }
    return null;
  };
  const TEXTOVE = /^(text|search|email|tel|url|number|password|date|time|datetime-local|month|week|)$/;
  const jeCil = el => {
    const t = el.tagName;
    if (t === 'BUTTON' || t === 'SELECT' || t === 'TEXTAREA' || t === 'SUMMARY') return true;
    if (t === 'A' && el.hasAttribute('href')) return true;
    if (t === 'INPUT') return el.type !== 'hidden';
    if (el.getAttribute('role') === 'button') return true;
    if (el.isContentEditable && el.getAttribute('contenteditable') === 'true') return true;
    if (el.dataset.action && t !== 'TR' && t !== 'TD' && t !== 'DIV' && t !== 'TH' && t !== 'TABLE' && t !== 'LI') return true;
    if (el.dataset.action && (t === 'TH' || t === 'DIV')) return getComputedStyle(el).cursor === 'pointer';
    return false;
  };
  // Plocha, na kterou se dá klepnout: u zaškrtávátka i jeho popisek
  const plocha = el => {
    let r = el.getBoundingClientRect();
    if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
      const lab = el.closest('label') || (el.id && document.querySelector('label[for="' + el.id + '"]'));
      if (lab && vid(lab)) {
        const q = lab.getBoundingClientRect();
        r = { left: Math.min(r.left, q.left), top: Math.min(r.top, q.top), right: Math.max(r.right, q.right), bottom: Math.max(r.bottom, q.bottom) };
        r.width = r.right - r.left; r.height = r.bottom - r.top;
      }
    }
    return r;
  };
  const vRadku = el => {   // odkaz uprostřed textu (WCAG výjimka)
    if (el.tagName !== 'A') return false;
    const p = el.parentElement;
    return p && getComputedStyle(el).display === 'inline' && (p.textContent || '').trim().length > (el.textContent || '').trim().length + 15;
  };
  M.kontrola = async (o) => {
    const VW = o.vw, VH = o.vh;
    const koren = o.koren ? document.querySelector(o.koren) : null;
    const korenEl = koren || document.querySelector('.screen.active') || document.body;
    const pr = [];
    const add = (kat, el, extra) => pr.push({ kat, sig: typeof el === 'string' ? el : sig(el), text: typeof el === 'string' ? '' : popis(el), extra: extra || '' });
    const vnitrni = new Set();
    // 1) posun celé stránky
    const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    if (sw > VW + 1) add('posun-stránky', 'stránka', sw + ' px');
    // prvky v kořeni (+ topbar a pevné prvky, když kořen není dialog)
    const vse = Array.from(korenEl.querySelectorAll('*'));
    if (!koren) {
      document.querySelectorAll('.topbar, .topbar *, #stavovy-radek, #stavovy-radek *, .voice-fab, .form-archiv, .form-archiv *').forEach(e => vse.push(e));
    } else vse.unshift(koren);
    const vid2 = new Map();
    const jeVid = e => { if (!vid2.has(e)) vid2.set(e, vid(e)); return vid2.get(e); };
    // 2) přesah a oříznutí
    for (const el of vse) {
      if (!jeVid(el)) continue;
      const t = el.tagName;
      if (t === 'OPTION' || t === 'SCRIPT' || t === 'STYLE' || t === 'BR') continue;
      const r = el.getBoundingClientRect();
      if (r.right > VW + 1 || r.left < -1) {
        const sp = posunPredek(el);
        const sr = sp && sp.getBoundingClientRect();
        if (sp && sr.left >= -1 && sr.right <= VW + 1) vnitrni.add(sig(sp));
        else if (!pevnyPredek(el) || getComputedStyle(pevnyPredek(el)).pointerEvents !== 'none') {
          const rp = el.parentElement && el.parentElement.getBoundingClientRect();
          const rodicLeze = rp && (rp.right > VW + 1 || rp.left < -1) && el.parentElement !== document.body;
          if (!rodicLeze) add('přesah', el, Math.round(r.left) + '–' + Math.round(r.right) + ' px');
        }
      }
      if (t === 'SELECT' && el.selectedIndex >= 0) {
        // rozbalovátko užší než zvolená hodnota (vidět jen šipka nebo kus textu)
        const cs = getComputedStyle(el);
        const ctx = (M.__cv = M.__cv || document.createElement('canvas')).getContext('2d');
        ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        const w = ctx.measureText(el.options[el.selectedIndex].text).width;
        const volno = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 18;
        // Dlouhou volbu zkrátí i nativní rozbalovátko telefonu — vadou je,
        // když není vidět aspoň 80 px textu (nebo celý kratší text).
        if (volno + 2 < Math.min(w, 80)) add('oříznuto', el, 'rozbalovátko ' + Math.round(w) + '/' + Math.round(volno) + ' px');
      }
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || t === 'IMG' || t === 'CANVAS' || t === 'svg' || el.closest('svg')) continue;
      const cs = getComputedStyle(el);
      const txt = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim()) || el.children.length === 0 && el.textContent.trim();
      if (!txt) continue;
      if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && el.scrollWidth > el.clientWidth + 1) add('oříznuto', el, 'šířka ' + el.clientWidth + '/' + el.scrollWidth);
      else if (cs.overflowX === 'visible' && cs.display !== 'inline' && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && !(cs.overflowY === 'auto' || cs.overflowY === 'scroll'))
        add('přetéká', el, 'text ' + el.scrollWidth + ' px v ' + el.clientWidth + ' px');
      else if ((cs.overflowY === 'hidden' || cs.overflowY === 'clip') && el.scrollHeight > el.clientHeight + 2) add('oříznuto', el, 'výška ' + el.clientHeight + '/' + el.scrollHeight);
    }
    // 3) písmo, velikost, rozestupy
    // Zakázaný prvek (dokončená zpráva) ani prvek bez reakce na dotyk
    // se ovládat nedá — nepočítá se jako ovládací.
    const cile = vse.filter(e => jeVid(e) && jeCil(e) && !e.disabled && getComputedStyle(e).pointerEvents !== 'none');
    const plochy = new Map();
    for (const el of cile) {
      const t = el.tagName;
      if ((t === 'INPUT' && TEXTOVE.test(el.type)) || t === 'SELECT' || t === 'TEXTAREA' || (el.isContentEditable && el.getAttribute('contenteditable') === 'true')) {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 16) add('písmo<16', el, fs + ' px');
      }
      if (vRadku(el)) continue;
      const r = plocha(el);
      plochy.set(el, r);
      if (r.width < 40 - 0.5 || r.height < 40 - 0.5) add('malý-prvek', el, Math.round(r.width) + '×' + Math.round(r.height));
    }
    // Buňky tabulky (včetně záhlaví) sousedí jako v Excelu, to vadu nedělá;
    // pevně umístěné prvky (mikrofon) se posouvají přes obsah — u nich
    // rozhoduje kontrola „zakryto", ne sousedství.
    const seznam = Array.from(plochy.entries()).filter(([el]) => !(el.closest('td, th') && el.closest('table')) && !pevnyPredek(el));
    for (let i = 0; i < seznam.length; i++) for (let j = i + 1; j < seznam.length; j++) {
      const [a, ra] = seznam[i], [b, rb] = seznam[j];
      if (a.contains(b) || b.contains(a)) continue;
      const la = a.closest('label'), lb = b.closest('label');
      if ((la && (la.contains(b))) || (lb && lb.contains(a))) continue;
      const dx = Math.max(0, rb.left - ra.right, ra.left - rb.right);
      const dy = Math.max(0, rb.top - ra.bottom, ra.top - rb.bottom);
      // Těsně u sebe nevadí, když je každý dost velký ve směru, ve kterém
      // sousedí (položky nabídky pod sebou, každá aspoň 44 px vysoká).
      const podSebou = dx === 0, vedle = dy === 0;
      const dost = (podSebou && ra.height >= 44 && rb.height >= 44) || (vedle && !podSebou && ra.width >= 44 && rb.width >= 44);
      if (dx < 4 && dy < 4 && !dost) {
        const s = [sig(a), sig(b)].sort();
        add('nalepené', s[0] + ' ↔ ' + s[1]);
      }
    }
    // 4) dialog / nabídka / bublina mimo obrazovku
    if (koren) {
      const box = koren.classList.contains('modal-overlay') ? (koren.querySelector('.modal') || koren.firstElementChild) : koren;
      const r = box.getBoundingClientRect();
      if (r.left < -1 || r.top < -1 || r.right > VW + 1 || r.bottom > VH + 1) add('mimo-obrazovku', box, Math.round(r.left) + ',' + Math.round(r.top) + '–' + Math.round(r.right) + ',' + Math.round(r.bottom));
    }
    // 5) pevné prvky, které zabírají displej
    if (!koren) {
      document.querySelectorAll('body *').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.position !== 'fixed' && cs.position !== 'sticky') return;
        if (el.closest('table') || el.closest('.modal-overlay')) return;
        if (!vid(el)) return;
        const r = el.getBoundingClientRect();
        const vyska = Math.min(r.bottom, VH) - Math.max(r.top, 0);
        if (vyska > VH * 0.25 && (r.width > VW * 0.5)) add('pevný-prvek', el, Math.round(vyska) + ' px');
      });
    }
    // 6) dosažitelnost — doscrollovat a klepnout (jako prst)
    const sx = window.scrollX, sy = window.scrollY;
    const ulozene = [];
    for (const el of cile) {
      if (!el.isConnected || !vid(el)) continue;
      // posun rámečků, které se scrollIntoView pohnou, se po kontrole vrátí
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (a.scrollLeft || a.scrollTop) ulozene.push([a, a.scrollLeft, a.scrollTop]);
      el.scrollIntoView({ block: 'center', inline: 'center' });
      // klepne se do VIDITELNÉ části (průnik s displejem a s rámečky, které
      // obsah ořezávají) — široký prvek může přečnívat přes kraj rámečku
      let r = el.getBoundingClientRect();
      let x0 = Math.max(r.left, 0), x1 = Math.min(r.right, VW), y0 = Math.max(r.top, 0), y1 = Math.min(r.bottom, VH);
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
          const q = a.getBoundingClientRect();
          x0 = Math.max(x0, q.left); x1 = Math.min(x1, q.right); y0 = Math.max(y0, q.top); y1 = Math.min(y1, q.bottom);
        }
      }
      const mimo = x1 - x0 < 1 || y1 - y0 < 1;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const h = mimo ? null : document.elementFromPoint(cx, cy);
      const lab = h && h.closest && h.closest('label');
      const ok = h && (h === el || el.contains(h) || (lab && (lab.contains(el) || (el.id && lab.htmlFor === el.id))));
      if (!ok) {
        const pv = h && pevnyPredek(h);
        if (pv && !pv.contains(el) && !(koren && koren.contains(pv) && pv === koren)) add('zakryto', el, 'zakrývá ' + sig(pv));
        else add('nedosažitelné', el, h ? 'na místě je ' + sig(h) : 'mimo displej');
      }
    }
    ulozene.reverse().forEach(([a, l, t]) => { a.scrollLeft = l; a.scrollTop = t; });
    window.scrollTo(sx, sy);
    // sloučit stejné
    const m = new Map();
    pr.forEach(p => { const k = p.kat + '|' + p.sig; if (!m.has(k)) m.set(k, Object.assign({ pocet: 0 }, p)); m.get(k).pocet++; });
    return { problemy: Array.from(m.values()), vnitrniPosun: Array.from(vnitrni) };
  };
}

// ── stavy ───────────────────────────────────────────────────────────────
// Každý stav: { id, skupina, krok(p) [, koren] }. `koren` = co se kontroluje
// (dialog, nabídka); bez něj aktivní obrazovka + lišta + pevné prvky.
const E = (f, ...a) => p => p.evaluate(f, ...a);

async function rozbalitZalozky(p) {
  // seznam záložek pro každý typ zprávy (podle viditelné lišty)
  const out = {};
  for (const ev of ['RE-26-0101', 'RE-26-0102', 'RS-26-0001', 'RSP-26-0001']) {
    out[ev] = await p.evaluate(async (ev) => {
      await __M.otevri(ev);
      const bar = aktivniTabBar();
      return { typ: aktTyp, taby: bar ? Array.from(bar.querySelectorAll('.tab-btn')).filter(b => b.offsetParent).map(b => b.getAttribute('data-tab')) : [] };
    }, ev);
  }
  return out;
}

function vsechnyStavy(zalozky) {
  const S = [];
  const add = (id, skupina, krok, koren) => S.push({ id, skupina, krok, koren });
  add('domů', 'Úvod a archiv', E(async () => { showScreen('home'); await __M.w(100); }));
  add('domů – výběr zpráv', 'Úvod a archiv', E(async () => {
    showScreen('home'); await __M.w(50);
    const cb = Array.from(document.querySelectorAll('#archiv-container input[type=checkbox]')).filter(c => c.offsetParent);
    cb.slice(1, 3).forEach(c => c.click()); await __M.w(100);
  }));
  add('výběr typu zprávy', 'Úvod a archiv', E(async () => { showScreen('podtyp'); await __M.w(50); }));
  add('novinky', 'Novinky', E(async () => { showScreen('novinky'); await __M.w(50); }));
  add('novinky – hledání', 'Novinky', E(async () => {
    showScreen('novinky'); const i = document.querySelector('#screen-novinky input');
    if (i) { i.value = 'chránič'; i.dispatchEvent(new Event('input', { bubbles: true })); } await __M.w(100);
  }));
  add('nastavení', 'Nastavení', E(async () => { showScreen('nastaveni'); await __M.w(80); }));
  const JMENA = { elektro: 'Formulář elektro', lps: 'Formulář LPS', stroje: 'Formulář stroje', spotrebice: 'Formulář spotřebiče' };
  for (const ev of Object.keys(zalozky)) {
    const z = zalozky[ev];
    for (const tab of z.taby) {
      const sk = tab === 'mereni' ? 'Tabulka měření' : JMENA[z.typ];
      add(z.typ + ' – ' + tab, sk, E(async ([ev, tab]) => {
        await __M.otevri(ev); showScreen('form');
        const bt = aktivniTabBar().querySelector('.tab-btn[data-tab="' + tab + '"]');
        switchTab(tab, bt); await __M.w(120);
      }, [ev, tab]));
    }
  }
  // tabulka měření — další stavy
  add('měření – odrolováno (plovoucí hlavička)', 'Tabulka měření', E(async () => {
    await __M.otevri('RE-26-0101'); showScreen('form'); switchTab('mereni', aktivniTabBar().querySelector('[data-tab="mereni"]')); await __M.w(100);
    const t = document.querySelector('#rozvadece-container .meas-table tbody tr:nth-child(3)');
    window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - 60); window.dispatchEvent(new Event('scroll')); await __M.w(150);
  }));
  add('měření – dokončená zpráva', 'Tabulka měření', E(async () => {
    await __M.otevri('RE-26-0101'); showScreen('form'); switchTab('mereni', aktivniTabBar().querySelector('[data-tab="mereni"]'));
    setFormReadOnly(true); await __M.w(120);
  }));
  add('měření – bublina Zs', 'Plovoucí prvky', E(async () => {
    await __M.otevri('RE-26-0101'); showScreen('form'); switchTab('mereni', aktivniTabBar().querySelector('[data-tab="mereni"]')); await __M.w(150);
    const ik = document.querySelectorAll('#rozvadece-container .zs-lim-ikona')[1];
    const td = ik ? ik.closest('td') : zsLimBunka(document.querySelectorAll('#rozvadece-container tr[data-rowtype="obvod"]')[1], 7);
    td.scrollIntoView({ block: 'center', inline: 'center' }); await __M.w(150); zsLimBublinaUkaz(td, 'ikona'); await __M.w(80);
  }), '.zs-lim-bublina');
  add('měření – kontextové menu', 'Plovoucí prvky', E(async () => {
    await __M.otevri('RE-26-0101'); showScreen('form'); switchTab('mereni', aktivniTabBar().querySelector('[data-tab="mereni"]')); await __M.w(100);
    const td = document.querySelectorAll('#rozvadece-container tr[data-rowtype="obvod"] td')[14];
    td.scrollIntoView({ block: 'center', inline: 'center' }); await __M.w(150);
    const r = td.getBoundingClientRect();
    td.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.right - 2, clientY: r.bottom - 2, button: 2 }));
    await __M.w(80);
  }), '.kt-menu');
  add('elektro – postranní archiv', 'Formulář elektro', E(async () => {
    await __M.otevri('RE-26-0101'); showScreen('form'); formArchivNastavit(true); await __M.w(150);
  }), '.form-archiv');
  add('elektro – našeptávač místa', 'Plovoucí prvky', E(async () => {
    await __M.otevri('RE-26-0101'); showScreen('form'); switchTab('titulni', aktivniTabBar().querySelector('[data-tab="titulni"]')); await __M.w(80);
    const m = document.getElementById('f_misto'); m.scrollIntoView({ block: 'center' }); await __M.w(150); m.focus(); m.value = ''; await __M.w(150);
    mistoNabidkaOtevrit(m); await __M.w(150);
  }), '.misto-nabidka');
  add('elektro – lišta formátování textu', 'Plovoucí prvky', E(async () => {
    await __M.otevri('RE-26-0101'); showScreen('form'); switchTab('popis', aktivniTabBar().querySelector('[data-tab="popis"]')); await __M.w(80);
    const r = Array.from(document.querySelectorAll('#tab-popis .rich-edit')).find(e => e.offsetParent);
    r.scrollIntoView({ block: 'center' }); await __M.w(150); r.focus(); r.dispatchEvent(new Event('focusin', { bubbles: true })); await __M.w(120);
  }), '#txt-lista');
  add('elektro – hláška se ZPĚT', 'Plovoucí prvky', E(async () => {
    await __M.otevri('RE-26-0101'); showScreen('form');
    showToast('Řádek smazán — dlouhá hláška, aby bylo vidět zalomení na úzkém displeji', { timeout: 60000, actionLabel: '↩ ZPĚT', action: function () {} }); await __M.w(80);
  }), '#toast-wrap');
  add('spotřebiče – nabídka voleb', 'Plovoucí prvky', E(async () => {
    await __M.otevri('RSP-26-0001'); showScreen('form'); await __M.w(150);
    const sel = Array.from(document.querySelectorAll('#tab-spotrebice select.sp-pole')).find(s => s.offsetParent);
    sel.scrollIntoView({ block: 'center', inline: 'center' }); await __M.w(150); spotrNabidkaOtevrit(sel); await __M.w(100);
  }), '.sp-volby');
  // náhledy PDF a plán
  add('náhled PDF zprávy', 'Náhledy a tisk', E(async () => { await __M.otevri('RE-26-0101'); showScreen('form'); generujPDF(); await __M.w(1500); }));
  add('měřicí list do terénu', 'Náhledy a tisk', E(async () => {
    await __M.otevri('RE-26-0101'); showScreen('form'); terenOtevrit(); await __M.w(100); terenVytvorit(); await __M.w(1200);
  }));
  add('schéma rozváděčů', 'Náhledy a tisk', E(async () => { await __M.otevri('RE-26-0101'); showScreen('form'); stromTisk(); await __M.w(1200); }));
  add('protokol spotřebičů', 'Náhledy a tisk', E(async () => { await __M.otevri('RSP-26-0001'); showScreen('form'); spotrebiceNahled(); await __M.w(1200); }));
  add('plán revizí', 'Plán revizí', E(async () => { otevritPlan(); await __M.w(300); document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open')); await __M.w(50); }));
  add('plán – výběr objektů', 'Plán revizí', E(async () => {
    otevritPlan(); await __M.w(300); document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open'));
    const cb = Array.from(document.querySelectorAll('#screen-plan input[type=checkbox]')).filter(c => c.offsetParent).slice(1, 3);
    cb.forEach(c => c.click()); await __M.w(120);
  }));
  // tvorba dokumentace (samostatná část mimo revize)
  add('dokumentace – typy dokumentů', 'Tvorba dokumentace', E(async () => { dokOtevritTypy(); await __M.w(100); }));
  add('dokumentace – seznam', 'Tvorba dokumentace', E(async () => { dokOtevritSeznam('pouvv'); await __M.w(100); }));
  add('dokumentace – seznam, správa vzorů rozbalená', 'Tvorba dokumentace', E(async () => {
    dokOtevritSeznam('pouvv'); await __M.w(100); document.getElementById('dok-vzory-karta').open = true; await __M.w(100);
  }));
  add('dokumentace – protokol', 'Tvorba dokumentace', E(async () => { await __M.dok(); }));
  add('dokumentace – protokol, skupiny prostorů', 'Tvorba dokumentace', E(async () => {
    await __M.dok(); document.querySelector('.dk-skupina').scrollIntoView({ block: 'start' }); await __M.w(100);
  }));
  add('dokumentace – náhled PDF', 'Tvorba dokumentace', E(async () => { await __M.dok(); await dokNahled(); await __M.w(300); }));
  // rozvaděč DBO (konfigurátor)
  add('rozvaděč – seznam, knihovna rozbalená', 'Tvorba dokumentace', E(async () => {
    dokOtevritSeznam('rozv'); await __M.w(100); document.getElementById('dok-knihovna-karta').open = true; await __M.w(100);
  }));
  add('rozvaděč – seznam s objekty', 'Tvorba dokumentace', E(async () => {
    // vymyšlené objekty a rozvaděče, jen v paměti (nic se neukládá)
    DOK.rozvObjekty = [{ id: 'm-o1', nazev: 'Byt Polní 12, Kyjov' }, { id: 'm-o2', nazev: 'Dům Lipová 5' }];
    const r = (uid, c, ozn, obj, nz) => ({ uid, typ: 'rozv', cislo: c, data: Object.assign(DOK_TYPY.rozv.novy(), { cislo: c, oznaceni: ozn, objekt: obj, napajenZ: nz, stavba: 'Byt Polní 12' }) });
    DOK.dokumenty = DOK.dokumenty.filter(x => x.typ !== 'rozv').concat([r('m-a', 'ROZ-0001', 'RH1', 'm-o1'),
      r('m-b', 'ROZ-0002', 'RS1', 'm-o1', { uid: 'm-a', ozn: '-FA12' }), r('m-c', 'ROZ-0003', 'RS2 kuchyň', 'm-o1', { uid: 'm-a', ozn: '-FA13' }),
      r('m-d', 'ROZ-0004', 'RX', '')]);
    dokOtevritSeznam('rozv'); await __M.w(100);
  }));
  add('rozvaděč – zakreslit z revizní zprávy, krok 1', 'Tvorba dokumentace', E(async () => { await __M.zrevize(); }), '#modal-rz-zrevize');
  add('rozvaděč – zakreslit z revizní zprávy, krok 2', 'Tvorba dokumentace', E(async () => {
    await __M.zrevize(); document.querySelector('#rzz-zpravy [data-zuid="m-zr"]').click(); await __M.w(150);
  }), '#modal-rz-zrevize');
  add('rozvaděč – zakreslit, krok 2 s vlastní velikostí skříně', 'Tvorba dokumentace', E(async () => {
    await __M.zrevize(); document.querySelector('#rzz-zpravy [data-zuid="m-zr"]').click(); await __M.w(150);
    const s = document.querySelector('select[data-rzz-skrin="m-rs1"]'); s.value = '@vlastni'; s.dispatchEvent(new Event('change', { bubbles: true })); await __M.w(150);
    document.querySelector('.rz-vel input[data-vel="zpusob"][value="listy"]').click(); await __M.w(100);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }), '#modal-rz-zrevize');
  add('rozvaděč – vlastní velikost skříně (okno v editoru)', 'Tvorba dokumentace', E(async () => {
    await __M.rozv(); document.getElementById('toast-wrap').innerHTML = ''; TD_AKCE.tdRVelikost(); await __M.w(100);
  }), '#modal-rz-velikost');
  add('rozvaděč – editor, sbalený informační pruh, karta Skříně', 'Tvorba dokumentace', E(async () => {
    await __M.rozv(); localStorage.setItem('revize_el_rz_info', 'sbaleno'); rozvInfoPrekreslit();
    TD_AKCE.tdRTab(document.querySelector('.rz-tab[data-tab="skrine"]')); document.querySelector('.rz-knihovna').scrollIntoView({ block: 'start' }); await __M.w(100);
  }));
  add('rozvaděč – správa knihovny s importem výrobce', 'Tvorba dokumentace', E(async () => {
    // vymyšlený výrobce, jen v paměti (nic se neukládá)
    DOK.rozvKnihovna = [];
    for (let i = 0; i < 70; i++) DOK.rozvKnihovna.push({ id: 'u-m' + i, druh: 'pristroj', kat: i % 5 ? 'FA' : 'FI', nazev: '', vyrobce: 'Výrobce A',
      typ: 'A-' + i, poly: '1', In: 16, char: 'B', sirka: 1, zdroj: 'import' });
    dokOtevritSeznam('rozv'); await __M.w(100); document.getElementById('dok-knihovna-karta').open = true;
    const e = document.querySelector('#rz-sprava .rz-sf[data-sf="vyrobce"]'); e.value = 'Výrobce A'; e.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#rz-sprava .rz-sf-radek').scrollIntoView({ block: 'start' }); await __M.w(100);
  }));
  add('rozvaděč – editor', 'Tvorba dokumentace', E(async () => { await __M.rozv(); }));
  add('rozvaděč – filtry knihovny, Jističe', 'Tvorba dokumentace', E(async () => {
    await __M.rozv(); document.querySelector('#rz-filtry-hlavni .rz-skup[data-k="FA"]').click();
    document.getElementById('rz-filtry-hlavni').scrollIntoView({ block: 'start' }); await __M.w(100);
  }));
  add('rozvaděč – editor, hlavička a filtry rozbalené', 'Tvorba dokumentace', E(async () => {
    await __M.rozv(); document.querySelector('.rz-hlavicka').open = true; document.getElementById('rz-filtry').open = true; await __M.w(100);
  }));
  add('rozvaděč – čelní pohled', 'Tvorba dokumentace', E(async () => {
    await __M.rozv(); document.getElementById('rz-pohled').scrollIntoView({ block: 'start' }); await __M.w(100);
  }));
  add('rozvaděč – vybraný přístroj a vlastnosti', 'Tvorba dokumentace', E(async () => {
    await __M.rozv(); __rz.vyber = __rz.rady[1].prvky[3].uid; rozvPohledVykreslit(); rozvVlastnostiVykreslit();
    document.getElementById('rz-vlastnosti').scrollIntoView({ block: 'start' }); await __M.w(100);
  }));
  add('rozvaděč – přístroj vybraný k vložení klepnutím', 'Tvorba dokumentace', E(async () => {
    await __M.rozv(); __rz.knihVyber = 'v-fa-1-B16'; rozvKnihovnaVykreslit(); rozvPohledVykreslit();
    document.getElementById('rz-pohled').scrollIntoView({ block: 'start' }); await __M.w(100);
  }));
  add('rozvaděč – kontextové menu přístroje', 'Tvorba dokumentace', E(async () => {
    await __M.rozv(); document.getElementById('rz-pohled').scrollIntoView({ block: 'start' }); await __M.w(100);
    const g = document.querySelector('#rz-pohled [data-puid]'), r = g.getBoundingClientRect();
    rozvKontextZkusit(r.left + r.width / 2, r.top + 10, g); await __M.w(100);
  }), '.kt-menu');
  add('rozvaděč – záložka Dokumenty, všechny oddíly otevřené', 'Tvorba dokumentace', E(async () => {
    await __M.rozv(); rozvZalozkaNastavit('dok'); document.querySelectorAll('.rz-dok-oddil').forEach(d => { d.open = true; }); await __M.w(100);
  }));
  add('rozvaděč – kusové ověření, měření izolačního odporu', 'Tvorba dokumentace', E(async () => {
    await __M.rozv(); rozvZalozkaNastavit('dok'); const o = document.querySelector('[data-oddil="ko"]'); o.open = true;
    const m = document.querySelector('.rz-ko-metoda'); m.value = 'B'; m.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.rz-ko-met[data-met="B"]').scrollIntoView({ block: 'start' }); await __M.w(100);
  }));
  add('rozvaděč – výrobní štítek', 'Tvorba dokumentace', E(async () => { await __M.rozv(); await TD_AKCE.tdRStitek(); await __M.w(300); }));
  add('rozvaděč – náhled PDF', 'Tvorba dokumentace', E(async () => { await __M.rozv(); await dokNahled(); await __M.w(400); }));
  add('rozvaděč – přeplněná řada', 'Tvorba dokumentace', E(async () => {
    await __M.rozv(); rozvVlozit('v-fa-3-C32', 0, 0); document.getElementById('rz-pohled').scrollIntoView({ block: 'start' }); await __M.w(100);
  }));
  // dialogy
  const D = (id, krok) => add('dialog ' + id, 'Dialogy', krok, '#' + id);
  D('modal-revize', E(async () => { await __M.otevri('RE-26-0101'); showScreen('form'); openModalRevize(); await __M.w(100); }));
  D('modal-leave-form', E(async () => { await __M.otevri('RE-26-0101'); showScreen('form'); window.__formDirty = true; attemptLeaveForm(function () {}); await __M.w(100); }));
  D('modal-najit', E(async () => { await __M.otevri('RE-26-0101'); showScreen('form'); najitOtevrit(); await __M.w(100); }));
  D('modal-napaji', E(async () => {
    await __M.otevri('RE-26-0101'); showScreen('form'); switchTab('mereni', aktivniTabBar().querySelector('[data-tab="mereni"]')); await __M.w(80);
    const b = document.querySelector('#rozvadece-container [data-action="stromPriradit"]'); if (b) stromPriradit(b); await __M.w(100);
  }));
  D('modal-normy-editor', E(async () => { await __M.otevri('RE-26-0101'); showScreen('form'); otevritNormyEditor(); await __M.w(100); }));
  D('modal-odberatel', E(async () => { showScreen('home'); openOdberatelModal(); await __M.w(100); }));
  D('modal-snippety', E(async () => { await __M.otevri('RE-26-0101'); showScreen('form'); otevritKnihovnuTextu('f_zhodnoceni'); await __M.w(100); }));
  D('modal-typicke-texty', E(async () => { await __M.otevri('RE-26-0101'); showScreen('form'); otevritTypickeTexty('f_zhodnoceni'); await __M.w(100); }));
  D('modal-teren', E(async () => { await __M.otevri('RE-26-0101'); showScreen('form'); terenOtevrit(); await __M.w(100); }));
  D('modal-teren (stroje)', E(async () => { await __M.otevri('RS-26-0001'); showScreen('form'); terenOtevrit(); await __M.w(100); }));
  S[S.length - 1].koren = '#modal-teren';
  D('modal-rz', E(async () => { await __M.otevri('RE-26-0101'); showScreen('form'); switchTab('mereni', aktivniTabBar().querySelector('[data-tab="mereni"]')); rychleZadaniOtevrit(); await __M.w(150); }));
  D('modal-vlozit-mereni', E(async () => {
    await __M.otevri('RE-26-0101'); showScreen('form'); switchTab('mereni', aktivniTabBar().querySelector('[data-tab="mereni"]'));
    vlozitMereniOtevrit({ od: 1, text: 'Pračka\tABB\tB\t16\t\t\t3,00\nMyčka\tABB\tB\t16\t\t\t0,90' }); await __M.w(150);
  }));
  D('modal-sp-pristroje', E(async () => { await __M.otevri('RSP-26-0001'); showScreen('form'); spotrPristrojeOtevrit(); await __M.w(100); }));
  D('modal-vnorit', E(async () => { showScreen('home'); otevritVnoritModal(0); await __M.w(100); }));
  D('modal-dok-vzor', E(async () => { await __M.dok(); TD_AKCE.tdVzorZeSkupiny(document.querySelector('.dk-skupina [data-action="tdVzorZeSkupiny"]')); await __M.w(100); }));
  D('modal-dok-vlozit', E(async () => { await __M.dok(); dokVlozitDialog(document.querySelector('.dk-skupina')); await __M.w(100); }));
  D('modal-dok-katalog', E(async () => { dokOtevritSeznam('pouvv'); dokKatalogOtevrit(); await __M.w(100); }));
  D('modal-dok-vzor-jmeno', E(async () => {
    await __M.dok(); dokVzorDialog({ nazev: 'Kotelna (plynová, bez trvalé obsluhy)', kody: {}, pozn: '', texty: {} }, null);
    await dokVzorUlozit(); await __M.w(100);
  }));
  D('modal-rz-polozka', E(async () => { await __M.rozv(); TD_AKCE.tdRVlastni(); await __M.w(100); }));
  D('modal-rz-import', E(async () => {
    dokOtevritSeznam('rozv');
    await rozvImportSoubor(new File(['kategorie;typ;sirka_moduly;poly\nFA;VYM-1;1;1\nXY;VYM-2;;5\n'], 'vymysleny.csv')); await __M.w(100);
  }));
  D('modal-plan-objekt', E(async () => {
    otevritPlan(); await __M.w(300); document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open'));
    const el = document.querySelector('#screen-plan [data-action="planOtevritObjekt"], #screen-plan .plan-nazev');
    if (el) el.click(); await __M.w(150);
    if (!document.querySelector('#modal-plan-objekt.open')) { planOtevritObjekt(null); await __M.w(100); }
  }));
  D('modal-plan-slozka', E(async () => { otevritPlan(); await __M.w(300); document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open')); planOtevritSlozku(null, 'budova'); await __M.w(100); }));
  D('modal-plan-stitky', E(async () => { otevritPlan(); await __M.w(300); document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open')); planSpravaStitku(); await __M.w(100); }));
  D('modal-plan-technici', E(async () => { otevritPlan(); await __M.w(300); document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open')); planTechnici(); await __M.w(100); }));
  D('modal-plan-termin', E(async () => {
    otevritPlan(); await __M.w(300); document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open'));
    const c = document.querySelector('#screen-plan [data-action="planTermin"]'); if (c) planTermin(c); await __M.w(100);
  }));
  D('modal-plan-tisk', E(async () => { otevritPlan(); await __M.w(300); document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open')); planExport(); await __M.w(150); }));
  D('modal-plan-vlozit', E(async () => { otevritPlan(); await __M.w(300); document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open')); planVlozitZExcelu(); await __M.w(100); }));
  D('modal-plan-skryte', E(async () => { otevritPlan(); await __M.w(300); document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open')); planObnovitSkryte(); await __M.w(100); }));
  D('modal-plan-hv', E(async () => { otevritPlan(); await __M.w(300); document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open')); planHromadnaVolba('technik'); await __M.w(100); }));
  // ostatní dialogy otevřené natvrdo (obsah dosadí program až při skutečném použití)
  for (const id of ['modal-pdf-options', 'modal-email', 'modal-pretazeni', 'modal-ai', 'modal-ai-panel', 'modal-prirazit-odb', 'modal-plan-shody']) {
    D(id, E(async (id) => { await __M.otevri('RE-26-0101'); showScreen('form'); document.getElementById(id).classList.add('open'); await __M.w(80); }, id));
  }
  return S;
}

// Cílené kontroly tabulky měření (nad rámec obecného soupisu)
async function zvlastni(p, vp) {
  await p.evaluate(() => __M.uklid());
  const t = await p.evaluate(async () => {
    await __M.otevri('RE-26-0101'); showScreen('form'); switchTab('mereni', aktivniTabBar().querySelector('[data-tab="mereni"]')); await __M.w(150);
    const wrap = document.querySelector('#rozvadece-container .meas-table-wrap');
    wrap.scrollIntoView({ block: 'start' }); await __M.w(100);
    const tr = wrap.querySelector('tr[data-rowtype="obvod"]');
    const pred = [0, 1].map(i => tr.children[i].getBoundingClientRect().left);
    wrap.scrollLeft = 500; wrap.dispatchEvent(new Event('scroll')); await __M.w(150);
    const po = [0, 1].map(i => tr.children[i].getBoundingClientRect().left);
    const th = Array.from(wrap.querySelectorAll('thead th')).map(h => parseFloat(getComputedStyle(h).fontSize));
    const r = wrap.getBoundingClientRect();
    return { posunuto: wrap.scrollLeft, pred, po, sirsi: wrap.scrollWidth > wrap.clientWidth, thMin: Math.min(...th), wrapVDispleji: r.left >= 0 && r.right <= innerWidth + 1 };
  });
  check(vp.n + ' · měření: tabulka se posouvá uvnitř rámečku, rámeček je v displeji', t.sirsi && t.posunuto > 0 && t.wrapVDispleji, JSON.stringify(t));
  check(vp.n + ' · měření: ukotvený sloupec Č. + Název při posunu zůstává na místě', Math.abs(t.pred[0] - t.po[0]) < 1 && Math.abs(t.pred[1] - t.po[1]) < 1, JSON.stringify([t.pred, t.po]));
  check(vp.n + ' · měření: záhlaví čitelné (písmo ≥ 11 px)', t.thMin >= 11, String(t.thMin));
  // nejvzdálenější buňku (Kabel) vyplnit prstem
  const bod = await p.evaluate(async () => {
    const tr = document.querySelectorAll('#rozvadece-container tr[data-rowtype="obvod"]')[1];
    const i = fillCilovyInput(tr, 15); i.value = ''; window.__formDirty = false;
    i.scrollIntoView({ block: 'center', inline: 'center' }); await __M.w(200);
    const r = i.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await p.touchscreen.tap(bod.x, bod.y);
  await p.keyboard.type('CYKY 3×1,5');
  const vypl = await p.evaluate(async () => {
    const tr = document.querySelectorAll('#rozvadece-container tr[data-rowtype="obvod"]')[1];
    const i = fillCilovyInput(tr, 15);
    const D = getData();
    return { fokus: document.activeElement === i, hodnota: i.value, dirty: !!window.__formDirty,
             vDatech: D.rozvadece[0].mereni.filter(m => m.rowtype === 'obvod')[1].kabel };
  });
  check(vp.n + ' · měření: buňku Kabel jde klepnutím vyplnit a hodnota jde do dat', vypl.fokus && vypl.hodnota === 'CYKY 3×1,5' && vypl.dirty && vypl.vDatech === 'CYKY 3×1,5', JSON.stringify(vypl));
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const err = [];
  const PCREZIM = REZIM === 'pc' || REZIM === 'pcstyly';
  const viewporty = (PCREZIM ? PC : MOBIL).filter(v => !VPJEN || VPJEN.includes(v.n));
  const vysledky = [];
  const styly = {};
  if (REZIM !== 'test') fs.mkdirSync(VYSTUP, { recursive: true });
  for (const vp of viewporty) {
    const mobil = !PCREZIM;
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1,
      isMobile: mobil, hasTouch: mobil });
    const p = await ctx.newPage();
    p.on('pageerror', e => err.push(vp.n + ': ' + e.message));
    p.on('dialog', d => d.accept());
    await p.addInitScript(() => {
      try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {}
      const T = Date.UTC(2026, 9, 15, 8, 0, 0); const D0 = Date;
      class FD extends D0 { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } }
      FD.UTC = D0.UTC; FD.parse = D0.parse; window.Date = FD;
      let s = 42; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'load' });
    await p.waitForTimeout(900);
    await p.evaluate(pomocnik);
    await p.evaluate('window.__rozvByt = ' + require('./rozvadec-byt.js').toString());
    await p.evaluate(() => __M.fixture());
    const zalozky = await rozbalitZalozky(p);
    const S = vsechnyStavy(zalozky).filter(s => !JEN || JEN.test(s.id));
    for (const s of S) {
      await p.evaluate(() => __M.uklid());
      let chyba = '';
      try { await s.krok(p); } catch (e) { chyba = e.message.split('\n')[0]; }
      const soubor = (vp.n + '-' + s.id).replace(/[^a-z0-9áčďéěíňóřšťúůýž–-]+/gi, '_');
      if (REZIM === 'pc') {
        await p.screenshot({ path: path.join(VYSTUP, soubor + '.png'), fullPage: true, animations: 'disabled', caret: 'hide' });
        continue;
      }
      if (REZIM === 'pcstyly') {
        styly[soubor] = await p.evaluate(() => {
          // FNV-1a — stačí na porovnání, celé styly by byly stovky MB
          const h = t => { let x = 0x811c9dc5; for (let i = 0; i < t.length; i++) { x ^= t.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return x.toString(36); };
          return Array.from(document.querySelectorAll('*')).map(e => {
            const r = e.getBoundingClientRect();
            const poz = [r.x, r.y, r.width, r.height].map(v => v.toFixed(2)).join(',');
            // běžící animace (pulsující 📰) by se lišila podle okamžiku — jen poloha
            if (e.getAnimations && e.getAnimations().length) return e.tagName + '#' + e.id + ' ' + poz + ' anim';
            // seřazené — pořadí vlastních proměnných (--accent…) Chrome vypisuje podle
            // toho, kde v souboru jsou, i když se hodnoty nezměnily
            const c = getComputedStyle(e); const v = [];
            for (let k = 0; k < c.length; k++) v.push(c[k] + ':' + c.getPropertyValue(c[k]));
            const t = v.sort().join(';');
            return e.tagName + '#' + e.id + '.' + (typeof e.className === 'string' ? e.className : '') + ' ' + poz + ' ' + h(t);
          });
        });
        continue;
      }
      if (REZIM === 'soupis' && vp.n === '375') {
        await p.screenshot({ path: path.join(VYSTUP, soubor + '.jpg'), type: 'jpeg', quality: 55, animations: 'disabled', caret: 'hide' });
      }
      const korenOk = !s.koren || await p.evaluate(k => !!document.querySelector(k), s.koren);
      const v = korenOk && !chyba ? await p.evaluate(o => __M.kontrola(o), { vw: vp.w, vh: vp.h, koren: s.koren || null }) : { problemy: [], vnitrniPosun: [] };
      if (chyba || !korenOk) v.problemy.push({ kat: 'stav-nejde-otevřít', sig: chyba || ('nenalezeno ' + s.koren), text: '', pocet: 1 });
      vysledky.push({ stav: s.id, skupina: s.skupina, vp: vp.n, problemy: v.problemy, vnitrniPosun: v.vnitrniPosun });
      const n = v.problemy.length;
      check(vp.n + ' · ' + s.id, n === 0, n ? v.problemy.slice(0, 4).map(x => x.kat + ' ' + x.sig + (x.extra ? ' (' + x.extra + ')' : '')).join(' | ') + (n > 4 ? ' … +' + (n - 4) : '') : '');
    }
    if (!PCREZIM && !JEN) await zvlastni(p, vp);
    await ctx.close();
  }
  // PC: mobilní pravidla se nesmí uplatnit — hlavně vlastní zaškrtávátko
  if (REZIM === 'test' && !VPJEN) {
    for (const vp of PC) {
      const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h } });
      const p = await ctx.newPage();
      p.on('pageerror', e => err.push(vp.n + ': ' + e.message));
      await p.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
      await p.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'load' });
      await p.waitForTimeout(900);
      await p.evaluate(pomocnik);
      await p.evaluate('window.__rozvByt = ' + require('./rozvadec-byt.js').toString());
    await p.evaluate('window.__rozvByt = ' + require('./rozvadec-byt.js').toString());
      await p.evaluate(() => __M.fixture());
      const v = await p.evaluate(async () => {
        const out = { mq: matchMedia('(max-width:600px), (pointer:coarse) and (max-height:500px)').matches, spatne: [], n: 0 };
        const zkontroluj = () => document.querySelectorAll('input[type=checkbox], input[type=radio]').forEach(c => {
          if (!c.getClientRects().length) return;
          out.n++;
          const cs = getComputedStyle(c);
          if (cs.appearance !== 'auto' || cs.borderTopWidth === '11px' || parseFloat(cs.width) > 30) out.spatne.push((c.id || c.className || c.type) + ' ' + cs.appearance + ' ' + cs.width);
        });
        showScreen('home'); zkontroluj();
        showScreen('nastaveni'); zkontroluj();
        await __M.otevri('RE-26-0101'); showScreen('form');
        for (const t of ['titulni', 'popis', 'checklist', 'mereni']) { switchTab(t, aktivniTabBar().querySelector('[data-tab="' + t + '"]')); await __M.w(50); zkontroluj(); }
        return out;
      });
      check(vp.n + ' (PC) · mobilní pravidla se neuplatní', !v.mq);
      check(vp.n + ' (PC) · zaškrtávátka a přepínače mají nativní vzhled (' + v.n + ' kusů)', v.n > 20 && v.spatne.length === 0, v.spatne.slice(0, 3).join(' | '));
      await ctx.close();
    }
  }
  if (REZIM === 'pcstyly') fs.writeFileSync(path.join(VYSTUP, 'styly.json'), JSON.stringify(styly));
  if (!PCREZIM) {
    if (REZIM === 'soupis') fs.writeFileSync(path.join(VYSTUP, 'vysledky.json'), JSON.stringify(vysledky, null, 1));
    check('bez chyb stránky', err.length === 0, err.slice(0, 3).join(' | '));
    console.log(res.join('\n'));
  } else console.log((REZIM === 'pc' ? 'snímky PC: ' : 'otisky stylů PC: ') + VYSTUP + (err.length ? '\nchyby: ' + err.join(' | ') : ''));
  await b.close();
  process.exit(res.some(r => r.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.error('CRASH:', e.message); process.exit(2); });
