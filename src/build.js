// Pure AMCP command builders. Every function takes option values that already have variables resolved
// and returns the command line(s), or throws an Error with a message meant for the Companion log.
// Grammar notes are from tests on CasparCG 2.5.1 (see HELP.md).

const TWEEN_FAMILIES = ['quad', 'cubic', 'quart', 'quint', 'sine', 'expo', 'circ', 'elastic', 'back', 'bounce']
// server spelling: the "outin back" tween is called easeoutintback in the 2.5.1 tween table
const TWEENS = ['linear', 'easenone']
for (const f of TWEEN_FAMILIES) {
	for (const k of ['in', 'out', 'inout', 'outin']) {
		TWEENS.push(k === 'outin' && f === 'back' ? 'easeoutintback' : `ease${k}${f}`)
	}
}
const TWEEN_SET = new Set(TWEENS)

const TRANSITIONS = ['CUT', 'MIX', 'PUSH', 'SLIDE', 'WIPE', 'VFADE', 'FADECUT', 'CUTFADE', 'STING']
const DIRECTIONAL = new Set(['PUSH', 'SLIDE', 'WIPE'])
const DIRECTIONS = ['', 'RIGHT', 'LEFT', 'DOWN', 'UP']

const MIXER_PROPS = ['OPACITY', 'VOLUME', 'BRIGHTNESS', 'SATURATION', 'CONTRAST']
// sensible ranges in percent; the server takes anything (VOLUME 100 = +40 dB, nan, inf - tested on 2.5.1)
const MIXER_RANGES = {
	OPACITY: [0, 100],
	VOLUME: [0, 400],
	BRIGHTNESS: [0, 500],
	SATURATION: [0, 500],
	CONTRAST: [0, 500],
}
// longest transition / animation accepted: 5 minutes at 50 fps (the server takes MIX 99999 = 33 minutes)
const MAX_FRAMES = 15000

// The server reads a transition anywhere in the line, file names included ("promo MIX 2024" plays with a
// 2024-frame mix, tested on 2.5.1). With no transition chosen, CUT 0 at the end makes it a plain cut again.
const TRANSITION_WORD = /\b(VFADE|FADECUT|CUTFADE|CUT|PUSH|SLIDE|WIPE|MIX)\s+\d+/i
const guardCut = (text) => (TRANSITION_WORD.test(text) ? 'CUT 0' : '')

const str = (v) => (v === undefined || v === null ? '' : String(v).trim())
const truthy = (v) => v === true || v === 'true' || v === 1 || v === '1'

// tested on 2.5.1: a layer above this (or negative, or not a number) is answered 202 but plays on layer 0
const MAX_INDEX = 2147483647

function int(v, what, { min = 0, max = MAX_INDEX, optional = false } = {}) {
	const s = str(v)
	if (s === '') {
		if (optional) return null
		throw new Error(`${what} is empty`)
	}
	if (!/^-?\d+$/.test(s)) throw new Error(`${what} must be a whole number, got "${s}"`)
	const n = parseInt(s, 10)
	if (n < min) throw new Error(`${what} must be at least ${min}, got ${n}`)
	if (n > max) throw new Error(`${what} must be at most ${max}, got ${s}`)
	return n
}

function num(v, what, { optional = false } = {}) {
	const s = str(v).replace(',', '.')
	if (s === '') {
		if (optional) return null
		throw new Error(`${what} is empty`)
	}
	if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`${what} must be a number, got "${s}"`)
	return parseFloat(s)
}

/** "1-10", or "1" when the layer is empty and allowed to be. */
function address(channel, layer, { layerRequired = false } = {}) {
	const ch = int(channel, 'Channel', { min: 1 })
	const l = int(layer, 'Layer', { optional: !layerRequired })
	return l === null ? `${ch}` : `${ch}-${l}`
}

