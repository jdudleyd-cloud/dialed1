'use client'
import { useState, useEffect } from 'react'
import PlayTab from './tabs/PlayTab'
import BagTab from './tabs/BagTab'
import CourseTab from './tabs/CourseTab'
import HistoryTab from './tabs/HistoryTab'

function loadPlayerName() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('dialed_player_name') || null
}

export default function AppLayout() {
  const [activeTab, setActiveTab] = useState('PLAY')
  const [location, setLocation] = useState(null)
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const [playerName, setPlayerName] = useState(null)
  const [nameInput, setNameInput] = useState('')
  const [showNamePrompt, setShowNamePrompt] = useState(false)

  // Shared caddy state
  const [selectedCourse, setSelectedCourse] = useState('palmer')
  const [selectedHole, setSelectedHole] = useState(1)
  const [throwType, setThrowType] = useState('backhand')
  const [windCondition, setWindCondition] = useState('calm')

  useEffect(() => {
    const name = loadPlayerName()
    if (!name) { setShowNamePrompt(true) }
    else { setPlayerName(name) }

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

  const courseLabel = selectedCourse === 'kensington' ? 'KENSINGTON' : 'PALMER PARK'

  return (
    <div className="flex flex-col bg-broadcast-black" style={{ height: '100dvh' }}>
      {/* Name prompt modal */}
      {showNamePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="broadcast-card p-6 mx-6 space-y-4 max-w-sm w-full">
            <div className="font-black text-broadcast-yellow font-saira text-2xl">WELCOME TO DIALED</div>
            <div className="text-broadcast-cyan text-sm">What's your name?</div>
            <input
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveName()}
              placeholder="Enter your name"
              className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-white text-base"
            />
            <button onClick={saveName}
              className="w-full py-3 bg-broadcast-yellow text-black font-black font-saira rounded text-sm">
              LET'S THROW
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-broadcast-black border-b-2 border-broadcast-yellow px-4 py-2 flex-shrink-0">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-black text-broadcast-yellow font-saira tracking-tight">
            DIALED
          </h1>
          <div className="flex items-center gap-3 text-xs font-saira">
            {playerName && <span className="text-broadcast-red font-black uppercase">{playerName}</span>}
            <span className="text-broadcast-cyan">{courseLabel}</span>
            <span className="text-gray-500">H{selectedHole}</span>
            <span className="text-broadcast-yellow uppercase">{throwType.slice(0, 2).toUpperCase()}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-broadcast-yellow font-saira animate-pulse">Initializing...</div>
          </div>
        ) : location ? (
          <>
            {activeTab === 'PLAY' && (
              <PlayTab
                location={location}
                weather={weather}
                selectedCourse={selectedCourse}
                selectedHole={selectedHole}
                setSelectedHole={setSelectedHole}
                throwType={throwType}
                setThrowType={setThrowType}
                windCondition={windCondition}
                setWindCondition={setWindCondition}
              />
            )}
            {activeTab === 'BAG' && <BagTab />}
            {activeTab === 'COURSE' && (
              <CourseTab
                location={location}
                selectedCourse={selectedCourse}
                setSelectedCourse={setSelectedCourse}
                selectedHole={selectedHole}
                setSelectedHole={setSelectedHole}
              />
            )}
            {activeTab === 'HISTORY' && <HistoryTab />}
          </>
        ) : null}
      </main>

      {/* Tab Navigation */}
      <nav className="bg-broadcast-black border-t-2 border-broadcast-yellow flex flex-shrink-0">
        {['PLAY', 'BAG', 'COURSE', 'HISTORY'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 font-saira font-bold text-sm tracking-wide transition-colors ${
              activeTab === tab
                ? 'bg-broadcast-yellow text-broadcast-black'
                : 'bg-broadcast-black text-broadcast-yellow hover:text-broadcast-red'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>
    </div>
  )
}
