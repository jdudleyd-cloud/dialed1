'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { getTerrainData, getHoleData, getElevationProfiles, normalizeProfiles } from '../../utils/terrainData'
import { HAZARD_TYPES, loadHazards, saveHazards } from '../../utils/hazards'
import { loadBag } from '../../utils/discData'
import { calculateFlightPath, calculateLandingCoords } from '../../utils/flightPhysics'

const COURSES = [
  { key: 'palmer', label: 'Palmer Park', holes: 18 },
  { key: 'kensington', label: 'Kensington', holes: 18 },
]
const COURSE_CENTERS = {
  palmer: { lat: 42.4224, lng: -83.1176 },
  kensington: { lat: 42.5275, lng: -83.634 },
}

// ─── Google Maps loader ───────────────────────────────────────────────────────
function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(window.google.maps); return }
    if (document.getElementById('gmap-script')) {
      const t = setInterval(() => { if (window.google?.maps) { clearInterval(t); resolve(window.google.maps) } }, 100)
      setTimeout(() => { clearInterval(t); reject(new Error('timeout')) }, 10000)
      return
    }
    window.__gmapsCb = () => resolve(window.google.maps)
    const s = document.createElement('script')
    s.id = 'gmap-script'
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing&callback=__gmapsCb`
    s.async = true; s.defer = true; s.onerror = reject
    document.head.appendChild(s)
  })
}

function ckFromCourse(selectedCourse) {
  return selectedCourse === 'kensington' ? 'kensington' : 'palmer_park'
}

// ─── Bezier curve helpers ─────────────────────────────────────────────────────
function quadBezier(p0, p1, p2, t) {
  return {
    lat: (1-t)**2*p0.lat + 2*(1-t)*t*p1.lat + t**2*p2.lat,
    lng: (1-t)**2*p0.lng + 2*(1-t)*t*p1.lng + t**2*p2.lng,
  }
}
function bezierPoints(start, control, end, n = 60) {
  const pts = []
  for (let i = 0; i <= n; i++) pts.push(quadBezier(start, control, end, i / n))
  return pts
}

// ─── Smooth SVG path (Catmull-Rom → bezier) ───────────────────────────────────
function smoothPath(vals, pcts, toX, toY) {
  if (!vals?.length) return ''
  const pts = vals.map((v, i) => [toX(pcts[i]), toY(v)])
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i-1)]
    const p1 = pts[i], p2 = pts[i+1]
    const p3 = pts[Math.min(pts.length-1, i+2)]
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
  }
  return d
}

// ─── Elevation Chart ──────────────────────────────────────────────────────────
function ElevationChart({ profiles }) {
  const W = 340, H = 100
  const PAD = { t: 10, b: 22, l: 34, r: 10 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b
  const toX = pct => PAD.l + (pct / 100) * iW
  const toY  = n   => PAD.t + (1 - n) * iH

  const leftPath  = smoothPath(profiles.left_fairway,  profiles.distance_pct, toX, toY)
  const centerPath= smoothPath(profiles.center_line,   profiles.distance_pct, toX, toY)
  const rightPath = smoothPath(profiles.right_fairway, profiles.distance_pct, toX, toY)

  const baseY = toY(0)
  const startX = toX(0)
  const endX   = toX(100)

  // Filled area paths (close down to baseline)
  const fillLeft   = `${leftPath} L ${endX} ${baseY} L ${startX} ${baseY} Z`
  const fillCenter = `${centerPath} L ${endX} ${baseY} L ${startX} ${baseY} Z`
  const fillRight  = `${rightPath} L ${endX} ${baseY} L ${startX} ${baseY} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="gl" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.02"/>
        </linearGradient>
        <linearGradient id="gc" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffeb3b" stopOpacity="0.30"/>
          <stop offset="100%" stopColor="#ffeb3b" stopOpacity="0.02"/>
        </linearGradient>
        <linearGradient id="gr" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0.02"/>
        </linearGradient>
        <filter id="glow-c">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Grid */}
      {[0.25, 0.5, 0.75].map(v => (
        <line key={v} x1={PAD.l} y1={toY(v)} x2={W-PAD.r} y2={toY(v)}
          stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4"/>
      ))}
      <line x1={PAD.l} y1={toY(0)} x2={W-PAD.r} y2={toY(0)} stroke="#334155" strokeWidth="1"/>

      {/* X axis ticks */}
      {[0,25,50,75,100].map(pct => (
        <g key={pct}>
          <line x1={toX(pct)} y1={baseY} x2={toX(pct)} y2={baseY+4} stroke="#475569" strokeWidth="1"/>
          <text x={toX(pct)} y={H-4} textAnchor="middle" fill="#64748b" fontSize="7.5" fontFamily="sans-serif">{pct}%</text>
        </g>
      ))}

      {/* Y axis labels */}
      <text x={PAD.l-3} y={toY(1)+3.5} textAnchor="end" fill="#64748b" fontSize="7.5" fontFamily="sans-serif">{profiles.max.toFixed(0)}</text>
      <text x={PAD.l-3} y={toY(0)+3.5} textAnchor="end" fill="#64748b" fontSize="7.5" fontFamily="sans-serif">{profiles.min.toFixed(0)}</text>

      {/* Filled areas */}
      <path d={fillLeft}   fill="url(#gl)" opacity="0.6"/>
      <path d={fillCenter} fill="url(#gc)" opacity="0.5"/>
      <path d={fillRight}  fill="url(#gr)" opacity="0.6"/>

      {/* Lines */}
      <path d={leftPath}   fill="none" stroke="#00d4ff" strokeWidth="1.5" strokeLinejoin="round" opacity="0.7"/>
      <path d={rightPath}  fill="none" stroke="#4ade80" strokeWidth="1.5" strokeLinejoin="round" opacity="0.7"/>
      <path d={centerPath} fill="none" stroke="#ffeb3b" strokeWidth="2.5" strokeLinejoin="round" filter="url(#glow-c)"/>

      {/* Endpoint dots */}
      <circle cx={toX(0)}   cy={toY(profiles.center_line[0])}                              r="4" fill="#ffeb3b" stroke="#000" strokeWidth="1"/>
      <circle cx={toX(100)} cy={toY(profiles.center_line[profiles.center_line.length-1])} r="4" fill="#00d4ff" stroke="#000" strokeWidth="1"/>
    </svg>
  )
}

