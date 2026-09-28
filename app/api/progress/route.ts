import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in to continue."},{status:401});
 if(!env.DB)return Response.json({error:"Database unavailable."},{status:503});
 const raw=new URL(request.url).searchParams.get("today")||"";
 const today=/^\d{4}-\d{2}-\d{2}$/.test(raw)&&!Number.isNaN(Date.parse(raw+"T12:00:00Z"))?raw:new Date().toISOString().slice(0,10);
 const monthStart=today.slice(0,7)+"-01",first=new Date(monthStart+"T12:00:00Z");first.setUTCDate(first.getUTCDate()-6);
 const start=first.toISOString().slice(0,10);
 const rows=await env.DB.prepare("SELECT id,person_id AS personId,date,kind,slot,value,logged_time AS loggedTime,details,photo_key AS photoKey,created_at AS createdAt,updated_at AS updatedAt FROM checkins WHERE person_id=? AND date>=? AND date<=? ORDER BY date DESC").bind(user.userId,start,today).all();
 return Response.json({checkins:rows.results});
}
