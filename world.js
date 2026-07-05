/* ============ THE DETECTORIST — WORLD BUILDER (Three.js) ============ */
'use strict';
const WORLD = (() => {

// ---------- seeded RNG + value noise ----------
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function makeNoise(rng){
  const perm = new Uint8Array(512); const p = new Uint8Array(256);
  for(let i=0;i<256;i++) p[i]=i;
  for(let i=255;i>0;i--){ const j=(rng()* (i+1))|0; const t=p[i]; p[i]=p[j]; p[j]=t; }
  for(let i=0;i<512;i++) perm[i]=p[i&255];
  const grad = (h,x,y)=>{ switch(h&3){ case 0:return x+y; case 1:return -x+y; case 2:return x-y; default:return -x-y; } };
  const fade = t=>t*t*t*(t*(t*6-15)+10);
  return function noise(x,y){
    const X=Math.floor(x)&255, Y=Math.floor(y)&255; x-=Math.floor(x); y-=Math.floor(y);
    const u=fade(x), v=fade(y);
    const aa=perm[perm[X]+Y], ab=perm[perm[X]+Y+1], ba=perm[perm[X+1]+Y], bb=perm[perm[X+1]+Y+1];
    const l=(a,b,t)=>a+t*(b-a);
    return l(l(grad(aa,x,y),grad(ba,x-1,y),u), l(grad(ab,x,y-1),grad(bb,x-1,y-1),u), v)*0.7071+0.5;
  };
}

const SIZE = 220, HALF = SIZE/2, SEG = 128;

// ---------- ground detail texture (multiplied over vertex colours) ----------
function makeGroundTexture(kind, rng){
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#efefef'; g.fillRect(0,0,512,512);
  // broad tonal blotches
  for(let i=0;i<900;i++){
    const v = 200 + rng()*55 | 0;
    g.fillStyle = 'rgba('+v+','+v+','+v+','+(0.06+rng()*0.1)+')';
    g.beginPath(); g.arc(rng()*512, rng()*512, 3+rng()*18, 0, 7); g.fill();
  }
  if(kind==='grass'){
    // thousands of tiny blade strokes in varied greens
    for(let i=0;i<5200;i++){
      const x=rng()*512, y=rng()*512, len=3.5+rng()*8;
      const a=-Math.PI/2 + (rng()-0.5)*1.1;
      const v=170+rng()*85;
      g.strokeStyle='rgba('+(v*0.78|0)+','+(v|0)+','+(v*0.55|0)+','+(0.22+rng()*0.3)+')';
      g.lineWidth=0.7+rng()*0.9;
      g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*len, y+Math.sin(a)*len); g.stroke();
    }
    for(let i=0;i<420;i++){ // soil flecks and shadow
      g.fillStyle='rgba(38,30,16,'+(0.1+rng()*0.22)+')';
      g.fillRect(rng()*512, rng()*512, 1+rng()*2, 1+rng()*2);
    }
  } else if(kind==='sand'){
    // wind ripples: sinuous bands with light crest / dark trough
    for(let i=0;i<70;i++){
      const y0=rng()*512, amp=2+rng()*5, wl=40+rng()*80, ph=rng()*7;
      g.beginPath();
      for(let x=0;x<=512;x+=8) g.lineTo(x, y0+Math.sin(x/wl*6.28+ph)*amp);
      g.strokeStyle='rgba(255,252,240,'+(0.16+rng()*0.14)+')'; g.lineWidth=2.2; g.stroke();
      g.beginPath();
      for(let x=0;x<=512;x+=8) g.lineTo(x, y0+2.5+Math.sin(x/wl*6.28+ph)*amp);
      g.strokeStyle='rgba(120,95,60,'+(0.12+rng()*0.12)+')'; g.lineWidth=1.6; g.stroke();
    }
    for(let i=0;i<2600;i++){ // grain speckle
      const v = rng()<0.5? 'rgba(105,85,55,0.25)' : 'rgba(255,255,248,0.3)';
      g.fillStyle=v; g.fillRect(rng()*512, rng()*512, 1, 1);
    }
  } else if(kind==='gravel'){
    // stones with offset shadows
    for(let i=0;i<1500;i++){
      const x=rng()*512, y=rng()*512, r=1+rng()*3.6;
      g.fillStyle='rgba(30,20,12,'+(0.18+rng()*0.2)+')';
      g.beginPath(); g.ellipse(x+1,y+1.4,r,r*0.8,rng(),0,7); g.fill();
      const v=190+rng()*65|0;
      g.fillStyle='rgba('+v+','+(v*0.88|0)+','+(v*0.72|0)+','+(0.5+rng()*0.4)+')';
      g.beginPath(); g.ellipse(x,y,r,r*0.8,rng(),0,7); g.fill();
    }
    for(let i=0;i<1800;i++){
      g.fillStyle='rgba(60,35,18,'+(0.15+rng()*0.2)+')';
      g.fillRect(rng()*512, rng()*512, 1, 1);
    }
  } else if(kind==='soil'){
    // organic clods + short directional strokes
    for(let i=0;i<1300;i++){
      const x=rng()*512, y=rng()*512, r=1.4+rng()*4;
      const v=150+rng()*90|0;
      g.fillStyle='rgba('+v+','+(v*0.84|0)+','+(v*0.62|0)+','+(0.2+rng()*0.3)+')';
      g.beginPath(); g.ellipse(x,y,r,r*0.6,rng(),0,7); g.fill();
    }
    for(let i=0;i<1600;i++){
      const x=rng()*512, y=rng()*512, len=2+rng()*6, a=(rng()-0.5)*0.5;
      g.strokeStyle='rgba(48,34,18,'+(0.14+rng()*0.22)+')'; g.lineWidth=0.8+rng();
      g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*len, y+Math.sin(a)*len); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(56,56);
  tex.anisotropy = 4;
  return tex;
}

// ---------- terrain ----------
function makeTerrain(preset, rng){
  const noise = makeNoise(rng);
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count*3);
  const col = new THREE.Color();
  const heights = new Float32Array(pos.count);
  for(let i=0;i<pos.count;i++){
    const x = pos.getX(i), z = pos.getZ(i);
    let h = preset.height(x, z, noise);
    pos.setY(i, h); heights[i]=h;
    preset.color(col, x, z, h, noise, rng);
    colors[i*3]=col.r; colors[i*3+1]=col.g; colors[i*3+2]=col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors,3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors:true, map: makeGroundTexture(preset.detail||'grass', rng) });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  // bilinear height sampler
  const N = SEG+1, step = SIZE/SEG;
  function heightAt(x,z){
    const fx = (x+HALF)/step, fz = (z+HALF)/step;
    const ix = Math.max(0, Math.min(SEG-1, Math.floor(fx)));
    const iz = Math.max(0, Math.min(SEG-1, Math.floor(fz)));
    const tx = fx-ix, tz = fz-iz;
    const i00 = iz*N+ix, i10 = i00+1, i01 = i00+N, i11 = i01+1;
    const h0 = heights[i00]*(1-tx)+heights[i10]*tx;
    const h1 = heights[i01]*(1-tx)+heights[i11]*tx;
    return h0*(1-tz)+h1*tz;
  }
  return { mesh, heightAt };
}

// ---------- sky ----------
function gradientTexture(stops){
  const c = document.createElement('canvas'); c.width=2; c.height=512;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0,0,0,512);
  for(const [t,color] of stops) gr.addColorStop(t,color);
  g.fillStyle = gr; g.fillRect(0,0,2,512);
  const tex = new THREE.CanvasTexture(c); return tex;
}
function radialSprite(inner, outer, size=256){
  const c = document.createElement('canvas'); c.width=c.height=size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  gr.addColorStop(0,inner); gr.addColorStop(1,outer);
  g.fillStyle=gr; g.fillRect(0,0,size,size);
  return new THREE.CanvasTexture(c);
}

