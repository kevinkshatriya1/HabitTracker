import { env } from "cloudflare:workers";
import { buildPushHTTPRequest } from "@pushforge/builder";

type SubscriptionRow={id:string;endpoint:string;p256dh:string;auth:string};

export function trustedPushEndpoint(value:string) {
  try {
    const url=new URL(value);
    const host=url.hostname.toLowerCase();
    return url.protocol==="https:" && !url.username && !url.password && !url.port &&
      (host==="web.push.apple.com" || host.endsWith(".push.apple.com") ||
       host==="fcm.googleapis.com" || host==="fcm-xm.googleapis.com" ||
       host==="updates.push.services.mozilla.com" || host==="push.services.mozilla.com" ||
       host.endsWith(".notify.windows.com"));
  } catch { return false }
}

export async function notifyFriends(actorId:string, date:string, message:string,kind:string,slot:number) {
  if (!env.DB || !env.VAPID_PRIVATE_JWK) return;
  try {
    const [actor,privacy]=await Promise.all([
      env.DB.prepare("SELECT name FROM people WHERE id=?").bind(actorId).first<{name:string}>(),
      env.DB.prepare("SELECT visibility FROM habit_visibility WHERE person_id=? AND kind=? AND slot=?").bind(actorId,kind,slot).first<{visibility:string}>(),
    ]);
    if(privacy?.visibility==="private")return;
    const subscriptions=await env.DB.prepare(`SELECT DISTINCT s.id,s.endpoint,s.p256dh,s.auth FROM push_subscriptions s
      WHERE s.person_id<>? AND (
       EXISTS (SELECT 1 FROM members recipient JOIN members actor ON actor.circle_id=recipient.circle_id
         JOIN group_goals g ON g.circle_id=actor.circle_id AND g.kind=? AND g.slot=? AND g.active=1
         LEFT JOIN goal_choices actor_choice ON actor_choice.goal_id=g.id AND actor_choice.person_id=?
         WHERE actor.person_id=? AND recipient.person_id=s.person_id AND COALESCE(actor_choice.enabled,1)=1)
       OR (?='public' AND EXISTS (SELECT 1 FROM friendships f WHERE f.status='accepted' AND ((f.requester_id=? AND f.recipient_id=s.person_id) OR (f.recipient_id=? AND f.requester_id=s.person_id))))
      ) LIMIT 100`).bind(actorId,kind,slot,actorId,actorId,privacy?.visibility||"group",actorId,actorId).all<SubscriptionRow>();
    const privateJWK=JSON.parse(env.VAPID_PRIVATE_JWK) as JsonWebKey;
    const title="Endeavor · "+(actor?.name||"A friend");
    await Promise.allSettled(subscriptions.results.map(async s=>{
      if (!trustedPushEndpoint(s.endpoint)) return;
      try {
        const push=await buildPushHTTPRequest({
          privateJWK,
          subscription:{endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},
          message:{payload:{title,body:message+" · "+date,url:"/"},adminContact:"https://keep-pace-kartik.kartikpillai.chatgpt.site"},
        });
        const response=await fetch(push.endpoint,{method:"POST",headers:push.headers,body:push.body,signal:AbortSignal.timeout(6500)});
        if (response.status===404 || response.status===410) await env.DB!.prepare("DELETE FROM push_subscriptions WHERE id=?").bind(s.id).run();
        else if (!response.ok) console.error("push delivery status",response.status);
      } catch(error) {console.error("push delivery failed",error)}
    }));
  } catch(error) { console.error("friend notifications failed",error) }
}
