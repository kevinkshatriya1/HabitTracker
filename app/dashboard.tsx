"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bell, CalendarDays, Heart, MessageCircle, UserRound, BedDouble, Camera, Check, ChevronDown, ChevronUp, CheckCircle2, ChevronRight, Clock3, Coffee, Dumbbell, Link2, Minus, Plus, Settings2, Share2, Sunrise, Users, Utensils, Wine, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cadenceLabel, cadenceOrder, goalApplies, inferGoalMinutes, type GroupGoal } from "@/lib/goals";

type Person={id:string;name:string;email?:string;weekdayWake:string;weekendWake:string;weekdayBed:string;reminderTime?:string;reminders?:number;avatarKey?:string|null};
type Checkin={id:string;personId:string;date:string;kind:string;slot:number;value:string|null;loggedTime:string|null;details:string|null;photoKey:string|null;createdAt:number;updatedAt:number};
type Group={id:string;name:string;inviteCode:string;ownerId:string;color:string};
type Choice={goalId:string;personId:string;enabled:number};
type State={me:Person;circle:Group;groups:Group[];goals:GroupGoal[];choices:Choice[];goalOrders:{kind:string;slot:number;rank:number}[];people:Person[];memberships:{circleId:string;personId:string}[];checkins:Checkin[];feed:Checkin[];privacy:{personId:string;kind:string;slot:number;visibility:string}[];publicGoals:{personId:string;kind:string;slot:number;title:string;cadence:GroupGoal["cadence"];target:string|null;preferredMinutes:number}[]};
type FriendPerson={id:string;name:string;avatarKey?:string|null};
type FriendRelation={id:string;requesterId:string;recipientId:string;status:string;personId:string;name:string;avatarKey?:string|null};
type FeedComment={id:string;checkinId:string;personId:string;body:string;createdAt:number;name:string;avatarKey?:string|null};
type Goal={id:string;circleId:string;kind:string;slot:number;title:string;hint:string;icon:typeof Sunrise;cadence:GroupGoal["cadence"]};

