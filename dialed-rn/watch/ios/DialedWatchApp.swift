// DIALED Watch — Apple Watch companion app entry point
// Target: watchOS 9.0+, SwiftUI lifecycle
// Bridge: WCSession (WatchConnectivity framework)

import SwiftUI
import WatchConnectivity

@main
struct DialedWatchApp: App {
    @StateObject private var sessionManager = WatchSessionManager.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(sessionManager)
        }
    }
}

// ─── Navigation root ──────────────────────────────────────────────────────────

struct ContentView: View {
    @EnvironmentObject var session: WatchSessionManager

    var body: some View {
        NavigationStack {
            if session.currentPayload != nil {
                TeePadView()
            } else {
                WaitingView()
            }
        }
    }
}

struct WaitingView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "antenna.radiowaves.left.and.right")
                .font(.title2)
                .foregroundColor(.cyan)
            Text("Waiting for DIALED")
                .font(.footnote)
                .foregroundColor(.gray)
        }
    }
}
