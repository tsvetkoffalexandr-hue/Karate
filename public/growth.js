const growthErrors={publication_permission_required:'Сначала подтвердите разрешение площадки и добавьте бота с правом публикации.',telegram_access_failed:'Telegram не подтвердил доступ. Добавьте бота в эту группу или канал с правом публикации.',bot_cannot_publish:'У бота нет права писать на этой площадке.',permission_note_required:'Укажите, кем и на каких условиях разрешена реклама.',draft_required:'Этот черновик уже изменился. Обновите страницу.'};
const postLabels={draft:'Черновик',queued:'В очереди',checking:'Проверка доступа',sending:'Отправляется',sent:'Опубликовано',uncertain:'Результат отправки неизвестен — проверьте площадку',blocked:'Публикация заблокирована',awaiting_moderation:'Пост отправлен · ждёт одобрения администратора',rejected:'Пост отклонён',removed:'Пост удалён'};
const accessLabels={needs_review:'Нужно проверить правила',awaiting_permission:'Ждём разрешения на рекламу',awaiting_membership:'Ждём одобрения вступления',prohibited:'Реклама запрещена',paid_only:'Только платное размещение',allowed:'Разрешение подтверждено'};
function trackingForm(channelId,post){
 const d=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Записать подтверждённый статус';const help=document.createElement('p');help.textContent='Для действий через браузер: укажите наблюдаемый результат и источник. Это запись в CRM, а не отправка объявления.';
 const select=document.createElement('select');select.setAttribute('aria-label','Подтверждённый статус');const choices=post?{awaiting_moderation:postLabels.awaiting_moderation,sent:postLabels.sent,rejected:postLabels.rejected,removed:postLabels.removed}:Object.fromEntries(Object.entries(accessLabels).filter(([k])=>k!=='allowed'));
 for(const [value,label]of Object.entries(choices)){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
 const evidence=document.createElement('input');evidence.placeholder='Что подтверждает статус: текст, дата, ссылка';evidence.setAttribute('aria-label','Подтверждение статуса');evidence.maxLength=1500;d.append(summary,help,select,evidence);
 const url=document.createElement('input');if(post){url.placeholder='Ссылка на опубликованный пост';url.type='url';d.append(url);}
 d.append(growthButton('Сохранить факт в CRM',()=>api('growth/track',{channelId,postId:post?.id,status:select.value,evidence:evidence.value,publishedUrl:url.value})));return d;
}
function growthButton(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await fn();await refreshGrowth();}catch(e){$('growthError').textContent=growthErrors[e.message]||e.message;}finally{b.disabled=false;}};return b;}
async function refreshGrowth(){
 if(!token)return;
 try{
 const state=await api('growth');$('channels').replaceChildren();$('posts').replaceChildren();
 $('discoveryStatus').textContent=state.runs.find(r=>r.agent==='discovery')?.finished_at?'Найдено площадок: '+state.channels.length:'Первый поиск ещё не завершён';
 $('contentStatus').textContent='Подготовлено черновиков: '+state.posts.filter(p=>p.status==='draft').length;
 $('publishingStatus').textContent=state.channels.some(c=>c.enabled)?'Разрешённых площадок: '+state.channels.filter(c=>c.enabled).length:'Ожидает разрешённую площадку';
 for(const c of state.channels){
  const a=document.createElement('article'),title=document.createElement('h3'),link=document.createElement('a');link.href=c.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=c.title;title.append(link);
  const desc=document.createElement('p');desc.textContent=c.description;
  const status=document.createElement('p');status.textContent=(c.platform==='facebook'?'Facebook':'Telegram')+' · '+(accessLabels[c.access_status]||'Нужно проверить правила')+(c.access_evidence?' · '+c.access_evidence:'');
  a.append(title,desc,status,growthButton('Подготовить RU',()=>api('growth/draft',{channelId:c.id,language:'ru'})),growthButton('Подготовить UK',()=>api('growth/draft',{channelId:c.id,language:'uk'})));
  if(!c.enabled&&c.platform==='telegram'){const d=document.createElement('details'),s=document.createElement('summary');s.textContent='Подключить разрешённую площадку';const help=document.createElement('p');help.textContent='Бот @BudoTallinnGrowthBot должен быть добавлен с правом публикации. Укажите, кто разрешил рекламу, ограничения и частоту. Подключение само по себе ничего не публикует.';const input=document.createElement('input');input.placeholder='Разрешение администратора и условия';input.maxLength=1000;input.setAttribute('aria-label','Разрешение: '+c.title);d.append(s,help,input,growthButton('Подтвердить разрешение и проверить доступ',()=>api('growth/permit',{channelId:c.id,note:input.value})));a.append(d);}else if(c.enabled) a.append(growthButton('Остановить публикации здесь',()=>api('growth/disable',{channelId:c.id})));
  if(c.platform==='facebook'){const note=document.createElement('p');note.textContent='Автопубликация в Facebook-группы через официальный API недоступна. Статусы браузерных действий записываются отдельно.';a.append(note);}
  a.append(trackingForm(c.id));$('channels').append(a);
 }
 for(const p of state.posts){const a=document.createElement('article'),h=document.createElement('h3');h.textContent=(state.channels.find(c=>c.id===p.channel_id)?.title||p.channel_id)+' · '+p.language.toUpperCase();const status=document.createElement('p');status.textContent=postLabels[p.status]||p.status;a.append(h,status);
  if(p.status==='draft'){
   const text=document.createElement('textarea');text.value=p.text;text.maxLength=3500;text.setAttribute('aria-label','Текст объявления');const date=document.createElement('input');date.type='datetime-local';date.setAttribute('aria-label','Когда разместить (время компьютера)');
   const help=document.createElement('p');help.textContent='Проверьте текст и условия площадки. Без даты — разместить при ближайшем запуске (до 5 минут).';
   const publish=growthButton('Одобрить этот текст и поставить в очередь',()=>api('growth/queue',{postId:p.id,text:text.value,scheduledAt:date.value?new Date(date.value).toISOString():new Date().toISOString()}));publish.disabled=!state.channels.find(c=>c.id===p.channel_id)?.enabled;
   a.append(text,help,date,publish);
  }else{const text=document.createElement('p');text.className='post-copy';text.textContent=p.text;a.append(text);}
  if(p.published_url){const link=document.createElement('a');link.href=p.published_url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Открыть опубликованный пост';a.append(link);}
  const facts=document.createElement('p');facts.textContent=[p.scheduled_at?'План: '+new Date(p.scheduled_at).toLocaleString('ru-RU',{timeZone:'Europe/Tallinn'}):'',p.updated_at?'Обновлено: '+new Date(p.updated_at).toLocaleString('ru-RU',{timeZone:'Europe/Tallinn'}):'',p.status_evidence||'',p.error?growthErrors[p.error]||p.error:''].filter(Boolean).join(' · ');a.append(facts);
  if(!['queued','checking','sending','uncertain'].includes(p.status))a.append(trackingForm(p.channel_id,p));$('posts').append(a);
 }
 if(!state.channels.length)$('channels').textContent='Поиск ещё не дал проверенных кандидатов. Запустите поиск.';
 if(!state.posts.length)$('posts').textContent='Черновики появятся после поиска площадок.';
 }catch(e){$('growthError').textContent=growthErrors[e.message]||e.message;}
}
$('discover').onclick=async()=>{$('discover').disabled=true;$('growthError').textContent='Проверяю открытые страницы площадок…';try{const r=await api('growth/discover',{});$('growthError').textContent=r.skipped?'Поиск уже запускался в последнюю минуту.':`Проверено страниц: ${r.checked}. Подходящих: ${r.matched}.`;await refreshGrowth();}catch(e){$('growthError').textContent=e.message;}finally{$('discover').disabled=false;}};
$('growthRefresh').onclick=refreshGrowth;
// Do not replace edited drafts on the periodic CRM refresh.
$('login').addEventListener('submit',()=>{setTimeout(refreshGrowth,500);});
refreshGrowth();
