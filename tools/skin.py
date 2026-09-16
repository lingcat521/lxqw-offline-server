"""skin.py - dump a compiled egret skin from default.thm.js.
usage: python3 tools/skin.py <path-substring-or-className> [--all]
  default: print skinParts + one line per named part/child with its layout props."""
import sys, re
SRC = 'apk/assets/game/js/default.thm.js'
s = open(SRC, encoding='utf-8', errors='replace').read()


def blocks():
    for m in re.finditer(r"generateEUI\.paths\['([^']*)'\]\s*=\s*window\.([A-Za-z0-9_$]+)\s*=\s*\(function", s):
        end = s.find('})(eui.Skin);', m.end())
        yield m.group(2), m.group(1), s[m.start():end + 12]


def layout(name, body):
    keep = []
    for fm in re.finditer(r'_proto\.([A-Za-z0-9_$]+) = function \(\) \{\n(.*?)\n\t\};', body, re.S):
        fn, fb = fm.group(1), fm.group(2)
        ls = [l.strip() for l in fb.split('\n')
              if re.search(r'\.(x|y|width|height|horizontalCenter|verticalCenter|source|text|size|visible|alpha|layout|anchorOffsetX|anchorOffsetY|skinName|itemRenderer|left|right|top|bottom)\s*=', l)]
        if ls:
            keep.append('  %-22s %s' % (fn, ' '.join(ls)))
    return keep


pat = sys.argv[1]
for cls, path, body in blocks():
    if pat not in path and pat != cls:
        continue
    parts = re.search(r'this\.skinParts = \[([^\]]*)\]', body)
    print('=== %s  %s' % (cls, path))
    print('skinParts: ' + (parts.group(1) if parts else '?'))
    for l in layout(cls, body):
        print(l)
    print()
