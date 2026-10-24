import json, subprocess, re, sys, numpy as np, parselmouth
sys.path.insert(0,'tools')
from build import RALT as AL
WH = re.compile(r'(何(?!か)|どこ|どちら|どの|どんな)')
def prep(t): return re.sub(r'(?<!そうです)か。', 'か？', t)
for x in AL:
    t = prep(x['ja']).strip()
    if not t.endswith('？'): continue
    for suf in ('', '_s'):
        subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f"audio/{x['id']}{suf}.mp3",'-ar','16000','-ac','1','/tmp/r.wav'])
        p = parselmouth.Sound('/tmp/r.wav').to_pitch(time_step=0.01, pitch_floor=50, pitch_ceiling=500)
        tt = p.xs(); f = p.selected_array['frequency']; ok = f > 0; tv = tt[ok]; fv = f[ok]
        w = fv[tv > tv[-1]-0.5]; w = w[(w > 0.6*np.median(w)) & (w < 1.6*np.median(w))]
        j = int(np.argmin(w[:-2])); st = 12*np.log2(w[j:].max()/w[j])
        kind = 'WH ' if WH.search(t.split('。')[-1] if '。' in t[:-1] else t) else 'Y/N'
        print(f"{kind} {st:5.1f}st {x['v']:3} {x['id']}{suf} {x['ja']}")
