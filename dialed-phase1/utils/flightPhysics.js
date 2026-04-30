// DIALED Flight Physics Engine
// Models disc flight with wind effects per throw type (RHBH / RHFH / Sidearm / Tomahawk)

// ─── Distance Calculation ─────────────────────────────────────────────────────
// Returns estimated throw distance in feet for an amateur player

export function calculateFlightPath(disc, throwType, windCondition, windRelation, holeDist) {
  const speed = disc.speed || 7
  const glide = disc.glide || 5
  const turn = disc.turn || 0   // negative = high-speed right for RHBH
  const fade = disc.fade || 1   // positive = low-speed left fade for RHBH

  // Base distance — amateur baseline ~220ft, scaled by disc speed + glide
  const BASE = 220
  const speedBonus = (speed - 7) * 18
  const glideBonus = (glide - 4) * 12
  let baseDistance = BASE + speedBonus + glideBonus
  if (holeDist) baseDistance = Math.min(baseDistance, holeDist * 1.25)

  // Wind strength values
  const W = { calm: 0, light: 0.08, moderate: 0.18, strong: 0.30 }[windCondition] ?? 0
  const highSpd = speed >= 12
  const midSpd = speed >= 9
  const SF = highSpd ? 1.4 : midSpd ? 1.0 : 0.7  // speed-wind factor

  // Distance modifier: headwind loses yardage, tailwind gains a little
  let dMod = 0
  if (windRelation === 'headwind')    dMod = -(W * SF)
  else if (windRelation === 'tailwind') dMod =  W * 0.6
  else                                  dMod = -(W * 0.25)  // crosswind reduces slightly

  const throwDistance = Math.round(baseDistance * (1 + dMod))

  // ─── Lateral Offset ──────────────────────────────────────────────────────────
  // Positive = right of target, Negative = left (from tee looking toward basket)
  // RHBH: negative turn → disc goes RIGHT initially; positive fade → disc goes LEFT at end
  const isRHFH  = throwType === 'forehand' || throwType === 'sidearm'
  const isTomah = throwType === 'tomahawk'

  // Raw flight lateral for RHBH
  // turn=-3 → +24ft right, fade=2 → -12ft left → net +12 right
  let lateral = (-turn * 8) - (fade * 6)

  // Forehand/sidearm: turn/fade roles invert
  if (isRHFH) lateral = -lateral

  // Tomahawk: nose-up overhand, disc acts very overstable, ends right + short
  if (isTomah) {
    lateral = fade * 15 + W * 30
    return { distance: Math.round(throwDistance * 0.6), lateral: Math.round(lateral), description: buildDesc(disc, throwType, windCondition, windRelation, Math.round(throwDistance * 0.6), Math.round(lateral)) }
  }

  // Wind lateral effects
  const isUS = disc.turn <= -2
  const isOS = (disc.fade - Math.abs(disc.turn)) >= 2
  const WL = W * 25 * SF  // max wind lateral push in feet

  if (windRelation === 'headwind') {
    // Headwind amplifies high-speed turn → understable discs turn MORE
    lateral += (-turn) * W * 18
    if (isOS) lateral -= W * 8  // overstable: headwind reduces their fade a tiny bit
  } else if (windRelation === 'tailwind') {
    // Tailwind makes all discs act more overstable (less turn, more fade)
    lateral -= Math.abs(turn) * W * 12
    lateral -= WL * 0.4
  } else if (windRelation === 'cross_right') {
    // Wind from right → pushes disc LEFT for RHBH; forehand fights it differently
    lateral -= WL
    if (isRHFH) lateral += WL * 0.5
  } else if (windRelation === 'cross_left') {
    // Wind from left → pushes disc RIGHT
    lateral += WL
    if (isRHFH) lateral -= WL * 0.5
  }

  return {
    distance: throwDistance,
    lateral: Math.round(lateral),
    description: buildDesc(disc, throwType, windCondition, windRelation, throwDistance, Math.round(lateral)),
  }
}

function buildDesc(disc, throwType, windCondition, windRelation, dist, lat) {
  const parts = [`~${dist}ft`]
  if (lat > 25)       parts.push(`${lat}ft right of center`)
  else if (lat < -25) parts.push(`${Math.abs(lat)}ft left of center`)
  else                parts.push('near center line')
  if (windCondition !== 'calm' && windRelation) {
    const rel = { headwind: 'into headwind', tailwind: 'with tailwind', cross_left: 'cross-left wind', cross_right: 'cross-right wind' }[windRelation]
    parts.push(rel)
  }
  return parts.join(' · ')
}

// ─── Recommendation Reasoning ────────────────────────────────────────────────
// Returns an array of human-readable reason strings for why this disc is recommended

