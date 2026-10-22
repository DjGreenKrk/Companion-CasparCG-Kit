const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const S = require('../src/state')
const V = require('../src/variables')
const upgrades = require('../src/upgrades')

const paths = { media: '/opt/casparcg/media/', template: '/opt/casparcg/template/' }

test('INFO XML from 2.5.1: clip, still, template, background, time', async () => {
	const xml = fs.readFileSync(path.join(__dirname, 'info_ch2.xml'), 'utf8')
	const st = await S.parseChannelInfo(xml, paths)
	assert.strictEqual(st.framerate, 50)
	assert.strictEqual(st.format, '720p5000')
	const l10 = st.layers['10']
	assert.strictEqual(l10.fg.name, '720/KLIP')
	assert.strictEqual(l10.fg.loop, true)
	assert.strictEqual(l10.bg.name, '720/BELKA_B')
	assert.strictEqual(st.layers['20'].fg.name, '720/BELKA_A')
	assert.strictEqual(S.layerState(st.layers['20'], 50), 'paused')
	assert.strictEqual(st.layers['30'].fg.name, 'TEST_HTML')
	const l11 = st.layers['11'].fg
	assert.strictEqual(l11.name, '720/INNY')
	assert.ok(l11.time >= 9 && l11.duration === 10, `time ${l11.time} / ${l11.duration}`)
	assert.strictEqual(S.layerState(st.layers['11'], 50), 'ended')
	assert.strictEqual(S.layerState(undefined, 50), 'empty')
})

test('CLS / TLS / INFO list parsing', () => {
	const m = S.parseCls([
		'"720/KLIP"  MOVIE  558245 20261021152216 500 1/50',
		'"BELKA_A"  STILL  13272 20261021150250 0 0/1',
	])
	assert.deepStrictEqual(m[0], { name: '720/KLIP', type: 'MOVIE', frames: 500, fps: 50 })
	assert.strictEqual(m[1].type, 'STILL')
	assert.deepStrictEqual(S.parseTls(['TEST_HTML', '"OLD" 1234 x']), ['TEST_HTML', 'OLD'])
	assert.deepStrictEqual(S.parseChannelList(['1 1080p5000 PLAYING']), [{ channel: 1, format: '1080p5000' }])
})

test('variables', () => {
	const v = V.layerValues('1-10', { fg: { name: 'KLIP', time: 2.5, duration: 10, loop: false }, bg: null }, 'playing')
	assert.strictEqual(v.c1_l10_remaining, '00:08')
	assert.strictEqual(v.c1_l10_time, '00:02')
	assert.strictEqual(v.c1_l10_remaining_s, 8)
	assert.strictEqual(v.c1_l10_progress, 25)
	assert.strictEqual(V.mmss(3725), '1:02:05')
})

test('upgrade from 2.x options', () => {
	const actions = [
		{
			id: 'a',
			actionId: 'PLAY',
			options: {
				channel: '1',
				layer: '',
				clip_dd: 'X',
				clip: '',
				loop: 'true',
				auto: 'false',
				transition: 'MIX',
				transition_duration: '25',
				transition_tween: 'linear',
			},
		},
		{ id: 'b', actionId: 'COMMAND', options: { cmd: 'CLEAR 1' } },
		{ id: 'c', actionId: 'CG ADD', options: { playonload: 'true', json: false } },
	]
	const r = upgrades[0]({}, { actions, feedbacks: [], config: null })
	assert.strictEqual(r.updatedActions.length, 2)
	assert.strictEqual(actions[0].options.loop, true)
	assert.strictEqual(actions[0].options.auto, false)
	assert.strictEqual(actions[0].options.direction, '')
	assert.strictEqual(actions[2].options.playonload, true)
	assert.strictEqual(actions[2].options.data_format, 'pairs')
})

test('outputs from INFO <channel>: number, path, running time', async () => {
	const xml = `<?xml version="1.0" encoding="utf-8"?><channel><format>1080p2500</format><framerate>25</framerate><framerate>1</framerate>
<output><port><port_701><consumer>ffmpeg</consumer><file><fps>25</fps><frame>72</frame><path>/opt/casparcg/rec/a.mp4</path></file></port_701>
<port_703><consumer>ffmpeg</consumer><file><fps>25</fps><frame>43</frame><path>rtmp://127.0.0.1/live/test</path></file></port_703></port></output></channel>`
	const st = await S.parseChannelInfo(xml, null)
	assert.deepStrictEqual(st.outputs, {
		701: { consumer: 'ffmpeg', path: '/opt/casparcg/rec/a.mp4', frames: 72, seconds: 2.88 },
		703: { consumer: 'ffmpeg', path: 'rtmp://127.0.0.1/live/test', frames: 43, seconds: 1.72 },
	})
})

test('a stream output without a frame counter is not running', () => {
	assert.strictEqual(S.outputRunning({ consumer: 'ffmpeg', path: 'srt://x', frames: null, seconds: null }), false)
	assert.strictEqual(S.outputRunning({ consumer: 'ffmpeg', path: 'a.mp4', frames: 0, seconds: 0 }), true)
	assert.strictEqual(S.outputRunning(undefined), false)
})
