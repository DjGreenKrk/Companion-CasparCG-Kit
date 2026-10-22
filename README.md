# Companion CasparCG Kit

### GreenCrew module for Bitfocus Companion and AI skills for CasparCG playout

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![CI](https://github.com/DjGreenKrk/Companion-CasparCG-Kit/actions/workflows/ci.yml/badge.svg)](https://github.com/DjGreenKrk/Companion-CasparCG-Kit/actions/workflows/ci.yml) [![Companion module checks](https://github.com/DjGreenKrk/Companion-CasparCG-Kit/actions/workflows/companion-checks.yml/badge.svg)](https://github.com/DjGreenKrk/Companion-CasparCG-Kit/actions/workflows/companion-checks.yml) [![Latest release](https://img.shields.io/github/v/release/DjGreenKrk/Companion-CasparCG-Kit?include_prereleases&label=release)](https://github.com/DjGreenKrk/Companion-CasparCG-Kit/releases) [![Release date](https://img.shields.io/github/release-date-pre/DjGreenKrk/Companion-CasparCG-Kit?label=released)](https://github.com/DjGreenKrk/Companion-CasparCG-Kit/releases) [![Last commit](https://img.shields.io/github/last-commit/DjGreenKrk/Companion-CasparCG-Kit)](https://github.com/DjGreenKrk/Companion-CasparCG-Kit/commits) [![Status: beta](https://img.shields.io/badge/status-beta-orange.svg)](ROADMAP.md)

**Companion CasparCG Kit** is a Bitfocus Companion module that controls a CasparCG playout
server, together with AI skills that write the buttons and the HTML graphics for it. Every
action has its own fields (channel, layer, clip, transition, template data) instead of a raw AMCP
line, every field takes Companion variables, and the buttons show what is on air. Made by
GreenCrew, part of the GreenCrew Tools family.

| Part | Version | What it does |
| --- | --- | --- |
| Companion module (`companion/`, `src/`) | 3.0.0-beta.2-by-GC | Controls CasparCG Server from Companion |
| Skill [casparcg-amcp-button-builder](skills/casparcg-amcp-button-builder/) | 2.1.0 | Writes, reviews and debugs AMCP commands and the Companion buttons that send them |
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
