'use strict';
/* Screens Time - layers (sheets and pages), actions, shell and start-up. */
const LOGO=window.__LOGO||'assets/logo.png';

/* ---------- layers, sheets, pages ---------- */
const LAY={};
const CLOSE=`<button class="icb" data-act="close" aria-label="Close">${IC.x}</button>`;
function show(id,fn,cls){let el=$('#'+id);if(!el){el=document.createElement('div');el.id=id;$('#ov').appendChild(el)}LAY[id]=fn;el.className=cls||'';el.innerHTML=fn()}
function redraw(id){const el=$('#'+id);if(!el||!LAY[id])return;const sc=()=>id==='sh'?$('.panel',el):el;const st=sc()?sc().scrollTop:0;el.classList.add('static');el.innerHTML=LAY[id]();if(sc())sc().scrollTop=st}
const openSheet=fn=>show('sh',()=>`<div class="backdrop" data-act="close"></div><div class="panel" role="dialog" aria-modal="true">${fn()}</div>`);
const showBk=fn=>show('bk',fn);
function toast(m){$('.toast')?.remove();const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');t.textContent=m;$('#dev').appendChild(t);setTimeout(()=>t.remove(),2300)}
function refresh(){repaint();if($('#pg'))redraw('pg');if(!$('#intro').hidden)$('#intro').innerHTML=introHTML()}
function closeBk(){clearInterval(S.tmp.pt);$('#bk')?.remove()}

function appSheet(id){
  const a=appById(id);if(!a)return `<div class="grab"></div><div class="rowx between"><div class="h2">App</div>${CLOSE}</div>`;
  const i=IDX.get(id),launches=opens(i);
  const pages={};for(let m=0;m<=NOW;m++)if(MM[m]===i){const p=a.pg[PG[m]]||'Opened';pages[p]=(pages[p]||0)+1}
  const pl=Object.entries(pages).sort((x,y)=>y[1]-x[1]).slice(0,8);
  const L=S.limits.find(l=>l.kind==='app'&&l.app===id);
  const avg=Math.round((RANGE.week[id]||0)/Math.max(1,WEEK.filter(q=>q>0).length));
  return `<div class="grab"></div><div class="rowx">${ico(a,'lg')}<div class="grow"><div class="h2 ell">${esc(a.n)}</div><div class="s">${esc(a.cat)}</div></div>${CLOSE}</div>
  <div class="rowx between" style="align-items:flex-end"><div><div class="lbl">Today</div><div class="big">${fm(a.t)}</div></div>${L?(L.min-a.t<0?`<span class="pill bad">${fm(a.t-L.min)} over limit</span>`:`<span class="pill good">${fm(L.min-a.t)} left</span>`):''}</div>
  <div class="stats"><div class="stat"><span>Daily average</span><b>${fm(avg)}</b></div><div class="stat"><span>Opened</span><b>${launches}x</b></div><div class="stat"><span>Notifications</span><b>${a.nf}</b></div></div>
  ${a.t?`<section class="card stack"><div class="lbl">Minutes per hour</div>${area(AH[i],{c:a.c,labels:[[0,'12a'],[6,'6a'],[12,'12p'],[18,'6p'],[23,'11p']],now:NOW/60,peak:(k,q)=>`${hLabel(k)} · ${q}m`,aria:a.n+' per hour'})}</section>`:''}
  ${pl.length?`<section class="card tight"><div class="sec" style="padding:12px 0 2px"><span class="lbl">What was open</span></div>${pl.map(([p,m])=>`<div class="row"><div class="grow"><div class="t ell" style="font-size:13.5px">${esc(p)}</div><div class="bar mt" style="--c:${a.c}"><i style="width:${m/pl[0][1]*100}%"></i></div></div><span class="mono t">${m}m</span></div>`).join('')}</section>`:''}
  <button class="btn block" data-act="${L?'limedit':'limfor'}" data-id="${esc(L?L.id:id)}">${L?'Edit daily limit':'Set a daily limit'}</button>`;
}
function delSheet(id){
  const d=DELETED.find(x=>x.id===id);if(!d)return `<div class="grab"></div><div class="rowx between"><div class="h2">App</div>${CLOSE}</div>`;
  return `<div class="grab"></div><div class="rowx"><span class="ico lg ghost">${esc(d.g)}</span><div class="grow"><div class="h2 ell">${esc(d.n)}</div><div class="s">${esc(d.notes)}</div></div>${CLOSE}</div>
  <div class="card stack"><div class="rowx between"><div><div class="lbl">Total time</div><div class="big">${fm(d.life)}</div></div><span class="pill">Deleted</span></div>
   ${d.hist?area(d.hist,{c:'var(--so)',labels:[[0,d.from],[d.hist.length-1,d.last]],aria:'Usage history of '+d.n,peak:(k,q)=>fm(q)}):''}</div>
  <div class="stats" style="grid-template-columns:1fr 1fr"><div class="stat"><span>Installed</span><b style="font-size:15px">${d.from||'-'}</b></div><div class="stat"><span>Removed</span><b style="font-size:15px">${d.last||'-'}</b></div>${d.peak?`<div class="stat"><span>Busiest day</span><b style="font-size:15px">${esc(d.peak.split(' on ')[0])}</b><small>${esc(d.peak.split(' on ')[1]||'')}</small></div>`:''}<div class="stat"><span>Last 30 days</span><b style="font-size:15px">${fm(d.mo)}</b></div></div>
  <p class="s" style="margin:0">Screens Time keeps the history of removed apps, so your weekly and monthly totals stay true.</p>`;
}
function notifSheet(){
  const list=APPS.filter(a=>a.nf>0).sort((a,b)=>b.nf-a.nf),mx=list.length?list[0].nf:1;
  return `<div class="grab"></div><div class="rowx between"><div><div class="lbl">Today</div><div class="h2">${NOTIF} notifications</div></div>${CLOSE}</div>
  ${list.length?`<p class="s" style="margin:0">Mute the noisy ones. Muted apps stay silent.${isLive()&&!S.perm.notif?' <b>Allow notification access in Settings first.</b>':''}</p>
  <div class="card tight">${list.slice(0,20).map(a=>`<div class="row">${ico(a,'sm')}<div class="grow"><div class="t ell">${esc(a.n)}</div><div class="bar mt" style="--c:${a.c}"><i style="width:${a.nf/mx*100}%"></i></div></div><span class="mono t" style="width:28px;text-align:right">${a.nf}</span><button class="sw" role="switch" aria-checked="${!!S.muted[a.id]}" data-act="mute" data-id="${esc(a.id)}" aria-label="Mute ${esc(a.n)}"></button></div>`).join('')}</div>`
  :`<p class="s" style="margin:0">${S.perm.notif||!isLive()?'No notifications so far today.':'Allow notification access in Settings to count them.'}</p>`}`;
}
function limSheet(){
  const t=S.tmp;
  return `<div class="grab"></div><div class="rowx between"><div class="h2">${t.id?'Edit limit':'Add a limit'}</div>${CLOSE}</div>
  <div class="seg"><button class="${t.kind==='app'?'on':''}" data-act="limkind" data-v="app">App</button><button class="${t.kind==='site'?'on':''}" data-act="limkind" data-v="site">Website</button></div>
  ${t.kind==='app'?`<div style="display:flex;gap:6px;flex-wrap:wrap">${pickIds([t.app],14).map(i=>`<button class="chip ${t.app===i?'on':''}" data-act="limapp" data-v="${esc(i)}">${esc(appName(i))}</button>`).join('')||'<span class="s">No apps yet.</span>'}</div>`:`<input class="txt" id="limsite" placeholder="example.com" value="${esc(t.site||'')}" data-inp="limsite" aria-label="Website">`}
  <div class="stepper"><button data-act="limstep" data-d="-5" aria-label="5 minutes less">&minus;</button><div style="text-align:center"><div class="big">${fm(t.min)}</div><div class="s">per day</div></div><button data-act="limstep" data-d="5" aria-label="5 minutes more">+</button></div>
  <div class="chips" style="justify-content:center">${[15,30,60,120].map(m=>`<button class="chip ${t.min===m?'on':''}" data-act="limq" data-v="${m}">${fm(m)}</button>`).join('')}</div>
  <div><div class="lbl" style="margin-bottom:6px">Reminder before time is up</div><div class="seg">${[[0,'Off'],[5,'5m'],[10,'10m'],[15,'15m']].map(([m,l])=>`<button class="${t.remind===m?'on':''}" data-act="limrem" data-v="${m}">${l}</button>`).join('')}</div></div>
  <button class="btn block" data-act="limsave">${t.id?'Save limit':'Add limit'}</button>${t.id?`<button class="btn bad block" data-act="limdel">Delete limit</button>`:''}`;
}
function goalSheet(){
  return `<div class="grab"></div><div class="rowx between"><div class="h2">Daily budget</div>${CLOSE}</div>
  <p class="s" style="margin:0">The hourglass fills against this number. Under budget keeps the crown.</p>
  <div class="stepper"><button data-act="goalstep" data-d="-15" aria-label="15 minutes less">&minus;</button><div style="text-align:center"><div class="big">${fm(S.goal)}</div><div class="s">per day</div></div><button data-act="goalstep" data-d="15" aria-label="15 minutes more">+</button></div>
  <div class="chips" style="justify-content:center">${[240,360,420,480].map(m=>`<button class="chip ${S.goal===m?'on':''}" data-act="goalq" data-v="${m}">${fm(m)}</button>`).join('')}</div>
  <button class="btn block" data-act="close">Done</button>`;
}
function pinHTML(){
  const t=S.tmp;
  return `<div class="grab"></div><div class="rowx between"><div class="h2">${t.mode==='set'?'Choose a 4 digit PIN':t.mode==='off'?'Enter your PIN to turn it off':'Enter your PIN'}</div>${CLOSE}</div>
  <div class="pins" aria-label="${t.pin.length} of 4 digits entered">${[0,1,2,3].map(i=>`<i class="${i<t.pin.length?'on':''}"></i>`).join('')}</div>
  <div class="pad">${[1,2,3,4,5,6,7,8,9,'',0,'DEL'].map(k=>k===''?'<span></span>':`<button data-act="pad" data-k="${k}" ${k==='DEL'?'aria-label="Delete digit" style="font-size:13px"':''}>${k}</button>`).join('')}</div>`;
}
const csv=()=>{
  const rows=['app,category,minutes_today,notifications,opens',...APPS.filter(a=>a.t>0||a.nf>0).map((a,i)=>`"${a.n.replace(/"/g,'""')}",${a.cat},${a.t},${a.nf},${a.m}`),'','date,minutes,unlocks',
    ...MONTH.map((q,i)=>`${Engine.ymd(Engine.addDays(M.now,i-29))},${q},${MU[i]}`)];
  return rows.join('\n');
};
function exportSheet(){return `<div class="grab"></div><div class="rowx between"><div class="h2">Export data</div>${CLOSE}</div><p class="s" style="margin:0">Today per app, and the last 30 days, as CSV. Copy it into any spreadsheet.</p><textarea class="txt mono" id="csv" rows="9" readonly style="font-size:12px">${esc(csv())}</textarea><button class="btn block" data-act="copycsv">${IC.copy} Copy CSV</button>`}
function actSheet(){return `<div class="grab"></div><div class="rowx between"><div class="h2">New activity</div>${CLOSE}</div><input class="txt" id="actname" placeholder="For example Coding" aria-label="Activity name" maxlength="20" autocomplete="off"><button class="btn block" data-act="actsave">Add activity</button>`}
function chSheet(){const t=S.tmp;return `<div class="grab"></div><div class="rowx between"><div class="h2">New challenge</div>${CLOSE}</div><input class="txt" id="chname" placeholder="For example No scrolling till lunch" aria-label="Challenge name" maxlength="32" autocomplete="off" value="${esc(t.name||'')}" data-inp="chname"><div class="stepper"><button data-act="chstep" data-d="-1" aria-label="One hour less">&minus;</button><div style="text-align:center"><div class="big">${t.hrs}h</div><div class="s">long</div></div><button data-act="chstep" data-d="1" aria-label="One hour more">+</button></div><button class="btn block" data-act="chsave">Add challenge</button>`}

/* the full-screen "time is up" and "wait a moment" screens, shown here as a preview of what the phone draws over the app */
function blockHTML(){
  const st=S.bstyle,l=S.limits.find(x=>x.on&&usedOf(x)>x.min)||S.limits[0],name=l?limName(l):'This app',a=l&&l.kind==='app'?appLook(l.app):null;
  return `<div class="blk ${st==='gif'?'gif':''}"><div class="lbl" style="color:var(--acc)">Screens Time</div>
  ${st==='gif'?`<div style="width:120px">${glass(.5,false,true)}</div>`:''}
  <div class="h1" style="color:#fff">${esc(name)} was blocked</div>
  ${st==='quote'?`<p style="font-size:17px;max-width:290px;margin:0;line-height:1.45">Small breaks, taken on purpose, give you the afternoon back.</p>`:''}
  ${a?ico(a):''}
  ${l?`<div style="width:100%;max-width:300px;display:flex;flex-direction:column;gap:8px"><div class="rowx between"><span>Time allowed</span><b class="mono">${fm(l.min)}</b></div><div class="rowx between"><span>Used today</span><b class="mono">${fm(usedOf(l))}</b></div></div>`:'<p style="margin:0;max-width:280px">This is what you will see when time is up.</p>'}
  <div class="rowx"><button class="btn" data-act="bkclose">Close</button></div></div>`;
}
function startPause(){
  const l=S.limits.find(x=>x.kind==='app'),name=l?limName(l):'this app',P=M.PAUSE;
  S.tmp.pc=S.pauseSec;
  showBk(()=>`<div class="blk"><div class="breathe" id="pcn">${S.pauseSec}</div><div class="h1" style="color:#fff">Pause before you scroll</div>
   <p style="margin:0;max-width:280px">${P.tries?`<b class="mono">${P.tries}</b> attempts to open ${esc(name)} in the last 24 hours.`:`Take a breath before you open ${esc(name)}.`}</p>
   <button class="btn block" style="max-width:320px" data-act="pausedone">I don't want to open it</button>
   <button class="btn ghost block" style="max-width:320px" id="pgo" data-act="pausego" disabled>Continue</button></div>`);
  clearInterval(S.tmp.pt);
  S.tmp.pt=setInterval(()=>{S.tmp.pc--;const c=$('#pcn');if(!c){clearInterval(S.tmp.pt);return}c.textContent=S.tmp.pc>0?S.tmp.pc:'ok';if(S.tmp.pc<=0){$('#pgo').disabled=false;clearInterval(S.tmp.pt)}},1000);
}

/* ---------- Settings ---------- */
/* 'a11y' is the only permission blocking needs: the blocking screen is drawn by the accessibility service itself */
const PERMS=[
  ['usage','Usage access','Needed. Lets Android tell Screens Time which app was open.',true],
  ['notif','Notification access','Counts notifications and mutes the ones you choose.'],
  ['a11y','Accessibility','Blocks apps when time is up, hides Reels and Shorts, blocks words. It only sees which page is open.']
];
function permRows(){
  return PERMS.map(([k,t,s,req])=>`<div class="row"><div class="grow"><div class="t">${t}${req?' <span class="pill">Needed</span>':''}</div><div class="s">${s}</div></div>${S.perm[k]?'<span class="pill good">On</span>':`<button class="btn sm" data-act="permopen" data-k="${k}">Allow</button>`}</div>${k==='a11y'&&isLive()&&!S.perm.a11y?'<div class="s hint">If Android says "Restricted setting": open App info for Screens Time, tap the three dots at the top right, choose Allow restricted settings, then try again. <button class="btn ghost sm" data-act="permopen" data-k="appinfo">Open App info</button></div>':''}`).join('');
}
function morePage(){
  const t=new Date(M.now).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  return `<div class="pagehead"><button class="icb" data-act="pgclose" aria-label="Back">${IC.left}</button><div class="grow"><div class="lbl">Screens Time</div><h1 class="h1">Settings</h1></div></div>
  <section class="card stack"><div class="rowx between"><div class="h2">${isLive()?'Live from this phone':'Sample data'}</div><span class="pill ${isLive()?'good':''}">${isLive()?'Live':'Demo'}</span></div>
   <p class="s" style="margin:0">${isLive()?`Updated at ${t}. Everything stays on this phone.`:'These numbers are a made-up day for the demo. On a phone, the same screens show your own usage.'}</p>
   ${S.loadError?`<p class="s" style="margin:0;color:var(--bad)">Could not read the data: ${esc(S.loadError)}</p>`:''}
   <button class="btn ghost sm" style="align-self:flex-start" data-act="reload">Refresh now</button></section>
  <section class="card tight"><div class="sec" style="padding:12px 0 2px"><span class="lbl">Permissions</span></div>${permRows()}</section>
  <section class="card tight"><div class="sec" style="padding:12px 0 2px"><span class="lbl">Your data</span></div>
   <div class="row"><div class="grow"><div class="t">Export</div><div class="s">Copy today and the last 30 days as CSV</div></div><button class="btn ghost sm" data-act="export">Export</button></div></section>
  <section class="card stack"><div class="lbl">Appearance</div><div class="seg">${[['system','System'],['light','Light'],['dark','Dark']].map(([k,t])=>`<button class="${S.theme===k?'on':''}" data-act="theme" data-v="${k}">${t}</button>`).join('')}</div></section>
  <button class="btn ghost block" data-act="intro">Replay the intro</button>`;
}

/* ---------- intro ---------- */
function ribbonCells(){let r='';for(let b=0;b<144;b++){const cnt={};for(let m=b*10;m<b*10+10;m++)if(MM&&MM[m]>=0)cnt[MM[m]]=(cnt[MM[m]]||0)+1;let best=-1,bc=0;for(const k in cnt)if(cnt[k]>bc){bc=cnt[k];best=+k}r+=best<0?'<i class="off"></i>':`<i style="--c:${APPS[best].c}"></i>`}return r}
function introHTML(){
  const i=S.intro;
  const sl=[
   `<div class="slide"><div class="ribbon" style="height:64px">${ribbonCells()}</div><div><h1 class="h1">Every minute, accounted for.</h1><p class="s" style="font-size:15px;margin-top:10px">See what was open and for how long, down to the minute. Apps you delete keep their history.</p></div></div>`,
   `<div class="slide"><div style="width:140px;margin:0 auto">${glass(.62,false)}</div><div><h1 class="h1">Limits that actually hold.</h1><p class="s" style="font-size:15px;margin-top:10px">Daily limits, set times and a pause before the scroll. Hide Reels and Shorts, keep the rest of the app.</p></div></div>`,
   `<div class="slide"><div><h1 class="h1">One permission, then you are set.</h1><p class="s" style="font-size:15px;margin-top:10px">${isLive()?'Screens Time reads app usage from Android. Everything stays on this phone.':'On a phone, Screens Time reads app usage from Android. In this demo nothing leaves the page.'}</p></div><div class="card tight">${permRows()}</div></div>`];
  return `<div class="rowx between"><div class="brand"><img src="${LOGO}" alt="" width="34" height="34"><span>Screens<b>Time</b></span></div><button class="btn ghost sm" data-act="introdone">Skip</button></div>
  ${sl[i]}<div class="dots">${[0,1,2].map(j=>`<i class="${j===i?'on':''}"></i>`).join('')}</div>
  <button class="btn block" data-act="${i<2?'intronext':'introdone'}">${i<2?'Next':'Start'}</button>`;
}
function showIntro(){const el=$('#intro');S.intro=0;el.hidden=false;el.innerHTML=introHTML()}

/* ---------- actions ---------- */
function setTheme(t){S.theme=t;const r=document.documentElement;if(t==='system')r.removeAttribute('data-theme');else r.setAttribute('data-theme',t)}
function startCh(c){c.st='run';c.end=Date.now()+c.hrs*3600000}
const lim=(app,min,remind)=>{const l=S.limits.find(x=>x.kind==='app'&&x.app===app);if(l){l.min=min;l.on=true}else S.limits.push({id:'l'+Date.now()+app.slice(-4),kind:'app',app,min,on:true,remind:remind||10})};
/* with a PIN on, these need the PIN first (5 minutes after a right PIN, no need to type it again) */
const PROTECTED=new Set(['limtog','limedit','limadd','limfor','schtog','schedit','schadd','kwdel','sitedel','bstyle','pausesec','tog','ai_wind']);
const ACT={
  tab(el){S.tab=el.dataset.v;paint(true)},
  more(){show('pg',morePage,'page')},
  pgclose(){$('#pg')?.remove()},
  close(){if($('#sh')){$('#sh').remove();repaint()}},
  bkclose(){closeBk()},
  range(el){S.range=el.dataset.v;S.wsel=null;paint(true)},
  wbar(el){S.wsel=+el.dataset.i;repaint()},
  gotolimits(){S.tab='limits';paint(true)},
  lpage(el){openLP(el.dataset.v)},
  cat(el){S.cat=el.dataset.v;redraw('pg')},
  allapps(){show('pg',allAppsPage,'page')},
  app(el){openSheet(()=>appSheet(el.dataset.id))},
  delapp(el){openSheet(()=>delSheet(el.dataset.id))},
  notif(){openSheet(notifSheet)},
  mute(el){const id=el.dataset.id;S.muted[id]=!S.muted[id];redraw('sh')},
  goaledit(){openSheet(goalSheet)},
  goalstep(el){S.goal=clamp(S.goal+ +el.dataset.d,60,600);redraw('sh');repaint()},
  goalq(el){S.goal=+el.dataset.v;redraw('sh');repaint()},
  hrtoggle(el){const h=+el.dataset.h;if(S.openH.has(h))S.openH.delete(h);else{S.openH.add(h);S.hsel=h}repaint()},
  hbar(el){const h=+el.dataset.h;
    if(h*60>NOW){toast('This hour has not come yet');return}
    if(!HM[h]){S.hsel=h;S.openH=new Set();repaint();toast('Phone was not used from '+hRange(h));return}
    S.hsel=h;S.openH=new Set([h]);repaint();const r=$('#hr-'+h);if(r)r.scrollIntoView({block:'start',behavior:'smooth'})},
  part(el){const k=+el.dataset.v,go=S.tab!=='time';S.part=k;S.hsel=null;S.openH=new Set();S.tab='time';if(go){drawNav();paint(true)}else repaint()},
  limtog(el){const l=S.limits.find(x=>x.id===el.dataset.id);l.on=!l.on;repaint()},
  limadd(){S.tmp={id:null,kind:'app',app:pickIds([],1)[0]||'',site:'',min:30,remind:10};openSheet(limSheet)},
  limfor(el){S.tmp={id:null,kind:'app',app:el.dataset.id,site:'',min:30,remind:10};openSheet(limSheet)},
  limedit(el){const l=S.limits.find(x=>x.id===el.dataset.id);S.tmp={id:l.id,kind:l.kind,app:l.app||pickIds([],1)[0]||'',site:l.site||'',min:l.min,remind:l.remind};openSheet(limSheet)},
  limkind(el){S.tmp.kind=el.dataset.v;redraw('sh')},
  limapp(el){S.tmp.app=el.dataset.v;redraw('sh')},
  limstep(el){S.tmp.min=clamp(S.tmp.min+ +el.dataset.d,5,480);redraw('sh')},
  limq(el){S.tmp.min=+el.dataset.v;redraw('sh')},
  limrem(el){S.tmp.remind=+el.dataset.v;redraw('sh')},
  limsave(){
    const t=S.tmp;let site='';
    if(t.kind==='site'){site=(t.site||'').trim().toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/.*$/,'');if(!site){toast('Enter a website first');return}}
    else if(!t.app){toast('Pick an app first');return}
    const base={kind:t.kind,min:t.min,remind:t.remind,on:true};
    if(t.kind==='app')base.app=t.app;else base.site=site;
    if(t.id)Object.assign(S.limits.find(x=>x.id===t.id),base);else S.limits.push({id:'l'+Date.now(),...base});
    ACT.close();toast('Limit saved');refresh();
  },
  limdel(){S.limits=S.limits.filter(x=>x.id!==S.tmp.id);ACT.close();toast('Limit deleted');repaint()},
  schtog(el){const x=S.sched.find(q=>q.id===el.dataset.id);x.on=!x.on;repaint()},
  schday(el){const x=S.sched.find(q=>q.id===el.dataset.id),i=+el.dataset.i;x.days[i]=x.days[i]?0:1;redraw('sh');repaint()},
  schall(el){const x=S.sched.find(q=>q.id===el.dataset.id);x.all=!x.all;redraw('sh');repaint()},
  schapp(el){const x=S.sched.find(q=>q.id===el.dataset.id),a=el.dataset.a,k=x.apps.indexOf(a);k<0?x.apps.push(a):x.apps.splice(k,1);redraw('sh');repaint()},
  schdel(el){S.sched=S.sched.filter(q=>q.id!==el.dataset.id);ACT.close();toast('Schedule deleted')},
  schadd(){const id='sc'+Date.now();S.sched.unshift({id,name:'New schedule',days:[0,1,1,1,1,1,0],all:false,start:'20:00',end:'22:00',apps:pickIds([],2),on:true});repaint();openSheet(()=>schSheet(id))},
  schedit(el){const id=el.dataset.id;openSheet(()=>schSheet(id))},
  tog(el){const k=el.dataset.k;S.flags[k]=!S.flags[k];refresh()},
  pausesec(el){S.pauseSec=+el.dataset.v;repaint()},
  trypause(){startPause()},
  pausedone(){closeBk();toast('Nice. Well done');refresh()},
  pausego(){closeBk();toast('This is only a preview');refresh()},
  tryblock(){showBk(blockHTML)},
  kwdel(el){S.keywords.splice(+el.dataset.i,1);repaint()},
  sitedel(el){S.sites.splice(+el.dataset.i,1);repaint()},
  bstyle(el){S.bstyle=el.dataset.v;repaint()},
  pin(){S.tmp={pin:'',mode:S.flags.pin?'off':'set'};openSheet(pinHTML)},
  pad(el){
    const t=S.tmp,k=el.dataset.k;
    if(k==='DEL')t.pin=t.pin.slice(0,-1);else if(t.pin.length<4)t.pin+=k;
    redraw('sh');
    if(t.pin.length===4)setTimeout(()=>{
      if(t.mode==='set'){S.pin=t.pin;S.flags.pin=true;S.unlockUntil=Date.now()+300000;ACT.close();toast('PIN protection on');refresh();saveCfg()}
      else if(t.pin===S.pin){
        if(t.mode==='off'){S.flags.pin=false;ACT.close();toast('PIN protection off');refresh()}
        else{S.unlockUntil=Date.now()+300000;const go=t.after;ACT.close();if(go)go()}
        saveCfg();
      }else{t.pin='';redraw('sh');toast('Wrong PIN, try again')}
    },160);
  },
  fstart(){const f=S.f;f.run=!f.run;updFocus()},
  freset(){S.f.run=false;S.f.left=S.f.len*60;repaint()},
  flen(el){S.f.len=+el.dataset.v;if(!S.f.run)S.f.left=S.f.len*60;repaint()},
  fact(el){S.f.act=el.dataset.v;repaint()},
  actadd(){openSheet(actSheet)},
  actsave(){const n=($('#actname').value||'').trim();if(!n){toast('Give the activity a name');return}if(!S.acts.some(a=>a.n===n))S.acts.push({n,m:0,d:todayKey()});S.f.act=n;ACT.close();repaint()},
  chstart(el){startCh(S.ch.find(c=>c.id===el.dataset.id));repaint();toast('Challenge started')},
  chcancel(el){const c=S.ch.find(x=>x.id===el.dataset.id);c.st='new';delete c.end;repaint()},
  chadd(){S.tmp={name:'',hrs:2};openSheet(chSheet)},
  chstep(el){S.tmp.hrs=clamp(S.tmp.hrs+ +el.dataset.d,1,72);redraw('sh')},
  chsave(){const n=(S.tmp.name||'').trim();if(!n){toast('Name your challenge first');return}S.ch.push({id:'c'+Date.now(),n,hrs:S.tmp.hrs,st:'new'});ACT.close();repaint();toast('Challenge added')},
  irange(el){S.irange=el.dataset.v;S.isel=null;repaint()},
  bar(el){S.isel=+el.dataset.i;repaint()},
  ai_wind(){
    let s=S.sched.find(x=>x.name==='Wind-down');
    const apps=pickIds([],3);
    if(!s){s={id:'sc'+Date.now(),name:'Wind-down',days:[1,1,1,1,1,1,1],all:false,start:'21:30',end:'07:00',apps,on:true};S.sched.unshift(s)}else{s.on=true;s.start='21:30'}
    S.tab='limits';paint(true);openLP('sched');toast('Wind-down starts at 9:30 PM');
  },
  permopen(el){
    const k=el.dataset.k;
    if(Data.isNative()){Data.openSettings(k);toast('Allow Screens Time, then come back')}
    else{S.perm[k]=!S.perm[k];if(k==='usage')S.needs=null;toast('Demo: on a phone this opens Android settings');refresh()}
  },
  reload(){toast('Refreshing');reload().then(()=>refresh())},
  export(){openSheet(exportSheet)},
  copycsv(){const ta=$('#csv');const fb=()=>{ta.focus();ta.select();toast('Selected. Press copy on your keyboard')};try{navigator.clipboard.writeText(ta.value).then(()=>toast('Copied to clipboard'),fb)}catch(e){fb()}},
  theme(el){setTheme(el.dataset.v);redraw('pg')},
  intro(){$('#pg')?.remove();showIntro()},
  intronext(){S.intro++;$('#intro').innerHTML=introHTML()},
  introdone(){$('#intro').hidden=true;S.introSeen=true;paint(true)}
};
const CHG={
  schname(el){S.sched.find(x=>x.id===el.dataset.id).name=el.value.trim()||'Schedule';repaint()},
  schtime(el){S.sched.find(x=>x.id===el.dataset.id)[el.dataset.f]=el.value||'00:00';repaint()},
  goalc(){repaint()}
};
const INP={
  goal(el){S.goal=+el.value;$('#goalv').textContent=fm(S.goal);el.style.setProperty('--p',((S.goal-60)/540*100).toFixed(1)+'%')},
  ugoal(el){S.ugoal=+el.value;$('#ugoalv').textContent=S.ugoal;el.style.setProperty('--p',((S.ugoal-20)/100*100).toFixed(1)+'%')},
  limsite(el){S.tmp.site=el.value},
  chname(el){S.tmp.name=el.value}
};
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');if(!el)return;const f=ACT[el.dataset.act];if(!f)return;
  const a=el.dataset.act;
  if(S.flags.pin&&PROTECTED.has(a)&&!(a==='tog'&&el.dataset.k==='pin')&&Date.now()>S.unlockUntil){S.tmp={pin:'',mode:'verify',after:()=>f(el,e)};openSheet(pinHTML);return}
  f(el,e);saveCfg();
});
document.addEventListener('change',e=>{const el=e.target.closest('[data-chg]');if(el&&CHG[el.dataset.chg]){CHG[el.dataset.chg](el,e);saveCfg()}});
document.addEventListener('input',e=>{const el=e.target.closest('[data-inp]');if(el&&INP[el.dataset.inp]){INP[el.dataset.inp](el,e);saveCfg()}});
document.addEventListener('submit',e=>{
  const f=e.target.closest('[data-form]');if(!f)return;e.preventDefault();
  const inp=$('input',f),v=inp.value.trim().toLowerCase();if(!v)return;
  const list=f.dataset.form==='kw'?S.keywords:S.sites;
  if(!list.includes(v))list.push(v);
  repaint();saveCfg();
});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if($('#bk'))closeBk();else if($('#sh'))ACT.close();else if($('#pg'))ACT.pgclose()});

