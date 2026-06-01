'use client'
import { useState, useEffect } from 'react'
import HoleStamp from './HoleStamp'
import { getThrows } from '../utils/storage'
import { getHoleDistance, courseHasMultiTee, isLoopCourse } from '../utils/courseData'
import { calculateFlightPath, getDiscReason } from '../utils/flightPhysics'
import { THROW_TYPES, getThrowLabel } from '../utils/recommendations'

const THROW_ICONS = { backhand: 'BH', forehand: 'FH', sidearm: 'SA', tomahawk: 'TH' }
const INK    = '#1a1d18'
const SIGNAL = '#FFD400'
const PEACH  = '#c4a890'
const MUTE   = '#8a8472'
const LABEL  = '#5a5440'

// ─── GPS helpers ──────────────────────────────────────────────────────────────
function toRad(v) { return v * Math.PI / 180 }
function toDeg(v) { return v * 180 / Math.PI }

function gpsDistanceFt(lat1, lon1, lat2, lon2) {
  const R = 3958.8 * 5280
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearingDeg(lat1, lon1, lat2, lon2) {
  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

function offsetPt(lat, lon, distFt, hdgDeg) {
  const R = 3958.8 * 5280
  const d = distFt / R, brng = toRad(hdgDeg)
  const φ1 = toRad(lat), λ1 = toRad(lon)
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(brng))
  const λ2 = λ1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2))
  return { lat: toDeg(φ2), lon: toDeg(λ2) }
}

function localPt(lat, lon, origin) {
  const cosLat = Math.cos(toRad(origin.lat))
  return { x: (lon - origin.lon) * 364000 * cosLat, y: (lat - origin.lat) * 364000 }
}

// ─── Caddy hint hook ──────────────────────────────────────────────────────────
function useCaddyHint() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const n = parseInt(localStorage.getItem('dialed_caddy_hint_seen') || '0', 10)
    setVisible(n < 3)
  }, [])
  const dismiss = () => {
    const n = parseInt(localStorage.getItem('dialed_caddy_hint_seen') || '0', 10)
    localStorage.setItem('dialed_caddy_hint_seen', String(n + 1))
    setVisible(false)
  }
  return [visible, dismiss]
}

// ─── Compact compass ──────────────────────────────────────────────────────────
function CompassWidget({ windDeg, basketBearing }) {
  const size = 80, cx = 40
  const windRad    = windDeg       !== undefined ? (windDeg       - 90) * Math.PI / 180 : null
  const basketRad  = basketBearing !== undefined ? (basketBearing - 90) * Math.PI / 180 : null
  const end   = (rad, r) => ({ x: cx + Math.cos(rad) * r, y: cx + Math.sin(rad) * r })
  const start = (rad, r) => ({ x: cx - Math.cos(rad) * r * 0.3, y: cx - Math.sin(rad) * r * 0.3 })

  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx={cx} cy={cx} r={38} fill="rgba(26,29,24,0.85)" stroke="#333" strokeWidth="1.5" />
      {['N','E','S','W'].map((d, i) => {
        const r = (i * 90 - 90) * Math.PI / 180
        return <text key={d} x={cx + Math.cos(r) * 28} y={cx + Math.sin(r) * 28 + 3}
          textAnchor="middle" fontSize="7" fill="#555" fontFamily="sans-serif">{d}</text>
      })}
      {windRad !== null && (() => {
        const s = start(windRad, 26), e = end(windRad, 26)
        return (
          <g>
            <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke={PEACH} strokeWidth="2.5" strokeLinecap="round" />
            <polygon points={`${e.x},${e.y} ${e.x + Math.cos(windRad + 2.5) * 7},${e.y + Math.sin(windRad + 2.5) * 7} ${e.x + Math.cos(windRad - 2.5) * 7},${e.y + Math.sin(windRad - 2.5) * 7}`} fill={PEACH} />
          </g>
        )
      })()}
      {basketRad !== null && (() => {
        const s = start(basketRad, 22), e = end(basketRad, 22)
        return (
          <g>
            <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke={SIGNAL} strokeWidth="2" strokeLinecap="round" strokeDasharray="4 2" />
            <circle cx={e.x} cy={e.y} r={2.5} fill={SIGNAL} />
          </g>
        )
      })()}
      <circle cx={cx} cy={cx} r={2.5} fill="#fff" />
    </svg>
  )
}

