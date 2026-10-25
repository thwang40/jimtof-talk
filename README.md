# 展會會話（JIMTOF 2026 出差日語）
Personal study PWA (Japanese for a JIMTOF 2026 trip). Same design/UX as 撿角日語 (nh-study): BAOJE catalogue colours, listen-first book-style dialogues,
key patterns in red bold, 🗣 開口練習 role-play (scene only → 💡 hint on request → original + 2 alternatives), search with 聽力模式, review list, offline download.
Audio: VOICEVOX (玄野武宏 / No.7 / 冥鳴ひまり / 雀松朱司); `_s` files are native 0.7x.
Content: `tools/jt_content.py` (phrases, dialogues), `tools/jt_rp.py` (role-play hints + alternatives, key patterns, partner names).
Rebuild: `python3 tools/build.py && python3 tools/gen.py audio` (needs local VOICEVOX engine; `tools/check.py` / `tools/check_rp.py` compare readings). Bump cache names in sw.js and AUDIO_CACHE in app.js on audio changes.

## 🗾 日本行每日（出差期間每天一個單元）
Content: `tools/jt_daily.py` — `DAYS` list (one dict per day: scenes with photos / words in the photo / tip / phrases tagged with the 《文化初級日本語》 lesson `L` / refs to pre-trip sentences, dialogues, `must5`), `RP_D` (role-play hints + 2 alternatives for every dialogue line), `PAT_D`, `ROFIX` (romaji fixes).
To add a day: append a dict to `DAYS` (id `dMMDD`), put photos in `img/<id>/` (long edge ≤1280px, WebP q75, ≤200KB each, never originals; blur names/barcodes), then
`python3 tools/build.py && python3 tools/check.py && python3 tools/check_rp.py && python3 tools/gen.py audio` (only new clips are generated), bump `SHELL`/`AUDIO` in sw.js (+ migration) and `AUDIO_CACHE` in app.js.
UI: home 「🗾 日本行每日」 section + sidebar group; day page tab 📷 照片教學 (`#/c/<id>/g`), 📣 句子, 🎧 對話; 今日 5 句必背 跟讀 at `#/sh/<id>-m5`.
