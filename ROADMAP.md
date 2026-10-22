# Companion CasparCG Kit roadmap

Work left out of 3.1.0-beta.1. Each item is a separate change, taken on when it brings a real
benefit.

## Not yet verified

| Item | Why | Notes |
| --- | --- | --- |
| Companion 5.0.x | Used in production; the module API (2.1) is accepted by 5.0.0 and newer, but only 5.1.0 was tested | Import the package, convert existing buttons, run a show page |
| Module API 2.2 | Preset notes, presets that store action results to local variables, value feedback types | Needs Companion 5.1 - after production moves to it |
| Preset templates | API 2.x `template` preset groups: one Play / Cue preset with the media list as values instead of one preset per file | |
| CasparCG on Windows | All tests ran on a Linux server | Paths with `\`, fonts for HTML graphics |
| CasparCG 2.4 and older | Tests target 2.5.1 | 2.4 has no VFADE / FADECUT / CUTFADE |
| DeckLink / NDI inputs and outputs, interlaced modes | The test server has no video hardware or NDI runtime | The actions build the commands from the source / wiki; `NDI LIST` answers 403 without the runtime |

## Functional

| Item | Why | Notes |
| --- | --- | --- |
| OSC instead of `INFO` polling | Less traffic, state every frame | Measured on 2.5.1: sent by default to every AMCP client on UDP 6250, a bundle per channel every frame; **no audio levels and no output state** in 2.5.1, so it would replace layer polling only (outputs still need `INFO`) |
| Clip thumbnails on buttons | Easier to find a clip on a page of presets | `THUMBNAIL RETRIEVE` gives a 256×144 PNG (base64, 2-45 KB); needs a cache and a resize to the button |
| Chroma key action | Green screen from a DeckLink input | `MIXER CHROMA` (2.5 form with 8 values, or the old `GREEN threshold softness spill`); needs a camera source to tune the defaults |