// ─── SVG fallback corridor map (with optional heat ellipses) ─────────────────
function HoleCorridorMap({ location, teePin, basketPin, throws, heatData }) {
  if (!teePin || !basketPin) return null

  const heading = bearingDeg(teePin.lat, teePin.lon, basketPin.lat, basketPin.lon)
  const start   = offsetPt(teePin.lat, teePin.lon, 100, heading + 180)
  const end     = offsetPt(basketPin.lat, basketPin.lon, 100, heading)
  const origin  = { lat: (teePin.lat + basketPin.lat) / 2, lon: (teePin.lon + basketPin.lon) / 2 }

  const startLocal = localPt(start.lat, start.lon, origin)
  const endLocal   = localPt(end.lat, end.lon, origin)
  const axisX = endLocal.x - startLocal.x, axisY = endLocal.y - startLocal.y
  const axisLen = Math.hypot(axisX, axisY) || 1
  const ux = axisX / axisLen, uy = axisY / axisLen
  const vx = -uy, vy = ux

  const corridorWidth = 60
  const buildPt = pt => {
    const p = localPt(pt.lat, pt.lon, origin)
    const dx = p.x - startLocal.x, dy = p.y - startLocal.y
    return { x: dx * ux + dy * uy, y: dx * vx + dy * vy }
  }

  const teePt   = buildPt(teePin)
  const basketPt = buildPt(basketPin)
  const playerPt = location ? buildPt(location) : null
  const throwPts = (throws || [])
    .filter(t => Number.isFinite(t.lat) && Number.isFinite(t.lon))
    .map(t => buildPt({ lat: t.lat, lon: t.lon }))

  const allPts = [teePt, basketPt, ...throwPts, playerPt].filter(Boolean)
  const minX = Math.min(0, ...allPts.map(p => p.x))
  const maxX = Math.max(axisLen + 20, ...allPts.map(p => p.x))
  const minY = Math.min(-corridorWidth / 2 - 10, ...allPts.map(p => p.y))
  const maxY = Math.max(corridorWidth / 2 + 10, ...allPts.map(p => p.y))

  const w     = Math.max(260, maxX - minX)
  const h     = Math.max(180, maxY - minY)
  const scale = Math.min(340 / w, 280 / h)
  const sx    = p => ((p.x - minX) * scale) + 12
  const sy    = p => (h - (p.y - minY)) * scale + 8
  const vbW   = Math.max(260, w * scale + 24)
  const vbH   = Math.max(180, h * scale + 16)

  return (
    <svg viewBox={`0 0 ${vbW} ${vbH}`} className="w-full h-full bg-black">
      <rect width="100%" height="100%" fill="#07111f" />
      <path
        d={`M ${sx({ x: 0, y: corridorWidth / 2 })} ${sy({ x: 0, y: corridorWidth / 2 })} L ${sx({ x: axisLen, y: corridorWidth / 2 })} ${sy({ x: axisLen, y: corridorWidth / 2 })} L ${sx({ x: axisLen, y: -corridorWidth / 2 })} ${sy({ x: axisLen, y: -corridorWidth / 2 })} L ${sx({ x: 0, y: -corridorWidth / 2 })} ${sy({ x: 0, y: -corridorWidth / 2 })} Z`}
        fill="rgba(196,168,144,0.06)" stroke={PEACH} strokeWidth="1" opacity="0.8"
      />
      <line x1={sx({ x: 0, y: 0 })} y1={sy({ x: 0, y: 0 })} x2={sx({ x: axisLen, y: 0 })} y2={sy({ x: axisLen, y: 0 })} stroke={SIGNAL} strokeWidth="2.5" />
      <circle cx={sx({ x: 0, y: 0 })}      cy={sy({ x: 0, y: 0 })}      r="5" fill={SIGNAL} />
      <circle cx={sx({ x: axisLen, y: 0 })} cy={sy({ x: axisLen, y: 0 })} r="6" fill={PEACH} />
      {playerPt && <circle cx={sx(playerPt)} cy={sy(playerPt)} r="6" fill="#22c55e" stroke="#052e16" strokeWidth="2" />}
      {throwPts.map((pt, i) => <circle key={i} cx={sx(pt)} cy={sy(pt)} r="4" fill="#ffb703" stroke={INK} strokeWidth="1.5" />)}

      {/* Heat ellipses — rendered after throw points so they're on top */}
      {heatData?.ready && (() => {
        const cx = sx({ x: heatData.mAlong, y: heatData.mAcross })
        const cy = sy({ x: heatData.mAlong, y: heatData.mAcross })
        const rx = heatData.sigAlong * scale
        const ry = heatData.sigAcross * scale
        return (
          <g>
            {[3, 2, 1].map((s, i) => (
              <ellipse key={s} cx={cx} cy={cy}
                rx={Math.max(4, rx * s)} ry={Math.max(3, ry * s)}
                fill="none" stroke={SIGNAL} strokeWidth={1}
                strokeOpacity={[0.12, 0.25, 0.5][i]}
              />
            ))}
            <circle cx={cx} cy={cy} r={3} fill={SIGNAL} fillOpacity={0.7} />
          </g>
        )
      })()}
    </svg>
  )
}

