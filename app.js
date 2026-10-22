(function(){
'use strict';
const J = window.JT;
const $ = s => document.querySelector(s);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS = 'jimtofTalk.v1';
const S = Object.assign({speed:1, listenFirst:true, showKana:true, showRomaji:true, shReps:1, rpModel:true, rpHint:'zh', done:{}, quiz:{}, best:{}}, (()=>{ try{ return JSON.parse(localStorage.getItem(LS))||{}; }catch(e){ return {}; } })());
function save(){ try{ localStorage.setItem(LS, JSON.stringify(S)); }catch(e){} updChips(); }
const CAT = {}, DLG = {}, ITEM = {};
J.cats.forEach(c => { CAT[c.id] = c;
  c.phrases.forEach(p => ITEM[p.id] = Object.assign({key:p.id, r:'me', a:p.id, cat:c.id}, p));
  c.dialogues.forEach(d => { d.cat = c.id; DLG[d.id] = d; d.lines.forEach((l,i) => ITEM[d.id+':'+i] = Object.assign({key:d.id+':'+i, cat:c.id, d:d.id}, l)); }); });
const ROLE = {me:'我（王）', f:'對方', f2:'對方', m2:'對方'};
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const CAN_REC = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

/* ---------- audio ---------- */
const audio = new Audio(); audio.preload = 'auto';
const mine = new Audio();
let token = 0;
const src = (a, slow) => `audio/${a}${(slow===undefined ? S.speed<1 : slow) ? '_s' : ''}.mp3`;
function stopAll(){ token++; [audio, mine].forEach(x => { try{ x.pause(); }catch(e){} x.onended = x.onerror = null; }); mark(null); clearTimeout(gapT); }
function mark(key){ document.querySelectorAll('.line.playing').forEach(e=>e.classList.remove('playing'));
  if(key){ const el = document.querySelector(`.line[data-key="${key}"]`); if(el){ el.classList.add('playing'); const r = el.getBoundingClientRect(); if(r.top > innerHeight-120 || r.top < 90) el.scrollIntoView({block:'center', behavior:'smooth'}); } } }
function playEl(el, url){ return new Promise(res => { el.onended = () => res(true); el.onerror = () => res(false); el.src = url; el.playbackRate = 1; const p = el.play(); if(p && p.catch) p.catch(() => res(false)); }); }
async function play(a, key, t){ if(t===undefined){ stopAll(); t = token; } mark(key); const ok = await playEl(audio, src(a)); if(t!==token) return false; mark(null); if(!ok) toast('音檔播放失敗'); return true; }
const wait = ms => new Promise(r => setTimeout(r, ms));
let gapT = null;
function durOf(a){ return new Promise(res => { const x = new Audio(); x.preload = 'metadata'; let done = false; const f = v => { if(!done){ done = true; res(v); } };
  x.onloadedmetadata = () => f(isFinite(x.duration) && x.duration > 0 ? x.duration : 2); x.onerror = () => f(2); x.src = src(a); setTimeout(() => f(2.5), 3000); }); }
async function playSeq(keys, gap=700){ stopAll(); const t = token;
  for(const k of keys){ if(t!==token) return false; await play(ITEM[k].a, k, t); if(t!==token) return false; await wait(gap); }
  return t===token; }

/* ---------- recording ---------- */
const REC = {}; let rec = null, recKey = null, recTimer = null;
function pickMime(){ if(!window.MediaRecorder || !MediaRecorder.isTypeSupported) return ''; for(const m of ['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus']) if(MediaRecorder.isTypeSupported(m)) return m; return ''; }
async function toggleRec(key){
  if(rec && rec.state === 'recording'){ rec.stop(); return; }
  if(!CAN_REC) return toast('此瀏覽器不支援錄音');
  stopAll();
  let stream;
  try{ stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}}); }
  catch(e){ return spRes(key, `<span class="score b">無法使用麥克風</span>：${e && e.name==='NotAllowedError' ? '權限被拒，請到瀏覽器／系統設定允許麥克風。' : esc(e && e.message || e)}`); }
  const mime = pickMime(); const chunks = [];
  try{ rec = mime ? new MediaRecorder(stream, {mimeType: mime}) : new MediaRecorder(stream); }catch(e){ rec = new MediaRecorder(stream); }
  recKey = key;
  rec.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = () => { clearTimeout(recTimer); stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, {type: rec.mimeType || mime || 'audio/mp4'});
    if(REC[key]) URL.revokeObjectURL(REC[key]); REC[key] = URL.createObjectURL(blob);
    rec = null; recKey = null; refreshSp(key); compare(key); };
  rec.start(); refreshSp(key);
  const d = await durOf(ITEM[key].a); recTimer = setTimeout(() => { if(rec && rec.state==='recording') rec.stop(); }, Math.min(20000, d*2500 + 3000));
}
async function compare(key){ stopAll(); const t = token; const it = ITEM[key];
  mark(key); await playEl(audio, src(it.a)); if(t!==token) return; await wait(400); if(t!==token || !REC[key]) return mark(null);
  await playEl(mine, REC[key]); mark(null); }
async function playMine(key){ if(!REC[key]) return; stopAll(); mark(key); await playEl(mine, REC[key]); mark(null); }

