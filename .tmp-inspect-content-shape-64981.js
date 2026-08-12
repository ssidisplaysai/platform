const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const id='64981';
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const key=readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
  const ex=await (await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers})).json();
  const rd=ex?.data?.resultData?.runData||{};
  const page=rd['Fetch QA Page Snapshot']?.[0]?.data?.main?.[0]?.[0]?.json?.body||{};
  const content=page?.content||{};
  const rendered=typeof content?.rendered==='string'?content.rendered:'';
  const raw=typeof content?.raw==='string'?content.raw:'';
  console.log(JSON.stringify({
    contentKeys:Object.keys(content||{}),
    renderedLen:rendered.length,
    rawLen:raw.length,
    renderedHasHref:/href=/.test(rendered),
    rawHasHref:/href=/.test(raw),
    renderedHrefCount:(rendered.match(/href=["'][^"']+["']/gi)||[]).length,
    rawHrefCount:(raw.match(/href=["'][^"']+["']/gi)||[]).length,
    renderedSample:rendered.slice(0,260),
    rawSample:raw.slice(0,260)
  },null,2));
})();