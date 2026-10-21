# GreenCrew CasparCG Server

### Bitfocus Companion module for CasparCG Server, built for operators

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![CI](https://github.com/DjGreenKrk/companion-module-greencrew-casparcg/actions/workflows/ci.yml/badge.svg)](https://github.com/DjGreenKrk/companion-module-greencrew-casparcg/actions/workflows/ci.yml) [![Last commit](https://img.shields.io/github/last-commit/DjGreenKrk/companion-module-greencrew-casparcg)](https://github.com/DjGreenKrk/companion-module-greencrew-casparcg/commits) [![Status: beta](https://img.shields.io/badge/status-beta-orange.svg)](ROADMAP.md)

**GreenCrew CasparCG Server** controls a CasparCG playout server from Bitfocus Companion. Every
action has its own fields (channel, layer, clip, transition, template data) instead of a raw AMCP
line, every field takes Companion variables, and the buttons show what is on air. It is part of
the GreenCrew Tools family.

It is based on the official Bitfocus module and keeps its action ids, so buttons made with it
keep working:

| Project | Author | What it contributed |
| --- | --- | --- |
| [bitfocus/companion-module-casparcg-server](https://github.com/bitfocus/companion-module-casparcg-server) | **Bitfocus AS, William Viker, Håkon Nessjøen** and contributors | The original module (2.1.2): AMCP connection, actions for playback, CG and raw commands, media and template lists |
| [DjGreenKrk/companion-module-greencrew-casparcg](https://github.com/DjGreenKrk/companion-module-greencrew-casparcg) | **GreenCrew** | Version 3: field-based actions, variables everywhere, live tally and countdowns, presets, reply handling for CasparCG 2.5, templates as objects, custom HTML graphics |

Thank you to Bitfocus and everyone who contributed to the original module. The MIT license and
the original copyright notice are kept in [LICENSE](LICENSE). Branding: [BRANDING.md](BRANDING.md).

## Getting started

1. Download `casparcg-server-<version>.tgz` from the
   [releases](https://github.com/DjGreenKrk/companion-module-greencrew-casparcg/releases).
2. Companion → **Modules** → **Import module package** → choose the file.
3. In the CasparCG connection choose the version ending in `-by-GC` (the module is listed as
   **CasparCG: Server (GreenCrew)**). Existing buttons are converted on the first start.
4. Enter the server IP. The CasparCG media scanner must run for the clip and template lists.

Tested with Companion 5.1.0 and CasparCG Server 2.5.1 on Linux. Companion 5.0.5 accepts the
module API but has not been tested; see [ROADMAP.md](ROADMAP.md).

## What it adds to the official module

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

## Development

```sh
npm ci
npm test                 # unit tests (node:test), incl. a real INFO reply from CasparCG 2.5.1
npx prettier --check src test index.js
npm run build            # casparcg-server-<version>.tgz for Companion → Modules → Import module package
```

For a development Companion start it with `--extra-module-path <dir>`, where
`<dir>/casparcg-server` holds the built `pkg/` folder.

CI: `ci.yml` (formatting, unit tests, package build with the package as an artifact) and
`companion-module-checks.yaml` (Bitfocus module checks).
