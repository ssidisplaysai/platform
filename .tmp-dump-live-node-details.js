const fs = require('fs');
const wf = JSON.parse(fs.readFileSync('.tmp-live-workflow.json','utf8'));
function node(name){return (wf.nodes||[]).find(n=>n.name===name);}
fs.writeFileSync('.tmp-prepare-hierarchy.js.txt', node('Prepare Hierarchy Fields')?.parameters?.jsCode || '');
fs.writeFileSync('.tmp-send-complete-callback.json', JSON.stringify(node('Send GLW Completion Callback')?.parameters || {}, null, 2));
fs.writeFileSync('.tmp-update-yoast.json', JSON.stringify(node('Update Yoast SEO')?.parameters || {}, null, 2));
fs.writeFileSync('.tmp-prepare-image-fields.js.txt', node('Prepare Image Fields')?.parameters?.jsCode || '');
fs.writeFileSync('.tmp-upload-image.json', JSON.stringify(node('Upload Image to WordPress')?.parameters || {}, null, 2));
fs.writeFileSync('.tmp-set-featured.json', JSON.stringify(node('Set Featured Image')?.parameters || {}, null, 2));
fs.writeFileSync('.tmp-insert-image.json', JSON.stringify(node('Insert Image Into Page')?.parameters || {}, null, 2));
console.log('dumped details');