let systemCache = null

async function getSystemData() {
  if (systemCache) return systemCache
  const res = await fetch('/data/dialed_detailed_system.json')
  systemCache = await res.json()
  return systemCache
}

// Returns top_5 disc list (array sorted by score) or null if not found
export async function getDiscRecommendations(courseKey, holeNumber, throwType, windCondition) {
  const data = await getSystemData()

  // Determine which sample block to use (palmer_park_samples only for now)
  const sampleKey = courseKey === 'palmer' ? 'palmer_park_samples' : 'kensington_samples'
  const samples = data[sampleKey] || data.palmer_park_samples
  if (!samples) return null

  const holeKey = `hole_${holeNumber}`
  const holeData = samples[holeKey]
  if (!holeData) return null

  const condition = holeData.conditions?.[windCondition]
  if (!condition) return null

  const throwData = condition.recommendations?.[throwType]
  if (!throwData?.top_5) return null

  // Convert object map to sorted array
  const discs = Object.entries(throwData.top_5).map(([name, data]) => ({
    name,
    ...data,
  }))
  discs.sort((a, b) => b.score - a.score)

  return {
    discs,
    mechanics: throwData.mechanics_info,
    conditionName: condition.name,
    throwName: throwData.throw_name,
  }
}

export function getWindLabel(condition) {
  return { calm: 'Calm', light: 'Light Wind', moderate: 'Moderate', strong: 'Strong Wind' }[condition] || condition
}

export function getThrowLabel(type) {
  return { backhand: 'Backhand', forehand: 'Forehand', sidearm: 'Sidearm', tomahawk: 'Tomahawk' }[type] || type
}

export const WIND_CONDITIONS = ['calm', 'light', 'moderate', 'strong']
export const THROW_TYPES = ['backhand', 'forehand', 'sidearm', 'tomahawk']
