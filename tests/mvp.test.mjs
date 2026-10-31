import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
import {transition} from '../src/flow.mjs';
function fixture(){
 const db=new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON');db.exec(readFileSync(new URL('../migrations/0001.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0002_interest.sql',import.meta.url),'utf8'));
 const env={DEMO_MODE:'true',ADMIN_TOKEN:'test-admin',WEBHOOK_SECRET:'test-webhook',AI_ENABLED:'false',DB:{
 prepare(sql){return{bind(...args){const s=db.prepare(sql);return{sql,args,async first(){return s.get(...args)||null},async all(){return{results:s.all(...args)}},async run(){return s.run(...args)}}}}},
 async batch(commands){db.exec('BEGIN');try{const r=[];for(const c of commands)r.push(await c.run());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}
 }};
 let update=100;
 const request=async(path,body,auth=true)=>worker.fetch(new Request('http://localhost'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer test-admin'}:{})},body:body?JSON.stringify(body):undefined}),env,{waitUntil(){}});
 const send=async(text,chatId=1)=>{const r=await request('/api/demo',{text,chatId,updateId:++update});assert.equal(r.status,200);return r.json()};
 const qualify=async(chatId=1,language='ru')=>{for(const t of ['/start','/'+language,'/agree','/yes','Test Parent','8','@parent_test','/skip'])await send(t,chatId)};
 return{db,env,request,send,qualify};
}
test('RU and UK: consent, valid parent contact, booking, CRM, deletion',async()=>{
 for(const language of ['ru','uk']){
 const f=fixture();await f.request('/api/slots',{id:'trial',label:'TEST',starts_at:new Date(Date.now()+86400000).toISOString(),capacity:1});
 await f.qualify(1,language);assert.equal(f.db.prepare('SELECT status FROM leads').get().status,'awaiting_assignment');let r=await f.request('/api/assign',{leadId:'demo:1',slotId:'trial'});assert.equal(r.status,200);assert.match((await r.json()).message,/Keldrimäe tn 9/);
 const state=await(await f.request('/api/state')).json();assert.equal(state.stats.booked,1);assert.match((await f.send('/slots')).reply,language==='uk'?/призначено/:/назначено/);assert.equal(state.leads[0].language,language);assert.equal(state.slots.length,0);
 await f.send('/delete');assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM leads').get().n,0);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM bookings').get().n,0);
 assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE payload LIKE '%parent_test%'").get().n,0);
 }
});
test('Booking capacity cannot be exceeded and repeated updates do not create duplicate state',async()=>{
 const f=fixture();await f.request('/api/slots',{id:'last',label:'TEST',starts_at:new Date(Date.now()+86400000).toISOString(),capacity:1});await f.qualify(1);await f.qualify(2);
 const a=await f.request('/api/assign',{leadId:'demo:1',slotId:'last'}),b=await f.request('/api/assign',{leadId:'demo:2',slotId:'last'});assert.deepEqual([a.status,b.status].sort(),[200,409]);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM bookings').get().n,1);
 const body={text:'/slots',chatId:1,updateId:999};await f.request('/api/demo',body);const repeated=await(await f.request('/api/demo',body)).json();assert.equal(repeated.duplicate,true);
 // SQL trigger independently enforces capacity even if an application used an old slot list.
 assert.throws(()=>f.db.prepare('INSERT INTO bookings(lead_id,slot_id) VALUES(?,?)').run('demo:2','last'),/slot_full/);
});
test('Admin and webhook endpoints reject anonymous callers; test gate rejects real visitors',async()=>{
 const f=fixture();assert.equal((await f.request('/api/state',null,false)).status,401);
 assert.equal((await f.request('/telegram',{},false)).status,401);
 const r=await worker.fetch(new Request('http://localhost/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'test-webhook'},body:JSON.stringify({update_id:42,message:{chat:{id:2,type:'private'},text:'/start'}})}),f.env,{waitUntil(){}});
 assert.equal((await r.json()).reason,'test_only');assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM leads').get().n,0);
});
test('No booking without consent or contact; age and contact validation',()=>{
 let l={language:'ru',step:'consent'};assert.equal(transition(l,'/book x',[]).book,undefined);
 l={language:'ru',step:'age',consent_at:'now'};assert.equal(transition(l,'8.5').patch,undefined);assert.equal(transition(l,'2').patch,undefined);assert.equal(transition(l,'8').patch.age,8);
 l.step='contact';assert.equal(transition(l,'abc').patch,undefined);assert.equal(transition(l,'+37255555555').patch.step,'preferences');
});
test('Missing Telegram token preserves outbox; scheduled delivery clears stored payload',async()=>{
 const f=fixture();f.env.DEMO_MODE='false';f.env.TELEGRAM_BOT_TOKEN='test';const tasks=[];
 const r=await worker.fetch(new Request('http://localhost/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'test-webhook'},body:JSON.stringify({update_id:77,message:{chat:{id:3,type:'private'},text:'/start'}})}),{...f.env,TELEGRAM_BOT_TOKEN:undefined},{waitUntil(p){tasks.push(p)}});await Promise.all(tasks);assert.equal(r.status,200);
 assert.equal(f.db.prepare('SELECT sent_at FROM outbox').get().sent_at,null);
 const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({ok:true});try{await worker.scheduled({},f.env);assert.ok(f.db.prepare('SELECT sent_at FROM outbox').get().sent_at);assert.equal(f.db.prepare('SELECT payload FROM outbox').get().payload,'{}');}finally{globalThis.fetch=old;}
});

test('Free trial interest comes before contact and is not an automatic booking',async()=>{
 const f=fixture();await f.send('/agree');await f.send('/no');let l=f.db.prepare('SELECT * FROM leads').get();assert.equal(l.interested,0);assert.equal(l.contact,null);assert.equal(l.status,'not_interested');await f.send('/yes');await f.send('Parent');await f.send('3');await f.send('@parent_test');await f.send('Будни после 17');l=f.db.prepare('SELECT * FROM leads').get();assert.equal(l.interested,1);assert.equal(l.preferred_times,'Будни после 17');assert.equal(l.status,'awaiting_assignment');const r=await f.send('/book any');assert.match(r.reply,/очереди/);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM bookings').get().n,0);
});

test('Welcome buttons capture interest before consent and collect details only after agreement',async()=>{
 const f=fixture();const greeting=await f.send('/start');assert.match(greeting.reply,/Хотите прийти попробовать/);await f.send('🥋 Хочу попробовать');let l=f.db.prepare('SELECT * FROM leads').get();assert.equal(l.interested,1);assert.equal(l.consent_at,null);assert.equal(l.parent,null);await f.send('Согласен, продолжить');l=f.db.prepare('SELECT * FROM leads').get();assert.equal(l.step,'parent');assert.ok(l.consent_at);await f.send('Написать тренеру');assert.equal(f.db.prepare('SELECT step FROM leads').get().step,'parent');
});
test('Public mode admits a different parent and hides synthetic records and test slots from CRM',async()=>{
 const f=fixture();await f.qualify(1);await f.request('/api/slots',{id:'demo-test',label:'TEST slot',starts_at:new Date(Date.now()+86400000).toISOString(),capacity:2});f.env.DEMO_MODE='false';f.env.TEST_CHAT_ID='123';
 const tasks=[];const r=await worker.fetch(new Request('http://localhost/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'test-webhook'},body:JSON.stringify({update_id:9999,message:{chat:{id:555,type:'private'},text:'/start'}})}),f.env,{waitUntil(p){tasks.push(p)}});await Promise.all(tasks);assert.equal(r.status,200);const body=await r.json();assert.ok(body.reply);assert.ok(!body.reply.includes('[TEST]'));let state=await(await f.request('/api/state')).json();assert.equal(state.leads.length,1);assert.equal(state.leads[0].id,'555');assert.equal(state.slots.length,0);assert.equal((await(await f.request('/api/state?include_test=1')).json()).leads.length,2);assert.equal((await f.request('/api/demo',{chatId:1,updateId:99999,text:'/start'})).status,403);
});

test('Coach notification is queued once with the qualified lead and analytics counts it',async()=>{
 const f=fixture();f.env.DEMO_MODE='false';f.env.ADMIN_CHAT_ID='123';let update=7000;
 for(const text of ['/yes','Согласен, продолжить','Parent','3','@parent_test','/skip']){const jobs=[];const r=await worker.fetch(new Request('http://localhost/telegram',{method:'POST',headers:{'X-Telegram-Bot-Api-Secret-Token':'test-webhook'},body:JSON.stringify({update_id:++update,message:{chat:{id:456,type:'private'},text}})}),f.env,{waitUntil(p){jobs.push(p)}});assert.equal(r.status,200);await Promise.all(jobs);}
 const notices=f.db.prepare("SELECT payload FROM outbox WHERE payload LIKE '%_agent%'").all();assert.equal(notices.length,1);const payload=JSON.parse(notices[0].payload);assert.equal(payload.chat_id,123);assert.match(payload.text,/@parent_test/);assert.equal(payload._agent,'notifications');assert.ok(!payload.text.includes('workers.dev'));assert.match(payload.text,/Для тренера/);
 const r=await f.request('/api/agents/run',{agent:'analytics'});assert.equal(r.status,200);assert.equal((await r.json()).stats.waiting,1);assert.ok(f.db.prepare("SELECT * FROM events WHERE agent='analytics'").get());
});
