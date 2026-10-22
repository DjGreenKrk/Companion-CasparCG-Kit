## Companion CasparCG Kit

Companion module that controls a CasparCG Server over AMCP (TCP 5250). GreenCrew build of the Bitfocus module, tested on CasparCG **2.5.1** with Companion **5.1.1** (needs Companion 5.1 or newer). Buttons made with the official module (2.x) keep working.

### Setup
- **CasparCG server IP / AMCP port** - the server; the media scanner must run for the clip and template lists.
- **State polling interval** - the module asks `INFO <channel>` this often (default 250 ms) and drives feedbacks and variables from it. 0 turns it off.
- **Layers that always get variables** - e.g. `1-10, 1-20`. Other layers get variables as soon as something plays on them.
- **Preset channel / layers** - presets are generated for this channel, clip layer and template layer.

### Actions
Every field accepts variables, including **local button variables**: `$(local:name)`, `$(custom:x)`, `$(caspar:c1_l10_clip)`. Companion replaces them before the module runs the action, and any field can be switched to an **expression** (e.g. a layer `10 + $(local:n)`), except the dropdowns and checkboxes that show or hide other fields.

- **Play / Cue (LOADBG) / Load** - channel, layer, clip (list from the server or typed), loop, start frame (SEEK), length, transition (CUT, MIX, PUSH, SLIDE, WIPE, VFADE, FADECUT, CUTFADE, STING), duration in frames, tween, direction. *Auto* (start when the current clip ends) is only offered on Cue - on PLAY the server ignores it and plays at once.
  - *Reset transforms first* sends `MIXER ch-layer CLEAR` before the clip: transforms (FILL, OPACITY...) survive `CLEAR`, so a lower third that was slid out stays off-screen otherwise.
  - Play with an empty clip starts what is cued in the background.
  - The tween is checked against the server's tween table before sending (an unknown tween makes the server reject the whole command).
- **Pause, Resume, Pause/resume toggle, Stop, Clear** (layer empty = whole channel, optional transform reset), **Clear all channels**.
- **Change playing clip** - loop on/off, seek, length, in, out on the playing (`CALL`) or cued (`CALLBG`) clip.
- **Go to position** - seconds from the start, or from the end with `-`. **Skip forward / back** - by seconds from where the clip is (`CALL SEEK REL`).
- **Mixer** - opacity / volume / brightness / saturation / contrast in %, position and size (FILL) in %, crop edges (CROP), show only a screen rectangle (CLIP), rotation and its pivot (ROTATION, ANCHOR), blend mode (BLEND), key for the layer above (KEYER), channel master volume, reset transforms, commit deferred changes. Each with duration (frames), tween and *defer* where the server allows it.
- **Play colour, web page, other channel or live stream** - colour from the picker with opacity, or typed (`BLACK`, `#AARRGGBB`; several colours = horizontal gradient), a web page (`[HTML]`), another channel / layer (`route://`), an SRT / RTMP / HTTP stream, an NDI source or a DeckLink input, with a transition. Measured on 2.5.1: SRT from another CasparCG shows after ~0.7 s with ~2 s delay; a UDP MPEG-TS stream needs ~8 s before the first picture - avoid it live.
- **Scroll an image (credits)** - a tall image scrolls by speed (pixels per frame) or total time; **Scroll: change speed** changes it on air with a tween (0 stops).
- **Web page: run JavaScript / reload** - for a layer playing a web page.
- **Output: start recording / stream / NDI**, **Output: stop** - the whole channel under a number you choose (e.g. 700). Record to a file (H.264 MP4, ProRes MOV or own ffmpeg options; `{date}`, `{time}`, `{datetime}` in the name; a relative name lands in the media folder and an existing file of that name is **overwritten**), stream over SRT or RTMP (YouTube / Facebook), or NDI. Starting a number that is already running replaces that output. The server says OK even if ffmpeg fails later - watch the *Output is running* feedback. **Test custom ffmpeg options before the show**: on 2.5.1 an unknown codec (`-codec:v nonexistent`) made the server stop answering for 12 minutes and then crash. ProRes needs a fast CPU (the 4-core test server encoded only 5 fps of 1080p). For SRT send to the receiver (`srt://receiver:9000?mode=caller`, the receiver listens): a listener output (`?mode=listener`) cannot be stopped until a receiver has connected, and a stream that never connected stays on the server's list after *stop* (the module then shows it as not running).
- **Output: save a picture of the channel** - PNG in the media folder (taken twice, because 2.5.1 saves the previous picture the first time).
- **Templates** - CG ADD / UPDATE / PLAY / NEXT / STOP / REMOVE / CLEAR / INVOKE; data as `f0="text" f1="text"` fields (sent as JSON or XML) or raw JSON/XML. *Pass data as* **Object** sends `CG INVOKE "update({...})"` instead, for templates whose `update()` expects a JS object: with *Fields* (`name="$(local:name)" accent="#c8ff67"`, any number of fields, quotes in variable values are safe) or *Raw*, where you can paste the call as written in the template docs, e.g. `update({ name: "$(local:name)", label: "PRELEGENT" });` (new lines and the final `;` are handled; with *Raw* a variable value containing `"` breaks the JS - use *Fields* then). CG ADD in object mode loads the template, calls `update({...})`, then plays it.
- **Custom HTML graphic: show / hide** - your own lower third (or any graphic) as HTML + CSS typed in the action, **no template file on the server**. Put `{{f0}}`, `{{f1}}`... where texts go and fill them in *Fields* (`f0="$(local:name)" f1="$(custom:role)"`; shown as text, quotes and `<` are fine). Position the graphic in your CSS (e.g. `position:absolute; left:6vw; bottom:12vh`; `vw`/`vh` keep it the same in 720p and 1080p). Animation: slide from the left / right / bottom, wipe, fade or cut, with its time in ms - the slide and wipe are measured from the graphic, so it starts right at the frame edge. *Hide* plays the out-animation and clears the layer afterwards (pressing *show* again before that cancels the clear). Change the texts while on air with **Template: update data** on the same layer (`f1="New role"`); untick *Show at once* to load it hidden and start it with **Template: play**. **Template: next** toggles the class `next` on the graphic, so your CSS can switch something (`.next .role {...}`). Tally / variables show the layer as `HTML:<NAME>` (the graphic name). Scripts inside the HTML are not run; fonts must be installed on the server (or loaded from the internet by your CSS).
- **Manually specify AMCP command** - raw AMCP, one command per line.
- **Refresh media and template lists**.

