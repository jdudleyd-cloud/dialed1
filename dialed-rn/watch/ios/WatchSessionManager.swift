// WatchSessionManager — WCSession delegate; receives payloads from RN phone app
// and sends ShotResult messages back after user confirms a throw.

import Foundation
import WatchConnectivity
import Combine

// ─── Data models (mirror types/models.ts) ─────────────────────────────────────

struct HolePayload {
    let holeNumber: Int
    let courseName: String
    let distanceFt: Int
    let parNumber: Int
    let windCondition: String
    let windRelation: String
    let windSpeedMph: Int
    let playerScoreVsPar: Int
    // suggestion
    let discLabel: String
    let throwType: String
    let expectedDistFt: Int
    let lateralFt: Int
    let confidence: Int
    let topReason: String

    static func from(_ dict: [String: Any]) -> HolePayload? {
        guard
            let hole    = dict["holeNumber"]       as? Int,
            let course  = dict["courseName"]       as? String,
            let dist    = dict["distanceFt"]       as? Int,
            let par     = dict["parNumber"]        as? Int,
            let wind    = dict["windCondition"]    as? String,
            let wRel    = dict["windRelation"]     as? String,
            let wSpd    = dict["windSpeedMph"]     as? Int,
            let scr     = dict["playerScoreVsPar"] as? Int,
            let disc    = dict["suggDiscLabel"]    as? String,
            let tType   = dict["suggThrowType"]    as? String,
            let eDist   = dict["suggExpectedDist"] as? Int,
            let lat     = dict["suggLateral"]      as? Int,
            let conf    = dict["suggConfidence"]   as? Int,
            let reason  = dict["suggTopReason"]    as? String
        else { return nil }

        return HolePayload(
            holeNumber: hole, courseName: course, distanceFt: dist,
            parNumber: par, windCondition: wind, windRelation: wRel,
            windSpeedMph: wSpd, playerScoreVsPar: scr,
            discLabel: disc, throwType: tType, expectedDistFt: eDist,
            lateralFt: lat, confidence: conf, topReason: reason
        )
    }
}

// ─── Session manager ──────────────────────────────────────────────────────────

@MainActor
final class WatchSessionManager: NSObject, ObservableObject {
    static let shared = WatchSessionManager()

    @Published var currentPayload: HolePayload? = nil
    @Published var isReachable: Bool = false

    private override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    func sendShotResult(
        holeNumber: Int,
        throwType: String,
        measuredDistFt: Int,
        inventoryId: Int
    ) {
        guard WCSession.default.isReachable else { return }

        let msg: [String: Any] = [
            "type":                "SHOT_RESULT",
            "holeNumber":          holeNumber,
            "throwType":           throwType,
            "measuredDistanceFt":  measuredDistFt,
            "confirmedAt":         ISO8601DateFormatter().string(from: Date()),
            "inventoryId":         inventoryId,
        ]

        WCSession.default.sendMessage(msg, replyHandler: nil) { err in
            print("[WatchSession] sendShotResult error: \(err.localizedDescription)")
        }
    }
}

// ─── WCSession delegate ───────────────────────────────────────────────────────

extension WatchSessionManager: WCSessionDelegate {
    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith state: WCSessionActivationState,
        error: Error?
    ) {
        Task { @MainActor in
            self.isReachable = (state == .activated)
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            self.isReachable = session.isReachable
        }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any]
    ) {
        guard
            let type = message["type"] as? String,
            type == "HOLE_PAYLOAD",
            let payload = HolePayload.from(message)
        else { return }

        Task { @MainActor in
            self.currentPayload = payload
        }
    }
}
