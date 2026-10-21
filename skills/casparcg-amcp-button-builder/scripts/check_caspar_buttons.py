#!/usr/bin/env python3
"""Check the CasparCG AMCP commands in a Bitfocus Companion .companionconfig export for known pitfalls.

Usage:
    python check_caspar_buttons.py export.companionconfig [--fps 50] [--page N]

Reads every button step, takes the caspar COMMAND actions (raw AMCP lines) and internal waits, and reports
problems that were verified on CasparCG 2.5.1 (see references/amcp-commands.md). Works with Companion
3.x-5.x exports (plain option values and 5.1 {"isExpression", "value"} objects). Output is UTF-8.
"""
import argparse
import io
import json
import re
import sys

TWEENS = {"linear", "easenone"} | {
    f"ease{k}{f}" for k in ("in", "out", "inout", "outin")
    for f in ("quad", "cubic", "quart", "quint", "sine", "expo", "circ", "elastic", "back", "bounce")
}
TWEENS = (TWEENS - {"easeoutinback"}) | {"easeoutintback"}
DIRECTIONS = {"LEFT", "RIGHT", "UP", "DOWN", "FROMLEFT", "FROMRIGHT", "FROMTOP", "FROMBOTTOM"}
TRANSITIONS = {"CUT", "MIX", "PUSH", "SLIDE", "WIPE", "VFADE", "FADECUT", "CUTFADE"}
REMOVED = [
    (r"^MIXER\s+\S+\s+(MIPMAP|STRAIGHT_ALPHA_OUTPUT)\b", "MIXER {0} no longer exists in 2.5 (400 ERROR)"),
    (r"^INFO\s+(SYSTEM|SERVER|QUEUES|THREADS|TEMPLATE)\b", "INFO {0} no longer exists in 2.5 (returns plain INFO)"),
    (r"^CG\s+\S+\s+INFO\b", "CG ... INFO no longer exists in 2.5 (400 ERROR)"),
    (r"^LOG\s+CATEGORY\b", "LOG CATEGORY no longer exists in 2.5 (400 ERROR)"),
    (r"^HELP\b", "HELP no longer exists in 2.5 (400 ERROR)"),
    (r"^CHANNEL_GRID\b", "CHANNEL_GRID takes over the LAST channel (adds a window, overwrites layers 1..n)"),
]
TRANSFORMS = r"FILL|OPACITY|VOLUME|CROP|CLIP|ROTATION|ANCHOR|PERSPECTIVE|BRIGHTNESS|SATURATION|CONTRAST|LEVELS|KEYER|BLEND|CHROMA"


def val(v):
    return v.get("value") if isinstance(v, dict) and "value" in v else v


def label(ctl):
    style = ctl.get("style", {})
    if "text" in style:
        return val(style["text"])
    for layer in style.get("layers", []):
        if layer.get("type") == "text":
            return val(layer.get("text")) or ""
    return ""


def tokens(cmd):
    return re.findall(r'"(?:[^"\\]|\\.)*"|\S+', cmd)


