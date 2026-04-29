'use client'
import { useState, useEffect } from 'react'
import { loadBag } from '../../utils/discData'
import { getWeather } from '../../utils/weather'
import { saveThrow, saveRound, getThrows } from '../../utils/storage'
import { logThrowToFirebase, logGPSPoint } from '../../utils/firebase'
import {
  getDiscRecommendations,
  getWindLabel,
  getThrowLabel,
  WIND_CONDITIONS,
  THROW_TYPES,
} from '../../utils/recommendations'
import { loadHazards, scoreDiscRisk, inferWindRelation } from '../../utils/hazards'

const WIND_ICONS = { calm: '🌀', light: '💨', moderate: '🌬', strong: '⛈' }
const THROW_ICONS = { backhand: 'BH', forehand: 'FH', sidearm: 'SA', tomahawk: 'TH' }

function degToCardinal(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

function bearing(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180
  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

function loadCustomPins() {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem('dialed_pins') || '{}') } catch { return {} }
}

// ─── Compass widget ───────────────────────────────────────────────────────────
function CompassWidget({ windDeg, basketBearing }) {
  const size = 100
  const cx = size / 2
  const windRad = windDeg !== undefined ? (windDeg - 90) * Math.PI / 180 : null
  const basketRad = basketBearing !== undefined ? (basketBearing - 90) * Math.PI / 180 : null

  const arrowEnd = (rad, len) => ({
    x: cx + Math.cos(rad) * len,
    y: cx + Math.sin(rad) * len,
  })
  const arrowStart = (rad, len) => ({
    x: cx - Math.cos(rad) * len * 0.3,
    y: cx - Math.sin(rad) * len * 0.3,
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cx} r={cx - 2} fill="#111" stroke="#333" strokeWidth="1.5" />
      {['N','E','S','W'].map((d, i) => {
        const a = i * 90
        const r = (a - 90) * Math.PI / 180
        return (
          <text key={d} x={cx + Math.cos(r) * 36} y={cx + Math.sin(r) * 36 + 3.5}
            textAnchor="middle" fontSize="8" fill="#555" fontFamily="sans-serif">{d}</text>
        )
      })}
      {/* Wind arrow — blue/cyan */}
      {windRad !== null && (() => {
        const s = arrowStart(windRad, 32)
        const e = arrowEnd(windRad, 32)
        return (
          <g>
            <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke="#00d4ff" strokeWidth="2.5" strokeLinecap="round" />
            <polygon
              points={`${e.x},${e.y} ${e.x + Math.cos(windRad + 2.5) * 8},${e.y + Math.sin(windRad + 2.5) * 8} ${e.x + Math.cos(windRad - 2.5) * 8},${e.y + Math.sin(windRad - 2.5) * 8}`}
              fill="#00d4ff" />
          </g>
        )
      })()}
      {/* Basket arrow — yellow */}
      {basketRad !== null && (() => {
        const s = arrowStart(basketRad, 28)
        const e = arrowEnd(basketRad, 28)
        return (
          <g>
            <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke="#ffeb3b" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 2" />
            <circle cx={e.x} cy={e.y} r={3} fill="#ffeb3b" />
          </g>
        )
      })()}
      <circle cx={cx} cy={cx} r={3} fill="#fff" />
    </svg>
  )
}

// ─── DiscRecommendationRow ─────────────────────────────────────────────────────
function DiscRecommendationRow({ disc, rank, selected, onSelect, hazardResult }) {
  const scoreColor = disc.score >= 90 ? '#ffeb3b' : disc.score >= 80 ? '#00d4ff' : '#aaa'
  const effectiveScore = disc.score - (hazardResult?.penalty || 0)
  const warnings = hazardResult?.warnings || []

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-2 rounded border transition-all ${
        selected
          ? 'border-broadcast-yellow bg-yellow-950'
          : 'border-gray-700 bg-broadcast-black hover:border-broadcast-yellow'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-4 font-black">{rank}.</span>
          <div>
            <div className="font-black text-white font-saira text-sm leading-tight">{disc.name}</div>
            <div className="text-[10px] text-gray-400 capitalize">{disc.type} · {disc.stability}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-gray-500 text-right">
            <div>{disc.speed}/{disc.glide}/{disc.turn}/{disc.fade}</div>
          </div>
          {hazardResult?.penalty > 0 && (
            <div className="text-xs font-bold text-orange-400 font-saira">
              -{hazardResult.penalty}
            </div>
          )}
          <div className="font-black text-sm font-saira" style={{ color: effectiveScore >= 90 ? '#ffeb3b' : effectiveScore >= 80 ? '#00d4ff' : '#aaa' }}>
            {effectiveScore.toFixed(0)}
          </div>
        </div>
      </div>
      {warnings.map((w, i) => (
        <div key={i} className="mt-1 text-[10px] text-orange-300 bg-orange-950 rounded px-1.5 py-0.5">{w}</div>
      ))}
    </button>
  )
}

