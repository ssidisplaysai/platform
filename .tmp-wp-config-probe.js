(async()=>{
  const base='https://leddisplaywarehouse.com';
  const urls=[
    '/wp-json/wp-site-health/v1/tests/php_constants',
    '/wp-json/wp-site-health/v1/tests/dotorg_communication',
    '/wp-json/wp/v2/settings',
    '/wp-json/',
    '/wp-admin/site-health.php?tab=debug',
    '/wp-content/debug.log'
  ];
  const out=[];
  for(const u of urls){
    try{
      const r=await fetch(base+u,{redirect:'manual'});
      const t=await r.text();
      out.push({url:u,status:r.status,location:r.headers.get('location'),contentType:r.headers.get('content-type'),sample:t.slice(0,180)});
    }catch(e){out.push({url:u,error:String(e)})}
  }
  console.log(JSON.stringify(out,null,2));
})();