'use client'
import { useState, useEffect, useRef } from 'react'
import {
  loadBag, saveBag, nextDiscId, deriveStability,
  EMPTY_DISC, DISC_TYPES
} from '../../utils/discData'
import { getThrows } from '../../utils/storage'

const TYPE_FILTERS = ['All', 'Distance Driver', 'Fairway Driver', 'Midrange', 'Putter']

// ─── Gap analysis ────────────────────────────────────────────────────────────
function analyzeGap(bag, disc) {
  const suggestions = []
  const speeds = bag.map(d => d.speed)
  const minSpeed = Math.min(...speeds)
  const maxSpeed = Math.max(...speeds)

  if (disc.type === 'Distance Driver' && disc.speed >= 12) {
    const hasFairway = bag.some(d => d.type === 'Fairway Driver')
    if (!hasFairway) suggestions.push('No Fairway Driver in bag — consider a 7-9 speed disc for controlled shots')
  }
  if (disc.stability === 'Overstable') {
    const hasUS = bag.some(d => d.stability === 'Understable' && d.type === disc.type)
    if (!hasUS) suggestions.push('No understable option at this disc type for turnover shots')
  }
  if (disc.stability === 'Understable') {
    const hasOS = bag.some(d => d.stability === 'Overstable' && d.type === disc.type)
    if (!hasOS) suggestions.push('No overstable option at this disc type for headwind/fade shots')
  }
  if (maxSpeed - minSpeed > 8 && disc.speed === minSpeed) {
    suggestions.push(`Big speed gap in bag (${minSpeed}–${maxSpeed}) — a mid-speed driver may help`)
  }
  return suggestions
}

// ─── ThrowHistory ─────────────────────────────────────────────────────────────
function ThrowHistory({ disc, onBack }) {
  const allThrows = getThrows().filter(t => t.discId === disc.id || t.discName === disc.name)
  const sorted = [...allThrows].reverse()
  const distances = allThrows.map(t => t.distance).filter(Boolean)
  const avg = distances.length ? Math.round(distances.reduce((a, b) => a + b, 0) / distances.length) : null

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      <button onClick={onBack} className="text-broadcast-cyan text-sm">← Back to bag</button>
      <div className="broadcast-card p-3">
        <div className="font-black text-broadcast-yellow font-saira text-lg">{disc.customLabel || disc.name}</div>
        <div className="text-xs text-broadcast-cyan">{disc.manufacturer} {disc.name} · {disc.plastic}</div>
        <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
          <div><span className="text-broadcast-cyan">Throws:</span> <span className="font-bold text-white">{allThrows.length}</span></div>
          <div><span className="text-broadcast-cyan">Avg Dist:</span> <span className="font-bold text-broadcast-yellow">{avg ? `${avg} ft` : 'N/A'}</span></div>
        </div>
      </div>
      {sorted.length === 0 && <div className="text-gray-500 text-sm text-center py-8">No throws logged yet</div>}
      {sorted.map((t, i) => (
        <div key={i} className="broadcast-card p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-broadcast-cyan">{t.course || '—'} · Hole {t.hole}</span>
            <span className="text-gray-400">{t.date ? new Date(t.date).toLocaleDateString() : ''}</span>
          </div>
          <div className="flex gap-4">
            {t.distance && <span className="text-broadcast-yellow font-bold">{t.distance} ft</span>}
            {t.throwType && <span className="text-gray-300">{t.throwType}</span>}
            {t.windCondition && <span className="text-gray-400">{t.windCondition} wind</span>}
          </div>
          {t.notes && <div className="text-gray-400 italic">{t.notes}</div>}
        </div>
      ))}
    </div>
  )
}