// ─── Main CourseTab ───────────────────────────────────────────────────────────
export default function CourseTab({
  location, selectedCourse, setSelectedCourse, selectedHole, setSelectedHole, devMode,
}) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const drawingManagerRef = useRef(null)
  const markersRef = useRef([])
  const holeLineRef = useRef(null)
  const hazardOverlaysRef = useRef([])
  const playerDotRef = useRef(null)
  const landingDotRef = useRef(null)
  const drawnPathsRef = useRef([])   // [{polyline, controlMarker, start, end, control}]
  const watchIdRef = useRef(null)

  const [terrainData, setTerrainData] = useState(null)
  const [holeData, setHoleData] = useState(null)
  const [profiles, setProfiles] = useState(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [pinMode, setPinMode] = useState(null)
  const [hazardPanel, setHazardPanel] = useState(false)
  const [activeHazardType, setActiveHazardType] = useState(null)
  const [hazards, setHazards] = useState([])
  const [bag, setBag] = useState([])
  const [selectedDisc, setSelectedDisc] = useState(null)
  const [windCondition, setWindCondition] = useState('calm')
  const [windRelation, setWindRelation] = useState(null)
  const [playerGPS, setPlayerGPS] = useState(null)
  const [gpsAlt, setGpsAlt] = useState(null)
  const [customPins, setCustomPins] = useState(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem('dialed_pins') || '{}') } catch { return {} }
  })
  const mapClickListenerRef = useRef(null)
  const activeHazardTypeRef = useRef(null)
  useEffect(() => { activeHazardTypeRef.current = activeHazardType }, [activeHazardType])
  const hazardsRef = useRef(hazards)
  useEffect(() => { hazardsRef.current = hazards }, [hazards])

  // Load data
  useEffect(() => { getTerrainData().then(setTerrainData).catch(() => {}) }, [])
  useEffect(() => { setBag(loadBag()) }, [])

  useEffect(() => {
    if (!terrainData) return
    const fullName = terrainData.courses.find(c =>
      c.course.toLowerCase().includes(selectedCourse === 'palmer' ? 'palmer' : 'kensington')
    )?.course
    const hole = getHoleData(terrainData, fullName, selectedHole)
    setHoleData(hole)
    setProfiles(hole ? normalizeProfiles(getElevationProfiles(hole)) : null)
  }, [terrainData, selectedCourse, selectedHole])

  useEffect(() => {
    setHazards(loadHazards(ckFromCourse(selectedCourse), selectedHole))
  }, [selectedCourse, selectedHole])

  // Live GPS tracking (pink dot + altitude for dev mode)
  useEffect(() => {
    if (!navigator.geolocation) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        setPlayerGPS({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        if (pos.coords.altitude != null) setGpsAlt(pos.coords.altitude)
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    )
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current) }
  }, [])

  // Update pink player dot when GPS changes
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !playerGPS) return
    const gmaps = window.google?.maps
    if (!gmaps) return
    if (playerDotRef.current) playerDotRef.current.setPosition(playerGPS)
    else {
      playerDotRef.current = new gmaps.Marker({
        position: playerGPS,
        map: mapInstanceRef.current,
        zIndex: 20,
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#ff69b4',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        title: 'Your location',
      })
    }
  }, [mapLoaded, playerGPS])

  // Update orange landing prediction dot
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return
    const gmaps = window.google?.maps
    if (!gmaps) return

    if (landingDotRef.current) { landingDotRef.current.setMap(null); landingDotRef.current = null }

    if (!selectedDisc || !holeData) return
    const pinKey = `${selectedCourse}_${selectedHole}`
    const saved = customPins[pinKey] || {}
    const tee = saved.tee || holeData.tee
    const basket = saved.basket || holeData.basket
    if (!tee || !basket) return

    const flight = calculateFlightPath(selectedDisc, 'backhand', windCondition, windRelation, holeData.distance_am)
    const landing = calculateLandingCoords(tee.lat, tee.lon, basket.lat, basket.lon, flight.distance, flight.lateral)
    if (!landing) return

    landingDotRef.current = new gmaps.Marker({
      position: landing,
      map: mapInstanceRef.current,
      zIndex: 15,
      icon: {
        path: gmaps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#ff6600',
        fillOpacity: 0.9,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
      title: `${selectedDisc.name} — ${flight.description}`,
    })
  }, [mapLoaded, selectedDisc, windCondition, windRelation, holeData, selectedHole, selectedCourse, customPins])

  // Init Google Maps
  useEffect(() => {
    if (!mapRef.current || mapLoaded) return
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) { setMapError(true); return }

    loadGoogleMapsScript(apiKey).then(gmaps => {
      const center = COURSE_CENTERS[selectedCourse] || COURSE_CENTERS.palmer
      const map = new gmaps.Map(mapRef.current, {
        center, zoom: 17, mapTypeId: 'satellite', tilt: 0,
        disableDefaultUI: true, zoomControl: true,
      })
      mapInstanceRef.current = map

      const dm = new gmaps.drawing.DrawingManager({
        drawingMode: null, drawingControl: false,
        polylineOptions: { strokeColor: '#ffeb3b', strokeOpacity: 0.9, strokeWeight: 3, editable: false },
        polygonOptions: { strokeWeight: 2, editable: false },
      })
      dm.setMap(map)
      drawingManagerRef.current = dm
      setMapLoaded(true)
    }).catch(() => setMapError(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef.current])

  // Hazard drawing listeners
  useEffect(() => {
    if (!mapLoaded || !drawingManagerRef.current) return
    const dm = drawingManagerRef.current
    const gmaps = window.google?.maps
    if (!gmaps) return

    gmaps.event.clearListeners(dm, 'polylinecomplete')
    gmaps.event.clearListeners(dm, 'polygoncomplete')

    dm.addListener('polylinecomplete', poly => {
      if (activeHazardTypeRef.current) {
        const hType = HAZARD_TYPES.find(h => h.key === activeHazardTypeRef.current)
        poly.setOptions({ strokeColor: hType?.color || '#aaa', strokeWeight: 3 })
        const path = poly.getPath().getArray().map(ll => ({ lat: ll.lat(), lng: ll.lng() }))
        const updated = [...hazardsRef.current, { type: activeHazardTypeRef.current, shape: 'polyline', path, side: 'left' }]
        hazardOverlaysRef.current.push(poly)
        saveHazards(ckFromCourse(selectedCourse), selectedHole, updated)
        setHazards(updated)
        setActiveHazardType(null)
        dm.setDrawingMode(null)
        return
      }
      // ── Throw path: convert to bendable bezier ──────────────────────────────
      const rawPath = poly.getPath().getArray()
      if (rawPath.length < 2) { poly.setMap(null); setDrawMode(false); return }
      poly.setMap(null)  // remove the raw polyline

      const start = { lat: rawPath[0].lat(), lng: rawPath[0].lng() }
      const end   = { lat: rawPath[rawPath.length-1].lat(), lng: rawPath[rawPath.length-1].lng() }
      const control = { lat: (start.lat+end.lat)/2, lng: (start.lng+end.lng)/2 }

      const curve = new gmaps.Polyline({
        path: bezierPoints(start, control, end),
        map: mapInstanceRef.current,
        strokeColor: '#ffeb3b', strokeOpacity: 0.9, strokeWeight: 3,
      })

      const bendMarker = new gmaps.Marker({
        position: control, map: mapInstanceRef.current, draggable: true,
        zIndex: 25,
        icon: {
          path: gmaps.SymbolPath.CIRCLE, scale: 8,
          fillColor: '#ffeb3b', fillOpacity: 0.9, strokeColor: '#000', strokeWeight: 1.5,
        },
        title: 'Drag to bend throw path',
      })

      const pathObj = { polyline: curve, controlMarker: bendMarker, start, end, control }
      drawnPathsRef.current.push(pathObj)

      bendMarker.addListener('drag', e => {
        const newCtrl = { lat: e.latLng.lat(), lng: e.latLng.lng() }
        pathObj.control = newCtrl
        curve.setPath(bezierPoints(pathObj.start, newCtrl, pathObj.end))
      })

      dm.setDrawingMode(null)
      setDrawMode(false)
    })

    dm.addListener('polygoncomplete', poly => {
      if (!activeHazardTypeRef.current) { poly.setMap(null); return }
      const hType = HAZARD_TYPES.find(h => h.key === activeHazardTypeRef.current)
      poly.setOptions({ strokeColor: hType?.color, fillColor: hType?.color, fillOpacity: hType?.fillOpacity, strokeWeight: 2 })
      const path = poly.getPath().getArray().map(ll => ({ lat: ll.lat(), lng: ll.lng() }))
      const updated = [...hazardsRef.current, { type: activeHazardTypeRef.current, shape: 'polygon', path, side: 'left' }]
      hazardOverlaysRef.current.push(poly)
      saveHazards(ckFromCourse(selectedCourse), selectedHole, updated)
      setHazards(updated)
      setActiveHazardType(null)
      dm.setDrawingMode(null)
    })
  }, [mapLoaded, selectedCourse, selectedHole]) // eslint-disable-line

  // Render hazard overlays
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return
    const gmaps = window.google?.maps; if (!gmaps) return
    hazardOverlaysRef.current.forEach(o => o.setMap(null))
    hazardOverlaysRef.current = []
    hazards.forEach(h => {
      const hType = HAZARD_TYPES.find(t => t.key === h.type)
      if (!hType || !h.path?.length) return
      const path = h.path.map(p => ({ lat: p.lat, lng: p.lng }))
      let overlay
      if (h.shape === 'polygon') {
        overlay = new gmaps.Polygon({ paths: path, map: mapInstanceRef.current, strokeColor: hType.color, strokeWeight: 2, fillColor: hType.color, fillOpacity: hType.fillOpacity })
      } else {
        overlay = new gmaps.Polyline({ path, map: mapInstanceRef.current, strokeColor: hType.color, strokeWeight: 3, strokeOpacity: 0.9 })
      }
      hazardOverlaysRef.current.push(overlay)
    })
  }, [mapLoaded, hazards])

  // Pan + update hole markers
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !holeData) return
    const gmaps = window.google.maps
    markersRef.current.forEach(m => m.setMap(null)); markersRef.current = []
    if (holeLineRef.current) { holeLineRef.current.setMap(null); holeLineRef.current = null }

    const saved = customPins[`${selectedCourse}_${selectedHole}`] || {}
    const tee = saved.tee || holeData.tee
    const basket = saved.basket || holeData.basket
    mapInstanceRef.current.panTo({ lat: (tee.lat+basket.lat)/2, lng: (tee.lon+basket.lon)/2 })
    mapInstanceRef.current.setZoom(19)

    holeLineRef.current = new gmaps.Polyline({
      path: [{ lat: tee.lat, lng: tee.lon }, { lat: basket.lat, lng: basket.lon }],
      map: mapInstanceRef.current, strokeColor: '#ffeb3b', strokeOpacity: 0.55, strokeWeight: 2,
      icons: [{ icon: { path: gmaps.SymbolPath.FORWARD_OPEN_ARROW, scale: 3, strokeColor: '#ffeb3b' }, offset: '100%' }],
    })

    markersRef.current.push(new gmaps.Marker({
      position: { lat: tee.lat, lng: tee.lon }, map: mapInstanceRef.current,
      zIndex: 10,
      icon: { path: 'M -8,-8 8,-8 8,8 -8,8 Z', fillColor: '#ffeb3b', fillOpacity: 1, strokeColor: '#000', strokeWeight: 2, scale: 1.2, anchor: new gmaps.Point(0,0) },
      label: { text: `${selectedHole}`, color: '#000', fontSize: '11px', fontWeight: '900' },
    }))
    markersRef.current.push(new gmaps.Marker({
      position: { lat: basket.lat, lng: basket.lon }, map: mapInstanceRef.current,
      zIndex: 10,
      icon: { path: gmaps.SymbolPath.CIRCLE, scale: 11, fillColor: '#00d4ff', fillOpacity: 1, strokeColor: '#000', strokeWeight: 2 },
      label: { text: '⛳', color: '#000', fontSize: '11px' },
    }))
  }, [mapLoaded, holeData, selectedHole, customPins, selectedCourse])

  // Map click for pin placement
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return
    const gmaps = window.google?.maps; if (!gmaps) return
    if (mapClickListenerRef.current) { gmaps.event.removeListener(mapClickListenerRef.current); mapClickListenerRef.current = null }
    if (!pinMode) return
    mapClickListenerRef.current = mapInstanceRef.current.addListener('click', e => {
      const lat = e.latLng.lat(), lon = e.latLng.lng()
      const key = `${selectedCourse}_${selectedHole}`
      const updated = { ...customPins, [key]: { ...(customPins[key] || {}), [pinMode]: { lat, lon } } }
      setCustomPins(updated)
      localStorage.setItem('dialed_pins', JSON.stringify(updated))
      setPinMode(null)
    })
    return () => { if (mapClickListenerRef.current) { const g = window.google?.maps; g?.event.removeListener(mapClickListenerRef.current) } }
  }, [mapLoaded, pinMode, selectedCourse, selectedHole, customPins])

  const toggleDraw = useCallback(() => {
    const gmaps = window.google?.maps; if (!gmaps || !drawingManagerRef.current) return
    if (!drawMode) { drawingManagerRef.current.setDrawingMode(gmaps.drawing.OverlayType.POLYLINE); setDrawMode(true); setActiveHazardType(null) }
    else { drawingManagerRef.current.setDrawingMode(null); setDrawMode(false) }
  }, [drawMode])

  const startHazardDraw = useCallback(hKey => {
    const gmaps = window.google?.maps; if (!gmaps || !drawingManagerRef.current) return
    const hType = HAZARD_TYPES.find(h => h.key === hKey)
    setActiveHazardType(hKey); setHazardPanel(false); setDrawMode(false)
    const mode = hType?.shape === 'polygon' ? gmaps.drawing.OverlayType.POLYGON : gmaps.drawing.OverlayType.POLYLINE
    drawingManagerRef.current.setDrawingMode(mode)
    if (hType?.shape === 'polygon') drawingManagerRef.current.setOptions({ polygonOptions: { strokeColor: hType.color, fillColor: hType.color, fillOpacity: hType.fillOpacity, strokeWeight: 2, editable: false } })
    else drawingManagerRef.current.setOptions({ polylineOptions: { strokeColor: hType.color, strokeWeight: 3, editable: false } })
  }, [])

  const clearPaths = useCallback(() => {
    drawnPathsRef.current.forEach(p => { p.polyline?.setMap(null); p.controlMarker?.setMap(null) })
    drawnPathsRef.current = []
  }, [])

  const clearHazards = useCallback(() => {
    if (!confirm('Clear all hazards on this hole?')) return
    hazardOverlaysRef.current.forEach(o => o.setMap(null)); hazardOverlaysRef.current = []
    saveHazards(ckFromCourse(selectedCourse), selectedHole, [])
    setHazards([])
  }, [selectedCourse, selectedHole])

  const cancelHazard = useCallback(() => {
    drawingManagerRef.current?.setDrawingMode(null)
    setActiveHazardType(null)
  }, [])

  // ── Flight prediction info ─────────────────────────────────────────────────
  const predictionInfo = selectedDisc && holeData ? (() => {
    const f = calculateFlightPath(selectedDisc, 'backhand', windCondition, windRelation, holeData.distance_am)
    return f
  })() : null

  return (
    <div className="flex flex-col overflow-auto pb-4">
      {/* Course selector */}
      <div className="px-4 pt-4 flex gap-2">
        {COURSES.map(c => (
          <button key={c.key} onClick={() => { setSelectedCourse(c.key); setSelectedHole(1) }}
            className={`flex-1 py-2 font-saira font-black text-sm rounded transition-colors ${
              selectedCourse === c.key ? 'bg-broadcast-yellow text-broadcast-black' : 'bg-broadcast-black border-2 border-broadcast-yellow text-broadcast-yellow'
            }`}>{c.label.toUpperCase()}</button>
        ))}
      </div>

      {/* Hole selector */}
      <div className="px-4 pt-3">
        <div className="broadcast-card p-3">
          <div className="text-xs text-broadcast-cyan mb-2">SELECT HOLE</div>
          <div className="grid grid-cols-9 gap-1">
            {Array.from({length:18},(_,i)=>i+1).map(n => (
              <button key={n} onClick={() => setSelectedHole(n)}
                className={`py-1.5 font-saira font-black text-xs rounded transition-all ${selectedHole===n ? 'bg-broadcast-yellow text-broadcast-black' : 'bg-broadcast-black border border-broadcast-yellow text-broadcast-yellow'}`}>
                {n}
              </button>
            ))}
          </div>
          {holeData && (
            <div className="flex gap-4 mt-2 text-xs flex-wrap">
              <span className="text-broadcast-cyan">Par <span className="text-broadcast-yellow font-black">{holeData.par}</span></span>
              <span className="text-broadcast-cyan">AM <span className="text-broadcast-yellow font-black">{holeData.distance_am}ft</span></span>
              <span className="text-broadcast-cyan">Pro <span className="text-broadcast-yellow font-black">{holeData.distance_pro}ft</span></span>
              {holeData.terrain?.type && <span className="text-broadcast-yellow font-black capitalize">{holeData.terrain.type.replace(/_/g,' ')}</span>}
              {holeData.terrain?.doglegs && holeData.terrain.doglegs !== 'none' && <span className="text-gray-400 capitalize">↪ {holeData.terrain.doglegs.replace(/_/g,' ')}</span>}
            </div>
          )}
          {hazards.length > 0 && (
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {hazards.map((h, i) => {
                const hType = HAZARD_TYPES.find(t => t.key === h.type)
                return <span key={i} className="text-xs px-1.5 py-0.5 rounded font-saira font-bold"
                  style={{ backgroundColor: hType?.color+'22', color: hType?.color, border: `1px solid ${hType?.color}` }}>{hType?.label}</span>
              })}
            </div>
          )}
        </div>
      </div>

      {/* Elevation chart */}
      {profiles && (
        <div className="px-4 pt-3">
          <div className="broadcast-card p-3 bg-gray-950">
            <div className="text-xs text-broadcast-cyan mb-1 flex justify-between">
              <span>ELEVATION — HOLE {selectedHole}</span>
              <span className="flex gap-3 text-[10px]">
                <span className="text-[#00d4ff]">▬ Left</span>
                <span className="text-broadcast-yellow">▬ Center</span>
                <span className="text-green-400">▬ Right</span>
              </span>
            </div>
            <ElevationChart profiles={profiles} />
          </div>
        </div>
      )}

      {/* Disc + wind selector for landing prediction */}
      <div className="px-4 pt-3">
        <div className="broadcast-card p-3">
          <div className="text-xs text-broadcast-cyan mb-2">PREDICT LANDING</div>
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {bag.slice(0,8).map(d => (
              <button key={d.id} onClick={() => setSelectedDisc(prev => prev?.id === d.id ? null : d)}
                className={`py-1.5 rounded text-[10px] font-bold font-saira text-center ${selectedDisc?.id===d.id ? 'bg-broadcast-yellow text-black' : 'bg-gray-800 text-white border border-gray-700'}`}>
                <div className="w-3 h-3 rounded-full mx-auto mb-0.5" style={{backgroundColor:d.color}}/>
                {(d.customLabel||d.name).slice(0,5).toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {['calm','light','moderate','strong'].map(w => (
              <button key={w} onClick={() => setWindCondition(w)}
                className={`flex-1 py-1 rounded text-[10px] font-bold font-saira ${windCondition===w?'bg-broadcast-cyan text-black':'bg-gray-800 text-broadcast-cyan border border-broadcast-cyan'}`}>
                {w.slice(0,3).toUpperCase()}
              </button>
            ))}
          </div>
          {predictionInfo && (
            <div className="mt-2 text-xs text-gray-300 bg-gray-900 rounded p-2">
              <span className="text-orange-400 font-bold">◉ </span>{predictionInfo.description}
            </div>
          )}
          {selectedDisc && <div className="text-[10px] text-gray-500 mt-1">Orange dot = predicted landing · Pink dot = you</div>}
        </div>
      </div>

      {/* Dev mode elevation readout */}
      {devMode && (
        <div className="px-4 pt-3">
          <div className="broadcast-card p-3 border-broadcast-red">
            <div className="text-xs text-broadcast-red font-bold mb-2">⚙ DEV MODE</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-gray-500">GPS Lat: </span><span className="text-white font-mono">{playerGPS?.lat?.toFixed(6) || '—'}</span></div>
              <div><span className="text-gray-500">GPS Lng: </span><span className="text-white font-mono">{playerGPS?.lng?.toFixed(6) || '—'}</span></div>
              <div><span className="text-gray-500">Altitude: </span><span className="text-broadcast-yellow font-mono">{gpsAlt != null ? `${gpsAlt.toFixed(1)}m` : '—'}</span></div>
              <div><span className="text-gray-500">Accuracy: </span><span className="text-white font-mono">~10m GPS</span></div>
            </div>
            <div className="text-[10px] text-gray-600 mt-2">SET TEE / BASKET pins lock permanently for all rounds</div>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="px-4 pt-3 pb-2">
        <div className="broadcast-card overflow-hidden">
          {/* Toolbar */}
          <div className="flex gap-1.5 p-2 border-b border-gray-800 flex-wrap">
            <button onClick={toggleDraw}
              className={`px-2 py-1.5 font-saira font-bold text-xs rounded ${drawMode ? 'bg-broadcast-red text-white' : 'bg-broadcast-black border border-broadcast-yellow text-broadcast-yellow'}`}>
              {drawMode ? '✏ Drawing...' : '✏ PATH'}
            </button>
            <button onClick={() => { setHazardPanel(p=>!p); setActiveHazardType(null) }}
              className={`px-2 py-1.5 font-saira font-bold text-xs rounded ${hazardPanel||activeHazardType ? 'bg-broadcast-red text-white' : 'bg-broadcast-black border border-orange-500 text-orange-400'}`}>
              {activeHazardType ? `⚠ ${activeHazardType.toUpperCase()}...` : '⚠ HAZARD'}
            </button>
            {/* Dev mode: always show TEE/BASKET; non-dev: hide */}
            {devMode && <>
              <button onClick={() => setPinMode(p=>p==='tee'?null:'tee')}
                className={`px-2 py-1.5 font-saira font-bold text-xs rounded ${pinMode==='tee'?'bg-broadcast-yellow text-black':'bg-broadcast-black border border-broadcast-yellow text-broadcast-yellow'}`}>
                {pinMode==='tee'?'📍 Tap...':'📍 TEE'}
              </button>
              <button onClick={() => setPinMode(p=>p==='basket'?null:'basket')}
                className={`px-2 py-1.5 font-saira font-bold text-xs rounded ${pinMode==='basket'?'bg-broadcast-cyan text-black':'bg-broadcast-black border border-broadcast-cyan text-broadcast-cyan'}`}>
                {pinMode==='basket'?'⛳ Tap...':'⛳ BASKET'}
              </button>
            </>}
            <button onClick={clearPaths} className="px-2 py-1.5 font-saira font-bold text-xs bg-broadcast-black border border-gray-600 text-gray-400 rounded">CLR</button>
            {hazards.length > 0 && <button onClick={clearHazards} className="px-2 py-1.5 font-saira font-bold text-xs bg-broadcast-black border border-red-700 text-red-500 rounded">CLR HZ</button>}
          </div>

          {/* Hazard type picker */}
          {hazardPanel && (
            <div className="p-2 border-b border-gray-800 flex gap-2 flex-wrap bg-gray-900">
              <div className="text-xs text-gray-400 w-full mb-1">Select hazard type:</div>
              {HAZARD_TYPES.map(h => (
                <button key={h.key} onClick={() => startHazardDraw(h.key)}
                  className="px-3 py-1.5 font-saira font-bold text-xs rounded border"
                  style={{ borderColor: h.color, color: h.color, backgroundColor: h.color+'22' }}>
                  {h.label} ({h.shape})
                </button>
              ))}
            </div>
          )}
          {activeHazardType && !hazardPanel && (
            <div className="p-2 border-b border-orange-800 bg-orange-950 flex items-center justify-between">
              <span className="text-xs text-orange-300 font-bold">Drawing {HAZARD_TYPES.find(h=>h.key===activeHazardType)?.label} — tap map</span>
              <button onClick={cancelHazard} className="text-xs text-gray-400 ml-2">Cancel</button>
            </div>
          )}
          {drawMode && <div className="p-2 border-b border-yellow-800 bg-yellow-950 text-xs text-yellow-300 font-bold">Draw path: tap start → tap end · Drag yellow dot to bend curve</div>}
          {pinMode && <div className="p-2 border-b border-yellow-800 bg-yellow-950 text-xs text-yellow-300 font-bold">Tap map to set {pinMode==='tee'?'TEE':'BASKET'} — pin locks permanently</div>}

          {mapError ? (
            <div className="flex items-center justify-center bg-gray-900" style={{height:280}}>
              <div className="text-center p-4">
                <div className="text-broadcast-yellow font-saira font-black mb-1">MAP UNAVAILABLE</div>
                <div className="text-xs text-broadcast-cyan">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</div>
                {holeData && <div className="text-xs text-gray-400 mt-2">Tee: {holeData.tee.lat.toFixed(5)}, {holeData.tee.lon.toFixed(5)}</div>}
              </div>
            </div>
          ) : (
            <div ref={mapRef} style={{width:'100%',height:280}}/>
          )}
        </div>
      </div>
    </div>
  )
}
