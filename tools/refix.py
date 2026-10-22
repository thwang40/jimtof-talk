import sys, json, subprocess, re
sys.path.insert(0,'/workspace/bunka-nihongo-app/tools'); sys.path.insert(0,'tools')
import numpy as np, parselmouth
import gen
from build import AL
def st_of(path):
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',path,'-ar','16000','-ac','1','/tmp/r2.wav'])
    p = parselmouth.Sound('/tmp/r2.wav').to_pitch(time_step=0.01, pitch_floor=50, pitch_ceiling=500)
    tt = p.xs(); f = p.selected_array['frequency']; ok = f > 0; tv = tt[ok]; fv = f[ok]
    w = fv[tv > tv[-1]-0.5]; w = w[(w > 0.6*np.median(w)) & (w < 1.6*np.median(w))]
    j = int(np.argmin(w[:-2])); return 12*np.log2(w[j:].max()/w[j])
ids = {x['id']: x for x in AL}
for fid in sys.argv[1:]:
    base, s = (fid[:-2], 0.8) if fid.endswith('_s') else (fid, 1.0)
    x = ids[base]; spk = gen.SPK[x['v']]
    for kb, ln in [(0.15,0.2),(0.2,0.22),(0.25,0.24),(0.3,0.26)]:
        gen.QBOOST[spk] = (kb, ln)
        gen.synth(gen.prep(x['ja']), spk, f'audio/{fid}.mp3', s)
        v = st_of(f'audio/{fid}.mp3'); print(fid, kb, round(v,1))
        if v > 3: break
