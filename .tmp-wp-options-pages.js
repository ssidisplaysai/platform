(async()=>{
  const res = await fetch('https://leddisplaywarehouse.com/wp-json/wp/v2/pages',{method:'OPTIONS',headers:{Accept:'application/json'}});
  const j = await res.json().catch(()=>null);
  const endpoints = j?.endpoints || [];
  const getEndpoint = endpoints.find(e => e.methods && e.methods.includes('GET')) || null;
  const args = getEndpoint?.args || null;
  const out = {
    status: res.status,
    hasGetEndpoint: Boolean(getEndpoint),
    statusArg: args?.status || null,
    contextArg: args?.context || null,
    slugArg: args?.slug || null,
    parentArg: args?.parent || null,
    perPageArg: args?.per_page || null
  };
  require('fs').writeFileSync('.tmp-wp-pages-options.json', JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
})();