# AMCP command reference (CasparCG)

Target: CasparCG Server 2.5.x (latest stable 2.5.1). The wiki below is written for 2.0.x, so commands added in 2.4/2.5 are listed in the "Newer than the wiki" section at the end.

Source: the CasparCG AMCP Protocol wiki page plus the server source v2.5.1-stable (tween table, transition and STING parsers, AMCP protocol strategy, `MIXER CLEAR` handler). Items marked **tested on 2.5.1** were measured on a real 2.5.1 server (replies captured byte by byte, picture and audio verified from channel recordings). The wiki says it is unmaintained and may not match versions newer than 2.0.x, so treat unmarked version-specific details as "verify on your server".

Conventions: `[name:type]` required, `{...}` optional, `|` alternatives. Commands are case-insensitive. Quote parameters containing spaces with `"` (escapes: `\"`, `\\`, `\n`). Each command ends with CR LF. Layer address `ch-layer`; no layer = 0 for play/load/mixer, "whole channel" for CLEAR.

## Playback

```
LOADBG [ch]{-[layer]} [clip] {LOOP} {[transition] [duration] {[tween]|linear} {[direction]|RIGHT}|CUT 0} {SEEK [frame]} {LENGTH [frames]} {FILTER [ffmpeg filter]} {AUTO}
LOAD   [ch]{-[layer]} [clip] {options as LOADBG}      # foreground, paused on first frame; no transition
PLAY   [ch]{-[layer]} {[clip]} {options as LOADBG}   # with a clip: load to background then play
PAUSE / RESUME / STOP [ch]{-[layer]}
CLEAR  [ch]{-[layer]}                                 # clips only (fg+bg); whole channel if no layer
CALL   [ch]{-[layer]} [param]                         # e.g. CALL 1-2 SEEK 25, CALL 1-12 LOOP 0
SWAP   [ch1]{-[l1]} [ch2]{-[l2]} {TRANSFORMS}
```
- `IN`/`OUT` (frames) set the playable section: `PLAY 1-11 clip IN 100 OUT 200` plays frames 100-200 and holds; `IN 100 LENGTH 50` = frames 100-150; with `LOOP` only that section loops (`SEEK` acts as `IN` when `IN` is absent). On a playing clip `CALL 1-11 OUT 250` takes effect at once; `CALL 1-11 IN n` only moves the loop start. `CALL 1-11 LENGTH` / `CALL 1-11 LOOP` without a value return the current value; **`CALL 1-11 SEEK` without a value never answers** - always give a frame number. Tested on 2.5.1.
- Filters: `VF "<ffmpeg video filter>"` and `AF "<ffmpeg audio filter>"` (e.g. `VF hflip`, `AF "volume=0.5"`). `FILTER "<x>"` is applied to video **and** audio, so a video-only filter there (`FILTER "hflip"`) yields black and silence with a `202` reply - use `VF`. Tested on 2.5.1.
- `SCALE_MODE STRETCH|FIT|FILL|HFILL|ORIGINAL` for media whose size differs from the channel. Default and any unknown word: `STRETCH`. Tested on 2.5.1: `FIT` keeps the aspect ratio but is anchored **top-left** (a 4:3 image on 1080p occupies x 0..1440, not centred - centre it with `MIXER FILL`); `ORIGINAL` is 1:1 pixels, also top-left.
- `PLAY <clip> [HTML] "<url>"` / `PLAY <clip> [HTML] <template name>` plays a web page or an HTML file from the template folder (tested on 2.5.1 with `file:///…`, `https://…` and a bare template name; renders even on a server without a GPU).
- `SWAP 1-10 1-9` swaps the clips but **leaves the transforms with the layer numbers**; add `TRANSFORMS` to move them too. Works across channels (`SWAP 1-10 2-10`, even with different video modes) and for whole channels (`SWAP 1 2`). Missing target → `400`; non-existent channel → `402` (tested on 2.5.1).
- `AUTO` on LOADBG: starts automatically when the foreground clip ends; with a transition of n frames (`AUTO MIX 20`) the transition starts n frames **before** the end (`VFADE n`: n/2 before; `CUT`/`CUTFADE`: 1 frame before - from the source). Only one AUTO clip per layer: a second `LOADBG ... AUTO` replaces the first. `AUTO` respects `LENGTH`, waits while the foreground is paused, and starts at once on an empty layer. A bare `PLAY <ch-layer>` fires the queued clip immediately. Tested on 2.5.1.
- **`AUTO` is a LOADBG option only.** `PLAY <ch-layer> <clip> AUTO MIX 20` loads and plays at once, cutting the running clip (tested on 2.5.1).
- **Race (tested on 2.5.1):** `LOADBG ... AUTO` sent less than ~100 ms after `PLAY`/`LOAD ... SEEK n` starts the background **immediately** (3 of 3 tries; 20 ms gap: 2 of 3; 100 ms: 0 of 3). Put `wait 100` between them. Without `SEEK` there is no race.
- A later `PLAY <ch-layer> <clip>` replaces a background loaded with `LOADBG ... AUTO`; the queued clip never plays.
- `SEEK`/`LENGTH` are in frames; `LENGTH` counts from the `SEEK` point (`PLAY 1-11 clip SEEK 50 LENGTH 100` plays frames 50-150, then holds the last frame). `CALL 1-11 SEEK 25` jumps while playing (`201 CALL OK` + `25`). `SEEK` past the end is accepted (`202`) but the clip does not advance (INFO time stays 0); a negative `SEEK` overflows the frame counter - don't use either.
- A clip that ends without `LOOP` and without a following `AUTO` clip holds its last frame on air.
- `CALL <ch-layer> SEEK` also takes a reference point and an offset: `SEEK REL 50` / `SEEK REL -25` (from the current frame), `SEEK IN`, `SEEK OUT`, `SEEK END`, `SEEK END -50` (50 frames before the end), `SEEK 100 10` (= 110). The reply is `201 CALL OK` + the new frame number, counted in **channel** frames. `CALL … START` is an alias of `IN`. Tested on 2.5.1 - the module's "go to position" and skip ±n s buttons map to these.
- `LOOP 0` through `CALL` ends a looping clip, but **not immediately**: the current pass plays to its end (`CALL 1-12 LOOP 0` → `201 CALL OK` + `0`). `CALL` with an unknown parameter answers `202` and does nothing.
- `PLAY 1-12 "STINGER_1"` followed by `LOADBG 1-12 "STINGER_2" AUTO MIX 20 LOOP` is the stinger-hold pattern: play the in-clip, then loop the hold clip when it ends; `LOADBG ... "STINGER_3" AUTO MIX 20` + `CALL ... LOOP 0` releases to the out-clip, which starts mixing 20 frames before the end of the current loop pass. Tested on 2.5.1: no black frame at either change, no visible seam in the loop.

