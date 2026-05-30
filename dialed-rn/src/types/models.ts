// ─── Core disc types ──────────────────────────────────────────────────────────

export type ThrowType = 'backhand' | 'forehand' | 'sidearm' | 'tomahawk'
export type WindCondition = 'calm' | 'light' | 'moderate' | 'strong'
export type WindRelation = 'headwind' | 'tailwind' | 'cross_left' | 'cross_right'
export type DiscStability = 'Overstable' | 'Understable' | 'Neutral'
export type HazardType = 'water' | 'ob' | 'brush' | 'trees' | 'other'
export type HazardSide = 'left' | 'right' | 'long'

// ─── Database tables ──────────────────────────────────────────────────────────

export interface Plastic {
  id: number
  manufacturer: string       // e.g. "Innova", "Discraft"
  plastic_name: string       // e.g. "Champion", "Z Line"
  durability_index: number   // 0.0–1.0; higher = more durable, slower wear
}

export interface DiscMaster {
  id: number
  brand: string
  model: string
  speed: number
  glide: number
  turn: number               // factory spec
  fade: number               // factory spec
  stability: DiscStability
  plastic_id: number         // FK → Plastic.id
}

export interface UserInventory {
  id: number
  disc_master_id: number     // FK → DiscMaster.id
  plastic_id: number         // FK → Plastic.id
  weight: number             // grams
  color: string
  custom_label: string | null
  throw_count: number        // cumulative throws with this disc
  impact_events: number      // count of severe impacts (< 20% expected distance)
  current_turn: number       // live-shifted from factory spec
  current_fade: number       // live-shifted from factory spec
  wear_index: number         // 0.0–1.0, derived from throw_count + impact_events
  created_at: string         // ISO 8601
}

export interface ThrowRecord {
  id: number
  round_id: number | null
  inventory_id: number       // FK → UserInventory.id
  hole_number: number
  course_key: string
  throw_type: ThrowType
  wind_condition: WindCondition
  wind_relation: WindRelation | null
  measured_distance_ft: number
  expected_distance_ft: number
  lateral_offset_ft: number
  is_severe_impact: boolean  // measured < 20% of expected
  tee_lat: number | null
  tee_lon: number | null
  landing_lat: number | null
  landing_lon: number | null
  created_at: string
}

export interface Round {
  id: number
  course_key: string
  started_at: string
  completed_at: string | null
  total_strokes: number | null
  vs_ai_active: boolean
}

// ─── Flight physics ───────────────────────────────────────────────────────────

export interface DiscProfile {
  speed: number
  glide: number
  turn: number
  fade: number
  stability?: DiscStability
}

export interface FlightResult {
  distance: number           // feet
  lateral: number            // feet, positive = right
  description: string
}

export interface LandingCoords {
  lat: number
  lng: number
}

// ─── Hazards ─────────────────────────────────────────────────────────────────

export interface Hazard {
  id: string
  type: HazardType
  side: HazardSide
  label?: string
}

export interface DiscRiskResult {
  penalty: number            // 0–30
  warnings: string[]
}

// ─── Watch bridge types ───────────────────────────────────────────────────────

export interface WatchPayload {
  holeNumber: number
  courseName: string
  distanceFt: number
  parNumber: number
  windCondition: WindCondition
  windRelation: WindRelation | null
  windSpeedMph: number
  suggestion: WatchSuggestion
  playerScoreVsPar: number   // cumulative
}

export interface WatchSuggestion {
  discLabel: string          // e.g. "Buzzz OS" or custom_label if set
  throwType: ThrowType
  expectedDistanceFt: number
  lateralFt: number
  confidence: number         // 0–100
  topReason: string          // single-line reason string
}

export interface ShotResult {
  holeNumber: number
  throwType: ThrowType
  measuredDistanceFt: number
  confirmedAt: string        // ISO 8601
  inventoryId: number
}

export interface WatchConnectionStatus {
  isReachable: boolean
  platform: 'apple' | 'wear' | null
}

// ─── Drama engine ─────────────────────────────────────────────────────────────

export type BanterEvent = 'tee' | 'myBirdie' | 'myBogey' | 'yourBirdie' | 'yourBogey'
export type BanterSituation = 'hotStreak' | 'slump' | 'pressure' | 'rivalry' | 'comeback' | BanterEvent

export interface DramaState {
  aiStreak: number           // positive = birdie run, negative = bogey run
  gap: number                // positive = AI ahead
  comingBack: boolean
  isAce: boolean
  isEagle: boolean
  currentHole: number
}

export interface HoleResult {
  playerStrokes: number
  aiStrokes: number
  par: number
}

// ─── Weather ──────────────────────────────────────────────────────────────────

export interface WeatherData {
  temp: number               // °F
  humidity: number           // %
  windSpeed: number          // mph
  windDirection: number      // degrees
  weatherCode: number        // WMO code
  description: string
}

// ─── Wear engine ──────────────────────────────────────────────────────────────

export interface WearProfile {
  currentTurn: number
  currentFade: number
  wearIndex: number
  throwCount: number
  impactEvents: number
}

export interface WearUpdateInput {
  inventoryId: number
  measuredDistanceFt: number
  expectedDistanceFt: number
  plasticDurabilityIndex: number
}
