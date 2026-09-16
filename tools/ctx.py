import sys, re
path=sys.argv[1]; pat=sys.argv[2]
before=int(sys.argv[3]) if len(sys.argv)>3 else 200
after=int(sys.argv[4]) if len(sys.argv)>4 else 800
maxhits=int(sys.argv[5]) if len(sys.argv)>5 else 6
s=open(path,encoding='utf-8',errors='replace').read()
n=0
for m in re.finditer(re.escape(pat), s):
    n+=1
    if n>maxhits: break
    a=max(0,m.start()-before); b=min(len(s),m.end()+after)
    print("=== #%d @%d ===" % (n, m.start()))
    print(s[a:b].replace("\n","\\n"))
    print()
print("[total hits: %d]" % len(re.findall(re.escape(pat), s)))