def check_command(cmd, fps):
    """Problems of one AMCP line, independent of context."""
    out = []
    up = cmd.upper()
    toks = tokens(cmd)
    head = toks[0].upper() if toks else ""
    for rx, msg in REMOVED:
        m = re.match(rx, up)
        if m:
            out.append(msg.format(*(m.groups() or ("",))))
    if head == "CALL" and len(toks) == 3 and toks[2].upper() == "SEEK":
        out.append("CALL ... SEEK without a frame number gets no reply at all")
    if head == "PLAY" and re.search(r"\bAUTO\b", up):
        out.append("AUTO only works on LOADBG; PLAY ... AUTO plays at once and cuts the running clip")
    if head in ("PLAY", "LOADBG", "LOAD") and len(toks) > 2:
        name = toks[2]
        if "\\" in name and not name.startswith('"'):
            out.append(f"backslash in media name {name}: use forward slashes")
    if re.search(r"\bFILTER\s", up):
        out.append("FILTER is applied to video AND audio - a video filter there gives black and silence; use VF / AF")
    if re.search(r"\b(FROM_LEFT|FROM_RIGHT|FROM_TOP|FROM_BOTTOM)\b", up):
        out.append("FROM_LEFT/FROM_RIGHT (underscore) are not direction keywords: ignored, the default "
                   "(enter from the left) is used and every token after it is ignored too")
    # transition grammar: TYPE frames [tween] [direction]
    for i, t in enumerate(toks):
        T = t.upper()
        if T in TRANSITIONS and head in ("PLAY", "LOADBG", "LOAD") and i + 1 < len(toks) and toks[i + 1].isdigit():
            rest = toks[i + 2:]
            if rest:
                first = rest[0]
                name = first.split(":")[0].lower()
                if first.upper().startswith("EASE") or first.lower() == "linear":
                    if name not in TWEENS:
                        out.append(f"tween '{first}' is not in the tween table: 403, the clip does NOT play")
                    elif ":" in first and not re.fullmatch(r"\w+(:\d+\.?\d?){1,2}", first):
                        out.append(f"tween parameters in '{first}': max. one decimal digit, no minus (403)")
                    nxt = rest[1].upper() if len(rest) > 1 else None
                    if nxt and nxt not in DIRECTIONS and not nxt.startswith(("SEEK", "LENGTH", "LOOP", "AUTO", "IN", "OUT")):
                        out.append(f"'{rest[1]}' after the tween is not a direction: ignored")
                elif first.upper() in DIRECTIONS:
                    if len(rest) > 1 and (rest[1].upper().startswith("EASE") or rest[1].lower() == "linear"):
                        out.append(f"tween '{rest[1]}' after the direction is ignored (motion is linear); "
                                   f"write {T} {toks[i + 1]} {rest[1]} {first}")
                elif first.upper() not in ("LOOP", "AUTO", "SEEK", "LENGTH", "IN", "OUT", "STING", "CLEAR_ON_404") \
                        and not re.match(r"FROM_(LEFT|RIGHT|TOP|BOTTOM)$", first.upper()):
                    out.append(f"'{first}' after '{T} {toks[i + 1]}' is not a tween or direction: it and the rest "
                               f"of the transition are ignored")
            break
    m = re.match(r"^MIXER\s+\S+\s+\w+(?:\s+-?[\d.]+)+\s+(\d+)\s+([A-Za-z]\S*)\s*$", cmd, re.I)
    if m:
        tw = m.group(2)
        if tw.upper() != "DEFER" and tw.split(":")[0].lower() not in TWEENS:
            out.append(f"tween '{tw}' is not in the tween table: 403 MIXER FAILED, the transform is NOT applied")
        elif ":" in tw and not re.fullmatch(r"\w+(:\d+\.?\d?){1,2}", tw):
            out.append(f"tween parameters in '{tw}': max. one decimal digit, no minus (403, transform NOT applied)")
    m = re.search(r"AUDIO_FADE_START=(\d+).*AUDIO_FADE_DURATION=(\d+)", up)
    if m:
        out.append(f"STING audio fade ends at frame {int(m.group(1)) + int(m.group(2))}: if the mask is longer, "
                   f"the whole sting is cut there")
    return out


def anim_frames(cmd):
    m = re.match(rf"^MIXER\s+(\S+)\s+({TRANSFORMS})\b(?:\s+-?[\d.]+)+\s+(\d+)(?:\s|$)", cmd, re.I)
    return (m.group(1), int(m.group(3))) if m else None


def layer_of(cmd):
    t = tokens(cmd)
    return t[1] if len(t) > 1 else None


