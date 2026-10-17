// Android Back regression tests: real game.js and HTML with a small DOM/clock adapter.
// Reuses the pending title-test adapter; no npm/workflow edits or native dependencies.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const SAVE_KEY = 'nexus-genba-records-v1';
const source = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
const nativeSource = fs.readFileSync(path.join(__dirname,
  'android/app/src/main/java/jp/kmccreativelab/idoldefense/MainActivity.java'), 'utf8');
// Execute the exact script sent by MainActivity, not a second implementation.
const nativeBackScript = JSON.parse(nativeSource.match(/BACK_SCRIPT = (".*");/)[1]);
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

class Element {
  constructor(attributes = '') {
    this.attributes = Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    this.id = this.attributes.id;
    this.dataset = Object.fromEntries(Object.entries(this.attributes).filter(([k]) => k.startsWith('data-')).map(([k,v]) => [k.slice(5),v]));
    this.classes = new Set((this.attributes.class || '').split(/\s+/).filter(Boolean));
    this.classList = {
      contains:c => this.classes.has(c),
      add:(...cs) => cs.forEach(c => this.classes.add(c)),
      remove:(...cs) => cs.forEach(c => this.classes.delete(c)),
      toggle:(c, force = !this.classes.has(c)) => { if (force) this.classes.add(c); else this.classes.delete(c); return force; },
    };
    this.style={}; this.listeners={}; this.children=[]; this.textContent=''; this.open=false;
    this.disabled=/(?:^|\s)disabled(?:\s|$)/.test(attributes);
    this.parentElement=this;
  }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  dispatch(type, init = {}) {
    const event = {type, defaultPrevented:false, preventDefault(){this.defaultPrevented=true;}, ...init};
    this['on'+type]?.(event);
    for (const fn of this.listeners[type] || []) fn(event);
    return event;
  }
  click() { assert.equal(this.disabled, false, `${this.id} is enabled`); this.dispatch('click'); }
  focus() { this.dispatch('focus'); }
  showModal() { this.open=true; }
  close() { if (this.open) {this.open=false; setImmediate(() => this.dispatch('close'));} }
  setAttribute(k,v) { this.attributes[k]=String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  set innerHTML(value) {
    this.markup=value;
    this.children=[...value.matchAll(/<button\b([^>]*)>/g)].map(m => new Element(m[1]));
  }
  get innerHTML() { return this.markup || ''; }
  querySelector(selector) { assert.equal(selector, 'small'); return this.small ??= new Element(); }
  insertAdjacentHTML() {} // HUD decoration; not part of the title assertions.
  getContext() { return new Proxy({}, {get:() => () => {}}); }
}

async function load({records, storage, audio='supported', storageBlocked=false, search='',
  url='https://kmc48.github.io/dol-genba-security/', gameSource=source} = {}) {
  const saved = storage || new Map([['unrelated-setting','keep']]);
  if (records !== undefined) saved.set(SAVE_KEY, records);
  const writes=[];
  const elements = new Map([...html.matchAll(/<[a-z][\w-]*\b([^>]*\bid="[^"]+"[^>]*)>/g)].map(m => {
    const element=new Element(m[1]); return [element.id,element];
  }));
  const el = id => { assert.ok(elements.has(id), `#${id} exists in real index.html`); return elements.get(id); };
  const document = new Element();
  document.body = new Element(html.match(/<body\b([^>]*)>/)[1]);
  document.getElementById=el;
  document.querySelectorAll = selector => {
    // v1.5 result roster draws one face canvas per entry.
    if (selector==='#resultBreakdown [data-face]') return [...el('resultBreakdown').innerHTML.matchAll(/<canvas([^>]*)>/g)].map(m => new Element(m[1]));
    const match=selector.match(/^\[data-(venue|group|close)\]$/);
    assert.ok(match, `supported selector ${selector}`);
    if (match[1]==='close') return [...html.matchAll(/<button\b([^>]*data-close="[^"]+"[^>]*)>/g)].map(m => new Element(m[1]));
    return el(match[1]==='venue' ? 'venues' : 'groups').children;
  };
  const calls={constructed:0,resume:0,suspend:0,starts:0};
  class AudioSpy {
    constructor(){calls.constructed++; this.currentTime=0; this.destination={};}
    resume(){calls.resume++; return audio==='resume-rejected' ? Promise.reject(new Error('blocked')) : Promise.resolve();}
    suspend(){calls.suspend++; return Promise.resolve();}
    createOscillator(){return {frequency:{},connect(){},start(){calls.starts++;},stop(){}};}
    createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
  }
  let now=0, nextFrame, seed=12345;
  const math=Object.create(Math);
  math.random=() => ((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const context=vm.createContext({
    console, document, Math:math,
    Image:class {constructor(){this.complete=true;this.naturalWidth=1254;}},
    window:{matchMedia:()=>({matches:false}),scrollTo(){},addEventListener(){},
      AudioContext:audio==='unsupported'||audio==='webkit' ? undefined : AudioSpy,
      webkitAudioContext:audio==='webkit' ? AudioSpy : undefined},
    localStorage:{getItem(k){if(storageBlocked)throw new Error('blocked');return saved.get(k)??null;},
      setItem(k,v){if(storageBlocked)throw new Error('blocked');writes.push([k,v]);saved.set(k,v);}},
    performance:{now:()=>now}, requestAnimationFrame(fn){nextFrame=fn;},
    location:new URL(search,url), URLSearchParams,
  });
  vm.runInContext(gameSource+`\nglobalThis.probe=()=>({mode,audioOn,titleChoice,assetReady,
    score:state?.score,remaining:state?.remaining,chosenVenue,chosenGroup,game:state?JSON.stringify(state):null});`,context,{filename:'game.js'});
  // Let the production Promise.all(image loads) set assetReady, rather than forcing it.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.probe().assetReady, true);
  return {el,document,calls,storage:saved,writes,
    // Test-only driver uses the real scoring/finish path; never shipped in game.js.
    finishWith({mistakes=0}={}) {vm.runInContext(`
      state.fans=[];state.count=1;state.missed=0;state.mistakes=${Number(mistakes)};
      state.idolDeparture=null;finish();`,context);},
    state:()=>context.probe(),
    back:()=>vm.runInContext(nativeBackScript,context),
    flush:()=>new Promise(resolve=>setImmediate(resolve)),
    visibility(hidden){document.hidden=hidden;document.dispatch('visibilitychange');},
    key:(key,init={})=>document.dispatch('keydown',{key,code:key===' '?'Space':key,repeat:false,...init}),
    tick(ms,frameMs=50){for(let passed=0;passed<ms;passed+=frameMs){now+=Math.min(frameMs,ms-passed);const callback=nextFrame;nextFrame=null;assert.ok(callback);callback(now);}},
  };
}

function screen(h, expected) {
  assert.equal(h.state().mode, expected);
  assert.equal(h.el('title').classList.contains('hidden'), expected!=='title');
  assert.equal(h.el('menu').classList.contains('hidden'), expected!=='menu');
  assert.equal(h.el('play').classList.contains('hidden'), expected==='title'||expected==='menu');
  assert.equal(h.document.body.classList.contains('on-title'), expected==='title');
  assert.equal(h.document.body.classList.contains('playing'), !['title','menu'].includes(expected));
}
function selection(h,index) {
  assert.equal(h.state().titleChoice,index);
  assert.equal(h.el('titleSound').classList.contains('selected'),index===0);
  assert.equal(h.el('titleMute').classList.contains('selected'),index===1);
}
function sound(h,on) {
  assert.equal(h.state().audioOn,on);
  assert.equal(h.el('soundBtn').textContent,on?'音 ON':'音 OFF');
  assert.equal(h.el('soundBtn').getAttribute('aria-label'),on?'サウンドをオフにする':'サウンドをオンにする');
}
function start(h) {h.el('startBtn').click();screen(h,'countdown');h.tick(3200);screen(h,'playing');}
function finish(h) {h.tick(60100);screen(h,'result');assert.equal(h.state().remaining,0);assert.equal(h.el('resultDialog').open,true);}
function start(g, {play=true, sound=false}={}) {
  g.el(sound?'titleSound':'titleMute').click();g.el('startBtn').click();
  if(play)g.tick(3200);
}
function visible(g, mode) {
  assert.equal(g.state().mode,mode);
  assert.equal(g.el('title').classList.contains('hidden'),mode!=='title');
  assert.equal(g.el('menu').classList.contains('hidden'),mode!=='menu');
  assert.equal(g.el('play').classList.contains('hidden'),mode==='title'||mode==='menu');
  assert.equal(g.document.body.classList.contains('on-title'),mode==='title');
}

test('root Back asks Android to background; no record/audio/screen mutation',async()=>{
  const g=await load();const before=g.state();
  assert.equal(g.back(),'background');assert.deepEqual(g.state(),before);
  visible(g,'title');assert.deepEqual(g.writes,[]);assert.equal(g.calls.constructed,0);
});

for(const sound of [false,true])test(`selection Back returns to title and keeps selection/audio (${sound})`,async()=>{
  const g=await load();g.el(sound?'titleSound':'titleMute').click();
  g.el('venues').children[2].click();g.el('groups').children[1].click();
  assert.equal(g.back(),'handled');visible(g,'title');
  assert.equal(g.state().chosenVenue,2);assert.equal(g.state().chosenGroup,1);
  assert.equal(g.state().audioOn,sound);assert.equal(g.state().titleChoice,sound?0:1);
  assert.equal(g.back(),'background');
  g.key('Enter');visible(g,'menu');assert.equal(g.state().audioOn,sound);
  assert.equal(g.writes.length,0);
});

for(const play of [false,true])test(`Back pauses ${play?'play':'countdown'}; repeated cycle resumes same game`,async()=>{
  const g=await load();start(g,{play});const prior=g.state().mode;
  for(let i=0;i<3;i++){
    assert.equal(g.back(),'handled');visible(g,'paused');assert.equal(g.el('pauseDialog').open,true);
    const paused=g.state().game;g.tick(10000);
    assert.equal(g.state().game,paused,'all game state is frozen, including time, queue, score and combo');
    assert.equal(g.back(),'handled');await g.flush();visible(g,prior);
    assert.equal(g.el('pauseDialog').open,false);assert.equal(g.state().game,paused,'resume does not reset state');
    g.tick(50);
  }
  assert.equal(g.writes.length,0,'pause never saves a partial score');
});

for(const origin of ['title','menu','countdown','playing','paused','result']){
  test(`help Back closes only help and restores ${origin}`,async()=>{
    const g=await load();
    if(origin==='menu')g.el('titleMute').click();
    if(['countdown','playing','paused','result'].includes(origin))start(g,{play:origin!=='countdown'});
    if(origin==='paused')g.el('pauseBtn').click();
    if(origin==='result')g.tick(61000);
    const before=g.state().game,writes=g.writes.length;
    g.el('helpBtn').click();assert.equal(g.el('helpDialog').open,true);
    g.tick(5000);assert.equal(g.state().remaining, before?JSON.parse(before).remaining:undefined);
    assert.equal(g.back(),'handled');assert.equal(g.el('helpDialog').open,false);
    await g.flush();visible(g,origin);
    assert.equal(g.el('pauseDialog').open,origin==='paused');
    assert.equal(g.el('resultDialog').open,origin==='result');
    assert.equal(g.writes.length,writes);
    if(origin==='playing'||origin==='countdown'){
      // Help uses previousMode but must retain all gameplay values.
      const after=JSON.parse(g.state().game),expected=JSON.parse(before);
      delete after.previousMode;delete expected.previousMode;assert.deepEqual(after,expected);
    }else assert.equal(g.state().game,before);
  });
}

test('pause UI -> selection -> title never saves an abandoned mission',async()=>{
  const g=await load({records:JSON.stringify({'0-0':{count:2,score:200}})});
  start(g);g.tick(4000);g.back();g.el('backBtn').click();await g.flush();visible(g,'menu');
  assert.equal(g.el('pauseDialog').open,false);g.back();visible(g,'title');
  assert.equal(g.el('titleBest').textContent,'HI-SCORE 200 pt');assert.equal(g.writes.length,0);
});

test('result -> selection -> title refreshes HI-SCORE and preserves records on reload',async()=>{
  const g=await load();start(g);
  g.key('1');g.tick(1000);assert.ok(g.state().score>0);
  g.tick(61000);visible(g,'result');assert.equal(g.el('resultDialog').open,true);
  assert.equal(g.writes.length,1);const saved=g.storage.get(SAVE_KEY),game=g.state().game;
  const top=Math.max(...Object.values(JSON.parse(saved)).map(b=>b.score));
  assert.equal(g.back(),'handled');await g.flush();visible(g,'menu');
  assert.equal(g.el('resultDialog').open,false);assert.equal(g.state().game,game);
  g.back();visible(g,'title');assert.equal(g.el('titleBest').textContent,`HI-SCORE ${top.toLocaleString()} pt`);
  assert.equal(g.back(),'background');assert.equal(g.writes.length,1);assert.equal(g.storage.get(SAVE_KEY),saved);
  const reloaded=await load({storage:g.storage});assert.equal(reloaded.el('titleBest').textContent,g.el('titleBest').textContent);
  assert.equal(reloaded.storage.get('unrelated-setting'),'keep');
});

test('visibility pause and Back use same resume operation',async()=>{
  const g=await load();start(g);g.visibility(true);visible(g,'paused');
  const paused=g.state().game;g.tick(5000);g.visibility(false);assert.equal(g.state().game,paused);
  g.back();await g.flush();visible(g,'playing');assert.equal(g.state().game,paused);
});

test('blocked localStorage does not break result, menu or title Back',async()=>{
  const g=await load({storageBlocked:true});start(g);g.tick(61000);
  g.back();await g.flush();visible(g,'menu');g.back();visible(g,'title');assert.equal(g.back(),'background');
});

test('native JS contract consumes missing/throwing handler, never requests background',()=>{
  assert.equal(vm.runInNewContext(nativeBackScript,{window:{}}),'handled');
  assert.equal(vm.runInNewContext(nativeBackScript,{window:{handleAndroidBack(){throw new Error('not ready');}}}),'handled');
});

// Visible "return to title" buttons share goTitle with Android Back.
for(const [from,button] of [['menu','menuTitleBtn'],['paused','pauseTitleBtn'],['result','resultTitleBtn']])
  test(`${button} returns to title from ${from} without saving an abandoned mission`,async()=>{
    const g=await load();
    if(from==='menu')g.el('titleSound').click();
    else{start(g,{sound:true});if(from==='paused')g.el('pauseBtn').click();else g.tick(61000);}
    const writes=g.writes.length;
    g.el(button).click();await g.flush();visible(g,'title');
    assert.equal(g.el('pauseDialog').open,false);assert.equal(g.el('resultDialog').open,false);
    assert.equal(g.document.body.classList.contains('playing'),false);
    assert.equal(g.writes.length,writes);assert.equal(g.state().titleChoice,0,'cursor follows current sound setting');
    g.key('Enter');visible(g,'menu');assert.equal(g.state().audioOn,true);
  });

test('header logo pauses a running mission and returns to title elsewhere',async()=>{
  const g=await load();start(g);
  const e=g.el('brandLink').dispatch('click');assert.equal(e.defaultPrevented,true);visible(g,'paused');
  g.el('backBtn').click();await g.flush();visible(g,'menu');
  g.el('brandLink').dispatch('click');visible(g,'title');
});

const S_CLEAR_KEY='dol-genba-s-clears-v1';
const releaseURLs=[
  'https://kmc48.github.io/dol-genba-security/',
  'http://127.0.0.1:8080/',
  'https://localhost/', // Android WebView
  'http://localhost/', // Older/configured Android WebView
  'capacitor://localhost/', // iOS WebView
  'file:///android_asset/public/index.html',
];
function assertLocked(g) {
  assert.equal(g.el('groups').children[4].disabled,true);
  assert.match(g.el('groups').innerHTML,/？？？[\s\S]*全アイドルS評価で出演/);
  assert.doesNotMatch(g.el('groups').innerHTML,/アニマルプラネット/);
}
function selectAnimal(g) {
  const card=g.el('groups').children[4];assert.equal(card.disabled,false);card.click();
  assert.equal(g.state().chosenGroup,4);assert.match(g.el('missionBrief').textContent,/動物園状態/);
}
function completeMission(g,group,venue=0,result={}) {
  g.el('venues').children[venue].click();g.el('groups').children[group].click();
  g.el('startBtn').click();g.tick(3200);g.finishWith(result);
  assert.equal(g.state().mode,'result');
}

test('release source ignores unlock URLs on Web, localhost and native origins',async()=>{
  for(const url of releaseURLs)for(const search of ['', '?unlock=animal', '?other=1&unlock=animal']) {
    const g=await load({url,search});g.el('titleMute').click();assertLocked(g);
    assert.deepEqual(g.writes,[]);
  }
});

test('regular S clears persist across restarts; only the fourth distinct group unlocks',async()=>{
  const storage=new Map([['unrelated-setting','keep']]),order=[2,0,3,1];
  for(let step=0;step<order.length;step++) {
    const g=await load({storage,search:'?unlock=animal'});g.el('titleMute').click();assertLocked(g);
    completeMission(g,order[step],step);
    assert.equal(g.el('rank').textContent,'S');
    assert.deepEqual(JSON.parse(storage.get(S_CLEAR_KEY)),order.slice(0,step+1));
    assert.equal(g.el('unlockNote').classList.contains('hidden'),step!==3);
    // A second completion or repeated S must not duplicate progress or re-announce the unlock.
    g.finishWith();assert.equal(g.writes.filter(([k])=>k===S_CLEAR_KEY).length,1);
    g.el('selectBtn').click();await g.flush();
    completeMission(g,order[step],(step+1)%4);
    assert.equal(g.writes.filter(([k])=>k===S_CLEAR_KEY).length,1);
    assert.equal(g.el('unlockNote').classList.contains('hidden'),true);
  }
  for(const url of releaseURLs) {
    const reloaded=await load({storage,url});reloaded.el('titleMute').click();selectAnimal(reloaded);
    assert.deepEqual(reloaded.writes,[]);
  }
  assert.equal(storage.get('unrelated-setting'),'keep');
});

test('A rank and abandoned missions cannot complete the fourth S clear',async()=>{
  const storage=new Map([[S_CLEAR_KEY,'[0,1,2]']]);
  const g=await load({storage});g.el('titleMute').click();
  completeMission(g,3,2,{mistakes:1});assert.equal(g.el('rank').textContent,'A');
  assert.equal(storage.get(S_CLEAR_KEY),'[0,1,2]');
  assert.equal(g.el('unlockNote').classList.contains('hidden'),true);
  g.el('selectBtn').click();await g.flush();assertLocked(g);
  g.el('startBtn').click();g.tick(3200);g.back();g.el('backBtn').click();await g.flush();
  assert.equal(storage.get(S_CLEAR_KEY),'[0,1,2]');
  const reloaded=await load({storage,search:'?unlock=animal'});assertLocked(reloaded);
});

test('missing or corrupt progress and unavailable storage fail closed without crashing',async()=>{
  for(const saved of ['not json','null','{}','[0,1,2,"3"]','[0,1,2,4]','[0,0,1,2]']) {
    const g=await load({storage:new Map([[S_CLEAR_KEY,saved]]),search:'?unlock=animal'});
    g.el('titleMute').click();assertLocked(g);
  }
  const blocked=await load({storageBlocked:true,search:'?unlock=animal'});
  blocked.el('titleMute').click();assertLocked(blocked);completeMission(blocked,0);
  assert.equal(blocked.el('rank').textContent,'S');
  assert.deepEqual(blocked.writes,[]);
  assertLocked(await load({storageBlocked:true,search:'?unlock=animal'}));
});

test('only an explicitly enabled dev server serves a temporary animal preview',async()=>{
  const {createGameServer}=await import('./serve.mjs');
  const {once}=require('node:events');
  for(const debugUnlock of [false,true]) {
    const server=createGameServer({debugUnlock});
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const url=`http://127.0.0.1:${server.address().port}/`;
    try {
      const response=await fetch(url+'game.js?unlock=animal');assert.equal(response.status,200);
      assert.equal(response.headers.get('cache-control'),'no-store');
      const gameSource=await response.text();
      assertLocked(await load({gameSource,url}));
      assertLocked(await load({gameSource,url,search:'?unlock=other'}));
      const storage=new Map([[S_CLEAR_KEY,'[0,1,2]']]);
      const g=await load({gameSource,url,storage,search:'?unlock=animal'});g.el('titleMute').click();
      if(debugUnlock) {
        selectAnimal(g);completeMission(g,4);assert.equal(g.el('rank').textContent,'S');
        assert.equal(storage.get(S_CLEAR_KEY),'[0,1,2]','hidden S cannot fill a regular clear');
        assertLocked(await load({storage,url,search:'?unlock=animal'}));
        assertLocked(await load({gameSource,storage,url}));
      } else {
        assert.equal(gameSource,source);assertLocked(g);assert.deepEqual(g.writes,[]);
      }
      assert.equal(await (await fetch(url+'index.html')).text(),html);
      assert.equal((await fetch(url+'serve.mjs')).status,404);
    } finally {
      await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
    }
  }
  assert.equal(fs.readFileSync(path.join(__dirname,'game.js'),'utf8'),source,'dev serving never edits source');
});

test('Web/native build output ignores unlock URLs even after dev preview use',async()=>{
  require('node:child_process').execFileSync(process.execPath,['build.mjs'],{cwd:__dirname});
  const built=fs.readFileSync(path.join(__dirname,'www/game.js'),'utf8');
  assert.equal(built,source);
  assert.equal(fs.existsSync(path.join(__dirname,'www/serve.mjs')),false);
  const config=JSON.parse(fs.readFileSync(path.join(__dirname,'capacitor.config.json'),'utf8'));
  assert.equal(config.webDir,'www');assert.ok(!config.server?.url);
  for(const url of releaseURLs) {
    const g=await load({gameSource:built,url,search:'?unlock=animal'});g.el('titleMute').click();assertLocked(g);
    const earned=await load({gameSource:built,url,storage:new Map([[S_CLEAR_KEY,'[0,1,2,3]']])});
    earned.el('titleMute').click();selectAnimal(earned);
  }
});

// Drive the production requestAnimationFrame callback at low and irregular frame rates.
test('60-second missions consume real foreground time at low FPS and after stalls',async()=>{
  for(const frameMs of [100,250,1000,5000]) {
    const g=await load();start(g,{play:false});g.tick(3050,frameMs);
    assert.equal(g.state().mode,'playing');
    g.tick(59000,frameMs);assert.equal(g.state().mode,'playing');
    assert.ok(g.state().remaining>0&&g.state().remaining<1.1);
    g.tick(1100,frameMs);assert.equal(g.state().mode,'result');
    assert.equal(g.state().remaining,0);
  }
});
test('long paused and background intervals do not consume mission time on resume',async()=>{
  const g=await load();start(g);g.tick(10000,100);
  g.visibility(true);const remaining=g.state().remaining;
  g.tick(120000,120000);assert.equal(g.state().remaining,remaining);
  g.visibility(false);g.el('resumeBtn').click();g.tick(1000,100);
  assert.ok(Math.abs(g.state().remaining-(remaining-1))<1e-8);
});
