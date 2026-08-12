const fs=require('fs');
const code=fs.readFileSync('.tmp-live-getrows-code.js','utf8');
const token="normalized === 'draft'";
const idx=code.indexOf(token);
console.log(JSON.stringify({idx,length:code.length}));
if(idx>=0){
 const start=Math.max(0,idx-40);
 const end=Math.min(code.length,idx+140);
 const seg=code.slice(start,end);
 console.log(seg);
 console.log('---JSON---');
 console.log(JSON.stringify(seg));
}