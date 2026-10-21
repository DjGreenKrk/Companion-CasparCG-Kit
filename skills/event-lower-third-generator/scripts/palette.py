#!/usr/bin/env python3
"""Dominant colours of an image (key visual, poster, logo, screenshot) and contrast checks.

Usage:
  palette.py image.png [-k 8]            dominant colours with share, and the better text colour on each
  palette.py --contrast "#ffffff" "#c8ff67"   WCAG contrast ratio of two colours

Decodes with Pillow if installed, otherwise with ffmpeg. Transparent pixels (logos) are ignored.
"""
import argparse
import random
import shutil
import subprocess
import sys

SIZE = 120


def load_pixels(path):
    try:
        from PIL import Image

        im = Image.open(path).convert("RGBA")
        im.thumbnail((SIZE, SIZE))
        return [p[:3] for p in im.getdata() if p[3] > 128]
    except ImportError:
        pass
    if not shutil.which("ffmpeg"):
        sys.exit("needs Pillow (pip install pillow) or ffmpeg")
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-frames:v", "1", "-vf",
         f"scale={SIZE}:{SIZE}:force_original_aspect_ratio=decrease,format=rgba", "-f", "rawvideo", "-"],
        capture_output=True, check=True).stdout
    return [tuple(out[i:i + 3]) for i in range(0, len(out), 4) if out[i + 3] > 128]


def kmeans(pixels, k, rounds=12):
    random.seed(1)
    centers = random.sample(pixels, min(k, len(pixels)))
    for _ in range(rounds):
        groups = [[] for _ in centers]
        for p in pixels:
            i = min(range(len(centers)), key=lambda c: sum((p[j] - centers[c][j]) ** 2 for j in range(3)))
            groups[i].append(p)
        centers = [tuple(sum(c[j] for c in g) / len(g) for j in range(3)) if g else centers[i] for i, g in enumerate(groups)]
    return [(c, len(g)) for c, g in zip(centers, groups) if g]


def lum(rgb):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(x) for x in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def hex_to_rgb(h):
    h = h.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def to_hex(rgb):
    return "#" + "".join(f"{round(v):02x}" for v in rgb)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image", nargs="?")
    ap.add_argument("-k", type=int, default=8)
    ap.add_argument("--contrast", nargs=2, metavar=("A", "B"))
    a = ap.parse_args()
    if a.contrast:
        r = contrast(hex_to_rgb(a.contrast[0]), hex_to_rgb(a.contrast[1]))
        verdict = "OK for body text" if r >= 4.5 else "OK only for large text (>= 3)" if r >= 3 else "too low"
        print(f"{a.contrast[0]} / {a.contrast[1]}: {r:.2f}:1 - {verdict}")
        return
    if not a.image:
        ap.error("image or --contrast needed")
    px = load_pixels(a.image)
    if not px:
        sys.exit("no opaque pixels")
    clusters = sorted(kmeans(px, a.k), key=lambda c: -c[1])
    total = sum(n for _, n in clusters)
    print("colour    share  text on it (contrast)")
    for c, n in clusters:
        w, b = contrast(c, (255, 255, 255)), contrast(c, (0, 0, 0))
        ink = f"white {w:.1f}:1" if w >= b else f"black {b:.1f}:1"
        print(f"{to_hex(c)}  {100 * n / total:5.1f}%  {ink}")


if __name__ == "__main__":
    main()
