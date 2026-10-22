const test = require('node:test')
const assert = require('node:assert')
const B = require('../src/build')

const base = { channel: '1', layer: '10', clip_dd: '', clip: '', transition: 'CUT' }

test('PLAY with list clip, cut', () => {
	assert.deepStrictEqual(B.playLike('PLAY', { ...base, clip_dd: 'KLIP' }), ['PLAY 1-10 "KLIP"'])
})

test('clip override wins, backslashes become slashes, quotes escaped', () => {
	const l = B.playLike('PLAY', { ...base, clip_dd: 'KLIP', clip: 'BELKI\\Łukasz "Ż"' })
	assert.deepStrictEqual(l, ['PLAY 1-10 "BELKI/Łukasz \\"Ż\\""'])
})

test('full PLAY: loop, seek, length, eased slide, direction last, MIXER CLEAR first', () => {
	const l = B.playLike('PLAY', {
		...base,
		clip_dd: 'BELKA_A',
		loop: true,
		seek: '50',
		length: '100',
		clear_mixer: true,
		transition: 'SLIDE',
		transition_duration: '50',
		transition_tween: 'EaseOutSine',
		direction: 'RIGHT',
	})
	assert.deepStrictEqual(l, [
		'MIXER 1-10 CLEAR',
		'PLAY 1-10 "BELKA_A" LOOP SEEK 50 LENGTH 100 SLIDE 50 easeoutsine RIGHT',
	])
})

test('AUTO only on LOADBG', () => {
	assert.deepStrictEqual(B.playLike('PLAY', { ...base, clip_dd: 'X', auto: true }), ['PLAY 1-10 "X"'])
	assert.deepStrictEqual(
		B.playLike('LOADBG', {
			...base,
			clip_dd: 'X',
			auto: true,
			loop: true,
			transition: 'MIX',
			transition_duration: '20',
		}),
		['LOADBG 1-10 "X" LOOP AUTO MIX 20 linear'],
	)
})

test('PLAY without clip plays the background, LOADBG without clip is an error', () => {
	assert.deepStrictEqual(B.playLike('PLAY', { ...base, transition: 'MIX' }), ['PLAY 1-10'])
	assert.throws(() => B.playLike('LOADBG', base), /needs a clip/)
})

test('invalid tweens and parameters are caught before sending', () => {
	assert.throws(() => B.tween('EASEOUTEASE'), /tween table/)
	assert.throws(() => B.tween('easeoutelastic:1:0.35'), /one decimal/)
	assert.strictEqual(B.tween('easeoutelastic:1:0.3'), 'easeoutelastic:1:0.3')
	assert.strictEqual(B.tween('easeoutintback'), 'easeoutintback')
	assert.throws(() => B.tween('easeoutinback'), /tween table/)
})

test('direction only for PUSH/SLIDE/WIPE', () => {
	assert.throws(() => B.transition({ transition: 'MIX', transition_duration: '10', direction: 'LEFT' }), /no direction/)
	assert.strictEqual(B.transition({ transition: 'VFADE', transition_duration: '10' }), 'VFADE 10 linear')
})

test('STING key-value form and cut mode', () => {
	assert.strictEqual(
		B.transition({
			transition: 'STING',
			sting_mask: 'STING_MASK',
			sting_overlay: 'STING_OVERLAY',
			sting_trigger: '10',
		}),
		'STING (MASK="STING_MASK" TRIGGER_POINT=10 OVERLAY="STING_OVERLAY")',
	)
	assert.strictEqual(
		B.transition({ transition: 'STING', sting_cut: true, sting_overlay: 'O', sting_trigger: '25' }),
		'STING (MASK="EMPTY" TRIGGER_POINT=25 OVERLAY="O")',
	)
})

test('channel / layer validation', () => {
	assert.throws(() => B.playLike('PLAY', { ...base, layer: 'abc', clip_dd: 'X' }), /whole number/)
	assert.throws(() => B.simple('CLEAR', { channel: '', layer: '' }), /Channel is empty/)
	assert.strictEqual(B.simple('CLEAR', { channel: '2', layer: '' }), 'CLEAR 2')
})

test('CALL params', () => {
	assert.strictEqual(B.callParam({ channel: '1', layer: '12', param: 'LOOP', loop_value: false }), 'CALL 1-12 LOOP 0')
	assert.strictEqual(
		B.callParam({ channel: '1', layer: '12', target: 'bg', param: 'LOOP', loop_value: true }),
		'CALLBG 1-12 LOOP 1',
	)
	assert.strictEqual(B.callParam({ channel: '1', layer: '12', param: 'SEEK', value: '0' }), 'CALL 1-12 SEEK 0')
	assert.throws(() => B.callParam({ channel: '1', layer: '12', param: 'SEEK', value: '' }), /empty/)
})

test('mixer values in percent', () => {
	assert.strictEqual(
		B.mixerProp({ channel: '1', layer: '10', property: 'OPACITY', value: '50', duration: '25', tween: 'easeinsine' }),
		'MIXER 1-10 OPACITY 0.5 25 easeinsine',
	)
	assert.strictEqual(
		B.mixerProp({ channel: '1', layer: '10', property: 'VOLUME', value: '0', duration: '0' }),
		'MIXER 1-10 VOLUME 0',
	)
	assert.throws(() => B.mixerProp({ channel: '1', layer: '', property: 'VOLUME', value: '0' }), /Layer is empty/)
	assert.strictEqual(
		B.mixerFill({ channel: '1', layer: '10', x: '-100', y: '0', sx: '100', sy: '100', duration: '25' }),
		'MIXER 1-10 FILL -1 0 1 1 25 linear',
	)
	assert.strictEqual(
		B.mixerFill({ channel: '1', layer: '10', x: '50', y: '0', sx: '100', sy: '100', defer: true }),
		'MIXER 1-10 FILL 0.5 0 1 1 DEFER',
	)
	assert.strictEqual(B.masterVolume({ channel: '2', value: '80' }), 'MIXER 2 MASTERVOLUME 0.8')
})

