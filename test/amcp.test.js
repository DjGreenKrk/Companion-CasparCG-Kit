const test = require('node:test')
const assert = require('node:assert')
const { AmcpClient } = require('../src/amcp')

function client() {
	const sent = []
	const c = new AmcpClient((d) => sent.push(d), { timeout: 200 })
	return { c, sent, feed: (s) => c.data(Buffer.from(s, 'utf8')) }
}

test('simple 202 reply', async () => {
	const { c, sent, feed } = client()
	const p = c.send('PLAY 1-10 "KLIP"')
	assert.deepStrictEqual(sent, ['PLAY 1-10 "KLIP"\r\n'])
	feed('202 PLAY OK\r\n')
	const r = await p
	assert.strictEqual(r.code, 202)
	assert.ok(r.ok)
})

test('400 with echo line matches the right request and keeps sync', async () => {
	const { c, feed } = client()
	const a = c.send('NIEZNANA 1-10')
	const b = c.send('VERSION')
	feed('400 ERROR\r\nNIEZNANA 1-10\r\n201 VERSION OK\r\n2.5.1 N/A Stable\r\n')
	assert.strictEqual((await a).code, 400)
	const rb = await b
	assert.strictEqual(rb.code, 201)
	assert.deepStrictEqual(rb.data, ['2.5.1 N/A Stable'])
})

test('a command that never gets a reply is skipped, not shifted onto the next', async () => {
	const { c, feed } = client()
	const seek = c.send('CALL 2-11 SEEK')
	const play = c.send('PLAY 2-10 "X"')
	feed('202 PLAY OK\r\n')
	assert.strictEqual((await seek).noReply, true)
	assert.strictEqual((await play).code, 202)
})

test('200 multi-line until empty line, UTF-8 split across chunks', async () => {
	const { c, feed } = client()
	const p = c.send('CLS')
	const bytes = Buffer.from('200 CLS OK\r\n"720/BELKI/ŁUKASZ ŻÓŁĆ"  STILL  1 2 0 0/1\r\n\r\n', 'utf8')
	const cut = bytes.indexOf(Buffer.from('Ż')) + 1 // split inside a 2-byte character
	c.data(bytes.subarray(0, cut))
	c.data(bytes.subarray(cut))
	const r = await p
	assert.deepStrictEqual(r.data, ['"720/BELKI/ŁUKASZ ŻÓŁĆ"  STILL  1 2 0 0/1'])
})

test('201 INFO with embedded LF stays one data item', async () => {
	const { c, feed } = client()
	const p = c.send('INFO 1')
	feed('201 INFO OK\r\n<?xml version="1.0"?>\n<channel>\n</channel>\n\r\n')
	const r = await p
	assert.strictEqual(r.data.length, 1)
	assert.match(r.data[0], /<channel>/)
})

test('error codes without data', async () => {
	const { c, feed } = client()
	const a = c.send('PLAY 1-10 "NOPE"')
	const b = c.send('MIXER 1-10 OPACITY abc')
	feed('404 PLAY FAILED\r\n501 MIXER OPACITY FAILED\r\n')
	assert.strictEqual((await a).code, 404)
	const rb = await b
	assert.strictEqual(rb.code, 501)
	assert.strictEqual(rb.ok, false)
})

test('timeout resolves noReply', async () => {
	const { c } = client()
	const r = await c.send('CALL 1-10 SEEK')
	assert.strictEqual(r.noReply, true)
})

test('reset fails pending', async () => {
	const { c } = client()
	const p = c.send('INFO 1')
	c.reset()
	assert.strictEqual((await p).text, 'Disconnected')
})

test('replies from different channels out of order (measured on 2.5.1)', async () => {
	const { c, sent, feed } = client()
	const a = c.send('PLAY 1-32 "INTRO"')
	const b = c.send('PLAY 2-32 "NIEMA"')
	const m = c.send('MIXER 3-32 OPACITY 0.5')
	// the second PLAY is held back until the first is answered, the MIXER behind it as well
	assert.deepStrictEqual(sent, ['PLAY 1-32 "INTRO"\r\n'])
	feed('202 PLAY OK\r\n')
	assert.strictEqual((await a).code, 202)
	assert.strictEqual(sent.length, 3)
	feed('202 MIXER OK\r\n404 PLAY FAILED\r\n')
	assert.strictEqual((await b).code, 404)
	assert.strictEqual((await m).code, 202)
})

test('different verbs on different channels are pipelined and matched in any order', async () => {
	const { c, sent, feed } = client()
	const i1 = c.send('INFO 1')
	const v = c.send('VERSION')
	const cls = c.send('CLS')
	assert.strictEqual(sent.length, 3)
	feed('200 CLS OK\r\n"A"  STILL  1 2 0 0/1\r\n\r\n201 VERSION OK\r\n2.5.1\r\n201 INFO OK\r\n<channel/>\r\n')
	assert.strictEqual((await i1).data[0], '<channel/>')
	assert.strictEqual((await v).data[0], '2.5.1')
	assert.strictEqual((await cls).data.length, 1)
})

test('same channel keeps order: a skipped command on that channel is detected', async () => {
	const { c, feed } = client()
	const seek = c.send('CALL 2-11 SEEK')
	const loop = c.send('CALL 2-11 LOOP 1')
	const info = c.send('INFO 2')
	feed('201 CALL OK\r\n1\r\n')
	// the CALL reply is taken by the oldest CALL; the INFO reply then proves nothing else is coming on channel 2
	feed('201 INFO OK\r\n<channel/>\r\n')
	await seek
	assert.strictEqual((await loop).noReply, true)
	assert.strictEqual((await info).code, 201)
})
