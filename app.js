(function(){
'use strict';
/* 展會會話（JIMTOF 2026 出差日語）— 版面與操作沿用「撿角日語」：BAOJE 型錄配色、聽力優先（點文字：日文 → 中文 → 隱藏）、
   書本式對話框（左：說話者／右：台詞）、重點句型紅字粗體、🗣 開口練習（只給場景，💡 提示要點了才出現，答案＝原句＋2 種說法）、
   🔍 搜尋（依分類分組、🎧 聽力模式）、🙋 我不會 → 複習清單、離線下載與自動更新。 */
const J = window.JT;
const $ = s => document.querySelector(s);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS = 'jimtofTalk.v1';
const S = Object.assign({speed:1, showKana:true, showRomaji:true, shReps:1, done:{}, quiz:{}, best:{}, review:{}, sListen:false}, (()=>{ try{ return JSON.parse(localStorage.getItem(LS))||{}; }catch(e){ return {}; } })());
// v2.0：預設 1x；之前選過慢速的裝置重設一次
if(S.spd1 !== 1){ S.speed = 1; S.spd1 = 1; }
function save(){ try{ localStorage.setItem(LS, JSON.stringify(S)); }catch(e){} updChips(); }
const CAT = {}, DLG = {}, ITEM = {};
J.cats.forEach(c => { CAT[c.id] = c;
  c.phrases.forEach((p, i) => ITEM[p.id] = Object.assign({key:p.id, r:'me', a:p.id, cat:c.id, n:i}, p));
  c.dialogues.forEach(d => { d.cat = c.id; DLG[d.id] = d; d.lines.forEach((l,i) => ITEM[d.id+':'+i] = Object.assign({key:d.id+':'+i, cat:c.id, d:d.id, n:i}, l)); }); });
const ME = '王';
const who = it => it.r === 'me' ? ME : (it.d ? DLG[it.d].pn : '對方');
const WHO_COLOR = {me:'#1d6434', other:'#1b5fa8'};
const wcol = it => it.r === 'me' ? WHO_COLOR.me : WHO_COLOR.other;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const CAN_REC = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const kid = k => String(k).replace(/[^\w]/g, '_');
const revCount = () => Object.keys(S.review).filter(k => ITEM[k]).length;

/* ---------- 重點句型：紅字粗體 ---------- */
function patRanges(t){ const R = [];
  J.pat.forEach(([m]) => { let i = t.indexOf(m); while(i >= 0){ const a = i, b = i + m.length; if(!R.some(r => a < r[1] && b > r[0])) R.push([a, b]); i = t.indexOf(m, i + 1); } });
  return R.sort((x, y) => x[0] - y[0]); }
function hiJa(t){ const R = patRanges(t); let h = '', p = 0; R.forEach(([a, b]) => { h += esc(t.slice(p, a)) + `<b class="kp">${esc(t.slice(a, b))}</b>`; p = b; }); return h + esc(t.slice(p)); }
function patsIn(texts){ const out = []; J.pat.forEach(P => { if(texts.some(t => patRanges(t).some(([a, b]) => t.slice(a, b) === P[0])) && !out.includes(P)) out.push(P); }); return out; }
function patListHTML(texts, title){ const ps = patsIn(texts); if(!ps.length) return '';
  return `<details class="patbox"><summary>📌 ${title||'重點句型'}（${ps.length}）</summary><div class="patlist">${ps.map(p => `<div><b class="kp">${esc(p[1])}</b><span class="small mute">　${esc(p[2])}</span></div>`).join('')}</div></details>`; }

/* ---------- audio ---------- */
const audio = new Audio(); audio.preload = 'auto';
const mine = new Audio();
let token = 0, gapT = null;
const src = (a, slow) => `audio/${a}${(slow===undefined ? S.speed<1 : slow) ? '_s' : ''}.mp3`;
function stopAll(){ token++; [audio, mine].forEach(x => { try{ x.pause(); }catch(e){} x.onended = x.onerror = null; }); mark(null); clearTimeout(gapT); }
function mark(key){ document.querySelectorAll('.playing').forEach(e=>e.classList.remove('playing'));
  if(key){ const el = document.querySelector(`.srow[data-key="${key}"]`); if(el){ el.classList.add('playing'); const r = el.getBoundingClientRect(); if(r.top > innerHeight-120 || r.top < 120) el.scrollIntoView({block:'center', behavior:'smooth'}); } } }
function playEl(el, url){ return new Promise(res => { el.onended = () => res(true); el.onerror = () => res(false); el.src = url; el.playbackRate = 1; const p = el.play(); if(p && p.catch) p.catch(() => res(false)); }); }
async function play(a, key, t){ if(t===undefined){ stopAll(); t = token; } mark(key); const ok = await playEl(audio, src(a)); if(t!==token) return false; mark(null); if(!ok) toast('音檔播放失敗'); return true; }
const wait = ms => new Promise(r => setTimeout(r, ms));
function durOf(a){ return new Promise(res => { const x = new Audio(); x.preload = 'metadata'; let done = false; const f = v => { if(!done){ done = true; res(v); } };
  x.onloadedmetadata = () => f(isFinite(x.duration) && x.duration > 0 ? x.duration : 2); x.onerror = () => f(2); x.src = src(a); setTimeout(() => f(2.5), 3000); }); }
let seqOn = null;
async function playSeq(keys, gap=700, reps=1){ stopAll(); const t = token;
  for(const k of keys){ for(let r=0;r<reps;r++){ if(t!==token) return false; await play(ITEM[k].a, k, t); if(t!==token) return false; await wait(gap); } }
  return t===token; }

/* ---------- recording (🎙) ---------- */
const REC = {}; let rec = null, recKey = null, recTimer = null;
function pickMime(){ if(!window.MediaRecorder || !MediaRecorder.isTypeSupported) return ''; for(const m of ['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus']) if(MediaRecorder.isTypeSupported(m)) return m; return ''; }
async function toggleRec(key){
  if(rec && rec.state === 'recording'){ rec.stop(); return; }
  if(!CAN_REC) return toast('此瀏覽器不支援錄音');
  stopAll(); let stream;
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
function scoreOf(heard, its){ return Math.round(100 * Math.max(...heard.flatMap(h => its.flatMap(it => [sim(h, it.ja), sim(h, it.kana)])))); }
let srBusy = null;
function recognize(key){
  if(!SR) return toast('此瀏覽器不支援語音辨識');
  if(srBusy){ try{ srBusy.abort(); }catch(e){} srBusy = null; }
  stopAll(); const it = ITEM[key];
  const r = new SR(); r.lang = 'ja-JP'; r.interimResults = false; r.maxAlternatives = 5; r.continuous = false;
  srBusy = r; let got = false;
  spRes(key, '🗣 請說…（說完會自動停止）');
  r.onresult = e => { got = true; const alts = []; for(const res of e.results) for(const a of res) alts.push(a.transcript);
    const sc = scoreOf(alts, [it]); const cls = sc>=80?'g':sc>=55?'m':'b';
    if(sc > (S.best[key]||0)){ S.best[key] = sc; save(); }
    spRes(key, `辨識到：<b class="jp">${esc(alts[0]||'')}</b><br>相符度 <span class="score ${cls}">${sc}%</span> ${sc>=80?'👍 很好！':sc>=55?'差不多了，再試一次':'再聽一次示範，慢慢說'}`); };
  r.onerror = e => { got = true; const m = {'not-allowed':'麥克風或語音辨識權限被拒（iPhone 需開啟「設定 › Siri」中的聽寫與 Siri）', 'service-not-allowed':'此模式下不能用語音辨識（iPhone 主畫面 App 模式可能不支援，請改用 Safari 開啟）', network:'語音辨識需要網路（飛機上請改用錄音對比）', 'no-speech':'沒有聽到聲音，再試一次', 'audio-capture':'找不到麥克風', aborted:'已取消'}[e.error] || e.error;
    spRes(key, `<span class="score b">${esc(m)}</span>`); };
  r.onend = () => { if(srBusy===r) srBusy = null; if(!got) spRes(key, '沒有聽到聲音，再試一次'); };
  try{ r.start(); }catch(e){ spRes(key, esc(e.message||e)); }
}

/* ---------- UI helpers ---------- */
function toast(m){ const t = $('#toast'); t.textContent = m; t.classList.remove('hidden'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 2000); }
function updChips(){ $('#speedBtn').textContent = (S.speed<1?'0.7':'1.0')+'x'; $('#speedBtn').classList.toggle('on', S.speed<1); $('#reviewCount').textContent = revCount(); }
let reveal = {};   // key -> 0 遮住／1 日文／2 日文＋中文（不儲存；換頁就回到聽力優先）
function maskHTML(t){ const n = Math.max(3, [...t].length), per = 22; let h = '';
  for(let r = n; r > 0; r -= per) h += `<span class="mask" style="width:${Math.min(r, per)*0.95+0.5}em"></span>`;
  return h + `<span class="sr">（點一下顯示日文）</span>`; }
function textBody(it, lv){
  if(lv < 1) return maskHTML(it.ja);
  return `<div class="ja">${hiJa(it.ja)}</div>${S.showKana?`<div class="kana">${esc(it.kana)}</div>`:''}${S.showRomaji?`<div class="ro">${esc(it.ro)}</div>`:''}` +
    (lv >= 2 ? `<div class="zh">${esc(it.zh)}</div>${it.note?`<div class="note">💡 ${esc(it.note)}</div>`:''}` : ''); }
// 書本式一行：左＝說話者（句子頁＝編號），中＝台詞（先遮住），右＝🔊 🔁 🎙 🙋
function rowHTML(it, opts={}){
  const lv = reveal[it.key]||0, me = it.r === 'me';
  const left = opts.num != null ? `<div class="snum">${opts.num}</div>` : `<div class="sname" style="color:${wcol(it)}">${esc(who(it))}<span class="colon">：</span></div>`;
  return `<div class="srow${opts.num!=null?' prow':''}${S.review[it.key]?' unf':''}" data-key="${it.key}">${left}
    <div class="stext${lv?'':' masked'}" data-act="rv" data-k="${it.key}" role="button" tabindex="0" aria-label="${lv>=2?'再點一次隱藏':lv?'顯示中文':'顯示日文'}">${textBody(it, lv)}${opts.extra||''}</div>
    <div class="sbtns"><button class="ibtn s" data-act="play" data-k="${it.key}" aria-label="播放" title="播放">🔊</button><button class="ibtn s" data-act="rep" data-k="${it.key}" aria-label="重複三次" title="重複三次">🔁</button>${me?`<button class="ibtn s" data-act="spk" data-k="${it.key}" aria-label="錄音對比" title="錄音對比／辨識">🎙</button>`:''}<button class="ibtn s" data-act="idk" data-k="${it.key}" aria-label="我不會（看出處並加入複習）" title="我不會">🙋</button></div>
  </div><div class="srcbox" id="src-${kid(it.key)}"></div><div class="spbox" id="sp-${kid(it.key)}"></div>`; }
function rerender(key, opts){ const el = document.querySelector(`.srow[data-key="${key}"]`); if(!el) return; const it = ITEM[key];
  const o = Object.assign({}, el.classList.contains('prow') ? {num: el.querySelector('.snum').textContent} : {}, opts||{}, curRowOpts(key));
  const tmp = document.createElement('div'); tmp.innerHTML = rowHTML(it, o); el.replaceWith(tmp.querySelector('.srow')); }
let curRowOpts = () => ({});
function blkBtn(on){ return `<button class="bshow${on?' on':''}" data-act="bshow" aria-pressed="${on}" title="${on?'回到聽力優先（隱藏這一段）':'這一段顯示全文'}">${on?'🙈 隱藏':'👁 顯示全文'}</button>`; }
function speedSeg(){ return `<div class="seg" role="group" aria-label="速度"><button data-act="spd" data-sp="0.7" class="${S.speed<1?'on':''}">0.7x</button><button data-act="spd" data-sp="1" class="${S.speed>=1?'on':''}">1x</button></div>`; }
function spHTML(key){
  const recOn = recKey === key;
  return `<div class="sp"><div class="row">
    <button class="btn sm ghost" data-act="play" data-k="${key}">▶ 示範</button>
    ${CAN_REC?`<button class="btn sm rec ${recOn?'on':''}" data-act="rec" data-k="${key}">${recOn?'⏹ 停止錄音':'🎙 錄我的聲音'}</button>`:''}
    ${REC[key]?`<button class="btn sm ghost" data-act="mine" data-k="${key}">▶ 我的</button><button class="btn sm ghost" data-act="cmp" data-k="${key}">⇄ 示範→我的</button>`:''}
    ${SR?`<button class="btn sm alt" data-act="sr" data-k="${key}">🗣 說說看（辨識）</button>`:''}</div>
    <div class="res">${recOn?'🔴 錄音中…說完按「停止」':''}${!CAN_REC?'<span class="small mute">此瀏覽器不支援錄音。</span>':''}</div></div>`; }
function refreshSp(key){ const b = document.getElementById('sp-'+kid(key)); if(b && b.innerHTML){ const r = b.querySelector('.res').innerHTML; b.innerHTML = spHTML(key); if(!rec || recKey!==key) b.querySelector('.res').innerHTML = r && !/錄音中/.test(r) ? r : ''; if(recKey===key) b.querySelector('.res').innerHTML='🔴 錄音中…說完按「停止」'; }
  if(key===curStageKey) renderStageSp(); }
function spRes(key, html){ const b = document.querySelector(`#sp-${kid(key)} .res`) || (key===curStageKey && $('#stageRes .res')); if(b) b.innerHTML = html; }
// 🙋 我不會：出處＋提醒＋重點句型＋另外兩種說法
function srcHTML(key){ const it = ITEM[key], c = CAT[it.cat], d = it.d ? DLG[it.d] : null;
  const ps = patsIn([it.ja]); const R = J.rp[it.ja];
  return `<div class="src"><button class="srcx" data-act="srcclose" data-k="${key}">收起 ▲</button>
    <div><b>出處</b>：${c.icon} ${esc(c.t)} › ${d ? `<a href="#/d/${d.id}">對話「${esc(d.t)}」</a>第 ${it.n+1} 句（${esc(who(it))}）` : `<a href="#/c/${c.id}/p">句子</a> 第 ${it.n+1} 句`}</div>
    ${it.note?`<div style="margin-top:6px">💡 ${esc(it.note)}</div>`:''}
    ${ps.length?`<div class="srch"><b>重點句型</b>${ps.map(p => `<div class="gent"><b class="kp">${esc(p[1])}</b> <span class="small mute">${esc(p[2])}</span></div>`).join('')}</div>`:''}
    ${R?`<div class="srch"><b>也可以這樣說</b>${R[1].map((a, j) => `<div class="alt"><button class="ibtn s" data-act="altplay" data-a="${esc(it.a)}-r_${j}" aria-label="播放">🔊</button><div><div class="ja">${hiJa(a[0])}</div>${S.showKana?`<div class="kana">${esc(a[1])}</div>`:''}<div class="zh">${esc(a[3])}</div></div></div>`).join('')}</div>`:''}
    <div class="small mute" style="margin-top:8px">已加入 📝 複習清單</div></div>`; }
function crumb(parts){ return `<div class="crumb"><a href="#/">首頁</a>${parts.map(p => ' › ' + (p[1]?`<a href="${p[1]}">${esc(p[0])}</a>`:esc(p[0]))).join('')}</div>`; }
function renderSide(cur){
  $('#side').innerHTML = searchFormHTML('', 'sside') + `<a href="#/" class="${cur==='home'?'cur':''}">🏠 首頁</a><a href="#/review" class="${cur==='review'?'cur':''}">📝 複習清單（${revCount()}）</a>` +
    J.cats.map(c => { const n = c.dialogues.filter(d => S.done[d.id]).length; return `<a href="#/c/${c.id}" class="${cur===c.id?'cur':''}">${c.icon} ${esc(c.t)}<small>${c.phrases.length} 句・${c.dialogues.length} 段對話・${n}/${c.dialogues.length} 完成</small></a>`; }).join('') +
    `<a href="#/sh/all" class="${cur==='sh'?'cur':''}">🔁 全部跟讀</a>`; }

/* ---------- views ---------- */
function supportHTML(){ const y = (ok, t) => `<span class="${ok?'':'no'}">${ok?'✓':'✗'} ${t}</span>`;
  return `<div class="support">${y(true,'聽力／跟讀（離線可用）')}${y(CAN_REC,'錄音對比')}${y(!!SR,'語音辨識'+(SR?'（需網路）':''))}</div>`; }
function viewHome(){
  renderSide('home');
  const nP = J.cats.reduce((a,c)=>a+c.phrases.length,0), nD = J.cats.reduce((a,c)=>a+c.dialogues.length,0), doneD = Object.keys(DLG).filter(id => S.done[id]).length;
  $('#view').innerHTML = `
  <div class="hero"><h1>展會會話</h1><div class="sub">JIMTOF 2026 出差日語・聽力＋口說</div></div>
  <p class="small mute">東京 Big Sight・${nP} 句實用句＋${nD} 段小對話（對方會怎麼回答）。先「只聽不看」，點文字：第 1 次顯示日文、第 2 次加中文、第 3 次再隱藏。聽不懂按 🙋，會告訴你出處、重點句型，並加入複習清單。</p>
  ${searchFormHTML('', 'home')}
  <div class="row" style="margin:8px 0 14px">
    <a class="btn" style="text-decoration:none" href="#/c/c1">從打招呼開始</a>
    <a class="btn ghost" style="text-decoration:none" href="#/sh/all">🔁 全部跟讀</a>
    <a class="btn alt" style="text-decoration:none" href="#/review">📝 複習清單（${revCount()}）</a>
    <span class="small mute">已練習對話 ${doneD}/${nD}</span>
  </div>
  <div class="grid">${J.cats.map(c => { const qs = S.quiz[c.id], n = c.dialogues.filter(d => S.done[d.id]).length;
    return `<a class="card" href="#/c/${c.id}"><div class="ic">${c.icon}</div><div class="ltitle">${esc(c.t)}</div><div class="small mute">${c.phrases.length} 句・${c.dialogues.length} 段對話${qs!=null?`・測驗 ${qs}%`:''}</div><div class="bar"><i style="width:${Math.round(n/c.dialogues.length*100)}%"></i></div></a>`; }).join('')}</div>
  <h2>練習方式</h2>
  <div class="card small" style="display:grid;gap:6px">
    <div>👂 <b>聽力優先</b>：文字先蓋住，聽 2–3 次再點開。速度 0.7x／1x（預設 1x）。每一段也可以按「👁 顯示全文」。</div>
    <div>🗣 <b>開口練習</b>：選一個角色，對方的台詞自動播放；輪到你時只顯示場景，想一想再開口說，需要時才按「💡 看提示」，最後看 3 種說法（原句＋2 種自然說法）。</div>
    <div>🎙 <b>錄音對比</b>：「我」的每一句都有 🎙 → 錄我的聲音 → 自動播放「示範 → 我的」。</div>
    <div>🔁 <b>跟讀</b>：播一句，留約 1.5 倍時間讓你跟著說，自動下一句。</div>
    <div>🙋 <b>我不會</b>：顯示出處、重點句型和另外兩種說法，加入 📝 複習清單。</div>
    <div>✏️ <b>聽力測驗</b>：聽對方的回答，選出意思。</div>
    <div>🔍 <b>搜尋</b>：日文、假名、中文都可以；打開「🎧 聽力模式」就只聽不看。</div>
  </div>
  ${supportHTML()}
  <h2>加到主畫面（飛機上也能用）</h2>
  <div class="card small">
    <div><b>iPhone（Safari）</b>：分享 →「加入主畫面」。</div>
    <div><b>Android（Chrome）</b>：右上「⋮」→「加到主畫面／安裝應用程式」。</div>
    <div class="mute" style="margin-top:4px">第一次開啟後音檔會自動存到裝置；到 ⚙︎ 設定按「下載全部離線資料」可確認全部存好（約 12 MB）。語音辨識需要網路。</div>
  </div>
  <div class="foot">語音為 AI 合成（VOICEVOX：玄野武宏＝我、VOICEVOX:No.7、VOICEVOX:冥鳴ひまり、VOICEVOX:雀松朱司＝對方），已調整重音與問句語調；開口練習的另外兩種說法為本 App 自編。實際對話請以現場日本人說法為準。僅供個人學習使用。</div>
  <div style="display:flex;justify-content:flex-end;margin:10px 0 4px;font-size:11px"><a href="https://thwang40.github.io/nh-study/" style="color:#9aa0a6;text-decoration:none">撿角日語 ›</a></div>`;
}
function viewCat(cid, tab){
  const c = CAT[cid]; if(!c) return viewHome(); renderSide(cid); reveal = {};
  tab = tab || 'p';
  const texts = c.phrases.map(p => p.ja).concat(c.dialogues.flatMap(d => d.lines.map(l => l.ja)));
  $('#view').innerHTML = `${crumb([[c.t]])}
  <h1>${c.icon} ${esc(c.t)}</h1>
  <div class="tabs"><a href="#/c/${cid}/p" class="${tab==='p'?'on':''}">📣 句子（${c.phrases.length}）</a><a href="#/c/${cid}/d" class="${tab==='d'?'on':''}">🎧 對話（${c.dialogues.length}）</a></div>
  ${tab==='p' ? `
  <div class="player"><div class="row"><button class="btn" id="playAll">▶ 全部播放</button>${speedSeg()}</div></div>
  ${patListHTML(texts, '這一組的重點句型')}
  <div class="script" data-blk><div class="blkbar">${blkBtn(false)}</div>${c.phrases.map((p,i) => rowHTML(ITEM[p.id], {num:i+1})).join('')}</div>
  <div class="small mute" style="margin-top:6px">點文字：第 1 次顯示日文、第 2 次加中文、第 3 次再隱藏。🔊 播放　🔁 重複三次　🎙 錄音對比　🙋 我不會（看出處、加入複習）</div>
  <div class="row" style="margin:12px 0 4px"><a class="btn sm alt" style="text-decoration:none" href="#/sh/${cid}">🔁 跟讀這一組</a><a class="btn sm ghost" style="text-decoration:none" href="#/q/${cid}">✏️ 聽力測驗</a></div>`
  : `<p class="small mute">每段對話：先聽全部 → 點開文字 → 🗣 開口練習（選一個角色，輪到你時開口說）。</p>
  <div class="dlist">${c.dialogues.map(d => `<a class="card" href="#/d/${d.id}"><div class="lnum">${S.done[d.id]?'<span class="badge">已練習</span>':''}</div><div class="ltitle">${esc(d.t)}</div><div class="small mute">🎬 ${esc(d.scene)}（${d.lines.length} 句）</div></a>`).join('')}</div>
  <div class="row" style="margin-top:10px"><a class="btn sm ghost" style="text-decoration:none" href="#/q/${cid}">✏️ 這一組的聽力測驗</a></div>`}
  ${nav(cid)}`;
  const pa = $('#playAll'); if(pa) pa.onclick = () => { if(pa.textContent.includes('停止')){ stopAll(); pa.textContent='▶ 全部播放'; return; } pa.textContent='⏹ 停止'; playSeq(c.phrases.map(p=>p.id), 900).then(()=>{ pa.textContent='▶ 全部播放'; }); };
}
function nav(cid){ const i = J.cats.findIndex(c=>c.id===cid), p = J.cats[i-1], n = J.cats[i+1];
  return `<div class="row" style="margin-top:16px">${p?`<a class="btn ghost" style="text-decoration:none" href="#/c/${p.id}">‹ ${esc(p.t)}</a>`:''}${n?`<a class="btn ghost" style="text-decoration:none" href="#/c/${n.id}">${esc(n.t)} ›</a>`:''}</div>`; }
// 一個輪次超過三句 → 逐句聽力練習（目前的對話每輪最多兩句，所以不會出現）
const sentences = t => t.match(/[^。！？!?]+[。！？!?]?/g) || [t];
function viewDlg(did){
  const d = DLG[did]; if(!d) return viewHome(); const c = CAT[d.cat]; renderSide(c.id); reveal = {};
  const keys = d.lines.map((_,i)=>did+':'+i);
  const idx = c.dialogues.indexOf(d), nx = c.dialogues[idx+1];
  const long = keys.filter(k => sentences(ITEM[k].ja).length > 3);
  $('#view').innerHTML = `${crumb([[c.t,'#/c/'+c.id+'/d'],[d.t]])}
  <h1>${esc(d.t)}</h1><div class="scene">🎬 ${esc(d.scene)}</div>
  <div class="player"><div class="row"><button class="btn" id="playAll">▶ 全部播放</button>${speedSeg()}</div></div>
  <div class="script" data-blk><div class="blkbar"><a class="rpbtn" href="#/rp/${did}" title="選一個角色，輪到你時開口說">🗣 開口練習</a>${blkBtn(false)}</div>${keys.map(k => rowHTML(ITEM[k])).join('')}</div>
  <div class="small mute" style="margin-top:6px">點文字：第 1 次顯示日文、第 2 次加中文、第 3 次再隱藏。🔊 播放　🔁 重複三次　🎙 錄音對比　🙋 我不會（看出處、加入複習）</div>
  ${long.length ? `<section class="splitsec"><div class="splithead"><h2>🎧 逐句聽力練習</h2></div>${long.map(k => `<div class="small">${esc(who(ITEM[k]))}：${sentences(ITEM[k].ja).map(s => `<div class="ja">${esc(s)}</div>`).join('')}</div>`).join('')}</section>` : ''}
  ${patListHTML(d.lines.map(l => l.ja), '這段對話的重點句型')}
  <div class="row" style="margin-top:14px"><a class="btn alt" style="text-decoration:none" href="#/rp/${did}">🗣 開口練習</a><a class="btn ghost" style="text-decoration:none" href="#/q/${c.id}">✏️ 聽力測驗</a>${nx?`<a class="btn ghost" style="text-decoration:none" href="#/d/${nx.id}">下一段 ›</a>`:`<a class="btn ghost" style="text-decoration:none" href="#/c/${c.id}/d">回對話列表</a>`}</div>`;
  const pa = $('#playAll'); pa.onclick = () => { if(pa.textContent.includes('停止')){ stopAll(); pa.textContent='▶ 全部播放'; return; } pa.textContent='⏹ 停止';
    playSeq(keys, 700).then(ok => { pa.textContent='▶ 全部播放'; if(ok){ S.done[did] = true; save(); toast('聽完了 👍 試試開口練習'); } }); };
}
function viewReview(){
  renderSide('review'); reveal = {};
  const ks = Object.keys(S.review).filter(k => ITEM[k]).sort((a, b) => (S.review[b].t||0) - (S.review[a].t||0));
  curRowOpts = k => ({extra: `<div class="reveal-actions"><span class="small mute">${esc(CAT[ITEM[k].cat].t)}${ITEM[k].d?'・'+esc(DLG[ITEM[k].d].t):'・句子'}</span><button class="btn sm ok" data-act="got" data-k="${k}">✓ 我會了</button></div>`});
  $('#view').innerHTML = `${crumb([['複習清單']])}<h1>📝 複習清單（${ks.length}）</h1>
  ${ks.length ? `<div class="player"><div class="row"><button class="btn" id="playAll">▶ 全部播放</button>${speedSeg()}</div></div>
  <div class="script" data-blk><div class="blkbar">${blkBtn(false)}</div>${ks.map(k => rowHTML(ITEM[k], curRowOpts(k))).join('')}</div>` : `<div class="card small mute">還沒有。聽不懂的句子按 🙋「我不會」，就會出現在這裡。</div>`}`;
  const pa = $('#playAll'); if(pa) pa.onclick = () => { if(pa.textContent.includes('停止')){ stopAll(); pa.textContent='▶ 全部播放'; return; } pa.textContent='⏹ 停止'; playSeq(ks, 800).then(()=>{ pa.textContent='▶ 全部播放'; }); };
}

/* ---------- shadowing ---------- */
let curStageKey = null, SH = null;
function renderStageSp(){ const b = $('#stageRes'); if(!b || !curStageKey) return; const r = b.querySelector('.res'); const keep = r ? r.innerHTML : '';
  b.innerHTML = spHTML(curStageKey).replace('<div class="sp">','<div class="sp" style="margin-top:12px">'); if(keep && recKey!==curStageKey) b.querySelector('.res').innerHTML = keep; }
function viewShadow(scope){
  const list = scope==='all' ? J.cats.flatMap(c=>c.phrases.map(p=>p.id)) : (CAT[scope] ? CAT[scope].phrases.map(p=>p.id) : null);
  if(!list) return viewHome(); renderSide(scope==='all'?'sh':scope);
  SH = {list, i:0, on:false, lv:0};
  $('#view').innerHTML = `${crumb(scope==='all'?[['全部跟讀']]:[[CAT[scope].t,'#/c/'+scope],['跟讀']])}
  <h1>🔁 跟讀（Shadowing）${scope==='all'?'・全部':''}</h1>
  <p class="small mute">播放示範 → 進度條跑完前（約 1.5 倍時間）換你大聲跟著說 → 自動下一句。文字先蓋住，點一下才顯示。</p>
  <div class="row">${speedSeg()}<div class="seg"><button data-shr="1" class="${S.shReps==1?'on':''}">每句 1 次</button><button data-shr="2" class="${S.shReps==2?'on':''}">2 次</button><button data-shr="3" class="${S.shReps==3?'on':''}">3 次</button></div></div>
  <div class="stage" id="stage"></div>
  <div class="row"><button class="btn" id="shGo">▶ 開始跟讀</button><button class="btn ghost" id="shPrev">‹ 上一句</button><button class="btn ghost" id="shNext">下一句 ›</button></div>`;
  document.querySelectorAll('[data-shr]').forEach(b => b.onclick = () => { S.shReps = +b.dataset.shr; save(); document.querySelectorAll('[data-shr]').forEach(x=>x.classList.toggle('on', x===b)); });
  $('#shGo').onclick = () => { if(SH.on){ shStop(); } else { SH.on = true; $('#shGo').textContent = '⏸ 暫停'; shRun(); } };
  $('#shPrev').onclick = () => { const was = SH.on; shStop(); SH.i = Math.max(0, SH.i-1); SH.lv = 0; shStage(); if(was) $('#shGo').click(); };
  $('#shNext').onclick = () => { const was = SH.on; shStop(); SH.i = Math.min(SH.list.length-1, SH.i+1); SH.lv = 0; shStage(); if(was) $('#shGo').click(); };
  shStage();
}
function shStage(phase){ const it = ITEM[SH.list[SH.i]]; curStageKey = it.key;
  $('#stage').innerHTML = `<div class="small mute">${SH.i+1} / ${SH.list.length}・${esc(CAT[it.cat].t)}</div>
  <div class="stext big${SH.lv?'':' masked'}" data-act="shrv" role="button" tabindex="0">${textBody(it, SH.lv)}</div>
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
    if(SH.i >= SH.list.length-1){ SH.on = false; $('#shGo').textContent = '▶ 從頭再來'; SH.i = 0; SH.lv = 0; toast('跟讀完成 👏'); return; }
    SH.i++; SH.lv = 0;
  }
}

/* ---------- 🗣 開口練習（角色扮演；跟撿角日語同一套流程，但是一般頁面，不蓋住整個畫面） ----------
   選角色 → 對方的台詞照順序自動播放（文字先遮住，可點開）→ 輪到你時停下來，只顯示場景＋「輪到你了，請開口說」
   💡 看提示（點了才出現：說意圖，不翻譯）、🔁 再聽一次對方、🎙 錄音（可選）→「我講完了，看答案」：①原句 ②③另外兩種說法 */
let RPS = null;
const rpMine = l => RPS && (RPS.role === 'me' ? l.r === 'me' : l.r !== 'me');
function viewRole(did){
  const d = DLG[did]; if(!d) return viewHome(); const c = CAT[d.cat]; renderSide(c.id);
  RPS = {d, role:null, pos:0, rv:{}, phase:'pick', cue:false};
  $('#view').innerHTML = `${crumb([[c.t,'#/c/'+c.id+'/d'],[d.t,'#/d/'+did],['開口練習']])}
  <h1>🗣 開口練習：${esc(d.t)}</h1><div class="scene">🎬 ${esc(d.scene)}</div><div id="rpArea"></div>`;
  rpDraw();
}
function rpRowHTML(i){ const s = RPS, d = s.d, l = d.lines[i], it = ITEM[d.id+':'+i], k = 'rp'+i;
  const me = rpMine(l), lv = me ? 2 : (s.rv[k]||0);
  return `<div class="rprow${me?' me':''}"><div class="rpwho" style="color:${wcol(it)}">${esc(who(it))}${me?'<span class="rpyou">你</span>':''}</div>
    <div class="rptext${lv?'':' masked'}"${me?'':` data-act="rprv" data-k="${k}" role="button" tabindex="0"`}>${lv>=1?`<div class="ja">${hiJa(l.ja)}</div>${S.showKana?`<div class="kana">${esc(l.kana)}</div>`:''}${lv>=2?`<div class="zh">${esc(l.zh)}</div>`:''}`:maskHTML(l.ja)}</div>
    ${me?'':`<button class="ibtn s" data-act="rpplay" data-i="${i}" aria-label="再聽一次" title="再聽一次">🔊</button>`}</div>`; }
function rpDraw(){
  const s = RPS; const el = $('#rpArea'); if(!s || !el) return; const d = s.d;
  if(s.phase==='pick'){
    const nMe = d.lines.filter(l => l.r==='me').length, nO = d.lines.length - nMe;
    el.innerHTML = `<div class="rpcard"><div class="rpq">你要扮演誰？</div>
      <div class="rpchips"><button class="rpchip" data-act="rprole" data-r="me" style="border-color:${WHO_COLOR.me};color:${WHO_COLOR.me}">${ME}（我）<span class="small mute">（${nMe} 句）</span></button>${nO?`<button class="rpchip" data-act="rprole" data-r="other" style="border-color:${WHO_COLOR.other};color:${WHO_COLOR.other}">${esc(d.pn)}<span class="small mute">（${nO} 句）</span></button>`:''}</div>
      <div class="small mute" style="margin-top:10px">對方的台詞會自動播放；輪到你時會停下來。不會先給你中文或日文——想一想這個場合你會怎麼說，開口說出來，再看答案（3 種說法）。</div>
      <div class="row" style="margin-top:10px">${speedSeg()}</div></div>`;
    return;
  }
  const cur = s.pos, l = d.lines[cur], it = l ? ITEM[d.id+':'+cur] : null;
  let card = '';
  if(s.phase==='turn' || s.phase==='ans'){
    const R = J.rp[l.ja] || ['（這句沒有提示）', []];
    const lastOther = [...Array(s.pos).keys()].reverse().find(i => !rpMine(d.lines[i]));
    if(s.phase==='turn'){
      card = `<div class="rpcard rpturn">
        <div class="rpscn">🎬 ${esc(d.scene)}</div>
        <div class="rpme"><span class="rpwho" style="color:${wcol(it)}">${esc(who(it))}</span><span class="rpyou">你</span></div>
        <div class="rpsay">輪到你了，請開口說 🗣</div>
        <div class="rptimer small mute" id="rpTimer">⏱ 0 秒</div>
        <div class="rpcue${s.cue?' open':''}">${s.cue ? `💡 ${esc(R[0])}` : `<button class="btn sm ghost" data-act="rpcue">💡 看提示</button>`}</div>
        <div class="row rpacts">
          ${lastOther!=null?`<button class="btn sm ghost" data-act="rpplay" data-i="${lastOther}">🔁 再聽一次對方</button>`:''}
          ${CAN_REC?`<button class="btn sm ghost${s.rec?' on':''}" data-act="rprec">${s.rec?'⏹ 停止錄音':s.recUrl?'🎙 重錄':'🎙 錄音（可選）'}</button>`:''}
          <button class="btn" data-act="rpans">我講完了，看答案</button>
        </div></div>`;
    } else {
      const one = (n, badge, cls, a, play) => `<div class="rpopt"><div class="rpn">${n}</div><div class="rpbody"><span class="rptag ${cls}">${badge}</span><div class="ja">${hiJa(a.ja)}</div>${S.showKana?`<div class="kana">${esc(a.kana)}</div>`:''}${S.showRomaji?`<div class="ro">${esc(a.ro)}</div>`:''}<div class="zh">${esc(a.zh)}</div></div><button class="ibtn s" ${play} aria-label="播放" title="播放">🔊</button></div>`;
      card = `<div class="rpcard rpanswer">
        <div class="rpme"><span class="rpwho" style="color:${wcol(it)}">${esc(who(it))}</span><span class="rpyou">你</span><span class="small mute">可以這樣說：</span></div>
        <div class="rpcue open small">💡 ${esc(R[0])}</div>
        ${one('①', '原句', 'txt', l, `data-act="rpplay" data-i="${cur}"`)}
        ${R[1].map((a, j) => one(j?'③':'②', '另一種說法', 'xtra', {ja:a[0], kana:a[1], ro:a[2], zh:a[3]}, `data-act="altplay" data-a="${esc(l.a)}-r_${j}"`)).join('')}
        <div class="small mute rpref">② ③ 為本 App 自編的自然說法（展場、商務場合都可以用）</div>
        <div class="row rpacts">${s.recUrl?`<button class="btn sm ghost" data-act="rpmine">▶ 聽我的錄音</button><button class="btn sm ghost" data-act="rpcmp">🔁 原句＋我的錄音</button>`:''}
          <button class="btn" data-act="rpnext">繼續 ▶</button></div></div>`;
    }
  } else if(s.phase==='done'){
    card = `<div class="rpcard"><div class="rpsay">🎉 練習完成！</div><div class="small mute">你扮演「${esc(s.role==='me'?ME:d.pn)}」說了 ${d.lines.filter(l => rpMine(l)).length} 句。換個角色再練一次，就能從另一邊聽、另一邊說。</div>
      <div class="row rpacts"><button class="btn" data-act="rprestart">再練一次</button><button class="btn ghost" data-act="rppick">換角色</button><a class="btn ghost" style="text-decoration:none" href="#/d/${d.id}">回對話</a></div></div>`;
  } else if(s.phase==='play'){
    card = `<div class="rpcard rpplaying"><div class="small mute">🔊 對方說話中…（文字先隱藏，可點一下顯示）</div><button class="btn sm ghost" data-act="rpskip">跳過 ⏭</button></div>`;
  }
  const shown = [...Array(s.phase==='play' ? s.pos + 1 : s.pos).keys()];
  el.innerHTML = `${shown.length?`<div class="script rpscript">${shown.map(rpRowHTML).join('')}</div>`:''}${card}
    <div class="row" style="margin-top:10px">${speedSeg()}<button class="btn sm ghost" data-act="rppick">換角色</button></div>`;
  if(s.phase==='turn') rpTick();
  const tgt = el.querySelector('.rpcard'); if(tgt){ const r = tgt.getBoundingClientRect(); if(r.bottom > innerHeight || r.top < 100) tgt.scrollIntoView({block:'nearest', behavior:'smooth'}); }
}
function rpTick(){ const s = RPS; clearInterval(s.timer); const f = () => { const t = document.getElementById('rpTimer'); if(!t || !RPS || RPS.phase!=='turn'){ clearInterval(s.timer); return; } t.textContent = `⏱ ${Math.floor((Date.now()-s.t0)/1000)} 秒`; }; f(); s.timer = setInterval(f, 1000); }
async function rpRun(){
  const s = RPS; if(!s) return; stopAll(); const t = token; const d = s.d;
  while(RPS===s && s.pos < d.lines.length){
    const l = d.lines[s.pos];
    if(rpMine(l)){ s.phase = 'turn'; s.t0 = Date.now(); s.cue = false; rpDraw(); return; }
    s.phase = 'play'; rpDraw();
    await playEl(audio, src(l.a)); if(t!==token || RPS!==s) return;
    s.pos++; await wait(450); if(t!==token || RPS!==s) return;
  }
  if(RPS===s){ s.phase = 'done'; S.done[d.id] = true; save(); rpDraw(); }
}
let rpRecorder = null;
function rpStopRec(){ if(rpRecorder && rpRecorder.state==='recording') try{ rpRecorder.stop(); }catch(e){} }
async function rpToggleRec(){
  const s = RPS; if(!s) return;
  if(rpRecorder && rpRecorder.state==='recording'){ rpRecorder.stop(); return; }
  stopAll(); let stream;
  try{ stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}}); }
  catch(e){ toast(e && e.name==='NotAllowedError' ? '麥克風權限被拒，請到設定允許' : '無法使用麥克風'); return; }
  const mime = pickMime(), chunks = [];
  try{ rpRecorder = mime ? new MediaRecorder(stream, {mimeType:mime}) : new MediaRecorder(stream); }catch(e){ rpRecorder = new MediaRecorder(stream); }
  const r = rpRecorder; let tm = null;
  r.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
  r.onstop = () => { clearTimeout(tm); stream.getTracks().forEach(t => t.stop()); if(rpRecorder===r) rpRecorder = null;
    if(RPS!==s) return; if(s.recUrl) URL.revokeObjectURL(s.recUrl); s.recUrl = URL.createObjectURL(new Blob(chunks, {type: r.mimeType || mime || 'audio/mp4'})); s.rec = false; rpDraw(); };
  r.start(); s.rec = true; rpDraw(); tm = setTimeout(() => { if(r.state==='recording') r.stop(); }, 20000);
}
function rpClose(){ if(!RPS) return; rpStopRec(); clearInterval(RPS.timer); if(RPS.recUrl) URL.revokeObjectURL(RPS.recUrl); RPS = null; }
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act^="rp"]'); if(!b) return; const act = b.dataset.act;
  const s = RPS; if(!s) return; const d = s.d;
  if(act==='rprole'){ s.role = b.dataset.r; s.pos = 0; s.rv = {}; rpRun(); }
  else if(act==='rppick'){ stopAll(); rpStopRec(); s.phase = 'pick'; s.pos = 0; rpDraw(); }
  else if(act==='rprestart'){ s.pos = 0; s.rv = {}; rpRun(); }
  else if(act==='rprv'){ const k = b.dataset.k; s.rv[k] = ((s.rv[k]||0)+1) % 3; const y = scrollY; rpDraw(); window.scrollTo(0, y); }
  else if(act==='rpplay'){ stopAll(); await playEl(audio, src(d.lines[+b.dataset.i].a)); }
  else if(act==='rpcue'){ s.cue = true; const c = b.closest('.rpcue'); const R = J.rp[d.lines[s.pos].ja]; c.classList.add('open'); c.textContent = '💡 ' + (R ? R[0] : ''); }
  else if(act==='rprec') rpToggleRec();
  else if(act==='rpans'){ rpStopRec(); clearInterval(s.timer); stopAll(); s.phase = 'ans'; rpDraw(); }
  else if(act==='rpmine'){ if(s.recUrl){ stopAll(); playEl(mine, s.recUrl); } }
  else if(act==='rpcmp'){ stopAll(); const t = token; await playEl(audio, src(d.lines[s.pos].a)); if(t!==token || !s.recUrl) return; await wait(350); playEl(mine, s.recUrl); }
  else if(act==='rpnext'){ if(s.recUrl){ URL.revokeObjectURL(s.recUrl); s.recUrl = null; } s.pos++; rpRun(); }
  else if(act==='rpskip'){ stopAll(); s.pos++; rpRun(); }
});

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
  if(ok) Q.score++; else { S.review[q.k] = {n:((S.review[q.k]||{}).n||0)+1, t:Date.now()}; save(); }
  $('#qFb').innerHTML = `<div class="result ${ok?'good':'bad'}">${ok?'⭕ 答對了！':'再聽一次，對照文字 👇（已加入複習清單）'}</div><div class="ja">${hiJa(it.ja)}</div><div class="kana">${esc(it.kana)}</div><div class="ro">${esc(it.ro)}</div><div class="zh">${esc(it.zh)}</div>${it.note?`<div class="note">💡 ${esc(it.note)}</div>`:''}
  <div class="small mute" style="margin-top:4px">出自：${esc(CAT[it.cat].t)}${it.d?'・對話「'+esc(DLG[it.d].t)+'」':'・句子'}</div>
  <div class="row" style="margin-top:10px"><button class="btn" id="qNext">${Q.i+1<Q.qs.length?'下一題 ›':'看結果'}</button></div>`;
  $('#qNext').onclick = () => { stopAll(); Q.i++; if(Q.i < Q.qs.length) renderQ(); else { const pct = Math.round(Q.score/Q.qs.length*100); S.quiz[Q.cid] = Math.max(S.quiz[Q.cid]||0, pct); save();
    $('#view').innerHTML = `${crumb([[CAT[Q.cid].t,'#/c/'+Q.cid],['結果']])}<h1>結果</h1><div class="card"><div style="font-size:40px;font-weight:800;color:${pct>=80?'var(--ok)':'var(--alert)'}">${pct}%</div><div>答對 ${Q.score} / ${Q.qs.length}</div>
    <div class="row" style="margin-top:12px"><button class="btn" id="again">再測一次</button><a class="btn ghost" style="text-decoration:none" href="#/c/${Q.cid}/d">回對話</a></div></div>`; $('#again').onclick = () => viewQuiz(Q.cid); } };
}

/* ---------- 🔍 搜尋（日文／假名／中文；片假名＝平假名、全形半形、忽略標點） ---------- */
const SQ_PUNCT = /[\s\u3000、。，,.．!！?？・･「」『』（）()［］\[\]【】〈〉《》〜~…‥:：;；"'“”‘’\/／＊*＋+=＝|｜-]/;
function sqChar(c){ let n = c.normalize('NFKC').toLowerCase(); n = n.replace(/[ァ-ヶ]/g, x => String.fromCharCode(x.charCodeAt(0) - 0x60)); return [...n].filter(x => !SQ_PUNCT.test(x)).join(''); }
function sqNorm(s){ let o = ''; for(const c of String(s||'')) o += sqChar(c); return o; }
function sqMap(s){ const chars = [...String(s||'')], n = [], pos = []; let off = 0;
  chars.forEach(c => { const t = sqChar(c); for(const x of t){ n.push(x); pos.push([off, off + c.length]); } off += c.length; }); return {n: n.join(''), pos}; }
function sqHi(s, q){ const m = sqMap(s), j = m.n.indexOf(q); if(j < 0 || !q) return null;
  const qa = [...q].length, nn = [...m.n]; const k = [...m.n.slice(0, j)].length;
  const a = m.pos[k][0], b = m.pos[Math.min(k + qa, nn.length) - 1][1]; s = String(s);
  return esc(s.slice(0, a)) + '<mark>' + esc(s.slice(a, b)) + '</mark>' + esc(s.slice(b)); }
let SIDX = null;
function sqItem(o){ o.nj = sqNorm(o.ja); o.nk = sqNorm(o.kana); o.nr = sqNorm(o.ro); o.nz = sqNorm(o.zh); return o; }
function buildIndex(){ const I = [];
  J.cats.forEach(c => {
    c.phrases.forEach((p, i) => I.push(sqItem({t:'句子', cat:c.id, ja:p.ja, kana:p.kana, ro:p.ro, zh:p.zh, who:'', src:`句子 ${i+1}`, href:`#/c/${c.id}/p`, key:p.id, au:p.id})));
    c.dialogues.forEach(d => d.lines.forEach((l, i) => I.push(sqItem({t:'對話', cat:c.id, ja:l.ja, kana:l.kana, ro:l.ro, zh:l.zh, who:who(ITEM[d.id+':'+i]), src:`「${d.t}」`, href:`#/d/${d.id}`, key:d.id+':'+i, au:l.a}))));
    const seen = new Set();
    c.dialogues.forEach(d => d.lines.forEach((l, i) => { if(seen.has(l.a)) return; seen.add(l.a); const R = J.rp[l.ja]; if(!R) return;
      R[1].forEach((a, j) => I.push(sqItem({t:'其他說法', cat:c.id, ja:a[0], kana:a[1], ro:a[2], zh:a[3], who:who(ITEM[d.id+':'+i]), src:`「${d.t}」開口練習`, href:`#/d/${d.id}`, key:d.id+':'+i, au:`${l.a}-r_${j}`}))); }));
  });
  return SIDX = I; }
const SQ_BADGE = {'句子':'txt', '對話':'g', '其他說法':'xt'};
function searchFormHTML(q, cls){ return `<form class="sform${cls?' '+cls:''}" role="search" data-sform><input type="search" name="q" value="${esc(q||'')}" placeholder="搜尋日文、假名或中文（例：めいし、名片）" aria-label="搜尋" enterkeyhint="search" autocomplete="off"><button class="btn sm" type="submit">🔍 搜尋</button></form>`; }
let SVIEW = [], SREV = {}, sAllOn = false;
function sTextHTML(o, lv, nq){
  if(!lv) return maskHTML(o.ja);
  return `<div class="ja">${(nq && sqHi(o.ja, nq)) || hiJa(o.ja)}</div>${S.showKana?`<div class="kana">${(nq && sqHi(o.kana, nq)) || esc(o.kana)}</div>`:''}${S.showRomaji?`<div class="ro">${(nq && sqHi(o.ro, nq)) || esc(o.ro)}</div>`:''}${lv > 1 ? `<div class="zh">${(nq && sqHi(o.zh, nq)) || esc(o.zh)}</div>` : ''}`; }
function viewSearch(q){
  renderSide('search');
  const nq = sqNorm(q); if(!SIDX) buildIndex();
  const res = nq ? SIDX.filter(o => o.nj.includes(nq) || o.nk.includes(nq) || o.nr.includes(nq) || o.nz.includes(nq)) : [];
  const LM = !!S.sListen; SVIEW = []; SREV = {}; let n = 0;
  const item = o => { const i = n++; SVIEW.push(o);
    const top = `<a class="sgo" href="${o.href}" data-hl="${esc(o.key)}"><span class="sbadge ${SQ_BADGE[o.t]}">${o.t}</span>${o.who?`<b class="swho2">${esc(o.who)}</b>`:''}<span class="small mute">${esc(o.src)}</span></a>`;
    return `<div class="sres${LM?' lm':''}" data-sn="${i}"><div class="srtop">${top}<button class="splay${LM?' big':''}" data-sact="play" data-sn="${i}" aria-label="播放這句">${LM?'▶ 聽':'▶'}</button></div>${LM ? `<div class="sbody" data-sact="rv" data-sn="${i}" role="button" tabindex="0">${sTextHTML(o, 0, nq)}</div>` : `<a class="sgo sbody" href="${o.href}" data-hl="${esc(o.key)}">${sTextHTML(o, 2, nq)}</a>`}</div>`; };
  const groups = J.cats.map(c => { const list = res.filter(o => o.cat === c.id); if(!list.length) return '';
    return `<section class="sgrp"><h2>${c.icon} ${esc(c.t)}<span class="small mute">（${list.length}）</span></h2>${list.map(item).join('')}</section>`; }).join('');
  const nc = J.cats.filter(c => res.some(o => o.cat === c.id)).length;
  $('#view').innerHTML = `${crumb([['搜尋']])}<h1>🔍 搜尋</h1>${searchFormHTML(q)}
    ${!nq ? `<div class="card small mute">輸入日文（漢字或假名）、羅馬拼音或中文，按「搜尋」或 Enter。可以找句子、對話、開口練習的其他說法。片假名、平假名都可以，例如「めいし」會找到「名刺」。</div>`
      : res.length ? `<div class="scbar"><div class="small mute scount">「${esc(q)}」共 ${res.length} 筆，分布在 ${nc} 個分類</div><div class="scbtns"><button class="bshow${LM?' on':''}" data-sact="lm" aria-pressed="${LM}">🎧 聽力模式：${LM?'開':'關'}</button><button class="bshow" data-sact="all">▶ 全部播放</button></div></div>${LM?`<div class="small mute slmtip">先聽，再點文字：第 1 次顯示日文、第 2 次加中文、第 3 次再隱藏。點上方出處可跳到那一句。</div>`:''}${groups}`
      : `<div class="card sempty">找不到「${esc(q)}」。<div class="small mute" style="margin-top:6px">試試看：少打幾個字、改用平假名（例：「めいし」）、或用中文（例：「名片」）。</div></div>`}`;
  const inp = $('#view .sform input'); if(inp && !nq) setTimeout(() => inp.focus(), 50);
}
function sCurQ(){ const h = location.hash.replace(/^#\/?/, ''); try{ return decodeURIComponent(h.slice(2)); }catch(e){ return h.slice(2); } }
function sMark(i){ document.querySelectorAll('.sres.playing').forEach(e => e.classList.remove('playing'));
  if(i == null) return; const el = document.querySelector(`.sres[data-sn="${i}"]`); if(el){ el.classList.add('playing'); const r = el.getBoundingClientRect(); if(r.top < 90 || r.bottom > innerHeight - 20) el.scrollIntoView({block:'center', behavior:'smooth'}); } }
async function sPlay(i, t){ const o = SVIEW[i]; if(!o) return true; if(t === undefined){ stopAll(); t = token; } sMark(i); await playEl(audio, src(o.au)); if(t !== token) return false; sMark(null); return true; }
function sAllBtn(){ document.querySelectorAll('[data-sact="all"]').forEach(b => b.textContent = sAllOn ? '⏹ 停止' : '▶ 全部播放'); }
async function sPlayAll(){
  if(sAllOn){ sAllOn = false; stopAll(); sMark(null); sAllBtn(); return; }
  stopAll(); const t = token; sAllOn = true; sAllBtn();
  for(let i = 0; i < SVIEW.length; i++){ const ok = await sPlay(i, t); if(!ok || t !== token) break; await wait(600); if(t !== token) break; }
  if(t === token) sMark(null); sAllOn = false; sAllBtn(); }
document.addEventListener('click', e => { const t = e.target.closest('[data-sact]'); if(!t) return; const act = t.dataset.sact;
  if(act === 'lm'){ S.sListen = !S.sListen; save(); sAllOn = false; stopAll(); const y = scrollY; viewSearch(sCurQ()); window.scrollTo(0, y); }
  else if(act === 'all') sPlayAll();
  else if(act === 'play'){ sAllOn = false; sAllBtn(); sPlay(+t.dataset.sn); }
  else if(act === 'rv'){ const i = +t.dataset.sn, lv = ((SREV[i] || 0) + 1) % 3; SREV[i] = lv; t.innerHTML = sTextHTML(SVIEW[i], lv, sqNorm(sCurQ())); } });
document.addEventListener('submit', e => { const f = e.target.closest('[data-sform]'); if(!f) return; e.preventDefault();
  const q = f.querySelector('input').value.trim(); const h = '#/s/' + encodeURIComponent(q); f.querySelector('input').blur();
  if(location.hash === h) route(); else location.hash = h; });
let pendingHL = null;
document.addEventListener('click', e => { const a = e.target.closest('a.sgo'); if(!a) return; pendingHL = a.dataset.hl || null; if(location.hash === a.getAttribute('href')){ e.preventDefault(); route(); } });
function applyHL(){ const k = pendingHL; pendingHL = null; if(!k || !ITEM[k]) return; reveal[k] = 2; rerender(k);
  const el = document.querySelector(`.srow[data-key="${k}"]`); if(!el) return; el.scrollIntoView({block:'center'}); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2200); }

/* ---------- events ---------- */
function closeSrc(k){ const b = document.getElementById('src-'+kid(k)); if(b) b.innerHTML = ''; const x = document.querySelector(`.srow[data-key="${k}"] [data-act="idk"]`); if(x) x.classList.remove('on'); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if(!b) return; const a = b.dataset.act, k = b.dataset.k;
  if(a==='play') play(ITEM[k].a, k);
  else if(a==='rep'){ playSeq([k], 900, 3); toast('重複 3 次'); }
  else if(a==='rv'){ reveal[k] = ((reveal[k]||0)+1) % 3; if(!reveal[k]) closeSrc(k); rerender(k); }
  else if(a==='shrv'){ SH.lv = (SH.lv + 1) % 3; shStage($('#shPhase') ? $('#shPhase').innerHTML : ''); }
  else if(a==='idk'){ const box = document.getElementById('src-'+kid(k)); if(box && box.innerHTML.trim()){ closeSrc(k); return; }
    reveal[k] = 2; S.review[k] = {n:((S.review[k]||{}).n||0)+1, t:Date.now()}; save(); rerender(k);
    const bx = document.getElementById('src-'+kid(k)); if(bx) bx.innerHTML = srcHTML(k);
    const x = document.querySelector(`.srow[data-key="${k}"] [data-act="idk"]`); if(x) x.classList.add('on');
    const sl = document.querySelector('#side a[href="#/review"]'); if(sl) sl.textContent = `📝 複習清單（${revCount()}）`; toast('已加入複習清單'); }
  else if(a==='srcclose') closeSrc(k);
  else if(a==='altplay'){ stopAll(); playEl(audio, src(b.dataset.a)); }
  else if(a==='got'){ delete S.review[k]; save(); toast('太棒了！已從複習清單移除'); const y = scrollY; viewReview(); window.scrollTo(0, y); }
  else if(a==='bshow'){ e.preventDefault(); const box = b.closest('[data-blk]'); const on = !b.classList.contains('on');
    box.querySelectorAll('.srow[data-key]').forEach(el => { const kk = el.dataset.key; reveal[kk] = on ? 2 : 0; if(!on) closeSrc(kk); rerender(kk); }); b.outerHTML = blkBtn(on); }
  else if(a==='spk'){ const box = document.getElementById('sp-'+kid(k)); if(box.innerHTML){ box.innerHTML=''; b.classList.remove('on'); } else { box.innerHTML = spHTML(k); b.classList.add('on'); } }
  else if(a==='rec') toggleRec(k);
  else if(a==='mine') playMine(k);
  else if(a==='cmp') compare(k);
  else if(a==='sr') recognize(k);
  else if(a==='spd'){ S.speed = +b.dataset.sp; save(); document.querySelectorAll('[data-act="spd"]').forEach(x => x.classList.toggle('on', +x.dataset.sp===S.speed)); }
});
document.addEventListener('keydown', e => { if((e.key==='Enter' || e.key===' ') && e.target.matches && e.target.matches('[role="button"][data-act],[role="button"][data-sact]')){ e.preventDefault(); e.target.click(); } });
$('#speedBtn').onclick = () => { S.speed = S.speed<1 ? 1 : 0.7; save(); toast(S.speed<1?'播放速度 0.7x':'播放速度 1x'); document.querySelectorAll('[data-act="spd"]').forEach(x => x.classList.toggle('on', +x.dataset.sp===S.speed)); };
$('#settingsBtn').onclick = openSettings;
$('#sheet').addEventListener('click', e => { if(e.target.id==='sheet') $('#sheet').classList.add('hidden'); });

/* ---------- 離線：清單＝App 用到的全部音檔（原句、開口練習另外兩種說法；各有 1x 與 0.7x） ---------- */
const AUDIO_CACHE = 'jt-audio-v2';   // 與 sw.js 的 AUDIO 相同
const relKey = u => { try{ const m = new URL(u, location.href).pathname.match(/\/(audio\/[^/]+\.mp3)$/); return m ? m[1] : null; }catch(e){ return null; } };
async function offScan(prune){
  const want = new Set(J.files), have = new Set(); let bytes = 0;
  if(prune) for(const k of await caches.keys()) if(/^jt-audio-/.test(k) && k !== AUDIO_CACHE) await caches.delete(k);
  const c = await caches.open(AUDIO_CACHE);
  for(const req of await c.keys()){ const key = relKey(req.url);
    if(!key || !want.has(key) || have.has(key)){ if(prune) await c.delete(req); continue; }
    have.add(key); const r = await c.match(req); const n = r && +r.headers.get('content-length'); if(n) bytes += n; }
  return {list: J.files, have, bytes}; }
const MB = n => (n / 1048576).toFixed(1) + ' MB';
async function cacheStatus(){ if(!('caches' in window)) return '此瀏覽器不支援離線快取';
  try{ const r = await offScan(true); return `${r.have.size >= r.list.length ? '✓ ' : ''}🔊 音檔：${r.have.size} / ${r.list.length}${r.bytes ? `（${MB(r.bytes)}）` : ''}`; }catch(e){ return '無法讀取快取狀態'; } }
async function downloadAll(btn, info){
  if(!('caches' in window)) return toast('此瀏覽器不支援離線');
  btn.disabled = true; info.textContent = '準備中…';
  try{ if(navigator.storage && navigator.storage.persist) await navigator.storage.persist(); }catch(e){}
  const R = await offScan(true), miss = J.files.filter(u => !R.have.has(u)), c = await caches.open(AUDIO_CACHE); let i = 0, done = 0, fail = 0;
  const show = () => { info.textContent = `🔊 音檔：${R.have.size + done} / ${R.list.length}（下載中，剩 ${miss.length - done - fail}${fail ? `，失敗 ${fail}` : ''}）`; }; show();
  const worker = async () => { while(i < miss.length){ const u = miss[i++];
    try{ const r = await fetch(u, {cache:'no-cache'}); if(r.ok && r.status === 200){ await c.put(u, r); done++; } else fail++; }catch(e){ fail++; }
    if((done + fail) % 10 === 0) show(); } };
  await Promise.all(Array.from({length:6}, worker));
  info.innerHTML = await cacheStatus(); btn.disabled = false; btn.textContent = fail ? `⬇︎ 再試一次（${fail} 個失敗）` : '✓ 下載完成，離線也能用'; }
async function openSettings(){
  $('#sheetBody').innerHTML = `<h2 style="margin-top:0">⚙︎ 設定</h2><div class="card" style="display:grid;gap:12px">
    <div><b>假名</b> <div class="seg"><button data-kana="1" class="${S.showKana?'on':''}">顯示</button><button data-kana="0" class="${!S.showKana?'on':''}">隱藏</button></div></div>
    <div><b>羅馬拼音</b> <div class="seg"><button data-ro="1" class="${S.showRomaji?'on':''}">顯示</button><button data-ro="0" class="${!S.showRomaji?'on':''}">隱藏</button></div></div>
    <div><b>這台裝置支援</b>${supportHTML()}<div class="small mute">${isIOS?'iPhone：語音辨識需在「設定 › Siri」開啟 Siri／聽寫，並需要網路；若主畫面 App 模式不能辨識，請改用 Safari 開啟。錄音對比離線也能用。':'Android：請用 Chrome（Samsung Internet 可能不支援語音辨識）。語音辨識需要網路。'}${standalone?'（目前：主畫面 App 模式）':''}</div></div>
    <div><b>離線</b><div class="small" id="ci">檢查中…</div><button class="btn sm ghost" id="dl" style="margin-top:6px">⬇︎ 下載全部離線資料（約 12 MB）</button><div class="small mute" style="margin-top:4px">只下載還沒存的；建議連 Wi-Fi。</div></div>
    <div><b>重設</b><div class="row" style="margin-top:6px"><button class="btn sm ghost" id="rsR">清空複習清單</button><button class="btn sm ghost" id="rs">清除進度與分數</button></div></div></div>
    <div class="foot">版本 2.0（新配色、聽力優先書本式排版、🗣 開口練習、🔍 搜尋、📝 複習清單）・資料只存在本裝置。錄音只在本機播放，不會上傳。</div><div class="row" style="margin-top:10px"><button class="btn" id="cl">完成</button></div>`;
  $('#sheet').classList.remove('hidden'); $('#ci').innerHTML = await cacheStatus();
  document.querySelectorAll('[data-kana]').forEach(b => b.onclick = () => { S.showKana = b.dataset.kana==='1'; save(); openSettings(); route(true); });
  document.querySelectorAll('[data-ro]').forEach(b => b.onclick = () => { S.showRomaji = b.dataset.ro==='1'; save(); openSettings(); route(true); });
  $('#dl').onclick = () => downloadAll($('#dl'), $('#ci'));
  $('#rsR').onclick = () => { if(confirm('確定清空複習清單？')){ S.review = {}; save(); route(true); openSettings(); } };
  $('#rs').onclick = () => { if(confirm('確定清除進度與分數？')){ S.done={}; S.quiz={}; S.best={}; save(); route(true); openSettings(); } };
  $('#cl').onclick = () => $('#sheet').classList.add('hidden');
}
function route(keepSheet){
  stopAll(); if(rec && rec.state==='recording') rec.stop(); if(srBusy) try{ srBusy.abort(); }catch(e){}
  if(SH) SH.on = false; rpClose(); curStageKey = null; sAllOn = false; curRowOpts = () => ({});
  if(keepSheet!==true) $('#sheet').classList.add('hidden');
  const h = location.hash.replace(/^#\/?/, ''); const [a, b, c] = h.split('/');
  if(a==='c') viewCat(b, c); else if(a==='d') viewDlg(b); else if(a==='sh') viewShadow(b); else if(a==='rp') viewRole(b); else if(a==='q') viewQuiz(b);
  else if(a==='review') viewReview(); else if(a==='s'){ let q = ''; try{ q = decodeURIComponent(h.slice(2)); }catch(e){ q = h.slice(2); } viewSearch(q); } else viewHome();
  updChips(); if(keepSheet!==true) window.scrollTo(0, 0);
  if(pendingHL) setTimeout(applyHL, 60);
}
window.addEventListener('hashchange', () => route());
route(); save();
// 頂端列高度（含 iPhone 瀏海）→ CSS --hdr，讓播放列／側欄剛好貼在頂端列下面
(function(){ const t = document.querySelector('.top'); if(!t) return; const set = () => document.documentElement.style.setProperty('--hdr', t.offsetHeight + 'px');
  set(); window.addEventListener('resize', set); window.addEventListener('load', set); if(window.ResizeObserver) new ResizeObserver(set).observe(t); })();
if('serviceWorker' in navigator && location.protocol !== 'file:'){
  // 新版上線後盡快生效：sw.js 不走 HTTP 快取；開啟時、回到頁面時、每 30 分鐘檢查更新；新版接手後自動重新整理一次（第一次安裝不重整）
  const hadCtl = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if(!hadCtl || reloaded) return; reloaded = true; location.reload(); });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', {updateViaCache:'none'}).then(reg => {
    const chk = () => reg.update().catch(()=>{}); chk();
    document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') chk(); });
    window.addEventListener('focus', chk);
    setInterval(chk, 30*60*1000);
  }).catch(()=>{}));
}
})();
