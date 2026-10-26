# Companion CasparCG Kit 3.1.0-beta.2

Live state over OSC, so the module no longer fills the server log, and NDI checked with the NDI 6 library.

* [FEATURE] Live state (tally, layer state, times, feedbacks, variables) comes over OSC: the module asks for it with `OSC SUBSCRIBE` on a free UDP port (or a fixed one in the connection settings). Polling `INFO` wrote every poll and its whole XML reply to the server log; now Companion adds nothing to it while nothing changes
* [CHANGE] `INFO` is read only for outputs (not in OSC on 2.5.1): once on connect, after the module's own `ADD` / `REMOVE`, and every 2 s while a recording or stream runs
* [FEATURE] With no OSC for 3 s (firewall, Docker) the module polls `INFO` and says so in the log, and stops when OSC is back. "Live state from: INFO polling" keeps the old behaviour
* [BUGFIX] "Output is running" goes off as soon as the server accepts the module's `REMOVE` (a stopped recording stays in `INFO` with its counter frozen)
* [FEATURE] NDI source list in "Play colour, web page...", filled from `NDI LIST` (as `PC/Source`, the form `ndi://` takes); the text field still overrides it
* [BUGFIX] "Output is running" works for NDI outputs (they report no frame counter)
* [CHANGE] NDI output names with accented letters are refused: the NDI library drops them (`Mównica` was announced as `Mwnica`)
* [FEATURE] Skill **casparcg-amcp-button-builder 2.3.0**: NDI and OSC facts measured on 2.5.1

# Companion CasparCG Kit 3.1.0-beta.1

Moved to Companion's newest module API 2.2 (`@companion-module/base` 2.2.1) on the Node.js 26 runtime. Needs Companion 5.1 or newer; tested on Companion 5.1.1 with CasparCG Server 2.5.1. For Companion 4.x or 5.0 keep 3.0.0-beta.3.

* [FEATURE] Fields can be expressions again (Companion 5.1 reset expression mode for modules on API 1.x), e.g. a layer `10 + $(local:n)`; the dropdowns and checkboxes that show or hide other fields stay plain values
* [CHANGE] Companion resolves variables - local button variables included - before the module runs an action (API 2.x)
* [CHANGE] Presets come in sections (API 2.x structure); field visibility uses Companion expressions
* [FEATURE] Play, Cue and template show/hide presets are template presets: one definition, Companion lists a button for every clip / template, each keeps its name in a local variable
* [BUGFIX] Buttons made before an option existed get its default once: API 2.x skips an action whose dropdown has no value (seen with CG ADD "pass as" on a 3.0 button)
* [CHANGE] Upgrade scripts read and write options as `{ value, isExpression }` and leave fields that are expressions alone
* [CHANGE] Build with @companion-module/tools 3 (package `.tgz`), entry `main.mjs` exports the class and `UpgradeScripts`
* [FEATURE] Skill **casparcg-amcp-button-builder 2.2.1**: module 3.1 notes
* [CHANGE] Tests build all definitions (visibility rules, preset structure, option keys)

# Companion CasparCG Kit 3.0.0-beta.3

Limits found by testing CasparCG Server 2.5.1 with wrong and unusual input: where the server answers OK but does something else, the module now stops or corrects the command.

