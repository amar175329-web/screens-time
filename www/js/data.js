/* Screens Time - data layer.
   One job: produce `raw` (see docs/DATA_CONTRACT.md) for Engine.build().
     - on the phone (Capacitor + the ScreensTime plugin): read it from Android
     - in a browser: ask Sample for it
   The screens never know which one it was. URL switch for testing in a browser: ?data=sample | stress | empty            */
const Data=(function(){
  const qs=new URLSearchParams(location.search);
  let plugin=null,mode='sample',full=null,lastDay='',err=null;
  const ICON_KEY='st_icons_v1';

  function detect(){
    const q=qs.get('data');
    if(q==='sample'||q==='stress'||q==='empty'){mode=q;return}
    try{
      const C=window.Capacitor;
      if(C&&C.isNativePlatform&&C.isNativePlatform()){
        plugin=C.registerPlugin?C.registerPlugin('ScreensTime'):(C.Plugins&&C.Plugins.ScreensTime);
        if(plugin){mode='native';return}
      }
    }catch(e){err=String(e)}
    mode='sample';
  }
  detect();

  const call=async(name,args)=>{
    if(!plugin||typeof plugin[name]!=='function')throw new Error('The phone side is missing: '+name);
    return plugin[name](args||{});
  };

  async function status(){
    if(mode!=='native')return {usage:true,notif:false,a11y:false};
    try{const s=await call('status');return {usage:!!s.usage,notif:!!s.notif,a11y:!!s.a11y}}
    catch(e){err=String(e);return {usage:false,notif:false,a11y:false}}
  }

  /* settings: the phone keeps its own copy because the blocker (a background service) has to read them */
  async function getConfig(){
    if(mode==='native'){try{const r=await call('getConfig');if(r&&r.json){const c=JSON.parse(r.json);if(c&&typeof c==='object')return c}}catch(e){err=String(e)}}
    return null;
  }
  function setConfig(json){if(mode==='native')call('setConfig',{json}).catch(e=>{err=String(e)})}
  function openSettings(which){return mode==='native'?call('openSettings',{which}).catch(e=>{err=String(e)}):Promise.resolve()}

  /* icons: asked for once, then remembered on this device */
  function loadIconCache(){try{const j=localStorage.getItem(ICON_KEY);if(j)Object.assign(ICONS,JSON.parse(j))}catch(e){}}
  function saveIconCache(){try{localStorage.setItem(ICON_KEY,JSON.stringify(ICONS))}catch(e){try{localStorage.removeItem(ICON_KEY)}catch(e2){}}}
  async function fetchIcons(apps){
    if(mode!=='native')return false;
    const miss=apps.filter(a=>!ICONS[a.id]&&!a.icon).map(a=>a.id);let got=false;
    for(let i=0;i<miss.length;i+=30){
      try{const r=await call('getIcons',{ids:miss.slice(i,i+30)});if(r&&r.icons){Object.assign(ICONS,r.icons);got=true}}catch(e){err=String(e);break}
    }
    if(got)saveIconCache();
    return got;
  }

  /* finished days that are not stored yet are summed up here (with the same engine) and handed back to be kept for ever */
  function rollups(d){
    const have=new Set((d.history||[]).map(h=>h.date)),ev=d.events||[],today=Engine.dayStart(d.now);
    if(!ev.length)return [];
    const first=Engine.dayStart(Math.min(...ev.map(e=>e.t))),out=[];
    for(let t=first;t<today;t=Engine.dayStart(Engine.addDays(t,1))){
      const key=Engine.ymd(t);
      if(have.has(key))continue;
      if(t===first&&!(d.history||[]).length)continue;           // the oldest day on a fresh install may be cut off: skip it
      const rec=Engine.rollupDay({apps:d.apps,known:d.known,events:ev,notifications:d.notifications},t);
      if(rec.total>0)out.push(rec);
    }
    return out;
  }

  async function loadNative(){
    const st=await status();
    if(!st.usage)return {raw:{now:Date.now(),mode:'native',apps:[],events:[]},needs:'usage',status:st};
    const today=Engine.dayStart(Date.now());
    let d;
    if(full&&lastDay===Engine.ymd(Date.now())){               // quick refresh: only today's events are asked for
      const t=await call('getData',{since:today-6*3600000});
      d={...full,...t,history:full.history,known:full.known};
    }else{
      d=await call('getData',{});
      const add=rollups(d);
      if(add.length){d.history=[...(d.history||[]),...add];call('saveRollups',{days:add}).catch(e=>{err=String(e)})}
      full=d;lastDay=Engine.ymd(d.now);
    }
    const raw={now:d.now,mode:'native',apps:d.apps||[],known:d.known||[],events:(d.events||[]).filter(e=>e.t>=today-6*3600000),pages:d.pages||[],
      background:d.background||[],notifications:(d.notifications||[]).filter(n=>n.t>=today),history:d.history||[],siteMinutes:d.siteMinutes||{},pause:d.pause||{}};
    return {raw,needs:null,status:st};
  }

  async function load(){
    err=null;
    if(mode!=='native')return {raw:Sample.raw({mode}),needs:null,status:await status()};
    try{return await loadNative()}
    catch(e){err=String(e&&e.message||e);return {raw:{now:Date.now(),mode:'native',apps:[],events:[]},needs:null,status:await status(),error:err}}
  }

  return {get mode(){return mode},get error(){return err},status,getConfig,setConfig,openSettings,fetchIcons,loadIconCache,load,
    sampleConfig:()=>Sample.config(),isNative:()=>mode==='native'};
})();
