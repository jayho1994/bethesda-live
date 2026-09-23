/* R4 camera: a shared pool world, chapter destinations, refracted water.
   The paintings are 2D source material; perspective geometry and water render in WebGL.
   This is layered 2.5D, not a surveyed 3D reconstruction of ancient Jerusalem. */
(()=>{'use strict';
const canvas=document.createElement('canvas');canvas.id='poolWorld';canvas.setAttribute('aria-hidden','true');document.getElementById('frame').prepend(canvas);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');let quiet=reduced.matches;let gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});
const destinations=[[.5,.5,1],[.17,.76,2.8],[.12,.24,2.8],[.47,.14,2.8],[.86,.28,2.8],[.87,.74,2.8],[.56,.85,2.8]];
const paths=['world','R1','R2','R3','R4','R5','R6'].map(k=>'art/pool-'+k+'.png');
let active=0,previous=0,started=0,ready=false,lastFrame=0,raf=0,missing=new Set(),loaded=new Set(),generation=0;
const frame=document.getElementById('frame');
function notice(){canvas.dataset.missing=[...missing].join(',');document.getElementById('status').dataset.artMissing=missing.size?'部分場景未載入；保留全文，使用可用的靜態背景。':'';}
function fallback(index){canvas.hidden=true;frame.style.backgroundImage=`linear-gradient(90deg,#171a1820,#171a18b0),url('${paths[index]}'),url('${paths[0]}')`;frame.style.backgroundSize='cover';canvas.dataset.renderer='still';}
if(!gl){window.PoolWorld={go:async key=>{fallback(key==='title'?0:Number(key.slice(1))||0);return true;},quiet:()=>{}};return;}
const vert=`attribute vec2 a;uniform vec3 camera;uniform float tilt;varying vec2 uv;void main(){uv=a;vec2 p=(a-camera.xy)*2.*camera.z;float depth=(1.-a.y)*.13;float w=1.+depth*tilt;gl_Position=vec4(p.x,-p.y+depth*tilt*.18,depth,w);}`;
const frag=`precision mediump float;varying vec2 uv;uniform sampler2D world;uniform sampler2D scene;uniform float time;uniform float blend;uniform float weather;uniform float motion;uniform float opacity;
vec3 water(sampler2D img,vec2 p,float t){vec3 c=texture2D(img,p).rgb;float teal=smoothstep(.01,.075,min(c.g-c.r,c.b-c.r));float wave=sin(p.x*180.+p.y*72.+t*.65)*sin(p.y*125.-t*.8);vec2 shift=vec2(wave,sin(p.x*104.-t*.6))*.0008*teal*motion;vec3 wet=texture2D(img,clamp(p+shift,.001,.999)).rgb;return wet+teal*wave*.026*motion;}
void main(){vec2 p=clamp(uv,.001,.999);vec3 c=water(world,p,time);float cloud=(sin(p.x*3.+time*.013)+sin(p.y*5.-time*.012))*.015*motion;
vec3 grade=mix(vec3(1.03,1.,.96),vec3(.73,.84,.93),weather);c=c*grade+cloud;
gl_FragColor=vec4(c,opacity);}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
let program,cam,tim,wea,mot,tilt,tex,sceneLayer,opacity;const chapterTextures=new Map();try{
 program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vert));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,frag));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('link');gl.useProgram(program);
 const vertices=[];for(let y=0;y<24;y++)for(let x=0;x<40;x++){const l=x/40,r=(x+1)/40,t=y/24,b=(y+1)/24;vertices.push(l,t,r,t,l,b,l,b,r,t,r,b);}const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
 cam=gl.getUniformLocation(program,'camera');tim=gl.getUniformLocation(program,'time');wea=gl.getUniformLocation(program,'weather');mot=gl.getUniformLocation(program,'motion');tilt=gl.getUniformLocation(program,'tilt');
 opacity=gl.getUniformLocation(program,'opacity');gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,1,1,0,gl.RGB,gl.UNSIGNED_BYTE,new Uint8Array([25,30,27]));
 sceneLayer=document.createElement('div');sceneLayer.id='chapterScene';sceneLayer.setAttribute('aria-hidden','true');canvas.after(sceneLayer);
}catch(e){fallback(0);window.PoolWorld={go:async k=>{fallback(k==='title'?0:Number(k.slice(1))||0);return true;},quiet:()=>{}};return;}
const images=new Map();function load(index){if(images.has(index))return images.get(index);const p=new Promise(resolve=>{const img=new Image();let done=false;const end=value=>{if(done)return;done=true;clearTimeout(timer);if(value){loaded.add(index);missing.delete(index);}else{images.delete(index);missing.add(index);}notice();resolve(value);};const timer=setTimeout(()=>end(null),10000);img.onload=()=>end(img);img.onerror=()=>end(null);img.src=paths[index];});images.set(index,p);return p;}
function size(){const r=canvas.getBoundingClientRect(),w=Math.min(1920,Math.round(r.width*devicePixelRatio)),h=Math.round(w*9/16);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}}
const mix=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t);
function render(now){raf=0;if(document.hidden)return;lastFrame=now;size();let p=quiet?1:Math.min(1,(now-started)/4200),from=destinations[previous],to=destinations[active],camera;
 if(p<.35){const t=smooth(p/.35);camera=[mix(from[0],.5,t),mix(from[1],.5,t),mix(from[2],1.05,t)];}else{const t=smooth((p-.35)/.65);camera=[mix(.5,to[0],t),mix(.5,to[1],t),mix(1.05,to[2],t)];}
 // Return to the whole pool for the opening and final reveal.
 if(active===0&&p===1)camera=to;
 gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1f(opacity,1);gl.uniform3fv(cam,camera);gl.uniform1f(tim,quiet?0:now/1000);gl.uniform1f(wea,[0,.05,.2,.08,.24,.8,.3][active]);gl.uniform1f(mot,quiet?0:1);gl.uniform1f(tilt,quiet?0:(1-p)*.25);gl.drawArrays(gl.TRIANGLES,0,40*24*6);
 const arriving=active&&loaded.has(active)?smooth(Math.max(0,Math.min(1,(p-.64)/.36))):0;
 sceneLayer.style.opacity='0';if(arriving>0&&chapterTextures.has(active)){gl.bindTexture(gl.TEXTURE_2D,chapterTextures.get(active));gl.uniform1f(opacity,arriving);gl.uniform3fv(cam,[.5,.5,1+(1-arriving)*.2]);gl.uniform1f(tilt,0);gl.drawArrays(gl.TRIANGLES,0,40*24*6);}sceneLayer.style.transform=`perspective(1400px) translate3d(${(1-arriving)*24}px,${(1-arriving)*12}px,0) scale(${1+(1-arriving)*.2})`;
 canvas.dataset.camera=JSON.stringify(camera.map(x=>Number(x.toFixed(3))));canvas.dataset.chapter=String(active);canvas.dataset.rendered=String(Number(canvas.dataset.rendered||0)+1);canvas.dataset.travel=p<1?'moving':'settled';
 if(!quiet)raf=requestAnimationFrame(render);
}
function wake(){if(!raf&&!document.hidden)raf=requestAnimationFrame(render);}
window.PoolWorld={async go(key){const next=key==='title'?0:Math.max(0,Math.min(6,Number(String(key).slice(1))||0));if(ready&&next===active&&loaded.has(next))return true;const g=++generation;const world=await load(0);if(!world){fallback(next);return false;}if(g!==generation)return false;canvas.hidden=false;frame.style.backgroundImage='';if(!ready){gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,world);ready=true;canvas.dataset.renderer='webgl';}
 const img=next?await load(next):null;if(g!==generation)return false;if(img&&!chapterTextures.has(next)){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,img);chapterTextures.set(next,t);}previous=active;active=next;started=performance.now();sceneLayer.style.backgroundImage=img?`url('${paths[next]}')`:'none';sceneLayer.style.opacity='0';wake();return true;},quiet(value){quiet=value;cancelAnimationFrame(raf);raf=0;wake();},destinations};
reduced.addEventListener('change',e=>window.PoolWorld.quiet(e.matches));document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else wake();});addEventListener('resize',wake);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(raf);raf=0;fallback(active);document.getElementById('status').dataset.artMissing='動態畫面已暫停；使用靜態場景。';});
})();
