# Template contract

Everything here was checked on CasparCG 2.5.1 (HTML producer = Chromium 142) with Companion 5.1, the Companion CasparCG Kit module 3.x (or the official `casparcg-server` 2.1.2 where noted) and Ontime 4.15.

## 1. The runtime (`assets/kit/gfx.js`)
```html
<link rel="stylesheet" href="kit/gfx-base.css">
<link rel="stylesheet" href="theme.css">
...
<div class="gfx-viewport"><div class="gfx-stage">          <!-- 1920x1080 stage, scaled to the channel -->
  <section class="lt" data-gfx>                              <!-- root: gets is-in / is-out -->
    <img data-field="photo">                                 <!-- image field: src, hidden when empty -->
    <div data-field="label" data-show="label"></div>          <!-- data-show: hidden when the field is empty -->
    <div class="name" data-field="name" data-fit="36"></div>  <!-- data-fit: shrink to fit, min 36 px -->
  </section>
</div></div>
<script src="kit/gfx.js"></script>
<script>
GFX.define({
  fields: {
    name:   { label: 'Imię i nazwisko', sample: 'Aleksandra Nowak' },  // sample = preview only
    label:  { label: 'Etykieta', default: 'PRELEGENT' },              // default = also on air
    accent: { type: 'color', default: '#c8ff67' },                    // -> CSS variable --accent
    photo:  { type: 'image' },
  },
  aliases: { f0: 'name', f1: 'role' },   // keys some CasparCG clients send
  outMs: 450,                            // exit animation length
  render(state, changed) {},             // extra rendering (lists, timers, conditional layout)
  onPlay(state) {}, onStop(state) {}, next(state) {},
})
</script>
```
Field types: `text` (default), `image`, `color`, `list` (array or text with new lines / ` | `), `number`, `bool`, `time` (seconds, `mm:ss`, `hh:mm:ss`, `-mm:ss` → seconds; Ontime's `--:--:--` → null).
Helpers: `GFX.formatDuration(sec)`, `GFX.clock(el, {timeZone})`, `GFX.countdown(target, cb, {timeZone})` (target `"14:30"`, ISO date or epoch ms), `GFX.fit(el)`, `GFX.state()`.
Preview: `file.html?preview=1` (background, safe-area frame, panel with all fields, Play / Stop / Next, the current `update({...})` as text) and `&data={"name":"..."}`.

Writing a template without the kit is fine (e.g. fixing a client's file), but it must keep the same contract: `window.update/play/stop/next/remove`, hidden until `play()`, `update()` accepting object / JSON / XML / "".

## 2. Data formats and the CasparCG side
| How it is sent | What `update()` gets | Notes |
|---|---|---|
| `CG 1-20 ADD 1 "pkg/speaker" 1 "<json>"` | JSON text | the data parameter must have **every backslash doubled** before AMCP quoting: 2.5.1 passes it as `update("...")` escaping only quotes, so JSON with `\"` (a quote inside a value) or `\n` breaks with `Uncaught SyntaxError` in the server log. The 3.x Companion module does this. |
| `CG 1-20 UPDATE 1 "<json>"` | JSON text | same rule |
| `CG 1-20 ADD 1 "pkg/speaker" 1 "<templateData>…"` | XML text | CasparCG clients' format, `f0`, `f1`… ids → use `aliases` |
| `CG 1-20 INVOKE 1 "update({name:\"Jan\"})"` | **object** | INVOKE runs the expression as written (no backslash doubling); no trailing `;` (SyntaxError) |
| `CG 1-20 ADD 1 "pkg/speaker" 0` (no data) | `""` | always called once - ignore empty |
| data not starting with `{` or `<` | `""` | the server takes it as a stored dataset name |

`CG INVOKE` right after `CG ADD ... 0` works (calls are queued while the page loads). `CG PLAY 1` → `play()`, `CG STOP 1` → `stop()`, `CG NEXT 1` → `next()`. Clear the layer (`CLEAR 1-20` / `CG 1-20 CLEAR`) after the exit animation. Template names: path under the template folder without `.html`, e.g. `"konferencja/speaker"` (TLS shows them upper-case).

Relative paths inside the template resolve from the template file: `kit/gfx.js`, `theme.css`, `fonts/x.woff2` (`@font-face`), `img/kowalski.jpg` - all tested. `file:///…/media/x.png` works too.

## 3. Companion buttons
With Companion CasparCG Kit 3.x:
- Show: action **Template: add (CG ADD)** - template from the list, *Play on load* on, *Pass data as* **Object** (or Text), *Data format* **Fields**: `name="$(local:name)" role="$(local:role)" company="$(local:company)" photo="img/$(local:photo).jpg"`. Any number of fields, quotes in variable values are safe. One button per speaker = duplicate the button and change only its local variables.
- Update on air: **Template: update data (CG UPDATE)** with the changed fields only.
- Hide: **Template: stop**, then after the exit (Companion `wait` = `outMs`) **Template: clear layer**.
- Raw: *Data format* **Raw** + *Object* accepts the call exactly as the template author documents it: `update({ name: "$(local:name)", accent: "#c8ff67" });` (new lines and the final `;` are handled; a `"` inside a variable value breaks the JS here - use Fields for free text).

With the stock 2.1.2 module: only `COMMAND` (raw AMCP); local variables there come out as `$NA` (bug), use custom variables `$(custom:name)`; double backslashes yourself; prefer `CG ... INVOKE 1 "update({...})"` (no doubling needed) with values that contain no `"`.

## 4. Live values (timers, scores, Ontime)
Three tested ways, best first for most shows:

**a) The template reads Companion variables itself** (no trigger, no Ontime connection in the template). Companion's HTTP API answers cross-origin (`Access-Control-Allow-Origin: *`), so the page can poll it (~10 ms per read on the LAN). Send once:
```
update({ companion: "192.168.1.10:8000",
         live: "remaining=ontime:timer_current_hms, phase=ontime:timer_phase, title=ontime:event_now_title" })
```
`gfx.js` polls every 250 ms (`liveMs` to change), applies only changed values, never stacks requests, keeps the last value if Companion is unreachable. `custom:name` reads a custom variable. The connection label (`ontime` above) is whatever the user named the connection in Companion. Tested: Ontime demo rundown → Companion Ontime module 5.4.1 → timer template on CasparCG, seconds and event change appear on air.

**b) Companion trigger** - Triggers → event **Variable changed** (`$(ontime:timer_current_hms)`) → action *Template: update data* with `remaining="$(ontime:timer_current_hms)" phase="$(ontime:timer_phase)"`. One CG command per change (once a second for a timer). Tested end to end. Use it when the template must not know Companion's address.

