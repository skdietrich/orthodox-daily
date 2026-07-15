#!/usr/bin/env python3
"""Verify the Orthodox Daily static build using only the Python standard library."""

from __future__ import annotations

import json
import re
import struct
import sys
from calendar import isleap
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIMIT_BYTES = 23 * 1024 * 1024
EXPECTED_PASCHA = {
    2026: "2026-04-12",
    2027: "2027-05-02",
    2028: "2028-04-16",
    2029: "2029-04-08",
    2030: "2030-04-28",
}
REQUIRED = [
    "index.html",
    "404.html",
    "manifest.webmanifest",
    "service-worker.js",
    "css/styles.css",
    "js/app.js",
    "js/astronomy.js",
    "assets/cross.svg",
    "assets/byzantine-bg.svg",
    "assets/candle.svg",
    "assets/icon-192.png",
    "assets/icon-512.png",
    "data/fixed-calendar.json",
    "data/history.json",
    "data/prayers.json",
    "data/practices.json",
    "data/images.json",
    "data/martyrs.json",
    "tools/generate_art.py",
    "README.md",
    "SOURCES.md",
    "CONTENT_NOTES.md",
    "IMAGE_INVENTORY.md",
    "ART_PREVIEW.jpg",
    "LICENSE",
    ".nojekyll",
    ".github/workflows/pages.yml",
]


def fail(message: str) -> None:
    raise AssertionError(message)


def read_json(relative: str):
    path = ROOT / relative
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        fail(f"Invalid JSON in {relative}: {exc}")


