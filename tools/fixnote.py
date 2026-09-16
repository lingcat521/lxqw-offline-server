p='/data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw/tools/genrules.py'
s=open(p,encoding='utf-8').read()
old="""    var nid = NOTE_IDS[st.frog.nextNote % NOTE_IDS.length]; st.frog.nextNote++;
    var has = false;
    for (var i=0;i<st.notes.length;i++) if (st.notes[i].id === nid) has = true;
    if (!has) st.notes.push({id: nid, read: 0, timestamp: nowSec()});"""
new="""    var nid = null;
    for (var k=0;k<NOTE_IDS.length;k++){
      var cand = NOTE_IDS[(st.frog.nextNote+k) % NOTE_IDS.length];
      var used = false;
      for (var i=0;i<st.notes.length;i++) if (st.notes[i].id === cand) used = true;
      if (!used) { nid = cand; st.frog.nextNote = (st.frog.nextNote+k+1) % NOTE_IDS.length; break; }
    }
    if (nid !== null) st.notes.push({id: nid, read: 0, timestamp: nowSec()});"""
if old in s:
    s=s.replace(old,new); open(p,'w',encoding='utf-8').write(s); print('genrules patched')
elif 'var nid = null;' in s: print('already patched')
else: print('PATTERN MISSING')
