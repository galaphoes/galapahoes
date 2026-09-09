
const CFG=window.TRIP_CONFIG||{},$=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const fallback={
announcements:[
{date:"SEP 9",tag:"NEW",title:"Flight info + arrival coordination",body:"Please add your arrival and departure details so we can plan airport transportation and group logistics."},
{date:"SEP 9",tag:"ACTIVITIES",title:"Activity proposals are live!",body:"Got an excursion, dinner, beach, hike, or weird idea? Propose it and let the group decide who wants in."},
],
itinerary:[
["DEC 27","Arrival","Get settled, explore town, dinner in town","https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80"],
["DEC 28","Beach + Town","Groceries, beach, relax, get bearings","https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=900&q=80"],
["DEC 29","Into the Blue","Open for snorkeling / boat proposals","https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=900&q=80"],
["DEC 30","Island Mode","Choose your own adventure","https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80"],
["DEC 31","New Year's Eve","Group dinner + NYE plans TBD","https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80"],
["JAN 01","Recovery","Nothing serious before noon","https://images.unsplash.com/photo-1470214304380-aadaedcfff1b?auto=format&fit=crop&w=900&q=80"],
["JAN 02","Adventure","Open for a bigger excursion","https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80"],
["JAN 03","Free Day","Pick your own adventure","https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80"],
["JAN 04","Last Full Day","Final beach + dinner","https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80"],
["JAN 05","Departure","Pack up and head home","https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=900&q=80"]
],
activities:[],
signups:[],
crew:[],
flights:[]
};
const DEFAULT_ACTIVITY_IMAGE="https://images.unsplash.com/photo-1546026423-cc4642628d2b?auto=format&fit=crop&w=1000&q=80";

let state=JSON.parse(JSON.stringify(fallback));
let signupsReady=!(CFG.data&&CFG.data.signupsCsv);

function csvToObjects(text){
 const rows=[];let row=[],cell="",quote=false;
 for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];
  if(c=='"'&&quote&&n=='"'){cell+='"';i++}else if(c=='"')quote=!quote;
  else if(c==','&&!quote){row.push(cell);cell=""}
  else if((c=='\n'||c=='\r')&&!quote){if(c=='\r'&&n=='\n')i++;row.push(cell);cell="";if(row.some(x=>x.trim()))rows.push(row);row=[]}
  else cell+=c}
 if(cell||row.length){row.push(cell);rows.push(row)} if(rows.length<2)return[];
 const h=rows[0].map(x=>x.trim());return rows.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,(r[i]||"").trim()])))
}
async function loadCsv(url){
 if(!url)return null;

 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),8000);
 const freshUrl=url+(url.includes("?")?"&":"?")+"_ts="+Date.now();

 try{
  const r=await fetch(freshUrl,{cache:"no-store",signal:controller.signal});
  if(!r.ok)throw Error(`CSV failed: HTTP ${r.status}`);
  return csvToObjects(await r.text());
 }finally{
  clearTimeout(timer);
 }
}

