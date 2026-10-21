# event-lower-third-generator — changelog

Version in `SKILL.md` (`metadata.version`). Major: template contract (`gfx.js` API, field
handling) changed incompatibly; minor: new templates, references or checks; patch: corrections.

## 0.1.0 — 2026-10-21

First version (developed as `broadcast-graphics`).

* [FEATURE] Workflow: client materials → style sheet (`theme.css` tokens) → set of graphics → check → operator README
* [FEATURE] Runtime `gfx.js` + `gfx-base.css`: fields (text, image, color, list, number, bool, time), `data-field` / `data-fit` / `data-show`, `is-in` / `is-out` animation, preview with generated panel (`?preview=1`), clock and countdown with time zone, live values read from Companion variables
* [FEATURE] Starter templates tested on CasparCG 2.5.1: speaker, timer (live / target, phases), ticker + clock, announcement
* [FEATURE] References: design from materials, graphics catalog (conference, TV, sport, stream), template contract (CasparCG data formats, Companion buttons and triggers, Ontime variables)
* [FEATURE] Scripts: `check_graphics.py` (autoplay, fonts, time zone, external URLs, missing files, background), `palette.py` (dominant colours, contrast)
