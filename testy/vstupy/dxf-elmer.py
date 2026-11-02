# Vymyšlený výkres rozvaděče se stavbou exportu ze Schémat CAD (Elmer):
# AC1018, $DWGCODEPAGE = ANSI_1250, jedna vrstva, žádné atributy, přístroje
# jsou bloky s vlastními názvy kreslíře a OBYČEJNÝMI texty uvnitř, tabulka
# obvodů volnými texty pod schématem, hlavní vypínač volným textem, třetí list
# čelní pohled (označení po řadách + popis skříně). Všechna data jsou vymyšlená.
# Spuštění: python3 testy/vstupy/dxf-elmer.py  →  testy/vstupy/elmer-ordinace.dxf
import os, ezdxf

doc = ezdxf.new('R2004')
doc.encoding = 'cp1250'   # $DWGCODEPAGE = ANSI_1250 (jako Elmer)
doc.header['$INSUNITS'] = 4
msp = doc.modelspace()
W, H, MEZ = 420, 297, 20

def ram(ox):
    msp.add_lwpolyline([(ox, 0), (ox + W, 0), (ox + W, H), (ox, H)], close=True)
    msp.add_lwpolyline([(ox + 10, 5), (ox + W - 5, 5), (ox + W - 5, H - 5), (ox + 10, H - 5)], close=True)
    for i in range(8):   # číslování zón v okraji rámu (nesmí se plést s čísly obvodů)
        msp.add_text(str(i + 1), height=2.5).set_placement((ox + 30 + i * 50, H - 3))
        msp.add_text(str(i + 1), height=2.5).set_placement((ox + 30 + i * 50, 1.5))

def text(t, x, y, h=2.5, rot=0, cil=None):
    (cil or msp).add_text(t, height=h, rotation=rot).set_placement((x, y))

def pristroj(nazev, x, y, texty, symbol='jistic'):
    b = doc.blocks.new(name=nazev)
    b.add_line((0, 0), (0, 4)); b.add_line((0, 12), (0, 16))
    if symbol == 'jistic':
        b.add_line((0, 12), (-3, 5)); b.add_line((-1, 3), (1, 5)); b.add_line((1, 3), (-1, 5))
    elif symbol == 'chranic':
        b.add_line((0, 12), (-3, 5)); b.add_ellipse((0, 8), major_axis=(3, 0), ratio=0.35)
        b.add_line((-4, 4), (4, 4))
    elif symbol == 'vypinac':
        b.add_line((0, 12), (-3, 5)); b.add_line((-1, 4), (1, 4))
    for i, t in enumerate(texty):
        if t in ('1', '2'):
            text(t, -2.5, 15 if t == '1' else 0.5, 1.8, cil=b)
        elif i == 0:
            text(t, 2, 14, 2.5, cil=b)               # označení
        elif i == 1:
            text(t, 5, 0, 2, rot=90, cil=b)          # typ svisle
        else:
            text(t, 2 + 0 * i, 10 - (i - 2) * 3, 2, cil=b)
    msp.add_blockref(nazev, (x, y))

def zakonceni(nazev, x, y, druh):
    b = doc.blocks.new(name=nazev)
    b.add_line((0, 0), (0, 4))
    if druh == 'zas':
        b.add_arc((0, 0), 3, 0, 180)
    else:
        b.add_circle((0, -3), 3); b.add_line((-2, -1), (2, -5)); b.add_line((2, -1), (-2, -5))
    msp.add_blockref(nazev, (x, y))

def tabulka(ox, radky):
    text('Obvod č.', ox + 15, 70, 2.2); text('Pi /kW/', ox + 15, 62, 2.2); text('Kabel', ox + 15, 54, 2.2); text('Popis', ox + 15, 46, 2.2)
    for x, cis, pi, kab, popis in radky:
        text(cis, x - 1.5, 70); text(pi, x - 2, 62, 2.2); text(kab, x - 6, 54, 1.8)
        for j, r in enumerate(popis):
            text(r, x - 6, 46 - j * 3.2, 1.8)

