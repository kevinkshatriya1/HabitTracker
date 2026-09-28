import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { visibleCheckinSQL,viewerBindings,feedAudienceSQL,audienceBindings } from "../../../lib/social-access";

export const dynamic = "force-dynamic";
export async function GET(request:Request){
 const user=await getChatGPTUser();
 if(!user)return Response.json({error:"Sign in to continue."},{status:401});
 if(!env.DB)return Response.json({error:"Database unavailable."},{status:503});
 const url=new URL(request.url);
 const before=Number(url.searchParams.get("before")||0);
 const beforeId=url.searchParams.get("beforeId")||"";
 if((before && (!Number.isSafeInteger(before)||before<0)) || beforeId.length>100)return Response.json({error:"Invalid feed cursor."},{status:400});
 const query=`SELECT x.id,x.person_id AS personId,x.date,x.kind,x.slot,x.value,x.logged_time AS loggedTime,x.details,x.photo_key AS photoKey,x.created_at AS createdAt,x.updated_at AS updatedAt
 FROM checkins x WHERE ${visibleCheckinSQL} AND ${feedAudienceSQL} ${before?"AND (x.updated_at < ? OR (x.updated_at = ? AND x.id < ?))":""}
 ORDER BY x.updated_at DESC,x.id DESC LIMIT 101`;
 try {
  const statement=env.DB.prepare(query);
  const rows=before?await statement.bind(...viewerBindings(user.userId),...audienceBindings(user.userId),before,before,beforeId).all():await statement.bind(...viewerBindings(user.userId),...audienceBindings(user.userId)).all();
  return Response.json({items:rows.results.slice(0,100),hasMore:rows.results.length>100});
 }catch(error){console.error("feed failed",error);return Response.json({error:"Could not load older activity."},{status:500})}
}
