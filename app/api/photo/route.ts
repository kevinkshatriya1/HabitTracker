import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { notifyFriends } from "../../../lib/push";

export const dynamic = "force-dynamic";

export async function POST(request:Request) {
  const user=await getChatGPTUser();
  if (!user) return Response.json({error:"Sign in to continue."},{status:401});
  try {
    if (!env.DB || !env.BUCKET) throw new Error("Storage unavailable");
    const form=await request.formData();
    const id=String(form.get("id") || "");
    const image=form.get("image");
    if (!(image instanceof File) || !["image/jpeg","image/png","image/webp","image/heic","image/heif"].includes(image.type) || image.size>8_000_000 || image.size===0) return Response.json({error:"Choose a JPG, PNG, WEBP, or HEIC image under 8 MB."},{status:400});
    const entry=await env.DB.prepare("SELECT id,photo_key AS photoKey,date,kind,slot FROM checkins WHERE id=? AND person_id=?").bind(id,user.userId).first<{id:string;photoKey:string|null;date:string;kind:string;slot:number}>();
    if (!entry) return Response.json({error:"Save the check-in before adding a photo."},{status:404});
    const key=`checkins/${user.userId}/${crypto.randomUUID()}`;
    await env.BUCKET.put(key,image.stream(),{httpMetadata:{contentType:image.type}});
    await env.DB.prepare("UPDATE checkins SET photo_key=?,photo_type=?,updated_at=? WHERE id=?").bind(key,image.type,Date.now(),id).run();
    if (entry.photoKey) await env.BUCKET.delete(entry.photoKey);
    await notifyFriends(user.userId,entry.date,"added a photo to their check-in",entry.kind,entry.slot);
    return Response.json({ok:true});
  } catch(error) {
    console.error("photo upload failed",error);
    return Response.json({error:"Photo upload failed. Please try again."},{status:500});
  }
}

export async function GET(request:Request) {
  const user=await getChatGPTUser();
  if (!user) return new Response(null,{status:401});
  const id=new URL(request.url).searchParams.get("id");
  if (!id) return new Response(null,{status:400});
  if (!env.DB || !env.BUCKET) return new Response(null,{status:503});
  const entry=await env.DB.prepare(`SELECT x.photo_key AS photoKey,x.photo_type AS photoType FROM checkins x
    JOIN members actor ON actor.person_id=x.person_id
    JOIN members viewer ON viewer.circle_id=actor.circle_id
    JOIN group_goals g ON g.circle_id=actor.circle_id AND g.kind=x.kind AND g.slot=x.slot AND g.active=1
    LEFT JOIN goal_choices choice ON choice.goal_id=g.id AND choice.person_id=x.person_id
    WHERE x.id=? AND viewer.person_id=? AND x.photo_key IS NOT NULL AND COALESCE(choice.enabled,1)=1 LIMIT 1`).bind(id,user.userId).first<{photoKey:string;photoType:string}>();
  if (!entry) return new Response(null,{status:404});
  const image=await env.BUCKET.get(entry.photoKey);
  if (!image) return new Response(null,{status:404});
  return new Response(image.body,{headers:{"Content-Type":entry.photoType,"Cache-Control":"private, max-age=60","X-Content-Type-Options":"nosniff"}});
}