/* ---------- shell ---------- */
const TABS=[['today','Today'],['time','Timeline'],['limits','Limits'],['focus','Focus'],['insights','Insights']];
const VIEWS={today:gate(viewToday),time:gate(viewTime),limits:viewLimits,focus:viewFocus,insights:gate(viewInsights)};
function drawNav(){
  $('#nav').innerHTML=TABS.map(([k,t])=>`<button class="${S.tab===k?'on':''}" data-act="tab" data-v="${k}" ${S.tab===k?'aria-current="page"':''}>${IC[k]}${t}</button>`).join('');
  const s=$('#bnsub');if(s)s.textContent=isLive()?'This phone':'Sample data';
}
function paint(enter,sweep){
  const v=$('#view'),st=v.scrollTop;S.anim=sweep!=null?sweep:!!enter;if(!enter)v.classList.remove('enter');
  v.innerHTML=VIEWS[S.tab]();S.anim=false;
  if(enter){v.classList.remove('enter');void v.offsetWidth;v.classList.add('enter');v.scrollTop=0}else v.scrollTop=st;
  drawNav();if(enter)countUp();
}
const repaint=()=>{paint(false,false);if($('#pg')&&LAY.pg)redraw('pg')};
function countUp(){
  $$('[data-count]').forEach(el=>{const to=+el.dataset.count,t0=performance.now();
    const step=t=>{const p=clamp((t-t0)/800,0,1),k=1-Math.pow(1-p,3);el.textContent=fm(to*k);if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step)});
}
function tick(){
  const f=S.f,now=Date.now();
  if(f.run&&f.left>0){
    f.left--;
    if(f.left<=0){
      f.run=false;const a=S.acts.find(x=>x.n===f.act);
      if(a){if(a.d!==todayKey()){a.m=0;a.d=todayKey()}a.m+=f.len}
      f.left=f.len*60;toast(`${f.act} session done: ${f.len} min`);saveCfg();if(S.tab==='focus')repaint();
    }else updFocus();
  }
  let fin=false;
  S.ch.forEach(c=>{if(c.st==='run'&&c.end<=now){c.st='done';c.when='Just now';fin=true;toast(c.n+' complete')}});
  $$('[data-end]').forEach(el=>{el.textContent=hms(el.dataset.end-now)});
  $$('[data-bar-end]').forEach(el=>{el.style.width=clamp((1-(el.dataset.barEnd-now)/el.dataset.tot)*100,0,100).toFixed(1)+'%'});
  if(fin){saveCfg();if(S.tab==='focus')repaint()}
}

