const fs=require('fs');
const wf=JSON.parse(fs.readFileSync('.tmp-live-workflow.json','utf8'));
const con=wf.connections||{};
const names=['Update Yoast SEO','Prepare Image Fields','Generate Image','Upload Image to WordPress','Insert Image Into Page','Set Featured Image','Update Image Alt Text','Send GLW Completion Callback','Update row in sheet'];
for(const name of names){
 const c=con[name];
 if(!c||!c.main){console.log(name+': (none)');continue;}
 const outs=c.main.map((b,i)=>`branch${i}: ${(b||[]).map(x=>x.node).join(', ')}`);
 console.log(name+': '+outs.join(' | '));
}