import fs from 'node:fs';
import assert from 'node:assert/strict';
const token=process.env.ADMIN_TOKEN,origin=process.env.BASE_URL;
if(!token||!origin)throw Error('Set ADMIN_TOKEN and BASE_URL');
let update=Date.now();const answers=[];
async function send(text,chatId){const r=await fetch(origin+'/api/demo',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({text,chatId,updateId:++update})});assert.equal(r.status,200);return r.json();}
for(const lang of ['ru','uk']){
 const chatId=Math.floor(Math.random()*1e9);
 for(const text of ['/start','/'+lang,'/agree','/yes','TEST AI','3','@test_parent','/skip'])await send(text,chatId);
 const question=lang==='uk'?'Скільки безкоштовних тренувань та де клуб?':'Сколько бесплатных тренировок и где клуб?';
 const r=await send(question,chatId);assert.match(r.reply,/2|дв[аіох]/i);assert.match(r.reply,/Keldrimäe/i);answers.push({language:lang,question,answer:r.reply});
}
const state=await(await fetch(origin+'/api/state',{headers:{Authorization:'Bearer '+token}})).json();assert.ok(state.events.filter(e=>e.agent==='faq'&&e.outcome==='ok').length>=2);
const report={checked_at:new Date().toISOString(),origin,model:'@cf/qwen/qwen3-30b-a3b-fp8',answers};fs.writeFileSync('ai-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
