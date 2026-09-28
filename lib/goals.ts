export type GroupGoal={
  id:string;circleId:string;kind:string;slot:number;title:string;
  cadence:"daily"|"weekday"|"weekend"|"sunday"|"weekly";target:string|null;preferredMinutes:number;active:number;
};

export const defaultGoals:Omit<GroupGoal,"id"|"circleId"|"active">[]=[
  {kind:"wake",slot:0,title:"Wake up",cadence:"daily",target:null,preferredMinutes:420},
  {kind:"makebed",slot:0,title:"Make the bed",cadence:"daily",target:null,preferredMinutes:440},
  {kind:"workout",slot:0,title:"Workout 01",cadence:"daily",target:null,preferredMinutes:1020},
  {kind:"workout",slot:1,title:"Workout 02",cadence:"weekday",target:null,preferredMinutes:1140},
  {kind:"bed",slot:0,title:"In bed",cadence:"weekday",target:null,preferredMinutes:1380},
  {kind:"prep",slot:0,title:"Sunday meal prep",cadence:"sunday",target:null,preferredMinutes:660},
  {kind:"drinks",slot:0,title:"Drinks this week",cadence:"weekly",target:"6",preferredMinutes:1200},
];

export const cadenceOrder={daily:0,weekday:1,weekend:2,sunday:3,weekly:4} as const;
export const cadenceLabel={daily:"Every day",weekday:"Weekdays",weekend:"Weekends",sunday:"Sunday",weekly:"Every week"} as const;
export function inferGoalMinutes(title:string){
 const text=title.toLowerCase();
 const clock=text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/);
 if(clock){const hour=Number(clock[1])%12+(clock[3]==="pm"?12:0);return hour*60+Number(clock[2]||0)}
 if(/wake|rise|alarm/.test(text))return 420;
 if(/bed|sleep|lights out/.test(text))return 1320;
 if(/breakfast|make.*bed|morning|meditat/.test(text))return 480;
 if(/lunch|midday/.test(text))return 720;
 if(/golf|walk/.test(text))return 900;
 if(/workout|lift|run|swim|bike|cardio|exercise|gym/.test(text))return 1020;
 if(/dinner|cook|meal prep/.test(text))return 1080;
 if(/read|journal|stretch|evening/.test(text))return 1260;
 return 720;
}

export async function seedGoals(db:D1Database,circleId:string){
  const existing=await db.prepare("SELECT id FROM group_goals WHERE circle_id=? LIMIT 1").bind(circleId).first();
  if(existing)return;
  const now=Date.now();
  await db.batch(defaultGoals.map(g=>db.prepare("INSERT OR IGNORE INTO group_goals (id,circle_id,kind,slot,title,cadence,target,preferred_minutes,active,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),circleId,g.kind,g.slot,g.title,g.cadence,g.target,g.preferredMinutes,1,now)));
}

export function goalApplies(goal:Pick<GroupGoal,"cadence">,day:Date){
  const weekday=day.getDay()!==0 && day.getDay()!==6;
  return goal.cadence==="daily" || (goal.cadence==="weekday"&&weekday) ||
    (goal.cadence==="weekend"&&!weekday) || (goal.cadence==="sunday"&&day.getDay()===0);
}
