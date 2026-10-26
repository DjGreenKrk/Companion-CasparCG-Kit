// Live layer state from the OSC stream (OSC SUBSCRIBE <port>), so the module does not have to poll INFO: every polled
// INFO and its whole XML reply end up in the server log. Measured on 2.5.1:
// - every frame each channel sends a bundle with its complete state; a cleared layer is simply missing from it;
// - a big channel (60 layers) is split into several bundles of ~2 KB with the same timetag;
// - the addresses are the INFO XML elements (/channel/1/stage/layer/10/foreground/file/time [s, length]);
// - there is no output (consumer) state, outputs still need INFO.

/** Messages of an OSC packet: [{ address, args, timetag }] (bundles flattened, timetag of the outer bundle). */
function decodeOsc(buf, timetag = null, out = []) {
	if (buf.length >= 16 && buf.toString('latin1', 0, 8) === '#bundle\0') {
		const tt = timetag ?? buf.readBigUInt64BE(8)
		let i = 16
		while (i + 4 <= buf.length) {
			const n = buf.readInt32BE(i)
			if (n <= 0 || i + 4 + n > buf.length) break
			decodeOsc(buf.subarray(i + 4, i + 4 + n), tt, out)
			i += 4 + n
		}
		return out
	}
	if (buf[0] !== 0x2f) return out // not a message ("/address")
	let i = 0
	const str = () => {
		const end = buf.indexOf(0, i)
		if (end < 0) throw new Error('OSC string not terminated')
		const s = buf.toString('utf8', i, end)
		i = (end + 4) & ~3
		return s
	}
	const address = str()
	const tags = i < buf.length ? str() : ','
	const args = []
	for (const t of tags.slice(1)) {
		if (t === 'i') (args.push(buf.readInt32BE(i)), (i += 4))
		else if (t === 'f') (args.push(buf.readFloatBE(i)), (i += 4))
		else if (t === 'h') (args.push(Number(buf.readBigInt64BE(i))), (i += 8))
		else if (t === 'd') (args.push(buf.readDoubleBE(i)), (i += 8))
		else if (t === 's') args.push(str())
		else if (t === 'T' || t === 'F') args.push(t === 'T')
		else if (t === 'b') i += 4 + ((buf.readInt32BE(i) + 3) & ~3)
		else break // unknown type: the rest cannot be read
	}
	out.push({ address, args, timetag })
	return out
}

/**
 * One channel's messages -> { channel, tree } where tree has the shape xml2js gives for `INFO <channel>`
 * (stage.layer.layer_10.foreground.file.time = ['0.76', '20']), so state.js reads both the same way.
 */
function channelTree(messages) {
	let channel = null
	const tree = {}
	for (const { address, args } of messages) {
		const parts = address.split('/')
		if (parts[1] !== 'channel' || !/^\d+$/.test(parts[2])) continue
		channel = Number(parts[2])
		const path = []
		for (let k = 3; k < parts.length; k++) {
			// /stage/layer/10 -> stage.layer.layer_10 (the INFO element name)
			if (parts[k] === 'layer' && parts[k - 1] === 'stage' && /^\d+$/.test(parts[k + 1] ?? '')) {
				path.push('layer', `layer_${parts[++k]}`)
			} else path.push(parts[k])
		}
		if (!path.length) continue
		const values = args.map(String) // INFO gives text: 'true', '0.76'
		let node = tree
		for (const key of path.slice(0, -1)) {
			if (typeof node[key] !== 'object' || node[key] === null || Array.isArray(node[key])) node[key] = {}
			node = node[key]
		}
		node[path[path.length - 1]] = values.length === 1 ? values[0] : values
	}
	return { channel, tree }
}

/**
 * Collects the bundles of one frame per channel (same timetag) and hands the complete frame over when the next
 * frame of that channel starts. onFrame(channel, messages).
 */
class OscFrames {
	constructor(onFrame) {
		this.onFrame = onFrame
		this.open = new Map() // channel -> { timetag, messages }
	}

	packet(buf) {
		const byChannel = new Map()
		for (const m of decodeOsc(buf)) {
			const c = /^\/channel\/(\d+)\//.exec(m.address)
			if (!c) continue
			const ch = Number(c[1])
			if (!byChannel.has(ch)) byChannel.set(ch, [])
			byChannel.get(ch).push(m)
		}
		for (const [ch, messages] of byChannel) {
			const tt = messages[0].timetag
			const cur = this.open.get(ch)
			if (cur && tt !== null && cur.timetag === tt) {
				cur.messages.push(...messages)
				continue
			}
			if (cur) this.onFrame(ch, cur.messages)
			this.open.set(ch, { timetag: tt, messages })
		}
	}

	reset() {
		this.open.clear()
	}
}

module.exports = { decodeOsc, channelTree, OscFrames }
