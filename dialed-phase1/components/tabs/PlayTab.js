'use client'
import { useState, useEffect, useRef } from 'react'
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
import { getHoleDistance, getHolePar, getCoursePar, getCourseHoleCount, courseHasMultiTee, isLoopCourse, getHoleCoords, getRoundRange, COURSE_HOLES } from '../../utils/courseData'

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

function toRad(v) { return v * Math.PI / 180 }
function toDeg(v) { return v * 180 / Math.PI }

function offsetPoint(lat, lon, distanceFt, headingDeg) {
  const earthRadiusFt = 3958.8 * 5280
  const d = distanceFt / earthRadiusFt
  const brng = toRad(headingDeg)
  const lat1 = toRad(lat)
  const lon1 = toRad(lon)
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng))
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
  return { lat: toDeg(lat2), lon: toDeg(lon2) }
}

function localPoint(lat, lon, origin) {
  const cosLat = Math.cos(toRad(origin.lat))
  const x = (lon - origin.lon) * 364000 * cosLat
  const y = (lat - origin.lat) * 364000
  return { x, y }
}

function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(window.google.maps); return }
    if (document.getElementById('gmap-script')) {
      const interval = setInterval(() => {
        if (window.google?.maps) { clearInterval(interval); resolve(window.google.maps) }
      }, 100)
      setTimeout(() => { clearInterval(interval); reject(new Error('timeout')) }, 10000)
      return
    }
    window.__gmapsCb = () => resolve(window.google.maps)
    const s = document.createElement('script')
    s.id = 'gmap-script'
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing,geometry&callback=__gmapsCb`
    s.async = true
    s.defer = true
    s.onerror = reject
    document.head.appendChild(s)
  })
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

function HoleCorridorMap({ location, teePin, basketPin, throws }) {
  if (!teePin || !basketPin) return null

  const heading = bearing(teePin.lat, teePin.lon, basketPin.lat, basketPin.lon)
  const start = offsetPoint(teePin.lat, teePin.lon, 100, heading + 180)
  const end = offsetPoint(basketPin.lat, basketPin.lon, 100, heading)
  const origin = {
    lat: (teePin.lat + basketPin.lat) / 2,
    lon: (teePin.lon + basketPin.lon) / 2,
  }

  const startLocal = localPoint(start.lat, start.lon, origin)
  const endLocal = localPoint(end.lat, end.lon, origin)
  const teeLocal = localPoint(teePin.lat, teePin.lon, origin)
  const basketLocal = localPoint(basketPin.lat, basketPin.lon, origin)
  const playerLocal = location ? localPoint(location.lat, location.lon, origin) : null

  const corridorWidth = 60
  const axisX = endLocal.x - startLocal.x
  const axisY = endLocal.y - startLocal.y
  const axisLen = Math.hypot(axisX, axisY) || 1
  const ux = axisX / axisLen
  const uy = axisY / axisLen
  const vx = -uy
  const vy = ux

  const sideA = {
    x: startLocal.x + vx * (corridorWidth / 2),
    y: startLocal.y + vy * (corridorWidth / 2),
  }
  const sideB = {
    x: startLocal.x - vx * (corridorWidth / 2),
    y: startLocal.y - vy * (corridorWidth / 2),
  }

  const buildPoint = (pt) => {
    const p = localPoint(pt.lat, pt.lon, origin)
    const dx = p.x - startLocal.x
    const dy = p.y - startLocal.y
    return {
      x: dx * ux + dy * uy,
      y: dx * vx + dy * vy,
    }
  }

  const teePt = buildPoint(teePin)
  const basketPt = buildPoint(basketPin)
  const playerPt = playerLocal ? buildPoint(location) : null
  const throwPts = (throws || []).filter(t => Number.isFinite(t.lat) && Number.isFinite(t.lon)).map(t => buildPoint({ lat: t.lat, lon: t.lon }))

  const minX = Math.min(0, teePt.x, basketPt.x, ...(throwPts.map(p => p.x)), playerPt ? playerPt.x : 0)
  const maxX = Math.max(axisLen + 20, teePt.x, basketPt.x, ...(throwPts.map(p => p.x)), playerPt ? playerPt.x : 0)
  const minY = Math.min(-corridorWidth / 2 - 10, teePt.y, basketPt.y, ...(throwPts.map(p => p.y)), playerPt ? playerPt.y : 0)
  const maxY = Math.max(corridorWidth / 2 + 10, teePt.y, basketPt.y, ...(throwPts.map(p => p.y)), playerPt ? playerPt.y : 0)

  const width = Math.max(260, maxX - minX)
  const height = Math.max(140, maxY - minY)
  const scale = Math.min(320 / width, 180 / height)
  const sx = (p) => ((p.x - minX) * scale) + 12
  const sy = (p) => (height - (p.y - minY) * scale) + 8

  return (
    <svg viewBox={`0 0 ${Math.max(260, width * scale + 24)} ${Math.max(140, height * scale + 16)}`} className="w-full h-[180px] bg-black">
      <defs>
        <linearGradient id="corridor" x1="0" x2="1">
          <stop offset="0%" stopColor="rgba(0,212,255,0.08)" />
          <stop offset="100%" stopColor="rgba(255,235,59,0.18)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="#07111f" />
      <path d={`M ${sx({ x: 0, y: corridorWidth / 2 })} ${sy({ x: 0, y: corridorWidth / 2 })} L ${sx({ x: axisLen, y: corridorWidth / 2 })} ${sy({ x: axisLen, y: corridorWidth / 2 })} L ${sx({ x: axisLen, y: -corridorWidth / 2 })} ${sy({ x: axisLen, y: -corridorWidth / 2 })} L ${sx({ x: 0, y: -corridorWidth / 2 })} ${sy({ x: 0, y: -corridorWidth / 2 })} Z`} fill="url(#corridor)" stroke="#00d4ff" strokeWidth="1" opacity="0.8" />
      <line x1={sx({ x: 0, y: 0 })} y1={sy({ x: 0, y: 0 })} x2={sx({ x: axisLen, y: 0 })} y2={sy({ x: axisLen, y: 0 })} stroke="#ffeb3b" strokeWidth="3" />
      <line x1={sx({ x: 0, y: corridorWidth / 2 })} y1={sy({ x: 0, y: corridorWidth / 2 })} x2={sx({ x: axisLen, y: corridorWidth / 2 })} y2={sy({ x: axisLen, y: corridorWidth / 2 })} stroke="#00d4ff" strokeOpacity="0.4" strokeWidth="1" />
      <line x1={sx({ x: 0, y: -corridorWidth / 2 })} y1={sy({ x: 0, y: -corridorWidth / 2 })} x2={sx({ x: axisLen, y: -corridorWidth / 2 })} y2={sy({ x: axisLen, y: -corridorWidth / 2 })} stroke="#00d4ff" strokeOpacity="0.4" strokeWidth="1" />
      <circle cx={sx({ x: 0, y: 0 })} cy={sy({ x: 0, y: 0 })} r="5" fill="#ffeb3b" />
      <circle cx={sx({ x: axisLen, y: 0 })} cy={sy({ x: axisLen, y: 0 })} r="6" fill="#00d4ff" />
      {playerPt && <circle cx={sx(playerPt)} cy={sy(playerPt)} r="6" fill="#22c55e" stroke="#052e16" strokeWidth="2" />}
      {throwPts.map((pt, i) => <circle key={i} cx={sx(pt)} cy={sy(pt)} r="4" fill="#ffb703" stroke="#111827" strokeWidth="1.5" />)}
      <text x={sx({ x: axisLen * 0.5, y: 0 })} y={sy({ x: axisLen * 0.5, y: -corridorWidth / 1.6 }) - 4} fill="#8b9bb6" fontSize="9" textAnchor="middle">Hole corridor</text>
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
  selectedTee,
  setSelectedTee,
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
  // Wind override — null means use auto-detected values; set when player feels conditions differ from sensor
  const [showWindOverride, setShowWindOverride] = useState(false)
  const [windDirOverride, setWindDirOverride] = useState(null)
  const [showRoundModal, setShowRoundModal] = useState(false)
  const [pendingRange, setPendingRange] = useState('full')
  const [pendingTee, setPendingTee] = useState('short')
  const [holeStrokes, setHoleStrokes] = useState(1)

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
  // Use override direction if player set one, otherwise fall back to sensor value
  const effectiveWindDeg = windDirOverride ?? windDeg
  const windCardinal = effectiveWindDeg !== undefined ? degToCardinal(effectiveWindDeg) : ''

  const pins = loadCustomPins()
  const pinKey = `${selectedCourse}_${selectedHole}`
  const holePin = pins[pinKey] || {}
  const coordFallback = getHoleCoords(selectedCourse, selectedHole, selectedTee || 'short')
  const teePin = holePin.tee || coordFallback?.tee
  const basketPin = holePin.basket || coordFallback?.basket

  const windRelation = inferWindRelation(
    effectiveWindDeg,
    teePin?.lat, teePin?.lon,
    basketPin?.lat, basketPin?.lon
  )

  const basketBearing = (location && basketPin)
    ? bearing(location.lat, location.lon, basketPin.lat, basketPin.lon)
    : undefined

  const [mapError, setMapError] = useState(false)
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const hasRealMapsKey = Boolean(mapsApiKey) && !/YOUR_GOOGLE_MAPS_API_KEY_HERE/i.test(mapsApiKey)

  useEffect(() => {
    if (!mapRef.current || !location) return
    const apiKey = mapsApiKey
    if (!hasRealMapsKey || !apiKey) { setMapError(true); return }

    loadGoogleMapsScript(apiKey).then(gmaps => {
      if (!mapRef.current) return
      const center = { lat: location.lat, lng: location.lon }
      const map = mapInstanceRef.current || new gmaps.Map(mapRef.current, {
        center,
        zoom: 18,
        mapTypeId: 'satellite',
        tilt: 0,
        disableDefaultUI: true,
        zoomControl: true,
      })
      mapInstanceRef.current = map

      if (teePin && basketPin) {
        const tee = new gmaps.LatLng(teePin.lat, teePin.lon)
        const basket = new gmaps.LatLng(basketPin.lat, basketPin.lon)
        const heading = bearing(teePin.lat, teePin.lon, basketPin.lat, basketPin.lon)
        const corridorLength = gmaps.geometry.spherical.computeDistanceBetween(tee, basket) + 200
        const mid = gmaps.geometry.spherical.computeOffset(tee, corridorLength / 2, heading)

        map.setOptions({ heading, tilt: 0, mapTypeId: 'satellite' })
        map.setCenter(mid)
        map.setZoom(17)
      } else {
        map.setCenter(center)
        map.setZoom(18)
      }

      const markers = []

      markers.push(new gmaps.Marker({
        position: center,
        map,
        title: 'You are here',
        zIndex: 20,
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#00ff88',
          fillOpacity: 1,
          strokeColor: '#0b0f1a',
          strokeWeight: 2,
        },
      }))

      if (teePin) {
        markers.push(new gmaps.Marker({
          position: { lat: teePin.lat, lng: teePin.lon },
          map,
          title: 'Tee',
          icon: {
            path: gmaps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#ffeb3b',
            fillOpacity: 1,
            strokeColor: '#111827',
            strokeWeight: 2,
          },
        }))
      }

      if (basketPin) {
        markers.push(new gmaps.Marker({
          position: { lat: basketPin.lat, lng: basketPin.lon },
          map,
          title: 'Basket',
          icon: {
            path: gmaps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: '#00d4ff',
            fillOpacity: 1,
            strokeColor: '#111827',
            strokeWeight: 2,
          },
        }))
      }

      const throwPath = (roundThrows || [])
        .filter(t => Number.isFinite(t?.lat) && Number.isFinite(t?.lon))
        .map(t => ({ lat: t.lat, lng: t.lon }))

      if (throwPath.length > 1) {
        new gmaps.Polyline({
          path: throwPath,
          map,
          geodesic: true,
          strokeColor: '#ffb703',
          strokeOpacity: 0.95,
          strokeWeight: 3,
        })
      }

      throwPath.forEach((pt, idx) => {
        markers.push(new gmaps.Marker({
          position: pt,
          map,
          title: `Throw ${idx + 1}`,
          label: { text: `${idx + 1}`, color: '#111827', fontSize: '10px', fontWeight: '900' },
          icon: {
            path: gmaps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: '#ffb703',
            fillOpacity: 1,
            strokeColor: '#111827',
            strokeWeight: 2,
          },
        }))
      })

      return () => markers.forEach(m => m.setMap(null))
    }).catch(() => setMapError(true))
  }, [location, teePin, basketPin, roundThrows, selectedCourse, selectedHole, mapsApiKey, hasRealMapsKey])

  const hazardScore = (disc) => {
    if (!disc || hazards.length === 0) return null
    return scoreDiscRisk(disc, windCondition, windRelation, hazards)
  }

  const COURSE_NAMES = { palmer: 'Palmer Park', kensington: 'Kensington', thorn: 'The Thorn', grizzly: 'Grizzly Oaks', cass_benton: 'Cass Benton', stony_creek: 'Stony Creek', ghesquiere: 'Ghesquiere', spindler: 'Spindler Park', acorn_knoll: 'Acorn Knoll', hudson_mills_monster: 'Hudson Mills Monster', hudson_mills_original_18: 'Hudson Mills Original (18)', hudson_mills_original_24: 'Hudson Mills Original (24)' }

  const beginRound = (tee, range) => {
    const resolvedTee = tee || pendingTee
    const resolvedRange = range || pendingRange
    if (resolvedTee) setSelectedTee(resolvedTee)
    const { start, end } = getRoundRange(selectedCourse, resolvedRange)
    setSelectedHole(start)
    const courseName = COURSE_NAMES[selectedCourse] || selectedCourse
    const holeCount = end - start + 1
    const round = saveRound({ course: courseName, holeCount, startHole: start, endHole: end, tee: resolvedTee, range: resolvedRange })
    setCurrentRound({ ...round, startHole: start, endHole: end })
    setRoundThrows([])
    setShowRoundModal(false)
  }

  const startRound = () => {
    const total = getCourseHoleCount(selectedCourse)
    // Show modal if course has multiple holes (range selection) or multi-tee
    if (total > 9 || courseHasMultiTee(selectedCourse)) {
      setPendingRange('full')
      setPendingTee('short')
      setShowRoundModal(true)
    } else {
      beginRound(null, 'full')
    }
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
      strokes: holeStrokes,
      lat: location.lat,
      lon: location.lon,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString(),
      throwType,
      windCondition,
      windRelation,
      course: selectedCourse,
      tee: selectedTee || 'short',
      roundId: currentRound?.id || null,
      predictedDistance: flight.distance,
      predictedLateral: flight.lateral,
      predictedDescription: flight.description,
    }
    const saved = saveThrow(throwData)
    logThrowToFirebase({ ...throwData, sessionId }).catch(() => {})
    logGPSPoint(sessionId, location.lat, location.lon, selectedHole).catch(() => {})
    setRoundThrows(prev => [...(prev || []), saved])
    setHoleStrokes(1)  // reset counter for next hole
    const endHole = currentRound?.endHole ?? getCourseHoleCount(selectedCourse)
    if (selectedHole < endHole) setSelectedHole(selectedHole + 1)
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

  // ── Par scoring ──────────────────────────────────────────────────────────────
  const activeTee = selectedTee || 'short'

  // Running score vs par across all holes logged so far this round
  const runningParScore = (() => {
    if (!currentRound || throws.length === 0) return null
    // Last logged entry per hole wins (handles re-logs)
    const holeScores = {}
    throws.forEach(t => { holeScores[t.hole] = t.strokes ?? 1 })
    let diff = 0
    for (const [hole, strokes] of Object.entries(holeScores)) {
      diff += strokes - getHolePar(selectedCourse, Number(hole), activeTee)
    }
    return diff
  })()

  const parDisplay = runningParScore === null ? null
    : runningParScore === 0 ? 'E'
    : runningParScore > 0   ? `+${runningParScore}`
    : `${runningParScore}`

  const parColor = runningParScore === null ? 'text-gray-400'
    : runningParScore < 0   ? 'text-green-400'
    : runningParScore === 0 ? 'text-broadcast-cyan'
    : 'text-broadcast-red'

  // For the current hole — what score will this give vs par?
  const currentPar     = getHolePar(selectedCourse, selectedHole, activeTee)
  const holeVsPar      = holeStrokes - currentPar
  const showNativeMap = !hasRealMapsKey || mapError
  const holeParLabel   = holeVsPar === -2 ? '🦅 Eagle'
    : holeVsPar === -1 ? '🐦 Birdie'
    : holeVsPar ===  0 ? 'Par'
    : holeVsPar ===  1 ? 'Bogey'
    : holeVsPar ===  2 ? 'Dbl Bogey'
    : holeVsPar  >   2 ? `+${holeVsPar}`
    : `${holeVsPar}`

  return (
    <div className="p-4 space-y-4 pb-6">
      {/* Live map for spotting and throw tracking */}
      <div className="broadcast-card p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs text-broadcast-cyan">LIVE PLAY MAP</div>
            <div className="text-[10px] text-gray-500">You · tee · basket · recent throw path</div>
          </div>
          <div className="text-[10px] text-gray-400">{(roundThrows || []).length} throw{(roundThrows || []).length === 1 ? '' : 's'}</div>
        </div>
        {showNativeMap ? (
          <div className="rounded border border-gray-800 overflow-hidden bg-black">
            <HoleCorridorMap location={location} teePin={teePin} basketPin={basketPin} throws={roundThrows || []} />
          </div>
        ) : (
          <div className="rounded border border-gray-800 overflow-hidden bg-black">
            <div ref={mapRef} style={{ width: '100%', height: 180 }} />
          </div>
        )}
      </div>

      {/* Weather Strip + Compass */}
      {weather && (
        <div className="broadcast-card p-3">
          <div className="flex gap-3 items-center">
            <CompassWidget windDeg={windDeg} basketBearing={basketBearing} />
            <div className="flex-1 grid grid-cols-2 gap-2 text-center">
              <WeatherStat value={`${weather.temp}°`} label={weather.description} />
              {/* Tappable wind stat — opens manual override when sensor reading feels wrong */}
              <button onClick={() => setShowWindOverride(true)} className="text-center w-full">
                <div className="broadcast-stat text-base flex items-center justify-center gap-1">
                  {weather.windSpeed}mph
                  {windDirOverride !== null && <span className="text-[9px] text-orange-400">●</span>}
                </div>
                <div className="text-[10px] text-broadcast-cyan leading-tight">
                  Wind {windCardinal} {windCondition !== 'calm' ? `· ${windCondition}` : ''}
                </div>
              </button>
              <WeatherStat value={`${weather.humidity}%`} label="Humidity" />
              <WeatherStat
                value={windRelation ? windRelation.replace('_', ' ').toUpperCase() : `${effectiveWindDeg || '—'}°`}
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
                {COURSE_NAMES[selectedCourse] || 'Palmer Park'}
              </div>
              <div className="text-xs text-gray-400">
                {throws.length} hole{throws.length !== 1 ? 's' : ''} logged
                {throws.length > 0 && ` · last: H${throws[throws.length - 1]?.hole}`}
              </div>
              {parDisplay !== null && (
                <div className={`text-sm font-black font-saira mt-0.5 ${parColor}`}>
                  {parDisplay} PAR
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-broadcast-cyan">HOLE</div>
              <div className="text-3xl font-black text-broadcast-yellow font-saira">{selectedHole}</div>
              {(() => {
                const dist = getHoleDistance(selectedCourse, selectedHole, activeTee)
                return dist
                  ? <div className="text-[10px] text-gray-400">{dist}ft · Par {currentPar}</div>
                  : <div className="text-[10px] text-gray-600">Par {currentPar}</div>
              })()}
              <button onClick={endRound}
                className="mt-0.5 px-3 py-1 bg-broadcast-red text-white font-black font-saira text-xs rounded">
                END ROUND
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {(() => {
              const dist = getHoleDistance(selectedCourse, selectedHole, activeTee)
              return (
                <div className="flex justify-between text-xs text-gray-500 px-1">
                  <span className="font-saira">H{selectedHole} · {COURSE_NAMES[selectedCourse] || 'Palmer Park'}</span>
                  <span>{dist ? `${dist}ft · ` : ''}Par {currentPar}</span>
                </div>
              )
            })()}
            <button onClick={startRound} className="w-full broadcast-btn font-saira py-3">
              START ROUND
            </button>
          </div>
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

      {/* Per-hole tee override — only for true multi-tee courses (e.g. Palmer, not Spindler) */}
      {currentRound && courseHasMultiTee(selectedCourse) && !isLoopCourse(selectedCourse) && (
        <div className="broadcast-card p-2">
          <div className="text-[10px] text-gray-500 mb-1.5 text-center">TEE OVERRIDE — HOLE {selectedHole}</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setSelectedTee('short')}
              className={`py-2 font-saira font-black text-xs rounded border transition-colors ${
                selectedTee === 'short'
                  ? 'bg-broadcast-yellow text-broadcast-black border-broadcast-yellow'
                  : 'bg-transparent text-broadcast-yellow border-broadcast-yellow'
              }`}>SHORT TEE</button>
            <button onClick={() => setSelectedTee('long')}
              className={`py-2 font-saira font-black text-xs rounded border transition-colors ${
                selectedTee === 'long'
                  ? 'bg-broadcast-cyan text-broadcast-black border-broadcast-cyan'
                  : 'bg-transparent text-broadcast-cyan border-broadcast-cyan'
              }`}>LONG TEE</button>
          </div>
        </div>
      )}

      {/* Stroke counter + Log Hole */}
      {currentRound && selectedDisc && (
        <div className="broadcast-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-broadcast-cyan font-bold">STROKES THIS HOLE</div>
            <div className="text-[10px] text-gray-500">
              Par {currentPar} · {holeVsPar === 0 ? <span className="text-broadcast-cyan">Par</span>
                : holeVsPar < 0 ? <span className="text-green-400">{holeParLabel}</span>
                : <span className="text-broadcast-red">{holeParLabel}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setHoleStrokes(s => Math.max(1, s - 1))}
              className="w-12 h-12 rounded-full bg-broadcast-black border-2 border-gray-600 text-white font-black text-xl font-saira flex items-center justify-center"
            >−</button>
            <div className="flex-1 text-center">
              <div className="text-4xl font-black text-broadcast-yellow font-saira leading-none">{holeStrokes}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">throw{holeStrokes !== 1 ? 's' : ''}</div>
            </div>
            <button
              onClick={() => setHoleStrokes(s => s + 1)}
              className="w-12 h-12 rounded-full bg-broadcast-black border-2 border-gray-600 text-white font-black text-xl font-saira flex items-center justify-center"
            >+</button>
          </div>
          <button
            onClick={logThrow}
            disabled={logging}
            className="w-full py-3 font-black font-saira text-sm rounded bg-broadcast-yellow text-broadcast-black disabled:opacity-60"
          >
            {logging ? 'LOGGING...' : `LOG HOLE ${selectedHole} — ${holeStrokes} STROKE${holeStrokes !== 1 ? 'S' : ''}`}
          </button>
        </div>
      )}
      {currentRound && !selectedDisc && (
        <div className="text-center text-xs text-broadcast-cyan py-2">Select a disc to log hole</div>
      )}

      {/* Round start modal — hole range + tee selection */}
      {showRoundModal && (() => {
        const total    = getCourseHoleCount(selectedCourse)
        const half     = total / 2
        const isShared = isLoopCourse(selectedCourse)                       // shared-basket course
        const multiTee = courseHasMultiTee(selectedCourse) && !isShared    // true per-hole tee choice
        const showRange = total > 9

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowRoundModal(false)}>
            <div className="bg-gray-900 border-2 border-broadcast-yellow rounded-xl p-5 mx-4 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
              <div>
                <div className="text-sm font-black text-broadcast-yellow font-saira text-center">START ROUND</div>
                <div className="text-[10px] text-gray-500 text-center mt-0.5">{COURSE_NAMES[selectedCourse] || selectedCourse}</div>
              </div>

              {/* Hole range — Front / Full / Back */}
              {showRange && (
                <div>
                  <div className="text-[10px] text-broadcast-cyan font-bold mb-2">HOW MANY HOLES?</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'front', label: 'FRONT', sub: `Holes 1–${half}`         },
                      { key: 'full',  label: 'FULL',  sub: `All ${total} holes`       },
                      { key: 'back',  label: 'BACK',  sub: `Holes ${half + 1}–${total}` },
                    ].map(({ key, label, sub }) => (
                      <button key={key} onClick={() => setPendingRange(key)}
                        className={`py-3 font-saira font-black text-xs rounded border-2 transition-colors ${
                          pendingRange === key
                            ? 'bg-broadcast-yellow text-broadcast-black border-broadcast-yellow'
                            : 'bg-transparent text-broadcast-yellow border-broadcast-yellow opacity-60'
                        }`}>
                        {label}<br/>
                        <span className="text-[9px] font-normal opacity-70">{sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tee selection — only for true multi-tee courses (e.g. Palmer) */}
              {multiTee && (
                <div>
                  <div className="text-[10px] text-broadcast-cyan font-bold mb-2">WHICH TEES?</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setPendingTee('short')}
                      className={`py-4 font-saira font-black text-sm rounded border-2 transition-colors ${
                        pendingTee === 'short'
                          ? 'bg-broadcast-yellow text-broadcast-black border-broadcast-yellow'
                          : 'bg-transparent text-broadcast-yellow border-broadcast-yellow opacity-60'
                      }`}>
                      SHORT<br/><span className="text-[10px] font-normal opacity-70">Am tees</span>
                    </button>
                    <button onClick={() => setPendingTee('long')}
                      className={`py-4 font-saira font-black text-sm rounded border-2 transition-colors ${
                        pendingTee === 'long'
                          ? 'bg-broadcast-cyan text-broadcast-black border-broadcast-cyan'
                          : 'bg-transparent text-broadcast-cyan border-broadcast-cyan opacity-60'
                      }`}>
                      LONG<br/><span className="text-[10px] font-normal opacity-70">Pro tees</span>
                    </button>
                  </div>
                </div>
              )}

              <button onClick={() => beginRound(pendingTee, pendingRange)}
                className="w-full py-3 bg-broadcast-yellow text-broadcast-black font-black font-saira text-sm rounded">
                LET'S THROW
              </button>
              <button onClick={() => setShowRoundModal(false)} className="w-full text-xs text-gray-600 py-1">Cancel</button>
            </div>
          </div>
        )
      })()}

      {/* Wind override modal — opened when player feels sensor reading is wrong */}
      {showWindOverride && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={() => setShowWindOverride(false)}>
          <div className="bg-gray-900 border-t-2 border-broadcast-yellow w-full rounded-t-xl p-4 pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-1">
              <div className="text-sm font-black text-broadcast-yellow font-saira">WIND OVERRIDE</div>
              <button onClick={() => setShowWindOverride(false)} className="text-gray-400 text-xl leading-none">✕</button>
            </div>
            <div className="text-[10px] text-gray-500 mb-3">
              Auto-detected: {weather?.windSpeed}mph {windDeg !== undefined ? degToCardinal(windDeg) : '—'} · {windDirOverride !== null ? <span className="text-orange-400">overridden</span> : 'using sensor'}
            </div>

            <div className="text-xs text-broadcast-cyan mb-1">CONDITION</div>
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {['calm', 'light', 'moderate', 'strong'].map(c => (
                <button key={c} onClick={() => setWindCondition(c)}
                  className={`py-1.5 font-saira font-bold text-[10px] rounded border transition-colors ${
                    windCondition === c
                      ? 'bg-broadcast-cyan text-broadcast-black border-broadcast-cyan'
                      : 'bg-broadcast-black text-broadcast-cyan border-broadcast-cyan'
                  }`}>
                  {c.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="text-xs text-broadcast-cyan mb-1">DIRECTION</div>
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((dir, i) => {
                const deg = i * 45
                const active = windDirOverride === deg || (windDirOverride === null && windDeg !== undefined && Math.round(windDeg / 45) % 8 === i)
                return (
                  <button key={dir} onClick={() => setWindDirOverride(deg)}
                    className={`py-1.5 font-saira font-bold text-[10px] rounded border transition-colors ${
                      active
                        ? 'bg-broadcast-yellow text-broadcast-black border-broadcast-yellow'
                        : 'bg-broadcast-black text-broadcast-yellow border-broadcast-yellow'
                    }`}>
                    {dir}
                  </button>
                )
              })}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setWindDirOverride(null); if (weather?.windSpeed) { const mph = weather.windSpeed; setWindCondition(mph <= 5 ? 'calm' : mph <= 12 ? 'light' : mph <= 20 ? 'moderate' : 'strong') } setShowWindOverride(false) }}
                className="flex-1 py-2 font-saira font-bold text-xs rounded bg-broadcast-black border border-gray-600 text-gray-400"
              >
                RESET TO AUTO
              </button>
              <button onClick={() => setShowWindOverride(false)}
                className="flex-1 py-2 font-saira font-bold text-xs rounded bg-broadcast-yellow text-broadcast-black">
                APPLY
              </button>
            </div>
          </div>
        </div>
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
