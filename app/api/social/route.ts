import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { visibleCheckinSQL,viewerBindings } from "../../../lib/social-access";
export const dynamic="force-dynamic";
const permitted=async(db:D1Database,id:string,viewerId:string)=>!!await db.prepare(`SELECT x.id FROM checkins x WHERE x.id=? AND ${visibleCheckinSQL}`).bind(id,...viewerBindings(viewerId)).first();
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in to continue."},{status:401});
 const db=env.DB;if(!db)return Response.json({error:"Database unavailable."},{status:503});
 const ids=(new URL(request.url).searchParams.get("ids")||"").split(",").filter(x=>/^[0-9a-f-]{36}$/.test(x)).slice(0,50);
 if(!ids.length)return Response.json({items:{}});
 const rows=await db.prepare(`SELECT x.id FROM checkins x WHERE x.id IN (${ids.map(()=>"?").join(",")}) AND ${visibleCheckinSQL}`).bind(...ids,...viewerBindings(user.userId)).all<{id:string}>();
 const safe=rows.results.map(x=>x.id);if(!safe.length)return Response.json({items:{}});
 const placeholders=safe.map(()=>"?").join(",");
 const [likes,comments]=await Promise.all([
  db.prepare(`SELECT checkin_id AS checkinId,person_id AS personId FROM feed_likes WHERE checkin_id IN (${placeholders})`).bind(...safe).all<{checkinId:string;personId:string}>(),
  db.prepare(`SELECT c.id,c.checkin_id AS checkinId,c.person_id AS personId,c.body,c.created_at AS createdAt,p.name,p.avatar_key AS avatarKey FROM feed_comments c JOIN people p ON p.id=c.person_id WHERE c.checkin_id IN (${placeholders}) ORDER BY c.created_at ASC LIMIT 500`).bind(...safe).all(),
 ]);
 const items:Record<string,{likes:number;liked:boolean;comments:unknown[]}>=Object.fromEntries(safe.map(id=>[id,{likes:0,liked:false,comments:[]}]));
 for(const l of likes.results){const x=items[l.checkinId];if(x){x.likes++;if(l.personId===user.userId)x.liked=true}}
 for(const c of comments.results){const x=items[c.checkinId as string];if(x)x.comments.push(c)}
 return Response.json({items});
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in to continue."},{status:401});
 const db=env.DB;if(!db)return Response.json({error:"Database unavailable."},{status:503});
 const body=await request.json() as {action?:string;id?:string;text?:string};const id=String(body.id||"");
 if(!(await permitted(db,id,user.userId)))return Response.json({error:"This update isn't available."},{status:403});
 if(body.action==="like"){
  const existing=await db.prepare("SELECT id FROM feed_likes WHERE checkin_id=? AND person_id=?").bind(id,user.userId).first();
  if(existing)await db.prepare("DELETE FROM feed_likes WHERE checkin_id=? AND person_id=?").bind(id,user.userId).run();
  else await db.prepare("INSERT INTO feed_likes (checkin_id,person_id,created_at) VALUES (?,?,?)").bind(id,user.userId,Date.now()).run();
  return Response.json({ok:true});
 }
 if(body.action==="comment"){
  const text=String(body.text||"").trim().slice(0,500);if(!text)return Response.json({error:"Write a comment first."},{status:400});
  await db.prepare("INSERT INTO feed_comments (id,checkin_id,person_id,body,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),id,user.userId,text,Date.now()).run();return Response.json({ok:true});
 }
 return Response.json({error:"Unknown action."},{status:400});
}
