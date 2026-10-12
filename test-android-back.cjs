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
  'android/app/src/main/java/jp/kmccreativelab/dolgenba/MainActivity.java'), 'utf8');
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

async function load({records, storage, audio='supported', storageBlocked=false} = {}) {
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
  });
  vm.runInContext(source+`\nglobalThis.probe=()=>({mode,audioOn,titleChoice,assetReady,
    score:state?.score,remaining:state?.remaining,chosenVenue,chosenGroup,game:state?JSON.stringify(state):null});`,context,{filename:'game.js'});
  // Let the production Promise.all(image loads) set assetReady, rather than forcing it.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(context.probe().assetReady, true);
  return {el,document,calls,storage:saved,writes,
    state:()=>context.probe(),
    back:()=>vm.runInContext(nativeBackScript,context),
    flush:()=>new Promise(resolve=>setImmediate(resolve)),
    visibility(hidden){document.hidden=hidden;document.dispatch('visibilitychange');},
    key:(key,init={})=>document.dispatch('keydown',{key,code:key===' '?'Space':key,repeat:false,...init}),
    tick(ms){for(let passed=0;passed<ms;passed+=50){now+=Math.min(50,ms-passed);const callback=nextFrame;nextFrame=null;assert.ok(callback);callback(now);}},
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
