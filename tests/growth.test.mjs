import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {discover,draft,permit,queuePost,publishDue,track,registerChannel} from '../src/growth.mjs';
function fixture(){const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0001.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0003_growth.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0004_publication_tracking.sql',import.meta.url),'utf8'));const env={TELEGRAM_BOT_TOKEN:'test',DB:{prepare(sql){return{bind(...args){return{async first(){return db.prepare(sql).get(...args)||null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){return db.prepare(sql).run(...args)}}}}}}};return{db,env};}
function seed(db){db.prepare('INSERT INTO growth_channels(id,url,title,source_url) VALUES(?,?,?,?)').run('test_group','https://t.me/test_group','Tallinn family','https://t.me/test_group');}
test('Discovery uses public pages, preserves permission isolation, and throttles repeated runs',async()=>{
 const {db,env}=fixture(),old=fetch;globalThis.fetch=async url=>new Response(String(url).includes('chatcrawler')?'<a href="https://t.me/test_group">test</a>':'<meta property="og:title" content="Tallinn family"><meta property="og:description" content="Дети и спорт"><div class="tgme_page_extra">100 members</div>');
 try{const r=await discover(env);assert.equal(r.matched,9);const rows=db.prepare('SELECT * FROM growth_channels').all();assert.ok(rows.every(c=>c.enabled===0&&c.permission_note===null));assert.ok((await discover(env)).skipped);}finally{globalThis.fetch=old;}
});
test('Publication requires explicit permission AND Telegram rights; queue sends only once',async()=>{
 const {db,env}=fixture();seed(db);const p=await draft(env,{channelId:'test_group'});assert.equal((await draft(env,{channelId:'test_group'})).id,p.id);assert.match(p.text,/Первые 2/);
 await assert.rejects(queuePost(env,{postId:p.id,text:p.text,scheduledAt:new Date().toISOString()}),/publication_permission_required/);
 const old=fetch;let sends=0,rights=false;globalThis.fetch=async(url)=>{const method=String(url).split('/').pop();return Response.json({ok:true,result:method==='getMe'?{id:1}:method==='getChat'?{id:-1001,type:'channel'}:method==='getChatMember'?{status:'administrator',can_post_messages:rights}:{message_id:++sends}})};
 try{
 await assert.rejects(permit(env,{channelId:'test_group',note:'Администратор разрешил один пост'}),/bot_cannot_publish/);rights=true;await permit(env,{channelId:'test_group',note:'Администратор разрешил один пост'});
 await queuePost(env,{postId:p.id,text:p.text,scheduledAt:new Date().toISOString()});await Promise.all([publishDue(env),publishDue(env)]);assert.equal(sends,1);assert.equal(db.prepare('SELECT status FROM growth_posts').get().status,'sent');
 }finally{globalThis.fetch=old;}
});
test('Revoked permission blocks queued post and lost send response is never automatically retried',async()=>{
 const {db,env}=fixture();seed(db);let p=await draft(env,{channelId:'test_group'});db.prepare("UPDATE growth_channels SET enabled=1,permission_note='Approved once',chat_id='-1001'").run();db.prepare("UPDATE growth_posts SET status='queued',scheduled_at='2020-01-01'").run();db.prepare('UPDATE growth_channels SET enabled=0').run();await publishDue(env);assert.equal(db.prepare('SELECT status FROM growth_posts').get().status,'blocked');
 db.prepare('UPDATE growth_channels SET enabled=1').run();db.prepare("UPDATE growth_posts SET status='queued'").run();let sends=0;const old=fetch;globalThis.fetch=async url=>{const m=String(url).split('/').pop();if(m==='sendMessage'){sends++;throw Error('timeout');}return Response.json({ok:true,result:m==='getMe'?{id:1}:m==='getChat'?{id:-1001,type:'channel'}:{status:'administrator',can_post_messages:true}})};
 try{await publishDue(env);await publishDue(env);assert.equal(sends,1);assert.equal(db.prepare('SELECT status FROM growth_posts').get().status,'uncertain');}finally{globalThis.fetch=old;}
});

test('CRM distinguishes permission, moderation, publication and keeps evidence history',async()=>{
 const {db,env}=fixture();const {id}=await registerChannel(env,{url:'https://www.facebook.com/groups/tallinn_test',title:'Tallinn test',evidence:'Test fixture, not a real discovered group'});
 await track(env,{channelId:id,status:'awaiting_permission',evidence:'Test request awaiting admin reply'});const post=await draft(env,{channelId:id});
 await track(env,{channelId:id,postId:post.id,status:'awaiting_moderation',evidence:'Test UI says pending approval'});
 assert.equal(db.prepare('SELECT status FROM growth_posts').get().status,'awaiting_moderation');assert.equal(db.prepare('SELECT access_status FROM growth_channels').get().access_status,'awaiting_permission');
 await assert.rejects(track(env,{channelId:id,postId:post.id,status:'sent',evidence:'Test approved',publishedUrl:'https://evil.example/'}),/publication_link_required/);
 await track(env,{channelId:id,postId:post.id,status:'sent',evidence:'Test approval confirmed',publishedUrl:'https://www.facebook.com/groups/tallinn_test/posts/123'});assert.equal(db.prepare('SELECT COUNT(*) n FROM growth_history').get().n,3);
 await assert.rejects(permit(env,{channelId:id,note:'Test permission granted'}),/official_publishing_unavailable/);
});
