#!/usr/bin/env python3
"""
ingest_course.py — parse a saved UDisc caddie-book HTML page, extract GPS
coordinates, update all 5 app registration files, then git commit + push.

USAGE
-----
  python scripts/ingest_course.py <saved.html> \
      --key   <course_key>      e.g.  stony_creek
      --label <display_label>   e.g.  "Stony Creek"
      --holes <number>          18 or 9
      [--dry-run]               print what would change without writing

HOW TO SAVE THE HTML
--------------------
  1. Open:  https://udisc.com/courses/<slug>/layouts/<id>/caddie-book
  2. Wait for the map to fully load.
  3. Browser menu → Save Page As → "Webpage, HTML Only"  (.html file)
  4. Run this script on that file.

MULTI-TEE COURSES (e.g. Ghesquiere Park)
-----------------------------------------
  Run twice — once per layout — using different --key values:
    --key ghesquiere_short   (navigate to the short-tees layout, save, run)
    --key ghesquiere_long    (navigate to the long-tees layout, save, run)
  Then manually merge the two entries in courseData.js if desired.
"""

import re, json, sys, math, subprocess, argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FILES = {
    'courseData': ROOT / 'utils' / 'courseData.js',
    'courseTab':  ROOT / 'components' / 'tabs' / 'CourseTab.js',
    'appLayout':  ROOT / 'components' / 'AppLayout.js',
    'playTab':    ROOT / 'components' / 'tabs' / 'PlayTab.js',
    'vsTab':      ROOT / 'components' / 'tabs' / 'VsTab.js',
}

# ── Haversine distance (feet) ─────────────────────────────────────────────────
def haversine_ft(lat1, lng1, lat2, lng2):
    R = 20902231  # Earth radius in feet
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlng / 2) ** 2)
    return round(2 * R * math.asin(math.sqrt(a)))


# ── HTML extraction ───────────────────────────────────────────────────────────
def extract_holes(html: str, expected: int) -> list:
    """
    Returns list of hole dicts: { 'tee': [lat, lng], 'basket': [lat, lng] }
    Tries React Router loaderData first, falls back to GPS regex.
    """
    holes = _try_loaderdata(html)
    if holes:
        print(f'  [extracted via React Router loaderData — {len(holes)} holes]')
        return holes

    holes = _try_gps_regex(html)
    if holes:
        print(f'  [extracted via GPS regex — {len(holes)} holes]')
        return holes

    raise ValueError(
        'Could not extract coordinates.\n'
        'Make sure you saved the CADDIE-BOOK page (not the main course page).\n'
        'URL pattern: udisc.com/courses/<slug>/layouts/<id>/caddie-book'
    )


def _try_loaderdata(html: str) -> list:
    # React Router v7 serializes context into a <script> tag
    m = re.search(
        r'window\.__reactRouterContext\s*=\s*(\{.+?)\s*;?\s*</script>',
        html, re.DOTALL
    )
    if not m:
        return []
    try:
        ctx    = json.loads(m.group(1))
        loader = ctx['state']['loaderData']
        cb_key = next((k for k in loader if 'caddie-book' in k), None)
        if not cb_key:
            return []
        payload = loader[cb_key]
        raw     = payload.get('selectedLayout', {}).get('holes', [])
        if not raw:
            return []
        out = []
        for h in sorted(raw, key=lambda x: x.get('holeNumber', 0)):
            t = h['teePosition']
            b = h['targetPosition']
            out.append({
                'tee':    [t['latitude'],  t['longitude']],
                'basket': [b['latitude'],  b['longitude']],
            })
        return out
    except Exception:
        return []


def _try_gps_regex(html: str) -> list:
    # Extract all lat,lng pairs with 5+ decimal places (avoids UI floats)
    GPS = re.compile(r'(-?\d{1,3}\.\d{5,}),\s*(-?\d{1,3}\.\d{5,})')
    raw = [(float(a), float(b)) for a, b in GPS.findall(html)
           if -90 <= float(a) <= 90 and -180 <= float(b) <= 180]
    if len(raw) < 2:
        return []

    # Deduplicate consecutive duplicates
    coords = [raw[0]]
    for c in raw[1:]:
        if abs(c[0] - coords[-1][0]) > 1e-7 or abs(c[1] - coords[-1][1]) > 1e-7:
            coords.append(c)

    # Stream-order rule (from AI_RULES.md):
    #   index 0 = shortTee, index 1 = longTee, index 2 = basket, 3+ = ignore
    # Group every 3 (or 2 if only tee+basket)
    holes = []
    i = 0
    while i + 1 < len(coords):
        if i + 2 < len(coords):
            holes.append({'tee': list(coords[i]), 'basket': list(coords[i + 2])})
            i += 3
        else:
            holes.append({'tee': list(coords[i]), 'basket': list(coords[i + 1])})
            i += 2
    return holes