test('CG ADD with fields as JSON and XML', () => {
	const o = {
		channel: '1',
		layer: '20',
		template_dd: 'TPL_BELKA',
		playonload: true,
		templatelayer: '1',
		variables: 'f0="Jan Kowalski" f1="Łódź"',
		json: true,
	}
	assert.strictEqual(B.cg('ADD', o), 'CG 1-20 ADD 1 "TPL_BELKA" 1 "{\\"f0\\":\\"Jan Kowalski\\",\\"f1\\":\\"Łódź\\"}"')
	const x = B.cg('ADD', { ...o, json: false })
	assert.match(x, /^CG 1-20 ADD 1 "TPL_BELKA" 1 "<templateData><componentData id=\\"f0\\">/)
	assert.strictEqual(B.cg('STOP', { channel: '1', layer: '20', templatelayer: '1' }), 'CG 1-20 STOP 1')
	assert.strictEqual(B.cg('ADD', { ...o, variables: '', playonload: false }), 'CG 1-20 ADD 1 "TPL_BELKA" 0')
})

test('CG data: backslashes doubled for the page (2.5.1 escapes only quotes in update("..."))', () => {
	// JSON {"k":"q\"q"} -> page must get it verbatim -> data q\\"q -> AMCP-quoted
	assert.strictEqual(B.dataParam('{"k":"q\\"q"}'), '"{\\"k\\":\\"q\\\\\\\\\\"q\\"}"')
	assert.strictEqual(B.dataParam('<x v="C:\\new"/>'), '"<x v=\\"C:\\\\\\\\new\\"/>"')
})

test('template data: quotes, commas and "=" inside values (text from variables)', () => {
	const d = (variables, json = true) => B.templateData({ variables, json })
	assert.strictEqual(d('f0="Jan "Kowal" Nowak" f1="x"'), '{"f0":"Jan \\"Kowal\\" Nowak","f1":"x"}')
	assert.strictEqual(d('f0="a=b, c", f1="Kraków"'), '{"f0":"a=b, c","f1":"Kraków"}')
	assert.strictEqual(d('f0="" f1="x"'), '{"f0":"","f1":"x"}')
	assert.strictEqual(
		d('f0="<b>&"', false),
		'<templateData><componentData id="f0"><data id="text" value="&lt;b>&amp;" /></componentData></templateData>',
	)
})

test('SWAP (2.x built "NaN" here)', () => {
	assert.strictEqual(
		B.swap({ channel1: '1', layer1: '10', channel2: '2', layer2: '10', transforms: true }),
		'SWAP 1-10 2-10 TRANSFORMS',
	)
	assert.strictEqual(B.swap({ channel1: '1', layer1: '', channel2: '2', layer2: '' }), 'SWAP 1 2')
})

test('sting clip names with spaces are rejected', () => {
	assert.throws(() => B.transition({ transition: 'STING', sting_mask: 'BELKI/BELKA SPACJA' }), /space/)
})

test('CG data as an object: update({...}) by CG INVOKE', () => {
	const o = {
		channel: '1',
		layer: '20',
		templatelayer: '1',
		pass_as: 'object',
		template_dd: 'PRELEGENT',
		playonload: true,
	}
	assert.strictEqual(
		B.cg('UPDATE', { ...o, variables: 'name="Jan "J" Kowalski"\naccent="#c8ff67"' }),
		'CG 1-20 INVOKE 1 "update({\\"name\\":\\"Jan \\\\\\"J\\\\\\" Kowalski\\",\\"accent\\":\\"#c8ff67\\"})"',
	)
	// raw call pasted as written: new lines joined, trailing ";" dropped
	const raw = 'update({\n  name: "Jan",\n  label: "PRELEGENT"\n});'
	assert.strictEqual(
		B.objectCall({ data_format: 'raw', variables: raw }),
		'update({ name: "Jan", label: "PRELEGENT" })',
	)
	assert.strictEqual(B.objectCall({ data_format: 'raw', variables: '{ name: "Jan" }' }), 'update({ name: "Jan" })')
	assert.strictEqual(B.objectCall({ data_format: 'raw', variables: 'show("a")' }), 'show("a")')
	// ADD: load without data, hand over the object, then play
	assert.deepStrictEqual(B.cg('ADD', { ...o, data_format: 'raw', variables: raw }), [
		'CG 1-20 ADD 1 "PRELEGENT" 0',
		'CG 1-20 INVOKE 1 "update({ name: \\"Jan\\", label: \\"PRELEGENT\\" })"',
		'CG 1-20 PLAY 1',
	])
	assert.deepStrictEqual(B.cg('ADD', { ...o, variables: '', playonload: true }), ['CG 1-20 ADD 1 "PRELEGENT" 1'])
	assert.strictEqual(B.cg('INVOKE', { ...o, method: 'next();' }), 'CG 1-20 INVOKE 1 "next()"')
})

test('layer numbers beyond 32 bits are refused (2.5.1 would play them on layer 0)', () => {
	assert.deepStrictEqual(B.playLike('PLAY', { ...base, layer: '2147483647', clip_dd: 'X' }), ['PLAY 1-2147483647 "X"'])
	assert.throws(() => B.playLike('PLAY', { ...base, layer: '2147483648', clip_dd: 'X' }), /at most/)
	assert.throws(() => B.playLike('PLAY', { ...base, layer: '-5', clip_dd: 'X' }), /at least 0/)
})
