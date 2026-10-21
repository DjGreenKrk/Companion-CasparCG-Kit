/*
 * gfx.js - shared runtime for CasparCG HTML graphics (tested on CasparCG 2.5.1, Chromium 142 inside).
 *
 * A template declares its fields and gets the CasparCG API (update / play / stop / next / remove),
 * a browser preview with a generated control panel (?preview=1), text fitting and clock / countdown helpers.
 *
 *   <section data-gfx class="lt">  ...  <span data-field="name" data-fit="38"></span>  ... </section>
 *   <script src="kit/gfx.js"></script>
 *   <script>
 *     GFX.define({
 *       fields: { name: { label: 'Name', sample: 'Jan Kowalski' }, accent: { type: 'color', default: '#c8ff67' } },
 *       aliases: { f0: 'name' },          // CasparCG client style f0, f1... (optional)
 *       outMs: 600,                        // length of the out-animation
 *       render(state, changed) {},         // optional extra rendering after the default one
 *     })
 *   </script>
 *
 * sample = text shown only in the browser preview; default = value used on air until data arrives (keep text
 * fields without a default, so a forgotten field shows nothing instead of a placeholder name on air).
 * Design in px for a 1920x1080 stage (.gfx-stage); the runtime scales it to the channel (720p, 2160p).
 *
 * Default rendering per field type:
 *   text  (default)  every [data-field=<key>] gets textContent (never HTML); [data-show=<key>] is hidden when empty
 *   image            <img data-field=<key>> gets src; hidden when empty (relative paths resolve from the template file)
 *   color            CSS variable --<key> on :root (only #rgb / #rrggbb / rgb() / hsl() accepted)
 *   list             array, or text split on new lines / " | " (render it yourself in render())
 *   number, bool     parsed; render yourself
 *   time             seconds, "mm:ss", "hh:mm:ss" or "-mm:ss" -> number of seconds (see GFX.formatDuration)
 * The root [data-gfx] gets class is-in on play and is-out on stop; animate with CSS on those classes.
 *
 * Live values straight from Bitfocus Companion (no trigger, no Ontime connection in the template): send
 *   { "companion": "192.168.1.10:8000", "live": "remaining=ontime:timer_current_hms, phase=ontime:timer_phase" }
 * and the template polls those Companion variables over HTTP (Companion allows cross-origin reads) every 250 ms,
 * applying a field when its value changes. "custom:name" reads a custom variable. live "" stops polling.
 */
