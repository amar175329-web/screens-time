'use strict';
/* Screens Time - charts, the Today screen and the Timeline screen. */

/* ---------- chart helpers ---------- */
function smooth(p,top,base){
  let d=`M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for(let i=0;i<p.length-1;i++){
    const p0=p[i-1]||p[i],p1=p[i],p2=p[i+1],p3=p[i+2]||p2;
    const y1=clamp(p1[1]+(p2[1]-p0[1])/6,top,base),y2=clamp(p2[1]-(p3[1]-p1[1])/6,top,base);
    d+=`C${(p1[0]+(p2[0]-p0[0])/6).toFixed(1)},${y1.toFixed(1)} ${(p2[0]-(p3[0]-p1[0])/6).toFixed(1)},${y2.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
let gid=0;
function area(v,o={}){
  const W=340,H=o.h||176,pl=8,pr=8,pt=22,pb=24,id='g'+(gid++);
  const max=Math.max(...v,1)*1.15,n=v.length;
  const x=i=>pl+i*(W-pl-pr)/Math.max(1,n-1),y=q=>pt+(1-q/max)*(H-pt-pb);
  const pts=v.map((q,i)=>[x(i),y(q)]);
  const line=n>1?smooth(pts,pt,H-pb):`M${pl},${y(v[0]||0)}`;
  const pk=v.indexOf(Math.max(...v));
  const px=x(pk),py=y(v[pk]||0);
  const tx=clamp(px,56,W-56);
  const grid=[0,.5,1].map(f=>`<line class="gl" x1="${pl}" x2="${W-pr}" y1="${(pt+f*(H-pt-pb)).toFixed(1)}" y2="${(pt+f*(H-pt-pb)).toFixed(1)}"/>`).join('');
  const labs=(o.labels||[]).map(([i,t])=>`<text class="ax" x="${x(i)}" y="${H-6}" text-anchor="${i===0?'start':i===n-1?'end':'middle'}">${t}</text>`).join('');
  const now=o.now!=null?`<line x1="${x(o.now)}" x2="${x(o.now)}" y1="${pt-4}" y2="${H-pb}" style="stroke:var(--mute)" stroke-dasharray="3 4"/><text class="ax" x="${x(o.now)+4}" y="${H-pb-6}" text-anchor="start">now</text>`:'';
  const c=o.c||'var(--acc)';
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(o.aria||'Usage over time')}">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${c};stop-opacity:.42"/><stop offset="1" style="stop-color:${c};stop-opacity:0"/></linearGradient></defs>
  ${grid}<path d="${line}L${x(n-1)},${H-pb}L${x(0)},${H-pb}Z" style="fill:url(#${id})"/>
  <path d="${line}" fill="none" style="stroke:${c}" stroke-width="2.5" stroke-linecap="round"/>
  ${now}<circle cx="${px}" cy="${py}" r="5" style="fill:var(--surf);stroke:${c}" stroke-width="2.5"/>
  <text class="ax" x="${tx}" y="${Math.max(12,py-11)}" text-anchor="middle" style="fill:var(--fg)">${o.peak?o.peak(pk,v[pk]):''}</text>${labs}</svg>`;
}
function bars(v,o={}){
  const W=340,H=o.h||176,pl=6,pr=6,pt=24,pb=24,n=v.length,base=H-pb;
  const goalMax=o.goal||0,max=Math.max(...v,goalMax,1)*1.12;
  const slot=(W-pl-pr)/n,bw=Math.min(26,slot*.62);
  const y=q=>pt+(1-q/max)*(H-pt-pb);
  let out='',hit='';
  v.forEach((q,i)=>{
    const cx=pl+slot*i+slot/2,x0=cx-bw/2,y0=y(q),r=Math.max(0,Math.min(4,bw/2,base-y0));
    const over=o.goal&&q>o.goal,sel=o.sel==null||o.sel===i;
    out+=`<path d="M${x0},${base}V${y0+r}Q${x0},${y0} ${x0+r},${y0}H${x0+bw-r}Q${x0+bw},${y0} ${x0+bw},${y0+r}V${base}Z" style="fill:${over?'var(--warn)':'var(--acc)'};opacity:${sel?1:.5}"/>`;
    hit+=`<rect x="${pl+slot*i}" y="0" width="${slot}" height="${H}" fill="transparent" data-act="${o.act||''}" data-i="${i}"/>`;
    if(o.sel===i)out+=`<text class="ax" x="${cx}" y="${Math.max(11,y0-6)}" text-anchor="middle" style="fill:var(--fg)">${o.fmt?o.fmt(q):q}</text>`;
  });
  const labs=(o.labels||[]).map(([i,t])=>`<text class="ax" x="${pl+slot*i+slot/2}" y="${H-6}" text-anchor="middle">${t}</text>`).join('');
  const gl=o.goal?`<line x1="${pl}" x2="${W-pr}" y1="${y(o.goal)}" y2="${y(o.goal)}" style="stroke:var(--mute)" stroke-dasharray="4 4"/><text class="ax" x="${pl+2}" y="${y(o.goal)-5}" text-anchor="start">${o.goalLabel||'Goal'}</text>`:'';
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(o.aria||'Bar chart')}"><line class="gl" x1="${pl}" x2="${W-pr}" y1="${base}" y2="${base}"/>${gl}${out}${labs}${hit}</svg>`;
}
function glass(f,over,dark,col){
  const id='gc'+(gid++),P='M44 28H156C156 92 116 112 106 134C116 156 156 176 156 240H44C44 176 84 156 94 134C84 112 44 92 44 28Z';
  const sand=col||(over?(dark?'#ff9a8a':'var(--bad)'):(dark?'var(--hl)':'var(--acc)'));
  const fill=dark?'rgba(255,255,255,.12)':'var(--surf2)',stroke=dark?'rgba(255,255,255,.7)':'var(--mute)',cap=dark?'#fff':'var(--fg)',cr=dark?'#121a36':'var(--surf)';
  const top=28+106*f,bot=240-106*f;
  return `<svg viewBox="0 -22 200 292" width="100%" role="img" aria-label="Hourglass showing ${Math.round(f*100)} percent of the budget used">
  <defs><clipPath id="${id}"><path d="${P}"/></clipPath></defs>
  <path d="${P}" style="fill:${fill}"/>
  <g clip-path="url(#${id})"><rect x="40" y="${top.toFixed(1)}" width="120" height="${(134-top).toFixed(1)}" style="fill:${sand}"/>
  <rect x="40" y="${bot.toFixed(1)}" width="120" height="${(106*f+2).toFixed(1)}" style="fill:${sand}"/>
  ${f<.995?`<line class="stream" x1="100" x2="100" y1="130" y2="${bot.toFixed(1)}" style="stroke:${sand}" stroke-width="3"/>`:''}</g>
  <path d="${P}" fill="none" style="stroke:${stroke}" stroke-width="3" stroke-linejoin="round"/>
  <rect x="34" y="16" width="132" height="14" rx="7" style="fill:${cap}"/><rect x="34" y="238" width="132" height="14" rx="7" style="fill:${cap}"/>
  ${over?'':`<path d="M72 14L78 -10L90 2L100 -14L110 2L122 -10L128 14Z" style="fill:${dark?'#ffd166':'#f2b54a'};stroke:${cr};stroke-width:2" stroke-linejoin="round"/>`}</svg>`;
}

/* ---------- day parts: the same three everywhere ---------- */
const PARTS=[
  {k:0,n:'Morning',r:'5 AM to 12 PM',hrs:[5,6,7,8,9,10,11],ic:DAWN},
  {k:1,n:'Afternoon',r:'12 PM to 5 PM',hrs:[12,13,14,15,16],ic:SUN},
  {k:2,n:'Night',r:'5 PM to 5 AM',hrs:[0,1,2,3,4,17,18,19,20,21,22,23],ic:NIGHT}
];
const partOfHour=h=>h>=5&&h<12?0:h>=12&&h<17?1:2;
const curPart=()=>partOfHour(Math.floor(NOW/60));
const hRange=h=>`${hLabel(h)} to ${hLabel((h+1)%24)}`;
function lastHourOf(k){const hs=PARTS[k].hrs,nowH=Math.floor(NOW/60);let best=null;hs.forEach(h=>{if(HM[h]>0&&h<=nowH&&(best===null||h>best))best=h});return best===null?hs.find(h=>h<=nowH)??hs[0]:best}

/* ---------- permission / empty states ---------- */
function permView(){
  return `<section class="hc" style="text-align:center;display:flex;flex-direction:column;gap:14px;align-items:center">
   <div style="width:84px">${glass(.35,false,true)}</div>
   <div><div class="big" style="font-size:26px;line-height:1.15">One permission to start</div>
   <p class="s" style="margin:10px auto 0;max-width:300px;font-size:14px">Android keeps a log of which app was open and when. Screens Time needs your OK to read that log. It stays on this phone.</p></div>
   <button class="btn block" data-act="permopen" data-k="usage">Allow usage access</button>
   <p class="s" style="margin:0;font-size:12.5px">In the list that opens, tap <b>Screens Time</b>, then switch <b>Allow</b> on. Come back here after.</p></section>`;
}
const gate=fn=>()=>S.needs==='usage'?permView():fn();

/* ---------- Today ---------- */
function scope(){
  const items=APPS.map((a,i)=>({a,i,m:mins(a)})).filter(x=>x.m>0);
  const dels=S.range!=='day'?DELETED.map(d=>({a:d,i:-1,m:S.range==='week'?d.wk:d.mo,del:1})).filter(x=>x.m>0):[];
  const all=[...items,...dels].sort((a,b)=>b.m-a.m);
  return {all,total:all.reduce((s,x)=>s+x.m,0)};
}
const rangeDays=()=>S.range==='week'?7:30;
const budget=()=>S.goal*(S.range==='day'?1:rangeDays());
function appRow(x,maxm,total){
  const a=x.a,L=S.range==='day'&&!x.del?S.limits.find(l=>l.kind==='app'&&l.app===a.id&&l.on):null;
  const over=L&&a.t>L.min,sub=x.del?'Deleted app':S.range==='day'?`${opens(x.i)} ${opens(x.i)===1?'time':'times'} opened`:esc(a.cat);
  return `<button class="app" data-act="${x.del?'delapp':'app'}" data-id="${esc(a.id)}"><div class="rowx">${ico(a,'md')}
   <div class="grow"><div class="t ell">${esc(a.n)}</div><div class="s ell">${sub}${over?' · <b class="over">Time is up</b>':''}</div></div>
   <div class="tr"><div class="t" style="font-size:16px">${fm(x.m)}</div></div></div>
   <div class="bar" style="--c:${a.c}"><i style="width:${(x.m/maxm*100).toFixed(1)}%"></i></div></button>`;
}
/* the mood of the day, in words and in colour: green = fine, amber = take care, red = over */
function mood(total,b){
  const over=S.limits.filter(l=>l.on&&usedOf(l)>l.min),f=b?total/b:0;
  if(f>1)return {k:'bad',t:'Over your budget'};
  if(S.range==='day'&&over.length)return {k:'warn',t:over.length===1?'One limit is up':`${over.length} limits are up`};
  if(f>=.8)return {k:'warn',t:'Almost at your budget'};
  return {k:'good',t:total?'You’re doing fine':'Nothing used yet'};
}
function hero(sc){
  const b=budget(),left=b-sc.total,f=clamp(sc.total/Math.max(1,b),0,1),day=S.range==='day',m=mood(sc.total,b);
  const A=S.range==='week'?WEEK:MONTH,daysIn=Math.max(1,A.filter(q=>q>0).length),diff=WEEK.reduce((a,c)=>a+c,0)-PREV;
  const cap=day?'today':S.range==='week'?'in the last 7 days':'in the last 30 days',txt=fm(sc.total);
  const say=left>=0?`${fm(left)} left of your ${fm(b)} budget`:`${fm(-left)} over your ${fm(b)} budget`;
  const facts=day?`${UNL} ${UNL===1?'unlock':'unlocks'} · <button class="lk" data-act="notif">${NOTIF} ${NOTIF===1?'notification':'notifications'}</button>`
    :S.range==='week'&&HAVE_PREV&&PREV>0?`${fm(Math.abs(diff))} ${diff<0?'less':'more'} than last week · ${fm(sc.total/daysIn)} a day`
    :`${fm(sc.total/daysIn)} a day on average`;
  return `<section class="ans ${m.k}"><div class="mood"><i></i>${m.t}</div>
   <div class="arow"><div class="grow"><div class="big" data-count="${sc.total}" style="${txt.length>7?'font-size:min(44px,10.6vw);':''}">${txt}</div><div class="cap">${cap}</div></div><div class="mg">${glass(f,left<0,false,'var(--mc)')}</div></div>
   <div class="mbar" role="img" aria-label="${Math.round(f*100)} percent of the budget used"><i style="width:${(f*100).toFixed(1)}%"></i></div>
   <button class="say" data-act="goaledit" aria-label="Change your budget">${say}${IC.right.replace('width="20" height="20"','width="16" height="16"')}</button>
   <div class="facts2">${facts}</div></section>`;
}
/* one tile per part of the day: the total, and the app that took most of it (its icon names the colour) */
function partData(p){
  const m=new Array(APPS.length).fill(0);let tot=0;
  p.hrs.forEach(h=>{for(let q=h*60;q<h*60+60&&q<=NOW;q++)if(MM[q]>=0){m[MM[q]]++;tot++}});
  return {tot,m};
}
function vParts(){
  const data=PARTS.map(p=>({p,...partData(p),live:p.k===curPart()})),mx=Math.max(...data.map(d=>d.tot),1);
  return data.map(d=>{
    const top=d.m.map((v,i)=>({i,v})).filter(x=>x.v).sort((x,y)=>y.v-x.v)[0],a=top&&APPS[top.i];
    return `<button class="tile ${d.live?'live':''}" data-act="part" data-v="${d.p.k}" aria-label="${d.p.n}, ${d.p.r}, ${fm(d.tot)}${top?`, mostly ${esc(a.n)}`:''}. Open hour by hour"><span class="pic">${d.p.ic}</span>
     <div><div class="tn">${d.p.n}</div><div class="ts">${d.p.r.replace(' to ','–')}</div></div><b>${fm(d.tot)}</b>
     ${a?`<div class="tbar"><i style="width:${Math.max(10,d.tot/mx*100).toFixed(0)}%;--c:${a.c}"></i></div><div class="ts">${ico(a,'xs')}<span class="ell">${esc(a.n)}</span></div>`:'<div class="ts">Phone was quiet</div>'}</button>`}).join('');
}
function daySection(){
  return `<section class="sect"><div><h2 class="h2">When did you use it?</h2><p class="s">Tap a part of the day to see it hour by hour.</p></div><div class="tiles">${vParts()}</div></section>`;
}
/* limits in one sentence */
function limSummary(){
  const on=S.limits.filter(l=>l.on),st=on.map(l=>({l,...limStatus(l)})),over=st.filter(x=>x.left<0),near=st.filter(x=>x.left>=0&&x.cls==='warn');
  let k='',t,sub;
  if(!on.length){t='No limits yet';sub='Add one to protect your time'}
  else if(over.length){k='bad';t=over.length===1?`Time is up for ${esc(limName(over[0].l))}`:`Time is up for ${over.length} limits`;sub='Tap to review'}
  else if(near.length){k='warn';t=`${esc(limName(near[0].l))} has only ${fmL(near[0].left)} left`;sub='Tap to review'}
  else{k='good';t=on.length===1?'Your limit is fine':`All ${on.length} limits are fine`;sub='Tap to see them'}
  return `<button class="lsum ${k}" data-act="gotolimits"><span class="pic">${IC.limits}</span><div class="grow"><div class="lt">${t}</div><div class="ls">${sub}</div></div><span class="cv">${IC.right}</span></button>`;
}
function heat(v,sel){
  const n=v.length,first=dAt(-(n-1)),lead=(first.getDay()+6)%7,mx=Math.max(...v,1);
  let cells='';for(let k=0;k<lead;k++)cells+='<span></span>';
  v.forEach((q,i)=>{
    const d=dAt(i-(n-1)),over=q>S.goal,lv=q/mx;
    const bg=!q?'var(--surf)':over?`color-mix(in srgb,var(--warn) ${Math.round(30+lv*50)}%,var(--bg))`:`color-mix(in srgb,var(--acc) ${Math.round(16+lv*74)}%,var(--bg))`;
    cells+=`<button class="hd ${i===sel?'sel':''}" style="background:${bg}" data-act="wbar" data-i="${i}" aria-label="${dName(i-(n-1),{day:'numeric',month:'short'})}, ${fm(q)}"><span>${d.getDate()}</span></button>`;
  });
  return `<div class="hmap">${'MTWTFSS'.split('').map(d=>`<em>${d}</em>`).join('')}${cells}</div>
   <div class="facts" style="margin-top:2px"><span class="nm"><i class="dot" style="--c:var(--acc)"></i>Under your goal</span><span class="nm"><i class="dot" style="--c:var(--warn)"></i>Over your goal</span></div>`;
}
function periodSection(){
  const v=S.range==='week'?WEEK:MONTH,n=v.length,sel=S.wsel==null||S.wsel>=n?n-1:S.wsel,q=v[sel];
  const lab=i=>dName(i-(n-1),{weekday:'long',day:'numeric',month:'short'});
  const chart=S.range==='week'
    ?bars(v,{labels:v.map((_,i)=>[i,dName(i-6)]),goal:S.goal,goalLabel:'Goal '+fm(S.goal),sel,fmt:fm,act:'wbar',aria:'Screen time per day'})
    :heat(v,sel);
  return `<section class="sect"><div><h2 class="h2">${S.range==='week'?'Day by day':'Your month'}</h2><p class="s">Tap ${S.range==='week'?'a bar':'a day'} to see it.</p></div>${chart}
   <div class="pick"><div><div class="lbl">${lab(sel)}</div><div class="t" style="font-size:18px">${fm(q)}</div></div><span class="pill ${q<=S.goal?'good':'warn'}">${q<=S.goal?fm(S.goal-q)+' under goal':fm(q-S.goal)+' over goal'}</span></div></section>`;
}
function topSection(sc){
  const rows=sc.all.slice(0,3);
  if(!rows.length)return `<section class="sect"><h2 class="h2">Where did your time go?</h2><p class="s">Nothing used ${S.range==='day'?'yet today':'in this time'}.</p></section>`;
  return `<section class="sect"><div class="rowx between"><h2 class="h2">Where did your time go?</h2>${sc.all.length>3?`<button class="tbtn" data-act="allapps">See all ${sc.all.length}</button>`:''}</div>
   <div class="card tight">${rows.map(x=>appRow(x,rows[0].m,sc.total)).join('')}</div></section>`;
}
function viewToday(){
  const sc=scope(),day=S.range==='day';
  return `<div class="tabs" role="tablist">${[['day','Today'],['week','Week'],['month','Month']].map(([k,t])=>`<button class="${S.range===k?'on':''}" data-act="range" data-v="${k}">${t}</button>`).join('')}</div>
  ${hero(sc)}
  ${day?topSection(sc)+daySection()+limSummary()+`<div class="key"><span><i style="--c:var(--good)"></i>Fine</span><span><i style="--c:var(--warn)"></i>Take care</span><span><i style="--c:var(--bad)"></i>Over</span></div>`:periodSection()+topSection(sc)}`;
}
function allAppsPage(){
  const sc=scope(),have=[...new Set(sc.all.filter(x=>!x.del).map(x=>x.a.cat))].sort(),cats=['All',...have,...(DELETED.length?['Deleted']:[])];
  if(!cats.includes(S.cat))S.cat='All';
  let list;
  if(S.cat==='Deleted'){
    list=`<p class="s" style="padding:6px 0 10px">Apps you uninstalled keep their history, so your totals stay true.</p>`+DELETED.map(d=>`<button class="app" data-act="delapp" data-id="${esc(d.id)}"><div class="rowx"><span class="ico ghost">${esc(d.g)}</span><div class="grow"><div class="t ell">${esc(d.n)}</div><div class="s">Installed ${d.from} · removed ${d.last}</div></div><div class="tr"><div class="t">${fm(d.life)}</div><div class="s">in total</div></div></div></button>`).join('');
  }else{
    const rows=sc.all.filter(x=>S.cat==='All'||x.a.cat===S.cat);
    list=rows.length?rows.map(x=>appRow(x,rows[0].m,sc.total)).join(''):'<p class="s" style="padding:14px 0">No apps here.</p>';
  }
  return `<div class="pagehead"><button class="icb" data-act="pgclose" aria-label="Back">${IC.left}</button><div class="grow"><div class="lbl">${S.range==='day'?'Today':S.range==='week'?'Last 7 days':'Last 30 days'}</div><h1 class="h1">All apps</h1></div></div>
  <div class="chips">${cats.map(c=>`<button class="chip ${S.cat===c?'on':''}" data-act="cat" data-v="${esc(c)}">${c==='All'?'All apps':esc(c)}</button>`).join('')}</div>
  <section class="card tight">${list}</section>`;
}

/* ---------- Timeline ---------- */
function hourRuns(h){
  const runs=[];
  for(let m=h*60;m<h*60+60;m++){const k=m>NOW?-1:MM[m];const l=runs[runs.length-1];if(l&&l.k===k)l.n++;else runs.push({k,n:1})}
  return runs.map(r=>r.k<0?`<i class="rest" style="flex:${r.n}"></i>`:`<i style="flex:${r.n};--c:${APPS[r.k].c}"></i>`).join('');
}
function hourBody(h){
  const base=h*60;
  const fg=SESS.filter(x=>x.e>base&&x.s<base+60).map(x=>({t:'fg',...x}));
  const bgr=BGL.filter(x=>x.s>=base&&x.s<base+60).map(x=>({t:'bg',...x}));
  const evs=[...fg,...bgr].sort((a,b)=>b.s-a.s);
  let rows='',prevFg=null;
  evs.forEach(x=>{
    if(x.t==='bg'){const a=APPS[x.a];rows+=`<div class="ev bgev"><span class="evt">${tm(x.s)}</span>${ico(a,'sm')}<div class="grow"><div class="t ell">${esc(a.n)}</div><div class="s">Playing with the screen off</div></div><div class="t">${x.d}m</div></div>`;return}
    if(prevFg&&prevFg.s-x.e>=5)rows+=`<div class="gap">Screen off for ${fm(prevFg.s-x.e)}</div>`;
    const a=APPS[x.a],pg=a.pg[x.p]||'';
    rows+=`<button class="ev" data-act="app" data-id="${esc(a.id)}"><span class="evt">${tm(x.s)}</span>${ico(a,'sm')}<div class="grow"><div class="t ell">${esc(a.n)}</div><div class="s ell">${esc(pg||'Opened')}</div></div><div class="tr">${x.unl?'<span class="pill good">Unlocked</span> ':''}<span class="t">${x.d}m</span></div></button>`;
    prevFg=x;
  });
  return `<div class="hb2"><div class="evs">${rows||'<div class="s">No details for this hour.</div>'}</div></div>`;
}
function viewTime(){
  if(S.part==null)S.part=curPart();
  const P=PARTS[S.part],nowH=Math.floor(NOW/60),hrs=P.hrs;
  if(S.hsel==null||!hrs.includes(S.hsel))S.hsel=lastHourOf(S.part),S.openH=new Set([S.hsel]);
  const tot=hrs.reduce((a,h)=>a+(HM[h]||0),0),unl=CL.filter(c=>hrs.includes(Math.floor(c.s/60))).length;
  const bars=hrs.map(h=>{const q=HM[h]||0,fut=h>nowH;
    return `<button class="hb ${S.hsel===h?'on':''} ${fut?'fut':''}" data-act="hbar" data-h="${h}" aria-label="${hRange(h)}, ${fut?'not yet':q+' minutes'}"><em>${fut||(!q&&S.hsel!==h)?'':q}</em><span class="hk"><i style="height:${(q/60*100).toFixed(1)}%"></i></span><u>${((h+11)%12)+1}<small>${h<12?'AM':'PM'}</small></u></button>`}).join('');
  let list='';
  hrs.slice().sort((a,b)=>b-a).forEach(h=>{
    if(!HM[h]||h>nowH)return;
    const open=S.openH.has(h);
    list+=`<section class="hr ${open?'open':''}" id="hr-${h}"><button class="hrh" data-act="hrtoggle" data-h="${h}" aria-expanded="${open}"><div class="hrt">${hLabel(h)}</div><div class="hrbar">${hourRuns(h)}</div><div class="hrm">${HM[h]}m</div><span class="chev">${IC.down}</span></button>${open?hourBody(h):''}</section>`;
  });
  const tabs=PARTS.map(p=>`<button class="${S.part===p.k?'on':''}" data-act="part" data-v="${p.k}"><b>${p.n}</b><small>${p.r.replace(' to ','–')}</small></button>`).join('');
  return `<div class="tabs tabs3" role="tablist">${tabs}</div>
  <section class="hc"><div class="lbl">${P.n}, ${P.r}</div><div class="big" style="font-size:44px;margin-top:6px">${fm(tot)}</div>
   <div class="s" style="margin-top:6px">${unl} ${unl===1?'unlock':'unlocks'}</div>
   <div class="hbars" style="grid-template-columns:repeat(${hrs.length},minmax(0,1fr))">${bars}</div>
   <div class="s" style="margin-top:10px;font-size:12px">One bar is one hour. The number on top is the minutes used.</div></section>
  <section class="sect"><div><h2 class="h2">Hour by hour</h2><p class="s">Tap an hour to see what was open.</p></div><div class="hrs">${list||'<p class="s" style="margin:0">The phone was not used in this part of the day.</p>'}</div></section>`;
}
