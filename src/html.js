// Custom HTML graphics without a template file on the server (verified on CasparCG 2.5.1):
// `PLAY ch-l [HTML] "data:..."` loads a small host page from the command itself (the server refuses data URLs
// longer than ~4 KB, and CG ADD does not take data URLs at all), then `CG ch-l UPDATE 1 "<json>"` sends the
// user's HTML, CSS, animation and field texts. CG UPDATE answers 403 until the page has loaded (~60 ms).
const { str, truthy, int, parsePairs, dataParam, address } = require('./build')

const ANIMATIONS = [
	{ id: 'slide_left', label: 'Slide in from the left' },
	{ id: 'slide_right', label: 'Slide in from the right' },
	{ id: 'slide_bottom', label: 'Slide up from the bottom' },
	{ id: 'wipe', label: 'Wipe from the left' },
	{ id: 'fade', label: 'Fade' },
	{ id: 'none', label: 'None (cut)' },
]

// Host page. play()/stop() animate the whole graphic; the slide distance is measured from the graphic itself,
// so it starts just outside the frame. update() takes JSON or <templateData> XML; keys starting with $ are control
// values ($html, $css, $anim, $dur, $play), the rest fill elements with data-f="<key>". next() toggles class "next".
const HOST_PAGE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}#g{position:absolute;left:0;top:0;width:100%;height:100%;visibility:hidden}</style><style id="s"></style><div id="g"></div><script>
var g=document.getElementById("g"),D={},A="slide_left",T=500,b,on=0;
function P(d){try{return JSON.parse(d)}catch(e){}var o={},c=new DOMParser().parseFromString(d,"text/xml").getElementsByTagName("componentData");for(var i=0;i<c.length;i++){var v=c[i].getElementsByTagName("data")[0];if(v)o[c[i].getAttribute("id")]=v.getAttribute("value")}return o}
function R(){var e=g.querySelectorAll("[data-f]");for(var i=0;i<e.length;i++)e[i].textContent=D[e[i].getAttribute("data-f")]||""}
function B(){var e=g.querySelectorAll("*"),b={l:innerWidth,t:innerHeight,r:0};for(var i=0;i<e.length;i++){var r=e[i].getBoundingClientRect();if(r.width&&r.height){b.l=Math.min(b.l,r.left);b.t=Math.min(b.t,r.top);b.r=Math.max(b.r,r.right)}}return b}
function C(x){return "inset(0 "+x+"px 0 0)"}
function M(){var s=g.style;s.transition="none";s.transform="none";s.clipPath="none";s.opacity=1;b=B()}
function tr(on){var s=g.style;s.transition=A!="none"?"transform "+T+"ms,opacity "+T+"ms,clip-path "+T+"ms":"none";s.transitionTimingFunction=on?"ease-out":"ease-in"}
function hid(){var s=g.style,W=innerWidth;s.transform=A=="slide_left"?"translateX("+(-b.r)+"px)":A=="slide_right"?"translateX("+(W-b.l)+"px)":A=="slide_bottom"?"translateY("+(innerHeight-b.t)+"px)":"none";s.opacity=A=="fade"?0:1;s.clipPath=A=="wipe"?C(W-b.l):"none"}
function vis(){var s=g.style;s.transform="none";s.opacity=1;s.clipPath=A=="wipe"?C(innerWidth-b.r):"none"}
g.addEventListener("transitionend",function(e){if(on&&e.propertyName=="clip-path"){g.style.transition="none";g.style.clipPath="none"}});
function play(){M();hid();void g.offsetWidth;g.style.visibility="visible";on=1;tr(1);vis()}
function stop(){M();vis();void g.offsetWidth;on=0;tr(0);hid()}
function next(){g.classList.toggle("next")}
function update(d){var o=P(d);if("$html" in o){document.getElementById("s").textContent=o.$css||"";g.innerHTML=o.$html}if(o.$anim)A=o.$anim;if(o.$dur!=null)T=+o.$dur;for(var k in o)if(k[0]!="$")D[k]=o[k];R();if(o.$play)play()}
</script>`

const DEFAULT_HTML = '<div class="lt">\n  <div class="name">{{f0}}</div>\n  <div class="role">{{f1}}</div>\n</div>'
const DEFAULT_CSS = [
	'.lt { position: absolute; left: 6vw; bottom: 12vh; font-family: "DejaVu Sans", sans-serif; color: #fff; }',
	'.name { background: #C62828; padding: 1.2vh 2vw; font-size: 4.6vh; font-weight: bold; }',
	'.role { background: #1E2A44; padding: 0.8vh 2vw; font-size: 3.2vh; display: inline-block; }',
].join('\n')

/** Graphic name as it appears in the layer state / tally: HTML:<NAME>. */
const safeName = (n) =>
	str(n)
		.replace(/[^A-Za-z0-9_-]/g, '_')
		.slice(0, 40)

function hostUrl(name) {
	const n = safeName(name)
	return `data:text/html;charset=utf-8;${n ? `gfx=${n};` : ''}base64,${Buffer.from(HOST_PAGE).toString('base64')}`
}

/** {{f0}} -> <span data-f="f0"></span>; the host page fills it with the field text (as text, not HTML). */
const placeholders = (html) => html.replace(/\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g, '<span data-f="$1"></span>')

function payload(o, { play }) {
	const html = str(o.html)
	if (!html) throw new Error('Custom HTML is empty')
	const dur = int(o.duration, 'Animation time', { optional: true }) ?? 500
	const anim = ANIMATIONS.some((a) => a.id === o.animation) ? o.animation : 'slide_left'
	const data = { $html: placeholders(html), $css: str(o.css), $anim: anim, $dur: dur }
	Object.assign(data, str(o.fields) ? parsePairs(str(o.fields)) : {})
	if (play) data.$play = 1
	return JSON.stringify(data)
}

/** Lines for runOrdered: load the host page, then hand it the graphic (retrying while the page loads). */
function show(o) {
	const addr = address(o.channel, o.layer, { layerRequired: true })
	return [
		{ cmd: `PLAY ${addr} [HTML] "${hostUrl(o.name)}"`, cancelClear: addr },
		{ cmd: `CG ${addr} UPDATE 1 ${dataParam(payload(o, { play: truthy(o.playonload) }))}`, retry403: true },
	]
}

function hide(o) {
	const addr = address(o.channel, o.layer, { layerRequired: true })
	const after = int(o.clear_after, 'Clear after', { optional: true })
	const lines = [`CG ${addr} STOP 1`]
	if (after !== null) lines.push({ cmd: `CLEAR ${addr}`, after, key: addr })
	return lines
}

module.exports = {
	ANIMATIONS,
	HOST_PAGE,
	DEFAULT_HTML,
	DEFAULT_CSS,
	hostUrl,
	placeholders,
	payload,
	show,
	hide,
	safeName,
}
