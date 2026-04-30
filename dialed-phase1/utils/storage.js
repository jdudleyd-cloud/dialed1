// Local storage helpers for throws, rounds, and settings

const THROWS_KEY   = 'dialed_throws'
const ROUNDS_KEY   = 'dialed_rounds'
const SETTINGS_KEY = 'dialed_settings'

export const getThrows = () => {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(THROWS_KEY) || '[]') } catch { return [] }
}

export const saveThrow = (throwData) => {
  if (typeof window === 'undefined') return
  try {
    const throws = getThrows()
    const newThrow = { id: Date.now(), timestamp: new Date().toISOString(), ...throwData }
    throws.push(newThrow)
    localStorage.setItem(THROWS_KEY, JSON.stringify(throws))
    return newThrow
  } catch (e) { console.error('saveThrow:', e) }
}

export const deleteThrow = (id) => {
  if (typeof window === 'undefined') return
  try {
    const throws = getThrows().filter(t => t.id !== id)
    localStorage.setItem(THROWS_KEY, JSON.stringify(throws))
  } catch (e) { console.error('deleteThrow:', e) }
}

export const getRounds = () => {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(ROUNDS_KEY) || '[]') } catch { return [] }
}

export const saveRound = (roundData) => {
  if (typeof window === 'undefined') return
  try {
    const rounds = getRounds()
    const newRound = {
      id: Date.now(),
      startTime: new Date().toISOString(),
      course: 'Palmer Park',
      throws: [],
      ...roundData,
    }
    rounds.push(newRound)
    localStorage.setItem(ROUNDS_KEY, JSON.stringify(rounds))
    return newRound
  } catch (e) { console.error('saveRound:', e) }
}

export const deleteRound = (id) => {
  if (typeof window === 'undefined') return
  try {
    const rounds = getRounds().filter(r => r.id !== id)
    localStorage.setItem(ROUNDS_KEY, JSON.stringify(rounds))
  } catch (e) { console.error('deleteRound:', e) }
}

export const getSettings = () => {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') } catch { return {} }
}

export const saveSettings = (settings) => {
  if (typeof window === 'undefined') return
  try {
    const current = getSettings()
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }))
  } catch (e) { console.error('saveSettings:', e) }
}
