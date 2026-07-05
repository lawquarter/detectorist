/* ============ THE DETECTORIST — GAME LOGIC ============ */
'use strict';
(() => {
const $ = s => document.querySelector(s);
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || location.search.includes('touch=1');
window.IS_TOUCH = IS_TOUCH;
const { DETECTORS, DETECTOR_ORDER, TOOLS, PERMITS, ITEMS, BUCKET, SITES, SITE_ORDER, MISSIONS, DIALOGUE } = DATA;

/* ================= STATE ================= */
const DEFAULT_STATE = () => ({
  day:1, money:2000, rep:1, tidy:0, lifetimeFinds:0,
  country:'AU', location:'au_beach',
  detector:'vanquish340', owned:{ vanquish340:true },
  tools:{ trowel:true }, uses:{ snacks:0, thermos:0 },
  packSlots:6, loadout:['trowel'],
  pouch:[], cabinet:[],
  bucket:{}, permits:{}, farmPermission:null,
  missions:{}, fines:0, karensSurvived:0,
  market:{ g:1, s:1, pg:1, ps:1 },
});
let state = DEFAULT_STATE();
const SAVE_KEY = 'detectorist-save-v1';
function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }catch(e){} }
function load(){ try{ const s = localStorage.getItem(SAVE_KEY); if(s){ state = Object.assign(DEFAULT_STATE(), JSON.parse(s)); return true; } }catch(e){} return false; }
const fmt$ = n => '$' + (Math.round(n*100)/100).toLocaleString('en-AU', {minimumFractionDigits: (n%1)?2:0, maximumFractionDigits:2});

const FLIGHTS = { 'AU-UK':1400,'AU-US':1600,'UK-US':900,'UK-AU':1400,'US-AU':1600,'US-UK':900 };
const LOCAL_COST = { au_park:0, au_beach:15, au_gold:60, au_show:25, uk_farm:30, uk_green:20, uk_pasture:15, us_park:25, us_beach:25, us_battle:40 };
function travelCost(siteId){
  const site = SITES[siteId];
  let c = LOCAL_COST[siteId];
  if(site.country !== state.country) c += FLIGHTS[state.country+'-'+site.country] || 1500;
  if(siteId === state.location) c = 0;
  return c;
}
function travelLabel(siteId){
  const site = SITES[siteId];
  if(siteId===state.location) return 'You are here';
  if(site.country!==state.country) return '✈ Flight + ' + site.travel.label.replace(/^.*?—\s*/,'');
  return site.travel.label;
}

/* ---------- precious metal spot market ---------- */
const GOLD_KEYS = ['sovereign','ring9ct','ring18ct','earring','posyring','nug05','nug3','nug12','specimen'];
const SILVER_KEYS = ['authree','ausix','aushil','auflorin','denarius','hammered','halfgroat','ukshil','mercdime','barberq','silring','silchain'];
const SPOT_BASE = { g:165, s:1.65 }; // AUD per gram
function metalMult(key){
  if(GOLD_KEYS.includes(key)) return state.market.g;
  if(SILVER_KEYS.includes(key)) return state.market.s;
  return 1;
}
function marketWalk(){
  state.market.pg = state.market.g; state.market.ps = state.market.s;
  state.market.g = Math.min(1.6, Math.max(0.65, state.market.g * (1 + (Math.random()-0.5)*0.16)));
  state.market.s = Math.min(1.7, Math.max(0.6, state.market.s * (1 + (Math.random()-0.5)*0.22)));
}
function tickerHtml(){
  const m = state.market;
  const arrow = (now, prev) => now > prev + 0.001 ? '<span style="color:#8fb04f">\u25b2</span>' : now < prev - 0.001 ? '<span style="color:#c8452f">\u25bc</span>' : '\u2013';
  return 'GOLD ' + arrow(m.g, m.pg) + ' $' + Math.round(SPOT_BASE.g * m.g) + '/g &nbsp;\u00b7&nbsp; SILVER ' + arrow(m.s, m.ps) + ' $' + (SPOT_BASE.s * m.s).toFixed(2) + '/g';
}

