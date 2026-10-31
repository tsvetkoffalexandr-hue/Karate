const q=(e,s,...a)=>e.DB.prepare(s).bind(...a);
export async function reportAgent(env,b){
 if(!['running','waiting','blocked','error'].includes(b.status)||typeof b.action!=='string'||b.action.length<3||b.action.length>500||typeof b.runId!=='string'||b.runId.length>100)throw Error('invalid_report');
 if(b.blocker!=null&&(typeof b.blocker!=='string'||b.blocker.length>1000))throw Error('invalid_blocker');
 const now=new Date().toISOString();
 await q(env,"UPDATE agent_monitor SET status=?,action=?,blocker=?,run_id=?,last_seen=?,last_started=CASE WHEN ?='running' AND (run_id IS NULL OR run_id!=?) THEN ? ELSE last_started END,last_finished=CASE WHEN ?!='running' THEN ? ELSE last_finished END WHERE id='promotion'",b.status,b.action,b.blocker||null,b.runId,now,b.status,b.runId,now,b.status,now).run();
 return {ok:true};
}
export async function monitorState(env,at=Date.now()){
 const row=await q(env,"SELECT * FROM agent_monitor WHERE id='promotion'").first();
 const counts=await q(env,"SELECT COUNT(*) AS groups FROM growth_channels WHERE access_status!='not_a_community'").first();
 const posts=await q(env,"SELECT SUM(p.status='sent') AS published,SUM(p.status='awaiting_moderation') AS moderation,SUM(p.status='draft') AS drafts,SUM(p.status='rejected') AS rejected FROM growth_posts p JOIN growth_channels c ON c.id=p.channel_id WHERE c.access_status!='not_a_community'").first();
 const permissions=await q(env,"SELECT COUNT(*) AS permissions FROM growth_channels WHERE access_status IN ('awaiting_permission','awaiting_membership')").first();
 if(!row)return {status:'not_started',counts:{...counts,...posts,...permissions}};
 let status=row.status;
 if(Date.parse(row.ends_at)<=at)status='expired';
 else if(!row.schedule_enabled)status='paused';
 else if(row.last_seen&&at-Date.parse(row.last_seen)>15*60000)status='stale';
 const expected=row.last_seen?new Date(Date.parse(row.last_seen)+row.interval_minutes*60000).toISOString():null;
 return {...row,status,reported_status:row.status,next_expected:expected&&Date.parse(expected)<=Date.parse(row.ends_at)?expected:null,counts:{...counts,...posts,...permissions},server_time:new Date(at).toISOString()};
}