const SKIES = {
  sunrise:   { top:'#2b4d6e', mid:'#e8825a', low:'#ffd9a0', fog:'#f4c98f', fogNear:70, fogFar:230,
               sun:{ x:-30, y:10, z:-160, color:'#ffdca8', size:70 }, hemi:['#ffd9b0','#3a4a52',0.9], dir:['#ffc887',0.85,[-0.3,0.25,-1]], amb:0.25, clouds:4, cloudTint:'rgba(255,190,140,' },
  afternoon: { top:'#3f7fd1', mid:'#8fc3ee', low:'#dcedf9', fog:'#cfe4f2', fogNear:90, fogFar:260,
               sun:{ x:80, y:120, z:-60, color:'#fff6da', size:50 }, hemi:['#bfe0ff','#5a6b3f',1.0], dir:['#fff2cc',1.0,[0.5,1,-0.4]], amb:0.3, clouds:5, cloudTint:'rgba(255,255,255,' },
  cloudy:    { top:'#7b8894', mid:'#aab6bf', low:'#d5dade', fog:'#c2cad0', fogNear:60, fogFar:200,
               sun:{ x:40, y:90, z:-80, color:'#e8ecef', size:30 }, hemi:['#cdd6dc','#4a5246',0.95], dir:['#dfe6ea',0.55,[0.3,1,-0.3]], amb:0.45, clouds:11, cloudTint:'rgba(235,240,244,' },
  harshnoon: { top:'#4a86c8', mid:'#a8cbe4', low:'#e9e2cf', fog:'#e2d9c2', fogNear:80, fogFar:240,
               sun:{ x:10, y:150, z:-30, color:'#ffffff', size:44 }, hemi:['#dceaf6','#7a5636',1.05], dir:['#fff8e6',1.15,[0.15,1,-0.2]], amb:0.3, clouds:2, cloudTint:'rgba(255,255,255,' },
  goldenhour:{ top:'#4a6a9e', mid:'#d99a5b', low:'#f3d9a4', fog:'#e6c893', fogNear:70, fogFar:230,
               sun:{ x:-110, y:26, z:-90, color:'#ffce8a', size:62 }, hemi:['#ffe0b0','#4d4a38',0.95], dir:['#ffc27a',0.9,[-0.7,0.3,-0.5]], amb:0.28, clouds:5, cloudTint:'rgba(255,205,150,' },
  dusk:      { top:'#2e2a55', mid:'#8a5d86', low:'#e8927c', fog:'#c98a86', fogNear:55, fogFar:200,
               sun:{ x:-60, y:8, z:-150, color:'#ff9d6e', size:66 }, hemi:['#d9a0a0','#2e3242',0.8], dir:['#ff9d76',0.65,[-0.35,0.15,-1]], amb:0.3, clouds:5, cloudTint:'rgba(230,150,140,' },
  morning:   { top:'#5a93c9', mid:'#a9cfe8', low:'#e6f0f4', fog:'#d8e8ef', fogNear:80, fogFar:240,
               sun:{ x:90, y:70, z:-100, color:'#fff8e0', size:48 }, hemi:['#cfe6f7','#57694a',1.0], dir:['#fff4d6',0.95,[0.6,0.7,-0.7]], amb:0.32, clouds:6, cloudTint:'rgba(255,255,255,' },
};

function buildSky(scene, key, rng){
  const S = SKIES[key];
  scene.background = gradientTexture([[0,S.top],[0.55,S.mid],[1,S.low]]);
  scene.fog = new THREE.Fog(new THREE.Color(S.fog), S.fogNear, S.fogFar);
  const hemi = new THREE.HemisphereLight(new THREE.Color(S.hemi[0]), new THREE.Color(S.hemi[1]), S.hemi[2]*0.62);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(new THREE.Color(S.dir[0]), S.dir[1]*0.72);
  dir.position.set(S.dir[2][0]*100, S.dir[2][1]*100, S.dir[2][2]*100);
  scene.add(dir);
  scene.add(new THREE.AmbientLight(0xffffff, S.amb*0.65));
  // sun disc
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map:radialSprite(S.sun.color,'rgba(255,255,255,0)'), transparent:true, depthWrite:false, fog:false }));
  sun.position.set(S.sun.x, S.sun.y, S.sun.z);
  sun.scale.setScalar(S.sun.size);
  scene.add(sun);
  // clouds
  const clouds = new THREE.Group();
  for(let i=0;i<S.clouds;i++){
    const puff = new THREE.Group();
    const n = 3+(rng()*3|0);
    const tex = radialSprite(S.cloudTint+'0.85)', S.cloudTint+'0)');
    for(let j=0;j<n;j++){
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthWrite:false, opacity:0.8, fog:false }));
      sp.position.set((rng()-0.5)*26, (rng()-0.5)*6, (rng()-0.5)*8);
      sp.scale.set(22+rng()*20, 11+rng()*8, 1);
      puff.add(sp);
    }
    puff.position.set((rng()-0.5)*360, 60+rng()*50, -60-rng()*160);
    puff.userData.speed = 0.4+rng()*0.7;
    clouds.add(puff);
  }
  scene.add(clouds);
  return { clouds, animate(dt){ clouds.children.forEach(p=>{ p.position.x += p.userData.speed*dt; if(p.position.x>220) p.position.x=-220; }); } };
}

// ---------- materials helper ----------
function lam(color){ return new THREE.MeshLambertMaterial({ color }); }

