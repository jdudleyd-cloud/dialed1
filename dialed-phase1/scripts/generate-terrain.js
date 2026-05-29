// generate-terrain.js
// Fetches real elevation data for disc golf courses and appends to terrain JSON
// Uses USGS National Map EPQ service (no rate limit, 1m resolution 3DEP data)
// Run: node scripts/generate-terrain.js

const https = require('https')
const fs = require('fs')
const path = require('path')

const NUM_SAMPLES = 20
const LATERAL_OFFSET = 0.00012   // ~13m offset; distinct at 1m DEM resolution
const CONCURRENT = 10            // parallel USGS requests

// ── Course definitions ────────────────────────────────────────────────────────

const COURSES = [
  {
    name: 'Stony Creek Buckhorn North Blue',
    terrain_type: 'rolling_wooded',
    holes: (() => {
      const coords = [
        { tee: [42.7323689, -83.0605464], basket: [42.7334295, -83.0602877] },
        { tee: [42.7339906, -83.0603837], basket: [42.7325622, -83.0614718] },
        { tee: [42.7321173, -83.0612736], basket: [42.7311001, -83.060884]  },
        { tee: [42.7312159, -83.0617518], basket: [42.7324233, -83.0618478] },
        { tee: [42.7331658, -83.061793],  basket: [42.7339794, -83.06174]   },
        { tee: [42.734597379633875, -83.06187428534031], basket: [42.7356014, -83.0617977] },
        { tee: [42.7356953, -83.0621212], basket: [42.7359471, -83.0615275] },
        { tee: [42.73588827149209, -83.06090399622916], basket: [42.7357105, -83.0596643] },
        { tee: [42.7360585, -83.059899],  basket: [42.736265,  -83.0588303] },
        { tee: [42.73581759573506, -83.05829521268606], basket: [42.7359813, -83.0571942] },
        { tee: [42.735566931390544, -83.05783066448082], basket: [42.7357283, -83.0587427] },
        { tee: [42.735372021750294, -83.0588179961195], basket: [42.7348308, -83.058973] },
        { tee: [42.7350706, -83.0592895], basket: [42.7354631, -83.0594903] },
        { tee: [42.7352839, -83.0599312], basket: [42.7356359, -83.0607623] },
        { tee: [42.73504926871892, -83.06112527847289], basket: [42.7342307, -83.061181] },
        { tee: [42.7342851, -83.0606653], basket: [42.7346847, -83.059509]  },
        { tee: [42.7343542, -83.0587089], basket: [42.7335274, -83.0586234] },
        { tee: [42.7335021, -83.05902],   basket: [42.7330618, -83.0593759] },
      ]
      const pars  = [3,4,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3]
      const dists = [420,597,385,441,297,367,184,370,297,302,252,202,153,293,305,343,302,187]
      return coords.map((c, i) => ({
        tee: c.tee, basket: c.basket, par: pars[i], dist_am: dists[i], dist_pro: dists[i],
      }))
    })(),
  },
  {
    name: 'Ahee Disc Golf Course Ghesquiere Park',
    terrain_type: 'flat_open',
    holes: (() => {
      const shortTees = [
        [42.43454955113501, -82.91315084381885],
        [42.43431139479647, -82.91400946153759],
        [42.43450102411872, -82.91447817512753],
        [42.433540537398564, -82.91445283456213],
        [42.43272430667197, -82.91436381753547],
        [42.432312847961754, -82.91342378893714],
        [42.432478606494,    -82.91253031433537],
        [42.432718265959785, -82.91359368474333],
        [42.433419700085786, -82.91429411051013],
      ]
      const longTees = [
        [42.43391413789408, -82.91348263285518],
        [42.43459589415779, -82.91338785194252],
        [42.43473332243097, -82.91450522171920],
        [42.4336947,        -82.9146078],
        [42.432825320699564, -82.91441653262594],
        [42.432436531962985, -82.91358426312914],
        [42.43279815106355, -82.91254840994624],
        [42.432908121766985, -82.91305425768894],
        [42.43327312936595, -82.91436132799092],
      ]
      const baskets = [
        [42.43445600553658, -82.91379145282289],
        [42.434854755826855, -82.91420257672297],
        [42.4338898453611,   -82.91437199829394],
        [42.4328884,         -82.914558],
        [42.43257265403353,  -82.91362765817695],
        [42.43212489042748,  -82.91260899490854],
        [42.432693895167496, -82.91333901027727],
        [42.433123792763965, -82.91421643850199],
        [42.43411425417255,  -82.91382845913095],
      ]
      const pars  = [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3]
      const dists = [176,205,225,240,206,230,231,224,283,214,239,310,294,232,286,216,323,339]
      const out = []
      for (let i = 0; i < 9; i++) {
        out.push({ tee: shortTees[i], basket: baskets[i], par: pars[i], dist_am: dists[i], dist_pro: dists[i+9] })
      }
      for (let i = 0; i < 9; i++) {
        out.push({ tee: longTees[i], basket: baskets[i], par: pars[i+9], dist_am: dists[i], dist_pro: dists[i+9] })
      }
      return out
    })(),
  },
  {
    name: 'Spindler Park',
    terrain_type: 'flat_mixed',
    holes: (() => {
      const shortTees = [
        [42.4714058,  -82.918664],
        [42.4724033,  -82.9176863],
        [42.4724337,  -82.918889],
        [42.472246810956236, -82.92040872468645],
        [42.47150000657482,  -82.92124967018395],
        [42.4728288,  -82.9220659],
        [42.4714651,  -82.921918],
        [42.47137111006366,  -82.92122164321141],
        [42.4711714,  -82.9192568],
        [42.4690862,  -82.9203846],
        [42.46764581366042,  -82.92068883776663],
        [42.4697547,  -82.9190285],
      ]
      const longTees = [
        [42.4713768,  -82.9183002],
        [42.4729117,  -82.9174438],
        [42.4722718,  -82.9191465],
        [42.4722746,  -82.9208072],
        [42.4714884,  -82.9212445],
        [42.4723344,  -82.9220105],
        [42.471189,   -82.9219571],
        [42.4711632,  -82.9208233],
        [42.4710496,  -82.9194817],
        [42.4687738,  -82.9200277],
        [42.4678551,  -82.9207652],
        [42.47037250191569, -82.91863276639351],
      ]
      const baskets = [
        [42.47232091334436,  -82.91821540549489],
        [42.4727972686317,   -82.91860756178981],
        [42.47193665744022,  -82.92037066072224],
        [42.47168340312324,  -82.92112219363405],
        [42.472366502044395, -82.9214483091001],
        [42.47159921459128,  -82.92154281678484],
        [42.47128778220229,  -82.92116687724513],
        [42.471645733377635, -82.91970328977932],
        [42.47041854200685,  -82.91950018108042],
        [42.46810509489642,  -82.9208422915214],
        [42.46831990278945,  -82.92022139430203],
        [42.47006959332443,  -82.91950023637403],
      ]
      const pars  = Array(24).fill(3)
      const dists = [355,287,438,281,321,470,212,421,282,379,276,171,345,316,351,232,325,296,216,349,230,328,224,258]
      const out = []
      for (let i = 0; i < 12; i++) {
        out.push({ tee: shortTees[i], basket: baskets[i], par: pars[i], dist_am: dists[i], dist_pro: dists[i+12] })
      }
      for (let i = 0; i < 12; i++) {
        out.push({ tee: longTees[i], basket: baskets[i], par: pars[i+12], dist_am: dists[i], dist_pro: dists[i+12] })
      }
      return out
    })(),
  },
]