/* ================= AUDIO ================= */
const AUDIO = (() => {
  let ctx=null, master=null, vco=null, vcoGain=null, noiseSrc=null, noiseGain=null;
  function ensure(){
    if(ctx) return;
    ctx = new (window.AudioContext||window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    vco = ctx.createOscillator(); vco.type='sine';
    vcoGain = ctx.createGain(); vcoGain.gain.value = 0;
    vco.connect(vcoGain); vcoGain.connect(master); vco.start();
    // ambient noise bed (waves / wind)
    const buf = ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
    noiseSrc = ctx.createBufferSource(); noiseSrc.buffer = buf; noiseSrc.loop = true;
    const filt = ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value = 420;
    noiseGain = ctx.createGain(); noiseGain.gain.value = 0;
    noiseSrc.connect(filt); filt.connect(noiseGain); noiseGain.connect(master);
    noiseSrc.start();
  }
  function resume(){ ensure(); if(ctx.state==='suspended') ctx.resume(); }
  let lfoPhase = 0;
  function detectorTone(strength, cond, fe, dt, pinpoint){
    if(!ctx) return;
    const t = ctx.currentTime;
    if(strength<=0.02){ vcoGain.gain.setTargetAtTime(0, t, 0.03); return; }
    let freq;
    if(fe) freq = 130 + cond*1.2;
    else freq = 300 + (cond/99)*760;
    if(pinpoint){ freq = 520 + strength*620; }
    lfoPhase += dt*22;
    vco.frequency.setTargetAtTime(freq + Math.sin(lfoPhase)*6, t, 0.02);
    vco.type = fe ? 'square' : 'sine';
    vcoGain.gain.setTargetAtTime(Math.min(0.5, strength*0.5), t, 0.03);
  }
  function stopTone(){ if(ctx) vcoGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05); }
  function ambient(level){ if(ctx) noiseGain.gain.setTargetAtTime(level, ctx.currentTime, 0.5); }
  function blip(freq=880, dur=0.08, type='sine', vol=0.25){
    if(!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type=type; o.frequency.value=freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime+dur);
  }
  function dig(){ if(!ctx) return;
    const b = ctx.createBufferSource(); const buf = ctx.createBuffer(1, ctx.sampleRate*0.22, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*Math.pow(1-i/d.length,1.6);
    b.buffer=buf;
    const f = ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=600;
    const g = ctx.createGain(); g.gain.value=0.5;
    b.connect(f); f.connect(g); g.connect(master); b.start(); }
  function coin(){ blip(1720,0.12,'triangle',0.3); setTimeout(()=>blip(2140,0.18,'triangle',0.22), 60); }
  function bucketFanfare(){ [660,880,1100,1320].forEach((f,i)=>setTimeout(()=>blip(f,0.22,'triangle',0.28), i*110)); }
  function squawk(){ blip(1450,0.1,'sawtooth',0.32); setTimeout(()=>blip(1150,0.14,'sawtooth',0.3),90); setTimeout(()=>blip(1600,0.09,'sawtooth',0.26),200); }
  function bad(){ blip(220,0.3,'square',0.25); setTimeout(()=>blip(160,0.4,'square',0.22),140); }
  return { resume, detectorTone, stopTone, ambient, blip, dig, coin, bucketFanfare, squawk, bad };
})();

/* ================= SCREENS ================= */
function show(id){ ['title','camp','field'].forEach(s=>$('#'+s).hidden = s!==id); }
function toast(msg, cls=''){
  const t = document.createElement('div'); t.className='toast '+cls; t.textContent=msg;
  $('#toasts').appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .5s'; setTimeout(()=>t.remove(), 500); }, 4200);
}

/* ---------- generic modal ---------- */
function modal({icon, title, body, options}){
  return new Promise(res => {
    $('#modalIcon').textContent = icon||''; $('#modalIcon').style.display = icon? 'flex':'none';
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = body;
    const btns = $('#modalBtns'); btns.innerHTML='';
    options.forEach((o,i)=>{
      const b = document.createElement('button');
      b.className = 'btn' + (o.gold?' gold':'');
      b.innerHTML = o.label; b.disabled = !!o.disabled;
      b.onclick = () => { $('#modal').hidden = true; res(o.key ?? i); };
      btns.appendChild(b);
    });
    $('#modal').hidden = false;
    (btns.querySelector('.gold')||btns.firstChild)?.focus();
  });
}

/* ================= BASE CAMP ================= */
let selectedSite = null;
function repStars(){ return '★'.repeat(Math.max(0,Math.min(5,state.rep))) + '☆'.repeat(5-Math.max(0,Math.min(5,state.rep))); }
function renderCampHeader(){
  $('#campDay').textContent = state.day;
  $('#campSpot').innerHTML = tickerHtml();
  $('#campMoney').textContent = fmt$(state.money);
  $('#campRep').textContent = repStars();
  $('#campFinds').textContent = state.lifetimeFinds;
}
function renderCamp(){
  renderCampHeader(); renderMap(); renderShop(); renderKit(); renderCollection(); renderMissions();
  selectSite(selectedSite || state.location);
  $('#campHint').textContent = 'Detecting from: ' + SITES[state.location].name + ' · ' + SITES[state.location].region;
}

/* ---------- world map ---------- */
const MAP_NODES = {
  au_park:[708,318], au_beach:[762,342], au_gold:[688,362], au_show:[668,300],
  uk_farm:[452,96], uk_green:[430,120], uk_pasture:[470,116],
  us_park:[175,138], us_beach:[214,158], us_battle:[160,172],
};
function renderMap(){
  const svg = $('#worldmap');
  svg.innerHTML =
    '<path class="land" d="M60,90 Q100,55 170,60 Q240,50 260,80 Q290,70 300,100 Q310,140 270,160 Q250,200 210,190 Q170,215 140,185 Q90,180 75,140 Q50,115 60,90 Z"/>' +
    '<path class="land" d="M416,70 Q430,52 448,60 Q470,55 472,80 Q488,95 470,112 Q478,132 458,138 Q436,148 424,130 Q406,120 412,98 Q408,80 416,70 Z"/>' +
    '<path class="land" d="M470,150 Q520,130 560,150 Q610,145 640,175 Q660,210 640,240 Q610,260 580,245 Q540,255 520,225 Q480,210 470,180 Z" opacity="0.5"/>' +
    '<path class="land" d="M640,290 Q690,270 740,285 Q790,290 800,325 Q795,360 750,372 Q700,385 665,365 Q630,345 640,290 Z"/>' +
    '<path class="land" d="M818,352 Q838,342 848,356 Q842,374 822,372 Q810,362 818,352 Z"/>' +
    '<path class="route" d="M708,318 C600,180 520,120 452,96"/>' +
    '<path class="route" d="M452,96 C340,80 250,100 175,138"/>' +
    '<path class="route" d="M175,138 C300,300 550,380 708,318"/>' +
    '<text x="165" y="105" fill="#6e5f42" font-size="13" letter-spacing="3">UNITED STATES</text>' +
    '<text x="405" y="45" fill="#6e5f42" font-size="13" letter-spacing="3">UNITED KINGDOM</text>' +
    '<text x="672" y="410" fill="#6e5f42" font-size="13" letter-spacing="3">AUSTRALIA</text>';
  for(const id of SITE_ORDER){
    const [x,y] = MAP_NODES[id]; const site = SITES[id];
    const cost = travelCost(id);
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('class','mapnode'+(id===selectedSite?' sel':'')+(cost>state.money?' locked':''));
    g.innerHTML =
      '<circle class="pin" cx="'+x+'" cy="'+y+'" r="8"/>' +
      (id===state.location? '<circle cx="'+x+'" cy="'+y+'" r="3.4" fill="#ffd24a"/>' : '') +
      '<text x="'+(x+13)+'" y="'+(y-6)+'">'+site.name+'</text>' +
      '<text class="cost" x="'+(x+13)+'" y="'+(y+9)+'">'+(id===state.location?'HERE':fmt$(cost))+'</text>';
    g.addEventListener('click', ()=>selectSite(id));
    svg.appendChild(g);
  }
}
function selectSite(id){
  selectedSite = id;
  document.querySelectorAll('.mapnode').forEach(n=>n.classList.remove('sel'));
  renderMap();
  const site = SITES[id]; const cost = travelCost(id);
  const badges = [];
  badges.push('<span class="badge">'+site.flag+' '+site.region+'</span>');
  badges.push('<span class="badge">'+({sunrise:'Sunrise',afternoon:'Afternoon',cloudy:'Overcast afternoon',harshnoon:'Harsh midday',goldenhour:'Golden hour',dusk:'Dusk',morning:'Fresh morning'})[site.time]+'</span>');
  if(site.permit) badges.push(state.permits[site.permit]? '<span class="badge good">Miner’s Right ✓</span>' : '<span class="badge warn">Needs Miner’s Right</span>');
  if(site.permission) badges.push(state.farmPermission? '<span class="badge good">Permission ✓</span>' : '<span class="badge warn">Landowner permission needed</span>');
  if(site.prohibited) badges.push('<span class="badge warn">Restricted: '+site.prohibited.label+'</span>');
  if(site.mineralised) badges.push('<span class="badge warn">Hot ground — gold machine advised</span>');
  if(site.soft) badges.push('<span class="badge">'+(site.soft==='plough'?'Heavy walking on the plough':'Soft dry sand — tiring')+'</span>');
  const mission = MISSIONS.find(m=>m.site===id && state.missions[m.id]==='accepted');
  if(mission) badges.push('<span class="badge good">Mission: '+mission.title+'</span>');
  $('#siteInfo').innerHTML =
    '<h2>'+site.name+'</h2><div class="region">'+site.region+' — '+travelLabel(id)+'</div>' +
    '<div class="badges">'+badges.join('')+'</div>' +
    '<p>'+site.desc+'</p>' +
    '<p><b>'+(id===state.location? 'You’re camped here.' : 'Travel: '+fmt$(cost))+'</b>' +
    (cost>state.money? ' <span style="color:#8a2a1a">— you can’t afford this yet.</span>':'') + '</p>';
  const go = $('#btnGo');
  go.disabled = cost>state.money;
  go.textContent = (id===state.location? 'HEAD OUT →' : 'TRAVEL & DETECT → '+(cost?fmt$(cost):''));
}

/* ---------- shop ---------- */
function itemCard(inner){ const d = document.createElement('div'); d.className='card'; d.innerHTML=inner; return d; }
function iconCanvas(item){
  const c = document.createElement('canvas'); c.width=c.height=96;
  WORLD.paintIcon(c, item); return c;
}
function renderShop(){
  const sell = $('#sellList'); sell.innerHTML='';
  sell.insertAdjacentHTML('beforeend', '<div class="dim small" style="margin-bottom:6px">Spot market today: '+tickerHtml()+'</div>');
  const sellables = state.pouch.map((f,i)=>({f,i,src:'pouch'})).concat(state.cabinet.map((f,i)=>({f,i,src:'cabinet'})));
  if(!sellables.length) sell.insertAdjacentHTML('beforeend', '<div class="dim">Nothing to sell. The fields await.</div>');
  let total = 0;
  sellables.forEach(({f,i,src})=>{
    const item = ITEMS[f.key]; const spot = metalMult(f.key); total += f.value*spot;
    const card = itemCard(
      '<div class="c-main"><div class="c-name">'+f.name+(src==='cabinet'?' <span class="dim small">(cabinet)</span>':'')+'</div>' +
      '<div class="c-desc">'+item.kind+' · found day '+f.day+' at '+SITES[f.site].name+'</div></div>' +
      '<div class="c-price">'+fmt$(f.value*spot)+(spot>1.02?' \u25b2':spot<0.98?' \u25bc':'')+'</div>');
    card.prepend(iconCanvas(item));
    const btn = document.createElement('button'); btn.className='btn'; btn.textContent='SELL';
    btn.onclick = ()=>{ sellFind(src,i); };
    card.appendChild(btn);
    if(src==='pouch' && !f.trash){
      const kb = document.createElement('button'); kb.className='btn'; kb.textContent='CABINET';
      kb.title='Keep it in your display cabinet';
      kb.onclick = ()=>{ state.cabinet.push(state.pouch.splice(i,1)[0]); save(); renderShop(); renderCollection(); };
      card.appendChild(kb);
    }
    sell.appendChild(card);
  });
  if(sellables.length>1){
    const all = document.createElement('button'); all.className='btn gold'; all.textContent='SELL EVERYTHING — '+fmt$(total);
    all.onclick = ()=>{ let sum=0;
      const cut = f => f.value * metalMult(f.key) * ((state.farmPermission==='split' && f.site==='uk_farm') ? 0.5 : 1);
      state.pouch.forEach(f=>sum+=cut(f)); state.cabinet.forEach(f=>sum+=cut(f));
      state.money += sum; state.pouch=[]; state.cabinet=[];
      AUDIO.coin(); save(); renderCamp(); toast('Sold the lot for '+fmt$(sum));
    };
    sell.appendChild(all);
  }
  if(state.farmPermission==='split')
    sell.insertAdjacentHTML('beforeend','<div class="dim small">Farmer Giles takes 50% of anything from Wheatfield Farm — a deal’s a deal.</div>');

  const dets = $('#detList'); dets.innerHTML='';
  DETECTOR_ORDER.forEach(id=>{
    const d = DETECTORS[id]; const owned = state.owned[id];
    const card = itemCard(
      '<div class="c-main"><div class="c-name">'+d.brand+' '+d.name+(d.goldOnly?' <span class="dim small">— gold machine</span>':'')+'</div>' +
      '<div class="c-desc">'+d.desc+' <span class="dim">ID '+(d.goldOnly?'none (all-metal)':d.idMin+'–'+d.idMax)+' · ~'+d.depth+' cm on coin</span></div></div>' +
      '<div class="c-price">'+(owned?'OWNED':fmt$(d.price))+'</div>');
    if(owned) card.classList.add('owned');
    if(!owned){
      const b = document.createElement('button'); b.className='btn'; b.textContent='BUY';
      b.disabled = state.money < d.price;
      b.onclick = ()=>{ state.money-=d.price; state.owned[id]=true; state.detector=id; AUDIO.coin(); save(); renderCamp(); toast(d.name+' added to the kit'); };
      card.appendChild(b);
    }
    dets.appendChild(card);
  });

  const tl = $('#toolList'); tl.innerHTML='';
  Object.values(TOOLS).forEach(t0=>{
    const owned = t0.kind==='consumable' ? (state.uses[t0.id]||0) > 0 : state.tools[t0.id];
    if(t0.id==='bigpack' && state.packSlots>6) return;
    const card = itemCard(
      '<div class="c-main"><div class="c-name">'+t0.name+'</div><div class="c-desc">'+t0.desc+
      (t0.slots?' <span class="dim">('+t0.slots+' slot'+(t0.slots>1?'s':'')+')</span>':'')+'</div></div>' +
      '<div class="c-price">'+(owned && t0.kind!=='consumable' ?'OWNED':fmt$(t0.price))+'</div>');
    if(owned && t0.kind!=='consumable') card.classList.add('owned');
    if(!owned || t0.kind==='consumable'){
      const b = document.createElement('button'); b.className='btn';
      b.textContent = t0.kind==='consumable' ? 'BUY'+((state.uses[t0.id]||0)?' (+'+t0.uses+')':'') : 'BUY';
      b.disabled = state.money < t0.price;
      b.onclick = ()=>{
        state.money -= t0.price;
        if(t0.kind==='consumable'){ state.uses[t0.id] = (state.uses[t0.id]||0) + t0.uses; if(!state.loadout.includes(t0.id)) state.loadout.push(t0.id); }
        else if(t0.id==='bigpack'){ state.packSlots = 8; }
        else state.tools[t0.id] = true;
        AUDIO.coin(); save(); renderCamp(); toast(t0.name+' purchased');
      };
      card.appendChild(b);
    }
    tl.appendChild(card);
  });

  const pl = $('#permitList'); pl.innerHTML='';
  Object.values(PERMITS).forEach(p=>{
    const owned = state.permits[p.id];
    const card = itemCard('<div class="c-main"><div class="c-name">'+p.name+'</div><div class="c-desc">'+p.desc+'</div></div>' +
      '<div class="c-price">'+(owned?'HELD':fmt$(p.price))+'</div>');
    if(owned) card.classList.add('owned');
    else { const b=document.createElement('button'); b.className='btn'; b.textContent='BUY';
      b.disabled = state.money<p.price;
      b.onclick=()=>{ state.money-=p.price; state.permits[p.id]=true; save(); renderCamp(); toast(p.name+' issued'); };
      card.appendChild(b); }
    pl.appendChild(card);
  });
}
function sellFind(src, idx){
  const arr = src==='pouch'? state.pouch : state.cabinet;
  const f = arr.splice(idx,1)[0];
  let v = f.value * metalMult(f.key);
  if(state.farmPermission==='split' && f.site==='uk_farm'){ v = v/2; }
  state.money += v; AUDIO.coin(); save(); renderCamp();
  toast('Sold '+f.name+' for '+fmt$(v));
}

/* ---------- kit ---------- */
function loadoutSlots(){
  return state.loadout.reduce((a,id)=> a + (TOOLS[id]? TOOLS[id].slots : 0), 0);
}
function renderKit(){
  const kd = $('#kitDetector'); kd.innerHTML='';
  DETECTOR_ORDER.filter(id=>state.owned[id]).forEach(id=>{
    const d = DETECTORS[id];
    const card = itemCard('<div class="c-main"><div class="c-name">'+d.brand+' '+d.name+'</div>' +
      '<div class="c-desc">ID '+(d.goldOnly?'all-metal, no ID':d.idMin+' to '+d.idMax)+' · ~'+d.depth+' cm · gold sensitivity '+
      (d.gold>=2?'excellent':d.gold>=0.35?'fair':'poor')+'</div></div>');
    if(id===state.detector) card.classList.add('equipped');
    const b = document.createElement('button'); b.className='btn';
    b.textContent = id===state.detector? 'IN HAND' : 'EQUIP';
    b.disabled = id===state.detector;
    b.onclick = ()=>{ state.detector=id; save(); renderKit(); };
    card.appendChild(b); kd.appendChild(card);
  });
  const kp = $('#kitPack'); kp.innerHTML='';
  $('#kitSlots').textContent = '('+loadoutSlots()+'/'+state.packSlots+' slots)';
  Object.values(TOOLS).forEach(t0=>{
    if(t0.kind==='upgrade') return;
    const has = t0.kind==='consumable' ? (state.uses[t0.id]||0)>0 : state.tools[t0.id];
    if(!has) return;
    const inPack = state.loadout.includes(t0.id);
    const card = itemCard('<div class="c-main"><div class="c-name">'+t0.name+
      (t0.kind==='consumable'?' <span class="dim small">×'+state.uses[t0.id]+'</span>':'')+'</div>' +
      '<div class="c-desc">'+(t0.kind==='digger'?'Digs ~'+t0.dig+' cm per effort':t0.desc)+' · '+t0.slots+' slot'+(t0.slots>1?'s':'')+'</div></div>');
    if(inPack) card.classList.add('equipped');
    const b = document.createElement('button'); b.className='btn';
    b.textContent = inPack? 'PACKED ✓' : 'PACK';
    b.onclick = ()=>{
      if(inPack) state.loadout = state.loadout.filter(x=>x!==t0.id);
      else {
        if(loadoutSlots()+t0.slots > state.packSlots){ toast('Backpack is full — '+state.packSlots+' slots', 'bad'); return; }
        state.loadout.push(t0.id);
      }
      save(); renderKit();
    };
    card.appendChild(b); kp.appendChild(card);
  });
}

/* ---------- collection ---------- */
function renderCollection(){
  const bl = $('#bucketList'); bl.innerHTML='';
  BUCKET.forEach(b=>{
    const done = state.bucket[b.id];
    bl.insertAdjacentHTML('beforeend',
      '<div class="b-item'+(done?' done':'')+'"><span class="b-check">'+(done?'[✓]':'[ ]')+'</span>' +
      '<span class="b-main"><span class="b-label">'+b.label+'</span><span class="b-where">'+b.where+'</span></span></div>');
  });
  const cab = $('#cabinet'); cab.innerHTML='';
  if(!state.cabinet.length) cab.innerHTML='<div class="dim">Empty shelves. Keep something special from the shop screen.</div>';
  state.cabinet.forEach(f=>{
    const item = ITEMS[f.key];
    const card = itemCard('<div class="c-main"><div class="c-name">'+f.name+'</div>' +
      '<div class="c-desc">Day '+f.day+' — '+SITES[f.site].name+'</div></div><div class="c-price">'+fmt$(f.value)+'</div>');
    card.prepend(iconCanvas(item));
    cab.appendChild(card);
  });
}

/* ---------- missions ---------- */
function renderMissions(){
  const mb = $('#missionBoard'); mb.innerHTML='';
  MISSIONS.forEach(m=>{
    const st = state.missions[m.id] || 'open';
    const note = document.createElement('div');
    note.className = 'note '+(st==='accepted'?'accepted':st==='done'?'completed':'');
    note.innerHTML = '<h4>'+m.title+'</h4><div class="n-post">'+m.post+'</div>' +
      '<div class="n-meta"><span>'+SITES[m.site].flag+' '+SITES[m.site].name+' · reward '+fmt$(m.reward)+'</span></div>';
    if(st==='open'){
      const b = document.createElement('button'); b.className='btn'; b.textContent='TAKE IT ON';
      b.onclick = ()=>{ state.missions[m.id]='accepted'; save(); renderMissions();
        modal({icon:'🤝', title:m.title, body:'<div class="quote">'+m.accept+'</div>', options:[{label:'On it', gold:true}]}); };
      note.querySelector('.n-meta').appendChild(b);
    } else if(st==='accepted'){
      note.querySelector('.n-meta').insertAdjacentHTML('beforeend','<span style="color:#41501f;font-weight:700">ACCEPTED</span>');
    }
    mb.appendChild(note);
  });
}

/* camp tabs */
document.querySelectorAll('.camp-tabs .tab').forEach(t=>{
  t.addEventListener('click', ()=>{
    document.querySelectorAll('.camp-tabs .tab').forEach(x=>x.classList.toggle('active', x===t));
    document.querySelectorAll('.tabpane').forEach(p=>p.classList.toggle('active', p.id==='tab-'+t.dataset.tab));
  });
});

/* ================= FIELD (3D) ================= */
let renderer=null, scene=null, camera=null, world=null, siteObj=null;
let running=false, locked=false, yaw=0, pitch=0;
const keys = {};
let player = { x:0, z:0, stamina:100, pouch:0 };
let targets = [];       // {x,z,depth,key,dug,mission}
let holes = null;
let detectorModel = null;
let npc = null;         // active event npc {obj, kind, t, phase}
let bird = null;
let snakeObj = null;
let clock = null;
let signal = { strength:0, cond:0, fe:false, target:null, jit:0 };
let pinpoint = false;
let flagTime = 0;       // time spent detecting in prohibited zone
let sessionFinds = [], sessionSpend = 0, sessionEarn = 0;
let eventTimer = 18;
let hintTimer = 0;
let permissionActive = true; // uk farm gate

function trip(){ return { site: SITES[state.location] }; }

function initRenderer(){
  if(renderer) return;
  renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias:true });
  renderer.setPixelRatio(Math.min(IS_TOUCH ? 1.6 : 2, window.devicePixelRatio||1));
  clock = new THREE.Clock();
  window.addEventListener('resize', sizeRenderer);
  sizeRenderer();
}
function sizeRenderer(){
  if(!renderer) return;
  renderer.setSize(window.innerWidth, window.innerHeight);
  if(camera){ camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); }
}