// ---------- props ----------
function makeTree(kind, rng){
  const g = new THREE.Group();
  if(kind==='gum'){
    const h = 7+rng()*4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.4,h,6), lam(0xd8cfc0));
    trunk.position.y = h/2; trunk.rotation.z = (rng()-0.5)*0.15; g.add(trunk);
    for(let i=0;i<4+(rng()*3|0);i++){
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.6+rng()*1.4, 6,5), lam(0x6b7a45));
      b.position.set((rng()-0.5)*4.5, h*0.75+(rng()-0.4)*2.6, (rng()-0.5)*4.5);
      b.scale.y = 0.7; g.add(b);
    }
  } else if(kind==='fig'){
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.9,1.6,4.5,8), lam(0x6e5a48));
    trunk.position.y=2.2; g.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(6.5,8,6), lam(0x3f5a2e));
    crown.position.y=7.2; crown.scale.set(1.25,0.75,1.25); g.add(crown);
  } else if(kind==='oak'){
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.7,3.6,7), lam(0x5d4a38));
    trunk.position.y=1.8; g.add(trunk);
    for(let i=0;i<4;i++){
      const b = new THREE.Mesh(new THREE.SphereGeometry(2.1+rng()*1.2,7,6), lam(0x4d6633));
      b.position.set((rng()-0.5)*3.2, 4.4+(rng()-0.3)*1.8, (rng()-0.5)*3.2); g.add(b);
    }
  } else if(kind==='elm'){
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.55,5,7), lam(0x66584a));
    trunk.position.y=2.5; g.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(3.4,7,6), lam(0x5d7a3a));
    crown.position.y=6.4; crown.scale.set(0.9,1.15,0.9); g.add(crown);
  } else if(kind==='ironbark'){
    const h=6+rng()*3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.35,h,6), lam(0x3f342c));
    trunk.position.y=h/2; trunk.rotation.z=(rng()-0.5)*0.2; g.add(trunk);
    for(let i=0;i<3;i++){
      const b = new THREE.Mesh(new THREE.SphereGeometry(1.2+rng(),6,5), lam(0x5c6b3f));
      b.position.set((rng()-0.5)*3, h*0.8+(rng()-0.4)*2,(rng()-0.5)*3); b.scale.y=0.6; g.add(b);
    }
  } else if(kind==='palm'){
    const h=6+rng()*2;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.3,h,6), lam(0x8a7355));
    trunk.position.y=h/2; trunk.rotation.z=(rng()-0.5)*0.25; g.add(trunk);
    for(let i=0;i<7;i++){
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.35,3.4,4), lam(0x4f7038));
      frond.position.y=h; const a=i/7*Math.PI*2;
      frond.rotation.set(Math.PI/2.6, a, 0);
      frond.rotation.order='YXZ';
      frond.translateY(1.4);
      g.add(frond);
    }
  }
  return g;
}
function makeRock(rng, tint){
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4+rng()*0.9), lam(tint||0x7d7468));
  r.scale.y = 0.55+rng()*0.3; r.rotation.y = rng()*Math.PI;
  return r;
}
function makeFencePost(){ const p = new THREE.Mesh(new THREE.BoxGeometry(0.14,1.1,0.14), lam(0x6e5a43)); p.position.y=0.55; return p; }
function makeFenceLine(from, to, heightAt, gap=2.4, railY=[0.45,0.9]){
  const g = new THREE.Group();
  const dx = to[0]-from[0], dz = to[1]-from[1];
  const len = Math.hypot(dx,dz), n = Math.max(2, Math.round(len/gap));
  const railMat = lam(0x7a6448);
  let prev = null;
  for(let i=0;i<=n;i++){
    const x = from[0]+dx*i/n, z = from[1]+dz*i/n, y = heightAt(x,z);
    const post = makeFencePost(); post.position.set(x,y+0.55,z); g.add(post);
    if(prev){
      for(const ry of railY){
        const rail = new THREE.Mesh(new THREE.BoxGeometry(1,0.06,0.05), railMat);
        const mx=(prev.x+x)/2, mz=(prev.z+z)/2, my=(prev.y+y)/2;
        rail.position.set(mx,my+ry,mz);
        rail.scale.x = Math.hypot(x-prev.x, z-prev.z, y-prev.y);
        rail.rotation.y = Math.atan2(-(z-prev.z), x-prev.x);
        rail.rotation.z = Math.atan2(y-prev.y, Math.hypot(x-prev.x,z-prev.z));
        g.add(rail);
      }
    }
    prev = {x,y,z};
  }
  return g;
}
function textPanelTexture(lines, opts={}){
  const c = document.createElement('canvas'); c.width=256; c.height=160;
  const g = c.getContext('2d');
  g.fillStyle = opts.bg || '#e8e2d2'; g.fillRect(0,0,256,160);
  g.strokeStyle = opts.border || '#8a2020'; g.lineWidth = 10; g.strokeRect(5,5,246,150);
  g.fillStyle = opts.fg || '#7a1a1a';
  g.textAlign='center'; g.textBaseline='middle';
  const fs = opts.size || 26;
  g.font = '700 '+fs+'px Arial Narrow, sans-serif';
  lines.forEach((ln,i)=> g.fillText(ln, 128, 80 + (i-(lines.length-1)/2)*(fs+6)));
  return new THREE.CanvasTexture(c);
}
function makeSign(lines, opts){
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,1.6,6), lam(0x5d5d5d));
  post.position.y=0.8; g.add(post);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.5,0.95,0.05),
    new THREE.MeshLambertMaterial({ map:textPanelTexture(lines, opts) }));
  board.position.y=1.75; g.add(board);
  return g;
}
function makeBuilding(kind){
  const g = new THREE.Group();
  if(kind==='farmhouse'){
    const walls = new THREE.Mesh(new THREE.BoxGeometry(9,3.6,6), lam(0xcbb79a)); walls.position.y=1.8; g.add(walls);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1,4.6,3,4,1), lam(0x6e4433));
    roof.rotation.y = Math.PI/4; roof.scale.set(1.45,1,1); roof.position.y=5.1; g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1,2.2,0.12), lam(0x4a3527)); door.position.set(0,1.1,3.05); g.add(door);
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.7,2.4,0.7), lam(0x8a5a45)); chim.position.set(3,5.4,0); g.add(chim);
    for(const wx of [-2.8,2.8]){ const win = new THREE.Mesh(new THREE.BoxGeometry(1.2,1.2,0.1), lam(0xbfd9e4)); win.position.set(wx,2,3.02); g.add(win); }
    g.userData.doorPos = new THREE.Vector3(0,0,3.6);
  } else if(kind==='church'){
    const nave = new THREE.Mesh(new THREE.BoxGeometry(6,4.4,12), lam(0xb0a68e)); nave.position.y=2.2; g.add(nave);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.05,3.6,2.8,4,1), lam(0x5a5148));
    roof.rotation.y=Math.PI/4; roof.scale.set(0.9,1,1.8); roof.position.y=5.7; g.add(roof);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3.4,8.5,3.4), lam(0xa89e86)); tower.position.set(0,4.25,7.5); g.add(tower);
    const battle = new THREE.Mesh(new THREE.BoxGeometry(3.8,0.5,3.8), lam(0x968c74)); battle.position.set(0,8.7,7.5); g.add(battle);
  } else if(kind==='bandstand'){
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4,3.6,0.5,8), lam(0xb8b0a0)); base.position.y=0.25; g.add(base);
    for(let i=0;i<8;i++){ const a=i/8*Math.PI*2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,2.6,6), lam(0xe8e4da));
      col.position.set(Math.cos(a)*2.9, 1.8, Math.sin(a)*2.9); g.add(col); }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.9,1.6,8), lam(0x3f5a4a)); roof.position.y=3.9; g.add(roof);
  } else if(kind==='memorial'){
    const steps = new THREE.Mesh(new THREE.BoxGeometry(3.4,0.5,3.4), lam(0xb8b4aa)); steps.position.y=0.25; g.add(steps);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.4,1.2,1.4), lam(0xc8c4ba)); plinth.position.y=1.1; g.add(plinth);
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.45,4.4,4), lam(0xd2cec4)); obelisk.position.y=3.9; g.add(obelisk);
  } else if(kind==='headframe'){
    const legs = lam(0x4a3d32);
    for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2,5.4,0.2), legs);
      leg.position.set(sx*1.1, 2.7, sz*1.1);
      leg.rotation.z = -sx*0.16; leg.rotation.x = sz*0.16; g.add(leg);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(2,0.3,2), legs); top.position.y=5.4; g.add(top);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.7,0.08,6,14), lam(0x2f2a24));
    wheel.position.y=5.9; g.add(wheel);
  } else if(kind==='playground'){
    const frame = lam(0xc85a2f);
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.12,2.4,0.12), frame); a.position.set(-1.4,1.2,0); a.rotation.z=0.3; g.add(a);
    const b = a.clone(); b.position.x=1.4; b.rotation.z=-0.3; g.add(b);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2.4,6), lam(0x888)); bar.rotation.z=Math.PI/2; bar.position.y=2.3; g.add(bar);
    for(const sx of [-0.5,0.5]){
      const rope1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02,0.02,1.6,4), lam(0x555)); rope1.position.set(sx,1.5,0); g.add(rope1);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.06,0.22), lam(0x333)); seat.position.set(sx,0.7,0); g.add(seat);
    }
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.08,3), lam(0xd9c23f));
    slide.position.set(3.4,0.9,0); slide.rotation.x=-0.5; g.add(slide);
    const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.7,1.8,0.1), lam(0xc85a2f)); ladder.position.set(3.4,0.9,1.6); g.add(ladder);
  } else if(kind==='picnic'){
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.08,1), lam(0x8a6f4d)); top.position.y=0.75; g.add(top);
    for(const sz of [-0.75,0.75]){ const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.06,0.3), lam(0x8a6f4d)); seat.position.set(0,0.45,sz); g.add(seat); }
    for(const sx of [-0.9,0.9]){ const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.75,1.6), lam(0x6e5840)); leg.position.set(sx,0.37,0); g.add(leg); }
  } else if(kind==='boardwalk'){
    const deck = new THREE.Mesh(new THREE.BoxGeometry(26,0.3,4), lam(0x9a8262)); deck.position.y=1.1; g.add(deck);
    for(let i=-2;i<=2;i++){ const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,1.2,6), lam(0x6e5a43)); pile.position.set(i*6,0.5,1.6); g.add(pile);
      const pile2 = pile.clone(); pile2.position.z=-1.6; g.add(pile2); }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(26,0.06,0.06), lam(0x8a7355)); rail.position.set(0,2,1.9); g.add(rail);
    const rail2 = rail.clone(); rail2.position.z=-1.9; g.add(rail2);
  } else if(kind==='lifeguard'){
    const legs = lam(0xd9c23f);
    for(const [sx,sz] of [[-0.8,-0.8],[0.8,-0.8],[-0.8,0.8],[0.8,0.8]]){
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14,2.6,0.14), legs); leg.position.set(sx,1.3,sz); g.add(leg); }
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.1,1.3,2.1), lam(0xc84a3f)); box.position.y=3.2; g.add(box);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8,0.8,4), lam(0xe8e2d2)); roof.position.y=4.3; roof.rotation.y=Math.PI/4; g.add(roof);
  }
  return g;
}

