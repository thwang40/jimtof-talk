"""📷 日本行每日：照片單字小截圖。
Usage: python3 tools/crops.py [--force]  -> img/<day>/w/<word id>.webp（長邊 ≤480px，WebP q≈70，≤30KB）
設定寫在 tools/jt_daily.py 的 CROPS_D（crops / orig / blur）。先裁原檔（比較清楚），沒有原檔就裁 img/<day>/<照片>.webp。
blur 的框一定先打馬賽克再裁，個資（姓名、條碼、票號、房號、座位號碼）不會出現在小截圖。"""
import os, sys
from PIL import Image, ImageOps, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jt_daily import DAYS
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAXE, Q0, LIMIT = 480, 72, 30000
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
def crop_one(im, b, out):
    W, H = im.size; x0, y0, x1, y1 = b[0] * W, b[1] * H, b[2] * W, b[3] * H
    pad = max(0.45 * min(y1 - y0, x1 - x0), 0.012 * max(W, H))
    c = im.crop((int(max(0, x0 - pad)), int(max(0, y0 - pad)), int(min(W, x1 + pad)), int(min(H, y1 + pad))))
    c.thumbnail((MAXE, MAXE), Image.LANCZOS); q = Q0
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
            crop_one(photo(d, p, cache), b, out); n += 1
        print(d['id'], 'crops made', n)