def check_step(actions, fps):
    """Context problems inside one step: list of ("cmd", text) / ("wait", ms)."""
    out = []
    since = {}  # layer -> ms since an animation was started (and its length)
    seek_pending = None
    for kind, a in actions:
        if kind == "wait":
            for k in since:
                since[k][0] += a
            if seek_pending is not None:
                seek_pending += a
            continue
        up = a.upper()
        an = anim_frames(a)
        if an:
            since[an[0]] = [0, an[1] * 1000 / fps]
        if up.startswith("CLEAR ") and layer_of(a) in since:
            elapsed, length = since[layer_of(a)]
            if elapsed < length:
                out.append(f"CLEAR {layer_of(a)} only {elapsed:.0f} ms after a {length:.0f} ms animation "
                           f"({int(length * fps / 1000)} frames at {fps} fps): the graphic is cut mid-move")
        if re.match(r"^(PLAY|LOAD)\s.*\bSEEK\s+\d+", up):
            seek_pending = 0
        if up.startswith("LOADBG") and re.search(r"\bAUTO\b", up) and seek_pending is not None and seek_pending < 100:
            out.append(f"LOADBG ... AUTO {seek_pending} ms after PLAY ... SEEK: the background starts at once; "
                       f"put a wait of at least 100 ms between them")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("config")
    ap.add_argument("--fps", type=float, default=50, help="channel frame rate (1080p5000 = 50)")
    ap.add_argument("--page")
    args = ap.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    with io.open(args.config, encoding="utf-8") as f:
        data = json.load(f)

    caspar_ids = {k for k, v in (data.get("instances") or {}).items()
                  if str(v.get("moduleId", v.get("instance_type", ""))).startswith("casparcg")}
    total = 0
    for page_no, page in (data.get("pages") or {}).items():
        if args.page and args.page != page_no:
            continue
        for row, cols in (page.get("controls") or {}).items():
            for col, ctl in cols.items():
                steps = ctl.get("steps") or {}
                button_cmds = []
                findings = []
                for step_id, step in sorted(steps.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 0):
                    acts = []
                    for set_id, actions in (step.get("action_sets") or {}).items():
                        if not isinstance(actions, list):
                            continue
                        for a in actions:
                            opts = {k: val(v) for k, v in (a.get("options") or {}).items()}
                            did = a.get("definitionId") or a.get("action")
                            if did == "wait":
                                try:
                                    acts.append(("wait", float(opts.get("time", 0))))
                                except (TypeError, ValueError):
                                    acts.append(("wait", 0.0))
                            elif (a.get("connectionId") or a.get("instance")) in caspar_ids or did == "COMMAND":
                                cmd = str(opts.get("cmd", "")).strip()
                                if cmd:
                                    acts.append(("cmd", cmd))
                                    button_cmds.append((step_id, cmd))
                                    findings += [(step_id, cmd, p) for p in check_command(cmd, args.fps)]
                                elif did == "COMMAND":
                                    findings.append((step_id, "", "empty COMMAND action (no cmd) - sends nothing"))
                    findings += [(step_id, "", p) for p in check_step(acts, args.fps)]
                # across steps: a transform used in one step and a later PLAY on the same layer without MIXER CLEAR
                for i, (sid, cmd) in enumerate(button_cmds):
                    an = anim_frames(cmd) or (re.match(rf"^MIXER\s+(\S+)\s+({TRANSFORMS})\b\s+\S", cmd, re.I) and (layer_of(cmd), 0))
                    if not an:
                        continue
                    lay = an[0]
                    plays = [(s, c) for s, c in button_cmds if s != sid and c.upper().startswith("PLAY " + lay.upper() + " ")]
                    for s, c in plays:
                        step_cmds = [c2.upper() for s2, c2 in button_cmds if s2 == s]
                        if not any(x.startswith(f"MIXER {lay.upper()} CLEAR") for x in step_cmds):
                            findings.append((s, c, f"step uses a transform on {lay} in step {sid} but plays on it here "
                                                   f"without MIXER {lay} CLEAR first: it inherits that transform"))
                if findings:
                    print(f"== {page_no}/{row}/{col} {label(ctl)!r}")
                    seen = set()
                    for sid, cmd, p in findings:
                        if (sid, cmd, p) in seen:
                            continue
                        seen.add((sid, cmd, p))
                        print(f"   step {sid}: {p}" + (f"\n            {cmd}" if cmd else ""))
                        total += 1
    print(f"\n{total} finding(s)")


if __name__ == "__main__":
    main()
