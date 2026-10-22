# Companion CasparCG Kit

### GreenCrew module for Bitfocus Companion and AI skills for CasparCG playout

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![CI](https://github.com/DjGreenKrk/Companion-CasparCG-Kit/actions/workflows/ci.yml/badge.svg)](https://github.com/DjGreenKrk/Companion-CasparCG-Kit/actions/workflows/ci.yml) [![Companion module checks](https://github.com/DjGreenKrk/Companion-CasparCG-Kit/actions/workflows/companion-checks.yml/badge.svg)](https://github.com/DjGreenKrk/Companion-CasparCG-Kit/actions/workflows/companion-checks.yml) [![Latest release](https://img.shields.io/github/v/release/DjGreenKrk/Companion-CasparCG-Kit?include_prereleases&label=release)](https://github.com/DjGreenKrk/Companion-CasparCG-Kit/releases) [![Release date](https://img.shields.io/github/release-date-pre/DjGreenKrk/Companion-CasparCG-Kit?label=released)](https://github.com/DjGreenKrk/Companion-CasparCG-Kit/releases) [![Last commit](https://img.shields.io/github/last-commit/DjGreenKrk/Companion-CasparCG-Kit)](https://github.com/DjGreenKrk/Companion-CasparCG-Kit/commits) [![Status: beta](https://img.shields.io/badge/status-beta-orange.svg)](ROADMAP.md) [![Tested on Companion 5.1.0](https://img.shields.io/badge/tested%20on-Companion%205.1.0-2ea44f.svg)](#known-limitations) [![Tested on CasparCG 2.5.1](https://img.shields.io/badge/tested%20on-CasparCG%202.5.1-2ea44f.svg)](#known-limitations)

**Companion CasparCG Kit** is a Bitfocus Companion module that controls a CasparCG playout
server, together with AI skills that write the buttons and the HTML graphics for it. Every
action has its own fields (channel, layer, clip, transition, template data) instead of a raw AMCP
line, every field takes Companion variables, and the buttons show what is on air. Made by
GreenCrew, part of the GreenCrew Tools family.

**Tested on Companion 5.1.0 with CasparCG Server 2.5.1** (Linux). Companion 5.0.x loads the module (same module
API) but has not been tested with it yet.

| Part | Version | What it does |
| --- | --- | --- |
| Companion module (`companion/`, `src/`) | 3.0.0-beta.3-by-GC | Controls CasparCG Server from Companion |
| Skill [casparcg-amcp-button-builder](skills/casparcg-amcp-button-builder/) | 2.2.0 | Writes, reviews and debugs AMCP commands and the Companion buttons that send them |
| Skill [event-lower-third-generator](skills/event-lower-third-generator/) | 0.1.0 | Generates HTML lower thirds and event graphics (speaker, timer, ticker…) from client materials |

The module is based on the official Bitfocus module and keeps its action ids, so buttons made
with it keep working:

| Project | Author | What it contributed |
| --- | --- | --- |
| [bitfocus/companion-module-casparcg-server](https://github.com/bitfocus/companion-module-casparcg-server) | **Bitfocus AS, William Viker, Håkon Nessjøen** and contributors | The original module (2.1.2): AMCP connection, actions for playback, CG and raw commands, media and template lists |
| [DjGreenKrk/Companion-CasparCG-Kit](https://github.com/DjGreenKrk/Companion-CasparCG-Kit) | **GreenCrew** | Module 3.x: field-based actions, variables everywhere, live tally and countdowns, presets, reply handling for CasparCG 2.5, templates as objects, custom HTML graphics; the AI skills |

Thank you to Bitfocus and everyone who contributed to the original module. The MIT license and
the original copyright notice are kept in [LICENSE](LICENSE). Branding: [BRANDING.md](BRANDING.md).

## Download

Each release on the [releases page](https://github.com/DjGreenKrk/Companion-CasparCG-Kit/releases)
has the whole kit and every part on its own:

| File | Install |
| --- | --- |
| `Companion-CasparCG-Kit-<version>.zip` | everything below in one archive |
| `casparcg-server-<version>-by-GC.tgz` | Companion → **Modules** → **Import module package** |
| `<skill>-<version>.skill` | Claude apps: Settings → Skills → upload (or *Save skill* on the file) |
| `<skill>-<version>.zip` | the skill folder: unpack into `~/.claude/skills/` (Claude Code) or another agent's skills folder |

Claude Code can install the skills as plugins straight from this repository:

```text
/plugin marketplace add DjGreenKrk/Companion-CasparCG-Kit
/plugin install casparcg-amcp-button-builder@companion-casparcg-kit
/plugin install event-lower-third-generator@companion-casparcg-kit
```

## Companion module

1. Import `casparcg-server-<version>-by-GC.tgz` (Companion → Modules → Import module package).
2. In the CasparCG connection choose the version ending in `-by-GC` (the module is listed as
   **CasparCG: Server (GreenCrew)**). Existing buttons are converted on the first start.
3. Enter the server IP. The CasparCG media scanner must run for the clip and template lists.

Tested with Companion 5.1.0 and CasparCG Server 2.5.1 on Linux. Companion 5.0.5 accepts the
module API but has not been tested; see [ROADMAP.md](ROADMAP.md).

What it adds to the official module:

- **Fields instead of AMCP**: clip from the server list or typed, loop, seek, length, transitions
  including VFADE / FADECUT / CUTFADE / STING, tween and direction lists, mixer in percent,
  CG with fields, pause toggle, clear with transform reset. Input is checked before sending.
- **Variables in every field**, including local button variables `$(local:name)`. The official
  2.1.2 resolves them only in the raw command and sends local variables as `$NA`.
- **Live state** from `INFO <channel>` polling: tally (on air / cued), layer state, "ending soon",
  connection and command errors as feedbacks; per-layer variables such as
  `$(caspar:c1_l10_remaining)`.
- **Presets** generated from the server's media and template lists, plus tested show/hide patterns.
- **Templates**: data as fields (`name="$(local:name)"`), JSON, XML or a JS object passed as
  `update({...})`; quotes and backslashes in variable values reach the template.
- **Custom HTML graphics**: an own lower third as HTML + CSS typed in the action, without a
  template file on the server.
- **CasparCG 2.5 reply handling**: replies for different channels arrive out of order; the module
  matches them per channel so errors are reported for the right button.
- Fixes: WIPE was sent as CUT, SWAP built `NaN`, a tween was always appended.

Details for operators: [companion/HELP.md](companion/HELP.md). Changes: [Changelog.md](Changelog.md).
Technical names keep the original spelling so that existing setups continue to work: module id
`casparcg-server`, action ids and variable names.

## Skills

The skills follow the open Agent Skills format (`SKILL.md` with `name`, `description` and
`metadata.version`) and work in Claude Code, the Claude apps and other agents that read skills.
Each skill folder is also a Claude Code plugin (`.claude-plugin/plugin.json`) and has its own
`CHANGELOG.md`; versions are independent of the module.

- **casparcg-amcp-button-builder** - AMCP syntax and behaviour measured on CasparCG 2.5.1
  (transitions, tweens, STING, mixer, templates, reply codes), Companion button patterns (lower
  third, stinger, intro), checks of exported `.companionconfig` files. Works with this module and
  with the official one.
- **event-lower-third-generator** - from client materials (brand book, key visual, slides, example
  graphics) to a package of transparent HTML templates with a JSON data contract, tested on
  CasparCG 2.5.1; includes the `gfx.js` runtime, starter templates, a linter and Companion /
  Ontime examples for live timers.

## Known limitations

Everything below was measured, mostly on CasparCG Server 2.5.1 with Companion 5.1.0. Each limit is marked with
where it comes from, because only some of them apply to your setup:

- **Test machine**: our test server, not CasparCG. It probably does not apply to a playout PC with a GPU.
- **CasparCG**: the server itself (2.5.1). It applies everywhere, with this module, the official module or any other client.
- **Module**: this Companion module. It can change in a later version.

### Test machine

The tests ran on a Linux container with 4 vCPU, 4 GB RAM and no GPU (software rendering with Mesa llvmpipe).

| Limit | Measured |
| --- | --- |
| Heavy channels do not keep real time | 4 HTML graphics at once on a 1080p50 channel; 1080p ProRes 4444 plus a recording reached ~54 % of real time |
| ProRes recording is too slow | `prores_ks` encoded ~5 fps of 1080p (H.264 `veryfast` keeps up) |
| Very large stills stall the server | an 8000×8000 PNG made the server and the container unresponsive for ~15 min |
| Not tested at all | DeckLink and NDI inputs / outputs, interlaced output, Windows, Companion 5.0.5 |

### CasparCG Server 2.5.1

These are server behaviours. The module works around the ones marked ✔; the rest are documented in
[HELP.md](companion/HELP.md) and the skill.

**Answered OK, but something else happens**

| Behaviour | Module |
| --- | --- |
| A wrong layer (`1--5`, `1-abc`, above 2147483647) plays on layer 0. A wrong channel is rejected with `400` | ✔ refuses the layer |
| A transition word plus a number in a file name (`promo MIX 2024`) starts that transition | ✔ adds `CUT 0` |
| A clip named like a colour (`RED`, `#FF0000`) plays the colour | ✔ refuses, asks for the extension |
| `<name>_A` / `<name>_ALPHA` next to `<name>` becomes its alpha key automatically | logs a note |
| Files with the same name and different extensions show as one clip; `PLAY` picks one of them | - |
| Broken, empty or truncated files play nothing | - |
| No range checks: `VOLUME 100` (+40 dB), `OPACITY 5`, `nan`; a negative animation time skips the change | ✔ checks ranges |
| `MIX 99999` is accepted (33 minutes) | ✔ at most 15000 frames |
| `SEEK REL` before the start or past the end: negative time / jump to 0 | ✔ keeps the skip inside the clip |
| `IMAGE` / `PRINT` save the picture of the previous snapshot | ✔ takes two |
| Adding an output under a number in use replaces the running recording; an existing file of that name is deleted | `{datetime}` in the default name |
| A removed stream stays in `INFO` with a frozen frame counter; an SRT listener nobody joined cannot be removed | ✔ running = counter moving; SRT defaults to caller |

**Can stop or crash the server**

| Behaviour |
| --- |
| An unknown ffmpeg codec in `ADD … FILE` (`-codec:v nonexistent`): no answer for 12 minutes at full CPU, then a crash. Test custom ffmpeg options off-air |
| `CALL` on a colour layer never answers; `CALL … SEEK` without a frame number never answers |

**Formats and sizes**

| Limit |
| --- |
| Video alpha is read as premultiplied: ProRes 4444 / VP9 with straight alpha shows colour where it should be transparent. Export "premultiplied with black"; PNG alpha is fine |
| Stills: png, jpg, bmp, tga, tif, webp, jp2. GIF shows its first frame only; animated WebP and SVG do not work; PSD / HEIC / EXR are not supported |
| `PLAY [HTML] "data:…"` works up to 4067 characters on Linux (path limit; Windows not tested). Template data via `CG UPDATE` / `CG INVOKE`: 1 MB worked |
| UDP MPEG-TS input needs ~8 s before the first picture and has many seconds of delay. SRT: ~0.7 s to start, ~2 s delay |

**Protocol and state**

| Limit |
| --- |
| Replies for different channels can arrive out of order, and replies do not name the channel |
| OSC sends layer state every frame but no audio levels and no output state, so there is no VU meter from OSC |
| On Linux the server needs a UTF-8 locale; otherwise non-ASCII media names break the AMCP connection |

### This module (3.0.0-beta.3-by-GC)

| Limit | Why / plan |
| --- | --- |
| State comes from `INFO` polling (default every 250 ms): tally, times and the skip position can be up to one interval old; "output is running" goes off ~1.5 s after a stop | OSC would be per frame, but 2.5.1 sends no output state over OSC ([ROADMAP](ROADMAP.md)) |
| Module API `@companion-module/base` 1.14 (taken over from the official 2.1.2): Companion 5.1 resets expression mode in fields, and the module resolves variables itself | Move to API 2.1.x, which Companion 5.0.5 and 5.1 both accept (2.2 needs 5.1) - [ROADMAP](ROADMAP.md) |
| Ranges set by the module: opacity 0-100 %, volume 0-400 %, brightness / saturation / contrast 0-500 %, transitions and animations at most 15000 frames | Safety limits, not server limits; existing buttons beyond them stop with an error in the log |
| NDI and DeckLink actions build the documented commands but were not tested with a source or card | Needs hardware |
| Custom HTML graphics: scripts in the HTML are not run; fonts must be installed on the server or loaded by your CSS | By design (data URL host page) |
| No clip thumbnails on buttons, no chroma-key action | [ROADMAP](ROADMAP.md) |

## Development

```sh
yarn install                      # yarn 1 via corepack (packageManager in package.json), as Bitfocus modules use
yarn test                         # unit tests (node:test), incl. a real INFO reply from CasparCG 2.5.1
yarn prettier --check src test index.js
yarn build                        # casparcg-server-<version>.tgz
python3 tools/build_release.py    # dist/: kit ZIP, module, skills (.skill and .zip), SHA256SUMS, notes
```

For a development Companion start it with `--extra-module-path <dir>`, where
`<dir>/casparcg-server` holds the built `pkg/` folder.

Releases: bump the versions (module in `package.json`, each skill in `SKILL.md` and its
`plugin.json` / `marketplace.json` entry), add the changelog sections, then push a tag
`v<version>`; `release.yml` builds and publishes the assets. CI: `ci.yml` (formatting, unit tests,
version checks, skill scripts, package build, release assets) and `companion-checks.yml` (the rules of
Bitfocus' module checks - yarn lockfile, tools minimum, manifest, HELP, version = tag, the built module
starts - without their requirement that the repository is named `companion-module-<id>`).