/* ---------- speech recognition ---------- */
const kata2hira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const normT = s => kata2hira(String(s).normalize('NFKC').toLowerCase()).replace(/[\s、。，,.!！?？・「」『』（）()〜~ー-]/g, '');
function lev(a, b){ const m = a.length, n = b.length; if(!m || !n) return Math.max(m, n); let p = Array.from({length:n+1}, (_, j) => j);
  for(let i=1;i<=m;i++){ const c = [i]; for(let j=1;j<=n;j++) c[j] = Math.min(p[j]+1, c[j-1]+1, p[j-1] + (a[i-1]===b[j-1]?0:1)); p = c; } return p[n]; }
function sim(a, b){ a = normT(a); b = normT(b); if(!a || !b) return 0; return 1 - lev(a, b) / Math.max(a.length, b.length); }
function scoreOf(heard, it){ return Math.round(100 * Math.max(...heard.map(h => Math.max(sim(h, it.ja), sim(h, it.kana))))); }
let srBusy = null;
function recognize(key, onDone){
  if(!SR) return toast('此瀏覽器不支援語音辨識');
  if(srBusy){ try{ srBusy.abort(); }catch(e){} srBusy = null; }
  stopAll(); const it = ITEM[key];
  const r = new SR(); r.lang = 'ja-JP'; r.interimResults = false; r.maxAlternatives = 5; r.continuous = false;
  srBusy = r; let got = false;
  spRes(key, '🗣 請說…（說完會自動停止）');
  r.onresult = e => { got = true; const alts = []; for(const res of e.results) for(const a of res) alts.push(a.transcript);
    const sc = scoreOf(alts, it); const cls = sc>=80?'g':sc>=55?'m':'b';
    if(sc > (S.best[key]||0)){ S.best[key] = sc; save(); }
    spRes(key, `辨識到：<b class="jp">${esc(alts[0]||'')}</b><br>相符度 <span class="score ${cls}">${sc}%</span> ${sc>=80?'👍 很好！':sc>=55?'差不多了，再試一次':'再聽一次示範，慢慢說'}`);
    onDone && onDone(sc); };
  r.onerror = e => { got = true; const m = {'not-allowed':'麥克風或語音辨識權限被拒（iPhone 需開啟「設定 › Siri」中的聽寫與 Siri）', 'service-not-allowed':'此模式下不能用語音辨識（iPhone 主畫面 App 模式可能不支援，請改用 Safari 開啟）', network:'語音辨識需要網路（飛機上請改用錄音對比）', 'no-speech':'沒有聽到聲音，再試一次', 'audio-capture':'找不到麥克風', aborted:'已取消'}[e.error] || e.error;
    spRes(key, `<span class="score b">${esc(m)}</span>`); onDone && onDone(null); };
  r.onend = () => { if(srBusy===r) srBusy = null; if(!got){ spRes(key, '沒有聽到聲音，再試一次'); onDone && onDone(null); } };
  try{ r.start(); }catch(e){ spRes(key, esc(e.message||e)); }
}