## Other producers (what `PLAY` accepts besides a clip) - tested on 2.5.1

| Source | Command | Notes |
|---|---|---|
| Colour | `PLAY 1-5 #FF0000`, `#80FF0000`, `RED` | `#AARRGGBB`; 6 digits = opaque (`#FF0000FF` is **blue** - the wiki's "blue, green, red" order is wrong). Names (any case): `EMPTY BLACK WHITE RED GREEN BLUE ORANGE YELLOW BROWN GRAY TEAL`; others (`pink`, `transparent`, `#f00`) → `404`. Good for a black/colour bed under graphics or a fade to black: `PLAY 1-1 BLACK MIX 25` |
| Gradient | `PLAY 1-5 #FF0000 #00FF00 #0000FF` | horizontal linear gradient left → right through all colours; the list ends at the first word that is not a colour, so `… #0000FF MIX 25` works. Rotate it with `MIXER … ROTATION` / `FILL` for other directions |
| Scrolling image (credits, tall PNG) | `PLAY 1-20 credits SPEED 4` / `DURATION 30` / `END_TIME "2026-10-22 18:00:00"` | positive `SPEED` (px per frame) scrolls **up**, negative down; `DURATION` = seconds for the whole image; `BLUR <px>`, `PREMULTIPLY` (straight-alpha PNG), `PROGRESSIVE`. Live speed change: `CALL 1-20 SPEED 10 25 easeinsine` (tweened over 25 frames), `CALL 1-20 SPEED` = query. Without SPEED/DURATION/END_TIME the image is just squeezed into the frame. Interlaced formats: even speeds only |
| Web page | `PLAY 1-30 [HTML] "https://…"` | `CALL 1-30 "<javascript>"` runs JS on the page (`202` even if the JS throws), `CALL 1-30 RELOAD` reloads it; `CG 1-30 INVOKE 0 "fn()"` also works on such a page. Handy for a web clock / Ontime view that needs a refresh |
| Another channel / layer | `PLAY 2-10 route://1` / `route://1-10` | no extra latency; scaled to the target channel; `403` for a missing channel |
| SRT / RTMP / HTTP stream | `PLAY 1-40 srt://host:port?mode=caller`, `PLAY 1-40 "rtmp://…"` | `202` at once, picture after the probe: SRT from another CasparCG ~0.7 s, then ~2 s delay. **UDP mpegts: ~8 s until the first picture and many seconds of delay** - don't use it live. The reply never says if the stream opened; check `INFO` / OSC `foreground/file/time` |
| NDI | `PLAY 1-40 "ndi://PC NAME/Source"`, `NDI LIST` | only when the NDI runtime is installed on the server; without it `NDI LIST` → `403 NDI LIST FAILED` (not tested with a source) |
| DeckLink input | `PLAY 1-40 DECKLINK 1 {FORMAT 1080i5000}` | from the source / wiki, not tested (no card) |

`CALL` on a colour layer (`CALL 1-5 RED`) **never answers** - the connection waits; don't send it.

## Transitions (in LOADBG / PLAY)

| Transition | Parameters |
|---|---|
| `CUT` | `CUT 0` (default) |
| `MIX` | `MIX <frames> {tween}` |
| `PUSH` / `WIPE` / `SLIDE` | `<name> <frames> {tween} {direction}` - directions `RIGHT` = `FROMLEFT` (default), `LEFT` = `FROMRIGHT`; 2.5: `DOWN` = `FROMTOP`, `UP` = `FROMBOTTOM` |
| `VFADE` / `FADECUT` / `CUTFADE` | 2.5 only, `<name> <frames> {tween}`. `VFADE`: dip through black (old fades out in the first half, new fades in during the second). `FADECUT`: old fades out over the whole duration, then the new clip cuts in. `CUTFADE`: old disappears at once, new fades in. Sound follows the picture (tested on 2.5.1) |
| `STING` | positional: `STING <mask> {trigger_point} {overlay}`; key-value: `STING (MASK=<f> TRIGGER_POINT=<n> OVERLAY=<f> AUDIO_FADE_START=<n> AUDIO_FADE_DURATION=<n>)` - see below |

Durations are **frames**. The transition parser upper-cases the whole command and matches it against one pattern (v2.5.1, same idea in 2.3/2.4):

```
<TYPE> <frames> [LINEAR | EASE<anything>] [FROMLEFT|FROMRIGHT|FROMTOP|FROMBOTTOM|LEFT|RIGHT|UP|DOWN] <rest ignored>
```

Consequences, **tested on 2.5.1** (lower third recorded frame by frame):

| `PLAY 1-10 belka ...` | Reply | What happens |
|---|---|---|
| `SLIDE 50` / `SLIDE 50 RIGHT` | 202 | enters from the left, linear, 50 frames |
| `SLIDE 50 LEFT` | 202 | enters from the right |
| `SLIDE 50 easeoutsine LEFT` | 202 | from the right, decelerating (correct order) |
| `SLIDE 50 LEFT easeoutquad` | 202 | from the right, **linear** - tween after the direction is ignored |
| `SLIDE 50 FROM_LEFT` | 202 | from the left = default; `FROM_LEFT` is ignored (no underscore form exists) |
| `SLIDE 50 FROM_RIGHT` | 202 | from the **left** - ignored, default applies |
| `SLIDE 50 FROM_LEFT EASEOUTEASE` | 202 | linear from the left - parsing stopped at `FROM_LEFT` |
| `SLIDE 50 easeoutsine FROM_LEFT` | 202 | from the left, eased (tween OK, direction ignored) |
| `SLIDE 50 nieistnieje LEFT` | 202 | linear from the **left** - an unknown word also swallows the direction |
| `SLIDE 50 EASEOUTEASE LEFT` | **403 PLAY FAILED** | nothing plays (`EASE…` was taken as a tween name and not found) |
| `PUSH 50 LEFT` / `WIPE 50 LEFT` / `MIX 50` | 202 | as documented; `WIPE` reveals in place, `MIX` ignores the direction |
| `SLIDE 50 DOWN` = `SLIDE 50 FROMTOP` | 202 | enters from the top (2.5) |
| `SLIDE 50 UP` = `SLIDE 50 FROMBOTTOM` | 202 | enters from the bottom (2.5) |
| `MIX 50 easeinsine` | 202 | crossfade with a slow start - tweens apply to MIX too |

STING details (2.5.1 source, responses tested): the mask and overlay are clip names from the media folder (missing → `404`). Positional `trigger_point` is a frame number; in the key-value form numbers are used only when > 0, and keys are case-insensitive. **Cut mode (2.5) = mask name `EMPTY`**: `STING EMPTY 25 overlay` or `STING (MASK=EMPTY TRIGGER_POINT=25 OVERLAY=overlay)` - the overlay plays and the new clip cuts in at the trigger point. An empty string `""` is not cut mode (`501`). A key-value block without `MASK=` is ignored entirely (plain cut, no overlay). Without `AUDIO_FADE_DURATION` the audio crossfades over the whole transition. Quoted names work in the key-value form (`MASK="720/STING_MASK"`; a missing quoted mask gives `404`, so it is really parsed), but a mask or overlay **with a space in its name cannot be loaded at all**: `404` in both the positional and the key-value form, quoted or not (tested on 2.5.1). Rename such files. A still image (PNG) is accepted as a mask (`202`).

STING timing (tested on 2.5.1, mask 25 frames, overlay 25 frames):
- Mask mode: the transition lasts as long as the **mask**; an overlay longer than the mask is cut off (from the source).
- Cut mode: the new clip cuts in at `trigger_point` and the transition ends at max(`trigger_point`, overlay length): `LOADBG … STING EMPTY 10 overlay` + `PLAY` → cut at +10, end at +25 frames.
- `AUDIO_FADE_START`/`AUDIO_FADE_DURATION` (frames) shape the audio crossfade, **but the sting ends when the audio fade ends**: `AUDIO_FADE_START=5 AUDIO_FADE_DURATION=10` with a 25-frame mask finished the whole sting after ~15 frames, cutting the mask and overlay. Keep `AUDIO_FADE_START + AUDIO_FADE_DURATION` ≥ mask length.
- `PLAY <clip> STING …` creates the mask/overlay producers only at PLAY time, so a ProRes overlay started ~4 frames late (cut appeared 6 frames after the overlay instead of 10, overlay cut short). Load the sting first (`LOADBG <clip> STING …`), then send a bare `PLAY` - timing is then exact.

## Tweens (animation types)

Case-insensitive (tested: `EASEINSINE` = `easeinsine`), looked up in a fixed table. An unknown name in a MIXER command is rejected with `403 MIXER <cmd> FAILED` (log: `Check syntax.`) and the transform is **not** applied. In a transition the result depends on position - see the table above (`403` and no playback only when the bad name directly follows the duration and starts with `EASE`; otherwise silently ignored). Registered names:

`linear`, `easenone`, and for each of quad, cubic, quart, quint, sine, expo, circ, elastic, back, bounce: `easein<x>`, `easeout<x>`, `easeinout<x>`, `easeoutin<x>`. Exception: the back family's out-in is spelled `easeoutintback`. Optional numeric parameters can be appended as `name:V0[:V1]` (for elastic/back overshoot); tested on 2.5.1: they change the motion (`easeoutback:3` overshoots much further than `easeoutback`), and each value must be a non-negative number with **at most one decimal digit** (`easeoutback:1.5` OK, `easeoutback:1.25`, `easeoutelastic:1:0.35` and `easeoutback:-1` → `403`).

## Mixer (per layer; `MIXER [ch]{-[layer]} <sub-command> ...`)

Animated commands accept an optional trailing `{[duration frames] {[tween]|linear}}`; no arguments = query the current value (reply `201 MIXER OK` + value).

```
KEYER {0|1}              layer acts as key for the layer above: the key layer is not shown, the layer above shows where
                         the key's R channel is bright (tested: white = 100 %, a blue bar with R≈21 = ~8 %) - not its alpha
CHROMA {enable target_hue hue_width min_saturation min_brightness softness spill_suppress spill_suppress_saturation show_mask}
                         chroma key; the old form CHROMA green|blue threshold softness spill is still accepted and converted
BLEND {mode}             normal (default), lighten, darken, multiply, average, add, subtract, difference, negation,
                         exclusion, screen, overlay, soft_light, hard_light, color_dodge, color_burn, linear_dodge,
                         linear_burn, linear_light, vivid_light, pin_light, hard_mix, reflect, glow, phoenix, contrast,
                         saturation, color, luminosity; an unknown name is accepted silently (202)
INVERT {0|1}             layer required
OPACITY / BRIGHTNESS / SATURATION / CONTRAST {float}
LEVELS {min-in max-in gamma min-out max-out}
FILL {x y x-scale y-scale}   position/scale on a 0-1 screen, 1 = full size, negative scale flips
CLIP {x y width height}      viewport in SCREEN coordinates; not affected by FILL/ROTATION/PERSPECTIVE
                             (tested: FILL 0.25 0 1 1 + CLIP 0 0 0.5 1 shows only screen x 0.25..0.5)
ANCHOR {x y}                 pivot for FILL/ROTATION in image coordinates; ANCHOR 0.5 0.5 alone shifts the image
                             half a frame up-left - pair it with FILL 0.5 0.5 1 1 to rotate/scale around the centre
CROP {left top right bottom} edges in IMAGE coordinates (CROP 0.1 0 0.5 1 keeps image x 0.1..0.5)
ROTATION {degrees}           clockwise around the anchor (default anchor = top-left corner)
PERSPECTIVE {8 corner coords}
VOLUME {float}               linear amplitude: 1.0 = original, 0.5 = -6 dB, 2.0 = +6 dB; no limiter (hard clip at 0 dBFS); negative values accepted - don't
MASTERVOLUME {float}         whole channel (MIXER 1 MASTERVOLUME 0.5); multiplies with layer VOLUME; NOT reset by
                             MIXER CLEAR or CLEAR ALL - set it back to 1 explicitly
GRID [n] {frames tween}      n x n grid starting at layer 1 (sets FILL of layers 1..n²)
COMMIT                       apply deferred transforms together: add DEFER as the last word of any mixer
                             command (MIXER 1-10 FILL 0.5 0 1 1 DEFER), then MIXER 1 COMMIT (tested on 2.5.1:
                             queries return the old value until COMMIT; animations start at COMMIT)
CLEAR                        reset all transforms on layer or channel
```
`MIPMAP` and `STRAIGHT_ALPHA_OUTPUT` no longer exist in 2.5.1 (`400 ERROR`). `MIXER 1 <cmd>` without a layer addresses layer 0 (e.g. `MIXER 1 VOLUME`), except `MASTERVOLUME`, `GRID`, `COMMIT` and `CLEAR`, which act on the channel.
Slide a graphic fully off-screen left in 25 frames: `MIXER 1-10 FILL -1 0 1 1 25` (x = -1, unchanged scale).

Tested on 2.5.1: a query returns the **target** value right away, even mid-animation (`MIXER 1-10 FILL` → `201 MIXER OK` / `-1.000000 0.000000 1.000000 1.000000`; `VOLUME` mid-tween returns the current value, e.g. `0.853…`). Every transform, `VOLUME` included, survives `CLEAR` and `CLEAR ALL` and is inherited by the next clip on the layer; only `MIXER ... CLEAR` resets it.

## Templates / data
```
CG [ch]{-[layer]|-9999} ADD [cg_layer] [template] [play-on-load 0|1] {[data]}
CG ... PLAY|STOP|NEXT|REMOVE [cg_layer]   CG ... UPDATE [cg_layer] [data]   CG ... INVOKE [cg_layer] [method]
CG ... CLEAR    CG ... INFO {[cg_layer]}
DATA STORE|RETRIEVE|LIST|REMOVE ...
```
`STOP` lets the template animate out; `REMOVE` does not.

Tested on 2.5.1 with an HTML template (`template/` folder, name without extension): `CG 1-20 ADD 1 tpl 0 "<data>"` loads it hidden and passes the data to `update()`; `CG ... PLAY 1` calls `play()`, `STOP` calls `stop()`, `NEXT` calls `next()`; `UPDATE 1 "<data>"` passes the **raw string** to `update()` (JSON and XML `<templateData>` both arrive verbatim - the template parses it); `INVOKE 1 fn` and `INVOKE 1 "fn()"` both call the function (`201 CG OK` + empty line). Missing template → `404 CG ADD FAILED`; a CG command on an empty CG layer → `202` (silently). `CG ... INFO` does not exist in 2.5.1 (`400`). `TLS` lists templates (`TEST_HTML`, `TPL_BELKA`).

Lower-third template with text, tested on 2.5.1 and checked on the channel recording (a test template: `f0` name, `f1` role, `f2` second role shown by `NEXT`):
- Data reaches the page correctly as JSON (`"{\"f0\":\"Łukasz Żółć\"}"`) and as XML `<templateData>`: Polish letters, `"` (sent as `&quot;` in XML, `\"` in JSON), `<b>` and `&` all show literally when the template sets `textContent`. In AMCP the whole data parameter is one quoted string with inner `"` escaped as `\"`.
- With `play-on-load 1` the first frame of the graphic reaches the output about **0.1 s** after the command (CEF loads the page); with the template loaded beforehand (`ADD ... 0`) a `CG ... PLAY` shows on output after about **0.05 s**. The in-animation is not cut in either case (25 of 25 frames of a 0.5 s CSS slide visible); deferring `play()` with `requestAnimationFrame` changed nothing. For a graphic that must hit a cue exactly, pre-load with play-on-load 0 and fire `CG ... PLAY`.
- When writing a slide-in, start it just outside the frame (`translateX(calc(-100% - <left margin>))`), not a fixed far offset: with `-120vw` most of the motion happened off screen and the bar seemed to pop in.
- `STOP` runs the template's out-animation; `CLEAR` / `REMOVE` right after it cut the animation, so wait for its length first.
- **How the data reaches the page (2.5.1, read from the CEF console in the server log):** the server calls `update("<data>")` escaping only `"`, not backslashes. JSON whose values contain an escaped quote (`{"k":"a\\"b"}`) or `\\n` breaks the call (`Uncaught SyntaxError: missing ) after argument list` in the log, template unchanged); a backslash in XML text is eaten. Fix on the sending side: double every backslash in the data before AMCP quoting - the page then gets it byte for byte (tested for `CG ADD` and `CG UPDATE`, JSON and XML). Data that starts with neither `{` nor `<` reaches `update()` as an **empty string** (it is taken as the name of a stored dataset).
- **Templates whose `update()` expects an object** (`update({ name: "Jan", accent: "#c8ff67" })`): send `CG ch-l INVOKE 1 "update({...})"` - INVOKE runs the expression, the template gets a real object, and the text is passed verbatim (no backslash doubling, JSON with `\\"` inside works). A trailing `;` gives `Uncaught SyntaxError`. `INVOKE` right after `CG ADD ... 0` works (the server queues calls while the template loads), so ADD without data → INVOKE update → `CG PLAY` is safe in one go. `CG ADD` without data still calls `update("")` - the template should ignore an empty string. Images: a field with a path relative to the template file (`img/logo.png` next to it) or `file:///.../media/x.png` loads in an `<img>` (tested on 2.5.1).
- A graphic without a template file: `PLAY ch-l [HTML] "data:text/html;charset=utf-8;base64,..."` renders an HTML page sent in the command (Polish letters need `charset=utf-8` in the URL or `<meta charset>`), and CG commands work on that layer. Limits: the server answers `404` for a data URL longer than about **4 KB**, and `CG ... UPDATE` on a page that is still loading answers **`403`** (about 60 ms after `PLAY`), so send a small host page in the URL and the real content by `CG UPDATE` once it answers `202`. `CG ADD` accepts a template name or an `http(s)://` URL, not a data URL or a file path (`404`).

## Channel / system
```
ADD [ch]{-[index]} [consumer] [params]   REMOVE [ch]{-[index]} ...    # consumers: DECKLINK, BLUEFISH, SCREEN, AUDIO, IMAGE, SYNCTO, FILE, STREAM
SET [ch] MODE|CHANNEL_LAYOUT [value]      PRINT [ch]                    # PRINT saves YYYYMMDDThhmmss.png into media/ (it then shows up in CLS); no screen consumer needed; on 2.5.1 it twice returned a stale frame (an earlier layer content) - verify graphics with a recording (ADD n-700 FILE ...) instead
LOG LEVEL [trace|debug|info|warning|error|fatal]                       # LOG CATEGORY no longer exists (400)
LOCK [ch] ACQUIRE|RELEASE|CLEAR {phrase}   PING {token}   BYE  KILL  RESTART
BEGIN ... COMMIT | DISCARD               # batch (details below)
REQ <id> <command>                        # reply is prefixed: RES <id> 202 PLAY OK
```
Tested on 2.5.1:
- **Screen consumer from AMCP (2.5):** `ADD 1-800 SCREEN [device] X 100 Y 50 WIDTH 640 HEIGHT 360 BORDERLESS NAME Preview` opens a window of that size and position (other flags: `FULLSCREEN`, `KEY_ONLY`, `SBS_KEY`, `NON_INTERACTIVE`, `GPU`, `DELAY`). Remove with `REMOVE 1-800` - give consumers an explicit index when adding; otherwise `REMOVE` needs exactly the same parameters as the `ADD` (the port number shown by INFO, e.g. 601, does not work as an index → `404`).
- `ADD 1-700 FILE /path/rec.mov -codec:v ... -codec:a ...` records the channel output (ffmpeg arguments, only the `-name:stream` form: `-codec:v`, not `-vcodec`); `REMOVE 1-700` stops it. `STREAM` is the same consumer for a URL: `ADD 1-701 STREAM srt://0.0.0.0:9000?mode=listener -format mpegts -codec:v libx264 -tune:v zerolatency -preset:v ultrafast -filter:v format=yuv420p -codec:a aac` (tested). `202 ADD OK` only means the consumer was created - if ffmpeg died, the next `REMOVE` answers `404`; read the log.
- **Snapshot**: `ADD 1 IMAGE <name>` (no extension) writes `media/<name>.png`, but on 2.5.1 the PNG shows the picture from the **previous** snapshot (4 of 4 tries, also with the picture still for 2 s); `PRINT 1` has the same bug. Workaround: send `ADD 1 IMAGE tmp`, wait 0.5 s, then `ADD 1 IMAGE <name>` - the second one is current. For checks use a recording.
- **NDI out** (`ADD 1 NDI NAME Caspar1`) needs the NDI runtime on the server (not tested).
- `route://<ch>` / `route://<ch>-<layer>` as a clip name plays another channel or layer (scaled to this channel): `PLAY 2-10 route://1-10`. Non-existent channel → `403`.
- **`CHANNEL_GRID`** always takes the **last** channel, adds a screen window to it and overwrites its layers 1..n with routes of all other channels in a grid. Never send it on a show server whose last channel is on air.
- `SET 3 MODE 1080p5000` changes a channel's video mode on the fly (`202 SET MODE OK`).
- `LOCK 1 ACQUIRE <phrase>`: other connections get `503` for **every** command on that channel (INFO too) until they `LOCK 1 ACQUIRE` with the same phrase; `LOCK 1 RELEASE` frees it; `LOCK 1 CLEAR <lock-clear-phrase from casparcg.config>` breaks any lock. The lock also ends when the locking client disconnects.
- `DATA STORE name "text"` / `DATA RETRIEVE name` (`201` + text) / `DATA LIST` / `DATA REMOVE name` work, including UTF-8 text - on Linux only with a UTF-8 locale (under `LANG=C` `DATA STORE` fails with `501` and leaves an empty file).
- `BYE` closes the connection without a reply.

## Queries
```
CLS {dir}   TLS {dir}   FLS   CINF [file]   INFO   INFO [ch]{-[layer]}   INFO CONFIG|PATHS
VERSION   THUMBNAIL LIST|RETRIEVE|GENERATE|GENERATE_ALL   DIAG   GL INFO   GL GC   NDI LIST
OSC SUBSCRIBE [port]   OSC UNSUBSCRIBE [port]
```
Also tested on 2.5.1: `INFO PATHS` → `201` + XML with the absolute media / log / data / template paths; `INFO CONFIG` → the whole loaded config as XML; `GL INFO` → GPU buffer pools; `DIAG` → `202` (opens the diagnostics window - nothing on a headless server); `LOG LEVEL debug` → `202 LOG OK`. `THUMBNAIL LIST` lines: `"720/BELKA_A" 20261021T152348 1736` (name, time, bytes); `THUMBNAIL RETRIEVE <clip>` → `201` + one line of base64 PNG, **256×144**, 2-45 KB (usable as a button image); missing → `501`.
Tested on 2.5.1: `INFO SYSTEM|SERVER|QUEUES|THREADS|TEMPLATE` no longer exist and silently return the plain `INFO` channel list; `VERSION FLASH|TEMPLATEHOST|CEF|SERVER` all return the server version; `FLS` → `501`; `THUMBNAIL RETRIEVE <clip>` → `201` + base64 PNG (needs the scanner).
`HELP` no longer exists in 2.5.1 (`400 ERROR`). `CLS`, `CINF`, `TLS` (and thumbnails) are served by the separate **media scanner** (`casparcg-scanner`, port 8000, configured in `<amcp><media-server>`); without it they answer `501 … FAILED`. `CLS` line format: `"NAME"  TYPE  bytes  YYYYMMDDhhmmss  frames  timebase`, e.g. `"STINGER_2"  MOVIE  29261999 20261021145633 100 1/50` - the quickest way to check a clip name and length (in frames) on the server. Names come back upper-case; subfolders as `"NORM/INTRO_11S"`. With scanner 1.4.0 the `{dir}` argument of `CLS` is ignored - it always lists everything. `INFO 1-10` returns the XML of the **whole channel** (layer under `<stage><layer><layer_10>`), not just the layer.

## OSC (live state over UDP) - tested on 2.5.1

Without any configuration the server sends OSC to **every AMCP client's IP on UDP 6250** (config: `<osc><default-port>`, `<disable-send-to-amcp-clients>`, `<predefined-clients>`); `OSC SUBSCRIBE 7001` adds port 7001 for this connection (`OSC UNSUBSCRIBE 7001` stops it; a non-number → `403 OSC SUBSCRIBE BAD PORT`). The subscription ends with the AMCP connection. One bundle per channel **every frame** (50/s on a 50p channel), so it is the fastest way to follow time and state. Addresses in 2.5 (the wiki's list is from 2.0 and does not match):

