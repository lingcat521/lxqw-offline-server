const f=new Intl.DateTimeFormat('zh-CN-u-ca-chinese',{day:'numeric'});
const out={};
for(let m=0;m<12;m++){const n=new Date(2026,m+1,0).getDate();
 for(let i=1;i<=n;i++){let s=f.format(new Date(2026,m,i)).replace(/日$/,'');out['2026-'+String(m+1).padStart(2,'0')+'-'+String(i).padStart(2,'0')]=s;}}
require('fs').writeFileSync('logs/lunar2026.json',JSON.stringify(out));
console.log('lunar2026 days', Object.keys(out).length);