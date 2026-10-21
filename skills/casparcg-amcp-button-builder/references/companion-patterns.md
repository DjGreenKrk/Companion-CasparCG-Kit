# Bitfocus Companion patterns for CasparCG

Companion 3.x/4.x/5.x button = one or more **steps** (Companion 5.1 exports call it `button-layered`); each step has actions on press ("down"). Steps advance on every press (step 1, then step 2, then back to step 1), which is what makes "show / hide" a single button.

Actions you will meet in a CasparCG show (UI name -> `definitionId` in the exported config):
- `caspar: Manually specify AMCP command` -> `COMMAND`, option `cmd` = the raw AMCP line. Optional "Delay: N ms" in the UI sets a per-action delay.
- `internal: Wait` -> `wait`, option `time` in **milliseconds** (often an expression, `isExpression: true`).
- `internal: Button press/release` -> `button_pressrelease`, option `location` = `page/row/column` (e.g. `4/0/4`). Used to chain buttons (e.g. press a "stinger" button from an intro button).
- `atem: ...` (`loadPreset`, `aux`) switchers are usually in the same show; AMCP rules don't apply to them.

Local variables (button -> "Local Variables" tab) are referenced as `$(local:name)`. They would be the right way to build many near-identical buttons (write the command once, duplicate the button, change only the variable), **but module 2.1.2 sends them as `$NA`** (tested: `PLAY 2-12 "$(local:clip)"` → `PLAY 2-12 "$NA"`; `$(custom:...)` in the same command was replaced correctly). With 2.1.2 use custom (global) variables, or the 3.x fork below.

## Companion CasparCG Kit 3.x (GreenCrew build of the module)
Based on the official 2.1.2 (repo `Companion-CasparCG-Kit`, version `3.0.0-beta.1-by-GC`, listed in Companion as "CasparCG: Server (GreenCrew)", installed as a module package `.tgz` via Modules → Import module package), tested end-to-end with Companion 5.1.0 and CasparCG 2.5.1. It has the same action ids as 2.1.2 and an upgrade script, so existing buttons keep working; `COMMAND` stays and now takes several lines (one command per line).
- Every field takes variables, including `$(local:...)`.
- Template data as `f0="$(local:name)" f1="$(custom:role)"` is sent as JSON or XML; text from a variable may contain quotes, commas and `=` (fixed in 3.x after a test: `Jan "Kowal" Nowak` was cut to `Jan `).
- Template actions (CG ADD / UPDATE) have *Pass data as*: **Text** (standard CG data, template parses JSON/XML) or **Object** (`CG INVOKE "update({...})"`, for templates written as `update({ name: ..., accent: ... })`); data from *Fields* (`name="$(local:name)" accent="#c8ff67"`, any number, quote-safe) or a pasted raw call `update({ name: "$(local:name)" });`.
- `HTML_SHOW` / `HTML_HIDE` ("Custom HTML graphic"): the operator's own lower third as HTML + CSS in the action, `{{f0}}`-style fields, slide / wipe / fade measured from the graphic, hide = out-animation then `CLEAR`. No template file on the server (`PLAY [HTML]` with a host page in a data URL + `CG UPDATE`). Texts can be changed on air with `CG UPDATE`; tally name `HTML:<NAME>`. The module doubles backslashes in all CG data (2.5.1 would otherwise break JSON with quotes in values).
- Actions with fields instead of raw AMCP (definitionId → what it sends): `PLAY` / `LOADBG` / `LOAD` (clip, loop, `SEEK`, `LENGTH`, `AUTO` offered only on LOADBG, transition incl. VFADE/FADECUT/CUTFADE/STING, tween, direction, "reset transforms first" = `MIXER ch-l CLEAR` before the clip), `PAUSE`, `RESUME`, `PAUSE_TOGGLE`, `STOP`, `CLEAR` (optional transform reset), `CLEAR_ALL`, `CALL_PARAM` (`CALL`/`CALLBG` LOOP/SEEK/LENGTH/IN/OUT), `GOTO`, `SWAP`, `MIXER_PROP` (opacity/volume/brightness/saturation/contrast in %), `MIXER_FILL` (%), `MIXER_MASTERVOLUME`, `MIXER_CLEAR`, `MIXER_COMMIT`, `CG ADD`/`UPDATE`/`PLAY`/`NEXT`/`STOP`/`REMOVE`/`CLEAR`/`INVOKE`. The module checks tweens (table and parameter format), directions and sting names before sending and logs the server's error with a hint (`404 PLAY FAILED - clip / template not found`).
- Feedbacks from `INFO <channel>` polling (250 ms): tally (clip on air / cued), layer state (playing, paused, ended, empty, looping), "ending soon", connected, "command failed". Variables per layer: `$(caspar:c1_l10_clip)`, `_remaining`, `_time`, `_duration`, `_progress`, `_state`, `_loop`, `_bg`.
- Presets generated from `CLS`/`TLS`: a Play and a Cue button per file with tally, show/hide per template, transport, countdown display, mixer, and patterns 1 and 3 below.
- `scripts/check_caspar_buttons.py` checks only `COMMAND` actions; field-based actions are validated by the module itself.

