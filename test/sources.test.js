const test = require('node:test')
const assert = require('node:assert')
const B = require('../src/build')

const at = { channel: '1', layer: '10', transition: 'CUT' }

test('mixer geometry in percent / degrees, with tween and defer', () => {
	assert.strictEqual(
		B.mixerGeometry({ ...at, property: 'CROP', crop_l: '10', crop_t: '0', crop_r: '50', crop_b: '100' }),
		'MIXER 1-10 CROP 0.1 0 0.5 1',
	)
	assert.strictEqual(
		B.mixerGeometry({
			...at,
			property: 'CLIP',
			clip_x: '0',
			clip_y: '0',
			clip_w: '50',
			clip_h: '100',
			duration: '25',
			tween: 'easeoutsine',
		}),
		'MIXER 1-10 CLIP 0 0 0.5 1 25 easeoutsine',
	)
	assert.strictEqual(
		B.mixerGeometry({ ...at, property: 'ROTATION', rotation: '-12.5', defer: true }),
		'MIXER 1-10 ROTATION -12.5 DEFER',
	)
	assert.strictEqual(
		B.mixerGeometry({ ...at, property: 'ANCHOR', anchor_x: '50', anchor_y: '50' }),
		'MIXER 1-10 ANCHOR 0.5 0.5',
	)
	assert.throws(
		() => B.mixerGeometry({ ...at, property: 'CROP', crop_l: 'x', crop_t: '0', crop_r: '1', crop_b: '1' }),
		/number/,
	)
	assert.throws(() => B.mixerGeometry({ ...at, layer: '', property: 'ROTATION', rotation: '5' }), /Layer is empty/)
})

test('blend mode list is checked, keyer on / off', () => {
	assert.strictEqual(B.mixerBlend({ ...at, blend: 'Screen' }), 'MIXER 1-10 BLEND screen')
	assert.throws(() => B.mixerBlend({ ...at, blend: 'neon' }), /Unknown blend/)
	assert.strictEqual(B.mixerKeyer({ ...at, keyer: true }), 'MIXER 1-10 KEYER 1')
	assert.strictEqual(B.mixerKeyer({ ...at, keyer: false }), 'MIXER 1-10 KEYER 0')
})

test('colours: picker number / css string + opacity -> #AARRGGBB; text list for gradients', () => {
	assert.strictEqual(B.hexColor(0xff0000), '#FFFF0000')
	assert.strictEqual(B.hexColor(0x0000ff, '50'), '#800000FF')
	assert.strictEqual(B.hexColor('rgb(0, 51, 102)'), '#FF003366')
	assert.strictEqual(B.hexColor('#c8ff67', 0), '#00C8FF67')
	assert.strictEqual(B.colorList('black'), 'BLACK')
	assert.strictEqual(B.colorList('#ff0000, #0000FF #80FFFFFF'), '#FF0000 #0000FF #80FFFFFF')
	assert.throws(() => B.colorList('pink'), /not a colour the server knows/)
	assert.throws(() => B.colorList('#f00'), /not a colour/)
})

test('PLAY_SOURCE builds each kind of source, transition last', () => {
	const p = (o) => B.playSource({ ...at, verb: 'PLAY', ...o })
	assert.strictEqual(
		p({ source: 'color', color: 0, transition: 'MIX', transition_duration: '25' }),
		'PLAY 1-10 #FF000000 MIX 25 linear',
	)
	assert.strictEqual(p({ source: 'color', color: 0, color_text: '#FF0000 #0000FF' }), 'PLAY 1-10 #FF0000 #0000FF')
	assert.strictEqual(
		p({ source: 'html', url: 'https://example.com/a b' }),
		'PLAY 1-10 [HTML] "https://example.com/a b"',
	)
	assert.strictEqual(p({ source: 'route', route_channel: '2', route_layer: '' }), 'PLAY 1-10 route://2')
	assert.strictEqual(p({ source: 'route', route_channel: '2', route_layer: '10' }), 'PLAY 1-10 route://2-10')
	assert.strictEqual(
		p({ source: 'stream', url: 'srt://10.0.0.5:9000?mode=caller' }),
		'PLAY 1-10 "srt://10.0.0.5:9000?mode=caller"',
	)
	assert.throws(() => p({ source: 'stream', url: 'klip' }), /not a stream address/)
	assert.strictEqual(p({ source: 'ndi', ndi_name: 'STUDIO PC/Cam 1' }), 'PLAY 1-10 "ndi://STUDIO PC/Cam 1"')
	assert.strictEqual(
		p({ source: 'decklink', device: '2', format: '1080i5000' }),
		'PLAY 1-10 DECKLINK 2 FORMAT 1080i5000',
	)
	assert.strictEqual(
		B.playSource({ ...at, verb: 'LOADBG', auto: true, source: 'color', color_text: 'BLACK' }),
		'LOADBG 1-10 BLACK AUTO',
	)
	assert.strictEqual(p({ source: 'color', color_text: 'BLACK', transition: 'STING' }), 'PLAY 1-10 BLACK')
})

