# GreenCrew CasparCG Server roadmap

Work left out of 3.0.0-beta.1. Each item is a separate change, taken on when it brings a real
benefit.

## Not yet verified

| Item | Why | Notes |
| --- | --- | --- |
| Companion 5.0.5 | Used in production; only the module API version was checked | Import the package, convert existing buttons, run a show page |
| CasparCG on Windows | All tests ran on a Linux server | Paths with `\`, fonts for HTML graphics |
| CasparCG 2.4 and older | Tests target 2.5.1 | 2.4 has no VFADE / FADECUT / CUTFADE |
| DeckLink / NDI outputs, interlaced modes | The test server has no video hardware | Polling and tally do not depend on outputs |

## Functional

| Item | Why | Notes |
| --- | --- | --- |
| OSC instead of `INFO` polling | Less traffic, state without polling delay | CasparCG can send layer state over OSC; needs a UDP listener in the module |
| Module API 2.x | Companion is moving to @companion-module/base 2 | Keep 1.14 while production runs Companion 5.0 |
| Expression mode in fields | Companion 5.1 resets `isExpression` for modules on API 1.x | Comes with API 2.x |
