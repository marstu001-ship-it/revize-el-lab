# Mobil — soupis problémů před a po úpravě

Vytvořeno `testy/test-mobil.js` v režimu `REZIM=soupis` (2026-10-15). **Před** = lab v1.3
(bez mobilních úprav), **po** = s mobilními úpravami. Telefon se napodobuje v Chromiu
(Playwright: `isMobile`, dotyk, 360 / 375 / 390 / 414 px na výšku a 844 × 390 na šířku).
Data jsou vymyšlená (fixtura v testu). Snímky jsou z šířky 375 px.

**Celkem: 1846 problémů před → 0 po** (70 stavů obrazovek; problém = jeden prvek
Jak to zopakovat (servery spouští `testy/servery.sh`):

```bash
cd testy
REZIM=soupis PORT=8901 VYSTUP=_beh/soupis-po node test-mobil.js   # JSON + snímky 375 px
node test-mobil.js                                                 # ✅/❌ — součást regrese
```

Úpravy jsou **jen v CSS, v bloku `MOBIL` na konci `<style>`** v `index.html`
(popis v `CLAUDE.md`, oddíl „Mobil"). Podmínka bloku je
`@media (max-width:600px), (pointer:coarse) and (max-height:500px)` — kromě
zadané šířky do 600 px chytá i **telefon na šířku** (844 × 390), který by
samotná šířka nezachytila. Na PC s myší neplatí nikdy.

s jednou vadou, sečtený jednou, i když se opakuje ve víc šířkách).

## Podle obrazovek

| obrazovka | stavů | před | po |
|---|---:|---:|---:|
| Úvod a archiv | 3 | 77 | 0 |
| Novinky | 2 | 21 | 0 |
| Nastavení | 1 | 44 | 0 |
| Formulář elektro | 6 | 282 | 0 |
| Tabulka měření | 3 | 375 | 0 |
| Formulář LPS | 6 | 288 | 0 |
| Formulář stroje | 6 | 290 | 0 |
| Formulář spotřebiče | 1 | 55 | 0 |
| Plovoucí prvky | 6 | 20 | 0 |
| Náhledy a tisk | 4 | 77 | 0 |
| Plán revizí | 2 | 78 | 0 |
| Dialogy | 30 | 239 | 0 |
| **celkem** | **70** | **1846** | **0** |

## Podle šířky (všechny výskyty)

| šířka | před | po |
|---|---:|---:|
| 360 px | 1082 | 0 |
| 375 px | 1051 | 0 |
| 390 px | 1042 | 0 |
| 414 px | 1027 | 0 |
| na šířku (844 × 390) | 1541 | 0 |

## Podle druhu problému (před)

| druh | co to znamená | před | po |
|---|---|---:|---:|
| malý-prvek | ovládací prvek menší než 40 × 40 px | 1101 | 0 |
| písmo<16 | písmo ve vstupním poli pod 16 px — iPhone při klepnutí přiblíží stránku | 367 | 0 |
| nedosažitelné | na ovládací prvek nejde doscrollovat ani klepnout | 183 | 0 |
| přesah | prvek leze za kraj displeje a nejde k němu doscrollovat | 81 | 0 |
| oříznuto | text uříznutý, rozbalovátko užší než vybraná hodnota | 46 | 0 |
| pevný-prvek | pevně umístěný prvek zabírá velkou část displeje | 23 | 0 |
| posun-stránky | stránka širší než displej — celá se posouvá do strany | 19 | 0 |
| mimo-obrazovku | dialog / nabídka / bublina se otevřela za krajem displeje | 9 | 0 |
| přetéká | text leze z prvku přes sousední | 7 | 0 |
| nalepené | dva ovládací prvky blíž než 4 px | 6 | 0 |
| zakryto | ovládací prvek trvale zakrytý pevně umístěným prvkem | 4 | 0 |

## Nejčastější problémy před úpravou

| v kolika stavech | problém | příklad |
|---:|---|---|
| 33 | malý-prvek · `div.topbar > div.brand[home]` | 332×37 |
| 33 | malý-prvek · `button#theme-toggle` | 37×29 |
| 33 | malý-prvek · `button#view-toggle` | 82×29 |
| 33 | malý-prvek · `div.topbar > div.topbar-right > button.btn.btn-ghost[home]` | 89×29 |
| 33 | malý-prvek · `button#btn-novinky` | 150×29 |
| 33 | malý-prvek · `div.topbar > div.topbar-right > button.btn.btn-ghost[nastaveni]` | 105×29 |
| 33 | malý-prvek · `div.topbar > div.topbar-right > button.btn.btn-ghost[nacist]` | 89×29 |
| 22 | malý-prvek · `button#btn-ulozit-archiv` | 89×29 |
| 22 | malý-prvek · `div.topbar > div.topbar-right > button.btn.btn-ghost[najitOtevrit]` | 82×29 |
| 22 | malý-prvek · `div.topbar > div.topbar-right > button.btn.btn-ghost[ulozit]` | 119×29 |
| 22 | malý-prvek · `div.topbar > div.topbar-right > button.btn.btn-gold[generujPDF]` | 140×27 |
| 22 | pevný-prvek · `div.topbar` | 202 px |
| 21 | oříznuto · `span#bc-typ` | šířka 158/495 |
| 21 | malý-prvek · `div#screen-form > div.breadcrumb > a[home]` | 43×16 |
| 21 | malý-prvek · `button#btn-form-archiv` | 80×22 |
| 19 | posun-stránky · `stránka` | 854 px |
| 14 | přesah · `div#stavovy-radek > span.sr-ok` | 459–579 px |
| 12 | přesah · `button#voice-fab` | 788–840 px |
| 12 | nedosažitelné · `button#voice-fab` | mimo displej |
| 8 | přesah · `div#stavovy-radek` | 0–854 px |
| 4 | přesah · `div#stavovy-radek > span.sr-oddel` | 356–363 px |
| 4 | přesah · `div#stavovy-radek > span` | 375–439 px |
| 4 | písmo<16 · `input#f_ev_cislo` | 14.08 px |
| 4 | malý-prvek · `input#f_ev_cislo` | 191×36 |
| 4 | písmo<16 · `textarea#f_misto` | 14.08 px |
| 4 | písmo<16 · `input#f_zahajeni` | 14.08 px |
| 4 | malý-prvek · `input#f_zahajeni` | 172×38 |
| 4 | písmo<16 · `input#f_vypracovani` | 14.08 px |
| 4 | malý-prvek · `input#f_vypracovani` | 172×38 |
| 4 | písmo<16 · `input#f_pristi` | 14.08 px |

## Stav po stavu

Počty jsou za všech pět šířek dohromady (jedinečné). Snímky 375 px: `mobil-soupis/pred/`, `mobil-soupis/po/`.

### Úvod a archiv

| stav | před | po | snímek |
|---|---:|---:|---|
| domů | 31 | 0 | [před](mobil-soupis/pred/375-dom%C5%AF.jpg) · [po](mobil-soupis/po/375-dom%C5%AF.jpg) |
| domů – výběr zpráv | 38 | 0 | [před](mobil-soupis/pred/375-dom%C5%AF_%E2%80%93_v%C3%BDb%C4%9Br_zpr%C3%A1v.jpg) · [po](mobil-soupis/po/375-dom%C5%AF_%E2%80%93_v%C3%BDb%C4%9Br_zpr%C3%A1v.jpg) |
| výběr typu zprávy | 8 | 0 | [před](mobil-soupis/pred/375-v%C3%BDb%C4%9Br_typu_zpr%C3%A1vy.jpg) · [po](mobil-soupis/po/375-v%C3%BDb%C4%9Br_typu_zpr%C3%A1vy.jpg) |

### Novinky

| stav | před | po | snímek |
|---|---:|---:|---|
| novinky | 10 | 0 | [před](mobil-soupis/pred/375-novinky.jpg) · [po](mobil-soupis/po/375-novinky.jpg) |
| novinky – hledání | 11 | 0 | [před](mobil-soupis/pred/375-novinky_%E2%80%93_hled%C3%A1n%C3%AD.jpg) · [po](mobil-soupis/po/375-novinky_%E2%80%93_hled%C3%A1n%C3%AD.jpg) |

### Nastavení

| stav | před | po | snímek |
|---|---:|---:|---|
| nastavení | 44 | 0 | [před](mobil-soupis/pred/375-nastaven%C3%AD.jpg) · [po](mobil-soupis/po/375-nastaven%C3%AD.jpg) |

### Formulář elektro

| stav | před | po | snímek |
|---|---:|---:|---|
| elektro – titulni | 92 | 0 | [před](mobil-soupis/pred/375-elektro_%E2%80%93_titulni.jpg) · [po](mobil-soupis/po/375-elektro_%E2%80%93_titulni.jpg) |
| elektro – popis | 30 | 0 | [před](mobil-soupis/pred/375-elektro_%E2%80%93_popis.jpg) · [po](mobil-soupis/po/375-elektro_%E2%80%93_popis.jpg) |
| elektro – pristroje | 61 | 0 | [před](mobil-soupis/pred/375-elektro_%E2%80%93_pristroje.jpg) · [po](mobil-soupis/po/375-elektro_%E2%80%93_pristroje.jpg) |
| elektro – zaver | 66 | 0 | [před](mobil-soupis/pred/375-elektro_%E2%80%93_zaver.jpg) · [po](mobil-soupis/po/375-elektro_%E2%80%93_zaver.jpg) |
| elektro – checklist | 21 | 0 | [před](mobil-soupis/pred/375-elektro_%E2%80%93_checklist.jpg) · [po](mobil-soupis/po/375-elektro_%E2%80%93_checklist.jpg) |
| elektro – postranní archiv | 12 | 0 | [před](mobil-soupis/pred/375-elektro_%E2%80%93_postrann%C3%AD_archiv.jpg) · [po](mobil-soupis/po/375-elektro_%E2%80%93_postrann%C3%AD_archiv.jpg) |

### Tabulka měření

| stav | před | po | snímek |
|---|---:|---:|---|
| elektro – mereni | 142 | 0 | [před](mobil-soupis/pred/375-elektro_%E2%80%93_mereni.jpg) · [po](mobil-soupis/po/375-elektro_%E2%80%93_mereni.jpg) |
| měření – odrolováno (plovoucí hlavička) | 142 | 0 | [před](mobil-soupis/pred/375-m%C4%9B%C5%99en%C3%AD_%E2%80%93_odrolov%C3%A1no_plovouc%C3%AD_hlavi%C4%8Dka_.jpg) · [po](mobil-soupis/po/375-m%C4%9B%C5%99en%C3%AD_%E2%80%93_odrolov%C3%A1no_plovouc%C3%AD_hlavi%C4%8Dka_.jpg) |
| měření – dokončená zpráva | 91 | 0 | [před](mobil-soupis/pred/375-m%C4%9B%C5%99en%C3%AD_%E2%80%93_dokon%C4%8Den%C3%A1_zpr%C3%A1va.jpg) · [po](mobil-soupis/po/375-m%C4%9B%C5%99en%C3%AD_%E2%80%93_dokon%C4%8Den%C3%A1_zpr%C3%A1va.jpg) |

### Formulář LPS

| stav | před | po | snímek |
|---|---:|---:|---|
| lps – titulni | 83 | 0 | [před](mobil-soupis/pred/375-lps_%E2%80%93_titulni.jpg) · [po](mobil-soupis/po/375-lps_%E2%80%93_titulni.jpg) |
| lps – lps-objekt | 51 | 0 | [před](mobil-soupis/pred/375-lps_%E2%80%93_lps-objekt.jpg) · [po](mobil-soupis/po/375-lps_%E2%80%93_lps-objekt.jpg) |
| lps – pristroje | 25 | 0 | [před](mobil-soupis/pred/375-lps_%E2%80%93_pristroje.jpg) · [po](mobil-soupis/po/375-lps_%E2%80%93_pristroje.jpg) |
| lps – lps-prohlidka | 72 | 0 | [před](mobil-soupis/pred/375-lps_%E2%80%93_lps-prohlidka.jpg) · [po](mobil-soupis/po/375-lps_%E2%80%93_lps-prohlidka.jpg) |
| lps – lps-mereni | 25 | 0 | [před](mobil-soupis/pred/375-lps_%E2%80%93_lps-mereni.jpg) · [po](mobil-soupis/po/375-lps_%E2%80%93_lps-mereni.jpg) |
| lps – zaver | 32 | 0 | [před](mobil-soupis/pred/375-lps_%E2%80%93_zaver.jpg) · [po](mobil-soupis/po/375-lps_%E2%80%93_zaver.jpg) |

### Formulář stroje

| stav | před | po | snímek |
|---|---:|---:|---|
| stroje – titulni | 127 | 0 | [před](mobil-soupis/pred/375-stroje_%E2%80%93_titulni.jpg) · [po](mobil-soupis/po/375-stroje_%E2%80%93_titulni.jpg) |
| stroje – stroje-objekt | 26 | 0 | [před](mobil-soupis/pred/375-stroje_%E2%80%93_stroje-objekt.jpg) · [po](mobil-soupis/po/375-stroje_%E2%80%93_stroje-objekt.jpg) |
| stroje – pristroje | 25 | 0 | [před](mobil-soupis/pred/375-stroje_%E2%80%93_pristroje.jpg) · [po](mobil-soupis/po/375-stroje_%E2%80%93_pristroje.jpg) |
| stroje – stroje-mereni | 44 | 0 | [před](mobil-soupis/pred/375-stroje_%E2%80%93_stroje-mereni.jpg) · [po](mobil-soupis/po/375-stroje_%E2%80%93_stroje-mereni.jpg) |
| stroje – stroje-kontroly | 36 | 0 | [před](mobil-soupis/pred/375-stroje_%E2%80%93_stroje-kontroly.jpg) · [po](mobil-soupis/po/375-stroje_%E2%80%93_stroje-kontroly.jpg) |
| stroje – zaver | 32 | 0 | [před](mobil-soupis/pred/375-stroje_%E2%80%93_zaver.jpg) · [po](mobil-soupis/po/375-stroje_%E2%80%93_zaver.jpg) |

### Formulář spotřebiče

| stav | před | po | snímek |
|---|---:|---:|---|
| spotrebice – spotrebice | 55 | 0 | [před](mobil-soupis/pred/375-spotrebice_%E2%80%93_spotrebice.jpg) · [po](mobil-soupis/po/375-spotrebice_%E2%80%93_spotrebice.jpg) |

### Plovoucí prvky

| stav | před | po | snímek |
|---|---:|---:|---|
| měření – bublina Zs | 2 | 0 | [před](mobil-soupis/pred/375-m%C4%9B%C5%99en%C3%AD_%E2%80%93_bublina_Zs.jpg) · [po](mobil-soupis/po/375-m%C4%9B%C5%99en%C3%AD_%E2%80%93_bublina_Zs.jpg) |
| měření – kontextové menu | 5 | 0 | [před](mobil-soupis/pred/375-m%C4%9B%C5%99en%C3%AD_%E2%80%93_kontextov%C3%A9_menu.jpg) · [po](mobil-soupis/po/375-m%C4%9B%C5%99en%C3%AD_%E2%80%93_kontextov%C3%A9_menu.jpg) |
| elektro – našeptávač místa | 2 | 0 | [před](mobil-soupis/pred/375-elektro_%E2%80%93_na%C5%A1ept%C3%A1va%C4%8D_m%C3%ADsta.jpg) · [po](mobil-soupis/po/375-elektro_%E2%80%93_na%C5%A1ept%C3%A1va%C4%8D_m%C3%ADsta.jpg) |
| elektro – lišta formátování textu | 6 | 0 | [před](mobil-soupis/pred/375-elektro_%E2%80%93_li%C5%A1ta_form%C3%A1tov%C3%A1n%C3%AD_textu.jpg) · [po](mobil-soupis/po/375-elektro_%E2%80%93_li%C5%A1ta_form%C3%A1tov%C3%A1n%C3%AD_textu.jpg) |
| elektro – hláška se ZPĚT | 1 | 0 | [před](mobil-soupis/pred/375-elektro_%E2%80%93_hl%C3%A1%C5%A1ka_se_ZP%C4%9AT.jpg) · [po](mobil-soupis/po/375-elektro_%E2%80%93_hl%C3%A1%C5%A1ka_se_ZP%C4%9AT.jpg) |
| spotřebiče – nabídka voleb | 4 | 0 | [před](mobil-soupis/pred/375-spot%C5%99ebi%C4%8De_%E2%80%93_nab%C3%ADdka_voleb.jpg) · [po](mobil-soupis/po/375-spot%C5%99ebi%C4%8De_%E2%80%93_nab%C3%ADdka_voleb.jpg) |

### Náhledy a tisk

| stav | před | po | snímek |
|---|---:|---:|---|
| náhled PDF zprávy | 33 | 0 | [před](mobil-soupis/pred/375-n%C3%A1hled_PDF_zpr%C3%A1vy.jpg) · [po](mobil-soupis/po/375-n%C3%A1hled_PDF_zpr%C3%A1vy.jpg) |
| měřicí list do terénu | 14 | 0 | [před](mobil-soupis/pred/375-m%C4%9B%C5%99ic%C3%AD_list_do_ter%C3%A9nu.jpg) · [po](mobil-soupis/po/375-m%C4%9B%C5%99ic%C3%AD_list_do_ter%C3%A9nu.jpg) |
| schéma rozváděčů | 15 | 0 | [před](mobil-soupis/pred/375-sch%C3%A9ma_rozv%C3%A1d%C4%9B%C4%8D%C5%AF.jpg) · [po](mobil-soupis/po/375-sch%C3%A9ma_rozv%C3%A1d%C4%9B%C4%8D%C5%AF.jpg) |
| protokol spotřebičů | 15 | 0 | [před](mobil-soupis/pred/375-protokol_spot%C5%99ebi%C4%8D%C5%AF.jpg) · [po](mobil-soupis/po/375-protokol_spot%C5%99ebi%C4%8D%C5%AF.jpg) |

### Plán revizí

| stav | před | po | snímek |
|---|---:|---:|---|
| plán revizí | 35 | 0 | [před](mobil-soupis/pred/375-pl%C3%A1n_reviz%C3%AD.jpg) · [po](mobil-soupis/po/375-pl%C3%A1n_reviz%C3%AD.jpg) |
| plán – výběr objektů | 43 | 0 | [před](mobil-soupis/pred/375-pl%C3%A1n_%E2%80%93_v%C3%BDb%C4%9Br_objekt%C5%AF.jpg) · [po](mobil-soupis/po/375-pl%C3%A1n_%E2%80%93_v%C3%BDb%C4%9Br_objekt%C5%AF.jpg) |

### Dialogy

| stav | před | po | snímek |
|---|---:|---:|---|
| dialog modal-revize | 6 | 0 | [před](mobil-soupis/pred/375-dialog_modal-revize.jpg) · [po](mobil-soupis/po/375-dialog_modal-revize.jpg) |
| dialog modal-leave-form | 3 | 0 | [před](mobil-soupis/pred/375-dialog_modal-leave-form.jpg) · [po](mobil-soupis/po/375-dialog_modal-leave-form.jpg) |
| dialog modal-najit | 10 | 0 | [před](mobil-soupis/pred/375-dialog_modal-najit.jpg) · [po](mobil-soupis/po/375-dialog_modal-najit.jpg) |
| dialog modal-napaji | 12 | 0 | [před](mobil-soupis/pred/375-dialog_modal-napaji.jpg) · [po](mobil-soupis/po/375-dialog_modal-napaji.jpg) |
| dialog modal-normy-editor | 6 | 0 | [před](mobil-soupis/pred/375-dialog_modal-normy-editor.jpg) · [po](mobil-soupis/po/375-dialog_modal-normy-editor.jpg) |
| dialog modal-odberatel | 19 | 0 | [před](mobil-soupis/pred/375-dialog_modal-odberatel.jpg) · [po](mobil-soupis/po/375-dialog_modal-odberatel.jpg) |
| dialog modal-snippety | 3 | 0 | [před](mobil-soupis/pred/375-dialog_modal-snippety.jpg) · [po](mobil-soupis/po/375-dialog_modal-snippety.jpg) |
| dialog modal-typicke-texty | 4 | 0 | [před](mobil-soupis/pred/375-dialog_modal-typicke-texty.jpg) · [po](mobil-soupis/po/375-dialog_modal-typicke-texty.jpg) |
| dialog modal-teren | 6 | 0 | [před](mobil-soupis/pred/375-dialog_modal-teren.jpg) · [po](mobil-soupis/po/375-dialog_modal-teren.jpg) |
| dialog modal-teren (stroje) | 10 | 0 | [před](mobil-soupis/pred/375-dialog_modal-teren_stroje_.jpg) · [po](mobil-soupis/po/375-dialog_modal-teren_stroje_.jpg) |
| dialog modal-rz | 14 | 0 | [před](mobil-soupis/pred/375-dialog_modal-rz.jpg) · [po](mobil-soupis/po/375-dialog_modal-rz.jpg) |
| dialog modal-vlozit-mereni | 21 | 0 | [před](mobil-soupis/pred/375-dialog_modal-vlozit-mereni.jpg) · [po](mobil-soupis/po/375-dialog_modal-vlozit-mereni.jpg) |
| dialog modal-sp-pristroje | 11 | 0 | [před](mobil-soupis/pred/375-dialog_modal-sp-pristroje.jpg) · [po](mobil-soupis/po/375-dialog_modal-sp-pristroje.jpg) |
| dialog modal-vnorit | 4 | 0 | [před](mobil-soupis/pred/375-dialog_modal-vnorit.jpg) · [po](mobil-soupis/po/375-dialog_modal-vnorit.jpg) |
| dialog modal-plan-objekt | 36 | 0 | [před](mobil-soupis/pred/375-dialog_modal-plan-objekt.jpg) · [po](mobil-soupis/po/375-dialog_modal-plan-objekt.jpg) |
| dialog modal-plan-slozka | 6 | 0 | [před](mobil-soupis/pred/375-dialog_modal-plan-slozka.jpg) · [po](mobil-soupis/po/375-dialog_modal-plan-slozka.jpg) |
| dialog modal-plan-stitky | 2 | 0 | [před](mobil-soupis/pred/375-dialog_modal-plan-stitky.jpg) · [po](mobil-soupis/po/375-dialog_modal-plan-stitky.jpg) |
| dialog modal-plan-technici | 2 | 0 | [před](mobil-soupis/pred/375-dialog_modal-plan-technici.jpg) · [po](mobil-soupis/po/375-dialog_modal-plan-technici.jpg) |
| dialog modal-plan-termin | 25 | 0 | [před](mobil-soupis/pred/375-dialog_modal-plan-termin.jpg) · [po](mobil-soupis/po/375-dialog_modal-plan-termin.jpg) |
| dialog modal-plan-tisk | 7 | 0 | [před](mobil-soupis/pred/375-dialog_modal-plan-tisk.jpg) · [po](mobil-soupis/po/375-dialog_modal-plan-tisk.jpg) |
| dialog modal-plan-vlozit | 6 | 0 | [před](mobil-soupis/pred/375-dialog_modal-plan-vlozit.jpg) · [po](mobil-soupis/po/375-dialog_modal-plan-vlozit.jpg) |
| dialog modal-plan-skryte | 0 | 0 | [před](mobil-soupis/pred/375-dialog_modal-plan-skryte.jpg) · [po](mobil-soupis/po/375-dialog_modal-plan-skryte.jpg) |
| dialog modal-plan-hv | 4 | 0 | [před](mobil-soupis/pred/375-dialog_modal-plan-hv.jpg) · [po](mobil-soupis/po/375-dialog_modal-plan-hv.jpg) |
| dialog modal-pdf-options | 2 | 0 | [před](mobil-soupis/pred/375-dialog_modal-pdf-options.jpg) · [po](mobil-soupis/po/375-dialog_modal-pdf-options.jpg) |
| dialog modal-email | 7 | 0 | [před](mobil-soupis/pred/375-dialog_modal-email.jpg) · [po](mobil-soupis/po/375-dialog_modal-email.jpg) |
| dialog modal-pretazeni | 4 | 0 | [před](mobil-soupis/pred/375-dialog_modal-pretazeni.jpg) · [po](mobil-soupis/po/375-dialog_modal-pretazeni.jpg) |
| dialog modal-ai | 1 | 0 | [před](mobil-soupis/pred/375-dialog_modal-ai.jpg) · [po](mobil-soupis/po/375-dialog_modal-ai.jpg) |
| dialog modal-ai-panel | 1 | 0 | [před](mobil-soupis/pred/375-dialog_modal-ai-panel.jpg) · [po](mobil-soupis/po/375-dialog_modal-ai-panel.jpg) |
| dialog modal-prirazit-odb | 4 | 0 | [před](mobil-soupis/pred/375-dialog_modal-prirazit-odb.jpg) · [po](mobil-soupis/po/375-dialog_modal-prirazit-odb.jpg) |
| dialog modal-plan-shody | 3 | 0 | [před](mobil-soupis/pred/375-dialog_modal-plan-shody.jpg) · [po](mobil-soupis/po/375-dialog_modal-plan-shody.jpg) |

## Rámečky s vlastním vodorovným posunem (po úpravě — povolené)

Obsah v nich se na displej nevejde schválně a je dosažitelný posunem rámečku (prstem do strany).
Test u nich ověřuje, že rámeček sám nepřesahuje displej. Stránka jako celek se do strany neposouvá nikde.

| rámeček | ve kolika stavech × šířkách |
|---|---:|
| `div#stavovy-radek` | 72 |
| `div#tab-bar-el` | 40 |
| `div#tab-bar-lps` | 30 |
| `div#tab-bar-stroje` | 30 |
| `div#rozvadece-container > div.scard.scard-rv > div.meas-table-wrap` | 15 |
| `div#tab-pristroje > div.scard > table.data-table` | 12 |
| `div#archiv-container` | 10 |
| `div#screen-plan > div.plan-wrap > div.plan-scroll` | 10 |
| `div#scard-dokumentace > table.data-table` | 6 |
| `div#spotrebice-list > div.sp-sheet-wrap` | 5 |
| `div#pdf-pages` | 5 |
| `div#teren-pdf-pages` | 5 |
| `div#spotrebice-pdf-pages` | 5 |
| `div#vm-nahled > div` | 5 |
| `div#scard-d3-zkouseni-tab > table.data-table` | 4 |
| `div#tab-lps-mereni > div.scard > table.data-table` | 4 |
| `div#stroje-mereni-hosty > div > table.data-table` | 4 |
| `div#stroje-kontroly-hosty > div > table.data-table` | 4 |
| `div#schema-pdf-pages` | 4 |
| `div#sp-pristroje-host > div.scard > table.data-table` | 4 |

## Verze pro PC

Mobilní pravidla se na PC neuplatní (`matchMedia` v 1366 i 1920 px = ne).
Ověřeno třemi způsoby, vždy lab v1.3 před úpravou × po úpravě:

1. **Otisk spočítaných stylů a polohy každého prvku** (`REZIM=pcstyly`) ve všech
   70 stavech v 1366 i 1920 px = 140 stavů, 816 860 prvků. **Shodné všechno**
   kromě 23 prvků v 7 stavech, a to jsou výhradně prvky **uprostřed animace**
   v okamžiku měření: vyjíždějící hláška se ZPĚT (posun 0,87 px — v 1366 je
   níž „před", v 1920 „po", tedy časování), přechod záložky po zavření dialogu
   a pulsující tlačítko. Žádný jiný styl ani poloha se nezměnily.
2. **Snímky celé stránky** (`REZIM=pc`), 140 snímků: **122 bajtově shodných**,
   18 s drobným rozdílem (text o 1 px níž, posunutá fáze tečkovaného podtržení
   odkazu „Přidat vadu C1", svislý pruh 3 px v okně objektu v plánu).
   Spočítané styly a polohy všech prvků jsou přitom shodné, takže jde
   o rasterizaci Chromu, ne o změnu vzhledu — **ověřeno**: stejný rozdíl
   (643 px v postranním archivu) vyrobí i samotný komentář `/*kkk…*/`
   o 1 000 znacích bez jediného pravidla. Pruh v okně objektu v plánu se liší
   i mezi dvěma běhy téže verze (před × před).
3. **Zaškrtávátka a přepínače** (jediné, co blok vzhledově nahrazuje —
   `appearance:none`): 24 kusů z 9 obrazovek (normy, napěťová soustava,
   ochrana, LPS, stroje, měřicí list, panel tisku, archiv, číslování v
   Nastavení). Před i po **bajtově shodné**: spočítané styly (`appearance:auto`,
   13–15 px), poloha, výřez snímku 48 × 48 px, přepnutí **klikem myši**,
   **mezerníkem**, **klikem na text popisku**, počet událostí `change`
   a **uložená data** (`getData()`).

**PDF:** elektro, LPS, stroje a spotřebiče vygenerované v 375 px, na šířku
(844 × 390, dotyk) i v 1366 px — 12 souborů **bajtově shodných** s verzí
před úpravou (zmrazený čas, sha256).

## Co emulace v Playwrightu neověří — zkusit na skutečném telefonu

- **Přiblížení iOS při klepnutí do pole** — 16 px je známá hranice Safari,
  Chromium ho nenapodobí.
- **Vysunutá klávesnice** — dialogy mají výšku `100dvh − 16px`; jak se chovají,
  když klávesnice zabere půl displeje, emulace neukáže.
- **Nativní výběr v rozbalovátku** (iOS kolečko, Android seznam).
- **Vzhled vlastního zaškrtávátka v Safari** (`appearance:none` + SVG fajfka)
  a podpora `:has()` (okno termínu a objektu v plánu; Safari 15.4+).
- **Dlouhý stisk prstem** pro kontextové menu a posouvání tabulky měření prstem
  (setrvačnost, ukotvený sloupec při rychlém posunu).
- **PDF z html2canvas na slabém telefonu** — data i výsledné PDF se nemění
  (ověřeno bajtově), ale doba a paměť na skutečném přístroji ano.
- **Výřez displeje / zaoblené rohy** (safe area) u telefonu na šířku.
- Přepínač zobrazení **PC / Mobil** na skutečném telefonu (automatika při
  šířce < 768 px).
