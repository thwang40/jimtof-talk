# 展會會話（JIMTOF 2026 出差日語）
Personal study PWA (Japanese for a JIMTOF 2026 trip). Same design/UX as 撿角日語 (nh-study): BAOJE catalogue colours, listen-first book-style dialogues,
key patterns in red bold, 🗣 開口練習 role-play (scene only → 💡 hint on request → original + 2 alternatives), search with 聽力模式, review list, offline download.
Audio: VOICEVOX (玄野武宏 / No.7 / 冥鳴ひまり / 雀松朱司); `_s` files are native 0.7x.
Content: `tools/jt_content.py` (phrases, dialogues), `tools/jt_rp.py` (role-play hints + alternatives, key patterns, partner names).
Rebuild: `python3 tools/build.py && python3 tools/gen.py audio` (needs local VOICEVOX engine; `tools/check.py` / `tools/check_rp.py` compare readings). Bump cache names in sw.js and AUDIO_CACHE in app.js on audio changes.
