"""vclass.py - extract full class bodies from main.min.js (Egret __extends/__reflect style)."""
import sys, re

SRC = 'apk/assets/game/js/main.min.js'


def load():
    return open(SRC, encoding='utf-8', errors='replace').read()


def extract(s, name):
    end = -1
    for m in re.finditer(r'__reflect\(\s*' + re.escape(name) + r'\.prototype\s*,\s*"' + re.escape(name) + r'"\s*\)', s):
        end = m.end()
    if end < 0:
        return None
    start = s.rfind('var ' + name + '=', 0, end)
    if start < 0:
        start = s.rfind(name + '=function', 0, end)
    if start < 0:
        return None
    return start, end, s[start:end]


def protos(body):
    return sorted(set(re.findall(r'prototype\.([A-Za-z0-9_$]+)\s*=', body)))


def main():
    s = load()
    args = sys.argv[1:]
    if not args:
        print('usage: vclass.py [--list PAT | --proto] Name...')
        return
    if args[0] == '--list':
        pat = re.compile(args[1])
        names = set()
        for m in re.finditer(r'__reflect\(\s*([A-Za-z0-9_$.]+)\.prototype\s*,\s*"([A-Za-z0-9_$]+)"\s*\)', s):
            if pat.search(m.group(2)):
                names.add(m.group(2))
        for n in sorted(names):
            print(n)
        return
    want_proto = '--proto' in args
    for name in [a for a in args if not a.startswith('--')]:
        r = extract(s, name)
        if not r:
            print('!! not found: ' + name)
            continue
        st, en, body = r
        if want_proto:
            print('=== %s @%d (%dB) methods: %s' % (name, st, len(body), ', '.join(protos(body))))
        else:
            print('=== %s @%d (%dB) ===' % (name, st, len(body)))
            print(body)


main()
