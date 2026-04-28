import { useState, useEffect } from 'react'
import PlayTab from './tabs/PlayTab'
import BagTab from './tabs/BagTab'
import CourseTab from './tabs/CourseTab'
import HistoryTab from './tabs/HistoryTab'

export default function AppLayout() {
  const [activeTab, setActiveTab] = useState('PLAY')
  const [location, setLocation] = useState(null)
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get geolocation on mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          })
        },
        (error) => {
          console.error('Geolocation error:', error)
          // Fallback to Palmer Park Detroit
          setLocation({ lat: 42.3314, lon: -83.0458 })
        }
      )
    }
    setLoading(false)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-broadcast-black">
      {/* Header */}
      <header className="bg-gradient-to-r from-broadcast-black to-broadcast-black border-b-2 border-broadcast-yellow px-4 py-3">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-black text-broadcast-yellow font-saira tracking-tight">
            DIALED
          </h1>
          <div className="text-xs font-saira text-broadcast-cyan">
            {location ? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` : 'Locating...'}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {!loading && location && (
          <>
            {activeTab === 'PLAY' && <PlayTab location={location} weather={weather} />}
            {activeTab === 'BAG' && <BagTab />}
            {activeTab === 'COURSE' && <CourseTab location={location} />}
            {activeTab === 'HISTORY' && <HistoryTab />}
          </>
        )}
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-broadcast-yellow font-saira">Initializing...</div>
          </div>
        )}
      </main>

      {/* Tab Navigation */}
      <nav className="bg-broadcast-black border-t-2 border-broadcast-yellow flex justify-around py-2">
        {['PLAY', 'BAG', 'COURSE', 'HISTORY'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 font-saira font-bold text-sm tracking-wide transition-colors ${
              activeTab === tab
                ? 'bg-broadcast-yellow text-broadcast-black border-b-2 border-broadcast-red'
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
