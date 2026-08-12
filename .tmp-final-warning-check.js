const urls=[
  'https://leddisplaywarehouse.com/direct-view-led-video-walls/texas/austin/',
  'https://leddisplaywarehouse.com/?page_id=19290',
  'https://app.ssiai.app/api/glw/health'
];
function hasWarn(text){ return /<b>Warning<\/b>|Warning:\s+|Notice:|Fatal error:/i.test(text); }
(async()=>{
  const results=[];
  for (const url of urls){
    const res=await fetch(url,{redirect:'follow'});
    const text=await res.text();
    results.push({url,status:res.status,warning:hasWarn(text),contentType:res.headers.get('content-type')});
  }
  console.log(JSON.stringify(results,null,2));
})();