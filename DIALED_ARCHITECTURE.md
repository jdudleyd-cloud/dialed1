# DIALED Architecture

## Monorepo Layout

```
dialed1/
├── dialed-phase1/       ← Next.js 14 PWA (live, Phase 1)
└── dialed-rn/           ← Expo + React Native TypeScript (Phase 2+)
```

## Phase 1 (Live — dialed-phase1/)

- **Stack:** React 18, Next.js 14, Tailwind CSS, plain JavaScript
- **Hosting:** Vercel
- **Storage:** Browser localStorage
- **APIs:** Open-Meteo (weather, no auth)
- **Features:** Play, Bag, Course, History, VS tabs; GPS throw logging; AI caddy; disc flight physics

## Phase 2 (Active — dialed-rn/)

- **Stack:** Expo SDK 51, React Native, TypeScript strict mode
- **Storage:** Expo SQLite (local) → Supabase (Phase 3 cloud sync)
- **State:** Zustand
- **Navigation:** Expo Router (file-based)
- **Watch:** react-native-watch-connectivity (Apple Watch) + Wearable Data Layer API (WearOS)

### Companion Watch Apps

| Platform     | Language       | Framework    | Bridge               |
|--------------|---------------|-------------|----------------------|
| Apple Watch  | Swift          | SwiftUI      | WCSession (WatchKit) |
| WearOS       | Kotlin         | Compose      | Data Layer API       |

### Watch Screens (both platforms)

1. **Tee Pad** — current hole, distance, caddy suggestion, wind direction
2. **Shot Confirm** — throw type selector, log tap to confirm
3. **Hole Out** — score entry (+/-), par display, carry to next hole

### Data Flow

```
React Native App
    ↓ (WatchBridgeService.ts)
WatchPayload (typed)
    ↓ WCSession / Data Layer API
Watch UI ← renders shot thesis
    ↓ user confirms throw
Watch sends ShotResult back
    ↓
WearEngineService.ts updates disc wear model
    ↓
SQLite: current_turn / current_fade updated
```

## WearEngineService (Phase 2 Core Feature)

Tracks cumulative plastic wear per disc per user. Every throw deviates slightly
from factory specs based on impact events. The service maintains:

- `plastic_durability_index`: 0.0–1.0, derived from plastic type and manufacturer
- `current_turn` / `current_fade`: live-shifted flight numbers
- Severe Impact multiplier: applied when measured distance < 20% of expected

## TypeScript Bridge Contract

All data crossing the RN ↔ watch bridge uses `WatchPayload` and `ShotResult`
types defined in `src/types/models.ts`. Never pass raw objects — always use
the typed payload builders in `WatchBridgeService.ts`.

## GPS / Coordinate Rules (inherited from Phase 1)

- UDisc Pro tee → `longTee`
- UDisc Am tee → `shortTee`
- Single-tee holes: `longTee === shortTee`
- Never rename these fields
- GPS math is protected — do not modify bearing/distance calculations

## Plastic Durability Baseline (seeded in migrations.ts)

| Manufacturer | Plastic       | Durability Index |
|-------------|--------------|-----------------|
| Innova       | Champion      | 0.95            |
| Innova       | Star          | 0.88            |
| Innova       | DX            | 0.60            |
| Discraft     | Z Line        | 0.93            |
| Discraft     | ESP           | 0.87            |
| Discraft     | Pro D         | 0.62            |
| Discraft     | Big Z         | 0.90            |
