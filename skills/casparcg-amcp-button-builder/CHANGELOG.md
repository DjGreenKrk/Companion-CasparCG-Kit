# casparcg-amcp-button-builder — changelog

Version in `SKILL.md` (`metadata.version`). Major: advice replaced or removed; minor: new tested
facts or sections; patch: wording and corrections without changing advice.

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
