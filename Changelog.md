# GreenCrew CasparCG Server 3.0.0-beta.1

First release under the GreenCrew name. Based on bitfocus/companion-module-casparcg-server 2.1.2. Tested with Companion 5.1.0 and CasparCG Server 2.5.1.

* [FEATURE] Every action has its own fields: playback (clip from the server list or typed, loop, seek, length, AUTO on LOADBG), transitions incl. VFADE / FADECUT / CUTFADE / STING with tween and direction lists, mixer in percent, master volume, CALL / CALLBG parameters, go to position, pause toggle, clear all
* [FEATURE] Variables in every field, including local button variables `$(local:...)` (2.1.2 sent them as `$NA`)
* [FEATURE] Live state from `INFO <channel>` polling: tally (on air / cued), layer state, "ending soon", connected and "command failed" feedbacks; per-layer variables (clip, state, time, remaining, duration, progress, loop, cued clip)
* [FEATURE] Presets generated from the media and template lists, transport, status, mixer and tested lower-third / stinger patterns
* [FEATURE] Templates: data as fields, JSON, XML, or a JS object passed with `CG INVOKE "update({...})"`; CG NEXT / REMOVE / CLEAR / INVOKE
* [FEATURE] Custom HTML graphics: own HTML + CSS with `{{f0}}` fields, slide / wipe / fade, hide with delayed clear, without a template file on the server
* [FEATURE] Raw command action takes several lines (one command per line)
* [CHANGE] AMCP replies are matched per channel: CasparCG 2.5 answers commands for different channels out of order; `400` with echo and commands without a reply are handled; server errors are shown with a hint
* [CHANGE] Module API @companion-module/base 1.14, runtime Node.js 22
* [BUGFIX] WIPE transition was sent as CUT
* [BUGFIX] SWAP built `NaN` instead of the layers
* [BUGFIX] A tween was appended even when not chosen
* [BUGFIX] Template data with quotes or backslashes in variable values did not reach the template (CasparCG 2.5 escapes only quotes when it calls `update()`)
* [BUGFIX] A quote inside a field value from a variable cut the value
