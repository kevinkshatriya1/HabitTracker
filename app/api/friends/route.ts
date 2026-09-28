import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in to continue."},{status:401});
 const db=env.DB;if(!db)return Response.json({error:"Database unavailable."},{status:503});
 const q=(new URL(request.url).searchParams.get("q")||"").trim().slice(0,70);
 const relations=(await db.prepare(`SELECT f.id,f.requester_id AS requesterId,f.recipient_id AS recipientId,f.status,p.id AS personId,p.name,p.avatar_key AS avatarKey
 FROM friendships f JOIN people p ON p.id=CASE WHEN f.requester_id=? THEN f.recipient_id ELSE f.requester_id END
 WHERE f.requester_id=? OR f.recipient_id=? ORDER BY f.created_at DESC`).bind(user.userId,user.userId,user.userId).all()).results;
 const suggested=(await db.prepare(`SELECT DISTINCT p.id,p.name,p.avatar_key AS avatarKey FROM people p JOIN members m ON m.person_id=p.id JOIN members mine ON mine.circle_id=m.circle_id WHERE mine.person_id=? AND p.id<>? ORDER BY p.name LIMIT 40`).bind(user.userId,user.userId).all()).results;
 const matches=q.length>=2?(await db.prepare(`SELECT p.id,p.name,p.avatar_key AS avatarKey FROM people p WHERE p.id<>? AND (LOWER(p.name) LIKE ? ESCAPE '\\' OR LOWER(p.email)=LOWER(?)) ORDER BY p.name LIMIT 25`).bind(user.userId,"%"+q.toLowerCase().replace(/[\\%_]/g,"\\$&")+"%",q).all()).results:[];
 return Response.json({relations,suggested,matches});
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in to continue."},{status:401});
 const db=env.DB;if(!db)return Response.json({error:"Database unavailable."},{status:503});
 const body=await request.json() as {action?:string;personId?:string};const other=String(body.personId||"");
 if(!other||other===user.userId)return Response.json({error:"Choose another person."},{status:400});
 const person=await db.prepare("SELECT id FROM people WHERE id=?").bind(other).first();if(!person)return Response.json({error:"Person not found."},{status:404});
 const existing=await db.prepare("SELECT requester_id AS requesterId,recipient_id AS recipientId,status FROM friendships WHERE (requester_id=? AND recipient_id=?) OR (requester_id=? AND recipient_id=?)").bind(user.userId,other,other,user.userId).first<{requesterId:string;recipientId:string;status:string}>();
 if(body.action==="request"){
  if(existing)return Response.json({error:existing.status==="accepted"?"Already friends.":"A request is already pending."},{status:409});
  await db.prepare("INSERT INTO friendships (id,requester_id,recipient_id,status,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),user.userId,other,"pending",Date.now()).run();return Response.json({ok:true});
 }
 if(body.action==="accept"&&existing?.recipientId===user.userId&&existing.status==="pending"){
  await db.prepare("UPDATE friendships SET status='accepted' WHERE requester_id=? AND recipient_id=?").bind(other,user.userId).run();return Response.json({ok:true});
 }
 if((body.action==="decline"||body.action==="remove")&&existing){
  await db.prepare("DELETE FROM friendships WHERE (requester_id=? AND recipient_id=?) OR (requester_id=? AND recipient_id=?)").bind(user.userId,other,other,user.userId).run();return Response.json({ok:true});
 }
 return Response.json({error:"That request is unavailable."},{status:400});
}
