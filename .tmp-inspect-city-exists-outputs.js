const fs=require('fs');
for (const id of ['60703','60706']) {
  const ex=JSON.parse(fs.readFileSync(`.tmp-exec-${id}.json`,'utf8'));
  const rd=ex?.data?.resultData?.runData||{};
  const out0=rd['City Page Exists?']?.[0]?.data?.main?.[0]?.[0]?.json||null;
  const out1=rd['City Page Exists?']?.[0]?.data?.main?.[1]?.[0]?.json||null;
  console.log('\nExecution',id);
  console.log('out0 existing_city_page_id=', out0?.existing_city_page_id, 'type=', typeof out0?.existing_city_page_id);
  console.log('out1 existing_city_page_id=', out1?.existing_city_page_id, 'type=', typeof out1?.existing_city_page_id);
  console.log('out1 city_page_found=', out1?.city_page_found);
}