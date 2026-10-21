// Shared option field definitions for actions and feedbacks.
const { TWEENS, DIRECTIONS, TRANSITIONS, MIXER_PROPS } = require('./build')

const VARS = { local: true }
const NUM_OR_VAR = '/^(-?\\d+|.*\\$\\(.+\\).*|)$/'

const channel = (def = '1') => ({
	type: 'textinput',
	id: 'channel',
	label: 'Channel',
	default: def,
	width: 3,
	regex: NUM_OR_VAR,
	useVariables: VARS,
})

const layer = (def = '10', { optional = false } = {}) => ({
	type: 'textinput',
	id: 'layer',
	label: optional ? 'Layer (empty = whole channel)' : 'Layer',
	default: def,
	width: 3,
	regex: NUM_OR_VAR,
	useVariables: VARS,
})

const number = (id, label, def = '', extra = {}) => ({
	type: 'textinput',
	id,
	label,
	default: def,
	regex: NUM_OR_VAR,
	useVariables: VARS,
	...extra,
})

const text = (id, label, def = '', extra = {}) => ({
	type: 'textinput',
	id,
	label,
	default: def,
	useVariables: VARS,
	...extra,
})

const checkbox = (id, label, def = false, extra = {}) => ({ type: 'checkbox', id, label, default: def, ...extra })

const TWEEN_CHOICES = TWEENS.map((t) => ({ id: t, label: t }))

const tweenField = (id = 'tween', extra = {}) => ({
	type: 'dropdown',
	id,
	label: 'Tween (easing)',
	default: 'linear',
	choices: TWEEN_CHOICES,
	allowCustom: true,
	tooltip: 'Parameters can be added after a colon, e.g. easeoutelastic:1:0.3 (max. one decimal digit)',
	...extra,
})

const DIRECTION_CHOICES = [
	{ id: '', label: 'Default (from the left)' },
	{ id: 'RIGHT', label: 'From the left (RIGHT)' },
	{ id: 'LEFT', label: 'From the right (LEFT)' },
	{ id: 'DOWN', label: 'From the top (DOWN)' },
	{ id: 'UP', label: 'From the bottom (UP)' },
]
if (DIRECTION_CHOICES.length !== DIRECTIONS.length) throw new Error('direction choices out of sync')

const TRANSITION_CHOICES = TRANSITIONS.map((t) => ({
	id: t,
	label:
		{
			CUT: 'CUT (none)',
			MIX: 'MIX (crossfade)',
			VFADE: 'VFADE (dip through black)',
			FADECUT: 'FADECUT (fade out, then cut)',
			CUTFADE: 'CUTFADE (cut out, fade in)',
			STING: 'STING (mask / overlay clip)',
		}[t] || t,
}))

const mediaField = (self, { id = 'clip_dd', label = 'Clip' } = {}) => ({
	type: 'dropdown',
	id,
	label,
	default: '',
	choices: self.mediaChoices,
	allowCustom: true,
	tooltip: 'Choose from the server list (refreshed on connect) or type a name',
})

const clipOverride = (label = 'Or clip name / variable (overrides the list)') =>
	text('clip', label, '', {
		tooltip: 'e.g. BELKI/$(local:name). Takes precedence over the list above when not empty.',
	})

/** Transition block for PLAY / LOAD / LOADBG. */
function transitionFields(self) {
	const isDir = (o) => ['PUSH', 'SLIDE', 'WIPE'].includes(o.transition)
	const isTimed = (o) => o.transition !== 'CUT' && o.transition !== 'STING'
	const isSting = (o) => o.transition === 'STING'
	const stingMask = (o) => o.transition === 'STING' && !o.sting_cut
	return [
		{ type: 'dropdown', id: 'transition', label: 'Transition', default: 'CUT', choices: TRANSITION_CHOICES },
		number('transition_duration', 'Transition duration (frames)', '25', { isVisible: isTimed }),
		tweenField('transition_tween', { isVisible: isTimed }),
		{
			type: 'dropdown',
			id: 'direction',
			label: 'Direction',
			default: '',
			choices: DIRECTION_CHOICES,
			isVisible: isDir,
		},
		checkbox('sting_cut', 'Sting: no mask, cut at the trigger point', false, { isVisible: isSting }),
		{ ...mediaField(self, { id: 'sting_mask', label: 'Sting mask clip' }), isVisible: stingMask },
		{ ...mediaField(self, { id: 'sting_overlay', label: 'Sting overlay clip (optional)' }), isVisible: isSting },
		number('sting_trigger', 'Sting trigger point (frames)', '', { isVisible: isSting }),
		number('sting_audio_start', 'Sting audio fade start (frames, optional)', '', { isVisible: isSting }),
		number('sting_audio_duration', 'Sting audio fade duration (frames, optional)', '', {
			isVisible: isSting,
			tooltip: 'Start + duration must be at least the mask length, otherwise the sting ends early',
		}),
	]
}

const mixerTailFields = () => [
	number('duration', 'Duration (frames, 0 = at once)', '0', { width: 4 }),
	tweenField('tween', { isVisible: (o) => o.duration !== '0' && o.duration !== '' }),
	checkbox('defer', 'Defer (apply on MIXER COMMIT)', false),
]

const MIXER_PROP_CHOICES = MIXER_PROPS.map((p) => ({ id: p, label: p[0] + p.slice(1).toLowerCase() }))

module.exports = {
	VARS,
	channel,
	layer,
	number,
	text,
	checkbox,
	tweenField,
	mediaField,
	clipOverride,
	transitionFields,
	mixerTailFields,
	MIXER_PROP_CHOICES,
	TRANSITION_CHOICES,
	DIRECTION_CHOICES,
}
