'use strict';
/* Screens Time - Limits, Focus and Insights screens (and the pages opened from them). */

/* ---------- Limits ---------- */
const DAYN=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const FLAGKEYS=['shorts','igreels'];   // the feeds the phone side can really detect today; the others are listed as "Soon"
/* the "keep the app, hide the endless videos" list: only apps that are really installed are shown */
const FEEDS=[
  {app:'com.google.android.youtube',n:'YouTube',items:[['shorts','Shorts',1],['ytsearch','Video search']]},
  {app:'com.instagram.android',n:'Instagram',items:[['igreels','Reels',1],['igexplore','Explore']]},
  {app:'com.facebook.katana',n:'Facebook',items:[['fbreels','Reels']]},
  {app:'com.snapchat.android',n:'Snapchat',items:[['snap','Spotlight']]},
  {app:'com.twitter.android',n:'X',items:[['xvideo','Video tab']]}
];
function limStatus(l){const used=usedOf(l),left=l.min-used;return {used,left,cls:left<0?'bad':left<=l.min*.25?'warn':'good'}}
const LICON={
  sched:sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  feeds:sv('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>'),
  words:sv('<path d="M4 7h16M4 12h11M4 17h7"/>'),
  look:sv('<rect x="6" y="3" width="12" height="18" rx="3"/><path d="M10 17.5h4"/>'),
  pin:sv('<rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')
};
const BSTYLE={minimal:'Plain',gif:'Hourglass',quote:'Quote'};
/* apps offered in pickers: the ones that were used most this week come first, then the rest, then anything already chosen */
function pickIds(chosen,n){
  const rank=APPS.filter(a=>!a.sys||(RANGE.week[a.id]||0)>0).sort((a,b)=>(RANGE.week[b.id]||0)-(RANGE.week[a.id]||0)||a.n.localeCompare(b.n)).slice(0,n).map(a=>a.id);
  return [...new Set([...(chosen||[]),...rank])].filter(id=>appById(id));
}

