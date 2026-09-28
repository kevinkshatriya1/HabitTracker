self.addEventListener("push",event=>{
  let data={title:"Keep Pace",body:"A friend checked in.",url:"/"};
  try {if(event.data)data={...data,...event.data.json()}} catch {}
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:"/icon-192.png",badge:"/icon-192.png",data:{url:data.url||"/"},tag:"keep-pace-"+Date.now()}));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const destination=new URL(event.notification.data?.url||"/",self.location.origin);
  if(destination.origin!==self.location.origin)return;
  event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(clients=>{
    const existing=clients.find(client=>new URL(client.url).origin===self.location.origin);
    if(existing)return existing.focus();
    return self.clients.openWindow(destination.href);
  }));
});
