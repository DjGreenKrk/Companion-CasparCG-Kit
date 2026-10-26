---
name: casparcg-amcp-button-builder
description: Write, review and debug CasparCG server commands (AMCP) and the Bitfocus Companion buttons that send them - lower thirds ("belki"), intro videos, stingers, timers, looped ad breaks, transitions (MIX/PUSH/WIPE/SLIDE/STING), MIXER commands (FILL, VOLUME, OPACITY, CLEAR), colour / gradient / scrolling-credits / web-page / SRT and NDI sources, recording and streaming outputs, OSC live state, layer/channel planning, casparcg.config, and audio loudness matching of media files. Use whenever the user mentions CasparCG, Caspar, AMCP, "PLAY 1-10", stinger, belka, a Companion config / .companionconfig with caspar actions, or media that plays out of a CasparCG media folder, even if they don't say "AMCP".
metadata:
  version: "2.3.0"
  author: Julian Szymański / GreenCrew
---

# CasparCG AMCP and Companion buttons

CasparCG is a free playout server (Windows/Linux) for broadcast graphics, video and audio. A controller (here usually Bitfocus Companion, sometimes Ontime or a script) sends it plain-text AMCP commands over TCP (default port 5250). This skill is for getting those commands right the first time: they fail silently from the operator's point of view (a typo just means nothing happens on air), so precision matters more than speed.

Full command syntax is in `references/amcp-commands.md`. Companion button patterns and a ready layer plan are in `references/companion-patterns.md`. Read the relevant file before writing anything non-trivial; this page holds the rules that cause most live-show bugs.

## Target version

Write for the newest stable server, **CasparCG 2.5.x (2.5.1 as of the last check)**; assume the user runs it unless they say otherwise, and ask for `VERSION` output (2.5.1 answers `201 VERSION OK` / `2.5.1 N/A Stable`) when a command's behaviour depends on version. Relevant to 2.5/2.4 and newer than the public AMCP wiki (which describes 2.0.x): `CALLBG` (CALL on the background producer), `CLEAR ALL`, `CLEAR_ON_404` parameter on LOAD/LOADBG/PLAY, command batching (`BEGIN`/`COMMIT`), extra STING audio-fade properties and a STING cut mode (mask `EMPTY`), new transitions `VFADE`/`FADECUT`/`CUTFADE` and directions `UP`/`DOWN`/`FROMTOP`/`FROMBOTTOM`, mixer transforms reimplemented in 2.5.0 (route-aware), screen consumer size/position settable via AMCP. Syntax and behaviour in this skill marked "tested on 2.5.1" was measured on a real 2.5.1 server (channel recordings analysed frame by frame); see `references/amcp-commands.md`.

A command that "works" on air is not proof that every token in it was understood: the transition parser silently ignores what it does not recognise (rule 3). When the wiki and the user's working command disagree, check the command against the parser rules below before calling it "newer than the wiki".

## Core model (what the commands act on)

- Address = `channel-layer`, e.g. `1-10` = channel 1, layer 10. A missing layer means layer 0 (`CLEAR 1` is the exception: it clears the whole channel; `CLEAR 1-0` clears layer 0). Higher layers draw on top of lower ones. Layers 0-2147483647 work and are created on first use; a wrong layer (`1--5`, `1-abc`, too big) is answered `202` and plays on **layer 0** (tested on 2.5.1), while a wrong channel gets `400`.
- Each layer has a **foreground** (playing) and a **background** (loaded, waiting). `LOADBG` fills the background, `PLAY` promotes it (running the prepared transition), `PLAY <clip> ...` does both in one go.
- **Clips and transforms are separate state.** `CLEAR` (and `CLEAR ALL`) removes clips. Mixer state (position, scale, volume, opacity, crop...) stays on the layer until `MIXER <ch>-<layer> CLEAR`, and the next clip played there inherits it. Tested on 2.5.1: after `MIXER 1-10 FILL -1 0 1 1 25` + `CLEAR 1-10`, a new `PLAY 1-10 ... SLIDE 50` runs entirely off-screen (nothing visible). This is the single most common source of "the next graphic is in the wrong place / too quiet / doesn't appear" bugs. The standard fix: start every graphic's button with `MIXER <ch>-<layer> CLEAR`, then a short wait, then `PLAY`.
- Names in `PLAY`/`LOADBG` are media-folder-relative, forward slashes, extension optional: `PLAY 1-10 "BELKI/PatrykOleszczuk"`. Quotes are **required** when the name contains a space (unquoted → `404`) and harmless otherwise; a subfolder alone does not need them. The lookup is case-insensitive (tested on 2.5.1 on Linux too, folder names included). Backslashes do not work on Linux (`404`). A typo is simply "404 media file not found". Polish letters in names work (`PLAY 1-10 "BELKI/Łukasz Żółć"`, case-insensitive too), but on a **Linux** server only when it runs with a UTF-8 locale (`LANG=C.UTF-8`); under `LANG=C`, the default for systemd services, one such command makes that connection stop answering entirely (tested on 2.5.1; Windows not tested).

