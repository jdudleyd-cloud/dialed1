'use client'
import { useEffect, useState, useRef } from 'react'
import { getThrows, getRounds, deleteThrow, deleteRound } from '../../utils/storage'

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
    s.async = true; s.defer = true; s.onerror = reject
    document.head.appendChild(s)
  })
}

// ─── Throw Map Modal ──────────────────────────────────────────────────────────
function ThrowMapModal({ throwData, onClose }) {
  const mapRef = useRef(null)
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    if (!mapRef.current || !throwData?.lat) return
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) { setMapError(true); return }

    loadGoogleMapsScript(apiKey).then(gmaps => {
      const pos = { lat: throwData.lat, lng: throwData.lon }
      const map = new gmaps.Map(mapRef.current, {
        center: pos,
        zoom: 19,
        mapTypeId: 'satellite',
        tilt: 0,
        disableDefaultUI: true,
        zoomControl: true,
      })

      new gmaps.Marker({
        position: pos,
        map,
        title: `${throwData.discName} — Hole ${throwData.hole}`,
        zIndex: 10,
        icon: {
          path: gmaps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#ffeb3b',
          fillOpacity: 1,
          strokeColor: '#000',
          strokeWeight: 2,
        },
        label: { text: `${throwData.hole}`, color: '#000', fontSize: '10px', fontWeight: '900' },
      })

      new gmaps.Circle({
        map,
        center: pos,
        radius: 5,
        strokeColor: '#00d4ff',
        strokeOpacity: 0.6,
        strokeWeight: 1.5,
        fillColor: '#00d4ff',
        fillOpacity: 0.08,
      })
    }).catch(() => setMapError(true))
  }, [throwData])

  if (!throwData) return null

  const date = throwData.timestamp
    ? new Date(throwData.timestamp).toLocaleString()
    : throwData.date
      ? new Date(throwData.date).toLocaleString()
      : '—'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-broadcast-black">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <button onClick={onClose} className="text-broadcast-cyan font-bold text-sm">← Back</button>
        <div className="flex-1">
          <div className="font-black text-broadcast-yellow font-saira">{throwData.discName}</div>
          <div className="text-xs text-broadcast-cyan">
            {throwData.course ? throwData.course.toUpperCase() : '—'} · Hole {throwData.hole}
          </div>
        </div>
        {throwData.predictedDistance && (
          <div className="text-right">
            <div className="text-xl font-black text-broadcast-yellow font-saira">{throwData.predictedDistance} ft</div>
            <div className="text-xs text-broadcast-cyan">Predicted</div>
          </div>
        )}
      </div>

      <div className="flex-1 relative">
        {mapError ? (
          <div className="flex items-center justify-center h-full text-center p-4">
            <div>
              <div className="text-broadcast-yellow font-saira font-black mb-2">MAP UNAVAILABLE</div>
              <div className="text-xs text-broadcast-cyan">
                {throwData.lat?.toFixed(5)}, {throwData.lon?.toFixed(5)}
              </div>
            </div>
          </div>
        ) : (
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        )}
      </div>

      <div className="flex-shrink-0 border-t border-gray-800 p-3 grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-xs text-broadcast-cyan">THROW TYPE</div>
          <div className="font-bold text-white text-sm capitalize">{throwData.throwType || '—'}</div>
        </div>
        <div>
          <div className="text-xs text-broadcast-cyan">WIND</div>
          <div className="font-bold text-white text-sm capitalize">{throwData.windCondition || '—'}</div>
        </div>
        <div>
          <div className="text-xs text-broadcast-cyan">GPS</div>
          <div className="font-bold text-white text-xs">
            {throwData.lat?.toFixed(4)}, {throwData.lon?.toFixed(4)}
          </div>
        </div>
        {throwData.predictedDescription && (
          <div className="col-span-3 text-xs text-gray-500">{throwData.predictedDescription}</div>
        )}
        <div className="col-span-3">
          <div className="text-xs text-gray-500">{date}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────