### Feedbacks
- **Clip is on a layer (tally)** - on air (foreground) or cued (background).
- **Layer state** - playing, paused, ended, anything loaded, empty, cued, looping.
- **Clip ending soon** - at most N seconds left (non-looping clips).
- **Output is running** - recording / stream with that number is active (from `INFO`, so it also goes off when ffmpeg stops by itself).
- **Connected**, **A command failed recently** (404 clip not found, 403 bad parameter...).

### Variables
`server_version`, `connected`, `last_error`, `media_count`, `c<ch>_format` and per layer `c<ch>_l<layer>_clip`, `_state`, `_time`, `_remaining`, `_remaining_s`, `_duration`, `_progress`, `_loop`, `_bg` (e.g. `$(caspar:c1_l10_remaining)`); per output `c<ch>_o<number>_active`, `_time` (how long it runs), `_path` - for outputs 700 and 701 of the preset channel from the start, for others once they run.

### Presets
Transport (incl. skip ±10 s), status displays (on air + countdown), mixer (incl. picture in picture in four corners and back to full screen), sources (fade to black, colour bed, other channels, web page and reload, SRT input), outputs (record and SRT stream start / stop with running time, snapshot), Play and Cue for every media file and show/hide for every template (template presets: pick the clip or template in the preset list; the button keeps it in its local variable `clip` / `template`), a custom HTML lower third show/hide, and two tested patterns: lower third show/hide and stinger hold/release.

### Notes (measured on 2.5.1)
- Durations in AMCP are **frames**; Companion waits are milliseconds.
- Replies to commands for different channels can arrive out of order. The module keeps track of that, so errors in the log belong to the right command.
- Sting mask / overlay files with spaces in the name cannot be loaded by the server - rename them.
- Template data (JSON / XML) may contain quotes, backslashes and new lines: the server passes data to the page escaping only quotes, so the module doubles backslashes first (without that, JSON with `\"` never reached the template). Data that is neither JSON (`{...}`) nor XML (`<...>`) reaches the template as an empty string (the server reads it as the name of a stored dataset).
- Limits the module checks because the server does not (all measured): layers 0-2147483647 (a wrong layer plays on layer 0), opacity 0-100 %, volume 0-400 %, transitions and animations at most 15000 frames. A clip named like a colour (`RED`) plays the colour - type it with its extension. A file name such as `promo MIX 2024` would start a 2024-frame mix - the module adds `CUT 0` when you chose no transition.
- Media: a file `<name>_A` or `<name>_ALPHA` next to `<name>` is used as its key (alpha mask) automatically; files with the same name and different extensions show as one clip and the server picks one of them; broken files are answered OK and show nothing. Video with alpha must be exported **premultiplied** (ProRes 4444 / VP9 with straight alpha shows colour where it should be transparent); PNG alpha is fine. GIF shows its first frame, animated WebP and SVG do not work. Keep stills near the channel size - an 8000×8000 PNG stalled the test server.
- Buttons made with module 2.x keep working (same action ids; yes/no fields are converted). Buttons with a volume above 400 % or a transition above 15000 frames now stop with an error in the log.
