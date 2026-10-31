const q=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const DIRECTORY='https://chatcrawler.link/ru/c/place/ee/t/local';
const SEEDS=['let_s_family','tallinn_chat1','lasnachat','tallin_chatik','tallin_estoniya','tallin4','EstoniaTallinUkraine','estonia_ukraine'];
const now=()=>new Date().toISOString();
const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
export function metadata(html){
 const get=name=>decode(html.match(new RegExp('property="og:'+name+'" content="([^"]*)"'))?.[1]||'');
 return {title:get('title').slice(0,200),description:get('description').slice(0,1500)};
}
async function log(env,agent,action,outcome){await q(env,'INSERT INTO events(agent,action,outcome) VALUES(?,?,?)',agent,action,outcome).run();}
async function finish(env,agent,status,detail){await q(env,'UPDATE growth_runs SET finished_at=?,status=?,detail=? WHERE agent=?',now(),status,detail,agent).run();}
async function lock(env,agent,interval){
 return q(env,"INSERT INTO growth_runs(agent,started_at,status) VALUES(?,?,'running') ON CONFLICT(agent) DO UPDATE SET started_at=excluded.started_at,status='running' WHERE started_at<? RETURNING agent",agent,now(),new Date(Date.now()-interval).toISOString()).first();
}
export async function discover(env,{manual=false}={}){
 if(!await lock(env,'discovery',manual?60000:86400000))return {skipped:true};
 let directory='',directoryOk=false,checked=0,matched=0;
 try{
  const r=await fetch(DIRECTORY,{signal:AbortSignal.timeout(15000)});
  if(r.ok){directory=(await r.text()).slice(0,500000);directoryOk=true;}
 }catch{}
 // Public pages only. Neither joining chats nor contacting their members.
 const known=(await q(env,"SELECT id FROM growth_channels WHERE platform='telegram' ORDER BY checked_at LIMIT 20").all()).results.map(c=>c.id);
 const handles=[...new Set([...SEEDS,...known,...[...directory.matchAll(/(?:https?:\/\/)?t\.me\/([a-zA-Z][a-zA-Z0-9_]{4,31})/g)].map(m=>m[1])])];
 for(let index=0;index<handles.length&&index<20;index++){
  const id=handles[index];
  try{
   const r=await fetch('https://t.me/'+id,{signal:AbortSignal.timeout(10000)});if(!r.ok)continue;
   const html=(await r.text()).slice(0,150000),m=metadata(html);checked++;
   const extra=html.match(/class="tgme_page_extra"[^>]*>([\s\S]*?)<\/div>/)?.[1]||'';
   if(!m.title||!/(?:members|subscribers)/i.test(extra)){
    await q(env,"UPDATE growth_channels SET access_status='not_a_community',enabled=0 WHERE id=?",id).run();continue;
   }
   const content=m.title+' '+m.description;
   for(const match of content.matchAll(/(?:t\.me\/|@)([a-zA-Z][a-zA-Z0-9_]{4,31})/g)){if(!handles.includes(match[1])&&handles.length<40)handles.push(match[1]);}
   const local=/таллин|tallin|estonia|эстони|lasnam|ласна|kesklinn/i.test(content);
   if(!local)continue;
   const score=40+(/дет|семейн|family|мам|lapsed|kids|батьк/i.test(content)?50:0)+(/спорт|круж|sport/i.test(content)?10:0);
   await q(env,'INSERT INTO growth_channels(id,url,title,description,source_url,score,checked_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,score=excluded.score,checked_at=excluded.checked_at',id,'https://t.me/'+id,m.title,m.description,SEEDS.includes(id)?'https://t.me/'+id:DIRECTORY,score,now()).run();matched++;
  }catch{}
 }
 const detail=JSON.stringify({checked,matched,directoryOk});
 await finish(env,'discovery',matched?'done':'error',detail);await log(env,'discovery','search',matched?'ok':'error');
 return {checked,matched,directoryOk};
}
export function advertisement(language='ru'){
 return language==='uk'?
 '🥋 Карате для дітей від 3 років у Таллінні\n\nKarate klub Budo запрошує початківців і дітей із досвідом. На заняттях працюємо над технікою, координацією та дисципліною.\n\n🎁 Перші 2 тренування — безкоштовні!\n📍 Keldrimäe tn 9, Tallinn\n\nХочете спробувати? Залиште заявку в боті — тренер Олександр зв’яжеться з вами та узгодить час.\nhttps://t.me/BudoTallinnGrowthBot':
 '🥋 Карате для детей от 3 лет в Таллине\n\nKarate klub Budo приглашает новичков и ребят с опытом. На занятиях работаем над техникой, координацией и дисциплиной.\n\n🎁 Первые 2 тренировки — бесплатно!\n📍 Keldrimäe tn 9, Tallinn\n\nХотите попробовать? Оставьте заявку в боте — тренер Александр свяжется с вами и согласует время.\nhttps://t.me/BudoTallinnGrowthBot';
}
export async function draft(env,{channelId,language='ru'}){
 if(!['ru','uk'].includes(language))throw Error('invalid_language');
 if(!await q(env,'SELECT id FROM growth_channels WHERE id=?',channelId).first())throw Error('channel_not_found');
 const existing=await q(env,"SELECT * FROM growth_posts WHERE channel_id=? AND language=? AND status='draft' LIMIT 1",channelId,language).first();if(existing)return existing;
 const id=crypto.randomUUID(),text=advertisement(language);
 await q(env,'INSERT INTO growth_posts(id,channel_id,language,text) VALUES(?,?,?,?)',id,channelId,language,text).run();
 await log(env,'content','draft','ok');return {id,channel_id:channelId,language,text,status:'draft'};
}
async function telegram(env,method,body){
 if(!env.TELEGRAM_BOT_TOKEN)throw Error('telegram_not_connected');
 const r=await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 const data=await r.json();if(!r.ok||!data.ok)throw Error('telegram_access_failed');return data.result;
}
export async function checkAccess(env,chatId){
 const me=await telegram(env,'getMe',{}),chat=await telegram(env,'getChat',{chat_id:chatId});
 if(!['channel','supergroup','group'].includes(chat.type))throw Error('group_or_channel_required');
 const member=await telegram(env,'getChatMember',{chat_id:chat.id,user_id:me.id});
 const admin=['creator','administrator'].includes(member.status);
 const allowed=chat.type==='channel'?(member.status==='creator'||(admin&&member.can_post_messages===true)):
  admin||(member.status==='member'&&chat.permissions?.can_send_messages===true)||(member.status==='restricted'&&member.is_member&&member.can_send_messages===true);
 if(!allowed)throw Error('bot_cannot_publish');
 return chat;
}
export async function permit(env,{channelId,note}){
 if(typeof note!=='string'||note.trim().length<10||note.length>1000)throw Error('permission_note_required');
 const c=await q(env,'SELECT * FROM growth_channels WHERE id=?',channelId).first();if(!c)throw Error('channel_not_found');
 if(c.platform!=='telegram')throw Error('official_publishing_unavailable');
 const chat=await checkAccess(env,'@'+c.id);
 // Permission is a separate, explicit owner attestation; membership alone never grants it.
 await q(env,"UPDATE growth_channels SET permission_note=?,chat_id=?,enabled=1,access_status='allowed',access_evidence=? WHERE id=?",note.trim(),String(chat.id),note.trim(),c.id).run();
 await history(env,c.id,null,'allowed',note.trim());
 await log(env,'publishing','permission','ok');return {ok:true};
}
export async function queuePost(env,{postId,text,scheduledAt}){
 const post=await q(env,'SELECT p.*,c.enabled,c.permission_note,c.chat_id,c.platform FROM growth_posts p JOIN growth_channels c ON c.id=p.channel_id WHERE p.id=?',postId).first();
 if(!post||post.status!=='draft')throw Error('draft_required');
 if(post.platform!=='telegram')throw Error('official_publishing_unavailable');
 if(!post.enabled||!post.permission_note||!post.chat_id)throw Error('publication_permission_required');
 if(typeof text!=='string'||text.length<30||text.length>3500)throw Error('invalid_text');
 if(!Number.isFinite(Date.parse(scheduledAt)))throw Error('invalid_date');
 await checkAccess(env,post.chat_id);
 const row=await q(env,"UPDATE growth_posts SET text=?,scheduled_at=?,status='queued' WHERE id=? AND status='draft' RETURNING id",text,new Date(Math.max(Date.now(),Date.parse(scheduledAt))).toISOString(),post.id).first();
 if(!row)throw Error('draft_required');await history(env,post.channel_id,post.id,'queued','Текст одобрен, время: '+scheduledAt);await log(env,'publishing','queued','ok');return {ok:true};
}
export async function publishDue(env){
 const posts=(await q(env,"SELECT p.*,c.enabled,c.permission_note,c.chat_id,c.platform,c.url FROM growth_posts p JOIN growth_channels c ON c.id=p.channel_id WHERE p.status='queued' AND p.scheduled_at<=? ORDER BY p.scheduled_at LIMIT 3",now()).all()).results;
 for(const p of posts){
  if(!await q(env,"UPDATE growth_posts SET status='checking' WHERE id=? AND status='queued' RETURNING id",p.id).first())continue;
  try{
   if(p.platform!=='telegram'||!p.enabled||!p.permission_note||!p.chat_id)throw Error('publication_permission_required');
   await checkAccess(env,p.chat_id);
   await q(env,"UPDATE growth_posts SET status='sending' WHERE id=?",p.id).run();
   const sent=await telegram(env,'sendMessage',{chat_id:p.chat_id,text:p.text,link_preview_options:{is_disabled:true}});
   const publishedUrl=p.url+'/'+sent.message_id;
   await q(env,"UPDATE growth_posts SET status='sent',sent_at=?,updated_at=?,message_id=?,published_url=?,status_evidence='Telegram API: sendMessage ok',error=NULL WHERE id=?",now(),now(),sent.message_id,publishedUrl,p.id).run();
   await history(env,p.channel_id,p.id,'sent',publishedUrl);
   await log(env,'publishing','published','ok');
  }catch(e){
   const stage=await q(env,'SELECT status FROM growth_posts WHERE id=?',p.id).first();
   // A lost response after sending must never lead to automatic duplicate advertisements.
   const status=stage?.status==='sending'?'uncertain':'blocked';await q(env,'UPDATE growth_posts SET status=?,error=?,updated_at=? WHERE id=?',status,e.message,now(),p.id).run();await history(env,p.channel_id,p.id,status,e.message);await log(env,'publishing','published','error');
  }
 }
 return {processed:posts.length};
}
export async function growthState(env){
 return {channels:(await q(env,"SELECT * FROM growth_channels WHERE access_status!='not_a_community' ORDER BY score DESC,title LIMIT 100").all()).results,posts:(await q(env,"SELECT p.* FROM growth_posts p JOIN growth_channels c ON c.id=p.channel_id WHERE c.access_status!='not_a_community' ORDER BY p.created_at DESC LIMIT 100").all()).results,runs:(await q(env,'SELECT * FROM growth_runs').all()).results,history:(await q(env,'SELECT * FROM growth_history ORDER BY id DESC LIMIT 100').all()).results};
}
async function history(env,channelId,postId,status,evidence){await q(env,'INSERT INTO growth_history(channel_id,post_id,status,evidence) VALUES(?,?,?,?)',channelId,postId,status,evidence).run();}
export async function registerChannel(env,{url,title,evidence}){
 const u=new URL(url);if(u.protocol!=='https:'||typeof title!=='string'||title.length<3||title.length>200||typeof evidence!=='string'||evidence.length<5||evidence.length>1500)throw Error('invalid_channel');
 const fb=['www.facebook.com','facebook.com','m.facebook.com'].includes(u.hostname)&&/^\/groups\/[a-zA-Z0-9._-]+\/?$/.test(u.pathname);
 const tg=u.hostname==='t.me'&&/^\/[a-zA-Z][a-zA-Z0-9_]{4,31}\/?$/.test(u.pathname);
 if(!fb&&!tg)throw Error('invalid_channel_url');
 const handle=u.pathname.split('/').filter(Boolean).pop(),id=fb?'fb_'+handle:handle;
 const canonical=fb?'https://www.facebook.com/groups/'+handle:'https://t.me/'+handle;
 await q(env,"INSERT INTO growth_channels(id,url,title,description,source_url,platform,checked_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,checked_at=excluded.checked_at",id,canonical,title,evidence,canonical,fb?'facebook':'telegram',now()).run();return {id};
}
export async function track(env,{channelId,postId,status,evidence,publishedUrl}){
 if(typeof evidence!=='string'||evidence.trim().length<5||evidence.length>1500)throw Error('evidence_required');
 const c=await q(env,'SELECT * FROM growth_channels WHERE id=?',channelId).first();if(!c)throw Error('channel_not_found');
 if(postId){
  if(!['awaiting_moderation','sent','rejected','removed'].includes(status))throw Error('invalid_status');
  const p=await q(env,'SELECT * FROM growth_posts WHERE id=? AND channel_id=?',postId,channelId).first();if(!p)throw Error('post_not_found');
  if(['queued','checking','sending','uncertain'].includes(p.status))throw Error('delivery_in_progress');
  if(status==='sent'){
   const u=new URL(publishedUrl);if(u.protocol!=='https:'||!['t.me','www.facebook.com','facebook.com','m.facebook.com'].includes(u.hostname))throw Error('publication_link_required');
  }
  await q(env,'UPDATE growth_posts SET status=?,status_evidence=?,published_url=?,updated_at=? WHERE id=?',status,evidence.trim(),status==='sent'?publishedUrl:p.published_url,now(),p.id).run();
 }else{
  if(!['needs_review','awaiting_permission','awaiting_membership','prohibited','paid_only'].includes(status))throw Error('invalid_status');
  await q(env,'UPDATE growth_channels SET access_status=?,access_evidence=?,enabled=0 WHERE id=?',status,evidence.trim(),c.id).run();
 }
 await history(env,channelId,postId||null,status,evidence.trim());return {ok:true};
}
export async function tickGrowth(env){
 await publishDue(env);
 await discover(env);
 // Each discovered venue receives one editable Russian draft; never enqueue automatically.
 const channels=(await q(env,"SELECT c.id FROM growth_channels c WHERE c.access_status!='not_a_community' AND NOT EXISTS(SELECT 1 FROM growth_posts p WHERE p.channel_id=c.id) ORDER BY score DESC LIMIT 5").all()).results;
 for(const c of channels)await draft(env,{channelId:c.id});
}
