/* R5: one metre-scale GLB world, perspective camera, depth-tested geometry.
   No chapter photographs or image crossfades. All dependencies ship locally. */
(()=>{'use strict';
let requested='title',engine=null,quiet=matchMedia('(prefers-reduced-motion: reduce)').matches;
let pending=[];
window.PoolWorld={go:key=>{requested=key;return engine?engine.go(key):new Promise(resolve=>pending.push(resolve));},quiet:value=>{quiet=value;engine?.quiet(value);}};
const frame=document.getElementById('frame');const status=document.getElementById('status');
const note=document.createElement('div');note.id='worldNotice';note.setAttribute('role','status');note.textContent='正在載入立體池區⋯';frame.append(note);
addEventListener('error',e=>{if(/pool-world|three\.(module|core)/.test(e.filename||'')){note.dataset.detail=e.error?.stack||'';note.hidden=false;note.textContent='立體畫面發生錯誤：'+e.message+' 文稿仍可使用。';}});
(async()=>{
 const [T,{GLTFLoader},{mergeGeometries},{Reflector}]=await Promise.all([import('./vendor/three.module.js'),import('./vendor/GLTFLoader.js'),import('./vendor/BufferGeometryUtils.js'),import('./vendor/Reflector.js')]);
 const canvas=document.createElement('canvas');canvas.id='poolWorld';canvas.setAttribute('aria-hidden','true');frame.prepend(canvas);
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(48,16/9,.12,650);
 scene.fog=new T.FogExp2(0x8bafa9,.0029);
 const hemi=new T.HemisphereLight(0xb4cede,0x504a35,1.25);scene.add(hemi);
 const sun=new T.DirectionalLight(0xffe0ac,3.3);sun.position.set(-35,65,25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:1,far:180});sun.shadow.bias=-.0004;sun.shadow.normalBias=.12;scene.add(sun,sun.target);
 const fill=new T.DirectionalLight(0xa4c6d7,.55);fill.position.set(45,20,-50);scene.add(fill);
 const globals={t:{value:0},storm:{value:0},flash:{value:0}};
 const sky=new T.Mesh(new T.SphereGeometry(460,24,12),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:globals,vertexShader:`varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`precision highp float;varying vec3 v;uniform float t,storm,flash;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float fb(vec2 p){return .5*n(p)+.25*n(p*2.1)+.125*n(p*4.3)+.0625*n(p*8.2);}
 void main(){vec3 r=normalize(v);float h=max(0.,r.y);vec3 c=mix(vec3(.79,.83,.72),vec3(.20,.46,.66),pow(h,.45));vec2 p=r.xz/(.28+abs(r.y))*.95+vec2(t*.016,t*.004);float cloud=smoothstep(.38,.64,fb(p*2.8));cloud*=smoothstep(.0,.2,h);c=mix(c,vec3(.92,.91,.84),cloud*.88);c=mix(c,vec3(.15,.21,.26)+cloud*.12,storm*.86);gl_FragColor=vec4(c+flash*.22,1.);}`}));scene.add(sky);
 // The ground-facing moving cloud shadow and wind apply to actual world coordinates.
 function atmosphere(mat,isLeaf){
 const stone=/limestone|Weathered|Paving|Concrete|Ivory|Jade/.test(mat.name),wood=/timber/.test(mat.name),fabric=/Fabric/.test(mat.name),roof=/Terracotta/.test(mat.name);
 mat.onBeforeCompile=s=>{
 s.uniforms.worldTime=globals.t;s.uniforms.stormLevel=globals.storm;
 s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 worldP;uniform float worldTime;');
 s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+(isLeaf?'transformed.x+=sin(worldTime*1.1+position.y*.8+position.x*.5)*.16;transformed.z+=cos(worldTime*.8+position.z)*.12;':'')+'worldP=(modelMatrix*vec4(transformed,1.)).xyz;');
 s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
 varying vec3 worldP;uniform float worldTime;uniform float stormLevel;
 float patHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
 float patNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(patHash(i),patHash(i+vec3(1,0,0)),f.x),mix(patHash(i+vec3(0,1,0)),patHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(patHash(i+vec3(0,0,1)),patHash(i+vec3(1,0,1)),f.x),mix(patHash(i+vec3(0,1,1)),patHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 `);
 s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float cloudShade=sin(worldP.x*.048+worldTime*.085)+cos(worldP.z*.056-worldTime*.066);
 float coarse=patNoise(worldP*2.8),fine=patNoise(worldP*36.);
 diffuseColor.rgb*=.84+.06*cloudShade+.14*coarse+.08*fine;
 ${stone?`vec3 face=abs(normalize(cross(dFdx(worldP),dFdy(worldP))));vec2 tile=face.y>.55?worldP.xz:vec2(face.x>.5?worldP.z:worldP.x,worldP.y);float row=floor(tile.y/.65);vec2 uv=fract(vec2(tile.x/1.3+mod(row,2.)*.5,tile.y/.65));float joint=1.-smoothstep(.008,.027,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));diffuseColor.rgb*=1.-joint*.17;float damp=(1.-smoothstep(-.1,1.6,worldP.y))*(.1+.15*coarse);diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.48,.61,.44),damp);`:''}
 ${wood?'float grain=sin(worldP.x*36.+patNoise(worldP*2.)*9.);diffuseColor.rgb*=.84+.10*grain;':''}
 ${fabric?'float weave=sin(worldP.x*110.)*sin(worldP.z*110.);diffuseColor.rgb*=.95+.05*weave;':''}
 ${roof?'diffuseColor.rgb*=.83+.22*patNoise(worldP*5.);':''}
 diffuseColor.rgb*=mix(1.,.74,stormLevel);`);
 };
 mat.customProgramCacheKey=()=>['r5-atmosphere',isLeaf,stone,wood,fabric,roof].join('-');
 }
 const loader=new GLTFLoader();let loaded;
 const abort=new Promise((_,reject)=>setTimeout(()=>reject(Error('立體模型載入逾時。請檢查連線後重新載入。')),30000));
 loaded=await Promise.race([loader.loadAsync('art/bethesda-world.glb'),abort]);
 loaded.scene.traverse(o=>{if(o.name==='Stone_island_foundation')o.position.y=-3.5;});loaded.scene.updateMatrixWorld(true);const buckets=new Map();let meshCount=0;
 loaded.scene.traverse(o=>{if(!o.isMesh||o.name.startsWith('Water_surface'))return;meshCount++;const material=o.material;if(Array.isArray(material))throw Error('模型材質格式不符');const key=material.uuid;const geo=o.geometry.clone();for(const attr of Object.keys(geo.attributes))if(!['position','normal'].includes(attr))geo.deleteAttribute(attr);if(!geo.attributes.normal)geo.computeVertexNormals();geo.applyMatrix4(o.matrixWorld);if(geo.index){const g=geo.toNonIndexed();geo.dispose();if(!buckets.has(key))buckets.set(key,{material,geometries:[]});buckets.get(key).geometries.push(g);}else{if(!buckets.has(key))buckets.set(key,{material,geometries:[]});buckets.get(key).geometries.push(geo);}});
 for(const {material,geometries} of buckets.values()){const merged=mergeGeometries(geometries,false);if(!merged)throw Error('模型合併失敗');for(const g of geometries)g.dispose();const m=material.clone();if(m.transparent)m.depthWrite=false;atmosphere(m,/Leaves/.test(m.name));const mesh=new T.Mesh(merged,m);mesh.name='Static '+m.name;mesh.castShadow=!m.transparent;mesh.receiveShadow=!m.transparent;scene.add(mesh);}
 // True displaced surfaces, continuous ripple normals, moving sunlight and rain impacts.
 const reflection=new Reflector(new T.PlaneGeometry(55,45),{textureWidth:768,textureHeight:432,multisample:0,clipBias:.003});reflection.rotation.x=-Math.PI/2;reflection.position.y=-.23;reflection.updateMatrixWorld(true);const waters=[];
 const waterUniforms={...globals,eye:{value:camera.position},warmth:{value:0},mirror:{value:reflection.getRenderTarget().texture},mirrorMatrix:reflection.material.uniforms.textureMatrix};
 const waterMaterial=new T.ShaderMaterial({uniforms:waterUniforms,side:T.DoubleSide,vertexShader:`uniform float t,storm;varying vec3 wp;varying vec2 uvw;
 void main(){vec3 p=position;float amp=mix(.09,.34,storm);p.z+=sin(p.x*.65+t*1.35)*amp+sin(p.y*.83-t*1.6)*amp*.55;uvw=uv;vec4 world=modelMatrix*vec4(p,1.);wp=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,fragmentShader:`precision highp float;uniform float t,storm,flash,warmth;uniform vec3 eye;uniform sampler2D mirror;uniform mat4 mirrorMatrix;varying vec3 wp;varying vec2 uvw;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){float a=mix(.09,.34,storm);vec3 normal=normalize(vec3(-.65*cos(wp.x*.65+t*1.35)*a,1.,-.83*cos(wp.z*.83-t*1.6)*a));normal.xz+=vec2(sin(wp.z*5.+t*2.),cos(wp.x*4.-t*1.7))*.055;normal=normalize(normal);vec3 view=normalize(eye-wp);float fres=pow(1.-max(0.,dot(view,normal)),3.);float spark=pow(max(0.,dot(reflect(normalize(vec3(.45,-.8,-.35)),normal),view)),90.);float caustic=pow(abs(sin(wp.x*3.+sin(wp.z*2.+t)*1.5+t)*sin(wp.z*2.6-t*.8)),16.);vec2 cell=floor(wp.xz*4.5);float age=fract(t*.8+hash(cell));float ring=1.-smoothstep(.025,.07,abs(length(fract(wp.xz*4.5)-.5)-age*.45));ring*=1.-age;vec3 deep=mix(vec3(.025,.21,.20),vec3(.045,.10,.15),storm);vec3 c=mix(deep,mix(vec3(.52,.69,.70),vec3(.25,.32,.38),storm),fres*.82);c+=caustic*.065+spark*vec3(1.,.8,.42)*(1.-storm*.8)+ring*storm*.06+flash*.16;c=mix(c,c*vec3(1.15,.90,.75),warmth*.35);vec4 mp=mirrorMatrix*vec4(wp.x,-wp.z,0.,1.);vec2 muv=mp.xy/mp.w+normal.xz*.025;vec3 reflectionColour=texture2D(mirror,clamp(muv,.001,.999)).rgb;c=mix(c,reflectionColour,mix(.28,.64,fres)*(1.-storm*.25));gl_FragColor=vec4(c,1.);}`} );
 for(const x of [-14,14]){const water=new T.Mesh(new T.PlaneGeometry(23.7,43.7,80,120),waterMaterial);water.rotation.x=-Math.PI/2;water.position.set(x,-.23,0);water.name='Living water '+x;scene.add(water);waters.push(water);}
 // GPU rain: line segments traverse real world depth, so porches occlude them.
 const rainCount=4400,rainGeo=new T.BufferGeometry(),rainPosition=[],seeds=[];let rng=73019;const rand=()=>{rng=(rng*1664525+1013904223)>>>0;return rng/4294967296;};
 for(let i=0;i<rainCount;i++){const x=(rand()-.5)*110,z=(rand()-.5)*100,seed=rand();rainPosition.push(x,0,z,x,.85,z);seeds.push(seed,seed);}
 rainGeo.setAttribute('position',new T.Float32BufferAttribute(rainPosition,3));rainGeo.setAttribute('seed',new T.Float32BufferAttribute(seeds,1));
 const rain=new T.LineSegments(rainGeo,new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:globals,vertexShader:`attribute float seed;uniform float t;varying float fade;void main(){vec3 p=position;p.y+=mod(seed*35.-t*17.,35.);p.x+=p.y*.18;fade=1.-p.y/45.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`uniform float storm;varying float fade;void main(){gl_FragColor=vec4(.72,.84,.90,storm*.48*fade);}`}));rain.frustumCulled=false;scene.add(rain);
 const bolt=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(6,43,-30),new T.Vector3(2,35,-31),new T.Vector3(5,29,-30),new T.Vector3(-1,23,-31),new T.Vector3(2,18,-30),new T.Vector3(-3,9,-30)]),new T.LineBasicMaterial({color:0xd9ecff,transparent:true,opacity:0,depthWrite:false}));scene.add(bolt);
 const poses=[{p:[45,52,60],l:[-3,1,-5]},{p:[-34,5,26],l:[-42,3,19]},{p:[-32,6,-10],l:[-42,3,-18]},{p:[32,5.5,-10],l:[42,3,-19]},{p:[34,5.2,25],l:[43,3,18]},{p:[13,3.2,22.9],l:[0,3,-5]},{p:[-9,4.8,40],l:[1,1.8,28]}];
 let framing=.08;let active=-1,travel=null,time=0,last=null,raf=0,storm=0,stormTarget=0;let look=new T.Vector3(0,1,0),draws=0,disposed=false;
 camera.position.fromArray(poses[0].p);camera.lookAt(look);
 const ease=x=>x*x*x*(x*(x*6-15)+10);
 function resize(){const rect=frame.getBoundingClientRect();const w=Math.max(1,Math.min(1920,Math.round(rect.width*Math.min(devicePixelRatio,1.5))));const h=Math.round(w*9/16);if(canvas.width!==w||canvas.height!==h)renderer.setSize(w,h,false);camera.aspect=16/9;camera.setViewOffset(w,h,w*framing,0,w,h);camera.updateProjectionMatrix();}
 function render(now){raf=0;if(disposed||document.hidden)return;const dt=last===null?0:Math.min(.05,(now-last)/1000);last=now;if(!quiet)time+=dt;
 if(travel){const p=quiet?1:Math.max(0,Math.min(1,(now-travel.start)/travel.duration));camera.position.copy(travel.path.getPoint(ease(p)));look.lerpVectors(travel.look,new T.Vector3(...poses[active].l),ease(p));if(p>=1)travel=null;}
 camera.lookAt(look);storm=quiet?stormTarget:T.MathUtils.damp(storm,stormTarget,.8,dt);globals.t.value=time;globals.storm.value=storm;
 const pulse=time%9.4;const lightning=storm>.6&&pulse>7.6&&pulse<7.95?Math.sin((pulse-7.6)/.35*Math.PI):0;globals.flash.value=quiet?0:lightning;bolt.material.opacity=quiet?0:lightning*.9;
 sun.intensity=(3.3-storm*2.5)*(1+Math.sin(time*.12)*.075)+lightning*.8;sun.color.set(active===4||active===6?0xffc58a:0xffe0b4);hemi.intensity=1.25-storm*.35;waterUniforms.warmth.value=active===4||active===6?1:0;
 scene.fog.density=.0029+storm*.009;scene.fog.color.set(storm>.5?0x617779:0x8bafa9);rain.visible=storm>.01;
 const desiredFraming=frame.classList.contains('scene-only')?0:active===0?.08:.22;framing=quiet?desiredFraming:T.MathUtils.damp(framing,desiredFraming,2.4,dt);resize();if(draws%2===0||quiet||travel){camera.updateMatrixWorld(true);for(const w of waters)w.visible=false;reflection.onBeforeRender(renderer,scene,camera);for(const w of waters)w.visible=true;}renderer.render(scene,camera);draws++;Object.assign(canvas.dataset,{renderer:'three-webgl',chapter:String(active),camera:JSON.stringify(camera.position.toArray().map(x=>+x.toFixed(3))),look:JSON.stringify(look.toArray().map(x=>+x.toFixed(3))),travel:travel?'moving':'settled',rendered:String(draws),worldTime:time.toFixed(3),storm:storm.toFixed(3),triangles:String(renderer.info.render.triangles),calls:String(renderer.info.render.calls),worldMeshes:String(meshCount)});
 if(!quiet)raf=requestAnimationFrame(render);
 }
 function wake(){if(!raf&&!document.hidden&&!disposed)raf=requestAnimationFrame(render);}
 engine={async go(key){const next=key==='title'?0:Math.max(0,Math.min(6,Number(String(key).replace(/^R/i,''))||0));if(next===active)return true;const first=active<0;active=next;stormTarget=next===5?1:0;const dest=new T.Vector3(...poses[next].p),from=camera.position.clone();const a=from.clone(),b=dest.clone();a.y=Math.max(15,from.y*.8);b.y=Math.max(15,dest.y+8);if(next===0)b.set(35,45,60);const path=new T.CatmullRomCurve3([from,a,b,dest],false,'centripetal');travel={path,start:performance.now(),duration:next===0?6500:7600,look:look.clone()};if(quiet||(first&&next===0)){camera.position.copy(dest);look.fromArray(poses[next].l);travel=null;}wake();return true;},quiet(value){quiet=value;last=null;cancelAnimationFrame(raf);raf=0;wake();}};
 window.PoolWorld.go=engine.go;window.PoolWorld.quiet=engine.quiet;window.PoolWorld.destinations=poses;
 addEventListener('resize',wake);document.addEventListener('visibilitychange',()=>{last=null;if(document.hidden){cancelAnimationFrame(raf);raf=0;}else wake();});matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>engine.quiet(e.matches));
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();disposed=true;cancelAnimationFrame(raf);note.hidden=false;note.textContent='立體畫面已中斷。文稿仍可使用，請重新載入以恢復場景。';canvas.dataset.renderer='context-lost';});
 note.hidden=true;status.dataset.artMissing='';await engine.go(requested);pending.splice(0).forEach(resolve=>resolve(true));
})().catch(e=>{note.hidden=false;note.textContent='立體場景未能載入：'+e.message+' 文稿仍可使用。';status.dataset.artMissing=note.textContent;window.PoolWorld.go=async()=>false;pending.splice(0).forEach(resolve=>resolve(false));console.error('R5 world load failed',e);});
})();
