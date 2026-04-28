# DIALED — Phase 1

Disc golf AI caddy PWA. Personalized flight intelligence that learns how *you* throw.

## Phase 1 Features (Live)

- ✅ Real geolocation (browser-based GPS)
- ✅ Open-Meteo weather API (temp, humidity, wind, direction)
- ✅ 14-disc Discraft bag (pre-loaded specs)
- ✅ Throw logging with GPS start/end dots
- ✅ Round tracking (18 holes)
- ✅ Flight chart replay (SVG, coming Phase 2)
- ✅ Local storage persistence (browser)
- ✅ 4 tabs: PLAY, BAG, COURSE, HISTORY
- ✅ Broadcast aesthetic (NFL RedZone meets Bloomberg Terminal)

## Tech Stack

- **Frontend:** React 18 + Next.js 14 + Tailwind CSS
- **Hosting:** Vercel (free tier)
- **Database:** Browser local storage (Phase 1), Supabase (Phase 3)
- **APIs:** Open-Meteo (weather, free), Mapbox (Phase 2, 50K free loads/mo)
- **Domain:** Optional (Vercel auto-URL works)

## Getting Started

1. Clone the repo
2. `npm install`
3. `npm run dev`
4. Open http://localhost:3000
5. Allow geolocation prompt

## Deployment

Push to GitHub → Vercel auto-deploys instantly. Live URL: https://chatbot-rosy-kappa.vercel.app (replace with your Vercel project)

## Next: Phase 2

- OpenStreetMap course detection
- USGS elevation integration
- Flight drawing tool (bezier curves + waypoint tagging)
- Tree hit detail forms
- Field practice mode
- Personal flight library per disc

---

**Home course:** Palmer Park, Detroit  
**Bag:** 14 discs (Discraft)  
**Users:** You + 5 testing crew
