export const HAZARD_TYPES = [
  { key: 'water',  label: 'Water',       color: '#0088ff', fillOpacity: 0.25, shape: 'polygon' },
  { key: 'ob',     label: 'Out of Bounds', color: '#ff2222', fillOpacity: 0,   shape: 'polyline' },
  { key: 'brush',  label: 'Thick Brush', color: '#ff8800', fillOpacity: 0.2,  shape: 'polygon' },
  { key: 'trees',  label: 'Trees',       color: '#00aa33', fillOpacity: 0.2,  shape: 'polygon' },
  { key: 'other',  label: 'Other',       color: '#aaaaaa', fillOpacity: 0.15, shape: 'polyline' },
]

export function hazardKey(course, hole) {
  return `dialed_hazards_${course}_${hole}`
}

export function loadHazards(course, hole) {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(hazardKey(course, hole)) || '[]')
  } catch { return [] }
}

export function saveHazards(course, hole, hazards) {
  if (typeof window === 'undefined') return
  localStorage.setItem(hazardKey(course, hole), JSON.stringify(hazards))
}

export function getHazardStyle(type) {
  return HAZARD_TYPES.find(h => h.key === type) || HAZARD_TYPES[4]
}

// ─── Wind / Stability Scoring ────────────────────────────────────────────────
// Returns { penalty: 0-20, warnings: string[] } for a disc given conditions

export function scoreDiscRisk(disc, windCondition, windDirection, hazards) {
  const warnings = []
  let penalty = 0

  const { speed, turn, fade, stability } = disc
  const isOS = stability === 'Overstable' || fade - Math.abs(turn) >= 2
  const isUS = stability === 'Understable' || turn <= -2

  const headwind = windDirection === 'headwind' || windCondition === 'headwind'
  const tailwind = windDirection === 'tailwind' || windCondition === 'tailwind'
  const crossLeft = windDirection === 'cross_left'
  const crossRight = windDirection === 'cross_right'

  const windStrong = ['moderate', 'strong'].includes(windCondition)
  const windMod = windCondition !== 'calm'

  // Understable + headwind = turns harder left (RHBH)
  if (isUS && headwind && windMod) {
    warnings.push('Understable disc turns more in headwind')
    penalty += windStrong ? 8 : 4
  }

  // Overstable + tailwind = fades harder
  if (isOS && tailwind && windMod) {
    warnings.push('Overstable disc fades harder in tailwind')
    penalty += windStrong ? 6 : 3
  }

  // High speed disc + headwind = goes longer / harder turn
  if (speed >= 12 && headwind && windMod) {
    warnings.push('High speed driver amplified by headwind')
    penalty += windStrong ? 5 : 2
  }

  // Cross wind interactions
  if (crossLeft && isUS) {
    warnings.push('Crosswind from left pushes understable disc further left')
    penalty += 5
  }
  if (crossRight && isOS) {
    warnings.push('Crosswind from right amplifies overstable fade right')
    penalty += 5
  }

  // ─── Hazard checks ──────────────────────────────────────────────────────────
  const leftHazards = hazards.filter(h => h.side === 'left')
  const rightHazards = hazards.filter(h => h.side === 'right')
  const longHazards = hazards.filter(h => h.side === 'long')

  const dangerLeft = leftHazards.filter(h => ['water', 'ob'].includes(h.type))
  const dangerRight = rightHazards.filter(h => ['water', 'ob'].includes(h.type))
  const dangerLong = longHazards.filter(h => ['water', 'ob'].includes(h.type))

  // Understable in headwind + danger left
  if (dangerLeft.length > 0 && isUS && (headwind || crossLeft) && windMod) {
    const label = dangerLeft[0].type === 'water' ? 'water' : 'OB'
    warnings.push(`⚠ Turns toward ${label} left in this wind — avoid`)
    penalty += 15
  }

  // Overstable + danger right in tailwind
  if (dangerRight.length > 0 && isOS && (tailwind || crossRight) && windMod) {
    const label = dangerRight[0].type === 'water' ? 'water' : 'OB'
    warnings.push(`⚠ Fades toward ${label} right in tailwind — avoid`)
    penalty += 15
  }

  // High speed + headwind + long hazard (runs through)
  if (dangerLong.length > 0 && speed >= 11 && headwind && windMod) {
    const label = dangerLong[0].type === 'water' ? 'water' : 'OB'
    warnings.push(`⚠ May run through into ${label} long — headwind adds distance`)
    penalty += 12
  }

  // General brush/trees on either side with strong turn
  const brushLeft = leftHazards.filter(h => h.type === 'brush' || h.type === 'trees')
  const brushRight = rightHazards.filter(h => h.type === 'brush' || h.type === 'trees')

  if (brushLeft.length > 0 && isUS && windMod) {
    warnings.push('Trees/brush left — understable may kick in')
    penalty += 5
  }
  if (brushRight.length > 0 && isOS && windMod) {
    warnings.push('Trees/brush right — overstable fade may find trouble')
    penalty += 5
  }

  return { penalty: Math.min(penalty, 30), warnings }
}

// Infer wind direction from degrees + hole bearing
export function inferWindRelation(windDeg, teeLat, teeLon, basketLat, basketLon) {
  if (windDeg === undefined || !teeLat) return null
  const holeBearing = Math.atan2(basketLon - teeLon, basketLat - teeLat) * (180 / Math.PI)
  const normalizedHole = (holeBearing + 360) % 360
  const diff = ((windDeg - normalizedHole) + 360) % 360

  if (diff < 45 || diff > 315) return 'tailwind'
  if (diff >= 45 && diff < 135) return 'cross_right'
  if (diff >= 135 && diff < 225) return 'headwind'
  return 'cross_left'
}
