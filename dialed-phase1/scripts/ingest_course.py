#!/usr/bin/env python3
"""
ingest_course.py — parse saved UDisc caddie-book HTML page(s), extract GPS
coordinates, update all 5 app registration files, then git commit + push.

USAGE
-----
  Single-tee course (one layout):
    python scripts/ingest_course.py \
        --short <saved.html> \
        --key   <course_key>      e.g.  stony_creek \
        --label <display_label>   e.g.  "Stony Creek" \
        --holes <number>          18 or 9 \
        [--dry-run]

  Multi-tee course (two layouts saved separately):
    python scripts/ingest_course.py \
        --short <short_tees.html> \
        --long  <long_tees.html> \
        --key   <course_key>      e.g.  grizzly \
        --label <display_label>   e.g.  "Grizzly Oaks" \
        --holes <number>          18 or 9 \
        [--dry-run]

HOW TO SAVE THE HTML
--------------------
  1. Open:  https://udisc.com/courses/<slug>/layouts/<id>/caddie-book
  2. Wait for the map to fully load.
  3. Browser menu → Save Page As → "Webpage, HTML Only"  (.html file)
  4. Run this script on that file.

IDENTIFYING SHORT vs LONG LAYOUTS ON UDISC
-------------------------------------------
  UDisc uses different names for tee layouts — look at the layout tab label:

    SHORT / Am tees  →  use as --short
      Labels you'll see:  "Am", "Amateur", "Short Tees", "White Tees",
                          "Rec", "Short", or any non-Pro/Blue label

    LONG / Pro tees  →  use as --long
      Labels you'll see:  "Pro", "Professional", "Long Tees", "Blue Tees",
                          "Gold", "Long", or the furthest-distance layout

  When in doubt: the layout with LONGER average distances is --long.

MULTI-TEE COURSES (e.g. Ghesquiere Park)
-----------------------------------------
  Navigate to each layout separately on UDisc, save each page, then run
  with both --short and --long.  The script merges them into one course
  entry using { shortTee, longTee, basket } format.

  For loop-format courses (9 baskets × 2 tees = 18 holes):
    Use --holes 18.  Holes 1–9 will use shortTee, holes 10–18 use longTee
    wrapping to basket index (holeNum-1) % 9.
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


# ── Merge short + long into multi-tee format ─────────────────────────────────
def merge_tee_layouts(short_holes: list, long_holes: list) -> list:
    """
    Zip two single-tee extractions into multi-tee hole entries.
    short_holes[i].tee  → shortTee
    long_holes[i].tee   → longTee
    short_holes[i].basket is used (baskets are the same physical object).
    """
    if len(short_holes) != len(long_holes):
        print(f'  WARNING: short layout has {len(short_holes)} holes, '
              f'long layout has {len(long_holes)} — using minimum')
    count = min(len(short_holes), len(long_holes))
    merged = []
    for i in range(count):
        merged.append({
            'shortTee': short_holes[i]['tee'],
            'longTee':  long_holes[i]['tee'],
            'basket':   short_holes[i]['basket'],
        })
    return merged


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
    ap = argparse.ArgumentParser(
        description='Ingest a UDisc caddie-book HTML into the app.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Layout identification:
  --short  →  Am / Short Tees / White Tees / Rec layout
  --long   →  Pro / Long Tees / Blue Tees / Gold layout

  When in doubt: the layout with longer average distances is --long.
        """
    )
    ap.add_argument('--short', required=True, metavar='HTML',
                    help='Path to saved caddie-book HTML for short/Am tees')
    ap.add_argument('--long',  metavar='HTML', default=None,
                    help='Path to saved caddie-book HTML for long/Pro tees '
                         '(omit for single-tee courses)')
    ap.add_argument('--key',   required=True, help='JS identifier  e.g. stony_creek')
    ap.add_argument('--label', required=True, help='Display name   e.g. "Stony Creek"')
    ap.add_argument('--holes', required=True, type=int, help='Number of holes: 9 or 18')
    ap.add_argument('--dry-run', action='store_true', help='Print without writing')
    args = ap.parse_args()

    # ── Parse short layout ────────────────────────────────────────────────────
    print(f'\n→ Parsing short layout: {args.short}')
    short_html  = Path(args.short).read_text(encoding='utf-8', errors='replace')
    short_holes = extract_holes(short_html, args.holes)

    # ── Parse long layout (optional) ─────────────────────────────────────────
    long_holes = None
    if args.long:
        print(f'→ Parsing long layout:  {args.long}')
        long_html  = Path(args.long).read_text(encoding='utf-8', errors='replace')
        long_holes = extract_holes(long_html, args.holes)

    # ── Validate counts ───────────────────────────────────────────────────────
    physical_holes = args.holes if not long_holes else min(len(short_holes), len(long_holes))

    if long_holes:
        # Multi-tee: physical basket count = holes / 2 for loop courses,
        # or holes directly if each physical hole has 2 tee pads
        # Use short_holes length as the physical count
        base_count = len(short_holes)
        if base_count != args.holes and base_count * 2 != args.holes:
            print(f'  WARNING: expected {args.holes} holes (or {args.holes//2} for loop), '
                  f'got {base_count} — check your HTML files')
        holes = merge_tee_layouts(short_holes[:base_count], long_holes[:base_count])
    else:
        # Single-tee
        if len(short_holes) != args.holes:
            print(f'  WARNING: expected {args.holes} holes, got {len(short_holes)} — truncating/padding')
        short_holes = short_holes[:args.holes]
        if len(short_holes) < args.holes:
            sys.exit(f'ERROR: only {len(short_holes)} holes found, cannot continue')
        holes = short_holes

    # ── Distances (from short tee to basket) ─────────────────────────────────
    def tee_coords(h):
        return h.get('shortTee') or h.get('tee')

    distances = [haversine_ft(tee_coords(h)[0], tee_coords(h)[1],
                               h['basket'][0],    h['basket'][1])
                 for h in holes]

    # For loop-format multi-tee courses, expand distances to full hole count
    if long_holes and args.holes > len(holes):
        from math import ceil
        long_distances = [
            haversine_ft(h['longTee'][0], h['longTee'][1],
                         h['basket'][0],  h['basket'][1])
            for h in holes
        ]
        distances = distances + long_distances  # short holes first, then long holes

    pars = [3] * args.holes

    # ── Course center (average tee positions) ─────────────────────────────────
    lats = [tee_coords(h)[0] for h in holes]
    lngs = [tee_coords(h)[1] for h in holes]
    center = (sum(lats) / len(lats), sum(lngs) / len(lngs))

    # ── Summary ───────────────────────────────────────────────────────────────
    tee_type = 'multi-tee (shortTee + longTee)' if long_holes else 'single-tee'
    print(f'\n  Course:    {args.label}  ({args.holes} holes, {tee_type})')
    print(f'  Key:       {args.key}')
    print(f'  Center:    {center[0]:.5f}, {center[1]:.5f}')
    print(f'  Distances: {distances}')

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