function lrow(act,v,icon,title,hint,status,on){
  return `<button class="lrow" data-act="${act}" data-v="${v}"><span class="pic">${icon}</span><span class="grow"><span class="t" style="display:block">${title}</span><span class="s" style="display:block">${hint}</span></span>${status?`<span class="st ${on?'on':''}">${status}</span>`:''}<span class="cv">${IC.right}</span></button>`;
}
function pgHead(back,title,right){
  return `<div class="pagehead"><button class="icb" data-act="pgclose" aria-label="Back">${IC.left}</button><div class="grow"><div class="lbl">${back}</div><h1 class="h1">${title}</h1></div>${right||''}</div>`;
}
const LSTAT={
  good:sv('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',22),
  warn:sv('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',22),
  bad:sv('<circle cx="12" cy="12" r="9"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>',22)
};
function limHero(){
  const on=S.limits.filter(l=>l.on),st=on.map(l=>({l,...limStatus(l)})),over=st.filter(x=>x.left<0),n=over.length;
  const big=!on.length?'No limits yet':n?`${n} ${n===1?'limit is':'limits are'} over`:'All limits are fine';
  const names=over.slice(0,2).map(x=>esc(limName(x.l))).join(' and ')+(n>2?` and ${n-2} more`:'');
  const sub=!on.length?'Add a limit to protect your time.':n?`Time is up for ${names}.`:`You are within time on all ${on.length} ${on.length===1?'limit':'limits'}.`;
  return `<section class="hc"><div class="lbl">Today</div>
   <div class="big" style="font-size:min(34px,8.6vw);margin-top:8px;line-height:1.1">${big}</div>
   <div class="s" style="margin-top:8px;font-size:14px">${sub}</div></section>`;
}
function limCard(l){
  const {used,left,cls}=limStatus(l),a=l.kind==='app'?appLook(l.app):null;
  const ic=a?ico(a):`<span class="ico ghost">${IC.globe.replace('width="18" height="18"','width="22" height="22"')}</span>`;
  const head=cls==='bad'?['Time is up',`${fmL(-left)} extra today`]:cls==='warn'?['Almost up',`Only ${fmL(left)} left today`]:['Time is fine',`${fmL(left)} left today`];
  return `<section class="lc ${l.on?'':'off'}"><div class="rowx">${ic}<div class="grow"><div class="t ell">${esc(limName(l))}</div><div class="s">Allowed: ${fmL(l.min)} a day${a?'':' (website)'}</div></div>
    <div class="onoff"><span>${l.on?'On':'Off'}</span><button class="sw" role="switch" aria-checked="${l.on}" data-act="limtog" data-id="${esc(l.id)}" aria-label="${esc(limName(l))} limit on or off"></button></div></div>
   <div class="lstat ${cls}">${LSTAT[cls]}<div><b>${head[0]}</b><span>${head[1]}</span></div></div>
   <div><div class="bar lg ${cls==='bad'?'bad':cls==='warn'?'warn':''}" role="img" aria-label="Used ${fmL(used)} of ${fmL(l.min)}"><i style="width:${clamp(used/l.min*100,used?3:0,100).toFixed(1)}%"></i></div>
    <div class="rowx between s" style="margin-top:6px"><span>Used today: <b>${fmL(used)}</b></span><span>Allowed: ${fmL(l.min)}</span></div></div>
   <button class="btn ghost sm" style="align-self:flex-start" data-act="limedit" data-id="${esc(l.id)}">Change limit</button></section>`;
}
/* blocking only works when Android has allowed it: say so, once, with a button */
function blockNotice(){
  if(!isLive()||S.perm.a11y)return '';
  return `<section class="alert" style="cursor:default"><span class="aic">!</span><div class="grow">To block an app, Android needs the Accessibility permission.</div><button class="btn sm" data-act="more">Allow</button></section>`;
}
function viewLimits(){
  const cards=S.limits.map(limCard).join('');
  const sch=S.sched.filter(x=>x.on).length,feeds=FLAGKEYS.filter(k=>S.flags[k]).length+(S.flags.pause?1:0),words=S.keywords.length+S.sites.length;
  return limHero()+blockNotice()+
  `<div><div class="rowx between"><h2 class="h2" style="margin:0">Daily limits</h2><button class="btn sm" data-act="limadd">${IC.plus} Add a limit</button></div>
  <p class="s" style="margin:8px 0 0">Choose how long you want to use an app each day. When the time is up, the app is blocked.</p></div>
  ${cards||'<p class="s" style="margin:0">No limits yet. Tap Add a limit to start.</p>'}
  <div><h2 class="h2" style="margin:6px 0 10px">Other ways to control your time</h2>
  <div class="menu">${lrow('lpage','sched',LICON.sched,'Lock apps at set times','For example, no Instagram at night',sch?`${sch} on`:'Off',sch)}
   ${lrow('lpage','feeds',LICON.feeds,'Hide Reels and Shorts','Use the app without endless videos',feeds?`${feeds} on`:'Off',feeds)}
   ${lrow('lpage','words',LICON.words,'Block words and websites','They will not open',words?`${words} added`:'None',words)}
   ${lrow('lpage','look',LICON.look,'Time-up screen','What you see when time is up',BSTYLE[S.bstyle],0)}
   <div class="lrow"><span class="pic">${LICON.pin}</span><div class="grow"><div class="t">Secret PIN</div><div class="s">Needed to change these limits</div></div><div class="onoff"><span>${S.flags.pin?'On':'Off'}</span><button class="sw" role="switch" aria-checked="${S.flags.pin}" data-act="pin" aria-label="Secret PIN on or off"></button></div></div></div></div>`;
}

