"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bell, BedDouble, Camera, Check, CheckCircle2, ChevronRight, Clock3, Coffee, Dumbbell, Link2, Minus, Plus, Settings2, Share2, Sunrise, Users, Utensils, Wine, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { goalApplies, type GroupGoal } from "@/lib/goals";

type Person={id:string;name:string;email:string;weekdayWake:string;weekendWake:string;weekdayBed:string;reminderTime?:string;reminders?:number};
type Checkin={id:string;personId:string;date:string;kind:string;slot:number;value:string|null;photoKey:string|null;createdAt:number};
type Group={id:string;name:string;inviteCode:string;ownerId:string};
type Choice={goalId:string;personId:string;enabled:number};
type State={me:Person;circle:Group;groups:Group[];goals:GroupGoal[];choices:Choice[];people:Person[];checkins:Checkin[]};
type Goal={id:string;circleId:string;kind:string;slot:number;title:string;hint:string;icon:typeof Sunrise;cadence:GroupGoal["cadence"]};

const todayKey=()=>dateKey(new Date());
function dateKey(d:Date){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
function fromKey(key:string){const [y,m,d]=key.split("-").map(Number);return new Date(y,m-1,d)}
function shift(d:Date,n:number){const out=new Date(d);out.setDate(out.getDate()+n);return out}
function weekStart(d:Date){return shift(d,-(d.getDay()+6)%7)}
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
function Avatar({person,size="normal"}:{person:Person;size?:"normal"|"small"}){return <span className={"avatar "+(size==="small"?"avatar-small":"")} title={person.name}>{initials(person.name)}</span>}

export default function Dashboard(){
 const [start,setStart]=useState(()=>weekStart(new Date()));
 const [view,setView]=useState<"week"|"month">("week");
 const [month,setMonth]=useState(()=>monthStart(new Date()));
 const [section,setSection]=useState<"individual"|"group">("individual");
 const [groupId,setGroupId]=useState("");
 const [selected,setSelected]=useState(todayKey);
 const [data,setData]=useState<State|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [saving,setSaving]=useState("");
 const [notice,setNotice]=useState("");
 const [modal,setModal]=useState<""|"settings"|"share"|"workout"|"newgroup"|"editgoals"|"participation"|"rename">("");
 const [newGroupName,setNewGroupName]=useState("");
 const [groupName,setGroupName]=useState("");
 const [customTitle,setCustomTitle]=useState("");
 const [customCadence,setCustomCadence]=useState<GroupGoal["cadence"]>("daily");
 const [workSlot,setWorkSlot]=useState(0);
 const [workType,setWorkType]=useState("Lift");
 const [actualTime,setActualTime]=useState("");
 const [timeGoal,setTimeGoal]=useState<""|"wake"|"bed">("");
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
     setData(json);setError("");
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
 const scopeGoals=(data?.goals||[]).filter(g=>g.active && (section==="individual" || g.circleId===data?.circle.id));
 const dailyGoals=scopeGoals.filter(g=>g.cadence!=="weekly" && goalApplies(g,selectedDate) && chosen(data!.me.id,g.id)).map(g=>displayGoal(g,data!.me,selectedDate));
 const weeklyGoals=scopeGoals.filter(g=>(g.cadence==="weekly"||g.cadence==="sunday")&&chosen(data!.me.id,g.id));
 const sunday=dateKey(shift(start,6));
 const weekEntries=myEntries.filter(c=>c.date>=dateKey(start) && c.date<=dateKey(shift(start,6)));
 const drinks=weekEntries.filter(c=>c.kind==="drinks").reduce((n,c)=>n+Number(c.value||0),0);
 const dayDone=dailyGoals.filter(g=>my(g.kind,g.slot)).length;
 const dueThisWeek=Array.from({length:7},(_,i)=>{const day=shift(start,i);return scopeGoals.filter(g=>g.kind!=="drinks" && (g.cadence==="weekly"?i===6:goalApplies(g,day)) && chosen(data!.me.id,g.id)).map(g=>({g,date:dateKey(day)}))}).flat();
 const totalWeek=dueThisWeek.filter(({g,date})=>my(g.kind,g.slot,date)).length;
 const weekTarget=dueThisWeek.length;
 const weekRate=weekTarget?Math.min(100,Math.round(totalWeek/weekTarget*100)):0;
 const recent=data?.checkins.filter(c=>c.personId!==data.me.id).slice(0,5)||[];
 const inviteUrl=typeof window!=="undefined" && data?window.location.origin+"/?join="+data.circle.inviteCode:"";
 const monthDays=Array.from({length:new Date(month.getFullYear(),month.getMonth()+1,0).getDate()},(_,i)=>new Date(month.getFullYear(),month.getMonth(),i+1));
 const summaryDays=monthDays.filter(day=>dateKey(day)<=todayKey());
 const personProgress=(p:Person,day:Date,scopeCircle=section==="group"?data?.circle.id:undefined)=>{
   const key=dateKey(day);
   const matching=(data?.goals||[]).filter(g=>g.active && g.kind!=="drinks" && (!scopeCircle||g.circleId===scopeCircle) && chosen(p.id,g.id) && (g.cadence==="weekly"?day.getDay()===0:goalApplies(g,day)));
   return {done:matching.filter(g=>find(p.id,key,g.kind,g.slot)).length,expected:matching.length};
 };
 const crewColors=["#326e4f","#8eb83e","#8066ac","#d18648","#368c9e","#bf6d83"];
 const comparison=section==="group"?(data?.people.map(p=>({id:p.id,label:p.id===data.me.id?"You":p.name.split(" ")[0],person:p,scopeCircle:data.circle.id}))||[]):(data?.groups.map(g=>({id:g.id,label:g.name,person:data.me,scopeCircle:g.id}))||[]);

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

 async function action(payload:Record<string,unknown>,status="Saving…"){
   setSaving(status);setError("");
   try{const response=await fetch("/api/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const body=await response.json() as {error?:string};if(!response.ok)throw Error(body.error||"Could not save.");
    await load();setNotice("Saved");setTimeout(()=>setNotice(""),2500);return true
   }catch(e){setError(e instanceof Error?e.message:"Could not save.");return false}
   finally{setSaving("")}
 }
 function toggle(kind:string,slot=0,date=selected,value?:string){
   const existing=my(kind,slot,date);
   if(kind==="wake" || kind==="bed"){setTimeGoal(kind);setActualTime(existing?.value||new Date().toTimeString().slice(0,5));return}
   if(kind==="workout" && !existing){setWorkSlot(slot);setWorkType("Lift");setModal("workout");return}
   action({action:"checkin",date,kind,slot,remove:!!existing,value});
 }
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
 async function renameGroup(){if(!data || !groupName.trim())return;const ok=await action({action:"rename",circleId:data.circle.id,name:groupName.trim()});if(ok)setModal("")}
 async function addGoal(){const ok=await action({action:"goal_add",circleId:data?.circle.id,title:customTitle,cadence:customCadence});if(ok)setCustomTitle("")}
 function toggleChoice(goal:GroupGoal){action({action:"goal_choice",goalId:goal.id,enabled:!chosen(data!.me.id,goal.id)})}
 const goalCount=dayDone+"/"+dailyGoals.length;

 return <div className="app-shell">
  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={e=>upload(e.target.files?.[0]||null)} />
  <aside className="sidebar">
   <div className="brand"><span className="brand-icon">K<span>↗</span></span><span>keep pace<span className="brand-dot">.</span></span></div>
   <div className="side-main"><p className="side-label">YOUR SPACE</p><button className={"nav-item "+(section==="individual"?"active":"")} onClick={()=>setSection("individual")}><span className="nav-icon">▦</span> Individual</button><button className={"nav-item "+(section==="group"?"active":"")} onClick={()=>setSection("group")}><Users size={19}/> Groups <span className="nav-count">{data?.groups.length||1}</span></button><button className="nav-item" onClick={()=>setModal("settings")}><Settings2 size={19}/> Goals & reminders</button></div>
   <div className="side-bottom"><div className="sidebar-note"><span className="note-spark">✳</span><strong>Consistency is a team sport.</strong><span>A little proof goes a long way.</span></div><div className="profile"><Avatar person={data?.me||{id:"",name:"You",email:"",weekdayWake:"",weekendWake:"",weekdayBed:""}}/><span><strong>{data?.me.name||"Your space"}</strong><small>{data?.circle.name||"Accountability calendar"}</small></span><button aria-label="Settings" onClick={()=>setModal("settings")}><Settings2 size={17}/></button></div></div>
  </aside>
  <main className="main-area">
   <header className="topbar"><div className="mobile-brand"><span className="brand-icon">K<span>↗</span></span> keep pace.</div><div className="crumb">ACCOUNTABILITY <ChevronRight size={15}/> <strong>{section==="individual"?"Individual":data?.circle.name||"Group"}</strong></div><div className="header-actions"><button className="icon-button" aria-label="Goal settings" onClick={()=>setModal("settings")}><Settings2 size={19}/></button><button className="invite-button" onClick={()=>{setSection("group");setModal("share")}}><Share2 size={17}/> <span>Invite friends</span></button></div></header>
   <div className="content">
    <section className="intro"><div><p className="eyebrow">{section==="individual"?"YOUR GOALS, ALL IN ONE PLACE":"SHOW UP TOGETHER"}</p><h1>{section==="individual"?"Your pace":"Your group"}<span className="period">.</span></h1><p>{section==="individual"?"Your chosen goals from every group.":"Track your progress alongside friends."}</p></div><div className="week-score"><div className="score-ring" style={{background:"conic-gradient(#c8f35e "+weekRate+"%, #e9eee6 0)"}}><span>{weekRate}%</span></div><div><strong>Selected week</strong><small>{totalWeek} of {weekTarget} goal check-ins</small></div></div></section>
    <nav className="section-tabs" aria-label="Accountability sections"><button className={section==="individual"?"active":""} aria-current={section==="individual"?"page":undefined} onClick={()=>setSection("individual")}>Individual</button><button className={section==="group"?"active":""} aria-current={section==="group"?"page":undefined} onClick={()=>setSection("group")}>Groups <span>{data?.groups.length||1}</span></button></nav>
    {section==="group"&&<div className="group-strip"><div className="group-chips">{data?.groups.map(group=><button key={group.id} className={group.id===data.circle.id?"active":""} onClick={()=>setGroupId(group.id)}>{group.name}</button>)}</div><button className="group-add" onClick={()=>setModal("newgroup")}><Plus size={16}/> New group</button><button className="group-add" onClick={()=>setModal("share")}><Link2 size={16}/> Join / invite</button>{data?.circle.ownerId===data?.me.id&&<button className="group-add" onClick={()=>{setGroupName(data!.circle.name);setModal("rename")}}><Settings2 size={16}/> Edit group name</button>}{data?.circle.ownerId===data?.me.id&&<button className="group-add" onClick={()=>setModal("editgoals")}><Settings2 size={16}/> Edit group goals</button>}</div>}
    <button className="participation-tab" onClick={()=>setModal("participation")}><CheckCircle2 size={16}/><span>Goals you're taking part in</span><small>{data?scopeGoals.filter(g=>chosen(data.me.id,g.id)).length:0} active</small><ChevronRight size={16}/></button>
    {error&&<div className="error-banner" role="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError("")}><X size={17}/></button></div>}
    {notice&&<div className="notice" role="status"><Check size={16}/>{notice}</div>}
    <section className="calendar-panel">
     <div className="panel-heading"><div><span className="section-kicker">YOUR CALENDAR</span><h2>{view==="month"?month.toLocaleDateString("en-US",{month:"long",year:"numeric"}):weekLabel(start)}</h2></div><div className="calendar-tools"><div className="view-toggle" aria-label="Calendar view"><button className={view==="week"?"active":""} aria-pressed={view==="week"} onClick={()=>setView("week")}>Week</button><button className={view==="month"?"active":""} aria-pressed={view==="month"} onClick={()=>{setMonth(monthStart(fromKey(selected)));setView("month")}}>Month</button></div><div className="calendar-nav"><button onClick={()=>view==="month"?goMonth(-1):goWeek(-1)} aria-label={"Previous "+view}><ArrowLeft size={19}/></button><button className="today-nav" onClick={()=>{const now=new Date();setStart(weekStart(now));setMonth(monthStart(now));setSelected(dateKey(now))}}>Today</button><button onClick={()=>view==="month"?goMonth(1):goWeek(1)} aria-label={"Next "+view}><ArrowRight size={19}/></button></div></div></div>
     {view==="week" ? <div className="week-grid">{Array.from({length:7},(_,i)=>{
       const day=shift(start,i),key=dateKey(day),progress=personProgress(data?.me||{id:"",name:"",email:"",weekdayWake:"",weekendWake:"",weekdayBed:""},day);
       return <button key={key} className={"day-tile "+(selected===key?"selected ":"")+(key===todayKey()?"today ":"")} onClick={()=>setSelected(key)}>
         <span className="day-name">{day.toLocaleDateString("en-US",{weekday:"short"})}</span><strong>{day.getDate()}</strong>
         <span className="day-progress"><span style={{width:progress.expected?Math.min(100,progress.done/progress.expected*100)+"%":"0%"}}/></span><small>{progress.done}/{progress.expected}</small>
       </button>})}</div> :
       <div className="month-view">
         <p className="month-explain">Completed check-ins ÷ chosen goals. Future days are excluded from totals. Each color represents {section==="group"?"a person":"a group"}.</p>
         <div className="month-standings">{comparison.map((item,i)=>{
           const stats=summaryDays.reduce((sum,day)=>{const x=personProgress(item.person,day,item.scopeCircle);return {done:sum.done+x.done,expected:sum.expected+x.expected}},{done:0,expected:0});
           return <div className="month-standing" key={item.id}><span className="standing-dot" style={{background:crewColors[i%crewColors.length]}}/><div><strong>{item.label}</strong><small>{stats.done}/{stats.expected} goals</small></div><b>{stats.expected?Math.round(stats.done/stats.expected*100)+"%":"—"}</b></div>
         })}</div>
         <div className="month-scroll"><div className="month-weekdays">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(x=><span key={x}>{x}</span>)}</div>
           <div className="month-grid">{Array.from({length:Math.round((monthGridEnd(month).getTime()-monthGridStart(month).getTime())/86400000)+1},(_,i)=>{
             const day=shift(monthGridStart(month),i),key=dateKey(day),out=day.getMonth()!==month.getMonth();
             return <button key={key} className={"month-day "+(out?"outside ":"")+(selected===key?"selected ":"")+(key===todayKey()?"today":"")} onClick={()=>{setSelected(key);setStart(weekStart(day));if(out)setMonth(monthStart(day))}} aria-label={day.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}>
               <span className="month-day-number">{day.getDate()}</span><div className="month-person-list">{comparison.map((item,j)=>{const x=personProgress(item.person,day,item.scopeCircle);return <span className="month-person" key={item.id} title={item.label+": "+x.done+" of "+x.expected+" goals"}><i style={{background:crewColors[j%crewColors.length],opacity:x.expected?.25+.75*x.done/x.expected:.25}}/><span className="month-person-name">{item.label}</span><b>{x.done}/{x.expected}</b></span>})}</div>
             </button>})}</div>
         </div>
         <div className="selected-day-team"><strong>{selectedDate.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})} · {section==="group"?"Crew":"Group"} progress</strong><div>{comparison.map((item,i)=>{const x=personProgress(item.person,selectedDate,item.scopeCircle);return <span key={item.id}><i style={{background:crewColors[i%crewColors.length]}}/>{item.label} <b>{x.done}/{x.expected}</b></span>})}</div></div>
       </div>}

    </section>
    <div className="below-grid">
     <section className="daily-panel"><div className="panel-heading daily-heading"><div><span className="section-kicker">{selected===todayKey()?"TODAY'S CHECKLIST":"DAILY CHECKLIST"}</span><h2>{selectedDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</h2></div><span className="goal-count">{goalCount} done</span></div>
      {loading&&!data?<div className="loading">Loading your week…</div>:<div className="goals-list">{dailyGoals.map(g=>{const entry=my(g.kind,g.slot),Icon=g.icon;const target=g.kind==="wake"?(isWeekend?data!.me.weekendWake:data!.me.weekdayWake):data!.me.weekdayBed;return <div className={"goal-row "+(entry?"completed":"")} key={g.id}><button className="goal-toggle" onClick={()=>toggle(g.kind,g.slot)} disabled={!!saving} aria-label={(entry?"Remove ":"Complete ")+g.title}>{entry?<Check size={18} strokeWidth={3}/>:null}</button><span className="goal-icon"><Icon size={20}/></span><div className="goal-info"><strong>{g.title}</strong>{section==="individual"&&<small className="goal-source">{data?.groups.find(group=>group.id===g.circleId)?.name}</small>}<span>{entry?(g.kind==="wake"||g.kind==="bed"?fmtTime(entry.value||"00:00")+(isOnTime(entry,target,g.kind)?" · On target":" · Past target"):g.kind==="workout"?entry.value:"Done"):g.hint}</span></div>{entry?<div className="goal-end">{entry.photoKey?<button className="photo-thumb" onClick={()=>choosePhoto(entry.id)} title="Replace photo"><img src={"/api/photo?id="+encodeURIComponent(entry.id)} alt="Check-in proof"/></button>:<button className="photo-action" onClick={()=>choosePhoto(entry.id)} aria-label={"Add a photo for "+g.title}><Camera size={18}/></button>}</div>:<button className="log-button" onClick={()=>toggle(g.kind,g.slot)} disabled={!!saving}>Log <Plus size={15}/></button>}</div>})}</div>}
      <p className="panel-footnote"><Camera size={15}/> Add a photo after logging a check-in to show your crew.</p>
     </section>
     <aside className="right-column">
      <section className="weekly-panel"><div className="panel-heading"><div><span className="section-kicker">WEEKLY GOALS</span><h2>The bigger picture</h2></div></div>
       {weeklyGoals.length===0&&<p className="empty-weekly">Pick a weekly goal above to track it here.</p>}
       {weeklyGoals.map(g=>g.kind==="drinks"?<div className="weekly-goal" key={g.id}>
         <div className="drinks-heading"><span className="weekly-icon drinks"><Wine size={20}/></span><div><strong>{g.title}</strong><small>{section==="individual"?data?.groups.find(group=>group.id===g.circleId)?.name+" · ":""}Keep it at {g.target||"6"} or fewer</small></div><span className={"drinks-count "+(drinks>Number(g.target||6)?"over":"")}>{drinks}<span> / {g.target||"6"}</span></span></div>
         <div className="drinks-meter"><span style={{width:Math.min(100,drinks/Number(g.target||6)*100)+"%",background:drinks>Number(g.target||6)?"#ec896b":undefined}}/></div>
         <div className="drink-controls"><span>{drinks>Number(g.target||6)?"Over your limit by "+(drinks-Number(g.target||6)):drinks===0?"No drinks logged yet":(Number(g.target||6)-drinks)+" remaining this week"}</span><div>{my("drinks",0,selected)&&Number(my("drinks",0,selected)?.value)>0&&<button aria-label="Add drinks photo" onClick={()=>choosePhoto(my("drinks",0,selected)!.id)}><Camera size={15}/></button>}<button aria-label="Remove one drink on selected day" disabled={!my("drinks",0,selected)||Number(my("drinks",0,selected)?.value)<=0||!!saving} onClick={()=>action({action:"checkin",date:selected,kind:"drinks",value:Number(my("drinks",0,selected)?.value||0)-1})}><Minus size={15}/></button><button aria-label="Log one drink on selected day" disabled={!!saving} onClick={()=>action({action:"checkin",date:selected,kind:"drinks",value:Number(my("drinks",0,selected)?.value||0)+1})}><Plus size={15}/></button></div></div><p className="drink-day-note">Logging for {selectedDate.toLocaleDateString("en-US",{weekday:"long"})}.</p>
       </div>:<div className="weekly-goal" key={g.id}><div className="weekly-item"><span className="weekly-icon food">{g.kind==="prep"?<Utensils size={20}/>:<CheckCircle2 size={20}/>}</span><div><strong>{g.title}</strong><small>{section==="individual"?data?.groups.find(group=>group.id===g.circleId)?.name+" · ":""}{my(g.kind,g.slot,sunday)?"Done this week":"Complete once this week"}</small></div><button className={"mini-check "+(my(g.kind,g.slot,sunday)?"checked":"")} onClick={()=>toggle(g.kind,g.slot,sunday)} aria-label={"Toggle "+g.title}>{my(g.kind,g.slot,sunday)&&<Check size={17}/>}</button>{my(g.kind,g.slot,sunday)&&<button className="weekly-photo" onClick={()=>choosePhoto(my(g.kind,g.slot,sunday)!.id)} aria-label={"Add photo for "+g.title}><Camera size={17}/></button>}</div></div>)}
      </section>
      {section==="group"&&<section className="crew-panel"><div className="panel-heading"><div><span className="section-kicker">TOGETHER IS BETTER</span><h2>Your crew</h2></div><button className="link-button" onClick={()=>setModal("share")}>Invite <ArrowRight size={16}/></button></div><div className="crew-avatars">{data?.people.map(p=><div className="crew-person" key={p.id}><Avatar person={p}/><span>{p.id===data.me.id?"You":p.name.split(" ")[0]}</span></div>)}</div><div className="crew-week-standings">{data?.people.map((p,i)=>{const stats=Array.from({length:7},(_,day)=>personProgress(p,shift(start,day),data.circle.id)).reduce((sum,x)=>({done:sum.done+x.done,expected:sum.expected+x.expected}),{done:0,expected:0});return <div key={p.id}><i style={{background:crewColors[i%crewColors.length]}}/><span>{p.id===data.me.id?"You":p.name.split(" ")[0]}</span><strong>{stats.done}/{stats.expected}</strong></div>})}</div>{recent.length?<div className="activity-list">{recent.map(c=>{const p=data!.people.find(p=>p.id===c.personId);return <div className="activity" key={c.id}><Avatar person={p||data!.me} size="small"/><div><strong>{p?.name||"Friend"}</strong> {c.kind==="workout"?"logged "+(c.value||"a workout"):c.kind==="makebed"?"made their bed":c.kind==="wake"?"checked in their wake-up":c.kind==="bed"?"checked in for bed":c.kind==="prep"?"meal prepped":c.kind==="drinks"?"updated drinks":"completed "+(data!.goals.find(g=>g.circleId===data!.circle.id&&g.kind===c.kind)?.title||"a goal")}<small>{fromKey(c.date).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</small>{c.photoKey&&<img className="activity-photo" src={"/api/photo?id="+encodeURIComponent(c.id)} alt={"Check-in photo from "+(p?.name||"friend")}/>}</div></div>})}</div>:<div className="empty-crew"><Users size={21}/><p>{data?.people.length===1?"Invite a friend to see each other's check-ins here.":"Your crew's check-ins will appear here."}</p></div>}</section>}
     </aside>
    </div>
    <footer className="footer"><span>Keep Pace <span>↗</span></span><a href="/signout-with-chatgpt?return_to=%2F">Sign out</a></footer>
   </div>
  </main>
  <Dialog open={modal==="participation"} onOpenChange={v=>setModal(v?"participation":"")}><DialogContent className="app-dialog participation-dialog"><DialogHeader><DialogTitle>Goals you're taking part in</DialogTitle><DialogDescription>Choose which goals count for you. One check-in counts in each group that shares that goal.</DialogDescription></DialogHeader><div className="participation-groups">{((section==="individual"?data?.groups:[data?.circle])||[]).filter(Boolean).map(group=><div className="participation-group" key={group!.id}><div className="participation-group-name"><Users size={15}/><strong>{group!.name}</strong></div><div className="participation-goals">{data?.goals.filter(g=>g.circleId===group!.id && g.active).map(g=><div key={g.id} className="participation-goal"><span>{g.title}<small>{g.cadence==="weekly"?"Weekly":g.cadence==="sunday"?"Sunday":g.cadence==="weekday"?"Weekdays":g.cadence==="weekend"?"Weekends":"Daily"}</small></span><Switch checked={chosen(data!.me.id,g.id)} onCheckedChange={()=>toggleChoice(g)} aria-label={(chosen(data!.me.id,g.id)?"Leave ":"Join ")+g.title+" in "+group!.name}/></div>)}</div></div>)}</div>{error&&<p className="dialog-error" role="alert">{error}</p>}</DialogContent></Dialog>
  <Dialog open={modal==="rename"} onOpenChange={v=>setModal(v?"rename":"")}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Edit group name</DialogTitle><DialogDescription>Friends in this group will see the updated name.</DialogDescription></DialogHeader><label className="time-entry">Group name<Input autoFocus value={groupName} maxLength={50} onChange={e=>setGroupName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")renameGroup()}}/></label>{error&&<p className="dialog-error" role="alert">{error}</p>}<Button className="modal-primary" disabled={!groupName.trim()||!!saving} onClick={renameGroup}>Save group name</Button></DialogContent></Dialog>
  <Dialog open={modal==="settings"} onOpenChange={v=>setModal(v?"settings":"")}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Goals & reminders</DialogTitle><DialogDescription>Set targets that work for your schedule.</DialogDescription></DialogHeader><div className="form-grid"><label>Your name<Input maxLength={50} value={settings.name} onChange={e=>setSettings({...settings,name:e.target.value})}/></label><label>Weekday wake-up<Input type="time" value={settings.weekdayWake} onChange={e=>setSettings({...settings,weekdayWake:e.target.value})}/></label><label>Weekend wake-up<Input type="time" value={settings.weekendWake} onChange={e=>setSettings({...settings,weekendWake:e.target.value})}/></label><label>Weekday bedtime<Input type="time" value={settings.weekdayBed} onChange={e=>setSettings({...settings,weekdayBed:e.target.value})}/></label><label>Daily reminder time<Input type="time" value={settings.reminderTime} onChange={e=>setSettings({...settings,reminderTime:e.target.value})}/></label></div><div className="reminder-row"><div><strong>Browser reminder</strong><small>Alerts when this page is open and your check-ins are incomplete.</small></div><Switch checked={settings.reminders} onCheckedChange={v=>setSettings({...settings,reminders:v})} aria-label="Enable browser reminders"/></div><div className="push-setting"><span className="push-icon"><Bell size={19}/></span><div><strong>Friend activity on your phone</strong><small>Get a push when a friend logs a goal or adds a photo, even when the app is closed. Each friend turns this on separately.</small><small>On iPhone: Safari → Share → Add to Home Screen; open the new icon, then enable alerts here.</small></div><Button variant={pushEnabled?"outline":"default"} onClick={pushEnabled?disablePush:enablePush} disabled={!!saving}>{pushEnabled?"Turn off":"Enable"}</Button></div>{error&&<p className="dialog-error" role="alert">{error}</p>}<Button className="modal-primary" disabled={!!saving} onClick={saveSettings}>Save goals</Button></DialogContent></Dialog>
  <Dialog open={modal==="share"} onOpenChange={v=>{setModal(v?"share":"");if(!v)history.replaceState(null,"","/")}}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Bring your crew in</DialogTitle><DialogDescription>Everyone who joins can view each other's check-ins and photos.</DialogDescription></DialogHeader><div className="invite-card"><span className="invite-symbol"><Link2 size={23}/></span><strong>Share your group link</strong><p>Send this to your friends. They'll sign in and join {data?.circle.name}.</p><div className="copy-row"><Input readOnly value={inviteUrl} onFocus={e=>e.target.select()}/><Button onClick={copyInvite}>Copy</Button></div></div><div className="join-section"><strong>Have an invite from a friend?</strong><div className="copy-row"><Input value={inviteInput} placeholder="Paste link or invite code" onChange={e=>setInviteInput(e.target.value)}/><Button variant="outline" disabled={!inviteInput.trim()||!!saving} onClick={join}>Join</Button></div></div></DialogContent></Dialog>
  <Dialog open={modal==="newgroup"} onOpenChange={v=>setModal(v?"newgroup":"")}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Create a group</DialogTitle><DialogDescription>Give it a name, then choose its goals and invite friends.</DialogDescription></DialogHeader><label className="time-entry">Group name<Input value={newGroupName} maxLength={50} placeholder="e.g. Morning crew" onChange={e=>setNewGroupName(e.target.value)}/></label><Button className="modal-primary" disabled={!newGroupName.trim()||!!saving} onClick={createGroup}>Create group</Button></DialogContent></Dialog>
  <Dialog open={modal==="editgoals"} onOpenChange={v=>setModal(v?"editgoals":"")}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>{data?.circle.name} goals</DialogTitle><DialogDescription>Turn goals on for this group. Members choose their own participation.</DialogDescription></DialogHeader><div className="edit-goal-list">{data?.goals.filter(g=>g.circleId===data.circle.id).map(g=><div className="edit-goal-row" key={g.id}><div><strong>{g.title}</strong><small>{g.cadence==="weekly"?"Weekly":g.cadence==="sunday"?"Sunday":g.cadence==="weekday"?"Weekdays":g.cadence==="weekend"?"Weekends":"Daily"}</small></div>{g.kind==="drinks"&&<label className="limit-field">Limit <Input type="number" min={1} max={30} defaultValue={g.target||"6"} key={g.id+"-"+g.target} onBlur={e=>{if(e.target.value!==g.target)action({action:"goal_target",goalId:g.id,target:Number(e.target.value)})}}/></label>}<Switch checked={!!g.active} onCheckedChange={enabled=>action({action:"goal_active",goalId:g.id,enabled})} aria-label={(g.active?"Remove ":"Add ")+g.title+" from group"}/></div>)}</div><div className="custom-goal-form"><strong>Add a custom goal</strong><Input value={customTitle} maxLength={70} placeholder="e.g. Read 20 minutes" onChange={e=>setCustomTitle(e.target.value)}/><div><Select value={customCadence} onValueChange={v=>setCustomCadence(v as GroupGoal["cadence"])}><SelectTrigger aria-label="Goal schedule"><SelectValue/></SelectTrigger><SelectContent>{[["daily","Daily"],["weekday","Weekdays"],["weekend","Weekends"],["sunday","Sunday"],["weekly","Once a week"]].map(([value,label])=><SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Button disabled={!customTitle.trim()||!!saving} onClick={addGoal}>Add goal</Button></div></div>{error&&<p className="dialog-error" role="alert">{error}</p>}</DialogContent></Dialog>
  <Dialog open={modal==="workout"} onOpenChange={v=>setModal(v?"workout":"")}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Log your workout</DialogTitle><DialogDescription>What did you do for workout {workSlot+1}?</DialogDescription></DialogHeader><div className="workout-options">{["Lift","Cardio","Golf","Other"].map(x=><button key={x} className={workType===x?"picked":""} onClick={()=>setWorkType(x)}>{x}</button>)}</div><Button className="modal-primary" disabled={!!saving} onClick={async()=>{const ok=await action({action:"checkin",kind:"workout",slot:workSlot,date:selected,value:workType});if(ok)setModal("")}}>Log workout</Button></DialogContent></Dialog>
  <Dialog open={!!timeGoal} onOpenChange={v=>{if(!v)setTimeGoal("")}}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Log {timeGoal==="wake"?"wake-up":"bedtime"}</DialogTitle><DialogDescription>Record the actual time for {selectedDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}.</DialogDescription></DialogHeader><label className="time-entry">Actual time<Input type="time" value={actualTime} onChange={e=>setActualTime(e.target.value)}/></label><div className="time-actions">{my(timeGoal)&&<Button variant="outline" onClick={async()=>{const ok=await action({action:"checkin",kind:timeGoal,date:selected,remove:true});if(ok)setTimeGoal("")}}>Remove check-in</Button>}<Button className="modal-primary" disabled={!!saving} onClick={async()=>{const ok=await action({action:"checkin",kind:timeGoal,date:selected,value:actualTime});if(ok)setTimeGoal("")}}>Save time</Button></div></DialogContent></Dialog>
 </div>;
}
