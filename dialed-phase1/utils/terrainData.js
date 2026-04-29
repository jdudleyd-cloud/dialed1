// Cache loaded JSON so we only fetch once per session
let terrainCache = null
let elevationCache = {}

export async function getTerrainData() {
  if (terrainCache) return terrainCache
  const res = await fetch('/data/courses_3d_terrain_complete.json')
  terrainCache = await res.json()
  return terrainCache
}

export async function getElevationData(courseKey) {
  if (elevationCache[courseKey]) return elevationCache[courseKey]
  const file = courseKey === 'kensington'
    ? '/data/kensington_elevation_data.json'
    : '/data/palmer_park_elevation_data.json'
  const res = await fetch(file)
  elevationCache[courseKey] = await res.json()
  return elevationCache[courseKey]
}

export function getCourseNames(terrainData) {
  return terrainData.courses.map(c => c.course)
}

export function getHoleData(terrainData, courseName, holeNumber) {
  const course = terrainData.courses.find(c => c.course === courseName)
  if (!course) return null
  return course.holes.find(h => h.hole === holeNumber) || null
}

export function getElevationProfiles(holeData) {
  if (!holeData?.terrain?.elevation_profiles) return null
  const { left_fairway, center_line, right_fairway } = holeData.terrain.elevation_profiles
  const pcts = holeData.terrain.distance_pct || center_line.map((_, i) => (i / (center_line.length - 1)) * 100)
  return { left_fairway, center_line, right_fairway, distance_pct: pcts }
}

export function normalizeProfiles(profiles) {
  const allVals = [
    ...profiles.left_fairway,
    ...profiles.center_line,
    ...profiles.right_fairway,
  ]
  const min = Math.min(...allVals)
  const max = Math.max(...allVals)
  const range = max - min || 1
  const norm = arr => arr.map(v => (v - min) / range)
  return {
    left_fairway: norm(profiles.left_fairway),
    center_line: norm(profiles.center_line),
    right_fairway: norm(profiles.right_fairway),
    distance_pct: profiles.distance_pct,
    min,
    max,
  }
}
