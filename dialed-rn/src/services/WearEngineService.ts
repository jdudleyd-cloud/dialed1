// WearEngineService — tracks cumulative disc plastic wear and shifts flight numbers
//
// Every throw degrades a disc slightly. Premium plastics degrade slowly; base
// plastics degrade fast. A severe impact (measured distance < 20% of expected)
// applies a multiplier on top of normal wear.
//
// After each throw: call updateWear() → persist returned WearProfile to user_inventory.

import type {
  UserInventory,
  WearProfile,
  WearUpdateInput,
  DiscProfile,
} from '../types/models'

// ─── Constants ────────────────────────────────────────────────────────────────

const THROWS_PER_WEAR_TICK = 50
const SEVERE_IMPACT_MULTIPLIER = 4.0
const SEVERE_IMPACT_THRESHOLD = 0.20   // measured < 20% of expected = severe
const MAX_WEAR_INDEX = 1.0
const MAX_SHIFT_TURN = 2.0             // max turn can shift (toward understable)
const MAX_SHIFT_FADE = 1.5             // max fade can shift (toward understable)

// ─── Core wear update ─────────────────────────────────────────────────────────

/**
 * Computes updated flight numbers after a throw event.
 *
 * Call this after every logged throw. Persist the returned WearProfile
 * back to user_inventory (current_turn, current_fade, wear_index, throw_count,
 * impact_events).
 */
export function updateWear(
  disc: UserInventory,
  input: WearUpdateInput,
): WearProfile {
  const { measuredDistanceFt, expectedDistanceFt, plasticDurabilityIndex } = input

  const isSevere = expectedDistanceFt > 0
    && (measuredDistanceFt / expectedDistanceFt) < SEVERE_IMPACT_THRESHOLD

  const newThrowCount = disc.throw_count + 1
  const newImpactEvents = disc.impact_events + (isSevere ? 1 : 0)

  // Wear tick: one unit of degradation per THROWS_PER_WEAR_TICK throws,
  // scaled by how fragile the plastic is (low durability_index = faster wear)
  const baseTick = 1 / THROWS_PER_WEAR_TICK
  const plasticScaling = 1 - plasticDurabilityIndex  // 0 for max durability, 1 for none
  const impactMultiplier = isSevere ? SEVERE_IMPACT_MULTIPLIER : 1.0

  const wearDelta = baseTick * (1 + plasticScaling) * impactMultiplier
  const newWearIndex = Math.min(MAX_WEAR_INDEX, disc.wear_index + wearDelta)

  // Shift flight numbers toward understable as wear accumulates.
  // turn goes more negative (more understable); fade decreases.
  const turnShift = -(newWearIndex * MAX_SHIFT_TURN)
  const fadeShift = -(newWearIndex * MAX_SHIFT_FADE)

  // Load factory specs from disc (current values at wear_index=0 are factory specs)
  // We derive factory specs by reversing the current wear already applied.
  const factoryTurn = computeFactorySpec(disc.current_turn, disc.wear_index, MAX_SHIFT_TURN, 'turn')
  const factoryFade = computeFactorySpec(disc.current_fade, disc.wear_index, MAX_SHIFT_FADE, 'fade')

  const newTurn = parseFloat((factoryTurn + turnShift).toFixed(2))
  const newFade = parseFloat((factoryFade + fadeShift).toFixed(2))

  return {
    currentTurn: newTurn,
    currentFade: newFade,
    wearIndex: parseFloat(newWearIndex.toFixed(4)),
    throwCount: newThrowCount,
    impactEvents: newImpactEvents,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeFactorySpec(
  currentValue: number,
  currentWearIndex: number,
  maxShift: number,
  _spec: 'turn' | 'fade',
): number {
  if (currentWearIndex === 0) return currentValue
  const appliedShift = -(currentWearIndex * maxShift)
  return currentValue - appliedShift
}

/**
 * Returns whether a throw event qualifies as a severe impact.
 */
export function isSevereImpact(measuredFt: number, expectedFt: number): boolean {
  if (expectedFt <= 0) return false
  return measuredFt / expectedFt < SEVERE_IMPACT_THRESHOLD
}

/**
 * Returns a human-readable wear label for UI display.
 */
export function getWearLabel(wearIndex: number): string {
  if (wearIndex < 0.10) return 'New'
  if (wearIndex < 0.25) return 'Light Wear'
  if (wearIndex < 0.50) return 'Moderate Wear'
  if (wearIndex < 0.75) return 'Heavy Wear'
  return 'Beat-In'
}

/**
 * Returns the live DiscProfile for a disc, using current_turn / current_fade
 * rather than factory specs. Pass this into calculateFlightPath.
 */
export function getLiveDiscProfile(disc: UserInventory): DiscProfile {
  return {
    speed: disc.current_turn,   // speed doesn't wear
    glide: disc.current_fade,   // glide doesn't wear meaningfully
    turn: disc.current_turn,
    fade: disc.current_fade,
  }
}

/**
 * Given a disc's current wear, estimate how many more throws until it reaches
 * a target wear tier. Returns null if already past target.
 */
export function throwsUntilWearTier(
  currentWearIndex: number,
  plasticDurabilityIndex: number,
  targetWearIndex: number,
): number | null {
  if (currentWearIndex >= targetWearIndex) return null

  const baseTick = 1 / THROWS_PER_WEAR_TICK
  const plasticScaling = 1 - plasticDurabilityIndex
  const tickPerThrow = baseTick * (1 + plasticScaling)

  const remaining = targetWearIndex - currentWearIndex
  return Math.ceil(remaining / tickPerThrow)
}