function enterField(){
  const site = SITES[state.location];
  initRenderer();
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(72, window.innerWidth/window.innerHeight, 0.05, 400);
  world = WORLD.buildSite(site, scene);
  holes = new THREE.Group(); scene.add(holes);
  // player start
  player.x = 0; player.z = 60; yaw = Math.PI; pitch = -0.1;
  if(site.id==='uk_farm' && !state.farmPermission){ player.x=-66.5; player.z=46; yaw = 2.6; }
  player.stamina = 100;
  permissionActive = !(site.permission && !state.farmPermission);
  signal.strength = 0; signal.target = null; pinpoint = false;
  lastGood.target = null; lastGood.t = -9; coilWorld.ok = false; swingPhase = 0; swingAmp = 0;
  // detector viewmodel
  detectorModel = WORLD.makeDetectorModel(0xc9a227);
  camera.add(detectorModel);
  scene.add(camera);
  coilShadow = makeCoilShadow();
  scene.add(coilShadow);
  // targets
  seedTargets(site);
  // mission flag
  const mission = MISSIONS.find(m=>m.site===site.id && state.missions[m.id]==='accepted');
  if(mission && mission.zone && site['_'+mission.zone]){
    const p = site['_'+mission.zone];
    const flag = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,2.4,6), new THREE.MeshLambertMaterial({color:0xdddddd}));
    pole.position.y=1.2; flag.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.8,0.5), new THREE.MeshLambertMaterial({color:0xc8452f, side:THREE.DoubleSide}));
    cloth.position.set(0.4,2.1,0); flag.add(cloth);
    flag.position.set(p.x, world.heightAt(p.x,p.z), p.z);
    scene.add(flag);
  }
  // HUD
  $('#hudSite').textContent = site.name;
  $('#hudTime').textContent = site.region + ' · ' + ({sunrise:'dawn',afternoon:'afternoon',cloudy:'overcast',harshnoon:'midday',goldenhour:'golden hour',dusk:'dusk',morning:'morning'})[site.time];
  $('#hudCash').textContent = Math.round(state.money);
  const det = DETECTORS[state.detector];
  $('#detBrand').textContent = det.brand; $('#detModel').textContent = det.name;
  $('#detLcd').hidden = !!det.goldOnly; $('#detGold').hidden = !det.goldOnly;
  const lcd = $('#detLcd');
  lcd.classList.toggle('backlit', det.screen==='lcd-back');
  lcd.classList.toggle('lcd2d', det.screen==='lcd-2d');
  $('#lcdMode').textContent = ({park:'PARK',uspark:'PARK',green:'PARK',beach:'BEACH',farm:'FIELD',goldfields:'GOLD'})[site.terrain]||'ALL';
  const scale = $('#lcdScale'); scale.innerHTML='';
  for(let i=0;i<30;i++) scale.appendChild(document.createElement('i'));
  $('#lcd2dMap').hidden = det.screen !== 'lcd-2d';
  idmapPts = [];
  buildCompass();
  updatePouchHud();
  sessionFinds=[]; sessionEarn=0; sessionSpend=0; flagTime=0; eventTimer = 26+Math.random()*20;
  npc=null; bird=null; snakeObj=null;
  const missionEl = $('#hudMission');
  if(mission){ missionEl.hidden=false; missionEl.innerHTML = '<b>'+mission.title+'</b><br>'+(mission.zone?'Search near the red flag.':'Search anywhere on this site.'); }
  else missionEl.hidden = true;
  show('field');
  $('#hud').hidden = false;
  $('#touchui').hidden = !IS_TOUCH;
  pauseTitle('READY', site.desc + (permissionActive? '' : ' — You need permission first: walk to the farmhouse and knock (E at the door).'));
  running = true;
  AUDIO.ambient(site.terrain==='beach'? 0.05 : 0.015);
  if(!animating) animate();
}

function seedTargets(site){
  const rng = WORLD.mulberry32((state.day*2654435761 ^ site.id.length*97) >>> 0);
  targets = [];
  const table = Object.entries(site.finds).filter(([k,w])=>w>0).map(([k,w])=>({k, w:(ITEMS[k].w||1)*w}));
  const totalW = table.reduce((a,t)=>a+t.w,0);
  function pick(){
    let r = rng()*totalW;
    for(const t of table){ r-=t.w; if(r<=0) return t.k; }
    return table[0].k;
  }
  for(let i=0;i<site.targets;i++){
    const key = pick(); const item = ITEMS[key];
    const x = (rng()-0.5)*WORLD.SIZE*0.88, z = (rng()-0.5)*WORLD.SIZE*0.88;
    const depth = item.depth[0] + rng()*(item.depth[1]-item.depth[0]);
    targets.push({ x, z, depth, key, dug:false });
  }
  // guaranteed mission target
  const mission = MISSIONS.find(m=>m.site===site.id && state.missions[m.id]==='accepted');
  if(mission){
    const zone = mission.zone && site['_'+mission.zone];
    const x = zone? zone.x + (rng()-0.5)*14 : (rng()-0.5)*80;
    const z = zone? zone.z + (rng()-0.5)*14 : (rng()-0.5)*80;
    const item = ITEMS[mission.targetItem];
    targets.push({ x, z, depth: item.depth[0]+rng()*6, key:mission.targetItem, dug:false, mission:mission.id });
  }
}