;(function () {
	'use strict'

	const qs = new URLSearchParams(location.search)
	const PREVIEW = qs.get('preview') === '1'
	let def = null
	let state = {}
	let root = null
	let outTimer = null
	let visible = false

	// ---------- data parsing: object (CG INVOKE update({...})), JSON text, XML <templateData>, "" (CG ADD without data)
	function parse(input) {
		if (input && typeof input === 'object') return input
		if (typeof input !== 'string') return {}
		const raw = input.trim()
		if (!raw) return {}
		if (raw[0] === '{') {
			try {
				return JSON.parse(raw)
			} catch (e) {
				console.log('gfx: data is not valid JSON: ' + e.message)
				return {}
			}
		}
		if (raw[0] === '<') {
			const doc = new DOMParser().parseFromString(raw, 'application/xml')
			const out = {}
			doc.querySelectorAll('componentData').forEach((c) => {
				const d = c.querySelector('data')
				if (d) out[c.getAttribute('id')] = d.getAttribute('value') ?? d.textContent
			})
			return out
		}
		return {}
	}

	const COLOR = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\))$/i

	function parseTime(v) {
		if (typeof v === 'number') return v
		const s = String(v).trim()
		if (!s) return null
		const neg = s.startsWith('-')
		const parts = s.replace(/^[-+]/, '').split(':').map(Number)
		if (parts.some((p) => !Number.isFinite(p))) return null
		const sec = parts.reduce((acc, p) => acc * 60 + p, 0)
		return neg ? -sec : sec
	}

	function coerce(field, v) {
		switch (field.type) {
			case 'number': {
				const n = Number(v)
				return Number.isFinite(n) ? n : field.default
			}
			case 'bool':
				return v === true || v === 1 || /^(1|true|yes|on|tak)$/i.test(String(v))
			case 'list':
				if (Array.isArray(v)) return v.map(String).filter((x) => x.trim())
				return String(v)
					.split(/\r?\n|\s+\|\s+/)
					.map((x) => x.trim())
					.filter(Boolean)
			case 'color':
				return COLOR.test(String(v).trim()) ? String(v).trim() : field.default
			case 'time':
				return parseTime(v)
			default:
				return v == null ? '' : String(v)
		}
	}

	// ---------- rendering
	function fit(el) {
		// shrink the font until the text fits its box (data-fit = minimum size in px at 1080p)
		const min = parseFloat(el.dataset.fit) || 0
		el.style.fontSize = ''
		let size = parseFloat(getComputedStyle(el).fontSize)
		while (size > min && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
			size -= 1
			el.style.fontSize = size + 'px'
		}
	}

	function renderDefault(changed) {
		for (const key of changed) {
			const field = def.fields[key]
			const v = state[key]
			const empty = v === '' || v == null || (Array.isArray(v) && !v.length)
			if (field.type === 'color') {
				document.documentElement.style.setProperty('--' + key, v)
				continue
			}
			document.querySelectorAll('[data-field="' + key + '"]').forEach((el) => {
				if (el.tagName === 'IMG') {
					if (empty) el.removeAttribute('src')
					else el.src = v
					el.hidden = empty
				} else if (field.type !== 'list' && field.type !== 'time') {
					el.textContent = empty ? '' : String(v)
				}
			})
			document.querySelectorAll('[data-show="' + key + '"]').forEach((el) => (el.hidden = empty))
		}
		document.querySelectorAll('[data-fit]').forEach(fit)
	}

	function apply(data) {
		if ('companion' in data || 'live' in data) setLive(data)
		const changed = []
		for (const [k, v] of Object.entries(data)) {
			const key = (def.aliases && def.aliases[k]) || k
			if (!def.fields[key] || v == null) continue
			state[key] = coerce(def.fields[key], v)
			changed.push(key)
		}
		if (!changed.length) return
		renderDefault(changed)
		if (def.render) def.render(state, changed)
		if (PREVIEW) syncPanel()
	}

	// ---------- live binding to Companion variables
	const live = { host: '', map: {}, last: {}, timer: null, busy: false }

	function setLive(data) {
		if ('companion' in data) live.host = String(data.companion || '').replace(/^https?:\/\//, '').replace(/\/+$/, '')
		if ('live' in data) {
			let m = data.live || {}
			if (typeof m === 'string') {
				// "field=connection:variable, field2=custom:name"
				m = Object.fromEntries(
					m
						.split(/[,\n]/)
						.map((p) => p.split('=').map((x) => x.trim()))
						.filter((p) => p.length === 2 && p[0] && p[1]),
				)
			}
			live.map = m
			live.last = {}
		}
		clearInterval(live.timer)
		live.timer = live.host && Object.keys(live.map).length ? setInterval(poll, data.liveMs || 250) : null
	}

	function varUrl(v) {
		const i = v.indexOf(':')
		const conn = v.slice(0, i)
		const name = v.slice(i + 1)
		return conn === 'custom'
			? `http://${live.host}/api/custom-variable/${encodeURIComponent(name)}/value`
			: `http://${live.host}/api/variable/${encodeURIComponent(conn)}/${encodeURIComponent(name)}/value`
	}

	async function poll() {
		if (live.busy) return // never stack requests when Companion is slow
		live.busy = true
		try {
			const out = {}
			await Promise.all(
				Object.entries(live.map).map(async ([field, v]) => {
					const r = await fetch(varUrl(v), { cache: 'no-store' })
					if (!r.ok) return
					const val = await r.text()
					if (live.last[field] !== val) out[field] = live.last[field] = val
				}),
			)
			if (Object.keys(out).length) apply(out)
		} catch (e) {
			// Companion unreachable: keep the last values on air
		} finally {
			live.busy = false
		}
	}

	// ---------- CasparCG API
	function update(data) {
		apply(parse(data))
	}

	function play() {
		clearTimeout(outTimer)
		root.classList.remove('is-out', 'is-in')
		void root.offsetWidth // restart the CSS animation
		root.classList.add('is-in')
		visible = true
		if (def.onPlay) def.onPlay(state)
	}

	function stop() {
		clearTimeout(outTimer)
		if (!visible) return
		visible = false
		root.classList.remove('is-in')
		root.classList.add('is-out')
		if (def.onStop) def.onStop(state)
		outTimer = setTimeout(() => root.classList.remove('is-out'), def.outMs || 600)
	}

	function next() {
		if (def.next) def.next(state)
		else if (visible) stop()
		else play()
	}

	function remove() {
		clearTimeout(outTimer)
		visible = false
		root.classList.remove('is-in', 'is-out')
	}

	// ---------- helpers for templates
	const pad = (n) => String(n).padStart(2, '0')

	/** seconds -> "m:ss" / "h:mm:ss" (negative = overtime, shown with "-" or "+" per sign option). */
	function formatDuration(sec, { hours = 'auto', overtimeSign = '-' } = {}) {
		if (sec == null || !Number.isFinite(sec)) return '--:--'
		const neg = sec < 0
		let s = Math.abs(Math.round(sec))
		const h = Math.floor(s / 3600)
		s -= h * 3600
		const m = Math.floor(s / 60)
		s -= m * 60
		const body = h || hours === true ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s)
		return (neg ? overtimeSign : '') + body
	}

	/**
	 * Clock in a fixed time zone (the CasparCG server usually runs in UTC - never rely on the local zone).
	 * GFX.clock(el, { timeZone: 'Europe/Warsaw', seconds: false })
	 */
	function clock(el, { timeZone = 'Europe/Warsaw', seconds = false, locale = 'pl-PL' } = {}) {
		const f = new Intl.DateTimeFormat(locale, {
			timeZone,
			hour: '2-digit',
			minute: '2-digit',
			second: seconds ? '2-digit' : undefined,
			hour12: false,
		})
		const tick = () => (el.textContent = f.format(new Date()))
		tick()
		return setInterval(tick, 250)
	}

	/**
	 * Countdown that runs by itself towards a target time (one update, no traffic during the show).
	 * target: epoch ms, ISO date, or "HH:MM" today in timeZone. cb(secondsLeft) is called 4x per second.
	 */
	function countdown(target, cb, { timeZone = 'Europe/Warsaw' } = {}) {
		const at = toEpoch(target, timeZone)
		const tick = () => cb(at == null ? null : (at - Date.now()) / 1000)
		tick()
		return setInterval(tick, 250)
	}

	function toEpoch(t, timeZone) {
		if (t == null || t === '') return null
		if (typeof t === 'number') return t
		const s = String(t).trim()
		if (/^\d{10,}$/.test(s)) return Number(s)
		const hm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s)
		if (hm) {
			// wall-clock time today in timeZone
			const now = new Date()
			const parts = Object.fromEntries(
				new Intl.DateTimeFormat('en-CA', {
					timeZone,
					year: 'numeric',
					month: '2-digit',
					day: '2-digit',
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit',
					hour12: false,
				})
					.formatToParts(now)
					.map((p) => [p.type, p.value]),
			)
			const zoneNow = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second)
			const offset = zoneNow - Math.floor(now.getTime() / 1000) * 1000
			const target = Date.UTC(parts.year, parts.month - 1, parts.day, +hm[1], +hm[2], +(hm[3] || 0))
			return target - offset
		}
		const d = Date.parse(s)
		return Number.isNaN(d) ? null : d
	}

	// ---------- browser preview (?preview=1): background, control panel generated from the fields, ?data={json}
	let panel = null
	function buildPanel() {
		document.body.classList.add('gfx-preview')
		panel = document.createElement('aside')
		panel.className = 'gfx-panel'
		panel.innerHTML = '<h1>' + (document.title || 'Graphic') + '</h1>'
		for (const [key, f] of Object.entries(def.fields)) {
			const label = document.createElement('label')
			label.textContent = (f.label || key) + ' (' + key + ')'
			const input = document.createElement(f.type === 'list' ? 'textarea' : 'input')
			if (f.type === 'color') input.type = 'text'
			input.dataset.key = key
			input.addEventListener('input', () => apply({ [key]: input.value }))
			panel.append(label, input)
		}
		const row = document.createElement('div')
		row.className = 'gfx-buttons'
		for (const [txt, fn] of [
			['Play', play],
			['Stop', stop],
			['Next', next],
		]) {
			const b = document.createElement('button')
			b.textContent = txt
			b.onclick = fn
			row.append(b)
		}
		const json = document.createElement('pre')
		json.className = 'gfx-json'
		panel.append(row, json)
		document.body.append(panel)
		syncPanel()
	}
	function syncPanel() {
		if (!panel) return
		panel.querySelectorAll('[data-key]').forEach((el) => {
			if (document.activeElement === el) return
			const v = state[el.dataset.key]
			el.value = Array.isArray(v) ? v.join('\n') : v == null ? '' : v
		})
		panel.querySelector('.gfx-json').textContent = 'update(' + JSON.stringify(state, null, 1) + ')'
	}

	// ---------- 1920x1080 stage scaled to the channel / browser window
	function scaleStage() {
		const s = Math.min(innerWidth / 1920, innerHeight / 1080)
		document.documentElement.style.setProperty('--gfx-scale', String(s))
	}

	// ---------- define
	function define(d) {
		scaleStage()
		addEventListener('resize', scaleStage)
		def = d
		root = document.querySelector('[data-gfx]')
		if (!root) throw new Error('gfx: no element with data-gfx')
		state = {}
		const defaults = {}
		for (const [k, f] of Object.entries(def.fields)) defaults[k] = (PREVIEW ? f.sample ?? f.default : f.default) ?? ''
		apply(defaults)
		window.update = update
		window.play = play
		window.stop = stop
		window.next = next
		window.remove = remove
		if (PREVIEW) {
			buildPanel()
			if (qs.has('data')) update(qs.get('data'))
			requestAnimationFrame(() => requestAnimationFrame(play))
		}
		// never play by itself outside the preview: CasparCG starts it with CG PLAY / play-on-load
	}

	window.GFX = { define, update, play, stop, next, remove, fit, formatDuration, clock, countdown, parseTime, state: () => state }
})()
