'use client'
import { useState, useEffect } from 'react'
import { loadBag } from '../../utils/discData'
import { getWeather } from '../../utils/weather'
import { saveThrow, saveRound } from '../../utils/storage'
import { logThrowToFirebase, logGPSPoint } from '../../utils/firebase'
import {
  getDiscRecommendations,
  getThrowLabel,
  THROW_TYPES,
} from '../../utils/recommendations'
import { loadHazards, scoreDiscRisk, inferWindRelation } from '../../utils/hazards'
import { calculateFlightPath, getDiscReason } from '../../utils/flightPhysics'

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

// ─── Flight Prediction Panel ──────────────────────────────────────────────────
function FlightPrediction({ disc, throwType, windCondition, windRelation }) {
  if (!disc) return null
  const flight = calculateFlightPath(disc, throwType, windCondition, windRelation, null)
  const lateralDir = flight.lateral > 0 ? 'right' : flight.lateral < 0 ? 'left' : ''
  const lateralAbs = Math.abs(flight.lateral)

  return (
    <div className="mt-3 p-2 rounded border border-gray-700 bg-gray-900/60 space-y-1">
      <div className="text-[10px] text-broadcast-cyan font-bold">PREDICTED FLIGHT</div>
      <div className="flex gap-3">
        <div className="text-center">
          <div className="text-lg font-black text-broadcast-yellow font-saira leading-tight">
            {flight.distance}
          </div>
          <div className="text-[9px] text-gray-500">FEET</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-black font-saira leading-tight" style={{
            color: lateralAbs > 30 ? '#ff6600' : lateralAbs > 15 ? '#ffeb3b' : '#00d4ff'
          }}>
            {lateralAbs > 5 ? `${lateralAbs}ft ${lateralDir}` : 'CENTER'}
          </div>
          <div className="text-[9px] text-gray-500">LATERAL</div>
        </div>
        {windCondition !== 'calm' && windRelation && (
          <div className="text-center">
            <div className="text-sm font-black font-saira leading-tight text-broadcast-cyan capitalize">
              {windRelation.replace('_', ' ')}
            </div>
            <div className="text-[9px] text-gray-500">WIND</div>
          </div>
        )}
      </div>
      <div className="relative h-5 bg-gray-800 rounded-full overflow-hidden mt-1">
        <div className="absolute inset-y-0 left-1/2 w-px bg-gray-600" />
        {(() => {
          const maxLateral = 80
          const pct = 50 + (flight.lateral / maxLateral) * 45
          const clampedPct = Math.max(5, Math.min(95, pct))
          return (
            <div
              className="absolute top-1 bottom-1 w-2 rounded-full"
              style={{
                left: `${clampedPct}%`,
                backgroundColor: '#ff6600',
                transform: 'translateX(-50%)',
                boxShadow: '0 0 6px #ff6600',
              }}
            />
          )
        })()}
        <div className="absolute inset-0 flex items-center justify-center text-[9px] text-gray-500 pointer-events-none">
          ← Left · Center · Right →
        </div>
      </div>
      <div className="text-[9px] text-gray-600 leading-snug">{flight.description}</div>
    </div>
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
  currentRound,
  setCurrentRound,
  roundThrows,
  setRoundThrows,
}) {
  const [weather, setWeather] = useState(initialWeather)
  const [bag, setBag] = useState([])
  const [selectedDisc, setSelectedDisc] = useState(null)
  const [recommendations, setRecommendations] = useState(null)
  const [recsLoading, setRecsLoading] = useState(false)
  const [logging, setLogging] = useState(false)
  const [hazards, setHazards] = useState([])
  const [showCaddy, setShowCaddy] = useState(false)
  const [showBagAll, setShowBagAll] = useState(false)

  const throws = roundThrows || []

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

  useEffect(() => {
    const courseKey = selectedCourse === 'kensington' ? 'kensington' : 'palmer_park'
    setHazards(loadHazards(courseKey, selectedHole))
  }, [selectedCourse, selectedHole])

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

  const hazardScore = (disc) => {
    if (!disc || hazards.length === 0) return null
    return scoreDiscRisk(disc, windCondition, windRelation, hazards)
  }

  const startRound = () => {
    const courseName = selectedCourse === 'kensington' ? 'Kensington' : 'Palmer Park'
    const round = saveRound({ course: courseName, holeCount: 18 })
    setCurrentRound(round)
    setRoundThrows([])
  }

  const logThrow = async () => {
    if (!location || !selectedDisc) return
    setLogging(true)
    const sessionId = currentRound?.id || Date.now()

    const flight = calculateFlightPath(selectedDisc, throwType, windCondition, windRelation, null)

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
      windRelation,
      course: selectedCourse,
      roundId: currentRound?.id || null,
      predictedDistance: flight.distance,
      predictedLateral: flight.lateral,
      predictedDescription: flight.description,
    }
    const saved = saveThrow(throwData)
    logThrowToFirebase({ ...throwData, sessionId }).catch(() => {})
    logGPSPoint(sessionId, location.lat, location.lon, selectedHole).catch(() => {})
    setRoundThrows(prev => [...(prev || []), saved])
    if (selectedHole < 18) setSelectedHole(selectedHole + 1)
    else endRound()
    setLogging(false)
  }

  const endRound = () => {
    setCurrentRound(null)
    setRoundThrows([])
  }

  // Bag ordered by AI rank — top pick first
  const bagRanked = (() => {
    const recMap = {}
    recommendations?.discs?.forEach((d, i) => {
      recMap[d.name.toLowerCase()] = { score: d.score, rank: i + 1 }
    })
    return [...bag]
      .map(d => ({ ...d, aiRec: recMap[d.name.toLowerCase()] || null }))
      .sort((a, b) => {
        if (!a.aiRec && !b.aiRec) return 0
        if (!a.aiRec) return 1
        if (!b.aiRec) return -1
        return a.aiRec.rank - b.aiRec.rank
      })
  })()

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
              Basket: <span className="text-broadcast-yellow">{Math.round(basketBearing)}° ({degToCardinal(basketBearing)})</span>
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
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                <div className="text-xs text-green-400 font-bold font-saira">ROUND IN PROGRESS</div>
              </div>
              <div className="text-lg font-black text-broadcast-yellow font-saira mt-0.5">
                {selectedCourse === 'kensington' ? 'Kensington' : 'Palmer Park'}
              </div>
              <div className="text-xs text-gray-400">
                {throws.length} throw{throws.length !== 1 ? 's' : ''} logged
                {throws.length > 0 && ` · last: H${throws[throws.length - 1]?.hole}`}
              </div>
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

      {/* Wind — auto-detected status strip */}
      {weather && windCondition !== 'calm' && (
        <div className="broadcast-card px-3 py-2 flex items-center gap-2">
          <span className="text-lg">{WIND_ICONS[windCondition]}</span>
          <div className="flex-1">
            <span className="text-xs font-black font-saira text-broadcast-cyan uppercase">
              {windCondition} wind
            </span>
            <span className="text-xs text-gray-500 ml-2">
              {weather.windSpeed}mph {windCardinal}
              {windRelation ? ` · ${windRelation.replace('_', ' ')}` : ''}
            </span>
          </div>
          {windCondition !== 'calm' && windRelation && (
            <WindPhysicsLabel windCondition={windCondition} windRelation={windRelation} throwType={throwType} inline />
          )}
        </div>
      )}

      {/* Bag + Caddy — ordered by AI rank */}
      <div className="broadcast-card p-3">
        <div className="flex justify-between items-center mb-2">
          <div>
            <div className="text-xs text-broadcast-cyan">YOUR BAG</div>
            {recommendations && !recsLoading && (
              <div className="text-[9px] text-gray-500">
                {recommendations.throwName} · {recommendations.conditionName}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowCaddy(c => !c)}
            className={`px-2 py-0.5 font-saira font-bold text-[10px] rounded border transition-colors ${
              showCaddy
                ? 'bg-broadcast-cyan text-broadcast-black border-broadcast-cyan'
                : 'bg-transparent text-broadcast-cyan border-broadcast-cyan'
            }`}
          >
            🎙 CADDY
          </button>
        </div>

        {recsLoading && <div className="text-[9px] text-gray-500 mb-1">Loading caddy...</div>}

        <div className="grid grid-cols-4 gap-1.5">
          {bagRanked.map(disc => {
            const hr = hazardScore(disc)
            const hasWarning = hr?.penalty > 0
            const reasons = showCaddy
              ? getDiscReason(disc, throwType, windCondition, windRelation, hazards, null)
              : []
            const topReason = reasons.find(r => !r.startsWith('⚠'))
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
                {disc.aiRec?.rank && disc.aiRec.rank <= 3 && (
                  <span className="absolute top-0.5 left-0.5 text-[8px] font-black text-broadcast-yellow leading-none">
                    #{disc.aiRec.rank}
                  </span>
                )}
                <div className="w-3 h-3 rounded-full mx-auto mb-0.5" style={{ backgroundColor: disc.color }} />
                <div className="truncate px-0.5">{(disc.customLabel || disc.name).slice(0, 6).toUpperCase()}</div>
                {showCaddy && topReason && (
                  <div className="text-[8px] text-gray-400 px-0.5 leading-tight mt-0.5 truncate">
                    {topReason.slice(0, 28)}
                  </div>
                )}
                {hasWarning && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-black text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">!</span>
                )}
              </button>
            )
          })}

          {/* Last slot — opens full bag selector */}
          <button
            onClick={() => setShowBagAll(true)}
            className="py-1.5 rounded text-center font-saira font-bold text-[10px] bg-broadcast-black border border-gray-600 text-gray-500 flex flex-col items-center justify-center"
          >
            <span className="text-base leading-none">···</span>
            <span>ALL</span>
          </button>
        </div>

        {/* Selected disc detail */}
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

              <FlightPrediction
                disc={selectedDisc}
                throwType={throwType}
                windCondition={windCondition}
                windRelation={windRelation}
              />

              {(() => {
                const reasons = getDiscReason(selectedDisc, throwType, windCondition, windRelation, hazards, null)
                return reasons.length > 0 ? (
                  <div className="mt-2">
                    <div className="text-[10px] text-broadcast-cyan font-bold mb-1">AI CADDY SAYS</div>
                    <div className="space-y-1">
                      {reasons.map((r, i) => (
                        <div key={i} className={`text-[10px] rounded px-2 py-1 leading-snug ${
                          r.startsWith('⚠') ? 'bg-orange-950 text-orange-300' : 'bg-gray-900 text-gray-300'
                        }`}>
                          {r}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}
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

      {/* Full bag selector modal */}
      {showBagAll && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
          onClick={() => setShowBagAll(false)}
        >
          <div
            className="bg-gray-900 border-t-2 border-broadcast-yellow w-full rounded-t-xl p-4 pb-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <div className="text-sm font-black text-broadcast-yellow font-saira">FULL BAG</div>
              <button onClick={() => setShowBagAll(false)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {bag.map(disc => (
                <button
                  key={disc.id}
                  onClick={() => { setSelectedDisc(disc); setShowBagAll(false) }}
                  className={`py-2 rounded text-center font-saira font-bold text-[10px] transition-all ${
                    selectedDisc?.id === disc.id
                      ? 'bg-broadcast-yellow text-broadcast-black border-2 border-broadcast-red'
                      : 'bg-broadcast-black border border-gray-600 text-white'
                  }`}
                >
                  <div className="w-3 h-3 rounded-full mx-auto mb-0.5" style={{ backgroundColor: disc.color }} />
                  <div className="truncate px-0.5">{(disc.customLabel || disc.name).slice(0, 6).toUpperCase()}</div>
                  <div className="text-[9px] text-gray-500 capitalize">{disc.type}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Wind physics one-liner label ─────────────────────────────────────────────
function WindPhysicsLabel({ windCondition, windRelation, throwType, inline }) {
  const isRHFH = throwType === 'forehand' || throwType === 'sidearm'
  const labels = {
    headwind: isRHFH
      ? `Headwind: overstable more reliable for forehand`
      : `Headwind: understable turns harder — use overstable`,
    tailwind: `Tailwind: all discs act more overstable`,
    cross_left: isRHFH
      ? `Cross-left: RHFH fights this naturally`
      : `Cross-left: disc pushed right — aim left`,
    cross_right: isRHFH
      ? `Cross-right: RHFH pushed left — aim right`
      : `Cross-right: disc pushed left — overstable helps`,
  }
  const label = labels[windRelation]
  if (!label) return null
  if (inline) return (
    <span className="text-[9px] text-orange-300 font-bold">⚡</span>
  )
  return (
    <div className="text-[10px] text-orange-300 bg-orange-950/60 rounded px-2 py-1 inline-block">
      ⚡ {label}
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
