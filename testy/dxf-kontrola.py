# Pomocník pro test-rozvadec.js (výměna s CAD): přečte DXF přes ezdxf
# a vypíše JSON, nebo změní atribut přístroje (jako technik v CAD).
#   python3 dxf-kontrola.py rozbor SOUBOR.dxf
#   python3 dxf-kontrola.py zmen VSTUP.dxf VYSTUP.dxf OZNACENI TAG HODNOTA [OZNACENI TAG HODNOTA …]
#   python3 dxf-kontrola.py bez-pristroju VYSTUP.dxf      (platný DXF jen s čarami a textem)
import sys, json, ezdxf

def rozbor(cesta):
    doc = ezdxf.readfile(cesta)
    a = doc.audit()
    msp = doc.modelspace()
    ins = []
    for e in msp.query('INSERT'):
        ins.append({'blok': e.dxf.name, 'vrstva': e.dxf.layer, 'atr': {x.dxf.tag: x.dxf.text for x in e.attribs},
                    'skryte': {x.dxf.tag: bool(x.dxf.flags & 1) for x in e.attribs},
                    'textu': sum(1 for t in doc.blocks[e.dxf.name] if t.dxftype() == 'TEXT')})
    typy = {}
    for e in msp:
        typy[e.dxftype()] = typy.get(e.dxftype(), 0) + 1
    texty = [t.dxf.text for t in msp.query('TEXT')]
    for b in doc.blocks:
        texty += [t.dxf.text for t in b if t.dxftype() == 'TEXT']
    ram = [e for e in msp.query('LWPOLYLINE[layer=="RAM"]') if e.closed]
    print(json.dumps({'chyby': len(a.errors), 'opravy': len(a.fixes), 'zpravy': [x.message for x in a.errors + a.fixes][:5],
                      'verze': doc.dxfversion, 'kodovani': doc.encoding, 'codepage': doc.header.get('$DWGCODEPAGE'),
                      'insunits': doc.header.get('$INSUNITS'), 'vrstvy': [l.dxf.name for l in doc.layers], 'typy': typy,
                      'inserty': ins, 'texty': texty, 'ramu': len(ram)}, ensure_ascii=False))

def zmen(vstup, vystup, zmeny):
    doc = ezdxf.readfile(vstup)
    for e in doc.modelspace().query('INSERT'):
        atr = {x.dxf.tag: x for x in e.attribs}
        for i in range(0, len(zmeny), 3):
            if 'OZNACENI' in atr and atr['OZNACENI'].dxf.text == zmeny[i] and zmeny[i + 1] in atr:
                atr[zmeny[i + 1]].dxf.text = zmeny[i + 2]
    doc.saveas(vystup)

def bez_pristroju(vystup):
    doc = ezdxf.new('R2004')
    msp = doc.modelspace()
    msp.add_line((0, 0), (100, 50))
    msp.add_text('Půdorys – jen čára a text', height=3).set_placement((10, 10))
    doc.saveas(vystup)

if sys.argv[1] == 'rozbor':
    rozbor(sys.argv[2])
elif sys.argv[1] == 'zmen':
    zmen(sys.argv[2], sys.argv[3], sys.argv[4:])
elif sys.argv[1] == 'bez-pristroju':
    bez_pristroju(sys.argv[2])
