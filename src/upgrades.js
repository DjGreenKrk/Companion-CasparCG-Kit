// Upgrade scripts. Buttons made with module 2.x keep working: action ids and option ids are unchanged,
// yes/no dropdowns ('true' / 'false') become checkboxes and new options get their defaults.

const bool = (v) => v === true || v === 'true'

function v3(_context, props) {
	const updatedActions = []
	for (const action of props.actions) {
		const o = action.options
		let changed = true
		switch (action.actionId) {
			case 'PLAY':
			case 'LOAD':
			case 'LOADBG':
				o.loop = bool(o.loop)
				o.auto = bool(o.auto)
				// 2.x always sent the tween and had WIPE mapped to CUT by mistake; keep what was really sent
				if (o.transition === undefined || o.transition === '') o.transition = 'CUT'
				if (o.transition_tween === undefined || o.transition_tween === '') o.transition_tween = 'linear'
				o.transition_duration = o.transition_duration === undefined ? '' : String(o.transition_duration)
				o.direction ??= ''
				o.seek ??= ''
				o.length ??= ''
				o.clear_mixer ??= false
				o.channel = String(o.channel ?? '1')
				o.layer = String(o.layer ?? '')
				break
			case 'SWAP':
				o.transforms = bool(o.transforms)
				break
			case 'CG ADD':
				o.playonload = bool(o.playonload)
				o.data_format ??= 'pairs'
				o.json = bool(o.json)
				break
			case 'CG UPDATE':
				o.data_format ??= 'pairs'
				o.json = bool(o.json)
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

module.exports = [v3]
