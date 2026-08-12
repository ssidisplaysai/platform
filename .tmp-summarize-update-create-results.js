const fs=require('fs');
for (const id of ['60725','60726','60727']) {
  const ex=JSON.parse(fs.readFileSync(`.tmp-exec-${id}.json`,'utf8'));
  const rd=ex?.data?.resultData?.runData||{};
  const upd=rd['Update Existing City Page']?.[0]?.data?.main?.[0]?.[0]?.json || null;
  const crt=rd['Create a post']?.[0]?.data?.main?.[0]?.[0]?.json || null;
  const lookup=rd['Normalize City Lookup Result']?.[0]?.data?.main?.[0]?.[0]?.json || null;
  console.log(JSON.stringify({id,lookup:{city_page_found:lookup?.city_page_found,existing_city_page_id:lookup?.existing_city_page_id},updateExecuted:Boolean(upd),updateResult:upd?{id:upd.id,status:upd.status,slug:upd.slug,parent:upd.parent,link:upd.link}:null,createExecuted:Boolean(crt),createResult:crt?{id:crt.id,status:crt.status,slug:crt.slug,parent:crt.parent,link:crt.link}:null},null,2));
}