// ---------- people / creatures ----------
function makePerson(opts={}){
  const g = new THREE.Group();
  const shirt = lam(opts.shirt||0xc86a5a), pants = lam(opts.pants||0x4a5568), skin = lam(opts.skin||0xd8a884);
  const legs = new THREE.Group();
  const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.85,0.24), pants); lLeg.geometry.translate(0,-0.42,0); lLeg.position.set(-0.14,0.85,0);
  const rLeg = lLeg.clone(); rLeg.position.x=0.14;
  legs.add(lLeg,rLeg); g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55,0.75,0.32), shirt); torso.position.y=1.25; g.add(torso);
  const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.7,0.18), shirt); lArm.geometry.translate(0,-0.3,0); lArm.position.set(-0.37,1.55,0);
  const rArm = lArm.clone(); rArm.position.x=0.37; g.add(lArm,rArm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.36,0.32), skin); head.position.y=1.85; g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36,0.14,0.34), lam(opts.hair||0x5a4632)); hair.position.y=2.03; g.add(hair);
  if(opts.hat==='ranger'){
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.04,10), lam(0x6e5a3a)); brim.position.y=2.06; g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.2,0.2,8), lam(0x6e5a3a)); crown.position.y=2.18; g.add(crown);
  }
  if(opts.hat==='cap'){
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2,8,5,0,Math.PI*2,0,Math.PI/2), lam(0x3f5a2e)); cap.position.y=2.0; g.add(cap);
  }
  if(opts.sunnies){
    const sg = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.08,0.05), lam(0x1c1c1e)); sg.position.set(0,1.9,0.17); g.add(sg);
  }
  if(opts.handbag){
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.26,0.14), lam(0x8a3a4a)); bag.position.set(-0.5,1.02,0.05); g.add(bag);
  }
  if(opts.phone){
    const ph = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.16,0.02), lam(0x1c1c1e)); ph.position.set(0.42,1.6,0.22); g.add(ph);
    rArm.rotation.x = -1.4;
  }
  g.userData.limbs = { lLeg, rLeg, lArm, rArm };
  return g;
}
function makeMagpie(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22,7,5), lam(0x141414)); body.scale.set(1,0.8,1.7); g.add(body);
  const nape = new THREE.Mesh(new THREE.SphereGeometry(0.13,6,4), lam(0xf0f0f0)); nape.position.set(0,0.12,-0.16); g.add(nape);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13,6,5), lam(0x141414)); head.position.set(0,0.12,0.32); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045,0.2,5), lam(0xb0b4b8)); beak.rotation.x=Math.PI/2; beak.position.set(0,0.1,0.5); g.add(beak);
  const wingGeo = new THREE.BoxGeometry(0.75,0.03,0.34);
  const lWing = new THREE.Mesh(wingGeo, lam(0x141414)); lWing.geometry = wingGeo.clone(); lWing.geometry.translate(-0.38,0,0); lWing.position.set(-0.1,0.06,0);
  const rWing = new THREE.Mesh(wingGeo.clone(), lam(0x141414)); rWing.geometry.translate(0.38,0,0); rWing.position.set(0.1,0.06,0);
  const lPatch = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.032,0.2), lam(0xf0f0f0)); lPatch.position.set(-0.35,0.005,0); lWing.add(lPatch);
  const rPatch = lPatch.clone(); rPatch.position.x=0.35; rWing.add(rPatch);
  g.add(lWing,rWing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.03,0.4), lam(0x141414)); tail.position.set(0,0.04,-0.5); g.add(tail);
  g.userData.wings = { lWing, rWing };
  return g;
}
function makeSeagull(){
  const g = makeMagpie();
  g.traverse(o=>{ if(o.isMesh && o.material.color.getHex()===0x141414) o.material = lam(0xe8eaec); });
  return g;
}
function makeSnake(){
  const g = new THREE.Group();
  const segs = [];
  for(let i=0;i<9;i++){
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.09 - i*0.004, 6,5), lam(i%2? 0x3f3a28 : 0x8a7a3a));
    s.scale.y = 0.7; g.add(s); segs.push(s);
  }
  g.userData.segs = segs;
  return g;
}
function makeTractor(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4,1.1,1.4), lam(0x2f7a3f)); body.position.y=1.1; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.1,1.1,1.2), lam(0x3a8a4a)); cab.position.set(-0.5,2.1,0); g.add(cab);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.0,0.8,1.1), lam(0xbfd9e4)); glass.position.set(-0.5,2.15,0); g.add(glass);
  const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.85,0.85,0.5,10), lam(0x1c1c1e));
  for(const sz of [-0.85,0.85]){ const w = rb.clone(); w.rotation.x=Math.PI/2; w.position.set(-0.7,0.85,sz); g.add(w); }
  const fw = new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.45,0.35,10), lam(0x1c1c1e));
  for(const sz of [-0.7,0.7]){ const w = fw.clone(); w.rotation.x=Math.PI/2; w.position.set(1,0.45,sz); g.add(w); }
  return g;
}
function makeSheep(rng){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42,7,6), lam(0xe6e2d6));
  body.position.y = 0.62; body.scale.set(1,0.85,1.35); g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.22,0.3), lam(0x2e2a26));
  head.position.set(0,0.66,0.58); head.rotation.x = 0.5; g.add(head);
  for(const pair of [[-0.18,-0.22],[0.18,-0.22],[-0.18,0.22],[0.18,0.22]]){
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.42,5), lam(0x2e2a26));
    leg.position.set(pair[0],0.21,pair[1]); g.add(leg);
  }
  g.rotation.y = rng()*Math.PI*2;
  return g;
}
function makeCannon(){
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.14,2.2,10), lam(0x2f3a30));
  barrel.rotation.x = Math.PI/2 - 0.18; barrel.position.set(0,0.85,0.3); g.add(barrel);
  for(const sx of [-0.55,0.55]){
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.5,0.09,8,16), lam(0x5a4632));
    wheel.rotation.y = Math.PI/2; wheel.position.set(sx,0.55,0); g.add(wheel);
  }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,1.2,6), lam(0x4a3a2a));
  axle.rotation.z = Math.PI/2; axle.position.y = 0.55; g.add(axle);
  return g;
}
function makeKangaroo(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5,7,6), lam(0x8a6f52)); body.position.y=0.9; body.scale.set(0.8,1.1,1.2); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2,6,5), lam(0x8a6f52)); head.position.set(0,1.75,0.25); g.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.2,0.6,6), lam(0x8a6f52)); neck.position.set(0,1.45,0.15); neck.rotation.x=-0.3; g.add(neck);
  for(const sx of [-0.08,0.08]){ const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07,0.25,5), lam(0x7a5f45)); ear.position.set(sx,1.98,0.2); g.add(ear); }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.2,1.3,6), lam(0x8a6f52)); tail.position.set(0,0.4,-0.7); tail.rotation.x=1.1; g.add(tail);
  for(const sx of [-0.25,0.25]){ const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.5,0.55), lam(0x7a5f45)); leg.position.set(sx,0.3,0.1); g.add(leg); }
  return g;
}

// ---------- detector view model (attached to camera) ----------
function makeDetectorModel(color){
  const g = new THREE.Group();
  // the classic rig: control box and grip at the elbow, short pole down to the coil
  const a = new THREE.Vector3(0.34,-0.44,-0.55);   // elbow, at the frame edge
  const b = new THREE.Vector3(0.165,-0.90,-1.80);  // yoke above the coil
  const dir = b.clone().sub(a);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.017,0.026,dir.length(),8), lam(0x23232a));
  shaft.position.copy(a).add(b).multiplyScalar(0.5);
  shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
  g.add(shaft);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.032,0.2,8), lam(0x1c1c1e));
  grip.position.set(0.35,-0.46,-0.46); grip.rotation.x = Math.PI/2-0.5; g.add(grip);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.13,0.085,0.05), lam(color||0xc9a227));
  box.position.set(0.34,-0.39,-0.64); box.rotation.x = -0.45; g.add(box);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.05,0.006), lam(0x9fb8a0));
  screen.position.set(0.34,-0.373,-0.612); screen.rotation.x = -0.45; g.add(screen);
  const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.14,6), lam(0x3a3a3e));
  yoke.position.set(0.165,-0.93,-1.85); yoke.rotation.x = 1.15; g.add(yoke);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.19,0.035,8,20), lam(color||0xc9a227));
  coil.rotation.x = Math.PI/2 + 0.14; // flat to the ground, leading edge lifted like a skid plate
  coil.position.set(0.16,-0.97,-1.9);
  const coilInner = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.16,0.02,20), lam(0x2a2a2e));
  coilInner.rotation.x = 0.14;
  coilInner.position.copy(coil.position); coilInner.position.y -= 0.005;
  g.add(coil, coilInner);
  g.userData.coil = coil;
  g.userData.coilParts = [[coil, Math.PI/2 + 0.14],[coilInner, 0.14]];
  return g;
}

// ---------- boxing gloves ----------
function makeBoxingGlove(scale){
  const s = scale||1;
  const g = new THREE.Group();
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.11*s, 8, 7), lam(0xb02a20));
  fist.scale.set(1,0.9,1.15); g.add(fist);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.07*s,0.09*s,0.11*s,8), lam(0xe8e2d2));
  cuff.position.set(0,-0.01,0.13*s); cuff.rotation.x = Math.PI/2; g.add(cuff);
  return g;
}
function makePlayerGloves(){
  const g = new THREE.Group();
  const l = makeBoxingGlove(0.8); l.position.set(-0.22,-0.3,-0.58); g.add(l);
  const r = makeBoxingGlove(0.8); r.position.set(0.22,-0.3,-0.58); g.add(r);
  g.userData = { l, r };
  return g;
}
function addNpcGloves(person){
  const L = person.userData.limbs;
  for(const arm of [L.lArm, L.rArm]){
    const glove = makeBoxingGlove(1.15);
    glove.position.set(0,-0.72,0);
    arm.add(glove);
  }
}

// ---------- shovel / hole ----------
function makeHole(){
  const g = new THREE.Group();
  const dirt = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.34,0.06,10), lam(0x3a2c1e));
  dirt.position.y = 0.01; g.add(dirt);
  const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.14,0.12,9), lam(0x4a3826));
  plug.position.set(0.45,0.06,0); g.add(plug);
  return g;
}

// ---------- scatter helper ----------
function scatter(group, rng, count, maker, heightAt, opts={}){
  const min = opts.min||8;
  for(let i=0;i<count;i++){
    let x=(rng()-0.5)*(opts.spread||SIZE*0.9), z=(rng()-0.5)*(opts.spread||SIZE*0.9);
    if(opts.filter && !opts.filter(x,z)){ i--; continue; }
    if(Math.hypot(x,z)<min){ continue; }
    const m = maker(rng);
    m.position.set(x, heightAt(x,z)+(opts.lift||0), z);
    m.rotation.y = rng()*Math.PI*2;
    group.add(m);
  }
}