/** Media / template names: forward slashes, always quoted (quotes are harmless and protect spaces). */
function quote(name) {
	const s = str(name).replace(/\\/g, '/')
	return '"' + s.replace(/"/g, '\\"') + '"'
}

function fmt(n) {
	// AMCP takes plain decimals; avoid exponent notation and float noise
	return String(Math.round(n * 1e6) / 1e6)
}

/** Validate a tween (with optional parameters, e.g. easeoutelastic:1:0.3). Returns the normalised tween. */
function tween(t) {
	let s = str(t)
	if (s === '') return 'linear'
	const [name, ...params] = s.split(':')
	if (!TWEEN_SET.has(name.toLowerCase())) {
		throw new Error(`Tween "${name}" is not in the server's tween table (the server would answer 403 and do nothing)`)
	}
	for (const p of params) {
		if (!/^\d+(\.\d)?$/.test(p)) {
			throw new Error(`Tween parameter "${p}" in "${s}": use at most one decimal digit and no minus (2.5.1 rejects it)`)
		}
	}
	return [name.toLowerCase(), ...params].join(':')
}

function transition(o) {
	const type = str(o.transition).toUpperCase() || 'CUT'
	if (!TRANSITIONS.includes(type)) throw new Error(`Unknown transition "${type}"`)
	if (type === 'CUT') return ''
	if (type === 'STING') {
		const cut = truthy(o.sting_cut)
		const mask = cut ? 'EMPTY' : str(o.sting_mask)
		if (!mask) throw new Error('STING needs a mask clip (or tick "cut at trigger point")')
		for (const n of [mask, str(o.sting_overlay)]) {
			// tested on 2.5.1: 404 in both the positional and the key-value form, quoted or not
			if (/\s/.test(n))
				throw new Error(`Sting clip "${n}" has a space in its name - the server cannot load it, rename the file`)
		}
		const parts = [`MASK=${quote(mask)}`]
		const trigger = int(o.sting_trigger, 'Sting trigger point', { optional: true })
		if (trigger) parts.push(`TRIGGER_POINT=${trigger}`)
		if (str(o.sting_overlay)) parts.push(`OVERLAY=${quote(o.sting_overlay)}`)
		const afs = int(o.sting_audio_start, 'Audio fade start', { optional: true })
		const afd = int(o.sting_audio_duration, 'Audio fade duration', { optional: true })
		if (afs) parts.push(`AUDIO_FADE_START=${afs}`)
		if (afd) parts.push(`AUDIO_FADE_DURATION=${afd}`)
		return `STING (${parts.join(' ')})`
	}
	const dur = int(o.transition_duration, 'Transition duration (frames)', { optional: true, max: MAX_FRAMES }) ?? 0
	let out = `${type} ${dur} ${tween(o.transition_tween)}`
	const dir = str(o.direction).toUpperCase()
	if (dir) {
		if (!DIRECTIONAL.has(type)) throw new Error(`${type} has no direction (only PUSH, SLIDE and WIPE)`)
		if (!DIRECTIONS.includes(dir)) throw new Error(`Unknown direction "${dir}"`)
		out += ' ' + dir
	}
	return out
}

/**
 * PLAY / LOAD / LOADBG. Returns an array of lines: an optional MIXER CLEAR first, then the command.
 * Parameter order: clip, LOOP, SEEK, LENGTH, AUTO, transition (the transition parser ignores everything
 * after the direction, so it goes last).
 */
function playLike(verb, o) {
	const addr = address(o.channel, o.layer)
	const clip = str(o.clip) || str(o.clip_dd)
	const parts = [verb, addr]
	if (clip) parts.push(quote(colourSafe(clip)))
	else if (verb !== 'PLAY') throw new Error(`${verb} needs a clip`)
	if (truthy(o.loop)) parts.push('LOOP')
	const seek = int(o.seek, 'Seek (frames)', { optional: true })
	if (seek) parts.push(`SEEK ${seek}`)
	const length = int(o.length, 'Length (frames)', { optional: true })
	if (length) parts.push(`LENGTH ${length}`)
	if (verb === 'LOADBG' && truthy(o.auto)) parts.push('AUTO')
	if (clip) {
		const t = transition(o) || guardCut(clip)
		if (t) parts.push(t)
	}
	const lines = []
	if (truthy(o.clear_mixer)) lines.push(`MIXER ${address(o.channel, o.layer, { layerRequired: true })} CLEAR`)
	lines.push(parts.join(' '))
	return lines
}

/** A clip called like a colour (RED, #FF0000) would play the colour instead (tested on 2.5.1). */
function colourSafe(clip) {
	const s = str(clip)
	if (COLOR_NAMES.includes(s.toUpperCase()) || /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(s))
		throw new Error(`"${s}" is a colour name for the server - type the file name with its extension (e.g. ${s}.mp4)`)
	return s
}

function simple(verb, o, { layerRequired = false } = {}) {
	return `${verb} ${address(o.channel, o.layer, { layerRequired })}`
}

const CALL_PARAMS = ['LOOP', 'SEEK', 'LENGTH', 'IN', 'OUT']

function callParam(o) {
	const verb = str(o.target) === 'bg' ? 'CALLBG' : 'CALL'
	const p = str(o.param).toUpperCase()
	if (!CALL_PARAMS.includes(p)) throw new Error(`Unknown parameter "${p}"`)
	let value
	if (p === 'LOOP') value = truthy(o.loop_value) ? 1 : 0
	else {
		value = int(o.value, `${p} (frames)`, { min: 0 })
	}
	return `${verb} ${address(o.channel, o.layer, { layerRequired: true })} ${p} ${value}`
}

function mixerTail(o) {
	let out = ''
	const dur = int(o.duration, 'Duration (frames)', { optional: true, max: MAX_FRAMES }) ?? 0
	if (dur > 0) out += ` ${dur} ${tween(o.tween)}`
	if (truthy(o.defer)) out += ' DEFER'
	return out
}

function mixerProp(o) {
	const prop = str(o.property).toUpperCase()
	if (!MIXER_PROPS.includes(prop)) throw new Error(`Unknown mixer property "${prop}"`)
	const pct = num(o.value, `${prop} (%)`)
	const [lo, hi] = MIXER_RANGES[prop]
	if (pct < lo || pct > hi) throw new Error(`${prop} must be ${lo}-${hi} %, got ${pct}`)
	const v = pct / 100
	// MIXER 1 VOLUME without a layer only touches layer 0, so a layer is required
	return `MIXER ${address(o.channel, o.layer, { layerRequired: true })} ${prop} ${fmt(v)}${mixerTail(o)}`
}

function mixerFill(o) {
	const v = ['x', 'y', 'sx', 'sy'].map((k) => fmt(num(o[k], `Fill ${k} (%)`) / 100))
	return `MIXER ${address(o.channel, o.layer, { layerRequired: true })} FILL ${v.join(' ')}${mixerTail(o)}`
}

function masterVolume(o) {
	const pct = num(o.value, 'Master volume (%)')
	if (pct < 0 || pct > 400) throw new Error(`Master volume must be 0-400 %, got ${pct}`)
	const v = pct / 100
	return `MIXER ${int(o.channel, 'Channel', { min: 1 })} MASTERVOLUME ${fmt(v)}${mixerTail(o)}`
}

/** Template data: either raw (JSON/XML as typed) or f0="John" f1="Doe" pairs (as in module 2.x). */
/** f0="text" f1="text" -> { f0: 'text', f1: 'text' } */
function parsePairs(raw) {
	const data = {}
	// a value ends at the quote followed by the next key="..." or the end, so text from variables may contain quotes
	const re = /([^=\s,]+?)="(.*?)"(?=[\s,]*(?:[^=\s,"]+="|$))[\s,]*/g
	let m
	while ((m = re.exec(raw)) !== null) data[m[1]] = m[2]
	if (!Object.keys(data).length) throw new Error(`Template variables "${raw}" are not in the form f0="text" f1="text"`)
	return data
}

function templateData(o) {
	const raw = str(o.variables)
	if (!raw) return null
	if (str(o.data_format) === 'raw') return raw
	const data = parsePairs(raw)
	if (truthy(o.json)) return JSON.stringify(data)
	const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
	let xml = '<templateData>'
	for (const k of Object.keys(data)) {
		xml += `<componentData id="${esc(k)}"><data id="text" value="${esc(data[k])}" /></componentData>`
	}
	return xml + '</templateData>'
}

const amcpString = (s) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'

// CasparCG 2.5.1 hands CG data to the page as update("<data>") escaping only the quotes, so a backslash in the
// data (JSON \" or \n, a Windows path) breaks the call or is lost. Doubling it first makes the page get the data
// exactly as built (verified). Then the usual AMCP quoting.
const dataParam = (d) => amcpString(d.replace(/\\/g, '\\\\'))

/**
 * "Pass as object": a JS call for CG INVOKE, so the template gets update({...}) with an object instead of a string.
 * Fields -> update({"f0":"..."}) (JSON, so quotes in values are safe). Raw: a call as typed (`update({...});`,
 * trailing ";" removed - 2.5.1 rejects it) or an object literal that gets wrapped in update(...).
 * INVOKE is passed to the page verbatim (no backslash doubling needed - verified on 2.5.1).
 */
function objectCall(o) {
	const raw = str(o.variables)
	if (!raw) return null
	if (str(o.data_format) !== 'raw') return `update(${JSON.stringify(parsePairs(raw))})`
	const one = raw
		.replace(/\s*\n\s*/g, ' ')
		.replace(/;\s*$/, '')
		.trim()
	return /^[A-Za-z_$][\w$.]*\s*\(.*\)$/.test(one) ? one : `update(${one})`
}

function cg(sub, o) {
	const addr = address(o.channel, o.layer, { layerRequired: true })
	const hostLayer = int(o.templatelayer, 'Template host layer', { optional: true }) ?? 1
	switch (sub) {
		case 'ADD': {
			const t = str(o.template) || str(o.template_dd)
			if (!t) throw new Error('CG ADD needs a template')
			const play = truthy(o.playonload)
			if (o.pass_as === 'object') {
				// load without data, hand over the object, then start (the server queues calls while it loads)
				const call = objectCall(o)
				return [
					`CG ${addr} ADD ${hostLayer} ${quote(t)} ${call ? 0 : play ? 1 : 0}`,
					call && `CG ${addr} INVOKE ${hostLayer} ${amcpString(call)}`,
					call && play && `CG ${addr} PLAY ${hostLayer}`,
				].filter(Boolean)
			}
			const d = templateData(o)
			let out = `CG ${addr} ADD ${hostLayer} ${quote(t)} ${play ? 1 : 0}`
			if (d) out += ' ' + dataParam(d)
			return out
		}
		case 'UPDATE': {
			if (o.pass_as === 'object') {
				const call = objectCall(o)
				if (!call) throw new Error('CG UPDATE needs data')
				return `CG ${addr} INVOKE ${hostLayer} ${amcpString(call)}`
			}
			const d = templateData(o)
			if (!d) throw new Error('CG UPDATE needs data')
			return `CG ${addr} UPDATE ${hostLayer} ${dataParam(d)}`
		}
		case 'INVOKE': {
			const m = str(o.method)
			if (!m) throw new Error('CG INVOKE needs a method name')
			return `CG ${addr} INVOKE ${hostLayer} ${amcpString(m.replace(/;\s*$/, ''))}`
		}
		case 'CLEAR':
			return `CG ${addr} CLEAR`
		default:
			return `CG ${addr} ${sub} ${hostLayer}`
	}
}

function swap(o) {
	let out = `SWAP ${address(o.channel1, o.layer1)} ${address(o.channel2, o.layer2)}`
	if (truthy(o.transforms)) out += ' TRANSFORMS'
	return out
}

// ------------------------------------------------------------------ mixer: geometry, blend, keyer

/** Geometry commands with their values in percent (CROP / CLIP / ANCHOR) or degrees (ROTATION). */
const GEOMETRY = {
	CROP: ['crop_l', 'crop_t', 'crop_r', 'crop_b'],
	CLIP: ['clip_x', 'clip_y', 'clip_w', 'clip_h'],
	ANCHOR: ['anchor_x', 'anchor_y'],
	ROTATION: ['rotation'],
}

function mixerGeometry(o) {
	const prop = str(o.property).toUpperCase()
	const keys = GEOMETRY[prop]
	if (!keys) throw new Error(`Unknown mixer property "${prop}"`)
	const v = keys.map((k) => num(o[k], `${prop} ${k.split('_')[1]}`))
	const values = prop === 'ROTATION' ? v.map(fmt) : v.map((x) => fmt(x / 100))
	return `MIXER ${address(o.channel, o.layer, { layerRequired: true })} ${prop} ${values.join(' ')}${mixerTail(o)}`
}

// tested on 2.5.1: an unknown mode is accepted silently, so the list is checked here
const BLEND_MODES = [
	'normal', 'lighten', 'darken', 'multiply', 'average', 'add', 'subtract', 'difference', 'negation', 'exclusion',
	'screen', 'overlay', 'soft_light', 'hard_light', 'color_dodge', 'color_burn', 'linear_dodge', 'linear_burn',
	'linear_light', 'vivid_light', 'pin_light', 'hard_mix', 'reflect', 'glow', 'phoenix', 'contrast', 'saturation',
	'color', 'luminosity',
] // prettier-ignore

function mixerBlend(o) {
	const mode = str(o.blend).toLowerCase()
	if (!BLEND_MODES.includes(mode)) throw new Error(`Unknown blend mode "${mode}" (the server would ignore it)`)
	return `MIXER ${address(o.channel, o.layer, { layerRequired: true })} BLEND ${mode}`
}

function mixerKeyer(o) {
	return `MIXER ${address(o.channel, o.layer, { layerRequired: true })} KEYER ${truthy(o.keyer) ? 1 : 0}`
}

// ------------------------------------------------------------------ other sources for PLAY / LOADBG

// tested on 2.5.1: the colour producer knows only these names; others answer 404
const COLOR_NAMES = ['EMPTY', 'BLACK', 'WHITE', 'RED', 'GREEN', 'BLUE', 'ORANGE', 'YELLOW', 'BROWN', 'GRAY', 'TEAL']

/** Companion colour (number, "#rrggbb" or "rgb(a)(...)") + opacity in percent -> "#AARRGGBB". */
function hexColor(value, opacity = 100) {
	let rgb
	if (typeof value === 'number') rgb = value
	else {
		const s = str(value)
		let m
		if ((m = /^#?([0-9a-f]{6})$/i.exec(s))) rgb = parseInt(m[1], 16)
		else if ((m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s))) rgb = (+m[1] << 16) | (+m[2] << 8) | +m[3]
		else if (/^\d+$/.test(s)) rgb = parseInt(s, 10)
		else throw new Error(`"${s}" is not a colour`)
	}
	const a = Math.round((Math.min(100, Math.max(0, num(opacity, 'Opacity (%)'))) / 100) * 255)
	return (
		'#' +
		[a, (rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255]
			.map((x) => x.toString(16).padStart(2, '0'))
			.join('')
			.toUpperCase()
	)
}

/** A colour or a gradient typed as text: names or #RRGGBB / #AARRGGBB separated by spaces. */
function colorList(text) {
	const parts = str(text)
		.split(/[\s,]+/)
		.filter(Boolean)
	if (!parts.length) throw new Error('No colour given')
	for (const p of parts) {
		if (!/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(p) && !COLOR_NAMES.includes(p.toUpperCase()))
			throw new Error(`"${p}" is not a colour the server knows: use #RRGGBB, #AARRGGBB or ${COLOR_NAMES.join(', ')}`)
	}
	return parts.map((p) => p.toUpperCase()).join(' ')
}

const SOURCES = ['color', 'html', 'route', 'stream', 'ndi', 'decklink']

/** The producer part of PLAY / LOADBG for a source that is not a media file. */
function sourceSpec(o) {
	switch (str(o.source)) {
		case 'color':
			return str(o.color_text) ? colorList(o.color_text) : hexColor(o.color, o.opacity ?? 100)
		case 'html': {
			const url = str(o.url)
			if (!url) throw new Error('Web page needs an address')
			return `[HTML] ${quote(url)}`
		}
		case 'route': {
			const ch = int(o.route_channel, 'Route: source channel', { min: 1 })
			const l = int(o.route_layer, 'Route: source layer', { optional: true })
			return `route://${l === null ? ch : `${ch}-${l}`}`
		}
		case 'stream': {
			const url = str(o.url)
			if (!/^[a-z][a-z0-9+.-]*:\/\/./i.test(url))
				throw new Error(`"${url}" is not a stream address (srt://, rtmp://, http://...)`)
			// quoted as it is: backslashes are not folder separators in a URL
			return '"' + url.replace(/"/g, '\\"') + '"'
		}
		case 'ndi': {
			const name = str(o.ndi_name) || str(o.ndi_dd)
			if (!name) throw new Error('NDI needs a source name (PC NAME/Source)')
			return '"' + ('ndi://' + name.replace(/^ndi:\/\//i, '')).replace(/"/g, '\\"') + '"'
		}
		case 'decklink': {
			const dev = int(o.device, 'DeckLink device', { min: 1 })
			return `DECKLINK ${dev}` + (str(o.format) ? ` FORMAT ${str(o.format)}` : '')
		}
		default:
			throw new Error(`Unknown source "${o.source}"`)
	}
}

function playSource(o) {
	const verb = str(o.verb).toUpperCase() || 'PLAY'
	if (!['PLAY', 'LOADBG'].includes(verb)) throw new Error(`Unknown command "${verb}"`)
	const spec = sourceSpec(o)
	const parts = [verb, address(o.channel, o.layer, { layerRequired: true }), spec]
	if (verb === 'LOADBG' && truthy(o.auto)) parts.push('AUTO')
	const t = transition({ ...o, transition: o.transition === 'STING' ? 'CUT' : o.transition }) || guardCut(spec)
	if (t) parts.push(t)
	return parts.join(' ')
}

/** Scrolling image (credits): PLAY <image> SPEED n | DURATION s. */
function scrollPlay(o) {
	const clip = str(o.clip) || str(o.clip_dd)
	if (!clip) throw new Error('Scroll needs an image')
	const parts = ['PLAY', address(o.channel, o.layer, { layerRequired: true }), quote(colourSafe(clip))]
	if (str(o.mode) === 'duration') {
		const d = num(o.value, 'Duration (s)')
		if (d <= 0) throw new Error('Duration must be more than 0 s')
		parts.push(`DURATION ${fmt(d)}`)
	} else {
		const s = num(o.value, 'Speed (px per frame)')
		if (s === 0) throw new Error('Speed 0 does not scroll - the image would be squeezed into the frame')
		parts.push(`SPEED ${fmt(s)}`)
	}
	const blur = int(o.blur, 'Motion blur (px)', { optional: true })
	if (blur) parts.push(`BLUR ${blur}`)
	if (truthy(o.premultiply)) parts.push('PREMULTIPLY')
	const t = transition({ ...o, transition: o.transition === 'STING' ? 'CUT' : o.transition }) || guardCut(clip)
	if (t) parts.push(t)
	return parts.join(' ')
}

function scrollSpeed(o) {
	const s = num(o.value, 'Speed (px per frame)')
	let out = `CALL ${address(o.channel, o.layer, { layerRequired: true })} SPEED ${fmt(s)}`
	const dur = int(o.duration, 'Duration (frames)', { optional: true, max: MAX_FRAMES }) ?? 0
	if (dur > 0) out += ` ${dur} ${tween(o.tween)}`
	return out
}

/** JavaScript on a web page layer, or a reload. */
function pageCall(o) {
	const addr = address(o.channel, o.layer, { layerRequired: true })
	if (truthy(o.reload)) return `CALL ${addr} RELOAD`
	const js = str(o.js).replace(/\s*\n\s*/g, ' ')
	if (!js) throw new Error('No JavaScript given')
	return `CALL ${addr} ${amcpString(js)}`
}

/**
 * Skip forward / back by seconds, turned into channel frames (CALL ... SEEK REL counts channel frames, 2.5.1).
 * Tested on 2.5.1: a skip before the start leaves the clip at a negative time and one past the end jumps to 0,
 * so with a known position (fg from polling) the skip is kept inside the clip.
 */
function seekRelative(o, framerate, fg) {
	const sec = num(o.seconds, 'Seconds')
	if (!framerate) throw new Error('the channel frame rate is not known yet (not connected / not polled)')
	const addr = address(o.channel, o.layer, { layerRequired: true })
	const frames = Math.round(sec * framerate)
	if (fg && fg.time !== null && fg.duration) {
		const target = fg.time + sec
		if (target <= 0) return `CALL ${addr} SEEK 0`
		if (target >= fg.duration) return `CALL ${addr} SEEK END -1`
	}
	return `CALL ${addr} SEEK REL ${frames}`
}

// ------------------------------------------------------------------ outputs (consumers)

// tested on 2.5.1 (ffmpeg consumer): only the -name:stream form of options is taken
const RECORD_PRESETS = {
	h264: {
		ext: 'mp4',
		args: '-codec:v libx264 -preset:v veryfast -crf:v 18 -filter:v format=yuv420p -codec:a aac -b:a 192k',
	},
	prores: { ext: 'mov', args: '-codec:v prores_ks -profile:v 2 -filter:v format=yuv422p10le -codec:a pcm_s16le' },
}
const STREAM_PRESETS = {
	srt: '-format mpegts -codec:v libx264 -preset:v veryfast -tune:v zerolatency -b:v 8000k -maxrate:v 8000k -bufsize:v 8000k -g:v 50 -filter:v format=yuv420p -codec:a aac -b:a 192k',
	rtmp: '-format flv -codec:v libx264 -preset:v veryfast -tune:v zerolatency -b:v 6000k -maxrate:v 6000k -bufsize:v 12000k -g:v 50 -filter:v format=yuv420p -codec:a aac -b:a 160k',
}

/** {date} {time} {datetime} in a file name, from the given Date (local time). */
function fillDate(s, now = new Date()) {
	const p = (n) => String(n).padStart(2, '0')
	const date = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`
	const time = `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
	return s
		.replace(/\{date\}/g, date)
		.replace(/\{time\}/g, time)
		.replace(/\{datetime\}/g, `${date}_${time}`)
}

function outputIndex(o) {
	return `${int(o.channel, 'Channel', { min: 1 })}-${int(o.index, 'Output number', { min: 1 })}`
}

function outputAdd(o, now) {
	const at = outputIndex(o)
	const kind = str(o.kind)
	const extra = str(o.args)
	if (kind === 'file') {
		const preset = RECORD_PRESETS[str(o.preset)]
		let path = fillDate(str(o.path), now).replace(/\\/g, '/')
		if (!path) throw new Error('Recording needs a file name')
		if (preset && !/\.[a-z0-9]{2,4}$/i.test(path)) path += '.' + preset.ext
		const args = str(o.preset) === 'custom' ? extra : [preset?.args, extra].filter(Boolean).join(' ')
		return `ADD ${at} FILE ${quote(path)}${args ? ' ' + args : ''}`
	}
	if (kind === 'stream') {
		const url = str(o.url)
		if (!/^[a-z][a-z0-9+.-]*:\/\/./i.test(url)) throw new Error(`"${url}" is not a stream address (srt://, rtmp://...)`)
		const preset = STREAM_PRESETS[str(o.stream_preset)]
		const args = str(o.stream_preset) === 'custom' ? extra : [preset, extra].filter(Boolean).join(' ')
		return `ADD ${at} STREAM ${'"' + url.replace(/"/g, '\\"') + '"'}${args ? ' ' + args : ''}`
	}
	if (kind === 'ndi') {
		const name = str(o.ndi_name)
		if (!name) throw new Error('NDI output needs a name')
		// the NDI library drops them: "Mównica" is announced as "Mwnica" (tested on 2.5.1 with NDI 6.3)
		const bad = [...new Set(name.match(/[^\x20-\x7e]/g) || [])]
		if (bad.length)
			throw new Error(`NDI name "${name}": ${bad.join(' ')} would be dropped by NDI - use letters without accents`)
		return `ADD ${at} NDI NAME ${quote(name)}`
	}
	throw new Error(`Unknown output "${kind}"`)
}

function outputRemove(o) {
	return `REMOVE ${outputIndex(o)}`
}

/**
 * Picture of the channel as PNG in the media folder. On 2.5.1 a snapshot holds the picture of the previous one,
 * so it is taken twice; the second one (500 ms later) overwrites the file with the current picture.
 */
function snapshot(o, now) {
	const ch = int(o.channel, 'Channel', { min: 1 })
	const name = fillDate(str(o.name) || 'snapshot_{datetime}', now)
		.replace(/\\/g, '/')
		.replace(/\.png$/i, '')
	const cmd = `ADD ${ch} IMAGE ${quote(name)}`
	return [{ cmd }, { cmd, after: 500, key: `snapshot-${ch}` }]
}

module.exports = {
	TWEENS,
	TRANSITIONS,
	DIRECTIONS,
	MIXER_PROPS,
	MIXER_RANGES,
	MAX_FRAMES,
	CALL_PARAMS,
	str,
	truthy,
	int,
	address,
	quote,
	tween,
	transition,
	playLike,
	simple,
	callParam,
	mixerProp,
	mixerFill,
	masterVolume,
	parsePairs,
	templateData,
	dataParam,
	objectCall,
	cg,
	swap,
	GEOMETRY,
	BLEND_MODES,
	COLOR_NAMES,
	SOURCES,
	RECORD_PRESETS,
	STREAM_PRESETS,
	mixerGeometry,
	mixerBlend,
	mixerKeyer,
	hexColor,
	colorList,
	sourceSpec,
	playSource,
	scrollPlay,
	scrollSpeed,
	pageCall,
	seekRelative,
	fillDate,
	outputAdd,
	outputRemove,
	snapshot,
}
