"""Build data.js from content.py, and (with --audio OUT) generate VOICEVOX audio; --check compares readings."""
import sys, os, json, re
T = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, T)
sys.path.insert(0, '/workspace/bunka-nihongo-app/tools')
from jt_content import CATS
from jt_rp import RP, PATTERNS, PARTNER
from romaji import romaji
from jt_daily import DAYS, RP_D, PAT_D, rj
ROOT = os.path.join(T, '..')
# 🗾 日本行每日：轉成跟行前單元一樣的格式接在後面（L＝課本課別）
LES = {}
for _d in DAYS:
    _ph = [p for sc in _d['scenes'] for p in sc['phrases']]
    for p in _ph:
        if p[4]: LES[p[0]] = p[4]
    _dl = []
    for dd in _d['dialogues']:
        ls = []
        for l in dd['lines']:
            if len(l) == 2: ls.append(l)
            else:
                ls.append((l[0], l[1], l[2], rj(l[2]), l[3], l[4] if len(l) > 4 else ''))
                if len(l) > 5 and l[5]: LES[l[1]] = l[5]
        _dl.append(dict(t=dd['t'], scene=dd['scene'], lines=ls))
    CATS = CATS + [dict(id=_d['id'], icon=_d['icon'], t=_d['t'], day=_d, phrases=[(p[0], p[1], rj(p[1]), p[2], p[3]) for p in _ph], dialogues=_dl)]
    for i, dd in enumerate(_d['dialogues']): PARTNER[f"{_d['id']}d{i}"] = dd['pn']
for k, v in RP_D.items(): RP.setdefault(k, v)
PATTERNS = list(PATTERNS) + [p for p in PAT_D if p[0] not in {x[0] for x in PATTERNS}]
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
        for o in phrases + [l for d in dls for l in d['lines']]:
            if c.get('day') and o['ja'] in LES: o['L'] = LES[o['ja']]
        cat = dict(id=c['id'], icon=c['icon'], t=c['t'], phrases=phrases, dialogues=dls)
        if c.get('day'):
            D = c['day']; n = 0; scenes = []
            for sc in D['scenes']:
                ids = [f"{c['id']}_{n+i}" for i in range(len(sc['phrases']))]; n += len(sc['phrases'])
                refs = [[ALLP[ja][0], why] for ja, why in sc['refs']]
                scenes.append(dict(t=sc['t'], imgs=[[f"img/{c['id']}/{f}.webp", cap] for f, cap in sc['imgs']],
                                   words=[list(w) for w in sc['words']], tip=sc['tip'], ids=ids, refs=refs))
            P = {p['ja']: p['id'] for p in phrases}
            cat.update(day=1, date=D['date'], intro=D['intro'], scenes=scenes, m5=[[P[ja], use] for ja, use in D['must5']])
        cats.append(cat)
    return cats, lines_all
cats, AL = build()
# 🗣 開口練習：每句台詞的提示＋另外兩種說法（音檔 audio/<a>-r_<k>.mp3，聲音跟原句同一個角色）
RPD = {ja: [cue, [[a[0], a[1], (rj if ja in RP_D else romaji)(a[1]), a[2]] for a in alts]] for ja, (cue, alts) in RP.items()}
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
    imgs = [u for c in cats for sc in c.get('scenes', []) for u, _ in sc['imgs']]
    data = dict(cats=cats, audio=audio, rp=RPD, pat=[list(p) for p in PATTERNS], files=files, imgs=imgs)
    open(os.path.join(ROOT, 'data.js'), 'w').write('window.JT=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('phrases', sum(len(c['phrases']) for c in cats), 'dialogues', sum(len(c['dialogues']) for c in cats),
          'dlg lines', sum(len(d['lines']) for c in cats for d in c['dialogues']), 'audio clips', len(audio), 'rp alts', len(RALT), 'files', len(files))
