// Variable definitions and values derived from the polled state.

const LAYER_VARS = [
	['clip', 'clip / template on air'],
	['state', 'state (playing / paused / ended / empty)'],
	['time', 'elapsed (mm:ss)'],
	['remaining', 'remaining (mm:ss)'],
	['remaining_s', 'remaining (whole seconds)'],
	['duration', 'duration (mm:ss)'],
	['progress', 'progress (%)'],
	['loop', 'looping (yes / no)'],
	['bg', 'cued in background'],
]

/** Seconds as m:ss / h:mm:ss. Countdowns round up (00:01 until the end), elapsed time rounds down. */
function mmss(sec, { up = true } = {}) {
	if (sec === null || sec === undefined || isNaN(sec)) return ''
	const s = Math.max(0, up ? Math.ceil(sec - 1e-6) : Math.floor(sec + 1e-6))
	const h = Math.floor(s / 3600)
	const m = Math.floor((s % 3600) / 60)
	const r = String(s % 60).padStart(2, '0')
	return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${String(m).padStart(2, '0')}:${r}`
}

const OUTPUT_VARS = [
	['active', 'active (yes / no)'],
	['time', 'running for (mm:ss)'],
	['path', 'file / address'],
]

function definitions(channels, layerKeys, outputKeys = []) {
	const defs = [
		{ variableId: 'server_version', name: 'Server version' },
		{ variableId: 'connected', name: 'Connected (yes / no)' },
		{ variableId: 'last_error', name: 'Last failed command and reply' },
		{ variableId: 'media_count', name: 'Number of media files on the server' },
	]
	for (const c of channels) {
		defs.push({ variableId: `c${c.channel}_format`, name: `Channel ${c.channel}: video format` })
	}
	for (const key of layerKeys) {
		const [c, l] = key.split('-')
		for (const [id, label] of LAYER_VARS) {
			defs.push({ variableId: `c${c}_l${l}_${id}`, name: `Channel ${c} layer ${l}: ${label}` })
		}
	}
	for (const key of outputKeys) {
		const [c, n] = key.split('-')
		for (const [id, label] of OUTPUT_VARS) {
			defs.push({ variableId: `c${c}_o${n}_${id}`, name: `Channel ${c} output ${n}: ${label}` })
		}
	}
	return defs
}

/** Variables of one output (consumer) added with an index, e.g. a recording on 1-700. */
function outputValues(key, out) {
	const [c, n] = key.split('-')
	const p = `c${c}_o${n}_`
	return {
		[p + 'active']: out ? 'yes' : 'no',
		[p + 'time']: out?.seconds !== null && out?.seconds !== undefined ? mmss(out.seconds, { up: false }) : '',
		[p + 'path']: out?.path ?? '',
	}
}

function layerValues(key, layer, state) {
	const [c, l] = key.split('-')
	const fg = layer?.fg
	const p = `c${c}_l${l}_`
	const hasTime = fg && fg.duration !== null && fg.time !== null
	const remaining = hasTime ? fg.duration - fg.time : null
	return {
		[p + 'clip']: fg?.name ?? '',
		[p + 'state']: state,
		[p + 'time']: hasTime ? mmss(fg.time, { up: false }) : '',
		[p + 'remaining']: hasTime ? mmss(remaining) : '',
		[p + 'remaining_s']: hasTime ? Math.max(0, Math.ceil(remaining - 1e-6)) : '',
		[p + 'duration']: hasTime ? mmss(fg.duration) : '',
		[p + 'progress']: hasTime && fg.duration > 0 ? Math.min(100, Math.round((fg.time / fg.duration) * 100)) : '',
		[p + 'loop']: fg ? (fg.loop ? 'yes' : 'no') : '',
		[p + 'bg']: layer?.bg?.name ?? '',
	}
}

module.exports = { definitions, layerValues, outputValues, mmss, LAYER_VARS, OUTPUT_VARS }
