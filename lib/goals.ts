export type GroupGoal={
  id:string;circleId:string;kind:string;slot:number;title:string;
  cadence:"daily"|"weekday"|"weekend"|"sunday"|"weekly";target:string|null;active:number;
};

export const defaultGoals:Omit<GroupGoal,"id"|"circleId"|"active">[]=[
  {kind:"wake",slot:0,title:"Wake up",cadence:"daily",target:null},
  {kind:"makebed",slot:0,title:"Make the bed",cadence:"daily",target:null},
  {kind:"workout",slot:0,title:"Workout 01",cadence:"daily",target:null},
  {kind:"workout",slot:1,title:"Workout 02",cadence:"weekday",target:null},
  {kind:"bed",slot:0,title:"In bed",cadence:"weekday",target:null},
  {kind:"prep",slot:0,title:"Sunday meal prep",cadence:"sunday",target:null},
  {kind:"drinks",slot:0,title:"Drinks this week",cadence:"weekly",target:"6"},
];

export async function seedGoals(db:D1Database,circleId:string){
  const existing=await db.prepare("SELECT id FROM group_goals WHERE circle_id=? LIMIT 1").bind(circleId).first();
  if(existing)return;
  const now=Date.now();
  await db.batch(defaultGoals.map(g=>db.prepare("INSERT OR IGNORE INTO group_goals (id,circle_id,kind,slot,title,cadence,target,active,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),circleId,g.kind,g.slot,g.title,g.cadence,g.target,1,now)));
}

export function goalApplies(goal:Pick<GroupGoal,"cadence">,day:Date){
  const weekday=day.getDay()!==0 && day.getDay()!==6;
  return goal.cadence==="daily" || (goal.cadence==="weekday"&&weekday) ||
    (goal.cadence==="weekend"&&!weekday) || (goal.cadence==="sunday"&&day.getDay()===0);
}