async function loadData(){
 const d=CFG.data||{};

 async function tryFeed(label,url,apply,render){
  if(!url){
   console.info(`[Trip Site] ${label}: no CSV URL configured`);
   return;
  }

  try{
   const rows=await loadCsv(url);

   if(!rows?.length){
    console.warn(`[Trip Site] ${label}: CSV loaded but contained no data rows`);
    if(label==="Signups"){
     signupsReady=true;
     state.signups=[];
     renderActivities();
    }
    return;
   }

   apply(rows);
   render();
   console.info(`[Trip Site] ${label}: loaded ${rows.length} row(s)`);

  }catch(e){
   console.error(`[Trip Site] ${label}: failed to load`,e);

   if(label==="Signups"){
    signupsReady=true;
    state.signups=[];
    renderActivities();
   }
  }
 }

 await Promise.all([
  tryFeed("Announcements",d.announcementsCsv,a=>{
   state.announcements=a.map(x=>({
    date:x.Date||x.date,
    tag:x.Tag||x.tag||"UPDATE",
    title:x.Title||x.title,
    body:x.Body||x.body
   }));
  },renderAnnouncements),

  tryFeed("Activities",d.activitiesCsv,acts=>{
   state.activities=acts
    .filter(x=>(x.Approved||x.approved||"YES").toUpperCase()!=="NO")
    .map(x=>({
     id:normalizeActivityId(x.ID||x.id),
     name:x.Activity||x.activity,
     date:[
      formatDateValue(x.Date||x.date),
      formatTimeValue(x.Time||x.time)
     ].filter(Boolean).join(" · "),
     proposer:x.ProposedBy||x["Proposed By"]||"",
     description:x.Description||"",
     cost:x.Cost||"TBD",
     min:Number(x.Minimum||0),
     status:x.Status||"Open",
     image:x.Image||DEFAULT_ACTIVITY_IMAGE
    }));
  },renderActivities),

  tryFeed("Signups",d.signupsCsv,sups=>{
   state.signups=sups.map((x,index)=>({
    activityId:normalizeActivityId(
     x.ActivityID||x["Activity ID"]||x.activityId
    ),
    name:normalizePersonName(
     x.Name||x["Your Name"]||x.name
    ),
    status:String(
     x.Status||x.status||"Going"
    ).trim(),
    timestamp:String(
     x.Timestamp||x.timestamp||""
    ).trim(),
    timestampMs:parseTimestamp(
     x.Timestamp||x.timestamp||""
    ),
    _index:index
   })).filter(x=>x.activityId&&x.name);

   signupsReady=true;
  },renderActivities),

  tryFeed("Crew",d.crewCsv,c=>{
   state.crew=c.map(x=>({
    name:x.Name||x.name,
    note:x.Note||x.note||"Going"
   }));
  },renderCrew),

  tryFeed("Flights",d.flightsCsv,f=>{
   state.flights=f.map(x=>({
    name:x.Name||x.name,
    arrival:x.Arrival||x.arrival,
    arrivalFlight:x.ArrivalFlight||x["Arrival Flight"]||"",
    departure:x.Departure||x.departure,
    departureFlight:x.DepartureFlight||x["Departure Flight"]||""
   }));
  },renderFlights)
 ]);
}

function normalizeActivityId(v){
 return String(v??"")
  .replace(/\u00A0/g," ")
  .trim()
  .toUpperCase();
}

function normalizeStatus(v){
 return String(v??"").trim().toLowerCase();
}

function normalizePersonName(v){
 return String(v??"")
  .replace(/\u00A0/g," ")
  .trim()
  .replace(/\s+/g," ");
}

function personKey(v){
 return normalizePersonName(v).toLowerCase();
}

function parseTimestamp(v){
 const raw=String(v??"").trim();
 if(!raw)return 0;
 const t=Date.parse(raw);
 return Number.isNaN(t)?0:t;
}

function formatTimeValue(v){
 const raw=String(v??"").trim();
 if(!raw)return "";

 if(/^\d*\.?\d+$/.test(raw)){
  const n=Number(raw);
  if(n>=0&&n<1){
   const total=Math.round(n*24*60);
   const h=Math.floor(total/60)%24;
   const m=total%60;
   const ap=h>=12?"PM":"AM";
   return `${h%12||12}:${String(m).padStart(2,"0")} ${ap}`;
  }
 }

 const ampm=raw.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i);
 if(ampm){
  return `${Number(ampm[1])}:${ampm[2]} ${ampm[3].toUpperCase()}`;
 }

 const h24=raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
 if(h24){
  const h=Number(h24[1]);
  const ap=h>=12?"PM":"AM";
  return `${h%12||12}:${h24[2]} ${ap}`;
 }

 return raw;
}

function formatDateValue(v){
 const raw=String(v??"").trim();
 if(!raw)return "";

 const d=new Date(raw);
 if(!Number.isNaN(d.getTime())){
  return d.toLocaleDateString("en-US",{
   month:"short",
   day:"numeric",
   year:"numeric"
  });
 }

 return raw;
}

function latestSignupMap(){
 const latest=new Map();

 state.signups.forEach((s,index)=>{
  const activityId=normalizeActivityId(s.activityId);
  const name=normalizePersonName(s.name);

  if(!activityId||!name)return;

  const key=`${activityId}::${personKey(name)}`;
  const stamp=s.timestampMs||0;
  const prior=latest.get(key);

  if(
   !prior ||
   stamp>prior.timestampMs ||
   (stamp===prior.timestampMs&&index>prior._index)
  ){
   latest.set(key,{...s,activityId,name,_index:index});
  }
 });

 return latest;
}