export function getDiscReason(disc, throwType, windCondition, windRelation, hazards = [], holeData = null) {
  const reasons = []
  const isOS   = disc.stability === 'Overstable'   || (disc.fade - Math.abs(disc.turn)) >= 2
  const isUS   = disc.stability === 'Understable'  || disc.turn <= -2
  const isRHFH = throwType === 'forehand' || throwType === 'sidearm'
  const wind   = windCondition !== 'calm'
  const W      = { light: 'light', moderate: 'moderate', strong: 'strong' }[windCondition] || ''

  // ── Throw type ──────────────────────────────────────────────────────────────
  if (isRHFH) {
    if (isOS)   reasons.push('Overstable discs are reliable forehand/sidearm — predictable rightward fade')
    else if (isUS) reasons.push('Understable here acts as neutral for forehand — good control')
    else        reasons.push('Neutral stability ideal for forehand accuracy')
  } else {
    if (isUS && !wind)  reasons.push('Understable in calm — easy turnover and max distance')
    else if (isOS)      reasons.push('Overstable backhand delivers consistent left fade on command')
    else                reasons.push('Neutral stability — straight lines with gentle finish')
  }

  // ── Wind reasoning ───────────────────────────────────────────────────────────
  if (wind && windRelation) {
    if (windRelation === 'headwind') {
      if (isOS)  reasons.push(`Overstable resists headwind — won't turn over in ${W} headwind`)
      else if (isUS) reasons.push(`⚠ Understable turns harder in ${W} headwind — high risk of veering off line`)
      if (disc.speed >= 12) reasons.push(`High-speed (${disc.speed}) driver gets amplified by headwind — expect increased turn`)
      if (isRHFH && isOS) reasons.push(`RHFH + overstable + headwind = reliable predictable fade right`)
    }
    if (windRelation === 'tailwind') {
      if (isUS)  reasons.push(`Tailwind stabilizes understable disc — flies straighter than usual`)
      if (isOS)  reasons.push(`⚠ Overstable fades hard in tailwind — flies left faster than expected`)
      if (!isOS) reasons.push(`Tailwind adds distance — this disc handles the extra push well`)
    }
    if (windRelation === 'cross_left') {
      if (isUS)  reasons.push(`⚠ Cross-left wind pushes understable disc further right — danger if OB right`)
      if (isOS)  reasons.push(`Overstable counters cross-left wind — fade cancels rightward push`)
      if (isRHFH) reasons.push(`RHFH forehand fights cross-left wind naturally`)
    }
    if (windRelation === 'cross_right') {
      if (isOS)  reasons.push(`⚠ Cross-right wind amplifies overstable fade — flies hard left`)
      if (isUS)  reasons.push(`Cross-right wind counters understable turn — balanced flight`)
      if (!isRHFH) reasons.push(`RHBH backhand: cross-right pushes disc left toward fade line`)
    }
  }

  // ── Hazard reasoning ────────────────────────────────────────────────────────
  const leftDanger  = hazards.filter(h => h.side === 'left'  && ['water', 'ob'].includes(h.type))
  const rightDanger = hazards.filter(h => h.side === 'right' && ['water', 'ob'].includes(h.type))
  const longDanger  = hazards.filter(h => h.side === 'long'  && ['water', 'ob'].includes(h.type))

  if (leftDanger.length) {
    const label = leftDanger[0].type === 'water' ? 'water' : 'OB'
    if (isOS && !isRHFH) reasons.push(`⚠ Overstable fades left toward ${label} — watch the line`)
    else if (!isOS)      reasons.push(`${label} left — this disc stays right of center, away from trouble`)
  }
  if (rightDanger.length) {
    const label = rightDanger[0].type === 'water' ? 'water' : 'OB'
    if (isUS) reasons.push(`⚠ Understable turns right toward ${label} — risky in any wind`)
    else      reasons.push(`${label} right — overstable fade keeps disc left of danger`)
  }
  if (longDanger.length) {
    const label = longDanger[0].type === 'water' ? 'water' : 'OB'
    if (disc.speed >= 11 && windRelation === 'headwind') reasons.push(`⚠ High-speed disc + headwind may run through into ${label} long`)
  }

  // ── Disc class reasoning ─────────────────────────────────────────────────────
  if (disc.speed >= 12)      reasons.push(`Distance driver (spd ${disc.speed}) — built for max range`)
  else if (disc.speed >= 8)  reasons.push(`Fairway driver (spd ${disc.speed}) — distance with control`)
  else if (disc.speed >= 5)  reasons.push(`Midrange (spd ${disc.speed}) — accuracy-focused choice`)
  else                       reasons.push(`Putter (spd ${disc.speed}) — precision approach shot`)

  // ── Hole context ─────────────────────────────────────────────────────────────
  if (holeData?.terrain?.type) {
    const t = holeData.terrain.type
    if (t.includes('wooded') && disc.speed <= 8) reasons.push('Lower speed disc threads wooded fairways better')
    if (t.includes('open') && disc.speed >= 10)  reasons.push('Open fairway rewards the distance this driver provides')
    if (holeData.terrain.doglegs?.includes('left') && isOS)  reasons.push('Hole doglegs left — overstable fade follows the bend')
    if (holeData.terrain.doglegs?.includes('right') && isUS) reasons.push('Hole doglegs right — understable turn follows the bend')
  }

  return reasons.length ? reasons : ['Balanced choice for current conditions']
}

// ─── Landing Coordinate Calculator ───────────────────────────────────────────
// Converts distance (ft) + lateral offset (ft) into GPS coordinates

export function calculateLandingCoords(teeLat, teeLon, basketLat, basketLon, distanceFt, lateralFt) {
  if (!teeLat || !basketLat) return null
  const toRad = d => d * Math.PI / 180

  // Bearing from tee to basket
  const dLon = toRad(basketLon - teeLon)
  const lat1 = toRad(teeLat), lat2 = toRad(basketLat)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  const bearing = Math.atan2(y, x)           // forward direction (radians)
  const perp    = bearing + Math.PI / 2      // 90° right = lateral right

  // 1 degree ≈ 364,000 ft (lat), adjusted for longitude
  const ftLat = 364000
  const ftLon = 364000 * Math.cos(toRad(teeLat))

  const forwardLat = (distanceFt * Math.cos(bearing)) / ftLat
  const forwardLon = (distanceFt * Math.sin(bearing)) / ftLon
  const latLat     = (lateralFt  * Math.cos(perp))    / ftLat
  const latLon     = (lateralFt  * Math.sin(perp))    / ftLon

  return {
    lat: teeLat + forwardLat + latLat,
    lng: teeLon + forwardLon + latLon,
  }
}
