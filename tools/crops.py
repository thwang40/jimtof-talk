"""📷 日本行每日：照片單字小截圖。
Usage: python3 tools/crops.py [--force]  -> img/<day>/w/<word id>.webp 單字截圖、img/<day>/q/<day>q<n>.webp 整句截圖（寬 ≤800px、高 ≤640px，WebP q≈72，≤60KB）
設定寫在 tools/jt_daily.py 的 CROPS_D（crops / orig / blur）。先裁原檔（比較清楚），沒有原檔就裁 img/<day>/<照片>.webp。
blur 的框一定先打馬賽克再裁，個資（姓名、條碼、票號、房號、座位號碼）不會出現在小截圖。"""
import os, sys
from PIL import Image, ImageOps, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jt_daily import DAYS
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAXW, MAXH, Q0, LIMIT = 800, 640, 72, 60000
def photo(d, p, cache):
    if p not in cache:
        o = d.get('orig', {}).get(p)
        f = o if o and os.path.exists(o) else os.path.join(ROOT, 'img', d['id'], p + '.webp')
        if f != o: print('  （沒有原檔，改用壓縮照片）', p)
        im = ImageOps.exif_transpose(Image.open(f)).convert('RGB'); W, H = im.size
        for b in d.get('blur', {}).get(p, []):
            box = tuple(int(v * s) for v, s in zip(b, (W, H, W, H))); r = im.crop(box)
            r = r.resize((max(1, r.width // 24), max(1, r.height // 24))).resize(r.size).filter(ImageFilter.GaussianBlur(12))
            im.paste(r, box[:2])
        cache[p] = im
    return cache[p]
CTX_X, CTX_Y = 0.75, 1.6   # 周圍文字：左右各加 0.75 個字框寬（至少 2 個字高），上下各加 1.6 個字框高 → 約 2～3 倍字框
def crop_one(im, b, out, mark=True, ctx=1.0):
    W, H = im.size; x0, y0, x1, y1 = b[0] * W, b[1] * H, b[2] * W, b[3] * H
    w, h = x1 - x0, y1 - y0; s = min(w, h)
    px = max(ctx * CTX_X * w, 2.0 * s, 0.02 * max(W, H)); py = max(ctx * CTX_Y * h, 1.2 * s, 0.02 * max(W, H))
    if ctx < 1: px, py = max(0.12 * w, 1.2 * s, 0.02 * max(W, H)), max(0.35 * h, 1.0 * s, 0.02 * max(W, H))   # 整句：框本身已經夠大，只留一點邊
    elif h > w * 1.5: px, py = max(2.4 * w, 2.0 * s), max(0.35 * h, 1.2 * s)   # 直書：左右多加幾行
    cx0, cy0, cx1, cy1 = int(max(0, x0 - px)), int(max(0, y0 - py)), int(min(W, x1 + px)), int(min(H, y1 + py))
    c = im.crop((cx0, cy0, cx1, cy1)).convert('RGBA')
    if mark:   # 目標字加淡黃底＋框，旁邊的字照樣看得到
        from PIL import ImageDraw
        ov = Image.new('RGBA', c.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
        m = max(2, int(0.12 * s)); lw = max(3, int(max(c.size) / 160))
        r = (x0 - cx0 - m, y0 - cy0 - m, x1 - cx0 + m, y1 - cy0 + m)
        d.rounded_rectangle(r, radius=max(4, m * 2), fill=(255, 230, 0, 46), outline=(255, 120, 0, 235), width=lw)
        c = Image.alpha_composite(c, ov)
    c = c.convert('RGB'); c.thumbnail((MAXW, MAXH), Image.LANCZOS); q = Q0
    while True:
        c.save(out, 'WEBP', quality=q, method=6)
        if os.path.getsize(out) <= LIMIT or q <= 40: break
        q -= 8
def words(d):
    for si, sc in enumerate(d['scenes']):
        for wi, w in enumerate(sc['words']): yield f"{d['id']}w{si}_{wi}", w[0]
if __name__ == '__main__':
    force = '--force' in sys.argv
    for d in DAYS:
        C = d.get('crops')
        if not C: continue
        os.makedirs(os.path.join(ROOT, 'img', d['id'], 'w'), exist_ok=True); cache = {}; n = 0
        ws = list(words(d)); known = {ja for _, ja in ws}
        for ja in C:
            if ja not in known: print('  ⚠ crops 裡有不存在的單字：', ja)
        for wid, ja in ws:
            if ja not in C: print('  ⚠ 沒有小截圖：', ja); continue
            out = os.path.join(ROOT, 'img', d['id'], 'w', wid + '.webp')
            if os.path.exists(out) and not force: continue
            p, b = C[ja][0], C[ja][1]
            crop_one(photo(d, p, cache), b, out, 'nomark' not in C[ja][2:] and 'fallback' not in C[ja][2:]); n += 1
        print(d['id'], 'crops made', n)
        # 🧩 整句截圖：同一句裡的單字框（同一張照片）合起來＝整句的框
        from jt_phrases import PHR_D
        os.makedirs(os.path.join(ROOT, 'img', d['id'], 'q'), exist_ok=True); n = 0
        for qi, q in enumerate(PHR_D.get(d['id'], [])):
            bx = [C[w] for w in q['w'] if w in C and 'fallback' not in C[w][2:]]
            if not bx: print('  ⚠ 整句沒有截圖：', q['ja']); continue
            from jt_phrases import qphoto; p = qphoto(q, C)
            bb = [b[1] for b in bx if b[0] == p]
            box = q.get('box') or (min(b[0] for b in bb), min(b[1] for b in bb), max(b[2] for b in bb), max(b[3] for b in bb))
            out = os.path.join(ROOT, 'img', d['id'], 'q', f"{d['id']}q{qi}.webp")
            if os.path.exists(out) and not force: continue
            crop_one(photo(d, p, cache), box, out, True, ctx=0.5); n += 1
        print(d['id'], 'phrase crops made', n)
