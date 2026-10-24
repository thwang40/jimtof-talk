"""Build data.js from content.py, and (with --audio OUT) generate VOICEVOX audio; --check compares readings."""
import sys, os, json, re
T = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, T)
sys.path.insert(0, '/workspace/bunka-nihongo-app/tools')
from jt_content import CATS
from jt_rp import RP, PATTERNS, PARTNER
from romaji import romaji
ROOT = os.path.join(T, '..')
def build():
    cats = []; lines_all = []
    ALLP = {p[0]: (f"{c['id']}_{i}", p) for c in CATS for i, p in enumerate(c['phrases'])}
    for c in CATS:
        P = {}; phrases = []
        for i, p in enumerate(c['phrases']):
            ja, kana, ro, zh = p[:4]; note = p[4] if len(p) > 4 else ''
            o = dict(id=f"{c['id']}_{i}", ja=ja, kana=kana, ro=ro, zh=zh, note=note, v='me'); phrases.append(o); P[ja] = o
            lines_all.append(o)
        dls = []
        for di, d in enumerate(c['dialogues']):
            ls = []
            for li, l in enumerate(d['lines']):
                role = l[0]
                if len(l) == 2:
                    pid, pp = ALLP[l[1]]; ref = dict(id=pid, ja=pp[0], kana=pp[1], ro=pp[2], zh=pp[3])
                    ls.append(dict(r=role, ja=ref['ja'], kana=ref['kana'], ro=ref['ro'], zh=ref['zh'], note='', a=ref['id'], p=ref['id']))
                else:
                    ja, kana, ro, zh = l[1:5]; note = l[5] if len(l) > 5 else ''
                    hit = next((x for x in lines_all if x['ja'] == ja and x['v'] == role), None)
                    aid = hit['id'] if hit else f"{c['id']}d{di}_{li}"
                    o = dict(r=role, ja=ja, kana=kana, ro=ro, zh=zh, note=note, a=aid)
                    if not hit: lines_all.append(dict(id=aid, ja=ja, kana=kana, v=role))
                    ls.append(o)
            dls.append(dict(id=f"{c['id']}d{di}", t=d['t'], scene=d['scene'], lines=ls))
        cats.append(dict(id=c['id'], icon=c['icon'], t=c['t'], phrases=phrases, dialogues=dls))
    return cats, lines_all
cats, AL = build()
# 🗣 開口練習：每句台詞的提示＋另外兩種說法（音檔 audio/<a>-r_<k>.mp3，聲音跟原句同一個角色）
RPD = {ja: [cue, [[a[0], a[1], romaji(a[1]), a[2]] for a in alts]] for ja, (cue, alts) in RP.items()}
RALT = []   # [{id, ja, v}] for gen.py
_seen = set()
for c in cats:
    for d in c['dialogues']:
        d['pn'] = PARTNER.get(d['id'], '對方')
        for l in d['lines']:
            if l['a'] in _seen: continue
            _seen.add(l['a'])
            for k, a in enumerate(RP[l['ja']][1]): RALT.append(dict(id=f"{l['a']}-r_{k}", ja=a[0], kana=a[1], v=l['r']))
if __name__ == '__main__':
    audio = sorted({x['id'] for x in AL})
    files = [f'audio/{a}{s}.mp3' for a in audio + [x['id'] for x in RALT] for s in ('', '_s')]
    data = dict(cats=cats, audio=audio, rp=RPD, pat=[list(p) for p in PATTERNS], files=files)
    open(os.path.join(ROOT, 'data.js'), 'w').write('window.JT=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('phrases', sum(len(c['phrases']) for c in cats), 'dialogues', sum(len(c['dialogues']) for c in cats),
          'dlg lines', sum(len(d['lines']) for c in cats for d in c['dialogues']), 'audio clips', len(audio), 'rp alts', len(RALT), 'files', len(files))
