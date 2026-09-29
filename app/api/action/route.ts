import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { notifyFriends } from "../../../lib/push";
import { seedGoals, inferGoalMinutes, cadenceOrder } from "../../../lib/goals";

export const dynamic = "force-dynamic";
const palette = ["#714B8E","#A63F65","#2B776C","#9A702F","#5B7A3B","#9B517B","#7E584A","#4C6B61"];
const allowed = new Set(["wake","bed","makebed","workout","prep","drinks"]);
const validWeeklyDay=(x:unknown)=>Number.isInteger(Number(x))&&Number(x)>=0&&Number(x)<=6;
const allowedIcons=new Set(["sunrise","moon","bed","clock","dumbbell","footprints","bike","waves","heart","target","flame","coffee","utensils","apple","book","brain","music","pencil","droplets","check"]);
const validIcon=(x:unknown)=>x==null||x===""||allowedIcons.has(String(x));
const validDate = (x:unknown):x is string => typeof x==="string" && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x+"T12:00:00Z"));
const validTime = (x:unknown):x is string => typeof x==="string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(x);

export async function POST(request:Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({error:"Sign in to continue."},{status:401});
  try {
    const data = await request.json() as Record<string,unknown>;
    const db=env.DB;
    if (!db) throw new Error("Database unavailable");
    if (data.action==="settings") {
      const weekdayWake=data.weekdayWake, weekendWake=data.weekendWake, weekdayBed=data.weekdayBed, weekendBed=data.weekendBed, reminderTime=data.reminderTime;
      if (![weekdayWake,weekendWake,weekdayBed,weekendBed].every(x=>x===""||validTime(x))||!validTime(reminderTime)) return Response.json({error:"Enter valid times."},{status:400});
      const name=String(data.name || "").trim().slice(0,50);
      if (!name) return Response.json({error:"Enter your name."},{status:400});
      const phoneNumber=String(data.phoneNumber||"").trim();
      if(phoneNumber.length>30||phoneNumber&&!/^[+\d() .-]+$/.test(phoneNumber))return Response.json({error:"Enter a valid phone number."},{status:400});
      await db.prepare("UPDATE people SET name=?,weekday_wake=?,weekend_wake=?,weekday_bed=?,weekend_bed=?,reminder_time=?,reminders=?,phone_number=? WHERE id=?").bind(name,weekdayWake,weekendWake,weekdayBed,weekendBed,reminderTime,data.reminders?1:0,phoneNumber,user.userId).run();
      return Response.json({ok:true});
    }
    if (data.action==="group_edit") {
      const name=String(data.name || "").trim().slice(0,50);
      const color=String(data.color || "");
      if (!name || !palette.includes(color)) return Response.json({error:"Enter a group name and choose a color."},{status:400});
      const result=await db.prepare("UPDATE circles SET name=?,color=? WHERE id=? AND owner_id=?").bind(name,color,String(data.circleId||""),user.userId).run();
      if (!result.meta.changes) return Response.json({error:"Only the group creator can edit this group."},{status:403});
      return Response.json({ok:true});
    }
    if (data.action==="group_update") {
      const circleId=String(data.circleId||""),name=String(data.name||"").trim().slice(0,50),color=String(data.color||"");
      if(!name||!palette.includes(color))return Response.json({error:"Enter a group name and choose a color."},{status:400});
      const member=await db.prepare("SELECT circle_id FROM members WHERE circle_id=? AND person_id=?").bind(circleId,user.userId).first();
      if(!member)return Response.json({error:"Join this group to edit it."},{status:403});
      const goals=(await db.prepare("SELECT id FROM group_goals WHERE circle_id=?").bind(circleId).all<{id:string}>()).results;
      const changes=Array.isArray(data.goals)?data.goals as {id?:unknown;active?:unknown;target?:unknown;rank?:unknown}[]:[];
      if(changes.length!==goals.length||new Set(changes.map(g=>g.id)).size!==goals.length||changes.some(g=>!goals.some(x=>x.id===g.id)||!Number.isFinite(Number(g.rank))||Number(g.rank)<0||Number(g.rank)>1439))return Response.json({error:"Refresh the group and try again."},{status:400});
      await db.batch([db.prepare("UPDATE circles SET name=?,color=? WHERE id=?").bind(name,color,circleId),...changes.map(g=>db.prepare("UPDATE group_goals SET active=?,target=CASE WHEN kind='drinks' THEN ? ELSE target END,sort_rank=? WHERE id=? AND circle_id=?").bind(g.active?1:0,g.target==null?null:String(g.target),Number(g.rank),String(g.id),circleId))]);
      return Response.json({ok:true});
    }
    if (data.action==="create_group") {
      const name=String(data.name||"").trim().slice(0,50);
      if(!name)return Response.json({error:"Enter a group name."},{status:400});
      const id=crypto.randomUUID(),code=crypto.randomUUID().slice(0,8).toUpperCase(),now=Date.now();
      const used=(await db.prepare("SELECT c.color FROM circles c JOIN members m ON m.circle_id=c.id WHERE m.person_id=?").bind(user.userId).all<{color:string}>()).results.map(x=>x.color);
      const color=palette.find(x=>!used.includes(x))||palette[used.length%palette.length];
      await db.batch([
        db.prepare("INSERT INTO circles (id,name,invite_code,owner_id,color,created_at) VALUES (?,?,?,?,?,?)").bind(id,name,code,user.userId,color,now),
        db.prepare("INSERT INTO members (circle_id,person_id,joined_at) VALUES (?,?,?)").bind(id,user.userId,now),
      ]);
      await seedGoals(db,id);
      return Response.json({ok:true,groupId:id});
    }
    if (data.action==="delete_group") {
      const circleId=String(data.circleId||"");
      const circle=await db.prepare("SELECT id FROM circles WHERE id=? AND owner_id=?").bind(circleId,user.userId).first();
      if(!circle)return Response.json({error:"Only the group creator can delete this group."},{status:403});
      await db.batch([db.prepare("DELETE FROM personal_goal_edits WHERE goal_id IN (SELECT id FROM group_goals WHERE circle_id=?)").bind(circleId),db.prepare("DELETE FROM goal_choices WHERE goal_id IN (SELECT id FROM group_goals WHERE circle_id=?)").bind(circleId),db.prepare("DELETE FROM group_goals WHERE circle_id=?").bind(circleId),db.prepare("DELETE FROM members WHERE circle_id=?").bind(circleId),db.prepare("DELETE FROM circles WHERE id=? AND owner_id=?").bind(circleId,user.userId)]);
      return Response.json({ok:true});
    }
    if (data.action==="goal_copy") {
      const circleId=String(data.circleId||""),sourceId=String(data.sourceGoalId||"");
      const source=await db.prepare("SELECT g.kind,g.slot,g.title,g.cadence,g.target,g.preferred_minutes AS preferredMinutes,g.weekly_day AS weeklyDay FROM group_goals g JOIN members m ON m.circle_id=g.circle_id WHERE g.id=? AND m.person_id=? AND g.active=1").bind(sourceId,user.userId).first<{kind:string;slot:number;title:string;cadence:string;target:string|null;preferredMinutes:number;weeklyDay:number}>();
      const target=await db.prepare("SELECT id FROM members WHERE circle_id=? AND person_id=?").bind(circleId,user.userId).first();
      if(!source||!target)return Response.json({error:"Choose a goal from one of your groups."},{status:403});
      const existing=await db.prepare("SELECT id FROM group_goals WHERE circle_id=? AND kind=? AND slot=?").bind(circleId,source.kind,source.slot).first();
      if(existing)return Response.json({error:"This goal is already in the group."},{status:409});
      const id=crypto.randomUUID();
      await db.batch([db.prepare("INSERT INTO group_goals (id,circle_id,kind,slot,title,cadence,target,preferred_minutes,weekly_day,active,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(id,circleId,source.kind,source.slot,source.title,source.cadence,source.target,source.preferredMinutes,source.weeklyDay,1,Date.now()),db.prepare("INSERT INTO goal_choices (goal_id,person_id,enabled) SELECT ?,person_id,CASE WHEN person_id=? THEN 1 ELSE 0 END FROM members WHERE circle_id=?").bind(id,user.userId,circleId)]);
      return Response.json({ok:true});
    }
    if(data.action==="personal_goal_add"){
      const title=String(data.title||"").trim().slice(0,70),cadence=String(data.cadence||""),time=String(data.preferredTime||""),day=Number(data.weeklyDay??0),iconKey=String(data.iconKey||"");
      if(!title||!["daily","weekday","weekend","sunday","weekly"].includes(cadence)||time&&!validTime(time)||!validWeeklyDay(day)||!validIcon(iconKey))return Response.json({error:"Enter a goal, schedule, day and icon."},{status:400});
      const id=crypto.randomUUID(),kind="custom:"+id.replace(/-/g,"").slice(0,24),minutes=time?Number(time.slice(0,2))*60+Number(time.slice(3)):inferGoalMinutes(title);
      await db.prepare("INSERT INTO personal_goals (id,person_id,kind,slot,title,cadence,preferred_minutes,weekly_day,active,created_at,icon_key) VALUES (?,?,?,?,?,?,?,?,1,?,?)").bind(id,user.userId,kind,0,title,cadence,minutes,day,Date.now(),iconKey||null).run();
      return Response.json({ok:true});
    }
    if(data.action==="personal_goal_update"){
      const id=String(data.goalId||""),title=String(data.title||"").trim().slice(0,70),cadence=String(data.cadence||""),time=String(data.preferredTime||""),day=Number(data.weeklyDay??0),iconKey=String(data.iconKey||"");
      if(!title||!["daily","weekday","weekend","sunday","weekly"].includes(cadence)||!validTime(time)||!validWeeklyDay(day)||!validIcon(iconKey))return Response.json({error:"Enter a goal, schedule, day and icon."},{status:400});
      const result=await db.prepare("UPDATE personal_goals SET title=?,cadence=?,preferred_minutes=?,weekly_day=?,icon_key=? WHERE id=? AND person_id=?").bind(title,cadence,Number(time.slice(0,2))*60+Number(time.slice(3)),day,iconKey||null,id,user.userId).run();
      if(!result.meta.changes)return Response.json({error:"Personal goal not found."},{status:404});
      return Response.json({ok:true});
    }
    if(data.action==="personal_goal_delete"){
      const result=await db.prepare("UPDATE personal_goals SET active=0 WHERE id=? AND person_id=?").bind(String(data.goalId||""),user.userId).run();
      if(!result.meta.changes)return Response.json({error:"Personal goal not found."},{status:404});
      return Response.json({ok:true});
    }
    if (data.action==="personal_goal_edit") {
      const goalId=String(data.goalId||""),title=String(data.title||"").trim().slice(0,70),cadence=String(data.cadence||""),weeklyDay=Number(data.weeklyDay??0),preferredTime=String(data.preferredTime||""),iconKey=String(data.iconKey||"");
      if(!title||!["daily","weekday","weekend","sunday","weekly"].includes(cadence)||!validWeeklyDay(weeklyDay)||preferredTime&&!validTime(preferredTime)||!validIcon(iconKey))return Response.json({error:"Enter a title, repeat schedule, and icon."},{status:400});
      const goal=await db.prepare("SELECT g.id FROM group_goals g JOIN members m ON m.circle_id=g.circle_id WHERE g.id=? AND m.person_id=?").bind(goalId,user.userId).first();
      if(!goal)return Response.json({error:"Goal unavailable."},{status:403});
      await db.prepare("INSERT INTO personal_goal_edits (goal_id,person_id,title,cadence,weekly_day,preferred_minutes,icon_key) VALUES (?,?,?,?,?,?,?) ON CONFLICT(goal_id,person_id) DO UPDATE SET title=excluded.title,cadence=excluded.cadence,weekly_day=excluded.weekly_day,preferred_minutes=excluded.preferred_minutes,icon_key=excluded.icon_key").bind(goalId,user.userId,title,cadence,weeklyDay,preferredTime?Number(preferredTime.slice(0,2))*60+Number(preferredTime.slice(3)):null,iconKey||null).run();
      return Response.json({ok:true});
    }
    if (data.action==="goal_active") {
      const goalId=String(data.goalId||"");
      const enabled=data.enabled?1:0;
      const result=await db.prepare("UPDATE group_goals SET active=? WHERE id=? AND circle_id IN (SELECT id FROM circles WHERE owner_id=?)").bind(enabled,goalId,user.userId).run();
      if(!result.meta.changes)return Response.json({error:"Only the group creator can edit group goals."},{status:403});
      return Response.json({ok:true});
    }
    if (data.action==="goal_target") {
      const goalId=String(data.goalId||""),target=Number(data.target);
      if(!Number.isInteger(target)||target<1||target>30)return Response.json({error:"Enter a limit from 1 to 30."},{status:400});
      const result=await db.prepare("UPDATE group_goals SET target=? WHERE id=? AND kind='drinks' AND circle_id IN (SELECT id FROM circles WHERE owner_id=?)").bind(String(target),goalId,user.userId).run();
      if(!result.meta.changes)return Response.json({error:"Only the group creator can change the drink limit."},{status:403});
      return Response.json({ok:true});
    }
    if (data.action==="goal_add") {
      const circleId=String(data.circleId||"");
      const circle=await db.prepare("SELECT id FROM circles WHERE id=? AND owner_id=?").bind(circleId,user.userId).first();
      if(!circle)return Response.json({error:"Only the group creator can add goals."},{status:403});
      const title=String(data.title||"").trim().slice(0,70);
      const cadence=String(data.cadence||"");
      if(!title||!["daily","weekday","weekend","sunday","weekly"].includes(cadence))return Response.json({error:"Enter a goal and schedule."},{status:400});
      const requestedTime=String(data.preferredTime||"");
      if(requestedTime && !validTime(requestedTime))return Response.json({error:"Enter a valid typical time."},{status:400});
      const preferredMinutes=requestedTime?Number(requestedTime.slice(0,2))*60+Number(requestedTime.slice(3)):inferGoalMinutes(title);
      const id=crypto.randomUUID();
      const normalized=title.toLowerCase().replace(/\s+/g," ").trim()+"|"+cadence;
      const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(normalized));
      const kind="custom:"+Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,24);
      const existingGoal=await db.prepare("SELECT id FROM group_goals WHERE circle_id=? AND kind=?").bind(circleId,kind).first();
      if(existingGoal)return Response.json({error:"This group already has that goal. Turn it on above if it's paused."},{status:409});
      await db.prepare("INSERT INTO group_goals (id,circle_id,kind,slot,title,cadence,target,preferred_minutes,active,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(id,circleId,kind,0,title,cadence,null,preferredMinutes,1,Date.now()).run();
      await db.prepare("INSERT INTO goal_choices (goal_id,person_id,enabled) SELECT ?,person_id,CASE WHEN person_id=? THEN 1 ELSE 0 END FROM members WHERE circle_id=?").bind(id,user.userId,circleId).run();
      return Response.json({ok:true});
    }
    if (data.action==="goal_reorder") {
      const cadence=String(data.cadence||"");
      const order=Array.isArray(data.order)?data.order as {kind?:unknown;slot?:unknown}[]:[];
      if(!(cadence in cadenceOrder)||order.length<2||order.length>100)return Response.json({error:"Choose goals in the same schedule."},{status:400});
      const available=(await db.prepare("SELECT g.kind,g.slot,MIN(g.preferred_minutes) AS preferredMinutes FROM group_goals g JOIN members m ON m.circle_id=g.circle_id WHERE m.person_id=? AND g.cadence=? AND g.active=1 GROUP BY g.kind,g.slot").bind(user.userId,cadence).all<{kind:string;slot:number;preferredMinutes:number}>()).results;
      const keyed=new Map(available.map(g=>[g.kind+":"+g.slot,g]));
      const keys=order.map(g=>String(g.kind||"")+":"+Number(g.slot));
      if(new Set(keys).size!==keys.length||keys.length!==keyed.size||keys.some(k=>!keyed.has(k)))return Response.json({error:"One of these goals isn't available."},{status:403});
      // Keep custom order on a time-of-day scale so future goals slot in naturally.
      const anchors=available.map(g=>g.preferredMinutes).sort((a,b)=>a-b);
      await db.batch(order.map((g,i)=>db.prepare("INSERT INTO goal_order (person_id,kind,slot,rank) VALUES (?,?,?,?) ON CONFLICT(person_id,kind,slot) DO UPDATE SET rank=excluded.rank").bind(user.userId,String(g.kind),Number(g.slot),anchors[i]+i*0.001)));
      return Response.json({ok:true});
    }
    if (data.action==="privacy") {
      const kind=String(data.kind||""),slot=Number(data.slot),visibility=String(data.visibility||"");
      if(!["private","group","public"].includes(visibility)||!Number.isInteger(slot)||slot<0||slot>1)return Response.json({error:"Choose who can see this habit."},{status:400});
      const goal=await db.prepare("SELECT g.id FROM group_goals g JOIN members m ON m.circle_id=g.circle_id WHERE m.person_id=? AND g.kind=? AND g.slot=? LIMIT 1").bind(user.userId,kind,slot).first();
      if(!goal)return Response.json({error:"Habit not found."},{status:404});
      await db.prepare("INSERT INTO habit_visibility (person_id,kind,slot,visibility) VALUES (?,?,?,?) ON CONFLICT(person_id,kind,slot) DO UPDATE SET visibility=excluded.visibility").bind(user.userId,kind,slot,visibility).run();
      return Response.json({ok:true});
    }
    if (data.action==="goal_choice") {
      const goalId=String(data.goalId||"");
      const goal=await db.prepare("SELECT g.id FROM group_goals g JOIN members m ON m.circle_id=g.circle_id WHERE g.id=? AND m.person_id=? AND g.active=1").bind(goalId,user.userId).first();
      if(!goal)return Response.json({error:"That goal isn't available in your groups."},{status:403});
      await db.prepare("INSERT INTO goal_choices (goal_id,person_id,enabled) VALUES (?,?,?) ON CONFLICT(goal_id,person_id) DO UPDATE SET enabled=excluded.enabled").bind(goalId,user.userId,data.enabled?1:0).run();
      return Response.json({ok:true});
    }
    if (data.action==="join") {
      const code=String(data.code || "").trim().toUpperCase();
      const circle=await db.prepare("SELECT id FROM circles WHERE invite_code=?").bind(code).first<{id:string}>();
      if (!circle) return Response.json({error:"That invite link is invalid."},{status:404});
      await db.prepare("INSERT OR IGNORE INTO members (circle_id,person_id,joined_at) VALUES (?,?,?)").bind(circle.id,user.userId,Date.now()).run();
      // Rejoining an existing group also makes it the active group.
      await db.prepare("UPDATE members SET joined_at=? WHERE circle_id=? AND person_id=?").bind(Date.now(),circle.id,user.userId).run();
      await seedGoals(db,circle.id);
      await db.prepare("INSERT OR IGNORE INTO goal_choices (goal_id,person_id,enabled) SELECT id,?,1 FROM group_goals WHERE circle_id=? AND active=1").bind(user.userId,circle.id).run();
      return Response.json({ok:true});
    }
    if (data.action!=="checkin" || !validDate(data.date) || !(allowed.has(String(data.kind)) || /^custom:[0-9a-f]{24}$/.test(String(data.kind)))) return Response.json({error:"Invalid check-in."},{status:400});
    const kind=String(data.kind), date=data.date;
    const slot=kind==="workout" ? Number(data.slot) : 0;
    if (!Number.isInteger(slot) || slot<0 || slot>1) return Response.json({error:"Invalid workout slot."},{status:400});
    const permitted=await db.prepare("SELECT g.id,g.title FROM group_goals g JOIN members m ON m.circle_id=g.circle_id LEFT JOIN goal_choices choice ON choice.goal_id=g.id AND choice.person_id=? WHERE m.person_id=? AND g.kind=? AND g.slot=? AND g.active=1 AND COALESCE(choice.enabled,1)=1 LIMIT 1").bind(user.userId,user.userId,kind,slot).first<{id:string;title:string}>();
    if(!permitted)return Response.json({error:"Choose this goal in one of your groups before logging it."},{status:403});
    const existing=await db.prepare("SELECT id,photo_key AS photoKey,value FROM checkins WHERE person_id=? AND date=? AND kind=? AND slot=?").bind(user.userId,date,kind,slot).first<{id:string;photoKey:string|null;value:string|null}>();
    if (data.remove) {
      if (existing) {
        await db.prepare("DELETE FROM checkins WHERE id=?").bind(existing.id).run();
        if (existing.photoKey && env.BUCKET) await env.BUCKET.delete(existing.photoKey);
      }
      return Response.json({ok:true});
    }
    if (!validTime(data.loggedTime)) return Response.json({error:"Enter the time you completed this goal."},{status:400});
    let details:string|null=null;
    let value:string|null=null;
    if (kind==="wake" || kind==="bed") {
      if (!validTime(data.value)) return Response.json({error:"Enter the actual time."},{status:400});
      value=data.value;
    } else if (kind==="workout") {
      const type=String(data.workoutType||"");
      const description=String(data.description||"").trim().slice(0,300);
      if(!["Lift","Run","Swim","Bike","Golf","Other"].includes(type)||!description)return Response.json({error:"Choose a workout type and describe what you did."},{status:400});
      const exercises=Array.isArray(data.exercises)?data.exercises.slice(0,20).map((e:unknown)=>{const x=e as Record<string,unknown>;return {name:String(x.name||"").trim().slice(0,70),sets:String(x.sets||"").trim().slice(0,30),weight:String(x.weight||"").trim().slice(0,30)}}).filter((e:{name:string})=>e.name):[];
      value=type;
      details=JSON.stringify({description,exercises,additional:String(data.additional||"").trim().slice(0,500)});
    } else if (kind==="drinks") {
      const count=Number(data.value);
      if (!Number.isInteger(count) || count<0 || count>30) return Response.json({error:"Enter a drink count from 0 to 30."},{status:400});
      value=String(count);
    } else if (kind.startsWith("custom:")) {
      value="Done";
    }
    const now=Date.now(),entryId=existing?.id || crypto.randomUUID();
    await db.prepare("INSERT INTO checkins (id,person_id,date,kind,slot,value,logged_time,details,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(person_id,date,kind,slot) DO UPDATE SET value=excluded.value,logged_time=excluded.logged_time,details=excluded.details,updated_at=excluded.updated_at").bind(entryId,user.userId,date,kind,slot,value,data.loggedTime,details,now,now).run();
    if (!existing || (kind==="drinks" && Number(value)>Number(existing.value||0))) {
      const description=kind==="wake"?"logged their wake-up":kind==="bed"?"logged their bedtime":kind==="makebed"?"made their bed":kind==="workout"?"logged "+value:kind==="prep"?"finished Sunday meal prep":kind==="drinks"?"logged a drink":"completed "+permitted.title;
      await notifyFriends(user.userId,date,description,kind,slot);
    }
    return Response.json({ok:true,id:entryId});
  } catch(error) {
    console.error("action failed",error);
    return Response.json({error:"Could not save your change. Try again."},{status:500});
  }
}
