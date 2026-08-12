const fs=require('fs');
for (const id of ['60703','60706']) {
  const ex = JSON.parse(fs.readFileSync(`.tmp-exec-${id}.json`,'utf8'));
  const rd = ex?.data?.resultData?.runData || {};
  const lookupItem = rd['Normalize City Lookup Result']?.[0]?.data?.main?.[0]?.[0]?.json || null;
  const cityExistsIn = rd['City Page Exists?']?.[0]?.data?.main || null;
  const left = lookupItem?.existing_city_page_id;
  console.log(JSON.stringify({
    id,
    existing_city_page_id:left,
    type: typeof left,
    city_page_found: lookupItem?.city_page_found,
    cityPageExistsBranchSizes: Array.isArray(cityExistsIn) ? cityExistsIn.map(b=>Array.isArray(b)?b.length:0) : null
  },null,2));
}