```
/channel/1/format                                   "1080p5000"
/channel/1/framerate                                50 1
/channel/1/stage/layer/10/foreground/producer       "ffmpeg" | "color" | "html" | "image" | "route" | "empty" ...
/channel/1/stage/layer/10/foreground/paused         T / F
/channel/1/stage/layer/10/foreground/loop           T / F
/channel/1/stage/layer/10/foreground/file/name      "klip"
/channel/1/stage/layer/10/foreground/file/path      "/opt/casparcg/media/klip.mp4"
/channel/1/stage/layer/10/foreground/file/time      2.44 10.0      (seconds: current, file length)
/channel/1/stage/layer/10/foreground/file/clip      0.0 10.0       (seconds: IN, playable length)
/channel/1/stage/layer/10/foreground/frames_left    n              (only with an AUTO clip queued)
/channel/1/stage/layer/10/foreground/transition/... type "mix", frame [n, total], direction, producer (during a transition)
/channel/1/stage/layer/10/background/producer       "empty" | "ffmpeg" ...
```
Only active layers are sent. **Not sent on 2.5.1**: audio levels (`/mixer/audio/…` - the source fills them, but nothing arrives) and consumer state (`/output/…`), so OSC gives no VU meter.

## Response codes
Meaning per the protocol: 100 info event · 101 event, one data line · 200 ok, multi-line data (ends with an empty line) · 201 ok, one data line · 202 ok, no data · 400 command not understood · 401 illegal channel · 402 missing parameter · 403 illegal parameter · 404 media not found · 500/501 server error · 502 media unreadable · 503 access error.

