// x aliases a check-in. Every visible post must belong to an active, chosen goal.
export const visibleCheckinSQL=`EXISTS (
 SELECT 1 FROM group_goals g
 JOIN members actor ON actor.circle_id=g.circle_id AND actor.person_id=x.person_id
 LEFT JOIN goal_choices choice ON choice.goal_id=g.id AND choice.person_id=x.person_id
 LEFT JOIN habit_visibility privacy ON privacy.person_id=x.person_id AND privacy.kind=x.kind AND privacy.slot=x.slot
 WHERE g.kind=x.kind AND g.slot=x.slot AND g.active=1 AND COALESCE(choice.enabled,1)=1 AND (
  x.person_id=? OR
  (COALESCE(privacy.visibility,'group')='group' AND EXISTS (SELECT 1 FROM members viewer WHERE viewer.circle_id=g.circle_id AND viewer.person_id=?)) OR
  COALESCE(privacy.visibility,'group')='public' 
 ))`;
export const viewerBindings=(id:string)=>[id,id];
export const feedAudienceSQL=`(x.person_id=? OR EXISTS (SELECT 1 FROM members actor JOIN members viewer ON viewer.circle_id=actor.circle_id WHERE actor.person_id=x.person_id AND viewer.person_id=?) OR EXISTS (SELECT 1 FROM friendships f WHERE f.status='accepted' AND ((f.requester_id=? AND f.recipient_id=x.person_id) OR (f.recipient_id=? AND f.requester_id=x.person_id))))`;
export const audienceBindings=(id:string)=>[id,id,id,id];
