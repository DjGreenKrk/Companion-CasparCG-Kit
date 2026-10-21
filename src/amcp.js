// AMCP client: line framing, response parsing and request/response matching.
//
// Measured on CasparCG 2.5.1: every channel has its own command queue, so replies to commands for different
// channels (and to commands without a channel, like VERSION or CLS) can come back in any order, while replies
// within one channel keep their order. Replies carry only the verb ("202 PLAY OK"), not the channel.
// So: a reply is matched to the oldest pending request with the same verb, and a request is held back while
// a request with the same verb is outstanding on another channel - that keeps the match unambiguous at the
// cost of a few ms for e.g. PLAY 1-10 + PLAY 2-10 in one button. Some commands never get a reply (`CALL 1-10
// SEEK` without a frame number) and `400 ERROR` is followed by an echo of the offending line.
const { EventEmitter } = require('node:events')

const CODE_TEXT = {
	100: 'INFO',
	101: 'INFO',
	200: 'OK',
	201: 'OK',
	202: 'OK',
	400: 'Command not understood',
	401: 'Illegal video channel',
	402: 'Parameter missing',
	403: 'Illegal parameter',
	404: 'Media file not found',
	500: 'Internal server error',
	501: 'Internal server error',
	502: 'Media file unreadable',
	503: 'Access error (channel locked?)',
}

// codes followed by exactly one data line
const SINGLE_LINE = new Set([101, 201, 400])

const HEADER_RE = /^(\d{3})\s+(\S+)(.*)$/

function verbOf(cmd) {
	const m = /^\s*(\S+)/.exec(cmd)
	return m ? m[1].toUpperCase() : ''
}

/** Server command queue a line goes to: its channel number, or 0 for commands without a channel. */
function queueOf(cmd) {
	const m = /^\s*\S+\s+(\d+)(?:-\d+)?(?:\s|$)/.exec(cmd)
	return m ? parseInt(m[1], 10) : 0
}

class AmcpParser extends EventEmitter {
	constructor() {
		super()
		this.buffer = Buffer.alloc(0)
		this.current = null
	}

	reset() {
		this.buffer = Buffer.alloc(0)
		this.current = null
	}

	push(chunk) {
		this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : Buffer.from(chunk)
		let idx
		// split on CRLF bytes before decoding, so multi-byte UTF-8 characters split across chunks stay intact
		while ((idx = this.buffer.indexOf('\r\n')) !== -1) {
			const line = this.buffer.subarray(0, idx).toString('utf8')
			this.buffer = this.buffer.subarray(idx + 2)
			this.line(line)
		}
	}

	line(line) {
		const cur = this.current
		if (cur) {
			if (cur.multi) {
				if (line === '') {
					this.finish()
				} else {
					cur.data.push(line)
				}
				return
			}
			// single data line expected; a header here means the server sent none (be tolerant)
			const m = HEADER_RE.exec(line)
			if (m && cur.code !== 400 && /^[A-Z]/.test(m[2])) {
				this.finish()
			} else {
				cur.data.push(line)
				this.finish()
				return
			}
		}
		const m = HEADER_RE.exec(line)
		if (!m) {
			this.emit('garbage', line)
			return
		}
		const code = parseInt(m[1], 10)
		this.current = { code, verb: m[2].toUpperCase(), status: (m[2] + m[3]).trim(), data: [], multi: code === 200 }
		if (code !== 200 && !SINGLE_LINE.has(code)) this.finish()
	}

	finish() {
		const r = this.current
		this.current = null
		r.ok = r.code >= 100 && r.code < 300
		r.text = CODE_TEXT[r.code] || 'Unknown'
		this.emit('response', r)
	}
}

class AmcpClient extends EventEmitter {
	/**
	 * @param {(data: string) => Promise<boolean> | boolean} write raw writer (socket)
	 */
	constructor(write, { timeout = 5000 } = {}) {
		super()
		this.write = write
		this.timeout = timeout
		this.pending = []
		this.outgoing = []
		this.parser = new AmcpParser()
		this.parser.on('response', (r) => this.onResponse(r))
		this.parser.on('garbage', (l) => this.emit('garbage', l))
	}

	data(chunk) {
		this.parser.push(chunk)
	}

	/**
	 * Send one AMCP line. The promise resolves with the reply ({code, ok, verb, status, data, text}) or with
	 * {noReply: true} on timeout / disconnect; it never rejects. Lines are written in call order; a line is
	 * written at once unless the same verb is outstanding on another channel (see top of file).
	 */
	send(cmd, { timeout } = {}) {
		cmd = String(cmd)
			.replace(/[\r\n]+/g, ' ')
			.trim()
		return new Promise((resolve) => {
			const req = { cmd, verb: verbOf(cmd), queue: queueOf(cmd), resolve, timeout: timeout ?? this.timeout }
			this.outgoing.push(req)
			this.flush()
		})
	}

	flush() {
		while (this.outgoing.length) {
			const req = this.outgoing[0]
			if (this.pending.some((p) => p.verb === req.verb && p.queue !== req.queue)) return
			this.outgoing.shift()
			req.sentAt = Date.now()
			req.timer = setTimeout(() => this.finish(req, { noReply: true, ok: false, text: 'No reply' }), req.timeout)
			this.pending.push(req)
			try {
				Promise.resolve(this.write(req.cmd + '\r\n')).catch(() => {})
			} catch (e) {
				this.finish(req, { noReply: true, ok: false, text: 'Not connected' })
			}
		}
	}

	finish(req, r) {
		const i = this.pending.indexOf(req)
		if (i !== -1) this.pending.splice(i, 1)
		clearTimeout(req.timer)
		r.cmd = req.cmd
		if (req.sentAt) r.ms = Date.now() - req.sentAt
		req.resolve(r)
		this.flush()
	}

	onResponse(r) {
		let req
		if (r.code === 400 && r.data.length) {
			const echo = r.data[0].trim().toUpperCase()
			req = this.pending.find((p) => p.cmd.toUpperCase() === echo)
		}
		if (!req) req = this.pending.find((p) => p.verb === r.verb)
		if (!req && r.code === 400) req = this.pending[0]
		if (!req) {
			this.emit('unsolicited', r)
			return
		}
		// earlier requests on the same channel queue were skipped by the server and will never be answered.
		// Only replies produced while executing prove that; parse errors (400...) may be sent out of turn.
		// Commands without a channel (VERSION, CLS - the latter waits for the media scanner) are not assumed ordered.
		const executed = (r.ok || r.code === 404) && req.queue !== 0
		for (const s of executed ? this.pending.filter((p) => p.queue === req.queue && p !== req) : []) {
			if (this.pending.indexOf(s) > this.pending.indexOf(req)) break
			this.finish(s, { noReply: true, ok: false, text: 'No reply' })
		}
		this.finish(req, r)
	}

	/** Connection lost: fail everything that is still waiting or queued. */
	reset() {
		this.parser.reset()
		for (const p of [...this.pending, ...this.outgoing.splice(0)]) {
			this.finish(p, { noReply: true, ok: false, text: 'Disconnected' })
		}
	}
}

module.exports = { AmcpClient, AmcpParser, verbOf, queueOf, CODE_TEXT }