// ── Geometry helpers ──────────────────────────────────────────────────────────

function perpOffset(lat1, lon1, lat2, lon2, side) {
  const dLat = lat2 - lat1
  const dLon = lon2 - lon1
  const len = Math.sqrt(dLat * dLat + dLon * dLon) || 1
  const mult = side === 'left' ? 1 : -1
  return { dLat: mult * (-dLon / len) * LATERAL_OFFSET, dLon: mult * (dLat / len) * LATERAL_OFFSET }
}

function buildSamplePoints(tee, basket) {
  const [lat1, lon1] = tee
  const [lat2, lon2] = basket
  const leftOff  = perpOffset(lat1, lon1, lat2, lon2, 'left')
  const rightOff = perpOffset(lat1, lon1, lat2, lon2, 'right')
  const center = [], left = [], right = []
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / (NUM_SAMPLES - 1)
    const cLat = lat1 + t * (lat2 - lat1)
    const cLon = lon1 + t * (lon2 - lon1)
    center.push({ latitude: cLat, longitude: cLon })
    left.push({ latitude: cLat + leftOff.dLat, longitude: cLon + leftOff.dLon })
    right.push({ latitude: cLat + rightOff.dLat, longitude: cLon + rightOff.dLon })
  }
  return { center, left, right }
}