/* ---------- UI helpers ---------- */
function toast(m){ const t = $('#toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2000); }
function updChips(){ $('#speedBtn').textContent = (S.speed<1?'0.8':'1.0')+'x'; $('#speedBtn').classList.toggle('on', S.speed<1); }
const reveal = {};
function textHTML(it, lv){
  if(lv < 1) return `<button class="hiddenText" data-act="rv" data-k="${it.key}">👂 先聽聽看… 點這裡顯示日文</button>`;
  let h = `<div class="ja">${esc(it.ja)}</div>${S.showKana?`<div class="kana">${esc(it.kana)}</div>`:''}${S.showRomaji?`<div class="ro">${esc(it.ro)}</div>`:''}`;
  if(lv < 2) return h + `<div class="reveal-actions"><button class="btn sm ghost" data-act="rv" data-k="${it.key}">顯示中文</button></div>`;
  return h + `<div class="zh">${esc(it.zh)}</div>${it.note?`<div class="note">💡 ${esc(it.note)}</div>`:''}`;
}
function lineHTML(it, opts={}){
  const lv = S.listenFirst ? (reveal[it.key]||0) : 2; const me = it.r === 'me';
  return `<div class="line" data-key="${it.key}">
    <div class="lhead">${opts.num!=null?`<span class="small mute">${opts.num}</span>`:''}<span class="spk ${me?'me':''}">${ROLE[it.r]}</span>${S.best[it.key]!=null?`<span class="badge">最佳 ${S.best[it.key]}%</span>`:''}
      <div class="lbtns"><button class="ibtn" data-act="play" data-k="${it.key}" aria-label="播放">🔊</button><button class="ibtn" data-act="rep" data-k="${it.key}" aria-label="重複三次">🔁</button>${me?`<button class="ibtn" data-act="spk" data-k="${it.key}" aria-label="口說練習">🎙</button>`:''}</div></div>
    <div class="txt">${textHTML(it, lv)}</div>
    <div class="spbox"></div></div>`;
}
function spHTML(key){
  const recOn = recKey === key;
  return `<div class="sp"><div class="row">
    <button class="btn sm ghost" data-act="play" data-k="${key}">▶ 示範</button>
    ${CAN_REC?`<button class="btn sm rec ${recOn?'on':''}" data-act="rec" data-k="${key}">${recOn?'⏹ 停止錄音':'🎙 錄我的聲音'}</button>`:''}
    ${REC[key]?`<button class="btn sm ghost" data-act="mine" data-k="${key}">▶ 我的</button><button class="btn sm ghost" data-act="cmp" data-k="${key}">⇄ 示範→我的</button>`:''}
    ${SR?`<button class="btn sm alt" data-act="sr" data-k="${key}">🗣 說說看（辨識）</button>`:''}</div>
    <div class="res">${recOn?'🔴 錄音中…說完按「停止」':''}${!CAN_REC?'<span class="small mute">此瀏覽器不支援錄音。</span>':''}</div></div>`;
}
function refreshSp(key){ const b = document.querySelector(`.line[data-key="${key}"] .spbox`); if(b && b.innerHTML) { const r = b.querySelector('.res').innerHTML; b.innerHTML = spHTML(key); if(!rec || recKey!==key) b.querySelector('.res').innerHTML = r && !/錄音中/.test(r) ? r : ''; if(recKey===key) b.querySelector('.res').innerHTML='🔴 錄音中…說完按「停止」'; } const st = $('#stageRes'); if(st && key===curStageKey) renderStageSp(); }
function spRes(key, html){ const b = document.querySelector(`.line[data-key="${key}"] .spbox .res`) || (key===curStageKey && $('#stageRes .res')); if(b) b.innerHTML = html; }
function speedSeg(){ return `<div class="seg" role="group" aria-label="速度"><button data-act="spd" data-sp="0.8" class="${S.speed<1?'on':''}">慢 0.8x</button><button data-act="spd" data-sp="1" class="${S.speed>=1?'on':''}">正常 1x</button></div>`; }
function modeSeg(){ return `<div class="seg" role="group"><button data-act="mode" data-m="1" class="${S.listenFirst?'on':''}">聽力優先</button><button data-act="mode" data-m="0" class="${!S.listenFirst?'on':''}">顯示全文</button></div>`; }
function renderSide(cur){
  $('#side').innerHTML = `<a href="#/" class="${cur==='home'?'cur':''}">🏠 首頁</a>` + J.cats.map(c => `<a href="#/c/${c.id}" class="${cur===c.id?'cur':''}">${c.icon} ${esc(c.t)}<small>${c.phrases.length} 句・${c.dialogues.length} 段對話</small></a>`).join('') +
    `<a href="#/sh/all" class="${cur==='sh'?'cur':''}">🔁 全部跟讀</a>`;
}
function crumb(parts){ return `<div class="crumb"><a href="#/">首頁</a>${parts.map(p => ' › ' + (p[1]?`<a href="${p[1]}">${esc(p[0])}</a>`:esc(p[0]))).join('')}</div>`; }

/* ---------- views ---------- */
function supportHTML(){
  const y = (ok, t) => `<span class="${ok?'':'no'}">${ok?'✓':'✗'} ${t}</span>`;
  return `<div class="support">${y(true,'聽力／跟讀（離線可用）')}${y(CAN_REC,'錄音對比')}${y(!!SR,'語音辨識'+(SR?'（需網路）':''))}</div>`;
}
function viewHome(){
  renderSide('home');
  const nP = J.cats.reduce((a,c)=>a+c.phrases.length,0), nD = J.cats.reduce((a,c)=>a+c.dialogues.length,0);
  $('#view').innerHTML = `
  <h1>JIMTOF 2026 出差日語：聽力＋口說</h1>
  <p class="small mute">東京 Big Sight・${nP} 句實用句＋${nD} 段小對話（對方會怎麼回答）。先「只聽不看」，聽懂了再點開日文、羅馬拼音、中文。每一句都可以 🎙 錄自己的聲音和示範對比，也能跟讀（Shadowing）和角色扮演。</p>
  ${supportHTML()}
  <div class="row" style="margin:10px 0 14px">
    <a class="btn" style="text-decoration:none" href="#/c/c1">從打招呼開始</a>
    <a class="btn alt" style="text-decoration:none" href="#/sh/all">🔁 全部跟讀（${nP} 句）</a>
  </div>
  <div class="cards">${J.cats.map(c => { const qs = S.quiz[c.id];
    return `<a class="card" href="#/c/${c.id}"><div class="ic">${c.icon}</div><div class="ltitle">${esc(c.t)}</div><div class="small mute">${c.phrases.length} 句・${c.dialogues.length} 段對話${qs!=null?`・測驗 ${qs}%`:''}</div><div class="small mute jp" style="margin-top:4px">${esc(c.phrases[0].ja)}</div></a>`; }).join('')}</div>
  <h2>🎯 練習方式</h2>
  <div class="card small" style="display:grid;gap:6px">
    <div>👂 <b>聽力優先</b>：文字先蓋住，聽 2–3 次再點開。速度可切換「慢 0.8x／正常 1x」。</div>
    <div>🎙 <b>錄音對比</b>：每句按 🎙 →「錄我的聲音」→ 自動播放「示範 → 我的」對比。</div>
    <div>🔁 <b>跟讀</b>：播一句，留約 1.5 倍時間讓你跟著說，自動下一句。</div>
    <div>🎭 <b>角色扮演</b>：App 說對方的台詞，輪到你時只給中文提示，你用日文說。</div>
    <div>✏️ <b>聽力測驗</b>：聽對方的回答，選出意思。</div>
    <div>🗣 <b>語音辨識</b>（有網路且瀏覽器支援時）：顯示辨識到的日文和相符度。</div>
  </div>
  <h2>📱 加到主畫面（飛機上也能用）</h2>
  <div class="card small">
    <div><b>iPhone（Safari）</b>：分享 →「加入主畫面」。</div>
    <div><b>Galaxy Z Fold（Chrome）</b>：右上「⋮」→「加到主畫面／安裝應用程式」。</div>
    <div class="mute" style="margin-top:4px">第一次開啟時會把全部音檔存到裝置（約 3.5 MB），之後沒網路也能播放、跟讀、錄音對比（⚙︎ 可檢查）。語音辨識需要網路。</div>
  </div>
  <div class="foot">語音為 AI 合成（VOICEVOX：玄野武宏＝我、VOICEVOX:No.7、VOICEVOX:冥鳴ひまり、VOICEVOX:雀松朱司＝對方），已調整重音與問句語調；實際對話請以現場日本人說法為準。僅供個人學習使用。<br>文化日本語課本練習：<a href="https://thwang40.github.io/nh-study/">日文聽力練習 App</a></div>`;
}
function viewCat(cid, tab){
  const c = CAT[cid]; if(!c) return viewHome(); renderSide(cid);
  tab = tab || 'p';
  $('#view').innerHTML = `${crumb([[c.t]])}
  <h1>${c.icon} ${esc(c.t)}</h1>
  <div class="tabs"><a href="#/c/${cid}/p" class="${tab==='p'?'on':''}">📣 句子（${c.phrases.length}）</a><a href="#/c/${cid}/d" class="${tab==='d'?'on':''}">🎧 對話（${c.dialogues.length}）</a></div>
  ${tab==='p' ? `
  <div class="player"><div class="row"><button class="btn" id="playAll">▶ 全部播放</button>${speedSeg()}${modeSeg()}</div></div>
  <div class="row" style="margin:4px 0 10px"><a class="btn sm alt" style="text-decoration:none" href="#/sh/${cid}">🔁 跟讀這一組</a><a class="btn sm ghost" style="text-decoration:none" href="#/q/${cid}">✏️ 聽力測驗</a></div>
  <div class="lines">${c.phrases.map((p,i) => lineHTML(ITEM[p.id], {num:i+1})).join('')}</div>`
  : `<p class="small mute">每段對話都可以：先聽全部 → 點開文字 → 🎭 角色扮演（你說「我」的台詞）。</p>
  <div class="dlist">${c.dialogues.map(d => `<a class="card" href="#/d/${d.id}"><div class="lnum">${S.done[d.id]?'<span class="badge">已練習</span>':''}</div><div class="ltitle">${esc(d.t)}</div><div class="small mute">${esc(d.scene)}（${d.lines.length} 句）</div></a>`).join('')}</div>
  <div class="row" style="margin-top:10px"><a class="btn sm ghost" style="text-decoration:none" href="#/q/${cid}">✏️ 這一組的聽力測驗</a></div>`}
  ${nav(cid)}`;
  const pa = $('#playAll'); if(pa) pa.onclick = () => { if(pa.textContent.includes('停止')){ stopAll(); pa.textContent='▶ 全部播放'; return; } pa.textContent='⏹ 停止'; playSeq(c.phrases.map(p=>p.id), 900).then(()=>{ pa.textContent='▶ 全部播放'; }); };
}
function nav(cid){ const i = J.cats.findIndex(c=>c.id===cid), p = J.cats[i-1], n = J.cats[i+1];
  return `<div class="row" style="margin-top:16px">${p?`<a class="btn ghost" style="text-decoration:none" href="#/c/${p.id}">‹ ${esc(p.t)}</a>`:''}${n?`<a class="btn ghost" style="text-decoration:none" href="#/c/${n.id}">${esc(n.t)} ›</a>`:''}</div>`; }
function viewDlg(did){
  const d = DLG[did]; if(!d) return viewHome(); const c = CAT[d.cat]; renderSide(c.id);
  const keys = d.lines.map((_,i)=>did+':'+i);
  const idx = c.dialogues.indexOf(d), nx = c.dialogues[idx+1];
  $('#view').innerHTML = `${crumb([[c.t,'#/c/'+c.id+'/d'],[d.t]])}
  <h1>${esc(d.t)}</h1><div class="scene">🎬 ${esc(d.scene)}</div>
  <div class="player"><div class="row"><button class="btn" id="playAll">▶ 全部播放</button>${speedSeg()}${modeSeg()}</div></div>
  <div class="row" style="margin:4px 0 10px"><a class="btn sm alt" style="text-decoration:none" href="#/rp/${did}">🎭 角色扮演（我說王的台詞）</a></div>
  <div class="lines">${keys.map(k => lineHTML(ITEM[k])).join('')}</div>
  <div class="row" style="margin-top:14px"><a class="btn ghost" style="text-decoration:none" href="#/q/${c.id}">✏️ 聽力測驗</a>${nx?`<a class="btn ghost" style="text-decoration:none" href="#/d/${nx.id}">下一段 ›</a>`:`<a class="btn ghost" style="text-decoration:none" href="#/c/${c.id}/d">回對話列表</a>`}</div>`;
  const pa = $('#playAll'); pa.onclick = () => { if(pa.textContent.includes('停止')){ stopAll(); pa.textContent='▶ 全部播放'; return; } pa.textContent='⏹ 停止';
    playSeq(keys, 700).then(ok => { pa.textContent='▶ 全部播放'; if(ok){ S.done[did] = true; save(); toast('聽完了 👍 試試角色扮演'); } }); };
}

/* ---------- shadowing ---------- */
let curStageKey = null, SH = null;
function renderStageSp(){ const b = $('#stageRes'); if(!b || !curStageKey) return; const r = b.querySelector('.res'); const keep = r ? r.innerHTML : '';
  b.innerHTML = spHTML(curStageKey).replace('<div class="sp">','<div class="sp" style="margin-top:12px">'); if(keep && recKey!==curStageKey) b.querySelector('.res').innerHTML = keep; }
function viewShadow(scope){
  const list = scope==='all' ? J.cats.flatMap(c=>c.phrases.map(p=>p.id)) : (CAT[scope] ? CAT[scope].phrases.map(p=>p.id) : null);
  if(!list) return viewHome(); renderSide(scope==='all'?'sh':scope);
  SH = {list, i:0, on:false, showText:true};
  $('#view').innerHTML = `${crumb(scope==='all'?[['全部跟讀']]:[[CAT[scope].t,'#/c/'+scope],['跟讀']])}
  <h1>🔁 跟讀（Shadowing）${scope==='all'?'・全部':''}</h1>
  <p class="small mute">播放示範 → 進度條跑完前（約 1.5 倍時間）換你大聲跟著說 → 自動下一句。</p>
  <div class="row">${speedSeg()}<div class="seg"><button data-shr="1" class="${S.shReps==1?'on':''}">每句 1 次</button><button data-shr="2" class="${S.shReps==2?'on':''}">2 次</button><button data-shr="3" class="${S.shReps==3?'on':''}">3 次</button></div>
    <div class="seg"><button data-sht="1" class="on">顯示文字</button><button data-sht="0">隱藏文字</button></div></div>
  <div class="stage" id="stage"></div>
  <div class="row"><button class="btn" id="shGo">▶ 開始跟讀</button><button class="btn ghost" id="shPrev">‹ 上一句</button><button class="btn ghost" id="shNext">下一句 ›</button></div>`;
  document.querySelectorAll('[data-shr]').forEach(b => b.onclick = () => { S.shReps = +b.dataset.shr; save(); document.querySelectorAll('[data-shr]').forEach(x=>x.classList.toggle('on', x===b)); });
  document.querySelectorAll('[data-sht]').forEach(b => b.onclick = () => { SH.showText = b.dataset.sht==='1'; document.querySelectorAll('[data-sht]').forEach(x=>x.classList.toggle('on', x===b)); shStage(); });
  $('#shGo').onclick = () => { if(SH.on){ shStop(); } else { SH.on = true; $('#shGo').textContent = '⏸ 暫停'; shRun(); } };
  $('#shPrev').onclick = () => { const was = SH.on; shStop(); SH.i = Math.max(0, SH.i-1); shStage(); if(was) $('#shGo').click(); };
  $('#shNext').onclick = () => { const was = SH.on; shStop(); SH.i = Math.min(SH.list.length-1, SH.i+1); shStage(); if(was) $('#shGo').click(); };
  shStage();
}
function shStage(phase){ const it = ITEM[SH.list[SH.i]]; curStageKey = it.key;
  $('#stage').innerHTML = `<div class="small mute">${SH.i+1} / ${SH.list.length}・${esc(CAT[it.cat].t)}</div>
  ${SH.showText?`<div class="big">${esc(it.ja)}</div>${S.showKana?`<div class="kana">${esc(it.kana)}</div>`:''}${S.showRomaji?`<div class="ro">${esc(it.ro)}</div>`:''}`:`<div class="big mute">👂（文字已隱藏）</div>`}
  <div class="zh">${esc(it.zh)}</div>
  <div id="shPhase">${phase||''}</div><div class="gapbar"><i id="gapI"></i></div><div id="stageRes"></div>`;
  renderStageSp(); }
function shStop(){ if(!SH) return; SH.on = false; stopAll(); const b = $('#shGo'); if(b) b.textContent = '▶ 繼續跟讀'; const g = $('#gapI'); if(g){ g.style.transition='none'; g.style.width='0'; } }
async function shRun(){
  stopAll(); const t = token;
  while(SH && SH.on && t===token){
    const it = ITEM[SH.list[SH.i]];
    for(let r=0; r<S.shReps; r++){
      shStage('🔊 聽示範…'); const d = await durOf(it.a); if(t!==token) return;
      await play(it.a, null, t); if(t!==token) return;
      const gap = Math.max(1.5, d*1.5);
      $('#shPhase').innerHTML = `<div class="yourturn">🗣 換你說！</div>`;
      const g = $('#gapI'); g.style.transition = 'none'; g.style.width = '0'; void g.offsetWidth; g.style.transition = `width ${gap}s linear`; g.style.width = '100%';
      await new Promise(res => { gapT = setTimeout(res, gap*1000); }); if(t!==token) return;
    }
    if(SH.i >= SH.list.length-1){ SH.on = false; $('#shGo').textContent = '▶ 從頭再來'; SH.i = 0; toast('跟讀完成 👏'); return; }
    SH.i++;
  }
}

/* ---------- role-play ---------- */
let RP = null;
function viewRole(did){
  const d = DLG[did]; if(!d) return viewHome(); const c = CAT[d.cat]; renderSide(c.id);
  RP = {d, i:0, on:false};
  $('#view').innerHTML = `${crumb([[c.t,'#/c/'+c.id+'/d'],[d.t,'#/d/'+did],['角色扮演']])}
  <h1>🎭 角色扮演：${esc(d.t)}</h1><div class="scene">🎬 ${esc(d.scene)}。App 說「對方」的台詞；輪到「我」時看提示，用日文說出來。</div>
  <div class="row">${speedSeg()}<div class="seg"><button data-rph="zh" class="${S.rpHint==='zh'?'on':''}">提示：只給中文</button><button data-rph="ja" class="${S.rpHint==='ja'?'on':''}">給日文</button></div>
    <div class="seg"><button data-rpm="1" class="${S.rpModel?'on':''}">說完播正確說法</button><button data-rpm="0" class="${!S.rpModel?'on':''}">不播</button></div></div>
  <div class="bubbles" id="bubs"></div>
  <div class="stage" id="stage" style="min-height:120px"><div class="mute">按「開始」</div></div>
  <div class="row"><button class="btn" id="rpGo">▶ 開始</button><button class="btn ghost" id="rpNext">跳過 ›</button><button class="btn ghost" id="rpAgain">↺ 重來</button></div>`;
  document.querySelectorAll('[data-rph]').forEach(b => b.onclick = () => { S.rpHint = b.dataset.rph; save(); document.querySelectorAll('[data-rph]').forEach(x=>x.classList.toggle('on', x===b)); });
  document.querySelectorAll('[data-rpm]').forEach(b => b.onclick = () => { S.rpModel = b.dataset.rpm==='1'; save(); document.querySelectorAll('[data-rpm]').forEach(x=>x.classList.toggle('on', x===b)); });
  $('#rpGo').onclick = () => { if(RP.on){ RP.on = false; stopAll(); $('#rpGo').textContent = '▶ 繼續'; } else { RP.on = true; $('#rpGo').textContent = '⏸ 暫停'; rpRun(); } };
  $('#rpNext').onclick = () => { stopAll(); rpBubble(RP.i); RP.i++; if(RP.on) rpRun(); else rpPrompt(); };
  $('#rpAgain').onclick = () => viewRole(did);
}
function rpBubble(i){ const l = RP.d.lines[i]; if(!l) return; const b = $('#bubs');
  b.insertAdjacentHTML('beforeend', `<div class="bub ${l.r==='me'?'me':''}"><div class="small mute">${ROLE[l.r]}</div><div class="ja">${esc(l.ja)}</div>${S.showRomaji?`<div class="ro">${esc(l.ro)}</div>`:''}<div class="small">${esc(l.zh)}</div></div>`); }
function rpPrompt(){ const l = RP.d.lines[RP.i]; if(!l){ $('#stage').innerHTML = `<div class="yourturn">🎉 完成！</div><div class="small mute">再來一次可以改成「只給中文」提示挑戰自己。</div>`; $('#rpGo').textContent='▶ 開始'; RP.on=false; S.done[RP.d.id] = true; save(); return false; } return true; }
async function rpRun(){
  stopAll(); const t = token;
  while(RP.on && t===token){
    if(!rpPrompt()) return;
    const i = RP.i, l = RP.d.lines[i], key = RP.d.id+':'+i; curStageKey = key;
    if(l.r !== 'me'){
      $('#stage').innerHTML = `<div class="small mute">${ROLE[l.r]}</div><div class="big mute">🔊 對方說話中…</div><div class="small mute">（聽完會顯示文字）</div>`;
      await play(l.a, null, t); if(t!==token) return;
      rpBubble(i); RP.i++; await wait(500);
    } else {
      const d = await durOf(l.a); if(t!==token) return; const gap = Math.max(2.5, d*1.5 + 1);
      $('#stage').innerHTML = `<div class="small mute">輪到你（我）</div><div class="yourturn">🗣 換你說：</div>
        <div class="big" style="font-size:20px">${S.rpHint==='ja'?esc(l.ja):'「'+esc(l.zh)+'」'}</div>${S.rpHint==='ja'&&S.showRomaji?`<div class="ro">${esc(l.ro)}</div>`:''}
        <div class="gapbar"><i id="gapI"></i></div>
        <div class="row" style="margin-top:8px">${SR?`<button class="btn sm alt" id="rpSR">🗣 用辨識檢查</button>`:''}</div><div class="sp" style="background:none;border:0;padding:0"><div class="res" id="rpRes"></div></div>`;
      const g = $('#gapI'); void g.offsetWidth; g.style.transition = `width ${gap}s linear`; g.style.width = '100%';
      const res = await new Promise(r => { gapT = setTimeout(() => r('time'), gap*1000);
        const b = $('#rpSR'); if(b) b.onclick = () => { clearTimeout(gapT); g.style.transition='none'; g.style.width='0'; b.disabled = true;
          recognizeTo(l, key, '#rpRes', () => r('sr')); }; });
      if(t!==token) return;
      if(res==='sr') await wait(1500);
      if(t!==token) return;
      if(S.rpModel){ const st = $('#stage'); st.insertAdjacentHTML('beforeend', `<div class="small" style="margin-top:6px">✅ 正確說法：<b>${esc(l.ja)}</b></div>`); await play(l.a, null, t); if(t!==token) return; }
      rpBubble(i); RP.i++; await wait(400);
    }
  }
}
function recognizeTo(it, key, sel, done){
  const target = Object.assign({}, it); const box = () => $(sel);
  if(!SR) return done();
  const r = new SR(); r.lang='ja-JP'; r.maxAlternatives=5; r.interimResults=false; let got=false;
  box().innerHTML = '🗣 請說…';
  r.onresult = e => { got=true; const alts=[]; for(const x of e.results) for(const a of x) alts.push(a.transcript); const sc = scoreOf(alts, target); const cls = sc>=80?'g':sc>=55?'m':'b';
    if(sc > (S.best[key]||0)){ S.best[key]=sc; save(); } box().innerHTML = `辨識到：<b>${esc(alts[0]||'')}</b>・相符度 <span class="score ${cls}">${sc}%</span>`; };
  r.onerror = e => { got=true; box().innerHTML = `<span class="score b">辨識失敗：${esc(e.error)}${e.error==='network'?'（需要網路）':''}</span>`; };
  r.onend = () => { if(!got) box().innerHTML = '沒有聽到聲音'; done(); };
  try{ r.start(); }catch(e){ done(); }
}

/* ---------- quiz ---------- */
let Q = null;
const shuffle = a => { a = a.slice(); for(let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; };
function viewQuiz(cid){
  const c = CAT[cid]; if(!c) return viewHome(); renderSide(cid);
  const staff = c.dialogues.flatMap(d => d.lines.map((l,i)=>d.id+':'+i).filter(k => ITEM[k].r!=='me'));
  const phr = c.phrases.map(p=>p.id);
  const pickKeys = shuffle(staff).slice(0, 6).concat(shuffle(phr).slice(0, Math.max(3, 8-Math.min(6, staff.length))));
  const all = Object.values(ITEM);
  const qs = shuffle(pickKeys).map((k, n) => { const it = ITEM[k]; const type = n%3===2 ? 'hear' : 'mean'; const f = type==='hear' ? 'ja' : 'zh';
    const same = shuffle(all.filter(x => x.cat===it.cat && x[f]!==it[f])), other = shuffle(all.filter(x => x[f]!==it[f]));
    const opts = []; const seen = new Set([it[f]]); for(const x of same.concat(other)){ if(opts.length>=3) break; if(!seen.has(x[f])){ seen.add(x[f]); opts.push(x[f]); } }
    return {k, type, ans: it[f], opts: shuffle(opts.concat([it[f]]))}; });
  Q = {cid, qs, i:0, score:0}; renderQ();
}
function renderQ(){
  const q = Q.qs[Q.i], it = ITEM[q.k], c = CAT[Q.cid];
  $('#view').innerHTML = `${crumb([[c.t,'#/c/'+c.id],['聽力測驗']])}
  <h1>✏️ ${esc(c.t)}・聽力測驗</h1><div class="small mute">第 ${Q.i+1} / ${Q.qs.length} 題・答對 ${Q.score}</div><div class="bar"><i style="width:${Q.i/Q.qs.length*100}%"></i></div>
  <div class="card" style="margin-top:10px"><div class="q">${q.type==='hear'?'🎧 你聽到的是哪一句？':(it.r==='me'?'🎧 這句話是什麼意思？':'🎧 對方說了什麼？')}</div>
  <div class="row" style="margin-bottom:10px"><button class="btn" id="qPlay">🔊 再聽一次</button>${speedSeg()}</div>
  <div class="opts">${q.opts.map((o,i)=>`<button class="opt ${q.type==='hear'?'jp':''}" data-o="${i}">${esc(o)}</button>`).join('')}</div>
  <div class="row" style="margin-top:10px"><button class="btn sm alt" id="qIdk">🙋 聽不懂</button></div><div id="qFb"></div></div>`;
  $('#qPlay').onclick = () => play(it.a);
  document.querySelectorAll('.opt').forEach(b => b.onclick = () => ansQ(q.opts[+b.dataset.o], b));
  $('#qIdk').onclick = () => ansQ(null, null);
  setTimeout(() => play(it.a), 250);
}
function ansQ(ch, btn){
  const q = Q.qs[Q.i]; if(q.done) return; q.done = true; const it = ITEM[q.k]; const ok = ch === q.ans;
  document.querySelectorAll('.opt').forEach(b => { b.disabled = true; if(q.opts[+b.dataset.o]===q.ans) b.classList.add('right'); }); if(btn && !ok) btn.classList.add('wrong'); $('#qIdk').disabled = true;
  if(ok) Q.score++;
  $('#qFb').innerHTML = `<div class="result ${ok?'good':'bad'}">${ok?'⭕ 答對了！':'再聽一次，對照文字 👇'}</div><div class="ja">${esc(it.ja)}</div><div class="kana">${esc(it.kana)}</div><div class="ro">${esc(it.ro)}</div><div class="zh">${esc(it.zh)}</div>${it.note?`<div class="note">💡 ${esc(it.note)}</div>`:''}
  <div class="small mute" style="margin-top:4px">出自：${esc(CAT[it.cat].t)}${it.d?'・對話「'+esc(DLG[it.d].t)+'」':'・句子'}</div>
  <div class="row" style="margin-top:10px"><button class="btn" id="qNext">${Q.i+1<Q.qs.length?'下一題 ›':'看結果'}</button></div>`;
  $('#qNext').onclick = () => { stopAll(); Q.i++; if(Q.i < Q.qs.length) renderQ(); else { const pct = Math.round(Q.score/Q.qs.length*100); S.quiz[Q.cid] = Math.max(S.quiz[Q.cid]||0, pct); save();
    $('#view').innerHTML = `${crumb([[CAT[Q.cid].t,'#/c/'+Q.cid],['結果']])}<h1>結果</h1><div class="card"><div style="font-size:40px;font-weight:800;color:${pct>=80?'var(--ok)':'#c62828'}">${pct}%</div><div>答對 ${Q.score} / ${Q.qs.length}</div>
    <div class="row" style="margin-top:12px"><button class="btn" id="again">再測一次</button><a class="btn ghost" style="text-decoration:none" href="#/c/${Q.cid}/d">回對話</a></div></div>`; $('#again').onclick = () => viewQuiz(Q.cid); } };
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if(!b) return; const a = b.dataset.act, k = b.dataset.k;
  if(a==='play') play(ITEM[k].a, k);
  else if(a==='rep'){ stopAll(); const t = token; (async () => { for(let r=0;r<3;r++){ if(t!==token) return; await play(ITEM[k].a, k, t); await wait(900); } })(); toast('重複 3 次'); }
  else if(a==='rv'){ reveal[k] = Math.min(2, (reveal[k]||0)+1); const el = document.querySelector(`.line[data-key="${k}"] .txt`); if(el) el.innerHTML = textHTML(ITEM[k], reveal[k]); }
  else if(a==='spk'){ const box = document.querySelector(`.line[data-key="${k}"] .spbox`); if(box.innerHTML){ box.innerHTML=''; b.classList.remove('on'); } else { box.innerHTML = spHTML(k); b.classList.add('on'); if(S.listenFirst && (reveal[k]||0) < 1){ reveal[k] = 1; document.querySelector(`.line[data-key="${k}"] .txt`).innerHTML = textHTML(ITEM[k], 1); } } }
  else if(a==='rec') toggleRec(k);
  else if(a==='mine') playMine(k);
  else if(a==='cmp') compare(k);
  else if(a==='sr') recognize(k);
  else if(a==='spd'){ S.speed = +b.dataset.sp; save(); document.querySelectorAll('[data-act="spd"]').forEach(x => x.classList.toggle('on', +x.dataset.sp===S.speed)); }
  else if(a==='mode'){ S.listenFirst = b.dataset.m==='1'; save(); route(); }
});
$('#speedBtn').onclick = () => { S.speed = S.speed<1 ? 1 : 0.8; save(); toast(S.speed<1?'慢速 0.8x':'正常 1x'); document.querySelectorAll('[data-act="spd"]').forEach(x => x.classList.toggle('on', +x.dataset.sp===S.speed)); };
$('#settingsBtn').onclick = openSettings;
$('#sheet').addEventListener('click', e => { if(e.target.id==='sheet') $('#sheet').classList.add('hidden'); });
async function cacheInfo(){ if(!('caches' in window)) return '此瀏覽器不支援離線快取';
  try{ let n = 0; for(const k of await caches.keys()){ const c = await caches.open(k); n += (await c.keys()).filter(r => /\.mp3$/.test(r.url)).length; } return `已離線儲存音檔：${n} / ${J.audio.length*2}`; }catch(e){ return '無法讀取'; } }
async function openSettings(){
  $('#sheetBody').innerHTML = `<h2 style="margin-top:0">⚙︎ 設定</h2><div class="card" style="display:grid;gap:12px">
    <div><b>假名</b> <div class="seg"><button data-kana="1" class="${S.showKana?'on':''}">顯示</button><button data-kana="0" class="${!S.showKana?'on':''}">隱藏</button></div></div>
    <div><b>羅馬拼音</b> <div class="seg"><button data-ro="1" class="${S.showRomaji?'on':''}">顯示</button><button data-ro="0" class="${!S.showRomaji?'on':''}">隱藏</button></div></div>
    <div><b>這台裝置支援</b>${supportHTML()}<div class="small mute">${isIOS?'iPhone：語音辨識需在「設定 › Siri」開啟 Siri／聽寫，並需要網路；若主畫面 App 模式不能辨識，請改用 Safari 開啟。錄音對比離線也能用。':'Android：請用 Chrome（Samsung Internet 可能不支援語音辨識）。語音辨識需要網路。'}${standalone?'（目前：主畫面 App 模式）':''}</div></div>
    <div><b>離線</b><div class="small" id="ci">檢查中…</div><button class="btn sm ghost" id="dl" style="margin-top:6px">⬇︎ 下載全部音檔</button></div>
    <div><b>重設</b> <button class="btn sm ghost" id="rs">清除進度與分數</button></div></div>
    <div class="foot">版本 1.0・資料只存在本裝置。錄音只在本機播放，不會上傳。</div><div class="row" style="margin-top:10px"><button class="btn" id="cl">完成</button></div>`;
  $('#sheet').classList.remove('hidden'); $('#ci').textContent = await cacheInfo();
  document.querySelectorAll('[data-kana]').forEach(b => b.onclick = () => { S.showKana = b.dataset.kana==='1'; save(); openSettings(); route(true); });
  document.querySelectorAll('[data-ro]').forEach(b => b.onclick = () => { S.showRomaji = b.dataset.ro==='1'; save(); openSettings(); route(true); });
  $('#dl').onclick = async () => { const c = await caches.open(AUDIO_CACHE); let n = 0; const urls = J.audio.flatMap(a => [`audio/${a}.mp3`, `audio/${a}_s.mp3`]);
    for(const u of urls){ try{ if(!(await c.match(u))) await c.add(u); }catch(e){} if(++n % 20 === 0) $('#ci').textContent = `下載中… ${n}/${urls.length}`; } $('#ci').textContent = await cacheInfo(); };
  $('#rs').onclick = () => { if(confirm('確定清除？')){ S.done={}; S.quiz={}; S.best={}; save(); route(true); openSettings(); } };
  $('#cl').onclick = () => $('#sheet').classList.add('hidden');
}
const AUDIO_CACHE = 'jt-audio-v1';
function route(keepSheet){
  stopAll(); if(rec && rec.state==='recording') rec.stop(); if(srBusy) try{ srBusy.abort(); }catch(e){}
  if(SH) SH.on = false; if(RP) RP.on = false; curStageKey = null;
  if(keepSheet!==true) $('#sheet').classList.add('hidden');
  const [a, b, c] = location.hash.replace(/^#\/?/, '').split('/');
  if(a==='c') viewCat(b, c); else if(a==='d') viewDlg(b); else if(a==='sh') viewShadow(b); else if(a==='rp') viewRole(b); else if(a==='q') viewQuiz(b); else viewHome();
  updChips(); if(keepSheet!==true) window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => route());
route();
if('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
})();