def razitko(ox, list_c):
    x, y = ox + W - 135, 10
    msp.add_lwpolyline([(x, y), (x + 130, y), (x + 130, y + 40), (x, y + 40)], close=True)
    for (pop, hod, yy) in [('Akce', 'Ordinace MUDr. Vymyšlená, Smyšlená 12', 33), ('Investor', 'Vymyšlená zdravotní s.r.o.', 26),
                           ('Název výkresu', 'Rozvaděč RS-ORD1', 19), ('Vypracoval', 'Petr Vymyšlený', 12)]:
        text(pop, x + 2, y + yy + 4, 1.6); text(hod, x + 2, y + yy, 2.6)
    text('List ' + str(list_c) + ' / 3', x + 100, y + 2, 2)

# ── list 1: přívod, hlavní vypínač (volný text), pět RCBO ──
ox = 0
ram(ox)
text('C1 RH100.2', ox + 18, 252, 2.5); text('FA02 B25/3', ox + 18, 247, 2.5)
msp.add_line((ox + 18, 240), (ox + 45, 240))
msp.add_line((ox + 45, 236), (ox + 45, 244)); msp.add_line((ox + 45, 236), (ox + 42, 243))
text('QH', ox + 48, 241, 2.5); text('ASN 32/3', ox + 48, 237, 2.2); text('In=32A', ox + 48, 233, 2.2)
msp.add_line((ox + 45, 225), (ox + 160, 225))   # hlavní přípojnice
rcbo = [('FA1', 'OLI 10B/2/030/A', 10), ('FA2', 'OLI 16B/2/030/A', 16), ('FA3', 'OLI 16B/2/030/A', 16),
        ('FA4', 'OLI 16B/2/030/A', 16), ('FA5', 'OLI 10B/2/030/A', 10)]
for i, (o, typ, In) in enumerate(rcbo):
    x = ox + 70 + i * 20
    msp.add_line((x, 225), (x, 216))
    pristroj('Fíčko 1f (%d)' % (i + 3), x, 200, [o, typ, 'Idn=30mA', 'In=%dA' % In, '1', '2'], 'chranic')
    msp.add_line((x, 200), (x, 102))
tabulka(ox, [
    (ox + 70, '01', '0,8', 'CYKY-J 3x1,5', ['Osv. (ordinace,', 'sesterna, čekárna)']),
    (ox + 90, '02', '2', 'CYKY-J 3x2,5', ['Zás. ordinace']),
    (ox + 110, '03', '2', 'CYKY-J 3x2,5', ['Zás. sesterna']),
    (ox + 130, '04', '2,5', 'CYKY-J 3x2,5', ['Zásuvky – kuchyňka, ř. 1']),
    (ox + 150, '05', '', '', ['Rezerva']),
])
for i, d in enumerate(['svit', 'zas', 'zas', 'zas']):
    zakonceni(('_U (%d)' if d == 'svit' else 'ZASU_01 (%d)') % (i + 1), ox + 70 + i * 20, 98, d)
text('Rozvaděč:', ox + 200, 120, 2.5); text('RS-ORD1', ox + 245, 120, 2.5)
text('Rozvodná soustava:', ox + 200, 114, 2.5); text('3 NPE AC 50 Hz 230/400V / TN-C-S', ox + 245, 114, 2.5)
text('Krytí:', ox + 200, 108, 2.5); text('IP40', ox + 245, 108, 2.5)
text('Rozměry:', ox + 200, 102, 2.5); text('300x545x90 mm', ox + 245, 102, 2.5)
text('Provedení:', ox + 200, 96, 2.5); text('nástěnné', ox + 245, 96, 2.5)
text('Přívod:', ox + 200, 90, 2.5); text('shora', ox + 245, 90, 2.5)
text('Způsob ochrany:', ox + 200, 84, 2.5); text('automatickým odpojením od zdroje', ox + 245, 84, 2.5)
razitko(ox, 1)