// ── USGS 3DEP Elevation API ───────────────────────────────────────────────────

function fetchOneElevation(lat, lon) {
  return new Promise((resolve, reject) => {
    const url = `https://epqs.nationalmap.gov/v1/json?x=${lon}&y=${lat}&wkid=4326&includeDate=false`
    https.get(url, res => {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          const v = parseFloat(json.value)
          if (isNaN(v)) { reject(new Error('Bad value: ' + body)); return }
          resolve(v * 3.28084) // meters → feet
        } catch(e) { reject(e) }
      })
    }).on('error', reject)
  })
}

// Fetch with retry for transient errors
async function fetchWithRetry(lat, lon, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchOneElevation(lat, lon)
    } catch(e) {
      if (i === attempts - 1) throw e
      await new Promise(r => setTimeout(r, 1000 * (i + 1)))
    }
  }
}

// Parallel batch fetch with concurrency limit
async function fetchAllElevations(points) {
  const results = new Array(points.length)
  let idx = 0
  let done = 0
  const total = points.length

  async function worker() {
    while (idx < total) {
      const i = idx++
      results[i] = await fetchWithRetry(points[i].latitude, points[i].longitude)
      done++
      if (done % 50 === 0 || done === total) {
        process.stdout.write(`  ${done}/${total} points fetched\n`)
      }
    }
  }

  const workers = Array.from({ length: CONCURRENT }, worker)
  await Promise.all(workers)
  return results
}

// ── Terrain classification ────────────────────────────────────────────────────

function classifyTerrainType(centerProfile, courseTerrainType) {
  const change = Math.abs(centerProfile[centerProfile.length - 1] - centerProfile[0])
  if (change < 12) return courseTerrainType
  if (change < 40) {
    if (courseTerrainType.includes('wooded')) return 'rolling_wooded'
    if (courseTerrainType.includes('open'))   return 'rolling_open'
    return 'rolling_mixed'
  }
  return 'wooded'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const outPath = path.join(__dirname, '..', 'public', 'data', 'courses_3d_terrain_complete.json')
  const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'))

  for (const course of COURSES) {
    if (existing.courses.find(c => c.course === course.name)) {
      console.log(`\nSkipping ${course.name} — already exists`)
      continue
    }
    console.log(`\n=== ${course.name} (${course.holes.length} holes) ===`)

    // Build all sample points
    const allPoints = []
    const holeMeta = []

    for (const hole of course.holes) {
      const { center, left, right } = buildSamplePoints(hole.tee, hole.basket)
      const startIdx = allPoints.length
      allPoints.push(...left, ...center, ...right)
      holeMeta.push({ startIdx })
    }

    console.log(`  Fetching ${allPoints.length} points via USGS 3DEP (${CONCURRENT} concurrent)...`)
    const elevationsF = await fetchAllElevations(allPoints)

    const holeResults = []
    const allCenterElevs = []

    for (let i = 0; i < course.holes.length; i++) {
      const hole = course.holes[i]
      const { startIdx } = holeMeta[i]
      const n = NUM_SAMPLES

      const leftProfile   = elevationsF.slice(startIdx,         startIdx + n)
      const centerProfile = elevationsF.slice(startIdx + n,     startIdx + 2 * n)
      const rightProfile  = elevationsF.slice(startIdx + 2 * n, startIdx + 3 * n)

      allCenterElevs.push(...centerProfile)

      holeResults.push({
        hole: i + 1,
        par: hole.par,
        distance_am: hole.dist_am,
        distance_pro: hole.dist_pro,
        tee: { lat: hole.tee[0], lon: hole.tee[1] },
        basket: { lat: hole.basket[0], lon: hole.basket[1] },
        terrain: {
          type: classifyTerrainType(centerProfile, course.terrain_type),
          doglegs: 'straight',
          hazards: [],
          elevation_profiles: {
            left_fairway: leftProfile,
            center_line: centerProfile,
            right_fairway: rightProfile,
          },
        },
      })
    }

    const baseElev = Math.min(...allCenterElevs)
    existing.courses.push({
      course: course.name,
      terrain_type: course.terrain_type,
      base_elevation_ft: Math.round(baseElev),
      holes: holeResults,
    })

    // Save after each course in case of failure
    fs.writeFileSync(outPath, JSON.stringify(existing, null, 2))
    console.log(`  ✓ ${holeResults.length} holes written, base ~${Math.round(baseElev)} ft`)
  }

  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
