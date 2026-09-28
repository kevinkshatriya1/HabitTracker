import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:"Sign in to continue."},{status:401});
 if(!env.DB||!env.BUCKET)return Response.json({error:"Storage unavailable."},{status:503});
 const form=await request.formData(),image=form.get("image");
 if(!(image instanceof File)||!["image/jpeg","image/png","image/webp","image/heic","image/heif"].includes(image.type)||image.size<1||image.size>5_000_000)return Response.json({error:"Choose a JPG, PNG, WEBP, or HEIC photo under 5 MB."},{status:400});
 const old=await env.DB.prepare("SELECT avatar_key AS avatarKey FROM people WHERE id=?").bind(user.userId).first<{avatarKey:string|null}>();
 const key=`avatars/${user.userId}/${crypto.randomUUID()}`;
 await env.BUCKET.put(key,image.stream(),{httpMetadata:{contentType:image.type}});
 await env.DB.prepare("UPDATE people SET avatar_key=?,avatar_type=? WHERE id=?").bind(key,image.type,user.userId).run();
 if(old?.avatarKey)await env.BUCKET.delete(old.avatarKey);
 return Response.json({ok:true});
}
export async function GET(request:Request){
 const user=await getChatGPTUser();if(!user)return new Response(null,{status:401});
 if(!env.DB||!env.BUCKET)return new Response(null,{status:503});
 const id=new URL(request.url).searchParams.get("id")||"";
 const person=await env.DB.prepare("SELECT avatar_key AS avatarKey,avatar_type AS avatarType FROM people WHERE id=?").bind(id).first<{avatarKey:string|null;avatarType:string|null}>();
 if(!person?.avatarKey)return new Response(null,{status:404});
 const object=await env.BUCKET.get(person.avatarKey);if(!object)return new Response(null,{status:404});
 return new Response(object.body,{headers:{"Content-Type":person.avatarType||"image/jpeg","Cache-Control":"private,max-age=60","X-Content-Type-Options":"nosniff"}});
}
