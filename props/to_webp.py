"""Trim rendered prop PNGs to their content and save them as WebP for the web app.

Usage: python props/to_webp.py <render_dir> <out_dir>
The seedling stages share one crop box, so the plant grows in place.
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)


def clean(img):
    """Drop the faint alpha the shadow catcher leaves across the floor, and fade shadows that the
    render frame cut off, so no prop shows a hard edge."""
    a = img.getchannel("A").point(lambda v: 0 if v < 28 else min(255, int((v - 28) * 255 / 200)))
    w, h = img.size
    edge = Image.new("L", (w, h), 0)
    px = edge.load()
    m = 0.12
    for y in range(h):
        fy = min(y / h, (h - 1 - y) / h) / m
        for x in range(w):
            px[x, y] = int(255 * min(1, fy, min(x / w, (w - 1 - x) / w) / m))
    img.putalpha(ImageChops.multiply(a, edge))
    return img


def box(img):
    return img.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()


def union(boxes):
    return min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)


images = {p.stem: clean(Image.open(p).convert("RGBA")) for p in sorted(src.glob("*.png")) if not p.stem.startswith("contact")}
seedling = union([box(im) for name, im in images.items() if name.startswith("seedling")])
for name, im in images.items():
    crop = im.crop(seedling if name.startswith("seedling") else box(im))
    crop.save(out / f"{name}.webp", "WEBP", quality=82, method=6)
    print(f"{name}.webp {crop.size} {(out / f'{name}.webp').stat().st_size // 1024} KB")
