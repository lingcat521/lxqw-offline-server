const f=new Intl.DateTimeFormat('zh-CN-u-ca-chinese',{day:'numeric'});
const out={};
for(let m=0;m<12;m++){const d=new Date(2023,m,1);const n=new Date(2023,m+1,0).getDate();
 for(let i=1;i<=n;i++){const dd=new Date(2023,m,i);let s=f.format(dd);s=s.replace(/日$/,'');out['2023-'+String(m+1).padStart(2,'0')+'-'+String(i).padStart(2,'0')]=s;}}
require('fs').writeFileSync('logs/lunar2023.json',JSON.stringify(out));
console.log('lunar 2023 days:',Object.keys(out).length, 'sample', out['2023-09-01'], out['2023-09-13']);