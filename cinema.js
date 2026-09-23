/* R6: pre-rendered films. Only the active clip and one incoming clip can load.
   No game writes. Copy is independent of media readiness and autoplay. */
(()=>{'use strict';
const frame=document.getElementById('frame'),root=document.createElement('div');
root.id='poolWorld';root.setAttribute('aria-hidden','true');frame.prepend(root);
const poster=document.createElement('img');poster.alt='';poster.className='cinema-poster';root.append(poster);
const slots=[0,1].map(()=>{const v=document.createElement('video');v.muted=true;v.defaultMuted=true;v.playsInline=true;v.preload='none';v.disablePictureInPicture=true;v.setAttribute('aria-hidden','true');root.append(v);return v;});
const notice=document.createElement('aside');notice.id='worldNotice';notice.setAttribute('role','status');notice.hidden=true;
const message=document.createElement('span'),retry=document.createElement('button');retry.textContent='重試影片';notice.append(message,retry);frame.append(notice);
let manifest=null,wanted='title',shown=null,active=-1,sequence=0,quiet=matchMedia('(prefers-reduced-motion: reduce)').matches,loading=null,failed=false,frames=0,lastTime=-1,lastProgress=Date.now(),loops=0,buffering=false;
const url=p=>new URL('cinema/'+p,document.baseURI).href;
const key=k=>k==='title'?'title':/^R[1-6]$/.test(k)?k:'R6';
const tell=(s,canRetry=true)=>{message.textContent=s+' ';retry.hidden=!canRetry;notice.hidden=false;};
const dispose=v=>{v.pause();v.onended=null;v.removeAttribute('src');v.preload='none';v.load();v.classList.remove('cinema-on');};
function metrics(v){if(v.currentTime!==lastTime){if(v.loop&&lastTime>v.currentTime+1)loops++;lastTime=v.currentTime;lastProgress=Date.now();if(buffering){buffering=false;if(!failed)notice.hidden=true;}}Object.assign(root.dataset,{renderer:'prerendered-film',chapter:wanted,clip:v.dataset.clip||'',travel:v.loop?'settled':'moving',rendered:String(frames),worldTime:v.currentTime.toFixed(3),videoWidth:String(v.videoWidth),videoHeight:String(v.videoHeight),quiet:String(quiet),loops:String(loops)});}
function observeVideo(v){if(!v.requestVideoFrameCallback)return;v.requestVideoFrameCallback(()=>{if(slots[active]===v){frames++;metrics(v);}observeVideo(v);});}
slots.forEach(v=>{observeVideo(v);v.addEventListener('timeupdate',()=>{if(slots[active]===v)metrics(v);});v.addEventListener('error',()=>{if(slots[active]===v&&!loading){failed=true;tell('影片播放中斷，現正保留場景及文稿。');}});});
async function play(v,seq){if(quiet||document.hidden)return;try{await v.play();}catch(e){if(seq===sequence&&e.name!=='AbortError'){failed=true;tell('影片暫停，請按「重試影片」開始播放。');}}}
function load(v,path,seq){
 return new Promise((resolve,reject)=>{
  const done=(e)=>{clearTimeout(timer);v.removeEventListener('loadeddata',ready);v.removeEventListener('error',bad);if(loading?.cancel===cancel)loading=null;e?reject(e):resolve();};
  const ready=()=>done(),bad=()=>done(Error('影片未能載入。')),cancel=()=>done(Error('superseded'));
  const timer=setTimeout(()=>done(Error('影片載入逾時。')),25000);
  loading={cancel,seq};v.addEventListener('loadeddata',ready,{once:true});v.addEventListener('error',bad,{once:true});v.preload='auto';v.src=url(path);v.load();
 });
}
async function start(path,loop,seq,destination){
 const next=active===0?1:0,v=slots[next];dispose(v);v.loop=loop;v.dataset.clip=path;
 tell('正在載入場景影片，文稿可繼續使用。',false);
 try{await load(v,path,seq);if(seq!==sequence)return;
  const old=active;active=next;lastTime=-1;lastProgress=Date.now();loops=0;buffering=false;v.classList.add('cinema-on');poster.hidden=true;
  if(old>=0&&old!==next)dispose(slots[old]);shown=destination;failed=false;notice.hidden=true;metrics(v);
  v.onended=loop?null:()=>{if(seq===sequence&&!quiet)start(manifest.scenes[destination].hold,true,seq,destination);};
  document.dispatchEvent(new Event('pool-world-ready'));await play(v,seq);
 }catch(e){if(seq!==sequence||e.message==='superseded')return;dispose(v);failed=true;tell(e.message+' 現正保留場景及文稿；可重試或使用離線版。');}
}
function go(k,force=false){const next=key(k);if(next===wanted&&!force&&(loading||shown===next)&&!failed)return Promise.resolve(true);
 const previous=shown;wanted=next;const seq=++sequence;loading?.cancel();loading=null;
 if(!manifest)return Promise.resolve(false);
 poster.src=url(manifest.scenes[next].poster);poster.hidden=false;
 if(quiet){slots.forEach(dispose);active=-1;shown=next;failed=false;notice.hidden=true;Object.assign(root.dataset,{renderer:'prerendered-film',chapter:next,travel:'still',quiet:'true'});document.dispatchEvent(new Event('pool-world-ready'));return Promise.resolve(true);}
 const transition=previous&&manifest.transitions[previous+'>'+next];
 start(transition||manifest.scenes[next].hold,!transition,seq,next);return Promise.resolve(true);
}
function setQuiet(value){quiet=!!value;root.dataset.quiet=String(quiet);if(quiet){++sequence;loading?.cancel();loading=null;slots.forEach(v=>v.pause());if(active<0||shown!==wanted||!slots[active].loop){slots.forEach(dispose);active=-1;if(manifest)poster.src=url(manifest.scenes[wanted].poster);poster.hidden=false;}shown=wanted;notice.hidden=true;}else go(wanted,true);}
setInterval(()=>{if(active<0||quiet||document.hidden||loading||failed)return;const v=slots[active];if(!v.paused&&!v.ended&&Date.now()-lastProgress>6000){buffering=true;tell('影片正在緩衝，文稿與遊戲控制仍可繼續。');}},1000);
window.PoolWorld={go,quiet:setQuiet};retry.onclick=()=>{if(failed&&active>=0&&shown===wanted&&!slots[active].error&&!loading){failed=false;notice.hidden=true;play(slots[active],sequence);}else go(wanted,true);};
document.addEventListener('visibilitychange',()=>{if(document.hidden)slots.forEach(v=>v.pause());else if(active>=0){lastProgress=Date.now();play(slots[active],sequence);}});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>setQuiet(e.matches));
fetch('cinema/manifest.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('影片清單未能載入。');return r.json();}).then(m=>{if(m.version!=='R6'||!m.scenes?.title||!m.transitions)throw Error('影片清單格式不正確。');manifest=m;go(wanted,true);}).catch(e=>{failed=true;tell(e.message+' 文稿仍可使用，請重新載入。',false);});
})();
