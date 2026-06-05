"""Download self-hosted WOFF2 fonts used by the site."""
from __future__ import annotations

import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
FONTS_DIR = ROOT / "fonts"
CSS_OUT = ROOT / "css" / "fonts.css"

# Subset: weights actually used in the site
GOOGLE_CSS = (
    "https://fonts.googleapis.com/css2?"
    "family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&"
    "family=Lora:ital,wght@0,400;0,500;0,600;1,400&"
    "family=Montserrat:wght@400;500;600&"
    "family=Playfair+Display:ital,wght@0,500;0,600;1,400&"
    "display=swap"
)


def fetch_css() -> str:
    req = urllib.request.Request(
        GOOGLE_CSS,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            )
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8")


def main() -> None:
    FONTS_DIR.mkdir(parents=True, exist_ok=True)
    css = fetch_css()
    urls = sorted(set(re.findall(r"url\((https://[^)]+)\)", css)))
    local_css = css
    for url in urls:
        filename = url.split("/")[-1].split("?")[0]
        dest = FONTS_DIR / filename
        if not dest.exists():
            print("download", filename)
            urllib.request.urlretrieve(url, dest)
        local_css = local_css.replace(url, f"../fonts/{filename}")
    local_css = re.sub(
        r"/\*[^*]*\*+([^/*][^*]*\*+)*/",
        "",
        local_css,
    )
    CSS_OUT.write_text(local_css.strip() + "\n", encoding="utf-8")
    print(f"Wrote {CSS_OUT} ({len(urls)} font files)")


if __name__ == "__main__":
    main()
