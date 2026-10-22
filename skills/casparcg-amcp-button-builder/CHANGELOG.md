# casparcg-amcp-button-builder — changelog

Version in `SKILL.md` (`metadata.version`). Major: advice replaced or removed; minor: new tested
facts or sections; patch: wording and corrections without changing advice.

## 2.1.1 — 2026-10-22

* [BUGFIX] A wrong layer number (negative, above 2147483647, with letters) is answered `202` and plays on layer 0; layer range and count measured

## 2.1.0 — 2026-10-22

Compared with the official documentation (old wiki, casparcg.com/docs, v2.5.1-stable source) and measured on 2.5.1 what it leaves out.

* [FEATURE] Other producers: colour (`#AARRGGBB`, names, gradients), scrolling image (`SPEED` / `DURATION` / `END_TIME`, `CALL SPEED` with a tween), `[HTML]` pages with `CALL "<js>"` / `RELOAD`, SRT / UDP / NDI / DeckLink sources with measured start time and delay
* [FEATURE] `CALL SEEK REL` / `IN` / `OUT` / `END` with an offset
* [FEATURE] OSC section: default sending to AMCP clients on 6250, `OSC SUBSCRIBE`, the 2.5 address list; audio levels are not sent on 2.5.1
* [FEATURE] Outputs: `STREAM` (SRT) consumer, `IMAGE` snapshot, NDI out; queries `INFO PATHS` / `CONFIG`, `GL INFO`, `DIAG`, `NDI LIST`, thumbnail format (256×144 PNG)
* [BUGFIX] `IMAGE` and `PRINT` save the picture from the previous snapshot - take two, use the second
* [BUGFIX] `CALL` on a colour layer never answers
* [BUGFIX] An unknown ffmpeg codec in `ADD … FILE` hangs and then crashes the server; an output number in use is replaced; an SRT output that never connected cannot be removed

## 2.0.0 — 2026-10-21

Verified on a real CasparCG 2.5.1 server and Companion 5.1.0 (recordings analysed frame by frame).
Renamed from `casparcg-amcp` (the old name did not say what the skill does); install it under the new folder name and remove the old one.

* [CHANGE] Tweens: list and parameter format replaced with the values accepted by 2.5.1; invalid tween = `403`
* [CHANGE] Transition directions: token order and meaning corrected (`SLIDE 50 easeoutsine RIGHT` enters from the left; `FROM_LEFT EASEOUTEASE` is ignored)
* [CHANGE] STING cut mode, response codes table, loudness normalisation (`atrim` to the video length)
* [CHANGE] Local variables in Companion: recommendation corrected - module 2.1.2 sends them as `$NA`; global variables or Companion CasparCG Kit 3.x
* [FEATURE] 2.4/2.5 additions verified: CALLBG, CLEAR ALL, CLEAR_ON_404, BEGIN/COMMIT, VFADE/FADECUT/CUTFADE, STING audio fade
* [FEATURE] AMCP reply order: replies for different channels arrive out of order
* [FEATURE] HTML templates: data escaping in 2.5.1 (`update("...")` escapes only quotes), plain text data = empty, data URLs up to ~4 KB, `CG INVOKE "update({...})"` passes an object, play-on-load latency
* [FEATURE] Companion: Companion CasparCG Kit 3.x section, `wait` accuracy, lost presses during reconnect, `check_caspar_buttons.py` linter
* [BUGFIX] STING mask / overlay names with spaces do not load (404 in both forms)
* [BUGFIX] PRINT can save a stale frame - verify with a recording

## 1.0.0

Starting point (named `casparcg-amcp`, unversioned at the time).