const todayKey=()=>dateKey(new Date());
function dateKey(d:Date){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
function fromKey(key:string){const [y,m,d]=key.split("-").map(Number);return new Date(y,m-1,d)}
function shift(d:Date,n:number){const out=new Date(d);out.setDate(out.getDate()+n);return out}
function weekStart(d:Date){return shift(d,-d.getDay())}
function monthStart(d:Date){return new Date(d.getFullYear(),d.getMonth(),1)}
function monthGridStart(d:Date){return weekStart(monthStart(d))}
function monthGridEnd(d:Date){return shift(weekStart(new Date(d.getFullYear(),d.getMonth()+1,0)),6)}
function fmtTime(t:string){const [h,m]=t.split(":").map(Number);return new Date(2020,0,1,h,m).toLocaleTimeString("en-US",{hour:"numeric",minute:m? "2-digit":undefined})}
function initials(name:string){return name.split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")}
function weekLabel(d:Date){const end=shift(d,6);return d.toLocaleDateString("en-US",{month:"long",day:"numeric"})+" – "+end.toLocaleDateString("en-US",{month:d.getMonth()===end.getMonth()?undefined:"short",day:"numeric",year:"numeric"})}
function displayGoal(g:GroupGoal,p:Person,day:Date):Goal {
 const weekend=[0,6].includes(day.getDay());
 const icon=g.kind==="wake"?Sunrise:g.kind==="bed"?Clock3:g.kind==="workout"?Dumbbell:g.kind==="makebed"?BedDouble:g.kind==="prep"?Utensils:g.kind==="drinks"?Wine:CheckCircle2;
 const hint=g.kind==="wake"?"By "+fmtTime(weekend?p.weekendWake:p.weekdayWake):g.kind==="bed"?"By "+fmtTime(p.weekdayBed):g.kind==="workout"?"Lift, cardio, or golf":g.kind==="drinks"?"Limit "+(g.target||"6")+" this week":g.cadence==="sunday"?"Sunday":g.cadence==="weekday"?"Weekdays":g.cadence==="weekend"?"Weekends":g.cadence==="weekly"?"Once a week":"Every day";
 return {...g,icon,hint};
}
function isOnTime(entry:Checkin, target:string, kind:string){if(!entry.value)return true;return kind==="wake"?entry.value<=target:entry.value<=target}
function Avatar({person,size="normal"}:{person:Person;size?:"normal"|"small"}){return <span className={"avatar "+(size==="small"?"avatar-small":"")} title={person.name}>{person.avatarKey?<img src={"/api/avatar?id="+encodeURIComponent(person.id)+"&v="+encodeURIComponent(person.avatarKey)} alt={person.name}/>:initials(person.name)}</span>}

export default function Dashboard(){
 const [start,setStart]=useState(()=>weekStart(new Date()));
 const [view,setView]=useState<"week"|"month">("week");
 const [month,setMonth]=useState(()=>monthStart(new Date()));
 const [section,setSection]=useState<"me"|"group"|"feed"|"settings">("me");
 const [meTab,setMeTab]=useState<"activity"|"profile">("activity");
 const [feedTab,setFeedTab]=useState<"myfeed"|"fof"|"friends">("myfeed");
 const [groupId,setGroupId]=useState("");
 const [selected,setSelected]=useState(todayKey);
 const [data,setData]=useState<State|null>(null);
 const [progressCheckins,setProgressCheckins]=useState<Checkin[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [saving,setSaving]=useState("");
 const [notice,setNotice]=useState("");
 const [modal,setModal]=useState<""|"settings"|"share"|"newgroup"|"editgroup"|"participation"|"log">("");
 const [newGroupName,setNewGroupName]=useState("");
 const [groupName,setGroupName]=useState("");
 const [groupColor,setGroupColor]=useState("#5B5FC7");
 const [calendarPerson,setCalendarPerson]=useState("all");
 const [calendarTask,setCalendarTask]=useState("all");
 const [feedGroup,setFeedGroup]=useState("all");
 const [feedPerson,setFeedPerson]=useState("all");
 const [feedTask,setFeedTask]=useState("all");
 const [feedExtra,setFeedExtra]=useState<Checkin[]>([]);
 const [feedHasMore,setFeedHasMore]=useState(true);
 const [feedLoading,setFeedLoading]=useState(false);
 const [friendSearch,setFriendSearch]=useState("");
 const [friendData,setFriendData]=useState<{relations:FriendRelation[];suggested:FriendPerson[];matches:FriendPerson[]}>({relations:[],suggested:[],matches:[]});
 const [social,setSocial]=useState<Record<string,{likes:number;liked:boolean;comments:FeedComment[]}>>({});
 const [commentDrafts,setCommentDrafts]=useState<Record<string,string>>({});
 const [showComments,setShowComments]=useState<Record<string,boolean>>({});
 const [logKind,setLogKind]=useState("");
 const [logSlot,setLogSlot]=useState(0);
 const [logDate,setLogDate]=useState("");
 const [loggedTime,setLoggedTime]=useState("");
 const [logCount,setLogCount]=useState(0);
 const [logPhoto,setLogPhoto]=useState<File|null>(null);
 const [workDescription,setWorkDescription]=useState("");
 const [workAdditional,setWorkAdditional]=useState("");
 const [workExercises,setWorkExercises]=useState<{name:string;sets:string;weight:string}[]>([]);
 const [customTitle,setCustomTitle]=useState("");
 const [customTime,setCustomTime]=useState("");
 const [customCadence,setCustomCadence]=useState<GroupGoal["cadence"]>("daily");
 const [workType,setWorkType]=useState("Lift");
 const [settings,setSettings]=useState({name:"",weekdayWake:"07:00",weekendWake:"09:00",weekdayBed:"23:00",reminderTime:"20:00",reminders:false});
 const [inviteInput,setInviteInput]=useState("");
 const fileRef=useRef<HTMLInputElement>(null);
 const [pushEnabled,setPushEnabled]=useState(false);
 const [pushSupport,setPushSupport]=useState(true);
 const [photoFor,setPhotoFor]=useState<string|null>(null);
 const rangeStart=view==="week"?start:monthGridStart(month);
 const rangeEnd=view==="week"?shift(start,6):monthGridEnd(month);

 const load=useCallback(async(showLoading=false)=>{
   if(showLoading)setLoading(true);
   try {
     const response=await fetch("/api/state?start="+dateKey(rangeStart)+"&end="+dateKey(rangeEnd)+(groupId?"&group="+encodeURIComponent(groupId):""),{cache:"no-store"});
     const json=await response.json() as State & {error?:string};
     if(!response.ok)throw Error(json.error || "Could not load your calendar.");
     fetch("/api/progress?today="+todayKey(),{cache:"no-store"}).then(r=>r.ok?r.json() as Promise<{checkins?:Checkin[]}>:null).then((result:{checkins?:Checkin[]}|null)=>{if(result?.checkins)setProgressCheckins(result.checkins)}).catch(()=>{});
     setData(json);setFeedHasMore(json.feed.length>=100);setError("");
     if(!groupId)setGroupId(json.circle.id);
     setSettings({name:json.me.name,weekdayWake:json.me.weekdayWake,weekendWake:json.me.weekendWake,weekdayBed:json.me.weekdayBed,reminderTime:json.me.reminderTime||"20:00",reminders:!!json.me.reminders});
   }catch(e){setError(e instanceof Error?e.message:"Could not load your calendar.")}
   finally{setLoading(false)}
 },[view,dateKey(rangeStart),dateKey(rangeEnd),groupId]);
 useEffect(()=>{load(true)},[load]);
 useEffect(()=>{const id=setInterval(()=>load(),60_000);return()=>clearInterval(id)},[load]);
 useEffect(()=>{
   if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {setPushSupport(false);return}
   navigator.serviceWorker.register("/sw.js").then(async registration=>{
     const subscription=await registration.pushManager.getSubscription();
     setPushEnabled(!!subscription && Notification.permission==="granted");
     if (subscription && Notification.permission==="granted") {
       await fetch("/api/push",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(subscription.toJSON())});
     }
   }).catch(()=>setPushSupport(false));
 },[]);

 const myEntries=useMemo(()=>data?.checkins.filter(c=>c.personId===data.me.id)||[],[data]);
 const selectedDate=fromKey(selected);
 const isWeekend=[0,6].includes(selectedDate.getDay());
 const find=(personId:string,date:string,kind:string,slot=0)=>data?.checkins.find(c=>c.personId===personId && c.date===date && c.kind===kind && c.slot===slot);
 const my=(kind:string,slot=0,date=selected)=>data?find(data.me.id,date,kind,slot):undefined;
 const chosen=(personId:string,goalId:string)=>((data?.choices.find(c=>c.personId===personId&&c.goalId===goalId)?.enabled)??1)===1;
 const goalRank=(g:GroupGoal)=>data?.goalOrders.find(o=>o.kind===g.kind&&o.slot===g.slot)?.rank??g.preferredMinutes;
 const sortGoals=(goals:GroupGoal[])=>[...goals].sort((a,b)=>cadenceOrder[a.cadence]-cadenceOrder[b.cadence]||goalRank(a)-goalRank(b)||a.preferredMinutes-b.preferredMinutes||a.title.localeCompare(b.title)||a.circleId.localeCompare(b.circleId));
 const scopeGoals=sortGoals((data?.goals||[]).filter(g=>g.active && (section==="me" || g.circleId===data?.circle.id)));
 const dailyGoals=scopeGoals.filter(g=>g.cadence!=="weekly" && goalApplies(g,selectedDate) && chosen(data!.me.id,g.id)).map(g=>displayGoal(g,data!.me,selectedDate));
 const weeklyGoals=scopeGoals.filter(g=>(g.cadence==="weekly"||g.cadence==="sunday")&&chosen(data!.me.id,g.id));
 const sunday=dateKey(start);
 const weekEntries=myEntries.filter(c=>c.date>=dateKey(start) && c.date<=dateKey(shift(start,6)));
 const drinks=weekEntries.filter(c=>c.kind==="drinks").reduce((n,c)=>n+Number(c.value||0),0);
 const dayDone=dailyGoals.filter(g=>my(g.kind,g.slot)).length;
 const dueThisWeek=Array.from({length:7},(_,i)=>{const day=shift(start,i);return scopeGoals.filter(g=>g.kind!=="drinks" && (g.cadence==="weekly"?i===(g.kind==="drinks"?6:0):goalApplies(g,day)) && chosen(data!.me.id,g.id)).map(g=>({g,date:dateKey(day)}))}).flat();
 const totalWeek=dueThisWeek.filter(({g,date})=>my(g.kind,g.slot,date)).length;
 const weekTarget=dueThisWeek.length;
 const weekRate=weekTarget?Math.min(100,Math.round(totalWeek/weekTarget*100)):0;
 const recent=data?.checkins.filter(c=>c.personId!==data.me.id && data.memberships.some(m=>m.circleId===data.circle.id&&m.personId===c.personId)).slice(0,5)||[];
 const groupPeople=data?.people.filter(p=>data.memberships.some(m=>m.circleId===data.circle.id&&m.personId===p.id))||[];
 const groupGoals=data?.goals.filter(g=>g.circleId===data.circle.id&&g.active)||[];
 const groupPalette=["#5B6EF5","#12B3A8","#FF6F59","#F5A623","#E85D9E","#3FAE5B","#8B6BE0","#E4572E"];
 const goalName=(kind:string,slot:number)=>data?.goals.find(g=>g.kind===kind&&g.slot===slot)?.title||data?.publicGoals.find(g=>g.kind===kind&&g.slot===slot)?.title||kind;
 const entryGroups=(c:Checkin)=>data?.groups.filter(group=>data.memberships.some(m=>m.circleId===group.id&&m.personId===c.personId) && data.goals.some(g=>g.circleId===group.id&&g.active&&g.kind===c.kind&&g.slot===c.slot&&chosen(c.personId,g.id)))||[];
 const allFeed=Array.from(new Map([...(data?.feed||[]),...feedExtra].map(c=>[c.id,c])).values()).sort((a,b)=>b.updatedAt-a.updatedAt||b.id.localeCompare(a.id));
 const filteredFeed=allFeed.filter(c=>(feedPerson==="all"||c.personId===feedPerson)&&(feedTask==="all"||c.kind+":"+c.slot===feedTask)&&(feedGroup==="all"||entryGroups(c).some(g=>g.id===feedGroup)));
 const filterPeople=feedGroup==="all"?data?.people||[]:data?.people.filter(p=>data.memberships.some(m=>m.circleId===feedGroup&&m.personId===p.id))||[];
 const filterGoals=[...(data?.goals||[]).filter(g=>g.active&&(feedGroup==="all"||g.circleId===feedGroup)),...(feedGroup==="all"?data?.publicGoals||[]:[]).map(g=>({...g,id:"public:"+g.personId+g.kind+g.slot,active:1}))].filter(g=>g.active!==0).filter((g,i,a)=>a.findIndex(x=>x.kind===g.kind&&x.slot===g.slot)===i);
 const inviteUrl=typeof window!=="undefined" && data?window.location.origin+"/?join="+data.circle.inviteCode:"";
 const monthDays=Array.from({length:new Date(month.getFullYear(),month.getMonth()+1,0).getDate()},(_,i)=>new Date(month.getFullYear(),month.getMonth(),i+1));
 const summaryDays=monthDays.filter(day=>dateKey(day)<=todayKey());
 const completedGoal=(p:Person,g:GroupGoal,day:Date,entries=data?.checkins||[])=>{if(g.kind!=="drinks")return entries.some(c=>c.personId===p.id&&c.date===dateKey(day)&&c.kind===g.kind&&c.slot===g.slot);if(dateKey(day)>todayKey())return false;const monday=weekStart(day),end=dateKey(day);const count=entries.filter(c=>c.personId===p.id&&c.kind==="drinks"&&c.date>=dateKey(monday)&&c.date<=end).reduce((n,c)=>n+Number(c.value||0),0);return count<=Number(g.target||6)};
 const personProgress=(p:Person,day:Date,scopeCircle=section==="group"?data?.circle.id:undefined,entries=data?.checkins||[])=>{
   const key=dateKey(day);
   const matching=(data?.goals||[]).filter(g=>g.active && (p.id===data?.me.id||data?.privacy.find(v=>v.personId===p.id&&v.kind===g.kind&&v.slot===g.slot)?.visibility!=="private") && (!scopeCircle||g.circleId===scopeCircle) && chosen(p.id,g.id) && (section!=="group"||calendarTask==="all"||g.kind+":"+g.slot===calendarTask) && (g.cadence==="weekly"?day.getDay()===(g.kind==="drinks"?6:0):goalApplies(g,day)));
   return {done:matching.filter(g=>completedGoal(p,g,day,entries)).length,expected:matching.length};
 };
 const currentDay=new Date(),elapsedWeek=Array.from({length:currentDay.getDay()+1},(_,i)=>shift(weekStart(currentDay),i)),elapsedMonth=Array.from({length:currentDay.getDate()},(_,i)=>new Date(currentDay.getFullYear(),currentDay.getMonth(),i+1));
 const individualStats=(days:Date[])=>days.reduce((sum,day)=>{const x=personProgress(data?.me||{id:"",name:"",email:"",weekdayWake:"",weekendWake:"",weekdayBed:""},day,undefined,progressCheckins);return {done:sum.done+x.done,expected:sum.expected+x.expected}},{done:0,expected:0});
 const progressCircles=[{label:"Today",stats:individualStats([currentDay]),color:"#4655D6"},{label:"This week",stats:individualStats(elapsedWeek),color:"#C43A1F"},{label:"This month",stats:individualStats(elapsedMonth),color:"#12B3A8"}];
 const crewColors=["#5B6EF5","#12B3A8","#FF6F59","#F5A623","#E85D9E","#3FAE5B"];
 const groupWeekStats=data?Array.from({length:7},(_,i)=>shift(start,i)).flatMap(day=>groupPeople.map(p=>personProgress(p,day,data.circle.id))).reduce((sum,x)=>({done:sum.done+x.done,expected:sum.expected+x.expected}),{done:0,expected:0}):{done:0,expected:0};
 const groupWeekRate=groupWeekStats.expected?Math.round(groupWeekStats.done/groupWeekStats.expected*100):0;
 const feedCalendarPeople=(feedGroup==="all"?data?.people||[]:filterPeople).filter(p=>feedPerson==="all"||p.id===feedPerson);
 const feedProgress=(p:Person,day:Date)=>{const goals=[...(data?.goals||[]).filter(g=>g.active&&(p.id===data?.me.id||data?.privacy.find(v=>v.personId===p.id&&v.kind===g.kind&&v.slot===g.slot)?.visibility!=="private")&&(feedGroup==="all"||g.circleId===feedGroup)&&data?.memberships.some(m=>m.personId===p.id&&m.circleId===g.circleId)&&chosen(p.id,g.id)),...((feedGroup==="all"?data?.publicGoals||[]:[]).filter(g=>g.personId===p.id).map(g=>({...g,id:"friend:"+p.id+g.kind+g.slot,circleId:"",active:1})))].filter(g=>(feedTask==="all"||g.kind+":"+g.slot===feedTask)&&(g.cadence==="weekly"?day.getDay()===(g.kind==="drinks"?6:0):goalApplies(g,day))).filter((g,i,a)=>a.findIndex(x=>x.kind===g.kind&&x.slot===g.slot)===i);return {done:goals.filter(g=>completedGoal(p,g,day)).length,expected:goals.length}};
 const comparison=section==="group"?(data?.people.filter(p=>data.memberships.some(m=>m.circleId===data.circle.id&&m.personId===p.id)).filter(p=>calendarPerson==="all"||p.id===calendarPerson).map(p=>({id:p.id,label:p.id===data.me.id?"You":p.name.split(" ")[0],person:p,scopeCircle:data.circle.id}))||[]):(data?.groups.map(g=>({id:g.id,label:g.name,person:data.me,scopeCircle:g.id}))||[]);

 useEffect(()=>{
  const code=new URLSearchParams(window.location.search).get("join");
  if(code && data && code!==data.circle.inviteCode){setInviteInput(code.toUpperCase());setModal("share")}
 },[data?.circle.inviteCode]);
 useEffect(()=>{
  if(!data?.me.reminders || typeof Notification==="undefined" || Notification.permission!=="granted")return;
  const check=()=>{const now=new Date();const key=dateKey(now);if(now.toTimeString().slice(0,5)<data.me.reminderTime!)return;
   const marker="keep-pace-reminded-"+key;
   if(localStorage.getItem(marker))return;
   const items=data.goals.filter(g=>g.active && goalApplies(g,now) && (data.choices.find(c=>c.goalId===g.id&&c.personId===data.me.id)?.enabled??1)===1 && !data.checkins.some(c=>c.personId===data.me.id&&c.date===key&&c.kind===g.kind&&c.slot===g.slot)).length;
   if(items){new Notification("Keep Pace",{body:items+" check-in"+(items===1?"":"s")+" still open today."});localStorage.setItem(marker,"1")}
  };
  const timer=setInterval(check,60_000);check();return()=>clearInterval(timer);
 },[data]);

 async function loadMoreFeed(){const last=allFeed[allFeed.length-1];if(!last||feedLoading)return;setFeedLoading(true);try{const response=await fetch("/api/feed?before="+last.updatedAt+"&beforeId="+encodeURIComponent(last.id));const body=await response.json() as {items?:Checkin[];hasMore?:boolean;error?:string};if(!response.ok)throw Error(body.error||"Could not load older activity.");setFeedExtra(previous=>[...previous,...(body.items||[])]);setFeedHasMore(!!body.hasMore)}catch(e){setError(e instanceof Error?e.message:"Could not load older activity.")}finally{setFeedLoading(false)}}
 async function action(payload:Record<string,unknown>,status="Saving…"){
   setSaving(status);setError("");
   try{const response=await fetch("/api/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const body=await response.json() as {error?:string};if(!response.ok)throw Error(body.error||"Could not save.");
    await load();setNotice("Saved");setTimeout(()=>setNotice(""),2500);return true
   }catch(e){setError(e instanceof Error?e.message:"Could not save.");return false}
   finally{setSaving("")}
 }
 function openLog(kind:string,slot=0,date=selected){
   const existing=my(kind,slot,date);let details:{description?:string;additional?:string;exercises?:{name:string;sets:string;weight:string}[]}={};
   try{details=JSON.parse(existing?.details||"{}") as typeof details}catch{}
   setLogKind(kind);setLogSlot(slot);setLogDate(date);setLoggedTime(existing?.loggedTime||new Date().toTimeString().slice(0,5));
   setWorkType(kind==="workout"&&["Lift","Run","Swim","Bike","Golf","Other"].includes(existing?.value||"")?existing!.value!:"Lift");
   setWorkDescription(details.description||"");setWorkAdditional(details.additional||"");setWorkExercises(details.exercises||[]);
   setLogCount(Number(existing?.value||0));setLogPhoto(null);setModal("log");
 }
 async function saveLog(){const payload:Record<string,unknown>={action:"checkin",kind:logKind,slot:logSlot,date:logDate,loggedTime};
  if(logKind==="wake"||logKind==="bed")payload.value=loggedTime;
  if(logKind==="drinks")payload.value=logCount;
  if(logKind==="workout")Object.assign(payload,{workoutType:workType,description:workDescription,additional:workAdditional,exercises:workExercises});
  if(!logPhoto){if(await action(payload))setModal("");return}
  setSaving("Saving check-in and photo…");setError("");
  try{const res=await fetch("/api/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const saved=await res.json() as {id?:string;error?:string};if(!res.ok||!saved.id)throw Error(saved.error||"Could not save check-in.");
   const form=new FormData();form.append("id",saved.id);form.append("image",logPhoto);
   const photoRes=await fetch("/api/photo",{method:"POST",body:form});const photo=await photoRes.json() as {error?:string};if(!photoRes.ok)throw Error(photo.error||"Check-in saved, but photo upload failed. Try adding it again.");
   await load();setLogPhoto(null);setModal("");setNotice("Check-in and photo saved");setTimeout(()=>setNotice(""),2500)
  }catch(e){await load();setError(e instanceof Error?e.message:"Could not save check-in or photo.")}finally{setSaving("")}
 }
 async function removeLog(){if(await action({action:"checkin",kind:logKind,slot:logSlot,date:logDate,remove:true}))setModal("")}
 const toggle=(kind:string,slot=0,date=selected)=>openLog(kind,slot,date);
 async function upload(file:File|null){if(!file||!photoFor)return;setSaving("Uploading photo…");setError("");
   try{const form=new FormData();form.append("id",photoFor);form.append("image",file);
    const res=await fetch("/api/photo",{method:"POST",body:form});const body=await res.json() as {error?:string};if(!res.ok)throw Error(body.error||"Upload failed.");
    await load();setNotice("Photo added");setTimeout(()=>setNotice(""),2500)
   }catch(e){setError(e instanceof Error?e.message:"Upload failed.")}finally{setPhotoFor(null);setSaving("");if(fileRef.current)fileRef.current.value=""}
 }
 function choosePhoto(id:string){setPhotoFor(id);fileRef.current?.click()}
 function goWeek(n:number){const next=shift(start,n*7);setStart(next);setSelected(dateKey(next))}
 function goMonth(n:number){const next=new Date(month.getFullYear(),month.getMonth()+n,1);setMonth(next);setStart(weekStart(next));setSelected(dateKey(next))}
 async function enablePush(){
   if (!pushSupport || !("Notification" in window)) {setError("On iPhone, add Keep Pace to your Home Screen, open it there, then turn on alerts.");return}
   try {
     // Ask directly from the button press, as required by iPhone.
     const permission=await Notification.requestPermission();
     if(permission!=="granted")throw Error("Notification permission wasn't granted. Enable it in your phone settings and try again.");
     setSaving("Enabling phone alerts…");
     const registration=await navigator.serviceWorker.register("/sw.js");
     const response=await fetch("/api/push");
     const result=await response.json() as {publicKey?:string;error?:string};
     if(!response.ok||!result.publicKey)throw Error(result.error||"Phone alerts are unavailable.");
     const padded=result.publicKey+"=".repeat((4-result.publicKey.length%4)%4);
     const key=Uint8Array.from(atob(padded.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0)).buffer as ArrayBuffer;
     const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
     const saved=await fetch("/api/push",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(subscription.toJSON())});
     if(!saved.ok){const body=await saved.json() as {error?:string};throw Error(body.error||"Could not save phone alerts.")}
     setPushEnabled(true);setNotice("Phone alerts enabled");setTimeout(()=>setNotice(""),3000);setError("");
   }catch(e){setError(e instanceof Error?e.message:"Could not enable phone alerts.")}
   finally{setSaving("")}
 }
 async function disablePush(){
   try{
     const registration=await navigator.serviceWorker.ready;
     const subscription=await registration.pushManager.getSubscription();
     if(subscription){await fetch("/api/push",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({endpoint:subscription.endpoint})});await subscription.unsubscribe()}
     setPushEnabled(false);setNotice("Phone alerts turned off");setTimeout(()=>setNotice(""),3000)
   }catch(e){setError(e instanceof Error?e.message:"Could not turn off alerts.")}
 }
 async function saveSettings(){if(settings.reminders && typeof Notification!=="undefined" && Notification.permission==="default"){const permission=await Notification.requestPermission();if(permission!=="granted"){setError("Browser notifications were not enabled. You can still use in-app reminders while this page is open.");setSettings({...settings,reminders:false});return}}
  const ok=await action({action:"settings",...settings});if(ok)setModal("")}
 async function copyInvite(){try{await navigator.clipboard.writeText(inviteUrl);setNotice("Invite link copied");setTimeout(()=>setNotice(""),3000)}catch{setError("Copy unavailable. Select the link below to share it.")}}
 async function join(){const code=inviteInput.includes("join=")?inviteInput.split("join=")[1].split("&")[0]:inviteInput;const ok=await action({action:"join",code:code.trim()});if(ok){setGroupId("");setSection("group");setModal("");setInviteInput("");history.replaceState(null,"","/")}}
 async function createGroup(){const ok=await action({action:"create_group",name:newGroupName});if(ok){setGroupId("");setSection("group");setNewGroupName("");setModal("")}}
 async function saveGroup(){if(!data || !groupName.trim())return;const ok=await action({action:"group_edit",circleId:data.circle.id,name:groupName.trim(),color:groupColor});if(ok)setNotice("Group updated")}
 async function addGoal(){const ok=await action({action:"goal_add",circleId:data?.circle.id,title:customTitle,cadence:customCadence,preferredTime:customTime});if(ok){setCustomTitle("");setCustomTime("")}}
 function toggleChoice(goal:GroupGoal){action({action:"goal_choice",goalId:goal.id,enabled:!chosen(data!.me.id,goal.id)})}
 async function moveGoal(goal:GroupGoal,direction:-1|1){
  const unique=sortGoals((data?.goals||[]).filter(g=>g.active&&g.cadence===goal.cadence)).filter((g,i,a)=>a.findIndex(x=>x.kind===g.kind&&x.slot===g.slot)===i);
  const index=unique.findIndex(g=>g.kind===goal.kind&&g.slot===goal.slot),other=index+direction;
  if(index<0||other<0||other>=unique.length)return;
  [unique[index],unique[other]]=[unique[other],unique[index]];
  await action({action:"goal_reorder",cadence:goal.cadence,order:unique.map(g=>({kind:g.kind,slot:g.slot}))},"Reordering…");
 }
 const orderedParticipation=sortGoals((data?.goals||[]).filter(g=>g.active)).filter((g,i,a)=>a.findIndex(x=>x.kind===g.kind&&x.slot===g.slot)===i);
 const socialIds=allFeed.map(c=>c.id).join(",");
 useEffect(()=>{if(!socialIds||section!=="feed")return;let alive=true;const ids=socialIds.split(",");const refresh=()=>Promise.all(Array.from({length:Math.ceil(ids.length/50)},(_,i)=>fetch("/api/social?ids="+ids.slice(i*50,i*50+50).join(",")).then(r=>r.json() as Promise<{items:typeof social}>))).then(parts=>{if(alive)setSocial(Object.assign({},...parts.map(p=>p.items)))}).catch(()=>{});refresh();const timer=setInterval(refresh,30_000);return()=>{alive=false;clearInterval(timer)}},[socialIds,section]);
 const loadFriends=useCallback(async(q="")=>{try{const response=await fetch("/api/friends?q="+encodeURIComponent(q));if(response.ok)setFriendData(await response.json())}catch{}},[]);
 useEffect(()=>{if(section!=="feed")return;const timer=setTimeout(()=>loadFriends(friendSearch),250);return()=>clearTimeout(timer)},[friendSearch,section,loadFriends]);
 async function friendAction(actionName:string,personId:string){setSaving("Updating friends…");try{const res=await fetch("/api/friends",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:actionName,personId})});const body=await res.json() as {error?:string};if(!res.ok)throw Error(body.error||"Could not update friendship.");await Promise.all([loadFriends(friendSearch),load()]);setNotice(actionName==="request"?"Friend request sent":"Friends updated");setTimeout(()=>setNotice(""),2500)}catch(e){setError(e instanceof Error?e.message:"Could not update friendship.")}finally{setSaving("")}}
 async function socialAction(actionName:"like"|"comment",id:string){const text=commentDrafts[id]||"";if(actionName==="comment"&&!text.trim())return;try{const res=await fetch("/api/social",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:actionName,id,text})});const body=await res.json() as {error?:string};if(!res.ok)throw Error(body.error||"Could not update post.");if(actionName==="comment")setCommentDrafts({...commentDrafts,[id]:""});const response=await fetch("/api/social?ids="+id);const updated=await response.json() as {items:typeof social};setSocial(previous=>({...previous,...updated.items}))}catch(e){setError(e instanceof Error?e.message:"Could not update post.")}}
 async function uploadAvatar(file:File|null){if(!file)return;setSaving("Uploading profile photo…");try{const form=new FormData();form.append("image",file);const res=await fetch("/api/avatar",{method:"POST",body:form});const body=await res.json() as {error?:string};if(!res.ok)throw Error(body.error||"Could not upload photo.");await load();setNotice("Profile photo updated");setTimeout(()=>setNotice(""),2500)}catch(e){setError(e instanceof Error?e.message:"Could not upload photo.")}finally{setSaving("")}}
 const privacyGoals=(data?.goals||[]).filter((g,i,a)=>a.findIndex(x=>x.kind===g.kind&&x.slot===g.slot)===i);
 const goalCount=dayDone+"/"+dailyGoals.length;

 return <div className={"app-shell "+(section==="group"?"group-theme":"me-theme")} style={{"--group-color":data?.circle.color||"#4566B5"} as React.CSSProperties}>
  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={e=>upload(e.target.files?.[0]||null)} />
  <aside className="sidebar">
   <div className="brand"><span className="brand-icon">K<span>↗</span></span><span>keep pace<span className="brand-dot">.</span></span></div>
   <div className="side-bottom"><div className="sidebar-note"><div className="kp-ticker-wrap"><div className="kp-ticker"><span>✳ Consistency is a team sport</span><span>✦ Show up. Every day.</span><span>◆ A little proof goes a long way</span><span>✳ Your friends are watching</span><span>✦ Small habits, big results</span><span>◆ Together is always better</span><span>✳ Consistency is a team sport</span><span>✦ Show up. Every day.</span><span>◆ A little proof goes a long way</span><span>✳ Your friends are watching</span><span>✦ Small habits, big results</span><span>◆ Together is always better</span></div></div></div><div className="profile"><Avatar person={data?.me||{id:"",name:"You",email:"",weekdayWake:"",weekendWake:"",weekdayBed:""}}/><span><strong>{data?.me.name||"Your space"}</strong><small>{data?.circle.name||"Accountability calendar"}</small></span><button aria-label="Settings" onClick={()=>setModal("settings")}><Settings2 size={17}/></button></div></div>
  </aside>
  <main className="main-area">
   <header className="topbar"><div className="mobile-brand"><span className="brand-icon">K<span>↗</span></span> keep pace.</div><div className="crumb">ACCOUNTABILITY <ChevronRight size={15}/> <strong>{section==="me"?"Me":section==="feed"?"Feed":section==="settings"?"Settings":data?.circle.name||"Group"}</strong></div><div className="header-actions"><button className="icon-button" aria-label="Goal settings" onClick={()=>setModal("settings")}><Settings2 size={19}/></button><button className="invite-button" onClick={()=>{setSection("group");setModal("share")}}><Share2 size={17}/> <span>Invite friends</span></button></div></header>
   <div className="content">
    <section className="intro"><div><p className="eyebrow">{section==="me"?"YOUR GOALS":section==="feed"?"FRIEND ACTIVITY":section==="settings"?"YOUR ACCOUNT":"SHOW UP TOGETHER"}</p><h1 className="kp-gradient-text">{section==="me"?"Today’s plan":section==="feed"?"Activity":section==="settings"?"Settings":data?.circle.name||"Group"}</h1><p>{section==="me"?"Your chosen goals from every group.":section==="feed"?"Updates from friends and groups.":section==="settings"?"Manage your profile and visibility.":"Track your progress alongside friends."}</p></div>{section==="group"&&<div className="week-score"><div className="score-ring" style={{background:"conic-gradient("+(data?.circle.color||"#4566B5")+" "+groupWeekRate+"%, #e9eee6 0)"}}><span>{groupWeekRate}%</span></div><div><strong>Selected week</strong><small>{groupWeekStats.done} of {groupWeekStats.expected} group tasks</small></div></div>}</section>
    {section==="me"&&<div className="progress-trio">{progressCircles.map(({label,stats,color})=>{const rate=stats.expected?Math.round(stats.done/stats.expected*100):0;return <div className="progress-card" key={label} style={{"--progress-color":color} as React.CSSProperties}><div className="progress-ring" style={{background:`conic-gradient(${color} ${rate}%,#edf0ee 0)`}}><span>{rate}%</span></div><div><strong>{label}</strong><small>{stats.done} of {stats.expected} goals</small></div></div>})}</div>}
    {section==="group"&&<div className="group-strip"><div className="group-chips">{data?.groups.map(group=><button key={group.id} className={group.id===data.circle.id?"active":""} onClick={()=>{setGroupId(group.id);setCalendarPerson("all");setCalendarTask("all")}}>{group.name}</button>)}</div><button className="group-add" onClick={()=>setModal("newgroup")}><Plus size={16}/> New group</button><button className="group-add" onClick={()=>setModal("share")}><Link2 size={16}/> Join / invite</button>{data?.circle.ownerId===data?.me.id&&<button className="group-add" onClick={()=>{setGroupName(data!.circle.name);setGroupColor(data!.circle.color);setModal("editgroup")}}><Settings2 size={16}/> Edit group</button>}</div>}
    {section==="me"&&<div className="me-tabs"><button className={meTab==="activity"?"active":""} onClick={()=>setMeTab("activity")}>My Activity</button><button className={meTab==="profile"?"active":""} onClick={()=>setMeTab("profile")}>My Profile</button></div>}
    {section==="me"&&meTab==="activity"&&<button className="participation-tab" onClick={()=>setModal("participation")}><CheckCircle2 size={16}/><span>Goals you're taking part in</span><small>{data?scopeGoals.filter(g=>chosen(data.me.id,g.id)).length:0} active</small><ChevronRight size={16}/></button>}
    {section==="me"&&meTab==="profile"&&<section className="profile-page">
      <div className="profile-hero">
        <div className="profile-avatar-wrap">
          <label className="profile-avatar-label" title="Change photo">
            <Avatar person={data?.me||{id:"",name:"You",email:"",weekdayWake:"",weekendWake:"",weekdayBed:""}}/>
            <span className="profile-avatar-overlay"><Camera size={16}/></span>
            <Input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={e=>uploadAvatar(e.target.files?.[0]||null)}/>
          </label>
        </div>
        <div className="profile-hero-info">
          <h2 className="profile-name">{data?.me.name||"Your name"}</h2>
          <p className="profile-email">{data?.me.email||""}</p>
          <div className="profile-badges">
            {data?.groups.map(g=><span key={g.id} className="profile-badge" style={{"--badge-color":g.color} as React.CSSProperties}>{g.name}</span>)}
          </div>
        </div>
        <button className="profile-edit-btn" onClick={()=>setModal("settings")}><Settings2 size={16}/> Edit</button>
      </div>

      <div className="profile-stats-row">
        {progressCircles.map(({label,stats,color})=>{const rate=stats.expected?Math.round(stats.done/stats.expected*100):0;return(
          <div className="profile-stat-card" key={label} style={{"--stat-color":color} as React.CSSProperties}>
            <div className="profile-stat-ring" style={{background:`conic-gradient(${color} ${rate}%, #ece4d6 0)`}}>
              <span>{rate}<i>%</i></span>
            </div>
            <strong>{label}</strong>
            <small>{stats.done}/{stats.expected}</small>
          </div>
        )})}
      </div>

      <div className="profile-schedule">
        <h3 className="profile-section-label">YOUR SCHEDULE</h3>
        <div className="profile-schedule-grid">
          <div className="profile-schedule-item"><span className="psi-icon"><Sunrise size={17}/></span><div><strong>Weekday wake-up</strong><span>{fmtTime(data?.me.weekdayWake||"07:00")}</span></div></div>
          <div className="profile-schedule-item"><span className="psi-icon"><Sunrise size={17}/></span><div><strong>Weekend wake-up</strong><span>{fmtTime(data?.me.weekendWake||"09:00")}</span></div></div>
          <div className="profile-schedule-item"><span className="psi-icon"><Clock3 size={17}/></span><div><strong>Bedtime</strong><span>{fmtTime(data?.me.weekdayBed||"23:00")}</span></div></div>
          <div className="profile-schedule-item"><span className="psi-icon"><Bell size={17}/></span><div><strong>Daily reminder</strong><span>{data?.me.reminderTime?fmtTime(data.me.reminderTime):"Off"}</span></div></div>
        </div>
      </div>

      <div className="profile-groups-section">
        <h3 className="profile-section-label">YOUR CREWS</h3>
        {data?.groups.length?<div className="profile-groups-list">{data.groups.map(g=>{const members=data.memberships.filter(m=>m.circleId===g.id).length;const myGoals=sortGoals(data.goals.filter(x=>x.circleId===g.id&&x.active&&chosen(data.me.id,x.id)));return(<div className="profile-group-card" key={g.id} style={{"--g-color":g.color} as React.CSSProperties}><div className="pgc-top"><span className="pgc-dot"/><strong>{g.name}</strong><small>{members} member{members!==1?"s":""}</small></div><div className="pgc-goals">{myGoals.slice(0,4).map(x=><span key={x.id}>{x.title}</span>)}{myGoals.length>4&&<span>+{myGoals.length-4} more</span>}</div><button className="pgc-invite" onClick={()=>{setGroupId(g.id);setModal("share")}}><Link2 size={13}/> Invite</button></div>)})}</div>:<p className="empty-weekly">No groups yet. Join one with an invite link or create your own.</p>}
        <button className="profile-new-group-btn" onClick={()=>setModal("newgroup")}><Plus size={15}/> New group</button>
      </div>

      <div className="profile-privacy-section">
        <h3 className="profile-section-label">VISIBILITY</h3>
        <p className="profile-privacy-note">Choose who can see each habit in the feed.</p>
        <div className="profile-privacy-list">{privacyGoals.map(g=>{const visibility=data?.privacy.find(x=>x.personId===data?.me.id&&x.kind===g.kind&&x.slot===g.slot)?.visibility||"group";return(<label className="profile-privacy-row" key={g.kind+g.slot}><span>{g.title}</span><select value={visibility} onChange={e=>action({action:"privacy",kind:g.kind,slot:g.slot,visibility:e.target.value})}><option value="private">Only me</option><option value="group">My groups</option><option value="public">Public</option></select></label>)})}</div>
      </div>
    </section>}
    {error&&<div className="error-banner" role="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError("")}><X size={17}/></button></div>}
    {notice&&<div className="notice" role="status"><Check size={16}/>{notice}</div>}
    {section==="group"&&<div className="compare-filters"><label>Person<select value={calendarPerson} onChange={e=>setCalendarPerson(e.target.value)}><option value="all">Everyone</option>{groupPeople.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Task<select value={calendarTask} onChange={e=>setCalendarTask(e.target.value)}><option value="all">All tasks</option>{groupGoals.filter((g,i,a)=>a.findIndex(x=>x.kind===g.kind&&x.slot===g.slot)===i).map(g=><option key={g.id} value={g.kind+":"+g.slot}>{g.title}</option>)}</select></label></div>}
    {section==="settings"?<section className="settings-page"><div className="panel-heading"><div><span className="section-kicker">PROFILE</span><h2>Your photo and goals</h2></div></div><div className="settings-profile"><Avatar person={data?.me||{id:"",name:"You",email:"",weekdayWake:"",weekendWake:"",weekdayBed:""}}/><label>Change profile photo<Input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={e=>uploadAvatar(e.target.files?.[0]||null)}/></label></div><div className="form-grid"><label>Your name<Input maxLength={50} value={settings.name} onChange={e=>setSettings({...settings,name:e.target.value})}/></label><label>Weekday wake-up<Input type="time" value={settings.weekdayWake} onChange={e=>setSettings({...settings,weekdayWake:e.target.value})}/></label><label>Weekend wake-up<Input type="time" value={settings.weekendWake} onChange={e=>setSettings({...settings,weekendWake:e.target.value})}/></label><label>Weekday bedtime<Input type="time" value={settings.weekdayBed} onChange={e=>setSettings({...settings,weekdayBed:e.target.value})}/></label><label>Daily reminder<Input type="time" value={settings.reminderTime} onChange={e=>setSettings({...settings,reminderTime:e.target.value})}/></label></div><div className="reminder-row"><div><strong>Browser reminders</strong><small>When the app is open and tasks are incomplete.</small></div><Switch checked={settings.reminders} onCheckedChange={v=>setSettings({...settings,reminders:v})}/></div><Button className="modal-primary" disabled={!!saving} onClick={saveSettings}>Save schedule</Button><div className="push-setting"><span className="push-icon"><Bell size={19}/></span><div><strong>Friend activity alerts</strong><small>Notifications for visible check-ins and photos. Each friend enables alerts on their own phone.</small></div><Button variant={pushEnabled?"outline":"default"} onClick={pushEnabled?disablePush:enablePush}>{pushEnabled?"Turn off":"Enable"}</Button></div><div className="privacy-section"><h2>Who sees each habit</h2><p>Only you hides updates from everyone else. Group shares with groups where you participate. Public lets anyone on Keep Pace view the update; friends will see it in their feed.</p>{privacyGoals.map(g=>{const visibility=data?.privacy.find(x=>x.personId===data.me.id&&x.kind===g.kind&&x.slot===g.slot)?.visibility||"group";return <label className="privacy-row" key={g.kind+g.slot}><span>{g.title}</span><select value={visibility} onChange={e=>action({action:"privacy",kind:g.kind,slot:g.slot,visibility:e.target.value})}><option value="private">Only me</option><option value="group">My groups</option><option value="public">Public</option></select></label>})}</div></section>:section==="feed"?<section className="feed-panel"><div className="feed-tabs"><button className={feedTab==="myfeed"?"active":""} onClick={()=>setFeedTab("myfeed")}>My Feed</button><button className={feedTab==="fof"?"active":""} onClick={()=>setFeedTab("fof")}>Friends of Friends</button><button className={feedTab==="friends"?"active":""} onClick={()=>setFeedTab("friends")}>My Friends</button></div><div className="panel-heading"><div><span className="section-kicker">LATEST UPDATES</span><h2>Activity across your groups and friends</h2></div></div><details className="friend-panel"><summary><Users size={17}/> Friends & requests <span>{friendData.relations.filter(x=>x.status==="pending"&&x.recipientId===data?.me.id).length||""}</span></summary><div className="friend-content"><label>Find friends by name or exact email<Input value={friendSearch} onChange={e=>setFriendSearch(e.target.value)} placeholder="Search people on Keep Pace"/></label>{friendData.relations.filter(x=>x.status==="pending"&&x.recipientId===data?.me.id).length>0&&<div><h3>Requests to you</h3>{friendData.relations.filter(x=>x.status==="pending"&&x.recipientId===data?.me.id).map(x=><div className="friend-row" key={x.id}><Avatar person={{...data!.me,id:x.personId,name:x.name,avatarKey:x.avatarKey}} size="small"/><span>{x.name}</span><button disabled={!!saving} onClick={()=>friendAction("accept",x.personId)}>Accept</button><button disabled={!!saving} onClick={()=>friendAction("decline",x.personId)}>Decline</button></div>)}</div>}{friendData.relations.filter(x=>x.status==="accepted").length>0&&<div><h3>Friends</h3>{friendData.relations.filter(x=>x.status==="accepted").map(x=><div className="friend-row" key={x.id}><Avatar person={{...data!.me,id:x.personId,name:x.name,avatarKey:x.avatarKey}} size="small"/><span>{x.name}</span><button disabled={!!saving} onClick={()=>friendAction("remove",x.personId)}>Remove</button></div>)}</div>}<div><h3>{friendSearch.length>=2?"Search results":"People in your groups"}</h3>{(friendSearch.length>=2?friendData.matches:friendData.suggested).filter(p=>!friendData.relations.some(r=>r.personId===p.id&&r.status==="accepted")).map(p=>{const relation=friendData.relations.find(r=>r.personId===p.id);return <div className="friend-row" key={p.id}><Avatar person={{...data!.me,id:p.id,name:p.name,avatarKey:p.avatarKey}} size="small"/><span>{p.name}</span>{relation?<small>{relation.requesterId===data?.me.id?"Request sent":"Respond above"}</small>:<button disabled={!!saving} onClick={()=>friendAction("request",p.id)}>Add friend</button>}</div>})}</div></div></details><div className="compare-filters"><label>Group<select value={feedGroup} onChange={e=>{setFeedGroup(e.target.value);setFeedPerson("all");setFeedTask("all")}}><option value="all">Groups + friends</option>{data?.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label><label>Person<select value={feedPerson} onChange={e=>setFeedPerson(e.target.value)}><option value="all">Everyone</option>{filterPeople.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Task<select value={feedTask} onChange={e=>setFeedTask(e.target.value)}><option value="all">All tasks</option>{filterGoals.map(g=><option key={g.id} value={g.kind+":"+g.slot}>{g.title}</option>)}</select></label></div>{filteredFeed.length?<div className="feed-list">{filteredFeed.map(c=>{const person=data?.people.find(p=>p.id===c.personId),groups=entryGroups(c);let detail:{description?:string;additional?:string;exercises?:{name:string;sets:string;weight:string}[]}={};try{detail=JSON.parse(c.details||"{}") as typeof detail}catch{}return <article className="feed-card" key={c.id}><Avatar person={person||data!.me}/><div><div className="feed-top"><strong>{person?.name||"Member"}</strong><small>{fromKey(c.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})} · {c.loggedTime?fmtTime(c.loggedTime):"Time not recorded"}</small></div><p>{goalName(c.kind,c.slot)}{c.kind==="workout"?" · "+(c.value||"Workout"):c.kind==="drinks"?" · "+c.value+" drinks":""}</p>{detail.description&&<p className="feed-description">{detail.description}</p>}{detail.exercises?.map((e,i)=><small className="feed-exercise" key={i}>{e.name}{e.sets?" · "+e.sets+" sets":""}{e.weight?" · "+e.weight:""}</small>)}{detail.additional&&<small className="feed-exercise">{detail.additional}</small>}<div className="feed-tags">{groups.map(g=><span key={g.id} style={{"--tag-color":g.color} as React.CSSProperties}>{g.name}</span>)}</div>{c.photoKey&&<img className="activity-photo" src={"/api/photo?id="+encodeURIComponent(c.id)} alt={"Check-in photo from "+(person?.name||"member")}/>}<div className="feed-social"><button className={social[c.id]?.liked?"liked":""} onClick={()=>socialAction("like",c.id)} aria-label={social[c.id]?.liked?"Unlike":"Like"}><Heart size={17} fill={social[c.id]?.liked?"currentColor":"none"}/>{social[c.id]?.likes||0}</button><button onClick={()=>setShowComments({...showComments,[c.id]:!showComments[c.id]})}><MessageCircle size={17}/>{social[c.id]?.comments.length||0} comments</button></div>{showComments[c.id]&&<div className="comments"><div>{(social[c.id]?.comments||[]).map(comment=><div className="comment" key={comment.id}><Avatar person={{...data!.me,id:comment.personId,name:comment.name,avatarKey:comment.avatarKey}} size="small"/><p><strong>{comment.name}</strong> {comment.body}</p></div>)}</div><div className="comment-compose"><Input maxLength={500} value={commentDrafts[c.id]||""} placeholder="Write a comment" onChange={e=>setCommentDrafts({...commentDrafts,[c.id]:e.target.value})} onKeyDown={e=>{if(e.key==="Enter")socialAction("comment",c.id)}}/><button disabled={!commentDrafts[c.id]?.trim()} onClick={()=>socialAction("comment",c.id)}>Post</button></div></div>}</div></article>})}</div>:<p className="empty-weekly">No updates match these filters. Load older activity to keep looking.</p>}{feedHasMore&&<button className="load-feed" disabled={feedLoading} onClick={loadMoreFeed}>{feedLoading?"Loading…":"Load older updates"}</button>}<div className="feed-calendar"><div className="panel-heading"><div><span className="section-kicker">COMPARE PROGRESS</span><h2>{view==="month"?month.toLocaleDateString("en-US",{month:"long",year:"numeric"}):weekLabel(start)}</h2></div><div className="calendar-tools"><div className="view-toggle"><button className={view==="week"?"active":""} onClick={()=>setView("week")}>Week</button><button className={view==="month"?"active":""} onClick={()=>{setMonth(monthStart(fromKey(selected)));setView("month")}}>Month</button></div><div className="calendar-nav"><button onClick={()=>view==="month"?goMonth(-1):goWeek(-1)} aria-label="Previous period"><ArrowLeft size={17}/></button><button onClick={()=>view==="month"?goMonth(1):goWeek(1)} aria-label="Next period"><ArrowRight size={17}/></button></div></div></div><div className="feed-calendar-scroll"><div className="feed-calendar-grid">{(view==="month"?Array.from({length:Math.round((monthGridEnd(month).getTime()-monthGridStart(month).getTime())/86400000)+1},(_,i)=>shift(monthGridStart(month),i)):Array.from({length:7},(_,i)=>shift(start,i))).map(day=><button key={dateKey(day)} className={"feed-calendar-day "+(selected===dateKey(day)?"selected":"")} onClick={()=>setSelected(dateKey(day))}><strong>{day.toLocaleDateString("en-US",{weekday:"short",day:"numeric"})}</strong>{feedCalendarPeople.map((p,i)=>{const x=feedProgress(p,day);return <span key={p.id}><i style={{background:feedGroup==="all"?data?.groups.find(g=>data.memberships.some(m=>m.personId===p.id&&m.circleId===g.id))?.color||crewColors[i%crewColors.length]:data?.groups.find(g=>g.id===feedGroup)?.color}}/>{p.id===data?.me.id?"You":p.name.split(" ")[0]} <b>{x.expected?Math.round(x.done/x.expected*100):0}%</b></span>})}</button>)}</div></div><p className="feed-calendar-note">Completed tasks ÷ selected goals. Group, person, and task filters apply to this calendar.</p></div></section>:<>{section==="group"&&<section className="calendar-panel">
     <div className="panel-heading"><div><span className="section-kicker">{section==="group"?"GROUP CALENDAR":"YOUR CALENDAR"}</span><h2>{view==="month"?month.toLocaleDateString("en-US",{month:"long",year:"numeric"}):weekLabel(start)}</h2></div><div className="calendar-tools"><div className="view-toggle" aria-label="Calendar view"><button className={view==="week"?"active":""} aria-pressed={view==="week"} onClick={()=>setView("week")}>Week</button><button className={view==="month"?"active":""} aria-pressed={view==="month"} onClick={()=>{setMonth(monthStart(fromKey(selected)));setView("month")}}>Month</button></div><div className="calendar-nav"><button onClick={()=>view==="month"?goMonth(-1):goWeek(-1)} aria-label={"Previous "+view}><ArrowLeft size={19}/></button><button className="today-nav" onClick={()=>{const now=new Date();setStart(weekStart(now));setMonth(monthStart(now));setSelected(dateKey(now))}}>Today</button><button onClick={()=>view==="month"?goMonth(1):goWeek(1)} aria-label={"Next "+view}><ArrowRight size={19}/></button></div></div></div>
     {view==="week" ? <div className="week-grid">{Array.from({length:7},(_,i)=>{
       const day=shift(start,i),key=dateKey(day),progress=section==="group"?comparison.reduce((sum,item)=>{const x=personProgress(item.person,day,item.scopeCircle);return {done:sum.done+x.done,expected:sum.expected+x.expected}},{done:0,expected:0}):personProgress(data?.me||{id:"",name:"",email:"",weekdayWake:"",weekendWake:"",weekdayBed:""},day);
       return <button key={key} className={"day-tile "+(selected===key?"selected ":"")+(key===todayKey()?"today ":"")} onClick={()=>setSelected(key)}>
         <span className="day-name">{day.toLocaleDateString("en-US",{weekday:"short"})}</span><strong>{day.getDate()}</strong>
         <span className="day-progress"><span style={{width:progress.expected?Math.min(100,progress.done/progress.expected*100)+"%":"0%"}}/></span><small>{section==="group"?comparison.length+" members":progress.done+"/"+progress.expected}</small>{section==="group"&&<span className="week-people">{comparison.map((item,j)=>{const x=personProgress(item.person,day,item.scopeCircle);return <span key={item.id}><i style={{background:crewColors[j%crewColors.length]}}/>{item.label} {x.expected?Math.round(x.done/x.expected*100):0}%</span>})}</span>}
       </button>})}</div> :
       <div className="month-view">
         <p className="month-explain">Completed check-ins ÷ chosen goals. Future days are excluded from totals. Each color represents {section==="group"?"a person":"a group"}.</p>
         <div className="month-standings">{comparison.map((item,i)=>{
           const stats=summaryDays.reduce((sum,day)=>{const x=personProgress(item.person,day,item.scopeCircle);return {done:sum.done+x.done,expected:sum.expected+x.expected}},{done:0,expected:0});
           return <div className="month-standing" key={item.id}><span className="standing-dot" style={{background:section==="group"?crewColors[i%crewColors.length]:data?.groups.find(g=>g.id===item.id)?.color||crewColors[i%crewColors.length]}}/><div><strong>{item.label}</strong><small>{stats.done}/{stats.expected} goals</small></div><b>{stats.expected?Math.round(stats.done/stats.expected*100)+"%":"—"}</b></div>
         })}</div>
         <div className="month-scroll"><div className="month-weekdays">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(x=><span key={x}>{x}</span>)}</div>
           <div className="month-grid">{Array.from({length:Math.round((monthGridEnd(month).getTime()-monthGridStart(month).getTime())/86400000)+1},(_,i)=>{
             const day=shift(monthGridStart(month),i),key=dateKey(day),out=day.getMonth()!==month.getMonth();
             return <button key={key} className={"month-day "+(out?"outside ":"")+(selected===key?"selected ":"")+(key===todayKey()?"today":"")} onClick={()=>{setSelected(key);setStart(weekStart(day));if(out)setMonth(monthStart(day))}} aria-label={day.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}>
               <span className="month-day-number">{day.getDate()}</span><div className="month-person-list">{comparison.map((item,j)=>{const x=personProgress(item.person,day,item.scopeCircle);return <span className="month-person" key={item.id} title={item.label+": "+x.done+" of "+x.expected+" goals"}><i style={{background:section==="group"?crewColors[j%crewColors.length]:data?.groups.find(g=>g.id===item.id)?.color||crewColors[j%crewColors.length],opacity:x.expected?.25+.75*x.done/x.expected:.25}}/><span className="month-person-name">{item.label}</span><b>{section==="group"?(x.expected?Math.round(x.done/x.expected*100):0)+"%":x.done+"/"+x.expected}</b></span>})}</div>
             </button>})}</div>
         </div>
         <div className="selected-day-team"><strong>{selectedDate.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})} · {section==="group"?"Crew":"Group"} progress</strong><div>{comparison.map((item,i)=>{const x=personProgress(item.person,selectedDate,item.scopeCircle);return <span key={item.id}><i style={{background:section==="group"?crewColors[i%crewColors.length]:data?.groups.find(g=>g.id===item.id)?.color||crewColors[i%crewColors.length]}}/>{item.label} <b>{section==="group"?(x.expected?Math.round(x.done/x.expected*100):0)+"%":x.done+"/"+x.expected}</b></span>})}</div></div>
       </div>}
     {section==="group"&&<div className="group-day-breakdown"><h3>{selectedDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})} · Task details</h3>{comparison.map(item=>{const tasks=groupGoals.filter(g=>(item.person.id===data?.me.id||data?.privacy.find(v=>v.personId===item.person.id&&v.kind===g.kind&&v.slot===g.slot)?.visibility!=="private")&&chosen(item.person.id,g.id)&&(calendarTask==="all"||g.kind+":"+g.slot===calendarTask)&&(g.cadence==="weekly"?selectedDate.getDay()===(g.kind==="drinks"?6:0):goalApplies(g,selectedDate)));const done=tasks.filter(g=>completedGoal(item.person,g,selectedDate)).length;return <div className="group-person-day" key={item.id}><strong>{item.label} · {tasks.length?Math.round(done/tasks.length*100):0}%</strong><div>{tasks.length?tasks.map(g=>{const entry=find(item.person.id,selected,g.kind,g.slot),complete=completedGoal(item.person,g,selectedDate);return <span className={complete?"task-done":""} key={g.id}>{complete?"✓ ":"○ "}{g.title}{g.kind==="drinks"?" · ≤"+(g.target||6):entry?.loggedTime?" · "+fmtTime(entry.loggedTime):""}</span>}):<small>No tasks scheduled</small>}</div></div>})}</div>}
    </section>}
    </>}
    {section==="me"&&meTab==="activity"&&<div className="below-grid">
     <section className="daily-panel"><div className="panel-heading daily-heading"><div><span className="section-kicker">{selected===todayKey()?"TODAY'S CHECKLIST":"DAILY CHECKLIST"}</span><h2>{selectedDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</h2></div><span className="goal-count">{goalCount} done</span></div>
      {loading&&!data?<div className="loading">Loading your week…</div>:<div className="goals-list">{(["daily","weekday","weekend"] as const).map(cadence=>{const items=dailyGoals.filter(g=>g.cadence===cadence);return items.length?<div className="goal-schedule" key={cadence}><h3>{cadenceLabel[cadence]}</h3>{items.map(g=>{const entry=my(g.kind,g.slot),Icon=g.icon;const target=g.kind==="wake"?(isWeekend?data!.me.weekendWake:data!.me.weekdayWake):data!.me.weekdayBed;return <div className={"goal-row "+(entry?"completed":"")} key={g.id}><button className="goal-toggle" onClick={()=>toggle(g.kind,g.slot)} disabled={!!saving} aria-label={(entry?"Edit ":"Log ")+g.title}>{entry?<Check size={18} strokeWidth={3}/>:null}</button><span className="goal-icon"><Icon size={20}/></span><div className="goal-info"><strong>{g.title}</strong>{section==="me"&&<small className="goal-source">{data?.groups.find(group=>group.id===g.circleId)?.name}</small>}<span>{entry?(g.kind==="wake"||g.kind==="bed"?fmtTime(entry.value||"00:00")+(isOnTime(entry,target,g.kind)?" · On target":" · Past target"):g.kind==="workout"?entry.value+(entry.loggedTime?" · "+fmtTime(entry.loggedTime):""):(entry.loggedTime?fmtTime(entry.loggedTime):"Time not recorded")):g.hint}</span></div>{entry?<div className="goal-end">{entry.photoKey?<button className="photo-thumb" onClick={()=>choosePhoto(entry.id)} title="Replace photo"><img src={"/api/photo?id="+encodeURIComponent(entry.id)} alt="Check-in proof"/></button>:<button className="photo-action" onClick={()=>choosePhoto(entry.id)} aria-label={"Add a photo for "+g.title}><Camera size={18}/></button>}</div>:<button className="log-button" onClick={()=>toggle(g.kind,g.slot)} disabled={!!saving}>Log <Plus size={15}/></button>}</div>})}</div>:null})}</div>}
      <p className="panel-footnote"><Camera size={15}/> Add a photo after logging a check-in to show your crew.</p>
     </section>
     <aside className="right-column">
      <section className="weekly-panel"><div className="panel-heading"><div><span className="section-kicker">WEEKLY GOALS</span><h2>The bigger picture</h2></div></div>
       {weeklyGoals.length===0&&<p className="empty-weekly">Pick a weekly goal above to track it here.</p>}
       {(["sunday","weekly"] as const).map(cadence=>{const items=weeklyGoals.filter(g=>g.cadence===cadence);return items.length?<div className="goal-schedule" key={cadence}><h3>{cadenceLabel[cadence]}</h3>{items.map(g=>g.kind==="drinks"?<div className="weekly-goal" key={g.id}>
         <div className="drinks-heading"><span className="weekly-icon drinks"><Wine size={20}/></span><div><strong>{g.title}</strong><small>{section==="me"?data?.groups.find(group=>group.id===g.circleId)?.name+" · ":""}Keep it at {g.target||"6"} or fewer</small></div><span className={"drinks-count "+(drinks>Number(g.target||6)?"over":"")}>{drinks}<span> / {g.target||"6"}</span></span></div>
         <div className="drinks-meter"><span style={{width:Math.min(100,drinks/Number(g.target||6)*100)+"%",background:drinks>Number(g.target||6)?"#ec896b":undefined}}/></div>
         <div className="drink-controls"><span>{drinks>Number(g.target||6)?"Over your limit by "+(drinks-Number(g.target||6)):drinks===0?"No drinks logged yet":(Number(g.target||6)-drinks)+" remaining this week"}</span><div>{my("drinks",0,selected)&&Number(my("drinks",0,selected)?.value)>0&&<button aria-label="Add drinks photo" onClick={()=>choosePhoto(my("drinks",0,selected)!.id)}><Camera size={15}/></button>}<button className="drink-log-button" aria-label="Log drinks on selected day" disabled={!!saving} onClick={()=>openLog("drinks",0,selected)}>Log drinks</button></div></div><p className="drink-day-note">Logging for {selectedDate.toLocaleDateString("en-US",{weekday:"long"})}.</p>
       </div>:<div className="weekly-goal" key={g.id}><div className="weekly-item"><span className="weekly-icon food">{g.kind==="prep"?<Utensils size={20}/>:<CheckCircle2 size={20}/>}</span><div><strong>{g.title}</strong><small>{section==="me"?data?.groups.find(group=>group.id===g.circleId)?.name+" · ":""}{my(g.kind,g.slot,sunday)?"Done this week":"Complete once this week"}</small></div><button className={"mini-check "+(my(g.kind,g.slot,sunday)?"checked":"")} onClick={()=>toggle(g.kind,g.slot,sunday)} aria-label={"Toggle "+g.title}>{my(g.kind,g.slot,sunday)&&<Check size={17}/>}</button>{my(g.kind,g.slot,sunday)&&<button className="weekly-photo" onClick={()=>choosePhoto(my(g.kind,g.slot,sunday)!.id)} aria-label={"Add photo for "+g.title}><Camera size={17}/></button>}</div></div>)}</div>:null})}
      </section>

     </aside>
    </div>}
    <footer className="footer"><span>Keep Pace <span>↗</span></span><a href="/signout-with-chatgpt?return_to=%2F">Sign out</a></footer>
   </div>
  </main>
  <Dialog open={modal==="participation"} onOpenChange={v=>setModal(v?"participation":"")}><DialogContent className="app-dialog participation-dialog"><DialogHeader><DialogTitle>Make this yours</DialogTitle><DialogDescription>Set your order within each schedule. Your choices and order only affect you.</DialogDescription></DialogHeader><div className="order-list"><strong>Your order</strong>{(["daily","weekday","weekend","sunday","weekly"] as const).map(cadence=>{const list=orderedParticipation.filter(g=>g.cadence===cadence);return list.length?<div className="order-section" key={cadence}><h3>{cadenceLabel[cadence]}</h3>{list.map((g,i)=><div className="order-row" key={g.kind+g.slot}><span className="order-number">{String(i+1).padStart(2,"0")}</span><span className="order-title">{g.title}<small>{Math.floor(g.preferredMinutes/60)%12||12}:{String(g.preferredMinutes%60).padStart(2,"0")} {g.preferredMinutes<720?"AM":"PM"} · {data?.groups.filter(group=>data.goals.some(x=>x.circleId===group.id&&x.kind===g.kind&&x.slot===g.slot)).map(group=>group.name).join(", ")}</small></span><div className="order-controls"><button aria-label={"Move "+g.title+" earlier"} disabled={i===0||!!saving} onClick={()=>moveGoal(g,-1)}><ChevronUp size={17}/></button><button aria-label={"Move "+g.title+" later"} disabled={i===list.length-1||!!saving} onClick={()=>moveGoal(g,1)}><ChevronDown size={17}/></button></div></div>)}</div>:null})}</div><div className="participation-divider"><strong>Taking part in</strong><p>One check-in counts in every group where you choose the same goal.</p></div><div className="participation-groups">{(data?.groups||[]).map(group=><div className="participation-group" key={group.id}><div className="participation-group-name"><Users size={15}/><strong>{group.name}</strong></div><div className="participation-goals">{sortGoals((data?.goals||[]).filter(g=>g.circleId===group.id&&g.active)).map(g=><div key={g.id} className="participation-goal"><span>{g.title}<small>{cadenceLabel[g.cadence]}</small></span><Switch checked={chosen(data!.me.id,g.id)} onCheckedChange={()=>toggleChoice(g)} aria-label={(chosen(data!.me.id,g.id)?"Leave ":"Join ")+g.title+" in "+group.name}/></div>)}</div></div>)}</div>{error&&<p className="dialog-error" role="alert">{error}</p>}</DialogContent></Dialog>
  <Dialog open={modal==="editgroup"} onOpenChange={v=>setModal(v?"editgroup":"")}><DialogContent className="app-dialog edit-group-dialog"><DialogHeader><DialogTitle>Edit group</DialogTitle><DialogDescription>Set the name, color, and goals for {data?.circle.name}.</DialogDescription></DialogHeader><label className="time-entry">Group name<Input value={groupName} maxLength={50} onChange={e=>setGroupName(e.target.value)}/></label><div className="color-picker"><strong>Group color</strong><div>{groupPalette.map(color=><button key={color} type="button" aria-label={"Choose color "+color} aria-pressed={groupColor===color} className={groupColor===color?"selected":""} style={{background:color}} onClick={()=>setGroupColor(color)}>{groupColor===color&&<Check size={18}/>}</button>)}</div></div><Button className="modal-primary" disabled={!groupName.trim()||!!saving} onClick={saveGroup}>Save name & color</Button><div className="group-goals-edit"><strong>Group goals</strong><p>Turn goals on for this group. Members choose their own participation.</p><div className="edit-goal-list">{sortGoals((data?.goals||[]).filter(g=>g.circleId===data?.circle.id)).map(g=><div className="edit-goal-row" key={g.id}><div><strong>{g.title}</strong><small>{g.cadence==="weekly"?"Weekly":g.cadence==="sunday"?"Sunday":g.cadence==="weekday"?"Weekdays":g.cadence==="weekend"?"Weekends":"Daily"}</small></div>{g.kind==="drinks"&&<label className="limit-field">Limit <Input type="number" min={1} max={30} defaultValue={g.target||"6"} key={g.id+"-"+g.target} onBlur={e=>{if(e.target.value!==g.target)action({action:"goal_target",goalId:g.id,target:Number(e.target.value)})}}/></label>}<Switch checked={!!g.active} onCheckedChange={enabled=>action({action:"goal_active",goalId:g.id,enabled})} aria-label={(g.active?"Remove ":"Add ")+g.title+" from group"}/></div>)}</div><div className="custom-goal-form"><strong>Add a custom goal</strong><Input value={customTitle} maxLength={70} placeholder="e.g. Read 20 minutes" onChange={e=>setCustomTitle(e.target.value)}/><label className="custom-time">Typical time (optional)<Input type="time" value={customTime} onChange={e=>setCustomTime(e.target.value)}/><small>Leave blank to place it automatically around {new Date(2020,0,1,Math.floor(inferGoalMinutes(customTitle)/60),inferGoalMinutes(customTitle)%60).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}.</small></label><div><Select value={customCadence} onValueChange={v=>setCustomCadence(v as GroupGoal["cadence"])}><SelectTrigger aria-label="Goal schedule"><SelectValue/></SelectTrigger><SelectContent>{[["daily","Daily"],["weekday","Weekdays"],["weekend","Weekends"],["sunday","Sunday"],["weekly","Once a week"]].map(([value,label])=><SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Button disabled={!customTitle.trim()||!!saving} onClick={addGoal}>Add goal</Button></div></div></div>{error&&<p className="dialog-error" role="alert">{error}</p>}</DialogContent></Dialog>
  <Dialog open={modal==="settings"} onOpenChange={v=>setModal(v?"settings":"")}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Goals & reminders</DialogTitle><DialogDescription>Set targets that work for your schedule.</DialogDescription></DialogHeader><div className="form-grid"><label>Your name<Input maxLength={50} value={settings.name} onChange={e=>setSettings({...settings,name:e.target.value})}/></label><label>Weekday wake-up<Input type="time" value={settings.weekdayWake} onChange={e=>setSettings({...settings,weekdayWake:e.target.value})}/></label><label>Weekend wake-up<Input type="time" value={settings.weekendWake} onChange={e=>setSettings({...settings,weekendWake:e.target.value})}/></label><label>Weekday bedtime<Input type="time" value={settings.weekdayBed} onChange={e=>setSettings({...settings,weekdayBed:e.target.value})}/></label><label>Daily reminder time<Input type="time" value={settings.reminderTime} onChange={e=>setSettings({...settings,reminderTime:e.target.value})}/></label></div><div className="reminder-row"><div><strong>Browser reminder</strong><small>Alerts when this page is open and your check-ins are incomplete.</small></div><Switch checked={settings.reminders} onCheckedChange={v=>setSettings({...settings,reminders:v})} aria-label="Enable browser reminders"/></div><div className="push-setting"><span className="push-icon"><Bell size={19}/></span><div><strong>Friend activity on your phone</strong><small>Get a push when a friend logs a goal or adds a photo, even when the app is closed. Each friend turns this on separately.</small><small>On iPhone: Safari → Share → Add to Home Screen; open the new icon, then enable alerts here.</small></div><Button variant={pushEnabled?"outline":"default"} onClick={pushEnabled?disablePush:enablePush} disabled={!!saving}>{pushEnabled?"Turn off":"Enable"}</Button></div>{error&&<p className="dialog-error" role="alert">{error}</p>}<Button className="modal-primary" disabled={!!saving} onClick={saveSettings}>Save goals</Button></DialogContent></Dialog>
  <Dialog open={modal==="share"} onOpenChange={v=>{setModal(v?"share":"");if(!v)history.replaceState(null,"","/")}}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Bring your crew in</DialogTitle><DialogDescription>Everyone who joins can view each other's check-ins and photos.</DialogDescription></DialogHeader><div className="invite-card"><span className="invite-symbol"><Link2 size={23}/></span><strong>Share your group link</strong><p>Send this to your friends. They'll sign in and join {data?.circle.name}.</p><div className="copy-row"><Input readOnly value={inviteUrl} onFocus={e=>e.target.select()}/><Button onClick={copyInvite}>Copy</Button></div></div><div className="join-section"><strong>Have an invite from a friend?</strong><div className="copy-row"><Input value={inviteInput} placeholder="Paste link or invite code" onChange={e=>setInviteInput(e.target.value)}/><Button variant="outline" disabled={!inviteInput.trim()||!!saving} onClick={join}>Join</Button></div></div></DialogContent></Dialog>
  <Dialog open={modal==="newgroup"} onOpenChange={v=>setModal(v?"newgroup":"")}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Create a group</DialogTitle><DialogDescription>Give it a name, then choose its goals and invite friends.</DialogDescription></DialogHeader><label className="time-entry">Group name<Input value={newGroupName} maxLength={50} placeholder="e.g. Morning crew" onChange={e=>setNewGroupName(e.target.value)}/></label><Button className="modal-primary" disabled={!newGroupName.trim()||!!saving} onClick={createGroup}>Create group</Button></DialogContent></Dialog>
  <Dialog open={modal==="log"} onOpenChange={v=>setModal(v?"log":"")}><DialogContent className="app-dialog log-dialog"><DialogHeader><DialogTitle>{my(logKind,logSlot,logDate)?"Edit":"Log"} {goalName(logKind,logSlot)}</DialogTitle><DialogDescription>{logDate&&fromKey(logDate).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})} · Time is required. Photo is optional.</DialogDescription></DialogHeader><label className="time-entry">Time completed<Input type="time" required value={loggedTime} onChange={e=>setLoggedTime(e.target.value)}/></label>{logKind==="drinks"&&<label className="time-entry">Drinks on this day<Input type="number" min={0} max={30} value={logCount} onChange={e=>setLogCount(Number(e.target.value))}/></label>}{logKind==="workout"&&<div className="workout-form"><strong>Workout type</strong><div className="workout-options">{["Lift","Run","Swim","Bike","Golf","Other"].map(x=><button type="button" key={x} className={workType===x?"picked":""} onClick={()=>setWorkType(x)}>{x}</button>)}</div><label className="time-entry">Workout description <span>(required)</span><textarea required maxLength={300} placeholder={workType==="Lift"?"Push day · bench, rows, dips":"6:37 pace · 4 miles"} value={workDescription} onChange={e=>setWorkDescription(e.target.value)}/></label><div className="exercise-heading"><strong>Exercises (optional)</strong><button type="button" onClick={()=>setWorkExercises([...workExercises,{name:"",sets:"",weight:""}])}><Plus size={15}/> Add exercise</button></div>{workExercises.map((e,i)=><div className="exercise-row" key={i}><Input aria-label={"Exercise "+(i+1)} placeholder="Exercise" value={e.name} onChange={event=>setWorkExercises(workExercises.map((x,j)=>j===i?{...x,name:event.target.value}:x))}/><Input aria-label="Sets" placeholder="Sets" value={e.sets} onChange={event=>setWorkExercises(workExercises.map((x,j)=>j===i?{...x,sets:event.target.value}:x))}/><Input aria-label="Weight" placeholder="Weight" value={e.weight} onChange={event=>setWorkExercises(workExercises.map((x,j)=>j===i?{...x,weight:event.target.value}:x))}/><button type="button" aria-label="Remove exercise" onClick={()=>setWorkExercises(workExercises.filter((_,j)=>j!==i))}><X size={16}/></button></div>)}<label className="time-entry">Additional notes (optional)<textarea maxLength={500} value={workAdditional} onChange={e=>setWorkAdditional(e.target.value)} placeholder="Anything else you want to share"/></label></div>}<label className="log-photo">Photo (optional)<Input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={e=>setLogPhoto(e.target.files?.[0]||null)}/></label>{error&&<p className="dialog-error" role="alert">{error}</p>}<div className="time-actions">{my(logKind,logSlot,logDate)&&<Button variant="outline" disabled={!!saving} onClick={removeLog}>Remove</Button>}<Button className="modal-primary" disabled={!loggedTime||(logKind==="workout"&&!workDescription.trim())||!!saving} onClick={saveLog}>Save check-in</Button></div></DialogContent></Dialog>
  <nav className="bottom-nav" aria-label="Main navigation">{([{id:"feed",label:"Feed",icon:Bell},{id:"group",label:"Groups",icon:Users},{id:"me",label:"Me",icon:UserRound},{id:"settings",label:"Settings",icon:Settings2}] as const).map(item=>{const Icon=item.icon;return <button key={item.id} className={section===item.id?"active":""} aria-current={section===item.id?"page":undefined} onClick={()=>setSection(item.id as typeof section)}><Icon size={21}/><span>{item.label}</span></button>})}</nav>
 </div>;
}
