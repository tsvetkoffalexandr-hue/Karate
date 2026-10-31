import assert from 'node:assert/strict';
const origin=process.env.BASE_URL||'http://localhost:8791';
const token=process.env.ADMIN_TOKEN;
if(!token)throw Error('Set ADMIN_TOKEN');
async function api(path,body){const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}
const health=await api('/health');assert.equal(health.mode,'test');
const suffix=Date.now(),chatId=Math.floor(Math.random()*1e9),id='test-'+suffix;let update=suffix;
await api('/api/slots',{id,label:'TEST · Пробная тренировка',capacity:1,starts_at:new Date(Date.now()+2*86400000).toISOString()});
const transcript=[];
for(const text of ['/start','/uk','/agree','/yes','Тестовий батько','3','@test_parent','Будні після 17:00']){const r=await api('/api/demo',{chatId,updateId:++update,text});transcript.push({text,reply:r.reply});}
let waiting=await api('/api/state');assert.equal(waiting.leads.find(l=>l.id==='demo:'+chatId).status,'awaiting_assignment');assert.equal(waiting.leads.find(l=>l.id==='demo:'+chatId).slot_id,null);await api('/api/assign',{leadId:'demo:'+chatId,slotId:id});const state=await api('/api/state');const lead=state.leads.find(l=>l.id==='demo:'+chatId);assert.equal(lead.status,'booked');assert.equal(lead.language,'uk');assert.equal(lead.slot_id,id);
const denied=await fetch(origin+'/api/state');assert.equal(denied.status,401);
console.log(JSON.stringify({checked_at:new Date().toISOString(),origin,health,checks:{ukrainian_intake:true,interest_before_assignment:true,manual_assignment:true,crm_saved:true,booking_saved:true,admin_auth_required:true},transcript},null,2));