test('scrolling image by speed or duration, speed change with tween', () => {
	assert.strictEqual(
		B.scrollPlay({ ...at, clip_dd: 'NAPISY', mode: 'speed', value: '4' }),
		'PLAY 1-10 "NAPISY" SPEED 4',
	)
	assert.strictEqual(
		B.scrollPlay({
			...at,
			clip: 'credits',
			mode: 'duration',
			value: '30',
			blur: '4',
			premultiply: true,
			transition: 'MIX',
			transition_duration: '25',
		}),
		'PLAY 1-10 "credits" DURATION 30 BLUR 4 PREMULTIPLY MIX 25 linear',
	)
	assert.throws(() => B.scrollPlay({ ...at, clip_dd: 'X', mode: 'speed', value: '0' }), /does not scroll/)
	assert.strictEqual(
		B.scrollSpeed({ ...at, value: '10', duration: '25', tween: 'easeinsine' }),
		'CALL 1-10 SPEED 10 25 easeinsine',
	)
	assert.strictEqual(B.scrollSpeed({ ...at, value: '0', duration: '0' }), 'CALL 1-10 SPEED 0')
})

test('web page call and reload, skip by seconds in channel frames', () => {
	assert.strictEqual(B.pageCall({ ...at, js: 'go("a")\n  next()' }), 'CALL 1-10 "go(\\"a\\") next()"')
	assert.strictEqual(B.pageCall({ ...at, reload: true, js: 'x' }), 'CALL 1-10 RELOAD')
	assert.strictEqual(B.seekRelative({ ...at, seconds: '-10' }, 50), 'CALL 1-10 SEEK REL -500')
	assert.strictEqual(B.seekRelative({ ...at, seconds: '2,5' }, 25), 'CALL 1-10 SEEK REL 63')
	assert.throws(() => B.seekRelative({ ...at, seconds: '10' }, 0), /frame rate/)
})

test('outputs: record presets, date in the name, stream, NDI, remove, snapshot twice', () => {
	const now = new Date(2026, 9, 22, 8, 5, 9)
	assert.strictEqual(B.fillDate('rec_{datetime}', now), 'rec_20261022_080509')
	assert.strictEqual(
		B.outputAdd({ channel: '1', index: '700', kind: 'file', path: 'rec/show_{date}', preset: 'h264' }, now),
		'ADD 1-700 FILE "rec/show_20261022.mp4" ' + B.RECORD_PRESETS.h264.args,
	)
	assert.strictEqual(
		B.outputAdd(
			{ channel: '1', index: '700', kind: 'file', path: 'a.mxf', preset: 'custom', args: '-codec:v mpeg2video' },
			now,
		),
		'ADD 1-700 FILE "a.mxf" -codec:v mpeg2video',
	)
	assert.strictEqual(
		B.outputAdd({
			channel: '2',
			index: '701',
			kind: 'stream',
			url: 'rtmp://a.rtmp.youtube.com/live2/KEY',
			stream_preset: 'rtmp',
			args: '-b:a 128k',
		}),
		'ADD 2-701 STREAM "rtmp://a.rtmp.youtube.com/live2/KEY" ' + B.STREAM_PRESETS.rtmp + ' -b:a 128k',
	)
	assert.strictEqual(
		B.outputAdd({ channel: '1', index: '702', kind: 'ndi', ndi_name: 'Caspar PGM' }),
		'ADD 1-702 NDI NAME "Caspar PGM"',
	)
	assert.throws(
		() => B.outputAdd({ channel: '1', index: '', kind: 'file', path: 'x', preset: 'h264' }),
		/Output number is empty/,
	)
	assert.strictEqual(B.outputRemove({ channel: '1', index: '700' }), 'REMOVE 1-700')
	assert.deepStrictEqual(B.snapshot({ channel: '1', name: 'snap_{time}.png' }, now), [
		{ cmd: 'ADD 1 IMAGE "snap_080509"' },
		{ cmd: 'ADD 1 IMAGE "snap_080509"', after: 500, key: 'snapshot-1' },
	])
})
