const fs=require('fs');
const p='c:/Users/rober/AppData/Roaming/Code/User/workspaceStorage/408c8dc4db920451da028b966c2c83e0/GitHub.copilot-chat/transcripts/8e55e0ee-819e-42fd-8438-ce311852980e.jsonl';
const lines=fs.readFileSync(p,'utf8').split(/\r?\n/);
let hit=null;
for(const line of lines){
 if(!line.trim()) continue;
 try{const obj=JSON.parse(line); if(obj?.type==='user.message' && typeof obj?.data?.content==='string' && obj.data.content.includes('PROJECT: GLW v1.0 FINAL FREEZE + SECURITY CLOSEOUT')){hit=obj.data.content;}}
 catch{}
}
if(!hit) throw new Error('message not found');
fs.writeFileSync('.tmp-user-final-freeze-request.txt',hit);
console.log('WROTE .tmp-user-final-freeze-request.txt');