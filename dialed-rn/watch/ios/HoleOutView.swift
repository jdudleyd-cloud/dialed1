// Screen 3 of 3: Hole Out
// User logs their final stroke count for the hole.
// Sends score back to RN app and returns to TeePadView for the next hole.

import SwiftUI

struct HoleOutView: View {
    @EnvironmentObject var session: WatchSessionManager
    @Environment(\.dismiss) private var dismiss

    @State private var strokeCount: Int = 3
    @State private var confirmed = false

    var body: some View {
        guard let p = session.currentPayload else {
            return AnyView(ProgressView())
        }

        let vsPar = strokeCount - p.parNumber

        return AnyView(
            VStack(spacing: 10) {

                Text("HOLE \(p.holeNumber) OUT")
                    .font(.system(size: 11, weight: .black, design: .monospaced))
                    .foregroundColor(.cyan)

                // ── Stroke counter ────────────────────────────────────────────
                HStack(spacing: 16) {
                    Button(action: { if strokeCount > 1 { strokeCount -= 1 } }) {
                        Image(systemName: "minus.circle.fill")
                            .font(.title3)
                            .foregroundColor(.red.opacity(0.8))
                    }
                    .buttonStyle(.plain)

                    VStack(spacing: 2) {
                        Text("\(strokeCount)")
                            .font(.system(size: 36, weight: .black, design: .monospaced))
                            .foregroundColor(.white)
                            .focusable(true)
                            .digitalCrownRotation(
                                $strokeCount,
                                from: 1, through: 12, by: 1,
                                sensitivity: .high,
                                isContinuous: false,
                                isHapticFeedbackEnabled: true
                            )

                        Text("STROKES")
                            .font(.system(size: 8, design: .monospaced))
                            .foregroundColor(.gray)
                    }

                    Button(action: { if strokeCount < 12 { strokeCount += 1 } }) {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                            .foregroundColor(.green.opacity(0.8))
                    }
                    .buttonStyle(.plain)
                }

                // ── Score vs par ──────────────────────────────────────────────
                Text(vsParLabel(vsPar))
                    .font(.system(size: 13, weight: .heavy, design: .monospaced))
                    .foregroundColor(vsParColor(vsPar))

                // ── Confirm ───────────────────────────────────────────────────
                Button(action: confirmHoleOut) {
                    Text(confirmed ? "NEXT HOLE →" : "CONFIRM")
                        .font(.system(size: 12, weight: .black, design: .monospaced))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 7)
                        .background(confirmed ? Color.green.opacity(0.3) : Color.cyan.opacity(0.2))
                        .cornerRadius(8)
                }
                .buttonStyle(.plain)
            }
            .padding(10)
            .background(Color.black)
        )
    }

    private func confirmHoleOut() {
        guard let p = session.currentPayload else { return }

        WKInterfaceDevice.current().play(.success)

        let msg: [String: Any] = [
            "type":        "HOLE_COMPLETE",
            "holeNumber":  p.holeNumber,
            "strokes":     strokeCount,
            "par":         p.parNumber,
            "confirmedAt": ISO8601DateFormatter().string(from: Date()),
        ]

        if WCSession.default.isReachable {
            WCSession.default.sendMessage(msg, replyHandler: nil, errorHandler: nil)
        }

        confirmed = true

        // Pop all the way back to TeePadView
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            // The RN app will send a new HOLE_PAYLOAD for the next hole,
            // which will update currentPayload and refresh TeePadView.
            dismiss()
        }
    }

    private func vsParLabel(_ vsPar: Int) -> String {
        switch vsPar {
        case ..<(-1): return "EAGLE 🦅"
        case -1:      return "BIRDIE 🐦"
        case 0:       return "PAR"
        case 1:       return "BOGEY"
        case 2:       return "DOUBLE"
        default:      return "+\(vsPar)"
        }
    }

    private func vsParColor(_ vsPar: Int) -> Color {
        if vsPar <= -2 { return .yellow }
        if vsPar == -1 { return .green }
        if vsPar == 0  { return .white }
        if vsPar == 1  { return .orange }
        return .red
    }
}