* [BUGFIX] Layer numbers above 2147483647 are refused (the server plays them on layer 0)
* [BUGFIX] A file name with a transition word and a number ("promo MIX 2024") no longer starts a transition: `CUT 0` is added when no transition is chosen
* [BUGFIX] A clip called like a colour (RED, #FF0000) is refused with a hint to type the extension (the server would play the colour)
* [CHANGE] Mixer values are checked: opacity 0-100 %, volume and master volume 0-400 % (+12 dB), brightness / saturation / contrast 0-500 %; transitions and animations at most 15000 frames
* [CHANGE] The log notes when the server will use `<clip>_A` / `<clip>_ALPHA` as the key of a clip
* [FEATURE] Skill **casparcg-amcp-button-builder 2.2.0**: limits, file names and formats measured on 2.5.1
* [FEATURE] README: "Known limitations" - what comes from the test machine, from CasparCG 2.5.1 itself and from this module

# Companion CasparCG Kit 3.0.0-beta.2

Features from the CasparCG documentation and source that the module did not cover yet, each checked on CasparCG Server 2.5.1.

* [FEATURE] Mixer: crop, screen mask (CLIP), rotation and pivot (ANCHOR), blend modes, keyer - with duration, tween and defer
* [FEATURE] Play colour (picker with opacity, names, gradients), web page, another channel / layer (route://), SRT / RTMP / HTTP stream, NDI source, DeckLink input - with transitions
* [FEATURE] Scrolling image (credits) by speed or total time, speed change on air
* [FEATURE] Web page layers: run JavaScript, reload
* [FEATURE] Skip forward / back by seconds (`CALL SEEK REL`)
* [FEATURE] Outputs: record (H.264, ProRes, own ffmpeg options, date in the file name), stream (SRT, RTMP), NDI, stop; PNG snapshot of the channel (taken twice because 2.5.1 saves the previous picture first)
* [FEATURE] Feedback "Output is running" and variables per output (`c1_o700_time`, `_active`, `_path`) from `INFO`
* [FEATURE] Presets: skip ±10 s, picture in picture corners, fade to black, colour bed, other channels, web page reload, SRT input, record / stream start-stop with running time, snapshot
* [FEATURE] Skill **casparcg-amcp-button-builder 2.1.0**: producers, OSC, outputs and queries that the official documentation leaves out, measured on 2.5.1

# Companion CasparCG Kit 3.0.0-beta.1

First release under the GreenCrew name. Based on bitfocus/companion-module-casparcg-server 2.1.2. Tested with Companion 5.1.0 and CasparCG Server 2.5.1.

* [FEATURE] Every action has its own fields: playback (clip from the server list or typed, loop, seek, length, AUTO on LOADBG), transitions incl. VFADE / FADECUT / CUTFADE / STING with tween and direction lists, mixer in percent, master volume, CALL / CALLBG parameters, go to position, pause toggle, clear all
* [FEATURE] Variables in every field, including local button variables `$(local:...)` (2.1.2 sent them as `$NA`)
* [FEATURE] Live state from `INFO <channel>` polling: tally (on air / cued), layer state, "ending soon", connected and "command failed" feedbacks; per-layer variables (clip, state, time, remaining, duration, progress, loop, cued clip)
* [FEATURE] Presets generated from the media and template lists, transport, status, mixer and tested lower-third / stinger patterns
* [FEATURE] Templates: data as fields, JSON, XML, or a JS object passed with `CG INVOKE "update({...})"`; CG NEXT / REMOVE / CLEAR / INVOKE
* [FEATURE] Custom HTML graphics: own HTML + CSS with `{{f0}}` fields, slide / wipe / fade, hide with delayed clear, without a template file on the server
* [FEATURE] Raw command action takes several lines (one command per line)
* [FEATURE] AI skills in the kit, each installable on its own (`.skill` for the Claude apps, folder `.zip`, Claude Code plugins from this repository): **casparcg-amcp-button-builder 2.0.0** (AMCP commands and Companion buttons, tested on 2.5.1) and **event-lower-third-generator 0.1.0** (HTML lower thirds and event graphics from client materials)
* [CHANGE] AMCP replies are matched per channel: CasparCG 2.5 answers commands for different channels out of order; `400` with echo and commands without a reply are handled; server errors are shown with a hint
* [CHANGE] Module API @companion-module/base 1.14, runtime Node.js 22
* [BUGFIX] WIPE transition was sent as CUT
* [BUGFIX] SWAP built `NaN` instead of the layers
* [BUGFIX] A tween was appended even when not chosen
* [BUGFIX] Template data with quotes or backslashes in variable values did not reach the template (CasparCG 2.5 escapes only quotes when it calls `update()`)
* [BUGFIX] A quote inside a field value from a variable cut the value
