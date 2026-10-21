#!/bin/bash
# Připraví testovací zázemí v testy/_beh a spustí servery. Spouští se samo při
# startu session (.claude/settings.json → SessionStart) a na začátku regrese.sh.
#   8901 program z pracovní kopie        8902 stará verze z gitu (STARA, výchozí HEAD)
#   8903 falešná CDN (knihovny, písma)   8904 program s odkazy na 8903 (test ZIPu)
#   8920 v9.110 (test-karta-stroje porovnává formulář stroje)
# 8905–8907 si za běhu berou test-zip-kodu.js a test-sri.js — tady je neobsazovat.
T=$(cd "$(dirname "$0")" && pwd); R=$(dirname "$T"); B=$T/_beh
PRED=96fe576   # v9.110
# openpyxl potřebují testy sešitů .xlsx — v novém prostředí chybí
python3 -c "import openpyxl" 2>/dev/null || python3 -m pip install -q openpyxl >/dev/null 2>&1 || echo "⚠ openpyxl se nepodařilo nainstalovat"
mkdir -p "$B"/stara "$B"/predchozi "$B"/zipapp "$B"/cdn "$B"/out

for p in 8901 8902 8903 8904 8920; do fuser -k -s $p/tcp 2>/dev/null; done

# stará verze pro porovnani2.js = poslední commit (bez neodevzdaných změn)
for f in index.html sw.js manifest.json; do git -C "$R" show "${STARA:-HEAD}:$f" > "$B/stara/$f"; done
# v9.110 — v mělkém klonu se musí dotáhnout
git -C "$R" cat-file -e "$PRED" 2>/dev/null || git -C "$R" fetch -q --depth=1 origin "$PRED"
git -C "$R" show "$PRED:index.html" > "$B/predchozi/index.html"

# falešná CDN: skutečné knihovny (kvůli otiskům SRI) + prázdná písma
cp "$T"/knihovny/*.js "$B/cdn/"
printf '\n' > "$B/cdn/pismo-a.woff2"; printf '\n' > "$B/cdn/pismo-b.woff2"
cat > "$B/cdn/css2" <<'CSS'
@font-face{font-family:'DM Mono';src:url(http://127.0.0.1:8903/pismo-a.woff2) format('woff2');}
@font-face{font-family:'Courier Prime';src:url(http://127.0.0.1:8903/pismo-b.woff2) format('woff2');}
CSS
# program pro test ZIPu: odkazy na CDN přesměrované na 8903
sed -e 's#https://fonts.googleapis.com/css2?[^"]*#http://127.0.0.1:8903/css2#' \
    -e 's#https://cdnjs.cloudflare.com/ajax/libs/[^"]*/\([^/"]*\.js\)#http://127.0.0.1:8903/\1#' \
    "$R/index.html" > "$B/zipapp/index.html"
cp "$R/sw.js" "$R/manifest.json" "$R/CLAUDE.md" "$B/zipapp/"
mkdir -p "$B/zipapp/.github/workflows"; cp "$R/.github/workflows/pages.yml" "$B/zipapp/.github/workflows/"
[ -f "$R/.nojekyll" ] && cp "$R/.nojekyll" "$B/zipapp/"
mkdir -p "$B/zipapp/vektor"; cp "$R"/vektor/* "$B/zipapp/vektor/"

start() { (cd "$1" && exec setsid nohup "${@:2}" </dev/null >/dev/null 2>&1 &) </dev/null >/dev/null 2>&1; }
start "$R"           python3 -m http.server 8901
start "$B/stara"     python3 -m http.server 8902
start "$T"           python3 corsserver.py 8903 "$B/cdn"
start "$T"           python3 corsserver.py 8904 "$B/zipapp"
start "$B/predchozi" python3 -m http.server 8920
sleep 1
for p in 8901 8902 8903 8904 8920; do
  c=$(curl -s -o /dev/null -w '%{http_code}' --noproxy '*' http://127.0.0.1:$p/)
  [ "$c" = 200 ] || echo "⚠ server $p neodpovídá ($c)"
done
exit 0