function buildCompass(){
  const pts = ['N','NE','E','SE','S','SW','W','NW'];
  const strip = $('#compassStrip'); strip.innerHTML='';
  for(let r=0;r<3;r++) pts.forEach((p,i)=>{
    const s = document.createElement('span');
    s.textContent = p; if(p.length===1) s.className='card-pt';
    strip.appendChild(s);
  });
}
function updateCompass(){
  const strip = $('#compassStrip');
  const w = 40*8;
  let frac = ((-yaw) % (Math.PI*2) + Math.PI*2) % (Math.PI*2) / (Math.PI*2);
  strip.style.left = (130 - w - frac*w + 20) + 'px';
}

function pauseTitle(t, d){
  $('#pauseTitle').textContent = t; $('#pauseDesc').textContent = d||'';
  $('#fieldPause').hidden = false;
}

/* ---------- pointer lock ---------- */
const glCanvas = $('#gl');
$('#btnResume').addEventListener('click', ()=>{
  AUDIO.resume();
  $('#fieldPause').hidden = true;
  if(!IS_TOUCH) glCanvas.requestPointerLock?.();
  locked = true; // optimistic; fallback drag-look also works
});
document.addEventListener('pointerlockchange', ()=>{
  locked = document.pointerLockElement === glCanvas;
  if(!locked && running && $('#fieldPause').hidden && $('#modal').hidden && $('#digModal').hidden && $('#findModal').hidden && $('#resultsModal').hidden){
    pauseTitle('PAUSED','The kettle’s on. Back out there when you’re ready.');
  }
});
document.addEventListener('mousemove', e=>{
  if(!running || !$('#fieldPause').hidden) return;
  if(document.pointerLockElement===glCanvas || e.buttons===1){
    yaw -= e.movementX*0.0022;
    pitch -= e.movementY*0.0019;
    pitch = Math.max(-1.25, Math.min(0.6, pitch));
  }
});
$('#btnPackUp').addEventListener('click', endSession);

document.addEventListener('keydown', e=>{
  keys[e.code]=true;
  if(e.code==='Tab'){ e.preventDefault();
    if(running && $('#fieldPause').hidden){ document.exitPointerLock?.(); pauseTitle('PAUSED','The kettle’s on.'); }
  }
  if(!running || !$('#fieldPause').hidden) return;
  const modalOpen = !$('#modal').hidden || !$('#digModal').hidden || !$('#findModal').hidden || !$('#resultsModal').hidden;
  if(boxing){
    if(!modalOpen && boxing.phase==='telegraph'){
      if(e.code==='Digit1'||e.code==='KeyJ'){ boxing.picked='jab'; updateBoxHud(); }
      if(e.code==='Digit2'||e.code==='KeyB'){ boxing.picked='block'; updateBoxHud(); }
      if(e.code==='Digit3'||e.code==='KeyD'){ boxing.picked='duck'; updateBoxHud(); }
    }
    return;
  }
  if(e.code==='ShiftLeft'||e.code==='ShiftRight') pinpoint = true;
  if(modalOpen) return;
  if(e.code==='KeyE') tryInteract();
  if(e.code==='KeyR') eat();
  if(e.code==='KeyH'){ document.exitPointerLock?.(); endSession(); }
});
document.addEventListener('keyup', e=>{
  keys[e.code]=false;
  if(e.code==='ShiftLeft'||e.code==='ShiftRight') pinpoint = false;
});

function eat(){
  for(const id of ['thermos','snacks']){
    if(state.loadout.includes(id) && (state.uses[id]||0)>0){
      state.uses[id]--; player.stamina = Math.min(100, player.stamina + TOOLS[id].restore);
      toast(id==='snacks'? 'Muesli bar demolished. +'+TOOLS[id].restore+' stamina' : 'Hot sweet tea. +'+TOOLS[id].restore+' stamina');
      AUDIO.blip(520,0.1,'sine',0.2); save(); return;
    }
  }
  toast('Nothing to eat — pack snacks at base camp', 'bad');
}

/* ---------- interaction (dig / knock) ---------- */
function tryInteract(){
  const site = SITES[state.location];
  // farmhouse knock
  if(site.permission && !state.farmPermission && world.interactives.farmhouseDoor){
    const d = world.interactives.farmhouseDoor;
    if(Math.hypot(player.x-d.x, player.z-d.z) < 8){ farmerDialogue(); return; }
  }
  if(!permissionActive){ toast('You don’t have permission to detect here yet', 'bad'); return; }
  const t = diggableTarget();
  if(t) startDig(t);
  else toast('No target under the coil — get a repeatable signal first');
}

/* ---------- detection core ---------- */
let swingPhase = 0, swingAmp = 0, coilGap = 0;
let coilShadow = null;
const coilWorld = { x:0, z:0, ok:false };
const _coilV = new THREE.Vector3(), _upV = new THREE.Vector3();
const _qInv = new THREE.Quaternion();
const lastGood = { target:null, t:-9 };
function makeCoilShadow(){
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64,64,8,64,64,64);
  gr.addColorStop(0,'rgba(0,0,0,0.85)'); gr.addColorStop(0.55,'rgba(0,0,0,0.5)'); gr.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0,0,128,128);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1,1),
    new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(c), transparent:true, opacity:0.4, depthWrite:false }));
  mesh.rotation.x = -Math.PI/2;
  mesh.renderOrder = 2;
  return mesh;
}
function coilPoint(){
  if(coilWorld.ok) return coilWorld;
  return { x: player.x + Math.sin(yaw)*-1.55, z: player.z + Math.cos(yaw)*-1.55 };
}
// a target stays "diggable" briefly after the coil sweeps past it
function diggableTarget(){
  if(signal.target && signal.strength>0.12) return signal.target;
  if(lastGood.target && !lastGood.target.dug && clock && (clock.elapsedTime - lastGood.t) < 1.1) return lastGood.target;
  return null;
}
function updateDetection(dt){
  const det = DETECTORS[state.detector];
  const site = SITES[state.location];
  signal.strength = 0; signal.target = null;
  if(!permissionActive){ AUDIO.stopTone(); return; }
  const cp = coilPoint();
  let best = 0, bestT = null;
  const mineralPenalty = (site.mineralised && !det.goldOnly) ? 0.6 : 1;
  for(const t of targets){
    if(t.dug) continue;
    const item = ITEMS[t.key];
    const sizeF = (item.icon==='coinbig'||item.icon==='shoe'||item.icon==='pick')?1.35:1;
    let effMax = det.depth * sizeF * mineralPenalty;
    if(item.kind==='gold') effMax = det.depth * det.gold * sizeF;
    else if(det.goldOnly) effMax = det.depth * 1.1 * sizeF; // all-metal hears everything shallow
    // air gap under the coil costs depth almost 1:1 — swing low
    const effDepth = t.depth + Math.min(80, coilGap*100)*0.9;
    if(effDepth > effMax) continue;
    const depthFrac = effDepth/effMax;
    const r = (pinpoint? 0.5 : 0.95) * (1.15 - depthFrac*0.55);
    const dist = Math.hypot(cp.x-t.x, cp.z-t.z);
    if(dist < r){
      const s = (1-dist/r) * (0.45 + 0.55*(1-depthFrac));
      if(s>best){ best=s; bestT=t; }
    }
  }
  // ground noise on hot ground
  if(site.mineralised && !det.goldOnly && Math.random()<dt*1.6){
    best = Math.max(best, 0.1+Math.random()*0.12);
    if(!bestT) { signal.cond = Math.random()*20; signal.fe = Math.random()<0.5; }
  }
  if(bestT){
    const item = ITEMS[bestT.key];
    signal.cond = item.cond; signal.fe = !!item.fe;
    signal.jit = (item.jit||1) + (1-best)*7 + (bestT.depth/det.depth)*4;
  }
  signal.strength = best; signal.target = bestT;
  if(bestT && best>0.12){ lastGood.target = bestT; lastGood.t = clock.elapsedTime; }
  AUDIO.detectorTone(best, signal.cond, signal.fe, dt, pinpoint);
  updateLcd(det);
}
let lcdHold = 0, lcdShown = '--';
// 2D ID map: recent target samples, x = conductivity 0..1, y = ferrous score 0..1
let idmapPts = [];
function drawIdMap(activeFrac){
  const cv = $('#lcd2dMap'); if(cv.hidden) return;
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.fillStyle = '#101822'; g.fillRect(0,0,W,H);
  g.strokeStyle = 'rgba(140,170,200,0.16)'; g.lineWidth = 1;
  for(let i=1;i<4;i++){ g.beginPath(); g.moveTo(W*i/4,0); g.lineTo(W*i/4,H); g.stroke(); }
  g.beginPath(); g.moveTo(0,H*0.45); g.lineTo(W,H*0.45); g.stroke();
  g.fillStyle = 'rgba(224,86,63,0.5)'; g.font = '8px Arial'; g.fillText('FE', 4, 10);
  g.fillStyle = 'rgba(120,208,240,0.55)'; g.fillText('0', 4, H-4); g.fillText('99', W-14, H-4);
  if(activeFrac !== null && signal.target){
    const item = ITEMS[signal.target.key];
    const fs = item.fe ? 0.72 + Math.random()*0.22
             : (item.jit||1) >= 14 ? 0.28 + Math.random()*0.5
             : 0.06 + Math.random()*0.14;
    idmapPts.push({ x: activeFrac, y: fs });
    if(idmapPts.length > 55) idmapPts.shift();
  } else if(idmapPts.length && Math.random() < 0.06) idmapPts.shift();
  idmapPts.forEach((p,i)=>{
    const a = 0.15 + 0.85*(i/idmapPts.length);
    g.fillStyle = p.y > 0.45 ? 'rgba(224,86,63,'+a+')' : 'rgba(120,208,240,'+a+')';
    // ferrous plots in the upper FE band, clean conductors along the bottom
    g.beginPath(); g.arc(6 + p.x*(W-12), 6 + (1-p.y)*(H-12), i === idmapPts.length-1 ? 3.2 : 2, 0, 7); g.fill();
  });
  if(idmapPts.length){
    const last = idmapPts[idmapPts.length-1];
    g.strokeStyle = 'rgba(233,224,200,0.5)';
    g.beginPath(); g.moveTo(6 + last.x*(W-12), 0); g.lineTo(6 + last.x*(W-12), H); g.stroke();
  }
}
function updateLcd(det){
  const lcdId = $('#lcdId');
  if(det.goldOnly){
    $('#goldNeedle').style.setProperty('--sig', signal.strength.toFixed(2));
    return;
  }
  lcdHold -= 1;
  if(signal.strength>0.06 && signal.target){
    if(lcdHold<=0){
      const item = ITEMS[signal.target.key];
      let id;
      if(item.fe){
        id = det.idMin < 0 ? -(2 + Math.round(Math.random()* Math.min(7,-det.idMin-1))) : Math.round(Math.random()*4);
      } else {
        const span = det.idMax - Math.max(0,det.idMin);
        id = Math.round((item.cond/99)*span + Math.max(0,det.idMin));
        id += Math.round((Math.random()-0.5)*2*signal.jit*(span/40));
        id = Math.max(det.idMin, Math.min(det.idMax, id));
      }
      lcdShown = id; lcdHold = 4 + Math.random()*5;
    }
    const frac = Math.max(0, Math.min(1, (Number(lcdShown)-det.idMin)/(det.idMax-det.idMin)));
    if(det.screen==='lcd-seg'){
      // Vanquish 340: no numeric ID, just a coarse zone readout
      const zones = ['LOW','LOW','MID','MID','HIGH','TOP'];
      lcdId.textContent = signal.fe ? 'IRON' : zones[Math.min(5, Math.floor(frac*6))];
      lcdId.classList.add('seg');
    } else {
      lcdId.textContent = lcdShown;
      lcdId.classList.remove('seg');
    }
    lcdId.classList.toggle('iron', !!signal.fe);
    const cells = document.querySelectorAll('#lcdScale i');
    cells.forEach((c,i)=> c.classList.toggle('lit', Math.abs(i/29 - frac) < 0.045));
    $('#lcdCursor').style.setProperty('--x', (frac*100)+'%');
    $('#lcdCursor').style.setProperty('--o', 1);
    if(det.screen==='lcd-2d') drawIdMap(frac);
    // depth bars
    const det0 = DETECTORS[state.detector];
    const dFrac = signal.target ? signal.target.depth/det0.depth : 0;
    document.querySelectorAll('#lcdDepth i').forEach((b,i)=> b.classList.toggle('on', dFrac > i/5));
  } else {
    lcdId.textContent = '--'; lcdId.classList.remove('iron');
    document.querySelectorAll('#lcdScale i').forEach(c=>c.classList.remove('lit'));
    document.querySelectorAll('#lcdDepth i').forEach(b=>b.classList.remove('on'));
    $('#lcdCursor').style.setProperty('--o', 0);
    if(det.screen==='lcd-2d') drawIdMap(null);
  }
  $('#pinpointTag').hidden = !pinpoint;
}

