// Upgrade scripts. Buttons made with module 2.x keep working: action ids and option ids are unchanged,
// yes/no dropdowns ('true' / 'false') become checkboxes and new options get their defaults.
// Module API 2.x hands options over as { value, isExpression }; a bare value is accepted too.

const bool = (v) => v === true || v === 'true'

/** Read / write one option of an action, whether Companion wrapped it or not. */
function optionAccess(options) {
	const isWrapped = (v) => v !== null && typeof v === 'object' && 'value' in v && 'isExpression' in v
	return {
		get(key) {
			const v = options[key]
			return isWrapped(v) ? v.value : v
		},
		isExpression(key) {
			const v = options[key]
			return isWrapped(v) && v.isExpression
		},
		set(key, value) {
			options[key] = { value, isExpression: false }
		},
		setDefault(key, value) {
			if (options[key] === undefined || (isWrapped(options[key]) && options[key].value === undefined)) {
				options[key] = { value, isExpression: false }
			}
		},
	}
}

function v3(_context, props) {
	const updatedActions = []
	for (const action of props.actions) {
		const o = optionAccess(action.options)
		// fields a user turned into an expression are left as they are
		const setBool = (k) => !o.isExpression(k) && o.set(k, bool(o.get(k)))
		let changed = true
		switch (action.actionId) {
			case 'PLAY':
			case 'LOAD':
			case 'LOADBG': {
				setBool('loop')
				setBool('auto')
				// 2.x always sent the tween and had WIPE mapped to CUT by mistake; keep what was really sent
				const tr = o.get('transition')
				if (tr === undefined || tr === '') o.set('transition', 'CUT')
				const tw = o.get('transition_tween')
				if (tw === undefined || tw === '') o.set('transition_tween', 'linear')
				if (!o.isExpression('transition_duration')) {
					const d = o.get('transition_duration')
					o.set('transition_duration', d === undefined ? '' : String(d))
				}
				o.setDefault('direction', '')
				o.setDefault('seek', '')
				o.setDefault('length', '')
				o.setDefault('clear_mixer', false)
				if (!o.isExpression('channel')) o.set('channel', String(o.get('channel') ?? '1'))
				if (!o.isExpression('layer')) o.set('layer', String(o.get('layer') ?? ''))
				break
			}
			case 'SWAP':
				setBool('transforms')
				break
			case 'CG ADD':
				setBool('playonload')
				o.setDefault('data_format', 'pairs')
				setBool('json')
				break
			case 'CG UPDATE':
				o.setDefault('data_format', 'pairs')
				setBool('json')
				break
			default:
				changed = false
		}
		if (changed) updatedActions.push(action)
	}
	let updatedConfig = null
	if (props.config) {
		updatedConfig = {
			poll_interval: 250,
			watch_layers: '1-10',
			preset_channel: 1,
			preset_layer: 10,
			preset_cg_layer: 20,
			log_commands: false,
			...props.config,
		}
	}
	return { updatedConfig, updatedActions, updatedFeedbacks: [] }
}

/**
 * Module API 2.x checks option values before running an action: a dropdown without a value (an option that did not
 * exist when the button was made, e.g. "pass as" in CG ADD) makes Companion skip the whole action. This fills every
 * missing option of our actions and feedbacks with the default of its current definition (tested on Companion 5.1.0).
 * When a later version adds options, append this function again so it runs once more.
 */
function fillMissingDefaults(_context, props) {
	const defaults = currentDefaults()
	const fill = (list, idKey, defs) => {
		const updated = []
		for (const item of list) {
			const def = defs[item[idKey]]
			if (!def) continue
			const o = optionAccess(item.options)
			let changed = false
			for (const [key, value] of Object.entries(def)) {
				if (value === undefined) continue
				if (o.get(key) === undefined) {
					o.set(key, value)
					changed = true
				}
			}
			if (changed) updated.push(item)
		}
		return updated
	}
	return {
		updatedConfig: null,
		updatedActions: fill(props.actions, 'actionId', defaults.actions),
		updatedFeedbacks: fill(props.feedbacks, 'feedbackId', defaults.feedbacks),
	}
}

/** { actions: { id: { option: default } }, feedbacks: {...} } from the definitions, built without a connection. */
function currentDefaults() {
	const self = {
		mediaChoices: [],
		templateChoices: [],
		ndiChoices: [],
		media: [],
		templates: [],
		channels: [],
		config: {},
		log() {},
	}
	const pick = (defs) =>
		Object.fromEntries(
			Object.entries(defs).map(([id, d]) => [
				id,
				Object.fromEntries((d.options || []).filter((f) => f.type !== 'static-text').map((f) => [f.id, f.default])),
			]),
		)
	return { actions: pick(require('./actions')(self)), feedbacks: pick(require('./feedbacks')(self)) }
}

// fillMissingDefaults again: 3.1.0-beta.2 added the NDI source list (ndi_dd) to "Play colour, web page...".
module.exports = [v3, fillMissingDefaults, fillMissingDefaults]
module.exports.optionAccess = optionAccess
module.exports.currentDefaults = currentDefaults
