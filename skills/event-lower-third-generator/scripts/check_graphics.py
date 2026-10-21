#!/usr/bin/env python3
"""Static checks of CasparCG HTML graphics (a template file or a whole package folder).

Usage: check_graphics.py <file.html | folder> [--fonts "Font A,Font B"]

Finds the problems that show up on air (see SKILL.md): playing by itself on load, placeholder text,
fonts that the playout machine does not have, clocks without a time zone, external URLs, missing
relative files, update() that is not defined / crashes on "" / inserts HTML, no transparent background.
Heuristic - read the template when a finding looks wrong. Exit code 1 if an ERROR was found.
"""
import argparse
import re
import sys
from pathlib import Path

# fonts normally present on a Linux CasparCG server (DejaVu, Liberation) plus generic families;
# a Windows playout machine has its own set - pass --fonts to add the fonts you know are installed
DEFAULT_FONTS = {
    "dejavu sans", "dejavu sans mono", "dejavu serif", "liberation sans", "liberation serif", "liberation mono",
    "liberation sans narrow", "arial", "helvetica", "sans-serif", "serif", "monospace", "system-ui", "inherit",
    "initial", "var",
}

findings = []


def report(level, path, msg):
    findings.append((level, path, msg))


def strip_comments(text):
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"(?<![:\"'])//[^\n]*", "", text)


def font_faces(texts):
    faces = set()
    for t in texts:
        for m in re.finditer(r"@font-face\s*{[^}]*font-family\s*:\s*([^;]+);", t, re.S):
            faces.add(m.group(1).strip().strip("\"'").lower())
    return faces


def check_file(path, css_texts, known_fonts):
    raw = path.read_text(encoding="utf-8", errors="replace")
    text = strip_comments(raw)
    rel = path.name
    uses_kit = "gfx.js" in text and "GFX.define" in text

    if not re.search(r"<meta[^>]+charset\s*=\s*[\"']?utf-8", raw, re.I):
        report("WARN", rel, "no <meta charset=\"utf-8\"> - Polish letters can break")

    # API
    if not uses_kit:
        for fn in ("update", "play", "stop"):
            if not re.search(rf"(function\s+{fn}\s*\(|window\.{fn}\s*=|\b{fn}\s*[:=]\s*(async\s*)?(\(|function))", text):
                report("ERROR", rel, f"{fn}() is not defined for CasparCG (CG UPDATE/PLAY/STOP do nothing)")
        if re.search(r"function\s+update\s*\(\s*(\w+)", text) and "JSON.parse" in text and "try" not in text:
            report("WARN", rel, "update() parses JSON without try/catch - CG ADD without data calls update(\"\")")

    # autoplay outside the preview
    if re.search(r"get\(\s*['\"]autoplay['\"]\s*\)\s*!==?\s*['\"]0['\"]", text):
        report("ERROR", rel, "plays by itself unless ?autoplay=0 - CasparCG never adds that; it goes on air on load")
    for m in re.finditer(r"(?:requestAnimationFrame|setTimeout|addEventListener\(\s*['\"](?:load|DOMContentLoaded)['\"])[^;\n]{0,80}\bplay\b", text):
        ctx = text[max(0, m.start() - 160):m.start()]
        if "preview" not in ctx.lower():
            report("WARN", rel, "play() is scheduled at load - make sure it only happens in the browser preview")
            break

    # HTML injection of data
    if re.search(r"\.innerHTML\s*=\s*(?!['\"`]\s*['\"`]|['\"`]<)", text) and not uses_kit:
        report("WARN", rel, "innerHTML set from a variable - data text should go in with textContent")

    # background
    for m in re.finditer(r"(?<![\w.#:-])(html|body)\s*(?:,\s*(?:html|body)\s*)?{([^}]*)}", text):
        bg = re.search(r"background(?:-color)?\s*:\s*([^;]+)", m.group(2))
        if bg and "transparent" not in bg.group(1) and "preview" not in text[max(0, m.start() - 60):m.start()]:
            report("ERROR", rel, f"{m.group(1)} has background {bg.group(1).strip()} - on air the page must be transparent")

    # fonts
    faces = font_faces([text] + css_texts)
    for m in re.finditer(r"font-family\s*:\s*([^;}\n]+)", text + "\n".join(css_texts)):
        fams = [f.strip().strip("\"'").lower() for f in m.group(1).split(",")]
        if fams and fams[0] not in known_fonts and fams[0] not in faces and not fams[0].startswith("var("):
            report("WARN", rel, f"font \"{fams[0]}\" is neither shipped (@font-face) nor known on the server - falls back to \"{fams[-1] if len(fams) > 1 else 'the browser default'}\"")
    for m in re.finditer(r"font\s*:\s*[^;]*?\d+px\s+([\"']?[A-Za-z][^,;]*)", text):
        fam = m.group(1).strip().strip("\"'").lower()
        if fam not in known_fonts and fam not in faces and not fam.startswith("var("):
            report("WARN", rel, f"font \"{fam}\" (font shorthand) is not shipped / known on the server")

    # time zone
    if re.search(r"new Date\(\)", text) and re.search(r"getHours|toLocaleTimeString|DateTimeFormat", text) and "timeZone" not in text and not uses_kit:
        report("WARN", rel, "clock without timeZone - CasparCG servers often run in UTC")

    # external URLs
    for m in re.finditer(r"(?:src|href)\s*=\s*[\"'](https?://[^\"']+)|url\(\s*[\"']?(https?://[^)\"']+)|@import\s+(?:url\()?[\"']?(https?://[^)\"';]+)", text):
        url = next(g for g in m.groups() if g)
        report("WARN", rel, f"external URL {url} - the playout machine may be offline; ship the file")

    # missing relative files
    for m in re.finditer(r"(?:src|href)\s*=\s*[\"']([^\"':#?]+)[\"']|url\(\s*[\"']?([^)\"':#?]+)[\"']?\s*\)", raw):
        ref = next(g for g in m.groups() if g)
        if ref.startswith(("data", "/", "$")) or "{" in ref:
            continue
        if not (path.parent / ref).exists():
            report("ERROR", rel, f"missing file {ref}")

    # placeholder text left in the markup
    body = re.search(r"<body[^>]*>(.*)</body>", raw, re.S)
    if body:
        for m in re.finditer(r"<(h1|h2|h3|div|span|p)[^>]*\bid=[\"'](name|title|headline|role)[\"'][^>]*>([^<]{3,})<", body.group(1)):
            report("WARN", rel, f"#{m.group(2)} contains \"{m.group(3).strip()}\" in the markup - it is on air until data arrives")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("target")
    ap.add_argument("--fonts", default="", help="comma separated font families installed on the playout machine")
    a = ap.parse_args()
    known = DEFAULT_FONTS | {f.strip().lower() for f in a.fonts.split(",") if f.strip()}
    target = Path(a.target)
    files = sorted(target.rglob("*.html")) if target.is_dir() else [target]
    files = [f for f in files if "kit" not in f.parts]
    base = target if target.is_dir() else target.parent
    css = [p.read_text(encoding="utf-8", errors="replace") for p in base.rglob("*.css")]
    for f in files:
        check_file(f, [strip_comments(c) for c in css], known)
    for level, path, msg in findings:
        print(f"{level:5} {path}: {msg}")
    errors = sum(1 for f in findings if f[0] == "ERROR")
    print(f"{len(files)} file(s), {errors} error(s), {len(findings) - errors} warning(s)")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
