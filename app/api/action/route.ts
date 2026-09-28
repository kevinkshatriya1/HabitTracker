import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { notifyFriends } from "../../../lib/push";

export const dynamic = "force-dynamic";
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
    if (data.action==="rename") {
      const name=String(data.name || "").trim().slice(0,50);
      const circleId=String(data.circleId || "");
      if (!name) return Response.json({error:"Enter a group name."},{status:400});
      const result=await db.prepare("UPDATE circles SET name=? WHERE id=? AND owner_id=?").bind(name,circleId,user.userId).run();
      return Response.json({ok:result.meta.changes>0});
    }
    if (data.action==="join") {
      const code=String(data.code || "").trim().toUpperCase();
      const circle=await db.prepare("SELECT id FROM circles WHERE invite_code=?").bind(code).first<{id:string}>();
      if (!circle) return Response.json({error:"That invite link is invalid."},{status:404});
      await db.prepare("INSERT OR IGNORE INTO members (circle_id,person_id,joined_at) VALUES (?,?,?)").bind(circle.id,user.userId,Date.now()).run();
      // Rejoining an existing group also makes it the active group.
      await db.prepare("UPDATE members SET joined_at=? WHERE circle_id=? AND person_id=?").bind(Date.now(),circle.id,user.userId).run();
      return Response.json({ok:true});
    }
    if (data.action!=="checkin" || !validDate(data.date) || !allowed.has(String(data.kind))) return Response.json({error:"Invalid check-in."},{status:400});
    const kind=String(data.kind), date=data.date;
    const slot=kind==="workout" ? Number(data.slot) : 0;
    if (!Number.isInteger(slot) || slot<0 || slot>1) return Response.json({error:"Invalid workout slot."},{status:400});
    const existing=await db.prepare("SELECT id,photo_key AS photoKey,value FROM checkins WHERE person_id=? AND date=? AND kind=? AND slot=?").bind(user.userId,date,kind,slot).first<{id:string;photoKey:string|null;value:string|null}>();
    if (data.remove) {
      if (existing) {
        await db.prepare("DELETE FROM checkins WHERE id=?").bind(existing.id).run();
        if (existing.photoKey && env.BUCKET) await env.BUCKET.delete(existing.photoKey);
      }
      return Response.json({ok:true});
    }
    let value:string|null=null;
    if (kind==="wake" || kind==="bed") {
      if (!validTime(data.value)) return Response.json({error:"Enter the actual time."},{status:400});
      value=data.value;
    } else if (kind==="workout") {
      value=String(data.value || "Workout").trim().slice(0,60);
    } else if (kind==="drinks") {
      const count=Number(data.value);
      if (!Number.isInteger(count) || count<0 || count>30) return Response.json({error:"Enter a drink count from 0 to 30."},{status:400});
      value=String(count);
    }
    const now=Date.now();
    await db.prepare("INSERT INTO checkins (id,person_id,date,kind,slot,value,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(person_id,date,kind,slot) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(existing?.id || crypto.randomUUID(),user.userId,date,kind,slot,value,now,now).run();
    if (!existing || (kind==="drinks" && Number(value)>Number(existing.value||0))) {
      const description=kind==="wake"?"logged their wake-up":kind==="bed"?"logged their bedtime":kind==="makebed"?"made their bed":kind==="workout"?"logged "+value:kind==="prep"?"finished Sunday meal prep":"logged a drink";
      await notifyFriends(user.userId,date,description);
    }
    return Response.json({ok:true});
  } catch(error) {
    console.error("action failed",error);
    return Response.json({error:"Could not save your change. Try again."},{status:500});
  }
}
