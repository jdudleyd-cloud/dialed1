'use client'
import { useState, useEffect } from 'react'
import { loadBag } from '../../utils/discData'
import { saveThrow, saveRound } from '../../utils/storage'

const AI_NAMES = ['Crusher', 'Fairway Fred', 'Disc Wizard', 'Iron Eagle', 'Chain Rattler', 'Ace Hunter']

function randomAIName() { return AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)] }

function simulateAIThrow(holePar, holeDist, difficulty) {
  const r = Math.random()
  let strokes
  if (difficulty >= 80) {
    if      (r < 0.25) strokes = holePar - 1
    else if (r < 0.85) strokes = holePar
    else               strokes = holePar + 1
  } else if (difficulty >= 50) {
    if      (r < 0.08) strokes = holePar - 1
    else if (r < 0.55) strokes = holePar
    else if (r < 0.88) strokes = holePar + 1
    else               strokes = holePar + 2
  } else {
    if      (r < 0.03) strokes = holePar - 1
    else if (r < 0.28) strokes = holePar
    else if (r < 0.62) strokes = holePar + 1
    else if (r < 0.88) strokes = holePar + 2
    else               strokes = holePar + 3
  }
  const landPct = 0.5 + (difficulty / 100) * 0.5 + (Math.random() - 0.5) * 0.3
  return {
    strokes,
    distance: Math.round(holeDist * Math.min(landPct, 1.1)),
    label: strokes === holePar - 2 ? 'Eagle! 🦅' : strokes === holePar - 1 ? 'Birdie! 🐦' : strokes === holePar ? 'Par ✓' : `+${strokes - holePar} 😬`,
  }
}