## Pattern 1 - Lower third ("belka") with show/hide

Two steps on one button. Replace `<name>` with a variable for duplication: `$(local:name)` with Companion CasparCG Kit 3.x, a custom variable `$(custom:...)` with module 2.1.2 (local variables give `$NA` there).

Step 1 (show):
```
MIXER 1-10 CLEAR
(wait 100 ms)
PLAY 1-10 "BELKI/<name>" SLIDE 50 <tween> RIGHT      (50 frames = 1 s at 50 fps; RIGHT = enters from the left)
```
Order matters: tween first, then direction (`SLIDE 50 easeoutsine RIGHT`). The form found in existing shows, `SLIDE 50 FROM_LEFT EASEOUTEASE`, is accepted (`202`) but both words are ignored - it is a plain linear slide from the left, identical to `SLIDE 50` (tested on 2.5.1). Keeping it is harmless; switching to an eased form changes the look on air, so agree it with the operator.
Step 2 (hide):
```
MIXER 1-10 FILL -1 0 1 1 25      (slide off-screen left in 25 frames)
(wait 500 ms)
CLEAR 1-10
```
Notes: `MIXER CLEAR` first, because the previous hide left the layer shifted off-screen (tested: without it the next lower third slides in entirely off-screen and nothing is visible). If the wait before `CLEAR` is shorter than the out-animation (25 frames = 0.5 s at 50 fps), the graphic is cut (tested: with wait 200 it vanishes with about a third still on screen). Two simultaneous lower thirds (two speakers) need two layers (e.g. 1-10 and 1-9) and a hide step for each; the higher layer draws on top, and `CLEAR 1-10` leaves 1-9 alone.

## Pattern 2 - Intro video between stinger transitions

Layers: video/intro on one layer, stingers on a higher layer (stinger overlays the cut).
```
CLEAR <stinger layer>;  CLEAR <intro layer>
(wait 100)
PLAY <stinger> "STINGER_IN"                         # in-animation
LOADBG <stinger> "STINGER_HOLD" AUTO MIX 20          # held frame / loop (a short clip without LOOP freezes on its last frame until the next PLAY)
(wait ~3000)                                         # length until fully covered
PLAY <stinger> "STINGER_OUT"
(wait 200)
PLAY <intro layer> "intro/<name>"                    # intro starts under the stinger
(wait <intro length ms, tuned by the operator>)
...stinger again, CLEAR <intro layer>, final stinger-out
```
Wait times are tuned on the real server by the operator; they can differ from the file duration on purpose (overlap with the stinger). Do not "correct" them to the file length without asking. To chain two intros in one button, queue the second one with `LOADBG <intro layer> "intro/<second>" AUTO MIX 20` right after the first `PLAY` (it mixes in 20 frames before the first ends). **Not** `PLAY ... AUTO MIX 20` - with `PLAY` the second intro starts at once and cuts the first (tested on 2.5.1). If the first intro was started with `SEEK`, put `wait 100` before the `LOADBG ... AUTO`.

