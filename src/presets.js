const { COLORS } = require('./feedbacks')

const { RED, GREEN, AMBER, WHITE, BLACK } = COLORS
const GREY = 0x333333
const MAX_MEDIA_PRESETS = 300

module.exports = function presetDefinitions(self) {
	const ch = String(self.config.preset_channel || 1)
	const layer = String(self.config.preset_layer || 10)
	const cgLayer = String(self.config.preset_cg_layer || 20)
	const at = `${ch}-${layer}`
	const v = (id) => `$(${self.label}:${id})`
	const lv = (id) => v(`c${ch}_l${layer}_${id}`)

	// full option sets (defaults + overrides), so the buttons look right in the editor
	const defaults = {}
	for (const [id, def] of Object.entries(self.actionDefs)) {
		defaults[id] = Object.fromEntries((def.options || []).map((o) => [o.id, o.default ?? '']))
	}
	const a = (actionId, options = {}, delay) => {
		const act = { actionId, options: { ...defaults[actionId], channel: ch, layer, ...options } }
		if (delay) act.delay = delay
		return act
	}
	const fb = (feedbackId, options, style) => ({ feedbackId, options: { channel: ch, layer, ...options }, style })
	const btn = (category, name, text, steps, feedbacks = [], style = {}) => ({
		type: 'button',
		category,
		name,
		style: { text, size: 'auto', color: WHITE, bgcolor: GREY, ...style },
		feedbacks,
		steps: steps.map((down) => ({ down, up: [] })),
	})
	const short = (n) => n.split('/').pop()

	const presets = {}
	let i = 0
	const add = (p) => (presets[`p${i++}`] = p)

	// --- transport for the preset layer
	const T = `Transport ${at}`
	add(
		btn(
			T,
			'Play cued clip',
			`PLAY\\n${at}`,
			[[a('PLAY')]],
			[fb('layer_state', { state: 'playing' }, { bgcolor: GREEN })],
		),
	)
	add(
		btn(
			T,
			'Pause / resume',
			`PAUSE\\n${at}`,
			[[a('PAUSE_TOGGLE')]],
			[fb('layer_state', { state: 'paused' }, { bgcolor: AMBER, color: BLACK })],
		),
	)
	add(btn(T, 'Stop', `STOP\\n${at}`, [[a('STOP')]]))
	add(
		btn(T, 'Clear layer', `CLEAR\\n${at}`, [[a('CLEAR')]], [fb('layer_state', { state: 'loaded' }, { bgcolor: RED })]),
	)
	add(btn(T, 'Clear channel', `CLEAR\\nch ${ch}`, [[a('CLEAR', { layer: '' })]]))
	add(btn(T, 'Clear all channels', 'CLEAR\\nALL', [[a('CLEAR_ALL')]]))
	add(btn(T, 'Restart clip', `RESTART\\n${at}`, [[a('CALL_PARAM', { param: 'SEEK', value: '0' })]]))
	add(btn(T, 'Back 10 s', `-10 s\\n${at}`, [[a('SEEK_REL', { seconds: '-10' })]]))
	add(btn(T, 'Forward 10 s', `+10 s\\n${at}`, [[a('SEEK_REL', { seconds: '10' })]]))
	add(
		btn(
			T,
			'Loop on / off',
			`LOOP\\n${at}`,
			[[a('CALL_PARAM', { param: 'LOOP', loop_value: true })], [a('CALL_PARAM', { param: 'LOOP', loop_value: false })]],
			[fb('layer_state', { state: 'loop' }, { bgcolor: GREEN })],
		),
	)
	add(
		btn(T, 'Safe state (reset transforms + clear)', `SAFE\\n${at}`, [[a('MIXER_CLEAR'), a('CLEAR')]], [], {
			bgcolor: 0x660000,
		}),
	)

	// --- status displays
	const S = 'Status'
	add(
		btn(
			S,
			'On air + remaining',
			`${lv('clip')}\\n${lv('remaining')}`,
			[[]],
			[
				fb('layer_state', { state: 'playing' }, { bgcolor: GREEN }),
				fb('layer_state', { state: 'paused' }, { bgcolor: AMBER, color: BLACK }),
				fb('time_remaining', { seconds: '10' }, { bgcolor: RED }),
			],
			{ size: '14' },
		),
	)
	add(btn(S, 'Elapsed / duration', `${lv('time')}\\n${lv('duration')}`, [[]], [], { size: '14' }))
	add(
		btn(
			S,
			'Cued clip',
			`NEXT:\\n${lv('bg')}`,
			[[]],
			[fb('layer_state', { state: 'bg' }, { bgcolor: AMBER, color: BLACK })],
		),
	)
	add(
		btn(
			S,
			'Connection',
			`CASPAR\\n${v('server_version')}`,
			[[a('REFRESH')]],
			[
				fb('connected', {}, { bgcolor: GREEN }),
				fb('command_failed', { seconds: '5' }, { bgcolor: AMBER, color: BLACK }),
			],
			{ bgcolor: RED },
		),
	)

	// --- mixer
	const M = `Mixer ${at}`
	add(btn(M, 'Fade out', `FADE OUT\\n${at}`, [[a('MIXER_PROP', { property: 'OPACITY', value: '0', duration: '25' })]]))
	add(btn(M, 'Fade in', `FADE IN\\n${at}`, [[a('MIXER_PROP', { property: 'OPACITY', value: '100', duration: '25' })]]))
	add(
		btn(M, 'Mute / unmute', `MUTE\\n${at}`, [
			[a('MIXER_PROP', { property: 'VOLUME', value: '0', duration: '12' })],
			[a('MIXER_PROP', { property: 'VOLUME', value: '100', duration: '12' })],
		]),
	)
	add(btn(M, 'Reset transforms', `MIXER\\nCLEAR\\n${at}`, [[a('MIXER_CLEAR')]]))
	// picture in picture: a third of the screen with a 4 % margin, animated over 25 frames
	const pip = { sx: '33', sy: '33', duration: '25', tween: 'easeoutsine' }
	for (const [name, x, y] of [
		['top left', '4', '4'],
		['top right', '63', '4'],
		['bottom left', '4', '63'],
		['bottom right', '63', '63'],
	]) {
		add(btn(M, `Picture in picture ${name}`, `PIP\\n${name.toUpperCase()}`, [[a('MIXER_FILL', { ...pip, x, y })]]))
	}
	add(
		btn(M, 'Back to full screen', `FULL\\nSCREEN\\n${at}`, [
			[a('MIXER_FILL', { x: '0', y: '0', sx: '100', sy: '100', duration: '25', tween: 'easeoutsine' })],
		]),
	)

	// --- other sources
	const SRC = `Sources on ${at}`
	add(
		btn(SRC, 'Fade to black', `TO\\nBLACK\\n${at}`, [
			[a('PLAY_SOURCE', { source: 'color', color_text: 'BLACK', transition: 'MIX', transition_duration: '25' })],
		]),
	)
	add(
		btn(SRC, 'Colour bed', `COLOUR\\n${at}`, [
			[a('PLAY_SOURCE', { source: 'color', color: 0x003366, transition: 'MIX', transition_duration: '25' })],
		]),
	)
	for (const c of self.channels.filter((c) => String(c.channel) !== ch)) {
		add(
			btn(SRC, `Channel ${c.channel} here`, `CH ${c.channel}\\n→ ${at}`, [
				[a('PLAY_SOURCE', { source: 'route', route_channel: String(c.channel), route_layer: '' })],
			]),
		)
	}
	add(btn(SRC, 'Web page', `WEB\\nPAGE\\n${at}`, [[a('PLAY_SOURCE', { source: 'html', url: 'https://casparcg.com' })]]))
	add(btn(SRC, 'Reload web page', `RELOAD\\n${at}`, [[a('PAGE_CALL', { reload: true })]]))
	add(
		btn(SRC, 'SRT input', `SRT IN\\n${at}`, [
			[a('PLAY_SOURCE', { source: 'stream', url: 'srt://192.168.0.10:9000?mode=caller' })],
		]),
	)

	// --- outputs of the preset channel
	const O = `Outputs ch ${ch}`
	const ov = (n, id) => v(`c${ch}_o${n}_${id}`)
	const ofb = (n) => ({
		feedbackId: 'output_active',
		options: { channel: ch, index: String(n) },
		style: { bgcolor: RED },
	})
	add(
		btn(
			O,
			'Record start / stop',
			`REC\\n${ov(700, 'time')}`,
			[[a('OUTPUT_ADD', { index: '700', kind: 'file' })], [a('OUTPUT_REMOVE', { index: '700' })]],
			[ofb(700)],
		),
	)
	add(
		btn(
			O,
			'SRT stream start / stop',
			`SRT OUT\\n${ov(701, 'time')}`,
			[[a('OUTPUT_ADD', { index: '701', kind: 'stream' })], [a('OUTPUT_REMOVE', { index: '701' })]],
			[ofb(701)],
		),
	)
	add(btn(O, 'Snapshot (PNG)', `SNAP\\nch ${ch}`, [[a('SNAPSHOT')]]))
	add(btn(M, 'Master volume 100%', `MASTER\\n100%\\nch ${ch}`, [[a('MIXER_MASTERVOLUME', { value: '100' })]]))

	// --- patterns verified on CasparCG 2.5.1
	const P = 'Patterns (tested on 2.5.1)'
	const still = self.media.find((m) => m.type === 'STILL')?.name || 'BELKI/NAME'
	add(
		btn(
			P,
			'Lower third show / hide',
			`LOWER\\nTHIRD\\n${at}`,
			[
				[
					a('PLAY', {
						clip_dd: still,
						clear_mixer: true,
						transition: 'SLIDE',
						transition_duration: '50',
						transition_tween: 'easeoutsine',
						direction: 'RIGHT',
					}),
				],
				[a('MIXER_FILL', { x: '-100', y: '0', sx: '100', sy: '100', duration: '25' }), a('CLEAR', {}, 600)],
			],
			[fb('layer_state', { state: 'loaded' }, { bgcolor: RED })],
		),
	)
	add(
		btn(
			P,
			'Stinger hold / release',
			`STINGER\\n${at}`,
			[
				[
					a('PLAY', { clip_dd: 'STINGER_1', clear_mixer: true }),
					a('LOADBG', { clip_dd: 'STINGER_2', auto: true, loop: true, transition: 'MIX', transition_duration: '20' }),
				],
				[
					a('LOADBG', { clip_dd: 'STINGER_3', auto: true, transition: 'MIX', transition_duration: '20' }),
					a('CALL_PARAM', { param: 'LOOP', loop_value: false }, 100),
				],
			],
			[fb('layer_state', { state: 'loop' }, { bgcolor: AMBER, color: BLACK })],
		),
	)

	add(
		btn(
			P,
			'Custom HTML lower third show / hide',
			`HTML\\nBELKA\\n${ch}-${cgLayer}`,
			[[a('HTML_SHOW', { layer: cgLayer })], [a('HTML_HIDE', { layer: cgLayer })]],
			[
				{
					feedbackId: 'layer_clip',
					options: { channel: ch, layer: cgLayer, clip_dd: '', clip: 'HTML:BELKA', where: 'fg' },
					style: { bgcolor: RED },
				},
			],
		),
	)

	// --- one button per media file / template
	const media = self.media.slice(0, MAX_MEDIA_PRESETS)
	for (const m of media) {
		add(
			btn(
				`Play on ${at}`,
				`Play ${m.name}`,
				short(m.name),
				[[a('PLAY', { clip_dd: m.name })]],
				[
					fb('layer_clip', { clip_dd: m.name, where: 'fg' }, { bgcolor: RED }),
					fb('layer_clip', { clip_dd: m.name, where: 'bg' }, { bgcolor: AMBER, color: BLACK }),
				],
			),
		)
	}
	for (const m of media) {
		add(
			btn(
				`Cue on ${at}`,
				`Cue ${m.name}`,
				`CUE\\n${short(m.name)}`,
				[[a('LOADBG', { clip_dd: m.name })]],
				[
					fb('layer_clip', { clip_dd: m.name, where: 'bg' }, { bgcolor: AMBER, color: BLACK }),
					fb('layer_clip', { clip_dd: m.name, where: 'fg' }, { bgcolor: RED }),
				],
			),
		)
	}
	const cgAt = `${ch}-${cgLayer}`
	for (const t of self.templates) {
		add(
			btn(
				`Templates on ${cgAt}`,
				`Template ${t} show / hide`,
				short(t),
				[
					[a('CG ADD', { layer: cgLayer, template_dd: t, playonload: true })],
					[a('CG STOP', { layer: cgLayer }), a('CLEAR', { layer: cgLayer }, 1000)],
				],
				[
					{
						feedbackId: 'layer_clip',
						options: { channel: ch, layer: cgLayer, clip_dd: t, where: 'fg' },
						style: { bgcolor: RED },
					},
				],
			),
		)
	}
	return presets
}
