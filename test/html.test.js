const test = require('node:test')
const assert = require('node:assert')
const H = require('../src/html')
const { nameFromPath } = require('../src/state')

const base = { channel: '1', layer: '20', name: 'belka', html: '<b>{{f0}}</b><i>{{ f1 }}</i>', css: 'b{color:red}' }

test('show: host page from the command, then the graphic by CG UPDATE (retried while loading)', () => {
	const [play, upd] = H.show({
		...base,
		fields: 'f0="Jan "Kowal" Nowak" f1="<Łódź>"',
		animation: 'wipe',
		duration: '300',
		playonload: true,
	})
	assert.match(play.cmd, /^PLAY 1-20 \[HTML\] "data:text\/html;charset=utf-8;gfx=belka;base64,[A-Za-z0-9+/=]+"$/)
	assert.strictEqual(play.cancelClear, '1-20')
	// the server refuses data URLs longer than ~4 KB
	assert.ok(play.cmd.length < 3500, `host URL is ${play.cmd.length} chars`)
	assert.strictEqual(upd.retry403, true)
	assert.match(upd.cmd, /^CG 1-20 UPDATE 1 "\{.*\}"$/)
	const data = JSON.parse(
		H.payload(
			{ ...base, fields: 'f0="Jan "Kowal" Nowak" f1="<Łódź>"', animation: 'wipe', duration: '300' },
			{ play: true },
		),
	)
	assert.deepStrictEqual(data, {
		$html: '<b><span data-f="f0"></span></b><i><span data-f="f1"></span></i>',
		$css: 'b{color:red}',
		$anim: 'wipe',
		$dur: 300,
		f0: 'Jan "Kowal" Nowak',
		f1: '<Łódź>',
		$play: 1,
	})
})

test('show: loaded hidden, defaults, errors', () => {
	const data = JSON.parse(H.payload({ ...base, animation: 'bogus', duration: '' }, { play: false }))
	assert.strictEqual(data.$anim, 'slide_left')
	assert.strictEqual(data.$dur, 500)
	assert.ok(!('$play' in data))
	assert.throws(() => H.show({ ...base, html: '' }), /empty/)
	assert.throws(() => H.show({ ...base, layer: '' }), /Layer/)
	assert.match(H.hostUrl('a b/ż'), /;gfx=a_b__;/)
})

test('hide: CG STOP, CLEAR after the out-animation', () => {
	assert.deepStrictEqual(H.hide({ channel: '2', layer: '20', clear_after: '600' }), [
		'CG 2-20 STOP 1',
		{ cmd: 'CLEAR 2-20', after: 600, key: '2-20' },
	])
	assert.deepStrictEqual(H.hide({ channel: '2', layer: '20', clear_after: '' }), ['CG 2-20 STOP 1'])
})

test('layer state name of a custom HTML graphic', () => {
	assert.strictEqual(nameFromPath(H.hostUrl('belka')), 'HTML:BELKA')
	assert.strictEqual(nameFromPath('data:text/html;base64,AAAA'), 'HTML')
})
