'use client'
import { useState, useEffect, useRef } from 'react'
import { PERSONAS, PERSONAS_BY_TIER, getPersona } from '../../utils/personas'
import { attemptBanter, updateDramaState, initialDramaState, getRivalryLabel, getRivalryColor } from '../../utils/dramaEngine'

// ─── Hole par data ─────────────────────────────────────────────────────────────
const PALMER_PARS  = [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3]
const KENSINGTON_PARS = [3,4,3,3,4,3,3,3,4,3,3,3,3,4,3,3,3,3]

function getHolePars(course) {
  return course === 'kensington' ? KENSINGTON_PARS : PALMER_PARS
}

// ─── AI stroke simulator ───────────────────────────────────────────────────────
function simulateAIStrokes(par, difficulty) {
  const r = Math.random()
  if (difficulty >= 91) {
    if (r < 0.05) return par - 2
    if (r < 0.32) return par - 1
    if (r < 0.87) return par
    return par + 1
  }
  if (difficulty >= 71) {
    if (r < 0.02) return par - 2
    if (r < 0.20) return par - 1
    if (r < 0.72) return par
    if (r < 0.93) return par + 1
    return par + 2
  }
  if (difficulty >= 41) {
    if (r < 0.06) return par - 1
    if (r < 0.42) return par
    if (r < 0.74) return par + 1
    if (r < 0.91) return par + 2
    return par + 3
  }
  if (r < 0.02) return par - 1
  if (r < 0.20) return par
  if (r < 0.46) return par + 1
  if (r < 0.68) return par + 2
  if (r < 0.84) return par + 3
  return par + 4
}

// ─── Score cell coloring ──────────────────────────────────────────────────────
function scoreColor(strokes, par) {
  const diff = strokes - par
  if (diff <= -2) return { bg: '#ffd700', text: '#000' }
  if (diff === -1) return { bg: '#ffeb3b', text: '#000' }
  if (diff === 0)  return { bg: '#222', text: '#aaa' }
  if (diff === 1)  return { bg: '#7f1d1d', text: '#fca5a5' }
  return { bg: '#450a0a', text: '#f87171' }
}

function scoreLabel(strokes, par) {
  const d = strokes - par
  if (d <= -2) return `${strokes}★`
  if (d === -1) return `${strokes}•`
  return `${strokes}`
}

// ─── Tier badge ──────────────────────────────────────────────────────────────
function TierBadge({ tier }) {
  const cfg = {
    4: { label: 'ELITE',    color: '#ffeb3b', bg: '#3d3000' },
    3: { label: 'ADV',      color: '#00d4ff', bg: '#002d35' },
    2: { label: 'CASUAL',   color: '#aaa',    bg: '#222' },
    1: { label: 'BEGINNER', color: '#888',    bg: '#1a1a1a' },
  }[tier] || { label: '?', color: '#aaa', bg: '#222' }
  return (
    <span className="text-[8px] font-black font-saira rounded px-1 py-0.5"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}>
      {cfg.label}
    </span>
  )
}

