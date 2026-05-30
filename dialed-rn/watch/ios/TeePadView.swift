// Screen 1 of 3: Tee Pad
// Shows hole distance, par, wind, and caddy disc suggestion.
// Tapping "Throw" navigates to ShotConfirmView.

import SwiftUI

struct TeePadView: View {
    @EnvironmentObject var session: WatchSessionManager
    @State private var showConfirm = false

    var body: some View {
        guard let p = session.currentPayload else {
            return AnyView(ProgressView())
        }

        return AnyView(
            ScrollView {
                VStack(alignment: .leading, spacing: 6) {

                    // ── Hole header ──────────────────────────────────────────
                    HStack {
                        Text("HOLE \(p.holeNumber)")
                            .font(.system(size: 14, weight: .black, design: .monospaced))
                            .foregroundColor(.cyan)
                        Spacer()
                        Text("PAR \(p.parNumber)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.gray)
                    }

                    // ── Distance ─────────────────────────────────────────────
                    Text("\(p.distanceFt) ft")
                        .font(.system(size: 26, weight: .black, design: .monospaced))
                        .foregroundColor(.white)

                    // ── Wind ─────────────────────────────────────────────────
                    HStack(spacing: 4) {
                        Image(systemName: windIcon(p.windRelation))
                            .font(.caption)
                            .foregroundColor(windColor(p.windCondition))
                        Text("\(p.windCondition.uppercased()) · \(p.windSpeedMph) mph")
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .foregroundColor(windColor(p.windCondition))
                    }

                    Divider().background(Color.gray.opacity(0.4))

                    // ── Caddy suggestion ─────────────────────────────────────
                    Text("CADDY")
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .foregroundColor(.gray)

                    Text(p.discLabel)
                        .font(.system(size: 15, weight: .heavy, design: .monospaced))
                        .foregroundColor(.yellow)

                    Text(p.throwType.uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.orange)

                    Text(p.topReason)
                        .font(.system(size: 9))
                        .foregroundColor(.white.opacity(0.8))
                        .lineLimit(3)

                    // ── Confidence bar ───────────────────────────────────────
                    ProgressView(value: Double(p.confidence), total: 100)
                        .tint(confidenceColor(p.confidence))
                        .scaleEffect(x: 1, y: 1.5, anchor: .center)

                    // ── Lateral offset ───────────────────────────────────────
                    if abs(p.lateralFt) > 10 {
                        Text(lateralLabel(p.lateralFt))
                            .font(.system(size: 9, design: .monospaced))
                            .foregroundColor(.white.opacity(0.6))
                    }

                    // ── Score vs par ─────────────────────────────────────────
                    HStack {
                        Spacer()
                        Text(scoreLabel(p.playerScoreVsPar))
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                            .foregroundColor(scoreColor(p.playerScoreVsPar))
                    }

                    // ── CTA ──────────────────────────────────────────────────
                    Button(action: { showConfirm = true }) {
                        Text("THROW →")
                            .font(.system(size: 12, weight: .black, design: .monospaced))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                            .background(Color.cyan.opacity(0.2))
                            .cornerRadius(6)
                    }
                    .buttonStyle(.plain)
                }
                .padding(10)
            }
            .background(Color.black)
            .navigationDestination(isPresented: $showConfirm) {
                ShotConfirmView()
            }
        )
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private func windIcon(_ relation: String) -> String {
        switch relation {
        case "headwind":   return "arrow.up"
        case "tailwind":   return "arrow.down"
        case "cross_left": return "arrow.left"
        case "cross_right":return "arrow.right"
        default:           return "wind"
        }
    }

    private func windColor(_ condition: String) -> Color {
        switch condition {
        case "calm":     return .gray
        case "light":    return .green
        case "moderate": return .yellow
        case "strong":   return .red
        default:         return .white
        }
    }

    private func confidenceColor(_ c: Int) -> Color {
        if c >= 75 { return .green }
        if c >= 50 { return .yellow }
        return .red
    }

    private func lateralLabel(_ ft: Int) -> String {
        ft > 0
            ? "Drifts \(ft) ft right of center"
            : "Drifts \(abs(ft)) ft left of center"
    }

    private func scoreLabel(_ vsPar: Int) -> String {
        if vsPar == 0 { return "E" }
        return vsPar > 0 ? "+\(vsPar)" : "\(vsPar)"
    }

    private func scoreColor(_ vsPar: Int) -> Color {
        if vsPar <= -2 { return .yellow }
        if vsPar == -1 { return .green }
        if vsPar == 0  { return .white }
        return .red
    }
}
