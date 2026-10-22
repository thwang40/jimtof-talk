"""Build data.js from content.py, and (with --audio OUT) generate VOICEVOX audio; --check compares readings."""
import sys, os, json, re
T = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, T)
sys.path.insert(0, '/workspace/bunka-nihongo-app/tools')
from jt_content import CATS
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
if __name__ == '__main__':
    audio = sorted({x['id'] for x in AL})
    data = dict(cats=cats, audio=audio)
    open(os.path.join(ROOT, 'data.js'), 'w').write('window.JT=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('phrases', sum(len(c['phrases']) for c in cats), 'dialogues', sum(len(c['dialogues']) for c in cats),
          'dlg lines', sum(len(d['lines']) for c in cats for d in c['dialogues']), 'audio clips', len(audio))
