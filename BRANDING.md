# Companion CasparCG Kit — branding

Companion CasparCG Kit belongs to GreenCrew Tools. Shared branding, design and writing rules
live in [GreenCrew_Tools_Docs](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs) and are not
copied here.

## Name

- Product name: **Companion CasparCG Kit** (repository `Companion-CasparCG-Kit`, manifest `name`, README, HELP): a Companion module for CasparCG plus AI skills. GreenCrew appears in the subtitle, the descriptions and the author line, not in the name, so it does not read as a fork of CasparCG itself.
- Skills: `casparcg-amcp-button-builder`, `event-lower-third-generator` (named like the other GreenCrew event skills: system, object, action).
- In Companion's module list: **CasparCG: Server (GreenCrew)** — Companion builds that label from
  `manufacturer` and `products`, so the manufacturer stays `CasparCG`.
- Version suffix `-by-GC` (e.g. `3.0.0-beta.1-by-GC`) tells it apart from the official module in
  the connection's version list.

## Logo

There is no approved GreenCrew Tools mark for this module in `app_logo/`. A Companion module has no
own icon in Companion's interface, so none is used; a mark would follow
[ICONOGRAPHY.md](https://github.com/DjGreenKrk/GreenCrew_Tools_Docs/blob/main/branding/ICONOGRAPHY.md)
(the GreenCrew hexagon with one symbol) before it is added here.

## Platform-specific decisions

- Companion draws the configuration and action editors; the module cannot apply the GreenCrew
  design system to them.
- Button colours in presets and feedbacks follow broadcast conventions, not the GreenCrew palette:
  red = on air (program), amber = cued / paused / warning, green = playing / connected.
- Operator texts (HELP, action and field names) are in English, as the rest of Companion's
  module ecosystem.
- Technical identifiers keep the official names for compatibility (module id `casparcg-server`,
  action ids, variable prefix `caspar`).