// ─── Heat data computation ────────────────────────────────────────────────────
function computeHeat(discId, hole, course, teePin, basketPin) {
  if (!teePin || !basketPin || !discId) return { ready: false, count: 0 }

  const pts = getThrows().filter(t =>
    t.discId === discId &&
    Number(t.hole) === Number(hole) &&
    t.course === course &&
    Number.isFinite(t.lat) && Number.isFinite(t.lon)
  )

  if (pts.length < 3) return { ready: false, count: pts.length }

  const heading = bearingDeg(teePin.lat, teePin.lon, basketPin.lat, basketPin.lon)
  const startPt = offsetPt(teePin.lat, teePin.lon, 100, heading + 180)
  const origin  = { lat: (teePin.lat + basketPin.lat) / 2, lon: (teePin.lon + basketPin.lon) / 2 }

  const startLocal = localPt(startPt.lat, startPt.lon, origin)
  const endLocal   = localPt(offsetPt(basketPin.lat, basketPin.lon, 100, heading).lat,
                              offsetPt(basketPin.lat, basketPin.lon, 100, heading).lon, origin)
  const axisLen = Math.hypot(endLocal.x - startLocal.x, endLocal.y - startLocal.y) || 1
  const ux = (endLocal.x - startLocal.x) / axisLen, uy = (endLocal.y - startLocal.y) / axisLen
  const vx = -uy, vy = ux

  const corridorPts = pts.map(t => {
    const p  = localPt(t.lat, t.lon, origin)
    const dx = p.x - startLocal.x, dy = p.y - startLocal.y
    return { along: dx * ux + dy * uy, across: dx * vx + dy * vy }
  })

  const n      = corridorPts.length
  const mAlong  = corridorPts.reduce((s, p) => s + p.along, 0) / n
  const mAcross = corridorPts.reduce((s, p) => s + p.across, 0) / n
  const sigAlong  = Math.sqrt(corridorPts.reduce((s, p) => s + (p.along  - mAlong)  ** 2, 0) / n)
  const sigAcross = Math.sqrt(corridorPts.reduce((s, p) => s + (p.across - mAcross) ** 2, 0) / n)

  return { ready: true, count: n, mAlong, mAcross, sigAlong: sigAlong || 5, sigAcross: sigAcross || 3 }
}

