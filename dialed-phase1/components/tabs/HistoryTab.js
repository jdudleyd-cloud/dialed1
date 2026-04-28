import { useEffect, useState } from 'react'
import { getThrows, getRounds } from '../../utils/storage'

export default function HistoryTab() {
  const [throws, setThrows] = useState([])
  const [rounds, setRounds] = useState([])
  const [view, setView] = useState('rounds') // 'rounds' or 'throws'

  useEffect(() => {
    setThrows(getThrows())
    setRounds(getRounds())
  }, [])

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('rounds')}
          className={`flex-1 py-2 font-black font-saira text-sm rounded transition-colors ${
            view === 'rounds'
              ? 'bg-broadcast-yellow text-broadcast-black'
              : 'bg-broadcast-black text-broadcast-yellow border-2 border-broadcast-yellow'
          }`}
        >
          ROUNDS ({rounds.length})
        </button>
        <button
          onClick={() => setView('throws')}
          className={`flex-1 py-2 font-black font-saira text-sm rounded transition-colors ${
            view === 'throws'
              ? 'bg-broadcast-yellow text-broadcast-black'
              : 'bg-broadcast-black text-broadcast-yellow border-2 border-broadcast-yellow'
          }`}
        >
          THROWS ({throws.length})
        </button>
      </div>

      {/* Rounds View */}
      {view === 'rounds' && (
        <div className="space-y-3">
          {rounds.length === 0 ? (
            <div className="broadcast-card p-6 text-center text-gray-400">
              No rounds yet. Start a round in the PLAY tab.
            </div>
          ) : (
            rounds.map((round) => (
              <div key={round.id} className="broadcast-card p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-black text-broadcast-yellow font-saira">
                      {round.course}
                    </div>
                    <div className="text-xs text-broadcast-cyan">
                      {new Date(round.startTime).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="broadcast-stat">{round.throws?.length || 0}</div>
                    <div className="text-xs text-broadcast-cyan">Throws</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Throws View */}
      {view === 'throws' && (
        <div className="space-y-3">
          {throws.length === 0 ? (
            <div className="broadcast-card p-6 text-center text-gray-400">
              No throws yet. Log throws during a round.
            </div>
          ) : (
            throws.map((throwData) => (
              <div key={throwData.id} className="broadcast-card p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-black text-broadcast-yellow font-saira">
                      {throwData.discName}
                    </div>
                    <div className="text-xs text-broadcast-cyan">
                      Hole {throwData.hole} • {new Date(throwData.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="broadcast-stat">{Math.round(throwData.distance)} ft</div>
                    <div className="text-xs text-broadcast-cyan">Distance</div>
                  </div>
                </div>
                <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
                  Lat: {throwData.lat.toFixed(4)} • Lon: {throwData.lon.toFixed(4)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