/* ---- pages opened from the Limits menu ---- */
function day24(sc){
  if(sc.all)return `<div class="day24"><i style="left:0;width:100%"></i></div>`;
  const a=toMin(sc.start),b=toMin(sc.end),seg=(x,y)=>`<i style="left:${(x/14.4).toFixed(2)}%;width:${((y-x)/14.4).toFixed(2)}%"></i>`;
  return `<div><div class="day24">${a===b?'':a<b?seg(a,b):seg(a,1440)+seg(0,b)}</div><div class="tk24"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span></div></div>`;
}
function lpSched(){
  const cards=S.sched.map(sc=>{
    const apps=sc.apps.filter(id=>appById(id)).map(id=>appById(id)),shown=apps.slice(0,4);
    return `<section class="lc ${sc.on?'':'off'}"><div class="rowx"><button class="grow" data-act="schedit" data-id="${esc(sc.id)}"><div class="t">${esc(sc.name)}</div><div class="s">${sc.all?'All day':ampm(toMin(sc.start))+' to '+ampm(toMin(sc.end))}</div></button>
     <button class="sw" role="switch" aria-checked="${sc.on}" data-act="schtog" data-id="${esc(sc.id)}" aria-label="${esc(sc.name)} on"></button></div>
     <button class="scbody" data-act="schedit" data-id="${esc(sc.id)}" aria-label="Edit ${esc(sc.name)}"><div class="dayc">${'SMTWTFS'.split('').map((d,i)=>`<i class="${sc.days[i]?'on':''}">${d}</i>`).join('')}</div>${day24(sc)}
      <div class="rowx between"><div class="stackic">${shown.map(a=>`${ico(a,'sm')}`).join('')}<span class="more">${apps.length?(apps.length>4?`+${apps.length-4} more`:`${apps.length} blocked`):'No apps picked'}</span></div><span class="tbtn">Edit</span></div></button></section>`}).join('');
  return pgHead('Limits','Lock apps at set times',`<button class="btn sm" data-act="schadd">${IC.plus} New</button>`)+
  `<p class="s" style="margin:0">The apps you choose are locked during these hours. The green bar shows when.</p>
  ${cards||'<p class="s" style="margin:0">No schedules yet. Add one to block apps at set hours.</p>'}`;
}
function schSheet(id){
  const sc=S.sched.find(x=>x.id===id);if(!sc)return `<div class="grab"></div><div class="rowx between"><div class="h2">Schedule</div>${CLOSE}</div>`;
  return `<div class="grab"></div><div class="rowx between"><div class="h2">Edit schedule</div>${CLOSE}</div>
  <input class="txt" id="scn" value="${esc(sc.name)}" data-chg="schname" data-id="${esc(sc.id)}" aria-label="Schedule name" maxlength="28">
  <div><div class="lbl" style="margin-bottom:6px">Days</div><div class="cd">${'SMTWTFS'.split('').map((d,i)=>`<button class="${sc.days[i]?'on':''}" data-act="schday" data-id="${esc(sc.id)}" data-i="${i}" aria-label="${DAYN[i]}" aria-pressed="${!!sc.days[i]}">${d}</button>`).join('')}</div></div>
  <div class="rowx between"><span class="t">All day</span><button class="sw" role="switch" aria-checked="${sc.all}" data-act="schall" data-id="${esc(sc.id)}" aria-label="All day"></button></div>
  ${sc.all?'':`<div class="rowx" style="gap:12px"><label class="grow s">Starts<input class="tin" style="width:100%;display:block" type="time" value="${sc.start}" data-chg="schtime" data-id="${esc(sc.id)}" data-f="start"></label><label class="grow s">Ends<input class="tin" style="width:100%;display:block" type="time" value="${sc.end}" data-chg="schtime" data-id="${esc(sc.id)}" data-f="end"></label></div>`}
  <div><div class="lbl" style="margin-bottom:6px">Blocked apps</div><div class="kw">${pickIds(sc.apps,12).map(i=>`<button class="chip ${sc.apps.includes(i)?'on':''}" data-act="schapp" data-id="${esc(sc.id)}" data-a="${esc(i)}">${esc(appName(i))}</button>`).join('')}</div></div>
  <button class="btn block" data-act="close">Done</button><button class="btn bad block" data-act="schdel" data-id="${esc(sc.id)}">Delete schedule</button>`;
}
function lpFeeds(){
  const here=FEEDS.filter(f=>appById(f.app));
  const feeds=here.map(f=>{const a=appById(f.app);
    return f.items.map(([k,l,ready])=>`<div class="feed">${ico(a)}<div class="grow"><div class="t">${l}</div><div class="s">${f.n}</div></div>${ready?`<button class="sw" role="switch" aria-checked="${!!S.flags[k]}" data-act="tog" data-k="${k}" aria-label="Hide ${f.n} ${l}"></button>`:'<span class="pill">Soon</span>'}</div>`).join('')}).join('');
  const on=here.reduce((n,f)=>n+f.items.filter(([k,,r])=>r&&S.flags[k]).length,0),P=M.PAUSE;
  return pgHead('Limits','Hide Reels and Shorts')+
  `<section class="sect"><div class="rowx between"><div><h2 class="h2">Keep the app, hide the endless videos</h2><p class="s">Switch on the parts you want hidden. This follows how the apps are built today, so an app update can break it until Screens Time is updated too.</p></div>${here.length?`<span class="pill ${on?'good':''}">${on} hidden</span>`:''}</div><div>${feeds||'<p class="s" style="margin:0">None of these apps are on this phone.</p>'}</div></section>
  <section class="sect"><div class="rowx"><span class="pic">${LICON.sched.replace('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>','<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>')}</span><div class="grow"><h2 class="h2">A short wait before opening</h2><p class="s">Apps that have a daily limit show a countdown first, so you can change your mind.</p></div><button class="sw" role="switch" aria-checked="${S.flags.pause}" data-act="tog" data-k="pause" aria-label="Short wait before opening"></button></div>
   <div class="seg">${[3,5,10].map(n=>`<button class="${S.pauseSec===n?'on':''}" data-act="pausesec" data-v="${n}">${n} sec</button>`).join('')}</div>
   ${P.tries?`<p class="s" style="margin:0">You stopped yourself ${P.tries}x in the last 24 hours${P.saved>0?` and saved ${fm(P.saved)}`:''}.</p>`:''}
   <button class="btn ghost block" data-act="trypause">See how it looks</button></section>`;
}
function lpWords(){
  return pgHead('Limits','Block words and websites')+
  `<section class="sect"><div><h2 class="h2">Words</h2><p class="s">A page that shows one of these words is closed. Works in browsers and in social apps.</p></div>
   <div class="kw">${S.keywords.map((k,i)=>`<span class="chip x">${esc(k)}<button data-act="kwdel" data-i="${i}" aria-label="Remove ${esc(k)}">${IC.x}</button></span>`).join('')||'<span class="s">No words yet.</span>'}</div>
   <form data-form="kw" class="rowx"><input class="txt" id="kwin" placeholder="Add a word or phrase" aria-label="New keyword" autocomplete="off"><button class="btn sm" type="submit">Add</button></form></section>
  <section class="sect"><div><h2 class="h2">Websites</h2><p class="s">These sites will not open in your browser.</p></div>
   <div class="kw">${S.sites.map((k,i)=>`<span class="chip x">${esc(k)}<button data-act="sitedel" data-i="${i}" aria-label="Remove ${esc(k)}">${IC.x}</button></span>`).join('')||'<span class="s">No websites yet.</span>'}</div>
   <form data-form="site" class="rowx"><input class="txt" id="sitein" placeholder="example.com" aria-label="New website" autocomplete="off"><button class="btn sm" type="submit">Add</button></form></section>`;
}
function lpLook(){
  const styles=[['minimal','Plain','<div class="pv"><u></u><u class="s"></u><u class="b"></u></div>'],['gif','Hourglass',`<div class="pv g"><div class="pvg">${glass(.5,false,true)}</div><u class="s"></u></div>`],['quote','Quote','<div class="pv"><b class="qm">&ldquo;</b><u class="s"></u><u class="s"></u></div>']];
  return pgHead('Limits','Time-up screen')+
  `<section class="sect"><div><h2 class="h2">What you see when time is up</h2><p class="s">Pick one. It covers the app when your time is over.</p></div>
   <div class="bstyles">${styles.map(([k,t,pv])=>`<button class="bs ${S.bstyle===k?'on':''}" data-act="bstyle" data-v="${k}" aria-pressed="${S.bstyle===k}">${pv}<span>${t}</span></button>`).join('')}</div>
   <button class="btn block" data-act="tryblock">See the full screen</button></section>`;
}
const LP={sched:lpSched,feeds:lpFeeds,words:lpWords,look:lpLook};
const openLP=v=>show('pg',LP[v],'page');