/* ---------- loading real (or sample) data ---------- */
let loading=null;
function reload(){
  if(loading)return loading;
  loading=(async()=>{
    try{
      const r=await Data.load();
      S.needs=r.needs;S.loadError=r.error||null;
      if(r.status)S.perm={...S.perm,...r.status};
      applyModel(Engine.build(r.raw));
      loadColors(changed=>{if(changed){APPS.forEach(paintColor);refresh()}});
      if(Data.isNative())Data.fetchIcons(APPS).then(got=>{if(got){APPS.forEach(a=>{if(ICONS[a.id])a.icon=ICONS[a.id]});loadColors(()=>{APPS.forEach(paintColor);refresh()})}});
    }catch(e){S.loadError=String(e&&e.message||e);if(!M)applyModel(Engine.emptyModel(Date.now(),'native'))}
    finally{loading=null}
  })();
  return loading;
}
function watchData(){
  if(!Data.isNative())return;
  const go=()=>{if(document.visibilityState==='visible')reload().then(()=>refresh())};
  document.addEventListener('visibilitychange',go);window.addEventListener('focus',go);
  setInterval(go,60000);
}

function updateAreaChartScrub(svg, clientX) {
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  const W = 340, H = 176, pl = 8, pr = 8, pt = 22, pb = 24;
  const relX = Math.max(0, Math.min(rect.width, clientX - rect.left)) / Math.max(1, rect.width) * W;
  const vals = (svg.dataset.vals || '').split(',').map(Number);
  const n = vals.length;
  if (!n) return;
  const k = Math.max(0, Math.min(n - 1, Math.round((relX - pl) / Math.max(1, W - pl - pr) * (n - 1))));
  const max = Math.max(...vals, 1) * 1.15;
  const x = pl + k * (W - pl - pr) / Math.max(1, n - 1);
  const y = pt + (1 - (vals[k] || 0) / max) * (H - pt - pb);
  const dot = svg.querySelector('.ac-dot');
  const guide = svg.querySelector('.ac-guide');
  const txt = svg.querySelector('.ac-txt');
  if (dot) { dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1)); }
  if (guide) { guide.setAttribute('x1', x.toFixed(1)); guide.setAttribute('x2', x.toFixed(1)); guide.style.display = 'block'; }
  if (txt) {
    txt.setAttribute('x', Math.max(56, Math.min(W - 56, x)).toFixed(1));
    txt.setAttribute('y', Math.max(12, y - 11).toFixed(1));
    txt.textContent = hLabel(k) + ' · ' + (vals[k] || 0) + 'm';
  }
}

