# <Event> - graphics package (operator sheet)

Copy this folder into CasparCG's `template` folder (e.g. `template/<event>/`). Layer plan: 20 lower thirds,
21 timer, 22 ticker, 23 announcements (change to the show's plan). Exit animations take 0.45 s - clear the layer after that.

| Template | Fields | Show (AMCP) |
|---|---|---|
| `<event>/speaker` | name, role, company, label, photo, logo, accent | `CG 1-20 ADD 1 "<event>/speaker" 1 "{\"name\":\"Jan Kowalski\",\"role\":\"CEO\"}"` |
| `<event>/timer` | title, label, remaining *or* target, phase, warn, danger | `CG 1-21 ADD 1 "<event>/timer" 1 "{\"title\":\"Przerwa\",\"target\":\"14:30\"}"` |
| `<event>/ticker` | items, label, speed, clock | `CG 1-22 ADD 1 "<event>/ticker" 1 "{\"items\":[\"...\",\"...\"]}"` |
| `<event>/announcement` | label, title, text | `CG 1-23 ADD 1 "<event>/announcement" 1 "{\"title\":\"...\",\"text\":\"...\"}"` |

Update on air: `CG 1-20 UPDATE 1 "{\"role\":\"...\"}"`. Hide: `CG 1-20 STOP 1`, then `CLEAR 1-20`.
Sample data for every template: `data.example.json`. Browser preview: open a file with `?preview=1`.

## Companion (Companion CasparCG Kit 3.x)
- Speaker button: *Template: add* → `<event>/speaker`, Pass data as *Object*, Fields
  `name="$(local:name)" role="$(local:role)" company="$(local:company)"`; local variables name / role / company on the button.
  Second step: *Template: stop*, wait 450 ms, *Template: clear layer*.
- Timer from Ontime, without a trigger: *Template: add* → `<event>/timer`, Fields
  `title="$(ontime:event_now_title)" companion="<companion-ip>:<port>" live="remaining=ontime:timer_current_hms, phase=ontime:timer_phase"`
  (the template then reads the Ontime variables from Companion by itself).

## Look
Colours, fonts and timing: `theme.css`. Taken from: <materials>.