/* ---------- Focus ---------- */
const FON='#ffb38a',FOFF='rgba(255,255,255,.2)';
function ringPos(pr){const a=pr*2*Math.PI-Math.PI/2;return [130+112*Math.cos(a),130+112*Math.sin(a)]}
const ft=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const todayKey=()=>Engine.ymd(M?M.now:Date.now());
const actToday=a=>a.d===todayKey()?a.m:0;
function viewFocus(){
  const f=S.f,pr=1-f.left/(f.len*60),[dx,dy]=ringPos(pr),n=Math.round(pr*60);
  let ticks='';
  for(let i=0;i<60;i++){const a=i*6*Math.PI/180-Math.PI/2,r1=i%5?100:95,r2=108;
    ticks+=`<line class="tk" x1="${(130+r1*Math.cos(a)).toFixed(1)}" y1="${(130+r1*Math.sin(a)).toFixed(1)}" x2="${(130+r2*Math.cos(a)).toFixed(1)}" y2="${(130+r2*Math.sin(a)).toFixed(1)}" stroke-width="${i%5?2.5:4}" stroke-linecap="round" style="stroke:${i<n?FON:FOFF}"/>`}
  const total=S.acts.reduce((s,a)=>s+actToday(a),0);
  const run=S.ch.filter(c=>c.st==='run'),news=S.ch.filter(c=>c.st==='new'),done=S.ch.filter(c=>c.st==='done').slice(-2);
  const runRow=c=>{const tt=c.hrs*3600000;return `<div class="chrun"><div class="rowx between"><div class="t">${esc(c.n)}</div><span class="pill">${c.hrs}h challenge</span></div><div class="big mono" data-end="${c.end}">${hms(c.end-Date.now())}</div><div class="bar"><i data-bar-end="${c.end}" data-tot="${tt}" style="width:${clamp((1-(c.end-Date.now())/tt)*100,0,100).toFixed(1)}%"></i></div><div class="s">Apps are locked until it ends.</div><button class="btn bad sm" style="align-self:flex-start" data-act="chcancel" data-id="${esc(c.id)}">Give up</button></div>`};
  const newRow=c=>`<div class="ask" style="align-items:center"><div class="grow"><div class="t">${esc(c.n)}</div><div class="s">${c.hrs} ${c.hrs===1?'hour':'hours'}</div></div><button class="btn sm" data-act="chstart" data-id="${esc(c.id)}">Start</button></div>`;
  const doneRow=c=>`<div class="ask" style="align-items:center"><span class="ico">${IC.check.replace('width="16" height="16"','width="22" height="22"')}</span><div class="grow"><div class="t">${esc(c.n)}</div><div class="s">${c.hrs}h · ${c.when||'Completed'}</div></div></div>`;
  return `<section class="hc"><div class="rowx between"><div class="lbl">Focus session</div><span class="pill">${f.len} min</span></div>
   <div class="fd" id="fring"><svg viewBox="0 0 260 260" width="100%" role="img" aria-label="Focus timer dial">${ticks}<circle id="fdot" cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="7" style="fill:${FON};stroke:#0b3a36" stroke-width="3"/></svg>
    <div class="mid"><div class="lbl" id="fsub">${esc(f.act)}</div><div class="big mono" id="ftime">${ft(f.left)}</div><div class="s">remaining</div></div></div>
   <div class="fctl"><button class="btn" id="fbtn" data-act="fstart">${f.run?'Pause':f.left<f.len*60?'Resume':'Start'}</button><button class="btn ghost" data-act="freset">Reset</button></div>
   <div class="chips" style="justify-content:center;margin-top:12px">${[15,25,45,60].map(m=>`<button class="chip ${f.len===m?'on':''}" data-act="flen" data-v="${m}">${m} min</button>`).join('')}</div></section>
  <section class="sect"><div class="rowx between"><div><h2 class="h2">Focusing on</h2><p class="s">Finished sessions are added to it.</p></div><div class="big" style="font-size:24px">${fm(total)}</div></div>
   <div class="kw">${S.acts.map(a=>`<button class="chip ${f.act===a.n?'on':''}" data-act="fact" data-v="${esc(a.n)}">${esc(a.n)}${actToday(a)?` · ${fm(actToday(a))}`:''}</button>`).join('')}<button class="chip" data-act="actadd">+ New</button></div></section>
  <section class="sect"><div class="rowx between"><div><h2 class="h2">Detox challenges</h2><p class="s">Put the phone down for a set time.</p></div><button class="btn sm" data-act="chadd">${IC.plus} New</button></div>
   ${run.map(runRow).join('')}${news.map(newRow).join('')}${done.map(doneRow).join('')}
   ${S.ch.length?'':'<p class="s" style="margin:0">No challenges yet. Add one.</p>'}</section>`;
}
function updFocus(){
  const f=S.f,t=$('#ftime');if(!t)return;
  t.textContent=ft(f.left);
  const pr=1-f.left/(f.len*60),n=Math.round(pr*60);
  $$('#fring .tk').forEach((l,i)=>{l.style.stroke=i<n?FON:FOFF});
  const [x,y]=ringPos(pr),d=$('#fdot');d.setAttribute('cx',x.toFixed(1));d.setAttribute('cy',y.toFixed(1));
  const b=$('#fbtn');if(b)b.textContent=f.run?'Pause':f.left<f.len*60?'Resume':'Start';
}

