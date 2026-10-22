const test = require('node:test')
const assert = require('node:assert')

// The definitions are built the way index.js builds them, with a stand-in for the connection
function build({ media = [], templates = [] } = {}) {
	const self = {
		mediaChoices: [],
		templateChoices: [],
		media,
		templates,
		channels: [{ channel: 1 }, { channel: 2 }],
		config: { preset_channel: 1, preset_layer: 10, preset_cg_layer: 20 },
		label: 'caspar',
		log() {},
	}
	self.actionDefs = require('../src/actions')(self)
	self.feedbackDefs = require('../src/feedbacks')(self)
	return { self, ...require('../src/presets')(self) }
}

test('visibility: no isVisible functions, referenced fields cannot be expressions (module API 2.x)', () => {
	const { self } = build()
	for (const [kind, defs] of [
		['action', self.actionDefs],
		['feedback', self.feedbackDefs],
	]) {
		for (const [id, def] of Object.entries(defs)) {
			for (const field of def.options || []) {
				assert.strictEqual(field.isVisible, undefined, `${kind} ${id}.${field.id} still has isVisible`)
				for (const m of (field.isVisibleExpression || '').matchAll(/\$\(options:(\w+)\)/g)) {
					const ref = def.options.find((f) => f.id === m[1])
					assert.ok(ref, `${kind} ${id}.${field.id} refers to a missing field ${m[1]}`)
					assert.strictEqual(ref.disableAutoExpression, true, `${kind} ${id}: ${m[1]} needs disableAutoExpression`)
				}
			}
		}
	}
})

test('presets: every preset is referenced by the structure and every reference exists', () => {
	for (const lists of [{}, { media: [{ name: 'KLIP' }, { name: '720/BELKA_A' }], templates: ['TPL'] }]) {
		const { self, structure, presets } = build(lists)
		const referenced = new Set()
		for (const section of structure) {
			for (const d of section.definitions) referenced.add(typeof d === 'string' ? d : d.presetId)
		}
		assert.deepStrictEqual([...referenced].sort(), Object.keys(presets).sort())
		for (const p of Object.values(presets)) {
			assert.strictEqual(p.type, 'simple')
			for (const step of p.steps) {
				for (const a of step.down) {
					const keys = Object.keys(
						self.actionDefs[a.actionId]
							? Object.fromEntries(self.actionDefs[a.actionId].options.map((o) => [o.id]))
							: {},
					)
					for (const k of Object.keys(a.options))
						assert.ok(keys.includes(k), `preset ${p.name}: ${a.actionId} has no option ${k}`)
				}
			}
		}
	}
})

test('presets: media and templates come as template groups with a local variable', () => {
	const { structure, presets } = build({ media: [{ name: 'KLIP' }, { name: '720/BELKA_A' }], templates: ['TPL'] })
	const group = structure.flatMap((s) => s.definitions).find((d) => d.type === 'template' && d.presetId === 'play_clip')
	assert.deepStrictEqual(group.templateValues, [
		{ name: 'KLIP', value: 'KLIP' },
		{ name: '720/BELKA_A', value: '720/BELKA_A' },
	])
	assert.strictEqual(group.templateVariableName, 'clip')
	assert.deepStrictEqual(presets.play_clip.localVariables, [
		{ variableType: 'simple', variableName: 'clip', startupValue: 'KLIP' },
	])
	assert.strictEqual(presets.play_clip.steps[0].down[0].options.clip, '$(local:clip)')
})
