import fs from 'node:fs';import assert from 'node:assert/strict';
const origin=process.env.BASE_URL,token=process.env.ADMIN_TOKEN;
if(!origin||!token)throw Error('Set BASE_URL and ADMIN_TOKEN');
let update=Date.now();const slotId='race-'+update,chatIds=[Math.floor(Math.random()*1e9),Math.floor(Math.random()*1e9)];
async function api(path,body){return fetch(origin+'/api/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});}
assert.equal((await(await fetch(origin+'/health')).json()).mode,'test');
assert.equal((await api('slots',{id:slotId,label:'TEST · Одно место',capacity:1,starts_at:new Date(Date.now()+86400000).toISOString()})).status,200);
for(const chatId of chatIds)for(const text of ['/agree','/yes','TEST Race','3','@test_parent','/skip'])assert.equal((await api('demo',{chatId,updateId:++update,text})).status,200);
const result=await Promise.all(chatIds.map(chatId=>api('assign',{leadId:'demo:'+chatId,slotId})));assert.deepEqual(result.map(r=>r.status).sort(),[200,409]);
const replay={chatId:chatIds[1],updateId:++update,text:'/info'};assert.equal((await api('demo',replay)).status,200);assert.equal((await(await api('demo',replay)).json()).duplicate,true);
const state=await(await api('state')).json();assert.equal(state.leads.filter(l=>l.slot_id===slotId).length,1);
assert.equal((await fetch(origin+'/api/state')).status,401);
const webhook=await fetch(origin+'/telegram',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(webhook.status,401);
const report={checked_at:new Date().toISOString(),origin,concurrent_assignment_statuses:result.map(r=>r.status),checks:{one_place_one_booking:true,duplicate_update_ignored:true,crm_requires_admin:true,webhook_requires_secret:true}};fs.writeFileSync('cloud-concurrency-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