// ---------- terrain presets ----------
function terrainPreset(site, rng){
  const t = site.terrain;
  if(t==='park' || t==='uspark' || t==='green'){
    const base = t==='green'? new THREE.Color(0x5d7a3a) : t==='uspark'? new THREE.Color(0x567a38) : new THREE.Color(0x5d7c36);
    const dryCol = new THREE.Color(0x9a8c54), dirtCol = new THREE.Color(0x8a7550);
    return { detail:'grass',
      height:(x,z,n)=> n(x*0.012,z*0.012)*3 + n(x*0.05,z*0.05)*0.7,
      color:(col,x,z,h,n)=>{ col.copy(base);
        const v = n(x*0.09+7,z*0.09+3);
        col.offsetHSL(0,(v-0.5)*0.1,(v-0.5)*0.12);
        if(h>2.4) col.offsetHSL(0,-0.05,0.04);
        const dry = n(x*0.022+5, z*0.022+1);
        if(dry>0.64) col.lerp(dryCol, Math.min(0.75,(dry-0.64)*4));
        if(dry>0.8) col.lerp(dirtCol, Math.min(0.7,(dry-0.8)*6));
      } };
  }
  if(t==='beach'){
    return { detail:'sand',
      height:(x,z,n)=>{
        // water toward -z: wet flat, dry sand rises, dunes at back
        let h;
        if(z < -18) h = -1.6 + (z+18)*0.02; // under water slope
        else if(z < 6) h = -1.55 + (z+18)*0.075; // wet sand slope up
        else h = 0.25 + (z-6)*0.055 + n(x*0.03, z*0.03)*1.6*Math.min(1,(z-6)/30);
        return h + n(x*0.1,z*0.1)*0.12;
      },
      color:(col,x,z,h,n)=>{
        if(z<-14) col.setHex(0xc9b98c); // submerged sand
        else if(z<7){ col.setHex(0xcdb586); const v=n(x*0.08,z*0.08); col.offsetHSL(0,0,(v-0.5)*0.06); } // wet
        else { col.setHex(0xe4d0a0); const v=n(x*0.06,z*0.06); col.offsetHSL(0,0.02,(v-0.5)*0.08); }
        if(z>36 && n(x*0.05,z*0.05)>0.45) col.setHex(0x8a9a5a); // dune grass tint
      } };
  }
  if(t==='goldfields'){
    return { detail:'gravel',
      height:(x,z,n)=> n(x*0.01,z*0.01)*6 + n(x*0.04,z*0.04)*1.6 - 2,
      color:(col,x,z,h,n)=>{ col.setHex(0x9a5a34);
        const v = n(x*0.07+2,z*0.07+9);
        col.offsetHSL((v-0.5)*0.04,(v-0.5)*0.12,(v-0.5)*0.1);
        if(v>0.62) col.setHex(0x7a6a4a);
      } };
  }
  if(t==='farm'){
    return { detail:'soil',
      height:(x,z,n)=>{
        let h = n(x*0.008,z*0.008)*7 - 1 + n(x*0.05,z*0.05)*0.4;
        if(x>10) h += Math.sin(z*1.4)*0.16; // plough furrows east side
        return h;
      },
      color:(col,x,z,h,n)=>{
        if(x>10){ col.setHex(0x6e5238); const v=n(x*0.1,z*0.1); col.offsetHSL(0,0,(v-0.5)*0.1); } // ploughed
        else { col.setHex(0xb89a56); const v=n(x*0.07,z*0.07); col.offsetHSL(0,(v-0.5)*0.08,(v-0.5)*0.1); } // stubble
      } };
  }
  if(t==='pasture'){
    const worn = new THREE.Color(0x9a8c58);
    const base = site.id==='us_battle'? new THREE.Color(0x5d6e38) : new THREE.Color(0x527a38);
    return { detail:'grass',
      height:(x,z,n)=> n(x*0.009,z*0.009)*5 + n(x*0.045,z*0.045)*0.9 - 1,
      color:(col,x,z,h,n)=>{ col.copy(base);
        const v = n(x*0.08+3,z*0.08+6);
        col.offsetHSL(0,(v-0.5)*0.08,(v-0.5)*0.1);
        const track = n(x*0.02+11, z*0.02+4);
        if(track>0.68) col.lerp(worn, Math.min(0.7,(track-0.68)*4));
      } };
  }
  return { height:()=>0, color:(col)=>col.setHex(0x777777) };
}

// ---------- near-field grass ring (dense, follows the player) ----------
function makeNearGrass(scene, heightAt, colA, colB, rngSeedBase, count){
  const COUNT = count||4600, CELL = 10;
  const geo = new THREE.ConeGeometry(0.018, 1, 3);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const inst = new THREE.InstancedMesh(geo, mat, COUNT);
  inst.frustumCulled = false;
  const ca = new THREE.Color(colA), cb = new THREE.Color(colB), cm = new THREE.Color();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
        s = new THREE.Vector3(), p = new THREE.Vector3();
  let lastCX = null, lastCZ = null;
  scene.add(inst);
  function fill(cx, cz){
    const perCell = Math.floor(COUNT/9);
    let k = 0;
    for(let gx=-1; gx<=1; gx++) for(let gz=-1; gz<=1; gz++){
      const cellX = cx+gx, cellZ = cz+gz;
      const rng = mulberry32(((cellX*73856093) ^ (cellZ*19349663) ^ rngSeedBase) >>> 0);
      for(let i=0; i<perCell && k<COUNT; i++){
        const x = (cellX + rng())*CELL - 0, z = (cellZ + rng())*CELL;
        if(Math.abs(x)>HALF-2 || Math.abs(z)>HALF-2){ // outside terrain: park it underground
          p.set(0,-50,0); s.set(0.001,0.001,0.001); q.identity();
          m4.compose(p,q,s); inst.setMatrixAt(k, m4); inst.setColorAt(k, ca); k++; continue;
        }
        e.set((rng()-0.5)*0.5, rng()*Math.PI, (rng()-0.5)*0.5);
        q.setFromEuler(e);
        const h = 0.1 + rng()*0.24;
        s.set(0.7+rng()*0.8, h, 0.7+rng()*0.8);
        p.set(x, heightAt(x,z)+h*0.4, z);
        m4.compose(p, q, s);
        inst.setMatrixAt(k, m4);
        cm.copy(ca).lerp(cb, rng());
        inst.setColorAt(k, cm);
        k++;
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    if(inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }
  return { update(px, pz){
    const cx = Math.floor(px/CELL), cz = Math.floor(pz/CELL);
    if(cx!==lastCX || cz!==lastCZ){ lastCX = cx; lastCZ = cz; fill(cx, cz); }
  } };
}

// ---------- instanced ground cover ----------
function addBlades(props, rng, heightAt, opts){
  const geo = new THREE.ConeGeometry(opts.width||0.02, 1, 3);
  geo.translate(0, 0.5, 0);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: opts.color }), opts.count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
        s = new THREE.Vector3(), p = new THREE.Vector3();
  let k = 0;
  for(let i=0; i<opts.count*4 && k<opts.count; i++){
    const x = (rng()-0.5)*(opts.spread||SIZE*0.92), z = (rng()-0.5)*(opts.spread||SIZE*0.92);
    if(opts.filter && !opts.filter(x,z)) continue;
    e.set((rng()-0.5)*0.45, rng()*Math.PI, (rng()-0.5)*0.45);
    q.setFromEuler(e);
    const h = opts.hMin + rng()*(opts.hMax-opts.hMin);
    s.set(0.7+rng()*0.7, h, 0.7+rng()*0.7);
    p.set(x, heightAt(x,z)+h*0.42, z);
    m4.compose(p, q, s);
    inst.setMatrixAt(k++, m4);
  }
  inst.count = k;
  props.add(inst);
}
function addPebbles(props, rng, heightAt, opts){
  const geo = new THREE.SphereGeometry(1, 5, 4);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: opts.color }), opts.count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(),
        s = new THREE.Vector3(), p = new THREE.Vector3();
  let k = 0;
  for(let i=0; i<opts.count*4 && k<opts.count; i++){
    const x = (rng()-0.5)*(opts.spread||SIZE*0.92), z = (rng()-0.5)*(opts.spread||SIZE*0.92);
    if(opts.filter && !opts.filter(x,z)) continue;
    e.set(rng()*3, rng()*3, rng()*3); q.setFromEuler(e);
    const r = opts.rMin + rng()*(opts.rMax-opts.rMin);
    s.set(r, r*(0.4+rng()*0.3), r*(0.7+rng()*0.5));
    p.set(x, heightAt(x,z)+r*0.25, z);
    m4.compose(p, q, s);
    inst.setMatrixAt(k++, m4);
  }
  inst.count = k;
  props.add(inst);
}
function addGroundCover(site, props, rng, heightAt){
  const t = site.terrain;
  if(t==='park' || t==='green' || t==='uspark' || t==='pasture'){
    const g1 = t==='park'? 0x5d7a34 : t==='green'? 0x527236 : t==='pasture'? 0x4d7232 : 0x4e6e30;
    const g2 = t==='park'? 0x77913e : t==='green'? 0x6a8a42 : 0x688a3c;
    addBlades(props, rng, heightAt, { count:2400, color:g1, hMin:0.12, hMax:0.3 });
    addBlades(props, rng, heightAt, { count:2400, color:g2, hMin:0.1, hMax:0.26 });
    // longer unmown tufts
    addBlades(props, rng, heightAt, { count:900, color:0x4d6628, hMin:0.3, hMax:0.55, width:0.03 });
    // daisies / capeweed
    addPebbles(props, rng, heightAt, { count:260, color: t==='park'? 0xe9d94a : 0xf0eee0, rMin:0.02, rMax:0.035 });
  }
  if(t==='beach'){
    // marram grass on the dunes
    addBlades(props, rng, heightAt, { count:2600, color:0x8a9a5a, hMin:0.3, hMax:0.7, width:0.026,
      filter:(x,z)=> z>36 });
    addBlades(props, rng, heightAt, { count:900, color:0xb0b878, hMin:0.25, hMax:0.5, width:0.02,
      filter:(x,z)=> z>32 });
    // shells and pebbles along the tide line
    addPebbles(props, rng, heightAt, { count:520, color:0xf0e8d8, rMin:0.025, rMax:0.06,
      filter:(x,z)=> z>-6 && z<10 });
    addPebbles(props, rng, heightAt, { count:260, color:0xc9a88a, rMin:0.02, rMax:0.05,
      filter:(x,z)=> z>-8 && z<12 });
    // dried seaweed wisps
    addBlades(props, rng, heightAt, { count:180, color:0x4a4530, hMin:0.04, hMax:0.1, width:0.09,
      filter:(x,z)=> z>-4 && z<4 });
  }
  if(t==='goldfields'){
    // dry tussocks in the red dirt
    addBlades(props, rng, heightAt, { count:3400, color:0xa89454, hMin:0.14, hMax:0.42, width:0.024 });
    addBlades(props, rng, heightAt, { count:1200, color:0x7d6b3c, hMin:0.1, hMax:0.28 });
    // quartz float — the prospector's tell — and ironstone
    addPebbles(props, rng, heightAt, { count:600, color:0xefeae0, rMin:0.03, rMax:0.11 });
    addPebbles(props, rng, heightAt, { count:800, color:0x6e3f22, rMin:0.03, rMax:0.09 });
  }
  if(t==='farm'){
    // grassy headland strips around the worked ground
    addBlades(props, rng, heightAt, { count:2200, color:0x6a7a3a, hMin:0.14, hMax:0.4,
      filter:(x,z)=> z<-92 || z>92 || x<-96 });
    // loose straw on the stubble side
    addBlades(props, rng, heightAt, { count:1400, color:0xd0b878, hMin:0.03, hMax:0.07, width:0.05,
      filter:(x,z)=> x<8 });
    // clods on the plough
    addPebbles(props, rng, heightAt, { count:900, color:0x5a422c, rMin:0.04, rMax:0.12,
      filter:(x,z)=> x>12 });
  }
}

