import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { seedGoals } from "../../../lib/goals";
import { visibleCheckinSQL,viewerBindings,feedAudienceSQL,audienceBindings } from "../../../lib/social-access";

export const dynamic = "force-dynamic";

type Group={id:string;name:string;inviteCode:string;ownerId:string;color:string};

export async function GET(request:Request){
 const user=await getChatGPTUser();
 if(!user)return Response.json({error:"Sign in to continue."},{status:401});
 try{
  const db=env.DB;
  if(!db)throw Error("Database unavailable");
  const name=user.fullName||user.email.split("@")[0];
  await db.prepare("INSERT INTO people (id,email,name) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email").bind(user.userId,user.email,name).run();
  let groups=(await db.prepare("SELECT c.id,c.name,c.invite_code AS inviteCode,c.owner_id AS ownerId,c.color FROM members m JOIN circles c ON c.id=m.circle_id WHERE m.person_id=? ORDER BY m.joined_at DESC,m.id DESC").bind(user.userId).all<Group>()).results;
  if(!groups.length){
   const id=crypto.randomUUID(),code=crypto.randomUUID().slice(0,8).toUpperCase(),now=Date.now();
   await db.batch([
    db.prepare("INSERT INTO circles (id,name,invite_code,owner_id,color,created_at) VALUES (?,?,?,?,?,?)").bind(id,"My crew",code,user.userId,"#4566B5",now),
    db.prepare("INSERT INTO members (circle_id,person_id,joined_at) VALUES (?,?,?)").bind(id,user.userId,now),
   ]);
   groups=[{id,name:"My crew",inviteCode:code,ownerId:user.userId,color:"#4566B5"}];
  }
  const url=new URL(request.url);
  const circle=groups.find(g=>g.id===url.searchParams.get("group"))||groups[0];
  for(const group of groups)await seedGoals(db,group.id);
  const start=/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("start")||"")?url.searchParams.get("start")!:new Date().toISOString().slice(0,10);
  let end=/^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("end")||"")?url.searchParams.get("end")!:start;
  if(Date.parse(end)-Date.parse(start)>45*86400000)end=new Date(Date.parse(start)+45*86400000).toISOString().slice(0,10);
  const [person,roster,memberships,goals,choices,orders,entries,feed,privacy,publicGoals]=await Promise.all([
   db.prepare("SELECT id,email,name,phone_number AS phoneNumber,weekday_wake AS weekdayWake,weekend_wake AS weekendWake,weekday_bed AS weekdayBed,weekend_bed AS weekendBed,reminder_time AS reminderTime,reminders,avatar_key AS avatarKey FROM people WHERE id=?").bind(user.userId).first(),
   db.prepare("SELECT DISTINCT p.id,p.name,p.weekday_wake AS weekdayWake,p.weekend_wake AS weekendWake,p.weekday_bed AS weekdayBed,p.avatar_key AS avatarKey FROM people p WHERE p.id=? OR EXISTS (SELECT 1 FROM members m JOIN members viewer ON viewer.circle_id=m.circle_id WHERE m.person_id=p.id AND viewer.person_id=?) OR EXISTS (SELECT 1 FROM friendships f WHERE f.status='accepted' AND ((f.requester_id=? AND f.recipient_id=p.id) OR (f.recipient_id=? AND f.requester_id=p.id))) ORDER BY p.name").bind(user.userId,user.userId,user.userId,user.userId).all(),
   db.prepare("SELECT m.circle_id AS circleId,m.person_id AS personId FROM members m WHERE m.circle_id IN (SELECT circle_id FROM members WHERE person_id=?)").bind(user.userId).all(),
   db.prepare("SELECT g.id,g.circle_id AS circleId,g.kind,g.slot,g.title,g.cadence,g.target,g.preferred_minutes AS preferredMinutes,g.active FROM group_goals g JOIN members m ON m.circle_id=g.circle_id WHERE m.person_id=? ORDER BY CASE g.cadence WHEN 'daily' THEN 0 WHEN 'weekday' THEN 1 WHEN 'weekend' THEN 2 WHEN 'sunday' THEN 3 ELSE 4 END,g.preferred_minutes,g.created_at").bind(user.userId).all(),
   db.prepare("SELECT ch.goal_id AS goalId,ch.person_id AS personId,ch.enabled FROM goal_choices ch JOIN group_goals g ON g.id=ch.goal_id WHERE g.circle_id IN (SELECT circle_id FROM members WHERE person_id=?)").bind(user.userId).all(),
   db.prepare("SELECT kind,slot,rank FROM goal_order WHERE person_id=?").bind(user.userId).all(),
   db.prepare(`SELECT x.id,x.person_id AS personId,x.date,x.kind,x.slot,x.value,x.logged_time AS loggedTime,x.details,x.photo_key AS photoKey,x.created_at AS createdAt,x.updated_at AS updatedAt
    FROM checkins x WHERE x.date BETWEEN ? AND ? AND ${visibleCheckinSQL} AND ${feedAudienceSQL} ORDER BY x.updated_at DESC`).bind(start,end,...viewerBindings(user.userId),...audienceBindings(user.userId)).all(),
   db.prepare(`SELECT x.id,x.person_id AS personId,x.date,x.kind,x.slot,x.value,x.logged_time AS loggedTime,x.details,x.photo_key AS photoKey,x.created_at AS createdAt,x.updated_at AS updatedAt
    FROM checkins x WHERE ${visibleCheckinSQL} AND ${feedAudienceSQL} ORDER BY x.updated_at DESC,x.id DESC LIMIT 100`).bind(...viewerBindings(user.userId),...audienceBindings(user.userId)).all(),
   db.prepare("SELECT person_id AS personId,kind,slot,visibility FROM habit_visibility WHERE person_id=? OR person_id IN (SELECT m.person_id FROM members m JOIN members mine ON mine.circle_id=m.circle_id WHERE mine.person_id=?)").bind(user.userId,user.userId).all(),
   db.prepare(`SELECT DISTINCT g.kind,g.slot,g.title,g.cadence,g.target,g.preferred_minutes AS preferredMinutes,p.id AS personId FROM group_goals g
    JOIN members m ON m.circle_id=g.circle_id JOIN people p ON p.id=m.person_id
    LEFT JOIN goal_choices choice ON choice.goal_id=g.id AND choice.person_id=p.id
    JOIN habit_visibility privacy ON privacy.person_id=p.id AND privacy.kind=g.kind AND privacy.slot=g.slot AND privacy.visibility='public'
    WHERE g.active=1 AND COALESCE(choice.enabled,1)=1 AND EXISTS (SELECT 1 FROM friendships f WHERE f.status='accepted' AND ((f.requester_id=? AND f.recipient_id=p.id) OR (f.recipient_id=? AND f.requester_id=p.id)))`).bind(user.userId,user.userId).all(),
  ]);
  const personalGoals=(await db.prepare("SELECT id,person_id AS personId,kind,slot,title,cadence,preferred_minutes AS preferredMinutes,weekly_day AS weeklyDay,icon_key AS iconKey,active,created_at AS createdAt FROM personal_goals WHERE person_id=? AND active=1 ORDER BY preferred_minutes,created_at").bind(user.userId).all()).results;
  return Response.json({me:person,circle,groups,people:roster.results,memberships:memberships.results,goals:goals.results,personalGoals,choices:choices.results,goalOrders:orders.results,checkins:entries.results,feed:feed.results,privacy:privacy.results,publicGoals:publicGoals.results});
 }catch(error){console.error("state load failed",error);return Response.json({error:"Could not load your calendar. Please try again."},{status:500})}
}