function ScoreBoard({ scores, playerName, gameMode }) {
  const players = gameMode === 'doubles'
    ? [playerName, scores.aiPartner?.name, scores.ai1?.name, scores.ai2?.name].filter(Boolean)
    : [playerName, scores.ai?.name]

  const getTotalScore = (who) => {
    const arr = who === playerName ? scores.player : who === scores.ai?.name ? scores.ai?.holes :
      who === scores.aiPartner?.name ? scores.aiPartner?.holes : scores.ai2?.holes
    return arr ? arr.reduce((a, b) => a + b, 0) : 0
  }

  return (
    <div className="broadcast-card p-3">
      <div className="text-xs text-broadcast-cyan font-bold mb-2">SCORECARD</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <td className="text-gray-500 pr-2">Player</td>
              {(scores.player || []).map((_, i) => (
                <td key={i} className="text-center text-gray-500 w-6">H{i + 1}</td>
              ))}
              <td className="text-center text-broadcast-yellow font-bold pl-2">TOT</td>
            </tr>
          </thead>
          <tbody>
            {[
              { label: playerName, holes: scores.player },
              ...(gameMode === 'vs' ? [{ label: scores.ai?.name, holes: scores.ai?.holes }] : []),
              ...(gameMode === 'doubles' ? [
                { label: `${scores.aiPartner?.name} (partner)`, holes: scores.aiPartner?.holes },
                { label: scores.ai1?.name, holes: scores.ai1?.holes },
                { label: scores.ai2?.name, holes: scores.ai2?.holes },
              ] : []),
            ].map(({ label, holes }, pi) => (
              <tr key={pi}>
                <td className={`pr-2 font-bold ${pi === 0 ? 'text-broadcast-yellow' : 'text-gray-300'}`}>
                  {label}
                </td>
                {(holes || []).map((s, i) => (
                  <td key={i} className={`text-center w-6 rounded ${
                    s < (scores.pars?.[i] || 3) ? 'text-green-400' :
                    s > (scores.pars?.[i] || 3) ? 'text-broadcast-red' : 'text-white'
                  }`}>{s}</td>
                ))}
                <td className="text-center font-black text-broadcast-yellow pl-2">
                  {(holes || []).reduce((a, b) => a + b, 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function VsTab({ selectedCourse, selectedHole, setSelectedHole, holeDataMap }) {
  const [gameMode, setGameMode] = useState(null)   // null | 'vs' | 'doubles'
  const [difficulty, setDifficulty] = useState(50)
  const [gameActive, setGameActive] = useState(false)
  const [currentHole, setCurrentHole] = useState(1)
  const [playerTurn, setPlayerTurn] = useState(true)  // true = player, false = AI
  const [bag, setBag] = useState([])
  const [selectedDisc, setSelectedDisc] = useState(null)
  const [playerStrokes, setPlayerStrokes] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [scores, setScores] = useState(null)
  const [aiNames, setAiNames] = useState({})

  useEffect(() => { setBag(loadBag()) }, [])

  const holeData = holeDataMap?.[currentHole]
  const holePar  = holeData?.par || 3
  const holeDist = holeData?.distance_am || 300

  function startGame() {
    const ai1 = randomAIName()
    const names = gameMode === 'doubles'
      ? { ai: ai1, aiPartner: randomAIName(), ai2: randomAIName() }
      : { ai: ai1 }
    setAiNames(names)
    setScores({
      player: [], pars: [],
      ai: { name: names.ai, holes: [] },
      ...(gameMode === 'doubles' ? {
        aiPartner: { name: names.aiPartner, holes: [] },
        ai2: { name: names.ai2, holes: [] },
      } : {})
    })
    setCurrentHole(1)
    setPlayerTurn(true)
    setPlayerStrokes(null)
    setAiResult(null)
    setShowResult(false)
    setGameOver(false)
    setGameActive(true)
    if (setSelectedHole) setSelectedHole(1)
  }

  function logPlayerThrow() {
    if (!selectedDisc) return
    // For simplicity: count this as 1 stroke, player can input actual score
    const strokes = playerStrokes || 3
    const updScores = { ...scores }
    updScores.player = [...(updScores.player || []), strokes]
    updScores.pars   = [...(updScores.pars || []), holePar]
    setScores(updScores)
    setAiThinking(true)
    setPlayerTurn(false)

    // AI takes turn after short delay
    setTimeout(() => {
      const aiThrow = simulateAIThrow(holePar, holeDist, difficulty)
      const updScores2 = { ...updScores }
      updScores2.ai = { ...updScores2.ai, holes: [...(updScores2.ai?.holes || []), aiThrow.strokes] }
      if (gameMode === 'doubles') {
        const p = simulateAIThrow(holePar, holeDist, difficulty)
        const e = simulateAIThrow(holePar, holeDist, Math.max(0, difficulty - 20))
        updScores2.aiPartner = { ...updScores2.aiPartner, holes: [...(updScores2.aiPartner?.holes || []), p.strokes] }
        updScores2.ai2 = { ...updScores2.ai2, holes: [...(updScores2.ai2?.holes || []), e.strokes] }
      }
      setScores(updScores2)
      setAiResult(aiThrow)
      setAiThinking(false)
      setShowResult(true)
    }, 1500)
  }

  function nextHole() {
    if (currentHole >= 18) {
      setGameOver(true)
      return
    }
    const next = currentHole + 1
    setCurrentHole(next)
    if (setSelectedHole) setSelectedHole(next)
    setPlayerTurn(true)
    setPlayerStrokes(null)
    setAiResult(null)
    setShowResult(false)
  }

  const playerTotal = scores?.player?.reduce((a, b) => a + b, 0) || 0
  const aiTotal     = scores?.ai?.holes?.reduce((a, b) => a + b, 0) || 0
  const parTotal    = scores?.pars?.reduce((a, b) => a + b, 0) || 0
  const playerVsPar = playerTotal - parTotal
  const aiVsPar     = aiTotal - parTotal

  // ── Setup screen ─────────────────────────────────────────────────────────────
  if (!gameActive) return (
    <div className="p-4 space-y-4">
      <div className="text-broadcast-yellow font-black font-saira text-xl">GAME MODE</div>

      {/* Mode picker */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setGameMode('vs')}
          className={`broadcast-card p-4 text-center transition-all ${gameMode === 'vs' ? 'border-broadcast-yellow bg-yellow-950' : 'border-gray-700'}`}>
          <div className="text-3xl mb-1">🤖</div>
          <div className="font-black text-broadcast-yellow font-saira text-sm">VS AI</div>
          <div className="text-xs text-gray-400 mt-1">1v1 match against CPU</div>
        </button>
        <button onClick={() => setGameMode('doubles')}
          className={`broadcast-card p-4 text-center transition-all ${gameMode === 'doubles' ? 'border-broadcast-yellow bg-yellow-950' : 'border-gray-700'}`}>
          <div className="text-3xl mb-1">🤝</div>
          <div className="font-black text-broadcast-yellow font-saira text-sm">DOUBLES</div>
          <div className="text-xs text-gray-400 mt-1">You + AI vs 2 AI opponents</div>
        </button>
      </div>

      {gameMode && (
        <>
          {/* Difficulty */}
          <div className="broadcast-card p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div className="text-xs text-broadcast-cyan font-bold">AI DIFFICULTY</div>
              <div className="font-black text-broadcast-yellow font-saira text-lg">{difficulty}</div>
            </div>
            <input type="range" min={0} max={100} value={difficulty}
              onChange={e => setDifficulty(Number(e.target.value))}
              className="w-full accent-yellow-400" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Beginner</span><span>Casual</span><span>Pro</span>
            </div>
            <div className="text-xs text-gray-400 text-center">
              {difficulty >= 80 ? '⚡ Expert CPU — expect birdies' :
               difficulty >= 55 ? '🎯 Solid CPU — plays around par' :
               difficulty >= 30 ? '😤 Casual CPU — some bogeys' :
               '🥏 Beginner CPU — plenty of bogeys'}
            </div>
          </div>

          <div className="text-xs text-gray-500 text-center">
            {selectedCourse === 'kensington' ? 'Kensington' : 'Palmer Park'} · 18 holes
          </div>

          <button onClick={startGame}
            className="w-full py-4 bg-broadcast-yellow text-black font-black font-saira text-lg rounded">
            START MATCH
          </button>
        </>
      )}
    </div>
  )

  // ── Game over screen ──────────────────────────────────────────────────────────
  if (gameOver) {
    const playerWins = gameMode === 'doubles'
      ? (playerTotal + (scores.aiPartner?.holes?.reduce((a,b)=>a+b,0)||0)) < (aiTotal + (scores.ai2?.holes?.reduce((a,b)=>a+b,0)||0))
      : playerTotal < aiTotal
    return (
      <div className="p-4 space-y-4">
        <div className="broadcast-card p-6 text-center space-y-2">
          <div className="text-4xl">{playerWins ? '🏆' : '😅'}</div>
          <div className="font-black text-broadcast-yellow font-saira text-2xl">
            {playerWins ? 'YOU WIN!' : `${scores.ai?.name} WINS`}
          </div>
          <div className="text-broadcast-cyan text-sm">
            {playerWins ? 'Nice round!' : 'Better luck next time'}
          </div>
        </div>
        <ScoreBoard scores={scores} playerName="You" gameMode={gameMode} />
        <button onClick={() => { setGameActive(false); setGameMode(null) }}
          className="w-full py-3 bg-broadcast-yellow text-black font-black font-saira rounded">
          PLAY AGAIN
        </button>
      </div>
    )
  }

  // ── Active game screen ────────────────────────────────────────────────────────
  return (
    <div className="p-4 space-y-3 pb-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <div className="font-black text-broadcast-yellow font-saira text-lg">HOLE {currentHole}</div>
          <div className="text-xs text-broadcast-cyan">Par {holePar} · {holeDist}ft</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">{gameMode === 'doubles' ? 'DOUBLES' : 'VS AI'}</div>
          <div className="text-xs text-gray-400">Difficulty {difficulty}</div>
        </div>
      </div>

      {/* Live score comparison */}
      <div className="grid grid-cols-2 gap-3">
        <div className="broadcast-card p-3 text-center">
          <div className="text-xs text-broadcast-cyan">YOU</div>
          <div className="text-2xl font-black text-broadcast-yellow font-saira">{playerTotal}</div>
          <div className={`text-xs font-bold ${playerVsPar <= 0 ? 'text-green-400' : 'text-broadcast-red'}`}>
            {playerVsPar === 0 ? 'E' : playerVsPar > 0 ? `+${playerVsPar}` : `${playerVsPar}`}
          </div>
        </div>
        <div className="broadcast-card p-3 text-center">
          <div className="text-xs text-broadcast-cyan">{scores?.ai?.name || 'AI'}</div>
          <div className="text-2xl font-black font-saira" style={{ color: aiTotal < playerTotal ? '#ff4444' : '#aaa' }}>{aiTotal}</div>
          <div className={`text-xs font-bold ${aiVsPar <= 0 ? 'text-green-400' : 'text-broadcast-red'}`}>
            {aiVsPar === 0 ? 'E' : aiVsPar > 0 ? `+${aiVsPar}` : `${aiVsPar}`}
          </div>
        </div>
      </div>

      {/* AI thinking */}
      {aiThinking && (
        <div className="broadcast-card p-4 text-center">
          <div className="text-broadcast-cyan animate-pulse font-saira font-bold">
            🤖 {scores?.ai?.name} is throwing...
          </div>
        </div>
      )}

      {/* Hole result */}
      {showResult && aiResult && (
        <div className="broadcast-card p-4 space-y-2 border-broadcast-cyan">
          <div className="text-xs text-broadcast-cyan font-bold">HOLE {currentHole} RESULT</div>
          <div className="flex justify-between">
            <div>
              <div className="text-xs text-gray-400">You</div>
              <div className="font-black text-broadcast-yellow font-saira text-lg">{scores.player?.at(-1)} strokes</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">{scores?.ai?.name}</div>
              <div className="font-black font-saira text-lg text-white">{aiResult.label}</div>
            </div>
          </div>
          {gameMode === 'doubles' && (
            <div className="text-xs text-gray-400">
              Partner {scores.aiPartner?.name}: {scores.aiPartner?.holes?.at(-1)} strokes
            </div>
          )}
          <button onClick={nextHole}
            className="w-full py-3 bg-broadcast-yellow text-black font-black font-saira rounded mt-2">
            {currentHole >= 18 ? 'FINAL SCORES' : `→ HOLE ${currentHole + 1}`}
          </button>
        </div>
      )}

      {/* Player turn */}
      {playerTurn && !showResult && (
        <div className="space-y-3">
          <div className="text-xs text-broadcast-cyan font-bold">YOUR TURN — HOLE {currentHole}</div>

          {/* Stroke input */}
          <div className="broadcast-card p-3">
            <div className="text-xs text-gray-400 mb-2">How many strokes did you take?</div>
            <div className="flex gap-2">
              {[1,2,3,4,5,6,7].map(n => (
                <button key={n} onClick={() => setPlayerStrokes(n)}
                  className={`flex-1 py-2 rounded font-black font-saira text-sm ${
                    playerStrokes === n ? 'bg-broadcast-yellow text-black' : 'bg-gray-800 text-white'
                  }`}>{n}</button>
              ))}
            </div>
          </div>

          {/* Disc select */}
          <div className="broadcast-card p-3">
            <div className="text-xs text-gray-400 mb-2">Disc thrown:</div>
            <div className="grid grid-cols-4 gap-1.5">
              {bag.map(disc => (
                <button key={disc.id} onClick={() => setSelectedDisc(disc)}
                  className={`py-1.5 rounded text-center text-[10px] font-bold font-saira ${
                    selectedDisc?.id === disc.id ? 'bg-broadcast-yellow text-black' : 'bg-gray-800 text-white border border-gray-600'
                  }`}>
                  <div className="w-3 h-3 rounded-full mx-auto mb-0.5" style={{ backgroundColor: disc.color }} />
                  {(disc.customLabel || disc.name).slice(0, 6).toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <button onClick={logPlayerThrow} disabled={!selectedDisc || !playerStrokes}
            className="w-full py-3 bg-broadcast-yellow text-black font-black font-saira text-base rounded disabled:opacity-40">
            LOG THROW → AI TURN
          </button>
        </div>
      )}

      {/* Scorecard */}
      {scores?.player?.length > 0 && !showResult && (
        <ScoreBoard scores={scores} playerName="You" gameMode={gameMode} />
      )}

      <button onClick={() => { setGameActive(false); setGameMode(null) }}
        className="w-full py-2 text-xs text-gray-500 border border-gray-700 rounded">
        Quit Match
      </button>
    </div>
  )
}
