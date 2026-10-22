const B = require('./build')
const F = require('./options')
const { CALL_PARAMS } = require('./build')
const H = require('./html')

const YES = (id, label, def = false) => F.checkbox(id, label, def)

module.exports = function actionDefinitions(self) {
	/** Wrap a builder: resolve variables (local + global) in order, build, send. */
	const run = (build) => (action, context) => self.runOrdered(action, context, build)

	/** The server pairs <clip> with <clip>_A or <clip>_ALPHA from the media folder as its key (tested on 2.5.1). */
	const keyNote = (o) => {
		const clip = B.str(o.clip) || B.str(o.clip_dd)
		const up = clip.toUpperCase().replace(/\\/g, '/')
		const key = self.media.find((m) => m.name === `${up}_A` || m.name === `${up}_ALPHA`)
		if (key)
			self.log('info', `${clip}: the server also uses ${key.name} as its key (alpha mask) - rename it if not intended`)
	}
	const playRun = (verb) =>
		run((o) => {
			keyNote(o)
			return B.playLike(verb, o)
		})

	const learnClip = async (action) => {
		const st = self.layerAt(action.options.channel, action.options.layer)
		if (!st?.fg?.name) return undefined
		return { clip_dd: st.fg.name, clip: '' } // API 2.x: learn returns only the changed values
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
			callback: playRun('PLAY'),
			learn: learnClip,
		},
		LOADBG: {
			name: 'Cue clip in background (LOADBG)',
			description: 'Load a clip in the background; start it with PLAY (empty clip) or AUTO.',
			options: playOptions('LOADBG'),
			callback: playRun('LOADBG'),
			learn: learnClip,
		},
		LOAD: {
			name: 'Load clip, show first frame (LOAD)',
			options: playOptions('LOAD'),
			callback: playRun('LOAD'),
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
					disableAutoExpression: true,
					label: 'Parameter',
					default: 'LOOP',
					choices: CALL_PARAMS.map((p) => ({ id: p, label: p })),
				},
				F.checkbox('loop_value', 'Loop on', false, { ...F.when(F.oneOf('param', ['LOOP'])) }),
				F.number('value', 'Frame', '0', { ...F.when(F.noneOf('param', ['LOOP'])) }),
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
		MIXER_GEOMETRY: {
			name: 'Mixer: crop / mask / rotation / pivot (CROP, CLIP, ROTATION, ANCHOR)',
			description:
				'CROP cuts the image edges (image coordinates), CLIP shows only a rectangle of the screen, ROTATION turns around the pivot (ANCHOR, default top-left corner).',
			options: [
				F.channel(),
				F.layer(),
				{
					type: 'dropdown',
					id: 'property',
					disableAutoExpression: true,
					label: 'Property',
					default: 'CROP',
					choices: [
						{ id: 'CROP', label: 'Crop edges (CROP)' },
						{ id: 'CLIP', label: 'Show only a screen rectangle (CLIP)' },
						{ id: 'ROTATION', label: 'Rotation (ROTATION)' },
						{ id: 'ANCHOR', label: 'Pivot point (ANCHOR)' },
					],
				},
				...geometryFields(),
				...F.mixerTailFields(),
			],
			callback: run((o) => B.mixerGeometry(o)),
		},
		MIXER_BLEND: {
			name: 'Mixer: blend mode (BLEND)',
			options: [
				F.channel(),
				F.layer(),
				{
					type: 'dropdown',
					id: 'blend',
					label: 'Blend mode',
					default: 'normal',
					choices: B.BLEND_MODES.map((m) => ({ id: m, label: m })),
				},
			],
			callback: run((o) => B.mixerBlend(o)),
		},
		MIXER_KEYER: {
			name: 'Mixer: use layer as key for the layer above (KEYER)',
			description:
				'The layer is hidden and the layer above shows only where this one is bright (red channel, not alpha - tested on 2.5.1).',
			options: [F.channel(), F.layer(), YES('keyer', 'Keyer on', true)],
			callback: run((o) => B.mixerKeyer(o)),
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

		HTML_SHOW: {
			name: 'Custom HTML graphic: show',
			description:
				'Your own layout (HTML + CSS) without a template file on the server. {{f0}}, {{f1}}... are filled from Fields; change them later with "Template: update data" on the same layer.',
			options: [
				F.channel(),
				F.layer('20'),
				F.text('name', 'Graphic name (tally / variables show HTML:<NAME>)', 'belka', {
					regex: '/^[A-Za-z0-9_-]*$/',
					useVariables: undefined,
				}),
				F.text('html', 'HTML (use {{f0}}, {{f1}}... for texts)', H.DEFAULT_HTML, { multiline: true }),
				F.text('css', 'CSS', H.DEFAULT_CSS, { multiline: true }),
				F.text('fields', 'Fields', 'f0="Jan Kowalski" f1="Reporter"', {
					tooltip: 'f0="$(local:name)" f1="$(custom:role)" - shown as text (quotes and < > are fine)',
				}),
				F.fixed({
					type: 'dropdown',
					id: 'animation',
					label: 'Animation',
					default: 'slide_left',
					choices: H.ANIMATIONS,
				}),
				F.number('duration', 'Animation time (ms)', '500', { ...F.when(F.noneOf('animation', ['none'])) }),
				YES('playonload', 'Show at once (untick to load hidden, then "Template: play")', true),
			],
			callback: run((o) => H.show(o)),
		},
		HTML_HIDE: {
			name: 'Custom HTML graphic: hide',
			description: 'Plays the out-animation (CG STOP), then clears the layer.',
			options: [
				F.channel(),
				F.layer('20'),
				F.number('clear_after', 'Clear the layer after (ms, empty = keep it loaded)', '600'),
			],
			callback: run((o) => H.hide(o)),
		},

		PLAY_SOURCE: {
			name: 'Play colour, web page, other channel or live stream',
			description:
				'Sources that are not media files: colour / gradient, a web page ([HTML]), another channel or layer (route://), SRT / RTMP / HTTP stream, NDI, DeckLink input.',
			options: [
				F.channel(),
				F.layer(),
				{
					type: 'dropdown',
					id: 'verb',
					label: 'Command',
					default: 'PLAY',
					choices: [
						{ id: 'PLAY', label: 'Play now (PLAY)' },
						{ id: 'LOADBG', label: 'Cue in background (LOADBG)' },
					],
				},
				YES('auto', 'Auto: start when the current clip ends (AUTO)', false),
				{
					type: 'dropdown',
					id: 'source',
					disableAutoExpression: true,
					label: 'Source',
					default: 'color',
					choices: [
						{ id: 'color', label: 'Colour / gradient' },
						{ id: 'html', label: 'Web page ([HTML])' },
						{ id: 'route', label: 'Another channel / layer (route://)' },
						{ id: 'stream', label: 'Live stream (srt://, rtmp://, http://)' },
						{ id: 'ndi', label: 'NDI source (needs NDI on the server)' },
						{ id: 'decklink', label: 'DeckLink input' },
					],
				},
				{
					type: 'colorpicker',
					id: 'color',
					label: 'Colour',
					default: 0x000000,
					...F.when(F.oneOf('source', ['color'])),
				},
				F.number('opacity', 'Opacity (%)', '100', { ...F.when(F.oneOf('source', ['color'])) }),
				F.text('color_text', 'Or colours as text (overrides the picker)', '', {
					...F.when(F.oneOf('source', ['color'])),
					tooltip:
						'#RRGGBB, #AARRGGBB or BLACK, WHITE, RED, GREEN, BLUE, ORANGE, YELLOW, BROWN, GRAY, TEAL, EMPTY. Several colours = horizontal gradient: #FF0000 #0000FF',
				}),
				F.text('url', 'Address', '', {
					...F.when(F.oneOf('source', ['html', 'stream'])),
					tooltip:
						'Web page: https://... or file:///... Stream: srt://host:port?mode=caller, rtmp://..., http://...m3u8',
				}),
				F.number('route_channel', 'Source channel', '1', { ...F.when(F.oneOf('source', ['route'])) }),
				F.number('route_layer', 'Source layer (empty = whole channel)', '', {
					...F.when(F.oneOf('source', ['route'])),
				}),
				F.text('ndi_name', 'NDI source (PC NAME/Source)', '', { ...F.when(F.oneOf('source', ['ndi'])) }),
				F.number('device', 'DeckLink device', '1', { ...F.when(F.oneOf('source', ['decklink'])) }),
				F.text('format', 'Input format (optional, e.g. 1080i5000)', '', { ...F.when(F.oneOf('source', ['decklink'])) }),
				...F.transitionFields(self, { sting: false }),
			],
			callback: run((o) => B.playSource(o)),
		},
		SCROLL_PLAY: {
			name: 'Scroll an image (credits)',
			description: 'A tall image scrolls up (negative speed: down). Width should match the channel.',
			options: [
				F.channel(),
				F.layer(),
				F.mediaField(self, { label: 'Image' }),
				F.clipOverride('Or image name / variable'),
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Scroll by',
					default: 'speed',
					choices: [
						{ id: 'speed', label: 'Speed (pixels per frame)' },
						{ id: 'duration', label: 'Total time (seconds)' },
					],
				},
				F.number('value', 'Speed / seconds', '4', { tooltip: 'Interlaced channels: use even speeds' }),
				F.number('blur', 'Motion blur (px, optional)', ''),
				YES('premultiply', 'Image has straight alpha (PREMULTIPLY)'),
				...F.transitionFields(self, { sting: false }),
			],
			callback: run((o) => B.scrollPlay(o)),
		},
		SCROLL_SPEED: {
			name: 'Scroll: change speed (CALL SPEED)',
			options: [
				F.channel(),
				F.layer(),
				F.number('value', 'New speed (px per frame, 0 = stop)', '0'),
				F.number('duration', 'Change over (frames)', '25'),
				F.tweenField('tween'),
			],
			callback: run((o) => B.scrollSpeed(o)),
		},
		PAGE_CALL: {
			name: 'Web page: run JavaScript / reload',
			description: 'For a layer playing a web page ([HTML]). The server answers OK even when the script fails.',
			options: [
				F.channel(),
				F.layer(),
				F.fixed(YES('reload', 'Reload the page instead (RELOAD)')),
				F.text('js', 'JavaScript', '', { multiline: true, ...F.when(`!${F.opt('reload')}`) }),
			],
			callback: run((o) => B.pageCall(o)),
		},
		SEEK_REL: {
			name: 'Skip forward / back (seconds)',
			options: [F.channel(), F.layer(), F.number('seconds', 'Seconds (back: negative)', '10')],
			callback: run((o) => B.seekRelative(o, self.framerateOf(o.channel), self.layerAt(o.channel, o.layer)?.fg)),
		},

		OUTPUT_ADD: {
			name: 'Output: start recording / stream / NDI',
			description:
				'Starts an output of the whole channel under a number; stop it with "Output: stop" and the same number. A number already in use replaces that output.',
			options: [
				F.channel(),
				F.number('index', 'Output number', '700', {
					tooltip: 'Any free number, e.g. 700 for the recording, 701 for the stream',
				}),
				{
					type: 'dropdown',
					id: 'kind',
					disableAutoExpression: true,
					label: 'Output',
					default: 'file',
					choices: [
						{ id: 'file', label: 'Record to a file' },
						{ id: 'stream', label: 'Stream (SRT / RTMP)' },
						{ id: 'ndi', label: 'NDI (needs NDI on the server)' },
					],
				},
				F.text('path', 'File (in the media folder unless absolute)', 'recording_{datetime}', {
					...F.when(F.oneOf('kind', ['file'])),
					tooltip: '{date}, {time} and {datetime} are replaced; the extension comes from the format when missing',
				}),
				{
					type: 'dropdown',
					id: 'preset',
					label: 'Format',
					default: 'h264',
					...F.when(F.oneOf('kind', ['file'])),
					choices: [
						{ id: 'h264', label: 'H.264 + AAC (.mp4)' },
						{ id: 'prores', label: 'ProRes 422 + PCM (.mov) - needs a fast CPU' },
						{ id: 'custom', label: 'Custom ffmpeg options' },
					],
				},
				F.text('url', 'Address', 'srt://192.168.0.10:9000?mode=caller', {
					...F.when(F.oneOf('kind', ['stream'])),
					tooltip:
						'srt://receiver:port?mode=caller (the receiver listens - vMix, OBS, a decoder), rtmp://server/app/key. Listener mode (srt://0.0.0.0:9000?mode=listener) cannot be stopped until a receiver has connected (2.5.1).',
				}),
				{
					type: 'dropdown',
					id: 'stream_preset',
					label: 'Format',
					default: 'srt',
					...F.when(F.oneOf('kind', ['stream'])),
					choices: [
						{ id: 'srt', label: 'MPEG-TS, H.264 8 Mb/s (SRT)' },
						{ id: 'rtmp', label: 'FLV, H.264 6 Mb/s (RTMP: YouTube, Facebook...)' },
						{ id: 'custom', label: 'Custom ffmpeg options' },
					],
				},
				F.text('args', 'Extra ffmpeg options (-name:stream form, e.g. -b:v 4000k)', '', {
					...F.when(F.noneOf('kind', ['ndi'])),
					tooltip:
						'Test them before the show: on 2.5.1 an unknown codec made the server stop answering and crash (tested).',
				}),
				F.text('ndi_name', 'NDI name', 'CasparCG', { ...F.when(F.oneOf('kind', ['ndi'])) }),
			],
			callback: run((o) => B.outputAdd(o)),
		},
		OUTPUT_REMOVE: {
			name: 'Output: stop (REMOVE)',
			options: [F.channel(), F.number('index', 'Output number', '700')],
			callback: run((o) => B.outputRemove(o)),
		},
		SNAPSHOT: {
			name: 'Output: save a picture of the channel (PNG)',
			description:
				'Saved in the media folder. Taken twice 0.5 s apart (2.5.1 saves the previous picture the first time).',
			options: [F.channel(), F.text('name', 'File name (no extension)', 'snapshot_{datetime}')],
			callback: run((o) => B.snapshot(o)),
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

function geometryFields() {
	const n = (id, label, def, p, extra) =>
		F.number(id, label, def, { width: 3, ...F.when(F.oneOf('property', [p])), ...extra })
	return [
		n('crop_l', 'Left edge (%)', '0', 'CROP'),
		n('crop_t', 'Top edge (%)', '0', 'CROP'),
		n('crop_r', 'Right edge (%)', '100', 'CROP'),
		n('crop_b', 'Bottom edge (%)', '100', 'CROP'),
		n('clip_x', 'X (% of width)', '0', 'CLIP'),
		n('clip_y', 'Y (% of height)', '0', 'CLIP'),
		n('clip_w', 'Width (%)', '100', 'CLIP'),
		n('clip_h', 'Height (%)', '100', 'CLIP'),
		n('rotation', 'Degrees (clockwise)', '0', 'ROTATION'),
		n('anchor_x', 'X (% of the image)', '0', 'ANCHOR', {
			tooltip:
				'ANCHOR 50/50 alone moves the image up-left by half; pair it with FILL 50 50 to rotate around the centre',
		}),
		n('anchor_y', 'Y (% of the image)', '0', 'ANCHOR'),
	]
}

function cgOptions() {
	return [F.channel(), F.layer('20'), F.number('templatelayer', 'Template host layer', '1')]
}

function cgDataFields() {
	return [
		{
			type: 'dropdown',
			id: 'pass_as',
			disableAutoExpression: true,
			label: 'Pass data to the template as',
			default: 'string',
			choices: [
				{ id: 'string', label: 'Text (standard CG data; the template parses JSON / XML)' },
				{ id: 'object', label: 'Object: update({...}) by CG INVOKE' },
			],
			tooltip:
				'Object: for templates whose update() expects a JS object, e.g. update({ name: "Jan", accent: "#c8ff67" })',
		},
		{
			type: 'dropdown',
			id: 'data_format',
			disableAutoExpression: true,
			label: 'Data format',
			default: 'pairs',
			choices: [
				{ id: 'pairs', label: 'Fields: name="text" role="text"' },
				{ id: 'raw', label: 'Raw (as typed: JSON / XML, or update({...}) for object)' },
			],
		},
		F.checkbox('json', 'Send fields as JSON (HTML templates)', true, {
			...F.when(`${F.noneOf('data_format', ['raw'])} && ${F.noneOf('pass_as', ['object'])}`),
		}),
		F.text('variables', 'Data', '', {
			multiline: true,
			tooltip:
				'Fields: name="$(local:name)" role="$(custom:role)" - quotes in variable values are safe. Raw: {"f0":"John"}, or with Object: update({ name: "$(local:name)" })',
		}),
	]
}