// ─── DiscEditor ───────────────────────────────────────────────────────────────
function DiscEditor({ disc: initial, bag, onSave, onDelete, onCancel, isNew }) {
  const [disc, setDisc] = useState({ ...initial })
  const fileRef = useRef()
  const cameraRef = useRef()

  const set = (field, val) => {
    const updated = { ...disc, [field]: val }
    if (['turn', 'fade'].includes(field)) updated.stability = deriveStability(
      field === 'turn' ? val : updated.turn,
      field === 'fade' ? val : updated.fade
    )
    setDisc(updated)
  }

  const handlePhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => set('photos', [...(disc.photos || []), ev.target.result])
    reader.readAsDataURL(file)
  }

  const removePhoto = (idx) => set('photos', disc.photos.filter((_, i) => i !== idx))

  const numField = (label, field, min, max) => (
    <div className="flex flex-col items-center">
      <label className="text-xs text-broadcast-cyan mb-1">{label}</label>
      <input
        type="number" min={min} max={max}
        value={disc[field] ?? ''}
        onChange={e => set(field, Number(e.target.value))}
        className="w-14 text-center bg-gray-800 border border-gray-600 rounded text-broadcast-yellow font-bold p-1 text-sm"
      />
    </div>
  )

  return (
    <div className="p-4 space-y-4 overflow-y-auto pb-24">
      <div className="flex justify-between items-center">
        <h2 className="font-black text-broadcast-yellow font-saira text-lg">{isNew ? 'ADD DISC' : 'EDIT DISC'}</h2>
        <button onClick={onCancel} className="text-gray-400 text-sm">Cancel</button>
      </div>

      {/* Name + label */}
      <div className="space-y-2">
        <input placeholder="Disc Name (e.g. Buzzz)" value={disc.name}
          onChange={e => set('name', e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm" />
        <input placeholder="Custom Label (e.g. My Hyzer Buzzz)" value={disc.customLabel || ''}
          onChange={e => set('customLabel', e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm" />
        <input placeholder="Manufacturer" value={disc.manufacturer || ''}
          onChange={e => set('manufacturer', e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm" />
        <input placeholder="Plastic (e.g. Champion, Z, ESP)" value={disc.plastic || ''}
          onChange={e => set('plastic', e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm" />
      </div>

      {/* Type */}
      <div>
        <label className="text-xs text-broadcast-cyan block mb-1">DISC TYPE</label>
        <div className="flex flex-wrap gap-2">
          {DISC_TYPES.map(t => (
            <button key={t} onClick={() => set('type', t)}
              className={`px-3 py-1 rounded text-xs font-bold border ${disc.type === t ? 'bg-broadcast-yellow text-black border-broadcast-yellow' : 'bg-gray-800 text-gray-300 border-gray-600'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Flight numbers */}
      <div>
        <label className="text-xs text-broadcast-cyan block mb-2">FLIGHT NUMBERS</label>
        <div className="flex gap-3 justify-between">
          {numField('Speed', 'speed', 1, 15)}
          {numField('Glide', 'glide', 1, 7)}
          {numField('Turn', 'turn', -5, 1)}
          {numField('Fade', 'fade', 0, 5)}
        </div>
        <div className="mt-2 text-xs text-center">
          <span className="text-gray-400">Stability: </span>
          <span className={`font-bold ${disc.stability === 'Overstable' ? 'text-red-400' : disc.stability === 'Understable' ? 'text-broadcast-cyan' : 'text-broadcast-yellow'}`}>
            {disc.stability}
          </span>
        </div>
      </div>

      {/* Weight + purchase date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-broadcast-cyan block mb-1">WEIGHT (g)</label>
          <input type="number" min={100} max={200} value={disc.weight || ''}
            onChange={e => set('weight', Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm" />
        </div>
        <div>
          <label className="text-xs text-broadcast-cyan block mb-1">PURCHASE DATE</label>
          <input type="date" value={disc.purchaseDate || ''}
            onChange={e => set('purchaseDate', e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white text-sm" />
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="text-xs text-broadcast-cyan block mb-1">DISC COLOR</label>
        <div className="flex items-center gap-3">
          <input type="color" value={disc.color || '#ffeb3b'}
            onChange={e => set('color', e.target.value)}
            className="w-12 h-12 rounded cursor-pointer border-0 bg-transparent" />
          <span className="text-sm text-gray-300">{disc.color}</span>
        </div>
      </div>

      {/* Photos */}
      <div>
        <label className="text-xs text-broadcast-cyan block mb-2">PHOTOS</label>
        <div className="flex gap-2 flex-wrap mb-2">
          {(disc.photos || []).map((src, i) => (
            <div key={i} className="relative">
              <img src={src} alt="" className="w-20 h-20 object-cover rounded border border-gray-600" />
              <button onClick={() => removePhoto(i)}
                className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">×</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="file" accept="image/*" ref={fileRef} className="hidden" onChange={handlePhoto} />
          <input type="file" accept="image/*" capture="environment" ref={cameraRef} className="hidden" onChange={handlePhoto} />
          <button onClick={() => fileRef.current?.click()}
            className="flex-1 py-2 bg-gray-800 border border-gray-600 rounded text-xs text-gray-300">
            📁 Photo Library
          </button>
          <button onClick={() => cameraRef.current?.click()}
            className="flex-1 py-2 bg-gray-800 border border-gray-600 rounded text-xs text-gray-300">
            📷 Camera
          </button>
        </div>
      </div>

      {/* Gap suggestions */}
      {!isNew && (() => {
        const gaps = analyzeGap(bag, disc)
        return gaps.length > 0 ? (
          <div className="broadcast-card p-3 border-l-4 border-broadcast-cyan space-y-1">
            <div className="text-xs font-bold text-broadcast-cyan">BAG GAP ANALYSIS</div>
            {gaps.map((g, i) => <div key={i} className="text-xs text-gray-300">• {g}</div>)}
          </div>
        ) : null
      })()}

      {/* Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-broadcast-black border-t border-gray-700 flex gap-3 z-50">
        {!isNew && (
          <button onClick={() => onDelete(disc.id)}
            className="px-4 py-3 bg-red-900 border border-red-600 rounded text-red-300 text-sm font-bold">
            DELETE
          </button>
        )}
        <button onClick={() => onSave(disc)}
          className="flex-1 py-3 bg-broadcast-yellow text-black font-black rounded text-sm font-saira">
          {isNew ? 'ADD TO BAG' : 'SAVE CHANGES'}
        </button>
      </div>
    </div>
  )
}

// ─── Main BagTab ──────────────────────────────────────────────────────────────
export default function BagTab() {
  const [bag, setBag] = useState([])
  const [view, setView] = useState('bag') // 'bag' | 'edit' | 'add' | 'throws'
  const [selectedDisc, setSelectedDisc] = useState(null)
  const [typeFilter, setTypeFilter] = useState('All')

  useEffect(() => { setBag(loadBag()) }, [])

  const save = (updated) => { setBag(updated); saveBag(updated) }

  const handleSave = (disc) => {
    if (view === 'add') {
      const newDisc = { ...disc, id: nextDiscId(bag) }
      save([...bag, newDisc])
    } else {
      save(bag.map(d => d.id === disc.id ? disc : d))
    }
    setView('bag')
    setSelectedDisc(null)
  }

  const handleDelete = (id) => {
    if (!confirm('Remove this disc from your bag?')) return
    save(bag.filter(d => d.id !== id))
    setView('bag')
    setSelectedDisc(null)
  }

  if (view === 'edit' && selectedDisc) {
    return <DiscEditor disc={selectedDisc} bag={bag}
      onSave={handleSave} onDelete={handleDelete}
      onCancel={() => { setView('bag'); setSelectedDisc(null) }} isNew={false} />
  }
  if (view === 'add') {
    return <DiscEditor disc={{ ...EMPTY_DISC }} bag={bag}
      onSave={handleSave} onDelete={() => {}}
      onCancel={() => setView('bag')} isNew={true} />
  }
  if (view === 'throws' && selectedDisc) {
    return <ThrowHistory disc={selectedDisc} onBack={() => { setView('bag'); setSelectedDisc(null) }} />
  }

  // ── Bag list view ──────────────────────────────────────────────────────────
  const allThrows = getThrows()
  const filtered = typeFilter === 'All' ? bag : bag.filter(d => d.type === typeFilter)

  const drivers = bag.filter(d => d.type === 'Distance Driver' || d.type === 'Fairway Driver')
  const midranges = bag.filter(d => d.type === 'Midrange')
  const putters = bag.filter(d => d.type === 'Putter')

  const throwsFor = (disc) => allThrows.filter(t => t.discId === disc.id || t.discName === disc.name)
  const avgDist = (disc) => {
    const dists = throwsFor(disc).map(t => t.distance).filter(Boolean)
    return dists.length ? Math.round(dists.reduce((a, b) => a + b, 0) / dists.length) : null
  }

  const DiscRow = ({ disc }) => {
    const throws = throwsFor(disc)
    const avg = avgDist(disc)
    return (
      <div className="broadcast-card p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-gray-600 flex-shrink-0"
          style={{ backgroundColor: disc.color }} />
        <div className="flex-1 min-w-0">
          <div className="font-black text-broadcast-yellow font-saira truncate">
            {disc.customLabel || disc.name}
          </div>
          {disc.customLabel && <div className="text-xs text-gray-400 truncate">{disc.name}</div>}
          <div className="text-xs text-broadcast-cyan">
            {disc.speed}/{disc.glide}/{disc.turn}/{disc.fade} · {disc.stability}
          </div>
          <div className="text-xs text-gray-500">{disc.plastic} · {disc.weight}g</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {avg && <div className="text-xs text-broadcast-yellow font-bold">{avg} ft avg</div>}
          {throws.length > 0 && (
            <button onClick={() => { setSelectedDisc(disc); setView('throws') }}
              className="text-xs text-broadcast-cyan underline">
              {throws.length} throw{throws.length !== 1 ? 's' : ''}
            </button>
          )}
          <button onClick={() => { setSelectedDisc(disc); setView('edit') }}
            className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">
            EDIT
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto pb-24">
      {/* Summary stats */}
      <div className="broadcast-card p-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-xl font-black text-broadcast-yellow font-saira">{bag.length}</div>
            <div className="text-xs text-broadcast-cyan">Total</div>
          </div>
          <div>
            <div className="text-xl font-black text-broadcast-yellow font-saira">{drivers.length}</div>
            <div className="text-xs text-broadcast-cyan">Drivers</div>
          </div>
          <div>
            <div className="text-xl font-black text-broadcast-yellow font-saira">{midranges.length}</div>
            <div className="text-xs text-broadcast-cyan">Mids</div>
          </div>
          <div>
            <div className="text-xl font-black text-broadcast-yellow font-saira">{putters.length}</div>
            <div className="text-xs text-broadcast-cyan">Putters</div>
          </div>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TYPE_FILTERS.map(f => (
          <button key={f} onClick={() => setTypeFilter(f)}
            className={`px-3 py-1 rounded text-xs font-bold border whitespace-nowrap flex-shrink-0 ${typeFilter === f ? 'bg-broadcast-yellow text-black border-broadcast-yellow' : 'bg-gray-800 text-gray-300 border-gray-600'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Disc list */}
      <div className="space-y-2">
        {filtered.map(disc => <DiscRow key={disc.id} disc={disc} />)}
        {filtered.length === 0 && (
          <div className="text-gray-500 text-sm text-center py-8">No discs in this category</div>
        )}
      </div>

      {/* Add disc button */}
      <button onClick={() => setView('add')}
        className="fixed bottom-20 right-4 bg-broadcast-yellow text-black font-black px-5 py-3 rounded-full shadow-lg font-saira text-sm z-40">
        + ADD DISC
      </button>
    </div>
  )
}
