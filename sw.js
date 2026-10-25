const SHELL = 'jt-shell-v5', AUDIO = 'jt-audio-v4';
const SHELL_FILES = ['./','index.html','style.css','app.js','data.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','icons/maskable-512.png'];
self.window = self; importScripts('data.js');
// 全部音檔：原句＋開口練習的另外兩種說法（1x 與 0.7x），清單由 tools/build.py 產生
const AUDIO_FILES = self.JT.files;
// 日本行每日的照片（WebP，已壓縮）：背景存進 SHELL，離線也看得到
const IMG_FILES = self.JT.imgs || [];
async function cacheImgs(){ const c = await caches.open(SHELL);
  await Promise.allSettled(IMG_FILES.map(async u => { if(!(await c.match(u))){ const r = await fetch(u, {cache:'no-cache'}); if(r.ok) await c.put(u, r); } })); }
async function cacheAudio(){
  const c = await caches.open(AUDIO);
  for(let i = 0; i < AUDIO_FILES.length; i += 10)
    await Promise.allSettled(AUDIO_FILES.slice(i, i+10).map(async u => { if(!(await c.match(u))){ const r = await fetch(u, {cache:'no-cache'}); if(r.ok) await c.put(u, r); } }));
}
self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // v2/v3 -> v4：只有新增音檔（日本行每日、照片單字與例句），舊的全部搬過來，不用重新下載
    for(const old of ['jt-audio-v3', 'jt-audio-v2']) if(await caches.has(old)){
      const o = await caches.open(old), n = await caches.open(AUDIO);
      for(const r of await o.keys()){ if(!(await n.match(r))) await n.put(r, await o.match(r)); }
    }
    // v1 -> v2：1x 原句音檔沒變，搬過來；_s（慢速）改成 0.7x 重新產生，不搬
    if(await caches.has('jt-audio-v1')){
      const o = await caches.open('jt-audio-v1'), n = await caches.open(AUDIO);
      for(const r of await o.keys()){ const p = new URL(r.url).pathname; if(!/_s\.mp3$/.test(p) && !(await n.match(r))) await n.put(r, await o.match(r)); }
    }
    for(const k of await caches.keys()) if(![SHELL, AUDIO].includes(k)) await caches.delete(k);
    await self.clients.claim();
    cacheImgs().catch(() => {}); cacheAudio().catch(() => {});
  })());
});
// iOS Safari 用 Range 要音檔：從快取回 206
async function rangeResponse(req, res){
  const range = req.headers.get('range'); if(!range) return res;
  const buf = await res.arrayBuffer(); const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  const start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], buf.byteLength-1) : buf.byteLength-1;
  return new Response(buf.slice(start, end+1), {status:206, statusText:'Partial Content', headers:{'Content-Type':'audio/mpeg','Content-Range':`bytes ${start}-${end}/${buf.byteLength}`,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}});
}
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(e.request.method !== 'GET' || url.origin !== location.origin) return;
  if(url.pathname.endsWith('.mp3')){
    e.respondWith((async () => {
      const c = await caches.open(AUDIO); const key = url.pathname.replace(/^.*\/audio\//, 'audio/');
      const hit = await c.match(key); if(hit) return rangeResponse(e.request, hit);
      try{ const full = await fetch(url.pathname, {credentials:'same-origin', cache:'no-cache'}); if(full.ok && full.status===200){ await c.put(key, full.clone()); return rangeResponse(e.request, full); } }catch(err){}
      return fetch(e.request);
    })()); return;
  }
  // App 檔案：先走網路（新版一上線就看得到）；離線或 3 秒沒回應 → 用快取
  e.respondWith((async () => {
    const c = await caches.open(SHELL);
    const net = fetch(e.request, {cache:'no-cache'}).then(r => { if(r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    const hit = await c.match(e.request, {ignoreSearch:true});
    if(!hit) return (await net) || (await c.match('index.html'));
    const r = await Promise.race([net, new Promise(res => setTimeout(() => res(null), 3000))]);
    return (r && r.ok) ? r : hit;
  })());
});