// ---------- site dressing ----------
function dressSite(site, scene, heightAt, rng){
  const props = new THREE.Group();
  const interactives = { farmhouseDoor:null };
  const t = site.terrain;
  const filterOut = zone => (x,z) => !zone || Math.hypot(x-zone.x, z-zone.z) > zone.r+3;
  const pz = site._pzone;

  if(t==='park'){
    scatter(props, rng, 16, r=>makeTree('gum',r), heightAt, {filter:filterOut(pz)});
    const fig = makeTree('fig', rng); fig.position.set(-32, heightAt(-32,-20), -20); props.add(fig);
    site._bigfig = {x:-32,z:-20};
    const pg = makeBuilding('playground'); pg.position.set(34, heightAt(34,28), 28); props.add(pg);
    for(let i=0;i<4;i++){ const p = makeBuilding('picnic'); const x=-15+i*12, z=42; p.position.set(x,heightAt(x,z),z); p.rotation.y=rng(); props.add(p); }
    const mem = makeBuilding('memorial'); mem.position.set(pz.x, heightAt(pz.x,pz.z), pz.z); props.add(mem);
    // memorial fence ring + signs
    const ring = new THREE.Group();
    for(let i=0;i<14;i++){ const a=i/14*Math.PI*2; const post=makeFencePost();
      post.position.set(pz.x+Math.cos(a)*pz.r, heightAt(pz.x+Math.cos(a)*pz.r, pz.z+Math.sin(a)*pz.r)+0.55, pz.z+Math.sin(a)*pz.r); ring.add(post); }
    props.add(ring);
    const s1 = makeSign(['WAR MEMORIAL','NO METAL','DETECTING']); s1.position.set(pz.x, heightAt(pz.x,pz.z+pz.r+1), pz.z+pz.r+1); props.add(s1);
    const s2 = makeSign(['FEDERATION PARK','EST. 1901'],{border:'#2f5a3a',fg:'#2f5a3a'}); s2.position.set(6,heightAt(6,52),52); s2.rotation.y=Math.PI; props.add(s2);
    scatter(props, rng, 14, r=>makeRock(r,0x8a8474), heightAt, {filter:filterOut(pz)});
  }
  if(t==='beach'){
    // dune fence along z=40
    props.add(makeFenceLine([-100,42],[100,42], heightAt, 3.2,[0.5]));
    const bw = makeBuilding('boardwalk'); bw.position.set(-40, heightAt(-40,60), 60); props.add(bw);
    const lg = makeBuilding('lifeguard'); lg.position.set(30, heightAt(30,20), 20); props.add(lg);
    for(let i=0;i<6;i++){ const p = makeTree('palm',rng); const x=(rng()-0.5)*160, z=52+rng()*30; p.position.set(x,heightAt(x,z),z); props.add(p); }
    const s1 = makeSign(['DUNE CARE AREA','KEEP OUT','$220 PENALTY']); s1.position.set(pz.x, heightAt(pz.x, pz.z-pz.r-1)+0, pz.z-pz.r-1); props.add(s1);
    site._dunes = { x:pz.x-24, z:34 };
    // towels & umbrellas on dry sand
    for(let i=0;i<7;i++){
      const x=(rng()-0.5)*120, z=12+rng()*16;
      const towel = new THREE.Mesh(new THREE.BoxGeometry(1.7,0.03,0.9), lam([0xc85a5a,0x4a7ac8,0xd9c23f,0x4aa87a][i%4]));
      towel.position.set(x, heightAt(x,z)+0.03, z); towel.rotation.y=rng(); props.add(towel);
      if(i%2===0){ const um = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,2.2,6), lam(0xdddddd)); pole.position.y=1.1; um.add(pole);
        const top = new THREE.Mesh(new THREE.ConeGeometry(1.3,0.6,8), lam([0xc85a5a,0x4a7ac8][i%2])); top.position.y=2.2; um.add(top);
        um.position.set(x+1.4, heightAt(x+1.4,z), z); um.rotation.z=0.15; props.add(um); }
    }
  }
  if(t==='goldfields'){
    scatter(props, rng, 22, r=>makeTree('ironbark',r), heightAt, {filter:filterOut(pz)});
    scatter(props, rng, 30, r=>makeRock(r,0x8a5a3a), heightAt);
    const hf = makeBuilding('headframe'); hf.position.set(pz.x, heightAt(pz.x,pz.z), pz.z); props.add(hf);
    for(let i=0;i<3;i++){
      const mound = new THREE.Mesh(new THREE.ConeGeometry(2.6+rng()*2, 1.4+rng(), 8), lam(0xa06038));
      const x=pz.x+(rng()-0.5)*24, z=pz.z+(rng()-0.5)*24;
      mound.position.set(x, heightAt(x,z)+0.2, z); props.add(mound);
    }
    const s1 = makeSign(['DANGER','OPEN SHAFTS','KEEP OUT']); s1.position.set(pz.x+pz.r*0.8, heightAt(pz.x+pz.r*0.8,pz.z), pz.z); props.add(s1);
    const roo = makeKangaroo(); roo.position.set(48, heightAt(48,-42), -42); roo.rotation.y=-0.7; props.add(roo);
  }
  if(t==='farm'){
    // hedgerow boundary + farmhouse west, oaks
    props.add(makeFenceLine([-HALF+6,-HALF+6],[HALF-6,-HALF+6], heightAt, 3));
    props.add(makeFenceLine([-HALF+6,HALF-6],[HALF-6,HALF-6], heightAt, 3));
    for(let i=0;i<12;i++){
      const hx = -HALF+8+i*18;
      const hedge = new THREE.Mesh(new THREE.SphereGeometry(2.2+rng(),6,5), lam(0x3f5a2e));
      hedge.position.set(hx, heightAt(hx,-HALF+6)+0.8, -HALF+6); hedge.scale.y=0.8; props.add(hedge);
    }
    const house = makeBuilding('farmhouse'); const hx=-72, hz=54, hrot=Math.PI*0.85;
    house.position.set(hx, heightAt(hx,hz), hz); house.rotation.y = hrot; props.add(house);
    // door sits at local (0,0,3.6); rotate into world space
    interactives.farmhouseDoor = new THREE.Vector3(hx + Math.sin(hrot)*4.6, heightAt(hx,hz), hz + Math.cos(hrot)*4.6);
    scatter(props, rng, 8, r=>makeTree('oak',r), heightAt, {spread:180, filter:(x,z)=>x<-20||z<-30});
    const tractor = makeTractor(); tractor.position.set(30, heightAt(30,-60), -60); tractor.rotation.y=0.5; props.add(tractor);
    site._tractor = tractor;
    site._topfield = { x:60, z:-40 };
    // stubble rows west of x=10
    const stubGeo = new THREE.CylinderGeometry(0.015,0.02,0.32,3);
    const stubMat = lam(0xcbb26a);
    const inst = new THREE.InstancedMesh(stubGeo, stubMat, 3200);
    const m4 = new THREE.Matrix4(); let k=0;
    for(let gx=-100; gx<8 && k<3200; gx+=2.2){
      for(let gz=-100; gz<100 && k<3200; gz+=2.6){
        const x = gx+(rng()-0.5), z = gz+(rng()-0.5);
        m4.makeRotationY(rng()*3); m4.setPosition(x, heightAt(x,z)+0.16, z);
        inst.setMatrixAt(k++, m4);
      }
    }
    inst.count = k; props.add(inst);
    const s1 = makeSign(['WHEATFIELD FARM','PRIVATE LAND','PERMISSION ONLY'],{border:'#2f4a6a',fg:'#2f4a6a'});
    s1.position.set(-64, heightAt(-64,48), 48); props.add(s1);
  }
  if(t==='green'){
    const church = makeBuilding('church'); church.position.set(pz.x, heightAt(pz.x,pz.z), pz.z-6); props.add(church);
    // churchyard wall
    const wall = new THREE.Group();
    for(let i=0;i<16;i++){ const a=i/16*Math.PI*2;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(pz.r*0.42,0.8,0.3), lam(0x9a927c));
      seg.position.set(pz.x+Math.cos(a)*pz.r, heightAt(pz.x+Math.cos(a)*pz.r,pz.z+Math.sin(a)*pz.r)+0.4, pz.z+Math.sin(a)*pz.r);
      seg.rotation.y=-a+Math.PI/2; wall.add(seg); }
    props.add(wall);
    // headstones inside
    for(let i=0;i<8;i++){ const a=rng()*Math.PI*2, r=rng()*pz.r*0.6;
      const hs = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.7,0.1), lam(0xb0aa96));
      hs.position.set(pz.x+Math.cos(a)*r, heightAt(pz.x+Math.cos(a)*r,pz.z+Math.sin(a)*r)+0.35, pz.z+Math.sin(a)*r);
      hs.rotation.y=rng(); hs.rotation.z=(rng()-0.5)*0.15; props.add(hs); }
    scatter(props, rng, 10, r=>makeTree('elm',r), heightAt, {filter:filterOut(pz)});
    for(let i=0;i<3;i++){ const p=makeBuilding('picnic'); const x=20+i*10, z=30; p.position.set(x,heightAt(x,z),z); props.add(p); }
    // cottages edge
    for(let i=0;i<4;i++){ const c = makeBuilding('farmhouse'); c.scale.setScalar(0.7);
      const x=-80+i*32, z=88; c.position.set(x,heightAt(x,z),z); c.rotation.y=Math.PI; props.add(c); }
    const s1 = makeSign(['ST MARY’S','CHURCHYARD','NO DETECTING']); s1.position.set(pz.x, heightAt(pz.x,pz.z+pz.r+1), pz.z+pz.r+1); props.add(s1);
  }
  if(t==='uspark'){
    scatter(props, rng, 18, r=>makeTree('elm',r), heightAt, {filter:filterOut(pz)});
    scatter(props, rng, 6, r=>makeTree('oak',r), heightAt, {filter:filterOut(pz)});
    const bs = makeBuilding('bandstand'); bs.position.set(pz.x, heightAt(pz.x,pz.z), pz.z); props.add(bs);
    for(let i=0;i<12;i++){ const a=i/12*Math.PI*2; const post=makeFencePost();
      post.position.set(pz.x+Math.cos(a)*pz.r, heightAt(pz.x+Math.cos(a)*pz.r,pz.z+Math.sin(a)*pz.r)+0.55, pz.z+Math.sin(a)*pz.r); props.add(post); }
    const s1 = makeSign(['HISTORIC LAWN','NO DIGGING','CITY ORD. 12.4']); s1.position.set(pz.x, heightAt(pz.x,pz.z+pz.r+1), pz.z+pz.r+1); props.add(s1);
    for(let i=0;i<5;i++){ const p=makeBuilding('picnic'); const x=-40+i*10, z=-46; p.position.set(x,heightAt(x,z),z); props.add(p); }
    // path
    const path = new THREE.Mesh(new THREE.PlaneGeometry(3.4,150,1,40), lam(0xb0a58c));
    path.rotation.x=-Math.PI/2; path.position.set(-8,0,0);
    const pp = path.geometry.attributes.position;
    for(let i=0;i<pp.count;i++){ const wx=-8+pp.getX(i)+Math.sin(pp.getY(i)*0.05)*6; pp.setZ ? null : null; }
    props.add(path);
  }
  if(t==='pasture'){
    props.add(makeFenceLine([-HALF+6,-HALF+8],[HALF-6,-HALF+8], heightAt, 3));
    props.add(makeFenceLine([-HALF+6,HALF-8],[HALF-6,HALF-8], heightAt, 3));
    scatter(props, rng, 9, r=>makeTree('oak',r), heightAt, {filter:filterOut(pz)});
    if(site.country==='UK'){
      for(let i=0;i<9;i++){ const s = makeSheep(rng);
        const x=(rng()-0.5)*160, z=(rng()-0.5)*160;
        s.position.set(x, heightAt(x,z), z); props.add(s); }
      for(let i=0;i<8;i++){ const hx=-HALF+10+i*26;
        const hedge = new THREE.Mesh(new THREE.SphereGeometry(2+rng(),6,5), lam(0x3f5a2e));
        hedge.position.set(hx, heightAt(hx,-HALF+8)+0.7, -HALF+8); hedge.scale.y=0.8; props.add(hedge); }
    }
    if(site.id==='us_battle'){
      const cannon = makeCannon(); cannon.position.set(24, heightAt(24,30), 30); cannon.rotation.y=-0.6; props.add(cannon);
      props.add(makeFenceLine([-30,-50],[40,-58], heightAt, 2.6, [0.35,0.75]));
    }
    if(pz){
      const cairn = new THREE.Group();
      for(let i=0;i<14;i++){ const r = makeRock(rng, 0x8a8478);
        const a=rng()*Math.PI*2, rr=rng()*1.6;
        r.position.set(pz.x+Math.cos(a)*rr, heightAt(pz.x,pz.z)+0.2+rng()*0.9*(1-rr/1.8), pz.z+Math.sin(a)*rr);
        cairn.add(r); }
      props.add(cairn);
      for(let i=0;i<10;i++){ const a=i/10*Math.PI*2; const post=makeFencePost();
        post.position.set(pz.x+Math.cos(a)*pz.r, heightAt(pz.x+Math.cos(a)*pz.r,pz.z+Math.sin(a)*pz.r)+0.55, pz.z+Math.sin(a)*pz.r); props.add(post); }
      const s1 = makeSign(['PROTECTED SITE','NO DIGGING']); s1.position.set(pz.x, heightAt(pz.x,pz.z+pz.r+1), pz.z+pz.r+1); props.add(s1);
    }
  }
  addGroundCover(site, props, rng, heightAt);
  scene.add(props);
  return interactives;
}

