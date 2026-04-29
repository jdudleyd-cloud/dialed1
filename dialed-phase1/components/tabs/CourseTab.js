'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getTerrainData,
  getHoleData,
  getElevationProfiles,
  normalizeProfiles,
} from '../../utils/terrainData'
import { HAZARD_TYPES, loadHazards, saveHazards } from '../../utils/hazards'

const COURSES = [
  { key: 'palmer', label: 'Palmer Park', holes: 18 },
  { key: 'kensington', label: 'Kensington', holes: 18 },
]

const COURSE_CENTERS = {
  palmer: { lat: 42.4224, lng: -83.1176 },
  kensington: { lat: 42.5275, lng: -83.634 },
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
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=drawing&callback=__gmapsCb`
    s.async = true
    s.defer = true
    s.onerror = reject
    document.head.appendChild(s)
  })
}

function courseKey(selectedCourse) {
  return selectedCourse === 'kensington' ? 'kensington' : 'palmer_park'
}

export default function CourseTab({
  location,
  selectedCourse,
  setSelectedCourse,
  selectedHole,
  setSelectedHole,
}) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const drawingManagerRef = useRef(null)
  const markersRef = useRef([])
  const holeLineRef = useRef(null)
  const drawnPathsRef = useRef([])
  const hazardOverlaysRef = useRef([])

  const [terrainData, setTerrainData] = useState(null)
  const [holeData, setHoleData] = useState(null)
  const [profiles, setProfiles] = useState(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [pinMode, setPinMode] = useState(null) // 'tee' | 'basket' | null
  const [hazardPanel, setHazardPanel] = useState(false)
  const [activeHazardType, setActiveHazardType] = useState(null) // hazard key while drawing
  const [hazards, setHazards] = useState([])
  const [customPins, setCustomPins] = useState(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem('dialed_pins') || '{}') } catch { return {} }
  })
  const mapClickListenerRef = useRef(null)

  // Load terrain data
  useEffect(() => {
    getTerrainData().then(setTerrainData).catch(() => {})
  }, [])

  // Update hole data when course/hole changes
  useEffect(() => {
    if (!terrainData) return
    const fullName = terrainData.courses.find(c =>
      c.course.toLowerCase().includes(selectedCourse === 'palmer' ? 'palmer' : 'kensington')
    )?.course
    const hole = getHoleData(terrainData, fullName, selectedHole)
    setHoleData(hole)
    if (hole) {
      const profs = getElevationProfiles(hole)
      setProfiles(profs ? normalizeProfiles(profs) : null)
    } else {
      setProfiles(null)
    }
  }, [terrainData, selectedCourse, selectedHole])

  // Load hazards for current hole
  useEffect(() => {
    setHazards(loadHazards(courseKey(selectedCourse), selectedHole))
  }, [selectedCourse, selectedHole])

  // Initialize Google Maps
  useEffect(() => {
    if (!mapRef.current || mapLoaded) return
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) { setMapError(true); return }

    loadGoogleMapsScript(apiKey).then(gmaps => {
      const center = COURSE_CENTERS[selectedCourse] || COURSE_CENTERS.palmer
      const map = new gmaps.Map(mapRef.current, {
        center,
        zoom: 17,
        mapTypeId: 'satellite',
        tilt: 0,
        disableDefaultUI: true,
        zoomControl: true,
      })
      mapInstanceRef.current = map

      const dm = new gmaps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false,
        polylineOptions: {
          strokeColor: '#ffeb3b',
          strokeOpacity: 0.9,
          strokeWeight: 3,
          editable: false,
        },
        polygonOptions: {
          strokeWeight: 2,
          editable: false,
        },
      })
      dm.setMap(map)
      drawingManagerRef.current = dm

      // Throw path draw complete
      dm.addListener('polylinecomplete', poly => {
        if (activeHazardTypeRef.current) {
          // This is a hazard polyline — handled in hazard listener
          return
        }
        drawnPathsRef.current.push(poly)
        dm.setDrawingMode(null)
        setDrawMode(false)
      })

      setMapLoaded(true)
    }).catch(() => setMapError(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef.current])

  // Ref to track active hazard type during drawing (closure-safe)
  const activeHazardTypeRef = useRef(null)
  useEffect(() => { activeHazardTypeRef.current = activeHazardType }, [activeHazardType])

  // Wire up hazard drawing listeners when map loads or hazard type changes
  useEffect(() => {
    if (!mapLoaded || !drawingManagerRef.current) return
    const dm = drawingManagerRef.current
    const gmaps = window.google?.maps
    if (!gmaps) return

    // Remove old listeners to avoid duplication
    gmaps.event.clearListeners(dm, 'polylinecomplete')
    gmaps.event.clearListeners(dm, 'polygoncomplete')

    // Throw path
    dm.addListener('polylinecomplete', poly => {
      if (activeHazardTypeRef.current) {
        const hType = HAZARD_TYPES.find(h => h.key === activeHazardTypeRef.current)
        poly.setOptions({
          strokeColor: hType?.color || '#aaa',
          strokeWeight: 3,
        })
        const path = poly.getPath().getArray().map(ll => ({ lat: ll.lat(), lng: ll.lng() }))
        const newHazard = { type: activeHazardTypeRef.current, shape: 'polyline', path, side: inferSide(path) }
        const updated = [...hazardsRef.current, newHazard]
        hazardOverlaysRef.current.push(poly)
        saveHazards(courseKey(selectedCourse), selectedHole, updated)
        setHazards(updated)
        setActiveHazardType(null)
        dm.setDrawingMode(null)
        return
      }
      drawnPathsRef.current.push(poly)
      dm.setDrawingMode(null)
      setDrawMode(false)
    })

    dm.addListener('polygoncomplete', poly => {
      if (!activeHazardTypeRef.current) { poly.setMap(null); return }
      const hType = HAZARD_TYPES.find(h => h.key === activeHazardTypeRef.current)
      poly.setOptions({
        strokeColor: hType?.color || '#aaa',
        fillColor: hType?.color || '#aaa',
        fillOpacity: hType?.fillOpacity || 0.2,
        strokeWeight: 2,
      })
      const path = poly.getPath().getArray().map(ll => ({ lat: ll.lat(), lng: ll.lng() }))
      const newHazard = { type: activeHazardTypeRef.current, shape: 'polygon', path, side: inferSide(path) }
      const updated = [...hazardsRef.current, newHazard]
      hazardOverlaysRef.current.push(poly)
      saveHazards(courseKey(selectedCourse), selectedHole, updated)
      setHazards(updated)
      setActiveHazardType(null)
      dm.setDrawingMode(null)
    })
  }, [mapLoaded, selectedCourse, selectedHole]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ref to keep latest hazards accessible in closures
  const hazardsRef = useRef(hazards)
  useEffect(() => { hazardsRef.current = hazards }, [hazards])

  // Render hazard overlays when hazards or map changes
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return
    const gmaps = window.google?.maps
    if (!gmaps) return
    // Clear old hazard overlays
    hazardOverlaysRef.current.forEach(o => o.setMap(null))
    hazardOverlaysRef.current = []

    hazards.forEach(h => {
      const hType = HAZARD_TYPES.find(t => t.key === h.type)
      if (!hType || !h.path?.length) return
      const path = h.path.map(p => ({ lat: p.lat, lng: p.lng }))
      let overlay
      if (h.shape === 'polygon') {
        overlay = new gmaps.Polygon({
          paths: path,
          map: mapInstanceRef.current,
          strokeColor: hType.color,
          strokeWeight: 2,
          fillColor: hType.color,
          fillOpacity: hType.fillOpacity,
        })
      } else {
        overlay = new gmaps.Polyline({
          path,
          map: mapInstanceRef.current,
          strokeColor: hType.color,
          strokeWeight: 3,
          strokeOpacity: 0.9,
        })
      }
      hazardOverlaysRef.current.push(overlay)
    })
  }, [mapLoaded, hazards])

  // Pan + markers when hole changes
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !holeData) return
    const gmaps = window.google.maps

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
    if (holeLineRef.current) { holeLineRef.current.setMap(null); holeLineRef.current = null }

    const pinKey = `${selectedCourse}_${selectedHole}`
    const saved = customPins[pinKey] || {}
    const tee = saved.tee || holeData.tee
    const basket = saved.basket || holeData.basket
    const midLat = (tee.lat + basket.lat) / 2
    const midLng = (tee.lon + basket.lon) / 2
    mapInstanceRef.current.panTo({ lat: midLat, lng: midLng })
    mapInstanceRef.current.setZoom(19)

    holeLineRef.current = new gmaps.Polyline({
      path: [
        { lat: tee.lat, lng: tee.lon },
        { lat: basket.lat, lng: basket.lon },
      ],
      map: mapInstanceRef.current,
      strokeColor: '#ffeb3b',
      strokeOpacity: 0.7,
      strokeWeight: 3,
      icons: [{
        icon: { path: gmaps.SymbolPath.FORWARD_OPEN_ARROW, scale: 3, strokeColor: '#ffeb3b' },
        offset: '100%',
      }],
    })

    const teeMarker = new gmaps.Marker({
      position: { lat: tee.lat, lng: tee.lon },
      map: mapInstanceRef.current,
      title: `Hole ${selectedHole} Tee`,
      zIndex: 10,
      icon: {
        path: 'M -8,-8 8,-8 8,8 -8,8 Z',
        fillColor: '#ffeb3b', fillOpacity: 1, strokeColor: '#000', strokeWeight: 2,
        scale: 1.2, anchor: new gmaps.Point(0, 0),
      },
      label: { text: `${selectedHole}`, color: '#000', fontSize: '11px', fontWeight: '900' },
    })

    const basketMarker = new gmaps.Marker({
      position: { lat: basket.lat, lng: basket.lon },
      map: mapInstanceRef.current,
      title: `Hole ${selectedHole} Basket`,
      zIndex: 10,
      icon: {
        path: gmaps.SymbolPath.CIRCLE,
        scale: 11, fillColor: '#00d4ff', fillOpacity: 1, strokeColor: '#000', strokeWeight: 2,
      },
      label: { text: '⛳', color: '#000', fontSize: '11px' },
    })

    markersRef.current = [teeMarker, basketMarker]
  }, [mapLoaded, holeData, selectedHole, customPins, selectedCourse])

  // Map click handler for pin placement
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return
    const gmaps = window.google?.maps
    if (!gmaps) return

    if (mapClickListenerRef.current) {
      gmaps.event.removeListener(mapClickListenerRef.current)
      mapClickListenerRef.current = null
    }

    if (!pinMode) return

    mapClickListenerRef.current = mapInstanceRef.current.addListener('click', (e) => {
      const lat = e.latLng.lat()
      const lon = e.latLng.lng()
      const key = `${selectedCourse}_${selectedHole}`
      const updated = {
        ...customPins,
        [key]: { ...(customPins[key] || {}), [pinMode]: { lat, lon } },
      }
      setCustomPins(updated)
      localStorage.setItem('dialed_pins', JSON.stringify(updated))
      setPinMode(null)
    })

    return () => {
      if (mapClickListenerRef.current) {
        gmaps.event.removeListener(mapClickListenerRef.current)
        mapClickListenerRef.current = null
      }
    }
  }, [mapLoaded, pinMode, selectedCourse, selectedHole, customPins])

  const toggleDrawMode = useCallback(() => {
    if (!drawingManagerRef.current) return
    const gmaps = window.google?.maps
    if (!gmaps) return
    if (!drawMode) {
      drawingManagerRef.current.setDrawingMode(gmaps.drawing.OverlayType.POLYLINE)
      setDrawMode(true)
      setActiveHazardType(null)
    } else {
      drawingManagerRef.current.setDrawingMode(null)
      setDrawMode(false)
    }
  }, [drawMode])

  const startHazardDraw = useCallback((hKey) => {
    if (!drawingManagerRef.current) return
    const gmaps = window.google?.maps
    if (!gmaps) return
    const hType = HAZARD_TYPES.find(h => h.key === hKey)
    setActiveHazardType(hKey)
    setHazardPanel(false)
    setDrawMode(false)
    const mode = (hType?.shape === 'polygon')
      ? gmaps.drawing.OverlayType.POLYGON
      : gmaps.drawing.OverlayType.POLYLINE
    drawingManagerRef.current.setDrawingMode(mode)
    if (hType?.shape === 'polygon') {
      drawingManagerRef.current.setOptions({
        polygonOptions: {
          strokeColor: hType.color, fillColor: hType.color,
          fillOpacity: hType.fillOpacity, strokeWeight: 2, editable: false,
        }
      })
    } else {
      drawingManagerRef.current.setOptions({
        polylineOptions: { strokeColor: hType.color, strokeWeight: 3, editable: false }
      })
    }
  }, [])

  const clearPaths = useCallback(() => {
    drawnPathsRef.current.forEach(p => p.setMap(null))
    drawnPathsRef.current = []
  }, [])

  const clearHazards = useCallback(() => {
    if (!confirm('Clear all hazards on this hole?')) return
    hazardOverlaysRef.current.forEach(o => o.setMap(null))
    hazardOverlaysRef.current = []
    saveHazards(courseKey(selectedCourse), selectedHole, [])
    setHazards([])
  }, [selectedCourse, selectedHole])

  const cancelHazard = useCallback(() => {
    if (!drawingManagerRef.current) return
    drawingManagerRef.current.setDrawingMode(null)
    setActiveHazardType(null)
  }, [])

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Course Selector */}
      <div className="px-4 pt-4 flex gap-2">
        {COURSES.map(c => (
          <button key={c.key}
            onClick={() => { setSelectedCourse(c.key); setSelectedHole(1) }}
            className={`flex-1 py-2 font-saira font-black text-sm rounded transition-colors ${
              selectedCourse === c.key
                ? 'bg-broadcast-yellow text-broadcast-black'
                : 'bg-broadcast-black border-2 border-broadcast-yellow text-broadcast-yellow'
            }`}>
            {c.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Hole Selector */}
      <div className="px-4 pt-3">
        <div className="broadcast-card p-3">
          <div className="text-xs text-broadcast-cyan mb-2">SELECT HOLE</div>
          <div className="grid grid-cols-9 gap-1">
            {Array.from({ length: 18 }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setSelectedHole(n)}
                className={`py-1.5 font-saira font-black text-xs rounded transition-all ${
                  selectedHole === n
                    ? 'bg-broadcast-yellow text-broadcast-black'
                    : 'bg-broadcast-black border border-broadcast-yellow text-broadcast-yellow'
                }`}>
                {n}
              </button>
            ))}
          </div>
          {holeData && (
            <div className="flex gap-4 mt-2 text-xs">
              <span className="text-broadcast-cyan">Par <span className="text-broadcast-yellow font-black">{holeData.par}</span></span>
              <span className="text-broadcast-cyan">AM <span className="text-broadcast-yellow font-black">{holeData.distance_am}ft</span></span>
              <span className="text-broadcast-cyan">Pro <span className="text-broadcast-yellow font-black">{holeData.distance_pro}ft</span></span>
              {holeData.terrain?.type && (
                <span className="text-broadcast-yellow font-black capitalize">{holeData.terrain.type.replace(/_/g, ' ')}</span>
              )}
            </div>
          )}
          {hazards.length > 0 && (
            <div className="flex gap-2 mt-1 flex-wrap">
              {hazards.map((h, i) => {
                const hType = HAZARD_TYPES.find(t => t.key === h.type)
                return (
                  <span key={i} className="text-xs px-1.5 py-0.5 rounded font-saira font-bold"
                    style={{ backgroundColor: hType?.color + '33', color: hType?.color, border: `1px solid ${hType?.color}` }}>
                    {hType?.label || h.type}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Elevation Profile */}
      {profiles && (
        <div className="px-4 pt-3">
          <div className="broadcast-card p-3">
            <div className="text-xs text-broadcast-cyan mb-2 flex justify-between">
              <span>ELEVATION PROFILE — HOLE {selectedHole}</span>
              <span className="flex gap-3">
                <span className="text-[#00d4ff]">■ Left</span>
                <span className="text-broadcast-yellow">■ Center</span>
                <span className="text-green-400">■ Right</span>
              </span>
            </div>
            <ElevationChart profiles={profiles} />
          </div>
        </div>
      )}

      {/* Map */}
      <div className="px-4 pt-3 pb-3 flex-1">
        <div className="broadcast-card overflow-hidden" style={{ minHeight: 320 }}>
          {/* Toolbar */}
          <div className="flex gap-1.5 p-2 border-b border-gray-800 flex-wrap">
            <button onClick={toggleDrawMode}
              className={`px-2 py-1.5 font-saira font-bold text-xs rounded transition-colors ${
                drawMode
                  ? 'bg-broadcast-red text-white'
                  : 'bg-broadcast-black border border-broadcast-yellow text-broadcast-yellow'
              }`}>
              {drawMode ? '✏ Drawing...' : '✏ PATH'}
            </button>
            <button onClick={() => { setHazardPanel(p => !p); setActiveHazardType(null) }}
              className={`px-2 py-1.5 font-saira font-bold text-xs rounded transition-colors ${
                hazardPanel || activeHazardType
                  ? 'bg-broadcast-red text-white'
                  : 'bg-broadcast-black border border-orange-500 text-orange-400'
              }`}>
              {activeHazardType ? `⚠ Drawing ${activeHazardType.toUpperCase()}...` : '⚠ HAZARD'}
            </button>
            <button onClick={() => setPinMode(p => p === 'tee' ? null : 'tee')}
              className={`px-2 py-1.5 font-saira font-bold text-xs rounded transition-colors ${
                pinMode === 'tee'
                  ? 'bg-broadcast-yellow text-broadcast-black'
                  : 'bg-broadcast-black border border-broadcast-yellow text-broadcast-yellow'
              }`}>
              {pinMode === 'tee' ? '📍 Tap...' : '📍 TEE'}
            </button>
            <button onClick={() => setPinMode(p => p === 'basket' ? null : 'basket')}
              className={`px-2 py-1.5 font-saira font-bold text-xs rounded transition-colors ${
                pinMode === 'basket'
                  ? 'bg-broadcast-cyan text-broadcast-black'
                  : 'bg-broadcast-black border border-broadcast-cyan text-broadcast-cyan'
              }`}>
              {pinMode === 'basket' ? '⛳ Tap...' : '⛳ BASKET'}
            </button>
            <button onClick={clearPaths}
              className="px-2 py-1.5 font-saira font-bold text-xs bg-broadcast-black border border-gray-600 text-gray-400 rounded">
              CLR
            </button>
            {hazards.length > 0 && (
              <button onClick={clearHazards}
                className="px-2 py-1.5 font-saira font-bold text-xs bg-broadcast-black border border-red-700 text-red-500 rounded">
                CLR HZ
              </button>
            )}
          </div>

          {/* Hazard type picker */}
          {hazardPanel && (
            <div className="p-2 border-b border-gray-800 flex gap-2 flex-wrap bg-gray-900">
              <div className="text-xs text-gray-400 w-full mb-1">Select hazard type to draw:</div>
              {HAZARD_TYPES.map(h => (
                <button key={h.key} onClick={() => startHazardDraw(h.key)}
                  className="px-3 py-1.5 font-saira font-bold text-xs rounded border"
                  style={{ borderColor: h.color, color: h.color, backgroundColor: h.color + '22' }}>
                  {h.label} ({h.shape})
                </button>
              ))}
            </div>
          )}

          {/* Active hazard drawing prompt */}
          {activeHazardType && !hazardPanel && (
            <div className="p-2 border-b border-orange-800 bg-orange-950 flex items-center justify-between">
              <span className="text-xs text-orange-300 font-bold">
                Drawing {HAZARD_TYPES.find(h => h.key === activeHazardType)?.label} — tap map to draw
              </span>
              <button onClick={cancelHazard} className="text-xs text-gray-400 ml-2">Cancel</button>
            </div>
          )}

          {/* Pin mode prompt */}
          {pinMode && (
            <div className="p-2 border-b border-yellow-800 bg-yellow-950 text-xs text-yellow-300 font-bold">
              Tap the map to set {pinMode === 'tee' ? 'TEE' : 'BASKET'} position
            </div>
          )}

          {mapError ? (
            <MapFallback location={location} holeData={holeData} selectedHole={selectedHole} />
          ) : (
            <div ref={mapRef} style={{ width: '100%', height: 280 }} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferSide(path) {
  // Rough heuristic: not enough info without fairway centerline; default 'left'
  return 'left'
}

function ElevationChart({ profiles }) {
  const W = 320
  const H = 80
  const PAD = { top: 6, bottom: 18, left: 28, right: 8 }
  const iW = W - PAD.left - PAD.right
  const iH = H - PAD.top - PAD.bottom
  const toX = pct => PAD.left + (pct / 100) * iW
  const toY = norm => PAD.top + (1 - norm) * iH
  const makePath = (vals, pcts) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(pcts[i]).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {[0, 0.25, 0.5, 0.75, 1].map(v => (
        <line key={v} x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)} stroke="#333" strokeWidth="0.5" />
      ))}
      {[0, 25, 50, 75, 100].map(pct => (
        <g key={pct}>
          <line x1={toX(pct)} y1={H - PAD.bottom} x2={toX(pct)} y2={H - PAD.bottom + 3} stroke="#555" strokeWidth="0.5" />
          <text x={toX(pct)} y={H - 2} textAnchor="middle" fill="#666" fontSize="7">{pct}%</text>
        </g>
      ))}
      <text x={PAD.left - 2} y={toY(0) + 3} textAnchor="end" fill="#666" fontSize="7">{profiles.min.toFixed(0)}</text>
      <text x={PAD.left - 2} y={toY(1) + 3} textAnchor="end" fill="#666" fontSize="7">{profiles.max.toFixed(0)}</text>
      <path d={makePath(profiles.left_fairway, profiles.distance_pct)} fill="none" stroke="#00d4ff" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={makePath(profiles.center_line, profiles.distance_pct)} fill="none" stroke="#ffeb3b" strokeWidth="2" strokeLinejoin="round" />
      <path d={makePath(profiles.right_fairway, profiles.distance_pct)} fill="none" stroke="#4ade80" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={toX(0)} cy={toY(profiles.center_line[0])} r="3" fill="#ffeb3b" />
      <circle cx={toX(100)} cy={toY(profiles.center_line[profiles.center_line.length - 1])} r="3" fill="#00d4ff" />
    </svg>
  )
}

function MapFallback({ location, holeData, selectedHole }) {
  return (
    <div className="flex items-center justify-center bg-gradient-to-br from-gray-900 to-black" style={{ height: 280 }}>
      <div className="text-center p-4">
        <div className="text-broadcast-yellow font-saira font-black mb-1">MAP VIEW</div>
        <div className="text-xs text-broadcast-cyan mb-2">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local</div>
        {holeData && (
          <div className="text-xs text-gray-400 space-y-1">
            <div>Tee: {holeData.tee.lat.toFixed(5)}, {holeData.tee.lon.toFixed(5)}</div>
            <div>Basket: {holeData.basket.lat.toFixed(5)}, {holeData.basket.lon.toFixed(5)}</div>
          </div>
        )}
      </div>
    </div>
  )
}
