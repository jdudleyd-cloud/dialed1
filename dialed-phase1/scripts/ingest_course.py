#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
"""
ingest_course.py  —  Add a course to the Dialed app, fully automated.

USAGE
-----
  Single-tee course:
    python scripts/ingest_course.py
        --short "https://udisc.com/courses/SLUG/layouts/ID/caddie-book"
        --key   course_key
        --label "Course Name"
        --holes 18

  Multi-tee course (Am + Pro tees):
    python scripts/ingest_course.py
        --short "https://udisc.com/courses/SLUG/layouts/SHORT_ID/caddie-book"
        --long  "https://udisc.com/courses/SLUG/layouts/LONG_ID/caddie-book"
        --key   course_key
        --label "Course Name"
        --holes 18

  Updating an existing course (e.g. adding short tees to Palmer):
    same as above but add  --update

  Preview without writing anything:
    add  --dry-run

HOW TO FIND THE URL
-------------------
  1. Go to udisc.com -> search the course -> click Layouts
  2. Pick the Am/Short layout -> click Caddie Book
  3. Copy the URL from your browser.  It looks like:
       https://udisc.com/courses/detroit-palmer-park-dgc-AkPa/layouts/73810/caddie-book
  4. Paste it as --short.  For Pro/Long tees, find that layout and paste as --long.

NAMING
------
  --key    lowercase, underscores only:  oak_park  river_bends
  --label  quoted display name:          "Oak Park"  "River Bends"
  --holes  9 or 18

SHORT vs LONG
-------------
  Am / Short Tees / White / Rec  ->  --short
  Pro / Long Tees / Blue / Gold  ->  --long
"""

import re, json, math, subprocess, argparse, time
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
    R = 20902231
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlng / 2) ** 2)
    return round(2 * R * math.asin(math.sqrt(a)))


