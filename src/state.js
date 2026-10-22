// Channel / layer state from `INFO <channel>` (CasparCG 2.2+ XML, verified on 2.5.1).
const { parseStringPromise } = require('xml2js')

const arr = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])
const first = (v) => arr(v)[0]

/** Name the way CLS/TLS show it: relative to the media/template folder, no extension, upper case. */
function nameFromPath(path, paths) {
	if (!path) return ''
	if (/^data:/i.test(path)) {
		// custom HTML graphic loaded from the command (see html.js): data:text/html;...;gfx=<name>;base64,...
		const m = /^data:[^,]*?;gfx=([^;,]+)/i.exec(path)
		return m ? `HTML:${m[1].toUpperCase()}` : 'HTML'
	}
	let p = String(path).replace(/\\/g, '/')
	const isUrl = /^[a-z]+:\/\//i.test(p) && !/^file:\/\//i.test(p)
	if (isUrl) return p
	p = p.replace(/^file:\/\//i, '')
	for (const base of [paths?.media, paths?.template]) {
		if (base && p.toLowerCase().startsWith(base.toLowerCase())) {
			p = p.slice(base.length)
			break
		}
	}
	return p
		.replace(/^\/+/, '')
		.replace(/\.[^./]+$/, '')
		.toUpperCase()
}

/** Normalise a user-typed clip name for comparison with layer state. */
function normName(n) {
	return String(n ?? '')
		.trim()
		.replace(/^"|"$/g, '')
		.replace(/\\/g, '/')
		.toUpperCase()
}

function producerInfo(node, paths) {
	if (!node) return null
	const producer = first(node.producer)
	if (!producer || producer === 'empty') return null
	const file = first(node.file) || {}
	let name = first(file.name)
	const path = first(file.path)
	name = name ? normName(name) : nameFromPath(path, paths)
	const time = arr(file.time).map(Number)
	const clip = arr(file.clip).map(Number)
	const info = {
		producer,
		name,
		path: path || '',
		paused: first(node.paused) === 'true',
		loop: first(node.loop) === 'true',
		time: time.length ? time[0] : null,
		duration: time.length > 1 ? time[1] : null,
		clipIn: clip.length ? clip[0] : null,
		clipOut: clip.length > 1 ? clip[1] : null,
	}
	if (producer === 'transition') {
		const tr = first(node.transition) || {}
		info.transition = first(tr.type) || ''
		info.producer = first(tr.producer) || 'transition'
	}
	return info
}

/**
 * Parse `INFO <ch>` XML into { framerate, layers: { [layer]: { fg, bg } } }.
 * fg/bg are null when empty. A layer is listed only while something is loaded on it.
 */
async function parseChannelInfo(xml, paths) {
	const doc = await parseStringPromise(xml, { explicitArray: false })
	const ch = doc?.channel
	if (!ch) throw new Error('INFO reply is not a <channel> document')
	const fr = arr(ch.framerate).map(Number)
	const framerate = fr.length > 1 && fr[1] ? fr[0] / fr[1] : fr[0] || 0
	const layers = {}
	const stageLayers = first(ch.stage)?.layer
	const container = first(stageLayers) || {}
	for (const [key, node] of Object.entries(container)) {
		const m = /^layer_(\d+)$/.exec(key)
		if (!m) continue
		const l = first(node)
		const fg = producerInfo(first(l.foreground), paths)
		const bg = producerInfo(first(l.background), paths)
		if (fg || bg) layers[m[1]] = { fg, bg }
	}
	return { format: first(ch.format) || '', framerate, layers, outputs: parseOutputs(ch) }
}

/** <output><port><port_701><consumer>ffmpeg</consumer><file><frame>72</frame><path>...</path> -> { 701: {...} } */
function parseOutputs(ch) {
	const outputs = {}
	const ports = first(first(ch.output)?.port) || {}
	for (const [key, node] of Object.entries(ports)) {
		const m = /^port_(\d+)$/.exec(key)
		if (!m) continue
		const n = first(node) || {}
		const file = first(n.file) || {}
		const fps = Number(first(file.fps)) || 0
		const frame = Number(first(file.frame))
		outputs[m[1]] = {
			consumer: first(n.consumer) || '',
			path: first(file.path) || '',
			frames: isNaN(frame) ? null : frame,
			seconds: fps && !isNaN(frame) ? frame / fps : null,
		}
	}
	return outputs
}

function parsePaths(xml) {
	return parseStringPromise(xml, { explicitArray: false }).then((doc) => {
		const p = doc?.paths || {}
		const slash = (s) => (s ? String(s).replace(/\\/g, '/').replace(/\/?$/, '/') : '')
		return { media: slash(p['media-path']), template: slash(p['template-path']) }
	})
}

/** Layer state keyword used by feedbacks and variables. */
function layerState(layer, framerate) {
	const fg = layer?.fg
	if (!fg) return 'empty'
	if (fg.paused) return 'paused'
	if (!fg.loop && fg.duration && fg.time !== null && framerate) {
		if (fg.time >= fg.duration - 1.5 / framerate) return 'ended'
	}
	return 'playing'
}

/** CLS line: "NAME"  TYPE  bytes  date  frames  timebase */
function parseCls(lines) {
	const out = []
	for (const l of lines) {
		const m = /^"(.*)"\s+(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\/(\d+)/.exec(l)
		if (m) {
			const [num, den] = [Number(m[6]), Number(m[7])]
			out.push({ name: m[1], type: m[2], frames: Number(m[5]), fps: num ? den / num : 0 })
		} else {
			const q = /^"(.*)"/.exec(l)
			if (q) out.push({ name: q[1], type: '', frames: 0, fps: 0 })
		}
	}
	return out
}

function parseTls(lines) {
	return lines
		.map((l) => {
			const m = /^"(.*?)"/.exec(l)
			return (m ? m[1] : l.trim()).replace(/\\/g, '/')
		})
		.filter(Boolean)
}

/** `INFO` without arguments: "1 1080p5000 PLAYING" lines. */
function parseChannelList(lines) {
	const out = []
	for (const l of lines) {
		const m = /^(\d+)\s+(\S+)/.exec(l)
		if (m) out.push({ channel: Number(m[1]), format: m[2] })
	}
	return out
}

/**
 * An output counts as running only while it reports a frame counter: on 2.5.1 a stream that never connected
 * (SRT listener nobody joined, caller with no listener) stays listed after REMOVE, without <frame> (tested).
 */
function outputRunning(out) {
	return !!out && out.frames !== null
}

module.exports = {
	outputRunning,
	parseChannelInfo,
	parsePaths,
	layerState,
	parseCls,
	parseTls,
	parseChannelList,
	nameFromPath,
	normName,
}
