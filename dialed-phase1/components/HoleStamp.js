const SIZES = {
  sm: { px: 38, innerR: 15,   outerR: 18,   innerSW: 1.4, outerSW: 0.45, fontSize: 18 },
  md: { px: 44, innerR: 17.5, outerR: 21,   innerSW: 1.6, outerSW: 0.45, fontSize: 22 },
  lg: { px: 62, innerR: 26,   outerR: 30,   innerSW: 1.8, outerSW: 0.45, fontSize: 34 },
}

const INK   = '#1a1d18'
const PAPER = '#f0ead8'

export default function HoleStamp({ number, size = 'md', dark = true }) {
  const { px, innerR, outerR, innerSW, outerSW, fontSize } = SIZES[size] ?? SIZES.md
  const c = px / 2

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      aria-label={`Hole ${number}`}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <circle cx={c} cy={c} r={outerR} fill="none" stroke={INK} strokeWidth={outerSW} />
      <circle cx={c} cy={c} r={innerR} fill={dark ? PAPER : '#ffffff'} stroke={INK} strokeWidth={innerSW} />
      <text
        x={c}
        y={c}
        textAnchor="middle"
        dominantBaseline="central"
        fill={INK}
        fontSize={fontSize}
        fontFamily="'Roboto Slab', Georgia, serif"
        fontWeight="700"
      >
        {number}
      </text>
    </svg>
  )
}