/* ---------- Insights ---------- */
function insightsList(){
  const out=[];
  const over=S.limits.filter(l=>l.on&&usedOf(l)>l.min).sort((a,b)=>(usedOf(b)-b.min)-(usedOf(a)-a.min))[0];
  if(over)out.push({t:`${esc(limName(over))} went ${fmL(usedOf(over)-over.min)} over its limit`,b:'Locking it at set times makes it easier to stop.',a:'Lock at set times',act:'lpage',v:'sched'});
  const top=APPS.filter(a=>!a.sys).sort((a,b)=>b.t-a.t)[0];
  if(!S.limits.length&&TODAY>S.goal&&top&&top.t>0)out.push({t:`${esc(top.n)} took ${fm(top.t)} today`,b:'A daily limit on your busiest app is the quickest way to cut time.',a:`Limit ${esc(top.n)}`,act:'limfor',id:top.id});
  const pk=HM.indexOf(Math.max(...HM));
  if(TODAY>0&&HM[pk]>0)out.push({t:`Your busiest hour was ${hLabel(pk)} with ${HM[pk]} min`,b:`That is ${Math.round(HM[pk]/TODAY*100)}% of today. A wind-down lock in the evening can trim it.`,a:'Add wind-down',act:'ai_wind'});
  return out.slice(0,2);
}
function viewInsights(){
  const wsum=WEEK.reduce((a,b)=>a+b,0),diff=wsum-PREV,pct=PREV?Math.abs(Math.round((wsum/PREV-1)*100)):0,days=Math.max(1,WEEK.filter(q=>q>0).length);
  const R=S.irange,v=R==='week'?WEEK:R==='month'?MONTH:YEAR;
  const n=v.length,sel=S.isel==null||S.isel>=n?n-1:S.isel;
  const now=new Date(M.now),mName=i=>new Date(now.getFullYear(),now.getMonth()-11+i,1);
  const lab=i=>R==='week'?dName(i-6,{weekday:'long',day:'numeric',month:'short'}):R==='month'?dName(i-29,{day:'numeric',month:'short'}):mName(i).toLocaleDateString(undefined,{month:'long',year:'numeric'});
  const labels=R==='week'?v.map((_,i)=>[i,dName(i-6)]):R==='month'?[0,7,14,21,29].map(i=>[i,dName(i-29,{day:'numeric'})]):v.map((_,i)=>[i,mName(i).toLocaleDateString(undefined,{month:'short'}).slice(0,3)]);
  const chart=bars(v,{labels,goal:S.goal,goalLabel:'Goal '+fm(S.goal),sel,fmt:fm,act:'bar',aria:'Screen time by '+(R==='year'?'month':'day')});
  const wmx=Math.max(...WEEK,1),ideas=insightsList();
  const head=HAVE_PREV&&PREV>0?`<div class="big" style="margin-top:8px;font-size:min(46px,11vw)">${fm(Math.abs(diff))} ${diff<0?'less':'more'}</div><div class="s" style="margin-top:6px">than last week, ${pct}% ${diff<0?'down':'up'} · ${fm(wsum/days)} a day</div>`
    :`<div class="big" style="margin-top:8px;font-size:min(46px,11vw)">${fm(wsum/days)} a day</div><div class="s" style="margin-top:6px">Last week's numbers will appear after a few more days.</div>`;
  return `<section class="hc"><div class="lbl">This week</div>${head}
   <div class="minis w">${WEEK.map((q,i)=>`<div class="mb ${i===6?'on':''}"><i style="height:${Math.max(6,q/wmx*100)}%"></i></div>`).join('')}</div>
   <div class="dl">${WEEK.map((_,i)=>`<span>${dName(i-6,{weekday:'narrow'})}</span>`).join('')}</div></section>
  <section class="sect"><div><h2 class="h2">Look back</h2><p class="s">Tap a bar to see that ${R==='year'?'month (a daily average)':'day'}.</p></div>
   <div class="seg">${[['week','Week'],['month','Month'],['year','Year']].map(([k,t])=>`<button class="${R===k?'on':''}" data-act="irange" data-v="${k}">${t}</button>`).join('')}</div>
   ${chart}
   <div class="pick"><div><div class="lbl">${lab(sel)}</div><div class="t" style="font-size:18px">${fm(v[sel])}${R==='year'?' a day':''}</div></div>${v[sel]?`<span class="pill ${v[sel]>S.goal?'warn':'good'}">${v[sel]>S.goal?'Over':'Under'} the goal</span>`:''}</div></section>
  <section class="sect"><div><h2 class="h2">Your goals</h2><p class="s">The hourglass and bars measure against these.</p></div>
   <div><div class="rowx between"><span class="t">Daily screen time</span><span class="t" id="goalv">${fm(S.goal)}</span></div><input type="range" id="goalr" min="60" max="600" step="15" value="${S.goal}" style="--p:${((S.goal-60)/540*100).toFixed(1)}%" data-inp="goal" data-chg="goalc" aria-label="Daily screen time goal"></div>
   <div><div class="rowx between"><span class="t">Unlocks a day</span><span class="t" id="ugoalv">${S.ugoal}</span></div><input type="range" id="ugoalr" min="20" max="120" step="5" value="${S.ugoal}" style="--p:${((S.ugoal-20)/100*100).toFixed(1)}%" data-inp="ugoal" data-chg="goalc" aria-label="Unlock goal"><div class="s" style="margin-top:6px">${UNL} unlocks so far today.</div></div></section>
  ${ideas.length?`<section class="sect"><div><h2 class="h2">Ideas for you</h2><p class="s">Small changes that would help most.</p></div>
   ${ideas.map((x,i)=>`<div class="ask"><span class="n">${i+1}</span><div class="grow"><div class="t">${x.t}</div><div class="s" style="margin:3px 0 0">${x.b}</div><button class="btn sm" style="margin-top:10px" data-act="${x.act}"${x.v?` data-v="${x.v}"`:''}${x.id?` data-id="${esc(x.id)}"`:''}>${x.a}</button></div></div>`).join('')}</section>`:''}`;
}