/* ---------- digging ---------- */
let dig = null;
function currentDigger(){
  const site = SITES[state.location];
  let best = null;
  for(const id of state.loadout){
    const t = TOOLS[id];
    if(!t || t.kind!=='digger') continue;
    if(t.beachOnly && site.terrain!=='beach') continue;
    if(!best || t.dig>best.dig) best = t;
  }
  return best || TOOLS.trowel;
}
function startDig(target){
  const site = SITES[state.location];
  if(world.inProhibited(player.x, player.z)){
    toast('You really shouldn’t dig here…', 'bad'); flagTime += 8;
  }
  // snake ambush in goldfields
  if(site.hazards?.includes('snake') && Math.random()<0.09){
    snakeEvent(); return;
  }
  document.exitPointerLock?.();
  const tool = currentDigger();
  dig = { target, cm:0, tool, misses:0 };
  $('#digInfo').textContent = 'Using the '+tool.name.toLowerCase()+'.';
  $('#digStam').textContent = 'Stamina '+Math.round(player.stamina);
  $('#digTarget').style.top = '';
  updateDigVisual();
  $('#digModal').hidden = false;
  $('#btnDigMore').focus();
}
function updateDigVisual(){
  const t = dig.target;
  const pct = Math.min(1, dig.cm / t.depth);
  const line = $('#digDepthLine');
  line.style.top = (14 + pct*150) + 'px';
  line.dataset.cm = Math.round(dig.cm)+' cm';
  const tgt = $('#digTarget');
  tgt.style.top = (14 + 150*Math.min(1,t.depth/40) + 8) + 'px';
  const hasPP = state.loadout.includes('pinpointer') && state.tools.pinpointer;
  tgt.textContent = hasPP ? '◉' : '?';
  tgt.style.opacity = hasPP ? 1 : 0.35;
}
$('#btnDigMore').addEventListener('click', digMore);
document.addEventListener('keydown', e=>{ if(e.code==='KeyE' && !$('#digModal').hidden) digMore(); });
function digMore(){
  if(!dig) return;
  AUDIO.dig();
  const site = SITES[state.location];
  const sandy = site.terrain==='beach';
  let cm = dig.tool.dig * (0.8+Math.random()*0.4) * (sandy?1.25:1);
  const hasPP = state.loadout.includes('pinpointer') && state.tools.pinpointer;
  const stamCost = 2.2 + dig.tool.dig*0.09;
  player.stamina = Math.max(0, player.stamina - stamCost);
  // without a pinpointer you sometimes lose the target in the spoil
  if(!hasPP && dig.cm + cm >= dig.target.depth && Math.random()<0.4 && dig.misses<2){
    dig.misses++; dig.cm = Math.max(0, dig.target.depth - 3 - Math.random()*4);
    $('#digInfo').textContent = 'It’s in the spoil somewhere… (a pinpointer would help)';
  } else {
    dig.cm += cm;
  }
  $('#digStam').textContent = 'Stamina '+Math.round(player.stamina);
  updateDigVisual();
  if(player.stamina<=0){
    $('#digModal').hidden = true; dig=null;
    toast('You’re knackered. Eat something or head home.', 'bad');
    return;
  }
  if(dig.cm >= dig.target.depth){
    const t = dig.target; dig=null;
    $('#digModal').hidden = true;
    reveal(t);
  }
}
$('#btnDigStop').addEventListener('click', ()=>{ $('#digModal').hidden = true; dig=null; pauseTitle('PAUSED','You back-filled the hole and had a think.'); });

/* ---------- find reveal ---------- */
let revealTarget = null;
function reveal(t){
  const item = ITEMS[t.key];
  t.dug = true;
  const h = WORLD.makeHole();
  h.position.set(t.x, world.heightAt(t.x,t.z)+0.02, t.z);
  holes.add(h);
  const mission = t.mission && MISSIONS.find(m=>m.id===t.mission);
  const name = mission?.renameFind || item.name;
  const value = mission ? 0 : +(item.val[0] + Math.random()*(item.val[1]-item.val[0])).toFixed(2);
  revealTarget = { t, item, name, value, mission };
  $('#findKind').textContent = mission? 'MISSION FIND' : item.kind.toUpperCase();
  WORLD.paintIcon($('#findIcon'), item);
  $('#findName').textContent = name;
  $('#findBlurb').textContent = item.blurb;
  $('#findMeta').innerHTML = '<span>DEPTH <b>'+Math.round(t.depth)+' cm</b></span>' +
    '<span>VALUE <b>'+(mission? 'priceless' : (item.kind==='trash'&&!value ? 'nil' : fmt$(value)))+'</b></span>';
  $('#btnKeep').textContent = item.kind==='trash' && !value ? 'POCKET IT ANYWAY' : 'POUCH IT';
  if(item.kind==='trash') AUDIO.blip(240,0.15,'square',0.18); else AUDIO.coin();
  $('#findModal').hidden = false;
  $('#btnKeep').focus();
}
$('#btnKeep').addEventListener('click', ()=>{ finishReveal('keep'); });
$('#btnBin').addEventListener('click', ()=>{ finishReveal('bin'); });
$('#btnLeave').addEventListener('click', ()=>{ finishReveal('leave'); });
function finishReveal(action){
  $('#findModal').hidden = true;
  const { t, item, name, value, mission } = revealTarget; revealTarget=null;
  if(mission){
    state.missions[mission.id]='done';
    state.money += mission.reward; sessionEarn += mission.reward;
    state.rep = Math.min(5, state.rep + mission.rep);
    AUDIO.bucketFanfare();
    modal({icon:'🏅', title:'Mission complete — '+mission.title,
      body:'<div class="quote">'+mission.done+'</div><p>Reward: <b>'+fmt$(mission.reward)+'</b> · Reputation up.</p>',
      options:[{label:'Beautiful', gold:true}]});
    sessionFinds.push({name, value:mission.reward, kind:'mission'});
    state.lifetimeFinds++;
    save(); updatePouchHud(); return;
  }
  if(action==='keep'){
    if(state.pouch.length >= 12){ toast('Finds pouch is full!', 'bad'); }
    else {
      state.pouch.push({ key:t.key, name, value, site:state.location, day:state.day, trash:item.kind==='trash' });
      sessionFinds.push({name, value, kind:item.kind});
      state.lifetimeFinds++;
      // bucket list
      if(item.bucket && !state.bucket[item.bucket]){
        state.bucket[item.bucket]=true;
        AUDIO.bucketFanfare();
        toast('BUCKET LIST ✓ — '+BUCKET.find(b=>b.id===item.bucket).label, 'bucket');
      } else if(item.rare){ AUDIO.bucketFanfare(); }
    }
  } else if(action==='bin'){
    state.tidy++;
    if(state.tidy % 6 === 0 && state.rep<5){ state.rep++; toast('Word gets around: you leave sites cleaner than you found them. Reputation up ★'); }
    else toast('Binned. Tidy detectorist, welcome detectorist.');
    sessionFinds.push({name, value:0, kind:'binned'});
  } else {
    toast('Left in the spoil. Not our finest hour.', 'bad');
  }
  save(); updatePouchHud();
  pauseTitle('NICE DIG','Plug back in, boot flat, on to the next signal.');
}
function updatePouchHud(){
  $('#hudPouch').textContent = state.pouch.length+'/12';
  $('#hudCash').textContent = Math.round(state.money);
}

/* ---------- NPC events ---------- */
function scheduleEvents(dt){
  const site = SITES[state.location];
  if(!site.hazards || npc || bird || !permissionActive) return;
  eventTimer -= dt;
  if(eventTimer>0) return;
  eventTimer = 30 + Math.random()*35;
  const pool = site.hazards.filter(h=>{
    if(h==='ranger') return true;
    if(h==='karen') return true;
    if(h==='magpie'||h==='seagull') return true;
    if(h==='tractor') return true;
    return false;
  });
  // weighted: prohibited-zone flagging summons the ranger
  let kind = pool[Math.random()*pool.length|0];
  if(flagTime>6 && site.hazards.includes('ranger')) kind = 'ranger';
  if(kind==='snake') return;
  if(kind==='magpie' || kind==='seagull'){ birdEvent(kind); return; }
  if(kind==='tractor'){ toast(DIALOGUE.tractor); return; }
  spawnWalker(kind);
}
function spawnWalker(kind, forceMale){
  const male = kind==='karen' && (forceMale!==undefined ? forceMale : Math.random()<0.5);
  const opts = kind==='karen'
    ? (male
        ? { shirt:0x3a5a8a, pants:0xc9bda0, hair:0x8a8478, hat:'cap', sunnies:true, phone:true }
        : { shirt:0xd88ba8, pants:0xe8e2d2, hair:0xd9c23f, sunnies:true, handbag:true, phone:true })
    : { shirt:0x6b7a45, pants:0x4a4438, hat:'ranger' };
  const obj = WORLD.makePerson(opts);
  const ang = Math.random()*Math.PI*2;
  obj.position.set(player.x+Math.sin(ang)*26, 0, player.z+Math.cos(ang)*26);
  scene.add(obj);
  npc = { obj, kind, t:0, walking:true, male };
}
function updateNpc(dt){
  if(!npc) return;
  const o = npc.obj;
  o.position.y = world.heightAt(o.position.x, o.position.z);
  if(npc.walking){
    const dx = player.x-o.position.x, dz = player.z-o.position.z;
    const d = Math.hypot(dx,dz);
    o.rotation.y = Math.atan2(dx,dz);
    if(d>2.6){
      const sp = npc.kind==='karen'? 2.6 : 2.1;
      o.position.x += dx/d*sp*dt; o.position.z += dz/d*sp*dt;
      npc.t += dt*9;
      const L = o.userData.limbs;
      L.lLeg.rotation.x = Math.sin(npc.t)*0.55; L.rLeg.rotation.x = -Math.sin(npc.t)*0.55;
      L.lArm.rotation.x = -Math.sin(npc.t)*0.4;
      if(npc.kind!=='karen') L.rArm.rotation.x = Math.sin(npc.t)*0.4;
    } else {
      npc.walking = false;
      if(npc.kind==='karen') karenDialogue();
      else rangerDialogue();
    }
  }
}
function removeNpc(){ if(npc){ scene.remove(npc.obj); npc=null; } }

