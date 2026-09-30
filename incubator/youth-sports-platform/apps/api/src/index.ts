import Fastify from "fastify";
const app=Fastify({logger:true});
app.get("/health",async()=>({status:"ok",service:"sports-api",version:"0.1.0"}));
app.get("/v1/today",async()=>({date:new Date().toISOString().slice(0,10),family:{id:"demo-family",displayName:"Demo Family"},events:[{id:"demo-game-1",sport:"softball",type:"game",teamName:"10U Lightning",opponent:"Heat",startsAt:"2026-09-26T08:00:00-07:00",arrivalAt:"2026-09-26T07:00:00-07:00",venue:"Johnson Sports Complex",surface:"Diamond 3"}],attention:[{type:"rsvp",label:"RSVP for Tuesday practice"},{type:"assignment",label:"Snack assignment Saturday"},{type:"workload",label:"Pitcher workload",value:"92 pitches / 48 hours"}]}));
const port=Number(process.env.PORT??4000);const host=process.env.HOST??"0.0.0.0";
app.listen({port,host}).catch((error)=>{app.log.error(error);process.exit(1)});
