import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { trustedPushEndpoint } from "../../../lib/push";

export const dynamic="force-dynamic";

export async function GET() {
  const user=await getChatGPTUser();
  if (!user) return Response.json({error:"Sign in to continue."},{status:401});
  if (!env.VAPID_PUBLIC_KEY) return Response.json({error:"Phone alerts are unavailable."},{status:503});
  return Response.json({publicKey:env.VAPID_PUBLIC_KEY});
}

export async function POST(request:Request) {
  const user=await getChatGPTUser();
  if (!user) return Response.json({error:"Sign in to continue."},{status:401});
  if (!env.DB) return Response.json({error:"Could not save notifications."},{status:503});
  try {
    const payload=await request.json() as {endpoint?:string;keys?:{p256dh?:string;auth?:string}};
    const endpoint=payload.endpoint||"",p256dh=payload.keys?.p256dh||"",auth=payload.keys?.auth||"";
    if (!trustedPushEndpoint(endpoint) || endpoint.length>1500 || p256dh.length>200 || auth.length>200 || !p256dh || !auth) return Response.json({error:"Invalid push subscription."},{status:400});
    await env.DB.prepare("INSERT INTO push_subscriptions (id,person_id,endpoint,p256dh,auth,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET person_id=excluded.person_id,p256dh=excluded.p256dh,auth=excluded.auth").bind(crypto.randomUUID(),user.userId,endpoint,p256dh,auth,Date.now()).run();
    return Response.json({ok:true});
  } catch(error) { console.error("push subscription failed",error);return Response.json({error:"Could not enable notifications."},{status:500}) }
}

export async function DELETE(request:Request) {
  const user=await getChatGPTUser();
  if (!user) return Response.json({error:"Sign in to continue."},{status:401});
  if (!env.DB) return Response.json({error:"Could not update notifications."},{status:503});
  const body=await request.json() as {endpoint?:string};
  if (body.endpoint) await env.DB.prepare("DELETE FROM push_subscriptions WHERE person_id=? AND endpoint=?").bind(user.userId,body.endpoint).run();
  return Response.json({ok:true});
}