// ─── Main PlayTab ──────────────────────────────────────────────────────────────
export default function PlayTab({
  location,
  weather: initialWeather,
  selectedCourse,
  selectedHole,
  setSelectedHole,
  throwType,
  setThrowType,
  windCondition,
  setWindCondition,
}) {
  const [weather, setWeather] = useState(initialWeather)
  const [bag, setBag] = useState([])
  const [selectedDisc, setSelectedDisc] = useState(null)
  const [currentRound, setCurrentRound] = useState(null)
  const [throws, setThrows] = useState([])
  const [recommendations, setRecommendations] = useState(null)
  const [recsLoading, setRecsLoading] = useState(false)
  const [logging, setLogging] = useState(false)
  const [hazards, setHazards] = useState([])

  useEffect(() => { setBag(loadBag()) }, [])

  useEffect(() => {
    if (location) getWeather(location.lat, location.lon).then(setWeather)
  }, [location])

  useEffect(() => {
    if (!weather?.windSpeed) return
    const mph = weather.windSpeed
    if (mph <= 5) setWindCondition('calm')
    else if (mph <= 12) setWindCondition('light')
    else if (mph <= 20) setWindCondition('moderate')
    else setWindCondition('strong')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather])

  useEffect(() => {
    setRecsLoading(true)
    const courseKey = selectedCourse === 'kensington' ? 'kensington' : 'palmer'
    getDiscRecommendations(courseKey, selectedHole, throwType, windCondition)
      .then(setRecommendations)
      .catch(() => setRecommendations(null))
      .finally(() => setRecsLoading(false))
  }, [selectedCourse, selectedHole, throwType, windCondition])

  // Load hazards for current hole
  useEffect(() => {
    const courseKey = selectedCourse === 'kensington' ? 'kensington' : 'palmer_park'
    setHazards(loadHazards(courseKey, selectedHole))
  }, [selectedCourse, selectedHole])

  // Compute compass values
  const windDeg = weather?.windDirection
  const windCardinal = windDeg !== undefined ? degToCardinal(windDeg) : ''

  const pins = loadCustomPins()
  const pinKey = `${selectedCourse}_${selectedHole}`
  const holePin = pins[pinKey] || {}
  const teePin = holePin.tee
  const basketPin = holePin.basket

  const windRelation = inferWindRelation(
    windDeg,
    teePin?.lat, teePin?.lon,
    basketPin?.lat, basketPin?.lon
  )

  const basketBearing = (location && basketPin)
    ? bearing(location.lat, location.lon, basketPin.lat, basketPin.lon)
    : undefined

  // Score hazard risk for a disc
  const hazardScore = (disc) => {
    if (!disc || hazards.length === 0) return null
    return scoreDiscRisk(disc, windCondition, windRelation, hazards)
  }

  const startRound = () => {
    const courseName = selectedCourse === 'kensington' ? 'Kensington' : 'Palmer Park'
    const round = saveRound({ course: courseName, holeCount: 18 })
    setCurrentRound(round)
    setThrows([])
  }

  const logThrow = async () => {
    if (!location || !selectedDisc) return
    setLogging(true)
    const sessionId = currentRound?.id || Date.now()
    const throwData = {
      discId: selectedDisc.id,
      discName: selectedDisc.name,
      hole: selectedHole,
      lat: location.lat,
      lon: location.lon,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString(),
      throwType,
      windCondition,
      course: selectedCourse,
    }
    const saved = saveThrow(throwData)
    // Fire-and-forget — don't block UI on Firebase
    logThrowToFirebase({ ...throwData, sessionId }).catch(() => {})
    logGPSPoint(sessionId, location.lat, location.lon, selectedHole).catch(() => {})
    setThrows(prev => [...prev, saved])
    if (selectedHole < 18) setSelectedHole(selectedHole + 1)
    else endRound()
    setLogging(false)
  }

  const endRound = () => { setCurrentRound(null); setThrows([]) }

  // Sort bag discs in recommendations: match by name against rec list, fallback to all
  const recNames = recommendations?.discs?.map(d => d.name.toLowerCase()) || []
  const bagSorted = [...bag].sort((a, b) => {
    const ai = recNames.indexOf(a.name.toLowerCase())
    const bi = recNames.indexOf(b.name.toLowerCase())
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return (
    <div className="p-4 space-y-4 pb-6">
      {/* Weather Strip + Compass */}
      {weather && (
        <div className="broadcast-card p-3">
          <div className="flex gap-3 items-center">
            <CompassWidget windDeg={windDeg} basketBearing={basketBearing} />
            <div className="flex-1 grid grid-cols-2 gap-2 text-center">
              <WeatherStat value={`${weather.temp}°`} label={weather.description} />
              <WeatherStat value={`${weather.windSpeed}mph`} label={`Wind ${windCardinal}`} />
              <WeatherStat value={`${weather.humidity}%`} label="Humidity" />
              <WeatherStat
                value={windRelation ? windRelation.replace('_', ' ').toUpperCase() : `${windDeg || '—'}°`}
                label="vs Fairway" />
            </div>
          </div>
          {basketBearing !== undefined && (
            <div className="mt-2 text-xs text-gray-500 text-center">
              Basket bearing: <span className="text-broadcast-yellow">{Math.round(basketBearing)}° ({degToCardinal(basketBearing)})</span>
              {' · '}
              <span className="text-broadcast-cyan">Yellow = basket · Cyan = wind</span>
            </div>
          )}
        </div>
      )}

      {/* Round Status */}
      <div className="broadcast-card p-4">
        {currentRound ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-broadcast-cyan">ROUND IN PROGRESS</div>
              <div className="text-lg font-black text-broadcast-yellow font-saira">
                {selectedCourse === 'kensington' ? 'Kensington' : 'Palmer Park'}
              </div>
              <div className="text-xs text-gray-400">{throws.length} throws logged</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-broadcast-cyan">HOLE</div>
              <div className="text-3xl font-black text-broadcast-yellow font-saira">{selectedHole}</div>
              <button onClick={endRound}
                className="mt-1 px-3 py-1 bg-broadcast-red text-white font-black font-saira text-xs rounded">
                END ROUND
              </button>
            </div>
          </div>
        ) : (
          <button onClick={startRound} className="w-full broadcast-btn font-saira py-3">
            START ROUND
          </button>
        )}
      </div>

      {/* Throw Type Selector */}
      <div className="broadcast-card p-3">
        <div className="text-xs text-broadcast-cyan mb-2">THROW TYPE</div>
        <div className="grid grid-cols-4 gap-2">
          {THROW_TYPES.map(t => (
            <button key={t} onClick={() => setThrowType(t)}
              className={`py-2 font-saira font-black text-xs rounded transition-all ${
                throwType === t
                  ? 'bg-broadcast-yellow text-broadcast-black'
                  : 'bg-broadcast-black border border-broadcast-yellow text-broadcast-yellow'
              }`}>
              <div className="text-base leading-tight">{THROW_ICONS[t]}</div>
              <div className="text-[10px]">{getThrowLabel(t).toUpperCase()}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Wind Selector */}
      <div className="broadcast-card p-3">
        <div className="text-xs text-broadcast-cyan mb-2">
          WIND CONDITIONS
          {weather && <span className="text-gray-500 ml-2">({weather.windSpeed}mph auto)</span>}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {WIND_CONDITIONS.map(w => (
            <button key={w} onClick={() => setWindCondition(w)}
              className={`py-2 font-saira font-black text-xs rounded transition-all ${
                windCondition === w
                  ? 'bg-broadcast-cyan text-broadcast-black'
                  : 'bg-broadcast-black border border-broadcast-cyan text-broadcast-cyan'
              }`}>
              <div className="text-lg leading-tight">{WIND_ICONS[w]}</div>
              <div className="text-[10px]">{getWindLabel(w).toUpperCase()}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Disc Recommendations — filtered to bag discs */}
      <div className="broadcast-card p-3">
        <div className="flex justify-between items-center mb-2">
          <div className="text-xs text-broadcast-cyan">
            RECOMMENDATIONS — HOLE {selectedHole}
          </div>
          {recommendations && (
            <div className="text-xs text-gray-500">
              {recommendations.throwName} · {recommendations.conditionName}
            </div>
          )}
        </div>

        {recsLoading && <div className="text-xs text-gray-500 py-2">Loading...</div>}

        {!recsLoading && (() => {
          // Filter recommendations to only discs in bag
          const bagNames = bag.map(d => d.name.toLowerCase())
          const bagRecs = recommendations?.discs?.filter(d => bagNames.includes(d.name.toLowerCase())) || []

          if (bagRecs.length === 0) {
            return (
              <div className="text-xs text-gray-500 py-2">
                No recommendations matched your bag for this hole. Pick a disc below.
              </div>
            )
          }

          return (
            <div className="space-y-1.5">
              {bagRecs.slice(0, 5).map((recDisc, i) => {
                const bagDisc = bag.find(d => d.name.toLowerCase() === recDisc.name.toLowerCase())
                const hr = bagDisc ? hazardScore(bagDisc) : null
                return (
                  <DiscRecommendationRow
                    key={recDisc.name}
                    disc={recDisc}
                    rank={i + 1}
                    selected={selectedDisc?.name === recDisc.name}
                    onSelect={() => setSelectedDisc(bagDisc || recDisc)}
                    hazardResult={hr}
                  />
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Bag Disc Grid */}
      <div className="broadcast-card p-3">
        <div className="text-xs text-broadcast-cyan mb-2">YOUR BAG</div>
        <div className="grid grid-cols-4 gap-1.5">
          {bagSorted.map(disc => {
            const hr = hazardScore(disc)
            const hasWarning = hr && hr.penalty > 0
            return (
              <button
                key={disc.id}
                onClick={() => setSelectedDisc(disc)}
                className={`py-1.5 rounded text-center font-saira font-bold text-[10px] transition-all relative ${
                  selectedDisc?.id === disc.id
                    ? 'bg-broadcast-yellow text-broadcast-black border-2 border-broadcast-red'
                    : hasWarning
                      ? 'bg-broadcast-black border border-orange-500 text-white'
                      : 'bg-broadcast-black border border-gray-600 text-white'
                }`}
                title={`${disc.name} — ${disc.type}`}
              >
                <div className="w-3 h-3 rounded-full mx-auto mb-0.5" style={{ backgroundColor: disc.color }} />
                <div className="truncate px-0.5">{(disc.customLabel || disc.name).slice(0, 6).toUpperCase()}</div>
                {hasWarning && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-black text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">!</span>
                )}
              </button>
            )
          })}
        </div>

        {selectedDisc && (() => {
          const hr = hazardScore(selectedDisc)
          return (
            <div className="mt-3 p-2 bg-broadcast-black rounded border border-gray-700">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-black text-broadcast-yellow font-saira">
                    {selectedDisc.customLabel || selectedDisc.name}
                  </div>
                  {selectedDisc.customLabel && (
                    <div className="text-xs text-gray-500">{selectedDisc.name}</div>
                  )}
                  <div className="text-xs text-broadcast-cyan">
                    {selectedDisc.type} · {selectedDisc.stability}
                  </div>
                </div>
                <div className="flex gap-3 text-xs text-center">
                  <FlightNum label="SPD" value={selectedDisc.speed} />
                  <FlightNum label="GLI" value={selectedDisc.glide} />
                  <FlightNum label="TRN" value={selectedDisc.turn} />
                  <FlightNum label="FAD" value={selectedDisc.fade} />
                </div>
              </div>
              {hr?.warnings?.map((w, i) => (
                <div key={i} className="mt-1 text-[10px] text-orange-300 bg-orange-950 rounded px-2 py-0.5">{w}</div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Log Throw */}
      {currentRound && selectedDisc && (
        <button
          onClick={logThrow}
          disabled={logging}
          className="w-full py-4 font-black font-saira text-lg rounded bg-broadcast-yellow text-broadcast-black disabled:opacity-60"
        >
          {logging ? 'LOGGING...' : `LOG THROW — HOLE ${selectedHole}`}
        </button>
      )}
      {currentRound && !selectedDisc && (
        <div className="text-center text-xs text-broadcast-cyan py-2">Select a disc to log throw</div>
      )}
    </div>
  )
}

function WeatherStat({ value, label }) {
  return (
    <div>
      <div className="broadcast-stat text-base">{value}</div>
      <div className="text-[10px] text-broadcast-cyan leading-tight">{label}</div>
    </div>
  )
}

function FlightNum({ label, value }) {
  return (
    <div>
      <div className="text-[9px] text-gray-500">{label}</div>
      <div className="font-black text-broadcast-yellow">{value}</div>
    </div>
  )
}
