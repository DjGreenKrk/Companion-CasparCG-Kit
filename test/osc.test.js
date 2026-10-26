const test = require('node:test')
const assert = require('node:assert')
const S = require('../src/state')
const { decodeOsc, channelTree, OscFrames } = require('../src/osc')

// channel 3 of CasparCG 2.5.1 (OSC SUBSCRIBE): "simple" = 3-10 TRESC_A looping with TRESC_B cued (LOADBG MIX 25),
// 3-20 a paused still; "split" = one frame with 62 layers, sent as 17 packets with the same timetag
const fixture = require('./osc_ch3.json')
const packets = (k) => fixture[k].map((b) => Buffer.from(b, 'base64'))
const paths = { media: '/opt/casparcg/media/', template: '/opt/casparcg/template/' }

test('OSC frame reads like INFO: clip, loop, time, cued clip with transition, still by path', () => {
	const st = S.channelFromTree(channelTree(decodeOsc(packets('simple')[0])).tree, paths)
	assert.strictEqual(st.format, '1080p2500')
	assert.strictEqual(st.framerate, 25)
	const l10 = st.layers[10]
	assert.strictEqual(l10.fg.producer, 'ffmpeg')
	assert.strictEqual(l10.fg.name, 'AO/TRESC_A')
	assert.strictEqual(l10.fg.loop, true)
	assert.strictEqual(l10.fg.paused, false)
	assert.strictEqual(l10.fg.duration, 20)
	assert.ok(l10.fg.time > 0 && l10.fg.time < 20)
	assert.strictEqual(l10.bg.name, 'AO/TRESC_B')
	assert.strictEqual(l10.bg.transition, 'mix')
	assert.strictEqual(l10.bg.producer, 'ffmpeg')
	assert.deepStrictEqual(
		{ producer: st.layers[20].fg.producer, name: st.layers[20].fg.name, paused: st.layers[20].fg.paused },
		{ producer: 'image', name: 'AO/STILL_A', paused: true },
	)
	assert.strictEqual(st.layers[20].bg, null)
	assert.strictEqual(S.layerState(st.layers[20], 25), 'paused')
	assert.deepStrictEqual(Object.keys(st.outputs), [])
})

test('a frame split into several packets is put together before it is read', () => {
	const frames = []
	const f = new OscFrames((ch, messages) => frames.push({ ch, messages }))
	// the capture starts with the end of the previous frame: keep the packets of the last frame only
	const all = packets('split')
	const last = all[all.length - 1].readBigUInt64BE(8)
	const split = all.filter((p) => p.readBigUInt64BE(8) === last)
	assert.ok(split.length >= 5)
	for (const p of split) f.packet(p)
	assert.strictEqual(frames.length, 0) // the frame is complete only when the next one starts
	const next = Buffer.from(packets('simple')[0])
	next.writeBigUInt64BE(next.readBigUInt64BE(8) + 1n, 8)
	f.packet(next)
	assert.strictEqual(frames.length, 1)
	assert.strictEqual(frames[0].ch, 3)
	const st = S.channelFromTree(channelTree(frames[0].messages).tree, paths)
	assert.strictEqual(Object.keys(st.layers).length, 62)
	assert.strictEqual(st.layers[89].fg.name, 'AO/STILL_A')
})

test('an empty channel has no layers; garbage is ignored', () => {
	const st = S.channelFromTree(
		channelTree([
			{ address: '/channel/2/format', args: ['720p5000'] },
			{ address: '/channel/2/framerate', args: [50, 1] },
		]).tree,
		paths,
	)
	assert.deepStrictEqual(st.layers, {})
	assert.strictEqual(st.framerate, 50)
	assert.deepStrictEqual(decodeOsc(Buffer.from('not osc')), [])
})