## Rules that save live shows

1. **Verify tweens against the real list.** Tween names are looked up in a fixed table, case-insensitively. Valid: `linear`, `easenone` and `ease{in,out,inout,outin}{quad,cubic,quart,quint,sine,expo,circ,elastic,back,bounce}` (the one oddity: the back family's out-in variant is spelled `easeoutintback`). Names like `EASEOUTEASE` are not in the table - suggest e.g. `easeoutquad`/`easeoutsine` instead. What an unknown name does depends on where it is (tested on 2.5.1):
   - in a MIXER command (`MIXER 1-10 FILL -1 0 1 1 25 EASEOUTEASE`): `403 MIXER FILL FAILED`, the transform is **not** applied;
   - in a transition, directly after the duration (`PLAY ... SLIDE 50 EASEOUTEASE LEFT`): if it starts with `EASE`, `403 PLAY FAILED` and the clip **does not play**;
   - in a transition anywhere else (`SLIDE 50 FROM_LEFT EASEOUTEASE`, `SLIDE 50 LEFT easeoutquad`): silently ignored, the move is linear, reply `202`.
   Mixer commands take the tween as the last argument after a duration in **frames** (e.g. `MIXER 1-10 FILL -1 0 1 1 25 easeinsine`). Optional tween parameters `name:V0[:V1]` (e.g. `easeoutback:3`, `easeoutelastic:1:0.3`) accept only non-negative numbers with at most one decimal digit - `easeoutback:1.25` is `403`.
2. **Durations are frames, not milliseconds**, in every transition and mixer animation. 25 frames = 1 s at 25 fps, 50 frames = 1 s at 50 fps (tested: `SLIDE 50` = 1.0 s on `1080p5000`, 2.0 s on `1080p2500`). Always ask or read the channel's `video-mode` (e.g. `1080p5000` = 50 fps) before converting. Companion `wait` actions are the opposite: milliseconds.
3. **Transition syntax is positional: `<TYPE> <frames> [tween] [direction]`, in that order.** Directions: `RIGHT` = `FROMLEFT` (enters from the left, **the default**), `LEFT` = `FROMRIGHT` (enters from the right); 2.5 adds `DOWN` = `FROMTOP` (enters from the top), `UP` = `FROMBOTTOM` (from the bottom). 2.5 also adds `VFADE` (dip through black: old out in the first half, new in during the second), `FADECUT` (old fades out, then cut) and `CUTFADE` (old gone at once, new fades in) - picture and sound follow the same curve. The first token that does not fit ends parsing and the rest of the line is ignored without an error. `FROM_LEFT`/`FROM_RIGHT` **with an underscore do not exist** (same parser in 2.3, 2.4 and 2.5.1): tested on 2.5.1, `SLIDE 50 FROM_LEFT EASEOUTEASE` = plain linear slide from the left (identical to `SLIDE 50`), and `SLIDE 50 FROM_RIGHT` also enters from the **left**. An existing `FROM_LEFT` button may be left as it is (it gives the default), but say that its tween is ignored; for an eased entry write `SLIDE 50 easeoutsine RIGHT` (from the left) or `SLIDE 50 easeoutsine LEFT` (from the right), and tell the operator the look will change.
4. **`STING`** has two forms: positional `STING <mask> [trigger_point] [overlay]` or key-value `STING (MASK=... TRIGGER_POINT=... OVERLAY=... AUDIO_FADE_START=... AUDIO_FADE_DURATION=...)`. The mask/overlay files live in the media folder like any clip (missing file = `404`). Cut mode (2.5) is the mask name `EMPTY` (`STING EMPTY 25 overlay`), not an empty string (`""` = `501`). Without `MASK=` the key-value form is ignored and the clip just cuts in. Two traps (tested on 2.5.1): `AUDIO_FADE_START + AUDIO_FADE_DURATION` shorter than the mask **ends the whole sting early** (mask and overlay cut off), so keep the sum ≥ mask length; and `PLAY <clip> STING ...` starts the overlay a few frames late - for frame-accurate stings `LOADBG <clip> STING ...` ahead of time, then a bare `PLAY`.
5. **Pair every on-screen graphic with its own removal step.** The usual pattern is two Companion steps: step 1 `MIXER CLEAR` → wait 100 → `PLAY ... SLIDE ...`; step 2 `MIXER ... FILL -1 0 1 1 25` (slide out) → wait ≥ animation length → `CLEAR`. The wait before `CLEAR` must be at least as long as the out-animation, otherwise the graphic is cut mid-move (tested: wait 200 for a 25-frame/0.5 s move makes the lower third vanish with about a third still on screen; wait 500 is clean).
6. **Several graphics at once need several layers.** Two lower thirds on the same layer replace each other. Give them different layers and clear both.
6a. **`AUTO` belongs to `LOADBG`, never to `PLAY`.** `PLAY <clip> AUTO MIX 20` plays at once and cuts the running clip (tested on 2.5.1). To queue the next clip after the current one ends: `LOADBG <ch-layer> <clip> AUTO MIX 20`. A second `LOADBG ... AUTO` replaces the first; a bare `PLAY <ch-layer>` fires the queued clip immediately; on an empty layer `LOADBG ... AUTO` starts at once; a paused clip delays `AUTO` until it is resumed and reaches its end.
7. **Audio sticks to layers.** A clip's sound plays on the layer it is on; layers simply add up (no automatic ducking). `MIXER ... VOLUME` is a linear amplitude multiplier (tested: 0.5 = −6 dB, 2.0 = +6 dB, no limiter - a −15 LUFS clip at 8.0 hard-clips at 0 dBFS) and persists like any transform, including after `CLEAR`. `MIXER 1 VOLUME` (no layer) means layer 0, not the channel; the channel level is `MIXER 1 MASTERVOLUME`, which multiplies with layer volumes and is **not** reset by `MIXER 1 CLEAR` or `CLEAR ALL` - if a whole channel is too quiet, query it. To even out levels permanently, fix the files (see below) rather than adding per-button volumes.
7a. **Media with transparency: ProRes 4444 or PNG.** Tested on 2.5.1: both composite semi-transparent pixels exactly; QuickTime Animation (qtrle) with alpha does not (75 % opacity shows as ~50 %, 50 % and less become invisible). Video alpha is read as **premultiplied**: a ProRes 4444 / VP9 exported with straight (unmatted) alpha shows colour where it should be transparent - export "premultiplied (matted) with black". PNG alpha is straight and fine.
7b. **`202` does not mean it did what you meant.** Measured on 2.5.1, all answered OK:
   - a transition word with a number inside a **file name** (`"promo MIX 2024"`) starts that transition - add `CUT 0` at the end or rename;
   - a clip named like a colour (`RED`, `BLUE`, `#FF0000`) plays the colour - use the extension (`"red.mp4"`) or a subfolder;
   - a file `<name>_A` / `<name>_ALPHA` becomes the alpha key of `<name>` automatically (wanted for fill+key pairs, a trap for `belka.png` + `belka_a.png`);
   - files with the same name and different extensions show as one clip and `PLAY` picks one of them - give the extension;
   - broken, empty or truncated files play nothing;
   - the mixer takes any number (`VOLUME 100` = +40 dB, `OPACITY 5`, `nan`), and a negative duration silently skips the change;
   - an unknown codec in `ADD … FILE` hangs and then crashes the whole server - test ffmpeg options off-air.
   Full list, data sizes and the formats that play: "Limits, file names and formats" in `references/amcp-commands.md`.
8. **Companion variables in AMCP commands depend on the module version.** With the store module **casparcg-server 2.1.2**, local variables do **not** work: `PLAY 2-12 "$(local:clip)"` reaches the server as `PLAY 2-12 "$NA"` (tested with Companion 5.1.0; the module resolves variables without the button context). Global variables work (`$(custom:clip)`, `$(internal:...)`, other connections' variables). Switching the field to expression mode is not a way around it: Companion 5.1 resets `isExpression` for this module. With **Companion CasparCG Kit 3.x** (the GreenCrew build of the module, `references/companion-patterns.md`), `$(local:name)` works in every field (from 3.1 on Companion resolves it, and fields can be expressions again - module API 2.2, Companion 5.1+), so one button can be written once and duplicated with only the local variable changed: `PLAY 1-10 "BELKI/$(local:name)" ...`.

## Typical tasks

### Write or review a button / command sequence
1. Ask (or infer from the config) the layer plan: which layer is graphics, intros, stingers, video. If a config exists, read it first with the dump script below instead of guessing.
2. Write the AMCP lines; check: layer addresses consistent, quoted names, tween valid and placed **before** the direction, direction spelled `LEFT`/`RIGHT`/`FROMLEFT`/`FROMRIGHT`, durations in frames, MIXER CLEAR present where a transform was used earlier, at least `wait 100` between a `PLAY ... SEEK` and a following `LOADBG ... AUTO`.
3. Report anything unverifiable (version-specific syntax) as unverified rather than asserting it.

### Inspect a Companion config
```
python "<this skill>/scripts/dump_companion_config.py" path/to/export.companionconfig [--page 5]
```
Prints every button (page/row/column, label) with its steps and actions, in UTF-8, so you can audit timings, layers and missing `MIXER CLEAR`. Then run the automatic check for the pitfalls verified on 2.5.1 (transition token order, `FROM_LEFT`, unknown tweens and tween parameters, `AUTO` on `PLAY`, `SEEK` + `LOADBG AUTO` without a wait, `CLEAR` before the out-animation ends, `PLAY` without `MIXER CLEAR` after a transform, `FILTER`, removed commands, STING audio fade):
```
python "<this skill>/scripts/check_caspar_buttons.py" path/to/export.companionconfig [--fps 50] [--page 5]
```
Both scripts read Companion 3.x-5.x exports (5.1 stores options as `{"isExpression", "value"}` and buttons as `button-layered`). Treat the findings as review points: report them with the exact command and a proposed fix, and leave changes that alter the on-air look (e.g. adding easing) to the operator. A `.companionconfig` is JSON; do not hand-edit it unless the user asks, because Companion re-imports it wholesale. Prefer giving the user the exact action text to paste.

### Cross-check wait times against media length
Companion intro/stinger buttons usually hard-code `wait` = clip length (ms). To compare:
```
ffprobe -v error -show_entries format=duration -of csv=p=0 clip.mov
```
The configured time can be deliberately shorter or longer than the file (stinger overlap, `AUTO MIX`). If a number differs from the file length, ask the person who tuned the show before "correcting" it.

### Match loudness of media files
Measure with `ffmpeg -i f.mov -af ebur128=peak=true -f null -` (integrated LUFS + true peak). For a show, pick one target (e.g. -20 LUFS) and normalise the files in a copy folder with two-pass `loudnorm` (`I=-20:TP=-1.5:LRA=11`, measured values from pass 1, `linear=true`), copying the video untouched (`-c:v copy`) and re-encoding audio only (AAC, 48 kHz). **End the audio filter chain with `atrim=end=<video duration>`**: loudnorm appends roughly 18-100 ms of silence, and CasparCG takes the clip length from the container (tested on 2.5.1: an 11 s clip became 11.1 s, `CINF` 555 instead of 550 frames, so the clip end and `AUTO` came 5 frames late). The audio content itself does not shift, so waits counted from the clip start stay valid. Boosts above ~+6 dB on quiet files may hit the limiter, so re-measure peaks after. Never overwrite originals.

### casparcg.config
Short orientation: `<paths>` (media/data/template/log), `<channels>` each with `<video-mode>` and `<consumers>` (`screen`, `system-audio`, `decklink`, `ndi`...), `<controllers><tcp><port>5250</port><protocol>AMCP</protocol>`. Changes need a server restart. Ask before suggesting a restart on a live system. See the reference for details.

## Things not to assume
- The public wiki for AMCP says it is unmaintained and may not match 2.4/2.5; the new docs live at casparcg.com/docs/wiki (protocol page: `/docs/wiki/protocols/amcp-protocol`). Behaviour not marked "tested on 2.5.1" in this skill should be tested on the user's server, e.g. by sending the command from the Companion button once and reading the response code. Codes as 2.5.1 really sends them: 200/201/202 ok; `400 ERROR` for an unknown command, a wrong channel number **and** missing parameters (followed by a second line echoing the command); 402 too few values for a command that counts them; 403 bad tween name; 404 media not found; 501 runtime failure (e.g. a non-numeric value). See the table in `references/amcp-commands.md`.
- A `202` reply does not mean every token was understood (unknown transition tokens and `CALL` parameters are ignored silently). Watch the result, not only the code.
- Don't claim you tested anything on the user's server. Results marked "tested on 2.5.1" come from a separate test server (headless Linux, software rendering); behaviour with real outputs (DeckLink, NDI, screen) may differ.