// ─── Flight prediction panel ──────────────────────────────────────────────────
function FlightPrediction({ disc, throwType, windCondition, windRelation }) {
  if (!disc) return null
  const flight     = calculateFlightPath(disc, throwType, windCondition, windRelation, null)
  const lateralAbs = Math.abs(flight.lateral)
  const lateralDir = flight.lateral > 0 ? 'right' : flight.lateral < 0 ? 'left' : ''
  const latColor   = lateralAbs > 30 ? '#f0b4b0' : lateralAbs > 15 ? SIGNAL : PEACH

  return (
    <div className="mt-3 p-2 rounded space-y-1" style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}>
      <div className="text-[10px] font-mono" style={{ color: PEACH }}>PREDICTED FLIGHT</div>
      <div className="flex gap-3">
        <div className="text-center">
          <div className="text-lg font-black font-saira leading-tight" style={{ color: SIGNAL }}>{flight.distance}</div>
          <div className="text-[9px]" style={{ color: MUTE }}>FEET</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-black font-saira leading-tight" style={{ color: latColor }}>
            {lateralAbs > 5 ? `${lateralAbs}ft ${lateralDir}` : 'CENTER'}
          </div>
          <div className="text-[9px]" style={{ color: MUTE }}>LATERAL</div>
        </div>
        {windCondition !== 'calm' && windRelation && (
          <div className="text-center">
            <div className="text-sm font-black font-saira leading-tight capitalize" style={{ color: PEACH }}>{windRelation.replace('_', ' ')}</div>
            <div className="text-[9px]" style={{ color: MUTE }}>WIND</div>
          </div>
        )}
      </div>
      <div className="relative h-5 rounded-full overflow-hidden" style={{ background: '#1a1d18' }}>
        <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: '#333' }} />
        <div className="absolute top-1 bottom-1 w-2 rounded-full"
          style={{ left: `${Math.max(5, Math.min(95, 50 + (flight.lateral / 80) * 45))}%`, backgroundColor: '#f0b4b0', transform: 'translateX(-50%)', boxShadow: '0 0 6px #f0b4b0' }} />
        <div className="absolute inset-0 flex items-center justify-center text-[9px] pointer-events-none" style={{ color: '#444' }}>← Left · Center · Right →</div>
      </div>
      <div className="text-[9px] leading-snug" style={{ color: '#555' }}>{flight.description}</div>
    </div>
  )
}

