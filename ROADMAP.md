# Companion CasparCG Kit roadmap

Work left out of 3.1.0-beta.2. Each item is a separate change, taken on when it brings a real
benefit.

## Not yet verified

| Item | Why | Notes |
| --- | --- | --- |
| CasparCG on Windows | All tests ran on a Linux server | Paths with `\`, fonts for HTML graphics |
| CasparCG 2.4 and older | Tests target 2.5.1 | 2.4 has no VFADE / FADECUT / CUTFADE |
| DeckLink / NDI inputs and outputs, interlaced modes | The test server has no video hardware or NDI runtime | The actions build the commands from the source / wiki; `NDI LIST` answers 403 without the runtime |

## Functional

| Item | Why | Notes |
| --- | --- | --- |
| Clip thumbnails on buttons | Easier to find a clip on a page of presets | `THUMBNAIL RETRIEVE` gives a 256×144 PNG (base64, 2-45 KB); needs a cache and a resize to the button |
| Chroma key action | Green screen from a DeckLink input | `MIXER CHROMA` (2.5 form with 8 values, or the old `GREEN threshold softness spill`); needs a camera source to tune the defaults |