/* ---------- in-world boxing (Kevins only) ---------- */
let boxing = null, playerGloves = null, boxDuck = 0;
function heartsRow(hp){
  let s = '';
  for(let i=0;i<3;i++) s += i < Math.ceil(hp) ? '\u2764\ufe0f' : '\ud83d\udda4';
  return s;
}
function updateBoxHud(msg){
  if(!boxing) return;
  $('#boxYou').innerHTML = '\ud83e\udd4a YOU &nbsp;' + heartsRow(boxing.you);
  $('#boxHer').innerHTML = heartsRow(boxing.her) + ' &nbsp;KEVIN \ud83e\udd4a';
  const cueText = { hay:'HUGE wind-up \u2014 haymaker coming!', jab:'Quick jabs incoming!', guard:'He\u2019s covered up\u2026' };
  $('#boxCue').textContent = msg !== undefined ? msg
    : boxing.phase==='telegraph' ? (cueText[boxing.cue] + (boxing.picked? '  [' + boxing.picked.toUpperCase() + ' ready]' : ''))
    : '';
}
async function karenBoxing(){
  const wasMale = npc && npc.male;
  await modal({ icon:'\ud83e\udd4a', title:'Queensberry rules',
    body:'<p>He fetches two pairs of ancient boxing gloves from the ute \u2014 of course he has them. A dog walker agrees, reluctantly, to hold his phone.</p>' +
    '<p class="dim small">Watch his wind-up, then <b>1</b> JAB \u00b7 <b>2</b> BLOCK \u00b7 <b>3</b> DUCK</p>',
    options:[{label:'Gloves up', gold:true}]});
  // stage the opponent squared up in front of you
  const o = npc.obj;
  const fx = player.x + Math.sin(yaw)*-2.4, fz = player.z + Math.cos(yaw)*-2.4;
  o.position.set(fx, world.heightAt(fx,fz), fz);
  WORLD.addNpcGloves(o);
  playerGloves = WORLD.makePlayerGloves();
  camera.add(playerGloves);
  if(detectorModel) detectorModel.visible = false;
  if(coilShadow) coilShadow.visible = false;
  AUDIO.stopTone();
  $('#boxhud').hidden = false;
  boxing = { you:3, her:3, phase:'pre', t:0, cue:null, picked:null, anim:null, male:wasMale, done:null };
  updateBoxHud('Round 1');
  return new Promise(res => { boxing.done = res; });
}
function resolveBoxingRound(){
  const B = boxing; const pick = B.picked;
  let msg = '';
  if(B.cue==='hay'){
    if(pick==='duck'){ B.her -= 2; B.anim='duck'; msg = 'You duck the haymaker and counter! He spins like a ute door in the wind.'; }
    else if(pick==='block'){ B.you -= 0.5; B.anim='block'; msg = 'Blocked \u2014 your forearm files a complaint.'; }
    else if(pick==='jab'){ B.you -= 1; B.her -= 1; B.anim='jab'; msg = 'You trade blows. A kookaburra laughs.'; }
    else { B.you -= 1.5; B.anim='hit'; msg = 'The haymaker lands flush. You see sponsorship logos.'; }
  } else if(B.cue==='jab'){
    if(pick==='block'){ B.her -= 1; B.anim='block'; msg = 'Caught it on the glove and countered. Textbook.'; }
    else if(pick==='duck'){ B.you -= 1; B.anim='hit'; msg = 'You duck straight into it. Rookie error.'; }
    else if(pick==='jab'){ B.you -= 0.5; B.her -= 0.5; B.anim='jab'; msg = 'A scrappy exchange. The labrador looks away.'; }
    else { B.you -= 1; B.anim='hit'; msg = 'Jab, jab \u2014 both land. Wake up!'; }
  } else {
    if(pick==='jab'){ B.her -= 1; B.anim='jab'; msg = 'You jab straight through the guard.'; }
    else if(pick==='duck'){ B.anim='duck'; msg = 'You duck under\u2026 nothing. He looks confused.'; }
    else { B.anim='block'; msg = 'You both stand there defending. Gripping stuff.'; }
  }
  if(B.anim==='hit'){ AUDIO.blip(110,0.16,'square',0.35); $('#flash').style.opacity = 0.3; setTimeout(()=>$('#flash').style.opacity=0, 160); }
  else if(B.her < B.herBefore) AUDIO.blip(180,0.1,'square',0.28);
  player.stamina = Math.max(0, player.stamina - 5);
  B.phase = 'resolve'; B.t = 0;
  updateBoxHud(msg);
}
function updateBoxing(dt){
  const B = boxing; if(!B || !npc) return;
  B.t += dt;
  const o = npc.obj;
  o.position.y = world.heightAt(o.position.x, o.position.z);
  o.rotation.y = Math.atan2(player.x - o.position.x, player.z - o.position.z);
  const L = o.userData.limbs;
  if(B.phase==='pre'){
    L.rArm.rotation.x += (-0.4 - L.rArm.rotation.x)*dt*5;
    L.lArm.rotation.x += (-0.4 - L.lArm.rotation.x)*dt*5;
    if(B.t > 0.75){
      B.phase='telegraph'; B.t=0; B.picked=null; B.herBefore=B.her;
      B.cue = ['hay','jab','guard'][Math.random()*3|0];
      AUDIO.blip(660,0.07,'square',0.16);
      updateBoxHud();
    }
  } else if(B.phase==='telegraph'){
    if(B.cue==='hay'){ L.rArm.rotation.x += (-2.5 - L.rArm.rotation.x)*dt*3.5; L.rArm.rotation.z = -0.4; }
    else if(B.cue==='jab'){ L.lArm.rotation.x += (-1.3 - L.lArm.rotation.x)*dt*8; L.lArm.rotation.x += Math.sin(B.t*18)*0.04; }
    else { L.lArm.rotation.x += (-1.7 - L.lArm.rotation.x)*dt*6; L.rArm.rotation.x += (-1.7 - L.rArm.rotation.x)*dt*6; }
    if(B.t > 1.35) resolveBoxingRound();
  } else if(B.phase==='resolve'){
    const p = Math.min(1, B.t/0.45);
    const lunge = Math.sin(p*Math.PI);
    if(playerGloves){
      const G = playerGloves.userData;
      G.l.position.set(-0.22,-0.3,-0.58); G.r.position.set(0.22,-0.3,-0.58);
      if(B.anim==='jab') G.r.position.z = -0.58 - lunge*0.6;
      if(B.anim==='block'){ G.l.position.set(-0.12,-0.3+lunge*0.18,-0.52); G.r.position.set(0.12,-0.3+lunge*0.18,-0.52); }
    }
    boxDuck = B.anim==='duck' ? lunge*0.42 : 0;
    // his strike follows through
    const arm = B.cue==='jab' ? L.lArm : L.rArm;
    arm.rotation.x += ((B.cue==='guard'? -1.7 : -1.4+lunge*1.2) - arm.rotation.x)*dt*10;
    if(B.t > 1.0){
      if(B.you <= 0 || B.her <= 0){ endBoxing(B.her <= 0 ? 'win' : 'lose'); }
      else { B.phase='pre'; B.t=0; boxDuck=0; }
    }
  }
}
async function endBoxing(result){
  const done = boxing.done;
  boxing = null; boxDuck = 0;
  $('#boxhud').hidden = true;
  if(playerGloves){ camera.remove(playerGloves); playerGloves = null; }
  if(detectorModel) detectorModel.visible = true;
  if(coilShadow) coilShadow.visible = true;
  removeNpc();
  if(result==='win'){
    state.karensSurvived++;
    if(Math.random() < 0.5){
      await modal({ icon:'\ud83c\udfc6', title:'Winner \u2014 and no footage',
        body:'<p>He sits down heavily on the grass and concedes with a wave. The dog walker, it turns out, filmed forty seconds of the inside of a pocket. No evidence, no witnesses willing to get involved.</p><p class="dim">He retreats to the ute with his dignity lightly used.</p>',
        options:[{label:'Back to the signal', gold:true}]});
    } else {
      await modal({ icon:'\ud83d\ude94', title:'Police follow-up',
        body:'<p>You win on points \u2014 but a constable visits before you\u2019ve refilled your first plug. Affray in a public reserve, both parties cautioned.</p><p><b>Fine: '+fmt$(150)+'</b></p>',
        options:[{label:'Cop it sweet', gold:true}]});
      state.money = Math.max(0, state.money - 150); state.fines++; sessionSpend += 150;
      updatePouchHud(); AUDIO.bad();
    }
  } else {
    await modal({ icon:'\ud83e\udd15', title:'Down for the count',
      body:'<p>The haymaker you never saw. You come to with grass in your mouth and a labrador licking your ear.</p><p class="dim">Stamina is gone. Maybe head home.</p>',
      options:[{label:'Ouch', gold:true}]});
    player.stamina = 5;
  }
  save();
  if(done) done();
}
const KEVIN_LINES = [
  '"Oi mate, you can\u2019t just dig holes in a public park!"',
  '"Anything you find here is MINE, that is. This is MY park. I walk here."',
  '"I pay my rates, sunshine. Pack it up or you and me have got a problem."'];
