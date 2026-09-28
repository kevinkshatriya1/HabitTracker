"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bell, BedDouble, Camera, Check, CheckCircle2, ChevronRight, Clock3, Coffee, Dumbbell, Link2, Minus, Plus, Settings2, Share2, Sunrise, Users, Utensils, Wine, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type Person={id:string;name:string;email:string;weekdayWake:string;weekendWake:string;weekdayBed:string;reminderTime?:string;reminders?:number};
type Checkin={id:string;personId:string;date:string;kind:string;slot:number;value:string|null;photoKey:string|null;createdAt:number};
type State={me:Person;circle:{id:string;name:string;inviteCode:string};people:Person[];checkins:Checkin[]};
type Goal={kind:string;slot:number;title:string;hint:string;icon:typeof Sunrise};

const todayKey=()=>dateKey(new Date());
function dateKey(d:Date){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
function fromKey(key:string){const [y,m,d]=key.split("-").map(Number);return new Date(y,m-1,d)}
function shift(d:Date,n:number){const out=new Date(d);out.setDate(out.getDate()+n);return out}
function weekStart(d:Date){return shift(d,-(d.getDay()+6)%7)}
function fmtTime(t:string){const [h,m]=t.split(":").map(Number);return new Date(2020,0,1,h,m).toLocaleTimeString("en-US",{hour:"numeric",minute:m? "2-digit":undefined})}
function initials(name:string){return name.split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join("")}
function weekLabel(d:Date){const end=shift(d,6);return d.toLocaleDateString("en-US",{month:"long",day:"numeric"})+" – "+end.toLocaleDateString("en-US",{month:d.getMonth()===end.getMonth()?undefined:"short",day:"numeric",year:"numeric"})}
function goals(day:Date,me:Person):Goal[]{const weekend=[0,6].includes(day.getDay());return [
 {kind:"wake",slot:0,title:"Wake up",hint:"By "+fmtTime(weekend?me.weekendWake:me.weekdayWake),icon:Sunrise},
 {kind:"makebed",slot:0,title:"Make the bed",hint:"Start with a win",icon:BedDouble},
 {kind:"workout",slot:0,title:"Workout 01",hint:"Lift, cardio, or golf",icon:Dumbbell},
 ...(!weekend?[{kind:"workout",slot:1,title:"Workout 02",hint:"Lift, cardio, or golf",icon:Dumbbell}]:[]),
 ...(!weekend?[{kind:"bed",slot:0,title:"In bed",hint:"By "+fmtTime(me.weekdayBed),icon:Clock3}]:[]),
] }
function isOnTime(entry:Checkin, target:string, kind:string){if(!entry.value)return true;return kind==="wake"?entry.value<=target:entry.value<=target}
function Avatar({person,size="normal"}:{person:Person;size?:"normal"|"small"}){return <span className={"avatar "+(size==="small"?"avatar-small":"")} title={person.name}>{initials(person.name)}</span>}

export default function Dashboard(){
 const [start,setStart]=useState(()=>weekStart(new Date()));
 const [selected,setSelected]=useState(todayKey);
 const [data,setData]=useState<State|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [saving,setSaving]=useState("");
 const [notice,setNotice]=useState("");
 const [modal,setModal]=useState<""|"settings"|"share"|"workout">("");
 const [workSlot,setWorkSlot]=useState(0);
 const [workType,setWorkType]=useState("Lift");
 const [actualTime,setActualTime]=useState("");
 const [timeGoal,setTimeGoal]=useState<""|"wake"|"bed">("");
 const [settings,setSettings]=useState({name:"",weekdayWake:"07:00",weekendWake:"09:00",weekdayBed:"23:00",reminderTime:"20:00",reminders:false});
 const [inviteInput,setInviteInput]=useState("");
 const fileRef=useRef<HTMLInputElement>(null);
 const latestFriend=useRef<number|null>(null);
 const [photoFor,setPhotoFor]=useState<string|null>(null);
 const startKey=dateKey(start),endKey=dateKey(shift(start,6));

 const load=useCallback(async(showLoading=false)=>{
   if(showLoading)setLoading(true);
   try {
     const response=await fetch("/api/state?start="+dateKey(start)+"&end="+dateKey(shift(start,6)),{cache:"no-store"});
     const json=await response.json() as State & {error?:string};
     if(!response.ok)throw Error(json.error || "Could not load your calendar.");
     const newest=Math.max(0,...json.checkins.filter(c=>c.personId!==json.me.id).map(c=>c.createdAt));
     if(latestFriend.current!==null && newest>latestFriend.current && json.me.reminders && typeof Notification!=="undefined" && Notification.permission==="granted"){
       const newEntry=json.checkins.find(c=>c.personId!==json.me.id && c.createdAt===newest);
       const friend=json.people.find(p=>p.id===newEntry?.personId);
       new Notification("New crew check-in",{body:(friend?.name||"A friend")+" just checked in."});
     }
     latestFriend.current=newest;
     setData(json);setError("");
     setSettings({name:json.me.name,weekdayWake:json.me.weekdayWake,weekendWake:json.me.weekendWake,weekdayBed:json.me.weekdayBed,reminderTime:json.me.reminderTime||"20:00",reminders:!!json.me.reminders});
   }catch(e){setError(e instanceof Error?e.message:"Could not load your calendar.")}
   finally{setLoading(false)}
 },[start]);
 useEffect(()=>{load(true)},[load]);
 useEffect(()=>{const id=setInterval(()=>load(),60_000);return()=>clearInterval(id)},[load]);

 const myEntries=useMemo(()=>data?.checkins.filter(c=>c.personId===data.me.id)||[],[data]);
 const selectedDate=fromKey(selected);
 const isWeekend=[0,6].includes(selectedDate.getDay());
 const dailyGoals=data?goals(selectedDate,data.me):[];
 const find=(personId:string,date:string,kind:string,slot=0)=>data?.checkins.find(c=>c.personId===personId && c.date===date && c.kind===kind && c.slot===slot);
 const my=(kind:string,slot=0,date=selected)=>data?find(data.me.id,date,kind,slot):undefined;
 const sunday=dateKey(shift(start,6));
 const drinks=myEntries.filter(c=>c.kind==="drinks").reduce((n,c)=>n+Number(c.value||0),0);
 const dayDone=dailyGoals.filter(g=>my(g.kind,g.slot)).length;
 const totalWeek=myEntries.filter(c=>c.kind!=="drinks").length;
 const weekTarget=5*5+2*3+1;
 const weekRate=Math.min(100,Math.round(totalWeek/weekTarget*100));
 const recent=data?.checkins.filter(c=>c.personId!==data.me.id).slice(0,5)||[];
 const inviteUrl=typeof window!=="undefined" && data?window.location.origin+"/?join="+data.circle.inviteCode:"";

 useEffect(()=>{
  const code=new URLSearchParams(window.location.search).get("join");
  if(code && data && code!==data.circle.inviteCode){setInviteInput(code.toUpperCase());setModal("share")}
 },[data?.circle.inviteCode]);
 useEffect(()=>{
  if(!data?.me.reminders || typeof Notification==="undefined" || Notification.permission!=="granted")return;
  const check=()=>{const now=new Date();const key=dateKey(now);if(now.toTimeString().slice(0,5)<data.me.reminderTime!)return;
   const marker="keep-pace-reminded-"+key;
   if(localStorage.getItem(marker))return;
   const items=goals(now,data.me).filter(g=>!find(data.me.id,key,g.kind,g.slot)).length;
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
 async function saveSettings(){if(settings.reminders && typeof Notification!=="undefined" && Notification.permission==="default"){const permission=await Notification.requestPermission();if(permission!=="granted"){setError("Browser notifications were not enabled. You can still use in-app reminders while this page is open.");setSettings({...settings,reminders:false});return}}
  const ok=await action({action:"settings",...settings});if(ok)setModal("")}
 async function copyInvite(){try{await navigator.clipboard.writeText(inviteUrl);setNotice("Invite link copied");setTimeout(()=>setNotice(""),3000)}catch{setError("Copy unavailable. Select the link below to share it.")}}
 async function join(){const code=inviteInput.includes("join=")?inviteInput.split("join=")[1].split("&")[0]:inviteInput;const ok=await action({action:"join",code:code.trim()});if(ok){setModal("");setInviteInput("");history.replaceState(null,"","/")}}
 const goalCount=dayDone+"/"+dailyGoals.length;

 return <div className="app-shell">
  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={e=>upload(e.target.files?.[0]||null)} />
  <aside className="sidebar">
   <div className="brand"><span className="brand-icon">K<span>↗</span></span><span>keep pace<span className="brand-dot">.</span></span></div>
   <div className="side-main"><p className="side-label">YOUR SPACE</p><div className="nav-item active"><span className="nav-icon">▦</span> Calendar</div><button className="nav-item" onClick={()=>setModal("share")}><Users size={19}/> Your crew <span className="nav-count">{data?.people.length||1}</span></button><button className="nav-item" onClick={()=>setModal("settings")}><Settings2 size={19}/> Goals & reminders</button></div>
   <div className="side-bottom"><div className="sidebar-note"><span className="note-spark">✳</span><strong>Consistency is a team sport.</strong><span>A little proof goes a long way.</span></div><div className="profile"><Avatar person={data?.me||{id:"",name:"You",email:"",weekdayWake:"",weekendWake:"",weekdayBed:""}}/><span><strong>{data?.me.name||"Your space"}</strong><small>{data?.circle.name||"Accountability calendar"}</small></span><button aria-label="Settings" onClick={()=>setModal("settings")}><Settings2 size={17}/></button></div></div>
  </aside>
  <main className="main-area">
   <header className="topbar"><div className="mobile-brand"><span className="brand-icon">K<span>↗</span></span> keep pace.</div><div className="crumb">YOUR WEEK <ChevronRight size={15}/> <strong>{data?.circle.name||"Calendar"}</strong></div><div className="header-actions"><button className="icon-button" aria-label="Goal settings" onClick={()=>setModal("settings")}><Settings2 size={19}/></button><button className="invite-button" onClick={()=>setModal("share")}><Share2 size={17}/> <span>Invite friends</span></button></div></header>
   <div className="content">
    <section className="intro"><div><p className="eyebrow">THE ACCOUNTABILITY CALENDAR</p><h1>Make this week count<span className="period">.</span></h1><p>Small wins. Every day. Better together.</p></div><div className="week-score"><div className="score-ring" style={{background:"conic-gradient(#c8f35e "+weekRate+"%, #e9eee6 0)"}}><span>{weekRate}%</span></div><div><strong>Weekly progress</strong><small>{totalWeek} of {weekTarget} check-ins</small></div></div></section>
    {error&&<div className="error-banner" role="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError("")}><X size={17}/></button></div>}
    {notice&&<div className="notice" role="status"><Check size={16}/>{notice}</div>}
    <section className="calendar-panel">
     <div className="panel-heading"><div><span className="section-kicker">YOUR CALENDAR</span><h2>{weekLabel(start)}</h2></div><div className="calendar-nav"><button onClick={()=>goWeek(-1)} aria-label="Previous week"><ArrowLeft size={19}/></button><button className="today-nav" onClick={()=>{const now=new Date();setStart(weekStart(now));setSelected(dateKey(now))}}>Today</button><button onClick={()=>goWeek(1)} aria-label="Next week"><ArrowRight size={19}/></button></div></div>
     <div className="week-grid">{Array.from({length:7},(_,i)=>{const day=shift(start,i),key=dateKey(day),entries=myEntries.filter(c=>c.date===key && c.kind!=="drinks"),target=i>=5?3:5;return <button key={key} className={"day-tile "+(selected===key?"selected ":"")+(key===todayKey()?"today ":"")} onClick={()=>setSelected(key)}><span className="day-name">{day.toLocaleDateString("en-US",{weekday:"short"})}</span><strong>{day.getDate()}</strong><span className="day-progress"><span style={{width:Math.min(100,entries.length/target*100)+"%"}}/></span><small>{entries.length}/{target}</small></button>})}</div>
    </section>
    <div className="below-grid">
     <section className="daily-panel"><div className="panel-heading daily-heading"><div><span className="section-kicker">{selected===todayKey()?"TODAY'S CHECKLIST":"DAILY CHECKLIST"}</span><h2>{selectedDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</h2></div><span className="goal-count">{goalCount} done</span></div>
      {loading&&!data?<div className="loading">Loading your week…</div>:<div className="goals-list">{dailyGoals.map(g=>{const entry=my(g.kind,g.slot),Icon=g.icon;const target=g.kind==="wake"?(isWeekend?data!.me.weekendWake:data!.me.weekdayWake):data!.me.weekdayBed;return <div className={"goal-row "+(entry?"completed":"")} key={g.kind+g.slot}><button className="goal-toggle" onClick={()=>toggle(g.kind,g.slot)} disabled={!!saving} aria-label={(entry?"Remove ":"Complete ")+g.title}>{entry?<Check size={18} strokeWidth={3}/>:null}</button><span className="goal-icon"><Icon size={20}/></span><div className="goal-info"><strong>{g.title}</strong><span>{entry?(g.kind==="wake"||g.kind==="bed"?fmtTime(entry.value||"00:00")+(isOnTime(entry,target,g.kind)?" · On target":" · Past target"):g.kind==="workout"?entry.value:"Done"):g.hint}</span></div>{entry?<div className="goal-end">{entry.photoKey?<button className="photo-thumb" onClick={()=>choosePhoto(entry.id)} title="Replace photo"><img src={"/api/photo?id="+encodeURIComponent(entry.id)} alt="Check-in proof"/></button>:<button className="photo-action" onClick={()=>choosePhoto(entry.id)} aria-label={"Add a photo for "+g.title}><Camera size={18}/></button>}</div>:<button className="log-button" onClick={()=>toggle(g.kind,g.slot)} disabled={!!saving}>Log <Plus size={15}/></button>}</div>})}</div>}
      <p className="panel-footnote"><Camera size={15}/> Add a photo after logging a check-in to show your crew.</p>
     </section>
     <aside className="right-column">
      <section className="weekly-panel"><div className="panel-heading"><div><span className="section-kicker">WEEKLY TARGETS</span><h2>The bigger picture</h2></div></div>
       <div className="weekly-item"><span className="weekly-icon food"><Utensils size={20}/></span><div><strong>Sunday meal prep</strong><small>{my("prep",0,sunday)?"Prepped for the week":"Set yourself up for Monday"}</small></div><button className={"mini-check "+(my("prep",0,sunday)?"checked":"")} onClick={()=>toggle("prep",0,sunday)} aria-label="Toggle Sunday meal prep">{my("prep",0,sunday)&&<Check size={17}/>}</button>{my("prep",0,sunday)&&<button className="weekly-photo" onClick={()=>choosePhoto(my("prep",0,sunday)!.id)} aria-label="Add meal prep photo"><Camera size={17}/></button>}</div>
       <div className="weekly-divider"/>
       <div className="drinks-heading"><span className="weekly-icon drinks"><Wine size={20}/></span><div><strong>Drinks this week</strong><small>Keep it at 6 or fewer</small></div><span className={"drinks-count "+(drinks>6?"over":"")}>{drinks}<span> / 6</span></span></div>
       <div className="drinks-meter"><span style={{width:Math.min(100,drinks/6*100)+"%",background:drinks>6?"#ec896b":undefined}}/></div>
       <div className="drink-controls"><span>{drinks>6?"Over your weekly limit by "+(drinks-6):drinks===0?"No drinks logged yet":(6-drinks)+" remaining this week"}</span><div>{my("drinks",0,selected)&&Number(my("drinks",0,selected)?.value)>0&&<button aria-label="Add drinks photo" onClick={()=>choosePhoto(my("drinks",0,selected)!.id)}><Camera size={15}/></button>}<button aria-label="Remove one drink on selected day" disabled={!my("drinks",0,selected) || Number(my("drinks",0,selected)?.value)<=0 || !!saving} onClick={()=>action({action:"checkin",date:selected,kind:"drinks",value:Number(my("drinks",0,selected)?.value||0)-1})}><Minus size={15}/></button><button aria-label="Log one drink on selected day" disabled={!!saving} onClick={()=>action({action:"checkin",date:selected,kind:"drinks",value:Number(my("drinks",0,selected)?.value||0)+1})}><Plus size={15}/></button></div></div><p className="drink-day-note">Use + / − to log drinks for {selectedDate.toLocaleDateString("en-US",{weekday:"long"})}.</p>
      </section>
      <section className="crew-panel"><div className="panel-heading"><div><span className="section-kicker">TOGETHER IS BETTER</span><h2>Your crew</h2></div><button className="link-button" onClick={()=>setModal("share")}>Invite <ArrowRight size={16}/></button></div><div className="crew-avatars">{data?.people.map(p=><div className="crew-person" key={p.id}><Avatar person={p}/><span>{p.id===data.me.id?"You":p.name.split(" ")[0]}</span></div>)}</div>{recent.length?<div className="activity-list">{recent.map(c=>{const p=data!.people.find(p=>p.id===c.personId);return <div className="activity" key={c.id}><Avatar person={p||data!.me} size="small"/><div><strong>{p?.name||"Friend"}</strong> {c.kind==="workout"?"logged "+(c.value||"a workout"):c.kind==="makebed"?"made their bed":c.kind==="wake"?"checked in their wake-up":c.kind==="bed"?"checked in for bed":c.kind==="prep"?"meal prepped":"updated drinks"}<small>{fromKey(c.date).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</small>{c.photoKey&&<img className="activity-photo" src={"/api/photo?id="+encodeURIComponent(c.id)} alt={"Check-in photo from "+(p?.name||"friend")}/>}</div></div>})}</div>:<div className="empty-crew"><Users size={21}/><p>{data?.people.length===1?"Invite a friend to see each other's check-ins here.":"Your crew's check-ins will appear here."}</p></div>}</section>
     </aside>
    </div>
    <footer className="footer"><span>Keep Pace <span>↗</span></span><a href="/signout-with-chatgpt?return_to=%2F">Sign out</a></footer>
   </div>
  </main>
  <Dialog open={modal==="settings"} onOpenChange={v=>setModal(v?"settings":"")}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Goals & reminders</DialogTitle><DialogDescription>Set targets that work for your schedule.</DialogDescription></DialogHeader><div className="form-grid"><label>Your name<Input maxLength={50} value={settings.name} onChange={e=>setSettings({...settings,name:e.target.value})}/></label><label>Weekday wake-up<Input type="time" value={settings.weekdayWake} onChange={e=>setSettings({...settings,weekdayWake:e.target.value})}/></label><label>Weekend wake-up<Input type="time" value={settings.weekendWake} onChange={e=>setSettings({...settings,weekendWake:e.target.value})}/></label><label>Weekday bedtime<Input type="time" value={settings.weekdayBed} onChange={e=>setSettings({...settings,weekdayBed:e.target.value})}/></label><label>Daily reminder time<Input type="time" value={settings.reminderTime} onChange={e=>setSettings({...settings,reminderTime:e.target.value})}/></label></div><div className="reminder-row"><div><strong>Browser reminder</strong><small>Alerts when this page is open and your check-ins are incomplete.</small></div><Switch checked={settings.reminders} onCheckedChange={v=>setSettings({...settings,reminders:v})} aria-label="Enable browser reminders"/></div><Button className="modal-primary" disabled={!!saving} onClick={saveSettings}>Save goals</Button></DialogContent></Dialog>
  <Dialog open={modal==="share"} onOpenChange={v=>{setModal(v?"share":"");if(!v)history.replaceState(null,"","/")}}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Bring your crew in</DialogTitle><DialogDescription>Everyone who joins can view each other's check-ins and photos.</DialogDescription></DialogHeader><div className="invite-card"><span className="invite-symbol"><Link2 size={23}/></span><strong>Share your group link</strong><p>Send this to your friends. They'll sign in and join {data?.circle.name}.</p><div className="copy-row"><Input readOnly value={inviteUrl} onFocus={e=>e.target.select()}/><Button onClick={copyInvite}>Copy</Button></div></div><div className="join-section"><strong>Have an invite from a friend?</strong><div className="copy-row"><Input value={inviteInput} placeholder="Paste link or invite code" onChange={e=>setInviteInput(e.target.value)}/><Button variant="outline" disabled={!inviteInput.trim()||!!saving} onClick={join}>Join</Button></div></div></DialogContent></Dialog>
  <Dialog open={modal==="workout"} onOpenChange={v=>setModal(v?"workout":"")}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Log your workout</DialogTitle><DialogDescription>What did you do for workout {workSlot+1}?</DialogDescription></DialogHeader><div className="workout-options">{["Lift","Cardio","Golf","Other"].map(x=><button key={x} className={workType===x?"picked":""} onClick={()=>setWorkType(x)}>{x}</button>)}</div><Button className="modal-primary" disabled={!!saving} onClick={async()=>{const ok=await action({action:"checkin",kind:"workout",slot:workSlot,date:selected,value:workType});if(ok)setModal("")}}>Log workout</Button></DialogContent></Dialog>
  <Dialog open={!!timeGoal} onOpenChange={v=>{if(!v)setTimeGoal("")}}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>Log {timeGoal==="wake"?"wake-up":"bedtime"}</DialogTitle><DialogDescription>Record the actual time for {selectedDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}.</DialogDescription></DialogHeader><label className="time-entry">Actual time<Input type="time" value={actualTime} onChange={e=>setActualTime(e.target.value)}/></label><div className="time-actions">{my(timeGoal)&&<Button variant="outline" onClick={async()=>{const ok=await action({action:"checkin",kind:timeGoal,date:selected,remove:true});if(ok)setTimeGoal("")}}>Remove check-in</Button>}<Button className="modal-primary" disabled={!!saving} onClick={async()=>{const ok=await action({action:"checkin",kind:timeGoal,date:selected,value:actualTime});if(ok)setTimeGoal("")}}>Save time</Button></div></DialogContent></Dialog>
 </div>;
}
