// Screen 2 of 3: Shot Confirm
// User selects throw type (override or accept suggestion) and enters measured distance.
// Confirming sends ShotResult back to the RN phone app via WCSession.

import SwiftUI

struct ShotConfirmView: View {
    @EnvironmentObject var session: WatchSessionManager
    @Environment(\.dismiss) private var dismiss

    @State private var selectedThrowType: String
    @State private var measuredDistance: Int
    @State private var showHoleOut = false
    @State private var didSend = false

    private let throwTypes = ["backhand", "forehand", "sidearm", "tomahawk"]

    init() {
        // Pre-select the caddy's suggestion; user can override with Digital Crown
        _selectedThrowType = State(initialValue: "backhand")
        _measuredDistance = State(initialValue: 200)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {

                Text("SHOT CONFIRM")
                    .font(.system(size: 11, weight: .black, design: .monospaced))
                    .foregroundColor(.cyan)

                // ── Throw type picker ─────────────────────────────────────────
                Picker("Throw", selection: $selectedThrowType) {
                    ForEach(throwTypes, id: \.self) { type in
                        Text(type.uppercased()).tag(type)
                    }
                }
                .pickerStyle(.wheel)
                .frame(height: 60)

                // ── Distance entry (Digital Crown) ────────────────────────────
                VStack(spacing: 2) {
                    Text("DISTANCE")
                        .font(.system(size: 9, design: .monospaced))
                        .foregroundColor(.gray)

                    Text("\(measuredDistance) ft")
                        .font(.system(size: 22, weight: .black, design: .monospaced))
                        .foregroundColor(.white)
                        .focusable(true)
                        .digitalCrownRotation(
                            $measuredDistance,
                            from: 0, through: 600, by: 5,
                            sensitivity: .medium,
                            isContinuous: false,
                            isHapticFeedbackEnabled: true
                        )
                }
                .padding(.vertical, 4)

                // ── Confirm button ────────────────────────────────────────────
                Button(action: confirmThrow) {
                    Text(didSend ? "✓ SENT" : "CONFIRM")
                        .font(.system(size: 13, weight: .black, design: .monospaced))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(didSend ? Color.green.opacity(0.3) : Color.cyan.opacity(0.2))
                        .cornerRadius(8)
                }
                .buttonStyle(.plain)
                .disabled(didSend)

                // ── Navigate to hole-out after send ──────────────────────────
                NavigationLink(destination: HoleOutView(), isActive: $showHoleOut) {
                    EmptyView()
                }
            }
            .padding(10)
        }
        .background(Color.black)
        .onAppear {
            // Pre-fill suggestion throw type from the current payload
            if let suggestion = session.currentPayload?.throwType {
                selectedThrowType = suggestion
            }
            if let expected = session.currentPayload?.expectedDistFt {
                measuredDistance = expected
            }
        }
    }

    private func confirmThrow() {
        guard let p = session.currentPayload else { return }

        WKInterfaceDevice.current().play(.success)

        session.sendShotResult(
            holeNumber:     p.holeNumber,
            throwType:      selectedThrowType,
            measuredDistFt: measuredDistance,
            inventoryId:    0   // TODO: wire to selected disc inventory_id
        )

        didSend = true

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            showHoleOut = true
        }
    }
}