async function karenDialogue(){
  document.exitPointerLock?.();
  AUDIO.blip(880,0.2,'sawtooth',0.15);
  const K = DIALOGUE.karen;
  const male = npc && npc.male;
  const line = male ? KEVIN_LINES[Math.random()*KEVIN_LINES.length|0] : K.lines[Math.random()*K.lines.length|0];
  const site = SITES[state.location];
  const hasPermitHere = (site.permit && state.permits[site.permit]) || (site.permission && state.farmPermission) || site.id==='au_park'||site.id==='au_beach'||site.id==='us_beach';
  const choice = await modal({ icon:'📱', title:K.title,
    body:'<div class="quote">'+line+'</div>',
    options: K.options.map(o=>({ key:o.key, label:o.label + (o.hint? ' <span class="dim small">— '+o.hint+'</span>':'') }))
      .concat(male ? [{ key:'box', label:'Suggest you settle it like gentlemen 🥊 <span class="dim small">— Queensberry rules</span>' }] : []) });
  if(choice==='box'){ await karenBoxing(); removeNpc(); save(); return; }
  const opt = K.options.find(o=>o.key===choice);
  let ok;
  if(choice==='polite') ok = state.rep>=3 || Math.random()<0.55;
  else if(choice==='permit') ok = hasPermitHere;
  else if(choice==='ignore') ok = Math.random()<0.5;
  else ok = true;
  if(choice==='packup'){ player.x += Math.sin(yaw)*-20; player.z += Math.cos(yaw)*-20; }
  if(opt.stam) player.stamina = Math.max(0, player.stamina + opt.stam);
  await modal({ icon: ok?'😮‍💨':'😤', title: ok? 'Crisis averted':'She’s not done',
    body:'<p>'+(ok? opt.success : opt.fail)+'</p>', options:[{label:'Back to it', gold:true}]});
  if(ok) state.karensSurvived++;
  if(!ok && opt.callRanger){ eventTimer = 6; flagTime = Math.max(flagTime, 7); }
  removeNpc(); save();
}
async function rangerDialogue(){
  document.exitPointerLock?.();
  const R = DIALOGUE.ranger;
  const site = SITES[state.location];
  let body, fine = 0;
  if(site.permit && !state.permits[site.permit]){ body = R.noPermit; fine = R.fineGold; }
  else if(flagTime>6){ body = state.rep>=4 && state.fines===0 ? R.warn : R.fineMsg; fine = (state.rep>=4 && state.fines===0)? 0 : R.finePark; }
  else body = R.ok;
  await modal({ icon:'🎖', title:R.title, body:'<div class="quote">'+body+'</div>' +
    (fine? '<p><b>Fine: '+fmt$(fine)+'</b></p>':''), options:[{label: fine? 'Cop it sweet':'No worries', gold:true}]});
  if(fine){ state.money = Math.max(0, state.money-fine); state.fines++; sessionSpend += fine; AUDIO.bad(); updatePouchHud(); }
  flagTime = 0; removeNpc(); save();
}
async function farmerDialogue(){
  document.exitPointerLock?.();
  const F = DIALOGUE.farmer;
  const canCharm = state.rep>=3;
  const choice = await modal({ icon:'🚜', title:F.title,
    body:'<div class="quote">'+F.intro+'</div>',
    options: F.options.map(o=>({ key:o.key, label:o.label, disabled: o.key==='cash' && state.money<80 })) });
  const opt = F.options.find(o=>o.key===choice);
  if(choice==='charm' && !canCharm){
    await modal({icon:'🚜', title:'Hmm.', body:'<p>'+opt.failResult+'</p>', options:[{label:'Fair enough'}]});
    farmerDialogue(); return;
  }
  if(choice==='cash'){ state.money-=80; sessionSpend+=80; updatePouchHud(); }
  state.farmPermission = choice;
  permissionActive = true;
  await modal({icon:'🤝', title:'Permission granted', body:'<p>'+opt.result+'</p>', options:[{label:'Get the coil wet', gold:true}]});
  toast('Wheatfield Farm — permission secured');
  save();
}
function birdEvent(kind){
  bird = { obj: kind==='magpie'? WORLD.makeMagpie() : WORLD.makeSeagull(), kind, t:0 };
  bird.obj.scale.setScalar(1.4);
  scene.add(bird.obj);
}
function updateBird(dt){
  if(!bird) return;
  bird.t += dt;
  const T = bird.t;
  const o = bird.obj;
  const W = o.userData.wings;
  W.lWing.rotation.z = Math.sin(T*18)*0.7; W.rWing.rotation.z = -Math.sin(T*18)*0.7;
  // swoop path: behind → over head → away
  const dur = 3.2;
  const p = T/dur;
  const eyeY = world.heightAt(player.x,player.z)+1.62;
  if(p>=1){
    if(bird.kind==='magpie' && !bird.hit){}
    scene.remove(o); bird=null; return;
  }
  const behindX = player.x - Math.sin(yaw)*-24, behindZ = player.z - Math.cos(yaw)*-24;
  const aheadX = player.x + Math.sin(yaw)*-24, aheadZ = player.z + Math.cos(yaw)*-24;
  o.position.x = behindX + (aheadX-behindX)*p;
  o.position.z = behindZ + (aheadZ-behindZ)*p;
  o.position.y = eyeY + 6 - Math.sin(p*Math.PI)*6.4;
  o.rotation.y = yaw + Math.PI;
  if(!bird.hit && Math.abs(p-0.5)<0.05){
    bird.hit = true;
    if(bird.kind==='magpie'){
      AUDIO.squawk();
      player.stamina = Math.max(0, player.stamina-8);
      $('#flash').style.opacity = 0.35; setTimeout(()=>$('#flash').style.opacity=0, 180);
      toast(DIALOGUE.magpie, 'bad');
    } else {
      AUDIO.squawk();
      if((state.uses.snacks||0)>0 && state.loadout.includes('snacks')){ state.uses.snacks--; toast(DIALOGUE.seagull, 'bad'); }
      else toast('A seagull screams past, finds nothing worth stealing, and insults you on the way out.');
    }
  }
}
async function snakeEvent(){
  snakeObj = WORLD.makeSnake();
  const cp = coilPoint();
  snakeObj.position.set(cp.x, world.heightAt(cp.x,cp.z)+0.1, cp.z);
  scene.add(snakeObj);
  document.exitPointerLock?.();
  AUDIO.bad();
  await modal({ icon:'🐍', title:'Tiger snake!', body:'<div class="quote">'+DIALOGUE.snake+'</div><p>That target can wait. Forever, maybe.</p>',
    options:[{label:'Back away slowly', gold:true}]});
  player.x -= Math.sin(yaw)*-6; player.z -= Math.cos(yaw)*-6;
  player.stamina = Math.max(0, player.stamina-5);
  setTimeout(()=>{ if(snakeObj){ scene.remove(snakeObj); snakeObj=null; } }, 9000);
}
function updateSnake(t){
  if(!snakeObj) return;
  snakeObj.userData.segs.forEach((s,i)=>{
    s.position.set(Math.sin(t*3+i*0.8)*0.14, 0, -i*0.16);
  });
}