**c) Ontime's own pages in CasparCG** - `PLAY 1-20 [HTML] "http://<ontime>:4001/timer"` renders Ontime's view live (tested; opaque dark background by default - style it with Ontime's view settings / custom CSS), or a custom view served by Ontime from its `external/` folder (the page connects to Ontime's WebSocket itself). Note: Ontime's "time now" uses the Ontime machine's clock and zone.

Self-running alternative for a fixed break: `update({ target: "14:30" })` - the template counts down by itself in the event's time zone; nothing is sent during the break.

Ontime variables (Companion module `getontime-ontime` 5.4.x), connection label `ontime`:
| Variable | Value |
|---|---|
| `timer_current_hms` | `00:59:59`, negative `-00:01:05` in overtime, `--:--:--` when stopped (use as `remaining`) |
| `timer_current` | milliseconds |
| `timer_phase` | `none`, `default`, `warning`, `danger`, `overtime`, `pending` (Ontime's own thresholds) |
| `playState` | `play`, `pause`, `stop`, `roll` |
| `event_now_title`, `event_next_title`, `event_now_note`, `event_now_cue` | rundown texts (also `_prev_`, `_flag_`) |
| `message_text`, `message_visible` | Ontime's presenter message |
| `aux_1_current` … `aux_3_current` | auxiliary timers in **milliseconds** |
| `clock` | Ontime wall clock in ms |

## 5. Starter templates (tested)
| File | Fields | Tested |
|---|---|---|
| `speaker.html` | name, role, company, label, accent, photo, logo | JSON with quotes, XML, object, logo from `img/`, 720p and 1080p |
| `timer.html` | title, label, remaining, target, phase, warn, danger, accent | live via trigger, live via polling Companion (Ontime), target 23:59, phases warning / danger / overtime |
| `ticker.html` | items, label, speed, clock, accent | list as array and as `a | b`, items replaced without restart, clock in Europe/Warsaw on a UTC server |
| `announcement.html` | label, title, text, accent | XML f0/f1, 2-line text |