# ── courseData.js patching ────────────────────────────────────────────────────
def _fmt(coord):
    return f'[{coord[0]}, {coord[1]}]'


def _coord_entry(h):
    if 'shortTee' in h:
        return (f'    {{ shortTee: {_fmt(h["shortTee"])}, '
                f'longTee: {_fmt(h["longTee"])}, '
                f'basket: {_fmt(h["basket"])} }},')
    return f'    {{ tee: {_fmt(h["tee"])}, basket: {_fmt(h["basket"])} }},'


def update_course_data(key, label, holes, distances, pars, dry_run):
    path = FILES['courseData']
    src  = path.read_text(encoding='utf-8')

    if f'  {key}:' in src:
        print(f'  SKIP courseData.js — {key} already present')
        return

    # ── COURSE_HOLE_COORDS entry ──────────────────────────────────────────────
    lines = [f'  {key}: [', f'    // {label}']
    for i, h in enumerate(holes):
        lines.append(f'    // hole {i + 1}')
        lines.append(_coord_entry(h))
    lines.append('  ],')
    coord_block = '\n'.join(lines) + '\n'

    # Insert immediately before "export const COURSE_HOLES"
    anchor = '\nexport const COURSE_HOLES'
    if anchor not in src:
        raise ValueError('Could not find "export const COURSE_HOLES" in courseData.js')
    idx = src.index(anchor)
    src = src[:idx] + coord_block + src[idx:]

    # ── COURSE_HOLES entry ────────────────────────────────────────────────────
    dist_str = ', '.join(str(d) for d in distances)
    pars_str = ', '.join(str(p) for p in pars)
    holes_block = (
        f'  {key}: {{\n'
        f'    distances: [{dist_str}],\n'
        f'    pars: [{pars_str}],\n'
        f'  }},\n'
    )

    # Insert before the closing "}" + "// Returns" comment
    anchor2 = '\n}\n\n// Returns'
    if anchor2 not in src:
        raise ValueError('Could not find COURSE_HOLES closing anchor in courseData.js')
    idx2 = src.index(anchor2)
    src = src[:idx2] + '\n' + holes_block + src[idx2:]

    if not dry_run:
        path.write_text(src, encoding='utf-8')


# ── CourseTab.js patching ─────────────────────────────────────────────────────
def update_course_tab(key, label, holes_count, center, dry_run):
    path = FILES['courseTab']
    src  = path.read_text(encoding='utf-8')

    if f"key: '{key}'" in src:
        print(f'  SKIP CourseTab.js — {key} already present')
        return

    new = src

    # COURSES array — insert before "]\nconst COURSE_CENTERS"
    courses_anchor = ']\nconst COURSE_CENTERS'
    new = new.replace(
        courses_anchor,
        f"  {{ key: '{key}', label: '{label}', holes: {holes_count} }},\n{courses_anchor}"
    )

    # COURSE_CENTERS — insert before "}\nconst COURSE_JSON_NAME"
    centers_anchor = '}\nconst COURSE_JSON_NAME'
    new = new.replace(
        centers_anchor,
        f"  {key}: {{ lat: {center[0]:.5f}, lng: {center[1]:.5f} }},\n{centers_anchor}"
    )

    # COURSE_JSON_NAME — insert before "}\n\n// ─── Google Maps"
    json_anchor = '}\n\n// ─── Google Maps loader'
    new = new.replace(
        json_anchor,
        f"  {key}: '{label}',\n{json_anchor}"
    )

    if new == src:
        print('  WARNING: CourseTab.js — no anchors matched, check file manually')
    elif not dry_run:
        path.write_text(new, encoding='utf-8')


# ── Inline-object patching (AppLayout, PlayTab, VsTab) ───────────────────────
def add_to_inline_object(src, pattern, key, value):
    """
    Finds an inline JS object matching `pattern` and appends key: 'value' to it.
    pattern should match the whole { ... } line.
    """
    def replacer(m):
        inner = m.group(0).rstrip()
        # Strip closing brace, add new entry, close
        if inner.endswith('}'):
            inner = inner[:-1].rstrip().rstrip(',')
            return f"{inner}, {key}: '{value}'" + ' }'
        return m.group(0)  # fallback: no change
    return re.sub(pattern, replacer, src)


