'use client'
import { useState, useEffect, useRef } from 'react'
import { PERSONAS } from '../../utils/personas'
import { attemptBanter, updateDramaState, initialDramaState, getRivalryLabel, getRivalryColor } from '../../utils/dramaEngine'
import { saveThrow, saveRound } from '../../utils/storage'

// ─── Course par tables ────────────────────────────────────────────────────────
const PARS = {
  palmer:     [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
  kensington: [3,4,3,3,4,3,3,3,4,3,3,3,3,4,3,3,3,3],
}

function getCoursePars(course) {
  return PARS[course] || PARS.palmer
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

// ─── Score helpers ────────────────────────────────────────────────────────────
function scoreColor(strokes, par) {
  const d = strokes - par
  if (d <= -2) return { bg: '#ffd700', text: '#000' }
  if (d === -1) return { bg: '#ffeb3b', text: '#000' }
  if (d === 0)  return { bg: '#222', text: '#aaa' }
  if (d === 1)  return { bg: '#7f1d1d', text: '#fca5a5' }
  return { bg: '#450a0a', text: '#f87171' }
}

function scoreLabel(strokes, par) {
  const d = strokes - par
  if (d <= -2) return `${strokes}★`
  if (d === -1) return `${strokes}•`
  return `${strokes}`
}

function strokeLabel(d) {
  if (d <= -2) return 'EAGLE'
  if (d === -1) return 'BIRDIE'
  if (d === 0)  return 'PAR'
  if (d === 1)  return 'BOGEY'
  return `+${d}`
}

function parStr(val) {
  if (val === 0) return 'E'
  return val > 0 ? `+${val}` : `${val}`
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

// ─── Persona card ─────────────────────────────────────────────────────────────
function PersonaCard({ persona, selected, onSelect }) {
  return (
    <button onClick={() => onSelect(persona)}
      className={`p-2 rounded border text-left transition-all ${
        selected ? 'border-broadcast-yellow bg-yellow-950' : 'border-gray-700 bg-broadcast-black hover:border-gray-500'
      }`}>
      <div className="flex items-start gap-1.5">
        <span className="text-xl leading-none">{persona.avatar}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-black text-white font-saira text-xs leading-tight truncate">{persona.name}</span>
            <TierBadge tier={persona.tier} />
          </div>
          <div className="text-[9px] text-gray-500 leading-snug mt-0.5 line-clamp-2">{persona.traits}</div>
          <div className="text-[9px] font-bold mt-0.5"
            style={{ color: persona.difficulty >= 91 ? '#ffeb3b' : persona.difficulty >= 71 ? '#00d4ff' : '#888' }}>
            {persona.difficulty}
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Banter bubble ────────────────────────────────────────────────────────────
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

// ─── Scorecard ────────────────────────────────────────────────────────────────
function ScoreBoard({ scores, pars, playerName, opponents }) {
  const playerTotal = scores.player.reduce((a, b) => a + b, 0)
  const playerPar = scores.player.reduce((a, s, i) => a + (s - pars[i]), 0)

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-center text-[10px] border-collapse min-w-max">
        <thead>
          <tr>
            <th className="text-left text-gray-500 px-2 py-1 sticky left-0 bg-broadcast-black z-10 text-[9px]">HOLE</th>
            {pars.map((_, i) => <th key={i} className="w-6 text-gray-600 font-normal">{i + 1}</th>)}
            <th className="text-gray-500 px-1.5 text-[9px]">TOT</th>
            <th className="text-gray-500 px-1.5 text-[9px]">+/-</th>
          </tr>
          <tr>
            <th className="text-left text-gray-600 px-2 sticky left-0 bg-broadcast-black z-10 text-[9px]">PAR</th>
            {pars.map((p, i) => <td key={i} className="text-gray-700">{p}</td>)}
            <td className="text-gray-600">{pars.reduce((a, b) => a + b, 0)}</td>
            <td />
          </tr>
        </thead>
        <tbody>
          {/* Player */}
          <tr className="border-t border-gray-800">
            <td className="text-left px-2 py-1 font-black text-broadcast-yellow font-saira sticky left-0 bg-broadcast-black z-10 text-[10px] max-w-[60px] truncate">
              {(playerName || 'YOU').slice(0, 8)}
            </td>
            {pars.map((par, i) => {
              const s = scores.player[i]
              if (s === undefined) return <td key={i} className="text-gray-800">·</td>
              const c = scoreColor(s, par)
              return (
                <td key={i}>
                  <span className="inline-block w-5 h-4 leading-4 text-[9px] font-bold rounded"
                    style={{ backgroundColor: c.bg, color: c.text }}>{scoreLabel(s, par)}</span>
                </td>
              )
            })}
            <td className="font-black text-broadcast-yellow px-1">{scores.player.length ? playerTotal : '—'}</td>
            <td className="font-black px-1" style={{ color: playerPar < 0 ? '#ffeb3b' : playerPar > 0 ? '#ff4444' : '#aaa' }}>
              {scores.player.length ? parStr(playerPar) : '—'}
            </td>
          </tr>
          {/* Opponents */}
          {opponents.map((opp, oi) => {
            const os = scores.opponents[oi] || []
            const ot = os.reduce((a, b) => a + b, 0)
            const op = os.reduce((a, s, i) => a + (s - pars[i]), 0)
            return (
              <tr key={opp.id} className="border-t border-gray-800">
                <td className="text-left px-2 py-1 font-black text-broadcast-cyan font-saira sticky left-0 bg-broadcast-black z-10 text-[10px] max-w-[60px] truncate">
                  {opp.name.slice(0, 8)}
                </td>
                {pars.map((par, i) => {
                  const s = os[i]
                  if (s === undefined) return <td key={i} className="text-gray-800">·</td>
                  const c = scoreColor(s, par)
                  return (
                    <td key={i}>
                      <span className="inline-block w-5 h-4 leading-4 text-[9px] font-bold rounded"
                        style={{ backgroundColor: c.bg, color: c.text }}>{scoreLabel(s, par)}</span>
                    </td>
                  )
                })}
                <td className="font-black text-broadcast-cyan px-1">{os.length ? ot : '—'}</td>
                <td className="font-black px-1" style={{ color: op < 0 ? '#ffeb3b' : op > 0 ? '#ff4444' : '#aaa' }}>
                  {os.length ? parStr(op) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Setup screen ─────────────────────────────────────────────────────────────
function SetupScreen({ onStart, selectedCourse }) {
  const [mode, setMode] = useState('vs')
  const [tierFilter, setTierFilter] = useState(null)
  const [opponents, setOpponents] = useState([])
  const maxSlots = mode === 'doubles' ? 3 : 1
  const filtered = tierFilter ? PERSONAS.filter(p => p.tier === tierFilter) : PERSONAS

  const toggle = (persona) => {
    setOpponents(prev => {
      if (prev.find(p => p.id === persona.id)) return prev.filter(p => p.id !== persona.id)
      if (prev.length >= maxSlots) return [...prev.slice(1), persona]
      return [...prev, persona]
    })
  }

  const courseName = selectedCourse === 'kensington' ? 'Kensington' : 'Palmer Park'

  return (
    <div className="p-4 space-y-4 pb-6">
      <div className="broadcast-card p-4">
        <div className="font-black text-broadcast-yellow font-saira text-xl mb-0.5">VS MODE</div>
        <div className="text-xs text-gray-400">
          Playing <span className="text-broadcast-cyan">{courseName}</span>. Pick your opponent — they'll talk back.
        </div>
      </div>

      <div className="broadcast-card p-3">
        <div className="text-xs text-broadcast-cyan mb-2">GAME MODE</div>
        <div className="grid grid-cols-2 gap-2">
          {[{ id: 'vs', label: 'VS AI', desc: '1v1 rivalry' }, { id: 'doubles', label: 'DOUBLES', desc: 'You + AI vs 2 AI' }].map(m => (
            <button key={m.id} onClick={() => { setMode(m.id); setOpponents([]) }}
              className={`py-2 px-3 rounded font-saira font-black text-xs transition-all ${
                mode === m.id ? 'bg-broadcast-yellow text-broadcast-black' : 'bg-broadcast-black border border-broadcast-yellow text-broadcast-yellow'
              }`}>
              <div>{m.label}</div>
              <div className="text-[9px] font-normal opacity-70">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="broadcast-card p-3">
        <div className="text-xs text-broadcast-cyan mb-2">FILTER BY TIER</div>
        <div className="flex gap-2 flex-wrap">
          {[null, 4, 3, 2, 1].map(t => (
            <button key={t ?? 'all'} onClick={() => setTierFilter(t)}
              className={`px-2 py-1 rounded text-[10px] font-bold font-saira transition-all ${
                tierFilter === t ? 'bg-broadcast-yellow text-broadcast-black' : 'bg-broadcast-black border border-gray-600 text-gray-400'
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
            <span className="text-broadcast-yellow ml-2">{opponents.map(p => p.name).join(' + ')}</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {filtered.map(p => (
            <PersonaCard key={p.id} persona={p} selected={opponents.some(o => o.id === p.id)} onSelect={toggle} />
          ))}
        </div>
      </div>

      <button
        onClick={() => opponents.length > 0 && onStart({ mode, opponents })}
        disabled={opponents.length === 0}
        className="w-full py-4 font-black font-saira text-lg rounded disabled:opacity-40 bg-broadcast-yellow text-broadcast-black">
        {opponents.length > 0
          ? `TEE IT UP vs ${opponents.map(p => p.name).join(' + ').toUpperCase()}`
          : 'SELECT AN OPPONENT FIRST'}
      </button>
    </div>
  )
}

// ─── End game confirm ─────────────────────────────────────────────────────────
function EndGameConfirm({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="broadcast-card p-5 mx-6 space-y-4 max-w-xs w-full">
        <div className="font-black text-broadcast-red font-saira text-lg">END ROUND?</div>
        <div className="text-sm text-gray-300">
          Your scores have been saved to the LOG. You can always start a new game.
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2 font-saira font-black text-sm rounded border border-gray-600 text-gray-400">
            KEEP PLAYING
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2 font-saira font-black text-sm rounded bg-broadcast-red text-white">
            END ROUND
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main VsTab ───────────────────────────────────────────────────────────────
export default function VsTab({
  selectedCourse, selectedHole, setSelectedHole,
  location, vsGame, setVsGame,
}) {
  // Transient UI state — fine to lose on tab switch
  const [playerStrokes, setPlayerStrokes] = useState(0)
  const [aiThinking, setAiThinking] = useState(false)
  const [holeResult, setHoleResult] = useState(null)
  const [banterLine, setBanterLine] = useState(null)
  const [showScorecard, setShowScorecard] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const banterTimerRef = useRef(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPlayerName(localStorage.getItem('dialed_player_name') || 'YOU')
    }
  }, [])

  // Derive game values from persistent vsGame prop
  const phase = vsGame?.phase || 'setup'
  const config = vsGame?.config || null
  const currentHole = vsGame?.currentHole || 1
  const scores = vsGame?.scores || { player: [], opponents: [] }
  const dramaState = vsGame?.dramaState || initialDramaState(1)

  const pars = getCoursePars(selectedCourse)
  const totalHoles = pars.length
  const currentPar = pars[currentHole - 1] || 3

  // Tee banter fires shortly after arriving at a new hole
  useEffect(() => {
    if (phase !== 'game' || !config) return
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

  // ── Start a new game ────────────────────────────────────────────────────────
  const startGame = ({ mode, opponents }) => {
    // Create a round in storage so LOG tab shows the game
    const courseName = selectedCourse === 'kensington' ? 'Kensington' : 'Palmer Park'
    const round = saveRound({
      course: courseName,
      vsMode: true,
      vsOpponents: opponents.map(o => o.name).join(', '),
    })

    setVsGame({
      phase: 'game',
      config: { mode, opponents },
      currentHole: 1,
      scores: { player: [], opponents: opponents.map(() => []) },
      dramaState: initialDramaState(1),
      roundId: round?.id || null,
      course: selectedCourse,
    })
    setBanterLine(null)
    setHoleResult(null)
    setPlayerStrokes(0)
    if (setSelectedHole) setSelectedHole(1)
  }

  // ── Log a hole ──────────────────────────────────────────────────────────────
  const logHole = () => {
    if (playerStrokes < 1 || !vsGame) return
    setAiThinking(true)
    setBanterLine(null)

    const oppStrokes = config.opponents.map(opp => simulateAIStrokes(currentPar, opp.difficulty))
    const playerS = playerStrokes

    setTimeout(() => {
      const newPlayerScores = [...scores.player, playerS]
      const newOppScores = config.opponents.map((_, i) => [...(scores.opponents[i] || []), oppStrokes[i]])
      const newScores = { player: newPlayerScores, opponents: newOppScores }

      const mainOpp = config.opponents[0]
      const mainOppS = oppStrokes[0]

      // Running gap: positive = player losing strokes vs opponent
      const runningGap = newPlayerScores.reduce((a,b)=>a+b,0) - newOppScores[0].reduce((a,b)=>a+b,0)

      const newDrama = updateDramaState(dramaState, {
        playerStrokes: playerS, aiStrokes: mainOppS, par: currentPar,
      })
      const fullDrama = { ...newDrama, gap: runningGap, currentHole }

      // Record player's hole to storage (real data alongside the game)
      saveThrow({
        hole: currentHole,
        strokes: playerS,
        discName: 'VS Game',
        discId: 'vs',
        throwType: 'vs',
        windCondition: 'unknown',
        course: selectedCourse,
        lat: location?.lat || null,
        lon: location?.lon || null,
        vsMode: true,
        vsOpponent: mainOpp.name,
        vsOpponentStrokes: mainOppS,
        vsPar: currentPar,
        roundId: vsGame.roundId,
        date: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      })

      // Also record AI throw for stats
      oppStrokes.forEach((s, i) => {
        saveThrow({
          hole: currentHole,
          strokes: s,
          discName: `${config.opponents[i].name} (AI)`,
          discId: 'ai',
          throwType: 'vs_ai',
          windCondition: 'unknown',
          course: selectedCourse,
          lat: location?.lat || null,
          lon: location?.lon || null,
          vsMode: true,
          vsAI: true,
          vsPar: currentPar,
          roundId: vsGame.roundId,
          date: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        })
      })

      // Banter after result
      const aiEvent  = mainOppS  <= currentPar - 1 ? 'myBirdie'  : mainOppS  >= currentPar + 1 ? 'myBogey'  : null
      const youEvent = playerS   <= currentPar - 1 ? 'yourBirdie': playerS   >= currentPar + 1 ? 'yourBogey': null
      const eventToUse = aiEvent || youEvent
      if (eventToUse) {
        const line = attemptBanter(mainOpp, fullDrama, eventToUse)
        if (line) setBanterLine({ persona: mainOpp, line })
      }

      // Show hole result card
      setHoleResult({
        hole: currentHole,
        par: currentPar,
        playerStrokes: playerS,
        playerVsPar: playerS - currentPar,
        allOppStrokes: oppStrokes,
        opponents: config.opponents,
      })

      // Update persistent game state
      const isLast = currentHole >= totalHoles
      setVsGame(prev => ({
        ...prev,
        scores: newScores,
        dramaState: fullDrama,
        phase: isLast ? 'over' : 'game',
      }))

      setAiThinking(false)
    }, 1600)
  }

  // ── Advance to next hole ────────────────────────────────────────────────────
  const nextHole = () => {
    const next = currentHole + 1
    setHoleResult(null)
    setPlayerStrokes(0)
    setBanterLine(null)

    if (next > totalHoles) {
      setVsGame(prev => ({ ...prev, phase: 'over' }))
    } else {
      setVsGame(prev => ({ ...prev, currentHole: next }))
      if (setSelectedHole) setSelectedHole(next)
    }
  }

  // ── End game early ──────────────────────────────────────────────────────────
  const endGame = () => {
    setVsGame(null)
    setHoleResult(null)
    setBanterLine(null)
    setPlayerStrokes(0)
    setShowEndConfirm(false)
  }

  // ── Play again ──────────────────────────────────────────────────────────────
  const playAgain = () => {
    setVsGame(null)
    setHoleResult(null)
    setBanterLine(null)
    setPlayerStrokes(0)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: SETUP
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return <SetupScreen onStart={startGame} selectedCourse={selectedCourse} />
  }

  const mainOpp = config.opponents[0]
  const pStr = scores.player.reduce((a, b) => a + b, 0)
  const oStr = (scores.opponents[0] || []).reduce((a, b) => a + b, 0)
  const gap  = pStr - oStr  // negative = player leading in raw strokes
  const playerParRun = scores.player.reduce((a, s, i) => a + (s - pars[i]), 0)
  const oppParRun    = (scores.opponents[0] || []).reduce((a, s, i) => a + (s - pars[i]), 0)

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: GAME OVER
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'over') {
    const won = pStr <= oStr
    const finalPlayerPar = scores.player.reduce((a, s, i) => a + (s - pars[i]), 0)
    const finalOppPar    = (scores.opponents[0] || []).reduce((a, s, i) => a + (s - pars[i]), 0)

    return (
      <div className="p-4 space-y-4 pb-6">
        <div className="broadcast-card p-5 text-center">
          <div className="text-5xl mb-2">{won ? '🏆' : mainOpp.avatar}</div>
          <div className={`font-black font-saira text-2xl ${won ? 'text-broadcast-yellow' : 'text-broadcast-red'}`}>
            {won ? 'YOU WIN' : `${mainOpp.name.toUpperCase()} WINS`}
          </div>
          <div className="text-broadcast-cyan text-sm mt-1">Round saved to your LOG.</div>
          <div className="mt-4 flex justify-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-black font-saira" style={{ color: finalPlayerPar <= 0 ? '#ffeb3b' : '#ff4444' }}>
                {parStr(finalPlayerPar)}
              </div>
              <div className="text-xs text-broadcast-cyan">{playerName}</div>
            </div>
            <div className="text-gray-600 text-2xl self-center">vs</div>
            <div className="text-center">
              <div className="text-2xl font-black font-saira" style={{ color: finalOppPar <= 0 ? '#ffeb3b' : '#ff4444' }}>
                {parStr(finalOppPar)}
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
          <button onClick={playAgain}
            className="py-3 font-saira font-black text-sm rounded border-2 border-broadcast-yellow text-broadcast-yellow">
            NEW RIVAL
          </button>
          <button onClick={playAgain}
            className="py-3 font-saira font-black text-sm rounded bg-broadcast-yellow text-broadcast-black">
            PLAY AGAIN
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: ACTIVE GAME
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-4 pb-6">
      {showEndConfirm && (
        <EndGameConfirm onConfirm={endGame} onCancel={() => setShowEndConfirm(false)} />
      )}

      {/* Header — hole + score + rival */}
      <div className="broadcast-card p-3">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-xs text-gray-500">HOLE</div>
            <div className="text-3xl font-black text-broadcast-yellow font-saira leading-none">{currentHole}</div>
            <div className="text-xs text-gray-500">PAR {currentPar}</div>
          </div>

          <div className="text-center">
            <div className="text-xs font-black font-saira" style={{ color: getRivalryColor(gap) }}>
              {getRivalryLabel(gap)}
            </div>
            <div className="text-lg font-black font-saira text-white mt-0.5">
              {gap === 0 ? 'TIED' : gap < 0 ? `YOU +${Math.abs(gap)}` : `${mainOpp.name.toUpperCase()} +${gap}`}
            </div>
            <div className="text-[10px] text-gray-500">
              {playerName}: {parStr(playerParRun)} · {mainOpp.name}: {parStr(oppParRun)}
            </div>
          </div>

          <div className="text-right">
            <div className="text-3xl leading-none">{mainOpp.avatar}</div>
            <div className="text-xs text-broadcast-cyan font-saira font-black">{mainOpp.name}</div>
            <TierBadge tier={mainOpp.tier} />
          </div>
        </div>

        {/* Course + GPS status */}
        <div className="mt-2 pt-2 border-t border-gray-800 flex justify-between text-[10px]">
          <span className="text-broadcast-cyan">
            {selectedCourse === 'kensington' ? 'KENSINGTON' : 'PALMER PARK'}
          </span>
          <span className={location ? 'text-green-500' : 'text-gray-600'}>
            {location ? `📍 GPS ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` : '📍 No GPS'}
          </span>
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

      {/* Banter */}
      {banterLine && (
        <div className="broadcast-card p-3">
          <BanterBubble persona={banterLine.persona} line={banterLine.line} />
        </div>
      )}

      {/* Hole result */}
      {holeResult && (
        <div className="broadcast-card p-4">
          <div className="text-xs text-broadcast-cyan mb-3 font-saira font-bold">HOLE {holeResult.hole} RESULT</div>
          <div className="flex gap-4 justify-around">
            {/* Player */}
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1 font-saira">{playerName}</div>
              {(() => {
                const d = holeResult.playerVsPar
                const col = d <= -2 ? '#ffd700' : d === -1 ? '#ffeb3b' : d === 0 ? '#aaa' : '#ff4444'
                return (
                  <>
                    <div className="text-4xl font-black font-saira" style={{ color: col }}>{holeResult.playerStrokes}</div>
                    <div className="text-xs font-bold" style={{ color: col }}>{strokeLabel(d)}</div>
                  </>
                )
              })()}
            </div>
            <div className="text-gray-600 text-2xl font-black self-center">vs</div>
            {/* Opponents */}
            {holeResult.opponents.map((opp, i) => {
              const s = holeResult.allOppStrokes[i]
              const d = s - holeResult.par
              const col = d <= -2 ? '#ffd700' : d === -1 ? '#ffeb3b' : d === 0 ? '#aaa' : '#ff4444'
              return (
                <div key={opp.id} className="text-center">
                  <div className="text-xs text-gray-400 mb-1 font-saira">{opp.name}</div>
                  <div className="text-4xl font-black font-saira" style={{ color: col }}>{s}</div>
                  <div className="text-xs font-bold" style={{ color: col }}>{strokeLabel(d)}</div>
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

      {/* Stroke input — hidden while waiting for AI or viewing hole result */}
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
            const col = d <= -2 ? '#ffd700' : d === -1 ? '#ffeb3b' : d === 0 ? '#aaa' : '#ff4444'
            return (
              <div className="text-center text-xs text-gray-400">
                {playerStrokes} stroke{playerStrokes > 1 ? 's' : ''} ·{' '}
                <span style={{ color: col }} className="font-bold">{strokeLabel(d)}</span>
              </div>
            )
          })()}
          <button onClick={logHole} disabled={playerStrokes < 1 || aiThinking}
            className="w-full py-4 font-black font-saira text-base rounded disabled:opacity-40 bg-broadcast-yellow text-broadcast-black transition-all">
            {aiThinking ? `${mainOpp.name.toUpperCase()} IS THROWING...` : 'LOG HOLE'}
          </button>
        </div>
      )}

      {/* End game — always visible during active game */}
      <button onClick={() => setShowEndConfirm(true)}
        className="w-full py-2.5 text-xs text-broadcast-red font-saira font-bold border border-broadcast-red rounded hover:bg-red-950 transition-colors">
        END ROUND EARLY
      </button>
    </div>
  )
}