What 2.5.1 actually sends (**tested**, raw bytes):

| Command | Reply |
|---|---|
| `PLAY 1-10 nie_ma` / `LOADBG 1-10 nie_ma` | `404 PLAY FAILED` / `404 LOADBG FAILED` |
| `PLAY` (no parameters) | `400 ERROR` **+ second line `PLAY`** (echo) - not 402 |
| `PLAY 99-1 clip` (channel does not exist) | `400 ERROR` + echo - not 401 |
| `NONEXISTENT 1-10` | `400 ERROR` + echo |
| `MIXER 1-10 FILL -1 0 1` (too few values) | `402 MIXER FILL FAILED` |
| `MIXER 1-10 FILL ... 25 badtween`, `PLAY ... SLIDE 50 EASEOUTEASE LEFT` | `403 … FAILED` |
| `MIXER 1-10 OPACITY abc`, `MIXER 1-10 FILL a b c d` | `501 MIXER … FAILED` - not 403 |
| `CINF missing` (scanner running) | `501 CINF FAILED` - not 404 |
| `CALL 1-10 UNKNOWN` | `202 CALL OK` (silently ignored) |
| `PING` / `PING abc` | `PONG` / `PONG abc` (no code) |

A client that reads one line per command will get out of sync after a `400`, because of the echo line. 401 and 503 exist in the server code but did not appear in testing.

