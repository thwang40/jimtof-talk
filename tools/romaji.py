"""kana (spaced, as in jt_content) -> Hepburn romaji in the same style as the hand-written lines (macrons, wa/e/o particles)."""
import re
D = {}
base = {'あ':'a','い':'i','う':'u','え':'e','お':'o','か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko','さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
 'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to','な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no','は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
 'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo','や':'ya','ゆ':'yu','よ':'yo','ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro','わ':'wa','を':'o','ん':'n',
 'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go','ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo','だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
 'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo','ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po','ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o','ゔ':'vu'}
yo = {'ゃ':'a','ゅ':'u','ょ':'o'}
def kata2hira(s): return ''.join(chr(ord(c)-0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)
def word(w):
    w0 = w; h = kata2hira(w); out = ''; i = 0
    while i < len(h):
        c = h[i]; n = h[i+1] if i+1 < len(h) else ''
        if c == 'っ':
            nx = word(h[i+1:i+2]) if i+1 < len(h) else ''
            out += ('t' if nx.startswith('ch') else nx[:1]); i += 1; continue
        if c == 'ー':
            out += {'a':'ā','i':'ī','u':'ū','e':'ē','o':'ō'}.get(out[-1:], '') if out else ''
            if out[-2:-1] in 'āīūēō' and out[-1:] == '': pass
            if out and out[-1] in 'āīūēō' and len(out) >= 2 and out[-2] in 'aiueo': out = out[:-2] + out[-1]
            i += 1; continue
        if n in yo and c in base:
            b = base[c]; b = b[:-1] if b not in ('shi','chi','ji') else b[:-1]
            out += (b if b.endswith(('sh','ch','j')) else b + 'y') + yo[n]; i += 2; continue
        if c == 'ん' and n and kata2hira(n)[0] in 'あいうえおやゆよ': out += "n'"; i += 1; continue
        out += base.get(c, c); i += 1
    # long vowels: ou/oo -> ō, uu -> ū (not across a boundary we can't see; good enough for these lines)
    out = re.sub(r'o[ou]', 'ō', out); out = re.sub(r'uu', 'ū', out)
    return out
NOSPLIT = {'ちょっと','とても','でも','もっと','きっと','ずっと','では','には','いいえ','いえいえ','こちらこそ','ようこそ','なんで','どうぞ','もう','まだ','すこし','すぐ','また'}
TAIL = ['でしょうか','ですか','ですね','ですよ','ですよね','でした','です','ますか','ませんか','ましたか']
PART = ['から','まで','には','では','へは','とは','より','の','を','に','で','と','が','は','へ','も','なら']
def split_tok(t):
    out = []
    for tl in TAIL:
        if t.endswith(tl) and len(t) > len(tl):
            head = t[:-len(tl)]
            if tl.startswith('ま'):   # itadakemasu ka: keep masu on the verb, split the final ka
                if tl.endswith('か'): return split_tok(t[:-1]) + ['か']
                return [t]
            return split_tok(head) + [tl[:2]] + ([tl[2:]] if len(tl) > 2 and tl[2:] not in ('しょうか',) else []) if tl != 'でしょうか' else split_tok(head) + ['でしょう', 'か']
    if t in NOSPLIT: return [t]
    for pt in PART:
        if t.endswith(pt) and len(t) > len(pt) and t[:-len(pt)] not in ('',):
            return split_tok(t[:-len(pt)]) + [pt]
    return [t]
PW = {'は':'wa','へ':'e','を':'o'}
def word_or_particle(x): return PW.get(x) or word(x)
NAMES = {'baojie':'BAOJE','ō':'Ō','ōsama':'Ō-sama','ōsan':'Ō-san','hamaguchi':'Hamaguchi','hamaguchisan':'Hamaguchi-san','taiwan':'Taiwan','shinkiba':'Shin-Kiba','ginza':'Ginza',
 'itchōme':'itchōme','yūrakuchōsen':'Yūrakuchō-sen','jimutofu':'JIMTOF','yokohama':'Yokohama','taipei':'Taipei','yamada':'Yamada'}
def romaji(kana):
    toks = re.split(r'(\s+|[、。！？!?，,…]+)', kana); res = []
    for t in toks:
        if not t: continue
        if re.fullmatch(r'\s+', t): res.append(' '); continue
        if re.fullmatch(r'[、。！？!?，,…]+', t):
            res.append(t.replace('、', ',').replace('。', '.').replace('！', '!').replace('？', '?').replace('，', ',')); continue
        res.append(' '.join(word_or_particle(x) for x in split_tok(t)))
    s = ''.join(res)
    s = re.sub(r'\s+([,.!?])', r'\1', s); s = re.sub(r'([,.!?])(?=\S)', r'\1 ', s); s = re.sub(r'\s+', ' ', s).strip()
    s = ' '.join(NAMES.get(w.lower(), w) if w.lower().strip(',.!?') not in NAMES else NAMES[w.lower().strip(',.!?')] + w[len(w.rstrip(',.!?')):] for w in s.split(' '))
    s = re.sub(r'Ginza itchōme', 'Ginza-itchōme', s)
    s = re.sub(r'(^|[.!?] )([a-zāīūēō])', lambda m: m.group(1) + m.group(2).upper(), s)
    return s
if __name__ == '__main__':
    for k in ['はじめまして。バオジェの おうと もうします。たいわんから まいりました。','ちょうだい します。こちら、わたしの めいしで ございます。',
              'しょうしょう おまち いただけますか。','チケット、ちょっと みせて もらえますか。','じゅうさんじに はまぐちさんと おやくそくを して おります、バオジェの おうです。',
              'こんごとも よろしく おねがい いたします。','クレジットカードは つかえますか。','キャッシュレスのみです。','ごりよう いただけません。','いいぞ！ナイスバッティング！','ほんいん']:
        print(romaji(k))
FIX = [(r'\bku ni\b','kuni'),(r'\bO mo ni\b','Omo ni'),(r'\b([Nn])a ni\b',r'\1ani'),(r'\b([Kk])o no\b',r'\1ono'),(r'\bso no\b','sono'),(r'\bmo no\b','mono'),
 (r'\bko to ni\b','koto ni'),(r'\bdeha\b','de wa'),(r'\bDeha\b','De wa'),(r'\bheha\b','e wa'),(r'\bniha\b','ni wa'),(r'deshi ta','deshita'),(r'\bDō mo\b','Dōmo'),
 (r'Kore kara mo','Korekara mo'),(r'\b([Kk])ongo to mo\b',r'\1ongotomo'),(r'\byon de\b','yonde'),(r'\bsusun de\b','susunde'),(r'\bTanoshin de\b','Tanoshinde'),
 (r'kudasaine','kudasai ne'),(r'imasuyo','imasu yo'),(r'arimasune','arimasu ne'),(r'okimasune','okimasu ne'),(r'masune\b','masu ne'),(r'\bōsa made\b','Ō-sama de'),
 (r'Nanmeisa made','Nanmei-sama de'),(r'batteingudeshitane','battingu deshita ne'),(r'Naisubatteingu','Naisu battingu'),(r'batteingu','battingu'),
 (r'Kurejittokādo','Kurejitto kādo'),(r'bōringubaito','bōringu baito'),(r'mēruadoresu','mēru adoresu'),(r'ichihōru','ichi hōru'),(r'Purasumainasu','Purasu mainasu'),
 (r'nimikuron','ni mikuron'),(r'Reitensanmiri','Rei-ten-san miri'),(r'reitensanmiri','rei-ten-san miri'),(r'\b([Nn])anmiri','\\1an miri'),(r'kyasshuresunomi','kyasshuresu nomi'),
 (r'([Kk])ochirakoso',r'\1ochira koso'),(r'([Oo])machishite',r'\1machi shite'),(r'okikishite','okiki shite'),(r'\bHee\b','Hē'),(r'\bIizo\b','Ii zo'),
 (r'Donoyōna','Dono yō na'),(r'donoyōna','dono yō na'),(r'donokurai','dono kurai'),(r'\bSōnan\b','Sō nan'),(r'nibansen','ni-bansen'),(r'gofun','go-fun'),(r'Jūsanji','Jūsan-ji'),(r'jūsanji','jūsan-ji')]
_romaji = romaji
def romaji(kana):
    s = _romaji(kana)
    for a, b in FIX: s = re.sub(a, b, s)
    return s[:1].upper() + s[1:]
