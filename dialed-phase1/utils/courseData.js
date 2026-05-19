// Per-hole distances (feet) and pars for all supported courses
// Palmer/Kensington: distances estimated from terrain data (actual GPS-derived)
// Thorn, Grizzly, Cass Benton: UDisc Short Tees layout — sourced 2025

export const COURSE_HOLES = {
  palmer: {
    distances: [240, 295, 310, 265, 330, 285, 275, 315, 255, 280, 305, 265, 325, 290, 270, 345, 280, 315],
    pars: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  },
  kensington: {
    distances: [280, 410, 270, 315, 455, 285, 265, 305, 425, 270, 315, 285, 265, 435, 295, 325, 275, 300],
    pars: [3, 4, 3, 3, 4, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3, 3],
  },
  thorn: {
    // The Short Thorne layout — Pontiac Oaks County Park, Pontiac MI
    // UDisc: udisc.com/courses/the-thorne-at-pontiac-oaks-5IHy
    distances: [300, 275, 300, 269, 275, 225, 275, 500, 287, 310, 450, 250, 357, 275, 225, 275, 609, 350],
    pars: [3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 4, 3, 3, 3, 3, 3, 4, 3],
  },
  grizzly: {
    // Grizzly Oaks at Oakland University, Rochester Hills MI (concrete tee pads installed 2023)
    // UDisc: udisc.com/courses/grizzly-oaks-r09O — Hole 18 is par 4 (522 ft), all others par 3
    distances: [376, 318, 297, 276, 221, 359, 258, 278, 302, 371, 328, 216, 341, 216, 315, 208, 276, 522],
    pars: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4],
  },
  cass_benton: {
    // Cass Benton Hills, Northville MI (est. 1999) — Short Tees layout
    // UDisc: udisc.com/courses/cass-benton-hills-9hkZ — Hole 18 is par 4 (527 ft), all others par 3
    distances: [207, 278, 441, 219, 230, 263, 182, 372, 231, 196, 169, 267, 270, 196, 201, 232, 236, 527],
    pars: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4],
  },
}

// Returns distance in feet for a given course + 1-indexed hole number
export function getHoleDistance(courseKey, holeNumber) {
  return COURSE_HOLES[courseKey]?.distances[holeNumber - 1] ?? null
}

// Returns par for a given course + 1-indexed hole number
export function getHolePar(courseKey, holeNumber) {
  return COURSE_HOLES[courseKey]?.pars[holeNumber - 1] ?? 3
}

// Returns total par for a course
export function getCoursePar(courseKey) {
  return (COURSE_HOLES[courseKey]?.pars || []).reduce((s, p) => s + p, 0)
}
