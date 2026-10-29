"""VOICEVOX audio for JIMTOF phrases (same pipeline as nh-study: kanji input + user dictionary + prosody.fix).
Usage: python gen.py OUTDIR [--force] [--slow-only]  -> OUTDIR/{id}.mp3 (1.0x) and {id}_s.mp3 (native 0.7x); also 開口練習 alternatives {a}-r_{k}"""
import json, subprocess, os, sys, re, urllib.request
sys.path.insert(0, '/workspace/bunka-nihongo-app/tools'); sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vv_client import H, post
from prosody import fix
SPK = {'me': 11, 'f': 29, 'f2': 14, 'm2': 52}          # 玄野武宏 / No.7 / 冥鳴ひまり / 雀松朱司
QBOOST = {11: (0.1, 0.18), 52: (0.1, 0.18)}
DICT = [('BAOJE','バオジェ',2,'PROPER_NOUN',10),('小径','ショウケイ',0,'COMMON_NOUN',9),('穴径','アナケイ',0,'COMMON_NOUN',9),
        ('公差','コウサ',1,'COMMON_NOUN',9),('浜口','ハマグチ',2,'PROPER_NOUN',10),('新木場','シンキバ',2,'PROPER_NOUN',10),
        ('銀座一丁目','ギンザイッチョウメ',5,'PROPER_NOUN',10),('国際展示場駅','コクサイテンジジョウエキ',7,'PROPER_NOUN',10),
        ('有楽町線','ユウラクチョウセン',0,'PROPER_NOUN',10),('JIMTOF','ジムトフ',1,'PROPER_NOUN',10),('王様','オウサマ',1,'PROPER_NOUN',9)]
def setup_dict():
    cur = json.loads(urllib.request.urlopen(H + '/user_dict').read())
    have = {v['surface'] for v in cur.values()}
    z = lambda s: ''.join(chr(ord(c)+0xFEE0) if '!' <= c <= '~' else c for c in s)
    for s,p,a,t,pr in DICT:
        if z(s) not in have and s not in have:
            post('/user_dict_word', surface=s, pronunciation=p, accent_type=a, word_type=t, priority=pr)
SAY = [('関内', 'かんない'), ('食事時', 'しょくじどき'), ('着時刻', 'ちゃくじこく'), ('四時に開きます', '四時にあきます'), ('10個入', 'じゅっこいり'), ('話せる方', '話せるかた'), ('初めての方', '初めてのかた'), ('何でしょうか', 'なんでしょうか'), ('お書きします', 'おかきします'), ('串玉', 'くしたま'), ('何分かかり', 'なんぷんかかり'), ('空箱', 'からばこ'), ('強炭酸', 'きょうたんさん'), ('台湾の方', '台湾のかた'), ('辛い', 'からい'), ('ターミナル行き', 'ターミナルゆき'), ('でない方', 'でないかた'), ('行先', 'ゆきさき'), ('サイト行き', 'サイトゆき'), ('点盛り', 'てんもり'), ('空港行き', 'くうこうゆき'), ('何枚入', 'なんまいいり'), ('枚入', 'まいいり'), ('ある方の', 'あるかたの'), ('一箱', 'ひとはこ'), ('何回でも入れます', 'なんかいでもはいれます'), ('ない人は入れません', 'ないひとははいれません'), ('また入れますか', 'またはいれますか'), ('9時から開きます', 'くじからあきます'), ('G6', 'ジーシックス'), ('YASDA', 'ヤスダ'), ('寿司処', 'すしどころ'), ('金型', 'かながた'), ('粗磨き', 'あらみがき'), ('中仕上げ', 'なかしあげ'), ('中央口', 'ちゅうおうぐち'), ('驚安', 'きょうやす'), ('大時計', 'おおどけい'), ('赤羽橋口', 'あかばねばしぐち'), ('赤羽橋', 'あかばねばし'), ('大門', 'だいもん'), ('両国', 'りょうごく'), ('黒い粒', 'くろいつぶ'), ('宮崎駿', 'みやざきはやお'), ('次の角', 'つぎのかど'), ('無塩', 'むえん'), ('黄色に', 'きいろに'), ('近江牛', 'おうみぎゅう'), ('左側面', 'ひだりそくめん'), ('下図', 'かず'), ('米粉', 'こめこ'), ('一食分', 'いっしょくぶん'), ('1食分', 'いっしょくぶん'), ('赤辛', 'あかから'), ('持って入れますか', 'もってはいれますか')]  # VOICEVOX misreadings
def prep(t):
    for a, b in SAY: t = t.replace(a, b)
    return re.sub(r'(?<!そうです)か。', 'か？', t)
# re-segment accent phrases the engine groups badly: tuple of phrase texts -> [(text, accent), ...]
REPHRASE = {('ジュウ','サンジニ'): [('ジュウサンジニ',3)],
            ('ショウケイボオリングバイトオ',): [('ショウケイ',0),('ボオリングバイトオ',6)]}
def rephrase(q, spk):
    aps = q['accent_phrases']; out = []; i = 0; changed = False
    while i < len(aps):
        for pat, new in REPHRASE.items():
            seg = aps[i:i+len(pat)]
            if tuple(''.join(m['text'] for m in p['moras']) for p in seg) == pat:
                ms = [m for p in seg for m in p['moras']]; k = 0
                for j, (t, a) in enumerate(new):
                    n = 0; acc = ''
                    while acc != t: acc += ms[k+n]['text']; n += 1
                    last = j == len(new) - 1
                    out.append(dict(moras=ms[k:k+n], accent=a or n, pause_mora=seg[-1].get('pause_mora') if last else None,
                                    is_interrogative=seg[-1].get('is_interrogative', False) if last else False)); k += n
                i += len(pat); changed = True; break
        else:
            out.append(aps[i]); i += 1
    if changed:
        q['accent_phrases'] = json.loads(post('/mora_data', out, speaker=spk))
    return q
def query(text, spk):
    return rephrase(json.loads(post('/audio_query', text=text, speaker=spk)), spk)
def synth(text, spk, out, speed):
    q = query(text, spk)
    q = fix(q, text, 'new', QBOOST, spk)
    q.update(speedScale=speed, prePhonemeLength=0.1, postPhonemeLength=0.15, outputSamplingRate=24000)
    wav = post('/synthesis', q, speaker=spk)
    p = subprocess.run(['ffmpeg','-y','-loglevel','error','-f','wav','-i','pipe:0','-ac','1','-b:a','56k',out], input=wav)
    assert p.returncode == 0, out
if __name__ == '__main__':
    from build import AL, RALT
    from concurrent.futures import ThreadPoolExecutor
    OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True); force = '--force' in sys.argv
    setup_dict(); jobs = []
    slow_only = '--slow-only' in sys.argv   # re-render every _s file at 0.7x (keeps 1.0x files)
    for x in AL + RALT:
        for suf, sp in (('', 1.0), ('_s', 0.7)):
            o = f"{OUT}/{x['id']}{suf}.mp3"
            if force or not os.path.exists(o) or (slow_only and suf == '_s'): jobs.append((prep(x['ja']), SPK[x['v']], o, sp))
    with ThreadPoolExecutor(4) as ex: list(ex.map(lambda j: synth(*j), jobs))
    print('generated', len(jobs))
