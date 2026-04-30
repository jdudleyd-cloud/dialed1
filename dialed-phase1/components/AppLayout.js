'use client'
import { useState, useEffect } from 'react'
import PlayTab from './tabs/PlayTab'
import BagTab from './tabs/BagTab'
import CourseTab from './tabs/CourseTab'
import HistoryTab from './tabs/HistoryTab'
import VsTab from './tabs/VsTab'

const TABS = ['PLAY', 'BAG', 'COURSE', 'VS', 'LOG']

function loadPlayerName() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('dialed_player_name') || null
}

function loadDevMode() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('dialed_dev_mode') === 'true'
}

export default function AppLayout() {
  const [activeTab, setActiveTab] = useState('PLAY')
  const [location, setLocation] = useState(null)
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const [playerName, setPlayerName] = useState(null)
  const [nameInput, setNameInput] = useState('')
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [devMode, setDevMode] = useState(false)

  // Shared caddy state
  const [selectedCourse, setSelectedCourse] = useState('palmer')
  const [selectedHole, setSelectedHole] = useState(1)
  const [throwType, setThrowType] = useState('backhand')
  const [windCondition, setWindCondition] = useState('calm')

  useEffect(() => {
    const name = loadPlayerName()
    if (!name) setShowNamePrompt(true)
    else setPlayerName(name)
    setDevMode(loadDevMode())

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => setLocation({ lat: 42.4224, lon: -83.1176 })
      )
    } else {
      setLocation({ lat: 42.4224, lon: -83.1176 })
    }
    setLoading(false)
  }, [])

  const saveName = () => {
    const name = nameInput.trim()
    if (!name) return
    localStorage.setItem('dialed_player_name', name)
    setPlayerName(name)
    setShowNamePrompt(false)
  }

  const toggleDevMode = () => {
    const next = !devMode
    setDevMode(next)
    localStorage.setItem('dialed_dev_mode', String(next))
  }

  const courseLabel = selectedCourse === 'kensington' ? 'KENSINGTON' : 'PALMER PARK'

  return (
    <div className="bg-broadcast-black" style={{ position: 'fixed', inset: 0 }}>
      {/* Name prompt */}
      {showNamePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="broadcast-card p-6 mx-6 space-y-4 max-w-sm w-full">
            <div className="font-black text-broadcast-yellow font-saira text-2xl">WELCOME TO DIALED</div>
            <div className="text-broadcast-cyan text-sm">What's your name?</div>
            <input autoFocus value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveName()}
              placeholder="Enter your name"
              className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-white text-base" />
            <button onClick={saveName}
              className="w-full py-3 bg-broadcast-yellow text-black font-black font-saira rounded text-sm">
              LET'S THROW
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-broadcast-black border-b-2 border-broadcast-yellow px-4 py-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-broadcast-yellow font-saira tracking-tight">DIALED</h1>
            {/* Dev mode toggle — long hold header to toggle, or tap DEV label */}
            <button onClick={toggleDevMode}
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold border transition-colors ${
                devMode ? 'bg-broadcast-red text-white border-broadcast-red' : 'bg-transparent text-gray-700 border-gray-700'
              }`}>
              DEV
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs font-saira">
            {playerName && <span className="text-broadcast-red font-black uppercase">{playerName}</span>}
            <span className="text-broadcast-cyan">{courseLabel}</span>
            <span className="text-gray-500">H{selectedHole}</span>
            <span className="text-broadcast-yellow uppercase">{throwType.slice(0,2).toUpperCase()}</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="absolute left-0 right-0 overflow-y-auto" style={{ top: 45, bottom: 56 }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-broadcast-yellow font-saira animate-pulse">Initializing...</div>
          </div>
        ) : location ? (
          <>
            {activeTab === 'PLAY' && (
              <PlayTab
                location={location} weather={weather}
                selectedCourse={selectedCourse} selectedHole={selectedHole}
                setSelectedHole={setSelectedHole} throwType={throwType}
                setThrowType={setThrowType} windCondition={windCondition}
                setWindCondition={setWindCondition}
              />
            )}
            {activeTab === 'BAG' && <BagTab />}
            {activeTab === 'COURSE' && (
              <CourseTab
                location={location} selectedCourse={selectedCourse}
                setSelectedCourse={setSelectedCourse} selectedHole={selectedHole}
                setSelectedHole={setSelectedHole} devMode={devMode}
              />
            )}
            {activeTab === 'VS' && (
              <VsTab
                selectedCourse={selectedCourse} selectedHole={selectedHole}
                setSelectedHole={setSelectedHole}
              />
            )}
            {activeTab === 'LOG' && <HistoryTab />}
          </>
        ) : null}
      </main>

      {/* Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-broadcast-black border-t-2 border-broadcast-yellow flex" style={{ height: 56 }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 font-saira font-bold text-[11px] tracking-wide transition-colors ${
              activeTab === tab
                ? 'bg-broadcast-yellow text-broadcast-black'
                : 'bg-broadcast-black text-broadcast-yellow'
            }`}>
            {tab}
          </button>
        ))}
      </nav>
    </div>
  )
}
