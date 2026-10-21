# companion-module-casparcg-server (fork, 3.x)

Fork of [bitfocus/companion-module-casparcg-server](https://github.com/bitfocus/companion-module-casparcg-server) 2.1.2.
See [HELP.md](./companion/HELP.md) for what the module does.

Changes against 2.1.2:
- variables (also local `$(local:...)`) in every field; 2.1.2 resolved them only in the raw command and without the button context, so local variables came out as `$NA`
- actions with real fields for playback, transitions (incl. 2.5 VFADE/FADECUT/CUTFADE/STING), tween and direction lists, mixer, templates; input checked before sending
- live state from `INFO <channel>` polling: tally / state / countdown feedbacks and per-layer variables
- presets generated from the server's media and template lists
- AMCP client that matches replies per channel (2.5.1 answers different channels out of order), handles `400` + echo and commands that never get a reply, reports the server's error with a hint
- fixes: WIPE was sent as CUT, SWAP built `NaN`, tween was always appended
- upgrade script: buttons made with 2.x keep working

## Development
```
npm install
npm test                 # unit tests (node:test), incl. a real INFO reply from 2.5.1
npx companion-module-build   # -> casparcg-server-<version>.tgz (Companion: Modules -> Import module package)
```
For a development Companion start it with `--extra-module-path <dir>` where `<dir>/casparcg-server` holds the built `pkg/`.