// ─── Main TeeScreen ───────────────────────────────────────────────────────────
export default function TeeScreen({
  location, showNativeMap, mapRef,
  windDeg, windCardinal, windCondition, windRelation,
  windDirOverride, setShowWindOverride,
  basketBearing, teePin, basketPin,
  selectedCourse, selectedHole, currentRound, activeTee, currentPar,
  bagRanked, selectedDisc, setSelectedDisc,
  showCaddy, setShowCaddy, recommendations, recsLoading,
  hazardScore, hazards, throwType, setThrowType,
  holeStrokes, setHoleStrokes, logging, logThrow,
  endRound, startRound, roundThrows,
  COURSE_NAMES, throws, parDisplay, parColor, holeVsPar, holeParLabel,
  setShowBagAll, selectedTee, setSelectedTee,
}) {
  const [showHint, dismissHint] = useCaddyHint()
  const holeDistFt = getHoleDistance(selectedCourse, selectedHole, activeTee)
  const liveDist   = (location && basketPin)
    ? Math.round(gpsDistanceFt(location.lat, location.lon, basketPin.lat, basketPin.lon))
    : null
  const displayDist = liveDist ?? holeDistFt ?? '—'

  const heatData = selectedDisc
    ? computeHeat(selectedDisc.id, selectedHole, selectedCourse, teePin, basketPin)
    : { ready: false, count: 0 }

  const divider = { borderBottom: '1px solid rgba(255,255,255,0.06)' }

  return (
    <div className="flex flex-col pb-6" style={{ background: INK }}>

      {/* ── MAP ─────────────────────────────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden" style={{ height: 280 }}>
        {showNativeMap ? (
          <HoleCorridorMap
            location={location}
            teePin={teePin}
            basketPin={basketPin}
            throws={roundThrows || []}
            heatData={heatData}
          />
        ) : (
          <div ref={mapRef} className="w-full h-full" />
        )}

        {/* TOP-LEFT: hole stamp + par/ft pill */}
        <div className="absolute top-2 left-2 flex items-center gap-2"
          style={{ background: 'rgba(26,29,24,0.78)', backdropFilter: 'blur(6px)', borderRadius: 8, padding: '4px 10px 4px 4px' }}>
          <HoleStamp number={selectedHole} size="md" />
          <div>
            <div className="font-mono font-bold leading-none" style={{ fontSize: 11, color: SIGNAL }}>PAR {currentPar}</div>
            {holeDistFt && <div className="font-mono leading-none mt-0.5" style={{ fontSize: 9, color: 'rgba(240,234,216,0.5)' }}>{holeDistFt}FT</div>}
          </div>
        </div>

        {/* TOP-RIGHT: compass */}
        <div className="absolute top-2 right-2">
          <CompassWidget windDeg={windDeg} basketBearing={basketBearing} />
        </div>

        {/* BOTTOM-RIGHT: wind legend + override trigger */}
        <button
          onClick={() => setShowWindOverride(true)}
          className="absolute bottom-2 right-2"
          style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(196,168,144,0.65)', background: 'rgba(26,29,24,0.7)', backdropFilter: 'blur(3px)', padding: '2px 6px', borderRadius: 3 }}
        >
          {windCardinal ? `${windCardinal} · ` : ''}Yellow=basket · Peach=wind
          {windDirOverride !== null && <span className="ml-1" style={{ color: '#fb923c' }}>●</span>}
        </button>

        {/* BOTTOM-LEFT: heat contour badge when not enough data */}
        {selectedDisc && !heatData.ready && (
          <div className="absolute bottom-2 left-2"
            style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(196,168,144,0.5)', background: 'rgba(26,29,24,0.6)', padding: '2px 6px', borderRadius: 3 }}>
            HEAT {heatData.count}/3
          </div>
        )}
      </div>

      {/* ── DISTANCE PANEL ──────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3" style={divider}>
        <div className="font-mono tracking-widest" style={{ fontSize: 10, color: LABEL }}>DISTANCE TO BASKET</div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="font-mono font-black" style={{ fontSize: 62, color: SIGNAL, lineHeight: 1 }}>{displayDist}</span>
          <span className="font-mono" style={{ fontSize: 14, color: MUTE }}>ft</span>
          {liveDist && <span className="font-mono ml-1" style={{ fontSize: 9, color: LABEL }}>GPS</span>}
        </div>
      </div>

      {/* ── THROW TYPE ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-3" style={divider}>
        <div className="font-mono tracking-widest mb-2" style={{ fontSize: 10, color: LABEL }}>THROW TYPE</div>
        <div className="grid grid-cols-4 gap-2">
          {THROW_TYPES.map(t => (
            <button key={t} onClick={() => setThrowType(t)}
              className="py-2 rounded font-saira font-black text-xs transition-all"
              style={{
                background:  throwType === t ? SIGNAL : 'transparent',
                color:       throwType === t ? INK    : SIGNAL,
                border:      `1.5px solid ${throwType === t ? SIGNAL : 'rgba(255,212,0,0.3)'}`,
              }}>
              <div className="text-base leading-tight">{THROW_ICONS[t]}</div>
              <div style={{ fontSize: 10 }}>{getThrowLabel(t).toUpperCase()}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── DISC STRIP ──────────────────────────────────────────────────────── */}
      <div className="py-3" style={divider}>
        <div className="px-4 font-mono tracking-widest mb-2" style={{ fontSize: 10, color: LABEL }}>
          YOUR BAG
          {recommendations && !recsLoading && (
            <span className="ml-2 normal-case font-normal" style={{ color: MUTE }}>{recommendations.throwName}</span>
          )}
        </div>
        <div className="flex gap-3 px-4 overflow-x-auto pb-1 no-scrollbar">
          {bagRanked.map(disc => {
            const isSelected = selectedDisc?.id === disc.id
            const hr         = hazardScore(disc)
            return (
              <button key={disc.id} onClick={() => setSelectedDisc(disc)}
                className="flex-shrink-0 flex flex-col items-center gap-1">
                <div className="rounded-full relative" style={{
                  width: 50, height: 50,
                  background: disc.color,
                  boxShadow: isSelected
                    ? `0 0 0 2.5px ${SIGNAL}, 0 0 0 4.5px ${INK}`
                    : hr?.penalty > 0 ? '0 0 0 2px #f97316' : 'none',
                }}>
                  {disc.aiRec?.rank <= 3 && (
                    <span style={{ position: 'absolute', top: 2, left: 4, fontSize: 9, color: INK, fontWeight: 900, fontFamily: 'monospace', lineHeight: 1 }}>
                      #{disc.aiRec.rank}
                    </span>
                  )}
                </div>
                <div className="font-mono text-center truncate" style={{ fontSize: 9, color: isSelected ? SIGNAL : MUTE, maxWidth: 52 }}>
                  {(disc.customLabel || disc.name).slice(0, 7)}
                </div>
              </button>
            )
          })}
          <button onClick={() => setShowBagAll(true)} className="flex-shrink-0 flex flex-col items-center gap-1">
            <div className="rounded-full flex items-center justify-center text-lg" style={{ width: 50, height: 50, border: '1.5px dashed rgba(255,255,255,0.2)', color: MUTE }}>···</div>
            <div className="font-mono" style={{ fontSize: 9, color: MUTE }}>ALL</div>
          </button>
        </div>
      </div>

      {/* ── CADDY HINT ──────────────────────────────────────────────────────── */}
      {showHint && (
        <button onClick={dismissHint} className="text-center py-2 font-mono"
          style={{ fontSize: 10, color: PEACH, opacity: 0.75 }}>
          HOLD BASKET MARKER → CADDY
        </button>
      )}

      {/* ── SELECTED DISC DETAIL ────────────────────────────────────────────── */}
      {selectedDisc && (() => {
        const hr      = hazardScore(selectedDisc)
        const reasons = showCaddy
          ? getDiscReason(selectedDisc, throwType, windCondition, windRelation, hazards || [], null)
          : []
        return (
          <div className="mx-4 my-3 rounded p-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex justify-between items-center">
              <div>
                <div className="font-black font-saira" style={{ color: SIGNAL }}>
                  {selectedDisc.customLabel || selectedDisc.name}
                </div>
                {selectedDisc.customLabel && (
                  <div className="text-xs text-gray-500">{selectedDisc.name}</div>
                )}
                <div className="text-xs font-mono" style={{ color: PEACH }}>
                  {selectedDisc.type} · {selectedDisc.stability}
                </div>
              </div>
              <div className="flex gap-3 text-center">
                {[['SPD', selectedDisc.speed], ['GLI', selectedDisc.glide], ['TRN', selectedDisc.turn], ['FAD', selectedDisc.fade]].map(([l, v]) => (
                  <div key={l}>
                    <div className="font-black text-white font-saira">{v}</div>
                    <div style={{ fontSize: 9, color: MUTE }}>{l}</div>
                  </div>
                ))}
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

            <div className="mt-2 flex items-center justify-between">
              <button
                onClick={() => setShowCaddy(c => !c)}
                className="px-2 py-0.5 rounded border font-saira font-bold transition-colors"
                style={{
                  fontSize: 10,
                  borderColor: PEACH,
                  color:       showCaddy ? INK  : PEACH,
                  background:  showCaddy ? PEACH : 'transparent',
                }}>
                🎙 {showCaddy ? 'HIDE CADDY' : 'CADDY'}
              </button>
            </div>

            {showCaddy && reasons.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="font-mono" style={{ fontSize: 10, color: PEACH }}>AI CADDY SAYS</div>
                {reasons.map((r, i) => (
                  <div key={i} className={`text-[10px] rounded px-2 py-1 leading-snug ${r.startsWith('⚠') ? 'bg-orange-950 text-orange-300' : 'bg-gray-900 text-gray-300'}`}>{r}</div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── TEE OVERRIDE ────────────────────────────────────────────────────── */}
      {currentRound && courseHasMultiTee(selectedCourse) && !isLoopCourse(selectedCourse) && (
        <div className="mx-4 mb-3 rounded p-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="font-mono text-gray-500 mb-1.5 text-center" style={{ fontSize: 10 }}>
            TEE OVERRIDE — HOLE {selectedHole}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setSelectedTee('short')}
              className="py-2 font-saira font-black text-xs rounded border transition-colors"
              style={{ background: selectedTee === 'short' ? SIGNAL : 'transparent', color: selectedTee === 'short' ? INK : SIGNAL, borderColor: SIGNAL }}>
              SHORT TEE
            </button>
            <button onClick={() => setSelectedTee('long')}
              className="py-2 font-saira font-black text-xs rounded border transition-colors"
              style={{ background: selectedTee === 'long' ? PEACH : 'transparent', color: selectedTee === 'long' ? INK : PEACH, borderColor: PEACH }}>
              LONG TEE
            </button>
          </div>
        </div>
      )}

      {/* ── ROUND STATUS ────────────────────────────────────────────────────── */}
      <div className="mx-4 mb-3 rounded p-4"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {currentRound ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                <span className="text-xs text-green-400 font-bold font-saira">ROUND IN PROGRESS</span>
              </div>
              <div className="text-lg font-black font-saira mt-0.5" style={{ color: SIGNAL }}>
                {COURSE_NAMES[selectedCourse] || 'Palmer Park'}
              </div>
              <div className="text-xs text-gray-400">
                {throws.length} hole{throws.length !== 1 ? 's' : ''} logged
                {throws.length > 0 && ` · last: H${throws[throws.length - 1]?.hole}`}
              </div>
              {parDisplay !== null && (
                <div className={`text-sm font-black font-saira mt-0.5 ${parColor}`}>{parDisplay} PAR</div>
              )}
            </div>
            <button onClick={endRound}
              className="px-3 py-1 font-black font-saira text-xs rounded text-white"
              style={{ background: '#c44a3a' }}>
              END ROUND
            </button>
          </div>
        ) : (
          <button onClick={startRound} className="w-full broadcast-btn font-saira py-3">
            START ROUND
          </button>
        )}
      </div>

      {/* ── STROKE COUNTER + LOG HOLE ────────────────────────────────────────── */}
      {currentRound && selectedDisc && (
        <div className="mx-4 mb-3 rounded p-3 space-y-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between">
            <div className="font-mono font-bold" style={{ fontSize: 10, color: PEACH }}>STROKES THIS HOLE</div>
            <div className="text-gray-500" style={{ fontSize: 10 }}>
              Par {currentPar} ·{' '}
              {holeVsPar === 0
                ? <span style={{ color: PEACH }}>Par</span>
                : holeVsPar < 0
                  ? <span className="text-green-400">{holeParLabel}</span>
                  : <span style={{ color: '#c44a3a' }}>{holeParLabel}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setHoleStrokes(s => Math.max(1, s - 1))}
              className="w-12 h-12 rounded-full flex items-center justify-center font-black text-xl font-saira text-white"
              style={{ background: INK, border: '2px solid rgba(255,255,255,0.2)' }}>
              −
            </button>
            <div className="flex-1 text-center">
              <div className="font-black font-saira leading-none" style={{ fontSize: 40, color: SIGNAL }}>{holeStrokes}</div>
              <div className="text-gray-500 mt-0.5" style={{ fontSize: 10 }}>throw{holeStrokes !== 1 ? 's' : ''}</div>
            </div>
            <button onClick={() => setHoleStrokes(s => s + 1)}
              className="w-12 h-12 rounded-full flex items-center justify-center font-black text-xl font-saira text-white"
              style={{ background: INK, border: '2px solid rgba(255,255,255,0.2)' }}>
              +
            </button>
          </div>
          <button
            onClick={logThrow}
            disabled={logging}
            className="w-full py-3 font-black font-saira text-sm rounded disabled:opacity-60"
            style={{ background: SIGNAL, color: INK }}>
            {logging ? 'LOGGING...' : `LOG HOLE ${selectedHole} — ${holeStrokes} STROKE${holeStrokes !== 1 ? 'S' : ''}`}
          </button>
        </div>
      )}

      {currentRound && !selectedDisc && (
        <div className="text-center font-mono py-2" style={{ fontSize: 12, color: PEACH }}>
          Select a disc to log hole
        </div>
      )}
    </div>
  )
}
