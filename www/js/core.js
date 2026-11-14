'use strict';
/* Screens Time - core: helpers, icons, app colours, the data model binding, settings state.
   Nothing in here invents numbers. Every figure comes from `M`, the model built by Engine.build(). */

/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/* time lengths: compact "1h 14m" and long "1 hour 14 minutes" */
const fm=m=>{m=Math.round(Math.max(0,m));const h=Math.floor(m/60),r=m%60;return h?`${h}h ${String(r).padStart(2,'0')}m`:`${r}m`};
const fmL=m=>{m=Math.round(Math.max(0,m));const h=Math.floor(m/60),r=m%60,a=h?`${h} ${h===1?'hour':'hours'}`:'',b=r||!h?`${r} ${r===1?'minute':'minutes'}`:'';return [a,b].filter(Boolean).join(' ')};
/* clock times are always 12-hour with AM / PM (m = minute of the day) */
const ampm=m=>{const h=Math.floor(m/60)%24,r=m%60;return `${((h+11)%12)+1}:${String(r).padStart(2,'0')} ${h<12?'AM':'PM'}`};
const tm=m=>{const h=Math.floor(m/60)%24,r=m%60;return `${((h+11)%12)+1}:${String(r).padStart(2,'0')}<small>${h<12?'AM':'PM'}</small>`};
const hLabel=h=>`${((h+11)%12)+1} ${h<12?'AM':'PM'}`;
const toMin=t=>{const [h,m]=String(t).split(':').map(Number);return (h||0)*60+(m||0)};
const hms=ms=>{ms=Math.max(0,Math.round(ms/1000));const h=Math.floor(ms/3600),m=Math.floor(ms%3600/60),s=ms%60;return (h?h+':':'')+String(m).padStart(h?2:1,'0')+':'+String(s).padStart(2,'0')};
const hash=s=>{let h=7;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return (h%1000)/1000};
const tail=id=>{const p=String(id).split('.');return p[p.length-1]||String(id)};
const sv=(p,w=22)=>`<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const IC={
  today:sv('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 8 8" stroke-width="4"/>'),
  time:sv('<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M6 8v8M11 6h9M11 12h9M11 18h9"/>'),
  limits:sv('<path d="M7 3h10M7 21h10M8 3c0 5 4 6 4 9s-4 4-4 9M16 3c0 5-4 6-4 9s4 4 4 9"/>'),
  focus:sv('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>'),
  insights:sv('<path d="M5 20V11M12 20V4M19 20v-7"/>'),
  gear:sv('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
  left:sv('<path d="M15 5l-7 7 7 7"/>',20), right:sv('<path d="M9 5l7 7-7 7"/>',20),
  x:sv('<path d="M6 6l12 12M18 6L6 18"/>',18), plus:sv('<path d="M12 5v14M5 12h14"/>',18),
  globe:sv('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',18),
  down:sv('<path d="M6 9l6 6 6-6"/>',16), check:sv('<path d="M5 12l5 5 9-10"/>',16),
  copy:sv('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',16)
};
const SUN=sv('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',20);
const DAWN=sv('<path d="M3 19h18M7 19a5 5 0 0 1 10 0M12 5v4M5 10l2 2M19 10l-2 2"/>',20);
const NIGHT=sv('<path d="M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10z"/>',20);

/* ---------- app icons and colours ----------
   Icon = the app's own icon (on a phone: from the system, a bitmap).
   Colour = the most vivid colour found inside that icon, so each app keeps ONE colour that matches what the person
   sees on the home screen. Nothing is hand-picked per app.
   No icon (an app that was uninstalled, or an icon that failed to load): a grey tile with its initials and the neutral grey.
   "Other apps" is always the neutral grey, and every colour on a chart is named in a legend next to it. */
const GREY=[154,174,177];
function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let h=0,s=0;if(d){s=d/(1-Math.abs(2*l-1));h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h=(h*60+360)%360}return [h,s,l]}
function hsl2rgb(h,s,l){const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;const [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return [r,g,b].map(v=>Math.round((v+m)*255))}
const rgbStr=c=>`rgb(${c[0]},${c[1]},${c[2]})`;
/* the most vivid colour inside an icon picture: ignore near-white and see-through pixels, group the rest by hue */
function dominant(img){
  const cv=document.createElement('canvas');cv.width=cv.height=32;const x=cv.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,32,32);
  const d=x.getImageData(0,0,32,32).data,B=Array.from({length:12},()=>({w:0,r:0,g:0,b:0,n:0}));
  for(let i=0;i<d.length;i+=4){if(d[i+3]<200)continue;const [h,s,l]=rgb2hsl(d[i],d[i+1],d[i+2]);if(l>.9)continue;const w=s*(1-Math.abs(2*l-1))+.01,b=B[Math.floor(h/30)%12];b.w+=w;b.r+=d[i];b.g+=d[i+1];b.b+=d[i+2];b.n++}
  const best=B.reduce((a,b)=>b.w>a.w?b:a);return best.n?[best.r,best.g,best.b].map(v=>Math.round(v/best.n)):null;
}
/* inside ONE chart, two apps must never share a look-alike colour: the later one is nudged round the colour wheel */
function sepColors(list){
  const out=[];
  list.forEach(a=>{let [h,s,l]=rgb2hsl(...a.rgb),c=a.rgb,k=0;
    if(a.rgb===GREY){out.push(GREY);return}
    while(k<8&&out.some(o=>Math.hypot(o[0]-c[0],o[1]-c[1],o[2]-c[2])<75)){h=(h+40)%360;s=Math.max(s,.5);l=clamp(l,.38,.6);c=hsl2rgb(h,s,l);k++}
    out.push(c)});
  return out.map(rgbStr);
}
const COLOR_CACHE=new Map();           // icon -> rgb, so a refresh never repeats the work
function paintColor(a){const c=a.icon&&COLOR_CACHE.get(a.icon);a.rgb=c||GREY;a.c=c?rgbStr(c):'var(--so)'}
function loadColors(done){
  const todo=APPS.filter(a=>a.icon&&!COLOR_CACHE.has(a.icon));
  if(!todo.length){if(done)done(false);return}
  let left=todo.length;
  todo.forEach(a=>{const im=new Image(),fin=()=>{if(--left===0&&done)done(true)};
    im.onload=()=>{try{const c=dominant(im);COLOR_CACHE.set(a.icon,c||GREY)}catch(e){COLOR_CACHE.set(a.icon,GREY)}fin()};
    im.onerror=()=>{COLOR_CACHE.set(a.icon,GREY);fin()};im.src=a.icon});
}
const inits=a=>esc((a.g||a.n||'?').slice(0,2));
const ico=(a,cls)=>a&&a.icon?`<span class="ico ${cls||''}"><img src="${a.icon}" alt="" width="40" height="40"></span>`:`<span class="ico ghost ${cls||''}">${inits(a||{})}</span>`;

/* ---------- the data model ---------- */
let M=null,NOW=0,APPS=[],DELETED=[],MM,PG,BG,BGL=[],SESS=[],HM=[],AH=[],UH=[],CL=[],UNL=0,TODAY=0,NOTIF=0;
let WEEK=[],PREV=0,HAVE_PREV=false,MONTH=[],YEAR=[],YMON=[],WU=[],MU=[],YU=[],RANGE={day:{},week:{},month:{}};
let IDX=new Map(),UNLOCKED=new Set();
const ICONS={};                        // id -> icon picture, filled by the phone (Data layer)
function applyModel(m){
  M=m;
  ({NOW,APPS,DELETED,MM,PG,BG,BGL,SESS,HM,AH,UH,CL,UNL,TODAY,NOTIF,WEEK,PREV,HAVE_PREV,MONTH,YEAR,YMON,WU,MU,YU,RANGE}=m);
  IDX=new Map(APPS.map((a,i)=>[a.id,i]));
  UNLOCKED=new Set(SESS.filter(s=>s.unl).map(s=>s.s));
  APPS.forEach(a=>{if(ICONS[a.id])a.icon=ICONS[a.id];paintColor(a)});
}
const appById=id=>APPS[IDX.get(id)];
const appName=id=>{const a=appById(id)||DELETED.find(d=>d.id===id);return a?a.n:tail(id)};
const appLook=id=>appById(id)||DELETED.find(d=>d.id===id)||{n:tail(id),g:tail(id).slice(0,2),icon:null,c:'var(--so)'};
const opens=i=>APPS[i]?APPS[i].m:0;         // how many times the app was opened (visits, counted by the engine)
const D0=()=>M?new Date(M.now):new Date();
const dAt=o=>new Date(Engine.addDays(M.now,o));
const dName=(o,opt)=>dAt(o).toLocaleDateString(undefined,opt||{weekday:'short'});
const isLive=()=>M&&M.mode==='native';
const hasData=()=>TODAY>0||M&&M.HIST_DAYS>1;

/* ---------- settings the person can change (saved on the phone, read by the blocker) ---------- */
const TEMPLATE_CH=()=>[{id:'c1',n:'Phone-free hour',hrs:1,st:'new'},{id:'c2',n:'Four hours without apps',hrs:4,st:'new'},{id:'c3',n:'Weekend detox',hrs:48,st:'new'}];
const CFG_DEFAULT=()=>({
  goal:420,ugoal:60,limits:[],sched:[],
  flags:{shorts:false,ytsearch:false,igreels:false,igexplore:false,fbreels:false,snap:false,xvideo:false,pause:false,pin:false},
  keywords:[],sites:[],bstyle:'minimal',pauseSec:5,pin:'',theme:'light',muted:{},
  acts:[{n:'Working',m:0},{n:'Reading',m:0},{n:'Studying',m:0}],act:'Working',len:25,ch:TEMPLATE_CH(),introSeen:false
});
const CFG_KEYS=Object.keys(CFG_DEFAULT());
const S={
  tab:'today',range:'day',cat:'All',part:null,hsel:null,openH:new Set(),wsel:null,isel:null,irange:'week',
  f:{act:'Working',len:25,left:1500,run:false},tmp:{},perm:{usage:true,notif:false,a11y:false},intro:0,unlockUntil:0,
  ...CFG_DEFAULT()
};
const cfgSnapshot=()=>{const o={};CFG_KEYS.forEach(k=>{o[k]=S[k]});o.act=S.f.act;o.len=S.f.len;return o};
function cfgApply(c){
  const d=CFG_DEFAULT();
  CFG_KEYS.forEach(k=>{if(c&&c[k]!==undefined&&c[k]!==null)S[k]=c[k];else if(S[k]===undefined)S[k]=d[k]});
  S.flags={...d.flags,...(c&&c.flags||{})};
  S.f={act:(c&&c.act)||S.f.act||'Working',len:(c&&c.len)||S.f.len||25,left:((c&&c.len)||S.f.len||25)*60,run:false};
}
const CFG_KEY='st_cfg_v2';
function saveCfg(){
  clearTimeout(saveCfg.t);
  saveCfg.t=setTimeout(()=>{const j=JSON.stringify(cfgSnapshot());try{localStorage.setItem(CFG_KEY,j)}catch(e){}if(window.Data)Data.setConfig(j)},250);
}
function loadLocalCfg(){try{const j=localStorage.getItem(CFG_KEY);return j?JSON.parse(j):null}catch(e){return null}}

/* limits */
const usedOf=l=>l.kind==='app'?(appById(l.app)?appById(l.app).t:0):((M&&M.SITE&&M.SITE[l.site])||0);
const limName=l=>l.kind==='app'?appName(l.app):l.site;
/* what each range shows for one app (minutes) */
const mins=a=>S.range==='day'?a.t:(RANGE[S.range][a.id]||0);
