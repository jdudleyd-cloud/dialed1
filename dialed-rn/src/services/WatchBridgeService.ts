// WatchBridgeService — sends typed payloads to Apple Watch (WCSession) and
// WearOS (Data Layer API) via react-native-watch-connectivity.
//
// Both platforms share the same send interface. The underlying library
// selects the correct native module at runtime.
//
// Usage:
//   const bridge = WatchBridgeService.getInstance()
//   await bridge.sendHolePayload(payload)
//   bridge.onShotResult((result) => { ... })

import type { WatchPayload, ShotResult, WatchConnectionStatus } from '../types/models'

// react-native-watch-connectivity covers both Apple Watch (WCSession) and
// WearOS (Data Layer API) behind a unified JS API.
// Install: npx expo install react-native-watch-connectivity
type WatchConnectivity = {
  getIsWatchAppInstalled: () => Promise<boolean>
  sendMessage: (
    message: Record<string, unknown>,
    replyHandler?: (reply: Record<string, unknown>) => void,
    errorHandler?: (error: Error) => void,
  ) => void
  addMessageListener: (
    callback: (message: Record<string, unknown>) => void,
  ) => () => void
  transferUserInfo: (info: Record<string, unknown>) => void
}

// Lazy-require so the service can be imported in non-watch contexts without crashing
function getWatch(): WatchConnectivity | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-watch-connectivity') as WatchConnectivity
  } catch {
    return null
  }
}

// ─── Message keys (match on both native sides) ────────────────────────────────

const MSG_HOLE_PAYLOAD = 'HOLE_PAYLOAD'
const MSG_SHOT_RESULT  = 'SHOT_RESULT'

// ─── Service ──────────────────────────────────────────────────────────────────

export class WatchBridgeService {
  private static instance: WatchBridgeService | null = null
  private shotResultListeners: Array<(result: ShotResult) => void> = []
  private messageUnsubscribe: (() => void) | null = null

  static getInstance(): WatchBridgeService {
    if (!WatchBridgeService.instance) {
      WatchBridgeService.instance = new WatchBridgeService()
    }
    return WatchBridgeService.instance
  }

  private constructor() {
    this.startListening()
  }

  // ── Send hole payload to watch ────────────────────────────────────────────

  async sendHolePayload(payload: WatchPayload): Promise<void> {
    const watch = getWatch()
    if (!watch) return

    const installed = await watch.getIsWatchAppInstalled()
    if (!installed) return

    watch.sendMessage(
      { type: MSG_HOLE_PAYLOAD, ...serializePayload(payload) },
      undefined,
      (err) => console.warn('[WatchBridge] sendHolePayload failed:', err.message),
    )
  }

  // ── Receive shot results from watch ──────────────────────────────────────

  onShotResult(callback: (result: ShotResult) => void): () => void {
    this.shotResultListeners.push(callback)
    return () => {
      this.shotResultListeners = this.shotResultListeners.filter(cb => cb !== callback)
    }
  }

  // ── Connection status ─────────────────────────────────────────────────────

  async getStatus(): Promise<WatchConnectionStatus> {
    const watch = getWatch()
    if (!watch) return { isReachable: false, platform: null }

    try {
      const installed = await watch.getIsWatchAppInstalled()
      return { isReachable: installed, platform: detectPlatform() }
    } catch {
      return { isReachable: false, platform: null }
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private startListening(): void {
    const watch = getWatch()
    if (!watch) return

    this.messageUnsubscribe = watch.addMessageListener((message) => {
      if (message.type !== MSG_SHOT_RESULT) return
      const result = deserializeShotResult(message)
      if (!result) return
      this.shotResultListeners.forEach(cb => cb(result))
    })
  }

  destroy(): void {
    this.messageUnsubscribe?.()
    this.shotResultListeners = []
    WatchBridgeService.instance = null
  }
}

// ─── Serialization ────────────────────────────────────────────────────────────
// Watch bridge only sends primitive values — no nested objects.

function serializePayload(p: WatchPayload): Record<string, unknown> {
  return {
    holeNumber:          p.holeNumber,
    courseName:          p.courseName,
    distanceFt:          p.distanceFt,
    parNumber:           p.parNumber,
    windCondition:       p.windCondition,
    windRelation:        p.windRelation ?? '',
    windSpeedMph:        p.windSpeedMph,
    playerScoreVsPar:    p.playerScoreVsPar,
    // suggestion flattened
    suggDiscLabel:       p.suggestion.discLabel,
    suggThrowType:       p.suggestion.throwType,
    suggExpectedDist:    p.suggestion.expectedDistanceFt,
    suggLateral:         p.suggestion.lateralFt,
    suggConfidence:      p.suggestion.confidence,
    suggTopReason:       p.suggestion.topReason,
  }
}

function deserializeShotResult(msg: Record<string, unknown>): ShotResult | null {
  if (
    typeof msg.holeNumber !== 'number' ||
    typeof msg.throwType !== 'string' ||
    typeof msg.measuredDistanceFt !== 'number' ||
    typeof msg.confirmedAt !== 'string' ||
    typeof msg.inventoryId !== 'number'
  ) return null

  return {
    holeNumber:          msg.holeNumber,
    throwType:           msg.throwType as ShotResult['throwType'],
    measuredDistanceFt:  msg.measuredDistanceFt,
    confirmedAt:         msg.confirmedAt,
    inventoryId:         msg.inventoryId,
  }
}

function detectPlatform(): WatchConnectionStatus['platform'] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Platform } = require('react-native')
    if (Platform.OS === 'ios') return 'apple'
    if (Platform.OS === 'android') return 'wear'
    return null
  } catch {
    return null
  }
}
