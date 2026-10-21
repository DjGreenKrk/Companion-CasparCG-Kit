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

const str = (v) => (v === undefined || v === null ? '' : String(v).trim())
const truthy = (v) => v === true || v === 'true' || v === 1 || v === '1'

function int(v, what, { min = 0, optional = false } = {}) {
	const s = str(v)
	if (s === '') {
		if (optional) return null
		throw new Error(`${what} is empty`)
	}
	if (!/^-?\d+$/.test(s)) throw new Error(`${what} must be a whole number, got "${s}"`)
	const n = parseInt(s, 10)
	if (n < min) throw new Error(`${what} must be at least ${min}, got ${n}`)
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
	const dur = int(o.transition_duration, 'Transition duration (frames)', { optional: true }) ?? 0
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
	if (clip) parts.push(quote(clip))
	else if (verb !== 'PLAY') throw new Error(`${verb} needs a clip`)
	if (truthy(o.loop)) parts.push('LOOP')
	const seek = int(o.seek, 'Seek (frames)', { optional: true })
	if (seek) parts.push(`SEEK ${seek}`)
	const length = int(o.length, 'Length (frames)', { optional: true })
	if (length) parts.push(`LENGTH ${length}`)
	if (verb === 'LOADBG' && truthy(o.auto)) parts.push('AUTO')
	if (clip) {
		const t = transition(o)
		if (t) parts.push(t)
	}
	const lines = []
	if (truthy(o.clear_mixer)) lines.push(`MIXER ${address(o.channel, o.layer, { layerRequired: true })} CLEAR`)
	lines.push(parts.join(' '))
	return lines
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
	const dur = int(o.duration, 'Duration (frames)', { optional: true }) ?? 0
	if (dur > 0) out += ` ${dur} ${tween(o.tween)}`
	if (truthy(o.defer)) out += ' DEFER'
	return out
}

function mixerProp(o) {
	const prop = str(o.property).toUpperCase()
	if (!MIXER_PROPS.includes(prop)) throw new Error(`Unknown mixer property "${prop}"`)
	const v = num(o.value, `${prop} (%)`) / 100
	// MIXER 1 VOLUME without a layer only touches layer 0, so a layer is required
	return `MIXER ${address(o.channel, o.layer, { layerRequired: true })} ${prop} ${fmt(v)}${mixerTail(o)}`
}

function mixerFill(o) {
	const v = ['x', 'y', 'sx', 'sy'].map((k) => fmt(num(o[k], `Fill ${k} (%)`) / 100))
	return `MIXER ${address(o.channel, o.layer, { layerRequired: true })} FILL ${v.join(' ')}${mixerTail(o)}`
}

function masterVolume(o) {
	const v = num(o.value, 'Master volume (%)') / 100
	return `MIXER ${int(o.channel, 'Channel', { min: 1 })} MASTERVOLUME ${fmt(v)}${mixerTail(o)}`
}

/** Template data: either raw (JSON/XML as typed) or f0="John" f1="Doe" pairs (as in module 2.x). */
function templateData(o) {
	const raw = str(o.variables)
	if (!raw) return null
	if (str(o.data_format) === 'raw') return raw
	const data = {}
	const re = /([^=\s,]+?)="([^"]*)"[ ,]*/g
	let m
	while ((m = re.exec(raw)) !== null) data[m[1]] = m[2]
	if (!Object.keys(data).length) throw new Error(`Template variables "${raw}" are not in the form f0="text" f1="text"`)
	if (truthy(o.json)) return JSON.stringify(data)
	const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
	let xml = '<templateData>'
	for (const k of Object.keys(data)) {
		xml += `<componentData id="${esc(k)}"><data id="text" value="${esc(data[k])}" /></componentData>`
	}
	return xml + '</templateData>'
}

const dataParam = (d) => '"' + d.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'

function cg(sub, o) {
	const addr = address(o.channel, o.layer, { layerRequired: true })
	const hostLayer = int(o.templatelayer, 'Template host layer', { optional: true }) ?? 1
	switch (sub) {
		case 'ADD': {
			const t = str(o.template) || str(o.template_dd)
			if (!t) throw new Error('CG ADD needs a template')
			const d = templateData(o)
			let out = `CG ${addr} ADD ${hostLayer} ${quote(t)} ${truthy(o.playonload) ? 1 : 0}`
			if (d) out += ' ' + dataParam(d)
			return out
		}
		case 'UPDATE': {
			const d = templateData(o)
			if (!d) throw new Error('CG UPDATE needs data')
			return `CG ${addr} UPDATE ${hostLayer} ${dataParam(d)}`
		}
		case 'INVOKE': {
			const m = str(o.method)
			if (!m) throw new Error('CG INVOKE needs a method name')
			return `CG ${addr} INVOKE ${hostLayer} ${quote(m)}`
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

module.exports = {
	TWEENS,
	TRANSITIONS,
	DIRECTIONS,
	MIXER_PROPS,
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
	templateData,
	cg,
	swap,
}