## Pattern 3 - Stinger hold / release
```
step 1: MIXER 1-12 CLEAR; wait 100; PLAY 1-12 "STINGER_1"; LOADBG 1-12 "STINGER_2" AUTO MIX 20 LOOP
step 2: LOADBG 1-12 "STINGER_3" AUTO MIX 20; wait 100; CALL 1-12 LOOP 0
```
Step 1 plays the in-clip and loops the hold clip; step 2 queues the out-clip and ends the loop so it plays when the loop finishes. Tested on 2.5.1: no black frame at either change and no seam in the loop. `LOOP 0` lets the **current pass** of the hold clip finish, and the out-clip starts mixing 20 frames before its end, so the release can take up to one hold-clip length (keep hold clips short if the operator expects a fast release). To make an already loaded background loop afterwards: `CALLBG 1-12 LOOP 1`.

## Pattern 4 - Timer/clock graphics
A fixed graphic (`TIMER_START`, `TIMER_BREAK`) uses the same show/hide two-step as a lower third. If it is HTML-driven (Ontime views as an HTML producer), use `PLAY 1-N [HTML] "https://..."` and remove with `CLEAR` (tested on 2.5.1: URL, `file:///` path and a bare template-folder name all work).

## Pitfalls
- Transforms survive `CLEAR` (see SKILL.md). If the user says "I clear the layer after each button", ask whether that is `CLEAR` (clips only) or `MIXER ... CLEAR` (transforms).
- Companion `wait` is ms; transition/mixer durations in AMCP are frames.
- A looped background (`LOOP`) keeps playing until released with `CALL <ch>-<layer> LOOP 0` or cleared.
- If a button does nothing, the cause is usually a wrong media name (404), an invalid tween (`403`, e.g. `SLIDE 50 EASEOUTEASE LEFT`), or a missing `MIXER CLEAR` leaving the graphic off-screen. Check the server log / Companion log first (the log line for a bad tween is just `Check syntax.`).
- If a button "works" but the animation looks wrong (no easing, wrong side), check token order and spelling: anything the transition parser does not recognise is ignored silently (`FROM_RIGHT` enters from the left).
- `PLAY ... SEEK n` followed at once by `LOADBG ... AUTO` starts the background immediately. Put `wait 100` between them.
- `AUTO` only works on `LOADBG`; `PLAY <clip> AUTO ...` plays at once.
- For a frame-accurate `STING`, load it in advance (`LOADBG <clip> STING ...`) and fire it with a bare `PLAY`; and never set `AUDIO_FADE_START + AUDIO_FADE_DURATION` shorter than the mask (it ends the sting early).
- A media name with a space needs quotes; without them the server answers `404`.
- Never use `CALL ... SEEK` without a frame number: the server never answers it.
- Graphics with transparency (lower thirds as video, stingers): ProRes 4444 or PNG, not QuickTime Animation (wrong semi-transparency on 2.5.1).
- If a whole channel is quiet after an earlier show, check `MIXER 1 MASTERVOLUME` - `MIXER CLEAR` does not reset it.
- **Tested end-to-end with Companion 5.1.0 + casparcg-server module 2.1.2** (buttons pressed through Companion's HTTP API, arrival times read from the CasparCG log):
  - Companion `wait` is accurate (100 ms → +100 ms, 500 ms → +499 ms). Actions in a step **without** a wait between them reach the server within ~1 ms of each other - the module does not wait for replies. That is why `PLAY ... SEEK` + `LOADBG ... AUTO` in one step need a `wait 100` between them.
  - The module copes with `400 ERROR` + echo and with commands that get no reply; errors appear in the connection log as `Got error COMMAND_UNKNOWN_DATA: <command>` (likewise for 404, 403, 501).
  - After a CasparCG restart the module reconnects by itself in ~3 s. A press while the server is down is **lost** (not queued) **but the button still advances to its next step**, so a show/hide button ends up inverted. Reset it with the step selector in the UI or `POST /api/location/<page>/<row>/<column>/step?step=1` (steps are 1-based), or give the operator a "safe state" button (`MIXER 1-10 CLEAR` + `CLEAR 1-10`).
  - A CasparCG restart wipes every layer, transform and `MASTERVOLUME`; Companion does not restore state.
  - Hand-made `.companionconfig` files for 5.1 (export version 12) must store action options as `{"isExpression": false, "value": ...}`; plain values import without error but are wiped when the module starts. Real exports are fine.
- After loudness normalisation, check the clip length on the server (`CINF`) - see SKILL.md (`atrim`).
- Exported `.companionconfig` files are large JSON (hundreds of kB). Use `scripts/dump_companion_config.py` to read them; don't paste them into the conversation.