# ── Browser scraper ───────────────────────────────────────────────────────────
def scrape_udisc(url: str) -> list:
    """
    Launch a headless browser, load the UDisc caddie-book page,
    wait for React Router to populate the hole data, extract GPS coords.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit(
            'ERROR: Playwright not installed.\n'
            'Run:  pip install playwright && python -m playwright install chromium'
        )

    print(f'   Opening browser -> {url}')

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Block images/fonts to speed up load
        page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}',
                   lambda r: r.abort())

        page.goto(url, wait_until='domcontentloaded', timeout=60000)

        # Wait until React Router has loaded the hole data
        try:
            page.wait_for_function(
                """() => {
                    const ctx = window.__reactRouterContext?.state?.loaderData;
                    if (!ctx) return false;
                    return Object.values(ctx).some(
                        v => v?.selectedLayout?.holes?.length > 0
                    );
                }""",
                timeout=30000
            )
        except Exception:
            # Fallback: give it a few more seconds
            time.sleep(5)

        holes_raw = page.evaluate("""() => {
            const ctx = window.__reactRouterContext?.state?.loaderData;
            if (!ctx) return null;
            const entry = Object.values(ctx).find(v => v?.selectedLayout?.holes?.length > 0);
            if (!entry) return null;
            return entry.selectedLayout.holes
                .sort((a, b) => a.holeNumber - b.holeNumber)
                .map(h => ({
                    hole:   h.holeNumber,
                    tee:    [h.teePosition.latitude,    h.teePosition.longitude],
                    basket: [h.targetPosition.latitude, h.targetPosition.longitude]
                }));
        }""")

        browser.close()

    if not holes_raw:
        sys.exit(
            f'ERROR: Could not extract hole data from:\n  {url}\n'
            'Make sure the URL ends with /caddie-book and the course exists on UDisc.'
        )

    return [{'tee': h['tee'], 'basket': h['basket']} for h in holes_raw]


# ── Merge short + long into multi-tee format ─────────────────────────────────
def merge_tee_layouts(short_holes: list, long_holes: list) -> list:
    count = min(len(short_holes), len(long_holes))
    if len(short_holes) != len(long_holes):
        print(f'   WARNING: short={len(short_holes)} holes, long={len(long_holes)} -> using {count}')
    return [
        {
            'shortTee': short_holes[i]['tee'],
            'longTee':  long_holes[i]['tee'],
            'basket':   short_holes[i]['basket'],
        }
        for i in range(count)
    ]


# ── courseData.js patching ────────────────────────────────────────────────────
def _fmt(coord):
    return f'[{coord[0]}, {coord[1]}]'

def _coord_entry(h):
    if 'shortTee' in h:
        return (f'    {{ shortTee: {_fmt(h["shortTee"])}, '
                f'longTee: {_fmt(h["longTee"])}, '
                f'basket: {_fmt(h["basket"])} }},')
    return f'    {{ tee: {_fmt(h["tee"])}, basket: {_fmt(h["basket"])} }},'


def update_course_data(key, label, holes, distances, pars, dry_run, update=False):
    path = FILES['courseData']
    src  = path.read_text(encoding='utf-8')
    already = f'  {key}:' in src

    if already and not update:
        print(f'   SKIP courseData.js — {key} already exists (use --update to overwrite)')
        return

    if already:
        # Strip old coord block
        # Use '\n  ],' to anchor the search to a line start, avoiding false
        # matches inside coordinate values like "      -83.xxx      ],"
        s = src.index(f'  {key}: [')
        e = src.index('\n  ],', s) + len('\n  ],')
        src = src[:s] + src[e:].lstrip('\n')
        # Strip old COURSE_HOLES entry
        s2 = src.index(f'  {key}: {{')
        e2 = src.index('\n  },\n', s2) + len('\n  },\n')
        src = src[:s2] + src[e2:].lstrip('\n')

    lines = [f'  {key}: [', f'    // {label}']
    for i, h in enumerate(holes):
        lines.append(f'    // hole {i + 1}')
        lines.append(_coord_entry(h))
    lines.append('  ],')
    coord_block = '\n'.join(lines) + '\n'

    anchor = '\nexport const COURSE_HOLES'
    if anchor not in src:
        raise ValueError('Cannot find "export const COURSE_HOLES" in courseData.js')
    idx = src.index(anchor)
    src = src[:idx] + coord_block + src[idx:]

    dist_str = ', '.join(str(d) for d in distances)
    pars_str = ', '.join(str(p) for p in pars)
    holes_block = f'  {key}: {{\n    distances: [{dist_str}],\n    pars: [{pars_str}],\n  }},\n'

    anchor2 = '\n}\n\n// Returns'
    if anchor2 not in src:
        raise ValueError('Cannot find COURSE_HOLES closing anchor in courseData.js')
    idx2 = src.index(anchor2)
    src = src[:idx2] + '\n' + holes_block + src[idx2:]

    if not dry_run:
        path.write_text(src, encoding='utf-8')


def update_course_tab(key, label, holes_count, center, dry_run, update=False):
    path = FILES['courseTab']
    src  = path.read_text(encoding='utf-8')

    if f"key: '{key}'" in src:
        print(f'   SKIP CourseTab.js — {key} already registered')
        return

    new = src
    new = new.replace(']\nconst COURSE_CENTERS',
                      f"  {{ key: '{key}', label: '{label}', holes: {holes_count} }},\n]\nconst COURSE_CENTERS")
    new = new.replace('}\nconst COURSE_JSON_NAME',
                      f"  {key}: {{ lat: {center[0]:.5f}, lng: {center[1]:.5f} }},\n}}\nconst COURSE_JSON_NAME")
    new = new.replace('}\n\n// ─── Google Maps loader',
                      f"  {key}: '{label}',\n}}\n\n// ─── Google Maps loader")

    if new == src:
        print('   WARNING: CourseTab.js anchors not matched — check manually')
    elif not dry_run:
        path.write_text(new, encoding='utf-8')


def update_inline_file(fkey, pattern, key, value, dry_run, update=False):
    path = FILES[fkey]
    src  = path.read_text(encoding='utf-8')

    if f"'{key}'" in src or f'"{key}"' in src:
        print(f'   SKIP {path.name} — {key} already present')
        return

    def replacer(m):
        inner = m.group(0).rstrip()
        if inner.endswith('}'):
            inner = inner[:-1].rstrip().rstrip(',')
            return f"{inner}, {key}: '{value}'" + ' }'
        return m.group(0)

    new = re.sub(pattern, replacer, src)
    if new == src:
        print(f'   WARNING: {path.name} pattern not matched — check manually')
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
    ap = argparse.ArgumentParser(description='Add a UDisc course to the Dialed app.')
    ap.add_argument('--short', required=True,
                    help='Caddie-book URL for short/Am tees')
    ap.add_argument('--long',  default=None,
                    help='Caddie-book URL for long/Pro tees (omit for single-tee)')
    ap.add_argument('--key',   required=True, help='JS key e.g. oak_park')
    ap.add_argument('--label', required=True, help='Display name e.g. "Oak Park"')
    ap.add_argument('--holes', required=True, type=int, help='9 or 18')
    ap.add_argument('--loop',     action='store_true',
                    help='Single URL contains 2N holes: first N = short tees, last N = long tees '
                         '(e.g. "White 12 + Black 12" style layouts)')
    ap.add_argument('--update',   action='store_true', help='Overwrite existing course')
    ap.add_argument('--dry-run',  action='store_true', help='Preview without writing')
    args = ap.parse_args()

    print(f'\n=== Dialed Course Ingest: {args.label} ===\n')

    # Scrape short tees
    print(f'[1/5] Scraping layout...')
    short_holes = scrape_udisc(args.short)
    print(f'   {len(short_holes)} holes extracted')

    # Scrape long tees (optional)
    long_holes = None
    if args.loop:
        # Single URL has 2N holes: split first half = short, second half = long
        total = len(short_holes)
        if total % 2 != 0:
            sys.exit(f'ERROR: --loop expects an even number of holes, got {total}')
        half = total // 2
        long_holes  = short_holes[half:]   # second half = long tees
        short_holes = short_holes[:half]   # first half  = short tees
        print(f'   Split into {half} short-tee + {half} long-tee holes')
        print(f'[2/5] Long tees split from same layout')
    elif args.long:
        print(f'[2/5] Scraping long tees...')
        long_holes = scrape_udisc(args.long)
        print(f'   {len(long_holes)} holes extracted')
    else:
        print(f'[2/5] No long tees — single-tee course')

    # Build merged hole list
    if long_holes:
        base = len(short_holes)
        holes = merge_tee_layouts(short_holes[:base], long_holes[:base])
    else:
        holes = short_holes[:args.holes]

    # Distances
    def tee_pt(h):
        return h.get('shortTee') or h.get('tee')

    short_dist = [haversine_ft(tee_pt(h)[0], tee_pt(h)[1], h['basket'][0], h['basket'][1])
                  for h in holes]

    if long_holes and args.loop:
        # Loop-format (Ghesquiere/Spindler style): holes 1-N from short, N+1-2N from long
        # distances array has 2N entries so getCourseHoleCount returns 2N correctly
        long_dist = [haversine_ft(h['longTee'][0], h['longTee'][1], h['basket'][0], h['basket'][1])
                     for h in holes]
        distances = short_dist + long_dist
    else:
        # True multi-tee (Palmer style): 18 real holes, short tee is the default distance
        distances = short_dist

    pars = [3] * args.holes

    lats = [tee_pt(h)[0] for h in holes]
    lngs = [tee_pt(h)[1] for h in holes]
    center = (sum(lats) / len(lats), sum(lngs) / len(lngs))

    tee_type = 'multi-tee (loop)' if args.loop else ('multi-tee' if long_holes else 'single-tee')
    print(f'\n   Course:    {args.label}  ({args.holes} holes, {tee_type})')
    print(f'   Center:    {center[0]:.5f}, {center[1]:.5f}')
    print(f'   Distances: {distances}')

    if args.dry_run:
        print('\n[dry-run] No files written.\n')
        return

    print(f'\n[3/5] Updating source files...')
    update_course_data(args.key, args.label, holes, distances, pars, args.dry_run, args.update)
    print('   OK courseData.js')
    update_course_tab(args.key, args.label, args.holes, center, args.dry_run, args.update)
    print('   OK CourseTab.js')
    update_inline_file('appLayout', r"const COURSE_LABELS\s*=\s*\{[^\}]+\}",
                       args.key, args.label.upper(), args.dry_run, args.update)
    print('   OK AppLayout.js')
    update_inline_file('playTab', r"const COURSE_NAMES\s*=\s*\{[^\}]+\}",
                       args.key, args.label, args.dry_run, args.update)
    print('   OK PlayTab.js')
    update_inline_file('vsTab', r"const COURSE_NAMES\s*=\s*\{[^\}]+\}",
                       args.key, args.label, args.dry_run, args.update)
    print('   OK VsTab.js')

    print(f'\n[4/5] Committing...')
    git(['add',
         'utils/courseData.js', 'components/tabs/CourseTab.js',
         'components/AppLayout.js', 'components/tabs/PlayTab.js',
         'components/tabs/VsTab.js'])
    git(['commit', '-m', f'feat(course): add {args.label} — GPS coords + UI registration'])

    print(f'[5/5] Pushing to GitHub...')
    git(['push'])

    print(f'\n=== Done. {args.label} will be live on Vercel in ~2 minutes. ===\n')


if __name__ == '__main__':
    main()