**Reply order (tested on 2.5.1):** replies on one connection do **not** always come back in the order the commands were sent. Every channel has its own command queue: commands for the same channel are answered in order, but commands for different channels, and commands without a channel (`VERSION`, `CLS`), are not ordered relative to each other. Measured, with all commands sent at once: `PLAY 1-32 "INTRO_7S_M15"` + `PLAY 2-32 "NIEMA"` → `404 PLAY FAILED` arrived **before** `202 PLAY OK`; `INFO 1`, `INFO 2`, `INFO 3` came back as 1, 3, 2; `PLAY 2-31 …`, `PLAY 1-31 …`, `MIXER 3-31 …` → MIXER first. Replies name only the verb (`202 PLAY OK`), not the channel, so a client that matches replies by order can pin an error on the wrong command, or parse channel 3's `INFO` as channel 2's. Either send one command at a time and wait for its reply, or never have the same verb outstanding on two channels at once. Reply times measured on 2.5.1: 0.5-6 ms for most commands, ~40 ms for `PLAY` with a transition onto a still image, one frame for `MIXER` queries.

## casparcg.config (minimal, from the server's sample)
```xml
<configuration>
  <paths><media-path>media/</media-path><log-path>log/</log-path><data-path>data/</data-path><template-path>template/</template-path></paths>
  <channels>
    <channel>
      <video-mode>720p5000</video-mode>     <!-- resolution + frame rate; 1080p5000 = 1080 @ 50 fps -->
      <consumers><screen /><system-audio /></consumers>   <!-- or decklink / ndi / ffmpeg ... -->
    </channel>
  </channels>
  <controllers><tcp><port>5250</port><protocol>AMCP</protocol></tcp></controllers>
  <amcp><media-server><host>localhost</host><port>8000</port></media-server></amcp>   <!-- media scanner for CLS/CINF/TLS -->
</configuration>
```
Other optional sections: `accelerator`, `ffmpeg`, `html`, `ndi`, `osc`, `video-modes`, `template-hosts`, `lock-clear-phrase`. Restart the server after editing. On Linux run the server with a UTF-8 locale (`LANG=C.UTF-8`), otherwise non-ASCII media names break the AMCP connection.

