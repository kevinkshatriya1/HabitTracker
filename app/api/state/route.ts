import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  try {
    const db = env.DB;
    if (!db) throw new Error("Database unavailable");
    const displayName = user.fullName || user.email.split("@")[0];
    await db.prepare("INSERT INTO people (id,email,name) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email").bind(user.userId,user.email,displayName).run();
    let membership = await db.prepare("SELECT c.id,c.name,c.invite_code AS inviteCode FROM members m JOIN circles c ON c.id=m.circle_id WHERE m.person_id=? ORDER BY m.joined_at DESC, m.id DESC LIMIT 1").bind(user.userId).first<{id:string;name:string;inviteCode:string}>();
    if (!membership) {
      const id = crypto.randomUUID();
      const code = crypto.randomUUID().slice(0,8).toUpperCase();
      const now = Date.now();
      await db.batch([
        db.prepare("INSERT INTO circles (id,name,invite_code,owner_id,created_at) VALUES (?,?,?,?,?)").bind(id,"My crew",code,user.userId,now),
        db.prepare("INSERT INTO members (circle_id,person_id,joined_at) VALUES (?,?,?)").bind(id,user.userId,now),
      ]);
      membership={id,name:"My crew",inviteCode:code};
    }
    const url = new URL(request.url);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("start") || "") ? url.searchParams.get("start")! : new Date().toISOString().slice(0,10);
    const end = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("end") || "") ? url.searchParams.get("end")! : start;
    const [person, roster, entries] = await Promise.all([
      db.prepare("SELECT id,email,name,weekday_wake AS weekdayWake,weekend_wake AS weekendWake,weekday_bed AS weekdayBed,reminder_time AS reminderTime,reminders FROM people WHERE id=?").bind(user.userId).first(),
      db.prepare("SELECT p.id,p.name,p.email,p.weekday_wake AS weekdayWake,p.weekend_wake AS weekendWake,p.weekday_bed AS weekdayBed FROM members m JOIN people p ON p.id=m.person_id WHERE m.circle_id=? ORDER BY m.joined_at,m.id").bind(membership.id).all(),
      db.prepare("SELECT x.id,x.person_id AS personId,x.date,x.kind,x.slot,x.value,x.photo_key AS photoKey,x.created_at AS createdAt FROM checkins x JOIN members m ON m.person_id=x.person_id WHERE m.circle_id=? AND x.date BETWEEN ? AND ? ORDER BY x.created_at DESC").bind(membership.id,start,end).all(),
    ]);
    return Response.json({ me:person,circle:membership,people:roster.results,checkins:entries.results });
  } catch (error) {
    console.error("state load failed",error);
    return Response.json({error:"Could not load your calendar. Please try again."},{status:500});
  }
}