def png_dimensions(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        signature = handle.read(24)
    if signature[:8] != b"\x89PNG\r\n\x1a\n":
        fail(f"{path.relative_to(ROOT)} is not a PNG")
    return struct.unpack(">II", signature[16:24])


def jpeg_dimensions(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if not data.startswith(b"\xff\xd8"):
        fail(f"{path.relative_to(ROOT)} is not a JPEG")
    index = 2
    while index < len(data):
        if data[index] != 0xFF:
            index += 1
            continue
        while index < len(data) and data[index] == 0xFF:
            index += 1
        if index >= len(data):
            break
        marker = data[index]
        index += 1
        if marker in {0xD8, 0xD9}:
            continue
        if index + 2 > len(data):
            break
        length = int.from_bytes(data[index:index + 2], "big")
        if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
            if index + 7 > len(data):
                break
            height = int.from_bytes(data[index + 3:index + 5], "big")
            width = int.from_bytes(data[index + 5:index + 7], "big")
            return width, height
        index += length
    fail(f"Could not read JPEG dimensions: {path.relative_to(ROOT)}")


def check_content_images() -> tuple[int, int]:
    payload = read_json("data/images.json")
    images = payload.get("images")
    if not isinstance(images, list) or len(images) < 18:
        fail("images.json must describe at least 18 local content images")
    seen_ids = set()
    total_bytes = 0
    for image in images:
        image_id = image.get("id")
        src = image.get("src")
        if not image_id or image_id in seen_ids:
            fail("Image IDs must be unique and non-empty")
        seen_ids.add(image_id)
        if not isinstance(src, str) or not src.startswith("assets/art/"):
            fail(f"Invalid local image path for {image_id}")
        path = ROOT / src
        if not path.exists():
            fail(f"Content image missing: {src}")
        size = path.stat().st_size
        if size < 250_000:
            fail(f"Content image is suspiciously small: {src} ({size:,} bytes)")
        width, height = jpeg_dimensions(path)
        if width < 1200 or height < 675:
            fail(f"Content image resolution is too small: {src} ({width}x{height})")
        if not image.get("alt") or not image.get("caption"):
            fail(f"Image metadata is incomplete for {image_id}")
        service_worker = (ROOT / "service-worker.js").read_text(encoding="utf-8")
        if f'"./{src}"' not in service_worker:
            fail(f"Content image is not cached offline: {src}")
        total_bytes += size
    return len(images), total_bytes


def check_dom_bindings() -> int:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    js = (ROOT / "js/app.js").read_text(encoding="utf-8")
    html_ids = set(re.findall(r'id="([^"]+)"', html))
    selector_ids = set(re.findall(r'\$\("#([A-Za-z0-9_-]+)"\)', js))
    missing = sorted(selector_ids - html_ids)
    if missing:
        fail("JavaScript references missing HTML IDs: " + ", ".join(missing))
    return len(selector_ids)


def check_required() -> None:
    missing = [relative for relative in REQUIRED if not (ROOT / relative).exists()]
    if missing:
        fail("Missing required files: " + ", ".join(missing))


def check_sizes() -> tuple[Path, int]:
    files = [path for path in ROOT.rglob("*") if path.is_file() and ".git" not in path.parts]
    oversized = [(path, path.stat().st_size) for path in files if path.stat().st_size >= LIMIT_BYTES]
    if oversized:
        lines = [f"{path.relative_to(ROOT)} ({size:,} bytes)" for path, size in oversized]
        fail("Files at or above the 23 MiB limit: " + "; ".join(lines))
    return max(((path, path.stat().st_size) for path in files), key=lambda item: item[1])


def check_manifest() -> None:
    manifest = read_json("manifest.webmanifest")
    for field in ("name", "short_name", "start_url", "display", "icons"):
        if field not in manifest:
            fail(f"Manifest is missing {field}")
    expected_icons = {192, 512}
    actual_icons = set()
    for icon in manifest["icons"]:
        match = re.fullmatch(r"(\d+)x(\d+)", icon.get("sizes", ""))
        if not match or match.group(1) != match.group(2):
            fail(f"Invalid manifest icon size: {icon}")
        size = int(match.group(1))
        path = ROOT / icon["src"]
        if not path.exists():
            fail(f"Manifest icon missing: {icon['src']}")
        if png_dimensions(path) != (size, size):
            fail(f"Manifest icon dimensions do not match: {icon['src']}")
        actual_icons.add(size)
    if not expected_icons.issubset(actual_icons):
        fail("Manifest must include 192px and 512px icons")


def check_fixed_data() -> tuple[int, int]:
    payload = read_json("data/fixed-calendar.json")
    entries = payload.get("entries")
    if not isinstance(entries, dict) or len(entries) != 366:
        fail("fixed-calendar.json must contain all 366 month/day keys")
    expected = set()
    cursor = date(2028, 1, 1)
    while cursor.year == 2028:
        expected.add(cursor.strftime("%m-%d"))
        cursor += timedelta(days=1)
    if set(entries) != expected:
        fail("fixed-calendar.json month/day keys are incomplete or invalid")
    curated = 0
    martyrs = 0
    for key, entry in entries.items():
        if not isinstance(entry.get("display"), str) or not entry["display"].strip():
            fail(f"Missing display text for {key}")
        if entry.get("status") not in {"curated", "jurisdictional"}:
            fail(f"Invalid status for {key}")
        if not isinstance(entry.get("martyrs"), list):
            fail(f"Martyrs must be a list for {key}")
        curated += entry["status"] == "curated"
        martyrs += len(entry["martyrs"])
    return curated, martyrs


def check_years() -> int:
    total = 0
    for year, expected_pascha in EXPECTED_PASCHA.items():
        relative = f"data/years/{year}.json"
        payload = read_json(relative)
        if payload.get("year") != year:
            fail(f"Wrong year metadata in {relative}")
        if payload.get("pascha") != expected_pascha:
            fail(f"Unexpected Pascha date in {relative}")
        days = payload.get("days")
        expected_count = 366 if isleap(year) else 365
        if not isinstance(days, dict) or len(days) != expected_count:
            fail(f"{relative} must contain {expected_count} daily records")
        cursor = date(year, 1, 1)
        while cursor.year == year:
            key = cursor.isoformat()
            if key not in days:
                fail(f"Missing {key} in {relative}")
            record = days[key]
            if record.get("date") != key:
                fail(f"Record date mismatch for {key}")
            if record.get("pascha") != expected_pascha:
                fail(f"Pascha mismatch in daily record {key}")
            if record.get("fixedKey") != cursor.strftime("%m-%d"):
                fail(f"Fixed key mismatch for {key}")
            if not isinstance(record.get("movable"), list):
                fail(f"Movable field must be a list for {key}")
            if not isinstance(record.get("fasting"), dict):
                fail(f"Fasting field must be an object for {key}")
            cursor += timedelta(days=1)
            total += 1
    return total


def check_other_data() -> tuple[int, int, int]:
    history = read_json("data/history.json").get("spotlights", {})
    prayers = read_json("data/prayers.json").get("prayers", [])
    practices = read_json("data/practices.json").get("practices", [])
    if not history:
        fail("Historical spotlights are empty")
    if not prayers:
        fail("Prayer library is empty")
    if not practices:
        fail("Daily practices are empty")
    prayer_ids = [item.get("id") for item in prayers]
    if len(prayer_ids) != len(set(prayer_ids)) or any(not item for item in prayer_ids):
        fail("Prayer IDs must be unique and non-empty")
    return len(history), len(prayers), len(practices)


def check_martyr_profiles(expected_count: int) -> tuple[int, int]:
    payload = read_json("data/martyrs.json")
    profiles = payload.get("martyrs")
    limit = payload.get("characterLimit", 149)
    if not isinstance(profiles, list) or not profiles:
        fail("martyrs.json must contain martyr profiles")
    if len(profiles) != expected_count:
        fail(f"martyrs.json has {len(profiles)} profiles but fixed calendar has {expected_count} martyr entries")
    ids = set()
    max_about = 0
    fixed = read_json("data/fixed-calendar.json").get("entries", {})
    expected = {(date_key, name) for date_key, entry in fixed.items() for name in entry.get("martyrs", [])}
    actual = set()
    for profile in profiles:
        profile_id = profile.get("id")
        if not profile_id or profile_id in ids:
            fail("Martyr profile IDs must be unique and non-empty")
        ids.add(profile_id)
        key = (profile.get("feastDate"), profile.get("name"))
        actual.add(key)
        if key not in expected:
            fail(f"Martyr profile does not match fixed calendar: {key}")
        about = profile.get("about", "")
        if not isinstance(about, str) or not about.strip():
            fail(f"Martyr profile is missing about text: {profile_id}")
        if len(about) > limit or len(about) >= 150:
            fail(f"Martyr about text exceeds 149 characters: {profile_id} ({len(about)})")
        if not profile.get("lifeDates") or not profile.get("place"):
            fail(f"Martyr profile dates/place missing: {profile_id}")
        max_about = max(max_about, len(about))
    if actual != expected:
        missing = sorted(expected - actual)
        fail(f"Martyr profiles are incomplete: {missing[:5]}")
    return len(profiles), max_about


def check_service_worker() -> int:
    text = (ROOT / "service-worker.js").read_text(encoding="utf-8")
    match = re.search(r"const APP_SHELL\s*=\s*\[(.*?)\];", text, re.S)
    if not match:
        fail("Could not find APP_SHELL in service-worker.js")
    paths = re.findall(r'"([^"]+)"', match.group(1))
    missing = []
    for raw in paths:
        relative = raw.removeprefix("./")
        if not relative:
            continue
        if not (ROOT / relative).exists():
            missing.append(relative)
    if missing:
        fail("Service worker references missing files: " + ", ".join(missing))
    return len(paths)


def check_no_runtime_external_dependencies() -> None:
    for relative in ("index.html", "404.html", "css/styles.css", "js/app.js", "js/astronomy.js", "service-worker.js"):
        text = (ROOT / relative).read_text(encoding="utf-8").lower()
        if "http://" in text or "https://" in text:
            fail(f"Runtime file contains an external URL: {relative}")


def main() -> int:
    try:
        check_required()
        largest_path, largest_size = check_sizes()
        check_manifest()
        curated, martyrs = check_fixed_data()
        martyr_profiles, max_martyr_about = check_martyr_profiles(martyrs)
        daily_records = check_years()
        history, prayers, practices = check_other_data()
        content_images, image_bytes = check_content_images()
        dom_bindings = check_dom_bindings()
        shell_count = check_service_worker()
        check_no_runtime_external_dependencies()
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1

    print("Orthodox Daily verification passed")
    print(f"  Daily records: {daily_records}")
    print(f"  Curated fixed-date entries: {curated}")
    print(f"  Martyr memorial records: {martyrs}")
    print(f"  Martyr profiles: {martyr_profiles} (longest about text: {max_martyr_about} characters)")
    print(f"  Historical spotlights: {history}")
    print(f"  Prayers: {prayers}")
    print(f"  Daily practices: {practices}")
    print(f"  Full-size local content images: {content_images} ({image_bytes:,} bytes total)")
    print(f"  Verified JavaScript-to-HTML bindings: {dom_bindings}")
    print(f"  Offline app-shell resources: {shell_count}")
    print(f"  Largest file: {largest_path.relative_to(ROOT)} ({largest_size:,} bytes)")
    print(f"  File-size ceiling: {LIMIT_BYTES:,} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
