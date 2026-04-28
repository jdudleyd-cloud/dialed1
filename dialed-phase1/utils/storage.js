// Local storage helpers for throws and rounds

const THROWS_KEY = 'dialed_throws'
const ROUNDS_KEY = 'dialed_rounds'
const SETTINGS_KEY = 'dialed_settings'

export const getThrows = () => {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(THROWS_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    console.error('Failed to load throws:', e)
    return []
  }
}

export const saveThrow = (throwData) => {
  if (typeof window === 'undefined') return
  try {
    const throws = getThrows()
    const newThrow = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...throwData,
    }
    throws.push(newThrow)
    localStorage.setItem(THROWS_KEY, JSON.stringify(throws))
    return newThrow
  } catch (e) {
    console.error('Failed to save throw:', e)
  }
}

export const getRounds = () => {
  if (typeof window === 'undefined') return []
  try {
    const data = localStorage.getItem(ROUNDS_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    console.error('Failed to load rounds:', e)
    return []
  }
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
  } catch (e) {
    console.error('Failed to save round:', e)
  }
}

export const getSettings = () => {
  if (typeof window === 'undefined') return {}
  try {
    const data = localStorage.getItem(SETTINGS_KEY)
    return data ? JSON.parse(data) : {}
  } catch (e) {
    console.error('Failed to load settings:', e)
    return {}
  }
}

export const saveSettings = (settings) => {
  if (typeof window === 'undefined') return
  try {
    const current = getSettings()
    const updated = { ...current, ...settings }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated))
  } catch (e) {
    console.error('Failed to save settings:', e)
  }
}
