const B = require('./build')
const F = require('./options')
const { CALL_PARAMS } = require('./build')

const YES = (id, label, def = false) => F.checkbox(id, label, def)

module.exports = function actionDefinitions(self) {
	/** Wrap a builder: resolve variables (local + global) in order, build, send. */
	const run = (build) => (action, context) => self.runOrdered(action, context, build)

	const learnClip = async (action) => {
		const st = self.layerAt(action.options.channel, action.options.layer)
		if (!st?.fg?.name) return undefined
		return { ...action.options, clip_dd: st.fg.name, clip: '' }
	}

	const playOptions = (verb) => [
		F.channel(),
		F.layer(),
		F.mediaField(self),
		F.clipOverride(),
		YES('loop', 'Loop'),
		...(verb === 'LOADBG' ? [F.checkbox('auto', 'Auto: start when the current clip ends (AUTO)', false)] : []),
		F.number('seek', 'Start at frame (SEEK, optional)', ''),
		F.number('length', 'Play length in frames (LENGTH, optional)', ''),
		F.checkbox('clear_mixer', 'Reset transforms first (MIXER CLEAR)', false, {
			tooltip:
				'Transforms (FILL, OPACITY...) survive CLEAR. Tick this when an earlier button moved or faded this layer.',
		}),
		...F.transitionFields(self),
	]

	const layerOnly = (optional = true) => [F.channel(), F.layer('10', { optional })]

	const actions = {
		PLAY: {
			name: 'Play clip (PLAY)',
			description: 'Play a clip on a layer. Leave the clip empty to start what is loaded in the background.',
			options: playOptions('PLAY'),
			callback: run((o) => B.playLike('PLAY', o)),
			learn: learnClip,
		},
		LOADBG: {
			name: 'Cue clip in background (LOADBG)',
			description: 'Load a clip in the background; start it with PLAY (empty clip) or AUTO.',
			options: playOptions('LOADBG'),
			callback: run((o) => B.playLike('LOADBG', o)),
			learn: learnClip,
		},
		LOAD: {
			name: 'Load clip, show first frame (LOAD)',
			options: playOptions('LOAD'),
			callback: run((o) => B.playLike('LOAD', o)),
			learn: learnClip,
		},
		PAUSE: { name: 'Pause (PAUSE)', options: layerOnly(), callback: run((o) => B.simple('PAUSE', o)) },
		RESUME: { name: 'Resume (RESUME)', options: layerOnly(), callback: run((o) => B.simple('RESUME', o)) },
		PAUSE_TOGGLE: {
			name: 'Pause / resume toggle',
			description: 'Pauses when the layer is playing, resumes when it is paused (uses the polled layer state).',
			options: layerOnly(false),
			callback: run((o) => {
				const st = self.layerAt(o.channel, o.layer)
				return B.simple(st?.fg?.paused ? 'RESUME' : 'PAUSE', o, { layerRequired: true })
			}),
		},
		STOP: { name: 'Stop (STOP)', options: layerOnly(), callback: run((o) => B.simple('STOP', o)) },
		CLEAR: {
			name: 'Clear layer / channel (CLEAR)',
			description: 'Removes clips. Transforms (MIXER) stay - tick "also reset transforms" to clear them too.',
			options: [...layerOnly(), YES('clear_mixer', 'Also reset transforms (MIXER CLEAR)')],
			callback: run((o) => {
				const lines = [B.simple('CLEAR', o)]
				if (B.truthy(o.clear_mixer)) lines.push(B.simple('MIXER', o) + ' CLEAR')
				return lines
			}),
		},
		CLEAR_ALL: {
			name: 'Clear all channels (CLEAR ALL)',
			options: [YES('clear_mixer', 'Also reset transforms on every channel (MIXER n CLEAR)')],
			callback: run((o) => {
				const lines = ['CLEAR ALL']
				if (B.truthy(o.clear_mixer)) for (const c of self.channels) lines.push(`MIXER ${c.channel} CLEAR`)
				return lines
			}),
		},
		CALL_PARAM: {
			name: 'Change playing clip: loop / seek / length / in / out (CALL)',
			options: [
				F.channel(),
				F.layer(),
				{
					type: 'dropdown',
					id: 'target',
					label: 'Clip',
					default: 'fg',
					choices: [
						{ id: 'fg', label: 'Playing clip (CALL)' },
						{ id: 'bg', label: 'Background clip (CALLBG)' },
					],
				},
				{
					type: 'dropdown',
					id: 'param',
					label: 'Parameter',
					default: 'LOOP',
					choices: CALL_PARAMS.map((p) => ({ id: p, label: p })),
				},
				F.checkbox('loop_value', 'Loop on', false, { isVisible: (o) => o.param === 'LOOP' }),
				F.number('value', 'Frame', '0', { isVisible: (o) => o.param !== 'LOOP' }),
			],
			callback: run((o) => B.callParam(o)),
		},
		CALL: {
			name: 'CALL with custom method',
			options: [F.channel(), F.layer('10', { optional: true }), F.text('method', 'Method', '', { regex: '/^.+$/' })],
			callback: run((o) => {
				if (/^\s*SEEK\s*$/i.test(o.method))
					throw new Error('CALL ... SEEK needs a frame number (the server never answers it)')
				return `CALL ${B.address(o.channel, o.layer)} ${B.str(o.method)}`
			}),
		},
		GOTO: {
			name: 'Go to position in seconds (from end: "-")',
			options: [F.channel(), F.layer(), F.text('offset', 'Seconds (from end: prefix "-")', '0')],
			callback: (action, context) => self.runGoto(action, context),
		},
		SWAP: {
			name: 'Swap layers (SWAP)',
			options: [
				{ ...F.channel(), id: 'channel1', label: 'Channel 1' },
				{ ...F.layer('', { optional: true }), id: 'layer1', label: 'Layer 1 (empty = whole channel)' },
				{ ...F.channel(), id: 'channel2', label: 'Channel 2' },
				{ ...F.layer('', { optional: true }), id: 'layer2', label: 'Layer 2 (empty = whole channel)' },
				YES('transforms', 'Swap transforms too'),
			],
			callback: run((o) => B.swap(o)),
		},

		MIXER_PROP: {
			name: 'Mixer: opacity / volume / brightness / saturation / contrast',
			options: [
				F.channel(),
				F.layer(),
				{ type: 'dropdown', id: 'property', label: 'Property', default: 'OPACITY', choices: F.MIXER_PROP_CHOICES },
				F.number('value', 'Value (%)', '100', { tooltip: '100 = normal, 0 = transparent / silent' }),
				...F.mixerTailFields(),
			],
			callback: run((o) => B.mixerProp(o)),
		},
		MIXER_FILL: {
			name: 'Mixer: position and size (FILL)',
			options: [
				F.channel(),
				F.layer(),
				F.number('x', 'X (% of width)', '0', { width: 3 }),
				F.number('y', 'Y (% of height)', '0', { width: 3 }),
				F.number('sx', 'Scale X (%)', '100', { width: 3 }),
				F.number('sy', 'Scale Y (%)', '100', { width: 3 }),
				...F.mixerTailFields(),
			],
			callback: run((o) => B.mixerFill(o)),
		},
		MIXER_MASTERVOLUME: {
			name: 'Mixer: channel master volume',
			description: 'Note: MIXER CLEAR does not reset the master volume.',
			options: [F.channel(), F.number('value', 'Volume (%)', '100'), ...F.mixerTailFields()],
			callback: run((o) => B.masterVolume(o)),
		},
		MIXER_CLEAR: {
			name: 'Mixer: reset transforms (MIXER CLEAR)',
			options: layerOnly(),
			callback: run((o) => B.simple('MIXER', o) + ' CLEAR'),
		},
		MIXER_COMMIT: {
			name: 'Mixer: commit deferred changes (MIXER COMMIT)',
			options: [F.channel()],
			callback: run((o) => `MIXER ${B.int(o.channel, 'Channel', { min: 1 })} COMMIT`),
		},

		'CG ADD': {
			name: 'Template: add (CG ADD)',
			options: [
				F.channel(),
				F.layer('20'),
				{
					type: 'dropdown',
					id: 'template_dd',
					label: 'Template',
					default: '',
					choices: self.templateChoices,
					allowCustom: true,
				},
				F.text('template', 'Or template name / variable (overrides the list)'),
				YES('playonload', 'Play on load'),
				F.number('templatelayer', 'Template host layer', '1'),
				...cgDataFields(),
			],
			callback: run((o) => B.cg('ADD', o)),
		},
		'CG UPDATE': {
			name: 'Template: update data (CG UPDATE)',
			options: [F.channel(), F.layer('20'), F.number('templatelayer', 'Template host layer', '1'), ...cgDataFields()],
			callback: run((o) => B.cg('UPDATE', o)),
		},
		'CG PLAY': { name: 'Template: play (CG PLAY)', options: cgOptions(), callback: run((o) => B.cg('PLAY', o)) },
		'CG NEXT': { name: 'Template: next (CG NEXT)', options: cgOptions(), callback: run((o) => B.cg('NEXT', o)) },
		'CG STOP': { name: 'Template: stop (CG STOP)', options: cgOptions(), callback: run((o) => B.cg('STOP', o)) },
		'CG REMOVE': {
			name: 'Template: remove (CG REMOVE)',
			options: cgOptions(),
			callback: run((o) => B.cg('REMOVE', o)),
		},
		'CG CLEAR': {
			name: 'Template: clear layer (CG CLEAR)',
			options: [F.channel(), F.layer('20')],
			callback: run((o) => B.cg('CLEAR', o)),
		},
		'CG INVOKE': {
			name: 'Template: call function (CG INVOKE)',
			options: [...cgOptions(), F.text('method', 'Function name')],
			callback: run((o) => B.cg('INVOKE', o)),
		},

		COMMAND: {
			name: 'Manually specify AMCP command',
			description: 'Raw AMCP line. Local and global variables are replaced, e.g. PLAY 1-10 "$(local:clip)".',
			options: [
				F.text('cmd', 'Command', 'CLEAR 1', {
					tooltip: 'Several commands: one per line (they are sent in order).',
					multiline: true,
				}),
			],
			callback: run((o) =>
				B.str(o.cmd)
					.split(/\r?\n/)
					.map((l) => l.trim())
					.filter(Boolean),
			),
		},
		REFRESH: {
			name: 'Refresh media and template lists',
			options: [],
			callback: () => self.refreshLists(),
		},
	}
	return actions
}

function cgOptions() {
	return [F.channel(), F.layer('20'), F.number('templatelayer', 'Template host layer', '1')]
}

function cgDataFields() {
	return [
		{
			type: 'dropdown',
			id: 'data_format',
			label: 'Data format',
			default: 'pairs',
			choices: [
				{ id: 'pairs', label: 'Fields: f0="text" f1="text"' },
				{ id: 'raw', label: 'Raw (JSON or XML as typed)' },
			],
		},
		F.checkbox('json', 'Send fields as JSON (HTML templates)', true, { isVisible: (o) => o.data_format !== 'raw' }),
		F.text('variables', 'Data', '', {
			tooltip: 'Fields: f0="John Doe" f1="$(local:title)". Raw: {"f0":"John"}',
		}),
	]
}
