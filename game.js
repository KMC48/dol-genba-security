const $=id=>document.getElementById(id);
const VENUES=[
 {name:'地下ライブハウス',full:'下北・地下ライブハウス',tag:'LIVE HOUSE',level:'★☆☆☆',capacity:'キャパ 300',interval:1.6,life:10,max:5},
 {name:'野外フェス',full:'青空サマーフェス',tag:'OPEN AIR',level:'★★☆☆',capacity:'キャパ 5,000',interval:1.25,life:9,max:6},
 {name:'ドーム公演',full:'ネオンシティドーム',tag:'DOME',level:'★★★☆',capacity:'キャパ 50,000',interval:1.02,life:8,max:7},
 {name:'超満員スタジアム',full:'国立級・グランドスタジアム',tag:'STADIUM',level:'★★★★',capacity:'キャパ 70,000',interval:.85,life:7.5,max:8}
];
const GROUPS=[
 {name:'彗星ピクセルズ',tag:'投げサイリウム多発',color:'#9ce6ff',weights:[8,8,12,47,10,15],line:'飛ばすのは気持ちだけ！',brief:'サイリウム投げに警戒。次々と現れる投げ手を止めろ。',voices:['その流れ星、客席発。','推しに届けるのは声援で！','サビで光るのは、ペンライトだけでいい。']},
 {name:'爆音シュガー',tag:'モッシュ・リフト多発',color:'#ff889a',weights:[25,35,10,8,7,15],line:'沸くのはOK！ 押すのはNG！',brief:'モッシュとリフトに警戒。荒れるフロアを駆け抜けろ。',voices:['肩車席は販売してません！','フロアが揺れる。人まで飛ぶな！','その熱量、コールに回して！']},
 {name:'放課後ルミナリンク',tag:'爆光サイリウム多発',color:'#ffcb7a',weights:[8,8,47,12,10,15],line:'光量で愛を証明しない！',brief:'過剰な光害に警戒。推しより眩しいオタクを見つけろ。',voices:['そこだけ昼公演になってる！','推しより目立つな、その光！','その光量、照明さんも二度見。']},
 {name:'純情アンコール',tag:'不当な最前管理多発',color:'#d8acff',weights:[12,8,8,10,47,15],line:'最前列は私有地じゃない！',brief:'不当な最前管理に警戒。勝手な場所取りから最前列を守れ。',voices:['その仕切り、誰の許可？','整理番号より強い権力、ありません！','そこ、あなたの指定席ではありません。']}
];
const TYPES=[
 {name:'リフト',short:'リフト',mark:'↑',color:'#ff8499',sprite:4,quote:'肩車席は販売してません！'},
 {name:'モッシュ',short:'モッシュ',mark:'↔',color:'#ffa778',sprite:4,quote:'押し合い禁止。推し合い歓迎。'},
 {name:'光害',short:'光害',mark:'光',color:'#ffe275',sprite:5,quote:'その光、ステージまで届いてます。'},
 {name:'サイリウム投げ',short:'投げ',mark:'投',color:'#9ce6ff',sprite:2,quote:'飛ばすのは気持ちだけ！'},
 {name:'不当な最前管理',short:'最前管理',mark:'占',color:'#d8acff',sprite:6,quote:'最前列は私有地じゃない！'},
 {name:'ステージ乱入',short:'乱入',mark:'駆',color:'#ffad66',sprite:6,quote:'ステージに上がれるのは出演者だけ！'},
 {name:'繋がりオタク',short:'繋がり',mark:'♥',color:'#ffd86e',sprite:6,quote:'そのハート、明らかに相互通信！'}
];
const CROPS=[[73,137,210,473],[337,147,287,470],[632,78,280,537],[947,99,290,517],[39,637,273,453],[314,672,320,500],[659,712,279,461],[948,670,289,506]];
const portraits=new Image(),venues=new Image();portraits.src='characters.png';venues.src='venues.png';
const canvas=$('game'),ctx=canvas.getContext('2d'),preview=$('preview'),pctx=preview.getContext('2d');
let chosenVenue=0,chosenGroup=0,mode='menu',state=null,lastFrame=0,assetReady=false,assetError=false;
let audioOn=false,audioCtx=null,musicBeat=0,musicClock=0;
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let bests={};try{bests=JSON.parse(localStorage.getItem('nexus-genba-records-v1')||'{}')}catch{}
if(!bests||typeof bests!=='object'||Array.isArray(bests))bests={};
const rand=(a,b)=>a+Math.random()*(b-a),clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const bestKey=()=>`${chosenVenue}-${chosenGroup}`;
function setText(id,v){$(id).textContent=v}
function buildMenu(){
 $('venues').innerHTML=VENUES.map((v,i)=>`<button class="venue-card" data-venue="${i}" aria-pressed="${i===chosenVenue}"><span class="card-meta"><span>${v.tag}</span><strong>${v.level}</strong></span><b>${v.name}</b></button>`).join('');
 $('groups').innerHTML=GROUPS.map((g,i)=>`<button class="group-card" data-group="${i}" aria-pressed="${i===chosenGroup}" style="--group-color:${g.color}"><span class="group-color"></span><b>${g.name}</b><small>${g.tag}</small></button>`).join('');
 document.querySelectorAll('[data-venue]').forEach(b=>b.onclick=()=>{chosenVenue=Number(b.dataset.venue);buildMenu();tone(420,.06)});
 document.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{chosenGroup=Number(b.dataset.group);buildMenu();tone(520,.06)});
 setText('missionBrief',GROUPS[chosenGroup].brief);setText('sceneName',VENUES[chosenVenue].full);
 const best=bests[bestKey()];setText('bestLine',best?`この現場のBEST：${best.count}人 / ${Number(best.score).toLocaleString()} pt`:`${VENUES[chosenVenue].capacity} / 60秒タイムアタック`);
}
const legend=TYPES.map(t=>`<div class="legend-row"><span class="legend-mark" style="--mark-color:${t.color}">${t.mark}</span><span>${t.name}</span></div>`).join('');
$('offenseLegend').innerHTML=legend;$('manualLegend').innerHTML=legend;buildMenu();
function tone(freq,duration=.1,type='square',volume=.035,delay=0){
 if(!audioOn||!audioCtx)return;try{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audioCtx.currentTime+delay);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+delay+duration);o.connect(g);g.connect(audioCtx.destination);o.start(audioCtx.currentTime+delay);o.stop(audioCtx.currentTime+delay+duration)}catch{}
}
function soundSuccess(){tone(600,.07);tone(900,.09,'square',.025,.065)}
function music(dt){if(!audioOn||!audioCtx)return;musicClock-=dt;if(musicClock>0)return;musicClock=.19;const melody=[523,659,784,659,880,784,659,587,523,659,784,1047,988,784,659,587];tone(melody[musicBeat%16],.12,'square',.011);if(musicBeat%2===0)tone([131,131,175,196][Math.floor(musicBeat/4)%4],.15,'triangle',.032);musicBeat++}
$('soundBtn').onclick=()=>{audioOn=!audioOn;if(audioOn){const AC=window.AudioContext||window.webkitAudioContext;if(!AC){audioOn=false;setText('soundBtn','音 非対応');return}audioCtx??=new AC();audioCtx.resume().catch(()=>{})}else{audioCtx?.suspend().catch(()=>{})}setText('soundBtn',audioOn?'音 ON':'音 OFF');$('soundBtn').setAttribute('aria-label',audioOn?'サウンドをオフにする':'サウンドをオンにする');tone(660,.08)};
function weightedType(){const weights=GROUPS[chosenGroup].weights;let n=rand(0,weights.reduce((a,b)=>a+b,0));for(let i=0;i<weights.length;i++){n-=weights[i];if(n<0)return i}return weights.length-1}
function stageY(venue=chosenVenue){return 720*(venue===0?.275:venue===1?.33:.36)}
function freeSlots(){const result=[];for(let r=0;r<4;r++)for(let c=0;c<4;c++){const key=r*4+c;if(!state.fans.some(f=>f.slot===key&&f.status!=='gone'))result.push({slot:key,x:128+c*128,y:315+r*104})}return result}
function spawnFan(normal=false,type=null){
 const which=type??weightedType(),rare=!normal&&which===6;
 if(rare&&state.rareSpawned)return null;
 const slots=freeSlots();if(!slots.length&&!rare)return null;
 let pool=which===4&&!normal?slots.filter(s=>s.slot<4):which===5&&!normal?slots.filter(s=>s.slot>=8):slots;if(!pool.length)pool=slots;
 const pos=rare?{slot:16,x:320,y:366}:pool[Math.floor(rand(0,pool.length))];
 const used=state.fans.filter(f=>!f.normal&&f.status==='active').map(f=>f.key);let key=1;while(used.includes(key))key++;
 const fan={...pos,x:pos.x+(rare?0:rand(-9,9)),y:pos.y+(rare?0:rand(-3,3)),id:state.nextId++,key:normal||rare?0:key,normal,type:which,sprite:normal?(Math.random()<.5?2:3):TYPES[which].sprite,age:0,life:rare?10:which===5?7:VENUES[chosenVenue].life,phase:rand(0,Math.PI*2),status:'active',exit:0};
 if(!normal&&which===5){fan.startX=fan.x;fan.startY=fan.y;fan.targetX=640*(.29+Math.floor(rand(0,5))*.105);fan.targetY=stageY()+3}
 if(rare)state.rareSpawned=true;
 state.fans.push(fan);return fan;
}
function spawnScheduledFans(){
 if(!state.invasionSeen&&state.elapsed>=8){const f=spawnFan(false,5);if(f){state.invasionSeen=true;log('HQ','ステージへ向かう人物を確認。登られる前に止めろ！')}}
 if(!state.rareSpawned&&state.elapsed>=state.rareAt){const f=spawnFan(false,6);if(f){announce('一度きり！ 繋がりオタク出現',2.3);setText('statusLine','金色の♥が目印！ 繋がりオタクは通常の10倍得点。');log('RARE','アイドルとハートの相互通信…！ 確保で1,000〜3,000点。');tone(1047,.15);tone(1319,.2,'square',.03,.15)}}
}
function resetGame(){
 state={remaining:60,elapsed:0,count:0,score:0,combo:0,maxCombo:0,lastEject:-100,missed:0,mistakes:0,charge:0,breakdown:TYPES.map(()=>0),rareAt:rand(24,36),rareSpawned:false,rarePoints:0,invasionSeen:false,fans:[],effects:[],nextId:1,guard:{x:320,y:672},queue:[],spawnClock:0,countdown:3,lastBeep:4,rush:false,rushCycle:0,announcement:0,logs:[],pulse:0,anim:0,hudClock:0};
 for(let i=0;i<5;i++)spawnFan(true);
 mode='countdown';document.body.classList.add('playing');$('menu').classList.add('hidden');$('play').classList.remove('hidden');
 setText('playVenue',VENUES[chosenVenue].full);setText('playGroup',GROUPS[chosenGroup].name);setText('statusLine','赤いマークの違反者をタップ！');
 $('resultDialog').close();$('pauseDialog').close();$('countdown').classList.remove('hidden');$('combo').classList.add('hidden');$('announcement').classList.add('hidden');
 log('HQ','配置につきました。楽しい現場を守ります。');updateHud();window.scrollTo({top:0,behavior:'instant'});audioCtx?.resume().catch(()=>{});canvas.focus({preventScroll:true});
}
function startGame(){if(assetError){setText('missionBrief','画像を読み込めませんでした。ページを再読み込みしてください。');return}if(!assetReady){setText('missionBrief','現場を準備しています。少しお待ちください。');return}resetGame()}
function beginPlay(){mode='playing';$('countdown').classList.add('hidden');spawnFan(false,3);spawnFan(false);if(chosenVenue>1)spawnFan(false);state.spawnClock=1.7;announce('警備開始！ 違反者をタップ',2.2);tone(880,.2)}
function updateHud(){if(!state)return;setText('time',Math.ceil(state.remaining));$('time').insertAdjacentHTML('beforeend','<small>秒</small>');$('time').parentElement.classList.toggle('urgent',state.remaining<=10);setText('count',state.count);$('count').insertAdjacentHTML('beforeend','<small>人</small>');setText('score',String(state.score).padStart(5,'0'));setText('chargeText',Math.floor(state.charge)+'%');$('chargeFill').style.width=state.charge+'%';$('specialBtn').disabled=state.charge<100||mode!=='playing';$('specialBtn').querySelector('small').textContent=state.charge>=100?'READY!':'CHARGE';$('combo').classList.toggle('hidden',state.combo<2);setText('combo',`${state.combo} COMBO ×${(1+Math.min(state.combo-1,20)*.1).toFixed(1)}`)}
function log(who,line){if(!state)return;state.logs.unshift({who,line});state.logs=state.logs.slice(0,5);$('liveLog').innerHTML=state.logs.map(l=>`<div class="log-entry"><small>${l.who}</small>${l.line}</div>`).join('')}
function announce(text,duration=1.8){setText('announcement',text);$('announcement').classList.remove('hidden');state.announcement=duration}
function fx(x,y,text,color='#c5fa5f',big=false){state.effects.push({x,y,text,color,life:1.1,max:1.1,big});for(let i=0;i<7;i++)state.effects.push({x,y,vx:rand(-90,90),vy:rand(-150,15),color,life:rand(.3,.65),max:.65,particle:true})}
function chooseFan(f){
 if(mode!=='playing'||f.status!=='active')return;
 if(f.normal){state.score=Math.max(0,state.score-150);state.mistakes++;state.combo=0;fx(f.x,f.y-65,'誤認 −150','#ff7188');setText('statusLine','その人、普通に楽しんでます！');tone(160,.18,'sawtooth',.03);log('FAN','「えっ、普通に応援してただけです…」');updateHud();return}
 if(state.queue.includes(f.id))return;
 state.queue.push(f.id);setText('statusLine',`${TYPES[f.type].name}を確認。${state.queue.length>1?'順番に対応中！':'駆けつけます！'}`);tone(400,.035,'triangle',.025);
}
function eject(f,special=false){
 if(f.status!=='active'||f.normal)return;
 if(state.elapsed-state.lastEject>5)state.combo=0;
 const people=f.type===1?2:1;let points=0;
 for(let i=0;i<people;i++){state.combo++;points+=Math.round((f.type===6?1000:100)*(1+Math.min(state.combo-1,20)*.1))}
 state.maxCombo=Math.max(state.maxCombo,state.combo);state.lastEject=state.elapsed;state.count+=people;state.breakdown[f.type]+=people;state.score+=points;
 if(!special)state.charge=Math.min(100,state.charge+12.5*people);
 if(f.type===6){state.rarePoints=points;log('RARE',`繋がりオタク確保！ +${points.toLocaleString()}点`)}
 f.status='exiting';f.exit=0;state.queue=state.queue.filter(id=>id!==f.id);fx(f.x,f.y-78,`${people===2?'2人退場！':f.type===6?'繋がり確保！':'退場！'} +${points}`,f.type===6?'#ffd86e':special?'#9ce6ff':'#c5fa5f');
 soundSuccess();if(state.count%4===1)log('FLOOR',TYPES[f.type].quote);
 if(state.combo%10===0)announce(`${state.combo} COMBO！ 神速の現場対応`,1.5);
 if(state.charge===100){setText('statusLine','応援スタッフ到着！ 「一斉退場」が使えます。')}else setText('statusLine',state.combo>=3?`${state.combo}人連続で退場！ 次の違反者へ。`:'対応完了。次の違反者を探そう。');updateHud();
}
function special(){if(mode!=='playing'||state.charge<100)return;const targets=state.fans.filter(f=>!f.normal&&f.status==='active');if(!targets.length){setText('statusLine','いまは平和。違反者が出るまで温存しよう。');return}state.charge=0;state.pulse=1;const people=targets.reduce((n,f)=>n+(f.type===1?2:1),0);targets.forEach(f=>eject(f,true));announce(`一斉退場！ ${people}人まとめて対応`,2);log('DAICHI','「ここは任せろ。みんな、出口はこちらだ！」');tone(330,.15,'square',.04);tone(660,.25,'square',.03,.1);updateHud()}
function pause(){if(mode!=='playing'&&mode!=='countdown')return;state.previousMode=mode;mode='paused';$('pauseDialog').showModal();updateHud()}
function resume(){if(mode!=='paused')return;mode=state.previousMode||'playing';$('pauseDialog').close();lastFrame=performance.now();updateHud();canvas.focus({preventScroll:true})}
function goMenu(){mode='menu';document.body.classList.remove('playing');$('resultDialog').close();$('pauseDialog').close();$('play').classList.add('hidden');$('menu').classList.remove('hidden');buildMenu();window.scrollTo({top:0,behavior:'instant'})}
function finish(){
 if(mode!=='playing')return;mode='result';state.remaining=0;state.queue=[];updateHud();
 const ranks=state.count>=55?['S','伝説の現場守護神']:state.count>=38?['A','頼れる現場リーダー']:state.count>=22?['B','一人前の警備員']:['C','伸びしろの新人隊員'];
 setText('rank',ranks[0]);setText('rankTitle',ranks[1]);setText('resultMission',`${VENUES[chosenVenue].name} × ${GROUPS[chosenGroup].name}`);setText('resultCount',state.count);$('resultCount').insertAdjacentHTML('beforeend','<small>人</small>');setText('resultScore',state.score.toLocaleString());setText('resultCombo',state.maxCombo+'連');setText('resultMistakes',`${state.missed} / ${state.mistakes}`);
 setText('resultRare',state.rarePoints?`♥ 繋がりオタク確保：+${state.rarePoints.toLocaleString()}点`:'♥ 繋がりオタク：今回は見逃し');
 $('resultBreakdown').innerHTML=TYPES.map((t,i)=>`<span>${t.short}<b>${state.breakdown[i]}人</b></span>`).join('');setText('resultQuote',state.mistakes===0?'「善良なオタクへの誤認ゼロ。推しも、ファンも、ありがとう！」':state.mistakes>3?'「次は、普通に応援しているファンをよく見極めよう。」':'「今日も、推しのステージを守り抜いた。」');
 const prev=bests[bestKey()];const isBest=!prev||state.count>prev.count||(state.count===prev.count&&state.score>prev.score);$('newBest').classList.toggle('hidden',!isBest);if(isBest){bests[bestKey()]={count:state.count,score:state.score};try{localStorage.setItem('nexus-genba-records-v1',JSON.stringify(bests))}catch{}}
 $('resultDialog').showModal();tone(523,.13);tone(659,.13,'square',.035,.14);tone(784,.3,'square',.035,.28);
}
function update(dt){
 state.anim+=dt;
 if(mode==='countdown'){state.countdown-=dt;let num=Math.ceil(state.countdown);setText('countdown',num>0?num:'GO!');if(num!==state.lastBeep&&num>0){state.lastBeep=num;tone(440,.06)}if(state.countdown<=0)beginPlay();return}
 if(mode!=='playing')return;
 state.elapsed+=dt;state.remaining=Math.max(0,60-state.elapsed);music(dt);spawnScheduledFans();
 const rushNow=(state.elapsed>=15&&state.elapsed<21)||(state.elapsed>=32&&state.elapsed<38)||state.elapsed>=50;
 if(rushNow&&!state.rush){state.rush=true;state.spawnClock=.1;announce(state.elapsed>=50?'ラストサビ！ 厄介ラッシュ！':'サビ突入！ 厄介ラッシュ！',2);log('STAGE',GROUPS[chosenGroup].voices[state.rushCycle%3]);state.rushCycle++}else if(!rushNow)state.rush=false;
 state.spawnClock-=dt;
 if(state.spawnClock<=0){const active=state.fans.filter(f=>!f.normal&&f.type!==6&&f.status==='active').length;if(active<VENUES[chosenVenue].max+(state.rush?1:0))spawnFan(false);state.spawnClock=VENUES[chosenVenue].interval*(state.rush?.55:1)*rand(.85,1.15)}
 for(const f of state.fans){
  f.age+=dt;
  if(f.status==='exiting'){f.exit+=dt;f.x+=(f.x<320?-330:330)*dt;if(f.exit>.85)f.status='gone';continue}
  if(!f.normal&&f.type===5){const p=clamp(f.age/f.life,0,1);f.x=f.startX+(f.targetX-f.startX)*p;f.y=f.startY+(f.targetY-f.startY)*p}
  if(!f.normal&&f.status==='active'&&f.age>=f.life){
   f.status='gone';const people=f.type===1?2:1;state.missed+=people;state.combo=0;state.queue=state.queue.filter(id=>id!==f.id);
   fx(f.x,f.y-50,f.type===5?'乱入を許した！':f.type===6?'繋がりを見逃した…':'見逃し…','#ffa1a1');
   setText('statusLine',f.type===5?'ステージに上がられた！ 移動中に止めよう。':f.type===6?'繋がりオタクを見逃した…この公演の出現は一度きり。':'対応が遅れた！ 赤いマークを優先しよう。');tone(210,.06,'triangle',.02)
  }
 }

 state.fans=state.fans.filter(f=>f.status!=='gone');
 state.queue=state.queue.filter(id=>state.fans.some(f=>f.id===id&&f.status==='active'));
 const target=state.fans.find(f=>f.id===state.queue[0]);if(target){const tx=target.x,ty=target.y+13,dx=tx-state.guard.x,dy=ty-state.guard.y,dist=Math.hypot(dx,dy),step=1100*dt;if(dist<=step+8){state.guard.x=tx;state.guard.y=ty;eject(target)}else{state.guard.x+=dx/dist*step;state.guard.y+=dy/dist*step}}
 if(state.combo&&state.elapsed-state.lastEject>5)state.combo=0;
 for(const e of state.effects){e.life-=dt;if(e.particle){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vy+=170*dt}else e.y-=25*dt}state.effects=state.effects.filter(e=>e.life>0);
 state.pulse=Math.max(0,state.pulse-dt);if(state.announcement>0){state.announcement-=dt;if(state.announcement<=0)$('announcement').classList.add('hidden')}
 state.hudClock-=dt;if(state.hudClock<=0){updateHud();state.hudClock=.1}if(state.remaining<=0)finish();
}
function drawSprite(c,index,x,y,h=82,flip=false,alpha=1,squash=1){
 if(!portraits.complete||!portraits.naturalWidth)return;const [sx,sy,sw,sh]=CROPS[index];const w=h*sw/sh;c.save();c.globalAlpha=alpha;c.translate(Math.round(x),Math.round(y));if(flip)c.scale(-1,1);c.drawImage(portraits,sx,sy,sw,sh,Math.round(-w/2),-h*squash,w,h*squash);c.restore();
}
function pixelText(c,text,x,y,color='#fff',size=18,align='center'){c.font=`bold ${size}px "DotGothic16", monospace`;c.textAlign=align;c.fillStyle='#06101be6';c.fillText(text,x+2,y+2);c.fillStyle=color;c.fillText(text,x,y)}
function drawVenue(c,w,h,time,venueIndex=chosenVenue){
 c.imageSmoothingEnabled=false;c.fillStyle='#111722';c.fillRect(0,0,w,h);
 if(venues.complete&&venues.naturalWidth){const tile=venues.width/2;c.drawImage(venues,(venueIndex%2)*tile,Math.floor(venueIndex/2)*tile,tile,tile,0,0,w,h)}
 const sy=venueIndex===0?.275:venueIndex===1?.33:.36;
 c.fillStyle='#04081520';c.fillRect(0,h*.35,w,h*.65);
 for(let i=0;i<5;i++){const x=w*(.29+i*.105),hop=reduced?0:Math.sin(time*5+i*.8)*2;drawSprite(c,7,x,h*sy+hop,36+(i===2?7:0),i%2===1,.98)}
 const cc=['#ff83a8','#a4e5ff','#ffd971','#c5fa5f','#d8acff'];
 for(let row=0;row<2;row++)for(let col=0;col<13;col++){const x=w*(.11+col*.065),y=h*(.40+row*.045);drawSprite(c,col%2?2:3,x,y,22,false,.32);if(Math.sin(time*4+col+row)>.3){c.fillStyle=cc[col%5]+'88';c.fillRect(x+4,y-21,2,7)}}
}
// A synchronized approach / body contact / recoil cycle, shared by both mosh participants.
function moshPose(f,time){const p=((time*1.25+f.phase) % 1+1)%1;let gap;if(p<.38)gap=42-26*p/.38;else if(p<.51)gap=16;else gap=16+26*(p-.51)/.49;return {gap,impact:p>=.38&&p<.55,lean:gap<22?.18:.08}}
function drawMosh(c,f,x,y,time){
 const pose=moshPose(f,time),gap=f.status==='exiting'?25:pose.gap;
 for(const side of [-1,1]){c.save();c.translate(x+side*gap,y+(reduced?0:Math.abs(Math.sin(time*12))*3));c.rotate(-side*pose.lean);drawSprite(c,side<0?6:4,0,0,80,side>0);c.restore()}
 if(f.status==='active'&&pose.impact){
  c.strokeStyle='#ffe7a6';c.lineWidth=3;
  for(let i=0;i<6;i++){const a=i*Math.PI/3;c.beginPath();c.moveTo(x+Math.cos(a)*9,y-39+Math.sin(a)*9);c.lineTo(x+Math.cos(a)*19,y-39+Math.sin(a)*19);c.stroke()}
  pixelText(c,'ドン！',x,y-77,'#ffcf83',15)
 }
}
function fanLabel(f){return {x:f.x,y:f.y-(f.type===0?126:94),width:f.type===6?178:f.type===1?126:f.type===4?110:98}}
function drawConnection(c,f,time){
 const ix=640*.5,iy=stageY()-26,fx=f.x,fy=f.y-71;
 c.save();c.strokeStyle='#ff94c755';c.lineWidth=2;c.setLineDash([3,7]);c.beginPath();c.moveTo(fx,fy);c.quadraticCurveTo(ix-48,(fy+iy)/2,ix,iy);c.stroke();c.setLineDash([]);
 for(let i=0;i<4;i++){let p=reduced?(i+.5)/4:(time*.5+i*.25)%1;const fromFan=i%2===0,q=fromFan?p:1-p;const x=fx+(ix-fx)*q+(fromFan?-1:1)*Math.sin(q*Math.PI)*25,y=fy+(iy-fy)*q;pixelText(c,'♥',x,y,fromFan?'#ff79b6':'#ffd86e',21)}
 pixelText(c,'♥',ix,iy-25,'#ff9dc7',24);pixelText(c,'相互♥',fx+38,fy+12,'#ffd86e',14);c.restore();
}
function drawFan(c,f,time){
 const normal=f.normal,t=TYPES[f.type],queued=state.queue.includes(f.id);const sway=reduced||f.type===1?0:Math.sin(time*5+f.phase)*2;let x=f.x+sway,y=f.y;
 const alpha=f.status==='exiting'?Math.max(0,1-f.exit*.9):normal?.82:1;
 c.save();c.globalAlpha=alpha;c.fillStyle='#0005';c.beginPath();c.ellipse(x,y+1,f.type===1&&!normal?63:25,7,0,0,Math.PI*2);c.fill();
 if(!normal&&f.status==='active'){
   const urgent=f.age/f.life>.7;c.strokeStyle=queued?'#c5fa5f':urgent?'#ff4c70':f.type===6?'#ffd86e':'#f36f91';c.lineWidth=3;c.beginPath();c.ellipse(x,y+1,f.type===1?68:34,11,0,0,Math.PI*2);c.stroke();
   if(f.type===0){drawSprite(c,6,x,y,64,false,1);y-=40+Math.sin(time*4+f.phase)*3}

   if(f.type===2){c.fillStyle='#ffe58c'+(reduced?'28':Math.sin(time*7)>.0?'36':'20');c.beginPath();c.arc(x,y-46,50,0,Math.PI*2);c.fill()}
   if(f.type===3){const p=(time*1.6+f.phase)%1;const px=x+Math.sin(f.phase)*65*p,py=y-55-p*160;c.save();c.translate(px,py);c.rotate(p*6);c.fillStyle='#9ce6ff';c.fillRect(-3,-14,6,28);c.fillStyle='#fff';c.fillRect(-1,-12,2,23);c.restore()}
   if(f.type===4){c.fillStyle='#b689e766';c.fillRect(x-48,y-10,96,14);c.strokeStyle='#d8acff';c.setLineDash([8,5]);c.strokeRect(x-47,y-24,94,34);c.setLineDash([])}
 }
 if(!normal&&f.type===1)drawMosh(c,f,x,y,time);
 else{if(!normal&&f.type===5){c.strokeStyle='#ffad6699';c.lineWidth=3;c.beginPath();c.moveTo(x-8,y+6);c.lineTo(x-8,y+21);c.moveTo(x+8,y+4);c.lineTo(x+8,y+17);c.stroke()}
 drawSprite(c,f.sprite,x,y,normal?72:84,false,1,reduced?1:1+Math.sin(time*(f.type===5?17:7)+f.phase)*.025)}
 if(!normal&&f.status==='active'){
   const labelY=fanLabel(f).y,labelWidth=fanLabel(f).width;c.fillStyle=queued?'#c5fa5f':f.type===6?'#ffd86e':'#de4164';c.fillRect(x-labelWidth/2,labelY-21,labelWidth,27);pixelText(c,`${f.key} ${t.short}${f.type===1?' ×2':f.type===6?' ♥10倍':''}`,x,labelY-1,queued||f.type===6?'#0b2012':'#fff',16);
   const rem=1-f.age/f.life;c.fillStyle='#120d19';c.fillRect(x-labelWidth/2,labelY+8,labelWidth,4);c.fillStyle=rem<.3?'#ff6788':t.color;c.fillRect(x-labelWidth/2,labelY+8,labelWidth*rem,4);
 }
 if(normal&&f.status==='active'&&Math.sin(time*.7+f.phase)>.98)pixelText(c,'推し最高！',x,y-79,'#bed4dc',12);
 c.restore();
}
function drawGame(){
 if(!state)return;const time=state.anim;ctx.clearRect(0,0,640,720);drawVenue(ctx,640,720,time);
 pixelText(ctx,GROUPS[chosenGroup].name,320,chosenVenue===0?105:chosenVenue===1?133:150,GROUPS[chosenGroup].color,17);
 ctx.fillStyle='#081018bd';ctx.fillRect(0,685,640,35);pixelText(ctx,'EXIT',47,708,'#b9f969',17);pixelText(ctx,'NEXUS SECURITY',320,708,'#c3ced6',13);pixelText(ctx,'EXIT',593,708,'#b9f969',17);
 if(state.queue.length){ctx.strokeStyle='#c5fa5f88';ctx.lineWidth=2;ctx.setLineDash([7,8]);ctx.beginPath();ctx.moveTo(state.guard.x,state.guard.y);state.queue.forEach(id=>{const f=state.fans.find(f=>f.id===id);if(f)ctx.lineTo(f.x,f.y)});ctx.stroke();ctx.setLineDash([])}
 for(const f of state.fans)if(!f.normal&&f.type===6&&f.status==='active')drawConnection(ctx,f,time);
 const sorted=[...state.fans].sort((a,b)=>a.y-b.y);let guardDrawn=false;
 const guard=()=>{ctx.strokeStyle='#c5fa5f';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(state.guard.x,state.guard.y+2,26,9,0,0,Math.PI*2);ctx.stroke();drawSprite(ctx,0,state.guard.x,state.guard.y,94,false,1,state.queue.length&&!reduced?1+Math.sin(time*20)*.04:1);pixelText(ctx,'YOU',state.guard.x,state.guard.y-99,'#c5fa5f',13)};
 for(const f of sorted){if(!guardDrawn&&f.y>state.guard.y){guard();guardDrawn=true}drawFan(ctx,f,time)}if(!guardDrawn)guard();
 if(state.pulse>0){ctx.strokeStyle=`rgba(197,250,95,${state.pulse})`;ctx.lineWidth=8;ctx.beginPath();ctx.arc(state.guard.x,state.guard.y,(1-state.pulse)*1100,0,Math.PI*2);ctx.stroke();drawSprite(ctx,1,90+(1-state.pulse)*400,650,100);drawSprite(ctx,1,550-(1-state.pulse)*400,425,94)}
 for(const e of state.effects){ctx.save();ctx.globalAlpha=Math.min(1,e.life/e.max*2);if(e.particle){ctx.fillStyle=e.color;ctx.fillRect(e.x,e.y,5,5)}else pixelText(ctx,e.text,e.x,e.y,e.color,22);ctx.restore()}
}
function drawPreview(time){
 drawVenue(pctx,640,430,time);const fanPositions=[[105,258,2],[177,300,3],[270,263,2],[396,282,5],[490,250,3],[549,322,6],[116,385,3],[436,391,2],[327,347,4]];
 for(const [x,y,s] of fanPositions)drawSprite(pctx,s,x,y+(!reduced?Math.sin(time*3+x)*2:0),s===5?79:70,false,.94);
 drawSprite(pctx,0,245,401,115);drawSprite(pctx,1,358,406,116);
 pctx.fillStyle='#e24c72';pctx.fillRect(371,178,65,24);pixelText(pctx,'光害！',404,196,'#fff',16);
}
function frame(now){const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;if(mode!=='menu'){if(mode==='playing'||mode==='countdown')update(dt);drawGame()}requestAnimationFrame(frame)}
canvas.addEventListener('pointerdown',e=>{
 if(mode!=='playing')return;e.preventDefault();const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*640,y=(e.clientY-r.top)/r.height*720;
 const labelHit=state.fans.find(f=>{const box=fanLabel(f);return !f.normal&&f.status==='active'&&Math.abs(x-box.x)<=box.width/2+3&&y>=box.y-24&&y<=box.y+12});
 if(labelHit){chooseFan(labelHit);return}
 const candidates=state.fans.filter(f=>f.status==='active'&&Math.abs(x-f.x)<=(!f.normal&&f.type===1?76:55)&&y>=f.y-(f.normal?75:f.type===0?123:86)&&y<=f.y+17).sort((a,b)=>{const da=Math.hypot(x-a.x,(y-(a.y-42))*.65),db=Math.hypot(x-b.x,(y-(b.y-42))*.65);return da-db});
 if(candidates[0])chooseFan(candidates[0]);
});
document.addEventListener('keydown',e=>{
 if(e.repeat||$('helpDialog').open)return;
 if(e.key==='Escape'){if(mode==='playing'||mode==='countdown'){e.preventDefault();pause()}return}
 if(mode!=='playing')return;
 if(e.code==='Space'){e.preventDefault();special()}
 if(/^[0-9]$/.test(e.key)){const f=state.fans.find(f=>!f.normal&&f.key===Number(e.key)&&f.status==='active');if(f)chooseFan(f)}
});
$('startBtn').onclick=startGame;$('retryBtn').onclick=startGame;$('selectBtn').onclick=goMenu;$('backBtn').onclick=goMenu;$('pauseBtn').onclick=pause;$('resumeBtn').onclick=resume;$('specialBtn').onclick=special;
$('pauseDialog').addEventListener('cancel',e=>{e.preventDefault();resume()});$('resultDialog').addEventListener('cancel',e=>{e.preventDefault();goMenu()});
let helpPaused=false;
$('helpBtn').onclick=()=>{helpPaused=mode==='playing'||mode==='countdown';if(helpPaused){state.previousMode=mode;mode='paused'}$('helpDialog').showModal()};
$('helpDialog').addEventListener('close',()=>{if(helpPaused&&mode==='paused'){mode=state.previousMode;lastFrame=performance.now();updateHud()}helpPaused=false});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(mode==='playing'||mode==='countdown'))pause()});
Promise.all([portraits,venues].map(img=>new Promise((resolve,reject)=>{if(img.complete&&img.naturalWidth)resolve();else{img.onload=resolve;img.onerror=reject}}))).then(()=>{assetReady=true}).catch(()=>{assetError=true;$('startBtn').disabled=true;setText('missionBrief','画像を読み込めませんでした。ページを再読み込みしてください。')});
requestAnimationFrame(frame);
// Browser-native agent controls share the same state and actions as the visible controls.
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController();
 const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}};
 register({name:'get_mission_status',title:'現場の状態を確認',description:'Read the selected venue, lineup, current game phase and current score. Does not change the game.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({phase:mode,venue:chosenVenue,lineup:chosenGroup,remaining:state?.remaining??60,ejected:state?.count??0,score:state?.score??0})});
 register({name:'configure_mission',title:'現場を選ぶ',description:'Select one of four venues and four fictional idol groups on the mission-selection screen. Does not start play. Indices 0–3 follow the visible order.',inputSchema:{type:'object',properties:{venue:{type:'integer',minimum:0,maximum:3},lineup:{type:'integer',minimum:0,maximum:3}},required:['venue','lineup'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(mode!=='menu')throw new Error('Return to mission selection before configuring.');if(!input||!Number.isInteger(input.venue)||!Number.isInteger(input.lineup)||input.venue<0||input.venue>3||input.lineup<0||input.lineup>3)throw new Error('venue and lineup must be integers from 0 to 3.');chosenVenue=input.venue;chosenGroup=input.lineup;buildMenu();return {venue:VENUES[chosenVenue].name,lineup:GROUPS[chosenGroup].name}}});
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
