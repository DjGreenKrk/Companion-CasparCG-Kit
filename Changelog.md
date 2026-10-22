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