function ConfirmDelete({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="broadcast-card p-5 mx-6 space-y-4 max-w-xs w-full">
        <div className="font-black text-broadcast-red font-saira text-lg">DELETE?</div>
        <div className="text-sm text-gray-300">{message}</div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 font-saira font-black text-sm rounded border border-gray-600 text-gray-400"
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 font-saira font-black text-sm rounded bg-broadcast-red text-white"
          >
            DELETE
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main HistoryTab ──────────────────────────────────────────────────────────
export default function HistoryTab() {
  const [throws, setThrows] = useState([])
  const [rounds, setRounds] = useState([])
  const [view, setView] = useState('throws')
  const [selectedThrow, setSelectedThrow] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // { type: 'throw'|'round', id, message }

  const refreshData = () => {
    const t = getThrows()
    setThrows([...t].reverse())
    setRounds([...getRounds()].reverse())
  }

  useEffect(() => { refreshData() }, [])

  const handleDeleteThrow = (id, discName, hole) => {
    setConfirmDelete({
      type: 'throw',
      id,
      message: `Delete throw: ${discName} on Hole ${hole}? This cannot be undone.`
    })
  }

  const handleDeleteRound = (id, course, date) => {
    setConfirmDelete({
      type: 'round',
      id,
      message: `Delete round at ${course} on ${date}? This cannot be undone.`
    })
  }

  const confirmDoDelete = () => {
    if (!confirmDelete) return
    if (confirmDelete.type === 'throw') deleteThrow(confirmDelete.id)
    else deleteRound(confirmDelete.id)
    setConfirmDelete(null)
    refreshData()
  }

  if (selectedThrow) {
    return <ThrowMapModal throwData={selectedThrow} onClose={() => setSelectedThrow(null)} />
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto pb-6">
      {confirmDelete && (
        <ConfirmDelete
          message={confirmDelete.message}
          onConfirm={confirmDoDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* View Toggle */}
      <div className="flex gap-2">
        <button onClick={() => setView('rounds')}
          className={`flex-1 py-2 font-black font-saira text-sm rounded transition-colors ${
            view === 'rounds'
              ? 'bg-broadcast-yellow text-broadcast-black'
              : 'bg-broadcast-black text-broadcast-yellow border-2 border-broadcast-yellow'
          }`}>
          ROUNDS ({rounds.length})
        </button>
        <button onClick={() => setView('throws')}
          className={`flex-1 py-2 font-black font-saira text-sm rounded transition-colors ${
            view === 'throws'
              ? 'bg-broadcast-yellow text-broadcast-black'
              : 'bg-broadcast-black text-broadcast-yellow border-2 border-broadcast-yellow'
          }`}>
          THROWS ({throws.length})
        </button>
      </div>

      {/* Rounds View */}
      {view === 'rounds' && (
        <div className="space-y-3">
          {rounds.length === 0 ? (
            <div className="broadcast-card p-6 text-center text-gray-400 text-sm">
              No rounds yet. Start a round in the PLAY tab.
            </div>
          ) : (
            rounds.map((round) => {
              const dateStr = round.startTime
                ? new Date(round.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : '—'
              return (
                <div key={round.id} className="broadcast-card p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-black text-broadcast-yellow font-saira">{round.course}</div>
                      <div className="text-xs text-broadcast-cyan">{dateStr}</div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="text-right">
                        <div className="text-xl font-black text-broadcast-yellow font-saira">
                          {round.throws?.length || 0}
                        </div>
                        <div className="text-xs text-broadcast-cyan">Throws</div>
                      </div>
                      <button
                        onClick={() => handleDeleteRound(round.id, round.course, dateStr)}
                        className="mt-0.5 w-7 h-7 flex items-center justify-center rounded border border-broadcast-red text-broadcast-red text-xs font-black hover:bg-broadcast-red hover:text-white transition-colors"
                        title="Delete round"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Throws View */}
      {view === 'throws' && (
        <div className="space-y-2">
          {throws.length === 0 ? (
            <div className="broadcast-card p-6 text-center text-gray-400 text-sm">
              No throws yet. Log throws during a round.
            </div>
          ) : (
            throws.map((t, i) => (
              <div
                key={t.id || i}
                className="broadcast-card border border-gray-700"
              >
                <button
                  onClick={() => setSelectedThrow(t)}
                  className="w-full p-3 text-left hover:border-broadcast-cyan transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-black text-broadcast-yellow font-saira">{t.discName}</div>
                      <div className="text-xs text-broadcast-cyan">
                        {t.course ? t.course.toUpperCase() : '—'} · Hole {t.hole}
                        {t.throwType && <span className="text-gray-500 ml-2 capitalize">{t.throwType}</span>}
                        {t.windCondition && t.windCondition !== 'calm' && (
                          <span className="text-orange-400 ml-2 capitalize">{t.windCondition} wind</span>
                        )}
                      </div>
                      {t.predictedDescription && (
                        <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">{t.predictedDescription}</div>
                      )}
                      <div className="text-xs text-gray-600 mt-0.5">
                        {t.timestamp ? new Date(t.timestamp).toLocaleString() : ''}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      {t.predictedDistance && (
                        <div className="text-lg font-black text-broadcast-yellow font-saira">{t.predictedDistance}ft</div>
                      )}
                      <div className="text-xs text-broadcast-cyan mt-0.5">TAP FOR MAP →</div>
                    </div>
                  </div>
                </button>
                {/* Delete button at bottom of card */}
                <div className="px-3 pb-2 flex justify-end">
                  <button
                    onClick={() => handleDeleteThrow(t.id, t.discName, t.hole)}
                    className="text-[10px] text-broadcast-red border border-broadcast-red rounded px-2 py-0.5 font-bold hover:bg-broadcast-red hover:text-white transition-colors"
                  >
                    DELETE
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
