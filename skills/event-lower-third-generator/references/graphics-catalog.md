# Graphics catalog

Field names are a suggestion; keep them consistent across a package (the operator learns one vocabulary). "Starter" = a tested template in `assets/starter/` to adapt.

## Conference / event - default set
| Graphic | Use | Fields | Notes |
|---|---|---|---|
| **Speaker** (starter `speaker.html`) | name of the person speaking | `name`, `role`, `company`, `label` (PRELEGENT / SPEAKER / MODERATOR), `photo`, `logo`, `accent` | the most used one; long names must fit; empty company hides the separator |
| **Two speakers / panel** | panel, interview, debate | `name1`, `role1`, `name2`, `role2` (or `people` list), `label` | two plates side by side, or one plate with two columns; or two layers of the speaker template |
| **Session title** | start of a talk / block | `title`, `subtitle`, `time`, `room`, `label` | bigger type, up to 2 lines |
| **Announcement** (starter `announcement.html`) | programme change, info, Wi-Fi, lunch | `label`, `title`, `text` | text up to 3 lines with shrink-to-fit |
| **Break timer** (starter `timer.html`) | "back in 5:00", countdown to start | `title`, `label`, `remaining` (live) or `target` (self-running), `phase`, `warn`, `danger` | live from Ontime/Companion, or one update with a target time; colour phases; overtime |
| **Ticker + clock** (starter `ticker.html`) | running info at the bottom | `items` (list), `label`, `speed`, `clock` | seamless loop, items change without restart |
| **Logo bug / clock** | permanent corner: event logo, LIVE, clock | `logo`, `live` (bool), `clock` (bool), `text` | small, inside action-safe, low motion |
| **Next up** | what's coming after the break | `label` (NEXT / ZA CHWILĘ), `title`, `name`, `time` | similar to session title; often paired with the timer |
| **Agenda** | list of the next 3-5 items | `items` (list of "time | title | speaker"), `title` | larger panel, still transparent around |
| **Q&A / social** | how to ask questions | `label`, `text` (slido.com #code), `qr` (image), `handle` | QR as an image file in `img/` |
| **Quote** | quotation from the speaker | `quote`, `name` | multi-line, typographic quotes „…” |
| **Sponsor / partner** | thanks, sponsor rotation | `logos` (list of image paths), `label`, `interval` | rotate logos with a timer inside the template |
| **Voting / poll result** | live results | `question`, `options` (list "label | value") | bars animate to values on update |

## TV / news
| Graphic | Fields |
|---|---|
| Name super (as speaker) | `name`, `role`, `location` |
| Location / time strap | `place`, `time` (or live clock), `label` (LIVE / NA ŻYWO / ARCHIWUM) |
| Breaking / alert strap | `headline`, `label`, `theme` (normal / alert) |
| Headline + ticker | `headline`, `kicker`, `items`, clock |
| Topic / story title | `title`, `kicker` |
| Phone / remote guest | `name`, `role`, `place`, `photo` |
| Credits / end roll | `items`, `speed` |

## Sport / esport
| Graphic | Fields |
|---|---|
| Scorebug | `home`, `away`, `homeScore`, `awayScore`, `period`, `clock` (live), `homeColor`, `awayColor`, `homeLogo`, `awayLogo` |
| Player super | `name`, `number`, `team`, `stat` |
| Lineup / results table | `rows` (list) |
| Countdown to start | as break timer |

## Stream / webinar
| Graphic | Fields |
|---|---|
| "Starting soon" / "Be right back" | `title`, `text`, timer fields |
| Chat / question highlight | `name`, `text`, `avatar` |
| Social handles | `items` (list of "icon | handle") |

## Behaviour patterns
- **show / update / hide**: every graphic; update while on air must not restart the animation (only re-render).
- **next()**: use it for a meaningful step - next ticker headline, second line of a speaker (e.g. role → topic of the talk), next logo, next agenda item. Default in `gfx.js` toggles show/hide.
- **live values** (timers, scores, clocks): either the template computes them itself (clock, countdown to a target time - no traffic) or the controller pushes each change (Ontime / Companion variables via a trigger). Don't push a clock every second when the template can run it.
- **lists** accept a JSON array or text with new lines / ` | ` (easy to type in a Companion field).
- **images** (photo, logo, QR, sponsor): file paths relative to the template (`img/kowalski.jpg`), or `file:///…/media/…`; empty value hides the element.
