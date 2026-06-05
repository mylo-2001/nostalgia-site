"""Generate WebP + responsive widths for site PNGs."""
from __future__ import annotations

import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
SKIP_DIRS = {"node_modules", ".git", "logo", "fonts", "tools"}
WIDTHS = (480, 960, 1440)
WEBP_QUALITY = 82


def should_skip(path: pathlib.Path) -> bool:
    parts = set(path.parts)
    return bool(parts & SKIP_DIRS)


def save_webp(img: Image.Image, dest: pathlib.Path, width: int | None = None) -> int:
    working = img
    if width and img.width > width:
        ratio = width / img.width
        height = max(1, round(img.height * ratio))
        working = img.resize((width, height), Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    working.save(dest, format="WEBP", quality=WEBP_QUALITY, method=6)
    return dest.stat().st_size


def process_png(src: pathlib.Path) -> dict[str, int]:
    saved: dict[str, int] = {}
    with Image.open(src) as img:
        img = img.convert("RGBA") if img.mode in ("RGBA", "LA", "P") else img.convert("RGB")
        base = src.with_suffix("")
        full_webp = base.with_suffix(".webp")
        saved["full"] = save_webp(img, full_webp)
        for width in WIDTHS:
            variant = pathlib.Path(f"{base}-{width}w.webp")
            if img.width > width:
                saved[f"{width}w"] = save_webp(img, variant, width)
            else:
                saved[f"{width}w"] = save_webp(img, variant)
    return saved


def main() -> None:
    pngs = sorted(
        p
        for p in ROOT.rglob("*.png")
        if p.is_file() and not should_skip(p)
    )
    total_before = sum(p.stat().st_size for p in pngs)
    total_after = 0
    count = 0
    for src in pngs:
        sizes = process_png(src)
        total_after += sizes.get("full", 0)
        count += 1
        rel = src.relative_to(ROOT)
        full_kb = round(sizes.get("full", 0) / 1024)
        orig_kb = round(src.stat().st_size / 1024)
        print(f"{rel}: {orig_kb}KB -> {full_kb}KB webp")
    print(f"\nConverted {count} PNGs")
    print(f"Original total: {round(total_before / 1024 / 1024, 1)} MB")
    print(f"WebP full-size total: {round(total_after / 1024 / 1024, 1)} MB")


if __name__ == "__main__":
    main()
