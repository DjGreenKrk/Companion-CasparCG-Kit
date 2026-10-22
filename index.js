const { InstanceBase, runEntrypoint, TCPHelper, InstanceStatus, Regex } = require('@companion-module/base')
const { AmcpClient } = require('./src/amcp')
const B = require('./src/build')
const S = require('./src/state')
const V = require('./src/variables')
const actionDefinitions = require('./src/actions')
const feedbackDefinitions = require('./src/feedbacks')
const presetDefinitions = require('./src/presets')
const upgradeScripts = require('./src/upgrades')

const CONFIG_DEFAULTS = {
	port: '5250',
	poll_interval: 250,
	watch_layers: '1-10',
	preset_channel: 1,
	preset_layer: 10,
	preset_cg_layer: 20,
	log_commands: false,
}

// output numbers used by the record / stream presets
const PRESET_OUTPUTS = [700, 701]

const HINTS = {
	400: 'the server did not understand the command - check the spelling',
	401: 'that channel does not exist',
	402: 'a parameter is missing',
	403: 'a parameter is invalid (e.g. a tween name)',
	404: 'clip / template not found - check the name (action: Refresh media and template lists)',
	501: 'the server failed to run it (e.g. a non-numeric value)',
	502: 'the file cannot be read',
	503: 'the channel is locked (LOCK)',
}

class CasparInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.media = []
		this.templates = []
		this.channels = []
		this.mediaChoices = []
		this.templateChoices = []
		this.state = {} // channel -> { format, framerate, layers }
		this.paths = null
		this.knownLayers = new Set()
		this.knownOutputs = new Set()
		this.outputProgress = new Map() // "ch-n" -> { frames, changedAt }
		this.values = {}
		this.lastErrorAt = 0
		this.chain = Promise.resolve()
		this.pendingClears = new Map()
		this.polling = new Set()
	}

	async init(config) {
		this.config = { ...CONFIG_DEFAULTS, ...stripEmpty(config) }
		this.updateDefinitions()
		this.connect()
	}

	async configUpdated(config) {
		this.config = { ...CONFIG_DEFAULTS, ...stripEmpty(config) }
		this.knownLayers = new Set()
		this.knownOutputs = new Set()
		this.updateDefinitions()
		this.connect()
	}

	async destroy() {
		this.stopPolling()
		clearInterval(this.errorTimer)
		for (const key of [...this.pendingClears.keys()]) this.cancelClear(key)
		if (this.socket) this.socket.destroy()
		delete this.socket
	}

	getConfigFields() {
		return [
			{ type: 'textinput', id: 'host', label: 'CasparCG server IP', width: 6, default: '', regex: Regex.HOSTNAME },
			{ type: 'textinput', id: 'port', label: 'AMCP port', width: 3, default: '5250', regex: Regex.PORT },
			{
				type: 'number',
				id: 'poll_interval',
				label: 'State polling interval (ms, 0 = off)',
				tooltip: 'Feedbacks and variables come from INFO <channel>. 250 ms is light for the server.',
				width: 4,
				default: 250,
				min: 0,
				max: 10000,
			},
			{
				type: 'textinput',
				id: 'watch_layers',
				label: 'Layers that always get variables',
				tooltip: 'e.g. 1-10, 1-20, 2-10. Other layers get variables once something plays on them.',
				width: 8,
				default: '1-10',
			},
			{
				type: 'static-text',
				id: 'presets_info',
				label: 'Presets',
				value: 'Presets are generated for this channel and these layers:',
				width: 12,
			},
			{ type: 'number', id: 'preset_channel', label: 'Preset channel', width: 4, default: 1, min: 1, max: 99 },
			{ type: 'number', id: 'preset_layer', label: 'Preset clip layer', width: 4, default: 10, min: 0, max: 9999 },
			{
				type: 'number',
				id: 'preset_cg_layer',
				label: 'Preset template layer',
				width: 4,
				default: 20,
				min: 0,
				max: 9999,
			},
			{ type: 'checkbox', id: 'log_commands', label: 'Log every command and reply (debug)', width: 6, default: false },
		]
	}

	// ---------------------------------------------------------------- connection

	connect() {
		this.stopPolling()
		if (this.socket) {
			this.socket.destroy()
			delete this.socket
		}
		if (this.amcp) this.amcp.reset()
		this.state = {}
		if (!this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, 'No server address')
			return
		}
		this.updateStatus(InstanceStatus.Connecting)
		const socket = new TCPHelper(this.config.host, Number(this.config.port) || 5250, { reconnect_interval: 2000 })
		this.socket = socket
		this.amcp = new AmcpClient((d) => socket.send(d))
		this.amcp.on('unsolicited', (r) => this.log('debug', `Unmatched reply: ${r.code} ${r.status}`))
		this.amcp.on('garbage', (l) => this.log('debug', `Unexpected line: ${l.slice(0, 200)}`))

		socket.on('status_change', (status, message) => {
			this.updateStatus(status, message)
			if (status !== InstanceStatus.Ok) this.onDisconnect()
		})
		socket.on('error', (err) => this.log('error', 'Network error: ' + err.message))
		socket.on('data', (chunk) => this.amcp.data(chunk))
		socket.on('connect', () => this.onConnect().catch((e) => this.log('error', `Init failed: ${e.message}`)))
	}

	isConnected() {
		return !!this.socket?.isConnected
	}

	async onConnect() {
		this.log('info', `Connected to ${this.config.host}`)
		this.setVariableValues({ connected: 'yes' })
		this.checkFeedbacks('connected')
		const ver = await this.amcp.send('VERSION')
		if (ver.ok) this.setVariableValues({ server_version: ver.data[0]?.split(' ')[0] ?? '' })
		const paths = await this.amcp.send('INFO PATHS')
		if (paths.ok && paths.data[0]) this.paths = await S.parsePaths(paths.data[0]).catch(() => null)
		const info = await this.amcp.send('INFO')
		if (info.ok) this.channels = S.parseChannelList(info.data)
		await this.refreshLists()
		this.startPolling()
	}

	onDisconnect() {
		if (!this.amcp) return
		this.stopPolling()
		this.amcp.reset()
		this.state = {}
		this.setVariableValues({ connected: 'no' })
		this.publishState()
		this.checkFeedbacks('connected')
	}

	async refreshLists() {
		if (!this.isConnected()) return
		const [cls, tls] = await Promise.all([
			this.amcp.send('CLS', { timeout: 15000 }),
			this.amcp.send('TLS', { timeout: 15000 }),
		])
		if (cls.ok) this.media = S.parseCls(cls.data)
		else this.log('warn', `CLS failed (${cls.code ?? ''} ${cls.text}) - is the media scanner running?`)
		if (tls.ok) this.templates = S.parseTls(tls.data)
		this.mediaChoices = this.media.map((m) => ({
			id: m.name,
			label: m.type === 'MOVIE' && m.fps ? `${m.name}  (${V.mmss(m.frames / m.fps)})` : m.name,
		}))
		this.templateChoices = this.templates.map((t) => ({ id: t, label: t }))
		this.setVariableValues({ media_count: this.media.length })
		this.updateDefinitions()
	}

	// ---------------------------------------------------------------- state polling

	startPolling() {
		this.stopPolling()
		const ms = Number(this.config.poll_interval)
		if (!ms) return
		this.log('info', `Polling ${this.channels.length} channel(s) every ${Math.max(50, ms)} ms`)
		this.pollTimer = setInterval(() => this.poll(), Math.max(50, ms))
		this.poll()
	}

	stopPolling() {
		if (this.pollTimer) clearInterval(this.pollTimer)
		delete this.pollTimer
		this.polling.clear()
	}

	poll() {
		for (const { channel } of this.channels) {
			if (this.polling.has(channel)) continue // previous answer still pending
			this.polling.add(channel)
			this.amcp
				.send(`INFO ${channel}`, { timeout: 3000 })
				.then(async (r) => {
					if (r.ok && r.data[0]) {
						this.state[channel] = await S.parseChannelInfo(r.data[0], this.paths)
						this.trackOutputs(channel)
					} else if (!r.noReply) {
						this.state[channel] = { format: '', framerate: 0, layers: {} }
					}
					this.publishState()
				})
				.catch((e) => this.log('warn', `INFO ${channel}: ${e.message}`))
				.finally(() => this.polling.delete(channel))
		}
	}

	layerAt(channel, layer) {
		return this.state[parseInt(channel, 10)]?.layers?.[parseInt(layer, 10)]
	}

	outputAt(channel, index) {
		return this.state[parseInt(channel, 10)]?.outputs?.[parseInt(index, 10)]
	}

	/** Remember when each output's frame counter last moved (see outputRunning). */
	trackOutputs(channel) {
		const now = Date.now()
		for (const [n, out] of Object.entries(this.state[channel]?.outputs || {})) {
			const key = `${channel}-${n}`
			const p = this.outputProgress.get(key)
			if (!p || p.frames !== out.frames) this.outputProgress.set(key, { frames: out.frames, changedAt: now })
		}
	}

	/**
	 * Tested on 2.5.1: a stream output stays in INFO after REMOVE with its frame counter frozen, and one that never
	 * connected has no counter. So an output runs only while its counter moves.
	 */
	outputRunning(channel, index) {
		const out = this.outputAt(channel, index)
		if (!S.outputRunning(out)) return false
		const p = this.outputProgress.get(`${parseInt(channel, 10)}-${parseInt(index, 10)}`)
		const ms = Math.max(1500, 4 * (Number(this.config.poll_interval) || 250))
		return !!p && Date.now() - p.changedAt < ms
	}

	framerateOf(channel) {
		return this.state[parseInt(channel, 10)]?.framerate || 0
	}

	stateOf(layer, framerate) {
		return S.layerState(layer, framerate)
	}

	publishState() {
		const keys = new Set(this.knownLayers)
		for (const k of String(this.config.watch_layers || '').split(/[\s,;]+/)) {
			if (/^\d+-\d+$/.test(k)) keys.add(k)
		}
		for (const [c, st] of Object.entries(this.state)) for (const l of Object.keys(st.layers)) keys.add(`${c}-${l}`)
		// outputs added with a number (recording on 1-700) keep their variables once seen
		const outKeys = new Set(this.knownOutputs)
		const pc = this.config.preset_channel || 1
		for (const n of PRESET_OUTPUTS) outKeys.add(`${pc}-${n}`) // the record / stream presets show their time
		for (const [c, st] of Object.entries(this.state))
			for (const n of Object.keys(st.outputs || {})) outKeys.add(`${c}-${n}`)
		const sig =
			[...keys].sort().join() + '|' + [...outKeys].sort().join() + '|' + this.channels.map((c) => c.channel).join()
		if (sig !== this.varSig) {
			this.varSig = sig
			this.knownLayers = keys
			this.knownOutputs = outKeys
			this.setVariableDefinitions(
				V.definitions(this.channels, [...keys].sort(sortLayers), [...outKeys].sort(sortLayers)),
			)
			this.values = {}
		}
		const values = {}
		for (const c of this.channels) values[`c${c.channel}_format`] = this.state[c.channel]?.format || c.format
		for (const key of keys) {
			const [c, l] = key.split('-')
			const layer = this.state[c]?.layers?.[l]
			Object.assign(values, V.layerValues(key, layer, S.layerState(layer, this.framerateOf(c))))
		}
		for (const key of outKeys) {
			const [c, n] = key.split('-')
			Object.assign(values, V.outputValues(key, this.outputAt(c, n), this.outputRunning(c, n)))
		}
		const changed = {}
		for (const [k, v] of Object.entries(values)) {
			if (this.values[k] !== v) changed[k] = this.values[k] = v
		}
		if (Object.keys(changed).length) {
			this.setVariableValues(changed)
			this.checkFeedbacks('layer_clip', 'layer_state', 'time_remaining', 'output_active')
		}
	}

	// ---------------------------------------------------------------- actions

	updateDefinitions() {
		this.actionDefs = actionDefinitions(this)
		this.setActionDefinitions(this.actionDefs)
		this.setFeedbackDefinitions(feedbackDefinitions(this))
		this.setPresetDefinitions(presetDefinitions(this))
		this.varSig = null
		this.publishState()
	}

	/** Replace $(...) variables, including local button variables, via the action/feedback context. */
	async resolve(value, context) {
		if (typeof value !== 'string' || !value.includes('$(')) return value
		return context ? context.parseVariablesInString(value) : this.parseVariablesInString(value)
	}

	async resolveOptions(options, context) {
		const out = {}
		for (const [k, v] of Object.entries(options || {})) out[k] = await this.resolve(v, context)
		return out
	}

	/**
	 * Run an action. Actions are processed strictly in the order Companion calls them (variable lookups are
	 * asynchronous, so without the chain a later action without variables could overtake an earlier one).
	 * Commands are written at once; replies are checked afterwards without holding up the next action.
	 */
	runOrdered(action, context, build) {
		const step = this.chain.then(async () => {
			let lines
			try {
				const o = await this.resolveOptions(action.options, context)
				lines = build(o)
			} catch (e) {
				this.commandError(`${action.actionId}: ${e.message}`)
				return
			}
			lines = (Array.isArray(lines) ? lines : [lines])
				.filter(Boolean)
				.map((l) => (typeof l === 'string' ? { cmd: l } : l))
			if (!this.isConnected()) {
				this.commandError(`Not connected - not sent: ${lines.map((l) => l.cmd).join(' | ')}`)
				return
			}
			for (let i = 0; i < lines.length; i++) {
				const l = lines[i]
				if (l.cancelClear) this.cancelClear(l.cancelClear)
				if (l.after !== undefined) {
					this.scheduleClear(l.key, l.after, l.cmd)
					continue
				}
				const send = l.retry403 ? this.sendUntilReady(l.cmd) : this.amcp.send(l.cmd)
				const check = send.then((r) => this.checkReply(r))
				// a line that prepares the next one (MIXER CLEAR before PLAY) must be done first
				if (i < lines.length - 1) await check
			}
		})
		this.chain = step.catch(() => {})
		return step
	}

	/** CG calls on a page that is still loading get 403; repeat until it answers (at most 3 s). */
	async sendUntilReady(cmd, limitMs = 3000) {
		const t0 = Date.now()
		await new Promise((res) => setTimeout(res, 60)) // a fresh page needs ~60 ms (measured on 2.5.1)
		for (;;) {
			const r = await this.amcp.send(cmd)
			if (r.code !== 403 || Date.now() - t0 > limitMs || !this.isConnected()) return r
			await new Promise((res) => setTimeout(res, 25))
		}
	}

	/** A delayed command (CLEAR after an out-animation), cancelled when the layer is used again before it fires. */
	scheduleClear(key, ms, cmd) {
		this.cancelClear(key)
		this.pendingClears.set(
			key,
			setTimeout(() => {
				this.pendingClears.delete(key)
				if (this.isConnected()) this.amcp.send(cmd).then((r) => this.checkReply(r))
			}, ms),
		)
	}

	cancelClear(key) {
		clearTimeout(this.pendingClears.get(key))
		this.pendingClears.delete(key)
	}

	checkReply(r) {
		if (this.config.log_commands) {
			const res = r.noReply ? r.text : `${r.code} ${r.status}`
			this.log('debug', `${r.cmd} -> ${res}${r.ms !== undefined ? ` (${r.ms} ms)` : ''}`)
		}
		if (r.noReply) {
			if (r.text !== 'No reply') this.commandError(`${r.cmd}: ${r.text}`)
			return r
		}
		if (!r.ok) {
			const hint = HINTS[r.code] ? ` - ${HINTS[r.code]}` : ''
			this.commandError(`${r.cmd} -> ${r.code} ${r.status}${hint}`)
		}
		return r
	}

	commandError(msg) {
		this.log('warn', msg)
		this.lastErrorAt = Date.now()
		this.setVariableValues({ last_error: msg })
		this.checkFeedbacks('command_failed')
		// keep re-checking while the "failed recently" feedback may switch off again
		clearInterval(this.errorTimer)
		let n = 0
		this.errorTimer = setInterval(() => {
			this.checkFeedbacks('command_failed')
			if (++n >= 60) clearInterval(this.errorTimer)
		}, 1000)
	}

	async runGoto(action, context) {
		const o = await this.resolveOptions(action.options, context)
		let addr
		try {
			addr = B.address(o.channel, o.layer, { layerRequired: true })
		} catch (e) {
			return this.commandError(`GOTO: ${e.message}`)
		}
		const sec = parseFloat(String(o.offset).replace(',', '.'))
		if (isNaN(sec)) return this.commandError(`GOTO: "${o.offset}" is not a number of seconds`)
		if (!this.isConnected()) return this.commandError(`GOTO: not connected`)
		const r = await this.amcp.send(`INFO ${parseInt(o.channel, 10)}`)
		if (!r.ok) return this.checkReply(r)
		const st = await S.parseChannelInfo(r.data[0], this.paths)
		const fg = st.layers[parseInt(o.layer, 10)]?.fg
		if (!fg || !st.framerate) return this.commandError(`GOTO: nothing is playing on ${addr}`)
		// negative SEEK overflows on 2.5.1, so "from the end" is turned into an absolute frame here
		const target = Math.max(0, sec >= 0 ? sec : (fg.duration ?? 0) + sec)
		this.checkReply(await this.amcp.send(`CALL ${addr} SEEK ${Math.round(target * st.framerate)}`))
	}
}

/** Connections made with module 2.x have no value for the newer fields. */
function stripEmpty(config) {
	return Object.fromEntries(Object.entries(config || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''))
}

function sortLayers(a, b) {
	const [ac, al] = a.split('-').map(Number)
	const [bc, bl] = b.split('-').map(Number)
	return ac - bc || al - bl
}

runEntrypoint(CasparInstance, upgradeScripts)
