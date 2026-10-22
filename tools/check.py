import sys, json; sys.path.insert(0,'/workspace/jimtof-talk/tools'); sys.path.insert(0,'/workspace/bunka-nihongo-app/tools')
from build import AL
from vv_client import post
from vv_norm import norm
from gen import prep, setup_dict
setup_dict()
bad=0
for x in AL:
    q=json.loads(post('/audio_query', text=prep(x['ja']), speaker=11))
    got=''.join(m['text'] for p in q['accent_phrases'] for m in p['moras'])
    if norm(got)!=norm(x['kana']): bad+=1; print('MISMATCH', x['id'], x['ja'], got, x['kana'])
print('mismatch', bad, 'of', len(AL))
