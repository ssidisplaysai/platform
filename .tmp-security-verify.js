const urls=[
  'https://leddisplaywarehouse.com/',
  'https://leddisplaywarehouse.com/wp-admin/',
  'https://leddisplaywarehouse.com/wp-json/',
  'https://leddisplaywarehouse.com/direct-view-led-video-walls/texas/austin/'
];
(async()=>{
  const results=[];
  for(const url of urls){
    const res=await fetch(url,{redirect:'follow'});
    const text=await res.text();
    results.push({url,status:res.status,contentType:res.headers.get('content-type'),snippet:text.slice(0,180).replace(/\s+/g,' ')});
  }
  console.log(JSON.stringify(results,null,2));
})();