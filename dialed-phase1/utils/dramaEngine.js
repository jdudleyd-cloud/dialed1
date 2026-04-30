// DIALED — Drama Engine
// Controls banter timing, situation detection, rivalry tracking, streaks
// Banter fires at: tee box | after AI throw result | after player throw result
// Base chance is low. Escalates sharply during pressure, rivalry, streaks, comebacks.

// ─── Banter probability thresholds ────────────────────────────────────────────
const CHANCE = {
  base:       0.22,   // normal play — roughly 1 in 4 eligible moments
  pressure:   0.65,   // within 2 strokes, holes 13+
  rivalry:    0.72,   // dominating (4+ stroke lead or deficit)
  hotStreak:  0.80,   // AI on 3+ birdie or better run
  slump:      0.40,   // AI on 3+ bogey+ run (quieter, more self-pitying)
  comeback:   0.90,   // AI just tied after being down 3+
  milestone:  1.00,   // AI just aced or eagled — always fires
}

// ─── Situation resolver ────────────────────────────────────────────────────────
// Returns the banter key that best matches the current game state + event
// event: 'tee' | 'myBirdie' | 'myBogey' | 'yourBirdie' | 'yourBogey'
export function resolveSituation(state, event) {
  const { aiStreak, gap, currentHole, comingBack } = state
  const isLate = currentHole >= 13
  const isPressure = Math.abs(gap) <= 2 && isLate
  const isRivalry = Math.abs(gap) >= 4

  if (comingBack && event === 'myBirdie') return 'hotStreak'
  if (aiStreak >= 3 && (event === 'myBirdie')) return 'hotStreak'
  if (aiStreak <= -3 && (event === 'myBogey')) return 'slump'
  if (isPressure && event === 'tee') return 'pressure'
  if (isRivalry && gap < 0 && event === 'tee') return 'rivalry'   // AI is losing
  if (isRivalry && gap > 0 && event === 'myBirdie') return 'rivalry' // AI dominating

  return event
}

// ─── Should banter fire? ──────────────────────────────────────────────────────
export function shouldBanter(state, event) {
  const { aiStreak, gap, currentHole, comingBack, isAce } = state
  if (isAce) return true  // always banter on ace/eagle

  const isLate = currentHole >= 13
  const isPressure = Math.abs(gap) <= 2 && isLate
  const isRivalry = Math.abs(gap) >= 4
  const isHotStreak = aiStreak >= 3
  const isSlump = aiStreak <= -3

  let chance = CHANCE.base
  if (comingBack)   chance = CHANCE.comeback
  else if (isHotStreak) chance = CHANCE.hotStreak
  else if (isPressure)  chance = CHANCE.pressure
  else if (isRivalry)   chance = CHANCE.rivalry
  else if (isSlump)     chance = CHANCE.slump

  return Math.random() < chance
}

// ─── Get banter line ──────────────────────────────────────────────────────────
export function getBanterLine(persona, state, event) {
  if (!persona?.banter) return null
  const situation = resolveSituation(state, event)
  const lines = persona.banter[situation] || persona.banter[event] || persona.banter.tee
  if (!lines || lines.length === 0) return null
  return lines[Math.floor(Math.random() * lines.length)]
}

// ─── Full banter attempt ──────────────────────────────────────────────────────
// Returns a line string if banter fires, null if it doesn't
export function attemptBanter(persona, state, event) {
  if (!shouldBanter(state, event)) return null
  return getBanterLine(persona, state, event)
}

// ─── Game state tracker ───────────────────────────────────────────────────────
// Call this after each hole completes to get updated drama state
export function updateDramaState(prev, holeResult) {
  // holeResult: { playerStrokes, aiStrokes, par }
  const { playerStrokes, aiStrokes, par } = holeResult
  const playerVsPar = playerStrokes - par
  const aiVsPar = aiStrokes - par

  // Streak tracking (positive = AI birdies in a row, negative = bogeys)
  let aiStreak = prev.aiStreak || 0
  if (aiVsPar <= -1) {
    aiStreak = aiStreak < 0 ? 1 : aiStreak + 1
  } else if (aiVsPar >= 1) {
    aiStreak = aiStreak > 0 ? -1 : aiStreak - 1
  } else {
    // par — streak resets toward 0 by 1
    if (aiStreak > 0) aiStreak--
    else if (aiStreak < 0) aiStreak++
  }

  // Cumulative score gap: positive = AI ahead, negative = AI behind
  const gap = (prev.gap || 0) + (playerStrokes - aiStrokes)

  // Comeback: AI just tied or took lead after being down 3+
  const wasDown = (prev.gap || 0) <= -3
  const nowEven = gap >= 0
  const comingBack = wasDown && nowEven

  // Ace/eagle detection
  const isAce = aiStrokes === 1
  const isEagle = aiVsPar <= -2

  return {
    ...prev,
    aiStreak,
    gap,
    comingBack,
    isAce,
    isEagle,
    currentHole: (prev.currentHole || 1) + 1,
  }
}

// ─── Initial drama state ──────────────────────────────────────────────────────
export function initialDramaState(startingHole = 1) {
  return {
    aiStreak: 0,
    gap: 0,
    comingBack: false,
    isAce: false,
    isEagle: false,
    currentHole: startingHole,
  }
}

// ─── Rivalry label ────────────────────────────────────────────────────────────
export function getRivalryLabel(gap) {
  if (gap >= 5) return 'DOMINATING'
  if (gap >= 3) return 'LEADING'
  if (gap >= 1) return 'AHEAD'
  if (gap === 0) return 'TIED'
  if (gap >= -2) return 'BEHIND'
  if (gap >= -4) return 'STRUGGLING'
  return 'DIGGING OUT'
}

export function getRivalryColor(gap) {
  if (gap >= 3) return '#ffeb3b'
  if (gap >= 1) return '#00d4ff'
  if (gap === 0) return '#aaa'
  if (gap >= -2) return '#ff9900'
  return '#ff4444'
}