## Newer than the wiki (2.4 / 2.5) - tested on 2.5.1
- `CALLBG [ch]{-[layer]} [param]` - like CALL but on the background producer: `CALLBG 1-12 LOOP 1` → `201 CALLBG OK` + `1`, and the clip loops once it comes on air (INFO shows `loop=false` on the background until then). On an empty layer: `202 CALLBG OK`.
- `CLEAR ALL` → `202 CLEAR ALL OK` - clears the layers of **all channels**; mixer transforms stay (tested: FILL and OPACITY survive).
- `CLEAR_ON_404` - flag on PLAY/LOADBG/LOAD. The reply is still `404 … FAILED`, but the layer is replaced by an empty (transparent) producer instead of leaving the old clip on air: `PLAY` and `LOAD` empty the foreground (`LOAD` leaves it paused), `LOADBG` empties the background (the next bare `PLAY` then plays nothing). Without the flag the old clip keeps playing.
- Batching: after `BEGIN` the server answers nothing; `COMMIT` runs the queued commands together and replies to each in order, then `202 COMMIT OK`, or `202 COMMIT PARTIAL` if any failed (the others still run), e.g. `202 PLAY OK` / `202 MIXER OK` / `404 PLAY FAILED` / `202 COMMIT PARTIAL`. `DISCARD` drops the batch silently. `COMMIT`/`DISCARD` without `BEGIN`, or `BEGIN` inside a batch → `400 ERROR` + echo. Don't combine with `REQ`: after `REQ id BEGIN`, `COMMIT` returns only the per-command replies, without a `COMMIT` line and without `RES`. 2.5.1 fixed a race when executing a batch.
- `REQ <id> <command>` → `RES <id> <normal reply>` (also for errors: `RES r3 400 ERROR` + echo). `REQ` without an id → `402  ERROR`.
- STING: extra audio fade properties (`AUDIO_FADE_START`, `AUDIO_FADE_DURATION`, frames) and cut mode with mask `EMPTY` (2.5) - see Transitions.
- 2.5: new transitions `VFADE`, `FADECUT`, `CUTFADE` and directions `UP`/`DOWN`/`FROMTOP`/`FROMBOTTOM` - see Transitions (tested on 2.5.1).
- 2.5.0: mixer transforms reimplemented to handle routes; routed channels with `MIXER KEY` fixed; screen consumer position/size settable via AMCP (not tested).
- `HELP` / `HELP PRODUCER` are gone in 2.5.1; the syntax above comes from the v2.5.1-stable source and was checked against the running server.
