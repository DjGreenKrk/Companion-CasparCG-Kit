const { combineRgb } = require('@companion-module/base')
const F = require('./options')
const { normName } = require('./state')

const RED = combineRgb(200, 0, 0)
const GREEN = combineRgb(0, 150, 0)
const AMBER = combineRgb(220, 140, 0)
const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)

module.exports = function feedbackDefinitions(self) {
	const layerOf = async (fb, context) => {
		const ch = await self.resolve(fb.options.channel, context)
		const l = await self.resolve(fb.options.layer, context)
		return { st: self.layerAt(ch, l), fr: self.framerateOf(ch) }
	}

	return {
		layer_clip: {
			type: 'boolean',
			name: 'Clip is on a layer (tally)',
			description: 'True while the chosen clip / template is playing (or cued) on the layer.',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [
				F.channel(),
				F.layer(),
				F.mediaField(self),
				F.clipOverride('Or clip name / variable'),
				{
					type: 'dropdown',
					id: 'where',
					label: 'Where',
					default: 'fg',
					choices: [
						{ id: 'fg', label: 'On air (foreground)' },
						{ id: 'bg', label: 'Cued (background)' },
					],
				},
			],
			callback: async (fb, context) => {
				const { st } = await layerOf(fb, context)
				const want = normName((await self.resolve(fb.options.clip, context)) || fb.options.clip_dd)
				if (!want) return false
				const p = fb.options.where === 'bg' ? st?.bg : st?.fg
				return !!p && p.name === want
			},
			learn: (fb) => {
				const st = self.layerAt(fb.options.channel, fb.options.layer)
				const p = fb.options.where === 'bg' ? st?.bg : st?.fg
				return p?.name ? { clip_dd: p.name, clip: '' } : undefined
			},
		},
		layer_state: {
			type: 'boolean',
			name: 'Layer state',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [
				F.channel(),
				F.layer(),
				{
					type: 'dropdown',
					id: 'state',
					label: 'State',
					default: 'playing',
					choices: [
						{ id: 'playing', label: 'Playing' },
						{ id: 'paused', label: 'Paused' },
						{ id: 'ended', label: 'Ended (holding last frame)' },
						{ id: 'loaded', label: 'Anything loaded' },
						{ id: 'empty', label: 'Empty' },
						{ id: 'bg', label: 'Something cued in background' },
						{ id: 'loop', label: 'Looping' },
					],
				},
			],
			callback: async (fb, context) => {
				const { st, fr } = await layerOf(fb, context)
				const s = self.stateOf(st, fr)
				switch (fb.options.state) {
					case 'loaded':
						return s !== 'empty'
					case 'bg':
						return !!st?.bg
					case 'loop':
						return !!st?.fg?.loop
					default:
						return s === fb.options.state
				}
			},
		},
		time_remaining: {
			type: 'boolean',
			name: 'Clip ending soon (countdown warning)',
			description: 'True while a non-looping clip has at most N seconds left.',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [F.channel(), F.layer(), F.number('seconds', 'Seconds left at most', '10')],
			callback: async (fb, context) => {
				const { st, fr } = await layerOf(fb, context)
				const fg = st?.fg
				if (!fg || fg.loop || fg.paused || fg.duration === null || fg.time === null) return false
				if (self.stateOf(st, fr) !== 'playing') return false
				const n = parseFloat(await self.resolve(fb.options.seconds, context))
				return fg.duration - fg.time <= (isNaN(n) ? 10 : n)
			},
		},
		output_active: {
			type: 'boolean',
			name: 'Output is running (recording / stream)',
			description: 'True while the channel has an output with this number (Output: start).',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [F.channel(), F.number('index', 'Output number', '700')],
			callback: async (fb, context) => {
				const ch = await self.resolve(fb.options.channel, context)
				const n = await self.resolve(fb.options.index, context)
				return self.outputRunning(ch, n)
			},
		},
		connected: {
			type: 'boolean',
			name: 'Connected to the server',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [],
			callback: () => self.isConnected(),
		},
		command_failed: {
			type: 'boolean',
			name: 'A command failed recently',
			description: 'True for N seconds after the server rejected a command (404 clip not found, 403 ...).',
			defaultStyle: { bgcolor: AMBER, color: BLACK },
			options: [F.number('seconds', 'For seconds', '5')],
			callback: (fb) => {
				const n = parseFloat(fb.options.seconds) || 5
				return self.lastErrorAt > 0 && Date.now() - self.lastErrorAt < n * 1000
			},
		},
	}
}

module.exports.COLORS = { RED, GREEN, AMBER, WHITE, BLACK }