let activeAreaSvg = null;
document.addEventListener('pointerdown', e => {
  const svg = e.target.closest('[data-chart="area"]');
  if (svg) {
    activeAreaSvg = svg;
    updateAreaChartScrub(svg, e.clientX);
    try { svg.setPointerCapture(e.pointerId); } catch (_) {}
  }
});
document.addEventListener('pointermove', e => {
  if (activeAreaSvg) {
    updateAreaChartScrub(activeAreaSvg, e.clientX);
  }
});
const endAreaScrub = e => {
  if (activeAreaSvg) {
    try { activeAreaSvg.releasePointerCapture(e.pointerId); } catch (_) {}
    activeAreaSvg = null;
  }
};
document.addEventListener('pointerup', endAreaScrub);
document.addEventListener('pointercancel', endAreaScrub);

async function boot(){
  $$('img[data-logo]').forEach(i=>{i.src=LOGO});
  $('#gear').innerHTML=IC.gear;
  Data.loadIconCache();
  let cfg=await Data.getConfig();if(!cfg)cfg=loadLocalCfg();
  if(!cfg&&!Data.isNative())cfg=Sample.config();
  cfgApply(cfg);setTheme(S.theme);
  S.ch.forEach(c=>{if(c.st==='run'&&(!c.end||c.end<=Date.now())){c.st='done';c.when='Completed'}});
  const t0=Date.now();
  await reload();
  drawNav();paint(true);
  setInterval(tick,1000);watchData();
  setTimeout(()=>{
    const sp=$('#splash');sp.classList.add('out');setTimeout(()=>sp.remove(),700);
    if(!S.introSeen)showIntro();
  },Math.max(300,1500-(Date.now()-t0)));
}
boot();
