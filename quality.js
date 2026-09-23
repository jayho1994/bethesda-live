/* Optional, local-only measurement panel. It never writes to a game API. */
(()=>{
 if(new URLSearchParams(location.search).get('quality')!=='1')return;
 const panel=document.createElement('aside');panel.id='qualityPanel';panel.style.cssText='position:fixed;right:12px;bottom:12px;z-index:10000;background:#211c15;color:#fff0d8;border:1px solid #b79b69;padding:14px;font:14px/1.6 system-ui;max-width:420px;max-height:70vh;overflow:auto;box-shadow:0 8px 35px #0008';
 panel.innerHTML='<button id="qualityClose" style="float:right">關閉量測面板</button><b>本機流暢度量度</b><p>保持此頁在前景。預覽模式會自動切換畫面，正式遊戲不會推進。</p><button id="qualityRun">量度四十秒</button><button id="qualitySave" disabled>下載結果</button><pre id="qualityResult" style="white-space:pre-wrap">尚未量度。</pre>';
 document.body.append(panel);let report=null,active=false;
 panel.querySelector('#qualityClose').onclick=()=>panel.hidden=true;
 const out=panel.querySelector('#qualityResult'),run=panel.querySelector('#qualityRun'),save=panel.querySelector('#qualitySave');
 run.onclick=()=>{if(active)return;active=true;run.disabled=true;save.disabled=true;report=null;
 const intervals=[];const drawStart=Number(document.getElementById("poolWorld")?.dataset.rendered||0);let start=null,previous=null,hidden=false,finished=false,nextScene=0;const initialVisible=document.visibilityState;const sizes={width:innerWidth,height:innerHeight,dpr:devicePixelRatio};
 const select=document.getElementById('previewSelect')||document.getElementById('reviewSelect');const canPreview=select&&!select.hidden&&select.options.length>5;const indexes=[0,2,8,12,16,22,26,33];let scene=0;
 const noteHidden=()=>{if(document.hidden)hidden=true;};document.addEventListener('visibilitychange',noteHidden);
 const finish=()=>{if(finished)return;finished=true;document.removeEventListener('visibilitychange',noteHidden);const sorted=[...intervals].sort((a,b)=>a-b);const quantile=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]||0;const p50=quantile(.5),p95=quantile(.95);const within=intervals.filter(n=>n<=33.4).length;const valid=!hidden&&initialVisible==='visible'&&intervals.length>=100;
 report={kind:'foreground requestAnimationFrame cadence and WebGL draw counter; not a GPU frame capture',renderedFrames:Number(document.getElementById('poolWorld')?.dataset.rendered||0)-drawStart,renderer:document.getElementById('poolWorld')?.dataset.renderer||'none',at:new Date().toISOString(),userAgent:navigator.userAgent,viewport:sizes,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,samples:intervals.length,medianMs:+p50.toFixed(2),p95Ms:+p95.toFixed(2),estimatedFps:p50?+(1000/p50).toFixed(1):0,within33_4msPercent:intervals.length?+(within/intervals.length*100).toFixed(2):0,automaticPreviewTransitions:scene,backgrounded:hidden,valid,pass:valid&&p95<=33.4,criterion:'At least 95% intervals <=33.4ms; foreground only'};
 out.textContent=JSON.stringify(report,null,2);run.disabled=false;save.disabled=false;active=false;};
 out.textContent='量度中，請保持此頁在前景⋯';
 const frame=t=>{if(finished)return;if(start===null){start=t;previous=t;}else{intervals.push(t-previous);previous=t;}if(canPreview&&t-start>=nextScene&&scene<indexes.length){select.value=String(Math.min(select.options.length-1,indexes[scene++]));select.dispatchEvent(new Event('change',{bubbles:true}));nextScene+=5000;}
 if(t-start>=40000){finish();return;}requestAnimationFrame(frame);};requestAnimationFrame(frame);setTimeout(finish,45000);
 };
 save.onclick=()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='bethesda-device-quality.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
})();