/* ---------- movement & loop ---------- */
let animating = false;
function animate(){
  animating = true;
  requestAnimationFrame(animate);
  if(!renderer || !scene) return;
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  const site = SITES[state.location];
  const paused = !$('#fieldPause').hidden || !$('#modal').hidden || !$('#digModal').hidden || !$('#findModal').hidden || !$('#resultsModal').hidden;
  if(running && !paused){
    // movement
    let mx=0, mz=0;
    if(!boxing && (keys.KeyW||keys.ArrowUp)) mz-=1;
    if(!boxing && (keys.KeyS||keys.ArrowDown)) mz+=1;
    if(!boxing && (keys.KeyA||keys.ArrowLeft)) mx-=1;
    if(!boxing && (keys.KeyD||keys.ArrowRight)) mx+=1;
    if(!boxing && touchMove.active){ mx += touchMove.x; mz += touchMove.y; }
    let mv = Math.hypot(mx,mz);
    if(mv>1){ mx/=mv; mz/=mv; mv=1; }
    if(mv>0.06){
      mx/=mv; mz/=mv;
      let speed = 4.4*mv;
      // soft ground
      if(site.soft==='drysand' && player.z>8) speed = 3.0;
      if(site.soft==='plough' && player.x>10) speed = 2.6;
      if(player.stamina<15) speed *= 0.6;
      const s = Math.sin(yaw), c = Math.cos(yaw);
      player.x += (mx*c + mz*s)*speed*dt;
      player.z += (mz*c - mx*s)*speed*dt;
      const lim = WORLD.HALF-4;
      player.x = Math.max(-lim, Math.min(lim, player.x));
      player.z = Math.max(-lim, Math.min(lim, player.z));
      let drain = 0.35;
      if(site.soft==='drysand' && player.z>8) drain = 0.9;
      if(site.soft==='plough' && player.x>10) drain = 1.1;
      player.stamina = Math.max(0, player.stamina - drain*dt);
    } else {
      player.stamina = Math.min(100, player.stamina + 0.5*dt);
    }
    // camera
    const gy = world.heightAt(player.x, player.z);
    const bob = mv>0 ? Math.sin(t*8)*0.045 : 0;
    camera.position.set(player.x, gy+1.62+bob-(boxDuck||0), player.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw; camera.rotation.x = pitch;
    // automatic coil swing — the coil fans an arc out from the viewpoint;
    // the rig pivots at the grip so the shaft's near end stays anchored off-screen
    if(detectorModel){
      const targetAmp = pinpoint ? 0.05 : (mv>0 ? 0.85 : 0.5);
      swingAmp += (targetAmp - swingAmp)*Math.min(1, dt*5);
      swingPhase += dt * (mv>0 ? 3.0 : 2.1);
      const sw = Math.sin(swingPhase)*swingAmp;
      const PX = 0.34, PZ = -0.55; // pivot at the elbow of the rig
      const cs = Math.cos(sw), sn = Math.sin(sw);
      detectorModel.rotation.y = sw;
      detectorModel.position.x = PX - (PX*cs + PZ*sn);
      detectorModel.position.z = PZ - (-PX*sn + PZ*cs);
      detectorModel.rotation.z = Math.sin(t*2.2)*0.012;
      detectorModel.position.y = 0;
      // the skid plate stays parallel to the ground whatever your gaze does
      for(const part of detectorModel.userData.coilParts) part[0].rotation.x = part[1] - pitch*0.92;
      camera.updateMatrixWorld();
      detectorModel.userData.coil.getWorldPosition(_coilV);
      // the arm keeps the coil riding ~8cm over the soil and it can never clip under;
      // looking up (or swinging over a hollow) lifts it — and costs depth
      const seek = pinpoint ? 0.03 : 0.08;
      const gCoil = world.heightAt(_coilV.x, _coilV.z);
      let correction = (gCoil + seek) - _coilV.y;
      // arm follows the gaze: watching the ground keeps the skid plate down;
      // raising your eyes raises the coil (and the shadow spreads, and depth suffers)
      const downAssist = Math.max(0.06, 0.62 - Math.max(0, pitch + 0.15) * 1.6);
      correction = Math.max(-downAssist, Math.min(0.62, correction));
      if(_coilV.y + correction < gCoil + 0.03) correction = gCoil + 0.03 - _coilV.y;
      _qInv.copy(camera.quaternion).invert();
      _upV.set(0, correction, 0).applyQuaternion(_qInv);
      detectorModel.position.add(_upV);
      detectorModel.userData.coil.getWorldPosition(_coilV);
      coilGap = Math.max(0, _coilV.y - gCoil - 0.03);
      coilWorld.x = _coilV.x; coilWorld.z = _coilV.z; coilWorld.ok = true;
      // contact shadow under the coil
      if(coilShadow){
        coilShadow.position.set(_coilV.x, gCoil + 0.015, _coilV.z);
        const sc = 0.44 + coilGap*0.55;
        coilShadow.scale.set(sc, 1, sc);
        coilShadow.material.opacity = Math.max(0.07, 0.5 - coilGap*0.5);
      }
    }
    if(boxing){ updateBoxing(dt); AUDIO.stopTone(); }
    else {
    updateDetection(dt);
    scheduleEvents(dt);
    updateNpc(dt);
    }
    updateBird(dt);
    updateSnake(t);
    // prohibited zone
    const inPz = world.inProhibited(player.x, player.z);
    $('#pzoneWarn').hidden = !inPz;
    if(inPz) flagTime += dt;
    // stamina UI
    const sf = $('#stamFill');
    sf.style.width = player.stamina+'%';
    sf.classList.toggle('low', player.stamina<25);
    updateCompass();
    // hints
    hintTimer -= dt;
    if(hintTimer<=0){
      hintTimer = 2;
      const hint = $('#hint');
      if(!permissionActive){
        const d = world.interactives.farmhouseDoor;
        hint.innerHTML = d && Math.hypot(player.x-d.x,player.z-d.z)<5 ? '<b>E</b> knock on the door' : 'Find the farmhouse and knock before detecting';
      }
      else if(diggableTarget()) hint.innerHTML = IS_TOUCH? 'Tap <b>DIG</b> — hold <b>PIN·PT</b> to narrow it down' : '<b>E</b> dig this target &nbsp; <b>SHIFT</b> pinpoint';
      else if(player.stamina<20) hint.innerHTML = IS_TOUCH? 'Running on empty — tap <b>EAT</b>, or pause to head home' : 'Running on empty — <b>R</b> to eat, or <b>H</b> to head home';
      else hint.textContent = '';
    }
  } else {
    AUDIO.stopTone();
  }
  if(world){ world.animate(t, dt); if(world.nearGrass) world.nearGrass.update(player.x, player.z); }
  renderer.render(scene, camera);
}

/* ---------- session end ---------- */
function endSession(){
  running = false;
  AUDIO.stopTone(); AUDIO.ambient(0);
  $('#fieldPause').hidden = true;
  const rows = sessionFinds.map(f=>'<tr><td>'+f.name+'</td><td>'+(f.kind==='binned'?'binned':f.value?fmt$(f.value):'—')+'</td></tr>').join('');
  const keeps = sessionFinds.filter(f=>f.value>0).reduce((a,f)=>a+f.value,0);
  $('#resultsBody').innerHTML =
    (sessionFinds.length? '<table>'+rows+'</table>' : '<p class="dim">Not a sausage. Even the ring pulls hid from you today.</p>') +
    '<div class="results-line"><span>POUCH VALUE ADDED</span><span>'+fmt$(keeps)+'</span></div>' +
    (sessionSpend? '<div class="results-line" style="border-top:none;padding-top:0"><span>FINES &amp; COSTS</span><span style="color:#8a2a1a">−'+fmt$(sessionSpend)+'</span></div>':'');
  $('#resultsModal').hidden = false;
}
$('#btnHome').addEventListener('click', ()=>{
  $('#resultsModal').hidden = true;
  state.day++;
  marketWalk();
  save();
  teardownField();
  renderCamp(); show('camp');
});
function teardownField(){
  if(scene){ scene.traverse(o=>{ if(o.geometry) o.geometry.dispose?.(); }); }
  scene=null; world=null; npc=null; bird=null; snakeObj=null; targets=[]; coilShadow=null; coilGap=0;
  $('#hud').hidden = true;
}

/* ================= TOUCH CONTROLS ================= */
const touchMove = { active:false, id:null, x:0, y:0, baseX:0, baseY:0 };
let lookTouchId = null, lookLast = null;
if(IS_TOUCH){
  document.body.classList.add('touch');
  document.addEventListener('touchstart', ()=>AUDIO.resume(), { once:true });
  const fieldEl = $('#field');
  const stickBase = $('#stickBase'), stickKnob = $('#stickKnob');
  function resetStick(){
    touchMove.active = false; touchMove.x = 0; touchMove.y = 0; touchMove.id = null;
    stickKnob.style.transform = 'translate(-50%,-50%)';
    stickBase.style.left = '24px'; stickBase.style.top = 'auto'; stickBase.style.bottom = '26px';
  }
  fieldEl.addEventListener('touchstart', e=>{
    if(!running || !$('#fieldPause').hidden) return;
    for(const t of e.changedTouches){
      const onButton = t.target.closest && t.target.closest('button');
      if(onButton) continue;
      if(t.clientX < innerWidth*0.45 && t.clientY > innerHeight*0.35 && !touchMove.active){
        touchMove.active = true; touchMove.id = t.identifier;
        touchMove.baseX = t.clientX; touchMove.baseY = t.clientY;
        stickBase.style.left = (t.clientX-59)+'px'; stickBase.style.top = (t.clientY-59)+'px'; stickBase.style.bottom = 'auto';
      } else if(lookTouchId === null){
        lookTouchId = t.identifier; lookLast = { x:t.clientX, y:t.clientY };
      }
    }
  }, { passive:true });
  fieldEl.addEventListener('touchmove', e=>{
    if(!running) return;
    e.preventDefault();
    for(const t of e.changedTouches){
      if(touchMove.active && t.identifier === touchMove.id){
        let dx = t.clientX - touchMove.baseX, dy = t.clientY - touchMove.baseY;
        const d = Math.hypot(dx,dy), R = 52;
        if(d > R){ dx *= R/d; dy *= R/d; }
        touchMove.x = dx/R; touchMove.y = dy/R;
        stickKnob.style.transform = 'translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px))';
      } else if(t.identifier === lookTouchId){
        yaw -= (t.clientX - lookLast.x)*0.0046;
        pitch -= (t.clientY - lookLast.y)*0.0036;
        pitch = Math.max(-1.25, Math.min(0.6, pitch));
        lookLast = { x:t.clientX, y:t.clientY };
      }
    }
  }, { passive:false });
  const endTouch = e=>{
    for(const t of e.changedTouches){
      if(t.identifier === touchMove.id) resetStick();
      if(t.identifier === lookTouchId){ lookTouchId = null; lookLast = null; }
    }
  };
  fieldEl.addEventListener('touchend', endTouch);
  fieldEl.addEventListener('touchcancel', endTouch);
  // action buttons
  const guardOk = () => running && $('#fieldPause').hidden &&
    $('#modal').hidden && $('#digModal').hidden && $('#findModal').hidden && $('#resultsModal').hidden && !boxing;
  $('#tbDig').addEventListener('pointerdown', e=>{ e.preventDefault(); if(guardOk()) tryInteract(); });
  $('#tbPP').addEventListener('pointerdown', e=>{ e.preventDefault(); if(guardOk()) pinpoint = true; });
  for(const ev of ['pointerup','pointercancel','pointerleave'])
    $('#tbPP').addEventListener(ev, ()=>{ pinpoint = false; });
  $('#tbEat').addEventListener('pointerdown', e=>{ e.preventDefault(); if(guardOk()) eat(); });
  $('#tbPause').addEventListener('pointerdown', e=>{ e.preventDefault();
    if(running && $('#fieldPause').hidden) pauseTitle('PAUSED','Have a breather. Pack up from here if you\u2019re done.'); });
  // swap keyboard copy for touch copy
  document.querySelectorAll('.title-controls').forEach(el=>{
    el.innerHTML = '<span><b>LEFT THUMB</b> move</span><span><b>RIGHT THUMB</b> look (coil swings itself)</span><span><b>DIG</b> when you hear a signal</span>';
  });
  $('#btnResume').textContent = 'TAP TO DETECT';
}
// tappable boxing choices (work with mouse too)
document.querySelectorAll('.box-keys .bk').forEach(b=>{
  b.addEventListener('pointerdown', e=>{ e.preventDefault();
    if(boxing && boxing.phase==='telegraph'){ boxing.picked = b.dataset.pick; updateBoxHud(); } });
});

/* ================= WIRING ================= */
$('#btnGo').addEventListener('click', ()=>{
  const id = selectedSite || state.location;
  const cost = travelCost(id);
  if(cost>state.money) return;
  if(cost>0){
    state.money -= cost;
    state.location = id; state.country = SITES[id].country;
    toast('Travelled to '+SITES[id].name+' — '+fmt$(cost));
  }
  save();
  enterField();
});
$('#btnNew').addEventListener('click', ()=>{
  state = DEFAULT_STATE(); save();
  AUDIO.resume();
  // straight onto the sand — base camp can wait
  enterField();
  pauseTitle('DAY 1 — KINGFISHER BEACH',
    'Straight onto the sand: sunrise, low tide, and a summer of lost property under your coil. ' +
    (IS_TOUCH ? 'Tap \u275a\u275a then \u201cPack up & head home\u201d' : 'Press H') +
    ' whenever you like to head home \u2014 the world map, shop, missions and detector upgrades all live there.');
});
$('#btnContinue').addEventListener('click', ()=>{ AUDIO.resume(); renderCamp(); show('camp'); });

/* boot */
if(load()){
  $('#btnContinue').hidden = false;
  $('#contDay').textContent = state.day;
  $('#btnNew').textContent = 'NEW GAME';
}

/* debug hooks for automated testing */
window.DBG = {
  get state(){ return state; },
  go(id){ selectedSite=id; state.money+=100000; renderCamp(); $('#btnGo').disabled=false; state.location=id; state.country=SITES[id].country; enterField(); },
  camp(){ renderCamp(); show('camp'); },
  key(code,down=true){ keys[code]=down; },
  look(y,p){ yaw=y; pitch=p; },
  pos(){ return {x:player.x, z:player.z, stamina:player.stamina, signal:signal.strength, targets:targets.filter(t=>!t.dug).length}; },
  nearest(){ let best=1e9,bt=null; const cp=coilPoint(); for(const t of targets){ if(t.dug)continue; const d=Math.hypot(cp.x-t.x,cp.z-t.z); if(d<best){best=d;bt=t;} } return bt&&{d:best,key:bt.key,depth:bt.depth,x:bt.x,z:bt.z}; },
  teleport(x,z){ player.x=x; player.z=z; },
  coil(){ return { x: coilWorld.x, z: coilWorld.z, ok: coilWorld.ok, swing: swingAmp, gap: coilGap }; },
  karen(){ spawnWalker('karen'); },
  kevin(){ spawnWalker('karen', true); },
  probe(){ const v = new THREE.Vector3(); camera.updateMatrixWorld(); detectorModel.userData.coil.getWorldPosition(v);
    return { pitch, yaw, camY: camera.position.y, coilY: v.y, gTerr: world.heightAt(v.x, v.z),
      modelPos: detectorModel.position.toArray().map(n=>+n.toFixed(3)), rotY: +detectorModel.rotation.y.toFixed(3) }; },
  resume(){ $('#fieldPause').hidden=true; },
};
})();