// ---------- ocean ----------
function makeOcean(scene){
  const geo = new THREE.PlaneGeometry(SIZE*1.4, 110, 90, 22);
  geo.rotateX(-Math.PI/2);
  const mat = new THREE.MeshLambertMaterial({ color:0x2e7a8a, transparent:true, opacity:0.92 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, -0.55, -73);
  scene.add(mesh);
  const base = geo.attributes.position.array.slice();
  // foam strips
  const foams = [];
  for(let i=0;i<3;i++){
    const f = new THREE.Mesh(new THREE.PlaneGeometry(SIZE*1.3, 1.6, 40,1),
      new THREE.MeshBasicMaterial({ color:0xf4f7f2, transparent:true, opacity:0.75, depthWrite:false }));
    f.rotation.x=-Math.PI/2; f.position.set(0,-0.42,-30-i*14);
    f.userData.phase = i*2.1;
    scene.add(f); foams.push(f);
  }
  return { animate(t){
    const pos = geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x = base[i*3], z = base[i*3+2];
      pos.setY(i, Math.sin(x*0.12 + t*1.3)*0.22 + Math.sin(z*0.24 + t*0.9)*0.3 + Math.sin((x+z)*0.05+t*0.5)*0.18);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    for(const f of foams){
      const ph = (t*0.35 + f.userData.phase)%6;
      f.position.z = -46 + ph*3.4;
      f.material.opacity = Math.max(0, 0.8 - Math.abs(ph-4.4)*0.45);
    }
  } };
}

// ---------- find icons (2D canvas painter for UI) ----------
function paintIcon(canvas, item){
  const g = canvas.getContext('2d'); const S = canvas.width;
  g.clearRect(0,0,S,S);
  g.save(); g.translate(S/2,S/2);
  const tint = item.tint || '#c9a227';
  const dark = '#241c12';
  const R = S*0.32;
  const disc=(r,fill)=>{ g.beginPath(); g.arc(0,0,r,0,7); g.fillStyle=fill; g.fill(); };
  switch(item.icon){
    case 'coin': case 'coinbig': {
      const r = item.icon==='coinbig'? S*0.4 : R;
      disc(r,tint); disc(r*0.86, shade(tint,-18)); disc(r*0.78, tint);
      g.fillStyle=shade(tint,-30); g.font='700 '+(r*0.9)+'px Georgia'; g.textAlign='center'; g.textBaseline='middle';
      g.fillText(item.kind==='coin'?'✶':'', 0, r*0.05);
      break; }
    case 'coin12': { g.beginPath();
      for(let i=0;i<12;i++){ const a=i/12*Math.PI*2; g.lineTo(Math.cos(a)*R, Math.sin(a)*R); }
      g.closePath(); g.fillStyle=tint; g.fill();
      g.beginPath(); for(let i=0;i<12;i++){ const a=i/12*Math.PI*2; g.lineTo(Math.cos(a)*R*0.8, Math.sin(a)*R*0.8); }
      g.closePath(); g.fillStyle=shade(tint,-15); g.fill(); break; }
    case 'coinrough': {
      g.beginPath();
      for(let i=0;i<16;i++){ const a=i/16*Math.PI*2; const rr=R*(0.82+Math.sin(i*3.7)*0.13); g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr); }
      g.closePath(); g.fillStyle=tint; g.fill();
      g.beginPath(); g.arc(-R*0.15,-R*0.1,R*0.4,0,7); g.fillStyle=shade(tint,-22); g.fill();
      g.beginPath(); g.arc(-R*0.15,-R*0.1,R*0.34,0,7); g.fillStyle=shade(tint,10); g.fill(); break; }
    case 'ring': { g.lineWidth=S*0.11; g.strokeStyle=tint; g.beginPath(); g.arc(0,S*0.04,R*0.8,0,7); g.stroke();
      g.strokeStyle=shade(tint,25); g.lineWidth=S*0.04; g.beginPath(); g.arc(0,S*0.04,R*0.8,-2.2,-1.2); g.stroke(); break; }
    case 'gem': { g.lineWidth=S*0.1; g.strokeStyle=tint; g.beginPath(); g.arc(0,S*0.1,R*0.72,0,7); g.stroke();
      g.fillStyle='#dff3ff'; g.beginPath();
      g.moveTo(0,-S*0.36); g.lineTo(S*0.13,-S*0.2); g.lineTo(0,-S*0.04); g.lineTo(-S*0.13,-S*0.2); g.closePath(); g.fill();
      g.strokeStyle='#9fd4ea'; g.lineWidth=2; g.stroke(); break; }
    case 'chain': { g.lineWidth=S*0.045; g.strokeStyle=tint;
      for(let i=0;i<5;i++){ g.beginPath(); g.ellipse(-S*0.26+i*S*0.13, Math.sin(i)*S*0.08, S*0.07,S*0.045, 0.5, 0,7); g.stroke(); } break; }
    case 'nug': { g.beginPath();
      for(let i=0;i<11;i++){ const a=i/11*Math.PI*2; const rr=R*(0.75+Math.sin(i*5.3)*0.22); g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr*0.85); }
      g.closePath(); g.fillStyle=tint; g.fill();
      g.fillStyle=shade(tint,30); g.beginPath(); g.arc(-R*0.25,-R*0.25,R*0.22,0,7); g.fill();
      g.fillStyle=shade(tint,-25); g.beginPath(); g.arc(R*0.2,R*0.22,R*0.18,0,7); g.fill(); break; }
    case 'quartz': { g.fillStyle='#e8e2d4'; g.beginPath();
      g.moveTo(-R,-R*0.2); g.lineTo(-R*0.3,-R); g.lineTo(R*0.6,-R*0.5); g.lineTo(R,R*0.3); g.lineTo(R*0.1,R*0.9); g.lineTo(-R*0.8,R*0.5);
      g.closePath(); g.fill();
      g.strokeStyle='#c9a227'; g.lineWidth=S*0.04; g.beginPath(); g.moveTo(-R*0.5,R*0.2); g.quadraticCurveTo(0,-R*0.3,R*0.5,-R*0.1); g.stroke(); break; }
    case 'nail': { g.strokeStyle=tint; g.lineWidth=S*0.07; g.lineCap='round';
      g.beginPath(); g.moveTo(-R*0.7,-R*0.7); g.lineTo(R*0.6,R*0.6); g.stroke();
      g.beginPath(); g.moveTo(-R*0.95,-R*0.45); g.lineTo(-R*0.45,-R*0.95); g.stroke(); break; }
    case 'cap': { g.beginPath();
      for(let i=0;i<21;i++){ const a=i/21*Math.PI*2; const rr=R*(i%2? 0.82:0.95)*0.9; g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr); }
      g.closePath(); g.fillStyle=tint; g.fill(); disc(R*0.6, shade(tint,-20)); break; }
    case 'pull': { g.lineWidth=S*0.06; g.strokeStyle=tint;
      g.beginPath(); g.arc(0,-S*0.1,S*0.16,0,7); g.stroke();
      g.beginPath(); g.ellipse(0,S*0.18,S*0.13,S*0.2,0,0,7); g.stroke(); break; }
    case 'foil': { g.fillStyle=tint; g.beginPath();
      g.moveTo(-R,-R*0.4); g.lineTo(-R*0.2,-R*0.8); g.lineTo(R*0.3,-R*0.3); g.lineTo(R*0.9,-R*0.5); g.lineTo(R*0.6,R*0.4); g.lineTo(-R*0.1,R*0.7); g.lineTo(-R*0.6,R*0.2);
      g.closePath(); g.fill();
      g.strokeStyle=shade(tint,20); g.lineWidth=2; g.stroke(); break; }
    case 'shell': { disc(R*0.85,tint); disc(R*0.6,shade(tint,-25)); disc(R*0.2,shade(tint,-40)); break; }
    case 'ball': { disc(R*0.7,tint); g.fillStyle=shade(tint,25); g.beginPath(); g.arc(-R*0.2,-R*0.2,R*0.2,0,7); g.fill(); break; }
    case 'buckle': { g.lineWidth=S*0.08; g.strokeStyle=tint;
      g.strokeRect(-R*0.8,-R*0.6,R*1.6,R*1.2);
      g.lineWidth=S*0.04; g.beginPath(); g.moveTo(0,-R*0.6); g.lineTo(0,R*0.6); g.stroke(); break; }
    case 'button': { disc(R*0.8,tint); disc(R*0.68,shade(tint,-12));
      g.fillStyle=shade(tint,-35);
      for(const [bx,by] of [[-0.2,-0.2],[0.2,-0.2],[-0.2,0.2],[0.2,0.2]]){ g.beginPath(); g.arc(bx*R,by*R,R*0.08,0,7); g.fill(); } break; }
    case 'car': { g.fillStyle=tint; g.beginPath();
      g.moveTo(-R,R*0.3); g.lineTo(-R,0); g.lineTo(-R*0.5,-R*0.1); g.lineTo(-R*0.2,-R*0.45); g.lineTo(R*0.5,-R*0.45); g.lineTo(R*0.8,-R*0.1); g.lineTo(R,0); g.lineTo(R,R*0.3);
      g.closePath(); g.fill();
      g.fillStyle=dark; g.beginPath(); g.arc(-R*0.5,R*0.35,R*0.22,0,7); g.fill(); g.beginPath(); g.arc(R*0.5,R*0.35,R*0.22,0,7); g.fill(); break; }
    case 'shoe': { g.lineWidth=S*0.1; g.strokeStyle=tint; g.beginPath(); g.arc(0,0,R*0.7,-0.4,Math.PI+0.4,false); g.stroke();
      g.fillStyle=shade(tint,-20); for(const a of [-0.2,1.2,2.2,3.3]){ g.beginPath(); g.arc(Math.cos(a)*R*0.7,Math.sin(a)*R*0.7,R*0.08,0,7); g.fill(); } break; }
    case 'pick': { g.strokeStyle='#7a6248'; g.lineWidth=S*0.07; g.beginPath(); g.moveTo(0,-R*0.2); g.lineTo(0,R*0.9); g.stroke();
      g.strokeStyle=tint; g.lineWidth=S*0.09; g.beginPath(); g.moveTo(-R*0.9,0); g.quadraticCurveTo(0,-R*0.9,R*0.9,0); g.stroke(); break; }
    case 'drop': { g.fillStyle=tint; g.beginPath();
      g.moveTo(0,-R*0.9); g.quadraticCurveTo(R*0.75,0,0,R*0.8); g.quadraticCurveTo(-R*0.75,0,0,-R*0.9); g.closePath(); g.fill(); break; }
    default: disc(R,tint);
  }
  g.restore();
}
function shade(hex, pct){
  const n = parseInt(hex.slice(1),16);
  let r=(n>>16)+pct*2.55, gg=((n>>8)&255)+pct*2.55, b=(n&255)+pct*2.55;
  r=Math.max(0,Math.min(255,r)); gg=Math.max(0,Math.min(255,gg)); b=Math.max(0,Math.min(255,b));
  return 'rgb('+(r|0)+','+(gg|0)+','+(b|0)+')';
}

