import { useState, useEffect } from 'react'
import { DISC_DATA } from '../../utils/discData'
import { getWeather } from '../../utils/weather'
import { saveThrow, getRounds, saveRound } from '../../utils/storage'

export default function PlayTab({ location, weather: initialWeather }) {
  const [weather, setWeather] = useState(initialWeather)
  const [selectedDisc, setSelectedDisc] = useState(DISC_DATA[0])
  const [currentRound, setCurrentRound] = useState(null)
  const [throws, setThrows] = useState([])
  const [hole, setHole] = useState(1)

  useEffect(() => {
    // Fetch weather on mount
    if (location) {
      getWeather(location.lat, location.lon).then(setWeather)
    }
  }, [location])

  const startRound = () => {
    const round = saveRound({ course: 'Palmer Park', holeCount: 18 })
    setCurrentRound(round)
    setThrows([])
    setHole(1)
  }

  const logThrow = () => {
    if (!location) return
    
    const throwData = {
      discId: selectedDisc.id,
      discName: selectedDisc.name,
      hole: hole,
      lat: location.lat,
      lon: location.lon,
      timestamp: new Date().toISOString(),
      distance: Math.random() * 300 + 100, // Mock distance
    }
    
    const saved = saveThrow(throwData)
    setThrows([...throws, saved])
    
    if (hole < 18) {
      setHole(hole + 1)
    } else {
      endRound()
    }
  }

  const endRound = () => {
    setCurrentRound(null)
    setThrows([])
    setHole(1)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Weather Card */}
      {weather && (
        <div className="broadcast-card p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="broadcast-stat">{weather.temp}°F</div>
              <div className="text-xs text-broadcast-cyan">{weather.description}</div>
            </div>
            <div>
              <div className="broadcast-stat">{weather.humidity}%</div>
              <div className="text-xs text-broadcast-cyan">Humidity</div>
            </div>
            <div>
              <div className="broadcast-stat">{weather.windSpeed} mph</div>
              <div className="text-xs text-broadcast-cyan">Wind</div>
            </div>
            <div>
              <div className="broadcast-stat">{weather.windDirection}°</div>
              <div className="text-xs text-broadcast-cyan">Direction</div>
            </div>
          </div>
        </div>
      )}

      {/* Round Status */}
      <div className="broadcast-card p-4">
        {currentRound ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-xs text-broadcast-cyan">CURRENT ROUND</div>
                <div className="text-xl font-black text-broadcast-yellow">Palmer Park</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-broadcast-cyan">HOLE</div>
                <div className="broadcast-stat">{hole}/18</div>
              </div>
            </div>
            <div className="text-xs text-broadcast-cyan mb-2">Throws: {throws.length}</div>
            <button
              onClick={endRound}
              className="w-full bg-broadcast-red text-white py-2 font-black font-saira rounded"
            >
              END ROUND
            </button>
          </>
        ) : (
          <button
            onClick={startRound}
            className="w-full broadcast-btn font-saira"
          >
            START ROUND
          </button>
        )}
      </div>

      {/* Disc Selector */}
      {currentRound && (
        <>
          <div className="broadcast-card p-4">
            <div className="text-xs text-broadcast-cyan mb-2">SELECT DISC</div>
            <div className="grid grid-cols-7 gap-2">
              {DISC_DATA.map((disc) => (
                <button
                  key={disc.id}
                  onClick={() => setSelectedDisc(disc)}
                  className={`p-2 rounded text-center text-xs font-saira font-bold transition-all ${
                    selectedDisc.id === disc.id
                      ? 'bg-broadcast-yellow text-broadcast-black border-2 border-broadcast-red'
                      : 'bg-broadcast-black border-2 border-gray-600 text-white hover:border-broadcast-yellow'
                  }`}
                  title={disc.name}
                >
                  {disc.name.slice(0, 3).toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Disc Info */}
          <div className="broadcast-card p-4">
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <div className="text-xs text-broadcast-cyan">Disc</div>
                <div className="font-bold text-broadcast-yellow">{selectedDisc.name}</div>
              </div>
              <div>
                <div className="text-xs text-broadcast-cyan">Type</div>
                <div className="font-bold text-broadcast-yellow">{selectedDisc.type}</div>
              </div>
              <div>
                <div className="text-xs text-broadcast-cyan">Speed</div>
                <div className="font-bold text-broadcast-yellow">{selectedDisc.speed}</div>
              </div>
              <div>
                <div className="text-xs text-broadcast-cyan">Stability</div>
                <div className="font-bold text-broadcast-yellow">{selectedDisc.stability}</div>
              </div>
            </div>

            {/* Log Throw Button */}
            <button
              onClick={logThrow}
              className="w-full bg-broadcast-yellow text-broadcast-black py-3 font-black font-saira rounded"
            >
              LOG THROW
            </button>
          </div>
        </>
      )}
    </div>
  )
}
