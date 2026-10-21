## CasparCG Server

Controls a CasparCG Server over AMCP (TCP 5250). Tested on CasparCG **2.5.1** with Companion 5.0/5.1.

### Setup
- **CasparCG server IP / AMCP port** - the server; the media scanner must run for the clip and template lists.
- **State polling interval** - the module asks `INFO <channel>` this often (default 250 ms) and drives feedbacks and variables from it. 0 turns it off.
- **Layers that always get variables** - e.g. `1-10, 1-20`. Other layers get variables as soon as something plays on them.
- **Preset channel / layers** - presets are generated for this channel, clip layer and template layer.

### Actions
Every field accepts variables, including **local button variables**: `$(local:name)`, `$(custom:x)`, `$(caspar:c1_l10_clip)`.

- **Play / Cue (LOADBG) / Load** - channel, layer, clip (list from the server or typed), loop, start frame (SEEK), length, transition (CUT, MIX, PUSH, SLIDE, WIPE, VFADE, FADECUT, CUTFADE, STING), duration in frames, tween, direction. *Auto* (start when the current clip ends) is only offered on Cue - on PLAY the server ignores it and plays at once.
  - *Reset transforms first* sends `MIXER ch-layer CLEAR` before the clip: transforms (FILL, OPACITY...) survive `CLEAR`, so a lower third that was slid out stays off-screen otherwise.
  - Play with an empty clip starts what is cued in the background.
  - The tween is checked against the server's tween table before sending (an unknown tween makes the server reject the whole command).
- **Pause, Resume, Pause/resume toggle, Stop, Clear** (layer empty = whole channel, optional transform reset), **Clear all channels**.
- **Change playing clip** - loop on/off, seek, length, in, out on the playing (`CALL`) or cued (`CALLBG`) clip.
- **Go to position** - seconds from the start, or from the end with `-`.
- **Mixer** - opacity / volume / brightness / saturation / contrast in %, position and size (FILL) in %, channel master volume, reset transforms, commit deferred changes. Each with duration (frames), tween and *defer*.
- **Templates** - CG ADD / UPDATE / PLAY / NEXT / STOP / REMOVE / CLEAR / INVOKE; data as `f0="text" f1="text"` fields (sent as JSON or XML) or raw JSON/XML.
- **Manually specify AMCP command** - raw AMCP, one command per line.
- **Refresh media and template lists**.

### Feedbacks
- **Clip is on a layer (tally)** - on air (foreground) or cued (background).
- **Layer state** - playing, paused, ended, anything loaded, empty, cued, looping.
- **Clip ending soon** - at most N seconds left (non-looping clips).
- **Connected**, **A command failed recently** (404 clip not found, 403 bad parameter...).

### Variables
`server_version`, `connected`, `last_error`, `media_count`, `c<ch>_format` and per layer `c<ch>_l<layer>_clip`, `_state`, `_time`, `_remaining`, `_remaining_s`, `_duration`, `_progress`, `_loop`, `_bg` (e.g. `$(caspar:c1_l10_remaining)`).

### Presets
Transport, status displays (on air + countdown), mixer, one Play and one Cue button per media file, show/hide per template, and two tested patterns: lower third show/hide and stinger hold/release.

### Notes (measured on 2.5.1)
- Durations in AMCP are **frames**; Companion waits are milliseconds.
- Replies to commands for different channels can arrive out of order. The module keeps track of that, so errors in the log belong to the right command.
- Sting mask / overlay files with spaces in the name cannot be loaded by the server - rename them.
- Buttons made with module 2.x keep working (same action ids; yes/no fields are converted).
