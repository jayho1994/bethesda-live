/* R9: decoded-frame handovers, bounded look-ahead and forward-only ambient loops.
   Presentation only: no game writes, no dependency from copy/control to media. */
(()=>{'use strict';
const frame=document.getElementById('frame'),root=document.createElement('div');
root.id='poolWorld';root.setAttribute('aria-hidden','true');frame.prepend(root);
const style=document.createElement('style');style.textContent=`#poolWorld video{visibility:visible!important;opacity:0;transition:opacity .42s ease;z-index:1}#poolWorld video.cinema-on{opacity:1}#poolWorld .cinema-poster{z-index:0}#poolWeather{position:absolute;inset:0;width:100%;height:100%;z-index:4;pointer-events:none}#poolWorld[data-quiet="true"] video{transition:none}`;document.head.append(style);
const poster=document.createElement('img');poster.alt='';poster.className='cinema-poster';root.append(poster);
const slots=[0,1,2].map(()=>{const v=document.createElement('video');v.muted=true;v.defaultMuted=true;v.playsInline=true;v.preload='none';v.disablePictureInPicture=true;v.setAttribute('aria-hidden','true');root.append(v);return {v,path:null,promise:null,cancel:null,generation:0};});
const notice=document.createElement('aside');notice.id='worldNotice';notice.setAttribute('role','status');notice.hidden=true;
const message=document.createElement('span'),retry=document.createElement('button');retry.textContent='重試影片';notice.append(message,retry);frame.append(notice);
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),order=['title','R1','R2','R3','R4','R5','R6'];
let manifest=null,wanted='title',shown=null,active=null,sequence=0,quiet=reduced.matches,failed=false,pending=false,frames=0,loops=0,lastTime=-1,lastProgress=performance.now(),prefetchTimer=0,travelTarget=null,travelFinishing=false,buffering=false;
const diagnostics={version:'R9',handoffs:[],errors:[],lightning:[],stalls:0,readyEvents:0};
const url=p=>new URL('cinema/'+p,document.baseURI).href;
const key=k=>k==='title'?'title':/^R[1-6]$/.test(k)?k:'R6';
const tell=(s,canRetry=true)=>{message.textContent=s+' ';retry.hidden=!canRetry;notice.hidden=false;};
function dispose(s){s.generation++;s.cancel?.();s.cancel=null;s.v.pause();s.v.onended=null;s.v.classList.remove('cinema-on');s.v.removeAttribute('src');s.v.preload='none';s.v.load();s.path=null;s.promise=null;}
function prune(keep=[]){slots.forEach(s=>{if(s!==active&&!keep.includes(s.path))dispose(s);});}
function prepare(path){
 let s=slots.find(s=>s.path===path);if(s)return s.promise.then(()=>s);
 s=slots.find(s=>s!==active&&!s.path);if(!s)return Promise.reject(Error('影片準備位置不足。'));
 s.path=path;const generation=++s.generation,v=s.v;v.loop=false;v.preload='auto';v.dataset.clip=path;
 s.promise=new Promise((resolve,reject)=>{
  let done=false;
  const finish=e=>{if(done)return;done=true;clearTimeout(timer);v.removeEventListener('loadeddata',ready);v.removeEventListener('error',bad);s.cancel=null;e?reject(e):resolve(s);};
  const ready=()=>finish(),bad=()=>finish(Error('影片未能載入。'));
  const timer=setTimeout(()=>finish(Error('影片載入逾時。')),25000);
  s.cancel=()=>finish(Error('superseded'));v.addEventListener('loadeddata',ready);v.addEventListener('error',bad);v.src=url(path);v.load();
 }).catch(e=>{if(s.generation===generation){s.promise=null;s.path=null;}throw e;});
 return s.promise;
}
function decoded(s,seq){const v=s.v;return new Promise((resolve,reject)=>{
 let complete=false,callback=null;
 const done=e=>{if(complete)return;complete=true;clearTimeout(timer);v.removeEventListener('timeupdate',tick);if(callback!==null)v.cancelVideoFrameCallback?.(callback);e?reject(e):resolve();};
 const tick=()=>{if(seq!==sequence||quiet)return done(Error('superseded'));if(v.currentTime>0&&v.readyState>=2)done();};
 const timer=setTimeout(()=>done(Error('影片尚未開始播放。')),12000);
 if(v.requestVideoFrameCallback)callback=v.requestVideoFrameCallback(()=>seq===sequence&&!quiet?done():done(Error('superseded')));
 else v.addEventListener('timeupdate',tick);
 if(document.hidden){done(Error('hidden'));return;}
 v.play().catch(e=>done(e));
 });}
function metrics(s){const v=s.v;if(v.currentTime!==lastTime){if(v.loop&&lastTime>v.currentTime+1)loops++;lastTime=v.currentTime;lastProgress=performance.now();if(buffering){buffering=false;if(!pending&&!failed)notice.hidden=true;}}
 Object.assign(root.dataset,{renderer:'prerendered-film',version:'R9',chapter:wanted,shown:shown||'',clip:s.path||'',travel:v.loop?'settled':'moving',rendered:String(frames),worldTime:v.currentTime.toFixed(3),videoWidth:String(v.videoWidth),videoHeight:String(v.videoHeight),quiet:String(quiet),loops:String(loops),pending:String(pending)});
 if(!v.loop&&travelTarget&&!travelFinishing&&v.duration-v.currentTime<.58)finishTravel(travelTarget,sequence);
}
function observe(s){const v=s.v;if(!v.requestVideoFrameCallback)return;v.requestVideoFrameCallback(()=>{if(s===active){frames++;metrics(s);}observe(s);});}
slots.forEach(s=>{observe(s);s.v.addEventListener('timeupdate',()=>{if(s===active)metrics(s);});s.v.addEventListener('error',()=>{if(s===active){failed=true;tell('影片播放中斷，文稿與遊戲控制仍可使用。');}});});
async function activate(s,loop,seq,destination,requestedAt){
 if(seq!==sequence||quiet)throw Error('superseded');
 const old=active,v=s.v;v.loop=loop;
 if(s!==old){v.currentTime=0;await decoded(s,seq);}else await v.play();
 if(seq!==sequence||quiet)throw Error('superseded');
 active=s;shown=destination;lastTime=-1;lastProgress=performance.now();loops=0;failed=false;notice.hidden=true;
 v.style.zIndex='3';v.classList.add('cinema-on');if(old&&old!==s)old.v.style.zIndex='2';
 diagnostics.handoffs.push({scene:destination,kind:loop?'hold':'travel',cachedStartMs:Math.round(performance.now()-requestedAt),at:Math.round(performance.now())});
 if(diagnostics.handoffs.length>100)diagnostics.handoffs.shift();
 metrics(s);setWeather(loop&&destination==='R5');
 await new Promise(resolve=>setTimeout(resolve,460));
 if(seq!==sequence)return;
 poster.hidden=true;if(old&&old!==s&&old!==active)dispose(old);v.style.zIndex='1';
 diagnostics.readyEvents++;document.dispatchEvent(new Event('pool-world-ready'));
}
function report(e,seq){if(seq!==sequence||['superseded','hidden'].includes(e.message))return;failed=true;pending=false;diagnostics.errors.push(e.message);tell(e.message+' 現正保留原場景，文稿與遊戲控制可繼續。');}
function scheduleAhead(seq){clearTimeout(prefetchTimer);prefetchTimer=setTimeout(()=>{
 if(seq!==sequence||quiet||document.hidden||pending||!active?.v.loop)return;
 const next=order[order.indexOf(shown)+1];if(!next)return;
 const paths=[manifest.transitions[shown+'>'+next],manifest.scenes[next].hold].filter(Boolean);prune(paths);
 Promise.all(paths.map(prepare)).catch(e=>{if(seq===sequence&&e.message!=='superseded')root.dataset.preload='retry-on-demand';});
 },250);}
async function finishTravel(destination,seq){if(travelFinishing)return;travelFinishing=true;const started=performance.now();
 try{const s=await prepare(manifest.scenes[destination].hold);await activate(s,true,seq,destination,started);if(seq===sequence){pending=false;travelTarget=null;travelFinishing=false;scheduleAhead(seq);}}catch(e){travelFinishing=false;report(e,seq);}}
async function run(next,previous,seq,requestedAt){
 const hold=manifest.scenes[next].hold,transition=previous&&active?.v.loop&&manifest.transitions[previous+'>'+next];
 prune([hold,transition].filter(Boolean));
 const loadingNotice=setTimeout(()=>{if(seq===sequence&&pending&&!failed)tell('正在準備下一個場景，遊戲可繼續。',false);},1500);
 try{
  const pair=await Promise.all([prepare(hold),transition?prepare(transition):Promise.resolve(null)]);if(seq!==sequence||quiet)return;
  if(transition){travelTarget=next;travelFinishing=false;pair[1].v.onended=()=>{if(seq===sequence)finishTravel(next,seq);};await activate(pair[1],false,seq,next,requestedAt);}
  else{await activate(pair[0],true,seq,next,requestedAt);if(seq===sequence){pending=false;scheduleAhead(seq);}}
 }catch(e){report(e,seq);}finally{clearTimeout(loadingNotice);}
}
function go(k,force=false){const next=key(k);if(next===wanted&&!force&&(pending||shown===next)&&!failed)return Promise.resolve(true);
 const previous=shown;wanted=next;const seq=++sequence;clearTimeout(prefetchTimer);travelTarget=null;travelFinishing=false;pending=true;root.dataset.chapter=next;
 if(!manifest)return Promise.resolve(false);
 if(!active||quiet){poster.src=url(manifest.scenes[next].poster);poster.hidden=false;}
 if(quiet){prune();if(active){dispose(active);active=null;}shown=next;pending=false;failed=false;notice.hidden=true;Object.assign(root.dataset,{chapter:next,shown:next,travel:'still',quiet:'true',pending:'false'});setWeather(false);return Promise.resolve(true);}
 run(next,previous,seq,performance.now());return Promise.resolve(true);
}
function setQuiet(value){quiet=!!value;root.dataset.quiet=String(quiet);setWeather(false);if(quiet){++sequence;clearTimeout(prefetchTimer);pending=false;travelTarget=null;slots.forEach(s=>s.v.pause());prune();if(active&&shown===wanted&&active.v.loop){notice.hidden=true;}else go(wanted,true);}else go(wanted,true);}
setInterval(()=>{if(!active||quiet||document.hidden||failed)return;const v=active.v;if(!v.ended&&performance.now()-lastProgress>2500){if(!buffering)diagnostics.stalls++;buffering=true;tell('影片正在緩衝，文字及遊戲按鈕仍可使用。',false);}},1000);
window.PoolWorld={go,quiet:setQuiet,diagnostics};retry.onclick=()=>go(wanted,true);
document.addEventListener('visibilitychange',()=>{if(document.hidden){slots.forEach(s=>s.v.pause());setWeather(false);}else if(!quiet){if(pending||failed)go(wanted,true);else if(active){lastProgress=performance.now();active.v.play().catch(e=>report(e,sequence));setWeather(active.v.loop&&shown==='R5');scheduleAhead(sequence);}}});
reduced.addEventListener('change',e=>setQuiet(e.matches));
/* Weather follows the outdoor opening; lightning is intentionally not tied to a clip's loop. */
const weather=document.createElement('canvas');weather.id='poolWeather';weather.width=960;weather.height=540;weather.hidden=true;root.append(weather);
const ctx=weather.getContext('2d'),rain=Array.from({length:110},()=>({x:Math.random()*960,y:Math.random()*540,s:190+Math.random()*150,l:8+Math.random()*13}));
let weatherOn=false,weatherFrame=0,lastWeather=0,flashAt=-10000,nextFlash=0;
function setWeather(enabled){weatherOn=!!enabled&&!quiet&&!document.hidden;weather.hidden=!weatherOn;root.dataset.weather=weatherOn?'rain':'off';if(weatherOn&&!weatherFrame){lastWeather=0;nextFlash=performance.now()+3500+Math.random()*6000;weatherFrame=requestAnimationFrame(drawWeather);}else if(!weatherOn&&weatherFrame){cancelAnimationFrame(weatherFrame);weatherFrame=0;ctx.clearRect(0,0,960,540);}}
function drawWeather(t){weatherFrame=0;if(!weatherOn)return;weatherFrame=requestAnimationFrame(drawWeather);if(lastWeather&&t-lastWeather<32)return;const dt=Math.min(.08,(t-(lastWeather||t))/1000);lastWeather=t;
 ctx.clearRect(0,0,960,540);ctx.save();ctx.beginPath();ctx.moveTo(134,100);ctx.lineTo(280,0);ctx.lineTo(650,0);ctx.lineTo(740,104);ctx.lineTo(740,372);ctx.lineTo(134,372);ctx.closePath();ctx.clip();
 ctx.strokeStyle='rgba(199,219,232,.22)';ctx.lineWidth=.65;ctx.beginPath();for(const p of rain){p.y+=p.s*dt;p.x-=p.s*.1*dt;if(p.y>540){p.y=-p.l;p.x=Math.random()*960;}ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-2,p.y+p.l);}ctx.stroke();
 if(t>=nextFlash){flashAt=t;nextFlash=t+6500+Math.random()*9500;diagnostics.lightning.push(Math.round(t));if(diagnostics.lightning.length>50)diagnostics.lightning.shift();}
 const age=t-flashAt;if(age<450){const strength=Math.exp(-age/90)*.20;ctx.fillStyle=`rgba(204,224,255,${strength})`;ctx.fillRect(0,0,960,540);}ctx.restore();root.dataset.lightningCount=String(diagnostics.lightning.length);
}
fetch('cinema/manifest.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('影片清單未能載入。');return r.json();}).then(m=>{if(m.version!=='R9'||!m.scenes?.title||!m.transitions)throw Error('影片清單格式不正確。');manifest=m;go(wanted,true);}).catch(e=>{failed=true;tell(e.message+' 文稿仍可使用，請重新載入。',false);});
})();