// ---------- build a full site ----------
function buildSite(site, scene){
  const rng = mulberry32(site.id.split('').reduce((a,c)=>a*31+c.charCodeAt(0),7)|0);
  // prohibited zone geometry per site
  const zones = {
    au_park:{x:-40,z:30,r:14}, au_beach:{x:38,z:48,r:16}, au_gold:{x:44,z:20,r:18}, au_show:{x:30,z:-26,r:15},
    uk_green:{x:-30,z:-30,r:20}, us_park:{x:30,z:-20,r:15}, us_battle:{x:-36,z:-20,r:13} };
  site._pzone = site.prohibited ? zones[site.id] : null;
  const preset = terrainPreset(site, rng);
  const { mesh, heightAt } = makeTerrain(preset, rng);
  scene.add(mesh);
  const sky = buildSky(scene, site.time, rng);
  const interactives = dressSite(site, scene, heightAt, rng);
  let ocean = null;
  if(site.terrain==='beach') ocean = makeOcean(scene);
  let nearGrass = null;
  const NG = { park:[0x55742e,0x86a04a], green:[0x4a6a30,0x74924a], uspark:[0x466830,0x6e8e44], pasture:[0x4a7034,0x7c9a4c],
               goldfields:[0x8a7440,0xb59c58], farm:null, beach:null };
  const ng = NG[site.terrain];
  if(ng) nearGrass = makeNearGrass(scene, heightAt, ng[0], ng[1], site.id.length*2654435761, site.terrain==='goldfields'? 1300 : 4600);
  return { heightAt, sky, ocean, interactives, nearGrass,
    pzone: site._pzone,
    inProhibited(x,z){ const p=site._pzone; return p ? Math.hypot(x-p.x,z-p.z)<p.r : false; },
    animate(t,dt){ sky.animate(dt); if(ocean) ocean.animate(t); } };
}

return { buildSite, makePerson, makeMagpie, makeSeagull, makeSnake, makeDetectorModel, makeHole, makePlayerGloves, addNpcGloves, paintIcon, SIZE, HALF, mulberry32 };
})();