def update_inline_file(filepath_key, var_pattern, key, value, dry_run):
    path = FILES[filepath_key]
    src  = path.read_text(encoding='utf-8')

    if f"'{key}'" in src or f'"{key}"' in src:
        print(f'  SKIP {path.name} — {key} already present')
        return

    new = add_to_inline_object(src, var_pattern, key, value)
    if new == src:
        print(f'  WARNING: {path.name} — pattern not matched, check manually')
    elif not dry_run:
        path.write_text(new, encoding='utf-8')


# ── Git ───────────────────────────────────────────────────────────────────────
def git(args):
    r = subprocess.run(['git'] + args, cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f'git {" ".join(args)} failed:\n{r.stderr}')
    return r.stdout.strip()


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description='Ingest a UDisc caddie-book HTML into the app.')
    ap.add_argument('html_file',          help='Path to saved caddie-book HTML')
    ap.add_argument('--key',   required=True, help='JS identifier  e.g. stony_creek')
    ap.add_argument('--label', required=True, help='Display name   e.g. "Stony Creek"')
    ap.add_argument('--holes', required=True, type=int, help='Number of holes: 9 or 18')
    ap.add_argument('--dry-run', action='store_true', help='Print without writing')
    args = ap.parse_args()

    html = Path(args.html_file).read_text(encoding='utf-8', errors='replace')
    print(f'\n→ Parsing {args.html_file}')

    holes = extract_holes(html, args.holes)
    if len(holes) != args.holes:
        print(f'  WARNING: expected {args.holes} holes, got {len(holes)} — truncating/padding')
    holes = holes[:args.holes]
    if len(holes) < args.holes:
        sys.exit(f'ERROR: only {len(holes)} holes found, cannot continue')

    # Distances and default par-3s
    distances = [haversine_ft(h['tee'][0], h['tee'][1], h['basket'][0], h['basket'][1])
                 for h in holes]
    pars = [3] * len(holes)

    # Course center (average tee positions)
    lats = [h['tee'][0] for h in holes]
    lngs = [h['tee'][1] for h in holes]
    center = (sum(lats) / len(lats), sum(lngs) / len(lngs))

    print(f'\n  Course:  {args.label}  ({args.holes} holes)')
    print(f'  Key:     {args.key}')
    print(f'  Center:  {center[0]:.5f}, {center[1]:.5f}')
    print(f'  Distances (ft): {distances}')

    if args.dry_run:
        print('\n[dry-run] No files written.\n')
        return

    print('\n→ Updating files...')

    # 1. courseData.js
    update_course_data(args.key, args.label, holes, distances, pars, args.dry_run)
    print('  ✓ utils/courseData.js')

    # 2. CourseTab.js
    update_course_tab(args.key, args.label, args.holes, center, args.dry_run)
    print('  ✓ components/tabs/CourseTab.js')

    # 3. AppLayout.js  — COURSE_LABELS
    update_inline_file(
        'appLayout',
        r"const COURSE_LABELS\s*=\s*\{[^\}]+\}",
        args.key, args.label.upper(), args.dry_run
    )
    print('  ✓ components/AppLayout.js')

    # 4. PlayTab.js  — COURSE_NAMES (inside function, so match the specific line)
    update_inline_file(
        'playTab',
        r"const COURSE_NAMES\s*=\s*\{[^\}]+\}",
        args.key, args.label, args.dry_run
    )
    print('  ✓ components/tabs/PlayTab.js')

    # 5. VsTab.js  — COURSE_NAMES (module-level)
    update_inline_file(
        'vsTab',
        r"const COURSE_NAMES\s*=\s*\{[^\}]+\}",
        args.key, args.label, args.dry_run
    )
    print('  ✓ components/tabs/VsTab.js')

    # Git
    print('\n→ Committing and pushing...')
    git(['add',
         'utils/courseData.js',
         'components/tabs/CourseTab.js',
         'components/AppLayout.js',
         'components/tabs/PlayTab.js',
         'components/tabs/VsTab.js'])
    git(['commit', '-m',
         f'feat(course): add {args.label} — GPS coords + UI registration'])
    git(['push'])

    print(f'\n✓ Done. Vercel will auto-deploy {args.label}.\n')


if __name__ == '__main__':
    main()