# ── list 2: chránič LFN se čtyřmi jističi pod ním, dva jističe přímo z přípojnice ──
ox = W + MEZ
ram(ox)
msp.add_line((ox + 20, 225), (ox + 300, 225))
x_fi = ox + 60
msp.add_line((x_fi, 225), (x_fi, 216))
pristroj('Fíčko 3f', x_fi, 200, ['FI7', 'LFN 40/4/030/A', 'Idn=30mA', 'In=40A', '1', '2'], 'chranic')
msp.add_line((x_fi, 200), (x_fi, 190))
msp.add_line((ox + 55, 190), (ox + 165, 190))   # přípojnice chrániče
ltn = [('FA8', 'LTN 10B/1', 10), ('FA9', 'LTN 16B/1', 16), ('FA10', 'LTN 16B/1', 16), ('FA11', 'LTN 16B/1', 16)]
for i, (o, typ, In) in enumerate(ltn):
    x = ox + 80 + i * 25
    msp.add_line((x, 190), (x, 176))
    pristroj('JST1P1 (4) (%d)' % (i + 2), x, 160, [o, typ, 'In=%dA' % In, '10kA', '1', '2'])
    msp.add_line((x, 160), (x, 102))
for i, (o, typ, In) in enumerate([('FA12', 'LTN 16B/1', 16), ('FA13', 'LTN 20B/1', 20)]):
    x = ox + 200 + i * 25
    msp.add_line((x, 225), (x, 216))
    pristroj('JST1P1 (%d)' % (i + 7), x, 200, [o, typ, 'In=%dA' % In, '10kA', '1', '2'])
    msp.add_line((x, 200), (x, 102))
# přístroj, který se rozpoznat nedá (bez jmenovitého proudu) — v náhledu červený řádek
pristroj('BLOK XY (1)', ox + 300, 200, ['FA14', 'Přístroj XY-neznámý'])
tabulka(ox, [
    (ox + 80, '06', '0,6', 'CYKY-J 3x1,5', ['Osv. chodba,', 'WC']),
    (ox + 105, '07', '2', 'CYKY-J 3x2,5', ['Zás. čekárna']),
    (ox + 130, '08', '2', 'CYKY-J 3x2,5', ['Zás. WC']),
    (ox + 155, '09', '1,5', 'CYKY-J 3x2,5', ['Zás. úklid']),
    (ox + 200, '10', '2', 'CYKY-J 3x2,5', ['Zás. kancelář']),
    (ox + 225, '11', '3', 'CYKY-J 3x4', ['Ohřev vody']),
])
for i, d in enumerate(['svit', 'zas', 'zas', 'zas']):
    zakonceni(('_U (%d)' if d == 'svit' else 'ZASU_01 (%d)') % (i + 10), ox + 80 + i * 25, 98, d)
razitko(ox, 2)

# ── list 3: čelní pohled (označení po řadách, popis skříně) ──
ox = 2 * (W + MEZ)
ram(ox)
text('Rozvodnice od výrobce ABB 3x12modulů, LucaSystem: Europa, IP40, třída II, rozměry 300x545x90', ox + 20, 270, 3)
rady = [['QH', 'FA1', 'FA2', 'FA3', 'FA4'], ['FA5', 'FI7', 'FA8', 'FA9', 'FA10'], ['FA11', 'FA12', 'FA13']]
for r, rada in enumerate(rady):
    y = 220 - r * 55
    msp.add_line((ox + 40, y - 10), (ox + 260, y - 10))
    for j, o in enumerate(rada):
        x = ox + 50 + j * 35
        msp.add_lwpolyline([(x - 8, y - 25), (x + 8, y - 25), (x + 8, y + 5), (x - 8, y + 5)], close=True)
        text(o, x - 4, y, 3)
razitko(ox, 3)

cesta = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'elmer-ordinace.dxf')
doc.saveas(cesta)
print('zapsáno', cesta)
