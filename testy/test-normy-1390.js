// Normy – ČSN 34 1390 (kontrola dávka 2): čísla článků v katalogu vad
// a prohlídce, zemní odpor 20 Ω na svod (čl. 55 b) a 15 Ω pro skupinu
// (čl. 55 c) v nápovědách a v patičce měření v PDF.
const { chromium } = require('./pw');
const PORT = process.env.PORT || 8901;
const res = []; const check = (n, ok, d) => res.push((ok ? '✅' : '❌') + ' ' + n + (d ? ' — ' + d : ''));
const w = ms => new Promise(r => setTimeout(r, ms));
async function stranka(b) {
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const err = []; p.on('pageerror', e => err.push(e.message));
  await p.addInitScript(() => { try { navigator.serviceWorker.register = () => new Promise(() => {}); } catch (e) {} });
  await p.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'load' });
  await p.waitForTimeout(900);
  return { p, err };
}
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const { p, err } = await stranka(b);
  const r = await p.evaluate(async () => {
    const kat = TYPICKE_ZAVADY_LPS_1390, pro = [].concat.apply([], LPS_PROHLIDKA_1390.map(s => s.items));
    novaZprava('lps');
    await new Promise(r => setTimeout(r, 250));
    const s = document.getElementById('lps_prohlidka_norma'); s.value = '1390'; s.dispatchEvent(new Event('change', { bubbles: true })); updateLpsMereniTexts();
    await new Promise(r => setTimeout(r, 250));
    const t = id => (document.getElementById(id) || {}).textContent || '';
    const nap = { info: t('lps-mereni-info'), zemni: t('lps-metoda-zemni'), prechod: t('lps-metoda-prechod') };
    magicPopis();
    const popis = Array.from(document.querySelectorAll('textarea')).map(t => t.value).filter(v => /ČSN 34 1390 \(Předpisy/.test(v)).join('\n');
    const set = (id, x) => { const e = document.getElementById(id); if (e) { e.value = x; e.dispatchEvent(new Event('input', { bubbles: true })); } };
    set('f_ev_cislo', 'RE-26-0901'); set('f_misto', 'Stará stodola');
    generujPDF();
    await new Promise(r => setTimeout(r, 1500));
    const pdf = document.getElementById('pdf-pages').textContent.replace(/\s+/g, ' ');
    return { kat, pro, nap, popis, pdf, kod: LPS1390_ZEMNI_KOD };
  });
  const K = re => r.kat.find(z => re.test(z.popis)), P = re => r.pro.find(z => re.test(z.t));
  const kat = [
    [/^Přerušený svod/, 'C1', 'ČSN 34 1390, čl. 51'],
    [/^Zemní odpor zemniče jednoho svodu přesahuje 20 Ω$/, 'C2', 'ČSN 34 1390, čl. 55 b)'],
    [/^Zemní odpor skupiny zemničů spojené nad zemí není menší než 15 Ω$/, 'C2', 'ČSN 34 1390, čl. 55 c)'],
    [/^Chybí jímací zařízení/, 'C1', 'ČSN 34 1390, čl. 16, 17'],
    [/^Nedodržena bezpečná vzdálenost/, 'C1', 'ČSN 34 1390, čl. 35'],
    [/^Chybí pospojování kovových částí/, 'C1', 'ČSN 34 1390, čl. 61 až 66'],
    [/^Nedostatečný počet svodů$/, 'C1', 'ČSN 34 1390, čl. 32'],
    [/^Pokročilá koroze/, 'C2', 'ČSN 34 1390, čl. 21 až 24, 54'],
    [/^Uvolněné, nepřístupné nebo poškozené zkušební/, 'C2', 'ČSN 34 1390, čl. 45'],
    [/^Chybí ochranný úhelník svodu v dosahu osob \(do výšky asi 1,7 m nad zemí\)$/, 'C2', 'ČSN 34 1390, čl. 38 b)'],
    [/^Přechodový odpor spojů větší než 0,2 Ω$/, 'C2', 'ČSN 34 1390, čl. 41 až 44 (provedení spojů); mez 0,2 Ω podle ČSN EN 62305-3'],
    [/^Nesprávně provedený přechod mezi materiály/, 'C2', 'ČSN 34 1390, čl. 42; ČSN 33 2000-5-54 ed.3, čl. 542.2.5'],
    [/^Doporučujeme doplnit přepěťovou ochranu/, 'C3', 'ČSN 33 2000-4-443 ed.3, čl. 443.4, 443.5'],
    [/^Doporučujeme antikorozní ošetření spojů/, 'C3', 'ČSN 34 1390, čl. 54; ČSN 33 2000-5-54 ed.3, čl. 542.2.5'],
    [/^Doporučujeme vést revizní knihu/, 'C3', 'ČSN 33 1500; ČSN 34 1390, čl. 201']
  ];
  for (const [re, kod, n] of kat) { const z = K(re); check('katalog 1390: ' + String(re).slice(2, 46) + ' → ' + kod + ' · ' + n, z && z.kod === kod && z.norma === n, z ? z.kod + ' · ' + z.norma : 'nenalezeno'); }
  check('katalog 1390: kód vady zemního odporu svodu je konstanta LPS1390_ZEMNI_KOD = C2', r.kod === 'C2');
  check('katalog 1390: žádné „>15 Ω", „1,8 m", čl. 46, 50, 52, 124, 129', !r.kat.some(z => />15 Ω|1,8 m|čl\. (46|50|52|124|129)\b/.test(z.popis + ' ' + z.norma)));
  const pro = [
    [/^Provedení jímacího zařízení/, 'ČSN 34 1390, čl. 16 až 19'],
    [/^Uspořádání jímacího vedení/, 'ČSN 34 1390, čl. 17, 18'],
    [/^Vzdálenosti jímačů od hořlavých/, 'ČSN 34 1390, čl. 35'],
    [/^Stav a koroze jímacích/, 'ČSN 34 1390, čl. 21 až 24, 54'],
    [/^Počet svodů \(1 na 15 m hřebene, resp\. 30 m obvodu\)$/, 'ČSN 34 1390, čl. 32'],
    [/^Vzdálenost svodů od hořlavých/, 'ČSN 34 1390, čl. 35'],
    [/^Zkušební svorky — asi 2 m nad zemí, přístupné$/, 'ČSN 34 1390, čl. 45'],
    [/^Mechanická ochrana svodu/, 'ČSN 34 1390, čl. 38 b) (do výšky asi 1,7 m)'],
    [/^Celistvost a stav spojů svodů/, 'ČSN 34 1390, čl. 41 až 44'],
    [/^Uzemnění jednotlivých svodů \(≤ 20 Ω\)$/, 'ČSN 34 1390, čl. 55 b)'],
    [/^Skupina zemničů spojená nad zemí \(< 15 Ω\)$/, 'ČSN 34 1390, čl. 55 c)'],
    [/^Materiál a průřez zemničů/, 'ČSN 34 1390, čl. 53'],
    [/^Hloubka uložení zemničů/, 'ČSN 34 1390, čl. 53 b)'],
    [/^Pospojování kovových částí/, 'ČSN 34 1390, čl. 61 až 66'],
    [/^Provedení svorkových spojů/, 'ČSN 34 1390, čl. 41 až 45'],
    [/^Celistvost LPS, přechodové odpory/, 'ČSN 34 1390, čl. 41 až 44; mez 0,2 Ω podle ČSN EN 62305-3'],
    [/^Dokumentace LPS/, 'ČSN 34 1390, čl. 12, 201']
  ];
  for (const [re, n] of pro) { const z = P(re); check('prohlídka 1390: ' + String(re).slice(2, 40) + ' → ' + n, z && z.csn === n, z ? z.t + ' · ' + z.csn : 'nenalezeno'); }
  const Z = 'Zemní odpor zemniče jednoho svodu nemá být větší než 20 Ω (čl. 55 b); skupina zemničů spojená nad zemí < 15 Ω (čl. 55 c).';
  check('nápověda měření (info i metoda) uvádí 20 Ω na svod a < 15 Ω pro skupinu', r.nap.info.includes(Z) && r.nap.zemni.includes(Z), r.nap.info);
  check('nápověda přechodového odporu: 0,2 Ω podle ČSN EN 62305-3, bez čl. 124', /0,2 Ω \(podle ČSN EN 62305-3\)/.test(r.nap.prechod) && !/124/.test(r.nap.prechod), r.nap.prechod);
  check('PDF patička měření: 20 Ω (čl. 55 b) a < 15 Ω (čl. 55 c), 0,2 Ω podle ČSN EN 62305-3',
    r.pdf.includes('ČSN 34 1390: ' + Z) && r.pdf.includes('Přechodové odpory spojů vodičů ≤ 0,2 Ω (podle ČSN EN 62305-3).') && !/15 Ω dle ČSN 34 1390|čl\. 124/.test(r.pdf));
  check('vzorový popis 1390: asi 1,7 m (čl. 38), asi 2 m (čl. 45), ≤ 20 Ω (čl. 55), čl. 35, čl. 61 až 66, bez čl. 124',
    /asi 1,7 m, čl\. 38/.test(r.popis) && /asi 2 m nad zemí.*čl\. 45/.test(r.popis) && /≤ 20 Ω \(ČSN 34 1390 čl\. 55\)/.test(r.popis) &&
    /čl\. 35\./.test(r.popis) && /čl\. 61 až 66/.test(r.popis) && !/1,8 m|1,5 m|15 Ω|čl\. (42|50|62|124)\b/.test(r.popis), r.popis.slice(0, 120));
  check('bez chyb stránky', !err.length, err.join(' | '));
  console.log(res.join('\n'));
  await b.close();
  process.exit(res.some(x => x.startsWith('❌')) ? 1 : 0);
})().catch(e => { console.error('CRASH:', e.message); process.exit(2); });
