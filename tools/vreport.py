"""vreport.py - 把最近一次开机的 [VP] 视图探针日志摘出来 (默认只看最后一次 boot 之后)。

用法:
  python3 tools/vreport.py            # 摘要
  python3 tools/vreport.py --full     # 带时间戳原文
"""
import sys, re

LOG = 'logs/game.log'
raw = open(LOG, encoding='utf-8', errors='replace').read().split('\n')
last = 0
for i, l in enumerate(raw):
    if 'installed v' in l:
        last = i
seg = raw[last:]
full = '--full' in sys.argv
keep = re.compile(r'\[VP\]|界面变化|FOUND |CALL |\.行 |\.数据 |\.三格|\.页签|\.文本 |\.标志 |\.子 |OPEN |ARM ')
print('# 日志段: 第 %d 行起 (最后一次 boot), 共 %d 行, 命中 %d 行' % (last + 1, len(seg), sum(1 for l in seg if keep.search(l))))
for l in seg:
    if not keep.search(l):
        continue
    if full:
        print(l)
    else:
        t = re.match(r'^(\S+) /__log log: (.*)$', l)
        if t:
            print(t.group(2))
        else:
            print(l)