// ─── Persona Card ─────────────────────────────────────────────────────────────
function PersonaCard({ persona, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(persona)}
      className={`p-2 rounded border text-left transition-all ${
        selected
          ? 'border-broadcast-yellow bg-yellow-950'
          : 'border-gray-700 bg-broadcast-black hover:border-gray-500'
      }`}
    >
      <div className="flex items-start gap-1.5">
        <span className="text-xl leading-none">{persona.avatar}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-black text-white font-saira text-xs leading-tight truncate">
              {persona.name}
            </span>
            <TierBadge tier={persona.tier} />
          </div>
          <div className="text-[9px] text-gray-500 leading-snug mt-0.5 line-clamp-2">
            {persona.traits}
          </div>
          <div className="text-[9px] font-bold mt-0.5"
            style={{ color: persona.difficulty >= 91 ? '#ffeb3b' : persona.difficulty >= 71 ? '#00d4ff' : '#888' }}>
            {persona.difficulty}
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Banter Bubble ───────────────────────────────────────────────────────────
function BanterBubble({ persona, line }) {
  if (!line || !persona) return null
  return (
    <div className="flex items-start gap-2">
      <span className="text-2xl flex-shrink-0 mt-0.5">{persona.avatar}</span>
      <div className="rounded-xl px-3 py-2 max-w-[85%] bg-gray-800 text-white rounded-tl-none">
        <div className="text-[10px] font-bold text-gray-400 mb-0.5">{persona.name}</div>
        <div className="text-sm leading-snug italic">"{line}"</div>
      </div>
    </div>
  )
}

// ─── Scoreboard ───────────────────────────────────────────────────────────────
function ScoreBoard({ scores, pars, playerName, opponents }) {
  const playerTotal = scores.player.reduce((a, b) => a + b, 0)
  const playerPar = scores.player.reduce((a, s, i) => a + (s - pars[i]), 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center text-[10px] border-collapse min-w-max">
        <thead>
          <tr>
            <th className="text-left text-gray-500 px-2 py-1 sticky left-0 bg-broadcast-black z-10">HOLE</th>
            {pars.map((_, i) => (
              <th key={i} className="w-7 text-gray-500 font-normal">{i + 1}</th>
            ))}
            <th className="text-gray-500 px-2">TOT</th>
            <th className="text-gray-500 px-2">+/-</th>
          </tr>
          <tr>
            <th className="text-left text-gray-500 px-2 sticky left-0 bg-broadcast-black z-10">PAR</th>
            {pars.map((p, i) => <td key={i} className="text-gray-600">{p}</td>)}
            <td className="text-gray-600">{pars.reduce((a, b) => a + b, 0)}</td>
            <td></td>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-gray-800">
            <td className="text-left px-2 py-1 font-black text-broadcast-yellow font-saira sticky left-0 bg-broadcast-black z-10 text-xs">
              {playerName || 'YOU'}
            </td>
            {pars.map((par, i) => {
              const s = scores.player[i]
              if (s === undefined) return <td key={i} className="text-gray-700">·</td>
              const c = scoreColor(s, par)
              return (
                <td key={i}>
                  <span className="inline-block w-6 h-5 leading-5 text-[9px] font-bold rounded"
                    style={{ backgroundColor: c.bg, color: c.text }}>
                    {scoreLabel(s, par)}
                  </span>
                </td>
              )
            })}
            <td className="font-black text-broadcast-yellow">{scores.player.length ? playerTotal : '—'}</td>
            <td className="font-black" style={{ color: playerPar > 0 ? '#ff4444' : playerPar < 0 ? '#ffeb3b' : '#aaa' }}>
              {scores.player.length ? (playerPar === 0 ? 'E' : playerPar > 0 ? `+${playerPar}` : playerPar) : '—'}
            </td>
          </tr>
          {opponents.map((opp, oi) => {
            const oppScores = scores.opponents[oi] || []
            const oppTotal = oppScores.reduce((a, b) => a + b, 0)
            const oppPar = oppScores.reduce((a, s, i) => a + (s - pars[i]), 0)
            return (
              <tr key={opp.id} className="border-t border-gray-800">
                <td className="text-left px-2 py-1 font-black text-broadcast-cyan font-saira sticky left-0 bg-broadcast-black z-10 text-xs">
                  {opp.name}
                </td>
                {pars.map((par, i) => {
                  const s = oppScores[i]
                  if (s === undefined) return <td key={i} className="text-gray-700">·</td>
                  const c = scoreColor(s, par)
                  return (
                    <td key={i}>
                      <span className="inline-block w-6 h-5 leading-5 text-[9px] font-bold rounded"
                        style={{ backgroundColor: c.bg, color: c.text }}>
                        {scoreLabel(s, par)}
                      </span>
                    </td>
                  )
                })}
                <td className="font-black text-broadcast-cyan">{oppScores.length ? oppTotal : '—'}</td>
                <td className="font-black" style={{ color: oppPar > 0 ? '#ff4444' : oppPar < 0 ? '#ffeb3b' : '#aaa' }}>
                  {oppScores.length ? (oppPar === 0 ? 'E' : oppPar > 0 ? `+${oppPar}` : oppPar) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────
function SetupScreen({ onStart }) {
  const [mode, setMode] = useState('vs')
  const [tierFilter, setTierFilter] = useState(null)
  const [opponents, setOpponents] = useState([])

  const filtered = tierFilter ? PERSONAS.filter(p => p.tier === tierFilter) : PERSONAS
  const maxSlots = mode === 'doubles' ? 3 : 1

  const toggleOpponent = (persona) => {
    setOpponents(prev => {
      const exists = prev.find(p => p.id === persona.id)
      if (exists) return prev.filter(p => p.id !== persona.id)
      if (prev.length >= maxSlots) return [...prev.slice(1), persona]
      return [...prev, persona]
    })
  }

  return (
    <div className="p-4 space-y-4 pb-6">
      <div className="broadcast-card p-4">
        <div className="font-black text-broadcast-yellow font-saira text-xl mb-0.5">VS MODE</div>
        <div className="text-xs text-gray-400">Pick your opponent. They'll talk back.</div>
      </div>

      <div className="broadcast-card p-3">
        <div className="text-xs text-broadcast-cyan mb-2">GAME MODE</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'vs', label: 'VS AI', desc: '1v1 rivalry' },
            { id: 'doubles', label: 'DOUBLES', desc: 'You + AI vs 2 AI' },
          ].map(m => (
            <button key={m.id} onClick={() => { setMode(m.id); setOpponents([]) }}
              className={`py-2 px-3 rounded font-saira font-black text-xs transition-all ${
                mode === m.id
                  ? 'bg-broadcast-yellow text-broadcast-black'
                  : 'bg-broadcast-black border border-broadcast-yellow text-broadcast-yellow'
              }`}>
              <div>{m.label}</div>
              <div className="text-[9px] font-normal opacity-70">{m.desc}</div>
            </button>
          ))}
        </div>
        {mode === 'doubles' && (
          <div className="mt-2 text-[10px] text-gray-500">
            Pick up to 3 opponents (2 AI vs you + 1 AI partner)
          </div>
        )}
      </div>

      <div className="broadcast-card p-3">
        <div className="text-xs text-broadcast-cyan mb-2">FILTER BY TIER</div>
        <div className="flex gap-2 flex-wrap">
          {[null, 4, 3, 2, 1].map(t => (
            <button key={t ?? 'all'} onClick={() => setTierFilter(t)}
              className={`px-2 py-1 rounded text-[10px] font-bold font-saira transition-all ${
                tierFilter === t
                  ? 'bg-broadcast-yellow text-broadcast-black'
                  : 'bg-broadcast-black border border-gray-600 text-gray-400'
              }`}>
              {t === null ? 'ALL' : t === 4 ? 'ELITE' : t === 3 ? 'ADVANCED' : t === 2 ? 'CASUAL' : 'BEGINNER'}
            </button>
          ))}
        </div>
      </div>

      <div className="broadcast-card p-3">
        <div className="text-xs text-broadcast-cyan mb-2">
          CHOOSE OPPONENT{mode === 'doubles' ? 'S' : ''}
          {opponents.length > 0 && (
            <span className="text-broadcast-yellow ml-2">
              {opponents.map(p => p.name).join(' + ')}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {filtered.map(persona => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              selected={opponents.some(p => p.id === persona.id)}
              onSelect={toggleOpponent}
            />
          ))}
        </div>
      </div>

      <button
        onClick={() => opponents.length > 0 && onStart({ mode, opponents })}
        disabled={opponents.length === 0}
        className="w-full py-4 font-black font-saira text-lg rounded transition-all disabled:opacity-40 bg-broadcast-yellow text-broadcast-black"
      >
        {opponents.length > 0
          ? `TEE IT UP vs ${opponents.map(p => p.name).join(' + ').toUpperCase()}`
          : 'SELECT AN OPPONENT FIRST'}
      </button>
    </div>
  )
}

// ─── Main VsTab ───────────────────────────────────────────────────────────────
export default function VsTab({ selectedCourse, selectedHole, setSelectedHole }) {
  const [phase, setPhase] = useState('setup')
  const [config, setConfig] = useState(null)
  const [currentHole, setCurrentHole] = useState(1)
  const [playerStrokes, setPlayerStrokes] = useState(0)
  const [scores, setScores] = useState({ player: [], opponents: [] })
  const [aiThinking, setAiThinking] = useState(false)
  const [holeResult, setHoleResult] = useState(null)
  const [banterLine, setBanterLine] = useState(null)
  const [dramaState, setDramaState] = useState(initialDramaState(1))
  const [playerName, setPlayerName] = useState('')
  const [showScorecard, setShowScorecard] = useState(false)
  const banterTimerRef = useRef(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPlayerName(localStorage.getItem('dialed_player_name') || 'YOU')
    }
  }, [])

  const pars = getHolePars(selectedCourse)
  const totalHoles = pars.length
  const currentPar = pars[currentHole - 1] || 3

  // Tee banter fires shortly after each new hole starts
  useEffect(() => {
    if (phase !== 'game' || !config || holeResult) return
    const mainOpp = config.opponents[0]
    if (!mainOpp) return
    clearTimeout(banterTimerRef.current)
    banterTimerRef.current = setTimeout(() => {
      const line = attemptBanter(mainOpp, dramaState, 'tee')
      if (line) setBanterLine({ persona: mainOpp, line })
    }, 900)
    return () => clearTimeout(banterTimerRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHole, phase])

  const startGame = (cfg) => {
    setConfig(cfg)
    setCurrentHole(1)
    setPlayerStrokes(0)
    setScores({ player: [], opponents: cfg.opponents.map(() => []) })
    setHoleResult(null)
    setBanterLine(null)
    setDramaState(initialDramaState(1))
    setPhase('game')
  }

  const logHole = () => {
    if (playerStrokes < 1) return
    setAiThinking(true)
    setBanterLine(null)

    const oppStrokes = config.opponents.map(opp => simulateAIStrokes(currentPar, opp.difficulty))
    const playerS = playerStrokes

    setTimeout(() => {
      const newPlayerScores = [...scores.player, playerS]
      const newOppScores = config.opponents.map((_, i) => [
        ...(scores.opponents[i] || []), oppStrokes[i],
      ])
      const newScores = { player: newPlayerScores, opponents: newOppScores }
      setScores(newScores)

      const mainOpp = config.opponents[0]
      const mainOppS = oppStrokes[0]

      // Running score gap (player - opponent; negative means player leading)
      const runningGap = newPlayerScores.reduce((a,b)=>a+b,0) - newOppScores[0].reduce((a,b)=>a+b,0)

      const newDrama = updateDramaState(dramaState, {
        playerStrokes: playerS, aiStrokes: mainOppS, par: currentPar,
      })
      const fullDrama = { ...newDrama, gap: runningGap, currentHole }
      setDramaState(fullDrama)

      // Fire post-hole banter based on result
      const aiEvent = mainOppS <= currentPar - 1 ? 'myBirdie'
        : mainOppS >= currentPar + 1 ? 'myBogey' : null
      const playerEvent = playerS <= currentPar - 1 ? 'yourBirdie'
        : playerS >= currentPar + 1 ? 'yourBogey' : null

      const eventToUse = aiEvent || playerEvent
      if (eventToUse) {
        const line = attemptBanter(mainOpp, fullDrama, eventToUse)
        if (line) setBanterLine({ persona: mainOpp, line })
      }

      setHoleResult({
        hole: currentHole,
        par: currentPar,
        playerStrokes: playerS,
        playerVsPar: playerS - currentPar,
        allOppStrokes: oppStrokes,
        opponents: config.opponents,
      })
      setAiThinking(false)
    }, 1600)
  }

  const nextHole = () => {
    setHoleResult(null)
    setPlayerStrokes(0)
    setBanterLine(null)
    const next = currentHole + 1
    if (next > totalHoles) {
      setPhase('over')
    } else {
      setCurrentHole(next)
      if (setSelectedHole) setSelectedHole(next)
    }
  }

  const resetGame = () => {
    setPhase('setup')
    setConfig(null)
    setHoleResult(null)
    setBanterLine(null)
    setPlayerStrokes(0)
  }

  // ── SETUP ──────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return <SetupScreen onStart={startGame} />
  }

  // ── GAME OVER ──────────────────────────────────────────────────────────────
  if (phase === 'over') {
    const playerTotal = scores.player.reduce((a, b) => a + b, 0)
    const playerParTotal = scores.player.reduce((a, s, i) => a + (s - pars[i]), 0)
    const mainOpp = config.opponents[0]
    const oppTotal = (scores.opponents[0] || []).reduce((a, b) => a + b, 0)
    const oppParTotal = (scores.opponents[0] || []).reduce((a, s, i) => a + (s - pars[i]), 0)
    const won = playerTotal <= oppTotal

    return (
      <div className="p-4 space-y-4 pb-6">
        <div className="broadcast-card p-5 text-center">
          <div className="text-5xl mb-2">{won ? '🏆' : mainOpp.avatar}</div>
          <div className={`font-black font-saira text-2xl ${won ? 'text-broadcast-yellow' : 'text-broadcast-red'}`}>
            {won ? 'YOU WIN' : `${mainOpp.name.toUpperCase()} WINS`}
          </div>
          <div className="text-broadcast-cyan text-sm mt-1">
            {won ? 'Well played.' : 'Better luck next round.'}
          </div>
          <div className="mt-4 flex justify-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-black font-saira" style={{ color: playerParTotal <= 0 ? '#ffeb3b' : '#ff4444' }}>
                {playerParTotal === 0 ? 'E' : playerParTotal > 0 ? `+${playerParTotal}` : playerParTotal}
              </div>
              <div className="text-xs text-broadcast-cyan">{playerName}</div>
            </div>
            <div className="text-gray-600 text-2xl self-center">vs</div>
            <div className="text-center">
              <div className="text-2xl font-black font-saira" style={{ color: oppParTotal <= 0 ? '#ffeb3b' : '#ff4444' }}>
                {oppParTotal === 0 ? 'E' : oppParTotal > 0 ? `+${oppParTotal}` : oppParTotal}
              </div>
              <div className="text-xs text-broadcast-cyan">{mainOpp.name}</div>
            </div>
          </div>
        </div>

        <div className="broadcast-card p-3">
          <div className="text-xs text-broadcast-cyan mb-2">FULL SCORECARD</div>
          <ScoreBoard scores={scores} pars={pars} playerName={playerName} opponents={config.opponents} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={resetGame}
            className="py-3 font-saira font-black text-sm rounded border-2 border-broadcast-yellow text-broadcast-yellow">
            PLAY AGAIN
          </button>
          <button onClick={resetGame}
            className="py-3 font-saira font-black text-sm rounded bg-broadcast-yellow text-broadcast-black">
            NEW RIVAL
          </button>
        </div>
      </div>
    )
  }

  // ── ACTIVE GAME ────────────────────────────────────────────────────────────
  const mainOpp = config.opponents[0]
  const playerRunning = scores.player.reduce((a, b) => a + b, 0)
  const oppRunning = (scores.opponents[0] || []).reduce((a, b) => a + b, 0)
  const gap = playerRunning - oppRunning  // negative = player leading

  const playerParRunning = scores.player.reduce((a, s, i) => a + (s - pars[i]), 0)
  const oppParRunning = (scores.opponents[0] || []).reduce((a, s, i) => a + (s - pars[i]), 0)

  return (
    <div className="p-4 space-y-4 pb-6">
      {/* Header */}
      <div className="broadcast-card p-3">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs text-gray-500">HOLE</div>
            <div className="text-3xl font-black text-broadcast-yellow font-saira leading-none">{currentHole}</div>
            <div className="text-xs text-gray-500">PAR {currentPar}</div>
          </div>
          <div className="text-center">
            <div className="text-xs font-black font-saira"
              style={{ color: getRivalryColor(gap) }}>
              {getRivalryLabel(gap)}
            </div>
            <div className="text-lg font-black font-saira text-white mt-0.5">
              {gap === 0 ? 'TIED'
                : gap < 0 ? `YOU +${Math.abs(gap)}`
                : `${mainOpp.name.toUpperCase()} +${gap}`}
            </div>
            <div className="text-[10px] text-gray-500">
              {playerName}: {playerParRunning === 0 ? 'E' : playerParRunning > 0 ? `+${playerParRunning}` : playerParRunning}
              {' · '}
              {mainOpp.name}: {oppParRunning === 0 ? 'E' : oppParRunning > 0 ? `+${oppParRunning}` : oppParRunning}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl leading-none">{mainOpp.avatar}</div>
            <div className="text-xs text-broadcast-cyan font-saira font-black">{mainOpp.name}</div>
            <TierBadge tier={mainOpp.tier} />
          </div>
        </div>
      </div>

      {/* Scorecard toggle */}
      <button onClick={() => setShowScorecard(s => !s)}
        className="w-full text-xs text-broadcast-cyan border border-gray-700 rounded py-1.5 font-saira font-bold">
        {showScorecard ? '▲ HIDE SCORECARD' : '▼ SCORECARD'}
      </button>
      {showScorecard && (
        <div className="broadcast-card p-3">
          <ScoreBoard scores={scores} pars={pars} playerName={playerName} opponents={config.opponents} />
        </div>
      )}

      {/* Banter bubble */}
      {banterLine && (
        <div className="broadcast-card p-3">
          <BanterBubble persona={banterLine.persona} line={banterLine.line} />
        </div>
      )}

      {/* Hole result */}
      {holeResult && (
        <div className="broadcast-card p-4">
          <div className="text-xs text-broadcast-cyan mb-3 font-saira font-bold">
            HOLE {holeResult.hole} RESULT
          </div>
          <div className="flex gap-4 justify-around">
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1 font-saira">{playerName}</div>
              {(() => {
                const d = holeResult.playerVsPar
                const colMap = { '-2': '#ffd700', '-1': '#ffeb3b', '0': '#aaa', '1': '#fca5a5' }
                const col = d <= -2 ? '#ffd700' : d === -1 ? '#ffeb3b' : d === 0 ? '#aaa' : '#ff4444'
                return (
                  <>
                    <div className="text-4xl font-black font-saira" style={{ color: col }}>
                      {holeResult.playerStrokes}
                    </div>
                    <div className="text-xs font-bold" style={{ color: col }}>
                      {d <= -2 ? 'EAGLE' : d === -1 ? 'BIRDIE' : d === 0 ? 'PAR' : d === 1 ? 'BOGEY' : `+${d}`}
                    </div>
                  </>
                )
              })()}
            </div>
            <div className="text-gray-600 text-2xl font-black self-center">vs</div>
            {holeResult.opponents.map((opp, i) => {
              const s = holeResult.allOppStrokes[i]
              const d = s - holeResult.par
              const col = d <= -2 ? '#ffd700' : d === -1 ? '#ffeb3b' : d === 0 ? '#aaa' : '#ff4444'
              return (
                <div key={opp.id} className="text-center">
                  <div className="text-xs text-gray-400 mb-1 font-saira">{opp.name}</div>
                  <div className="text-4xl font-black font-saira" style={{ color: col }}>{s}</div>
                  <div className="text-xs font-bold" style={{ color: col }}>
                    {d <= -2 ? 'EAGLE' : d === -1 ? 'BIRDIE' : d === 0 ? 'PAR' : d === 1 ? 'BOGEY' : `+${d}`}
                  </div>
                </div>
              )
            })}
          </div>
          <button onClick={nextHole}
            className="mt-4 w-full py-3 font-black font-saira text-sm rounded bg-broadcast-yellow text-broadcast-black">
            {currentHole >= totalHoles ? 'FINISH ROUND →' : `NEXT — HOLE ${currentHole + 1} →`}
          </button>
        </div>
      )}

      {/* Stroke input */}
      {!holeResult && (
        <div className="broadcast-card p-4 space-y-3">
          <div className="text-xs text-broadcast-cyan font-saira font-bold">
            YOUR STROKES — HOLE {currentHole} (PAR {currentPar})
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {[1,2,3,4,5,6,7].map(n => (
              <button key={n} onClick={() => setPlayerStrokes(n)}
                className={`py-3 rounded font-black font-saira text-lg transition-all ${
                  playerStrokes === n
                    ? 'bg-broadcast-yellow text-broadcast-black'
                    : 'bg-broadcast-black border border-gray-600 text-white'
                }`}>
                {n}
              </button>
            ))}
          </div>
          {playerStrokes > 0 && (() => {
            const d = playerStrokes - currentPar
            const label = d <= -2 ? 'EAGLE' : d === -1 ? 'BIRDIE' : d === 0 ? 'PAR' : d === 1 ? 'BOGEY' : `+${d}`
            const col = d <= -2 ? '#ffd700' : d === -1 ? '#ffeb3b' : d === 0 ? '#aaa' : '#ff4444'
            return (
              <div className="text-center text-xs text-gray-400">
                {playerStrokes} stroke{playerStrokes > 1 ? 's' : ''} ·{' '}
                <span style={{ color: col }} className="font-bold">{label}</span>
              </div>
            )
          })()}
          <button onClick={logHole} disabled={playerStrokes < 1 || aiThinking}
            className="w-full py-4 font-black font-saira text-base rounded disabled:opacity-40 bg-broadcast-yellow text-broadcast-black transition-all">
            {aiThinking
              ? `${mainOpp.name.toUpperCase()} IS THROWING...`
              : 'LOG HOLE'}
          </button>
        </div>
      )}

      <button onClick={resetGame}
        className="w-full py-2 text-xs text-gray-700 font-saira border border-gray-800 rounded">
        QUIT ROUND
      </button>
    </div>
  )
}
