"""Split js/i18n.js strings into core + page bundles."""
from __future__ import annotations

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "js" / "i18n.js"
OUT_DIR = ROOT / "js" / "i18n-bundles"

ENTRY_RE = re.compile(
    r"([a-zA-Z0-9_]+):\s*(?:\"((?:\\.|[^\"\\])*)\"|(?:\n\s*\"((?:\\.|[^\"\\])*)\")?)",
    re.MULTILINE,
)

BUNDLE_RULES = [
    ("home", lambda k: k.startswith(("home_", "hero_"))),
    (
        "catalog",
        lambda k: k.startswith(("collection_", "product_"))
        and not k.startswith("collection_cat"),
    ),
    ("shop", lambda k: k.startswith(("cart_", "checkout_", "wishlist_", "coupon_"))),
    ("content", lambda k: k.startswith(("about_", "contact_", "faq_", "privacy_", "terms_", "journal_", "legal_", "payments_", "shipping_"))),
]


def extract_lang_block(text: str, lang: str) -> str:
    marker = f"{lang}: {{"
    start = text.find(marker)
    if start < 0:
        return ""
    start += len(marker)
    depth = 1
    i = start
    while i < len(text) and depth:
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
        i += 1
    return text[start : i - 1]


def parse_entries(block: str) -> dict[str, str]:
    entries: dict[str, str] = {}
    for match in ENTRY_RE.finditer(block):
        key = match.group(1)
        val = match.group(2) if match.group(2) is not None else (match.group(3) or "")
        entries[key] = val.replace('\\"', '"')
    return entries


def bucket_key(key: str) -> str:
    if key.startswith("collection_cat"):
        return "shared"
    for name, rule in BUNDLE_RULES:
        if rule(key):
            return name
    return "shared"


def js_lang_object(data: dict[str, str], indent: str) -> str:
    lines = ["{"]
    for key in sorted(data):
        val = data[key].replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'{indent}{key}: "{val}",')
    lines.append(indent.rstrip() + "}")
    return "\n".join(lines)


def js_bundle(bundle: dict[str, dict[str, str]]) -> str:
    return (
        "{\n"
        f"    el: {js_lang_object(bundle['el'], '      ')},\n"
        f"    en: {js_lang_object(bundle['en'], '      ')},\n"
        "  }"
    )


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    core = text.split("var STRINGS = {", 1)[0]
    after = text.split("var STRINGS = {", 1)[1]
    machinery = after.split("};", 1)[1]

    el = parse_entries(extract_lang_block(text, "el"))
    en = parse_entries(extract_lang_block(text, "en"))
    if not el:
        raise SystemExit("Failed to parse i18n strings")

    bundles: dict[str, dict[str, dict[str, str]]] = {}
    for key in sorted(set(el) | set(en)):
        b = bucket_key(key)
        bundles.setdefault(b, {"el": {}, "en": {}})
        if key in el:
            bundles[b]["el"][key] = el[key]
        if key in en:
            bundles[b]["en"][key] = en[key]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    register_head = (
        "(function () {\n"
        "  window.NostalgiaI18nRegister = window.NostalgiaI18nRegister || function (bundle) {\n"
        "    window.__nostalgiaI18nQueue = window.__nostalgiaI18nQueue || [];\n"
        "    window.__nostalgiaI18nQueue.push(bundle);\n"
        "  };\n"
    )
    for name, data in sorted(bundles.items()):
        body = (
            register_head
            + f"  window.NostalgiaI18nRegister({js_bundle(data)});\n"
            + "})();\n"
        )
        (OUT_DIR / f"{name}.js").write_text(body, encoding="utf-8")
        print(f"{name}.js: {len(data['el'])} keys")

    core_body = (
        core
        + "var STRINGS = { el: {}, en: {} };\n\n"
        + "function mergeI18nBundle(bundle) {\n"
        + "  if (!bundle) return;\n"
        + '  ["el", "en"].forEach(function (lang) {\n'
        + "    if (!bundle[lang]) return;\n"
        + "    Object.keys(bundle[lang]).forEach(function (key) {\n"
        + "      STRINGS[lang][key] = bundle[lang][key];\n"
        + "    });\n"
        + "  });\n"
        + "}\n\n"
        + "window.NostalgiaI18nRegister = function (bundle) {\n"
        + "  mergeI18nBundle(bundle);\n"
        + "};\n\n"
        + "(window.__nostalgiaI18nQueue || []).forEach(mergeI18nBundle);\n"
        + machinery
    )
    (ROOT / "js" / "i18n-core.js").write_text(core_body, encoding="utf-8")
    print("wrote i18n-core.js")


if __name__ == "__main__":
    main()
