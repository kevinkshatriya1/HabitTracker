import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { notifyFriends } from "../../../lib/push";
import { seedGoals } from "../../../lib/goals";

export const dynamic = "force-dynamic";
const palette = ["#5B5FC7","#CB5B73","#C27A24","#267F9D","#8159A8","#B45A49","#287B75","#8C6480"];
const allowed = new Set(["wake","bed","makebed","workout","prep","drinks"]);
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
      const weekdayWake=data.weekdayWake, weekendWake=data.weekendWake, weekdayBed=data.weekdayBed, reminderTime=data.reminderTime;
      if (![weekdayWake,weekendWake,weekdayBed,reminderTime].every(validTime)) return Response.json({error:"Enter valid times."},{status:400});
      const name=String(data.name || "").trim().slice(0,50);
      if (!name) return Response.json({error:"Enter your name."},{status:400});
      await db.prepare("UPDATE people SET name=?,weekday_wake=?,weekend_wake=?,weekday_bed=?,reminder_time=?,reminders=? WHERE id=?").bind(name,weekdayWake,weekendWake,weekdayBed,reminderTime,data.reminders?1:0,user.userId).run();
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
      const id=crypto.randomUUID();
      const normalized=title.toLowerCase().replace(/\s+/g," ").trim()+"|"+cadence;
      const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(normalized));
      const kind="custom:"+Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,24);
      const existingGoal=await db.prepare("SELECT id FROM group_goals WHERE circle_id=? AND kind=?").bind(circleId,kind).first();
      if(existingGoal)return Response.json({error:"This group already has that goal. Turn it on above if it's paused."},{status:409});
      await db.prepare("INSERT INTO group_goals (id,circle_id,kind,slot,title,cadence,target,active,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(id,circleId,kind,0,title,cadence,null,1,Date.now()).run();
      await db.prepare("INSERT INTO goal_choices (goal_id,person_id,enabled) SELECT ?,person_id,CASE WHEN person_id=? THEN 1 ELSE 0 END FROM members WHERE circle_id=?").bind(id,user.userId,circleId).run();
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