function currentSignupsFor(activityId){
 const target=normalizeActivityId(activityId);

 return [...latestSignupMap().values()]
  .filter(s=>normalizeActivityId(s.activityId)===target);
}

function peopleFor(activityId,status){
 const targetStatus=normalizeStatus(status);

 return currentSignupsFor(activityId)
  .filter(s=>normalizeStatus(s.status)===targetStatus)
  .map(s=>s.name)
  .sort((a,b)=>a.localeCompare(b));
}

function countFor(id,status){
 return peopleFor(id,status).length;
}

function renderAnnouncements(){$("#announcementList").innerHTML=state.announcements.map((x,i)=>`<article class="announcement"><div class="meta"><span class="${i===0?"badge":""}">${x.tag}</span><span>${x.date}</span></div><h3>${x.title}</h3><p>${x.body}</p></article>`).join("")}
function renderItinerary(){$("#itineraryGrid").innerHTML=state.itinerary.map(x=>`<article class="day-card"><div class="image" style="background-image:url('${x[3]}')"></div><div class="body"><small>${x[0]}</small><h3>${x[1]}</h3><p>${x[2]}</p></div></article>`).join("")}
function escAttr(v){
 return String(v??"")
  .replace(/&/g,"&amp;")
  .replace(/"/g,"&quot;")
  .replace(/</g,"&lt;")
  .replace(/>/g,"&gt;");
}

function renderActivities(filter="all"){
 let a=state.activities;

 if(filter==="open")
  a=a.filter(x=>String(x.status).toLowerCase()==="open");

 if(filter==="free")
  a=a.filter(x=>/free|\$0/i.test(x.cost));

 if(filter==="paid")
  a=a.filter(x=>!/free|\$0/i.test(x.cost));

 $("#activityCount").textContent=a.length;

 $("#activityGrid").innerHTML=a.length ? a.map(x=>{
  const going=signupsReady?peopleFor(x.id,"Going"):[];
  const maybe=signupsReady?peopleFor(x.id,"Maybe"):[];

  return `
  <article class="activity-card">
   <div class="activity-img" style="background-image:url('${escAttr(x.image)}')"></div>

   <div class="activity-body">
    <div class="activity-top">
     <div>
      <div class="activity-date">${x.date}</div>
      <h3>${x.name}</h3>
     </div>
     <div class="activity-cost">${x.cost}</div>
    </div>

    <p class="activity-desc">${x.description}</p>

    <div class="activity-meta">
     <span>Proposed by ${x.proposer||"the group"}</span>
     <span>${x.min?`Min. ${x.min}`:"Open group"}</span>
    </div>

    <div class="activity-meta">
     ${
      signupsReady
       ? `<strong>👥 ${going.length} going</strong><span>${maybe.length} maybe</span>`
       : `<strong>👥 Loading RSVPs…</strong><span></span>`
     }
    </div>

    ${
     signupsReady
      ? `
       <div class="rsvp-lists">
        <div class="rsvp-group">
         <div class="rsvp-label">Going</div>
         <div class="rsvp-names">
          ${
           going.length
            ? going.map(n=>`<span>${n}</span>`).join("")
            : `<span class="rsvp-empty">No one yet</span>`
          }
         </div>
        </div>

        <div class="rsvp-group">
         <div class="rsvp-label">Maybe</div>
         <div class="rsvp-names">
          ${
           maybe.length
            ? maybe.map(n=>`<span>${n}</span>`).join("")
            : `<span class="rsvp-empty">No one yet</span>`
          }
         </div>
        </div>
       </div>
      `
      : ""
    }

    <div class="activity-actions">
     <button
      class="going signup-button"
      data-activity-id="${escAttr(x.id)}"
      data-activity-name="${escAttr(x.name)}"
      data-status="Going">
      I'm in
     </button>

     <button
      class="signup-button"
      data-activity-id="${escAttr(x.id)}"
      data-activity-name="${escAttr(x.name)}"
      data-status="Maybe">
      Maybe
     </button>
    </div>

    <button
     class="change-rsvp signup-button"
     data-activity-id="${escAttr(x.id)}"
     data-activity-name="${escAttr(x.name)}"
     data-status="">
     Change / cancel RSVP
    </button>
   </div>
  </article>
 `}).join("") : `<div class="form-fallback"><b>No approved activities yet.</b><p>Propose one and it will appear here after approval.</p></div>`;
}

function initials(n){return n.split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()}
function renderCrew(){
 $("#crewGrid").innerHTML=state.crew.length
  ? state.crew.map(x=>`<article class="crew-card"><div class="initials">${initials(x.name)}</div><h3>${x.name}</h3><p>${x.note||"Going"}</p></article>`).join("")
  : `<div class="form-fallback"><b>No crew entries yet.</b></div>`;
}
function renderFlights(){
 $("#flightTableBody").innerHTML=state.flights.map(x=>`<tr><td>${x.name}</td><td>${x.arrival||"—"}</td><td>${x.arrivalFlight||"—"}</td><td>${x.departure||"—"}</td><td>${x.departureFlight||"—"}</td></tr>`).join("")
  || `<tr><td colspan="5">No flight information yet.</td></tr>`;
}
function renderAll(){renderAnnouncements();renderItinerary();renderActivities();renderCrew();renderFlights()}
function countdown(){const start=new Date(CFG.trip?.startDate||"2026-12-27");$("#daysToGo").textContent=Math.max(0,Math.ceil((start-new Date())/86400000))}
const modal=$("#modalBackdrop"),body=$("#modalBody"),title=$("#modalTitle"),eyebrow=$("#modalEyebrow");
function openModal(kind,extra={}){
 const f=CFG.forms||{};let label="",url="";
 if(kind==="proposal"){label="ACTIVITY";title.textContent="Propose an activity";url=f.activityProposal}
 if(kind==="crew"){label="CREW";title.textContent="Add / update my info";url=f.crew}
 if(kind==="flight"){label="FLIGHTS";title.textContent="Add my flight info";url=f.flight}
 if(kind==="signup"){
  label="ACTIVITY SIGN-UP";title.textContent=extra.status?`${extra.status}: ${extra.name}`:`Change RSVP: ${extra.name}`;url=f.activitySignup;
  if(url){
   const p=[];if(CFG.signupActivityEntry)p.push(`${encodeURIComponent(CFG.signupActivityEntry)}=${encodeURIComponent(extra.id)}`);
   if(CFG.signupStatusEntry&&extra.status)p.push(`${encodeURIComponent(CFG.signupStatusEntry)}=${encodeURIComponent(extra.status)}`);
   if(p.length)url+=`${url.includes("?")?"&":"?"}usp=pp_url&${p.join("&")}`
  }
 }
 eyebrow.textContent=label;
 if(url)body.innerHTML=`<div class="form-fallback"><p>No extra app is required. The form opens in a new tab.</p><a class="btn primary form-link" href="${url}" target="_blank" rel="noopener">Open form →</a>${kind==="signup"?`<p><small>Activity <b>${extra.id}</b>${extra.status?` and <b>${extra.status}</b>`:""} ${extra.status?"are":"is"} already selected. Submit the form again any time to change your RSVP. Your latest response wins.</small></p>`:""}</div>`;
 else body.innerHTML=`<div class="form-fallback"><b>This form is not connected yet.</b></div>`;
 modal.hidden=false;document.body.style.overflow="hidden"
}
function closeModal(){modal.hidden=true;document.body.style.overflow=""}
window.openSignup=(id,name,status)=>openModal("signup",{id,name,status});

$("#activityGrid").addEventListener("click",e=>{
 const button=e.target.closest(".signup-button");
 if(!button)return;

 openSignup(
  button.dataset.activityId,
  button.dataset.activityName,
  button.dataset.status
 );
});
$$("[data-form]").forEach(b=>b.addEventListener("click",()=>openModal(b.dataset.form)));
$("#modalClose").addEventListener("click",closeModal);modal.addEventListener("click",e=>{if(e.target===modal)closeModal()});
$("#menuButton").addEventListener("click",()=>$("#mobileMenu").classList.toggle("open"));
$$(".mobile-menu a").forEach(a=>a.addEventListener("click",()=>$("#mobileMenu").classList.remove("open")));
$$("#activityFilters button").forEach(b=>b.addEventListener("click",()=>{$$("#activityFilters button").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderActivities(b.dataset.filter)}));
console.info("[Trip Site] V2.9 clean started");
renderAll();
countdown();
loadData();
